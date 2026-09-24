# StarMould ERP: Flow-Parity and Performance Audit Report
**Legacy PHP/Laravel vs Next.js/Supabase Architecture**  
**Date:** September 23, 2026  
**Auditor:** Antigravity Deep Audit Subsystem  
**Scope:** Scanning Module Staff Assignment Root Cause, 17-Module Interactive Flow Parity, and Supabase Performance Benchmark

---

## Executive Summary

A comprehensive, line-by-line audit comparing the legacy Laravel ERP (`app/Http/Controllers`, `resources/views`) with the current Next.js 16 + Supabase implementation (`frontend/src`) was executed.

Key Findings:
1. **Part 1 Root Cause Identified:** The staff assignment dropdowns (Scanner, QC Officer, Designer) in Scanning and Sample/Rework modules are completely empty (`Select` only) due to a **strict type comparison mismatch (`u.status === "1"`)**. In Supabase PostgreSQL, `status` is stored as an integer (`1`). In JavaScript, `1 === "1"` is strictly `false`. Every active user is silently discarded, causing the API to return `users: []`.
2. **Systemic Flow-Parity Breakages in Part 2:**
   - **Challan Module Broken:** `/api/challan` omits `scans` in its response, permanently breaking the Mould dropdown in the Add Challan modal and disabling the "Add Plate" button.
   - **Scanning & Sample Create Modals Broken:** APIs query `customers` without `usertype`, causing client-side `c.usertype === "Customer"` filters to evaluate to `false` for every customer.
   - **Purchase Chained Selectors Broken:** `availableProjects` is not filtered by the selected customer and compares `scan.id` against project code strings, causing subplate lookups to fail and fall back to an arbitrary slice of 30 unrelated plates.
   - **Widespread Staff Bug:** The exact same `u.status === "1"` bug was discovered in `/api/sample`, `/api/printing`, `/api/worklog`, and `/api/subplate`.
3. **Severe Performance Bottlenecks in Part 3:**
   - **Measured API Response Times:** Dashboard counts take **7.18s**, Scanning takes **4.84s** (transferring **1.16 MB** unpaginated JSON), Subplate takes **4.69s** (740 KB), and Purchase takes **3.98s**.
   - **Sequential Network Waterfall:** `/api/scanning` executes **12 sequential round-trips to Supabase** on every page load (including real-time auth verification and 5 separate count queries).
   - **N+1 Query in `/api/counts`:** Loops over 16 tables executing 16 separate sequential HTTP requests.
   - **Missing Indexes on Large Tables:** `subplate` (6,015 rows) has no index on `deleted_at` or `subprojectid`; `worklog` has no index on `scan_print_id` (forcing sequential scans for scanning hour aggregations); and `scan`, `challan`, `inward`, and `purchase` lack foreign key indexes on customer and vendor IDs.

---

# PART 1 — ROOT CAUSE: Staff Assignment Dropdown Failure

### 1. Legacy PHP Implementation (`ScanningController.php` & `ScanAdminController.php`)

In the legacy Laravel application, staff assignment dropdowns were populated directly from the `users` table filtering for active users:

- **Query Location 1:** `app/Http/Controllers/ScanningController.php:42-47`
```php
if(Auth::user()->role == 0){
    $userdata = UserModel::select('id','initials','status')->where('status','1')->get();
}
else{
    $userdata = UserModel::select('id','initials','status')->where('status','1')->where('id',Auth::user()->id)->get();
}
```

- **Query Location 2:** `app/Http/Controllers/ScanningController.php:286-302` (DataTables AJAX `scan_by` column renderer):
```php
->addColumn('scan_by', function($row){
   $data1 = UserModel::latest()->where("status","1")->get();
    
    $btn3 = '<select class="form-control select2-ajax" style="padding:0px;!important" id="scanby_'.$row->id.'" onchange="return changestatusscan(\'scan_by\',this.value,\''.$row->id.'\');">';
    $btn3.='<option value="0">Select</option>';
    foreach ($data1 as $key => $value) {
        if($value->id==$row->scan_by){
            $btn3.='<option value="'.$value->id.'" selected>'.$value->initials.'</option>';
         }else{
         $btn3.='<option value="'.$value->id.'">'.$value->initials.'</option>';
         }
    }
    $btn3.= '</select>';

     return $btn3;
})
```
Identical queries and `<select>` rendering loops exist in `ScanningController.php:303-320` (`qc_by`), `ScanningController.php:321-338` (`modeldesign_by`), and in `ScanAdminController.php:133-184`.

