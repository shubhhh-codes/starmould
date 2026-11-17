# Database backup operations

## What runs

GitHub is primary at **10:05 AM, 12:35 PM, 04:05 PM and 07:05 PM Asia/Kolkata**.
An independently hosted container checks due slots every five minutes and processes durable manual jobs every 15 seconds. After a 15-minute primary grace it may claim a missing slot. A valid running primary lease prevents duplicate capture. Three attempts per slot are allowed, with two-minute backoff; a running attempt renews a 90-second lease and has a 12-minute deadline.

The authoritative manifest is the fenced `backup_control.jobs` database row. Uploaded R2 manifests are attempt-specific; never assume an unreferenced object is a completed scheduled slot. Losing workers cannot mark newer generations complete. Late captures display their actual capture time and do not recreate historical data at the missed time. If the source database/coordinator is lost, operators can still retrieve encrypted payloads and their attempt manifests directly from R2 using separately protected credentials, verify checksums, decrypt and restore. The coordinator schema is intentionally outside the default public-schema archive; reapply its migration after disaster recovery. Historical app backup listings will need separate reconstruction from operator-verified R2 manifests.

## Windows setup without a new server (selected deployment)

The user has no VPS/container hosting account. Run the independent worker on the existing Windows workstation with Task Scheduler. Existing Supabase/database and R2 services are reused; no new hosting account, Docker or paid VPS is required. The worker runs independently of Next.js and browser tabs, starts at login, restarts on failure and reconciles after reconnect. **The PC must be powered on, have internet and have its configured Windows user logged in.** When it is off, GitHub remains primary; this is not an always-on remote fallback or a way to capture historical snapshots during an outage.

Commands from the repository root, in order:

```powershell
node automation/db-backup-service/install-postgres-tools.cjs
node --env-file=.env.local automation/db-backup-service/configure-windows.cjs
node --env-file=.env.local --env-file=.env.backup.local scripts/backup/cli.cjs migrate
.\automation\db-backup-service\install-windows-task.ps1 -StartNow
node --env-file=.env.local --env-file=.env.backup.local automation/db-backup-service/enable-local-ui.cjs
```

Wait approximately 15 seconds after starting the task for its first heartbeat before enabling the UI. Restart Next.js afterwards. Configuration preserves an existing recovery key, restricts the new ignored `.env.backup.local` to the Windows user/SYSTEM, and never prints secrets. Keep an offline copy of the encryption key. Portable tools are downloaded from the official EDB PostgreSQL 17 archive over HTTPS, extracting only client executables/DLLs with ZIP CRC validation; no PostgreSQL Windows server is installed. `.backup-tools/` and `.backup-logs/` are ignored.

If only the existing R2 bucket is accessible, local configuration reuses it under the exclusive `database/` prefix. Existing photo cleanup removes photo-record keys, while database cleanup lists only `database/`. Do not add a bucket-wide photo expiry rule that would delete database payloads. A dedicated private bucket with scoped credentials remains preferable when account access permits; it is not required to obtain another server/account.

The generated worker config initially sets `BACKUP_FALLBACK_ENABLED=false`: manual jobs run, but legacy artifact-only GitHub successes must not be misclassified as missed coordinated slots. Deploy the updated YAML and shared scripts, configure GitHub secrets and enable `BACKUP_AUTOMATION_ENABLED`, then set `BACKUP_FALLBACK_ENABLED=true` in `.env.backup.local` and restart the scheduled task. Do not activate one half of the coordinated schedule without the other. The monitor server binds loopback only; no public network access is opened.

Task name includes a hash of the checkout path. Inspect with `Get-ScheduledTask -TaskName 'StarMould-DatabaseBackup-*'`; stop/start its exact name with Stop-ScheduledTask/Start-ScheduledTask. Logs are in `.backup-logs/worker.log`, containing only safe event codes/job IDs. Moving/deleting the checkout requires updating/unregistering the task. This user-session task does not run while logged out; an administrator-managed system service is an optional future deployment. Independent external uptime alerts remain unconfigured without a reachable endpoint/monitoring provider; app status and local job logs are available.

## Remote/container alternative and activation gates

Committing the code alone does not deploy it. See the rollout report for local setup actually performed. **GitHub deployment/secrets/activation, fallback cutover and external monitoring are separate live gates.** The existing four-slot legacy GitHub export remains active until the repository variable `BACKUP_AUTOMATION_ENABLED=true` is set. Do not enable it until the paired worker setup and verification are complete.

