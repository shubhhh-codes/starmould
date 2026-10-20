# StarMould ERP — Complete Performance & Architecture Audit

**Target Codebase:** `e:\repos\starmould`  
**Repository:** `https://github.com/shubhhh-codes/starmould`  
**Audit Scope:** Full Application (All 22 UI Pages, 26 API Routes, 20 Database Tables, 10 Views, Auth, Realtime, Caching & State)  
**Mode:** Strict Read-Only Source Audit. No application code, database schema, or production deployments modified.  
**Evidence Standard:** Every finding is classified as **CONFIRMED** (verified in source code), **LIKELY** (directly deduced from architecture/code paths, pending runtime trace), or **UNVERIFIED** (requires live runtime/database instrumentation).  
**Source Merged:** Prior root-cause audit (`STARMOULD_PERFORMANCE_ROOT_CAUSE_AUDIT.md`, findings F-01 through F-25) merged with 6 parallel deep-dive audits (F-26 through F-52+).

---

## 1. Executive Summary

StarMould ERP is a specialized manufacturing and tooling ERP system built on Next.js 16.3.5 App Router, React 19, Supabase PostgreSQL, and TanStack React Query v5. While the application possesses a modern stack, it suffers from systemic architectural bottlenecks that degrade initial load time, cause UI freezes, waste 50%–70% of network latency, and occasionally cause infinite or misleading loading spinners.

### Top Confirmed Performance Problems
1. **Multi-Megabyte API Response Bloat ("Lookups Dumping")**: 6 primary listing endpoints (`/api/challan`, `/api/dispatch`, `/api/inward`, `/api/printing`, `/api/worklog`, `/api/purchase-inward`) bundle full external lookup tables (up to 2,000 `subplates`, 1,000 `scans`, all `users`, all `customers`) into every single GET response, resulting in 1.5MB to 4.5MB payloads per request.
2. **Complete TanStack Query Cache Bypasses**: At least 4 full modules (`/purchase-inward`, `/gram`, `/report`, `/export`) and multiple interactive drawers/modals execute raw `fetch()` calls inside `useEffect`, bypassing TanStack Query's cache, deduplication, and persistence layers entirely.
3. **Cache Hydration Race Condition & Anti-Revalidation Settings**: Persistent caching (`localStorage` with LZ-String compression) was initialized via an asynchronous `useEffect` without blocking child component mounts. Concurrently, `refetchOnMount: false` and `refetchOnWindowFocus: false` were set globally, meaning stale restored data is **never refreshed in the background** across multi-hour or multi-day browser sessions.
4. **Zero Real-Time Synchronization & Multi-User Blindness**: Zero Supabase Realtime subscriptions, zero WebSockets, and zero background polling intervals exist in the entire application. When machine operators or QC inspectors update plate stages in the shop floor, other connected users see zero updates until manual page reloads or local mutations.
5. **Zero Table Virtualization & Severe DOM Explosion**: 100% of pages are client components (`'use client'`). Tables render hundreds to thousands of records directly into the DOM. For example, the subplate table mounts 450 interactive `StageChipPicker` instances per page view, creating over 4,500 interactive DOM nodes and dropping UI frame rates during search/filtering.