- **Legacy Database Behavior:**
In MySQL / PDO, column `status` was defined as `INT` or `TINYINT(1)`. The SQL statement generated was:
`SELECT * FROM users WHERE status = '1'`
MySQL performs automatic string-to-number coercion, matching rows where `status = 1`.

---

### 2. Current Next.js Implementation (`frontend/src/app`)

- **API Route:** `frontend/src/app/api/scanning/route.ts:41-44` and `line 150`
```typescript
// frontend/src/app/api/scanning/route.ts:41-44
const { data: users } = await supabaseAdmin
  .from("users")
  .select("id, username, initials, status, role_id")
  .is("deleted_at", null);

// frontend/src/app/api/scanning/route.ts:150
return NextResponse.json({
  scans: enriched,
  customers: customers || [],
  users: (users || []).filter((u) => u.status === "1"), // <--- ROOT CAUSE BUG
  kpis: { ... },
});
```

- **Frontend Page Component:** `frontend/src/app/scanning/page.tsx:69-74`, `123-125`, `507-524`
```typescript
// frontend/src/app/scanning/page.tsx:74
setUsers(data.users || []);

// frontend/src/app/scanning/page.tsx:123-125
const activeStaff = useMemo(() => {
  return users.filter((u) => String(u.status) === "1");
}, [users]);

// frontend/src/app/scanning/page.tsx:507-524
<select
  value={row.scan_by || 0}
  onChange={(e) => handleStaffChange(row.id, "scan_by", Number(e.target.value))}
  className="..."
>
  <option value={0}>Select</option>
  {activeStaff.map((u) => (
    <option key={u.id} value={u.id}>
      {u.initials || u.name}
    </option>
  ))}
</select>
```

---

### 3. Root Cause Analysis & Evidence

A test script was executed directly against the live Supabase instance:
```javascript
const { data: users } = await supabase.from('users').select('id, name, initials, status');
// Result:
// ID: 1, name: "Shivani", status: 1 (type: number)
// ID: 2, name: "Akshay",  status: 1 (type: number)
// Filtered by u.status === "1": 0
// Filtered by String(u.status) === "1" || u.status === 1: 17
```

**The Mismatch:**
1. In PostgreSQL / Supabase, column `status` on `users` is integer (`INT`, type `number`).
2. `frontend/src/app/api/scanning/route.ts:150` performs strict type equality:
   `(users || []).filter((u) => u.status === "1")`
   In JavaScript, `1 === "1"` is always `false`.
3. Every single active user in the database is filtered out. The API responds with `users: []`.
4. On `frontend/src/app/scanning/page.tsx`, `data.users` is empty (`[]`). `activeStaff` is therefore `[]`.
5. The `<select>` element receives an empty array, rendering only `<option value={0}>Select</option>`. It is impossible to assign any staff member.

**Secondary Flaws in Scanning Module:**
- **Missing Column in Select:** `frontend/src/app/api/scanning/route.ts:43` queries `select("id, username, initials, status, role_id")`, omitting `name`. However, `page.tsx:521` attempts `{u.initials || u.name}`. If a user had null initials, it would display as `undefined`.
- **Add Modal Customer Dropdown Broken:** In `frontend/src/app/scanning/page.tsx:827`:
  `customers.filter((c) => c.usertype === "Customer")`
  However, `frontend/src/app/api/scanning/route.ts:35` selects only `id, customername, initials` without `usertype`. Thus, `c.usertype` is `undefined`, and the Customer dropdown in the Create Modal is **also 100% empty**.
- **PATCH Handler Zero-Handling:** In `frontend/src/app/api/scanning/route.ts:275`:
  `updatePayload[field] = value === "0" || value === "" ? null : value;`
  When a user selects "Select" (`0` as a number), `0 === "0"` is `false`. It saves integer `0` instead of `null`.

---

# PART 2 — FULL FLOW-PARITY AUDIT: All 17 Modules

Each interactive control across all 17 modules was inspected and tested against live data and the legacy Laravel codebase.

### Master Interactive Control Audit Table

