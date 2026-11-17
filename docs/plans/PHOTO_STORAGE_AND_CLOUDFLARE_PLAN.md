# Movement Photos, R2 Storage, and Cloudflare Migration Plan

Date: 16 November 2026  
Status: Requirements agreed; implementation not started

## 1. Objective

Add compulsory photo evidence to material movements and QC, provide structured ZIP backups inside the CRM, and automatically remove eligible photos after project completion. Move CRM hosting from Vercel to Cloudflare while keeping the database in Supabase and storing photos privately in Cloudflare R2.

This document records agreed requirements and a proposed implementation. Proposed technical choices must be checked against the installed Next.js version and Cloudflare runtime before implementation.

## 2. Agreed requirements

### Photo capture and movement completion

- Require at least one successfully uploaded photo for every purchase inward, outward, jobwork return inward, QC, packing, and dispatch event.
- The minimum applies to the whole movement/event, not to each item or subplate.
- Allow multiple photos against individual subplates, including different quantities, sides, and angles.
- Accept blank photos. Validate that the upload is a supported image; do not require automated inspection of its visual content.
- Support camera capture, gallery selection, and computer file selection, including multiple files at once.
- Store only photos in this feature; videos and uploaded PDF documents are outside scope.
- Do not impose a daily photo-count limit.
- Preserve each movement's separate photo history, including repeated outward/return cycles.

### Compression and watermark

- Store one compressed, permanently watermarked copy in R2. Do not retain a separate original copy.
- Start by evaluating WebP with lossy compression. Choose resolution and quality using representative real photos.
- Material condition, damage, and normal markings must remain clear when zoomed.
- Do not promise a fixed compressed size, lossless quality, or unlimited storage capacity.
- Include the movement type and applicable party details in the permanent watermark.
- The only timestamp displayed in the watermark is the server-recorded upload time, formatted in India Standard Time (Asia/Kolkata).
- Never substitute image metadata time, device time, or a backdated movement-entry time for upload time.
- Store the canonical timestamp in UTC and derive its IST display consistently.
- Define one server-authoritative upload timestamp during upload acceptance/finalization and use that same value in the watermark, index, and UI. A photo becomes available only after its processed object and database reference are successfully finalized.
- A retry of the same logical upload must not create duplicate photos or inconsistent timestamps.

### Access

- Only admins can download ZIP archives, manually delete photos, or use the Photo Storage dashboard.
- Other users can upload and view photos according to existing document/project permissions.
- R2 objects are private. Viewing and downloading must enforce CRM authorization.

## 3. Storage policy

The user's target is the 10 GB R2 storage allowance, not 10 TB. This is an alert threshold, not a hard upload cap.

| Usage | CRM behavior |
| --- | --- |
| Below 8 GB | Show normal usage |
| 8 GB and above | Warning |
| 9 GB and above | Urgent warning |
| 10 GB and above | Persistent prominent alert; uploads continue |

- Do not block admin or user uploads merely because storage crosses a threshold.
- The policy permits usage above 10 GB and therefore cannot guarantee staying within a free allowance.
- Count actual stored bytes, including any thumbnails, temporary objects, generated archives, and incomplete uploads where applicable.
- Prefer avoiding persistent duplicate archives and image variants where practical.
- Display the usage measurement's last-updated time and distinguish measured bucket usage from per-project attribution.
- Count a shared object once in total storage, even when it appears under multiple projects.
- Reconcile application counters against R2 inventory/metrics periodically. Do not rely exclusively on counters updated by successful browser requests.
- Storage allowance does not imply that hosting, requests, processing, and background work are all free. Verify current service limits and costs before deployment.

## 4. Retention and deletion

1. When a project moves into Register, start a 30-day photo-retention period.
2. Show its exact deletion deadline and keep backup download available while the photos remain available.
3. Remind admins 7 days before deletion, 3 days before deletion, and on the final day.
4. Delete eligible photos automatically after 30 days, even if nobody downloaded a backup.
5. Preserve business records, movement history, QC records, and a minimal record of photo deletion.
6. Replace unavailable photo controls with a clear deleted/expired status; do not leave broken image or download links.

### Reopened projects

- Cancel pending deletion when a project reopens.
- Start a fresh 30-day period when it subsequently moves into Register again.
- Already deleted photos cannot be restored by reopening a project.

### Photos shared across projects

- Link one physical photo to all applicable projects; avoid duplicating stored bytes.
- Delete it automatically only after every linked project has completed its own 30-day retention period.
- An active or reopened linked project prevents automatic deletion.
- Recheck all project links and statuses immediately before deletion to handle concurrent reopening or reassignment.
- Photos without a reliable project association must not be silently deleted using an assumed completion date. Surface them for admin review; the business policy for unassigned movements remains to be finalized.

### Deletion execution

