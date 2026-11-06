import { navigationItems } from "@/components/layout/sidebar";

export type PermissionCategory = 'navigation' | 'actions' | 'financials';

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: PermissionCategory;
  module?: string;
  moduleLabel?: string;
  moduleIcon?: string;
  route?: string;
  iconName?: string;
}

export type RolePermissionsMatrix = Record<number, Record<string, boolean>>;
export type RoleMenuOrders = Record<number, string[]>;

export interface RoleInfo {
  id: number;
  name: string;
  display_name: string;
  description: string;
  color: {
    bg: string;
    text: string;
    border: string;
    badge: string;
  };
}

export const ERP_ROLES: RoleInfo[] = [
  {
    id: 0,
    name: "admin",
    display_name: "Admin",
    description: "Full administrative access across all modules, system configurations, and user credentials.",
    color: {
      bg: "bg-purple-500/10",
      text: "text-purple-400",
      border: "border-purple-500/30",
      badge: "bg-purple-950/80 text-purple-300 border-purple-800/80",
    },
  },
  {
    id: 1,
    name: "manager",
    display_name: "Manager",
    description: "Procurement, movement documents, dispatch, vendor logistics, and financial reports.",
    color: {
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      border: "border-blue-500/30",
      badge: "bg-blue-950/80 text-blue-300 border-blue-800/80",
    },
  },
  {
    id: 2,
    name: "supervisor",
    display_name: "Supervisor",
    description: "Floor operations, scanning workstation, challan/dispatch movements, and QC approvals.",
    color: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/30",
      badge: "bg-amber-950/80 text-amber-300 border-amber-800/80",
    },
  },
  {
    id: 3,
    name: "designer",
    display_name: "Designer",
    description: "CAD/CAM subplate programming, 3D scanning modeling, and sample rework workflows.",
    color: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      badge: "bg-emerald-950/80 text-emerald-300 border-emerald-800/80",
    },
  },
  {
    id: 4,
    name: "worker",
    display_name: "Worker",
    description: "Machine operation, personal worklog recording, and mould progression tracking.",
    color: {
      bg: "bg-slate-500/10",
      text: "text-slate-400",
      border: "border-slate-500/30",
      badge: "bg-slate-900/80 text-slate-300 border-slate-700/80",
    },
  },
  {
    id: 5,
    name: "purchase_incharge",
    display_name: "Purchase Incharge",
    description: "Raw material procurement, supplier orders, purchase inwards, and inventory receiving.",
    color: {
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      border: "border-blue-500/30",
      badge: "bg-blue-950/80 text-blue-300 border-blue-800/80",
    },
  },
  {
    id: 6,
    name: "vmc",
    display_name: "VMC Department",
    description: "Machining floor, BMC/VMC work order execution, tool offsets, and program loading.",
    color: {
      bg: "bg-violet-500/10",
      text: "text-violet-400",
      border: "border-violet-500/30",
      badge: "bg-violet-950/80 text-violet-300 border-violet-800/80",
    },
  },
  {
    id: 7,
    name: "qc",
    display_name: "Quality Checking (QC)",
    description: "Inward inspection, in-process VMC dimension checks, and final dispatch QC sign-offs.",
    color: {
      bg: "bg-teal-500/10",
      text: "text-teal-400",
      border: "border-teal-500/30",
      badge: "bg-teal-950/80 text-teal-300 border-teal-800/80",
    },
  },
  {
    id: 9,
    name: "dispatch",
    display_name: "Dispatch",
    description: "Delivery challans, transport vehicle coordination, client packaging, and gate passes.",
    color: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      badge: "bg-emerald-950/80 text-emerald-300 border-emerald-800/80",
    },
  },
  {
    id: 10,
    name: "programmer",
    display_name: "Programmer",
    description: "CAD/CAM NC programming, machining path generation, and cutting tool parameters.",
    color: {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/30",
      badge: "bg-sky-950/80 text-sky-300 border-sky-800/80",
    },
  },
];

