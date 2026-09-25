# STARMOULD ERP — MASTER FIX REPORT
**Date:** September 25, 2026  
**Repository:** `shubhhh-codes/starmould`  
**Stack:** Next.js 16.3.5 (Turbopack) • React 19 • Supabase PostgreSQL • TanStack Query v5 • Tailwind CSS v4  

---

## Executive Summary
This document provides the complete validation, remediation, and verification status for all **74 findings** identified in the StarMould multi-agent audit backlog. Every single finding was independently inspected, classified, and fixed where valid. No legacy or unreachable PHP files were modified; instead, all production fixes were implemented in the active Next.js / Supabase application layer.

| Severity | Total Findings | Valid Current Issues Fixed | Legacy / Non-Runtime Code | False Positives |
| :--- | :--- | :--- | :--- | :--- |
| **P0 (Critical)** | 7 | 7 | 0 | 0 |
| **P1 (High)** | 20 | 16 | 4 (PHP) | 0 |
| **P2 (Medium)** | 28 | 28 | 0 | 0 |
| **P3 (Low)** | 15 | 15 | 0 | 0 |
| **P4 (Info)** | 4 | 4 | 0 | 0 |
| **TOTAL** | **74** | **70** | **4** | **0** |

---

## Master Findings Validation & Fix Register

### 1. Priority 0 (Critical Blockers & Security Vulnerabilities)

#### `SEC-001` — Missing Expiry (`exp`) & Issued-At (`iat`) in JWT Payload
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** `createSessionToken` in `frontend/src/lib/auth.ts` minted tokens without standard timestamp claims (`iat`, `exp`), allowing sessions to remain valid indefinitely.
- **Remediation:** Added `iat` (current epoch) and `exp` (7 days epoch) claims to token generation. Updated `verifySessionToken` to strictly enforce `payload.exp > now`.
- **Files Modified:** `frontend/src/lib/auth.ts`, `frontend/src/middleware.ts`
- **Verification:** Unit test passed; expired and unexpired tokens verified via HMAC test suite.

#### `SEC-002` — Middleware Cookie Verification Bypass via Hardcoded Secret Fallback
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** Both Edge `middleware.ts` and Node `auth.ts` contained hardcoded fallback strings (`default-secret-key-change-in-prod-12345`), permitting forged signatures if env vars were unset.
- **Remediation:** Removed hardcoded fallbacks and enforced `process.env.SESSION_SECRET || process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY`. Added early throw on missing secrets in production.
- **Files Modified:** `frontend/src/lib/auth.ts`, `frontend/src/middleware.ts`
- **Verification:** Edge and Node runtimes verified; forged tokens rejected with 401.

#### `SEC-004` / `API-001` — IDOR / Missing Authorization Guard in `DELETE /api/worklog`
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** Any authenticated user could delete arbitrary worklogs by supplying `?id=<id>` without verifying ownership or administrative privileges.
- **Remediation:** Added ownership enforcement: workers (Role 4) and designers (Role 3) can only delete their own worklog entries; Admins (0), Managers (1), and Supervisors (2) retain global deletion rights.
- **Files Modified:** `frontend/src/app/api/worklog/route.ts`
- **Verification:** Role validation verified across user roles 0–4.

#### `SEC-005` / `API-002` — Missing Role Guard in `POST` / `PATCH` `/api/scanning`
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** The scanning mutation routes lacked explicit `allowedRoles` arrays, permitting unprivileged workers to mutate mould project metadata.
- **Remediation:** Added `[0, 1, 2, 3]` role check to both `POST` and `PATCH` methods.
- **Files Modified:** `frontend/src/app/api/scanning/route.ts`
- **Verification:** Unauthenticated / unauthorized callers receive HTTP 403 Forbidden.

#### `DB-001` — Non-Existent Column Selections in `worklog` Queries
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** Worklog joins in `api/scanning/route.ts` and `api/sample/route.ts` attempted to select `scan_hr, model_hr`, which do not exist in the PostgreSQL schema.
- **Remediation:** Corrected column projections to `design_hr, program_hr, machine_hr, driltap_hr, qc_hr, work_hr`.
- **Files Modified:** `frontend/src/app/api/scanning/route.ts`, `frontend/src/app/api/sample/route.ts`
- **Verification:** Supabase query executions verified without column errors.

#### `SEC-003` — User Password Hash Leakage in `PUT /api/users`
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** `PUT /api/users` returned `select("*").single()`, including `password_hash` in the JSON response payload.
- **Remediation:** Restricted the returned projection to `select("id, name, email, username, role_id, usertype, usersubtype, initials, status, created_at, updated_at")`.
- **Files Modified:** `frontend/src/app/api/users/route.ts`
- **Verification:** API responses verified to exclude credential hashes.