- Use a scheduled, retryable cleanup process driven by database eligibility, rather than a blanket age-based R2 rule on all movement photos.
- Record deletion attempts, failures, and completion; retry partial failures safely.
- Use short lifecycle rules only for suitable temporary uploads/exports and abandoned multipart uploads.
- Manual deletion is admin-only and explicitly identifies what will be lost, including shared-project references.

## 5. Failed uploads and persistent drafts

- Save form data and pending photo files locally on the same device so they survive a tab close or device restart, subject to browser storage availability.
- Scope drafts to the signed-in user and document/event to avoid exposing another user's pending files.
- Provide per-photo status, an automatic retry mechanism, and a manual Retry button.
- Retry automatically when connectivity returns while the CRM is running; resume pending work when the CRM is reopened.
- Do not promise background uploads while the browser is closed.
- Finalize a movement only after at least one valid photo upload succeeds. Clearly show any additional pending/failed photos.
- Remove successfully synchronized local photo data once it is no longer needed by the draft.
- Expire a draft and its pending photos 24 hours after the last explicit user edit or photo addition. Automatic retries must not extend this deadline.
- If the browser is closed at expiry, remove expired content on the next CRM opening before offering draft recovery.
- Show expiry information because unsent files will be lost after expiration.
- Handle local-storage exhaustion gracefully, use compressed pending files where feasible, and avoid loading all photos into memory at once.

## 6. ZIP downloads and photo index

Admins can download:

- A complete project's photo archive.
- An individual mould's photo archive.
- Multiple selected projects in one export request.

Organize files by project, mould where applicable, movement type, party, and movement identifier. Movement identifiers must distinguish repeated visits to the same jobber.

Example structure:

```text
Photo-Backup_<Export-ID>/
  Photo-Index.csv
  Project_<Project-Code>/
    Mould_<Mould-Code>/
      Purchase-Inward/
        Vendor_<Name>/
          Inward_<Number>/
            2026-11-16_15-45-12_IST_<Photo-ID>.webp
      Jobwork-Outward/
        Jobber_<Name>/
          Outward_<Number>/
      Jobwork-Return-Inward/
        Jobber_<Name>/
          Inward_<Number>/
      QC/
        QC_<Event-ID>/
      Packing/
        Packing_<Event-ID>/
      Dispatch/
        Customer_<Name>/
          Dispatch_<Number>/
```

- Create folders only when they contain photos. Do not create an empty Material Order folder.
- Place movement-wide photos at movement level; put item/subplate photos in clearly identified child folders where applicable.
- Accommodate project-level photos that do not belong to one mould without inventing an association.
- Sanitize names, prevent filename collisions, and preserve stable identifiers even if display names change.
- Include an Excel-compatible UTF-8 CSV index with relative photo path, photo ID, project, mould, subplate/item where applicable, movement type/number, party, uploader, and upload time in IST.
- Protect CSV text fields against spreadsheet formula interpretation.
- Make shared-photo associations clear in the index; any archive duplication must not imply duplicate R2 storage.
- Show export progress and actionable failure/retry states.
- Generate large exports with bounded memory and resumable/retryable background work. Determine streaming versus temporary R2 archive storage during the runtime prototype.
- If an export is too large for the verified runtime/download path, provide clearly numbered ZIP parts and include an index for each part.
- Expire temporary archives promptly and include their bytes in usage accounting.
- Do not mark a backup as safely saved merely because a user clicked Download. Pending-download status can track a download attempt/export generation, but must not claim verified storage on the admin's device.
- Coordinate export reads and deletion so an export does not silently succeed with missing photos. Fail clearly or report omissions if source files become unavailable.

## 7. Admin Photo Storage dashboard

Provide:

- Total photo-storage usage, threshold alerts, and last reconciliation time.
- Per-project and per-mould photo counts and attributed sizes, with shared bytes explained.
- Active projects, completed projects in retention, unassigned photos, and upcoming deletions.
- Pending backup/download list with exact deletion dates.
- Project/mould selection, export progress, and available ZIP downloads.
- Manual photo cleanup with clear selection and confirmation of affected records.
- Failed uploads/background jobs/deletions requiring attention.

The dashboard remains inside the CRM; ordinary users do not need Cloudflare console access.

## 8. Proposed application design

Extend the existing attachment authorization and document references rather than introducing a parallel permission system.

Proposed records, subject to schema review:

- Photo: stable ID, R2 object key, canonical upload timestamp, uploader, processed size/dimensions, format, processing status, and deletion state.
- Photo associations: movement/event, project, mould, and optional subplate/item links; support multiple project associations.
- Upload attempt: idempotency key, stage, retry/error details, and temporary-object cleanup information.
- Retention metadata: project completion cycle and deletion eligibility.
- Export job: requested scope, requester, progress, source manifest, temporary archive references, and expiry.
- Cleanup/audit log: actions, outcomes, retries, and affected identifiers.

Never persist an expiring signed URL as the permanent photo reference. Store object keys and issue authorized short-lived access when needed.