| Module | Control / Feature | Expected Legacy Behavior | Current Next.js Implementation | Working? | Root Cause / Failure Mode |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Scanning** | Table Scanner Dropdown | Lists all active staff by initials; updates `scan_by` | `frontend/src/app/scanning/page.tsx:507` | **BROKEN** | `users: []` returned due to `u.status === "1"` strict check in `/api/scanning:150`. |
| | Table QC Officer Dropdown | Lists all active staff by initials; updates `qc_by` | `frontend/src/app/scanning/page.tsx:551` | **BROKEN** | Same `users: []` bug. |
| | Table Designer Dropdown | Lists all active staff by initials; updates `modeldesign_by` | `frontend/src/app/scanning/page.tsx:528` | **BROKEN** | Same `users: []` bug. |
| | Table Status Dropdown | Updates status (`pending`, `registered`, `completed`) | `frontend/src/app/scanning/page.tsx:573` | **WORKING** | Correctly executes `PATCH /api/scanning`. |
| | Table Payment Toggle | Toggles Paid (`1`) / Unpaid (`0`) | `frontend/src/app/scanning/page.tsx:601` | **WORKING** | Correctly executes `PATCH /api/scanning`. |
| | Add Modal Customer Select | Lists customers (`usertype = 'Customer'`) | `frontend/src/app/scanning/page.tsx:826` | **BROKEN** | `/api/scanning:35` omits `usertype` from SQL select; filter returns 0 items. |
| | Add Modal Scanner Select | Lists active staff | `frontend/src/app/scanning/page.tsx:891` | **BROKEN** | `activeStaff` is empty due to `u.status === "1"`. |
| **2. Sample / Rework** | Table Scanner Dropdown | Lists active staff; updates `scan_by` | `frontend/src/app/sample/page.tsx:430` | **BROKEN** | `/api/sample:95` uses strict `u.status === "1"`, returning `users: []`. |
| | Table QC By Dropdown | Lists active staff; updates `qc_by` | `frontend/src/app/sample/page.tsx:452` | **BROKEN** | Same `users: []` bug. |
| | Table Designer Dropdown | Lists active staff; updates `modeldesign_by` | `frontend/src/app/sample/page.tsx:474` | **BROKEN** | Same `users: []` bug. |
| | Add Modal Customer Select | Lists customers (`usertype = 'Customer'`) | `frontend/src/app/sample/page.tsx:661` | **BROKEN** | `/api/sample:30` omits `usertype` from SQL select; dropdown is 100% empty. |
| | Tab Switch (Sample vs Rework) | Filters table by worktype | `frontend/src/app/sample/page.tsx:313` | **WORKING** | Correctly filters `worktype = "Sample"` or `"Rework"`. |
| **3. Purchase** | Modal Customer Select | Selects client; filters mould project dropdown | `frontend/src/app/purchase/page.tsx:1085` | **PARTIAL** | Populates clients, but **does NOT filter mould project dropdown**. |
| | Modal Mould Chained Select | Shows moulds belonging to chosen Customer | `frontend/src/app/purchase/page.tsx:1107` | **BROKEN** | `availableProjects` contains ALL projects; `sp.projectid` is scan ID (`"1"`), mismatching mould string. |
| | Modal Subplate Chained Select | Shows subplates for chosen Mould | `frontend/src/app/purchase/page.tsx:1181` | **BROKEN** | Mismatch causes filter to return `[]`, falling back to arbitrary `subplates.slice(0, 30)`. |
| | Subplate Material Auto-Fill | Read-only auto-fill from selected subplate | `frontend/src/app/purchase/page.tsx:1210` | **WORKING** | Correctly updates `item.materialtype` when a plate is chosen. |
| | Pending Purchase Tab | Lists plates needing PO from `view_po_pending_inward_qty` | `frontend/src/app/purchase/page.tsx:887` | **WORKING** | Correctly computes pending plates using active PO items set. |
| **4. Work / Worklog** | Modal Customer Select | Selects customer; filters moulds | `frontend/src/app/work/page.tsx:850` | **WORKING** | Customers loaded with `usertype = "Customer"`; triggers `customerMoulds`. |
| | Modal Mould Chained Select | Shows customer's mould projects | `frontend/src/app/work/page.tsx:881` | **WORKING** | Correctly filters `scans` by `cname`. |
| | Modal Subplate Chained Select | Shows subplates belonging to mould | `frontend/src/app/work/page.tsx:910` | **WORKING** | Cascades using `sp.projectid === selectedMould.id`. |
| | Mould Work Type & Desc Auto-fill | Auto-fills Work Type and Part Description | `frontend/src/app/work/page.tsx:937` | **WORKING** | Displays auto-filled read-only summary card. |
| | Daily User Filter Dropdown | Filters daily worklogs by employee | `frontend/src/app/work/page.tsx:78` | **BROKEN** | `/api/worklog:123` uses `u.status === "1"`, returning `users: []`. Filter shows only "ALL". |
| **5. Challan** | Modal Customer Select | Selects customer; filters moulds | `frontend/src/app/challan/page.tsx:899` | **WORKING** | Correctly filters `customersList`. |
| | Modal Mould Chained Select | Shows moulds for selected customer | `frontend/src/app/challan/page.tsx:927` | **FATAL** | `/api/challan` **omits `scans` entirely**; `availableProjects` is permanently `[]`. |
| | Modal Add Plate Button | Adds subplate line item | `frontend/src/app/challan/page.tsx:962` | **FATAL** | `disabled={!modalForm.projectid}`; permanently disabled because mould cannot be chosen. |
| **6. Dispatch** | Modal Customer Select | Selects customer; filters moulds | `frontend/src/app/dispatch/page.tsx:890` | **WORKING** | Populates customers where `usertype = 'Customer'`. |
| | Modal Mould Chained Select | Shows moulds for selected customer | `frontend/src/app/dispatch/page.tsx:915` | **WORKING** | `/api/dispatch:80` includes `scans`; filter cascades correctly. |
| | Modal Subplate Chained Select | Shows subplates for selected mould | `frontend/src/app/dispatch/page.tsx:990` | **WORKING** | Cascades and allows custom plate entry. |
| **7. Inward** | Modal Vendor Select | Selects vendor; filters outward challans | `frontend/src/app/inward/page.tsx:645` | **WORKING** | Populates vendors; cascades to `availableOutwardChallans`. |
| | Modal Challan Chained Select | Selects outward challan with pending items | `frontend/src/app/inward/page.tsx:675` | **WORKING** | Populates challans with `gt("pending_qty", 0)`. |
| | Auto-populate Challan Items | Auto-fills customer, transporter, plates | `frontend/src/app/inward/page.tsx:149` | **WORKING** | Auto-fills items from `view_pending_inward_qty`. |
| **8. Printing** | Floor vs Admin View Toggle | Toggles Worker view vs Admin revenue view | `frontend/src/app/printing/page.tsx:62` | **WORKING** | Toggles viewMode state and columns. |
| | Gram Price Calculation | Auto-calculates ₹ from grams using `gram_calc` | `frontend/src/app/printing/page.tsx:28` | **WORKING** | Matches legacy formula: `fix != 0 ? fix : multiply * grams`. |
| | Staff Assignment | Assign print operator / QC | `frontend/src/app/printing/page.tsx:49` | **BROKEN** | `/api/printing:104` returns `users: []`; frontend never rendered dropdowns. |
| **9. Subplate Master** | Location Filter Dropdown | Filters by 'SM' vs Vendor location | `frontend/src/app/subplate/page.tsx:68` | **WORKING** | Correctly filters by `location`. |
| | Material Filter Dropdown | Filters by 23 authentic materials | `frontend/src/app/subplate/page.tsx:67` | **WORKING** | Filters using `REAL_MATERIALS` array. |
| | Project Filter Dropdown | Filters subplates by scan project | `frontend/src/app/subplate/page.tsx:69` | **WORKING** | Filters by `sp.projectid`. |
| **10. Purchase Inward** | Pending PO Inward Receive Modal | Receives items against open POs | `frontend/src/app/purchase-inward/page.tsx:78` | **WORKING** | Connected to live `view_po_pending_inward_qty`. |
| | Receive Qty Input & Validation | Validates against pending quantity | `frontend/src/app/purchase-inward/page.tsx:84` | **WORKING** | Prevents over-receiving beyond `pending_qty`. |
| **11. Customer Master** | Usertype Filter Tabs | Tabs for All, Customer, Vendor, Transport, Other | `frontend/src/app/customer/page.tsx:58` | **WORKING** | Filters by `c.usertype`. |
| | Add/Edit Modal Usertype Select | Sets usertype on new client/vendor | `frontend/src/app/customer/page.tsx:113` | **WORKING** | Correctly saves to `customers.usertype`. |
| **12. User Master** | Active Status Toggle | Toggles user status between 1 and 0 | `frontend/src/app/user/page.tsx:273` | **WORKING** | Uses `u.status === 1 ? 0 : 1`; patches Supabase users table. |
| | Role Dropdown | Assigns Admin, Manager, Supervisor, Designer, Worker | `frontend/src/app/user/page.tsx:7` | **WORKING** | Maps role_id 0..4; updates both `role_id` and `usertype`. |
| **13. Expense** | Account Filter Dropdown | Filters expenses by Account (`usertype='Other'`) | `frontend/src/app/expense/page.tsx:41` | **WORKING** | Populates accounts from `customers` table. |
| | Payment Mode / Type Dropdowns | Debit/Credit and Cash/Gpay/Check/NEFT | `frontend/src/app/expense/page.tsx:75` | **WORKING** | Correctly updates database balance. |
| **14. Gram Master** | Gram Tier Inputs | Creates weight tiers (min, max, fix, multiply) | `frontend/src/app/gram/page.tsx:45` | **WORKING** | Directly creates and updates `gram_calc` records. |
| | Test Gram Calculator | Live interactive calculator | `frontend/src/app/gram/page.tsx:34` | **WORKING** | Computes pricing in real-time. |
| **15. Report** | Downtime & Workflow Aggregations | Displays 7 downtime categories & workflow types | `frontend/src/app/report/page.tsx:42` | **WORKING** | Fetches live aggregates from `/api/report`. |
| **16. Export** | CSV Export Buttons (7 types) | Downloads 7 distinct CSV datasets matching legacy | `frontend/src/app/export/page.tsx:31` | **WORKING** | Correctly downloads CSV streams. |
| **17. Document Print** | Print Document Viewer | Renders printable Challan, Inward, Dispatch docs | `frontend/src/app/print/[type]/[id]` | **WORKING** | Fetches formatted document layout via `/api/print-doc`. |

