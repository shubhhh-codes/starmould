# StarMould ERP — Master Audit Report

**Date:** September 25, 2026  
**Environment:** Next.js 16.3.5 (Turbopack, React 19) + Supabase PostgreSQL  
**Local Test Server:** `http://localhost:3000`  
**Live Production URL:** `https://starmould.vercel.app/`  
**Repository:** `https://github.com/shubhhh-codes/starmould`  

---

## 1. Executive Summary & Audit Scope

A full multi-agent audit of the StarMould ERP codebase was executed across 8 specialized workstreams:
1. **Agent 1 — UI & Browser E2E Auditor:** Evaluated all 19 frontend routes, navigation shells, form interactions, validation rules, state bindings, drawers, modals, and responsive layout behavior.
2. **Agent 2 — API & Backend Auditor:** Evaluated all 23 Next.js Route Handlers (`/api/*`), HTTP methods, authentication guards, role-based authorization, input validation, and error responses.
3. **Agent 3 — Database & Data Integrity Auditor:** Evaluated PostgreSQL migrations (001–008), Supabase client configurations, SQL views, soft-delete semantics, constraint integrity, and data types.
4. **Agent 4 — Auth, Security & RBAC Auditor:** Evaluated HMAC token generation, session persistence, cookie flags, privilege boundaries (Roles 0–4), IDOR risks, PostgREST filter injection, file uploads, and sensitive data leakage.
5. **Agent 5 — Performance & Caching Auditor:** Evaluated TanStack React Query hooks, server-side in-memory caching, N+1 query patterns, column projections, aggregation queries, and memory lifecycle.
6. **Agent 6 — Code Quality & Architecture Auditor:** Evaluated dead code, unused mock fixtures, 200 ESLint warnings, `useMemo` dependency loops, error boundaries, component modularity, and repository hygiene.
7. **Agent 7 — Workflow & Business Logic Auditor:** Evaluated end-to-end manufacturing workflows (Customer -> Project -> Subplate -> Sample -> Work -> Printing -> Dispatch), procurement, job work challans, and financial ledgers.
8. **Agent 8 — Reporting, Export & Documents Auditor:** Evaluated 7 CSV export streams, downtime reporting, and 7 printable document formats (`/print/[type]/[id]`).

### Summary Totals

| Severity | Count | Primary Impact |
| :--- | :---: | :--- |
| **P0 (Critical Blocker)** | **7** | Security bypass, token forgery, IDOR deletion, state wipe, query fatal errors |
| **P1 (High Priority)** | **20** | Formula injection, PostgREST injection, N+1 bottlenecks, soft-delete leaks, overdrafts |
| **P2 (Medium Priority)** | **28** | RBAC gaps, UI filter disconnects, cache desync, missing document formats, render thrashing |
| **P3 (Low Priority)** | **15** | Layout polish, ColSpan offsets, date formatting, dead code cleanup |
| **P4 (Cosmetic / Info)** | **4** | Bundle cleanup, unused variables, minor naming conventions |
| **TOTAL FINDINGS** | **74** | Consolidated across all 8 workstreams |

---

## 2. Master Findings Catalog (Consolidated & Prioritized)

### P0 — Critical Vulnerabilities & Fatal Defects

#### [SEC-001] Cryptographic Key Management / Hardcoded Secret Fallback
- **Severity:** P0 | **Module:** Auth / Security | **File:** `frontend/src/lib/auth.ts:19-22`, `frontend/src/middleware.ts:31-34`
- **Description:** HMAC session signing uses a hardcoded fallback string (`"starmould-secure-production-secret-key-3fcb64b1-ee51"`) if environment variables are unset, allowing arbitrary session token forgery and admin impersonation.
- **Fix:** Enforce `SESSION_SECRET` at runtime and eliminate fallback strings.

#### [SEC-004 / API-001] Broken Object-Level Authorization (IDOR) on Worklog Deletion
- **Severity:** P0 | **Module:** Worklog API | **File:** `frontend/src/app/api/worklog/route.ts:248-278`
- **Description:** `DELETE /api/worklog` allows any authenticated user (including Worker Role 4) to permanently delete worklog entries belonging to any technician by passing `?id=...`.
- **Fix:** Enforce ownership check (`worklog.userid === auth.user.id`) or Admin/Manager role restriction.

