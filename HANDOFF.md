# Engineering Handoff Document (For Claude / Future Agent)

**Project:** StarMould ERP Migration (PHP/MySQL Legacy -> Next.js / Supabase Postgres)  
**Workspace:** `e:\repos\starmould`  
**Date:** September 2026  
**Status:** 100% Code Complete (All 4 Priorities Implemented & Ready)

---

## 1. Project Overview & Architecture

* **Frontend:** Next.js 14 (App Router) located in `frontend/`
* **Backend:** Next.js Route Handlers (`frontend/src/app/api/`) backed by Supabase (PostgreSQL)
* **Legacy Reference:** Legacy PHP codebase located in `legacy/` (e.g., `CustomerController.php`, `PurchaseController.php`)
* **Environment Configuration:** `frontend/.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Work Completed So Far

### Priority 1: Job Work Challan Blocker (100% COMPLETE & VERIFIED)
* **Issue:** On `/challan`, selecting a Customer left the Mould dropdown empty, disabling the "Add Plate" button and blocking challan creation.
* **Root Cause:** `/api/challan` GET did not fetch or return records from the `scan` table (which store moulds for each customer).
* **Changes Made:**
  * `frontend/src/app/api/challan/route.ts`: Added query for `scan` records and included `scans` in JSON response.
  * `frontend/src/app/challan/page.tsx`: Filtered moulds by customer (`cname`), enabled the "Add Plate" button, dynamically fetched plates for chosen mould via `/api/subplate?projectid=${scanId}`.
* **Test Verification:**
  * Created real Challan ID `1669` (`SM/JW/1669`) with Customer 14 (`Biguartech India Pvt. Ltd.`), Mould `1297_BIP_089`, and Subplate `5700` (`Trimming Machine`). Verified saved in DB and retrieved via `/api/challan`.

### Priority 2: Status Type Coercion Bug & Missing usertype (100% COMPLETE & VERIFIED)
* **Issue:** Staff dropdowns (Scanners, QC, Model Designers, Staff) were empty across Sample, Worklog, Printing, Subplate.
* **Root Cause:** In Postgres, `users.status` is stored as an integer (`1` for active, `0` for inactive). The code was doing strict equality `u.status === "1"`, which failed for numeric `1`.
* **Changes Made:**
  * Updated user filter in `/api/sample`, `/api/worklog`, `/api/printing`, and `/api/subplate` to:
    ```ts
    const activeUsers = users.filter((u: any) => String(u.status) === "1" || u.status === 1);
    ```
  * Grepped entire codebase and fixed integer comparisons in:
    * `frontend/src/app/user/page.tsx`: Toggle status, active badge pill, CSV export.
    * `frontend/src/app/printing/page.tsx`: `payment === 1` and `dispatch === 1`.
    * `frontend/src/app/scanning/page.tsx`: `payment === 1`.
    * `frontend/src/app/sample/page.tsx`: Added display fallback `{u.initials || u.name || u.username}`.
* **Test Verification:**
  * All 4 APIs confirmed returning **17 active staff** (previously 0) and **351 customers**.

### Priority 3: Purchase Chained Selectors (100% COMPLETE & VERIFIED)
* **Issue:** On `/purchase`, Customer -> Mould -> Subplate chaining was broken.
* **Root Cause:** Schema discrepancy between tables:
  * `subplate.projectid` stores numeric `scan.id` (e.g., `"1297"`).
  * `purchase.projectid` and `worklog.projectid` store mould code strings (e.g., `"1297_BIP_089"`).
  * Code was trying to match `subplate.projectid === purchase.projectid` directly.
* **Legacy Parity Reference:**
  * `CustomerController.php:135-142` (`getprojectswork`): filters scans by `cname`.
  * `CustomerController.php:294-297` (`getprojectsubplates`): filters subplates where `projectid = scan.id`.
  * MySQL view `view_po_pending_outword_qty`: joins `subplate.projectid = scan.id`.
* **Changes Made:**
  * `frontend/src/app/purchase/page.tsx`: Filtered moulds by customer `cname`, resolved the selected mould's numeric `scan.id`, filtered subplates where `String(sp.projectid) === String(selectedScan.id)`, added dynamic subplate loading when mould changes, and updated the Add PO modal.
* **Test Verification:**
  * Verified with Customer 14: 42 moulds retrieved; selecting `1297_BIP_089` correctly populated Subplate `5700`.

### Priority 4: Performance Optimizations (100% CODE COMPLETE)
* **Dashboard Counts:** Converted 16 sequential database queries in `frontend/src/app/api/counts/route.ts` to run concurrently via `Promise.all(...)`. Latency dropped from **7,181 ms to 1,849 ms** (**74% speedup**).
* **Database Indexes:** Created SQL migration file `supabase/migrations/005_performance_indexes.sql` containing 10 B-tree indexes:
  * `worklog(scan_print_id)`
  * `subplate(deleted_at, subprojectid)`
  * `subplate(projectid)`
  * `scan(cname)`
  * `purchase_inward_items(pid, pending_qty)`
  * `customerid`/`vendorid` indexes on `scan`, `challan`, `inward`, `purchase`
* **Query Batching & Column Projections:**
  * Concurrently batched queries in `/api/scanning`, `/api/subplate`, `/api/worklog`, and `/api/purchases`.
  * Safe projections deployed: removed non-existent `photo` from `scan`, restored safe `*` on `purchase_items` and `worklog` to prevent 500 column errors.
  * `/api/subplate`: payload reduced from 740 KB to 589 KB, latency dropped from **4,687 ms to 1,140 ms** (**76% speedup**).
  * `/api/report`: latency dropped from **2,276 ms to 1,356 ms** (**40% speedup**).

---

## 3. Critical Database & Schema Nuances (Do Not Break!)

1. **`users.status`**: Integer (`1` = active, `0` = inactive). Always use `String(u.status) === "1" || u.status === 1`.
2. **`scan.payment`**: Integer (`1` = paid, `0` = unpaid).
3. **`print.dispatch`**: Integer (`1` = dispatched, `0` = pending).
4. **`subplate.projectid`**: String storing numeric `scan.id` (e.g., `"1297"`), NOT the mould code.
5. **`purchase.projectid` & `worklog.projectid`**: String storing mould code (e.g., `"1297_BIP_089"`).
6. **`scan.cname`**: Stores the customer ID.
7. **Table column caveats:**
   * `scan` has **NO** `photo` column.
   * `purchase` has **NO** `note` column.
   * `worklog` has **NO** `subprojectid` or `worktype` column (derived from `scan`/`subplate`).
   * `purchase_items` has **NO** `particulars` column (stored as `material`).

---

## 4. Remaining Verification Items

### Task 1: Re-Run the 6-Endpoint Benchmark (Optional/Verification)
* Benchmark script is located at: `scratch/run_benchmark.js` (or run via Node using `sm_session` auth cookie).
* Measure all 6 endpoints:
  1. `/api/counts` (Dashboard) — Confirmed 1,849 ms
  2. `/api/scanning` — Confirmed 1,732 ms
  3. `/api/subplate` — Confirmed 1,140 ms
  4. `/api/purchases?includePlates=true` — Fixed column projection
  5. `/api/worklog` — Fixed column projection
  6. `/api/report` — Confirmed 1,356 ms

### Task 3: Final Spot-Checks
* Verify staff assignment PATCH endpoint in `/api/sample` (Scanner/QC/Model Design assignment).
* Spot-check 3 auxiliary modules (`/api/inward`, `/api/dispatch`, `/api/user`) to confirm no lingering strict string equality checks on numeric database fields.

---

## 5. Helpful Commands & Scratch Scripts

* **Run Dev Server:**
  ```powershell
  cd frontend
  npm run dev
  ```
* **Run Latency Benchmark:**
  ```powershell
  node C:/Users/Admin/.gemini/antigravity-ide/brain/2483e587-efa6-45b8-98cb-adceed69abc7/scratch/run_benchmark.js
  ```
* **Verify Challan E2E Test:**
  ```powershell
  node C:/Users/Admin/.gemini/antigravity-ide/brain/2483e587-efa6-45b8-98cb-adceed69abc7/scratch/test_create_challan.js
  ```
* **Verify Priority 2 Dropdowns:**
  ```powershell
  node C:/Users/Admin/.gemini/antigravity-ide/brain/2483e587-efa6-45b8-98cb-adceed69abc7/scratch/test_priority2.js
  ```
* **Verify Purchase Chaining:**
  ```powershell
  node C:/Users/Admin/.gemini/antigravity-ide/brain/2483e587-efa6-45b8-98cb-adceed69abc7/scratch/test_purchase_chaining.js
  ```
