# Photo History Gallery: Confirmed UI and Implementation Handoff

Date: 16 November 2026  
Workspace: `D:\Repo\starmould`  
Status: Scope confirmed by user. Planning document only; application code not changed.

## 1. Problem aur exact goal

Photo upload ho rahi hai, lekin saved movement ki history se admin/uploader ko usko dekhne ka clear action nahi mil raha. Purchase Inward screenshot mein receipt history ke Actions mein sirf Revert/Undo hai. Purchase Order mein Voucher jaisa Images action missing hai.

Goal: Har agreed row/stage par `Images (count)` action, jo same page par read-only popup gallery khole. Popup mein thumbnail select karne par large photo aur zoom mile.

Related documents:

- [Original requirements](/D:/Repo/starmould/docs/plans/PHOTO_STORAGE_AND_CLOUDFLARE_PLAN.md)
- [System correctness and remediation handoff](/D:/Repo/starmould/docs/plans/PHOTO_SYSTEM_FIX_IMPLEMENTATION_HANDOFF.md)

Yeh document history access and gallery UX ka focused extension hai. Earlier handoff ke permissions, atomic linking, retention aur upload fixes replace nahi karta.

## 2. Confirmed decisions

| Topic | Agreed behavior |
| --- | --- |
| Button placement | Existing row Actions area; QC/packing mein corresponding stage card |
| Label | `Images (3)` with image icon and available photo count |
| Open behavior | Same-page popup; filters, sort, pagination aur underlying scroll preserve |
| Large photo | Thumbnail click se large preview plus zoom |
| Metadata | Uploader name and server upload date/time in IST |
| Approval | New photo approval/rejection workflow nahi |
| Purchase Order | All linked inward receipts, receipt-wise separate groups |
| Purchase Inward | Sirf clicked receipt ki photos |
| Outward Jobwork | Outward photos plus every linked return inward, separate groups |
| Inward Jobwork | Sirf clicked return receipt ki photos |
| QC | VMC QC and Final QC stage-specific photo access |
| Packing | Packing stage-specific photo access |
| Dispatch | Clicked dispatch row ki photos |
| Empty state | `Images (0)` remains visible and opens explanation |
| Expired state | `Photos expired` separately visible; opens retention explanation |
| Gallery operations | View/zoom only; no upload, download, delete or approve buttons |
| Admin management | Download/delete existing Photo Storage dashboard mein |
| Full mould timeline | Is popup mein separate full mould timeline option nahi |

Browser se visible image ko absolutely unsavable banana possible nahi. View-only ka matlab CRM mein download/edit/delete controls absent hain; access permissions phir bhi server par enforced hon.

## 3. Current facts and root causes

1. Saved history rows gallery/list API mount nahi karti. Existing uploader create modals and QC dialog mein hai.
2. Purchase inward submit PO-wise receipts create karta hai, lekin receipt IDs preserve/link nahi karta. Current attach request mein `movementId` absent hai; delivery number final receipt identity nahi hai.
3. Current `/api/photos/list` active photos only return karta hai, maximum 500; counts, expiry summary, PO scope aur outward-plus-returns scope missing hain.
4. Current single `movement_id` ek photo ke multiple generated receipts se link ko represent nahi karta.
5. Attach calls separate unawaited requests hain, HTTP errors check nahi hote. Isliye upload success history association success ka proof nahi.
6. `scan.order_id` lookup repository schema se match nahi karta; actual `scan.projectid` mapping earlier handoff mein specified hai.
7. Current QC dialog uses uploader; packing stage uploader/history integration missing hai.
8. New `src/lib/photos/types.ts` already working tree mein exists. Reuse/extend its current contracts, duplicate conflicting file mat banao. Other work is in progress; implementation se pehle latest diff recheck karo.

Old uploaded test photo ko new button alone reliable receipt se match nahi kar sakta. Linking repair is feature ka required part hai.

## 4. Exact placement and history scopes