const NAV_DESCRIPTIONS: Record<string, string> = {
  nav_dashboard: "Access the main analytics overview, pending tasks, and production KPI metrics.",
  nav_customer_creator: "Access customer accounts directory and register new client billing profiles.",
  nav_vendor_transport: "Access suppliers, logistics transport providers, and outsourced workshop partners.",
  nav_subplate: "View and program subplate workpiece specifications, drawings, and dimension plates.",
  nav_scanning: "Manage scanning pipeline, mould modeling assignments, and workshop stages.",
  nav_purchase: "Create and issue raw material purchase orders to verified suppliers.",
  nav_purchase_inward: "Inspect incoming supplier materials and receive purchase items into inventory.",
  nav_challan: "Generate delivery challans for plates sent for external heat treatment or grinding.",
  nav_dispatch: "Coordinate final client dispatches, transport carrier details, and shipment tracking.",
  nav_inward: "Receive materials returned from external heat treatment and jobwork suppliers.",
  nav_quotation: "Generate, revise, and approve commercial customer mould quotations.",
  nav_work: "Log daily machine hours, floor activities, and track operator tasks.",
  nav_expense: "Record and categorize factory petty cash disbursements and general expenses.",
  nav_users: "Manage system user credentials, PIN passwords, and department assignments.",
  nav_settings: "Configure enterprise ERP parameters, RBAC permissions, and sidebar menus.",
  nav_reports: "Generate business intelligence, operational performance, and monthly analytics.",
  nav_export: "Export master data tables and reports to Excel / CSV spreadsheets.",
};

const NAV_ICON_NAMES: Record<string, string> = {
  nav_dashboard: "LayoutDashboard",
  nav_customer_creator: "Building2",
  nav_vendor_transport: "Truck",
  nav_subplate: "Layers",
  nav_scanning: "Scan",
  nav_purchase: "ShoppingCart",
  nav_purchase_inward: "PackageCheck",
  nav_challan: "FileText",
  nav_dispatch: "Send",
  nav_inward: "PackagePlus",
  nav_quotation: "Receipt",
  nav_work: "Clock",
  nav_expense: "Wallet",
  nav_users: "Users",
  nav_settings: "Settings",
  nav_reports: "BarChart3",
  nav_export: "FileDown",
};