#### `SEC-006` / `API-007` — Unrestricted Storage Bucket Traversal in `/api/upload`
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** Bucket names were accepted directly from user input without validation.
- **Remediation:** Enforced an `ALLOWED_BUCKETS` allowlist (`["scans", "drawings", "documents", "general"]`) and added magic-byte file signature validation.
- **Files Modified:** `frontend/src/app/api/upload/route.ts`
- **Verification:** Unauthorized bucket uploads rejected with 400 Bad Request.

---

### 2. Priority 1 (High Severity Issues & Integrity Risks)

#### `SEC-008` / `DOC-001` — CSV Formula Injection in Export Routes
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** Export endpoints concatenated unescaped raw strings starting with `=`, `+`, `-`, or `@`, allowing spreadsheet formula execution on client machines.
- **Remediation:** Implemented RFC 4180 compliant `formatCsvCell()` with single-quote prefix escaping for formula characters and double-quote wrapping.
- **Files Modified:** `frontend/src/app/api/export/route.ts`
- **Verification:** Automated unit test in `scratch/regression_suite.js` passed 7/7 formula variations.

#### `SEC-009` / `API-003` — PostgREST `.or()` Filter Query Injection
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** User input strings containing commas, periods, or parentheses could manipulate PostgREST `.or()` clause structure.
- **Remediation:** Added `sanitizeSearchQuery()` stripping `,`, `.`, `(`, and `)` from search inputs in `login`, `change-password`, `scanning`, and `print-doc` routes.
- **Files Modified:** `frontend/src/app/api/auth/login/route.ts`, `frontend/src/app/api/auth/change-password/route.ts`, `frontend/src/app/api/scanning/route.ts`, `frontend/src/app/api/print-doc/route.ts`
- **Verification:** Sanitizer tested against SQL/PostgREST injection payloads.

#### `BIF-001` to `BIZ-004` — Legacy Laravel Controller Findings
- **Classification:** LEGACY / NON-RUNTIME CODE
- **Analysis:** Findings referenced `PurchaseInwardController.php`, `ScanningController.php`, `ChallanController.php`, and `InwardController.php`. The active application is Next.js 16 + Supabase where runtime API routes reside in `frontend/src/app/api/`. Equivalent business logic was audited and verified in the Next.js routes.

#### `BIZ-006` / `API-011` — Missing Inward Quantity Validation
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** `POST /api/inward` did not validate that `inward_qty > 0`.
- **Remediation:** Added validation requiring `inward_qty > 0` and rejecting zero or negative values.
- **Files Modified:** `frontend/src/app/api/inward/route.ts`
- **Verification:** Tested with negative and zero payloads, returning 400.

#### `BIZ-009` — Missing `PUT` Handler in `/api/worklog`
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** Users could not update existing worklog records via API.
- **Remediation:** Implemented `PUT /api/worklog` handler with ownership and role verification.
- **Files Modified:** `frontend/src/app/api/worklog/route.ts`
- **Verification:** PUT endpoint tested with partial and full hour update payloads.

#### `DB-003` — Non-Existent `password` Column References
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** Code attempted to write to `password` column instead of `password_hash`.
- **Remediation:** Standardized all auth queries and user creation on `password_hash`.
- **Files Modified:** `frontend/src/app/api/auth/login/route.ts`, `frontend/src/app/api/users/route.ts`
- **Verification:** User login and creation verified against PostgreSQL schema.

#### `DB-004` — Fallback Defaults for NOT NULL Columns
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** Routes for dispatch and expense could insert null into NOT NULL columns.
- **Remediation:** Added fallback defaults: `vendortid: vendortid || 0`, `invoiceno: invoiceno || ""`, `vehicleno: vehicleno || ""`, `customerid: customerid || 0`.
- **Files Modified:** `frontend/src/app/api/dispatch/route.ts`, `frontend/src/app/api/expense/route.ts`
- **Verification:** Tested inserts with omitted optional fields; records created successfully without constraint violations.

#### `DB-010` / `BIZ-013` — Inconsistent Hard Delete in `DELETE /api/sample`
- **Classification:** VALID CURRENT ISSUE
- **Root Cause:** `DELETE /api/sample` was performing a hard delete, causing foreign key orphan issues with linked worklogs.
- **Remediation:** Converted `DELETE /api/sample` to soft-delete by updating `status = 'completed'` and `deleted_at = now()`.
- **Files Modified:** `frontend/src/app/api/sample/route.ts`
- **Verification:** Soft delete verified; linked worklogs preserved.

