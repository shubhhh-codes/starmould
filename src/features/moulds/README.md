# Mould dashboard feature

This feature owns dashboard mould presentation and its existing subplate workflows.
Shared UI, calculations, authentication and transport remain in their existing modules.
The legacy dashboard component and query-hook imports remain compatibility entrypoints.

## Ownership

- `mould-projects-table.tsx`: connects the table, drawers and shared integration dialogs.
- `components/`: toolbar, desktop rows, mobile cards, pagination and subplate panels.
- `hooks/`: form submission, details, project deletion/completion, assignments, menus and keyboard handling.
- `model/`: shared types and pure form/filter transformations.
- `queries/`: the existing project stream and mould/subplate queries and mutations.

Query transport and pagination types live in `src/lib/query/fetch-json.ts` and
`src/lib/query/types.ts`. Feature query modules must not import the old `query/hooks.ts`
entrypoint. Its re-exports support existing callers without a dependency cycle.

The separate Subplate Master screen lives under `src/features/subplates/` and retains
its own form behavior. Its forms are deliberately not substituted for dashboard forms.

## Verification

- `npm test`: existing library, customer identity, mould model and query checks, without network/database access.
- `npm run test:ui`: isolated dashboard/Subplate fixtures and shared drawer browser checks. Uses Chrome (`CHROME_PATH` can override its location).
- `npm run typecheck`, changed-file ESLint and `npm run build`.

The browser fixture uses manufactured records and intercepted API responses. It never signs into the app or changes live business records.

## Behavior deliberately preserved

- Received-date descending sorting; 15-row pages; index-based selection.
- Nonempty preloaded subplates skip lazy loading; empty arrays still trigger the existing query.
- Parent bulk delete callback takes precedence over the single callback, then direct DELETE; force remains `true`.
- Current form defaults allow blank dimensions; generated codes, calculations and payloads are unchanged.
- Excel currently exports all incoming records as CSV; PDF calls browser print. Correcting exports belongs to a separate change.
- Existing permission gates, cache keys, broadcasts and per-action notification/refresh ordering remain authoritative.

These are compatibility boundaries, not endorsements of the existing behavior. Any bug found while extracting code should be handled separately.

## Explicit follow-up UI changes

The user subsequently requested these corrections alongside the refactor:

- Position the rolling quantity digits on mount so the default 1 does not visually show 0.
- Give drawer plate names their own line; wrap codes/badges and move stage/actions below them.
- Add clearly labelled mobile `View Subplates` and `History` actions, visible only to admins.

These are intentional UI changes, rather than incidental consequences of moving files.
Existing desktop/subplate permissions and server authorization are unchanged.
