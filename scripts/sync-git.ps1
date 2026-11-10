param([switch]$Push)
$ErrorActionPreference = 'Stop'
$repoPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$gitArgs = @('-c', "safe.directory=$repoPath", '-C', $repoPath)
$sshCommand = & git @gitArgs config --local --get core.sshCommand
if (!$sshCommand) { throw 'Configure the paired local SSH key first. Do not send a private key in chat.' }
& git @gitArgs fetch origin
if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed. No remote files were changed.' }
& git @gitArgs rev-list --left-right --count HEAD...origin/main
if ($LASTEXITCODE -ne 0) { throw 'Could not compare local and remote history.' }
& git @gitArgs push --dry-run origin HEAD:main
if ($LASTEXITCODE -ne 0) { throw 'Write-permission check failed; no forced update was attempted.' }
if ($Push) {
    & git @gitArgs push origin HEAD:main
    if ($LASTEXITCODE -ne 0) { throw 'Push failed. Resolve divergence without force-push.' }
    & git @gitArgs fetch origin
    if ($LASTEXITCODE -ne 0) { throw 'Could not verify remote after push.' }
    $localHead = & git @gitArgs rev-parse HEAD
    $remoteHead = & git @gitArgs rev-parse origin/main
    if ($localHead -ne $remoteHead) { throw 'Local and remote versions still differ.' }
    Write-Output "Verified synchronized commit: $localHead"
} else {
    Write-Output 'Fetch and push-permission checks passed. Run with -Push to publish the already committed local changes.'
}
& git @gitArgs status --short --branch
