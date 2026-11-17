# Photo History Gallery: Implementation Plan

Date: 16 November 2026  
Status: Implemented in the working tree. Database migration applied. See the [implementation report](/D:/Repo/starmould/docs/reports/PHOTO_HISTORY_GALLERY_IMPLEMENTATION_REPORT.md) for verification and remaining legacy-photo association steps. The checklist below retains the original execution requirements.

Detailed specification: [Confirmed gallery handoff](/D:/Repo/starmould/docs/plans/PHOTO_HISTORY_GALLERY_IMPLEMENTATION_HANDOFF.md).  
Related correctness fixes: [Photo system remediation](/D:/Repo/starmould/docs/plans/PHOTO_SYSTEM_FIX_IMPLEMENTATION_HANDOFF.md).

## Target outcome

Saved photos history se accessible hon: row/stage mein `Images (count)`, same-page popup, grouped thumbnails, uploader, IST upload time aur large preview with zoom. Gallery view-only rahe. Admin download/delete Photo Storage dashboard mein rahe.

## Scope map

| Screen | Photo scope | Placement |
| --- | --- | --- |
| Purchase Order | PO ki all inward receipts, receipt-wise groups | Voucher ke paas |
| Purchase Inward log | Clicked receipt only | Revert/Undo ke paas |
| Outward Jobwork | Own outward plus linked returns, separate groups | Existing row Actions |
| Inward Jobwork | Clicked return only | Existing row Actions |
| VMC QC / Final QC | Corresponding subplate and stage/event | Respective stage card |
| Packing | Corresponding packing stage/event | Packing card |
| Dispatch | Clicked dispatch only | Existing row Actions |

All desktop, mobile, grouped and flat variants covered hon. Full mould timeline aur photo approval workflow is scope mein nahi hain.

## Phase 0: Inspect and lock contracts

**Dependencies:** None.

- [ ] Read current diff and `AGENTS.md`; relevant installed Next.js documentation padho.
- [ ] Existing `src/lib/photos/types.ts` and in-progress fixes inspect karo; same helpers/components duplicate mat banao.
- [ ] Confirm mutation response shapes in `src/lib/query/hooks.ts` and inventory API: `receipt`, `challan`, `inward`, `dispatch` envelopes.
- [ ] Trace relationships: `po_inward.pid -> purchase.id`, `inward.challanid -> challan.id`, stage evidence to subplate/stage/event.
- [ ] Identify actual project/mould IDs using existing schema; `scan.order_id` assumption remove karne ka patch location note karo.
- [ ] List all existing table/mobile rendering variants and their row action locations.
- [ ] Inspect whether required remediation dependencies have already been implemented; only missing changes schedule karo.

**Exit check:** Scope identity and API response contracts documented and typed; no guessed receipt IDs or document-number matching.

## Phase 1: Repair saved-photo associations

**Dependencies:** Phase 0.

**Files:** `src/lib/inventory-documents.ts`, `src/lib/query/hooks.ts`, all movement creation views, photo upload/attach routes, forward Supabase migration.

- [ ] Establish canonical photo-to-event/document associations, including one photo linked to multiple generated purchase receipts.
- [ ] Persist each actual receipt ID returned by PO-wise inward creation. Never substitute delivery number or challan ID for receipt ID.
- [ ] Include ready photo IDs and stable event/draft identity in creation payloads.
- [ ] Finalize inventory record and photo associations in the same database transaction, preserving existing inventory validation and request idempotency.
- [ ] Remove redundant fire-and-forget attach calls only after atomic replacement is working.
- [ ] Correct project lookup to deployed schema and check all lookup/link errors.
- [ ] Add needed unique constraints and indexes through a forward migration, without editing an applied migration.
- [ ] Produce a dry-run historical audit: exact recoverable links, unlinked uploads, ambiguous links and missing objects.
- [ ] Backfill only deterministic associations. Unknown old uploads remain explicitly unresolved for admin recovery.

**Exit check:** A new uploaded image is reliably queryable by saved receipt ID; retry does not create duplicate movement/link; existing user's test image is recovered with evidence or reported unresolved.

## Phase 2: Authorized gallery and count APIs

**Dependencies:** Phase 1.

**Files:** extend `src/lib/photos/types.ts`; add/reuse `src/lib/photos/history.ts`, shared access helper, history API routes; update photo view endpoint.

- [ ] Define discriminated scopes: purchase order, purchase receipt, outward challan, inward return, dispatch, subplate stage/event.
- [ ] Build one server resolver for both counts and gallery contents.
- [ ] Add `POST /api/photos/history/summary` for batched visible-row counts and states.
- [ ] Add `POST /api/photos/history` for one scoped, paginated grouped gallery.
- [ ] Resolve PO receipts and outward returns through canonical parent relationships.
- [ ] Enforce document/stage authorization for metadata, counts, child groups and image reads. Login alone is insufficient.
- [ ] Handle purchase receipt authorization against `po_inward`, separately from jobwork `inward`.
- [ ] Return available, expired and manually removed counts; retain minimal audit associations after physical deletion.
- [ ] Count distinct photo IDs, not association rows. Shared photos may appear in several valid groups; header total remains distinct.
- [ ] Use real pagination and SQL aggregates; do not derive counts from the current 500-photo response cap.
- [ ] Return only necessary gallery metadata, without upload credentials or download links.

**Exit check:** Counts and gallery agree, unauthorized users cannot infer/read unrelated evidence, every page is accessible, no missing-photo state is inferred from request failure.

## Phase 3: Shared view-only popup

**Dependencies:** Phase 2. Visual skeletons can be prepared earlier, but real integration uses verified contracts.

**Components under `src/components/photos/`:**