---

# PART 3 — SUPABASE QUERY PERFORMANCE AUDIT

### 1. Measured Live API Response Times (Cold vs Warm)

Benchmark executed directly against the running Next.js instance connected to the live Supabase database using an authenticated Admin session:

| Endpoint | HTTP Status | Response Payload | Run 1 (Cold) | Run 2 (Warm) | Average Response Time | Performance Rating |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`/api/counts` (Dashboard)** | 200 | 0.3 KB | 8,648 ms | 5,713 ms | **7,181 ms (7.2s)** | 🔴 **CRITICAL** |
| **`/api/scanning`** | 200 | **1,160.8 KB (1.16 MB)** | 4,588 ms | 5,081 ms | **4,835 ms (4.8s)** | 🔴 **CRITICAL** |
| **`/api/subplate`** | 200 | **739.5 KB** | 4,253 ms | 5,121 ms | **4,687 ms (4.7s)** | 🔴 **CRITICAL** |
| **`/api/purchases?includePlates=true`** | 200 | 334.6 KB | 5,168 ms | 2,785 ms | **3,977 ms (4.0s)** | 🟠 **POOR** |
| **`/api/worklog`** | 200 | **844.4 KB** | 2,717 ms | 1,918 ms | **2,318 ms (2.3s)** | 🟡 **SLOW** |
| **`/api/report`** | 200 | 0.5 KB | 2,600 ms | 1,951 ms | **2,276 ms (2.3s)** | 🟡 **SLOW** |

