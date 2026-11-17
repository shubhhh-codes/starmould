# StarMould database performance audit

Local main at b1901935cad310da0a04bafbeec8a965a63fe0c6, including existing uncommitted work. Static inventory covers the API routes and database-related source and migration patterns. Runtime frequency, production schema drift, execution plans and the cause of the memory warning remain unmeasured. The configured database hostname failed to resolve during the read-only check.

| Area | Finding | Change or next step |
| --- | --- | --- |
| Dashboard counts | A successful stage-count RPC was followed by three API reads of scans, subplates and PO items. API row caps could silently distort purchase progress. | Added an invoker RPC restricted to service_role. It aggregates active order quantities in PostgreSQL and returns existing stage totals with the purchase fields overridden. Apply the migration before app deployment. Older schemas retain the previous route behavior. |
| Quotations | The list repeated a full item-array scan per quotation, requested customer records even when codes were present, and accepted arbitrary page sizes. | Group items once, fetch only missing codes, validate pagination and cap pages at the largest UI size of 100. |
| Realtime | Every database marker invalidated active queries across modules. | Coalesce events in a 100 ms window per mounted listener. Permission notifications remain immediate. Cross-module dependencies still require an explicit map before narrowing invalidation further. |
| Reporting and export | Seven export branches request up to 100,000 rows. The API row cap can truncate results. Expense totals have a similar fallback. | Compare exported counts with SQL totals above the API row limit. Use deterministic paged reads or a snapshot export. Surface query failures instead of reporting zero or partial totals. |
| Inventory lists | Shared scan lookup requests up to 10,000 records on each call. Dispatch, purchases and worklog use it. | Scope lookup to the projects needed by each list. Check completed/registered project visibility against fixtures first. |
| Backup | The legacy HTTP download reads and orders each table and builds SQL and JSON in process memory. The newer queued worker already uses pg_dump. | Verify the deployed worker, restore a sample archive and migrate legacy callers with their format and access requirements. |
| Connection management | The backup control pool has a limit per process. The main application uses the Supabase data API. | Correlate database backend count by role with peak commitment, backups and traffic before changing pool settings. |
| Indexes and schema | The base migration already indexes purchase_items on pid and plateid. Static index presence does not establish deployed index use. | Compare staging execution plans and buffers at production-like cardinality. Check actual foreign-key coverage and unused indexes over a representative interval before new DDL. |
| Dashboard fallback | Missing table-count RPC causes 18 parallel exact counts. Missing pipeline RPC can trigger repeated broad reads. | Verify RPC installation on each environment and monitor failures. |
| Server cache | Prefix invalidation removes cached values while leaving outstanding fetches eligible to cache pre-write data. | Cover invalidate-during-fetch with a concurrency test before changing shared cache behavior. |

## Staging acceptance

Compare old and new dashboard totals on stable fixtures including zero plates, partial orders, inactive purchases, completed/registered projects, deleted plates and legacy project codes. Also independently check table totals above the Data API row limit. Verify service_role access and denial for public roles. Measure API calls per dashboard refresh, response bytes, p95 latency, backend count and peak commitment under comparable traffic. A lower request count alone cannot confirm the memory warning is resolved.

## Route inventory

Static call sites per source file include mutually exclusive branches and write handlers. Zero can indicate delegated database access.

| Route file | Table calls | RPC calls | Exact count sites |
| --- | ---: | ---: | ---: |
| src/app/api/attachments/route.ts | 2 | 0 | 0 |
| src/app/api/auth/change-password/route.ts | 2 | 0 | 0 |
| src/app/api/auth/login/route.ts | 1 | 0 | 0 |
| src/app/api/auth/logout/route.ts | 0 | 0 | 0 |
| src/app/api/auth/me/route.ts | 0 | 0 | 0 |
| src/app/api/backup/cron/route.ts | 3 | 0 | 0 |
| src/app/api/backup/jobs/download/route.ts | 0 | 0 | 0 |
| src/app/api/backup/jobs/route.ts | 0 | 0 | 0 |
| src/app/api/backup/route.ts | 0 | 0 | 0 |
| src/app/api/challan/route.ts | 14 | 0 | 2 |
| src/app/api/counts/route.ts | 6 | 3 | 1 |
| src/app/api/customers/import/route.ts | 3 | 0 | 0 |
| src/app/api/customers/route.ts | 14 | 0 | 4 |
| src/app/api/dispatch/route.ts | 15 | 0 | 1 |
| src/app/api/download-challan-pdf/route.ts | 7 | 0 | 0 |
| src/app/api/download-dispatch-pdf/route.ts | 6 | 0 | 0 |
| src/app/api/download-po-pdf/route.ts | 6 | 0 | 0 |
| src/app/api/download-quotation-pdf/route.ts | 4 | 0 | 0 |
| src/app/api/expense/route.ts | 9 | 2 | 0 |
| src/app/api/export/route.ts | 14 | 0 | 7 |
| src/app/api/exports/route.ts | 0 | 0 | 0 |
| src/app/api/inward/route.ts | 13 | 0 | 0 |
| src/app/api/logs/client-error/route.ts | 0 | 0 | 0 |
| src/app/api/photos/attach/route.ts | 0 | 0 | 0 |
| src/app/api/photos/export/[jobId]/download/route.ts | 2 | 0 | 0 |
| src/app/api/photos/export/[jobId]/route.ts | 1 | 0 | 0 |
| src/app/api/photos/export/route.ts | 5 | 0 | 0 |
| src/app/api/photos/history/recovery/route.ts | 4 | 2 | 0 |
| src/app/api/photos/history/route.ts | 0 | 0 | 0 |
| src/app/api/photos/history/summary/route.ts | 0 | 1 | 0 |
| src/app/api/photos/list/route.ts | 2 | 0 | 0 |
| src/app/api/photos/retention/route.ts | 1 | 0 | 0 |
| src/app/api/photos/stats/route.ts | 2 | 0 | 0 |
| src/app/api/photos/storage/cron/route.ts | 2 | 0 | 0 |
| src/app/api/photos/upload/route.ts | 7 | 0 | 0 |
| src/app/api/photos/view/[id]/route.ts | 5 | 0 | 0 |
| src/app/api/print-doc/route.ts | 33 | 0 | 0 |
| src/app/api/print-token/route.ts | 0 | 0 | 0 |
| src/app/api/projects/[id]/close/route.ts | 6 | 0 | 0 |
| src/app/api/projects/[id]/timeline/route.ts | 30 | 0 | 0 |
| src/app/api/purchase-inward/route.ts | 16 | 0 | 0 |
| src/app/api/purchases/route.ts | 26 | 0 | 3 |
| src/app/api/quotations/presets/route.ts | 6 | 0 | 0 |
| src/app/api/quotations/route.ts | 13 | 1 | 1 |
| src/app/api/realtime/token/route.ts | 2 | 0 | 0 |
| src/app/api/report/route.ts | 3 | 1 | 1 |
| src/app/api/scanning/preview-id/route.ts | 0 | 1 | 0 |
| src/app/api/scanning/route.ts | 18 | 3 | 4 |
| src/app/api/search/route.ts | 7 | 0 | 0 |
| src/app/api/settings/permissions/route.ts | 0 | 0 | 0 |
| src/app/api/subplate/route.ts | 29 | 0 | 3 |
| src/app/api/upload/route.ts | 4 | 0 | 0 |
| src/app/api/users/route.ts | 14 | 0 | 4 |
| src/app/api/vendors/route.ts | 12 | 0 | 4 |
| src/app/api/worklog/route.ts | 7 | 0 | 1 |
