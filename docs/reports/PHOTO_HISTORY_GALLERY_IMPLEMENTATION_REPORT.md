# Photo History Gallery Implementation Report

Date: 16 November 2026

## Delivered

- `Images (count)` actions in Purchase Order, Purchase Inward, Jobwork Outward, Jobwork Inward and Dispatch row actions, including existing desktop/mobile variants.
- Separate Images actions in VMC QC, Final QC and Packing stage cards.
- Shared read-only popup gallery with receipt/return grouping, uploader names and server upload timestamps in IST.
- Large preview with bounded pan, zoom controls, Ctrl/Cmd-wheel zoom, normal wheel pan, touch pinch, previous/next and keyboard close.
- Distinct never-uploaded, retention-expired, manually removed, partial, loading and error states.
- Batched counts for visible rows, lazy image loading, group/photo pagination and principal-scoped cache isolation.
- Server authorization shared by history metadata and image reads; parent scope does not grant restricted child receipt access.
- Inventory creation receives photo evidence in its request and finalizes links in the database transaction. The generic detached attachment endpoint now rejects reassignment.
- Stable explicit purchase receipt replay keys prevent repeated successful PO receipts when retrying a partially completed batch.
- Admin-only Unlinked Photo Recovery in Photo Storage, with image preview, searchable target selection, multiple-receipt association, explicit reason and audit logging.
- Recovery verifies actual object availability before linking. Missing and unverifiable files are visibly identified and cannot be linked as successfully recovered.

## Database and existing photos

Applied `20261116170000_photo_history_gallery.sql` to the configured database and requested PostgREST schema refresh. The prior photo contracts/atomic migrations were already present in database structure/function state; their migration registry entries were reconciled together with the gallery migration to preserve deployment order.

The gallery migration preserves the verified earlier inventory core, including source-line matching and quantity/partial-dispatch rules. The earlier atomic-photo SQL draft had omitted source-line guards, so that draft is not used as the gallery's business-rule implementation.

Storage inspection found 9 active upload records: 2 objects in R2 and 7 missing from R2. All 7 had matching processed WebP files in local development storage. Those exact files were copied to their existing R2 keys using conditional writes, verified, and the local copies were preserved. No new photo records or guessed receipt links were created.

All 9 legacy uploads remain available for explicit admin association. Their original saved receipt IDs are not reliably recorded. Use **Photo Storage > Unlinked photo recovery > Preview > Link to saved record** to select verified receipts/challans. No vendor/date heuristic was used to guess relationships.

## Main files

| Area | Files |
| --- | --- |
| UI | `src/components/photos/photo-history-button.tsx`, `photo-history-provider.tsx`, `photo-history-dialog.tsx`, `photo-viewer.tsx`, `unlinked-photo-recovery.tsx` |
| Scope/access contracts | `src/lib/photos/history-types.ts`, `history-access.ts`, `history.ts`, `movement-evidence.ts` |
| APIs | `src/app/api/photos/history/route.ts`, `history/summary/route.ts`, `history/recovery/route.ts`, existing image view/upload/attach routes |
| Integrations | Five purchase/movement views, `subplate-stage-card.tsx`, `app-layout.tsx`, Photo Storage view, query hooks/keys/persistence |
| Database | `supabase/migrations/20261116170000_photo_history_gallery.sql` |

## Validation

| Check | Result |
| --- | --- |
| TypeScript check | Passed |
| Existing library regression suite | 106 existing assertions passed, plus customer/mould regressions and new photo-history tests |
| Photo model/access tests | Passed: scope validation, IST, evidence identity, child authorization, permission failures, uploader isolation and pagination |
| SQL integration | Passed in an isolated schema with rollback: PO/receipt and outward/return scopes, distinct shared counts, stage separation, tombstones, photo/group pagination, atomic linking/replay/rollback and audited recovery |
| Browser gallery tests | Passed on desktop and emulated mobile: batched counts, read-only controls, IST, expiry, zoom, normal/control wheel, touch pinch, keyboard close and preserved filters |
| Production build | Passed in an isolated snapshot on the workspace drive after fixing unsupported Next.js exports |
| Focused lint | New gallery, access, history API and inventory helper files passed |
| Physical photo storage | All 9 legacy files available after restoration; no file deletions performed |
| Broader `test:ui` suite | Stops at dashboard CSV filename assertion in `scripts/test-dashboard-ui.cjs:35`; not a photo gallery assertion |

The SQL integration test replaces the inventory core with a test-only fixture implementation inside the isolated schema to test wrapper atomicity. It does not claim to exercise every real inventory business rule. The production migration retains the verified original core logic.

Four pre-existing unsupported Next.js exports blocked production type validation. Removed runtime helper re-exports from scanning/subplate/export page entry points, redirected a type-only stage import to its existing library, and made the quotation-number helper private to its route. Their underlying helper implementations were preserved.

## Boundaries and remaining checks

- No production business movement was created solely for testing, and no live photo was deleted.
- Browser tests use isolated fixture data and mobile emulation. A physical-phone check and an authenticated real upload-to-history walkthrough were not performed.
- Legacy uploads require admin verification before association. Files are restored; their business relationships were not guessed.
- Full Cloudflare hosting migration, broader photo upload/draft/retention/export remediation and their deployment verification remain separate workstreams from this gallery change.
- No commit or production frontend deployment was created by this task. The configured database migration and R2 file restoration were performed.

## Rerun checks

```text
npm run typecheck
npm test
npm run test:photos
npm run test:photos:db
```

`test:photos:db` needs the configured database connection. It creates only an isolated test schema inside a transaction and rolls it back; it never accesses R2.
