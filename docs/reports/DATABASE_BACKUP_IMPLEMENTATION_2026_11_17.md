# Database backup implementation and rollout status

Implemented 17 November 2026. User clarified that no VPS/cloud compute host is available, so the selected fallback executor is the existing Windows workstation; the container deployment remains optional.

## Implemented

- Four GitHub primary slots preserved: 10:05 AM, 12:35 PM, 04:05 PM, 07:05 PM IST.
- Durable PostgreSQL private coordinator, atomic claims, renewable leases, fencing, bounded retries and a shared pause state.
- A consistent pg_dump archive and SQL derived from that archive; AES-256-GCM encryption, per-file checksums, verified R2 persistence and 90-day retention.
- Independent background reconciler and durable manual-job worker, with no Next.js request-lifetime dependency.
- Administrator Backup Now, status/history, encrypted downloads, pause/resume and honest offline/activation states under Settings -> Backup.
- Windows portable PostgreSQL 17 tools and Task Scheduler install/start/restart scripts, plus configuration helpers that reuse existing database/R2 services. No PostgreSQL server installation or new hosting subscription.
- PostgreSQL 17 was verified on the actual source database. Capture checks server/tool major-version compatibility. Supabase CA trust is configured without disabling certificate/hostname verification.

## Local setup actually performed

- Downloaded portable PostgreSQL 17 client tools into ignored `.backup-tools/`, validating ZIP entries and tool execution.
- Created ignored `.env.backup.local`, restricted to the Windows user and SYSTEM, preserving its generated recovery key across reconfiguration. No secrets were printed or committed.
- Applied the private backup coordinator migration to the configured database. Existing ERP data/schema were not changed by this migration.
- Reused the existing reachable R2 bucket under `database/`; no new R2 account or bucket was created. Backup cleanup is prefix-scoped; photo retention is record-key-based.
- Registered and started `StarMould-DatabaseBackup-7C2EFBD094` for the current Windows user at login, hidden, with automatic restart. Verified the task running and its live worker heartbeat after restart.
- Executed a live manual smoke backup: completed with two encrypted payloads persisted and read-back verified in R2. No live database restore was performed.
- Enabled the local app backup UI configuration in ignored `.env.local`; restart Next.js to load the environment.

## Live activation completed

Backup automation was published separately to main in commit 8c75a20, preserving unrelated staged app/photo changes. Repository-scoped storage/encryption/database secrets and activation variables were configured without printing secret values. The workflow installs its isolated dependency package so it does not depend on unpublished app package changes.

A live GitHub manual verification completed successfully: https://github.com/shubhhh-codes/starmould/actions/runs/44024069488. The coordinator confirmed completed status on the first attempt. The four cron expressions are unchanged.

After that success, `BACKUP_FALLBACK_ENABLED=true` was set locally and the Windows task restarted. The coordinator's schedule activation epoch was advanced to cutover time, and only unclaimed queued pre-cutover slots were marked expired/PRE_CUTOVER_SLOT. This prevents treating successful legacy artifact-only runs earlier that day as missed coordinated slots. New slots after cutover are covered by the paired primary/fallback system. The app UI changes remain part of the local pending app release; no unrelated app/photo changes were published.

No independent external uptime monitor or notification destination is configured. Loopback `/monitor`, app status and local logs are available. No external messages were sent.

The PC must be on, online and logged into its configured Windows user for local fallback/manual processing. GitHub remains primary when the PC is unavailable. Neither path can recreate a historical recovery point after an outage. Protect an offline copy of the recovery key before relying on the encrypted archives.

## Verification

- Focused backup contract tests: slot/date mapping, authenticated encryption, tamper/wrong-key rejection, TLS configuration, corrupt storage rejection, duplicate trigger skip, stale-lease handling and failure-before-commit behavior.
- Real disposable PostgreSQL tests: idempotent migration, concurrent manual admission/claims, lease generations and fencing, pause, primary grace, retry backoff/budget, background capture of missed GitHub slots and monitoring.
- Actual pg_dump -> encryption -> decryption -> isolated pg_restore round trip with Unicode/JSON/numeric values, restored function and identity sequence checks.
- Administrator API tests: unauthenticated/manager denial, same-origin mutation admission, setup gating, idempotency, private metadata, pause and completed-only short-lived download redirects.
- Headless Chrome UI checks: manual enqueue, status, encrypted downloads, pause/resume, unavailable/setup states and mobile layout. Desktop/mobile screenshots visually inspected.
- TypeScript, focused ESLint, workflow/Compose parsing, PowerShell parsing/task validation, production build and existing regression suite passed during implementation. New unit/route checks are included in the normal regression runner.
- Container image build was not executed because Docker is unavailable here; Windows is the selected tested deployment.

Activation and recovery instructions: [database backup runbook](../operations/DATABASE_BACKUP_RUNBOOK.md).
