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

import { navigationItems } from "@/components/layout/sidebar";

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
  nav_inward: "Record items received back from external processing or client returns.",
  nav_work: "Log machine hours, track operator shifts, and review personal performance logs.",
  nav_expense: "Track factory expenditures, tool purchases, utilities, and daily petty cash.",
  nav_user_mgmt: "Manage staff accounts, assign system roles, and reset access credentials.",
  nav_settings: "Drag-and-drop menu customization, role visibility, and capability matrix.",
  nav_reports: "Generate production summaries, machine downtime logs, and throughput reports.",
  nav_export: "Export full database tables and audit logs into Excel/CSV streams.",
};

const NAV_ICON_NAMES: Record<string, string> = {
  nav_dashboard: "LayoutDashboard",
  nav_customer_creator: "Building2",
  nav_vendor_transport: "Truck",
  nav_subplate: "Layers",
  nav_scanning: "Scan",
  nav_purchase: "ShoppingCart",
  nav_purchase_inward: "PackagePlus",
  nav_challan: "ArrowUpRight",
  nav_dispatch: "Truck",
  nav_inward: "ArrowDownLeft",
  nav_work: "Briefcase",
  nav_expense: "Receipt",
  nav_user_mgmt: "ShieldCheck",
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

  // 2. Action & Creation Capabilities (Modular & Granular Sub-Actions)
  // --- SUBPLATE MASTER ACTIONS ---
  {
    key: "action_create_subplate",
    label: "Add Subplate",
    description: "Authorize drafting and registering new subplate workpieces with dimensions and steel grades.",
    category: "actions",
    module: "subplate",
    moduleLabel: "Subplate Master",
    moduleIcon: "Layers",
  },
  {
    key: "action_edit_subplate",
    label: "Edit Subplate",
    description: "Authorize modifying plate dimensions, material grades, remarks, or design files.",
    category: "actions",
    module: "subplate",
    moduleLabel: "Subplate Master",
    moduleIcon: "Layers",
  },
  {
    key: "action_delete_subplate",
    label: "Delete Subplate",
    description: "Authorize soft-deleting or removing workpiece subplates.",
    category: "actions",
    module: "subplate",
    moduleLabel: "Subplate Master",
    moduleIcon: "Layers",
  },

  // --- MOULD & 3D SCANNING PIPELINE ---
  {
    key: "action_create_scanning_project",
    label: "New Mould Entry",
    description: "Authorize creating and registering new mould projects and pipeline entries.",
    category: "actions",
    module: "scanning",
    moduleLabel: "Moulds Settings",
    moduleIcon: "Scan",
  },
  {
    key: "action_edit_mould",
    label: "Edit Mould Entry",
    description: "Authorize modifying mould project details, customer links, target dates, and work types.",
    category: "actions",
    module: "scanning",
    moduleLabel: "Moulds Settings",
    moduleIcon: "Scan",
  },
  {
    key: "action_delete_mould",
    label: "Delete Mould Entry",
    description: "Authorize soft-deleting or removing mould projects.",
    category: "actions",
    module: "scanning",
    moduleLabel: "Moulds Settings",
    moduleIcon: "Scan",
  },
  {
    key: "action_advance_pipeline",
    label: "Advance Pipeline Stages",
    description: "Authorize progressing moulds through Scanning, Design, CAM, VMC, and Benchwork.",
    category: "actions",
    module: "scanning",
    moduleLabel: "Moulds Settings",
    moduleIcon: "Scan",
  },

  // --- CLIENT CUSTOMERS ---
  {
    key: "action_create_customer",
    label: "Add Customer",
    description: "Authorize creating client customer accounts and commercial billing profiles.",
    category: "actions",
    module: "customers",
    moduleLabel: "Customer Directory",
    moduleIcon: "Building2",
  },
  {
    key: "action_edit_customer",
    label: "Edit Customer",
    description: "Authorize editing customer company names, addresses, contacts, and GSTIN.",
    category: "actions",
    module: "customers",
    moduleLabel: "Customer Directory",
    moduleIcon: "Building2",
  },
  {
    key: "action_delete_customer",
    label: "Delete Customer",
    description: "Authorize soft-deleting or deactivating client customer profiles.",
    category: "actions",
    module: "customers",
    moduleLabel: "Customer Directory",
    moduleIcon: "Building2",
  },

  // --- VENDORS & TRANSPORTERS ---
  {
    key: "action_create_vendor",
    label: "Add Vendor / Partner",
    description: "Authorize adding new suppliers, transport carriers, and outsourced partners.",
    category: "actions",
    module: "vendors",
    moduleLabel: "Vendors & Transporters",
    moduleIcon: "Truck",
  },
  {
    key: "action_edit_vendor",
    label: "Edit Vendor",
    description: "Authorize editing supplier bank details, IFSC, addresses, PAN, and GSTIN.",
    category: "actions",
    module: "vendors",
    moduleLabel: "Vendors & Transporters",
    moduleIcon: "Truck",
  },
  {
    key: "action_delete_vendor",
    label: "Delete Vendor",
    description: "Authorize soft-deleting or deactivating suppliers and transport records.",
    category: "actions",
    module: "vendors",
    moduleLabel: "Vendors & Transporters",
    moduleIcon: "Truck",
  },

  // --- PROCUREMENT & PURCHASE ORDERS ---
  {
    key: "action_create_purchase",
    label: "Add Purchase PO",
    description: "Authorize drafting and issuing raw material purchase orders to verified suppliers.",
    category: "actions",
    module: "purchase",
    moduleLabel: "Purchase Orders & Inward",
    moduleIcon: "ShoppingCart",
  },
  {
    key: "action_edit_purchase",
    label: "Edit Purchase PO",
    description: "Authorize modifying open PO quantities, pricing, delivery dates, or status.",
    category: "actions",
    module: "purchase",
    moduleLabel: "Purchase Orders & Inward",
    moduleIcon: "ShoppingCart",
  },
  {
    key: "action_delete_purchase",
    label: "Delete Purchase PO",
    description: "Authorize canceling or removing draft purchase orders.",
    category: "actions",
    module: "purchase",
    moduleLabel: "Purchase Orders & Inward",
    moduleIcon: "ShoppingCart",
  },
  {
    key: "action_create_purchase_inward",
    label: "Receive Inward Material",
    description: "Authorize inspecting incoming supplier materials and recording items at workshop gate.",
    category: "actions",
    module: "purchase",
    moduleLabel: "Purchase Orders & Inward",
    moduleIcon: "ShoppingCart",
  },

  // --- MOVEMENTS & LOGISTICS ---
  {
    key: "action_create_challan",
    label: "Add Job Work Challan",
    description: "Authorize issuing outward delivery notes for heat treatment, grinding, or external jobwork.",
    category: "actions",
    module: "logistics",
    moduleLabel: "Challan & Dispatch Logistics",
    moduleIcon: "ArrowUpRight",
  },
  {
    key: "action_create_dispatch",
    label: "Add Dispatch Challan",
    description: "Authorize generating official dispatch notes, transport carrier details, and gate passes.",
    category: "actions",
    module: "logistics",
    moduleLabel: "Challan & Dispatch Logistics",
    moduleIcon: "ArrowUpRight",
  },
  {
    key: "action_create_inward",
    label: "Receive Inward Return",
    description: "Authorize recording items received back from external processing or client returns.",
    category: "actions",
    module: "logistics",
    moduleLabel: "Challan & Dispatch Logistics",
    moduleIcon: "ArrowUpRight",
  },
  {
    key: "action_approve_qc",
    label: "Approve QC Sign-Off",
    description: "Authorize sign-off on incoming inspection, VMC machining, and final QC inspection gates.",
    category: "actions",
    module: "logistics",
    moduleLabel: "Challan & Dispatch Logistics",
    moduleIcon: "ArrowUpRight",
  },
  {
    key: "action_create_challan_dispatch",
    label: "Challan & Dispatch Movement",
    description: "Authorize generating outward delivery notes and official dispatch dockets.",
    category: "actions",
    module: "logistics",
    moduleLabel: "Challan & Dispatch Logistics",
    moduleIcon: "ArrowUpRight",
  },

  // --- QUOTATIONS & ESTIMATES ---
  {
    key: "action_create_quotation",
    label: "New Quotation",
    description: "Authorize drafting new cost estimates and mould quotations for customers.",
    category: "actions",
    module: "quotations",
    moduleLabel: "Quotations & Estimates",
    moduleIcon: "FileText",
  },
  {
    key: "action_edit_quotation",
    label: "Edit Quotation",
    description: "Authorize revising line items, tooling rates, payment terms, or status.",
    category: "actions",
    module: "quotations",
    moduleLabel: "Quotations & Estimates",
    moduleIcon: "FileText",
  },
  {
    key: "action_delete_quotation",
    label: "Delete Quotation",
    description: "Authorize deleting or archiving quotation drafts.",
    category: "actions",
    module: "quotations",
    moduleLabel: "Quotations & Estimates",
    moduleIcon: "FileText",
  },

  // --- WORKSHOP WORKLOGS ---
  {
    key: "action_create_worklog",
    label: "Add Work Entry",
    description: "Authorize logging machine hours, operating shifts, and daily work tasks.",
    category: "actions",
    module: "worklog",
    moduleLabel: "Workshop Worklogs",
    moduleIcon: "Briefcase",
  },
  {
    key: "action_edit_all_worklog",
    label: "Edit Other Staff Worklogs",
    description: "Authorize supervisors and managers to review and correct hours logged by operators.",
    category: "actions",
    module: "worklog",
    moduleLabel: "Workshop Worklogs",
    moduleIcon: "Briefcase",
  },

  // --- SYSTEM ADMINISTRATION ---
  {
    key: "action_manage_users",
    label: "Add / Edit Staff User",
    description: "Authorize adding staff members, managing logins, and altering role assignments.",
    category: "actions",
    module: "administration",
    moduleLabel: "Staff Users & Administration",
    moduleIcon: "ShieldCheck",
  },
  {
    key: "action_manage_expenses",
    label: "Add Expense Entry",
    description: "Authorize recording operational financial disbursements and factory petty cash.",
    category: "actions",
    module: "administration",
    moduleLabel: "Staff Users & Administration",
    moduleIcon: "ShieldCheck",
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