// Dynamically derived navigation definitions from sidebar navigationItems
const dynamicNavDefinitions: PermissionDefinition[] = navigationItems.map((item) => {
  const permKey = item.permKey || `nav_${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  return {
    key: permKey,
    label: item.title,
    description: NAV_DESCRIPTIONS[permKey] || `Access ${item.title} module and functions.`,
    category: "navigation",
    route: item.href,
    iconName: NAV_ICON_NAMES[permKey] || "LayoutDashboard",
  };
});

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // 1. Navigation & Module Access (Dynamic from sidebar.tsx)
  ...dynamicNavDefinitions,

  // 2. Action Capabilities Grouped Structurally:
  // Hierarchy: 1. Mould Projects -> 2. Subplates (Components of Mould) -> 3. Purchase -> 4. Logistics -> 5. Worklogs -> 6. Quotations -> 7. Directory -> 8. Admin

  // --- 1. MOULD PROJECTS & PIPELINE (Root Entity) ---
  {
    key: "action_create_scanning_project",
    label: "Create New Mould",
    description: "Register a new mould project with customer, mould code, and target delivery dates.",
    category: "actions",
    module: "scanning",
    moduleLabel: "1. Mould Projects & Pipeline",
    moduleIcon: "Scan",
  },
  {
    key: "action_edit_mould",
    label: "Edit Mould Details",
    description: "Update mould specifications, customer links, target dates, and work requirements.",
    category: "actions",
    module: "scanning",
    moduleLabel: "1. Mould Projects & Pipeline",
    moduleIcon: "Scan",
  },
  {
    key: "action_delete_mould",
    label: "Delete Mould Project",
    description: "Archive or delete mould projects from the active manufacturing pipeline.",
    category: "actions",
    module: "scanning",
    moduleLabel: "1. Mould Projects & Pipeline",
    moduleIcon: "Scan",
  },

  // --- 2. SUBPLATE WORKPIECES (Components inside Mould) ---
  {
    key: "action_create_subplate",
    label: "Add Subplate to Mould",
    description: "Add new subplate plates, core inserts, or cavity blocks with dimensions and steel grades.",
    category: "actions",
    module: "subplate",
    moduleLabel: "2. Subplate Workpieces",
    moduleIcon: "Layers",
  },
  {
    key: "action_edit_subplate",
    label: "Edit Subplate Specs",
    description: "Modify steel dimensions (L × W × H), material grades, remarks, or design files.",
    category: "actions",
    module: "subplate",
    moduleLabel: "2. Subplate Workpieces",
    moduleIcon: "Layers",
  },
  {
    key: "action_delete_subplate",
    label: "Delete Subplate",
    description: "Remove workpiece subplates or plate specifications from a mould.",
    category: "actions",
    module: "subplate",
    moduleLabel: "2. Subplate Workpieces",
    moduleIcon: "Layers",
  },

  // --- 3. RAW MATERIAL PURCHASES & INWARD ---
  {
    key: "action_create_purchase",
    label: "Create Purchase Order (PO)",
    description: "Draft and place purchase orders for raw steel plates and standard mould accessories.",
    category: "actions",
    module: "purchase",
    moduleLabel: "3. Purchase Orders & Inward",
    moduleIcon: "ShoppingCart",
  },
  {
    key: "action_edit_purchase",
    label: "Edit Purchase Order",
    description: "Modify PO plate quantities, material grades, agreed pricing, and expected delivery dates.",
    category: "actions",
    module: "purchase",
    moduleLabel: "3. Purchase Orders & Inward",
    moduleIcon: "ShoppingCart",
  },
  {
    key: "action_delete_purchase",
    label: "Delete Purchase Order",
    description: "Cancel or delete open purchase orders.",
    category: "actions",
    module: "purchase",
    moduleLabel: "3. Purchase Orders & Inward",
    moduleIcon: "ShoppingCart",
  },
  {
    key: "action_create_purchase_inward",
    label: "Receive Raw Steel at Gate",
    description: "Inspect incoming supplier materials and create Gate Inward receiving entries.",
    category: "actions",
    module: "purchase",
    moduleLabel: "3. Purchase Orders & Inward",
    moduleIcon: "ShoppingCart",
  },
  {
    key: "action_delete_purchase_inward",
    label: "Delete Inward Receipt",
    description: "Remove or cancel a material inward receiving entry.",
    category: "actions",
    module: "purchase",
    moduleLabel: "3. Purchase Orders & Inward",
    moduleIcon: "ShoppingCart",
  },

  // --- 4. JOBWORK CHALLANS & DISPATCH ---
  {
    key: "action_create_challan",
    label: "Create Jobwork Challan",
    description: "Generate outward delivery notes for heat treatment, surface grinding, or external jobwork.",
    category: "actions",
    module: "logistics",
    moduleLabel: "4. Challans, Inward & Dispatch",
    moduleIcon: "ArrowUpRight",
  },
  {
    key: "action_create_challan_dispatch",
    label: "Process Challan Movement",
    description: "Authorize delivery movements and print dispatch dockets.",
    category: "actions",
    module: "logistics",
    moduleLabel: "4. Challans, Inward & Dispatch",
    moduleIcon: "ArrowUpRight",
  },
  {
    key: "action_create_dispatch",
    label: "Create Dispatch Note",
    description: "Generate finished mould dispatch notes, client delivery gate passes, and carrier details.",
    category: "actions",
    module: "logistics",
    moduleLabel: "4. Challans, Inward & Dispatch",
    moduleIcon: "ArrowUpRight",
  },
  {
    key: "action_create_inward",
    label: "Receive Jobwork Return",
    description: "Log materials returning from external heat treatment, polishing, or grinding.",
    category: "actions",
    module: "logistics",
    moduleLabel: "4. Challans, Inward & Dispatch",
    moduleIcon: "ArrowUpRight",
  },
  {
    key: "action_approve_qc",
    label: "Approve QC Sign-Off",
    description: "Perform quality inspections and approve QC sign-offs on VMC machining and final moulds.",
    category: "actions",
    module: "logistics",
    moduleLabel: "4. Challans, Inward & Dispatch",
    moduleIcon: "ArrowUpRight",
  },
  {
    key: "action_delete_challan",
    label: "Delete Jobwork Challan",
    description: "Cancel or remove outward jobwork challans.",
    category: "actions",
    module: "logistics",
    moduleLabel: "4. Challans, Inward & Dispatch",
    moduleIcon: "ArrowUpRight",
  },
  {
    key: "action_delete_dispatch",
    label: "Delete Dispatch Note",
    description: "Cancel or remove client delivery dispatch notes.",
    category: "actions",
    module: "logistics",
    moduleLabel: "4. Challans, Inward & Dispatch",
    moduleIcon: "ArrowUpRight",
  },
  {
    key: "action_delete_inward",
    label: "Delete Jobwork Receipt",
    description: "Cancel or remove jobwork inward return receipts.",
    category: "actions",
    module: "logistics",
    moduleLabel: "4. Challans, Inward & Dispatch",
    moduleIcon: "ArrowUpRight",
  },

  // --- 5. WORKSHOP OPERATIONS & WORKLOGS ---
  {
    key: "action_create_worklog",
    label: "Add Daily Work Entry",
    description: "Log operator hours, machine run times, and daily machining work on moulds.",
    category: "actions",
    module: "worklog",
    moduleLabel: "5. Workshop Worklogs",
    moduleIcon: "Briefcase",
  },
  {
    key: "action_edit_worklog",
    label: "Edit Own Work Entry",
    description: "Allow operators to correct their own logged hours and shift details.",
    category: "actions",
    module: "worklog",
    moduleLabel: "5. Workshop Worklogs",
    moduleIcon: "Briefcase",
  },
  {
    key: "action_delete_worklog",
    label: "Delete Own Work Entry",
    description: "Allow operators to remove incorrect entries from their own worklog.",
    category: "actions",
    module: "worklog",
    moduleLabel: "5. Workshop Worklogs",
    moduleIcon: "Briefcase",
  },
  {
    key: "action_edit_all_worklog",
    label: "Edit Other Staff Worklogs",
    description: "Authorize supervisors to review and modify hours logged by other floor operators.",
    category: "actions",
    module: "worklog",
    moduleLabel: "5. Workshop Worklogs",
    moduleIcon: "Briefcase",
  },
  {
    key: "action_delete_all_worklog",
    label: "Delete Other Staff Worklogs",
    description: "Authorize managers or supervisors to delete duplicate or invalid staff worklogs.",
    category: "actions",
    module: "worklog",
    moduleLabel: "5. Workshop Worklogs",
    moduleIcon: "Briefcase",
  },

  // --- 6. QUOTATIONS & ESTIMATES ---
  {
    key: "action_create_quotation",
    label: "Create Quotation",
    description: "Draft official mould cost estimates, tooling prices, and payment terms for clients.",
    category: "actions",
    module: "quotations",
    moduleLabel: "6. Quotations & Estimates",
    moduleIcon: "FileText",
  },
  {
    key: "action_edit_quotation",
    label: "Edit Quotation",
    description: "Revise quotation rates, discounts, payment schedules, and scope of work.",
    category: "actions",
    module: "quotations",
    moduleLabel: "6. Quotations & Estimates",
    moduleIcon: "FileText",
  },
  {
    key: "action_delete_quotation",
    label: "Delete Quotation",
    description: "Archive or delete quotation drafts.",
    category: "actions",
    module: "quotations",
    moduleLabel: "6. Quotations & Estimates",
    moduleIcon: "FileText",
  },
  {
    key: "action_manage_quotation_presets",
    label: "Manage Quotation Presets",
    description: "Configure standard terms and conditions, payment milestones, and tooling clauses.",
    category: "actions",
    module: "quotations",
    moduleLabel: "6. Quotations & Estimates",
    moduleIcon: "FileText",
  },

  // --- 7. CUSTOMER DIRECTORY ---
  {
    key: "action_create_customer",
    label: "Add New Customer",
    description: "Register client companies, contact persons, GSTIN numbers, and billing addresses.",
    category: "actions",
    module: "customers",
    moduleLabel: "7. Customer Directory",
    moduleIcon: "Building2",
  },
  {
    key: "action_edit_customer",
    label: "Edit Customer Details",
    description: "Update client contact information, addresses, GSTIN, and payment terms.",
    category: "actions",
    module: "customers",
    moduleLabel: "7. Customer Directory",
    moduleIcon: "Building2",
  },
  {
    key: "action_delete_customer",
    label: "Delete Customer",
    description: "Deactivate or remove customer profiles from the system.",
    category: "actions",
    module: "customers",
    moduleLabel: "7. Customer Directory",
    moduleIcon: "Building2",
  },

  // --- 8. VENDORS & TRANSPORTERS ---
  {
    key: "action_create_vendor",
    label: "Add Vendor / Transporter",
    description: "Register steel suppliers, heat-treatment vendors, and logistics transport providers.",
    category: "actions",
    module: "vendors",
    moduleLabel: "8. Vendors & Transporters",
    moduleIcon: "Truck",
  },
  {
    key: "action_edit_vendor",
    label: "Edit Vendor Details",
    description: "Modify supplier banking details, IFSC, GSTIN, address, and contact numbers.",
    category: "actions",
    module: "vendors",
    moduleLabel: "8. Vendors & Transporters",
    moduleIcon: "Truck",
  },
  {
    key: "action_delete_vendor",
    label: "Delete Vendor",
    description: "Deactivate or remove vendor records.",
    category: "actions",
    module: "vendors",
    moduleLabel: "8. Vendors & Transporters",
    moduleIcon: "Truck",
  },

  // --- 9. SYSTEM ADMINISTRATION ---
  {
    key: "action_manage_users",
    label: "Add / Edit Staff Users",
    description: "Manage employee login profiles, roles, PIN passwords, and department assignments.",
    category: "actions",
    module: "administration",
    moduleLabel: "9. Staff & User Access",
    moduleIcon: "ShieldCheck",
  },
  {
    key: "action_manage_expenses",
    label: "Add Factory Expenses",
    description: "Record daily workshop petty cash, tool purchases, and operational expenses.",
    category: "actions",
    module: "administration",
    moduleLabel: "9. Staff & User Access",
    moduleIcon: "ShieldCheck",
  },

  // --- 10. FINANCIAL & DATA VISIBILITY ---
  {
    key: "financial_view_amounts",
    label: "View Commercial Amounts (₹)",
    description: "Allow viewing purchase rates, quotation amounts, and project commercial financials.",
    category: "financials",
    module: "financials",
    moduleLabel: "10. Financial Visibility",
    moduleIcon: "Wallet",
  },
  {
    key: "financial_view_banking",
    label: "View Bank Account Details",
    description: "Allow viewing customer and supplier bank accounts and IFSC codes.",
    category: "financials",
    module: "financials",
    moduleLabel: "10. Financial Visibility",
    moduleIcon: "Wallet",
  },
  {
    key: "financial_export_csv",
    label: "Export Excel / CSV Data",
    description: "Allow exporting reports and data tables to downloadable Excel / CSV spreadsheets.",
    category: "financials",
    module: "financials",
    moduleLabel: "10. Financial Visibility",
    moduleIcon: "Wallet",
  },
  {
    key: "financial_soft_delete",
    label: "Delete Master Records",
    description: "Allow soft-deleting master records across ERP modules.",
    category: "financials",
    module: "financials",
    moduleLabel: "10. Financial Visibility",
    moduleIcon: "Wallet",
  },
];