---

### 2. Root Cause Analysis of Slow API Responses

#### Issue A: N+1 Sequential Query Loop in `/api/counts` (7.18s latency)
- **File:** `frontend/src/app/api/counts/route.ts:32-41`
- **Pattern:**
```typescript
for (const table of tables) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("*", { count: "exact", head: true });
  counts[table] = count ?? 0;
}
```
- **Impact:** 16 separate sequential HTTP requests to Supabase cloud. At ~200ms per round-trip network hop + SSL handshake, total response time is `16 * 200ms = 3.2s` minimum network latency plus database execution, reaching **7.18 seconds**.
- **Fix:** Replace with `Promise.all(tables.map(...))` to execute all 16 count requests in parallel, reducing latency from 7,200ms to ~350ms.

#### Issue B: Sequential Network Waterfall in `/api/scanning` (4.84s latency)
- **File:** `frontend/src/app/api/scanning/route.ts`
- **Pattern:** The route executes **12 sequential queries** one after another:
  1. `authenticateRequest`: Real-time user check on `users` table (`line 7`)
  2. `scan`: Queries scan table (`line 17`)
  3. `customers`: Queries full customers table (`line 33`)
  4. `users`: Queries full users table (`line 41`)
  5. `subplate`: Queries subplates by project IDs (`line 53`)
  6. `worklog`: Queries worklogs by scan IDs (`line 69`)
  7. `count: totalScans`: Count query (`line 111`)
  8. `count: pendingScans`: Count query (`line 115`)
  9. `count: missingScanner`: Count query (`line 120`)
  10. `count: missingQC`: Count query (`line 126`)
  11. `count: missingDesigner`: Count query (`line 132`)
  12. `allAmounts`: Queries all amounts for revenue calculation (`line 138`)