| Screen | Existing file | Button location | Server scope |
| --- | --- | --- | --- |
| Purchase Order | `src/views/purchase-page.tsx` | Voucher ke paas existing Actions; grouped, flat and mobile variants | `purchase_order`, purchase ID |
| Purchase Inward log | `src/views/purchase-inward-page.tsx` | Receipt Actions mein Revert/Undo se pehle; uploader/admin role branch ke outside, after view permission check | `purchase_receipt`, po_inward ID |
| Outward Jobwork | `src/views/challan-page.tsx` | Voucher/print ke paas, all row/mobile variants | `jobwork_outward`, challan ID; own photos plus returns |
| Inward Jobwork | `src/views/inward-page.tsx` | Existing receipt Actions; desktop/mobile | `jobwork_receipt`, inward ID |
| VMC QC | `src/features/subplates/components/subplate-stage-card.tsx` | VMC QC card mein explicit Images button | `stage`, subplate ID + vmc_qcby + event/cycle where available |
| Final QC | Same stage card | Final QC card mein separate button | `stage`, subplate ID + final_qcby + event/cycle |
| Packing | Same stage card | Packing card mein separate button | `stage`, subplate ID + packing_workby + event/cycle |
| Dispatch history | `src/views/dispatch-page.tsx` | Existing print/voucher Actions ke paas; desktop/mobile | `dispatch`, dispatch ID |

Optional existing nested entry point: `src/features/subplates/components/dispatch-stage-details.tsx`. If it displays the same dispatch record, same shared action reuse karo, new independent photo logic nahi.

Purchase receipt identity `po_inward.id` hai. PO grouping relation `po_inward.pid -> purchase.id` hai. Jobwork return identity `inward.id` and parent relation `inward.challanid -> challan.id` hai. Dono inward types ko generic `inward` table samajh kar mix mat karo.

## 5. Shared UI components

Create/reuse under `src/components/photos/`:

| Component | Responsibility |
| --- | --- |
| `photo-history-button.tsx` | Count/state label, accessible click, stop row expansion/navigation |
| `photo-history-dialog.tsx` | Popup title, context metadata, fetch lifecycle, grouped grid and states |
| `photo-history-group.tsx` | Receipt/outward/return/stage heading and photo thumbnails |
| `photo-viewer.tsx` | Large image, zoom/pan, reset, previous/next, keyboard and touch |

Use existing `src/components/ui/dialog.tsx` Modal and overlay stack. Existing fix handoff proposes a viewer too; if already implemented, extend it instead of making two competing viewers.

### Button contract

- Props: typed `scope`, `summary`, `onOpen`, optional compact styling.
- Row action calls `event.stopPropagation()` so image click does not expand row or trigger receipt action.
- Loading count ko `0` mat show karo; skeleton/`Images (...)` with readable loading label use karo.
- Failed count ko `Images unavailable` or retry state dikhao. Count failure is not proof of missing photos.
- Approved labels/badges add mat karo. `Available` is storage/view state, not QC approval.
- View action ko Revert/Delete permission par gate mat karo. Existing document view permission and actual associations use karo.
- Images action existing voucher, locked PO edit, Undo grace window, delete guards aur row layout ko change nahi kare.
- Every list view per mounted screen ek dialog controller rakhe. Har row mein independently mounted fetching modal unnecessary hai.

### Popup layout

```text
Purchase Order <PO Number>                         [Close]
Supplier | Mould/Project | 7 available photos

Receipt <Receipt Number> | Received date | 3 photos
[thumbnail] [thumbnail] [thumbnail]
Uploader: <Name> | Uploaded: <date, time, seconds> IST

Receipt <Receipt Number> | Received date | 4 photos
[thumbnail] [thumbnail] [thumbnail] [thumbnail]
```

- Receipt date header business event date hai. Thumbnail metadata server upload time hai. Dono clearly labelled; ek ko doosre ka timestamp mat banao.
- Outward popup first `Sent to jobber`, then return receipt groups. Actual event numbers and party show karo.
- Single-receipt, stage and dispatch popup sirf relevant scope show kare.
- Newest receipt groups first; outward-own group fixed first. Photos inside a group upload time ascending with photo ID tie-breaker. Yeh recommended consistent ordering hai, new business requirement nahi.
- Grid mobile par 2 columns, desktop par available width ke hisaab se 3-5. Normal gallery area scrollable, header/close reachable.
- Image area uses object-contain for inspection. Thumbnails can crop, full preview must not crop evidence.
- Thumbnail metadata mein uploader and exact upload date/time visible or accessible ho. Date-less time ambiguous hai.

### Large preview

- Same popup ke andar viewer mode preferable; Back returns to same group/grid scroll position. Nested overlay ho to existing overlay-stack behavior verify karo.
- Zoom +/-, Fit, Reset, touch pinch/pan and keyboard previous/next. Escape first closes viewer mode, next Escape closes gallery.
- Normal mouse wheel scroll/pan; Ctrl/Cmd+wheel zoom. Clamp pan so photo empty space mein lost na ho.
- Focus trap, labelled controls, focus return to originating Images button, visible keyboard focus and proper dialog title required.
- Photo changed/closed par zoom state reset; component cleanup listeners/object URLs release kare.
- Loading image, failed image with Retry, 403 permission revoked and 410 expired while open ke explicit states hon.