- [ ] `photo-history-button.tsx`: image icon, count/state, accessible label, click stops row expansion.
- [ ] `photo-history-dialog.tsx`: existing Modal/overlay stack, scope context, grouped grid, loading/error/empty/deleted states.
- [ ] `photo-history-group.tsx`: receipt/event reference, party, business event date and thumbnails.
- [ ] Shared `photo-viewer.tsx` or existing equivalent: large image, zoom/pan, Fit/Reset, previous/next and Back.

**Behavior:**

- [ ] Thumbnail metadata shows uploader and full server upload date/time in IST. Receipt date is separately labelled.
- [ ] Open/close preserves table filters, page, sort and scroll.
- [ ] Touch-friendly tile tap opens preview; no reliance on hover controls.
- [ ] Normal wheel scroll/pan; Ctrl/Cmd+wheel or pinch zoom; bounded pan.
- [ ] Keyboard navigation, Escape handling, focus trap/restore and labelled controls.
- [ ] Image load failure has Retry; permission revoked/expired while open has explicit state.
- [ ] Gallery contains no upload/download/delete/approval buttons, including for admin.
- [ ] No separate full mould timeline entry point.

**Exit check:** Desktop and mobile popup inspect photos clearly without changing the underlying row/page or exposing management actions.

## Phase 4: Integrate screens

**Dependencies:** Phases 1-3.

| Order | Existing file | Integration |
| --- | --- | --- |
| 1 | `src/views/purchase-inward-page.tsx` | Receipt Images action, exact receipt scope |
| 2 | `src/views/purchase-page.tsx` | Voucher-adjacent Images, all linked receipts grouped |
| 3 | `src/views/challan-page.tsx` | Outward plus returns gallery |
| 4 | `src/views/inward-page.tsx` | Exact return receipt gallery |
| 5 | `src/views/dispatch-page.tsx` | Exact dispatch gallery |
| 6 | `src/features/subplates/components/subplate-stage-card.tsx` | Separate VMC QC, Final QC and packing actions |

- [ ] Every rendering variant uses the shared action and scope type.
- [ ] One dialog controller per mounted list rather than per-row fetching modals.
- [ ] Image view action is based on view permission, not Revert/Delete permission.
- [ ] Existing Voucher, locked PO editing, Undo grace period, inventory operations and stage assignment remain intact.
- [ ] QC/packing read access remains separate from upload/completion controls; do not introduce new completion semantics in this UI patch.
- [ ] Reuse shared dispatch action in nested dispatch history where the same record already appears.

**Exit check:** User can discover photos from all agreed locations; unrelated movement/stage photos never mix.

## Phase 5: Cache, status accuracy and performance

**Dependencies:** Phases 2-4.

**Files:** `src/lib/query/keys.ts`, principal-aware query helpers; proposed `src/features/photos/queries/photo-history.ts`.

- [ ] Batched count query for currently visible rows; lazy gallery metadata and lazy images.
- [ ] Scope/principal-aware cache keys and late-response guards.
- [ ] Invalidate child and parent aggregates after final linking, receipt changes/revert, photo removal, retention deletion and stage/dispatch changes.
- [ ] Abort or ignore old request when popup scope changes/closes.
- [ ] Preserve image storage policy; do not silently add persistent thumbnail/original duplicates.
- [ ] Distinguish loading, empty, expired, removed, partial and failed states.

| State | Required action label |
| --- | --- |
| Available | `Images (N)` |
| No photos recorded | `Images (0)` |
| All retention-deleted | `Photos expired` |
| All manually removed | `Photos removed` |
| Some remain | `Images (N)` with unavailable-photo explanation inside |
| Count request failed | `Images unavailable` and retry |
| Count loading | Loading placeholder, never fake zero |

**Exit check:** Accurate counts after changes, no account/scope cache leakage, no per-row full gallery requests, no silent truncation.

## Phase 6: Verify and release

**Dependencies:** All prior phases.

- [ ] Add focused automated tests for canonical scope resolution, permission checks, transaction rollback/replay, distinct counts, grouping and pagination.
- [ ] Test PO with multiple partial inward receipts and one upload shared across several receipts.
- [ ] Test outward with multiple returns; direct inward gallery shows only its own receipt.
- [ ] Test VMC QC, Final QC, packing and dispatch isolation.
- [ ] Test legacy unlinked image, all-expired, partial-expired and manually removed states.
- [ ] Test failed count/image fetch, Retry, permission revocation, rapid A-to-B popup switching and account change.
- [ ] Test touch pinch/pan, keyboard, focus restoration and unchanged underlying scroll/filter state.
- [ ] Run typecheck, existing regression suite, targeted lint and relevant deployment preview build.
- [ ] Verify actual upload-to-history viewing with isolated database/storage on desktop and representative mobile device.
- [ ] Deploy forward migration before enabling dependent API/UI; use a staged flag if release must be split.
- [ ] Keep old upload paths compatible during rollout; do not make new association fields mandatory before updated callers are deployed.
- [ ] Document rollback that hides new gallery entry points while preserving photo/event data; do not drop tables or delete photos as rollback.

**Exit check:** Saved photos are associated, discoverable, authorized and viewable from every agreed screen. No production-ready claim based solely on typecheck or a visible button.

## Out of scope for this focused change

- New photo approval/rejection process.
- Full mould timeline page.
- Gallery upload/download/delete controls.
- Changes to the agreed 30-day retention, compression/storage limits or business quantity rules.
- Completing the full Cloudflare migration or ZIP/background-processing redesign. Those remain in the system remediation handoff; coordinate shared dependencies.

## Implementation report required

Report completed tasks, changed files, migration state, historical-image repair results, actual tests and live checks, and remaining unresolved issues. Keep all pending checklist items open until verified.
