# Photo storage folders

Implemented on 16 November 2026. Object keys are relative to the configured R2 bucket, currently `starmould`. The bucket name is not repeated inside each key.

| Photo | Object key below the bucket |
| --- | --- |
| Purchase receipt | `MOULD-CODE/purchase_inward/SM-PR-005__5/TIMESTAMP_IST_ID.webp` |
| Outward jobwork | `MOULD-CODE/outward_jobwork/CHALLAN__ID/TIMESTAMP_IST_ID.webp` |
| Return inward | `MOULD-CODE/inward_jobwork/RETURN__ID/TIMESTAMP_IST_ID.webp` |
| VMC QC | `MOULD-CODE/vmc_qc/SUBPLATE__ID/EVENT-TIME_ID/TIMESTAMP_IST_ID.webp` |
| Final QC | `MOULD-CODE/final_qc/SUBPLATE__ID/EVENT-TIME_ID/TIMESTAMP_IST_ID.webp` |
| Packing | `MOULD-CODE/packing/SUBPLATE__ID/EVENT-TIME_ID/TIMESTAMP_IST_ID.webp` |
| Dispatch | `MOULD-CODE/dispatch/DISPATCH__ID/TIMESTAMP_IST_ID.webp` |
| Shared between moulds | `shared/CATEGORY/DOCUMENT__ID/TIMESTAMP_IST_ID.webp` |
| Unlinked, known mould | `MOULD-CODE/CATEGORY/TIMESTAMP_IST_ID.webp` |
| Unlinked, shared moulds | `shared/CATEGORY/TIMESTAMP_IST_ID.webp` |
| Unknown mould | `_unlinked/CATEGORY/TIMESTAMP_IST_ID.webp` |
| Unsaved movement | `_pending/BATCH-ID/CATEGORY/TIMESTAMP_IST_ID.webp` |

Unlinked photos go directly inside their category, with no per-photo subfolder. This follows the user's correction. Their receipt association remains unlinked in the database and in admin recovery. Filename IDs keep these flat folders collision-free. Receipt and subplate folders include their database IDs to distinguish labels that sanitize to the same name. Empty categories do not create artificial R2 objects; folders appear when they contain photos.

## Implementation

- `src/lib/photos/storage-layout.ts` owns category names, safe folder segments, IST filenames and deterministic keys.
- `src/lib/photos/storage-moves.ts` resolves existing database associations, copies the processed bytes, reads back and compares SHA-256, then switches the database pointer through a service-only RPC. Photos are not recompressed or rewatermarked.
- SQL triggers queue project/event/stage changes durably. Leases prevent concurrent moves of the same photo; revisions reject stale folder decisions. Compare-and-swap checks prevent a move from restoring a deleted photo. A prepared destination and obsolete source keys are journalled for retryable cleanup.
- Uploads start in `_pending`. Next.js `after()` starts bounded folder maintenance after upload, inventory creation, stage update and admin recovery, so moving files does not hold up successful entry responses. ID-based CRM view URLs remain unchanged.
- `src/lib/r2/export-zip.ts` uses the same layout under a bucket-named ZIP root. Shared photos appear under every selected mould. The CSV index records actual archive paths. Duplicate associations are deduplicated, database results are paginated, and missing files fail the backup rather than silently producing an incomplete archive.
- Admin Photo Storage has an **Organize Photo Folders** button. It processes up to 20 queue items per request. Existing permissions for photo viewing, downloads and deletion remain in force.

## Maintenance

```text
npm run photos:organize                 # Read-only database summary
npm run photos:organize -- --apply      # Apply registered migrations and process queued moves
npm run photos:organize -- --run        # Process already-installed queue and old-copy cleanup
```

For unattended retries and old-copy cleanup, configure the deployment scheduler to POST `/api/photos/storage/cron` every minute with `Authorization: Bearer <CRON_SECRET>`. The endpoint validates the configured secret and processes a bounded batch. The local secret exists, but no external scheduler or Cloudflare deployment was created by this change. Cleanup keeps a 60-second read grace period before removing obsolete objects. Admin maintenance or the CLI can also drain it.

Applied migrations:

- `20261116180000_photo_storage_layout.sql`
- `20261116181000_flat_unlinked_photo_folders.sql`
- `20261116182000_photo_storage_delete_race.sql`

The initial live migration moved all 11 active photos with content verification and cleaned all 11 previous keys. The follow-up migration flattened the nine legacy unlinked photos according to the user's correction and removed all nine obsolete per-photo keys. No obsolete keys or failed moves remained after verification. Nine photos still require admin receipt linking, one belongs to a pending draft, and one is receipt-linked. No receipt relationships were guessed.

## Validation

- TypeScript check and existing library regressions.
- Offline folder and worker tests: categories, IST day rollover, shared storage, safe paths, repeat events, copy/hash verification, missing files, corrupt copies and failed database updates.
- Isolated rollback-only SQL tests: triggers, leases, atomic pointer/attempt updates, stale revisions, deletion races, retry backoff and service-only function access.
- Real ZIP tests: shared expansion, exact bytes, deduplication, Excel index, CSV safety and missing-file failure.
- Existing gallery desktop/mobile and insecure HTTP tablet uploader tests.
- Running Next server endpoints compile and reject unauthenticated maintenance/upload requests.
