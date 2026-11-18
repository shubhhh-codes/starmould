# Four daily independent SQL backups

## Daily targets and ownership

Production automatically captures full SQL at 10:00 AM, 12:30 PM, 4:00 PM and 7:00 PM in Asia/Kolkata. One database primary key per IST date/slot prevents duplicate scheduled jobs. Manual Generate & download remains separate and can create additional snapshots.

cron-job.org calls the APP directly every minute. The app starts a capture only when a slot is due. GitHub is manual-only; vercel.json has no competing automatic schedules. No GitHub token, local PC worker or always-on development server is needed.

The minute request records a heartbeat, reconciles due slots and atomically claims at most one eligible job. It returns 202/running before capture begins, using Next after() to run the server task within maxDuration=300 and a 240-second capture deadline. 202 means accepted, not completed. Repeated calls while a job is running/completed do not create another capture. A killed background function leaves a durable row; a later minute check can reclaim it after its 90-second lease expires.

## Retry and completion rules

New automatic attempts may start only in [slot time, slot time + 30 minutes). Up to three attempts are allowed, separated by a two-minute backoff. A capture started in that window can finish afterward within its execution deadline. Previous-day jobs are never captured overnight. Expired windows/exhausted retries become missed, not fake successes. Pausing stops new admissions but lets already active captures finish.

Full capture uses the SAME archive.cjs engine as GitHub manual backups: PostgreSQL custom dump, archive validation, then readable SQL. It includes public tables/data/sequences/views/functions/triggers/constraints/policies, not global roles, auth identities or photos. PostgreSQL 17.12 Linux x64 tools are bundled with the server; there is no request-time install or download. Capture time depends on database size and network.

A checkpoint containing the capture timestamp, file key, size and SHA-256 is saved before uploading. Every upload is read back and verified before database completion. If the process dies after upload, retry verifies/reuses that SQL rather than recapturing it. Unknown storage errors defer recovery; only a missing/corrupt candidate permits recapture. Attempt-specific SQL keys prevent a stale process overwriting a newer attempt. Only one manifest is committed per slot. Incomplete attempt objects are removed on recovery or by the seven-day orphan cleanup; no JSON/encrypted backup objects are created.

Retention is 90 days. Cleanup/artifact-copy errors do not invalidate a committed backup. Existing saved files remain available on /export; expand Automatic backup schedule & history for target time, capture time, attempts and error details.

## Required server configuration

Keep DATABASE_URL, optional BACKUP_DUMP_DATABASE_URL, BACKUP_CONTROL_DATABASE_URL, BACKUP_DATABASE_CA, BACKUP_JOBS_ENABLED=true and the existing BACKUP_R2_* credentials. BACKUP_R2_PREFIX is database for production and database-staging for staging. CRON_SECRET authenticates scheduler requests and is not a GitHub token. Never put secrets in URLs or upload .env files. Workstation BACKUP_DATABASE_CA_FILE paths do not belong on Vercel; use inline PEM there.

Run `node scripts/backup/cli.cjs migrate` with the target environment loaded before deploying. It applies the base coordinator migration and 20261118150000_backup_fixed_ist_slots.sql. Completed historical timestamps are preserved. The latter migration adds missed status and staged_manifest; it is idempotent.

## Activation checklist (deployment required)

1. Deploy the verified app bundle and confirm the Vercel project allows a 300-second Node route duration. Linux pg_dump/pg_restore assets must be present in both generate and cron function traces. A local build/test is not hosted verification.
2. Confirm an authenticated manual Generate & download succeeds on the deployed server and the SQL copy completes in R2. Restore a sample into an isolated database.
3. Change existing cron-job.org job 8705801 from the GitHub dispatch URL to `https://YOUR_PRODUCTION_DOMAIN/api/backup/cron`. Use POST, timezone Asia/Kolkata, every minute (`* * * * *`), Authorization header `Bearer <CRON_SECRET>`, no GitHub headers/body. Enable failure and recovery email notifications. Do not enable a new duplicate job alongside the old dispatch job.
4. Add a separate health-check job: GET the same URL with `?action=health` every five minutes, same authorization header. Enable failure/recovery email notifications. Health checks do NOT update the scheduler heartbeat, so they cannot hide a stopped wakeup job. A 503 reports stale heartbeat, paused automation or an overdue incomplete slot.
5. Confirm no other legacy job dispatches GitHub or calls old backup endpoints. GitHub schedule/repository_dispatch and Vercel automatic crons are removed in this release; do not restore them during rollout.
6. Observe all four production slots for one full day. Check scheduled and captured IST times, one verified completed file per slot and no overnight new captures. Scheduler acceptance alone is not evidence of backup success.

The external service targets each minute but is not a real-time guarantee. Provider/network/database outages may cause retries or honest missed slots. The app cannot recreate database state from a past uncaptured moment.

## Validation

Unit/route tests exercise exact UTC mappings, quick admission/background execution, duplicate exclusion, authorization, pause, integrity and checkpoint reuse. The disposable PostgreSQL suite checks real concurrent claims, expired leases, fencing, all four time-window boundaries, retry limits and idempotent migrations. With PostgreSQL test tools it captures/restores real SQL and checks data, functions, views, policies and sequences. Production rollout and a full-day observation remain separate acceptance steps.