## 6. Typed data contracts and API changes

Extend `src/lib/photos/types.ts` with `PhotoHistoryScope`, `PhotoHistorySummary`, `PhotoHistoryGroup`, `PhotoHistoryItem` and paged response types. UI raw filter strings build na kare.

Suggested discriminated scope:

```ts
type PhotoHistoryScope =
  | { kind: "purchase_order"; purchaseId: number }
  | { kind: "purchase_receipt"; receiptId: number }
  | { kind: "jobwork_outward"; challanId: number }
  | { kind: "jobwork_receipt"; inwardId: number }
  | { kind: "dispatch"; dispatchId: number }
  | {
      kind: "stage";
      subplateId: number;
      stageKey: "vmc_qcby" | "final_qcby" | "packing_workby";
      eventId?: string;
    };
```

Suggested API boundaries, merge with equivalent existing work if present:

| API | Behavior |
| --- | --- |
| `POST /api/photos/history/summary` | Batch authorized scopes for visible rows; counts/state only, no photo blobs |
| `POST /api/photos/history` | One authorized scope, context, groups, page/cursor metadata and limited photo metadata |
| Existing `GET /api/photos/view/[id]` | Authorized individual image; same viewer source, no download UI |

Read-only POST permits structured scope without encoding complex arrays into URLs. Standardize error/status contract with existing API conventions.

Summary response per scope should include:

- Stable scope key.
- `availableCount`: distinct ready/viewable photo IDs.
- `expiredCount`: retention-deleted photo IDs.
- `removedCount`: admin-removed photo IDs where policy permits disclosing reason.
- Explicit state such as `available`, `empty`, `expired`, `removed`, `partial`.
- Optional `retentionDeadline` only when actually defined for this scope; shared-photo dates may differ. Do not invent one aggregate deadline.

Count labels: `Images (N)` uses distinct physical photo IDs, not association-row count. Shared photo in two receipt groups may appear in each relevant group with shared label; popup header deduplicates overall total and clearly says group totals can overlap. Count and content use the same resolver.

Gallery items return ID, authorized `viewUrl`, uploader name, canonical upload timestamp, dimensions and optional item label. Read-only history response does not need raw R2 key, signed upload credentials or download URLs.

Use cursor pagination for groups and photos. Metadata include total counts independent of loaded page, `nextCursor`, and group continuation markers. Current `limit(500)` must not silently hide additional photos.

## 7. Canonical server-side scope resolver

New/reused `src/lib/photos/history.ts` should own both summaries and gallery filtering. No duplicate scope rules inside each page component.

### Purchase receipt

- Resolve actual `po_inward.id` and its photo-event associations.
- Do not match by upload date, supplier, project code or delivery number alone.
- Return movement-wide and relevant item photos for that receipt, without importing all photos from its project.

### Purchase order

- Authorize `purchase.id` and resolve linked `po_inward.pid` receipts using paginated queries.
- Group matching photos by receipt ID; show `insrno`, received date and receipt state.
- Pending unreceived PO can show `Images (0)` with `No inward photos have been recorded for this purchase order.` No new PO-order photo requirement.

### Outward and returns

- Authorize challan ID and resolve own outward photos plus `inward.challanid` returns.
- Distinguish two inward receipts even when jobber/date/document text same ho.
- Direct inward scope includes only clicked inward ID. Challan ID fallback kabhi inward ID ke roop mein store mat karo.

### QC and packing

- Resolve actual subplate ID and stage key; add event/cycle ID if stage history exists.
- Legacy photos with only subplate/stage link can be shown as legacy stage evidence; arbitrary date-based invented event grouping mat karo.
- Repeated inspections in same stage separate stored events hon to per-event groups show karo. VMC QC/Final QC/packing mix nahi hone chahiye.
- This handoff adds read access, not a new stage assignment/completion policy. Earlier handoff owns mandatory evidence enforcement.

### Dispatch

- Actual dispatch ID ki finalized photos only; project-wide outward/packing photos include mat karo.

## 8. Fix linking before exposing the new gallery

This is a dependency, not optional polish.