- **Impact:** 12 sequential network hops. In addition, the route transfers **1.16 MB of uncompressed JSON** on every single request because `scan` and `subplates` records are returned with all columns unpaginated.
- **Fix:** Consolidate KPI counts into a single SQL RPC function or compute KPIs directly from the scanned records, batch independent queries via `Promise.all`, and paginate table rows.

#### Issue C: Massive Unpaginated JSON Payloads
- `/api/scanning`: **1,160.8 KB** (1.16 MB)
- `/api/worklog`: **844.4 KB**
- `/api/subplate`: **739.5 KB**
- `/api/purchases`: **334.6 KB**
Client browsers spend hundreds of milliseconds parsing large JSON strings, degrading UI thread responsiveness.

#### Issue D: Excessive Use of `.select("*")` (38 Occurrences)
38 queries pull every column regardless of whether the client or aggregation needs them. For example:
- `api/worklog/route.ts:22`: `supabaseAdmin.from("worklog").select("*")` transfers unused timestamps, audit fields, and raw notes across 1,396 rows.
- `api/subplate/route.ts:19`: `supabaseAdmin.from("subplate").select("*")` transfers heavy fields (`photo`, `packing_photo`) across 6,015 rows.
- `api/scanning/route.ts:19`: `supabaseAdmin.from("scan").select("*")` transfers notes, dates, and unused metadata across 1,000 rows.

#### Issue E: Missing Indexes on High-Traffic Columns
Comparison between required query filters and actual indexes defined in `supabase/migrations/001_init.sql`:

| Table | Row Count | Existing Indexes | Missing Critical Indexes | Query That Suffers |
| :--- | :---: | :--- | :--- | :--- |
| **`subplate`** | 6,015 | `idx_subplate_projectid`, `idx_subplate_location` | `deleted_at`, `subprojectid`, `(projectid, deleted_at)` | Every query filters `.is("deleted_at", null)`. Worklog and purchase lookups join on `subprojectid`. |
| **`worklog`** | 1,396 | `idx_worklog_userid`, `idx_worklog_projectid`, `idx_worklog_rdate` | **`scan_print_id`**, `customerid`, `subplateid` | Scanning and Sample modules aggregate work hours via `.in("scan_print_id", scanIds)`. With no index on `scan_print_id`, Postgres performs sequential table scans on every page load. |
| **`purchase_inward_items`** | 6,465 | `idx_purchase_inward_items_inpid`, `idx_purchase_inward_items_plateid` | `pid`, `pending_qty` | PO tracking views filter `pending_qty > 0`. |
| **`purchase_items`** | 5,416 | `idx_purchase_items_pid`, `idx_purchase_items_plateid` | `material`, `materialtype` | Material searches and exports. |
| **`scan`** | 1,340 | `idx_scan_status`, `idx_scan_projectid` | `cname`, `worktype`, `(status, worktype)` | Worklog mould cascading filters by `cname`. Sample/Rework filters by `worktype`. |
| **`challan`** | 1,667 | `idx_challan_status`, `idx_challan_challanno` | `customerid`, `vendorid`, `chdate` | Inward and challan registers filter by vendor and customer. |
| **`inward`** | 1,770 | `idx_inward_challanid`, `idx_inward_status` | `vendorid`, `customerid`, `chdate` | Inward registers filter by vendor. |
| **`purchase`** | 2,946 | `idx_purchase_status`, `idx_purchase_projectid` | `cname`, `vname`, `odate` | Vendor and customer procurement history queries. |
| **`customers`** | 367 | `idx_customers_usertype`, `idx_customers_customername` | `deleted_at`, `initials` | All 17 routes filter `.is("deleted_at", null)`. |

