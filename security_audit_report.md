# Security Audit Report

## 1. Supabase / PostgREST Silent Truncation & Pagination Traps

**Severity**: 🟠 High
**File & Line Number**: `src/app/api/scanning/route.ts` | Lines 38, 81, 87, 262, 270

**Bug Description & Root Cause**: PostgREST defaults to a 1000 row maximum limit unless `.limit()` is explicitly specified or pagination headers are sent. In several delta synchronization operations and data enrichment lookups where the `id` lists can be unbounded, `.select()` is invoked without a `.limit()`. This truncates the results silently, breaking the logic as not all dependent objects are correctly linked or retrieved. For example, batch fetching `worklog` on line 270: `.select("scan_print_id...").in("scan_print_id", scanIds)`. If >1000 items match, only the first 1000 are returned.

**Before (Vulnerable Code)**:
```typescript
        scanIds.length > 0
          ? supabaseAdmin
              .from("worklog")
              .select("scan_print_id, design_hr, program_hr, machine_hr, driltap_hr, qc_hr, work_hr")
              .in("scan_print_id", scanIds)
          : Promise.resolve({ data: [] }),
```

**After (Proposed Fix)**:
```typescript
        scanIds.length > 0
          ? supabaseAdmin
              .from("worklog")
              .select("scan_print_id, design_hr, program_hr, machine_hr, driltap_hr, qc_hr, work_hr")
              .in("scan_print_id", scanIds)
              .limit(10000)
          : Promise.resolve({ data: [] }),
```

---

## 2. JavaScript Type Coercion & Falsy/Null Quirks

**Severity**: 🟡 Medium
**File & Line Number**: `src/lib/weight-calculator.ts` | Lines 209-211

**Bug Description & Root Cause**: The code checks `!isNaN(Number(rawL))` to determine if a dimension is valid. However, `Number(null)` evaluates to `0`, making `isNaN(0)` `false`. Consequently, empty or `null` dimensions can slip through as valid numbers, causing `0` calculations which later cascade. Similar bugs exist in `src/app/api/scanning/route.ts` Line 138, where `isNaN(Number(s.cname))` is used to check if the customer name is just an ID vs actual name; if `s.cname` is `null`, it renders `Customer #null`.

**Before (Vulnerable Code)**:
```typescript
  const hasL = rawL !== null && rawL !== undefined && rawL !== "" && !isNaN(Number(rawL)) && Number(rawL) > 0;
```

**After (Proposed Fix)**:
```typescript
  const hasL = rawL !== null && rawL !== undefined && rawL !== "" && !Number.isNaN(Number(rawL)) && Number(rawL) > 0;
```

---

## 3. Query Parameter Injection & PostgREST Filter Manipulation

**Severity**: 🟠 High
**File & Line Number**: `src/app/api/scanning/route.ts` | Lines 185-188

