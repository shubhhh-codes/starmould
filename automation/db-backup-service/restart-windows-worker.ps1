$ErrorActionPreference = 'Stop'
$repoPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$tasks = @(Get-ScheduledTask -TaskName 'StarMould-DatabaseBackup-*' | Where-Object { $_.Actions.WorkingDirectory -eq $repoPath })
if ($tasks.Count -ne 1) { throw 'Expected exactly one backup task for this checkout.' }
Stop-ScheduledTask -TaskName $tasks[0].TaskName
$pidFile = Join-Path $repoPath '.backup-logs\worker.pid'
if (Test-Path -LiteralPath $pidFile) {
  $workerId = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
  $worker = Get-CimInstance Win32_Process -Filter "ProcessId = $workerId"
  if ($worker -and $worker.Name -eq 'node.exe' -and $worker.CommandLine.Contains("$repoPath\automation\db-backup-service\service.cjs")) {
    Stop-Process -Id $workerId -Force
  }
}
Start-ScheduledTask -TaskName $tasks[0].TaskName
Write-Output 'Restarted this checkout backup task. Interrupted jobs recover after lease expiry.'
