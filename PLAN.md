# StarMould ERP — Master Architecture & Performance Execution Plan

**Author:** Principal Software Architect & Next.js Performance Engineering Lead  
**Execution Date:** 2026-10-18 (Scheduled Morning Execution)  
**Target Codebase:** `e:\repos\starmould`  
**Reference Audit:** [`docs/STARMOULD_COMPLETE_PERFORMANCE_ARCHITECTURE_AUDIT.md`](file:///e:/repos/starmould/docs/STARMOULD_COMPLETE_PERFORMANCE_ARCHITECTURE_AUDIT.md)  
**Strategy Approved:** Incremental Phase-by-Phase, Clean-Cut API Lookups Stripping, Non-Blocking IndexedDB Persistence, Hybrid Supabase Realtime + TanStack Background Polling, Dual Large-Table Optimization (Server-Side Pagination + `@tanstack/react-virtual`).

---

## Table of Contents
1. [Execution Principles & Safety Rules](#1-execution-principles--safety-rules)
2. [Dependency Additions Required](#2-dependency-additions-required)
3. [Phase A: Critical Bug Fixes & Immediate Instrumentation](#3-phase-a-critical-bug-fixes--immediate-instrumentation)
4. [Phase B: TanStack Query v5 & Non-Blocking IndexedDB Persister](#4-phase-b-tanstack-query-v5--non-blocking-indexeddb-persister)
5. [Phase C: Migrate Raw `fetch()` Modules to TanStack Query](#5-phase-c-migrate-raw-fetch-modules-to-tanstack-query)
6. [Phase D: Clean-Cut API Lookups Stripping & Response Optimization](#6-phase-d-clean-cut-api-lookups-stripping--response-optimization)
7. [Phase E: API Concurrency via `Promise.all` & N+1 Elimination](#7-phase-e-api-concurrency-via-promiseall--n1-elimination)
8. [Phase F: Database Schema Migration, Indexes & In-Database Aggregations](#8-phase-f-database-schema-migration-indexes--in-database-aggregations)
9. [Phase G: High-Density Table Virtualization & Chip Memoization](#9-phase-g-high-density-table-virtualization--chip-memoization)
10. [Phase H: Hybrid Real-Time Synchronization (Supabase Realtime + Polling)](#10-phase-h-hybrid-real-time-synchronization-supabase-realtime--polling)
11. [Phase I: Security, Rate-Limiting & Code Cleanup](#11-phase-i-security-rate-limiting--code-cleanup)
12. [Post-Execution Verification Checklist & Smoke Tests](#12-post-execution-verification-checklist--smoke-tests)
13. [Emergency Rollback Playbook](#13-emergency-rollback-playbook)

---

## 1. Execution Principles & Safety Rules

1. **Strictly Sequential Phase Execution**: Never start a subsequent phase until the current phase passes type-checking (`npm run build` or `npx tsc --noEmit`) and manual smoke testing.
2. **One Git Commit Per Phase**: Commit changes at the end of each phase with conventional commit messages (e.g., `fix(api): phase a critical bug fixes and instrumentation`).
3. **Preserve Business Logic & Roles**: Never alter authorization rules (`authenticateRequest`), status codes, or role permission invariants.
4. **Zero Untracked Side Effects**: All database changes must be encapsulated in idempotent migrations (`IF NOT EXISTS`, `CONCURRENTLY`).
5. **No Blind Secrets**: Do not commit `.env` or print secret values in logs.

---

## 2. Dependency Additions Required

Run this once at the start of Phase B and Phase G:

```bash
# Phase B: Non-blocking IndexedDB persister (eliminates main-thread LZ-String compression)
npm install idb-keyval

# Phase G: Virtualization engine for continuous tables (work logs, printing orders)
npm install @tanstack/react-virtual
```

---

## 3. Phase A: Critical Bug Fixes & Immediate Instrumentation

**Objective:** Eliminate 4 confirmed fatal/functional bugs, unblock subplate creation, and inject `Server-Timing` headers for baseline latency profiling.

### Task A.1: Fix Fatal Table Typo in Subplate POST Handler (Finding F-26)
- **Target File:** [`src/app/api/subplate/route.ts`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L209-L215)
- **Current Defect:** Queries `.from("scans")` (plural) instead of `.from("scan")`. Causes subplate creation to crash with a 400/500 table-not-found error.
- **Action:** Change line 210 from `"scans"` to `"scan"`:
```diff
--- a/src/app/api/subplate/route.ts
+++ b/src/app/api/subplate/route.ts
@@ -209,3 +209,3 @@
         const { data: scanProject, error: scanErr } = await supabaseAdmin
-          .from("scans")
+          .from("scan")
           .select("id, projectid")
```

### Task A.2: Fix Soft-Delete Leak in Server Customers Cache (Finding F-38)
- **Target File:** [`src/lib/cache.ts`](file:///e:/repos/starmould/src/lib/cache.ts#L72-L79)
- **Current Defect:** `getCachedCustomers()` queries `customers` without `.is("deleted_at", null)`. Deleted customers are served across all ERP dropdowns.
- **Action:** Add the soft-delete filter:
```diff
--- a/src/lib/cache.ts
+++ b/src/lib/cache.ts
@@ -75,3 +75,4 @@ export async function getCachedCustomers(): Promise<any[]> {
     const { data } = await supabaseAdmin
       .from("customers")
-      .select("id, customername, initials, usertype, deleted_at");
+      .select("id, customername, initials, usertype, deleted_at")
+      .is("deleted_at", null);
```

### Task A.3: Fix Topbar Logout Session Leak (Finding F-39)
- **Target File:** [`src/components/layout/topbar.tsx`](file:///e:/repos/starmould/src/components/layout/topbar.tsx#L165-L174)
- **Current Defect:** Directly calls `/api/auth/logout` via raw `fetch`, completely bypassing `useAuth().logout()`. Leaves user state in `localStorage` and keeps TanStack Query cache populated.
- **Action:** Import `useAuth` and call `logout()`:
```diff
--- a/src/components/layout/topbar.tsx
+++ b/src/components/layout/topbar.tsx
@@ -25,3 +25,3 @@ export function Topbar() {
   const { user } = useAuth();
+  const { logout } = useAuth();
   const [userMenuOpen, setUserMenuOpen] = useState(false);
@@ -165,8 +165,4 @@ export function Topbar() {
   const handleLogout = async () => {
-    try {
-      await fetch("/api/auth/logout", { method: "POST" });
-      window.location.href = "/login";
-    } catch (e) {
-      console.error("Logout failed:", e);
-    }
+    await logout();
   };
```

### Task A.4: Fix Expense Cache Key Invalidation Mismatch (Finding F-37)
- **Target File:** [`src/app/api/expense/route.ts`](file:///e:/repos/starmould/src/app/api/expense/route.ts#L126, #L226, #L283)
- **Current Defect:** Calls `invalidateCachePrefix("counts:")`, but the dashboard count cache key defined in `cache.ts` is `"api_counts_all"`. Adding or editing expenses never updates dashboard count widgets.
- **Action:** Correct the cache invalidation call in POST, PUT, and DELETE handlers:
```diff
--- a/src/app/api/expense/route.ts
+++ b/src/app/api/expense/route.ts
@@ -126,3 +126,3 @@ export async function POST(req: NextRequest) {
     invalidateCachePrefix("expense_");
-    invalidateCachePrefix("counts:");
+    invalidateCache("api_counts_all");
```

### Task A.5: Add Server-Timing Header Helper for Baseline Instrumentation
- **Target File:** [`src/lib/api/response.ts`](file:///e:/repos/starmould/src/lib/api/response.ts)
- **Action:** Add a utility `withServerTiming(res: NextResponse, startTime: number, description?: string)` so route handlers can output standard `Server-Timing: total;dur=123.4` headers.

#### Phase A Verification:
1. `npm run build` succeeds without TypeScript errors.
2. POST `/api/subplate` with test project ID succeeds without table error.
3. Logout from Topbar clears `starmould_user_session` in `localStorage`.
4. Git commit: `git commit -am "fix(core): phase a - critical bug fixes and cache invalidations"`

---

## 4. Phase B: TanStack Query v5 & Non-Blocking IndexedDB Persister

**Objective:** Eliminate the hydration race condition, replace synchronous CPU-blocking `LZString` compression with non-blocking IndexedDB persistence, scope storage per user, and enable background stale revalidation.

### Task B.1: Install `idb-keyval`
```bash
npm install idb-keyval
```

### Task B.2: Create Non-Blocking IndexedDB Persister (ADR-01)
- **Target File:** [`src/lib/query/persister.ts`](file:///e:/repos/starmould/src/lib/query/persister.ts)
- **Implementation:** Replace synchronous localStorage + LZString with the official TanStack Query v5 custom `Persister` using `idb-keyval`.
- **Code Blueprint:**
```typescript
import { get, set, del } from "idb-keyval";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

export function createIDBPersister(userKeySuffix: string = "default"): Persister {
  const idbKey = `STARMOULD_CACHE_V3_${userKeySuffix}`;
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(idbKey, client);
      } catch (err) {
        console.warn("[IDBPersister] Failed to persist cache:", err);
      }
    },
    restoreClient: async () => {
      try {
        return await get<PersistedClient>(idbKey);
      } catch (err) {
        console.warn("[IDBPersister] Failed to restore cache:", err);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del(idbKey);
      } catch (err) {
        console.warn("[IDBPersister] Failed to remove cache:", err);
      }
    },
  };
}
```

### Task B.3: Replace Post-Mount `useEffect` with `<PersistQueryClientProvider>` (Finding F-27)
- **Target File:** [`src/components/providers/query-provider.tsx`](file:///e:/repos/starmould/src/components/providers/query-provider.tsx)
- **Current Defect:** Calls `persistQueryClient` inside `useEffect`, causing child queries to fire across the network before cached data is read.
- **Action:** Refactor to use the official `<PersistQueryClientProvider>` wrapper:
```tsx
"use client";

import React, { useState, useMemo } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createQueryClient } from "@/lib/query/client";
import { createIDBPersister } from "@/lib/query/persister";
import { useAuth } from "@/components/providers/auth-provider";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const { user } = useAuth();

  const persister = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const userSuffix = user?.id ? `${user.id}_${user.role_id}` : "anon";
    return createIDBPersister(userSuffix);
  }, [user?.id, user?.role_id]);

  if (!persister) {
    return <>{children}</>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: "v3.0.0",
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            // Only persist successful queries that are STABLE or MODERATE
            // Exclude huge high-churn operational query lists to preserve performance
            return (
              query.state.status === "success" &&
              query.queryKey[0] !== "worklogs" &&
              query.queryKey[0] !== "search"
            );
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
```

### Task B.4: Enable Background Revalidation in QueryClient Defaults (Finding F-10)
- **Target File:** [`src/lib/query/client.ts`](file:///e:/repos/starmould/src/lib/query/client.ts#L36-L45)
- **Action:** Change `refetchOnMount` from `false` to `true`, and enable `refetchOnWindowFocus` for the operational tier:
```diff
--- a/src/lib/query/client.ts
+++ b/src/lib/query/client.ts
@@ -38,3 +38,3 @@ export function createQueryClient(): QueryClient {
-      refetchOnWindowFocus: false,
-      refetchOnMount: false,
+      refetchOnWindowFocus: false, // Default off globally
+      refetchOnMount: true,        // Stale persisted data revalidates in background
       refetchOnReconnect: true,
```

### Task B.5: Move Render-Body Prefetch to `useEffect` (Finding F-15)
- **Target File:** [`src/lib/query/hooks.ts`](file:///e:/repos/starmould/src/lib/query/hooks.ts#L106-L127)
- **Action:** Wrap the next-page prefetch in `useEffect` so it complies with React 19 pure render rules:
```diff
--- a/src/lib/query/hooks.ts
+++ b/src/lib/query/hooks.ts
@@ -106,6 +106,8 @@ export function useProjectsQuery(params: ProjectsQueryParams = {}) {
-    if (query.data?.pagination?.hasNextPage) {
+    React.useEffect(() => {
+      if (query.data?.pagination?.hasNextPage) {
         const nextPageParams = { ...params, page: page + 1 };
         queryClient.prefetchQuery({
           queryKey: queryKeys.projects.list(nextPageParams),
           queryFn: () => ...,
           staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
         });
+      }
+    }, [query.data?.pagination?.hasNextPage, params, page, pageSize, queryClient]);
```

### Task B.6: Memoize `useSmartPrefetch` Functions (Finding F-28)
- **Target File:** [`src/lib/query/prefetch.ts`](file:///e:/repos/starmould/src/lib/query/prefetch.ts#L22-L254)
- **Action:** Wrap `prefetchProjects`, `prefetchSubplates`, `prefetchCustomers`, `prefetchWorklogs`, etc. in `useCallback` to prevent continuous idle warmup timer resets in `Sidebar`.

#### Phase B Verification:
1. Reload the app; inspect IndexedDB in DevTools → Application → IndexedDB → `keyval-store` to verify `STARMOULD_CACHE_V3_<userId>` is populated.
2. Confirm zero UI freeze on typing (LZ-String compression is no longer running on main thread).
3. Confirm stale queries display cached data instantly, with subtle background revalidation.
4. Git commit: `git commit -am "feat(query): phase b - indexeddb persister, blocking hydration, and pure render prefetch"`

---

## 5. Phase C: Migrate Raw `fetch()` Modules to TanStack Query

**Objective:** Unify 100% of data fetching under TanStack Query v5, eliminating raw `fetch()` + `useState` patterns across 4 modules and 2 interactive drawers.

### Task C.1: Add Missing Query & Mutation Hooks to `hooks.ts`
- **Target File:** [`src/lib/query/hooks.ts`](file:///e:/repos/starmould/src/lib/query/hooks.ts)
- **Hooks to Add:**
  1. `usePurchaseInwardQuery(params)` & `useCreatePurchaseInwardMutation()`
  2. `useGramTiersQuery()` & `useUpdateGramMutation()`
  3. `useReportMetricsQuery()`
  4. `useExportCountsQuery()`
- **Add to `src/lib/query/keys.ts`:**
  - `purchaseInward.all()`, `purchaseInward.list(params)`
  - `grams.all()`, `grams.list()`
  - `reports.all()`, `reports.summary()`

### Task C.2: Refactor `/purchase-inward` Page (Finding F-29)
- **Target File:** [`src/app/purchase-inward/page.tsx`](file:///e:/repos/starmould/src/app/purchase-inward/page.tsx#L47-L76, #L267-L297)
- **Action:**
  - Replace `const [inwards, setInwards] = useState(...)` with `const { data, isLoading } = usePurchaseInwardQuery()`.
  - Replace raw `fetch("/api/purchase-inward", { method: "POST" })` with `useCreatePurchaseInwardMutation()`.
  - On mutation success, invalidate `purchaseInward.all()`, `purchases.all()`, and `subplates.all()`.

### Task C.3: Refactor `/gram` Page (Finding F-29)
- **Target File:** [`src/app/gram/page.tsx`](file:///e:/repos/starmould/src/app/gram/page.tsx#L63-L89)
- **Action:**
  - Replace local `useState` + `fetchTiers()` with `useGramTiersQuery()`.
  - Replace direct PUT/POST/DELETE with `useUpdateGramMutation()`.
  - On mutation success, invalidate both `grams.all()` and `printing.all()` (so 3D printing auto-updates gram tier pricing).

### Task C.4: Refactor `/report` Page (Finding F-29)
- **Target File:** [`src/app/report/page.tsx`](file:///e:/repos/starmould/src/app/report/page.tsx#L72-L100)
- **Action:**
  - Replace manual `fetchReportData()` with `useReportMetricsQuery()`.
  - Enable caching (`staleTime: 5 * 60 * 1000`) so switching tabs does not re-run expensive aggregations.

### Task C.5: Replace Raw Subplate Fetches in Modals (Finding F-30)
- **Target Files:**
  - [`src/app/purchase/page.tsx#L164-L194`](file:///e:/repos/starmould/src/app/purchase/page.tsx#L164-L194)
  - [`src/app/challan/page.tsx#L141-L158`](file:///e:/repos/starmould/src/app/challan/page.tsx#L141-L158)
- **Action:** Remove `fetch('/api/subplate?projectid=...')` and local state; use the existing hook:
```tsx
const { data: projectSubplates, isLoading: isSubplatesLoading } = useSubplatesByProjectQuery(selectedProjectId);
```

### Task C.6: Refactor Dashboard Mould Projects Accordion (Finding F-01, F-03)
- **Target File:** [`src/components/dashboard/mould-projects-table.tsx`](file:///e:/repos/starmould/src/components/dashboard/mould-projects-table.tsx#L124-L153)
- **Action:**
  - Remove hand-rolled `rowSubplatesCache` and `loadingRowId`.
  - Create a child sub-component `<ProjectSubplatesRow projectId={project.id} />` that calls `useSubplatesByProjectQuery(projectId)` directly.
  - Show proper per-row skeleton loaders and actionable error retry buttons if network fails.

#### Phase C Verification:
1. Navigate between `/purchase-inward`, `/gram`, and `/report`; verify instantaneous transition using cached state on return visits.
2. Edit a gram tier in `/gram`; navigate to `/printing`; confirm updated pricing appears immediately.
3. Git commit: `git commit -am "refactor(pages): phase c - eliminate raw fetch and unify on tanstack query"`

---

## 6. Phase D: Clean-Cut API Lookups Stripping & Response Optimization

**Objective:** Reduce listing API response payloads from 2MB–4MB down to <150KB (70%–85% bandwidth reduction).

### Task D.1: Strip Lookups from GET `/api/challan` (Finding F-31)
- **Target File:** [`src/app/api/challan/route.ts`](file:///e:/repos/starmould/src/app/api/challan/route.ts#L45-L50, #L115-L124)
- **Current Bloat:** Fetches and returns 2,000 `subplates`, 1,000 `scans`, and all `customers`.
- **Action:**
  - Remove `subplate.select(...).limit(2000)` and `getCachedScansLookup()`.
  - Return clean JSON: `{ challans, pagination, totalActive }`.
  - In [`src/app/challan/page.tsx`](file:///e:/repos/starmould/src/app/challan/page.tsx), consume customers via `useCustomerDropdownQuery()` and users via `useUserDropdownQuery()`.

### Task D.2: Strip Lookups from GET `/api/dispatch` (Finding F-31)
- **Target File:** [`src/app/api/dispatch/route.ts`](file:///e:/repos/starmould/src/app/api/dispatch/route.ts#L42-L57, #L77-L82)
- **Action:** Remove queries for all customers, 2,000 subplates, and 1,000 scans. Return clean `{ dispatches, pagination }`. Update [`src/app/dispatch/page.tsx`](file:///e:/repos/starmould/src/app/dispatch/page.tsx) to read lookups from client hooks.

### Task D.3: Strip Lookups from GET `/api/inward` (Finding F-31)
- **Target File:** [`src/app/api/inward/route.ts`](file:///e:/repos/starmould/src/app/api/inward/route.ts#L50-L54, #L103-L112)
- **Action:** Remove the 2,000 subplates dump. Return clean `{ inwards, pendingChallans, pagination }`. Update [`src/app/inward/page.tsx`](file:///e:/repos/starmould/src/app/inward/page.tsx).

### Task D.4: Strip Lookups from GET `/api/worklog` (Finding F-31)
- **Target File:** [`src/app/api/worklog/route.ts`](file:///e:/repos/starmould/src/app/api/worklog/route.ts#L56-L65, #L128-L152)
- **Action:** Remove the 2,000 subplates lookup query. Return clean `{ worklogs, pagination, kpis }`. Update [`src/app/work/page.tsx`](file:///e:/repos/starmould/src/app/work/page.tsx).

### Task D.5: Strip Lookups from GET `/api/printing` & `/api/purchase-inward`
- **Target Files:**
  - [`src/app/api/printing/route.ts`](file:///e:/repos/starmould/src/app/api/printing/route.ts#L108-L118)
  - [`src/app/api/purchase-inward/route.ts`](file:///e:/repos/starmould/src/app/api/purchase-inward/route.ts#L65-L71)
- **Action:** Remove embedded user/customer full table arrays.

### Task D.6: Add Lean Mode to Subplate Endpoint (Finding F-02)
- **Target File:** [`src/app/api/subplate/route.ts`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L62-L95)
- **Action:** When `projectid` query parameter is supplied, skip the 3 KPI count queries, skip scans lookup, and return **only** matching subplates:
```typescript
if (projectid) {
  const { data: plates, error } = await subplateQuery;
  return NextResponse.json({ subplates: plates || [] }, {
    headers: { "Cache-Control": "private, no-store, must-revalidate" }
  });
}
```

### Task D.7: Set `private, no-store` on All Mutable ERP Routes (Finding F-08)
- **Target Files:** All route handlers in `src/app/api/**/route.ts`.
- **Action:** Replace `max-age=10, stale-while-revalidate=60` with `private, no-store, must-revalidate` so the browser HTTP cache never returns stale records following a TanStack Query mutation invalidation.

#### Phase D Verification:
1. Open DevTools Network tab.
2. Load `/challan`, `/dispatch`, `/inward`, `/work`.
3. Verify response payload sizes drop by 70%–85% (e.g. from 2.8MB down to <120KB).
4. Git commit: `git commit -am "perf(api): phase d - strip lookups dumping and optimize response headers"`

---

## 7. Phase E: API Concurrency via `Promise.all` & N+1 Elimination

**Objective:** Cut API endpoint execution times by 50%–65% by converting sequential database awaits to concurrent `Promise.all` calls, and batching mutation update loops.

### Task E.1: Parallelize GET `/api/dispatch` (Finding F-34)
- **Target File:** [`src/app/api/dispatch/route.ts`](file:///e:/repos/starmould/src/app/api/dispatch/route.ts#L18-L57)
- **Current Flow:** 5 sequential awaits.
- **Optimized Flow:**
```typescript
const { data: dispatches, error, count } = await dispatchQuery;
const dIds = (dispatches || []).map((d) => d.id);

// Concurrently fetch line items
const [{ data: items }] = await Promise.all([
  supabaseAdmin.from("dispatch_items").select("*").in("dispatchid", dIds),
]);
```

### Task E.2: Parallelize GET `/api/printing` (Finding F-34)
- **Target File:** [`src/app/api/printing/route.ts`](file:///e:/repos/starmould/src/app/api/printing/route.ts#L42-L83)
- **Optimized Flow:**
```typescript
const [printsRes, gramTiersRes] = await Promise.all([
  printQuery,
  supabaseAdmin.from("gram_calc").select("*").order("id", { ascending: true }),
]);
```

### Task E.3: Parallelize GET `/api/sample` (Finding F-34)
- **Target File:** [`src/app/api/sample/route.ts`](file:///e:/repos/starmould/src/app/api/sample/route.ts#L17-L57)
- **Optimized Flow:**
```typescript
const { data: samples, error } = await sampleQuery;
const scanIds = (samples || []).map((s) => s.id);

const [{ data: worklogs }] = await Promise.all([
  supabaseAdmin.from("worklog").select("scan_print_id, userid, work_hr").in("scan_print_id", scanIds),
]);
```

### Task E.4: Parallelize Document Generation in `/api/print-doc` (Finding F-34)
- **Target File:** [`src/app/api/print-doc/route.ts`](file:///e:/repos/starmould/src/app/api/print-doc/route.ts#L32-L61)
- **Action:** Parallelize customer lookup, vendor lookup, and line items query for Challan, Inward, Dispatch, and Purchase documents.

### Task E.5: Batch Subplate Location Updates in POST `/api/challan` and `/api/inward` (Finding F-35)
- **Target Files:**
  - [`src/app/api/challan/route.ts#L228-L248`](file:///e:/repos/starmould/src/app/api/challan/route.ts#L228-L248)
  - [`src/app/api/inward/route.ts#L245-L273`](file:///e:/repos/starmould/src/app/api/inward/route.ts#L245-L273)
- **Current Defect:** Loops over plate items executing individual `subplate.update()` queries.
- **Action:** Replace the loop with a single batch update statement:
```typescript
const plateIds = plates.map((p) => p.id);
if (plateIds.length > 0) {
  await supabaseAdmin
    .from("subplate")
    .update({ location: newLoc })
    .in("id", plateIds);
}
```

#### Phase E Verification:
1. Verify `/api/dispatch` response time drops by >50%.
2. Create a Challan with 10 plates; verify a single database update query is fired instead of 10 individual network roundtrips.
3. Git commit: `git commit -am "perf(api): phase e - promise.all concurrency and batch subplate updates"`

---

## 8. Phase F: Database Schema Migration, Indexes & In-Database Aggregations

**Objective:** Eliminate full-table JavaScript loops in Node.js, replace them with native SQL `GROUP BY` aggregations, and create optimal composite indexes.

### Task F.1: Create Idempotent Migration File
- **Target File:** `supabase/migrations/012_performance_optimization_v2.sql`
- **SQL Implementation:**
```sql
-- 012_performance_optimization_v2.sql
-- Idempotent, safe migration for StarMould ERP performance optimization

-- 1. Composite & Partial Indexes for Critical Query Paths
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subplate_projectid_active 
  ON public.subplate(projectid) 
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_worktype_status_active 
  ON public.scan(status, worktype) 
  WHERE status <> 'completed';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inward_items_inchallan_plate 
  ON public.inward_items(inchallanid, plateid);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_challan_items_challan_plate 
  ON public.challan_items(challanid, plateid);

-- 2. Fast Aggregation RPC Function for Dashboard Table Counts (Collapses 16 queries into 1)
CREATE OR REPLACE FUNCTION public.get_table_counts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'customers', (SELECT count(*) FROM public.customers WHERE deleted_at IS NULL),
    'subplates', (SELECT count(*) FROM public.subplate WHERE deleted_at IS NULL),
    'scans', (SELECT count(*) FROM public.scan),
    'purchases', (SELECT count(*) FROM public.purchase),
    'po_inwards', (SELECT count(*) FROM public.po_inward),
    'challans', (SELECT count(*) FROM public.challan),
    'inwards', (SELECT count(*) FROM public.inward),
    'dispatches', (SELECT count(*) FROM public.dispatch),
    'expenses', (SELECT count(*) FROM public.expense),
    'worklogs', (SELECT count(*) FROM public.worklog),
    'users', (SELECT count(*) FROM public.users WHERE deleted_at IS NULL)
  ) INTO result;
  RETURN result;
END;
$$;
```

### Task F.2: Move Expense Aggregation to PostgreSQL in `/api/expense` (Finding F-36)
- **Target File:** [`src/app/api/expense/route.ts`](file:///e:/repos/starmould/src/app/api/expense/route.ts#L43-L56)
- **Current Defect:** Queries **every row in the expense table** across the network and sums debit/credit balances using a JavaScript `for` loop in Node.js.
- **Action:** Replace with an aggregation query:
```typescript
// Replace full table scan with SQL grouping:
const { data: totals } = await supabaseAdmin
  .from("expense")
  .select("payment_type, amount");
// Or direct RPC / grouped select
```

### Task F.3: Move Scan Worktype Counting to SQL in `/api/report` (Finding F-36)
- **Target File:** [`src/app/api/report/route.ts`](file:///e:/repos/starmould/src/app/api/report/route.ts#L122)
- **Current Defect:** Fetches all scans to count `worktype` in JavaScript.
- **Action:** Replace with SQL grouping query.

### Task F.4: Use `get_table_counts()` in `/api/counts` (Finding F-47)
- **Target File:** [`src/app/api/counts/route.ts`](file:///e:/repos/starmould/src/app/api/counts/route.ts#L13-L52)
- **Action:** Call `supabaseAdmin.rpc("get_table_counts")` on cache miss instead of executing 16 parallel PostgREST queries.

#### Phase F Verification:
1. Migration file is written idempotently with `IF NOT EXISTS`.
2. `/api/expense` returns accurate debit/credit balances without downloading entire table.
3. `/api/counts` completes in <50ms.
4. Git commit: `git commit -am "perf(db): phase f - composite indexes, rpc counts, and sql aggregations"`

---

## 9. Phase G: High-Density Table Virtualization & Chip Memoization

**Objective:** Restrict rendered DOM nodes to <20 visible rows, eliminate UI frame drops during table scrolling, and memoize interactive stage chips.

### Task G.1: Install `@tanstack/react-virtual`
```bash
npm install @tanstack/react-virtual
```

### Task G.2: Memoize `StageChipPicker` (Finding F-42)
- **Target File:** Subplate stage chip component (in [`src/app/subplate/page.tsx`](file:///e:/repos/starmould/src/app/subplate/page.tsx#L590-L670) or separate chip file).
- **Action:** Wrap the chip in `React.memo` with custom comparison:
```tsx
export const StageChipPicker = React.memo(
  function StageChipPicker({
    stageKey,
    currentStage,
    subplateId,
    plateName,
    onStageUpdated,
  }: StageChipPickerProps) {
    // Component rendering logic...
  },
  (prev, next) => {
    return (
      prev.currentStage === next.currentStage &&
      prev.subplateId === next.subplateId &&
      prev.stageKey === next.stageKey
    );
  }
);
```

### Task G.3: Implement Virtualization on the Worklog Register (Finding F-42)
- **Target File:** [`src/app/work/page.tsx`](file:///e:/repos/starmould/src/app/work/page.tsx#L446-L545)
- **Action:** Use `useVirtualizer` with a container `ref`:
```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

const parentRef = React.useRef<HTMLDivElement>(null);

const rowVirtualizer = useVirtualizer({
  count: worklogs.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,
  overscan: 10,
});
```

### Task G.4: Eliminate `useState(initialData)` State Duplication in Mould Table (Finding F-43)
- **Target File:** [`src/components/dashboard/mould-projects-table.tsx`](file:///e:/repos/starmould/src/components/dashboard/mould-projects-table.tsx#L110-L111, #L542-L544)
- **Current Defect:** Duplicates TanStack Query cache into local `data` state, creating state drift and UI flickering when background refetches land.
- **Action:** Remove `const [data, setData] = useState(initialData)` and consume `initialData` directly, using TanStack Query mutations with optimistic cache updates via `queryClient.setQueryData`.

#### Phase G Verification:
1. Open Chrome DevTools Performance panel.
2. Scroll through the Worklogs table and Subplate table.
3. Verify frame rates remain steady at 60 FPS without long tasks (>50ms).
4. Git commit: `git commit -am "perf(ui): phase g - virtualized tables and memoized stage chips"`

---

## 10. Phase H: Hybrid Real-Time Synchronization (Supabase Realtime + Polling)

**Objective:** Ensure multi-user updates on the shop floor propagate instantly to all connected screens without polling storms or socket overload.

### Task H.1: Create Realtime Sync Provider & Hook (ADR-05)
- **Target File:** `src/lib/query/realtime.ts` (New File)
- **Implementation:**
```typescript
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query/keys";

export function useRealtimeManufacturingSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe only to high-velocity subplate stage changes
    const channel = supabase
      .channel("manufacturing-floor-sync")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "subplate",
        },
        (payload) => {
          // Targeted invalidation: refresh subplates and dashboard counts
          queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scan",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
```

### Task H.2: Attach Realtime Listener in QueryProvider
- **Target File:** [`src/components/providers/query-provider.tsx`](file:///e:/repos/starmould/src/components/providers/query-provider.tsx)
- **Action:** Mount `useRealtimeManufacturingSync()` inside `QueryProvider`.

### Task H.3: Configure 45s Background Polling Fallback on Active Tabs
- **Target File:** [`src/lib/query/client.ts`](file:///e:/repos/starmould/src/lib/query/client.ts)
- **Action:** Configure `refetchInterval: 45_000` with `refetchIntervalInBackground: false` on the `OPERATIONAL` cache tier as a fallback for any dropped WebSocket packets.

#### Phase H Verification:
1. Open the application in two separate browser windows side-by-side.
2. In Window A, advance a subplate from "Design" to "Order".
3. Verify Window B automatically updates the stage chip within 1.5 seconds without manual page reload.
4. Git commit: `git commit -am "feat(realtime): phase h - hybrid supabase realtime and background sync"`

---

## 11. Phase I: Security, Rate-Limiting & Code Cleanup

**Objective:** Protect public endpoints against brute force / DDoS, sanitize search queries, and consolidate redundant page templates.

### Task I.1: Add Rate Limiting to Sensitive Endpoints (Finding F-46)
- **Target Files:**
  - `src/app/api/auth/change-password/route.ts` (10 requests / 15 min)
  - `src/app/api/upload/route.ts` (20 uploads / 15 min)
  - `src/app/api/search/route.ts` (60 searches / min)
  - `src/app/api/logs/client-error/route.ts` (30 logs / min)
- **Action:** Invoke `checkRateLimit(ip, limit, windowMs)` from `src/lib/rate-limit.ts`.

### Task I.2: Sanitize Subplate Search Parameters (Finding F-21)
- **Target File:** [`src/app/api/subplate/route.ts#L35`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L35)
- **Action:** Strip PostgREST special characters `(),.%` from `search` and `projectid` inputs before interpolating into `.or()`.

### Task I.3: Consolidate Customers & Vendors Pages (Finding F-50)
- **Target Files:**
  - `src/app/customers/page.tsx` (1,291 lines)
  - `src/app/vendors/page.tsx` (1,378 lines)
- **Action:**
  - Extract reusable template `src/components/shared/directory-entity-page.tsx`.
  - Pass `entityType="Customer" | "Vendor"` with appropriate query hooks.
  - Eliminates ~2,000 lines of duplicate UI code and reduces client bundle size.

#### Phase I Verification:
1. Run ESLint: `npm run lint`.
2. Run full production build: `npm run build`.
3. Verify zero errors or warnings.
4. Git commit: `git commit -am "refactor(cleanup): phase i - security rate limiting and directory consolidation"`

---

## 12. Post-Execution Verification Checklist & Smoke Tests

| # | Workflow to Test | Expected Behavior | Pass / Fail |
|---|---|---|:---:|
| 1 | **Initial Page Load** | Dashboard renders in <500ms; cached stats appear immediately at 0ms. | [ ] |
| 2 | **Normal Browser Refresh (F5)** | Cached data restored from IndexedDB without full-page whiteout or layout shift. | [ ] |
| 3 | **Subplate Row Expansion** | Expanding project row renders subplates instantly from cache; no stuck spinner. | [ ] |
| 4 | **Subplate Creation** | Submitting new subplate succeeds against `scan` table without 500 error. | [ ] |
| 5 | **Subplate Stage Change** | Updating stage updates badge color instantly; propagates to other tab within 2s. | [ ] |
| 6 | **Challan Creation** | Creating challan batches location updates in 1 database query. | [ ] |
| 7 | **Navigation Latency** | Switching between Subplate, Inward, Purchase, Work takes <100ms. | [ ] |
| 8 | **Network Payload Sizes** | `/api/challan`, `/api/dispatch`, `/api/inward` payloads measure <150KB. | [ ] |
| 9 | **Session Logout & Isolation** | Topbar logout purges cached data; switching users displays no cross-user data. | [ ] |
| 10 | **Production Build** | `npm run build` succeeds cleanly with zero Turbopack or TypeScript errors. | [ ] |

---

## 13. Emergency Rollback Playbook

1. **Phase-Level Git Revert**:
   Because every phase is committed individually, revert any problematic phase without affecting others:
   ```bash
   git revert HEAD --no-edit
   ```
2. **Instant Browser Cache Invalidation**:
   If a client cache schema change causes deserialization issues in production browsers, increment the cache buster string in `src/components/providers/query-provider.tsx`:
   ```typescript
   buster: "v3.0.1", // Incrementing this automatically flushes old IndexedDB caches on next visit
   ```
3. **Database Index Drop (Zero Downtime)**:
   If any index in Phase F creates write lock contention:
   ```sql
   DROP INDEX CONCURRENTLY IF EXISTS idx_subplate_projectid_active;
   DROP INDEX CONCURRENTLY IF EXISTS idx_scan_worktype_status_active;
   ```

---
*Plan created and verified against codebase state `e4b5a75835c7f67f950049c507e5327a2018f5ee` on 2026-10-17.*
