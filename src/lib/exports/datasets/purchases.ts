import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";
import { getCachedCustomers, getCachedVendors } from "@/lib/cache";

interface BuildPurchasesOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildPurchasesDataset(
  options: BuildPurchasesOptions
): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "sr_no",        header: "Sr. No",      type: "number", width: 8,  center: true },
    { key: "srno",         header: "PO No.",      type: "string", width: 18, center: true },
    { key: "odate",        header: "Order Date",  type: "date",   width: 14, center: true },
    { key: "vendorname",   header: "Supplier",    type: "string", width: 28, center: true },
    { key: "customername", header: "Customer",    type: "string", width: 26, center: true },
    { key: "projectid",    header: "Mould Code",  type: "string", width: 18, center: true },
    { key: "created_by",   header: "Created By",  type: "string", width: 18, center: true },
    { key: "item_count",   header: "Total Items", type: "number", width: 12, center: true },
    { key: "status",       header: "Status",      type: "string", width: 14, center: true },
  ];

  let query = supabaseAdmin
    .from("purchase")
    .select("id, srno, odate, vname, cname, projectid, created_by, status, created_at")
    .order("id", { ascending: false })
    .limit(maxRows + 1);

  if (filters.status && filters.status !== "ALL" && filters.status !== "All") {
    query = query.eq("status", filters.status);
  }

  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  }

  const { data: rawPurchases, error } = await query;
  if (error) throw new Error(`Failed to query purchase orders: ${error.message}`);

  const allPurchases = rawPurchases || [];
  const poIds = allPurchases.map((p) => p.id);

  let items: any[] = [];
  if (poIds.length > 0) {
    const { data: poItems } = await supabaseAdmin
      .from("purchase_items")
      .select("id, pid")
      .in("pid", poIds);
    items = poItems || [];
  }

  const itemsCountByPo = new Map<number, number>();
  for (const item of items) {
    itemsCountByPo.set(item.pid, (itemsCountByPo.get(item.pid) || 0) + 1);
  }

  const [customers, vendors] = await Promise.all([
    getCachedCustomers(),
    getCachedVendors(),
  ]);
  const custMap = new Map((customers || []).map((c: any) => [c.id, c.customername]));
  const vendMap = new Map((vendors || []).map((v: any) => [v.id, v.vendor_name]));

  const queryStr = (search || "").trim().toLowerCase();

  const formatted = allPurchases.map((p) => {
    const vName = vendMap.get(p.vname) || (p.vname ? String(p.vname) : "");
    const cName = custMap.get(p.cname) || (p.cname ? String(p.cname) : "");
    return {
      id:           p.id,
      srno:         p.srno || "",
      odate:        p.odate || "",
      vendorname:   vName,
      customername: cName,
      projectid:    p.projectid || "",
      created_by:   p.created_by || "",
      item_count:   itemsCountByPo.get(p.id) || 0,
      status:       p.status === "1" ? "Active" : p.status === "0" ? "Closed" : (p.status || "Active"),
    };
  });

  const filtered = formatted.filter((p) => {
    if (!queryStr) return true;
    return (
      p.srno.toLowerCase().includes(queryStr) ||
      p.vendorname.toLowerCase().includes(queryStr) ||
      p.customername.toLowerCase().includes(queryStr) ||
      p.projectid.toLowerCase().includes(queryStr) ||
      p.created_by.toLowerCase().includes(queryStr)
    );
  });

  const rows = filtered.map((p, idx) => ({
    sr_no: idx + 1,
    ...p,
  }));

  const filtersApplied: Record<string, string> = {};
  if (filters.status && filters.status !== "ALL" && filters.status !== "All") {
    filtersApplied["Status"] = filters.status;
  }
  if (search) filtersApplied["Search Query"] = search;

  return {
    title: "Purchase Orders Register",
    subtitle: "Official purchase orders issued to steel suppliers and external service vendors",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
