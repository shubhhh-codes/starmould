import { RolePermissionsMatrix } from "./types";

/**
 * Default Factory Permissions Matrix for Star Mould ERP:
 * 0: Admin (100% full access, immutable safety lock)
 * 1: Manager (commercial, procurement, movements, vendors, expenses, reports)
 * 2: Supervisor (floor operations, scanning, challan, dispatch, inward, QC, worklogs)
 * 3: Designer (scanning, subplates, worklogs)
 * 4: Worker (worklogs, personal tasks, mould view)
 * 5: Purchase Incharge (purchase orders, inward materials, vendors)
 * 6: VMC Department (machining, subplates, worklogs)
 * 7: Quality Checking (QC) (QC sign-offs, inward verification, worklogs)
 * 9: Dispatch (challans, shipments, gate passes)
 * 10: Programmer (CAD/CAM NC programming, subplates, worklogs)
 */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMatrix = {
  // 0: ADMIN (ALL PERMISSIONS ENABLED)
  0: {
    nav_dashboard: true,
    nav_customer_creator: true,
    nav_vendor_transport: true,
    nav_subplate: true,
    nav_scanning: true,
    nav_project_register: true,
    nav_purchase: true,
    nav_quotation: true,
    nav_purchase_inward: true,
    nav_challan: true,
    nav_dispatch: true,
    nav_inward: true,
    nav_work: true,
    nav_expense: true,
    nav_user_mgmt: true,
    nav_settings: true,
    nav_reports: true,
    nav_export: true,
    // Subplate
    action_create_subplate: true,
    action_edit_subplate: true,
    action_delete_subplate: true,
    action_assign_subplate_designer: true,
    // Scanning / Mould
    action_create_scanning_project: true,
    action_edit_mould: true,
    action_delete_mould: true,
    action_advance_pipeline: true,
    // Customers
    action_create_customer: true,
    action_edit_customer: true,
    action_delete_customer: true,
    // Vendors
    action_create_vendor: true,
    action_edit_vendor: true,
    action_delete_vendor: true,
    // Purchase
    action_create_purchase: true,
    action_edit_purchase: true,
    action_delete_purchase: true,
    action_create_purchase_inward: true,
    // Logistics
    action_create_challan: true,
    action_create_dispatch: true,
    action_create_inward: true,
    action_approve_qc: true,
    action_create_challan_dispatch: true,
    // Quotations
    action_create_quotation: true,
    action_edit_quotation: true,
    action_delete_quotation: true,
    // Worklog
    action_create_worklog: true,
    action_edit_all_worklog: true,
    // Admin
    action_manage_expenses: true,
    action_manage_users: true,
    // Financials
    financial_view_amounts: true,
    financial_export_csv: true,
    financial_soft_delete: true,
  },

  // 1: MANAGER
  1: {
    nav_dashboard: true,
    nav_customer_creator: false,
    nav_vendor_transport: true,
    nav_subplate: false,
    nav_scanning: false,
    nav_project_register: false,
    nav_purchase: true,
    nav_purchase_inward: true,
    nav_challan: true,
    nav_dispatch: true,
    nav_inward: true,
    nav_work: false,
    nav_expense: true,
    nav_user_mgmt: false,
    nav_reports: true,
    nav_export: true,
    // Subplate
    action_create_subplate: false,
    action_edit_subplate: false,
    action_delete_subplate: false,
    action_assign_subplate_designer: false,
    // Scanning / Mould
    action_create_scanning_project: false,
    action_edit_mould: false,
    action_delete_mould: false,
    action_advance_pipeline: false,
    // Customers
    action_create_customer: false,
    action_edit_customer: true,
    action_delete_customer: false,
    // Vendors
    action_create_vendor: true,
    action_edit_vendor: true,
    action_delete_vendor: false,
    // Purchase
    action_create_purchase: true,
    action_edit_purchase: true,
    action_delete_purchase: true,
    action_create_purchase_inward: true,
    // Logistics
    action_create_challan: true,
    action_create_dispatch: true,
    action_create_inward: true,
    action_approve_qc: false,
    action_create_challan_dispatch: true,
    // Quotations
    action_create_quotation: true,
    action_edit_quotation: true,
    action_delete_quotation: false,
    // Worklog
    action_create_worklog: false,
    action_edit_all_worklog: false,
    // Admin
    action_manage_expenses: true,
    action_manage_users: false,
    // Financials
    financial_view_amounts: true,
    financial_export_csv: true,
    financial_soft_delete: false,
  },

  // 2: SUPERVISOR
  2: {
    nav_dashboard: true,
    nav_customer_creator: false,
    nav_vendor_transport: false,
    nav_subplate: true,
    nav_scanning: true,
    nav_project_register: true,
    nav_purchase: false,
    nav_purchase_inward: false,
    nav_challan: true,
    nav_dispatch: true,
    nav_inward: true,
    nav_work: true,
    nav_expense: false,
    nav_user_mgmt: false,
    nav_reports: true,
    nav_export: false,
    // Subplate
    action_create_subplate: true,
    action_edit_subplate: true,
    action_delete_subplate: false,
    action_assign_subplate_designer: true,
    // Scanning / Mould
    action_create_scanning_project: true,
    action_edit_mould: true,
    action_delete_mould: false,
    action_advance_pipeline: true,
    // Customers
    action_create_customer: false,
    action_edit_customer: false,
    action_delete_customer: false,
    // Vendors
    action_create_vendor: false,
    action_edit_vendor: false,
    action_delete_vendor: false,
    // Purchase
    action_create_purchase: false,
    action_edit_purchase: false,
    action_delete_purchase: false,
    action_create_purchase_inward: false,
    // Logistics
    action_create_challan: true,
    action_create_dispatch: true,
    action_create_inward: true,
    action_approve_qc: true,
    action_create_challan_dispatch: true,
    // Quotations
    action_create_quotation: false,
    action_edit_quotation: false,
    action_delete_quotation: false,
    // Worklog
    action_create_worklog: true,
    action_edit_all_worklog: true,
    // Admin
    action_manage_expenses: false,
    action_manage_users: false,
    // Financials
    financial_view_amounts: false,
    financial_export_csv: false,
    financial_soft_delete: false,
  },

  // 3: DESIGNER
  3: {
    nav_dashboard: true,
    nav_customer_creator: false,
    nav_vendor_transport: false,
    nav_subplate: true,
    nav_scanning: true,
    nav_project_register: true,
    nav_purchase: false,
    nav_purchase_inward: false,
    nav_challan: false,
    nav_dispatch: false,
    nav_inward: false,
    nav_work: true,
    nav_expense: false,
    nav_user_mgmt: false,
    nav_settings: false,
    nav_reports: false,
    nav_export: false,
    // Subplate
    action_create_subplate: true,
    action_edit_subplate: true,
    action_delete_subplate: false,
    action_assign_subplate_designer: false,
    // Scanning / Mould
    action_create_scanning_project: false,
    action_edit_mould: false,
    action_delete_mould: false,
    action_advance_pipeline: true,
    // Customers
    action_create_customer: false,
    action_edit_customer: false,
    action_delete_customer: false,
    // Vendors
    action_create_vendor: false,
    action_edit_vendor: false,
    action_delete_vendor: false,
    // Purchase
    action_create_purchase: false,
    action_edit_purchase: false,
    action_delete_purchase: false,
    action_create_purchase_inward: false,
    // Logistics
    action_create_challan: false,
    action_create_dispatch: false,
    action_create_inward: false,
    action_approve_qc: false,
    action_create_challan_dispatch: false,
    // Quotations
    action_create_quotation: false,
    action_edit_quotation: false,
    action_delete_quotation: false,
    // Worklog
    action_create_worklog: true,
    action_edit_all_worklog: false,
    // Admin
    action_manage_expenses: false,
    action_manage_users: false,
    // Financials
    financial_view_amounts: false,
    financial_export_csv: false,
    financial_soft_delete: false,
  },

  // 4: WORKER
  4: {
    nav_dashboard: true,
    nav_customer_creator: false,
    nav_vendor_transport: false,
    nav_subplate: false,
    nav_scanning: true,
    nav_project_register: true,
    nav_purchase: false,
    nav_purchase_inward: false,
    nav_challan: false,
    nav_dispatch: false,
    nav_inward: false,
    nav_work: true,
    nav_expense: false,
    nav_user_mgmt: false,
    nav_settings: false,
    nav_reports: false,
    nav_export: false,
    // Subplate
    action_create_subplate: false,
    action_edit_subplate: false,
    action_delete_subplate: false,
    action_assign_subplate_designer: false,
    // Scanning / Mould
    action_create_scanning_project: false,
    action_edit_mould: false,
    action_delete_mould: false,
    action_advance_pipeline: false,
    // Customers
    action_create_customer: false,
    action_edit_customer: false,
    action_delete_customer: false,
    // Vendors
    action_create_vendor: false,
    action_edit_vendor: false,
    action_delete_vendor: false,
    // Purchase
    action_create_purchase: false,
    action_edit_purchase: false,
    action_delete_purchase: false,
    action_create_purchase_inward: false,
    // Logistics
    action_create_challan: false,
    action_create_dispatch: false,
    action_create_inward: false,
    action_approve_qc: false,
    action_create_challan_dispatch: false,
    // Quotations
    action_create_quotation: false,
    action_edit_quotation: false,
    action_delete_quotation: false,
    // Worklog
    action_create_worklog: true,
    action_edit_all_worklog: false,
    // Admin
    action_manage_expenses: false,
    action_manage_users: false,
    // Financials
    financial_view_amounts: false,
    financial_export_csv: false,
    financial_soft_delete: false,
  },

  // 5: PURCHASE INCHARGE
  5: {
    nav_dashboard: true,
    nav_customer_creator: false,
    nav_vendor_transport: true,
    nav_subplate: false,
    nav_scanning: false,
    nav_project_register: false,
    nav_purchase: true,
    nav_purchase_inward: true,
    nav_challan: false,
    nav_dispatch: false,
    nav_inward: true,
    nav_work: false,
    nav_expense: false,
    nav_user_mgmt: false,
    nav_settings: false,
    nav_reports: true,
    nav_export: true,
    // Subplate
    action_create_subplate: false,
    action_edit_subplate: false,
    action_delete_subplate: false,
    action_assign_subplate_designer: false,
    // Scanning / Mould
    action_create_scanning_project: false,
    action_edit_mould: false,
    action_delete_mould: false,
    action_advance_pipeline: false,
    // Customers
    action_create_customer: false,
    action_edit_customer: false,
    action_delete_customer: false,
    // Vendors
    action_create_vendor: true,
    action_edit_vendor: true,
    action_delete_vendor: false,
    // Purchase
    action_create_purchase: true,
    action_edit_purchase: true,
    action_delete_purchase: true,
    action_create_purchase_inward: true,
    // Logistics
    action_create_challan: false,
    action_create_dispatch: false,
    action_create_inward: false,
    action_approve_qc: false,
    action_create_challan_dispatch: false,
    // Quotations
    action_create_quotation: false,
    action_edit_quotation: false,
    action_delete_quotation: false,
    // Worklog
    action_create_worklog: true,
    action_edit_all_worklog: false,
    // Admin
    action_manage_expenses: false,
    action_manage_users: false,
    // Financials
    financial_view_amounts: true,
    financial_export_csv: true,
    financial_soft_delete: false,
  },

  // 6: VMC DEPARTMENT
  6: {
    nav_dashboard: true,
    nav_customer_creator: false,
    nav_vendor_transport: false,
    nav_subplate: true,
    nav_scanning: true,
    nav_project_register: true,
    nav_purchase: false,
    nav_purchase_inward: false,
    nav_challan: false,
    nav_dispatch: false,
    nav_inward: false,
    nav_work: true,
    nav_expense: false,
    nav_user_mgmt: false,
    nav_settings: false,
    nav_reports: false,
    nav_export: false,
    // Subplate
    action_create_subplate: false,
    action_edit_subplate: true,
    action_delete_subplate: false,
    action_assign_subplate_designer: false,
    // Scanning / Mould
    action_create_scanning_project: false,
    action_edit_mould: false,
    action_delete_mould: false,
    action_advance_pipeline: true,
    // Customers
    action_create_customer: false,
    action_edit_customer: false,
    action_delete_customer: false,
    // Vendors
    action_create_vendor: false,
    action_edit_vendor: false,
    action_delete_vendor: false,
    // Purchase
    action_create_purchase: false,
    action_edit_purchase: false,
    action_delete_purchase: false,
    action_create_purchase_inward: false,
    // Logistics
    action_create_challan: false,
    action_create_dispatch: false,
    action_create_inward: false,
    action_approve_qc: false,
    action_create_challan_dispatch: false,
    // Quotations
    action_create_quotation: false,
    action_edit_quotation: false,
    action_delete_quotation: false,
    // Worklog
    action_create_worklog: true,
    action_edit_all_worklog: false,
    // Admin
    action_manage_expenses: false,
    action_manage_users: false,
    // Financials
    financial_view_amounts: false,
    financial_export_csv: false,
    financial_soft_delete: false,
  },

  // 7: QUALITY CHECKING (QC)
  7: {
    nav_dashboard: true,
    nav_customer_creator: false,
    nav_vendor_transport: false,
    nav_subplate: true,
    nav_scanning: true,
    nav_project_register: true,
    nav_purchase: false,
    nav_purchase_inward: false,
    nav_challan: false,
    nav_dispatch: false,
    nav_inward: true,
    nav_work: true,
    nav_expense: false,
    nav_user_mgmt: false,
    nav_settings: false,
    nav_reports: true,
    nav_export: false,
    // Subplate
    action_create_subplate: false,
    action_edit_subplate: false,
    action_delete_subplate: false,
    action_assign_subplate_designer: false,
    // Scanning / Mould
    action_create_scanning_project: false,
    action_edit_mould: false,
    action_delete_mould: false,
    action_advance_pipeline: true,
    // Customers
    action_create_customer: false,
    action_edit_customer: false,
    action_delete_customer: false,
    // Vendors
    action_create_vendor: false,
    action_edit_vendor: false,
    action_delete_vendor: false,
    // Purchase
    action_create_purchase: false,
    action_edit_purchase: false,
    action_delete_purchase: false,
    action_create_purchase_inward: false,
    // Logistics
    action_create_challan: false,
    action_create_dispatch: false,
    action_create_inward: false,
    action_approve_qc: true,
    action_create_challan_dispatch: false,
    // Quotations
    action_create_quotation: false,
    action_edit_quotation: false,
    action_delete_quotation: false,
    // Worklog
    action_create_worklog: true,
    action_edit_all_worklog: false,
    // Admin
    action_manage_expenses: false,
    action_manage_users: false,
    // Financials
    financial_view_amounts: false,
    financial_export_csv: false,
    financial_soft_delete: false,
  },

  // 9: DISPATCH
  9: {
    nav_dashboard: true,
    nav_customer_creator: false,
    nav_vendor_transport: false,
    nav_subplate: true,
    nav_scanning: true,
    nav_project_register: true,
    nav_purchase: false,
    nav_purchase_inward: false,
    nav_challan: true,
    nav_dispatch: true,
    nav_inward: true,
    nav_work: false,
    nav_expense: false,
    nav_user_mgmt: false,
    nav_settings: false,
    nav_reports: true,
    nav_export: true,
    // Subplate
    action_create_subplate: false,
    action_edit_subplate: false,
    action_delete_subplate: false,
    action_assign_subplate_designer: false,
    // Scanning / Mould
    action_create_scanning_project: false,
    action_edit_mould: false,
    action_delete_mould: false,
    action_advance_pipeline: false,
    // Customers
    action_create_customer: false,
    action_edit_customer: false,
    action_delete_customer: false,
    // Vendors
    action_create_vendor: false,
    action_edit_vendor: false,
    action_delete_vendor: false,
    // Purchase
    action_create_purchase: false,
    action_edit_purchase: false,
    action_delete_purchase: false,
    action_create_purchase_inward: false,
    // Logistics
    action_create_challan: true,
    action_create_dispatch: true,
    action_create_inward: false,
    action_approve_qc: false,
    action_create_challan_dispatch: true,
    // Quotations
    action_create_quotation: false,
    action_edit_quotation: false,
    action_delete_quotation: false,
    // Worklog
    action_create_worklog: true,
    action_edit_all_worklog: false,
    // Admin
    action_manage_expenses: false,
    action_manage_users: false,
    // Financials
    financial_view_amounts: false,
    financial_export_csv: true,
    financial_soft_delete: false,
  },

  // 10: PROGRAMMER
  10: {
    nav_dashboard: true,
    nav_customer_creator: false,
    nav_vendor_transport: false,
    nav_subplate: true,
    nav_scanning: true,
    nav_project_register: true,
    nav_purchase: false,
    nav_purchase_inward: false,
    nav_challan: false,
    nav_dispatch: false,
    nav_inward: false,
    nav_work: true,
    nav_expense: false,
    nav_user_mgmt: false,
    nav_settings: false,
    nav_reports: false,
    nav_export: false,
    // Subplate
    action_create_subplate: true,
    action_edit_subplate: true,
    action_delete_subplate: false,
    action_assign_subplate_designer: false,
    // Scanning / Mould
    action_create_scanning_project: false,
    action_edit_mould: false,
    action_delete_mould: false,
    action_advance_pipeline: true,
    // Customers
    action_create_customer: false,
    action_edit_customer: false,
    action_delete_customer: false,
    // Vendors
    action_create_vendor: false,
    action_edit_vendor: false,
    action_delete_vendor: false,
    // Purchase
    action_create_purchase: false,
    action_edit_purchase: false,
    action_delete_purchase: false,
    action_create_purchase_inward: false,
    // Logistics
    action_create_challan: false,
    action_create_dispatch: false,
    action_create_inward: false,
    action_approve_qc: false,
    action_create_challan_dispatch: false,
    // Quotations
    action_create_quotation: false,
    action_edit_quotation: false,
    action_delete_quotation: false,
    // Worklog
    action_create_worklog: true,
    action_edit_all_worklog: false,
    // Admin
    action_manage_expenses: false,
    action_manage_users: false,
    // Financials
    financial_view_amounts: false,
    financial_export_csv: false,
    financial_soft_delete: false,
  },
};