The fallback container is an always-on process with background reconciliation, not an HTTP backup request and not another GitHub dispatch. Host it on a VPS or managed always-on container service independent of GitHub. The supplied Compose configuration is ready for an existing Docker server; it is not a hosted server subscription. Private source is used only when building/deploying the image, not fetched per capture.

## One-time setup

1. Create a **dedicated private R2 bucket** for database archives. Issue bucket-scoped read/write credentials and keep them separate from movement-photo credentials. Configure automatic abort of incomplete multipart uploads after seven days; do not configure blanket expiry on referenced completed sets younger than 90 days.
2. Generate a 32-byte encryption key: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Generate a separate >=32-character monitor secret. Enter these only in secret stores; retain a protected offline recovery-key copy. Losing the key loses access to encrypted archives. Never paste secrets in an issue or commit.
3. Use a direct or session-pooler database URL suitable for pg_dump and a verified TLS connection. URLs must percent-encode passwords. Set `BACKUP_DUMP_DATABASE_URL` when its connection differs from the app's URL. `BACKUP_CONTROL_DATABASE_URL` optionally separates coordinator permissions/connections. Keep `DATABASE_URL` as a compatible fallback.
4. Apply `supabase/migrations/20261117120000_database_backup_jobs.sql` through your established migration process. Alternatively run `node --env-file=.env.local scripts/backup/cli.cjs migrate` with the intended database credentials. The migration creates only the private coordinator schema/tables. It is idempotent, does not expose PostgREST tables and does not alter ERP records. `enabled_at` prevents manufacturing a backlog from before activation.
5. In `automation/db-backup-service/`, copy `.env.example` to the ignored `.env` and supply the real values. Default `BACKUP_SCHEMAS=public` covers ERP data and schema definitions. Additional schemas may be comma-separated after testing their restore dependencies. Use PostgreSQL tooling compatible with the server; the supplied image uses PostgreSQL 17 (matching the source database verified during implementation) and Node 24. Capture rejects a server/tool major-version mismatch. When upgrading the database, update the GitHub container version and the Docker build argument POSTGRES_MAJOR together. Increase memory/tmp capacity for larger databases after measuring encrypted and plaintext temporary sizes.
6. On the independent Docker host, from that directory, run `docker compose build` then `docker compose up -d`. It listens on loopback port 8085 by default. Put an HTTPS reverse proxy in front of `/monitor` for your external monitor; preserve the Authorization header. No public backup-trigger endpoint is exposed. For managed hosting deploy the same image as an always-on service, set its secrets and PORT, and allow graceful termination for active attempts.
7. Set application environment `BACKUP_JOBS_ENABLED=true` plus its coordinator database access and dedicated backup R2 credentials. The application does not need the archive encryption key to enqueue/status/download encrypted archives. Redeploy the app. Settings -> Backup now shows the service heartbeat, **Backup Now**, per-job status, encrypted downloads and pause/resume.
8. Set the matching GitHub Actions secrets: `DATABASE_URL`, optional `BACKUP_CONTROL_DATABASE_URL`, optional `BACKUP_DUMP_DATABASE_URL`, optional `BACKUP_DATABASE_CA`, `BACKUP_R2_ACCOUNT_ID`, `BACKUP_R2_BUCKET`, `BACKUP_R2_ACCESS_KEY_ID`, `BACKUP_R2_SECRET_ACCESS_KEY`, and `BACKUP_ENCRYPTION_KEY`. Repository variables: `BACKUP_ENCRYPTION_KEY_ID=v1`, `BACKUP_SCHEMAS=public`, then `BACKUP_AUTOMATION_ENABLED=true`. Inspect existing cron/webhook callers of the old `/api/backup/cron` endpoint and retire their automatic schedule before cutover to avoid extra exports.
9. Test an app manual backup and GitHub **Actions -> StarMould Automated Database Backup -> Run workflow**. Both should persist verified archives. Observe all four scheduled slots and simulate a missed primary with an isolated test slot. Restore an archive into an isolated target before declaring recovery verified. Source visibility need not change; private repository checkout uses GITHUB_TOKEN with contents:read.

For certificate authorities, the Node coordinator can use `BACKUP_DATABASE_CA` (PEM). libpq uses `BACKUP_PGSSLROOTCERT`, a readable mounted certificate path; set that separately when needed. The capture command defaults libpq to verify-full. Do not disable TLS verification for production. Local test URLs alone use sslmode=disable.

## Monitoring

An external monitor on a provider separate from the worker polls `GET /monitor` over HTTPS with `Authorization: Bearer <BACKUP_MONITOR_SECRET>` every five minutes. A 200 means the worker is fresh, no due slot older than 30 minutes is missing, no observed recent slot completed late, and no recent slot required fallback. A 503 JSON body distinguishes `paused`, `workerHealthy`, `overdue`, `recovered`, and `late`. Database unavailability returns 503 as well. Configure outage and recovery notifications to an owner-selected destination. Notification delivery has not been performed by this implementation.

