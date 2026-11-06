export interface PermissionDependency {
  parentKey: string;
  parentLabel: string;
}

export const PERMISSION_DEPENDENCIES: Record<string, PermissionDependency> = {
  // --- 1. Mould Projects & Pipeline ---
  action_create_scanning_project: { parentKey: "nav_scanning", parentLabel: "Moulds & Scanning Page" },
  action_edit_mould: { parentKey: "action_create_scanning_project", parentLabel: "Create New Mould" },
  action_delete_mould: { parentKey: "action_edit_mould", parentLabel: "Edit Mould Details" },

  // --- 2. Subplate Workpieces ---
  action_create_subplate: { parentKey: "nav_subplate", parentLabel: "Subplate Master Page" },
  action_edit_subplate: { parentKey: "action_create_subplate", parentLabel: "Add Subplate to Mould" },
  action_delete_subplate: { parentKey: "action_edit_subplate", parentLabel: "Edit Subplate Specs" },

  // --- 3. Purchase Orders & Inward ---
  action_create_purchase: { parentKey: "nav_purchase", parentLabel: "Purchase Orders Page" },
  action_edit_purchase: { parentKey: "action_create_purchase", parentLabel: "Create Purchase Order" },
  action_delete_purchase: { parentKey: "action_edit_purchase", parentLabel: "Edit Purchase Order" },
  action_create_purchase_inward: { parentKey: "nav_purchase_inward", parentLabel: "Purchase Inward Page" },
  action_delete_purchase_inward: { parentKey: "action_create_purchase_inward", parentLabel: "Receive Raw Steel" },

  // --- 4. Challans, Inward & Dispatch ---
  action_create_challan: { parentKey: "nav_challan", parentLabel: "Challan Page" },
  action_create_challan_dispatch: { parentKey: "action_create_challan", parentLabel: "Create Jobwork Challan" },
  action_delete_challan: { parentKey: "action_create_challan", parentLabel: "Create Jobwork Challan" },
  action_create_dispatch: { parentKey: "nav_dispatch", parentLabel: "Dispatch Page" },
  action_delete_dispatch: { parentKey: "action_create_dispatch", parentLabel: "Create Dispatch Note" },
  action_create_inward: { parentKey: "nav_inward", parentLabel: "Inward Returns Page" },
  action_delete_inward: { parentKey: "action_create_inward", parentLabel: "Receive Jobwork Return" },
  action_approve_qc: { parentKey: "nav_challan", parentLabel: "Logistics Movement" },

  // --- 5. Workshop Operations & Worklogs ---
  action_create_worklog: { parentKey: "nav_work", parentLabel: "Workshop Worklogs Page" },
  action_edit_worklog: { parentKey: "action_create_worklog", parentLabel: "Add Daily Work Entry" },
  action_delete_worklog: { parentKey: "action_edit_worklog", parentLabel: "Edit Own Work Entry" },
  action_edit_all_worklog: { parentKey: "action_edit_worklog", parentLabel: "Edit Own Work Entry" },
  action_delete_all_worklog: { parentKey: "action_edit_all_worklog", parentLabel: "Edit Other Staff Worklogs" },

  // --- 6. Quotations & Estimates ---
  action_create_quotation: { parentKey: "nav_quotation", parentLabel: "Quotations Page" },
  action_edit_quotation: { parentKey: "action_create_quotation", parentLabel: "Create Quotation" },
  action_delete_quotation: { parentKey: "action_edit_quotation", parentLabel: "Edit Quotation" },
  action_manage_quotation_presets: { parentKey: "action_edit_quotation", parentLabel: "Edit Quotation" },

  // --- 7. Customer Directory ---
  action_create_customer: { parentKey: "nav_customer_creator", parentLabel: "Customer Directory Page" },
  action_edit_customer: { parentKey: "action_create_customer", parentLabel: "Add New Customer" },
  action_delete_customer: { parentKey: "action_edit_customer", parentLabel: "Edit Customer Details" },

  // --- 8. Vendors & Transporters ---
  action_create_vendor: { parentKey: "nav_vendor_transport", parentLabel: "Vendors Page" },
  action_edit_vendor: { parentKey: "action_create_vendor", parentLabel: "Add Vendor / Partner" },
  action_delete_vendor: { parentKey: "action_edit_vendor", parentLabel: "Edit Vendor Details" },

  // --- 9. Staff Administration ---
  action_manage_users: { parentKey: "nav_users", parentLabel: "Staff Users Page" },
  action_manage_expenses: { parentKey: "nav_expense", parentLabel: "Factory Expenses Page" },

  // --- 10. Financial Visibility ---
  financial_view_banking: { parentKey: "financial_view_amounts", parentLabel: "View Commercial Amounts (₹)" },
  financial_export_csv: { parentKey: "financial_view_amounts", parentLabel: "View Commercial Amounts (₹)" },
};

/**
 * Checks if a permission is locked because its parent is disabled.
 */
export function getPermissionLockStatus(
  key: string,
  permissions: Record<string, boolean>
): { isLocked: boolean; reason?: string; parentKey?: string } {
  const dep = PERMISSION_DEPENDENCIES[key];
  if (!dep) return { isLocked: false };

  const isParentEnabled = permissions[dep.parentKey] === true;
  if (!isParentEnabled) {
    return {
      isLocked: true,
      reason: dep.parentLabel,
      parentKey: dep.parentKey,
    };
  }

  // Check parent's parent recursively
  return getPermissionLockStatus(dep.parentKey, permissions);
}

/**
 * Gets all direct and transitive children that depend on a given permission key.
 */
export function getDependentChildren(parentKey: string): string[] {
  const children: string[] = [];
  for (const [key, dep] of Object.entries(PERMISSION_DEPENDENCIES)) {
    if (dep.parentKey === parentKey) {
      children.push(key);
      children.push(...getDependentChildren(key));
    }
  }
  return children;
}

/**
 * Gets all transitive parent keys required by a permission.
 */
export function getRequiredParents(childKey: string): string[] {
  const parents: string[] = [];
  let curr = childKey;
  while (PERMISSION_DEPENDENCIES[curr]) {
    const parent = PERMISSION_DEPENDENCIES[curr].parentKey;
    parents.push(parent);
    curr = parent;
  }
  return parents;
}

/**
 * Smart bidirectional cascade:
 * - Turning ON: Automatically turns ON all required parents.
 * - Turning OFF: Automatically turns OFF all downstream dependent children.
 */
export function cascadePermissionToggle(
  key: string,
  targetValue: boolean,
  currentPermissions: Record<string, boolean>
): Record<string, boolean> {
  const updated = { ...currentPermissions };
  updated[key] = targetValue;

  if (targetValue) {
    // Enable all required parents
    const parents = getRequiredParents(key);
    for (const p of parents) {
      updated[p] = true;
    }
  } else {
    // Disable all downstream children
    const children = getDependentChildren(key);
    for (const c of children) {
      updated[c] = false;
    }
  }

  return updated;
}

/**
 * Normalizes permissions so no child is true if its parent is false.
 */
export function normalizeRolePermissions(
  permissions: Record<string, boolean>
): Record<string, boolean> {
  const normalized = { ...permissions };
  let changed = true;

  // Repeat until fixed point reached (handles arbitrary depth)
  while (changed) {
    changed = false;
    for (const [childKey, dep] of Object.entries(PERMISSION_DEPENDENCIES)) {
      if (normalized[childKey] === true && normalized[dep.parentKey] !== true) {
        normalized[childKey] = false;
        changed = true;
      }
    }
  }

  return normalized;
}