1. Review current create mutation envelopes in `src/lib/query/hooks.ts`: server returns `receipt`, `challan`, `inward` or `dispatch` named result. `created.id` blindly assume mat karo.
2. Purchase inward loop har created receipt ID retain kare. One photo can belong to multiple generated receipts, so canonical event association join table use karo, single movement ID overwrite nahi.
3. Photo links and inventory creation transactionally finalize karo per existing remediation handoff. Fire-and-forget attach calls ko sole source of evidence mat rakho.
4. Derive PO/receipt/challan/return/project associations from trusted database rows, not user-entered numbers.
5. Persist confirmed group context before gallery invalidation. UI success ko actual final photo association success represent karna chahiye.
6. Existing uploaded test photos ke liye dry-run audit report generate karo: known exact links, unclaimed uploads, missing objects and ambiguous associations.
7. Only deterministic links backfill karo using stable server event/draft/source records. Same vendor/time window se photo auto-attach mat karo.
8. Ambiguous old photo admin-review recovery path mein rakho in Photo Storage dashboard. Proposed `Unlinked photos` section may support admin preview and explicit confirmed association; general history gallery stays view-only.
9. Agar old upload ke paas stable evidence nahi hai, successful auto-recovery claim mat karo. Record unresolved and require explicit admin association in recovery tooling.

Forward migration add karo if event links, tombstones, stage events or indexes missing hain. Already-applied SQL edit mat karo. New types existing database schema implement hone ka proof nahi hain.

## 9. Permissions and deleted-photo states

Use one shared access policy for summary, gallery and image endpoints. Existing `src/lib/document-access.ts` and permissions loader extend/reuse karo.

- Purchase inward read permission uses actual purchase receipt authorization, not generic jobwork inward authorization. Existing document helper currently maps `inward` to `inward` table, whereas purchase receipt is `po_inward`.
- Uploader hona alone unrelated business documents access karne ka bypass nahi. Admin sees all permitted administrative scopes; regular user current document/stage permissions se view kare.
- Aggregate PO/outward results filter children by allowed read access. Unauthorized groups/counts must not leak through summaries; return accessible totals consistently.
- Arbitrary IDs, mixed type/ID and no-filter list calls must not expose all photos.
- API 401/403 ko empty/expired state mein translate mat karo.
- Read gallery frontend controls ke saath server authorization bhi compulsory hai.

| Condition | Row label | Popup behavior |
| --- | --- | --- |
| Available photos | `Images (N)` | Grouped grid |
| No recorded photos | `Images (0)` | Clear no-photos explanation |
| All photos retention-deleted | `Photos expired` | Explain retention removal, known date where available |
| All photos manually removed | `Photos removed` | Clear removed state; no false retention reason |
| Some available, some expired/removed | `Images (N)` | Available grid plus removed/expired summary |
| Unlinked legacy evidence known | Available count only; optional needs-review indicator | Explain unlinked evidence separately, no guessed photos |
| Metadata request failed | `Images unavailable` | Retry and error message |
| Permission denied | Omit action if view disallowed | Server denies direct requests |

Keep minimal photo tombstone/association metadata after object removal so `expired` and `never uploaded` distinguish ho sakein. No stale thumbnail with broken URL. Deleted image blobs nahi, only audit metadata retain.

## 10. Query caching and performance

**Files:** `src/lib/query/keys.ts`, existing principal-aware query wrappers, proposed `src/features/photos/queries/photo-history.ts`.

1. Add centralized summary/detail keys containing principal scope, scope type/ID/stage/event and page cursor, consistent with current cache isolation architecture.
2. Visible rows ke scopes batch karo. Per row individual count request or full image download mat karo. Desktop/mobile same underlying list keys reuse karein.
3. Open popup par photos metadata fetch karo, image blobs only visible thumbnails and selected preview ke liye load hon. Whole gallery full-resolution preload mat karo.
4. Existing compressed image use karo initially; lazily load and bound visible grid. Persistent thumbnails original one-copy policy/storage footprint change karenge, so separate thumbnails silently add mat karo.
5. Summary/detail invalidation on successful final photo link, removal, expiry, receipt creation/revert and relevant stage/dispatch update. PO and parent outward aggregates bhi invalidate hon.
6. User logout/account switch par prior responses new principal ki UI update na karein. Existing `principalFetch`, snapshot guards and query conventions reuse karo.
7. Close/switch scope par requests abort or results scope-key guarded hon. A ki delayed response B popup mein show na ho.
8. Stale count gracefully reconcile when popup opens. Button count, popup totals and tombstones same authoritative model use karein.

Indexes should support photo-event IDs/types, receipt parent relations, photo state and stable pagination ordering. Counts SQL aggregation se calculate karo; unpaginated photos JS mein fetch karke length mat count karo.

