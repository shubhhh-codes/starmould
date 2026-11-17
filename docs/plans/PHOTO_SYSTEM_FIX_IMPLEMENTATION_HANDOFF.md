# Photo System: Focused Fix and Implementation Handoff

Date: 16 November 2026  
Workspace: `D:\Repo\starmould`  
Purpose: Exact remediation instructions and architecture specifications for the photo storage system.

## 1. Scope and Working Rules

Original requirements reference: [Photo storage plan](/D:/Repo/starmould/docs/plans/PHOTO_STORAGE_AND_CLOUDFLARE_PLAN.md).

- Review the current diff carefully. Files have been updated during ongoing reviews. Inward, dispatch, and challan currently have attach calls as separate fire-and-forget requests; do not add redundant duplicate calls assuming they are missing.
- Consult installed Next.js guides in `node_modules/next/dist/docs/` as required by `AGENTS.md`.
- Preserve existing inventory quantity checks, partial inward/dispatch, document idempotency, role permissions, and Project Register closure invariants.
- Never edit an applied migration file. Add forward migrations instead. Verify deployment state and prepare backfill plans.
- Do not overwrite existing user changes, reports, or unrelated configuration.
- Do not test by deleting production photos; use isolated test buckets and databases.
- Update contracts across API helpers, SQL functions, UI, and background jobs together. Do not treat UI-only validation as a completed fix.

### Fixed Requirements

| Requirement | Final Behavior |
| --- | --- |
| Photo minimum | Require at least 1 successful image per covered movement/event; not per-item minimum |
| Blank photo | Accept any valid supported image format; automated visual inspection is not required |
| Multiple photos | Permitted across movement and optional individual subplates |
| Sources | Camera capture, device gallery, and desktop file selection; multiple selection supported |
| Stored image | Store one compressed, permanently watermarked copy; do not retain separate raw originals |
| Timestamp | Authoritative server upload acceptance time only in IST display; no EXIF, device, or movement dates |
| Daily limit | None |
| Storage policy | 8 GB warning, 9 GB urgent warning, 10 GB+ prominent persistent alert; uploads continue |
| Retention | Automatically delete photos 30 days after Project Register transition, regardless of backup downloads |
| Reopened project | Cancel pending deletion immediately; start fresh 30-day window upon subsequent re-completion |
| Shared photo | Retain shared photo until the latest eligible completion retention of all linked projects expires |
| Reminders | Admin notifications at 7 days, 3 days, and final day before deletion deadline |
| Access control | Authenticated users can upload/view within authorized scope; ZIP export, dashboard, and manual deletion are admin-only |
| Persistent drafts | Same-device recovery; draft expires 24 hours after last explicit user edit or photo addition |
| Infrastructure | Cloudflare hosting, Cloudflare R2 photo storage, Supabase PostgreSQL database |

## 2. Implementation Order

| Order | Deliverable | Depends On |
| --- | --- | --- |
| 1 | Runtime prototype, identity mapping, shared API contracts | Existing code inspection |
| 2 | Forward schema migration, authorization, idempotent photo uploads | Identity mapping |
| 3 | Atomic movement/photo finalization and QC/packing coverage | Ready-photo contract |
| 4 | Project lifecycle, safe retention, retryable deletion | Canonical associations |
| 5 | Persistent drafts, upload queue, recovery | Stable draft/event/upload IDs |
| 6 | Background ZIP jobs, accurate storage dashboard, admin UX | Photo and lifecycle states |
| 7 | Regression verification and Cloudflare preview cutover | All above |

Do not enable automatic deletion before schema, associations, and concurrency checks are fully verified.

## 3. Shared Contracts

Core module: `src/lib/photos/types.ts`. All uploader and API components use these centralized type definitions:

- `draftId`: Stable UUID representing a specific movement form draft instance. Preserved across modal reopenings, regenerated on new movements.
- `eventId`: Logical server-side identity for a movement, QC, or packing event. Remains stable from draft to finalization.
- `clientUploadId`: Stable UUID assigned to each selected file for idempotent upload retries.
- `PhotoState`: `pending`, `processing`, `ready`, `failed`, `deletion_queued`, `deleting`, `delete_failed`, `deleted`.
- `lastUserEditedAt`: Timestamp of the last explicit user interaction. Background retries and progress updates do not modify this.
- `uploadedAt`: Canonical server-authoritative upload timestamp, assigned once and burned into watermark, database metadata, and index.
- Movement creation requests must accept validated `photoIds` and `draftId`/`eventId`.
- Existing document `Idempotency-Key` headers must be preserved alongside file-level upload idempotency.

### 3.1 Database Additions and Invariants

Use forward migrations. Evolve existing tables cleanly without competing tables.

| Record | Required Data / Invariant |
| --- | --- |
| Photo upload attempt | Actor ID, client upload UUID, draft/event ID, request identity, canonical uploadedAt, reserved object key, processing status, error; unique actor + client upload UUID |
| Movement photo | Image metadata, processing and deletion state, originating upload attempt and event identity; unique object key and upload attempt link |
| Photo event association | Photo ID + event ID + final document type/ID; unique photo/event pair |
| Photo project association | Canonical project ID, optional mould identity, display code snapshots |
| Retention cycle | Project ID, generation counter, registered_at timestamp, deletion_deadline, cancelled_at timestamp; unique project + generation |
| Deletion job | Photo ID, reason, generation, lease/claim, state, attempt counter, next_retry_at, confirmed_deleted_at |
| Export job / manifest | Scope type/params, requester ID, source photo IDs, progress, state, R2 output key, error, expires_at |
| Reminder notification | Cycle ID, milestone (7d, 3d, 1d), created/read timestamps; unique cycle + milestone |
| Storage snapshot | Source (R2 vs DB), physical bytes and count, measurement timestamp, status |

