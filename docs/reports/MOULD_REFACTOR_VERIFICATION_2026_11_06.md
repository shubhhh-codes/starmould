# Dashboard and Subplate Refactoring Verification

Date: 6 November 2026. No commits were made.

## What Changed

- Dashboard views, forms, actions, and data helpers were split into separate files.
- Subplate page uses 2-space indentation; large table, mobile, stage, and form sections are structured in meaningful components.
- Legacy imports and request formats were preserved. No database schema changes were made.
- Fixed an issue where the displayed quantity initially rendered as 0 despite the actual value being 1.
- Plate names, code/badges, and stage/actions were properly allocated in the details drawer.
- Mobile mould cards feature clear `View Subplates` and `History` buttons. New mobile buttons are visible only to Admins; existing desktop permissions were not modified.

## Manual App Verification

Checks were conducted in Chrome on the logged-in app at `http://localhost:3000`.
With user permission, a temporary mould `QA TEMP - DELETE AFTER TEST` was created under `TEST CUST`.
Its project code was `0002_TESTC_002` and the test plate code was `0002_TESTC_002_001`.

| Check | Expected | Actual |
|---|---|---|
| Temporary mould save | New record displayed, TESTC initials retained | Match; record appeared after dashboard refresh |
| Dashboard sort | Order changes according to received date | Both date orders displayed on screen |
| Dashboard search | Search for QA TEMP displays only the test mould | Match; Escape cleared the search |
| Selection | Both rows selected from header; Escape clears | Match; no bulk actions submitted |
| Page size | Select 10 and 15 items | Match; next-page navigation not checked due to few records |
| Add plate defaults | Plate 1, generated code, MS-Bright, mm, quantity 1 | Match; quantity display issue resolved and verified as 1 |
| Weight | 100 × 50 × 20 mm, MS-Bright, 1 piece = 0.781 kg | Match; remained 0.781 kg and quantity 1 after save |
| Minimum quantity | Keyboard navigation does not decrease below 1 | Match; Down to 1, Up to 2, Down to 1 |
| Inline expansion | Saved plate and details displayed | Match |
| Details drawer | Plate, dimensions, and code displayed | Match |
| Drawer text | Names do not squeeze; badges wrap cleanly | Visually verified on desktop and 390px mobile viewport |
| Mobile entry | Labelled buttons open subplate drawer and History | Both opened; History displayed saved plate and mould events |
| Subplate mobile view | Search, dimensions, qty, stages, and edit actions work | Match |
| Subplate edit | Only disposable plate name is updated | Match; displayed `QA TEMP PLATE A EDITED`; code/dimensions/quantity/weight preserved |
| Blank name validation | Save button is disabled | Match |
| Purchase/inward restrictions | Direct manual stage assignment replaced with PO/Gate Entry action on unordered plates | Mobile studio displayed PO required and Gate Entry Required; commercial records not created |
| Delete cancellation | Cancel keeps test mould intact | Match |
| Test cleanup | Only disposable mould and plate are removed | Match; QA TEMP search empty; original mould and plate reappear |

Original customer initials were not edited. Original mould `0001_TESTC_001` and plate
`0001_TESTC_001_001` (121 × 12 × 21 mm, quantity 10) remained on screen after cleanup.
The sequence number for the test mould was utilized without resetting the global counter.

## Verification Limitations

### Follow-up Live Check — 6 November 2026

- Tested quantity with 5 plus/minus cycles; consistently observed 1 → 2 → 1. Number remained stable after releasing the button; minus button was disabled at minimum.
- Holding the button in browser for 700 ms incremented quantity to 7 and stopped upon release. Reverted to 1 via keyboard. Note: this was a desktop mouse hold check; physical touch on a mobile device was not verified.
- Created disposable mould `QA TEMP - DELETE AFTER TEST - VERIFY 01` (`0002_TESTC_002`) with `QA TEMP VERIFY PLATE` (plate #4).
- Assigned Design Order to `designer`; displayed 1/9 stages completed with timestamp. Assignment persisted after page refresh. Reverting to Unassigned via Admin reset status to 0/9 and Pending.
- Changing accounts during non-admin testing caused session transitions; stable staff session results were not fully recorded.
- Automated browser controller paused when navigating Chrome network controls without confident URL confirmation. Consequently, network failure recovery, pagination, and live permission revocations were not fully tested.
- **The disposable mould and plate from this follow-up remained in the test database.** Browser halt prevented automatic cleanup. Original business records were untouched.

Summary of remaining limitations:

- Live login from non-admin accounts and real-time permission revocations were not executed.
- Reliable end-to-end assignment save/unassign was not manually recorded across all permutations.
- Forced network/database failures during save/delete operations were not simulated.
- Physical touch/hold/repeat behavior on mobile devices was not fully verified.
- Multi-page navigation with over 15 moulds was not tested.
- Long-press gestures, drag-to-close, and reduced-motion preferences on actual devices were not evaluated.
- Existing linked commercial records were not deleted, edited, or recreated.
- Shared drawer animation checks were automated; individual animation frames were not certified manually.

## Repeatable Automated Checks

- `npm test`: 106 existing library checks; customer identity, mould form/filter, and query checks.
- `npm run test:ui`: Isolated dashboard, Subplate, and shared drawer browser checks.
- Query movement: Exact match verified between old and new implementations for 15 functions/types.
- Subplate movement: Exact match verified for order and implementation across 98 state/action statements.
- Type check, changed-file lint, language check, and production build executed.
- Final production build, type checking, repeatable browser tests, and offline tests passed.
  No errors found in changed-file lint; existing pre-refactoring warnings remain.
- Visible text and input states matched across 7 old/new browser checkpoints in Subplate.

Isolated checks utilize mock records and do not touch real business records.
Pre-existing lint warnings and compatibility quirks were intentionally left untouched.
CSV/print exports and blank-dimension behaviors remain pending for separate updates.