## 9. Cloudflare hosting migration

Target responsibilities:

| Component | Target |
| --- | --- |
| CRM hosting/API | Cloudflare, using a verified deployment path for this Next.js app |
| Photo objects and temporary exports | Private Cloudflare R2 |
| Database | Existing Supabase database |
| Scheduled cleanup and background jobs | Cloudflare-compatible scheduled/queued execution selected after prototype |
| Offline drafts | Browser-local persistent storage |

Before changing application code, read the relevant installed guides under `node_modules/next/dist/docs/` as required by `AGENTS.md`.

Compatibility work must inspect existing authentication, API routes, Supabase connections, Node-only dependencies, PDF generation/browser dependencies, exports, and job execution. Do not assume that changing the deployment configuration alone will migrate every route successfully.

Keep credentials server-side. Create separate development/preview resources where needed. Test Cloudflare previews before changing the production domain, and preserve a rollback path to the existing deployment.

References to recheck during implementation:

- [Cloudflare framework deployment configuration](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/)
- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
- [R2 platform limits](https://developers.cloudflare.com/r2/platform/limits/)

## 10. Implementation phases

### Phase 1 — Inspect and prototype

- Map actual movement, QC, packing, dispatch, project, mould, and subplate relationships.
- Inspect existing attachments and determine whether Supabase-hosted historical photos require migration; R2 is not yet set up.
- Prototype Cloudflare deployment, image processing/watermarking, and a realistically large ZIP export.
- Select compression settings from zoomed sample photos and verify mobile-browser compatibility, including supported camera formats.
- Confirm required Cloudflare plans/services and usage visibility. Do not request secrets in a committed document.

### Phase 2 — Storage and upload foundation

- Configure private R2, server credentials, required CORS, and environment separation.
- Add schema changes and preserve existing authorization behavior.
- Implement validated uploads, authoritative timestamps, compression, watermarking, idempotent finalization, and orphan cleanup.
- Build shared camera/gallery/multiple-file uploader and photo viewer.

### Phase 3 — Movement integration and drafts

- Integrate every agreed movement/QC stage with the shared uploader.
- Enforce the movement-level one-photo minimum on the server as well as in the UI.
- Support optional per-subplate photos and multi-project movement associations.
- Implement persistent drafts, retry/resume, 24-hour expiry, and bounded local storage behavior.
- Define rollout behavior for historical records so new mandatory validation does not accidentally block unrelated edits to old movements.

### Phase 4 — Admin archives and storage management

- Implement project, mould, and bulk ZIP exports plus CSV indexes.
- Add dashboard usage accounting/reconciliation, threshold alerts, manual cleanup, and download states.
- Verify shared-photo accounting and export behavior.

### Phase 5 — Retention and production cutover

- Implement completion/reopen handling, shared-photo eligibility, reminders, and scheduled deletion with retries.
- Verify retention in a non-production environment using controlled dates.
- Complete Cloudflare regression checks and production migration with rollback readiness.
- Enable automatic production deletion only after eligibility and reminder behavior are verified.

## 11. Acceptance checks

- Each covered event rejects finalization without at least one successful photo; a blank valid image is accepted.
- Several items in one movement need only one common photo, and optional subplate photos remain correctly associated.
- Repeated movements retain distinct histories.
- Camera/gallery multi-selection works on representative phones and computers.
- Compressed samples preserve agreed visible detail; watermark remains legible without hiding essential content.
- Watermark, UI, filename, and index derive upload time consistently in IST; EXIF and client clock changes do not affect it.
- Interrupted uploads resume without duplicate records; same-device drafts survive reopening and expire after 24 hours of user inactivity.
- Storage thresholds alert at 8/9/10 GB while uploads remain allowed.
- Unauthorized users cannot access photos, exports, deletion controls, or the admin dashboard.
- Project, mould, and bulk ZIPs contain the correct photos, folders, and Excel-compatible index.
- Completion starts retention, reopening cancels it, and recompletion starts a fresh period.
- A shared photo survives until every linked project's retention has ended.
- Reminders appear at the agreed times; overdue photos are removed even without a download.
- Partial cleanup/export failures recover safely and do not silently report success.
- Business records remain readable after photo deletion.
- Existing CRM login, movement flows, document viewers, printing/PDF output, and database access work on the Cloudflare preview before cutover.

## 12. Technical decisions still requiring implementation evidence

- Exact compression quality, dimensions, mobile input-format conversion, and processing runtime.
- Cloudflare deployment adapter/runtime compatibility with the installed Next.js version.
- Background job execution, export size limits, streaming strategy, and temporary archive lifetime.
- Reliable R2 usage measurement and reconciliation frequency.
- Treatment of unassigned movements/photos and historical attachments.
- Meaning of pending-download acknowledgement beyond an export/download attempt; no verified local backup detection is assumed.

These are implementation details or remaining edge-case policies, not permission to change the agreed requirements above.
