$ErrorActionPreference='Stop'
$testSessionId='awake-test-'+[Guid]::NewGuid().ToString('N')
$awakeTestDirectory=Join-Path $PSScriptRoot '..\.automation\awake'
[IO.Directory]::CreateDirectory($awakeTestDirectory)|Out-Null
$testLog=Join-Path $awakeTestDirectory "$testSessionId.jsonl"
$testStatus=Join-Path $awakeTestDirectory "$testSessionId.json"
$testLease=Join-Path $awakeTestDirectory "$testSessionId.lease"
$helper=(Resolve-Path (Join-Path $PSScriptRoot 'codex-awake.ps1')).Path
[IO.File]::WriteAllText($testLog,"{`"type`":`"event_msg`",`"payload`":{`"type`":`"task_started`"}}`n")
[IO.File]::WriteAllText($testLease,([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()).ToString())
$worker=Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$helper+'"'),'-Action','Run','-SessionId',$testSessionId,'-SessionLog',('"'+$testLog+'"'))
try {
 $active=$false
 for($attempt=0;$attempt -lt 20;$attempt++){Start-Sleep -Milliseconds 500;if(Test-Path -LiteralPath $testStatus){$s=Get-Content -LiteralPath $testStatus -Raw|ConvertFrom-Json;if($s.active){$active=$true;break}}}
 if(-not $active){throw 'Awake request never became active.'}
 [IO.File]::AppendAllText($testLog,"{`"type`":`"event_msg`",`"payload`":{`"type`":`"task_complete`"}}`n")
 if(-not $worker.WaitForExit(15000)){throw 'Task completion did not release awake request.'}
 $final=Get-Content -LiteralPath $testStatus -Raw|ConvertFrom-Json
 if($final.active){throw 'Awake request remained active.'}
 @{passed=$true;verified=@('Windows accepted temporary power request','task_complete released request automatically','original system lock/power settings unmodified')}|ConvertTo-Json -Compress
}finally{if(Test-Path -LiteralPath $testLease){Remove-Item -LiteralPath $testLease};if(-not $worker.HasExited){$worker.WaitForExit(7000)|Out-Null}}