### 3.2 API Contract Specifications

| Endpoint | Required Behavior |
| --- | --- |
| `POST /api/photos/upload` | Multipart file upload with draftId, eventId, clientUploadId, and movement metadata; returns stable photo ID, state, and uploadedAt |
| Existing inventory POSTs | Accepts ready photoIds and eventId; atomically commits business document and photo associations |
| QC / Packing completion | Atomic stage transition requiring verified ready photoIds |
| `GET /api/photos/list` | Returns paginated photos filtered by authorized event, project, or mould |
| `GET /api/photos/view/[id]` | Authorizes caller against canonical associations before serving object |
| Photo deletion action | Admin-only; queues deletion jobs and returns pending status |
| `POST /api/photos/export` | Admin-only; enqueues background export job and returns HTTP 202 with jobId |
| `GET /api/photos/export/[jobId]` | Returns background export progress, status, and download availability |
| `GET /api/photos/export/[jobId]/download` | Streams generated ZIP archive with authenticated access check |
| `GET /api/photos/stats` | Admin-only; serves latest cached storage snapshot and database aggregates |

## 4. F01: Server Authorization Hardening
- Implement centralized authorization helpers in `src/lib/photos/access.ts` for admin checks, event access, and photo operations.
- Map movement types to existing role permissions: purchase inward to `action_create_purchase_inward`, outward challan to `action_create_challan`, return inward to `action_create_inward`, dispatch to `action_create_dispatch`.
- Validate source purchase orders, challans, and subplates on new draft uploads. Prevent non-admin callers from reassigning committed photos across movements.
- Enforce strict `Cache-Control: private, no-store` on photo viewing and metadata routes.

## 5. F02: Project and Mould Associations
- Create `src/lib/photos/associations.ts` to reliably resolve canonical project references (`scan.id` and `scan.projectid`) from incoming items.
- Ensure all relevant items in batch movements (such as multi-project purchase inward receipts) associate all project codes to photos.
- Maintain join table `photo_event_associations` to support one-to-many relationships between photos and multiple generated documents.

## 6. F03: Atomic Movement and Photo Finalization
- Replace client-only boolean validation by passing ready `photoIds` directly into inventory mutations.
- Enforce minimum photo requirements directly inside inventory transaction RPCs, ensuring document creation and photo association commit atomically.
- Remove loose post-success fetch calls to prevent orphaned or unlinked business documents.

## 7. F04: QC and Packing Compulsory Evidence
- Make photo evidence compulsory for VMC QC, Final QC, and Packing stage transitions.
- Ensure stage transition RPCs atomically require and link ready photo records.
- Preserve view-only modes for already completed stages.

## 8. F05: Upload Idempotency and Orphan Management
- Enforce unique `(uploaded_by, client_upload_id)` constraints on upload attempts.
- Re-use authoritative server timestamps on retried upload attempts.
- Support clean upload cancellation via `AbortController` and clean up incomplete multipart objects.

## 9. F06: Image Normalization and Resilient Watermarking
- Normalize EXIF orientation prior to dimension checks.
- Prevent negative composite coordinates on small or 1px blank images by extending the canvas into a dedicated footer banner.
- Ensure watermarks never obscure component damage or markings.
- Handle long Hindi/English text strings gracefully without SVG rendering failures.

## 10. F07: Persistent Drafts and Upload Queue
- Persist drafts locally using IndexedDB with binary Blobs/Files instead of heavy base64 strings.
- Enforce a 24-hour expiration window based strictly on `lastUserEditedAt`.
- Manage upload concurrency with automatic exponential backoff, per-file retry, and offline resumption.

## 11. F08: Project Register Retention Lifecycle
- Wire retention cycles to canonical Project Register database state transitions.
- Record single completion generations per project; cancel pending deletions immediately if a project is reopened.
- Handle historical completed projects conservatively without arbitrary mass deletion.

## 12. F09: Safe Shared-Photo Deletion
- Automatically delete photos only when EVERY linked project has completed its 30-day retention period.
- Process deletions through an asynchronous, retryable `PhotoDeletionJob` queue.
- Reconcile physical R2 object deletions with database records idempotently.

## 13. F10: Automated Reminders and Scheduler
- Implement scheduled background evaluations for retention deadlines and reminder generation.
- Produce deduplicated admin reminders at 7 days, 3 days, and final day before expiration.

## 14. F11: Background ZIP Exports and Bounded Memory
- Run ZIP generation as asynchronous background jobs returning HTTP 202.
- Stream output to R2 multipart objects to avoid memory exhaustion on large photo sets.
- Include complete Excel-compatible UTF-8 BOM CSV manifests with canonical IST timestamps.

## 15. F12: Storage Measurement and Administrative Cleanup
- Aggregate storage statistics directly in SQL.
- Distinguish between physical bucket storage and project-attributed bytes.
- Provide selective admin photo deletion with transparent confirmation dialogs.

## 16. F13: Cloudflare Runtime and Environment Guardrails
- Validate Sharp image processing pipelines against target Cloudflare deployment environments.
- Fallback to local disk storage strictly in development environments when R2 credentials are absent.

## 17. U01: Viewer Usability and Mobile Interaction
- Provide accessible modal viewers with pinch-to-zoom, keyboard navigation, and bounded mouse panning.
- Replace technical internal labels with clear, user-friendly status descriptions.
