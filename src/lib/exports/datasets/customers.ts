import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";

interface BuildCustomersDatasetOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildCustomersDataset(
  options: BuildCustomersDatasetOptions
): Promise<ExportDatasetResult> {
  const { search, scope, selectedIds, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "sr_no",          header: "Sr. No",             type: "number", width: 6,  center: true },
    { key: "customer_code",  header: "Cus. Code",          type: "string", width: 12, center: true },
    { key: "customername",   header: "Company Name",       type: "string", width: 30, center: true },
    { key: "gstin",          header: "GSTIN",              type: "string", width: 18, center: true },
    { key: "pan",            header: "PAN No",             type: "string", width: 12, center: true },
    { key: "contact_person", header: "Authorised Person",  type: "string", width: 20, center: true },
    { key: "mobile",         header: "Contact No",         type: "string", width: 14, center: true },
    { key: "mobile1",        header: "Alt. Contact No",    type: "string", width: 14, center: true },
    { key: "email",          header: "Mail ID",            type: "string", width: 24, center: true },
    { key: "address",        header: "Address",            type: "string", width: 36 },
  ];

  let query = supabaseAdmin
    .from("customers")
    .select("id, customer_code, pan_code, customername, gstin, pan, contact_person, mobile, mobile1, email, address, usertype")
    .eq("usertype", "Customer")
    .is("deleted_at", null)
    .order("customername", { ascending: true });

  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  }

  query = query.limit(maxRows + 1);

  const { data: rawCustomers, error } = await query;
  if (error) {
    throw new Error(`Failed to query customers for export: ${error.message}`);
  }

  const all = rawCustomers || [];
  if (all.length > maxRows) {
    throw new Error(
      `Export limit exceeded. Maximum allowable rows for ${format.toUpperCase()} is ${maxRows}. Please narrow your search.`
    );
  }

  const queryStr = (search || "").trim().toLowerCase();

  const filtered = all.filter((c) => {
    if (!queryStr) return true;
    return (
      (c.customername  && c.customername.toLowerCase().includes(queryStr))  ||
      (c.customer_code && c.customer_code.toLowerCase().includes(queryStr)) ||
      (c.pan_code      && c.pan_code.toLowerCase().includes(queryStr))      ||
      (c.gstin         && c.gstin.toLowerCase().includes(queryStr))         ||
      (c.pan           && c.pan.toLowerCase().includes(queryStr))           ||
      (c.contact_person && c.contact_person.toLowerCase().includes(queryStr)) ||
      (c.mobile        && c.mobile.includes(queryStr))                      ||
      (c.email         && c.email.toLowerCase().includes(queryStr))         ||
      (c.address       && c.address.toLowerCase().includes(queryStr))
    );
  });

  const rows = filtered.map((c, idx) => ({
    sr_no:          idx + 1,
    customer_code:  c.customer_code || c.pan_code || "",
    customername:   c.customername  || "",
    gstin:          c.gstin         || "",
    pan:            c.pan           || "",
    contact_person: c.contact_person || "",
    mobile:         c.mobile        || "",
    mobile1:        c.mobile1       || "",
    email:          c.email         || "",
    address:        c.address       || "",
  }));

  const filtersApplied: Record<string, string> = { "Type": "Customer" };
  if (search) filtersApplied["Search Query"] = search;
  if (scope === "selected") filtersApplied["Scope"] = `${selectedIds?.length || 0} Selected Rows`;

  return {
    title: "Customer Directory",
    subtitle: "Central directory for client customers and workpiece mould owners",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