#### [SEC-005 / API-002] Broken Function-Level Authorization on Scanning Mutations
- **Severity:** P0 | **Module:** Scanning API | **File:** `frontend/src/app/api/scanning/route.ts:178, 281`
- **Description:** `POST` and `PATCH /api/scanning` call `authenticateRequest(req)` without role restrictions, allowing Role 4 (Workers) to create projects, alter pricing, and override QA signoffs.
- **Fix:** Pass `[0, 1, 2, 3]` allowed roles into `authenticateRequest`.

#### [DB-001] Fatal Column Reference Error on Worklog Query
- **Severity:** P0 | **Module:** Scanning & Sample APIs | **File:** `frontend/src/app/api/scanning/route.ts:102`, `frontend/src/app/api/sample/route.ts:50`
- **Description:** Queries attempt to select non-existent columns `scan_hr, model_hr, rework_hr, insp_hr` from `worklog`, causing PostgreSQL query errors.
- **Fix:** Update projection to valid `worklog` columns (`design_hr, program_hr, machine_hr, driltap_hr, qc_hr, work_hr`).

#### [DB-002 / SEC-010] Insecure Default Fallback in RLS Helper Function
- **Severity:** P0 | **Module:** Database RLS | **File:** `supabase/migrations/004_rls_policies.sql:36`
- **Description:** `public.current_user_role()` falls back to `0` (Admin) when no JWT claims exist, granting super admin permissions on unauthenticated requests.
- **Fix:** Update fallback role to `NULL` or `4` (Worker).

#### [PERF-001] Soft-Delete Row Count Inaccuracy in Dashboard KPI Metrics
- **Severity:** P0 | **Module:** Dashboard API | **File:** `frontend/src/app/api/counts/route.ts:33-44`
- **Description:** `/api/counts` queries exact table counts without filtering `.is("deleted_at", null)`, displaying inflated counts that include soft-deleted records.
- **Fix:** Add `.is("deleted_at", null)` filtering for tables supporting soft delete.

#### [BIZ-002] Destructive State Wipe on Mould Project Update
- **Severity:** P0 | **Module:** Scanning Lifecycle | **File:** `app/Http/Controllers/ScanningController.php:740-763`
- **Description:** Updating a mould project explicitly resets `scan_by`, `qc_by`, `modeldesign_by`, work hours, amounts, and payment to `0`.
- **Fix:** Only update fields provided in the request payload and retain existing stage assignments.

---

### P1 — High-Priority Defects & Security Hazards

#### [SEC-002] Missing Expiration (`exp`) in Signed Session Token Payload
- **Severity:** P1 | **Module:** Auth / Security | **File:** `frontend/src/lib/auth.ts:27-62`, `frontend/src/middleware.ts:36-77`
- **Description:** Session tokens omit `iat` and `exp` claims; tokens remain cryptographically valid indefinitely if intercepted.
- **Fix:** Embed numeric `exp` timestamp in payload and reject expired tokens in verification routines.

#### [SEC-003] Sensitive Password Hash Leakage in User API
- **Severity:** P1 | **Module:** User Management API | **File:** `frontend/src/app/api/users/route.ts:241-251`
- **Description:** `PUT /api/users` uses `.select().single()`, returning raw bcrypt `password_hash` strings to the client.
- **Fix:** Project explicit safe columns (`id, name, username, initials, email, role_id, status, ...`).

#### [SEC-006 / API-007] Arbitrary Storage Bucket Upload Vulnerability
- **Severity:** P1 | **Module:** File Upload API | **File:** `frontend/src/app/api/upload/route.ts:25, 60-65`
- **Description:** `POST /api/upload` accepts unvalidated bucket names from client form data, allowing service role writes to private system buckets.
- **Fix:** Enforce strict allowlist `ALLOWED_BUCKETS = new Set(["subplate-photos", "mould-attachments"])`.