export const DEFAULT_ROLE_MENU_ORDERS: Record<number, string[]> = {
  0: [
    "nav_dashboard",
    "nav_customer_creator",
    "nav_vendor_transport",
    "nav_subplate",
    "nav_scanning",
    "nav_project_register",
    "nav_purchase",
    "nav_quotation",
    "nav_purchase_inward",
    "nav_challan",
    "nav_dispatch",
    "nav_inward",
    "nav_work",
    "nav_expense",
    "nav_user_mgmt",
    "nav_settings",
    "nav_reports",
    "nav_export",
  ],
  1: [
    "nav_dashboard",
    "nav_vendor_transport",
    "nav_purchase",
    "nav_purchase_inward",
    "nav_challan",
    "nav_dispatch",
    "nav_inward",
    "nav_expense",
    "nav_reports",
    "nav_export",
  ],
  2: [
    "nav_dashboard",
    "nav_subplate",
    "nav_scanning",
    "nav_project_register",
    "nav_challan",
    "nav_dispatch",
    "nav_inward",
    "nav_work",
    "nav_reports",
  ],
  3: [
    "nav_dashboard",
    "nav_subplate",
    "nav_scanning",
    "nav_project_register",
    "nav_work",
  ],
  4: [
    "nav_dashboard",
    "nav_scanning",
    "nav_project_register",
    "nav_work",
  ],
  5: [
    "nav_dashboard",
    "nav_purchase",
    "nav_purchase_inward",
    "nav_vendor_transport",
    "nav_inward",
    "nav_reports",
    "nav_export",
  ],
  6: [
    "nav_dashboard",
    "nav_subplate",
    "nav_scanning",
    "nav_project_register",
    "nav_work",
  ],
  7: [
    "nav_dashboard",
    "nav_subplate",
    "nav_scanning",
    "nav_project_register",
    "nav_inward",
    "nav_work",
    "nav_reports",
  ],
  9: [
    "nav_dashboard",
    "nav_dispatch",
    "nav_challan",
    "nav_inward",
    "nav_subplate",
    "nav_scanning",
    "nav_project_register",
    "nav_reports",
    "nav_export",
  ],
  10: [
    "nav_dashboard",
    "nav_subplate",
    "nav_scanning",
    "nav_project_register",
    "nav_work",
  ],
};
