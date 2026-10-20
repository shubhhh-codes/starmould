
# Project Code Architecture & Manual QA Testing Guide

**Feature:** Dynamic Tentative Project ID Preview & Concurrency-Safe Generation  
**Target Component:** `NewMouldModal` (`src/components/mould/new-mould-modal.tsx`)  
**Backend:** PostgreSQL RPCs (`get_next_project_code_preview`, `create_project_with_code`) + Next.js App Router API Routes  
**Date:** October 20, 2026  

---

## 1. Summary of Changes

### A. Database Layer (Supabase PostgreSQL)
* **Migration Applied:** [`supabase/migrations/20261020114500_project_code_rpc.sql`](file:///e:/repos/starmould/supabase/migrations/20261020114500_project_code_rpc.sql)
* **Unique Constraint:** `idx_scan_projectid_unique` enforces absolute uniqueness on `public.scan(projectid)`. (0 duplicates verified across 1,463 records).
* **Functional Expression Indexes:**
  - `idx_scan_projectid_global_num`: Indexes leading numbers `substring(projectid from '^([0-9]+)')::integer` for `< 2ms` max calculation.
  - `idx_scan_projectid_cust_num`: Indexes `(cname, substring(projectid from '_([0-9]+)$')::integer)` for instant customer sequence resolution.
* **Database RPCs:**
  - `public.get_next_project_code_preview(p_customer_id)`: STABLE function returning tentative code.
  - `public.create_project_with_code(...)`: VOLATILE function protected by `pg_advisory_xact_lock(hashtext('project_code_generation'))` that computes code and inserts atomically inside the same transaction.

### B. Backend API Layer
* **[`src/app/api/scanning/preview-id/route.ts`](file:///e:/repos/starmould/src/app/api/scanning/preview-id/route.ts):**
  - Dedicated preview route with `export const dynamic = 'force-dynamic'`.
  - Disables caching with `Cache-Control: no-store`.
  - Invokes `get_next_project_code_preview` directly.
* **[`src/app/api/scanning/route.ts`](file:///e:/repos/starmould/src/app/api/scanning/route.ts):**
  - **POST:** Replaced legacy Node.js ID generation with atomic call to `create_project_with_code`. Invalidates cache tags immediately.
  - **DELETE:** Added subplate dependency protection. If child records exist in `subplate` or `worklog`, deletion is rejected (HTTP 400). If 0 child records exist, it executes a hard delete to release the tail number for reuse.

### C. Frontend UI & State Layer
* **[`src/components/mould/new-mould-modal.tsx`](file:///e:/repos/starmould/src/components/mould/new-mould-modal.tsx):**
  - Replaced static text `"Project ID will be auto-generated upon submission"` with **`Next ID (tentative):`**.
  - Added non-editable pill badge (`aria-readonly="true"`, `role="status"`).
  - Displays `1466_ select customer` initially, transitioning immediately to `1466_MPPLT_009` once a customer is picked.
  - Added 1-click **Copy to Clipboard** icon button with checkmark feedback.
  - Shows success toast upon creation displaying the final confirmed Project ID.
* **[`src/lib/query/keys.ts`](file:///e:/repos/starmould/src/lib/query/keys.ts) & [`src/lib/query/hooks.ts`](file:///e:/repos/starmould/src/lib/query/hooks.ts):**
  - Partitioned preview cache by `customerId`.

---

## 2. Step-by-Step Manual QA Test Cases

> **Prerequisite:** Next.js dev server is running on `http://localhost:3000`.

```
Dashboard / Scanning Page -> Click "+ Mould" -> New Mould Modal
```

---

### Test Case 1: Initial Modal State & Tentative Label
| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 1.1 | Navigate to `http://localhost:3000/scanning` (or the home dashboard). | Page loads and shows Mould project table. |
| 1.2 | Click the **"+ Mould"** button to open the modal. | Modal opens smoothly. |
| 1.3 | Check the bottom-left corner of the modal footer. | You see the label **`Next ID (tentative):`**. |
| 1.4 | Inspect the badge next to the label. | Amber badge is shown: `1466_ select customer`. |
| 1.5 | Click or double-click the badge text. | Badge is strictly non-editable (cannot be edited or focused as an input). |

---

### Test Case 2: Customer Selection & Live Preview Calculation
| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 2.1 | Click the **Customer Name** searchable dropdown. | Dropdown list opens with customer search. |
| 2.2 | Search and select **Modern Pulp** (or any customer with initials `MPPLT`). | Dropdown selects the customer. |
| 2.3 | Observe the Project ID badge in the footer. | Badge immediately changes to a green pill with a pulsing dot showing: **`1466_MPPLT_009`**. |
| 2.4 | Check next to the badge. | A small label `(Tentative)` appears. |

---

### Test Case 3: 1-Click Copy to Clipboard
| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 3.1 | Hover over the small **Copy** icon inside the green badge. | Tooltip shows `"Copy tentative ID"`. |
| 3.2 | Click the Copy icon. | The icon switches to a green checkmark (`✓`) for 2 seconds. |
| 3.3 | Open Notepad, browser address bar, or text box and press `Ctrl+V`. | It pastes the exact code: `1466_MPPLT_009`. |

---

### Test Case 4: Customer Switching (Dynamic Recalculation)
| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 4.1 | Change the customer dropdown to another client (e.g. `VISH` or `SHYMP`). | The badge updates within milliseconds without page refresh. |
| 4.2 | Observe the new code. | Code updates to `1466_[NEW_INITIALS]_[NEW_COUNT]`. |
| 4.3 | Switch back to **Modern Pulp**. | Code returns to `1466_MPPLT_009`. |

---

### Test Case 5: Project Creation & Assigned Code Toast
| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 5.1 | Select Work Type (e.g. `Pulp Mould`). | Work type button is highlighted. |
| 5.2 | Enter Part Description: `Manual QA Test Mould 1`. | Form input accepts description. |
| 5.3 | Click **"Create Mould Project"**. | Submit button enters loading state (`"Creating Project..."`). |
| 5.4 | Observe modal and top right notifications. | 1. Modal closes.<br>2. Green toast appears: `Project 1466_MPPLT_009 created successfully!`.<br>3. Table refreshes and project `1466_MPPLT_009` appears at the top. |

---

### Test Case 6: Automatic Sequence Advancement
| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 6.1 | Click **"+ Mould"** again immediately. | Modal opens. |
| 6.2 | Notice the initial badge. | Sequence has incremented: `1467_ select customer`. |
| 6.3 | Select **Modern Pulp** (`MPPLT`) again. | Tentative ID computes to **`1467_MPPLT_010`**. |
| 6.4 | Click **Cancel** to close modal without submitting. | Modal closes cleanly. |

---

### Test Case 7: High-Water Mark Tail Deletion (Sequence Reuse)
| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 7.1 | In the table, find the project you created in Test 5 (`1466_MPPLT_009`). | Project row is located (has 0 subplates). |
| 7.2 | Delete this project row. | Project is deleted. |
| 7.3 | Click **"+ Mould"** again and select **Modern Pulp**. | High-water mark has dropped back: the tentative ID returns to **`1466_MPPLT_009`**! |

---

### Test Case 8: Child Subplate Deletion Protection
| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 8.1 | Locate an existing older project in the table that has child subplates registered. | Project row selected. |
| 8.2 | Attempt to delete that project. | Deletion is blocked with an error dialog or toast: *"Cannot delete project: Child subplates/mould components are registered to this project code. Complete or archive instead."* |
| 8.3 | Verify project status. | Project remains intact in the table. |

---

## 3. Business Logic Reference

$$\text{Project ID} = [\text{Global Max} + 1]_{4\text{ digits}} \ \text{\_} \ [\text{Customer Initials}] \ \text{\_} \ [\text{Customer Job Max} + 1]_{3\text{ digits}}$$

* **Global Number Drift Protection:** Extracted directly from `substring(projectid from '^([0-9]+)')::int`, never relying on Postgres `SERIAL id` (which has drifted due to legacy rows).
* **High-Water Mark Policy:** Deleting the latest project frees the sequence. Deleting a historical middle project does NOT backfill, protecting stamped steel plates from duplicate IDs.
* **Concurrency Protection:** Two admins submitting simultaneously will never clash; `pg_advisory_xact_lock` serializes the transaction and gives each project the exact next sequential ID.
