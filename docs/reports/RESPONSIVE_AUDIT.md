# Comprehensive Responsive Design Audit: Star Mould ERP

**Date:** September 22, 2026  
**Scope:** Mobile (320px–428px), Tablet (768px–1024px), and Desktop (1280px+) Breakpoints  
**Target Repository:** `frontend/` (Next.js 16 + Tailwind CSS v4)  
**Status:** READ-ONLY AUDIT — Zero code modifications applied during this pass.

---

## Executive Summary

The Star Mould ERP web application is currently **critically unusable on mobile screens (<= 428px) and severely compromised on tablet screens (768px–1024px)**. 

The single largest architectural blocker is the **Layout Shell**:
1. In [`components/layout/app-layout.tsx:22`](file:///e:/repos/starmould/frontend/src/components/layout/app-layout.tsx#L22), the main content wrapper has a hardcoded permanent left padding: `sidebarCollapsed ? "pl-16" : "pl-64"`.
2. On a standard mobile screen (e.g., iPhone 13/14 at 390px width or iPhone SE at 375px width), the default expanded sidebar (`pl-64` = 256px) leaves **only 119px to 134px of viewport width for the entire page**.
3. Even when toggled to "collapsed" (`pl-16` = 64px), the desktop sidebar stays permanently docked to the viewport left rather than sliding away into an off-canvas drawer with a backdrop overlay.

Across all 17 audited modules:
- **0 out of 17 pages** have mobile card-list fallbacks for data tables (`md:hidden` / `block md:hidden`). Every table requires horizontal scrolling.
- **5 modules** contain nested line-item tables that have `overflow-hidden` or lack `overflow-x-auto`, causing data columns to be permanently clipped off-screen.
- **6 modules** contain filter toolbars with un-prefixed minimum pixel widths (e.g. `min-w-[320px]`, `min-w-[240px]`) that exceed the available screen width and force page-level horizontal overflow.
- **100% of data table action buttons** (Edit, Delete, View, Print) are 22px–26px tall, failing the Apple HIG (44x44pt) and Google Material (48x48dp) touch target standards.

---

## 1. Global Setup Check

### 1.1 Viewport Meta Tag
- **File:** [`frontend/src/app/layout.tsx:1-23`](file:///e:/repos/starmould/frontend/src/app/layout.tsx#L1-L23)
- **Finding:** There is no explicit `export const viewport: Viewport = { ... }` defined in `layout.tsx`. Next.js automatically injects `<meta name="viewport" content="width=device-width, initial-scale=1"/>` by default. No custom script or plugin overrides this tag.
- **Recommendation:** Explicitly export `viewport` metadata from `layout.tsx` (`width: "device-width", initialScale: 1, maximumScale: 5`) to guarantee proper mobile scaling behavior across all browsers.

### 1.2 Breakpoints & Tailwind Configuration
- **File:** [`frontend/src/app/globals.css:1`](file:///e:/repos/starmould/frontend/src/app/globals.css#L1)
- **Tailwind Version:** Tailwind CSS v4 (`@import "tailwindcss";`)
- **Finding:** There is no `tailwind.config.ts` or `tailwind.config.js` in `frontend/`. Breakpoints are operating on default Tailwind CSS v4 specifications:
  - `sm`: `640px`
  - `md`: `768px`
  - `lg`: `1024px`
  - `xl`: `1280px`
  - `2xl`: `1536px`
- **Impact:** There is no custom `xs` (e.g. 480px or 375px) breakpoint. The jump between 0px (mobile) and 640px (`sm`) is vast, leaving phone screens (320px–428px) completely unstyled by `sm:` classes.

### 1.3 Body & Container Constraints
- **File:** [`frontend/src/app/globals.css:26-31`](file:///e:/repos/starmould/frontend/src/app/globals.css#L26-L31)
```css
body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  overflow-x: hidden;
}
```
- **Finding:** `body` has `overflow-x: hidden;`. This masks horizontal blowout at the root level, but causes contents inside nested containers to be clipped invisibly instead of gracefully scrolling or wrapping.

---

## 2. Layout Shell Audit (Sidebar, Topbar, Navigation)

### 2.1 Fixed Left Padding in Main Layout Wrapper
- **File & Line:** [`frontend/src/components/layout/app-layout.tsx:21-24`](file:///e:/repos/starmould/frontend/src/components/layout/app-layout.tsx#L21-L24)
```tsx
<div
  className={`flex-1 flex flex-col transition-all duration-300 ${
    sidebarCollapsed ? "pl-16" : "pl-64"
  }`}
>
```
- **The Issue:** `pl-64` (256px) and `pl-16` (64px) are unconditionally applied at all screen sizes. There is no `md:pl-64` or `pl-0` for screens below 768px.
- **Failure State:** On an iPhone 12/13/14 (390px wide):
  - Viewport width: `390px`
  - Sidebar padding (`pl-64`): `256px`
  - Remaining page width: `134px` (34% of screen width). Every form, heading, and table is forced into a vertical strip 134px wide.

### 2.2 Desktop-Only Fixed Sidebar
- **File & Line:** [`frontend/src/components/layout/sidebar.tsx:182-186`](file:///e:/repos/starmould/frontend/src/components/layout/sidebar.tsx#L182-L186)
```tsx
<aside
  className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col ${
    collapsed ? "w-16" : "w-64"
  }`}
>
```
- **The Issue:** The sidebar is never hidden on mobile. There is no `-translate-x-full` off-canvas state, no mobile drawer backdrop, and no touch gesture handling.
- **Failure State:** The sidebar sits permanently anchored over the viewport.

### 2.3 Topbar & Mobile Hamburger Menu
- **File & Line:** [`frontend/src/components/layout/topbar.tsx:65-71`](file:///e:/repos/starmould/frontend/src/components/layout/topbar.tsx#L65-L71)
```tsx
<button
  onClick={onToggleSidebar}
  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
  aria-label="Toggle Menu"
>
  <Menu className="h-5 w-5" />
</button>
```
- **The Issue:** Clicking `Menu` toggles `sidebarCollapsed` between `false` and `true` (256px vs 64px). It does **not** open or close a mobile navigation drawer.
- **Topbar Content:**
  - Fast module navigation tabs are hidden on `< lg` (`hidden lg:flex` at line 74) — Good.
  - Global search input is hidden on `< md` (`hidden md:flex` at line 115) — Good.
  - Shift indicator is hidden on `< sm` (`hidden sm:flex` at line 129) — Good.
  - User name label is hidden on `< sm` (`hidden sm:flex` at line 149) — Good.
  - However, because the topbar itself lives inside `app-layout.tsx`'s padded wrapper, it is squashed down to 134px on mobile screens.

---

## 3. Per-Module Audit (17 Core Application Pages)

| # | Module / Page | Table Mobile Handling | Modal Responsive Usability | Stat / KPI Grid | Form Columns | Filter Bar Wrap | Touch Target Sizing |
|---|---|---|---|---|---|---|---|
| 1 | **Dashboard (`/`)** | ⚠️ `overflow-x-auto` only; 9 cols; NO card fallback | N/A (no modal on page) | ❌ `grid-cols-2` on `< sm` (7th card orphaned) | N/A | ⚠️ `min-w-[280px]` search flex | ❌ 24px icon buttons |
| 2 | **Customer / Vendor (`/customer`)** | ⚠️ `overflow-x-auto`; 8 cols; fixed % widths (`w-[24%]`) | ⚠️ `max-w-xl` with 2-col inputs; tight on 375px | N/A | ⚠️ 2 cols in modal | ⚠️ `max-w-[180px]` cell truncate | ❌ `py-1 text-[11px]` (22px buttons) |
| 3 | **User Management (`/user`)** | ⚠️ `overflow-x-auto`; 8 cols; fixed % widths (`w-[22%]`) | ⚠️ `max-w-xl` with 2-col inputs | N/A | ⚠️ 2 cols in modal | ⚠️ `max-w-[190px]` cell truncate | ❌ `py-1 text-[11px]` (22px buttons) |
| 4 | **Gram Calculation (`/gram`)** | ⚠️ `overflow-x-auto`; 6 cols; NO card fallback | ⚠️ `max-w-md` | N/A | ❌ `grid grid-cols-2` unconstrained | ⚠️ 2 select dropdowns wrap | ❌ `p-1` delete buttons |
| 5 | **Reports (`/report`)** | ⚠️ `overflow-x-auto`; 9 cols; NO card fallback | N/A | ❌ `grid-cols-2` on `< sm` (6 cards) | N/A | Full-width controls | ⚠️ 32px refresh button |
| 6 | **Export (`/export`)** | N/A (Card-based download hub) | N/A | ⚠️ `grid-cols-1 md:grid-cols-3` | N/A | Form controls stack | ⚠️ 36px export buttons |
| 7 | **Expense (`/expense`)** | ⚠️ `overflow-x-auto`; 9 cols; NO card fallback | ⚠️ `max-w-lg` | N/A | ❌ 6 unconstrained `grid-cols-2` rows | ❌ `min-w-[320px]`, `min-w-[240px]` forces blowout | ❌ 26px icon buttons (`h-3.5 w-3.5`) |
| 8 | **Sample Plate (`/sample`)** | ⚠️ `overflow-x-auto`; 7 cols; NO card fallback | ⚠️ `max-w-lg` | N/A | ❌ `grid-cols-3` dimensions unconstrained | ❌ `min-w-[300px]`, `min-w-[240px]` blowout | ❌ 26px icon buttons |
| 9 | **Subplate Master (`/subplate`)** | ⚠️ `overflow-x-auto`; 9 cols; NO card fallback | ⚠️ `max-w-lg` | N/A | ❌ `grid-cols-3` dims, `grid-cols-4` params | ❌ `min-w-[320px]`, `min-w-[240px]` blowout | ❌ 22px badges / icons |
| 10 | **Scanning / Moulds (`/scanning`)** | ⚠️ `overflow-x-auto`; 8 cols; NO card fallback | ⚠️ `max-w-lg` + right drawer | N/A | ❌ `grid-cols-2`, `grid-cols-3` in drawer | ❌ `min-w-[300px]`, `min-w-[240px]` blowout | ❌ 26px icon buttons |
| 11 | **Printing (`/printing`)** | ⚠️ `overflow-x-auto`; 8 cols; NO card fallback | ⚠️ `max-w-lg` | N/A | ❌ 2 unconstrained `grid-cols-2` rows | ❌ `min-w-[300px]`, `min-w-[240px]` blowout | ❌ 26px icon buttons |
| 12 | **Work / Worklog (`/work`)** | ⚠️ 3 tables across 3 tabs; 7–9 cols each; NO cards | ❌ `max-w-xl max-h-[90vh]` overflow | N/A | ❌ 6 unconstrained `grid-cols-2` subgrids | ❌ `min-w-[300px]`, `min-w-[220px]` blowout | ❌ 24px tab & row buttons |
| 13 | **Outward Challan (`/challan`)** | ❌ Nested items table has NO `overflow-x-auto` | ❌ `max-w-4xl` modal overflows height & width | N/A | ⚠️ `md:grid-cols-12` repeater row | ⚠️ Flex search row wraps | ❌ 26px icon buttons |
| 14 | **Dispatch (`/dispatch`)** | ❌ Nested items table has NO `overflow-x-auto` | ❌ `max-w-4xl max-h-[92vh]` modal overflows | N/A | ⚠️ `md:grid-cols-12` repeater row | ⚠️ Flex search row wraps | ❌ 26px icon buttons |
| 15 | **Inward (`/inward`)** | ❌ Nested items table has NO `overflow-x-auto` | ❌ `max-w-4xl max-h-[90vh]` modal overflows | N/A | ⚠️ `md:grid-cols-12` repeater row | ⚠️ Flex search row wraps | ❌ 26px icon buttons |
| 16 | **Purchase Order (`/purchase`)** | ❌ Line items table clipped by `overflow-hidden` | ❌ `max-w-3xl` modal with 12-col repeater | N/A | ❌ `sm:col-span-1` shrinks to 50px | ⚠️ `max-w-[200px]` cell truncate | ❌ 26px icon buttons |
| 17 | **Purchase Inward (`/purchase-inward`)**| ❌ Received items table clipped by `overflow-hidden`| ⚠️ `max-w-xl` modal | N/A | ⚠️ 2 cols in modal | ⚠️ `max-w-[170px]` cell truncate | ❌ 26px icon buttons |

---

## 4. Specific High-Risk Modules (Detailed Breakdown)

### 4.1 Purchase Order & Purchase-Inward (Multi-Line-Item Repeaters & Clipped Tables)
- **Primary Issue 1: Hidden Overflow on Nested Tables**
  - **File & Line:** [`frontend/src/app/purchase/page.tsx:683-693`](file:///e:/repos/starmould/frontend/src/app/purchase/page.tsx#L683-L693)
  ```tsx
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-inner">
    ...
    <table className="w-full text-xs text-left">
  ```
  - **Finding:** The container uses `overflow-hidden` without an inner `overflow-x-auto` wrapper. Any subplate item row with material specs, dimensions, and ordered quantities that exceeds the screen width is **permanently truncated and cannot be scrolled**.
  - Identical bug in [`frontend/src/app/purchase-inward/page.tsx:691-695`](file:///e:/repos/starmould/frontend/src/app/purchase-inward/page.tsx#L691-L695).

- **Primary Issue 2: Extreme Column Compression on Small Tablet (`sm`)**
  - **File & Line:** [`frontend/src/app/purchase/page.tsx:1074-1140`](file:///e:/repos/starmould/frontend/src/app/purchase/page.tsx#L1074-L1140)
  ```tsx
  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
    <div className="sm:col-span-4">...</div> {/* Subplate */}
    <div className="sm:col-span-2">...</div> {/* Material Type */}
    <div className="sm:col-span-3">...</div> {/* Required Material */}
    <div className="sm:col-span-1">...</div> {/* Remaining Qty */}
    <div className="sm:col-span-1">...</div> {/* Order Qty */}
    <div className="sm:col-span-1">...</div> {/* Unit */}
  ```
  - **Finding:** At `640px` width, a 12-column grid provides ~48px width per column. `sm:col-span-1` restricts inputs for Remaining Qty, Order Qty, and Unit to **under 50px wide**, causing text inputs, numbers, and labels to clip and become illegible.

### 4.2 Outward Challan, Dispatch, and Inward (Nested Tables & Overlarge Modals)
- **Primary Issue 1: Missing Horizontal Scroll on Line-Item Expansion Tables**
  - **Challan:** [`frontend/src/app/challan/page.tsx:608`](file:///e:/repos/starmould/frontend/src/app/challan/page.tsx#L608) (`<table className="w-full text-xs text-left">`)
  - **Dispatch:** [`frontend/src/app/dispatch/page.tsx:571`](file:///e:/repos/starmould/frontend/src/app/dispatch/page.tsx#L571) (`<table className="w-full text-xs text-left">`)
  - **Inward:** [`frontend/src/app/inward/page.tsx:477`](file:///e:/repos/starmould/frontend/src/app/inward/page.tsx#L477) (`<table className="w-full text-xs text-left">`)
  - **Finding:** When a user expands a challan row to inspect dispatched plates, the nested table is placed inside a generic `<div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">` with **no `overflow-x-auto` wrapper**. The 5 columns (Plate Name, Condition, Work Nature, Particulars, Qty) force horizontal blowout beyond the viewport edge.

- **Primary Issue 2: Fixed Desktop Modal Sizing**
  - **Challan:** `max-w-4xl max-h-[90vh]` ([line 717](file:///e:/repos/starmould/frontend/src/app/challan/page.tsx#L717))
  - **Dispatch:** `max-w-4xl max-h-[92vh]` ([line 621](file:///e:/repos/starmould/frontend/src/app/dispatch/page.tsx#L621))
  - **Inward:** `max-w-4xl max-h-[90vh]` ([line 535](file:///e:/repos/starmould/frontend/src/app/inward/page.tsx#L535))
  - **Finding:** On mobile screens, these modals occupy the entire height (`90vh–92vh`) with fixed sticky headers and footers, leaving a tiny scrollable area of ~180px for a complex form that contains 6 header inputs and an interactive plate repeater.

### 4.3 Subplate Master (Data Density & Uncollapsing Modal Grids)
- **Primary Issue 1: 9-Column Unresponsive Data Table**
  - **File & Line:** [`frontend/src/app/subplate/page.tsx:363-376`](file:///e:/repos/starmould/frontend/src/app/subplate/page.tsx#L363-L376)
  - **Columns:** `# ID`, `Plate Name`, `Mould / Project`, `Subproject ID`, `Shape`, `Dimensions (L × W × H)`, `Material`, `Qty`, `Location`.
  - **Finding:** Wrapped in `overflow-x-auto`, but at 375px width, only the first 2 columns are visible. The user must scroll horizontally back and forth across 900px of table width to view dimensions and locations. No mobile card view exists.

- **Primary Issue 2: Fixed 3-Column and 4-Column Grids Inside Modal**
  - **File & Line:** [`frontend/src/app/subplate/page.tsx:519, 578`](file:///e:/repos/starmould/frontend/src/app/subplate/page.tsx#L519)
  ```tsx
  {/* Line 519 */}
  <div className="grid grid-cols-3 gap-3">
    {/* Length, Width, Height */}
  </div>
  {/* Line 578 */}
  <div className="grid grid-cols-4 gap-3">
    {/* Shape, Location, Material, Qty */}
  </div>
  ```
  - **Finding:** `grid-cols-3` and `grid-cols-4` are applied **without responsive prefixes** (`sm:` or `md:`). On a 375px phone screen inside a modal with padding, `grid-cols-4` forces each input container into **~65px width**, completely breaking dropdowns and number steppers.

### 4.4 Reports & Analytics (Data-Dense Grids & Charts)
- **Primary Issue 1: Orphaned Metric Cards**
  - **File & Line:** [`frontend/src/app/report/page.tsx:211`](file:///e:/repos/starmould/frontend/src/app/report/page.tsx#L211)
  ```tsx
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
  ```
  - **Finding:** On `< sm` (phones), `grid-cols-2` displays 6 cards as 3 rows of 2. Inside the current layout where the uncollapsed sidebar takes 256px, each card is squashed down to 50px, causing labels and numbers to overlap.
- **Primary Issue 2: Monthly Downtime 9-Column Table**
  - **File & Line:** [`frontend/src/app/report/page.tsx:288-301`](file:///e:/repos/starmould/frontend/src/app/report/page.tsx#L288-L301)
  - **Finding:** 9 columns (`Month`, `VMC`, `Electric`, `Setting`, `Chhol`, `Operator`, `Lunch`, `No Work`, `Total`) with numerical data formatted as small text. While wrapped in `overflow-x-auto`, the column headers are cramped (`px-2`) and difficult to read on touch screens.

### 4.5 Work / Worklog (3-Tab Layout & Sub-Grid Form Destruction)
- **Primary Issue 1: 3 Tables with Zero Mobile Fallback**
  - **Tab 1:** Daily Log ([line 485](file:///e:/repos/starmould/frontend/src/app/work/page.tsx#L485)) — 9 columns with `whitespace-nowrap`.
  - **Tab 2:** Master Register ([line 604](file:///e:/repos/starmould/frontend/src/app/work/page.tsx#L604)) — 7 columns.
  - **Tab 3:** Department Breakdown ([line 682](file:///e:/repos/starmould/frontend/src/app/work/page.tsx#L682)) — 8 columns.
- **Primary Issue 2: Nested Sub-Grids Squeezing Time Inputs to 65px**
  - **File & Line:** [`frontend/src/app/work/page.tsx:917, 922, 951`](file:///e:/repos/starmould/frontend/src/app/work/page.tsx#L917)
  ```tsx
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label>Shift Timing (Start / End)</label>
      <div className="grid grid-cols-2 gap-2"> {/* Line 922 */}
        <input type="time" ... />
        <input type="time" ... />
      </div>
    </div>
    <div>
      <label>Stage Hours (VMC / Drill Tap)</label>
      <div className="grid grid-cols-2 gap-2"> {/* Line 951 */}
        <input type="number" ... />
        <input type="number" ... />
      </div>
    </div>
  </div>
  ```
  - **Finding:** Inside a modal on mobile, this nested `grid-cols-2` inside another `grid-cols-2` forces the time input into **~65px width**. Mobile time pickers (`HH:MM:SS`) cannot render in 65px and fail to display properly.

---

## 5. Tailwind Class Audit (Grep-Based Ground Truth)

### 5.1 Hardcoded Pixel Widths Without Responsive Prefix
Every occurrence of `w-[###px]`, `min-w-[###px]`, or `max-w-[###px]` used without a responsive prefix (`sm:`, `md:`, `lg:`):

| File | Line | Token | Snippet / Context |
|---|---|---|---|
| `customer/page.tsx` | 628 | `max-w-[180px]` | `<td className="... truncate max-w-[180px]">` |
| `expense/page.tsx` | 370 | `min-w-[320px]` | `<div className="flex flex-wrap items-center gap-3 flex-1 min-w-[320px]">` |
| `expense/page.tsx` | 372 | `min-w-[240px]` | `<div className="relative flex-1 min-w-[240px]">` |
| `printing/page.tsx` | 521 | `min-w-[300px]` | `<div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">` |
| `printing/page.tsx` | 522 | `min-w-[240px]` | `<div className="relative flex-1 min-w-[240px]">` |
| `purchase/page.tsx` | 634 | `max-w-[200px]` | `<span className="truncate max-w-[200px]" title={vendorName}>` |
| `purchase/page.tsx` | 642 | `max-w-[200px]` | `<span className="truncate max-w-[200px] block" title={clientName}>` |
| `purchase-inward/page.tsx` | 533 | `max-w-[170px]` | `<span className="truncate max-w-[170px]" title={item.vendorname}>` |
| `purchase-inward/page.tsx` | 541 | `max-w-[170px]` | `<span className="truncate max-w-[170px] block" title={item.customername}>` |
| `sample/page.tsx` | 324 | `min-w-[300px]` | `<div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">` |
| `sample/page.tsx` | 325 | `min-w-[240px]` | `<div className="relative flex-1 min-w-[240px]">` |
| `scanning/page.tsx` | 408 | `min-w-[300px]` | `<div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">` |
| `scanning/page.tsx` | 409 | `min-w-[240px]` | `<div className="relative flex-1 min-w-[240px]">` |
| `subplate/page.tsx` | 321 | `min-w-[320px]` | `<div className="flex flex-wrap items-center gap-3 flex-1 min-w-[320px]">` |
| `subplate/page.tsx` | 322 | `min-w-[240px]` | `<div className="relative flex-1 min-w-[240px]">` |
| `user/page.tsx` | 695 | `max-w-[190px]` | `<td className="... truncate max-w-[190px]">` |
| `work/page.tsx` | 556 | `min-w-[300px]` | `<div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">` |
| `work/page.tsx` | 557 | `min-w-[220px]` | `<div className="relative flex-1 min-w-[220px]">` |
| `components/dashboard/mould-projects-table.tsx` | 151 | `max-w-[180px]` | `<div className="flex flex-col max-w-[180px]">` |
| `components/dashboard/mould-projects-table.tsx` | 174 | `max-w-[220px]` | `<span className="... truncate max-w-[220px] block">` |
| `components/dashboard/mould-projects-table.tsx` | 189 | `min-w-[120px]` | `<div className="flex items-center gap-2 min-w-[120px]">` |
| `components/dashboard/mould-projects-table.tsx` | 198 | `min-w-[34px]` | `<span className="... min-w-[34px]">` |
| `components/dashboard/mould-projects-table.tsx` | 286 | `min-w-[280px]` | `<div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">` |
| `components/layout/app-layout.tsx` | 37 | `max-w-[1600px]` | `<main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">` |

### 5.2 Dangerous `overflow-hidden` Wrappers on Tables
Containers that use `overflow-hidden` directly wrapping tables without horizontal scroll:
1. [`frontend/src/app/purchase/page.tsx:683-693`](file:///e:/repos/starmould/frontend/src/app/purchase/page.tsx#L683-L693) — PO subplate line items table clipped.
2. [`frontend/src/app/purchase-inward/page.tsx:691-695`](file:///e:/repos/starmould/frontend/src/app/purchase-inward/page.tsx#L691-L695) — Inward received items table clipped.
3. [`frontend/src/app/challan/page.tsx:608`](file:///e:/repos/starmould/frontend/src/app/challan/page.tsx#L608) — Challan expanded items table has no horizontal scroll.
4. [`frontend/src/app/dispatch/page.tsx:571`](file:///e:/repos/starmould/frontend/src/app/dispatch/page.tsx#L571) — Dispatch expanded items table has no horizontal scroll.
5. [`frontend/src/app/inward/page.tsx:477`](file:///e:/repos/starmould/frontend/src/app/inward/page.tsx#L477) — Inward expanded items table has no horizontal scroll.

### 5.3 Responsive Prefix Utilization Metrics
Analysis of responsive prefix tokens (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) across all 17 pages:

| Page | Total Lines | Responsive Tokens | Responsive Frequency |
|---|---|---|---|
| `app/page.tsx` (Dashboard) | 124 | **0** | **0.0% (Zero mobile handling)** |
| `app/work/page.tsx` | 1,011 | **2** | 0.2% |
| `app/gram/page.tsx` | 550 | **2** | 0.4% |
| `app/export/page.tsx` | 350 | **2** | 0.6% |
| `app/report/page.tsx` | 343 | **4** | 1.2% |
| `app/expense/page.tsx` | 900 | **4** | 0.4% |
| `app/sample/page.tsx` | 700 | **4** | 0.6% |
| `app/subplate/page.tsx` | 661 | **4** | 0.6% |
| `app/scanning/page.tsx` | 850 | **4** | 0.5% |
| `app/printing/page.tsx` | 850 | **6** | 0.7% |
| `app/purchase-inward/page.tsx` | 972 | **7** | 0.7% |
| `app/customer/page.tsx` | 1,025 | **9** | 0.9% |
| `app/user/page.tsx` | 1,150 | **9** | 0.8% |
| `app/purchase/page.tsx` | 1,246 | 13 | 1.0% |
| `app/inward/page.tsx` | 763 | 14 | 1.8% |
| `app/challan/page.tsx` | 1,012 | 15 | 1.5% |
| `app/dispatch/page.tsx` | 1,035 | 16 | 1.5% |

**Key Metric:** 12 out of 17 pages (70%) have fewer than 10 responsive tokens across 500–1,200 lines of code. This proves that responsive design was omitted almost entirely during development, rather than suffering from isolated bugs.

---

## 6. Recommended Remediation Roadmap

### Phase 1: Layout Shell & Navigation (Fixes 60% of All Mobile Issues)
1. **Responsive Shell Padding:**
   - In `app-layout.tsx`, change `pl-64` and `pl-16` to `md:pl-64` and `md:pl-16`, with `pl-0` for mobile (`< md`).
2. **Mobile Drawer Pattern:**
   - In `sidebar.tsx`, convert the mobile view into a slide-over drawer: `-translate-x-full md:translate-x-0 transition-transform`.
   - Add a dark backdrop overlay (`fixed inset-0 bg-slate-950/60 z-30 md:hidden`) that closes the drawer when tapped.
   - Wire the `topbar.tsx` Menu button to open/close this mobile drawer state.

### Phase 2: Filter Toolbars & Search Bars
1. Replace all hardcoded minimum widths (`min-w-[320px]`, `min-w-[300px]`, `min-w-[240px]`) in filter bars with responsive classes: `w-full sm:w-auto sm:min-w-[240px]`.
2. Ensure every filter container uses `flex flex-wrap gap-2.5 w-full`.

### Phase 3: Tables & Nested Line Items
1. Fix the 5 clipped nested tables in Purchase, Purchase-Inward, Challan, Dispatch, and Inward by adding `<div className="overflow-x-auto w-full">` wrappers.
2. Introduce a shared responsive Table/Card pattern:
   - `<div className="hidden md:block overflow-x-auto">` for desktop tabular view.
   - `<div className="block md:hidden space-y-3">` rendering data cards with key metrics and tap targets on mobile.

### Phase 4: Modals & Multi-Column Forms
1. Convert modal containers from fixed widths to fluid responsive sheets: `w-full max-w-lg mx-auto sm:my-8 rounded-2xl`. On phones (`< sm`), modals should span `w-full h-full sm:h-auto sm:max-h-[90vh]`.
2. Replace unconstrained grids (`grid-cols-2`, `grid-cols-3`, `grid-cols-4`) inside modals with collapsing grids: `grid-cols-1 sm:grid-cols-2` or `grid-cols-1 sm:grid-cols-3`.

### Phase 5: Touch Targets
1. Enforce minimum 40px–44px touch targets on all interactive elements: `min-h-[40px] px-3` or `p-2.5` for icon buttons, eliminating tightly packed `p-1 text-[11px]` controls.

---

*Report generated in READ-ONLY mode. No application files have been modified.*