Fallback recovery remains visible as degraded primary health for the reconciliation window (yesterday and today), even though the archive is usable. Check `source=fallback` jobs to troubleshoot GitHub inactivity, runner queues, billing or workflow errors. A fixed three-hour heartbeat is unsuitable because of the overnight gap.

## Manual operation and pause

Only administrators can use the new queued backup APIs and downloads. UI requests require same-origin authentication. Admission is bounded to three active/recent manual jobs and repeat idempotency keys return the original job. Jobs survive app/page restarts. An offline worker is shown honestly and disables the UI create button.

Pause/resume the shared saved-backup system from Settings -> Backup, or run `node scripts/backup/cli.cjs pause` / `resume` with coordinator environment supplied. Pause prevents new claims, renewals and completion, including on GitHub; queued jobs remain. Existing direct SQL/JSON convenience downloads and any legacy cron integrations are separate and must be stopped separately if a complete system maintenance freeze is required.

## Download and restore

Saved downloads are `database.dump.enc` and `database.sql.enc`; the SQL is generated from the same pg_dump archive. They include selected-schema structure and data from a consistent snapshot. Existing direct JSON/SQL export buttons are retained as data-only convenience tools, not exact rollback/full schema recovery.

1. Download a completed archive from Settings -> Backup (the signed URL expires in 60 seconds). Record its job ID and recovery key ID from the operator's manifest. R2 objects are private and encrypted.
2. On a trusted recovery machine, supply the matching `BACKUP_ENCRYPTION_KEY` through a secret environment and run `node scripts/backup/cli.cjs decrypt database.dump.enc recovered.dump`. The command refuses to overwrite an existing output and publishes plaintext only after GCM authentication succeeds. Never commit decrypted files.
3. Inspect `pg_restore --list recovered.dump`. Restore only into a disposable/empty compatible PostgreSQL or prepared Supabase test project first. For an empty local test database, `pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl --dbname=<ISOLATED_TEST_DATABASE> recovered.dump` handles the pre-existing public schema. **--clean is destructive on the selected target: this example is exclusively for an isolated test database.** Do not run it against the live database.
4. Check representative ERP row counts and relationships, functions, policies, sequence-generated IDs and app reads. Supabase roles, extensions, managed schemas and external schema references may require target preparation. Default public-only archives do not contain auth identities, global roles, Storage object bytes or R2 photos; protect these separately. A public-schema archive is not a complete Supabase account restore.
5. Plan live restoration separately using the verified target-specific procedure, downtime and a pre-restore snapshot. Never perform a live restore just to test a backup.

AES format: ASCII `SMBK1`, 12-byte random IV, AES-256-GCM ciphertext, 16-byte authentication tag. Keep old encryption keys until all archives using their key IDs expire. Rotate by changing the encryption key and key ID together in both runtimes; downloads need the historical matching key.

## Retention and cost

The fallback service expires referenced completed sets after 90 days, then removes unreferenced objects older than seven days. Recent valid sets are not deleted after a failed attempt. A per-attempt unique prefix prevents deletion of another generation. R2 incomplete multipart lifecycle handles hard-crash leftovers. Expired jobs remain as metadata with status=expired, without payload manifests.

There are approximately 120 scheduled sets per 30-day month, up to 360 retained at 90 days, plus manual sets. Each set has encrypted dump and SQL payloads. Budget for compressed archive/SQL sizes, R2 storage/operations, database egress/read-back checks, independent host and monitoring, and private GitHub Actions compute. New-mode GitHub does not mirror archives into Actions storage; R2 is authoritative. Legacy-mode artifacts retain their existing 90-day policy until cutover. Private-repository mode still depends on GitHub account/billing for the primary; the independently running fallback does not.

## Verification commands

- `node --test scripts/test-database-backups.cjs`
- `node scripts/test-backup-routes.cjs`
- `node scripts/test-backup-ui.cjs`
- `npm run typecheck`
- Disposable native PostgreSQL test: install `embedded-postgres` in an external QA directory, set `BACKUP_TEST_TOOLS` to that directory, and run `node scripts/test-database-backups-db.cjs`. Optional `PG_DUMP_BIN` and `PG_RESTORE_BIN` paths enable the real encrypted archive/restore round trip. This test never reads .env.local or connects to production.

Sources: [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [GitHub scheduling](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [private Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [Supabase recovery limits](https://supabase.com/docs/guides/platform/backups).