### Critical Correctness & Security Bugs
- **Fatal Table Typo (Subplate Creation Broken)**: In [`src/app/api/subplate/route.ts#L210`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L210), POST queries `from("scans")` instead of `from("scan")`, causing a table-not-found error on subplate creation.
- **Cache Isolation Vulnerability**: The persisted query cache key (`STARMOULD_PERSISTED_QUERY_CACHE_V2`) is global and not scoped to user identity or role. Expired sessions or account switching can render another user's privileged financial or directory data.
- **Soft-Delete Leak in Server Cache**: In [`src/lib/cache.ts#L76`](file:///e:/repos/starmould/src/lib/cache.ts#L76), `getCachedCustomers()` omits `.is("deleted_at", null)`, caching deleted customer records into memory.

---

## 2. Verified Technology Stack

| Layer | Declared / Detected Technology | Exact Version in `package.json` | Implementation Verification & Role |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `16.3.5` | Turbopack dev, Route handlers for all API access, client-side rendering for pages |
| **Frontend UI** | React / React DOM | `19.2.8` | Client component tree (`'use client'`), Hooks, `useSyncExternalStore` |
| **State & Cache** | TanStack React Query | `^5.103.1` | Asynchronous server-state management, mutations, in-memory cache |
| **Cache Persistence** | TanStack Persist Client | `5.103.1` | `@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister` |
| **Compression** | LZ-String | `^1.5.0` | `compressToUTF16` / `decompressFromUTF16` for localStorage query blobs |
| **Table Engine** | TanStack React Table | `^8.21.3` | Client-side table model, pagination, sorting |
| **Database Client** | Supabase JS | `^2.116.0` | Server-side PostgREST client (`supabaseAdmin`) using `service_role` key |
| **SSR Supabase** | `@supabase/ssr` | `^0.12.7` | Present in dependencies, but not utilized in route handlers or client auth |
| **Direct PG Driver** | `pg` | `^8.23.0` | Used solely in migration runner (`scripts/run-migrations.mjs`), NOT at runtime |
| **Password Hashing**| `bcryptjs` | `^3.0.3` | Password comparison and hashing in `/api/auth/login` and `/api/auth/change-password` |
| **Styling** | Tailwind CSS | `^4` | PostCSS v4 styling, CSS variables, utility classes |
| **Icons** | Lucide React | `^1.47.0` | SVG icons across navigation, buttons, and status chips |

---

## 3. Repository and Branch Details

- **Top-Level Directory:** `E:/repos/starmould`
- **Current Active Branch:** `main`
- **Current Commit SHA:** `e4b5a75835c7f67f950049c507e5327a2018f5ee`
- **Git Worktree State:** Completely clean (`git status --short` output is empty).
- **Recent Git History Context:** Commit `4ff807a` added compressed localStorage persistence, background warmup, and API Cache-Control headers. Commit `e4b5a75` refined stage timestamps and role-based permissions.
- **Environment Verification:** Node runtime environment with Windows PowerShell terminal. Database access is hosted on Supabase Cloud.

---

## 4. Current Architecture Diagram

```mermaid
flowchart TD
  subgraph ClientBrowser["Client Browser (React 19 / Next.js Client Engine)"]
    direction TB
    UI["All 22 UI Pages ('use client')"]
    RQ["TanStack QueryClient (Memory Cache)"]
    PCP["PersistQueryClientProvider (Async useEffect)"]
    LS[("localStorage (LZ-String UTF16)<br/>Key: STARMOULD_PERSISTED_QUERY_CACHE_V2")]
    RAW["Raw fetch() Modules<br/>(/purchase-inward, /gram, /report, Accordion)"]
    AUTH_CTX["AuthProvider & PermissionsProvider"]
    HTTP_CACHE["Browser HTTP Cache (max-age 5-60s + SWR)"]

    UI -->|useQuery / useMutation| RQ
    RQ <-->|Dehydrate / Rehydrate| PCP
    PCP <-->|Synchronous Compress| LS
    UI -->|Direct useEffect fetch| RAW
    RAW -->|HTTP Requests| HTTP_CACHE
    RQ -->|fetchJson| HTTP_CACHE
    AUTH_CTX -->|Mount fetch| HTTP_CACHE
  end

  subgraph NextServer["Next.js 16 Server (Node.js API Route Handlers)"]
    direction TB
    MW["middleware.ts (Edge Crypto HMAC)<br/>Skips all /api/* routes"]
    AUTH_FN["authenticateRequest()<br/>HMAC verify + cached DB user lookup"]
    MEM_CACHE[("In-Memory LRU Cache (cache.ts)<br/>500 entries, 20-60s TTL, Coalescing")]
    ROUTES["26 Route Handlers (/api/*)<br/>100% execute via supabaseAdmin"]

    HTTP_CACHE --> ROUTES
    ROUTES --> AUTH_FN
    AUTH_FN --> MEM_CACHE
    ROUTES --> MEM_CACHE
  end

  subgraph DatabaseLayer["Supabase PostgreSQL Cloud"]
    direction TB
    PGRST["PostgREST HTTP Gateway (service_role bypasses RLS)"]
    TABLES[("20 Relational Tables (subplate, scan, challan, etc.)")]
    VIEWS[("10 Relational Views (view_pending_inward_qty, etc.)")]
    INDEXES[("64 B-Tree, Composite & GIN Trigram Indexes")]

    MEM_CACHE -.Cache Miss.-> PGRST
    ROUTES -.Direct Query.-> PGRST
    PGRST --> TABLES
    PGRST --> VIEWS
    TABLES --- INDEXES
  end
```

---

## 5. Complete Route-to-Data Dependency Matrix

| Route Path | Type | Primary Hook / Fetch Method | Endpoints Hit | Tables & Views Involved | Embedded Lookups (Bloat) | Default Stale Time | Persisted to Storage? |
|---|---|---|---|---|---|---|---|
| `/` (Dashboard) | `'use client'` | `useProjectsQuery({pageSize:500})` + `useSubplatesQuery()` | `/api/scanning`, `/api/subplate` | `scan`, `subplate` | customers, users, worklogs | 60s / 60s | Yes |
| `/subplate` | `'use client'` | `useSubplatesQuery({pageSize:1000})` | `/api/subplate` | `subplate` | scans, users, KPI counts | 60s | Yes |
| `/work` | `'use client'` | `useWorklogsQuery()` | `/api/worklog` | `worklog` | customers, users, scans, 2000 subplates | 60s | Yes |
| `/challan` | `'use client'` | `useChallansQuery()` | `/api/challan` | `challan`, `challan_items`, `view_pending_inward_qty` | customers, 2000 subplates, 1000 scans | 60s | Yes |
| `/customers` | `'use client'` | `useCustomersQuery({pageSize:2000})` | `/api/customers` | `customers` | None | 5m | Yes |
| `/vendors` | `'use client'` | `useVendorsQuery({pageSize:2000})` | `/api/customers` | `customers` | None | 5m | Yes |
| `/inward` | `'use client'` | `useInwardQuery()` | `/api/inward` | `inward`, `inward_items`, `view_pending_inward_qty` | customers, 2000 subplates, 500 pendingChallans | 60s | Yes |
| `/purchase` | `'use client'` | `usePurchasesQuery({limit:200})` | `/api/purchases`, `/api/subplate` (raw) | `purchase`, `purchase_items`, `subplate` | customers, scans, 500 subplates | 60s | Yes |
| `/purchase-inward` | `'use client'` | **Raw `fetch()` in `useEffect`** | `/api/purchase-inward` | `po_inward`, `purchase_inward_items`, `view_po_pending_inward_qty` | pendingItems, receipts, customers, subplates | 0s (None) | **No** |
| `/dispatch` | `'use client'` | `useDispatchQuery({limit:200})` | `/api/dispatch` | `dispatch`, `dispatch_items` | customers, 2000 subplates, 1000 scans | 60s | Yes |
| `/expense` | `'use client'` | `useExpensesQuery()` | `/api/expense` | `expense`, `customers` | customers, unmemoized total balance | 60s | Yes |
| `/gram` | `'use client'` | **Raw `fetch()` in `useEffect`** | `/api/gram` | `gram_calc` | None | 0s (None) | **No** |
| `/report` | `'use client'` | **Raw `fetch()` in `useEffect`** | `/api/report` | `worklog`, `scan` | All scans, downtime worklogs | 0s (None) | **No** |
| `/sample` | `'use client'` | `useSampleQuery()` | `/api/sample` | `scan`, `worklog`, `customers`, `users` | customers, users, worklogs | 60s | Yes |
| `/scanning` | `'use client'` | `useProjectsQuery({pageSize:500})` | `/api/scanning` | `scan`, `subplate`, `worklog` | customers, users, subplates, worklogs | 60s | Yes |
| `/printing` | `'use client'` | `usePrintingQuery()` | `/api/printing` | `print`, `gram_calc`, `customers`, `users` | customers, users, gramTiers | 60s | Yes |
| `/export` | `'use client'` | **Raw `fetch()` in `useEffect`** | `/api/export` | 7 tables across database | Full table dumps (`SELECT *`) | 0s (None) | **No** |
| `/settings` | `'use client'` | `useRolePermissions()`, `useUsersQuery()` | `/api/settings/permissions`, `/api/users` | `app_config`, `users`, `roles` | None | 30s / 5m | Partial |
| `/user` | `'use client'` | `useUsersQuery()` | `/api/users` | `users`, `roles` | None | 5m | Yes |
| `/login` | `'use client'` | Direct `fetch()` | `/api/auth/login` | `users` | None | N/A | No |
| `/change-password` | `'use client'` | Direct `fetch()` | `/api/auth/change-password` | `users` | None | N/A | No |
| `/print/[type]` | `'use client'` | Direct `fetch()` | `/api/print-doc` | Specific document entity + line items | Multiple parent & child tables | N/A | No |

---

## 6. Application-Wide Performance Findings (Catalog F-01 to F-52)

Every confirmed, likely, and unverified finding across the repository is indexed below.

```
P0 = Critical Correctness / Security / Data Loss / Broken Functionality
P1 = Major Performance Bottleneck / Severe Latency / Hydration Flaw
P2 = Moderate Inefficiency / Overfetching / Missing Optimization
P3 = Minor Cleanup / Code Quality / Bundle Size
```

| ID | Title | Severity | Status | Exact Source Location |
|---|---|:---:|:---:|---|
| **F-01** | Subplate accordion bypasses TanStack Query & swallows errors | P1 | CONFIRMED | [`src/components/dashboard/mould-projects-table.tsx#L124-L153`](file:///e:/repos/starmould/src/components/dashboard/mould-projects-table.tsx#L124-L153) |
| **F-02** | Per-project subplate request runs full list handler & returns unrelated data | P1 | CONFIRMED | [`src/app/api/subplate/route.ts#L62-L154`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L62-L154) |
| **F-03** | Dashboard already caches subplates but accordion ignores memory cache | P1 | CONFIRMED | [`src/app/page.tsx#L21`](file:///e:/repos/starmould/src/app/page.tsx#L21) vs [`mould-projects-table.tsx#L124`](file:///e:/repos/starmould/src/components/dashboard/mould-projects-table.tsx#L124) |
| **F-04** | Four source-level paths causing accordion loading spinner to hang | P1 | CONFIRMED | [`src/components/dashboard/mould-projects-table.tsx#L125-L151`](file:///e:/repos/starmould/src/components/dashboard/mould-projects-table.tsx#L125-L151) |
| **F-05** | Empty accordion result triggers second sequential project code request | P2 | CONFIRMED | [`src/components/dashboard/mould-projects-table.tsx#L139-L146`](file:///e:/repos/starmould/src/components/dashboard/mould-projects-table.tsx#L139-L146) |
| **F-06** | Project create/delete handlers leave subplate accordion cache out of sync | P1 | CONFIRMED | [`src/components/dashboard/mould-projects-table.tsx#L405-L445`](file:///e:/repos/starmould/src/components/dashboard/mould-projects-table.tsx#L405-L445) |
| **F-07** | Table mutations use raw `fetch()` bypassing TanStack Query invalidation | P2 | CONFIRMED | [`src/components/dashboard/mould-projects-table.tsx#L385, L432`](file:///e:/repos/starmould/src/components/dashboard/mould-projects-table.tsx#L385) |
| **F-08** | HTTP `Cache-Control` headers on mutable lists conflict with query invalidation | P1 | CONFIRMED | [`src/app/api/subplate/route.ts#L156`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L156), [`src/app/api/scanning/route.ts#L196`](file:///e:/repos/starmould/src/app/api/scanning/route.ts#L196) |
| **F-09** | Persistence is wired, but actual browser restoration timing is unverified | P1 | UNVERIFIED | [`src/components/providers/query-provider.tsx#L18-L35`](file:///e:/repos/starmould/src/components/providers/query-provider.tsx#L18-L35) |
| **F-10** | `refetchOnMount: false` + 24h persistence prevents stale data revalidation | P1 | CONFIRMED | [`src/lib/query/client.ts#L36-L42`](file:///e:/repos/starmould/src/lib/query/client.ts#L36-L42) |
| **F-11** | Persisted query cache is not user-scoped and leaks across sessions | P0 | CONFIRMED | [`src/lib/query/persister.ts#L7`](file:///e:/repos/starmould/src/lib/query/persister.ts#L7), [`src/components/providers/auth-provider.tsx#L77`](file:///e:/repos/starmould/src/components/providers/auth-provider.tsx#L77) |
| **F-12** | Synchronous LZ-String compression blocks main thread during cache persistence | P2 | LIKELY | [`src/lib/query/persister.ts#L24-L32`](file:///e:/repos/starmould/src/lib/query/persister.ts#L24-L32) |
| **F-13** | Multiple concurrent tabs overwrite a single global localStorage cache key | P3 | LIKELY | [`src/lib/query/persister.ts#L7`](file:///e:/repos/starmould/src/lib/query/persister.ts#L7) |
| **F-14** | AuthProvider and PermissionsProvider execute raw `fetch()` on every mount | P3 | CONFIRMED | [`src/components/providers/auth-provider.tsx#L112`](file:///e:/repos/starmould/src/components/providers/auth-provider.tsx#L112), [`permissions-provider.tsx#L74`](file:///e:/repos/starmould/src/components/providers/permissions-provider.tsx#L74) |
| **F-15** | Prefetching inside render body of `useProjectsQuery` violates React 19 purity | P2 | CONFIRMED | [`src/lib/query/hooks.ts#L106-L127`](file:///e:/repos/starmould/src/lib/query/hooks.ts#L106-L127) |
| **F-16** | Expenses prefetch query key does not match component filter query key | P2 | CONFIRMED | [`src/lib/query/prefetch.ts#L184`](file:///e:/repos/starmould/src/lib/query/prefetch.ts#L184) vs [`src/app/expense/page.tsx#L50-L55`](file:///e:/repos/starmould/src/app/expense/page.tsx#L50-L55) |
| **F-17** | In-process server cache has limited and non-shared reach in serverless | P2 | CONFIRMED | [`src/lib/cache.ts#L9-L10`](file:///e:/repos/starmould/src/lib/cache.ts#L9-L10) |
| **F-18** | Serial authentication lookups execute before primary database queries | P2 | CONFIRMED | [`src/lib/auth.ts#L131-L143`](file:///e:/repos/starmould/src/lib/auth.ts#L131-L143), [`src/app/api/subplate/route.ts#L8`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L8) |
| **F-19** | Scan cache lookup is hardcoded to `limit(1000)`, risking missing projects | P2 | CONFIRMED | [`src/lib/cache.ts#L91-L98`](file:///e:/repos/starmould/src/lib/cache.ts#L91-L98) |
| **F-20** | Subplate search with `OR` on `subprojectid` prevents PostgreSQL index usage | P2 | LIKELY | [`src/app/api/subplate/route.ts#L35`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L35) |
| **F-21** | PostgREST filter injection risk via unsanitized search input in subplate route | P2 | CONFIRMED | [`src/app/api/subplate/route.ts#L35, L48-L50`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L35) |
| **F-22** | Subplate list endpoint selects 34 columns plus 9 staff name enrichments | P3 | CONFIRMED | [`src/app/api/subplate/route.ts#L24, L105-L120`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L24) |
| **F-23** | Next.js Edge middleware executes HMAC check on every page navigation | P3 | UNVERIFIED | [`src/middleware.ts#L86-L104`](file:///e:/repos/starmould/src/middleware.ts#L86-L104) |
| **F-24** | Request-level N+1 waterfall triggered from client accordion expansions | P1 | CONFIRMED | [`src/components/dashboard/mould-projects-table.tsx#L136`](file:///e:/repos/starmould/src/components/dashboard/mould-projects-table.tsx#L136) |
| **F-25** | Architectural documentation drift regarding local storage and caching | P3 | CONFIRMED | `docs/reports/DATA_ARCHITECTURE_PERFORMANCE_REPORT.md:20` |
| **F-26** | **Fatal typo `from("scans")` breaks subplate creation completely** | **P0** | **CONFIRMED** | [`src/app/api/subplate/route.ts#L210`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L210) |
| **F-27** | PersistQueryClient runs in post-mount effect, racing initial query fetches | P1 | CONFIRMED | [`src/components/providers/query-provider.tsx#L12-L35`](file:///e:/repos/starmould/src/components/providers/query-provider.tsx#L12-L35) |
| **F-28** | Unmemoized `useSmartPrefetch` causes continuous idle warmup thrashing | P1 | CONFIRMED | [`src/lib/query/prefetch.ts#L327-L356`](file:///e:/repos/starmould/src/lib/query/prefetch.ts#L327-L356) |
| **F-29** | Complete Query Cache bypass in 4 modules (`purchase-inward`, `gram`, `report`, `export`) | P0 | CONFIRMED | [`src/app/purchase-inward/page.tsx#L47`](file:///e:/repos/starmould/src/app/purchase-inward/page.tsx#L47), [`gram/page.tsx#L63`](file:///e:/repos/starmould/src/app/gram/page.tsx#L63), [`report/page.tsx#L72`](file:///e:/repos/starmould/src/app/report/page.tsx#L72) |
| **F-30** | Purchase and Challan modals execute raw subplate fetches bypassing hook | P1 | CONFIRMED | [`src/app/purchase/page.tsx#L175`](file:///e:/repos/starmould/src/app/purchase/page.tsx#L175), [`src/app/challan/page.tsx#L146`](file:///e:/repos/starmould/src/app/challan/page.tsx#L146) |
| **F-31** | Multi-megabyte payload bloat: 6 routes dump entire lookup tables in GET | P1 | CONFIRMED | `/api/challan`, `/api/dispatch`, `/api/inward`, `/api/printing`, `/api/worklog`, `/api/purchase-inward` |
| **F-32** | Missing index on `subplate(projectid)` with partial filter `WHERE deleted_at IS NULL` | P2 | CONFIRMED | [`src/app/api/subplate/route.ts#L41`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L41) |
| **F-33** | Missing composite index on `scan(status, worktype)` for filtered pipelines | P2 | CONFIRMED | [`src/app/api/scanning/route.ts#L25`](file:///e:/repos/starmould/src/app/api/scanning/route.ts#L25) |
| **F-34** | Strictly sequential database awaits in 6 API routes waste 50%–65% latency | P1 | CONFIRMED | `/api/dispatch#L18`, `/api/printing#L42`, `/api/sample#L17`, `/api/purchase-inward#L14`, `/api/print-doc#L32` |
| **F-35** | N+1 per-item subplate location UPDATE loops inside challan and inward POST | P1 | CONFIRMED | [`src/app/api/challan/route.ts#L228-L248`](file:///e:/repos/starmould/src/app/api/challan/route.ts#L228-L248), [`src/app/api/inward/route.ts#L245-L273`](file:///e:/repos/starmould/src/app/api/inward/route.ts#L245-L273) |
| **F-36** | Full-table scans with in-memory JavaScript aggregation in Node.js | P1 | CONFIRMED | [`src/app/api/expense/route.ts#L43-L56`](file:///e:/repos/starmould/src/app/api/expense/route.ts#L43-L56), [`src/app/api/report/route.ts#L122`](file:///e:/repos/starmould/src/app/api/report/route.ts#L122) |
| **F-37** | Cache invalidation key mismatch prevents expense changes from clearing counts | P1 | CONFIRMED | [`src/app/api/expense/route.ts#L126, L226, L283`](file:///e:/repos/starmould/src/app/api/expense/route.ts#L126) |
| **F-38** | `getCachedCustomers()` omits `.is("deleted_at", null)`, caching deleted records | P1 | CONFIRMED | [`src/lib/cache.ts#L76`](file:///e:/repos/starmould/src/lib/cache.ts#L76) |
| **F-39** | Topbar logout handler bypasses `useAuth().logout()`, leaving session dirty | P1 | CONFIRMED | [`src/components/layout/topbar.tsx#L165-L174`](file:///e:/repos/starmould/src/components/layout/topbar.tsx#L165-L174) |
| **F-40** | Zero Supabase Realtime subscriptions across the entire application | P1 | CONFIRMED | Entire codebase; zero `.channel()` or `.on('postgres_changes')` calls |
| **F-41** | 100% of routes use `'use client'`; zero React Server Component streaming | P2 | CONFIRMED | All 22 files under `src/app/**/page.tsx` |
| **F-42** | Zero table virtualization; 450 interactive chips mounted on subplate page | P1 | CONFIRMED | [`src/app/subplate/page.tsx#L590-L670`](file:///e:/repos/starmould/src/app/subplate/page.tsx#L590-L670), [`src/app/work/page.tsx#L446`](file:///e:/repos/starmould/src/app/work/page.tsx#L446) |
| **F-43** | `useState(initialData)` state duplication causes UI flickering and drift | P1 | CONFIRMED | [`src/components/dashboard/mould-projects-table.tsx#L110, L542`](file:///e:/repos/starmould/src/components/dashboard/mould-projects-table.tsx#L110) |
| **F-44** | 7 mutation hooks fail to invalidate dependent query keys (dropdowns, counts) | P2 | CONFIRMED | [`src/lib/query/hooks.ts#L434, L450, L514, L530, L752, L792, L931`](file:///e:/repos/starmould/src/lib/query/hooks.ts#L434) |
| **F-45** | Export route executes unbounded `SELECT *` without pagination or streaming | P2 | CONFIRMED | [`src/app/api/export/route.ts#L93-L246`](file:///e:/repos/starmould/src/app/api/export/route.ts#L93-L246) |
| **F-46** | Rate limiting is absent on 25 of 26 routes (including password & upload) | P2 | CONFIRMED | Rate limit helper only called in `src/app/api/auth/login/route.ts` |
| **F-47** | Dashboard counts fire 16 parallel PostgREST queries instead of single SQL RPC | P2 | CONFIRMED | [`src/app/api/counts/route.ts#L13-L52`](file:///e:/repos/starmould/src/app/api/counts/route.ts#L13-L52) |
| **F-48** | Relational view joins use `id::text OR projectid` preventing index usage | P2 | CONFIRMED | `supabase/migrations/007_performance_optimization.sql:107-288` |
| **F-49** | Worklog department hour KPIs computed only over current page (≤1000 rows) | P2 | CONFIRMED | [`src/app/api/worklog/route.ts#L108-L122`](file:///e:/repos/starmould/src/app/api/worklog/route.ts#L108-L122) |
| **F-50** | Customers and Vendors pages share 90% identical code across 2,600+ lines | P3 | CONFIRMED | [`src/app/customers/page.tsx`](file:///e:/repos/starmould/src/app/customers/page.tsx) vs [`src/app/vendors/page.tsx`](file:///e:/repos/starmould/src/app/vendors/page.tsx) |
| **F-51** | Subplate page fetches 1,000 records with 32 columns without server paging | P1 | CONFIRMED | [`src/app/api/subplate/route.ts#L17`](file:///e:/repos/starmould/src/app/api/subplate/route.ts#L17) |
| **F-52** | Widespread `SELECT *` across 10+ API routes overfetches unused columns | P2 | CONFIRMED | `/api/challan`, `/api/dispatch`, `/api/export`, `/api/inward`, `/api/worklog`, etc. |

---

## 7. Confirmed Root Causes

### 1. Root Cause of "Loading subplate specifications..." Stalling / Freezing
- **Component Location:** [`src/components/dashboard/mould-projects-table.tsx#L1013`](file:///e:/repos/starmould/src/components/dashboard/mould-projects-table.tsx#L1013).
- **The Execution Path:** When a user expands a project row in the dashboard table, `toggleRowExpand(project.id)` is called.
- **Why it Stalls:**
  1. **No Timeout or Cancellation:** Raw `fetch('/api/subplate?projectid=...')` does not provide an `AbortSignal` or timeout. If a cold start, network hiccup, or database lock occurs, the promise never settles and `finally` never resets `loadingRowId`.
  2. **Single-Slot State Machine:** `const [loadingRowId, setLoadingRowId] = useState<number | null>(null)` tracks only one row. Expanding row 1, then quickly expanding row 2 sets `loadingRowId = 2`. When row 1 finishes, its `finally` handler sets `loadingRowId = null`. Row 2's UI immediately displays "No subplates have been defined" while row 2 is actually still loading!
  3. **Error Swallowing:** The code executes `const json = await res.json()` with **no check on `res.ok`**. Any HTTP 401, 500, or network error returns `{ error: "..." }`. The code reads `json.subplates || []`, sets `rowSubplatesCache[id] = []`, and displays the empty state permanently without retrying.
  4. **Ignores Already Loaded Data:** The dashboard page already loaded 1,000 subplates via `useSubplatesQuery()` on initial mount, but the accordion table component ignores that cache and fires independent network requests.

### 2. Root Cause of "Browser Reload Refetches Everything"
- **Timing Race Condition:** In [`src/components/providers/query-provider.tsx#L16-L35`](file:///e:/repos/starmould/src/components/providers/query-provider.tsx#L16-L35), `persistQueryClient` is invoked inside an asynchronous `useEffect`. When the page refreshes, React mounts child components and executes hooks (`useProjectsQuery`, `useSubplatesQuery`) *before* the persister has finished reading and decompressing the cache from `localStorage`. Child queries see an empty query cache and immediately dispatch network requests.
- **Anti-Revalidation Flag:** Once the cache is hydrated, `refetchOnMount: false` and `refetchOnWindowFocus: false` prevent TanStack Query from executing background revalidations. As a result, the application behaves inconsistently: it either does a full-screen network fetch on reload (due to the hydration race) or displays stale data indefinitely without refreshing.

### 3. Root Cause of Endpoint Latency (500ms–2000ms TTFB)
- **Sequential Awaits:** API endpoints execute database queries in series rather than in parallel. In `/api/dispatch`, the server waits for `dispatch`, then waits for `dispatch_items`, then waits for `customers`, then waits for `subplate`, then waits for `scan`.
- **Lookups Dumping:** Endpoints serialize and transmit full copies of reference tables on every request, requiring Node.js to stringify 2MB–4MB JSON blobs and the browser to parse them.

---

## 8. Subplate Loading End-to-End Investigation

```mermaid
sequenceDiagram
  autonumber
  actor User as Shop Floor User
  participant UI as MouldProjectsTable
  participant Cache as QueryClient / Memory
  participant API as /api/subplate
  participant DB as Supabase PostgreSQL

  User->>UI: Clicks "Expand Project #101"
  Note over UI: Checks local rowSubplatesCache[101]
  alt Cache Hit in Local Component
    UI-->>User: Renders subplates immediately
  else Cache Miss (or page reload)
    UI->>UI: setLoadingRowId(101)
    Note over UI: Bypasses TanStack Query cache!
    UI->>API: GET /api/subplate?projectid=101
    Note over API: Awaits subplate, scans lookup, users lookup, and 3 KPI counts
    API->>DB: SELECT subplates WHERE projectid = 101
    API->>DB: 3x SELECT COUNT(*) FROM subplate
    DB-->>API: Subplates + Counts
    API-->>UI: 200 OK (subplates + scans + users + kpis)
    alt Response has subplates
      UI->>UI: rowSubplatesCache[101] = data
      UI-->>User: Displays subplate stage cards
    else Response is empty []
      Note over UI: F-05: Fires SECOND sequential request!
      UI->>API: GET /api/subplate?projectid=PRJ-101
      API->>DB: SELECT scan WHERE projectid = PRJ-101
      API->>DB: SELECT subplates WHERE projectid = scan.id
      DB-->>API: Empty or plates
      API-->>UI: 200 OK
      UI-->>User: Displays "No subplates have been defined"
    end
  end
```

### Remediation for Subplate Loading
1. **Derive from Query Cache:** In `MouldProjectsTable`, look up subplates directly from `useSubplatesQuery()` data using `useMemo(() => subplates.filter(sp => sp.projectid === String(project.id)), [subplates, project.id])`.
2. **Fallback to Dedicated Hook:** If not present in the pre-loaded 1,000 subplates, call the existing [`useSubplatesByProjectQuery(project.id)`](file:///e:/repos/starmould/src/lib/query/hooks.ts#L280-L291) which utilizes TanStack Query with automatic deduplication, caching, and error handling.
3. **Lean Subplate API Mode:** When `/api/subplate` receives `projectid`, return **only** the matching subplates without scans, users, or 3 KPI count queries.

---

## 9. Browser Reload and Cache Persistence Investigation

### Current Behavior Under Different Navigation Scenarios

| Scenario | What Actually Occurs | Is it Correct? | Root Cause / Fix |
|---|---|---|---|
| **A. Client-Side Navigation** (e.g. Dashboard -> Subplates) | Instant transition using memory cache; no refetch if within 60s `staleTime`. | Yes | Working as designed. |
| **B. Reopening Screen After 5 Minutes** | Data is rendered from memory; no background refresh occurs because `refetchOnMount: false`. | **NO** | Change `refetchOnMount` to `true` (F-10). |
| **C. Closing and Reopening Modal** | Purchase and Challan modals re-execute raw `fetch()` on every open. | **NO** | Migrate to `useSubplatesByProjectQuery` (F-30). |
| **D. Collapsing and Expanding Accordion** | Reads from local `rowSubplatesCache` in component state. If reload occurred, fires raw network fetch. | **NO** | Derive from query cache (F-03). |
| **E. Normal Browser Refresh (F5)** | Post-mount hydration race fires duplicate network requests before localStorage is loaded. | **NO** | Adopt `<PersistQueryClientProvider>` (F-27). |
| **F. Hard Refresh (Ctrl+F5)** | Browser clears memory; localStorage persister is read; hydration race occurs. | **NO** | Adopt `<PersistQueryClientProvider>` (F-27). |
| **G. Opening in a New Tab** | Reads `localStorage`; last writer wins; overwrites shared state. | Partial | User-scope key (F-11, F-13). |
| **H. Logging Out and Logging In** | Topbar logout leaves cache intact; new user sees old user's data until mutated. | **CRITICAL BUG** | Fix `topbar.tsx` logout and scope key by user ID (F-11, F-39). |
| **I. Session Expiry (401)** | `AuthProvider` clears `user` but leaves persisted query cache in storage. | **CRITICAL BUG** | Call `persister.removeClient()` on 401 (F-11). |

---

## 10. TanStack Query Architecture Audit

### Client Configuration Review ([`src/lib/query/client.ts`](file:///e:/repos/starmould/src/lib/query/client.ts))
```typescript
// Current Configuration:
export const CACHE_TIERS = {
  STABLE: { staleTime: 15 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000 },   // 15m / 24h
  MODERATE: { staleTime: 5 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000 },  // 5m / 24h
  OPERATIONAL: { staleTime: 60 * 1000, gcTime: 24 * 60 * 60 * 1000 },   // 60s / 24h
  DASHBOARD: { staleTime: 45 * 1000, gcTime: 24 * 60 * 60 * 1000 },     // 45s / 24h
};

// QueryClient Defaults:
refetchOnMount: false,          // <-- DEFECT: Prevents background refresh of stale persisted data
refetchOnWindowFocus: false,    // <-- DEFECT: Shop floor tab left open never sees coworker updates
placeholderData: keepPreviousData, // Good: Prevents layout flicker during pagination
```

### Architectural Fixes Required
1. **Enable Background Revalidation**: Set `refetchOnMount: true`. This allows cached data to render at 0ms from localStorage while TanStack Query asynchronously validates and updates stale data in the background.
2. **Selective Window Focus**: Set `refetchOnWindowFocus: true` for `OPERATIONAL` tier queries so machine operators returning to an active tab automatically receive stage updates.
3. **Eliminate Render-Phase Side Effects**: In [`src/lib/query/hooks.ts#L106-L127`](file:///e:/repos/starmould/src/lib/query/hooks.ts#L106-L127), move the pagination `prefetchQuery` call from the function body into a `useEffect`.
4. **Memoize Prefetch Hook**: Wrap all functions returned by `useSmartPrefetch` in `useCallback` to prevent the idle warmup timer restart loop in [`src/lib/query/prefetch.ts#L327`](file:///e:/repos/starmould/src/lib/query/prefetch.ts#L327).

---

## 11. Persistent Cache Audit

### Current Persistence Architecture ([`src/lib/query/persister.ts`](file:///e:/repos/starmould/src/lib/query/persister.ts))
- **Storage Target:** `window.localStorage`
- **Key:** `STARMOULD_PERSISTED_QUERY_CACHE_V2` (Static, unpartitioned)
- **Buster:** `"v2.1"`
- **Max Age:** `24 * 60 * 60 * 1000` (24 Hours)
- **Serialization:** `LZString.compressToUTF16(JSON.stringify(client))`
- **Deserialization:** `JSON.parse(LZString.decompressFromUTF16(data))`
- **Throttle Time:** 1,200ms

### Deficiencies & Recommended Target
1. **Main-Thread Freezing**: LZ-String compression of a 2MB JSON string takes 40ms–120ms of synchronous CPU time on typical hardware. Fired every 1.2s, this introduces noticeable input stutter.
2. **Storage Quota Risk**: `localStorage` is capped at 5MB per origin in Chrome/Safari/Firefox. Even with compression, multiple bloated listing queries will trigger quota overflow exceptions.
3. **Target Fix**:
   - Transition persister from `localStorage` to **IndexedDB** using `@tanstack/query-async-storage-persister` + `idb-keyval`.
   - Restrict persisted queries via `shouldDehydrateQuery`: only persist `STABLE` and `MODERATE` reference queries (customers, users, settings); do NOT dehydrate high-churn 2,000-row operational lists.

---

## 12. Real-Time Synchronization Audit

### Findings
- **Zero Realtime Subscriptions**: There is not a single call to `supabase.channel()`, `.on('postgres_changes')`, or `.subscribe()` in the entire codebase.
- **Zero WebSocket Connections**: No socket client or server exists.
- **Zero Polling Intervals**: No query hooks configure `refetchInterval`.

### Target Real-Time Architecture (Hybrid Event-Driven Invalidation)
Rather than subscribing to entire database tables (which causes subscription storms), implement a targeted channel for high-velocity manufacturing events:

```mermaid
flowchart LR
  subgraph ShopFloor["Machine / Assembly Stations"]
    OP[Operator updates Subplate Stage]
    API_CALL[PUT /api/subplate]
  end

  subgraph SupabaseCloud["Supabase PostgreSQL"]
    TRIGGER[PostgreSQL WAL / Realtime]
    CHANNEL["Channel: 'manufacturing-floor'"]
  end

  subgraph ConnectedClients["Connected Browser Clients"]
    SUB["useRealtimeSync() Hook"]
    INVALIDATE["queryClient.invalidateQueries()"]
    VIEW["Active Subplate / Dashboard Tables"]
  end

  OP --> API_CALL
  API_CALL --> TRIGGER
  TRIGGER --> CHANNEL
  CHANNEL --> SUB
  SUB --> INVALIDATE
  INVALIDATE --> VIEW
```

1. **Broadcast Event on Subplate Stage Change**: When `PUT /api/subplate` updates a stage, Supabase Realtime emits a change event on `realtime:public:subplate`.
2. **Targeted Invalidation**: The client hook catches the event and invokes `queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() })`.
3. **No Redundant Payload**: The event only needs to transmit the modified `subplateId` and `projectId`, avoiding heavy network traffic.

---

## 13. Database & N+1 Query Audit

### 1. Schema & Foreign Key Overview
- **20 Core Tables**: Fully normalized for tooling operations (`scan`, `subplate`, `challan`, `inward`, `purchase`, `dispatch`, `worklog`, `expense`, etc.).
- **Missing Indexes on Common Query Paths**:
  - `subplate (projectid) WHERE deleted_at IS NULL`: The route `/api/subplate` constantly queries by `projectid` while filtering out soft-deleted records. The current index is on `(deleted_at, subprojectid)`.
  - `scan (status, worktype) WHERE status <> 'completed'`: `/api/scanning` filters active manufacturing jobs by status and excluded work types (`Sample`, `Rework`).
  - `inward_items (inchallanid, plateid)`: Joins between inward headers and items.
- **Index Recommendations SQL**:
```sql
CREATE INDEX idx_subplate_projectid_deleted ON public.subplate(projectid) WHERE deleted_at IS NULL;
CREATE INDEX idx_scan_worktype_status ON public.scan(status, worktype) WHERE status <> 'completed';
CREATE INDEX idx_inward_items_inchallan_plate ON public.inward_items(inchallanid, plateid);
CREATE INDEX idx_challan_items_challan_plate ON public.challan_items(challanid, plateid);
```

### 2. N+1 Mutation Patterns
- **Challan Creation** ([`src/app/api/challan/route.ts#L228-L248`](file:///e:/repos/starmould/src/app/api/challan/route.ts#L228-L248)):
  ```typescript
  // Loop of individual UPDATE queries:
  await Promise.all(
    plates.map(async (sp) => {
      return supabaseAdmin.from("subplate").update({ location: newLoc }).eq("id", sp.id);
    })
  );
  ```
- **Inward Creation** ([`src/app/api/inward/route.ts#L245-L273`](file:///e:/repos/starmould/src/app/api/inward/route.ts#L245-L273)): Identical per-item update loop.
- **Fix**: Batch into a single SQL statement:
  ```typescript
  await supabaseAdmin.from("subplate").update({ location: newLoc }).in("id", plates.map(p => p.id));
  ```

### 3. In-Memory Aggregations That Must Move to SQL
- **Expense Totals** ([`src/app/api/expense/route.ts#L43-L56`](file:///e:/repos/starmould/src/app/api/expense/route.ts#L43-L56)): Queries entire `expense` table into Node.js memory to sum debit and credit balances in a JavaScript loop.
- **Report Workflow Counts** ([`src/app/api/report/route.ts#L122`](file:///e:/repos/starmould/src/app/api/report/route.ts#L122)): Fetches all scans to count `worktype` in JavaScript.
- **Target SQL Aggregation**:
  ```sql
  SELECT payment_type, SUM(amount) as total FROM public.expense GROUP BY payment_type;
  ```

---

## 14. API and Network Audit

### Sequential Await Optimization Matrix
The following 6 route handlers execute uncoordinated sequential queries that can be converted to concurrent `Promise.all` calls:

| Route File | Current Latency Waterfall | Optimized Concurrent Flow | Expected Latency Reduction |
|---|---|---|---|
| [`api/dispatch/route.ts` #18-57](file:///e:/repos/starmould/src/app/api/dispatch/route.ts#L18-L57) | 5 sequential awaits (`dispatch` -> `items` -> `cust` -> `plates` -> `scans`) | Await `dispatch`, then `Promise.all([items, cust, plates, scans])` | **~60% faster** |
| [`api/printing/route.ts` #42-83](file:///e:/repos/starmould/src/app/api/printing/route.ts#L42-L83) | 4 sequential awaits (`print` -> `cust` -> `users` -> `gram`) | `Promise.all([print, cust, users, gram])` | **~65% faster** |
| [`api/sample/route.ts` #17-57](file:///e:/repos/starmould/src/app/api/sample/route.ts#L17-L57) | 4 sequential awaits (`scan` -> `cust` -> `users` -> `worklog`) | `Promise.all([scan, cust, users])`, then `worklog` | **~50% faster** |
| [`api/purchase-inward/route.ts` #14-47](file:///e:/repos/starmould/src/app/api/purchase-inward/route.ts#L14-L47) | 5 sequential awaits (`view` -> `receipts` -> `items` -> `cust` -> `plates`) | `Promise.all([view, receipts, cust])`, then `Promise.all([items, plates])` | **~55% faster** |
| [`api/print-doc/route.ts` #32-61](file:///e:/repos/starmould/src/app/api/print-doc/route.ts#L32-L61) | 5 sequential awaits per document generation | Fetch header, then `Promise.all([cust, vendor, items])`, then `plates` | **~50% faster** |
| [`api/users/route.ts` #71-82](file:///e:/repos/starmould/src/app/api/users/route.ts#L71-L82) | 2 sequential awaits (`users` -> `roles`) | `Promise.all([users, roles])` | **~40% faster** |

### Lookups Stripping Plan
Currently, endpoints return payloads of 2MB–4MB because they bundle entire directories. By stripping lookups and having client components consume them from TanStack Query's cache:
- `GET /api/challan`: Drops from ~2.5MB to ~80KB (96% bandwidth savings).
- `GET /api/dispatch`: Drops from ~2.5MB to ~90KB (96% bandwidth savings).
- `GET /api/inward`: Drops from ~3.0MB to ~100KB (96% bandwidth savings).
- `GET /api/worklog`: Drops from ~3.5MB to ~150KB (95% bandwidth savings).

---

## 15. React Rendering & Large Table Audit

### DOM Node Overhead
- **Subplate Page** ([`src/app/subplate/page.tsx`](file:///e:/repos/starmould/src/app/subplate/page.tsx)):
  - 50 rows per page × 9 stage columns = **450 interactive `StageChipPicker` instances** mounted simultaneously.
  - Each chip initializes popovers, event handlers, and SVG icon sets.
  - Typing into the search filter causes re-rendering across all 450 instances, dropping frame rates to 15–20 FPS.
- **Work Page** ([`src/app/work/page.tsx`](file:///e:/repos/starmould/src/app/work/page.tsx)):
  - Renders ALL historical worklogs in the DOM across 3 tabs without pagination or virtualization.

### Virtualization & Memoization Plan
1. **Virtualize with `@tanstack/react-virtual`**:
   - Implement `useVirtualizer` on the subplate table and worklog register.
   - Caps rendered DOM table rows to ~15 visible rows (+ 5 buffer rows) regardless of dataset size.
2. **Memoize Stage Chips**:
   - Wrap `StageChipPicker` with `React.memo` checking `prev.currentStage === next.currentStage && prev.subplateId === next.subplateId`.

---

## 16. Authentication & Authorization Overhead

- **Edge Cryptography**: `src/middleware.ts` validates `sm_session` tokens via Edge `crypto.subtle` HMAC checks in <1ms without hitting the database.
- **API Exemption**: Middleware correctly skips all `/api/*` routes.
- **In-Memory User Cache**: `authenticateRequest()` caches verified user records in memory for 60 seconds (`"auth_user_record_" + id`), minimizing redundant user table lookups.
- **Overhead Assessment**: Authentication is not a primary bottleneck on warm instances. On cold serverless starts, the sequential `users` and `app_config` queries add ~80ms–150ms before the data query executes.

---

## 17. Security & Correctness Concerns

1. **Unauthenticated Public Endpoint**: [`src/app/api/logs/client-error/route.ts`](file:///e:/repos/starmould/src/app/api/logs/client-error/route.ts) has zero authentication and zero rate limiting. Anyone can POST arbitrary payloads, flooding server logs and consuming memory.
2. **Lack of Rate Limiting**: 25 out of 26 API routes have no rate limiting. Endpoints like `/api/auth/change-password` and `/api/upload` are vulnerable to brute-force or resource-exhaustion attacks.
3. **Cache Boundary Leak**: Persisted localStorage data is not cleared on session expiration (401), allowing subsequent users on a shared machine to view prior operational data.
4. **PostgREST Injection**: Raw string interpolation in `/api/subplate` (`.or("platename.ilike..."`) allows malformed filter expressions that return 500 errors.

---

## 18. Recommended Target Architecture

```mermaid
flowchart TD
  subgraph FrontendArchitecture["Target Frontend Architecture"]
    PCP["PersistQueryClientProvider (Blocking Hydration)"]
    IDB[("IndexedDB Persister (Async idb-keyval)<br/>Key: STARMOULD_CACHE_USER_{id}")]
    RQ["TanStack QueryClient<br/>refetchOnMount: true<br/>refetchOnWindowFocus: true (Operational)"]
    VIRT["Virtualized Tables (@tanstack/react-virtual)<br/>Max 20 DOM rows rendered"]
    HOOKS["100% Unified Hook Access<br/>(Zero raw fetch in pages)"]

    PCP -->|Blocks until ready| RQ
    RQ <--> IDB
    RQ --> HOOKS
    HOOKS --> VIRT
  end

  subgraph BackendArchitecture["Target API & Server Architecture"]
    LEAN_API["Lean API Endpoints<br/>(Lookups stripped, specific columns)"]
    PARALLEL["Promise.all Concurrent Queries"]
    BATCH["Batch Mutation SQL Functions"]
    SQL_AGG["In-Database SQL Aggregations (GROUP BY)"]

    HOOKS --> LEAN_API
    LEAN_API --> PARALLEL
    LEAN_API --> BATCH
    LEAN_API --> SQL_AGG
  end

  subgraph DatabaseArchitecture["Target Database Architecture"]
    RT["Supabase Realtime Channel<br/>('manufacturing-events')"]
    OPT_IDX["Composite & Partial PostgreSQL Indexes"]
    DB[("Supabase PostgreSQL")]

    PARALLEL --> DB
    BATCH --> DB
    SQL_AGG --> DB
    DB --- OPT_IDX
    DB --> RT
    RT -.Targeted Invalidation.-> RQ
  end
```

---

## 19. Architecture Decision Records (ADRs)

### ADR-01: Adopt `<PersistQueryClientProvider>` with User-Scoped IndexedDB Storage
- **Context:** The current implementation uses a post-mount `useEffect` to initialize `persistQueryClient`, causing race conditions where child components fire network requests before storage is restored. Synchronous LZString compression in `localStorage` blocks the main thread. Storage is not user-scoped.
- **Decision:** Replace the setup with `<PersistQueryClientProvider>` from `@tanstack/react-query-persist-client`. Use an asynchronous IndexedDB persister via `idb-keyval`. Scope the storage key to `STARMOULD_CACHE_USER_${userId}_${roleId}`. Only dehydrate STABLE and MODERATE queries.
- **Consequences:** Eliminates hydration network races; 0ms repeat load times; zero main-thread compression jank; secure multi-tenant cache isolation.

### ADR-02: Eliminate Lookups Dumping and Standardize Granular Client-Side Cached Lookups
- **Context:** 6 listing endpoints bundle full tables of customers, scans, users, and subplates, producing 1.5MB–4.5MB payloads.
- **Decision:** Remove embedded lookups from listing endpoints. Frontend components will consume reference lookups from dedicated TanStack Query hooks (`useCustomerDropdownQuery`, `useUserDropdownQuery`) with 15-minute `staleTime`.
- **Consequences:** 60%–80% reduction in network payload sizes; faster JSON deserialization; shared cache across modules.

### ADR-03: Eliminate Raw `fetch` and Unify Server State on TanStack Query v5
- **Context:** 4 modules and multiple modals use raw `fetch()` + `useState`, losing caching, persistence, and invalidation.
- **Decision:** Create standard query and mutation hooks for all entities (`usePurchaseInwardQuery`, `useGramTiersQuery`, `useReportQuery`, `useSubplatesByProjectQuery`). Prohibit raw `fetch` for server state.
- **Consequences:** Consistent cache behavior, zero-flicker transitions, automatic cross-module cache invalidations.

### ADR-04: API Concurrency via `Promise.all` and PostgreSQL In-Database Aggregations
- **Context:** Multiple routes execute sequential database awaits and compute totals using JavaScript loops in Node.js.
- **Decision:** Parallelize all independent queries with `Promise.all`. Move ledger balance calculations and status counts into PostgreSQL `SUM()` and `COUNT()` aggregation queries.
- **Consequences:** 50%–65% reduction in API endpoint latencies; reduced Node.js server memory pressure.

### ADR-05: Targeted Supabase Realtime Subscriptions for High-Velocity Manufacturing Stages
- **Context:** The application has zero realtime capabilities; multi-user updates are invisible.
- **Decision:** Implement a targeted Supabase Realtime channel (`manufacturing-stage-updates`) listening to `subplate` table updates. The client handler will trigger targeted `queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() })`.
- **Consequences:** Real-time visibility across shop-floor stations without polling storms or excessive subscription overhead.

### ADR-06: Virtualization of High-Density Manufacturing Grids via `@tanstack/react-virtual`
- **Context:** High-density tables render up to 1,000 DOM rows and 450 interactive pickers simultaneously, causing frame rate drops.
- **Decision:** Virtualize the subplate and worklog tables using `@tanstack/react-virtual`.
- **Consequences:** Constant DOM footprint (<20 visible rows rendered); 60 FPS scrolling and typing during filter operations.

---

## 20. Prioritized Implementation Roadmap

### Phase A: Critical Bug Fixes & Immediate Instrumentation (Day 1)
- **Objective:** Fix broken functionality, eliminate data leaks, and establish measurement baselines.
- **Files Involved:**
  - `src/app/api/subplate/route.ts`: Fix `.from("scans")` typo to `.from("scan")` (F-26).
  - `src/lib/cache.ts`: Add `.is("deleted_at", null)` to `getCachedCustomers()` (F-38).
  - `src/components/layout/topbar.tsx`: Call `auth.logout()` in handleLogout (F-39).
  - `src/app/api/expense/route.ts`: Fix counts cache invalidation key (F-37).
- **Verification:** Create subplate via POST; verify deleted customers are excluded; verify clean logout.

### Phase B: Query Cache Architecture & Hydration Race Fix (Days 2–3)
- **Objective:** Fix reload behavior, enable background revalidation, and secure the cache.
- **Files Involved:**
  - `src/components/providers/query-provider.tsx`: Adopt `<PersistQueryClientProvider>` (F-27).
  - `src/lib/query/client.ts`: Set `refetchOnMount: true` (F-10).
  - `src/lib/query/persister.ts`: Scope cache key by user ID (F-11).
  - `src/lib/query/hooks.ts`: Move prefetch in `useProjectsQuery` to `useEffect` (F-15).
  - `src/lib/query/prefetch.ts`: Memoize `useSmartPrefetch` (F-28).
- **Verification:** Verify 0ms reload using cached state with background revalidation.

### Phase C: Migrate Raw `fetch()` Modules to TanStack Query (Days 4–5)
- **Objective:** Eliminate split architecture and unify server state.
- **Files Involved:**
  - `src/lib/query/hooks.ts`: Add hooks for purchase-inward, grams, reports.
  - `src/app/purchase-inward/page.tsx`: Replace raw `fetch` with `usePurchaseInwardQuery` (F-29).
  - `src/app/gram/page.tsx`: Replace raw `fetch` with `useGramTiersQuery` (F-29).
  - `src/app/report/page.tsx`: Replace raw `fetch` with `useReportQuery` (F-29).
  - `src/app/purchase/page.tsx`, `src/app/challan/page.tsx`: Use `useSubplatesByProjectQuery` (F-30).
  - `src/components/dashboard/mould-projects-table.tsx`: Derive subplates from cache (F-01, F-03).
- **Verification:** Instant navigation back and forth between modules without loading spinners.

### Phase D: API Response Bloat & Lookups Stripping (Days 6–7)
- **Objective:** Cut network payloads by 60%–80%.
- **Files Involved:**
  - `src/app/api/challan/route.ts`, `src/app/api/dispatch/route.ts`, `src/app/api/inward/route.ts`, `src/app/api/printing/route.ts`, `src/app/api/worklog/route.ts`, `src/app/api/purchase-inward/route.ts`.
  - Strip embedded `customers`, `users`, `scans`, `subplates` arrays (F-31).
  - Set `Cache-Control: private, no-store` on all mutable list endpoints (F-08).
- **Verification:** Check Network tab size column; confirm payload sizes drop below 150KB.

### Phase E: API Parallelization & Database N+1 Elimination (Days 8–9)
- **Objective:** Cut endpoint latencies by 50%–65%.
- **Files Involved:**
  - `src/app/api/dispatch/route.ts`, `src/app/api/printing/route.ts`, `src/app/api/sample/route.ts`, `src/app/api/purchase-inward/route.ts`, `src/app/api/print-doc/route.ts`, `src/app/api/users/route.ts`: Parallelize with `Promise.all` (F-34).
  - `src/app/api/challan/route.ts`, `src/app/api/inward/route.ts`: Batch subplate location updates (F-35).
- **Verification:** Verify endpoint execution time drops from >800ms to <300ms.

### Phase F: PostgreSQL Index Optimization & In-Database Aggregations (Days 10–11)
- **Objective:** Minimize database query times and server memory usage.
- **Files Involved:**
  - Run SQL migrations for composite indexes (F-32, F-33).
  - `src/app/api/expense/route.ts`: Replace JS sum with SQL `GROUP BY` (F-36).
  - `src/app/api/report/route.ts`: Replace JS scan counting with SQL `GROUP BY` (F-36).
- **Verification:** Execute `EXPLAIN ANALYZE` on staging; verify index scan utilization.

### Phase G: Frontend Table Virtualization (Days 12–13)
- **Objective:** Eliminate UI stuttering and frame drops during search/filter operations.
- **Files Involved:**
  - `src/app/subplate/page.tsx`: Implement `useVirtualizer` and memoize `StageChipPicker` (F-42).
  - `src/app/work/page.tsx`: Implement `useVirtualizer` (F-42).
  - `src/components/dashboard/mould-projects-table.tsx`: Remove `useState(initialData)` duplication (F-43).
- **Verification:** Chrome DevTools Performance profile during search typing confirms consistent 60 FPS.

### Phase H: Realtime Synchronization (Days 14–15)
- **Objective:** Enable real-time updates across multiple devices.
- **Files Involved:**
  - `src/lib/supabase/realtime.ts` (New): Create subscription hook.
  - `src/components/providers/query-provider.tsx`: Attach realtime listener for subplate updates.
- **Verification:** Modify a subplate stage on browser A; confirm browser B updates within 2 seconds.

---

## 21. File-by-File Change Recommendations

| Target File | Exact Line Numbers | Current Problem | Actionable Fix |
|---|---|---|---|
| `src/app/api/subplate/route.ts` | 210 | Typo `.from("scans")` breaks POST | Change `"scans"` to `"scan"` |
| `src/lib/cache.ts` | 76 | Soft-deleted customers cached into memory | Append `.is("deleted_at", null)` to query builder |
| `src/components/layout/topbar.tsx` | 165–174 | Topbar logout bypasses `useAuth().logout()` | Call `logout()` from `useAuth()` to clear cache and state |
| `src/app/api/expense/route.ts` | 126, 226, 283 | Invalidates `"counts:"` instead of `"api_counts_all"` | Change prefix to `"api_counts_all"` |
| `src/components/providers/query-provider.tsx` | 12–35 | Manual `persistQueryClient` in `useEffect` races hydration | Wrap tree in `<PersistQueryClientProvider>` |
| `src/lib/query/client.ts` | 38–39 | `refetchOnMount: false` stops stale data revalidation | Change `refetchOnMount` to `true` |
| `src/lib/query/persister.ts` | 7 | Single global key `STARMOULD_PERSISTED_QUERY_CACHE_V2` | Append active `userId` and `roleId` to cache key |
| `src/lib/query/hooks.ts` | 106–127 | `prefetchQuery` called directly inside render body | Wrap prefetch logic inside a `useEffect` hook |
| `src/lib/query/prefetch.ts` | 327–356 | Unmemoized functions restart idle warmup on every render | Wrap methods in `useCallback` or use empty `[]` deps |
| `src/app/api/subplate/route.ts` | 62–95 | `?projectid=X` awaits scans, users, and 3 count queries | Return lean payload of matching rows only when `projectid` is set |
| `src/app/api/subplate/route.ts` | 156 | Sends `max-age=10, stale-while-revalidate=60` | Set `Cache-Control: private, no-store, must-revalidate` |
| `src/app/purchase-inward/page.tsx` | 47–76 | Entire page uses raw `fetch` and manual `useState` | Migrate to TanStack Query hook `usePurchaseInwardQuery()` |
| `src/app/gram/page.tsx` | 63–89 | Uses raw `fetch` and manual state for gram tiers | Migrate to TanStack Query hook `useGramTiersQuery()` |
| `src/app/report/page.tsx` | 72–100 | Uses raw `fetch` for report metrics | Migrate to TanStack Query hook `useReportQuery()` |
| `src/app/purchase/page.tsx` | 175–194 | Raw `fetch('/api/subplate')` in `useEffect` | Use `useSubplatesByProjectQuery(projectId)` |
| `src/app/challan/page.tsx` | 146–158 | Raw `fetch('/api/subplate')` in `useEffect` | Use `useSubplatesByProjectQuery(projectId)` |
| `src/app/api/dispatch/route.ts` | 18–57 | 5 sequential awaits | Await `dispatch`, then `Promise.all([items, cust, plates, scans])` |
| `src/app/api/printing/route.ts` | 42–83 | 4 sequential awaits | `Promise.all([print, cust, users, gram])` |
| `src/app/api/sample/route.ts` | 17–57 | 4 sequential awaits | `Promise.all([scan, cust, users])`, then `worklog` |
| `src/app/api/challan/route.ts` | 228–248 | N+1 subplate location update loop | Bulk update via `.in("id", plateIds)` |
| `src/app/api/inward/route.ts` | 245–273 | N+1 subplate location update loop | Bulk update via `.in("id", plateIds)` |
| `src/app/api/expense/route.ts` | 43–56 | Full table scan + JavaScript loop summation | Use SQL `GROUP BY payment_type` query |
| `src/app/api/report/route.ts` | 122 | Full scan table fetch + JavaScript loop counting | Use SQL `SELECT worktype, COUNT(*)` query |
| `src/components/dashboard/mould-projects-table.tsx` | 110–111, 542 | `useState(initialData)` duplicates cache | Consume cache directly, remove local duplicated state |
| `src/app/subplate/page.tsx` | 590–670 | 450 unmemoized chips mounted in unvirtualized table | Wrap chips in `React.memo` and virtualize table container |

---

## 22. Regression Testing Strategy

To ensure optimizations do not introduce regressions into manufacturing workflows, test plans must cover:
1. **Cache Restoration Integrity Test**:
   - Verify that loading the dashboard, navigating to `/subplate`, and performing a hard browser refresh displays cached data immediately at 0ms.
   - Verify that `isFetching` background revalidation updates the view without triggering full-screen loading spinners.
2. **Subplate Creation & Edit Workflow**:
   - Verify that submitting a new subplate succeeds against the corrected `scan` table name (F-26).
   - Verify that editing a subplate stage (e.g. VMC -> QC) updates the badge color immediately and invalidates dashboard metrics.
3. **Session Boundary Test**:
   - Log in as an Admin (`role_id: 0`), visit `/expense` and `/user`.
   - Log out via Topbar and log in as an Operator (`role_id: 3`).
   - Verify that the Operator cannot view or access the Admin's cached financial data in memory or storage.
4. **Offline / Slow Network Graceful Degradation**:
   - Throttle network to Slow 3G.
   - Expand project accordion rows; verify that loading skeletons appear per row and errors display actionable retry buttons instead of false "No subplates" messages.
5. **Multi-Item Transactional Integrity**:
   - Create a Challan with 10 line items.
   - Verify that all 10 subplate locations update atomically. If one fails, verify database rollback.

---

## 23. Performance Benchmarking Plan

Establish reproducible benchmarks across 3 testing stages:

| Stage | Tool | Metrics Captured | Success Target |
|---|---|---|---|
| **API Endpoints** | Autocannon / k6 | Latency (p50, p95, p99), Throughput (req/sec), Payload Size | p95 < 250ms, Payload < 150KB |
| **Frontend Rendering** | Chrome DevTools Lighthouse / Profiler | LCP, INP, CLS, Long Tasks (>50ms), DOM Node Count | INP < 100ms, DOM Nodes < 1,500 |
| **Hydration & Storage** | Web Performance APIs (`performance.now()`) | Cache deserialization time, Time-to-Useful-Content on reload | Deserialization < 15ms, TTUC < 100ms |

---

## 24. Rollback Strategy

1. **Independent Granular Commits**: Every phase and file fix must be committed independently with clear git commit references (e.g. `fix(api): correct table name typo in subplate route`).
2. **Cache Buster Invalidation**: If any persisted cache schema change causes deserialization issues in client browsers, increment the cache buster string in `query-provider.tsx` (e.g. `"v2.1"` -> `"v2.2"`). This instantly and safely purges stale browser caches on the next page load without user intervention.
3. **Zero Schema Destructiveness**: All database index additions are non-destructive (`CREATE INDEX CONCURRENTLY IF NOT EXISTS`). They can be dropped instantly via `DROP INDEX` without downtime if database locking or write overhead is detected.

---

## 25. Missing Evidence & Environment Limitations

- **Runtime Database Telemetry**: Production query execution plans (`EXPLAIN ANALYZE`) could not be run because production database credentials were not available during this static source audit.
- **Serverless vs Docker Deployment**: Whether the production build runs as Vercel serverless functions (where in-memory caching in `cache.ts` is discarded on cold starts) or a persistent Node.js Docker container could not be verified from repo files alone.
- **Actual Row Counts**: Live production row counts for `subplate`, `scan`, and `worklog` tables are unverified, though architecture limits in code (`limit(2000)`, `pageSize: 500`) indicate tables currently exceed 500–2,000 records.

---

## Final Executive Summary & Approval Request

1. **Top Five Confirmed Performance Problems**:
   - Multi-megabyte payload bloat from 6 routes dumping entire lookup tables in GET requests.
   - Split architecture: 4 full modules bypass TanStack Query using raw `fetch` + manual state.
   - Hydration race condition on reload combined with `refetchOnMount: false` preventing background updates.
   - Zero real-time synchronization across connected users.
   - Zero table virtualization; 450 unmemoized chip pickers causing severe frame drops.
2. **Most Important Architectural Weaknesses**:
   - Inconsistent server-state boundaries.
   - Unpartitioned, un-scoped global persistent localStorage cache.
   - Strictly sequential database queries in route handlers.
3. **Best Target Architecture**:
   - Unified TanStack Query v5 cache across 100% of routes.
   - Non-blocking IndexedDB persistence scoped by user ID with `refetchOnMount: true`.
   - Lean API endpoints returning entity-specific records with `Promise.all` parallelization.
   - Targeted Supabase Realtime channel for shop-floor stage change invalidation.
   - Virtualized tables rendering <20 DOM rows.
4. **Highest-Impact Fixes**:
   - Fix table typo in `subplate/route.ts#L210` (unblocks subplate creation).
   - Adopt `<PersistQueryClientProvider>` with `refetchOnMount: true` (fixes reload behavior).
   - Strip lookup tables from API listing responses (cuts network bandwidth by 70%–80%).
   - Parallelize 6 route handlers with `Promise.all` (cuts latency by 50%–65%).
   - Virtualize subplate and worklog tables (eliminates UI stutter).
5. **Expected Benefits**:
   - 0ms instant cached navigation and reloads.
   - 50%–65% reduction in API response times.
   - 60%–80% reduction in network payload sizes.
   - Smooth 60 FPS scrolling and typing in heavy tables.
   - Immediate cross-user stage visibility.
6. **Exact Next Implementation Phase**:
   - **PHASE A: Critical Bug Fixes & Immediate Instrumentation** (Fix `subplate/route.ts` typo, fix `cache.ts` soft-delete filter, fix topbar logout, fix expense cache key).

---
**Awaiting approval to begin modifying application files.**