**Bug Description & Root Cause**: `searchParams.get("search")` is directly interpolated into a PostgREST filter string `.or(projectid.ilike.%${safeSearch}%,...)`. Although the code attempts to sanitize with `safeSearch.replace(/[(),.%]/g, "")`, this regex is incomplete. Special characters relevant to `.ilike` and `.or` syntax like backslashes (`\`) or asterisks (`*`) or underscores (`_`) are not escaped, allowing users to inject malformed queries resulting in 500 server errors or potentially bypassing restrictive `.eq()` logic if injected properly.

**Before (Vulnerable Code)**:
```typescript
    if (search) {
      const safeSearch = search.replace(/[(),.%]/g, "");
      if (safeSearch) {
        scanQuery = scanQuery.or(`projectid.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
      }
    }
```

**After (Proposed Fix)**:
```typescript
    if (search) {
      const safeSearch = search.replace(/[(),.%\\_*]/g, "");
      if (safeSearch) {
        scanQuery = scanQuery.or(`projectid.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
      }
    }
```

---

## 4. Cache Desynchronization & Optimistic UI Bugs

**Severity**: 🟡 Medium
**File & Line Number**: `src/lib/query/hooks.ts` | Lines 245-262 and `src/app/api/scanning/route.ts` | Line 23

**Bug Description & Root Cause**: During delta synchronization `syncDelta`, the `serverTime` returned from the API route (`const serverTime = new Date().toISOString()`) is retrieved *before* the SQL query is executed (Line 23 of `scanning/route.ts`). If a row is updated concurrently while the SQL query executes, its `updated_at` might be strictly greater than `serverTime`. The client sets its local `lastSyncTime` to `serverTime`. On the next sync cycle, that concurrently updated row will not be fetched because its timestamp falls in the "crack" between `serverTime` and the query execution.

**Before (Vulnerable Code)**:
`src/app/api/scanning/route.ts` Line 23
```typescript
    if (since) {
      const serverTime = new Date().toISOString();
      const [updatedScansRes, ... ] = ...
```

**After (Proposed Fix)**:
Set `serverTime` after all database queries have completed, or rely entirely on `MAX(updated_at)` from the result set.
```typescript
    if (since) {
      const [updatedScansRes, updatedSubplatesRes] = await Promise.all([ ... ]);
      const serverTime = new Date().toISOString(); // Evaluated AFTER query execution
```

---

## 5. Cascade Deletions & Foreign Key Orphan Hazards

**Severity**: 🟠 High
**File & Line Number**: `src/app/api/subplate/route.ts` | Line 594

**Bug Description & Root Cause**: `DELETE` requests in `src/app/api/subplate/route.ts` hard delete a subplate directly from the database. However, this does not check for or cascade delete associated `worklog` records. Child `worklog` records tied to this `subplateid` will be left permanently orphaned, causing 500 errors in reporting or dashboard views where `subplate` lookups will return `null` and attempt property access. Similar logic is present in `purchases` deleting POs without soft deleting the `purchase_items`.

**Before (Vulnerable Code)**:
```typescript
    const { error } = await supabaseAdmin
      .from("subplate")
      .delete()
      .eq("id", subplateId);
```

**After (Proposed Fix)**:
```typescript
    // Ensure child worklogs are also hard-deleted or soft-deleted
    await supabaseAdmin.from("worklog").delete().eq("subplateid", subplateId);

    const { error } = await supabaseAdmin
      .from("subplate")
      .delete()
      .eq("id", subplateId);
```

---

## 6. Authorization & Role-Based Access Control (RBAC) Gaps

**Severity**: 🔴 Critical
**File & Line Number**: `src/app/api/worklog/route.ts` | Lines 164, 255, 350

**Bug Description & Root Cause**: The `authenticateRequest(req, undefined, "nav_work")` call checks only if the user has the "nav_work" permission. It passes `undefined` for roles. While `DELETE` explicitly checks `if (auth.user.role_id > 1) { ... verify ownership ... }`, `PUT` on Line 255 entirely lacks this check. This means ANY user (including workers) with navigation access to the worklog page can modify any other user's worklog hours, dates, or details. IDOR (Insecure Direct Object Reference) is fully exploitable.

**Before (Vulnerable Code)**:
```typescript
    // Role check / Ownership verification
    if (auth.user.role_id > 1) {
      const { data: existingLog } = await supabaseAdmin
        .from("worklog")
        .select("userid")
        .eq("id", id)
        .single();
      // ... check exists but only inside a block that is easily bypassed if not implemented
```

**After (Proposed Fix)**:
Implement strict ownership checks on `PUT` and `POST` matching the `DELETE` handler.
```typescript
    if (auth.user.role_id > 1) {
      const { data: existingLog } = await supabaseAdmin
        .from("worklog")
        .select("userid")
        .eq("id", id)
        .single();
      if (!existingLog || Number(existingLog.userid) !== auth.user.id) {
        return NextResponse.json(
          { error: "Forbidden: You can only edit your own worklogs" },
          { status: 403 }
        );
      }
    }
```