## 11. File-by-file implementation checklist

| File/area | Required change |
| --- | --- |
| `src/lib/photos/types.ts` | Typed scope, summary, group, item and paged response; existing IDs/states reuse |
| `src/lib/photos/history.ts` | Shared scope resolution, deduplication, groups, count/expired semantics |
| Existing/new photo access helper | Parent/child/stage authorization shared across APIs |
| `src/app/api/photos/history/summary/route.ts` | Batch authorized visible-row summaries |
| `src/app/api/photos/history/route.ts` | Scoped, paginated gallery data |
| `src/app/api/photos/view/[id]/route.ts` | Enforce same associations/access and expired responses |
| `src/lib/query/keys.ts` | Central history summary/detail keys |
| `src/features/photos/queries/photo-history.ts` | Principal-aware batched counts and lazy popup queries |
| `src/components/photos/photo-history-button.tsx` | Shared action/status label |
| `src/components/photos/photo-history-dialog.tsx` | Read-only grouped gallery and state handling |
| `src/components/photos/photo-history-group.tsx` | Group context and thumbnails |
| Existing/new shared photo viewer | Large photo/zoom/pan and accessibility |
| All five movement/PO views | Wire exact row scopes and dialog controller; all view variants |
| Subplate stage card | Stage-specific read gallery separate from upload/assignment actions |
| Inventory create APIs/RPC/mutations | Correct typed IDs and atomic photo associations |
| Forward SQL migration | Required event links/indexes/tombstones/backfill support |
| Photo Storage dashboard | Reuse existing management; recovery for ambiguous unlinked photos only where required |

## 12. Implementation sequence

1. Re-read active diff, existing shared types, UI variants, API envelopes and installed Next.js guides.
2. Implement canonical association fixes and authorization dependencies with safe migration/backfill report.
3. Implement shared resolver and batch-summary/detail APIs, tests first for PO/receipt and outward/return scope correctness.
4. Build shared button, read-only gallery and viewer.
5. Integrate Purchase Inward and PO first. Reproduce user's saved test-image case with a verified association.
6. Integrate outward, inward, dispatch and QC/packing stage cards using same components.
7. Add invalidation, expiry/tombstone states, responsive/accessibility checks and regression coverage.
8. Report unresolved historical links honestly. Do not mark fixed just because new uploads work.

## 13. Acceptance scenarios

| Test | Expected result |
| --- | --- |
| Purchase receipt with 3 images | Row `Images (3)`; only that receipt's photos open |
| Same PO with 2 partial receipts | PO gallery has two labelled receipt groups; receipt popups remain isolated |
| One upload batch creates several receipts | Shared photos accessible from every explicitly linked receipt, no duplicated R2 storage |
| Outward with 2 returns | Outward popup own group plus two return groups; direct return popup only its photos |
| VMC QC versus Final QC versus Packing | Separate buttons, correct stage images |
| Dispatch row | Correct final dispatch photos only |
| New upload succeeds but final linking fails | No false saved gallery/count; recoverable failure |
| Count fetch fails | No false `Images (0)` |
| All expired | `Photos expired`, explanation, no broken image request |
| Mixed available and removed | Count includes available only; popup explains other states |
| Unlinked historical test photo | Deterministically repaired or explicitly pending admin recovery; never guessed |
| Restricted user/direct URL | Unauthorized metadata/count/image access denied |
| Large history beyond one page | Counts accurate; all pages reachable |
| Click Images inside expanding row | Only gallery opens; row/filter/page/scroll unchanged |
| Mobile thumbnail | Tap opens preview, pinch/pan/reset works |
| Close viewer/gallery | Focus and grid/page scroll restored; no background scrolling leak |
| Fast row A then row B / account switch | No stale photos from wrong scope/principal |
| Gallery read-only | No upload/download/delete/approve controls, including admin |

Run meaningful new resolver/API/component tests plus existing typecheck, regression suite and targeted lint. Inspect desktop grouped/flat/mobile variants and verify actual upload-to-history flow against an isolated test environment. Do not change inventory business behavior, download permissions, retention duration or PDF viewport interactions while adding gallery access.

## 14. Required implementation report

- Changed files and new components.
- Exact scope coverage for every screen/view variant.
- Applied versus pending migrations and old-photo repair results.
- Permission and count/group test results.
- Actual live image-viewing verification versus static checks only.
- Remaining missing/ambiguous old uploads and failure cases.

Completion means saved photos are correctly linked, discoverable in the agreed history locations, authorized and viewable. A button with an unreliable count is not completion.
