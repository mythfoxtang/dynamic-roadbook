param([switch]$Push)
$ErrorActionPreference = 'Stop'
$repoPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$keyPath = Join-Path $repoPath '.deploy_keys/codex_dynamic_roadbook_2026_06_15'
$hostsPath = Join-Path $repoPath '.git_known_hosts'
if (!(Test-Path -LiteralPath $keyPath) -or !(Test-Path -LiteralPath $hostsPath)) {
    throw 'Existing project SSH key or verified known-hosts file is missing. No credentials were changed.'
}
try {
    $keyStream = [System.IO.File]::OpenRead($keyPath)
    $keyStream.Dispose()
} catch {
    throw 'Current Windows account cannot read the project SSH key. Run this script from your own PowerShell window; do not send the key in chat.'
}
$sshCommand = 'ssh -i "' + $keyPath.Replace('\','/') + '" -o IdentitiesOnly=yes -o UserKnownHostsFile="' + $hostsPath.Replace('\','/') + '" -o StrictHostKeyChecking=yes -o BatchMode=yes -o ConnectTimeout=15'
& git -C $repoPath config --local core.sshCommand $sshCommand
if ($LASTEXITCODE -ne 0) { throw 'Could not save repository-local SSH configuration.' }
& git -C $repoPath fetch origin
if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed. No remote files were changed.' }
& git -C $repoPath rev-list --left-right --count HEAD...origin/main
if ($LASTEXITCODE -ne 0) { throw 'Could not compare local and remote history.' }
& git -C $repoPath push --dry-run origin HEAD:main
if ($LASTEXITCODE -ne 0) { throw 'Write-permission check failed; no forced update was attempted.' }
if ($Push) {
    & git -C $repoPath push origin HEAD:main
    if ($LASTEXITCODE -ne 0) { throw 'Push failed. Resolve divergence without force-push.' }
    & git -C $repoPath fetch origin
    if ($LASTEXITCODE -ne 0) { throw 'Could not verify remote after push.' }
    $localHead = & git -C $repoPath rev-parse HEAD
    $remoteHead = & git -C $repoPath rev-parse origin/main
    if ($localHead -ne $remoteHead) { throw 'Local and remote versions still differ.' }
    Write-Output "Verified synchronized commit: $localHead"
} else {
    Write-Output 'Fetch and push-permission checks passed. Run with -Push to publish the already committed local changes.'
}
& git -C $repoPath status --short --branch