#### [SEC-008 / API-013 / DOC-001] CSV Formula Injection (CWE-1236) Across All Exports
- **Severity:** P1 | **Module:** Export Engine | **File:** `frontend/src/app/api/export/route.ts:60-210`
- **Description:** Export streams concatenate user-entered strings directly into CSV cells without escaping formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`).
- **Fix:** Implement centralized `sanitizeCsvCell()` escaping formula characters and double quotes.

#### [SEC-009 / API-003] PostgREST Filter Syntax Injection in `.or()` Clauses
- **Severity:** P1 | **Module:** Search Operations | **File:** `frontend/src/app/api/customers/route.ts:74`, `scanning/route.ts:40`, `subplate/route.ts:35`, `auth/login/route.ts:21`
- **Description:** Raw search strings interpolated into PostgREST `.or(...)` filter clauses without stripping control characters (`,`, `()`).
- **Fix:** Sanitize input strings to strip PostgREST structural characters before formatting filter strings.

#### [PERF-002] In-Memory Cache Memory Leak & Stampede Hazard
- **Severity:** P1 | **Module:** Server Caching | **File:** `frontend/src/lib/cache.ts:8-28`
- **Description:** Server-side in-memory `Map` lacks size bounding/eviction and promise coalescing for concurrent cache misses.
- **Fix:** Bound cache size and implement single-flight promise coalescing.

#### [PERF-003 / PERF-004 / API-009] Sequential N+1 Loops in Challan and Inward Mutations
- **Severity:** P1 | **Module:** Challan & Inward APIs | **File:** `frontend/src/app/api/challan/route.ts:228-246`, `frontend/src/app/api/inward/route.ts:212-246`
- **Description:** Updating subplate locations executes sequential `select` and `update` queries in a `for...of` loop per plate.
- **Fix:** Pre-fetch subplates in a single `.in("id", plateIds)` query and execute updates concurrently.

#### [PERF-005] Unbounded 2,000-Row Subplate Lookups on Every API Request
- **Severity:** P1 | **Module:** Logistics APIs | **File:** `frontend/src/app/api/challan/route.ts:46`, `dispatch/route.ts:46`, `inward/route.ts:51`
- **Description:** Routes unconditionally fetch 2,000 subplates on every request to resolve plate names.
- **Fix:** Scope query to matching plate IDs using `.in("id", itemPlateIds)`.

#### [PERF-006 / API-008] In-Memory Expense and Report Full Table Downloads
- **Severity:** P1 | **Module:** Expense & Report APIs | **File:** `frontend/src/app/api/expense/route.ts:41-55`, `frontend/src/app/api/report/route.ts:109-137`
- **Description:** Full table scans downloaded into Node.js memory on every page load to compute summary sums.
- **Fix:** Execute database-level aggregations (`SUM()`, `COUNT()`, `GROUP BY`).

#### [PERF-007] Client-Side In-Memory Filtering Bypassing Server-Side SQL
- **Severity:** P1 | **Module:** Subplate, Work, Scanning Pages | **File:** `frontend/src/app/subplate/page.tsx:94`, `work/page.tsx:73`, `scanning/page.tsx:56`
- **Description:** Pages download batches of records and perform search/date/customer filtering in browser memory via `useMemo`.
- **Fix:** Pass search and filter parameters into React Query hooks to filter at the SQL layer.

#### [PERF-008 / DOC-006] Report Year Filter Database Query Omission
- **Severity:** P1 | **Module:** Report API | **File:** `frontend/src/app/api/report/route.ts:45-53`
- **Description:** `/api/report` accepts `year` parameter but does not filter worklog records by date in SQL, caching multi-year sums under year keys.
- **Fix:** Add `.gte("rdate", `${year}-01-01`).lte("rdate", `${year}-12-31`)` filter.

#### [BIF-003] Subplate Location Numeric Corruption on Challan Update
- **Severity:** P1 | **Module:** Challan Lifecycle | **File:** `app/Http/Controllers/ChallanController.php:773-801`
- **Description:** Updating a challan assigns numeric vendor integer IDs to `subplate.location` rather than vendor initials.
- **Fix:** Resolve vendor initials and assign string initials consistently on create and update.

#### [BIZ-004] Job Work Return Location Overwrite Bug
- **Severity:** P1 | **Module:** Inward Return | **File:** `app/Http/Controllers/InwardController.php:578-584`
- **Description:** Inward receipt sets location to `'SM'` but immediately overwrites it with old vendor location array.
- **Fix:** Correct assignment branch to update location cleanly to `'SM'`.

#### [BIZ-005 / API-005] Broken Expense Rolling Balance Computation
- **Severity:** P1 | **Module:** Financial Ledger | **File:** `frontend/src/app/api/expense/route.ts:92-121, 160-165, 199`
- **Description:** Retrospective edits, deletions, and backdated expenses fail to propagate running balance updates forward.
- **Fix:** Compute rolling balances dynamically using SQL window functions.

#### [BIZ-006 / API-011] Missing Quantity Overdraft Protection on Inward Receipts
- **Severity:** P1 | **Module:** Procurement & Inward | **File:** `frontend/src/app/api/purchase-inward/route.ts:171-182`, `inward/route.ts:195-197`
- **Description:** Inward endpoints permit negative quantities and receipts exceeding pending order quantities.
- **Fix:** Enforce `0 < inward_qty <= pending_qty` validation on receipt submissions.

#### [DB-003] References to Non-Existent `users.password` Column
- **Severity:** P1 | **Module:** User Auth | **File:** `frontend/src/app/api/auth/login/route.ts:19`, `change-password/route.ts:32`, `users/route.ts:160`
- **Description:** Legacy column `password` queried/inserted instead of canonical `password_hash`.
- **Fix:** Standardize all user authentication operations to `password_hash`.

#### [DB-004] NOT NULL Constraint Violations in Dispatch and Expense
- **Severity:** P1 | **Module:** Logistics & Finance | **File:** `frontend/src/app/api/dispatch/route.ts:133`, `expense/route.ts:110`
- **Description:** `null` passed to columns declared `NOT NULL` (`vendortid`, `invoiceno`, `vehicleno`, `customerid`).
- **Fix:** Provide fallback defaults in route payloads (`0`, `""`, `"N/A"`).

#### [UI-001] Dashboard Stage Filter Card Disconnected from Data Table
- **Severity:** P1 | **Module:** Dashboard UI | **File:** `frontend/src/app/page.tsx:17-141`, `mould-projects-table.tsx:25-35`
- **Description:** Clicking pipeline stage cards displays a filter badge but does not filter table rows.
- **Fix:** Pass `activeStage` prop to `MouldProjectsTable` and filter displayed projects.

#### [CODE-001] Committed Production SQL Dump and Repository Bloat
- **Severity:** P1 | **Module:** Repository Hygiene | **File:** `sm_prod_080723_--24-09-2026_1300.sql`, `public/*.zip`, `resources/views/*.zip`
- **Description:** 5.8MB plain-text production SQL dump and historical zip archives committed in repo root.
- **Fix:** Remove unneeded backup archives and enforce root `.gitignore`.

#### [CODE-004] React Hook Exhaustive-Deps Violations Causing Render Thrashing
- **Severity:** P1 | **Module:** State Management | **File:** `frontend/src/app/**/*.tsx` (35+ occurrences)
- **Description:** Unmemoized fallback arrays in component bodies passed directly to `useMemo` dependency arrays.
- **Fix:** Move fallback initializations inside `useMemo` callbacks or wrap in stable declarations.

---

### P2 — Medium-Priority Functional, Architecture & UX Issues

1. **[SEC-007]** File Upload: Missing magic byte verification on uploaded images.
2. **[API-010]** Non-transactional composite inserts in Challan, Dispatch, Inward, and Purchases.
3. **[API-012]** User Management: Admins can soft-delete their own account or the sole active admin.
4. **[DB-007]** Purchase Items: `plateid` configured with destructive `ON DELETE CASCADE`.
5. **[DB-008]** Missing relational foreign key constraints across logistics and worklog tables.
6. **[PERF-009 / UI-010]** Pages bypassing TanStack Query with raw `fetch` (`gram`, `purchase-inward`, `report`, `export`).
7. **[PERF-010]** Missing server cache invalidation calls across mutating API routes.
8. **[PERF-011]** Missing dashboard count invalidation in TanStack mutation hooks.
9. **[PERF-012]** Direct subplate mutations in dashboard table bypassing React Query invalidation.
10. **[PERF-013]** Missing explicit column projections on heavy database queries.
11. **[BIZ-007]** Subplate lifecycle allows unconstrained stage transitions (e.g. packing before design/vmc).
12. **[BIZ-008]** 3D printing edit state wipe & out-of-tier pricing fallback to ₹0.
13. **[BIZ-009]** Worklog lifecycle: Missing PUT/PATCH handlers in `/api/worklog`.
14. **[BIZ-010]** Dispatch lifecycle: Disconnected subplate state & missing PUT in `/api/dispatch`.
15. **[BIZ-011]** PO column name mismatch (`material` vs `rmaterial`) & missing item deletion diff.
16. **[DOC-002]** RFC 4180 non-compliance in CSV string formatting.
17. **[DOC-003]** Raw foreign key integer IDs exported in CSVs instead of resolved company names.
18. **[DOC-004]** Master-detail child item truncation in 5 of 7 CSV exports.
19. **[DOC-008]** Missing interactive filter controls (year/customer) and footer totals in `/report`.
20. **[DOC-009]** Missing print document support for `sample` and `subplate` in `/api/print-doc`.
21. **[DOC-010]** Missing manufacturing hour columns in printable work order sheets.
22. **[UI-002]** Unimplemented global search input and notification button in topbar.
23. **[UI-003]** User profile menu missing outside-click dismissal listener.
24. **[UI-004]** Scanning subplates drawer attempting to read unpopulated `selectedProject.subplates`.
25. **[UI-005]** Subplate page `projectFilter` state unreachable due to missing UI select dropdown.
26. **[UI-006]** Client/server SSR date hydration mismatches on `new Date().toISOString()`.
27. **[UI-008]** Uncontrolled unkeyed input elements in scanning and printing table rows.
28. **[UI-009]** Missing table pagination on high-volume tables (`sample`, `printing`, `expense`, `work`).

---

### P3 — Low-Priority Polish & Architecture Items

1. **[SEC-011]** Logout cookie clearing missing explicit `sameSite` and `secure` flags.
2. **[SEC-012]** Hardcoded Supabase URL fallback string in `admin.ts`.
3. **[API-014]** Malformed JSON request bodies returning 500 instead of 400 Bad Request.
4. **[API-015]** Gram price calculation tier overlap validation.
5. **[API-016]** Low-entropy 4-digit timestamp slice in default subproject ID generation.
6. **[DB-011]** CSV export accessing phantom column `d.dispatchdate` instead of `d.chdate`.
7. **[DB-012]** Minor type definition mismatches in `types.ts`.
8. **[DOC-005]** Raw SQL date formats in CSV exports instead of `DD/MM/YYYY`.
9. **[DOC-007]** Missing `totalWorklogs` in `/api/report` response causing UI "0 records" subtitle.
10. **[DOC-011]** Missing `@media print` CSS page break rules and multi-copy options.
11. **[DOC-012]** Missing `<tfoot>` totals in printable document sheets.
12. **[UI-007]** Table loading skeleton and empty state `colSpan` mismatches in scanning and inward.
13. **[UI-011]** Secondary fields omitted from Sample and Scanning creation modals.
14. **[UI-015]** Customer deletion lacking summary impact assessment.
15. **[CODE-010]** Navigation using `window.location.href` instead of Next.js router.

---

### P4 — Non-Critical / Cleanup

1. **[API-017]** Casing inconsistencies in legacy DTO properties.
2. **[PERF-017]** Dead unreferenced `lib/client-cache.ts` utility file.
3. **[PERF-018]** In-flight fetch cancellation on logout.
4. **[CODE-011]** Duplicated status check helpers across pages.

---
*Report generated and consolidated from all 8 parallel audit workstreams.*
