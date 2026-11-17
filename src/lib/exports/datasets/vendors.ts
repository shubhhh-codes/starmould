import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";

interface BuildVendorsDatasetOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildVendorsDataset(
  options: BuildVendorsDatasetOptions
): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, hasFinancialAccess, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "sr_no",          header: "Sr. No",             type: "number", width: 8,  center: true },
    { key: "vendor_code",    header: "Vendor Code",        type: "string", width: 14, center: true },
    { key: "vendor_name",    header: "Company Name",       type: "string", width: 32, center: true },
    { key: "vendor_type",    header: "Type",               type: "string", width: 14, center: true },
    { key: "city",           header: "City",               type: "string", width: 16, center: true },
    { key: "gstin",          header: "GSTIN",              type: "string", width: 18, center: true },
    { key: "pan",            header: "PAN No",             type: "string", width: 14, center: true },
    { key: "contact_person", header: "Contact Person",     type: "string", width: 20, center: true },
    { key: "mobile",         header: "Contact No",         type: "string", width: 14, center: true },
    { key: "mobile1",        header: "Alt. Contact No",    type: "string", width: 14, center: true },
    { key: "email",          header: "Mail ID",            type: "string", width: 24, center: true },
  ];

  if (hasFinancialAccess) {
    columns.push(
      { key: "bank_name",  header: "Bank Name", type: "string", width: 20, center: true, financial: true },
      { key: "account_no", header: "A/C No",    type: "string", width: 18, center: true, financial: true },
      { key: "ifsc_code",  header: "IFSC Code", type: "string", width: 14, center: true, financial: true },
    );
  }

  // Address is strictly left-aligned (no center: true)
  columns.push({ key: "address", header: "Address", type: "string", width: 40 });

  let query = supabaseAdmin
    .from("vendors")
    .select("id, vendor_name, initials, vendor_code, vendor_type, city, gstin, pan, bank_name, account_no, ifsc_code, contact_person, mobile, mobile1, email, address")
    .is("deleted_at", null)
    .order("vendor_name", { ascending: true });

  const activeTab = filters.tab || filters.vendor_type;
  if (activeTab && activeTab !== "All" && activeTab !== "ALL") {
    const targetType = activeTab === "Vendor" ? "Supplier" : activeTab === "Transport" ? "Transporter" : activeTab;
    query = query.eq("vendor_type", targetType);
  }

  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  }

  query = query.limit(maxRows + 1);

  const { data: rawVendors, error } = await query;
  if (error) {
    throw new Error(`Failed to query vendors for export: ${error.message}`);
  }

  const all = rawVendors || [];
  if (all.length > maxRows) {
    throw new Error(
      `Export limit exceeded. Maximum allowable rows for ${format.toUpperCase()} is ${maxRows}. Please narrow your search.`
    );
  }

  const queryStr = (search || "").trim().toLowerCase();

  const filtered = all.filter((v) => {
    if (!queryStr) return true;
    return (
      (v.vendor_name    && v.vendor_name.toLowerCase().includes(queryStr))    ||
      (v.vendor_code    && v.vendor_code.toLowerCase().includes(queryStr))    ||
      (v.initials       && v.initials.toLowerCase().includes(queryStr))       ||
      (v.city           && v.city.toLowerCase().includes(queryStr))           ||
      (v.gstin          && v.gstin.toLowerCase().includes(queryStr))          ||
      (v.pan            && v.pan.toLowerCase().includes(queryStr))            ||
      (v.contact_person && v.contact_person.toLowerCase().includes(queryStr)) ||
      (v.mobile         && String(v.mobile).includes(queryStr))               ||
      (v.email          && v.email.toLowerCase().includes(queryStr))          ||
      (v.address        && v.address.toLowerCase().includes(queryStr))
    );
  });

  const rows = filtered.map((v, idx) => ({
    sr_no:          idx + 1,
    vendor_code:    v.vendor_code    || "",
    vendor_name:    v.vendor_name    || "",
    vendor_type:    v.vendor_type    || "",
    city:           v.city           || "",
    gstin:          v.gstin          || "",
    pan:            v.pan            || "",
    contact_person: v.contact_person || "",
    mobile:         v.mobile         || "",
    mobile1:        v.mobile1        || "",
    email:          v.email          || "",
    bank_name:      hasFinancialAccess ? (v.bank_name || "") : "",
    account_no:     hasFinancialAccess ? (v.account_no || "") : "",
    ifsc_code:      hasFinancialAccess ? (v.ifsc_code || "") : "",
    address:        v.address        || "",
  }));

  const filtersApplied: Record<string, string> = {};
  if (activeTab && activeTab !== "All" && activeTab !== "ALL") {
    filtersApplied["Category"] = activeTab;
  }
  if (search) filtersApplied["Search Query"] = search;
  if (scope === "selected") filtersApplied["Scope"] = `${selectedIds?.length || 0} Selected Rows`;

  return {
    title: "Vendors & Transporters Directory",
    subtitle: "Central registry for raw material suppliers, service vendors, and logistics transporters",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
