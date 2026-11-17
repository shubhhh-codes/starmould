$ErrorActionPreference = 'Stop'
$repoPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Set-Location -LiteralPath $repoPath
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
$workerEnv = Join-Path $repoPath '.env.backup.local'
if (-not (Test-Path -LiteralPath $workerEnv)) { throw 'Create .env.backup.local from the backup environment template first.' }
$toolBin = Join-Path $repoPath '.backup-tools\postgres17\bin'
$env:PG_DUMP_BIN = Join-Path $toolBin 'pg_dump.exe'
$env:PG_RESTORE_BIN = Join-Path $toolBin 'pg_restore.exe'
$env:BACKUP_DATABASE_CA_FILE = Join-Path $repoPath '.backup-tools\supabase-ca.crt'
$env:BACKUP_PGSSLROOTCERT = $env:BACKUP_DATABASE_CA_FILE
if (-not (Test-Path -LiteralPath $env:PG_DUMP_BIN)) { throw 'Run install-postgres-tools.cjs first.' }
$logPath = Join-Path $repoPath '.backup-logs'
New-Item -ItemType Directory -Force -Path $logPath | Out-Null
# No detached promise/process inside the app: Task Scheduler owns this worker.
$workerArguments = "--env-file=`"$repoPath\.env.local`" --env-file=`"$repoPath\.env.backup.local`" `"$repoPath\automation\db-backup-service\service.cjs`""
$workerProcess = Start-Process -FilePath $nodePath -ArgumentList $workerArguments -WorkingDirectory $repoPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logPath 'worker.log') -RedirectStandardError (Join-Path $logPath 'worker-error.log') -PassThru
Set-Content -LiteralPath (Join-Path $logPath 'worker.pid') -Value $workerProcess.Id
$workerProcess.WaitForExit()
exit $workerProcess.ExitCode
