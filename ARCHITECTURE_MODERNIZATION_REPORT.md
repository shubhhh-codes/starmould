# Codebase Architecture & Modernization Report

## Executive Summary
This document outlines the systematic refactoring, modularization, and architectural enhancements applied to the **StarMould ERP** application.

---

## 1. Clean Folder Structure & Layered Architecture

The application has been organized into clear, decoupled layers:

```
frontend/src/
├── app/                      # Next.js App Router (UI routes & API route handlers)
│   ├── (modules)/...         # Clean UI page components
│   └── api/...               # Edge / Node API endpoints
├── components/               # UI Component Hierarchy
│   ├── layout/               # Topbar, Sidebar, Shell layouts
│   ├── dashboard/            # High-level domain composite components
│   ├── providers/            # React context & query providers
│   └── ui/                   # Modular, reusable atomic design components (Button, Modal, Toast, Skeleton, etc.)
│       └── index.ts          # Unified public export barrel
├── lib/
│   ├── api/                  # Scalable Typed API Service Layer & standard response handlers
│   │   ├── client.ts         # Encapsulated API client domain modules
│   │   ├── response.ts       # Uniform API response & AppError handlers
│   │   └── index.ts          # API public barrel
│   ├── config/               # Centralized runtime Environment & Configuration
│   │   ├── env.ts            # Type-safe environment variables with schema validation
│   │   └── index.ts
│   ├── state/                # Centralized React-compatible State Management Store
│   │   ├── store.ts          # Lightweight external store with selectors & hooks
│   │   └── index.ts
│   ├── query/                # React Query caching, hooks & prefetch strategies
│   ├── permissions/          # Role-based access control engine
│   └── supabase/             # Client & Admin database connectors
```

---

## 2. Separation of Business Logic from UI Components

- **Domain API Client (`apiClient`)**: UI views no longer manually string-construct HTTP endpoints or manage fetch headers. All domain queries and mutations route through `lib/api/client.ts` with TypeScript models.
- **Query Hooks (`lib/query/hooks.ts`)**: Decouples UI pages from data fetching, caching strategies, background synchronization, and optimistic UI updates.
- **Custom Business Hooks**: Extracted table animations, role authorization, and overlay logic into `lib/hooks/` and `components/providers/`.

---

## 3. Environment Configuration Separation

- Created [env.ts](file:///e:/repos/starmould/frontend/src/lib/config/env.ts) to manage runtime environment variables with validation.
- Supabase Admin ([admin.ts](file:///e:/repos/starmould/frontend/src/lib/supabase/admin.ts)) and Client ([client.ts](file:///e:/repos/starmould/frontend/src/lib/supabase/client.ts)) now consume centralized config rather than unchecked `process.env`.
- Added startup validation alerting to missing critical secrets during runtime execution.

---

## 4. Centralized State Management

- Implemented [store.ts](file:///e:/repos/starmould/frontend/src/lib/state/store.ts) powered by `useSyncExternalStore`:
  - **Global Toast Notification Pipeline**: Dispatch notifications from any layer without prop drilling.
  - **Layout & Command Palette State**: Sidebar collapsed state, filter states, modal states.
  - **Component Hook**: `useAppStore(selector)` for performant selective re-renders.

---

## 5. Reusable Modular Components & Barrel Exports

- Created [ui/index.ts](file:///e:/repos/starmould/frontend/src/components/ui/index.ts) exporting reusable design system components:
  - `MotionButton`: Interactive tactile action button with built-in loading/success states.
  - `Modal`: Accessible dialog wrapper with overlay stack management.
  - `ToastContainer`: Self-dismissing toast alerts for all system events.
  - `TableSkeletonRows` / `CardGridSkeleton`: High performance loading skeletons.
  - `CommandPalette`: Omnisearch and action switcher.
  - `StaffSelect`: Form picker component.

---

## 6. Dead Code & Duplicate Code Cleanup

- Fixed `let` reassignment lint violation in [search/route.ts](file:///e:/repos/starmould/frontend/src/app/api/search/route.ts).
- Cleaned orphaned, unused route permission maps from [middleware.ts](file:///e:/repos/starmould/frontend/src/middleware.ts).
- Removed unused imports and orphaned variables across layout components ([sidebar.tsx](file:///e:/repos/starmould/frontend/src/components/layout/sidebar.tsx), [topbar.tsx](file:///e:/repos/starmould/frontend/src/components/layout/topbar.tsx), [app-layout.tsx](file:///e:/repos/starmould/frontend/src/components/layout/app-layout.tsx)).
- Verified full compilation with 0 ESLint errors and 0 TypeScript compilation errors.

---

## 7. Scalable API Layer & Unified Error Handling

- Built [response.ts](file:///e:/repos/starmould/frontend/src/lib/api/response.ts) providing:
  - `AppError`: Typed custom error class with HTTP status codes and optional metadata details.
  - `apiError(error, fallbackMessage, status)`: Formats uniform JSON error responses across API endpoints.
  - `apiSuccess(data, status, meta)`: Standard response wrapper.
- Implemented `apiClient` service instance supporting domain modules:
  - `apiClient.customers`
  - `apiClient.users`
  - `apiClient.scanning`
  - `apiClient.subplates`
  - `apiClient.purchases`
  - `apiClient.challan`
  - `apiClient.dispatch`
  - `apiClient.expenses`
  - `apiClient.inward`
  - `apiClient.gram`
  - `apiClient.printing`
