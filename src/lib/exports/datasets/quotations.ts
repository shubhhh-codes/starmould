import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";

interface BuildQuotationsOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildQuotationsDataset(
  options: BuildQuotationsOptions
): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, hasFinancialAccess, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "sr_no",         header: "Sr. No",         type: "number",   width: 8,  center: true },
    { key: "quotation_no",  header: "Quotation No.",  type: "string",   width: 18, center: true },
    { key: "quotation_date", header: "Date",          type: "date",     width: 13, center: true },
    { key: "customer_name", header: "Customer Name",  type: "string",   width: 28, center: true },
    { key: "customer_code", header: "Customer Code",  type: "string",   width: 16, center: true },
    { key: "status",        header: "Status",         type: "string",   width: 14, center: true },
    { key: "item_count",    header: "Total Items",    type: "number",   width: 12, center: true },
  ];

  if (hasFinancialAccess) {
    columns.push(
      { key: "taxable_amount", header: "Subtotal",   type: "currency", width: 16, financial: true },
      { key: "tax_amount",     header: "GST Amount", type: "currency", width: 15, financial: true },
      { key: "grand_total",    header: "Grand Total",type: "currency", width: 17, financial: true },
    );
  }

  let query = supabaseAdmin
    .from("quotations")
    .select("id, quotation_no, quotation_date, customer_id, consignee_name, status, taxable_amount, cgst_amount, sgst_amount, igst_amount, grand_total, created_at")
    .is("deleted_at", null)
    .order("id", { ascending: false })
    .limit(maxRows + 1);

  if (filters.status && filters.status !== "ALL" && filters.status !== "All") {
    query = query.eq("status", filters.status);
  }

  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  }

  const { data: rawQuotes, error } = await query;
  if (error) throw new Error(`Failed to query quotations: ${error.message}`);

  const allQuotes = rawQuotes || [];
  const quoteIds = allQuotes.map((q) => q.id);

  let items: any[] = [];
  if (quoteIds.length > 0) {
    const { data: itemData } = await supabaseAdmin
      .from("quotation_items")
      .select("quotation_id, id")
      .in("quotation_id", quoteIds);
    items = itemData || [];
  }

  const itemCountMap = new Map<number, number>();
  for (const it of items) {
    itemCountMap.set(it.quotation_id, (itemCountMap.get(it.quotation_id) || 0) + 1);
  }

  // Fetch customer codes
  const custIds = Array.from(new Set(allQuotes.map((q) => q.customer_id).filter(Boolean)));
  const custCodeMap = new Map<number, string>();
  if (custIds.length > 0) {
    const { data: custData } = await supabaseAdmin
      .from("customers")
      .select("id, customer_code, initials")
      .in("id", custIds);
    for (const c of custData || []) {
      custCodeMap.set(c.id, c.customer_code || c.initials || "");
    }
  }

  const queryStr = (search || "").trim().toLowerCase();

  const formatted = allQuotes.map((q) => {
    const customerCode = custCodeMap.get(q.customer_id) || "";
    const customerName = q.consignee_name || "";
    const totalGst = (Number(q.cgst_amount) || 0) + (Number(q.sgst_amount) || 0) + (Number(q.igst_amount) || 0);
    return {
      id: q.id,
      quotation_no: q.quotation_no || "",
      quotation_date: q.quotation_date ? String(q.quotation_date).split("T")[0] : "",
      customer_name: customerName,
      customer_code: customerCode,
      status: q.status ? q.status.toUpperCase() : "DRAFT",
      item_count: itemCountMap.get(q.id) || 0,
      taxable_amount: q.taxable_amount != null ? Number(q.taxable_amount) : 0,
      tax_amount: totalGst,
      grand_total: q.grand_total != null ? Number(q.grand_total) : 0,
    };
  });

  const filtered = formatted.filter((q) => {
    if (!queryStr) return true;
    return (
      q.quotation_no.toLowerCase().includes(queryStr) ||
      q.customer_name.toLowerCase().includes(queryStr) ||
      q.customer_code.toLowerCase().includes(queryStr) ||
      q.status.toLowerCase().includes(queryStr)
    );
  });

  const rows = filtered.map((q, idx) => ({
    sr_no: idx + 1,
    ...q,
  }));

  const filtersApplied: Record<string, string> = {};
  if (filters.status && filters.status !== "ALL" && filters.status !== "All") {
    filtersApplied["Status"] = filters.status;
  }
  if (search) filtersApplied["Search Query"] = search;

  return {
    title: "Customer Quotation Register",
    subtitle: "Complete official register of issued customer quotation proposals",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
