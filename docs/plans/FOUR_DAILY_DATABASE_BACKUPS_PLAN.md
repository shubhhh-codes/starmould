# Four daily database backups: implementation plan

Date: 17 November 2026
Status: Backup automation published, GitHub secrets/variables configured, live GitHub backup verified, and Windows fallback activated. Local manual backup and migration verified. Independent external notifications remain unconfigured; app UI changes await the separate app release. See `docs/reports/DATABASE_BACKUP_IMPLEMENTATION_2026_11_17.md` and the operations runbook.

## Objective and schedule

Keep four verified database recovery points every day after active development ends, without periodic source edits. Preserve the current workflow's five-minute offsets; the user's times are treated as approximate references to these existing slots.

| Slot | Asia/Kolkata time | UTC cron |
| --- | --- | --- |
| morning | 10:05 AM | `35 4 * * *` |
| midday | 12:35 PM | `5 7 * * *` |
| afternoon | 04:05 PM | `35 10 * * *` |
| evening | 07:05 PM | `35 13 * * *` |

Four scheduled recovery points means four successful logical slot records per IST date. Retries and manual snapshots are separate concepts. Scheduling cannot guarantee execution at the exact second. Proposed target: verified completion within 30 minutes of each slot, otherwise alert. Do not quietly label a late snapshot as one captured at its scheduled time.

## Current evidence

- `.github/workflows/db-backup.yml` already defines these four slots, manual dispatch, and repository dispatch.
- GitHub repository was verified PUBLIC earlier in this session. GitHub documents automatic inactivity disabling for public scheduled workflows after 60 days.
- Workflow calls `scripts/backup-db.mjs`, uploads SQL/JSON artifacts for 90 days, and uses a 15-minute job timeout.
- Exporter selects public base tables with four exclusions. It generates data upserts, not a complete schema-and-data disaster recovery dump. Reads of separate tables are not protected by a single consistent database snapshot.
- Workflow report hardcodes 22 tables, 45,000+ rows and a duplicate-risk claim; these are not evidence of a successful export or restore.
- `/api/backup/cron` has a separate implementation that stores exports in private Supabase Storage with read-back checksum verification and 30-day retention. Its deployment and scheduler configuration are unverified.
- Existing R2 application code primarily serves movement photos and allows a development filesystem fallback. Production database backup storage must use separate configuration and fail closed if cloud storage is unavailable.
- The worktree contains substantial existing photo-related changes. Implementation must preserve those changes and avoid staging or modifying unrelated work.

## Confirmed architecture revision after user clarification

The user confirmed three required paths: an app manual backup button, four automatic GitHub YAML backups, and an external background cron that captures a fallback backup if a scheduled GitHub backup does not complete. The source repository must support becoming private. This replaces the earlier dispatcher-first proposal; GitHub YAML is primary and independent execution is fallback.

### Primary and fallback responsibilities

- PRIMARY: existing GitHub YAML retains 10:05 AM, 12:35 PM, 04:05 PM and 07:05 PM IST. Its job runs the shared backup command and writes a verified completion manifest to private R2.
- FALLBACK: an external reconciler runs every five minutes. After a proposed 15-minute primary grace, it checks durable slot completion and active leases. If the slot is missing and safely claimable, it starts the same backup command on an independent managed container/job runtime with PostgreSQL tooling. It does not dispatch another GitHub workflow and does not require GitHub App credentials.
- MANUAL: an administrator-only Backup Now button calls an authenticated API that durably enqueues a separate manual snapshot and returns a job ID. The independent service executes it. Status shows queued/running/completed/failed and enables authorized download only after verified persistence. GitHub Run workflow remains an operations alternative.
- Proposed target remains completion within 30 minutes per scheduled slot, otherwise alert. Sustained outages cannot guarantee on-time capture; late recovery records the actual capture time.

### Independent runtime and shared coordination

Deploy the backup tool as a container to an independently scheduled job platform selected from available accounts before rollout. Build/deploy from private source on release; do not fetch GitHub source on every fallback run. A Cloudflare scheduled Worker can invoke/reconcile jobs, but cannot be assumed to execute pg_dump. Existing /api/backup/cron must not become a long-running fallback request: inspect its existing callers and, where appropriate, adapt it to short authenticated enqueue/status operations.

Both runtimes must use a shared durable atomic slot lease with expiry, renewal, bounded deadlines and fencing tokens. GitHub concurrency and a read-then-write R2 existence check are insufficient distributed locking. Completion publication must reject stale workers. A date/slot has one authoritative completed set, while partial attempts are separately cleaned. Manual jobs use unique IDs and request idempotency keys, and do not replace scheduled slots. One persistent global pause is respected by GitHub, fallback and retries.

