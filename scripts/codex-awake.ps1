param([ValidateSet('Run','Pulse','Stop','Status')][string]$Action='Status',[string]$SessionId=$env:CODEX_THREAD_ID,[int]$OwnerProcessId=0,[int]$LeaseSeconds=180,[string]$SessionLog='', [int]$MaxHours=12)
$ErrorActionPreference='Stop'
if ($SessionId -notmatch '^[a-zA-Z0-9-]+$') { throw 'A valid Codex session ID is required.' }
$awakeDirectory=Join-Path $PSScriptRoot '..\.automation\awake'
[IO.Directory]::CreateDirectory($awakeDirectory) | Out-Null
$leaseFile=Join-Path $awakeDirectory "$SessionId.lease"
$statusFile=Join-Path $awakeDirectory "$SessionId.json"
if ($Action -eq 'Pulse') { [IO.File]::WriteAllText($leaseFile,([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()).ToString()); 'Awake lease renewed'; exit }
if ($Action -eq 'Stop') { if (Test-Path -LiteralPath $leaseFile) { Remove-Item -LiteralPath $leaseFile }; 'Awake lease released'; exit }
if ($Action -eq 'Status') { if (Test-Path -LiteralPath $statusFile) { Get-Content -LiteralPath $statusFile -Raw } else { '{"active":false}' }; exit }
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class RoadbookAwake {
 [DllImport("kernel32.dll", SetLastError=true)] public static extern uint SetThreadExecutionState(uint flags);
}
'@
$awakeMutex=New-Object Threading.Mutex($false,"Local\RoadbookAwake-$SessionId")
if (-not $awakeMutex.WaitOne(0)) { throw 'An awake helper already owns this session.' }
function Write-AwakeStatus([bool]$active,[string]$reason) { [IO.File]::WriteAllText($statusFile,(@{active=$active;reason=$reason;workerPid=$PID;ownerPid=$OwnerProcessId;leaseSeconds=$LeaseSeconds;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')} | ConvertTo-Json -Compress)) }
try {
 if ([RoadbookAwake]::SetThreadExecutionState([uint32]2147483651) -eq 0) { throw 'Windows refused the power request.' }
 Write-AwakeStatus $true 'display-and-system-idle-sleep-prevented'
 'Temporary display/system awake request active; no lock or registry policy changed.'
 $logOffset=0L; $logPending=''; $taskRunning=$true; $startedAt=[DateTimeOffset]::UtcNow
 while (Test-Path -LiteralPath $leaseFile) {
  $stamp=0L
  if (-not [long]::TryParse([IO.File]::ReadAllText($leaseFile),[ref]$stamp)) { break }
  if (($SessionLog -eq '' -or -not (Test-Path -LiteralPath $SessionLog)) -and [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()-$stamp -gt $LeaseSeconds) { break }
  if(([DateTimeOffset]::UtcNow-$startedAt).TotalHours -gt $MaxHours){break}
  if ($OwnerProcessId -gt 0 -and -not (Get-Process -Id $OwnerProcessId -ErrorAction SilentlyContinue)) { break }
  if($SessionLog -ne '' -and (Test-Path -LiteralPath $SessionLog)){
   $logStream=[IO.File]::Open($SessionLog,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
   try{if($logOffset -gt $logStream.Length){$logOffset=0};$logStream.Seek($logOffset,[IO.SeekOrigin]::Begin)|Out-Null;$logReader=New-Object IO.StreamReader($logStream);$logChunk=$logReader.ReadToEnd();$logOffset=$logStream.Position;$logReader.Dispose()}finally{$logStream.Dispose()}
   $logLines=($logPending+$logChunk).Split("`n");$logPending=$logLines[-1]
   for($logIndex=0;$logIndex -lt $logLines.Length-1;$logIndex++){
    if($logLines[$logIndex] -notmatch '"type"\s*:\s*"event_msg"'){continue}
    try{$logEvent=$logLines[$logIndex]|ConvertFrom-Json;if($logEvent.type -eq 'event_msg'){switch($logEvent.payload.type){'task_started'{$taskRunning=$true};'task_complete'{$taskRunning=$false};'turn_aborted'{$taskRunning=$false}}}}catch{}
   }
   if(-not $taskRunning){break}
  }
  [RoadbookAwake]::SetThreadExecutionState([uint32]2147483651) | Out-Null
  Start-Sleep -Seconds 5
 }
} finally { [RoadbookAwake]::SetThreadExecutionState([uint32]2147483648) | Out-Null; Write-AwakeStatus $false 'released'; $awakeMutex.ReleaseMutex(); $awakeMutex.Dispose() }