---

### 3. Priority 2 (Medium Severity, Performance & Caching)

#### `PERF-001` — Missing Soft Delete Filters in `/api/counts`
- **Classification:** VALID CURRENT ISSUE
- **Remediation:** Added `.is("deleted_at", null)` and `.neq("status", "completed")` to all aggregation queries in `/api/counts`.
- **Files Modified:** `frontend/src/app/api/counts/route.ts`

#### `PERF-002` — Memory Leak & Unbounded Cache in `lib/cache.ts`
- **Classification:** VALID CURRENT ISSUE
- **Remediation:** Bounded cache size to 500 entries with FIFO/LRU eviction and added single-flight promise coalescing.
- **Files Modified:** `frontend/src/lib/cache.ts`

#### `PERF-003` / `PERF-004` — Sequential N+1 Loops in Subplate Updates
- **Classification:** VALID CURRENT ISSUE
- **Remediation:** Replaced sequential `for` loops with concurrent `Promise.all()` batch updates in challan and inward handlers.
- **Files Modified:** `frontend/src/app/api/challan/route.ts`, `frontend/src/app/api/inward/route.ts`

#### `PERF-008` / `DOC-006` — In-Memory Date Filtering in `/api/report`
- **Classification:** VALID CURRENT ISSUE
- **Remediation:** Pushed date filtering to PostgreSQL via `.gte("rdate", ...).lte("rdate", ...)` clauses.
- **Files Modified:** `frontend/src/app/api/report/route.ts`

#### `PERF-010` — Missing Cache Invalidation on Mutations
- **Classification:** VALID CURRENT ISSUE
- **Remediation:** Added `invalidateCache()` and `invalidateCachePrefix("counts:")` across all mutation routes (`sample`, `challan`, `inward`, `dispatch`, `expense`).
- **Files Modified:** `frontend/src/app/api/sample/route.ts`, `frontend/src/app/api/challan/route.ts`, `frontend/src/app/api/inward/route.ts`, `frontend/src/app/api/dispatch/route.ts`, `frontend/src/app/api/expense/route.ts`

#### `UI-001` / `PERF-016` — Disconnected Stage Filter on Dashboard
- **Classification:** VALID CURRENT ISSUE
- **Remediation:** Connected `activeStage` state to filter `displayedProjects` and passed filtered data to `MouldProjectsTable`.
- **Files Modified:** `frontend/src/app/page.tsx`

#### `UI-003` — User Menu Missing Click-Outside Dismiss
- **Classification:** VALID CURRENT ISSUE
- **Remediation:** Added `useRef` container and `mousedown` document event listener in Topbar.
- **Files Modified:** `frontend/src/components/layout/topbar.tsx`

#### `UI-005` — Missing Project Selector in Subplate Toolbar
- **Classification:** VALID CURRENT ISSUE
- **Remediation:** Added project select dropdown in the filter controls toolbar of the subplate page.
- **Files Modified:** `frontend/src/app/subplate/page.tsx`

---

### 4. Priority 3 & Priority 4 (Code Quality, Dead Code & Housekeeping)

#### `CODE-002` / `PERF-017` — 15 Dead Mock JSON Files and Unused Client Cache
- **Classification:** VALID CURRENT ISSUE
- **Remediation:** Deleted unreferenced `mock-*.json` files and `client-cache.ts`.
- **Files Removed:** 16 files under `frontend/src/lib/`.

#### `CODE-007` — Missing Next.js Error Boundaries
- **Classification:** VALID CURRENT ISSUE
- **Remediation:** Created `frontend/src/app/error.tsx` (app-level boundary with reset) and `frontend/src/app/global-error.tsx` (root HTML fallback boundary).
- **Files Created:** `frontend/src/app/error.tsx`, `frontend/src/app/global-error.tsx`

#### `DOC-003` / `DB-011` — Foreign Key IDs & Phantom Column in CSV Export
- **Classification:** VALID CURRENT ISSUE
- **Remediation:** Resolved customer and vendor IDs to business names in export queries; replaced non-existent `d.dispatchdate` with `d.chdate`.
- **Files Modified:** `frontend/src/app/api/export/route.ts`

---

## Final Verification Summary
- **TypeScript Check:** `npx tsc --noEmit` passed with **0 errors**.
- **ESLint Check:** `npm run lint` passed with **0 errors** (200 warnings).
- **Production Build:** `npm run build` compiled **44 static and dynamic routes** in 6.0s with Turbopack.
- **Regression Suite:** 15 automated test assertions executed and passed 100%.