### Manual app implementation

Inspect the existing export/admin screen and authorization conventions before choosing placement. Read the installed Next.js route and server/client guides before application edits. Add an administrator POST enqueue endpoint returning 202/job ID, an authenticated status endpoint and an authorized streaming download or short-lived signed URL. Follow project CSRF/origin conventions and limits. Do not expose database, storage or service credentials to the browser, and do not buffer a whole large archive in browser memory. Double-clicks/retries must not create accidental duplicate jobs. Clearly show format and decryption-key requirements. Ordinary users must not create jobs, inspect metadata or download backups.

### Revised rollout and completion gates

1. Implement the common archive/export, encryption, manifest and verification work specified in this plan, reusable by both executors.
2. Implement and test shared cross-runtime lease/fencing behavior, primary YAML, independent service and reconciler.
3. Implement the app manual button and enqueue/status/download access controls.
4. Configure a separate monitor for four completed-slot heartbeats, with 30-minute grace. Also surface repeated primary failures even if fallback succeeds. Prepare delivery hooks without sending external messages absent explicit instruction.
5. Test a missing GitHub run, failed run, slow valid run, lost response, lease expiry, stale writer, partial upload, simultaneous triggers and manual double-clicks. Prove one authoritative slot completion and safe fallback capture.
6. Restore both primary and fallback archives into an isolated database and verify representative schema/data behavior. Verify private-repository checkout and manual dispatch; do not change source visibility just to test.
7. Audit existing automatic callers before cutover. Deploy runtime, scheduler, coordinator and monitor; observe all four real daily slots and simulate primary failure. Report missing accounts/credentials as pending live setup, not completed automation.
8. Select independent runtime provider, strongly consistent coordinator, monitoring account and notification destination from available accounts before deployment. Measure compute/storage/egress costs, including private GitHub Actions. Do not promise free service or assume these accounts are already connected.

Add implementation under automation/db-backup-service/ for the independent container, reconciliation and durable job processing; scripts/backup/ for shared tooling; src/app/api/backup/ for manual integration; and the inspected existing admin/export screen for the button. The earlier automation/db-backup-dispatcher/ proposal is superseded.

## Shared archive, storage and recovery requirements

Deployment revision: the user has no new VPS/cloud hosting account. The selected independent executor is the existing Windows workstation, using `automation/db-backup-service/install-windows-task.ps1` and portable PostgreSQL 17 client tools. It runs at user login without a stored password. Supabase/database and existing R2 services are reused. PC power, internet and user-session availability bound fallback coverage; GitHub remains primary when the PC is unavailable. Container deployment is retained as an optional future alternative. External uptime alerts require separate reachable hosting/monitoring and are not claimed as configured.

- Use a compatible pg_dump custom-format archive as the canonical recovery payload, with a tested Supabase restore procedure covering application data/schema, functions, policies, triggers and sequences. Document roles, ownership and managed-schema limitations.
- Keep SQL/JSON convenience exports with accurate coverage labels; use consistent source reads if required. Upsert imports are not exact rollback because they preserve later-created rows.
- Compress/encrypt payloads before upload, keep recovery keys outside the bucket and verify read-back SHA-256 and object sizes before committing the completion manifest. Validate archive structure and prove actual restore into an isolated database.
- Store authoritative completed sets in a dedicated private R2 bucket for 90 days (up to 360 scheduled sets), separate from photos. Clean partial attempts after a grace period; never prune recent valid backups because a new attempt failed.
- Make secondary encrypted GitHub artifacts optional, with seven-day default retention to control private-repository costs. Replace hardcoded workflow report counts with measured results and actual timestamps.
- Document configuration names without secrets, pause/resume, downloads, decryption, restoration, credential rotation, private-repository transition and measured costs in docs/operations/DATABASE_BACKUP_RUNBOOK.md.
- Photos/files require a separate backup policy. This change covers database backups. Preserve unrelated worktree changes.

## Sources

- GitHub inactivity rule: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows
- GitHub workflow inspect/enable/dispatch API and permissions: https://docs.github.com/en/rest/actions/workflows
- GitHub schedule delay limitations: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Cloudflare Cron Triggers (UTC): https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Supabase backup coverage and restore caveats: https://supabase.com/docs/guides/platform/backups
- R2 pricing for measured cost estimation: https://developers.cloudflare.com/r2/pricing/
- GitHub App selected-repository access: https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app
- Private-repository Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions

