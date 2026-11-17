[CmdletBinding()]
param([switch]$StartNow, [switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
$repoPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$workerScript = Join-Path $PSScriptRoot 'start-windows-worker.ps1'
$workerEnv = Join-Path $repoPath '.env.backup.local'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
if (-not (Test-Path -LiteralPath $workerEnv)) { throw 'Configure .env.backup.local before registering the task. See the runbook.' }
if (-not (Test-Path -LiteralPath (Join-Path $repoPath '.backup-tools\postgres17\bin\pg_dump.exe'))) { throw 'Install the portable PostgreSQL tools first.' }
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$hash = [System.Security.Cryptography.SHA256]::Create()
try { $repoId = ([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($repoPath)))).Replace('-', '').Substring(0, 10) }
finally { $hash.Dispose() }
$taskName = "StarMould-DatabaseBackup-$repoId"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -File `"$workerScript`"" -WorkingDirectory $repoPath
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
if ($ValidateOnly) { Write-Output "Validated task configuration: $taskName (no task registered)"; return }
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'StarMould manual backup queue and five-minute missed-slot fallback. Requires this PC, internet and user session.' -Force | Out-Null
if ($StartNow) { Start-ScheduledTask -TaskName $taskName }
Write-Output "Registered $taskName for $currentUser. It starts at login; no VPS, Docker or stored Windows password required."