#### Issue F: Zero Client-Side Caching & Redundant Authentication Lookups
- **Zero Cache on Static Lookups:** Customers (367 rows) and Users (24 rows) rarely change during an active session, yet every single navigation between Scanning, Work, Purchase, Challan, Inward, and Dispatch re-fetches the entire customer and user tables from scratch.
- **Redundant Database Hit in Auth:** `frontend/src/lib/auth.ts:82` queries the `users` table on **every API request** to check status, despite the session token already being HMAC-SHA256 cryptographically signed.

---

### 3. Prioritized Fix List (Speed Improvement vs. Risk)

| Priority | Optimization | Expected Impact | Risk Level | Description |
| :---: | :--- | :--- | :---: | :--- |
| **P1** | **Add Missing Database Indexes** | **60–80% faster query execution** on filtered queries | **Zero Risk** | Add indexes on `worklog(scan_print_id)`, `subplate(deleted_at)`, `subplate(subprojectid)`, `scan(cname)`, `scan(worktype)`, and `purchase_inward_items(pending_qty)`. Non-breaking DDL. |
| **P2** | **Parallelize `/api/counts` with `Promise.all`** | **90% reduction in `/api/counts` latency** (from 7.2s to ~350ms) | **Very Low** | Replace the sequential `for` loop with `await Promise.all(...)`. |
| **P3** | **Batch & Consolidate `/api/scanning` Sequential Calls** | **60% reduction in Scanning load time** (from 4.8s to ~1.8s) | **Low** | Execute customer lookup, user lookup, and subplate queries in parallel via `Promise.all`. Consolidate 5 count queries into a single query or compute from fetched scans. |
| **P4** | **Replace `.select("*")` with Column Projections** | **40–60% reduction in JSON payload size** | **Low** | Project only required fields in `subplate`, `scan`, and `worklog` queries. Directly lowers bandwidth, serialization, and frontend parsing delays. |
| **P5** | **Client-Side TanStack Query / SWR Caching for Lookups** | **Instant navigation (0ms network)** for dropdown lookups | **Medium** | Cache customers and users lookups in memory (5-minute stale time) across page transitions instead of re-fetching on every route change. |
| **P6** | **Implement Server-Side Pagination for Subplate & Worklog** | **Eliminates 700KB–1.1MB payloads** | **Medium** | Transition `subplate` (6,015 rows) from full dumps to server-side page/limit chunks (e.g. 50 items/page). |
| **P7** | **In-Memory Cache for HMAC Session Verification** | **Saves 150–200ms on EVERY API call** | **Low** | Cache authenticated user record in memory for 60 seconds by user ID instead of making a round-trip database query on every API call. |

---

# PART 4 — PART 1 FIX PLAN & EXECUTION

### Fix Specifications for Scanning Module Staff Assignment:
1. **API Route Fix (`frontend/src/app/api/scanning/route.ts`):**
   - Update line 43: Add `name` to `.select("id, name, username, initials, status, role_id")`.
   - Update line 150: Fix status filter to handle both number and string types:
     `users: (users || []).filter((u) => String(u.status) === "1" || u.status === 1)`
   - Update line 35: Add `usertype` to customers query: `.select("id, customername, initials, usertype")` so Add Project modal customer dropdown functions.
   - Update line 275: Handle zero unassignment cleanly:
     `updatePayload[field] = (value === 0 || value === "0" || value === "" || value === null) ? null : Number(value);`
2. **Frontend Fix (`frontend/src/app/scanning/page.tsx`):**
   - Ensure fallback display uses initials with name fallback `{u.initials || u.name || u.username}`.
3. **Automated Verification:**
   - Execute a live API PATCH call assigning a verified active user (e.g., User ID `1` "Shivani" or User ID `9` "Divyesh Limbasiya" - Designer) to a real scanning project in Supabase.
   - Fetch the updated project from `/api/scanning` and verify that `scan_by` and `scan_by_name` reflect the assigned staff member.
