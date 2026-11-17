# Database backup operations

Backups are plain, readable `database.sql` files. No encryption key, password, decrypt command or .enc payload is used. R2 remains private; app listing/download routes require administrator authentication and issue short-lived download links.

## Automatic execution

GitHub primary runs at 10:05 AM, 12:35 PM, 04:05 PM and 07:05 PM IST. The Windows worker reconciles missed slots after a 15-minute grace, using shared database leases and checksum verification. The PC must be powered on, online and logged in for Windows fallback/manual jobs. Vercel only queues manual jobs and serves status/downloads; it does not execute pg_dump.

Capture uses version-compatible pg_dump to obtain a consistent snapshot, validates its temporary archive, then exports SQL with pg_restore. Only readable SQL and a manifest are uploaded. The temporary archive is removed. R2 read-back SHA-256 and size are checked before the fenced coordinator marks completion. Retention is 90 days. Photos/object bytes are outside this database snapshot.

## Download

Open the admin Database Backups page at /export. It lists files under database/ in the configured R2 bucket with upload times, sizes and download links. No file upload by the user is required. Alternatively use Cloudflare R2 dashboard and download database.sql from its date/slot/attempt folder. The manifest describes coverage and checksums; a stored attempt file alone is not proof of completed job status.

SQL opens directly in a text editor. To restore, first use an isolated compatible PostgreSQL/Supabase target and psql with ON_ERROR_STOP enabled. Prepare required roles/extensions/managed schemas on the target. Never restore to production merely for QA. Default public-schema coverage does not include global roles, Supabase auth identities or photo bytes.

## Configuration

App/Vercel: BACKUP_JOBS_ENABLED=true, BACKUP_CONTROL_DATABASE_URL pointing to the matching coordinator, BACKUP_R2_ACCOUNT_ID, BACKUP_R2_BUCKET, BACKUP_R2_ACCESS_KEY_ID, BACKUP_R2_SECRET_ACCESS_KEY, and BACKUP_DATABASE_CA with the Supabase PEM. Local CA_FILE paths are for the Windows workstation, not Vercel. Redeploy after Vercel environment changes.

Worker: use ignored .env.backup.local with database, R2, monitor secret and verified TLS settings. No BACKUP_ENCRYPTION_KEY or BACKUP_ENCRYPTION_KEY_ID is required. Existing database/R2 settings remain unchanged. Never upload real env files to Git.

GitHub: database/R2 secrets plus BACKUP_AUTOMATION_ENABLED=true and BACKUP_SCHEMAS=public. No encryption secret or key-ID variable is required. The workflow installs isolated automation/db-backup-service dependencies.

Windows restart: automation/db-backup-service/restart-windows-worker.ps1. Setup helpers and portable PostgreSQL 17 tools are under that directory. The task starts at user login, hidden. Logs and tools remain ignored under .backup-logs and .backup-tools. Do not point staging at the production coordinator. Staging needs its own worker and isolated storage before enabling jobs.

## Monitoring and QA

GET /monitor requires the configured BACKUP_MONITOR_SECRET. It reports worker freshness, pause state, missing slots, fallback recoveries and late completions. External alert delivery requires an independently configured reachable monitor; it is not implicitly provided by the local task.

Checks:
- node --test scripts/test-database-backups.cjs
- node scripts/test-backup-routes.cjs
- node scripts/test-backup-archives.cjs
- node scripts/test-backup-ui.cjs
- npm run typecheck
- npm run build

Disposable database QA uses scripts/test-database-backups-db.cjs with BACKUP_TEST_TOOLS, PG_DUMP_BIN, PG_RESTORE_BIN and optional PSQL_BIN. It restores readable SQL into an isolated local database and verifies data, functions and sequences, without encryption keys.

## Historical transition

Encryption was removed at the user's request. Existing completed encrypted SQL backups were converted and read-back verified; obsolete .enc objects were removed. Prior rollout reports describe historical encryption tests and are not current configuration instructions.
