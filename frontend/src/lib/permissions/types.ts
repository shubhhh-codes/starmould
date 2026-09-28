export type PermissionCategory = 'navigation' | 'actions' | 'financials';

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: PermissionCategory;
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
];

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // 1. Navigation & Module Access
  {
    key: "nav_dashboard",
    label: "Dashboard View",
    description: "Access the main analytics overview, pending tasks, and production KPI metrics.",
    category: "navigation",
    route: "/",
    iconName: "LayoutDashboard",
  },
  {
    key: "nav_customer_creator",
    label: "Customer Creator (Client Master)",
    description: "Access customer accounts directory and register new client billing profiles.",
    category: "navigation",
    route: "/customer?tab=Customer",
    iconName: "Building2",
  },
  {
    key: "nav_vendor_transport",
    label: "Vendor / Transport Directory",
    description: "Access suppliers, logistics transport providers, and outsourced workshop partners.",
    category: "navigation",
    route: "/customer?tab=Vendor",
    iconName: "Truck",
  },
  {
    key: "nav_subplate",
    label: "Subplate Master",
    description: "View and program subplate workpiece specifications, drawings, and dimension plates.",
    category: "navigation",
    route: "/subplate",
    iconName: "Layers",
  },
  {
    key: "nav_scanning",
    label: "Scanning / Mould Projects",
    description: "Manage scanning pipeline, mould modeling assignments, and workshop stages.",
    category: "navigation",
    route: "/scanning",
    iconName: "Scan",
  },
  {
    key: "nav_printing",
    label: "Printing & Dispatch Labels",
    description: "Print barcode tags, traveller sheets, and shipment dispatch documentation.",
    category: "navigation",
    route: "/printing",
    iconName: "Printer",
  },
  {
    key: "nav_purchase",
    label: "Purchase Orders (PO)",
    description: "Create and issue raw material purchase orders to verified suppliers.",
    category: "navigation",
    route: "/purchase",
    iconName: "ShoppingCart",
  },
  {
    key: "nav_purchase_inward",
    label: "Purchase Inward (GRN)",
    description: "Inspect incoming supplier materials and receive purchase items into inventory.",
    category: "navigation",
    route: "/purchase-inward",
    iconName: "PackagePlus",
  },
  {
    key: "nav_challan",
    label: "Outward Challans",
    description: "Generate delivery challans for plates sent for external heat treatment or grinding.",
    category: "navigation",
    route: "/challan",
    iconName: "ArrowUpRight",
  },
  {
    key: "nav_dispatch",
    label: "Final Dispatch Movements",
    description: "Coordinate final client dispatches, transport carrier details, and shipment tracking.",
    category: "navigation",
    route: "/dispatch",
    iconName: "Truck",
  },
  {
    key: "nav_inward",
    label: "Inward Returns & Receipts",
    description: "Record items received back from external processing or client returns.",
    category: "navigation",
    route: "/inward",
    iconName: "ArrowDownLeft",
  },
  {
    key: "nav_work",
    label: "Work & Worklogs",
    description: "Log machine hours, track operator shifts, and review personal performance logs.",
    category: "navigation",
    route: "/work",
    iconName: "Briefcase",
  },
  {
    key: "nav_sample",
    label: "Sample & Rework Pipeline",
    description: "Manage sample trials, rework tickets, and prototype test corrections.",
    category: "navigation",
    route: "/sample",
    iconName: "RotateCcw",
  },
  {
    key: "nav_expense",
    label: "Expense & Finance Master",
    description: "Track factory expenditures, tool purchases, utilities, and daily petty cash.",
    category: "navigation",
    route: "/expense",
    iconName: "Receipt",
  },
  {
    key: "nav_gram",
    label: "Gram Weight Master",
    description: "Calibrate raw material weight standards, density tables, and scrap allowances.",
    category: "navigation",
    route: "/gram",
    iconName: "Scale",
  },
  {
    key: "nav_user_mgmt",
    label: "User & Employee Management",
    description: "Manage staff accounts, assign system roles, and reset access credentials.",
    category: "navigation",
    route: "/user",
    iconName: "ShieldCheck",
  },
  {
    key: "nav_settings",
    label: "Menus & Role Permissions",
    description: "Drag-and-drop menu customization, role visibility, and capability matrix.",
    category: "navigation",
    route: "/settings",
    iconName: "Settings",
  },
  {
    key: "nav_reports",
    label: "Reports & Downtime Analytics",
    description: "Generate production summaries, machine downtime logs, and throughput reports.",
    category: "navigation",
    route: "/report",
    iconName: "BarChart3",
  },
  {
    key: "nav_export",
    label: "Export Streams",
    description: "Export full database tables and audit logs into Excel/CSV streams.",
    category: "navigation",
    route: "/export",
    iconName: "FileDown",
  },

  // 2. Action & Creation Capabilities
  {
    key: "action_create_customer",
    label: "Create & Manage Customers",
    description: "Authorize creating client customer accounts (strictly restricted to Admin by default).",
    category: "actions",
  },
  {
    key: "action_create_vendor",
    label: "Create Vendors & Transporters",
    description: "Authorize adding new suppliers, transport carriers, and outsourced partners.",
    category: "actions",
  },
  {
    key: "action_create_scanning_project",
    label: "Create Scanning Projects",
    description: "Authorize initializing new mould workpiece scanning jobs.",
    category: "actions",
  },
  {
    key: "action_approve_qc",
    label: "Approve Quality Checks (QC)",
    description: "Authorize sign-off on incoming, VMC machining, and final QC inspection gates.",
    category: "actions",
  },
  {
    key: "action_create_purchase",
    label: "Create Purchase Orders",
    description: "Authorize drafting and confirming purchase orders to raw material suppliers.",
    category: "actions",
  },
  {
    key: "action_create_challan_dispatch",
    label: "Create Challan & Dispatch",
    description: "Authorize generating outward delivery notes and official dispatch dockets.",
    category: "actions",
  },
  {
    key: "action_manage_expenses",
    label: "Create & Edit Expenses",
    description: "Authorize recording operational financial disbursements and expense entries.",
    category: "actions",
  },
  {
    key: "action_manage_users",
    label: "Create & Modify User Profiles",
    description: "Authorize adding new staff members and altering employee role assignments.",
    category: "actions",
  },

  // 3. Financial & Data Visibility
  {
    key: "financial_view_amounts",
    label: "View Billing & Commercial Amounts (₹)",
    description: "Permit viewing financial values, quotation amounts, and project billing figures.",
    category: "financials",
  },
  {
    key: "financial_export_csv",
    label: "Export Data to CSV / Excel",
    description: "Permit downloading spreadsheet exports from data tables across modules.",
    category: "financials",
  },
  {
    key: "financial_soft_delete",
    label: "Delete / Archive Records",
    description: "Permit performing soft deletion and archiving of master records.",
    category: "financials",
  },
];
