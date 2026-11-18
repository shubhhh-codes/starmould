import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";
import { getCachedCustomers, getCachedVendors } from "@/lib/cache";

interface BuildInwardsOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildInwardsDataset(
  options: BuildInwardsOptions
): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "sr_no",          header: "Sr. No",          type: "number", width: 8,  center: true },
    { key: "inchallanno",    header: "Inward No.",      type: "string", width: 18, center: true },
    { key: "chdate",         header: "Inward Date",     type: "date",   width: 14, center: true },
    { key: "vendorname",     header: "Vendor / Party",  type: "string", width: 28, center: true },
    { key: "customername",   header: "Customer",        type: "string", width: 28, center: true },
    { key: "projectid",      header: "Mould Project",   type: "string", width: 18, center: true },
    { key: "transportername",header: "Transporter",     type: "string", width: 22, center: true },
    { key: "item_count",     header: "Total Items",     type: "number", width: 12, center: true },
    { key: "created_by",     header: "Created By",      type: "string", width: 16, center: true },
  ];

  let query = supabaseAdmin
    .from("inward")
    .select("id, challanid, inchallanno, customerid, vendorid, vendortid, projectid, chdate, status, created_by, created_at")
    .order("id", { ascending: false })
    .limit(maxRows + 1);

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status);
  }

  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  }

  const [res, customers, vendors] = await Promise.all([
    query,
    getCachedCustomers().catch(() => []),
    getCachedVendors().catch(() => []),
  ]);

  if (res.error) throw new Error(`Failed to query inward receipts: ${res.error.message}`);

  const allInwards = res.data || [];
  const inwardIds = allInwards.map((i) => i.id);

  let items: any[] = [];
  if (inwardIds.length > 0) {
    const { data: itemData } = await supabaseAdmin
      .from("inward_items")
      .select("inchallanid, id")
      .in("inchallanid", inwardIds.slice(0, 1000));
    items = itemData || [];
  }

  const itemCountMap = new Map<number, number>();
  for (const it of items) {
    itemCountMap.set(it.inchallanid, (itemCountMap.get(it.inchallanid) || 0) + 1);
  }

  const custMap = new Map<string | number, string>();
  for (const c of customers || []) {
    custMap.set(c.id, c.name || c.cname || c.customername || "");
    custMap.set(Number(c.id), c.name || c.cname || c.customername || "");
  }

  const vendMap = new Map<string | number, string>();
  for (const v of vendors || []) {
    vendMap.set(v.id, v.vendor_name || v.name || "");
    vendMap.set(Number(v.id), v.vendor_name || v.name || "");
  }

  const queryStr = (search || "").trim().toLowerCase();

  const formatted = allInwards.map((i) => {
    const cName = custMap.get(i.customerid) || "";
    const vName = vendMap.get(i.vendorid) || "";
    const tName = vendMap.get(i.vendortid) || "";

    return {
      id: i.id,
      inchallanno: i.inchallanno || "",
      chdate: i.chdate ? String(i.chdate).split("T")[0] : "",
      vendorname: vName,
      customername: cName,
      projectid: i.projectid || "",
      transportername: tName,
      item_count: itemCountMap.get(i.id) || 0,
      created_by: String(i.created_by || ""),
    };
  });

  const filtered = formatted.filter((i) => {
    if (!queryStr) return true;
    return (
      i.inchallanno.toLowerCase().includes(queryStr) ||
      i.customername.toLowerCase().includes(queryStr) ||
      i.vendorname.toLowerCase().includes(queryStr) ||
      i.projectid.toLowerCase().includes(queryStr) ||
      i.transportername.toLowerCase().includes(queryStr)
    );
  });

  const rows = filtered.map((i, idx) => ({
    sr_no: idx + 1,
    ...i,
  }));

  const filtersApplied: Record<string, string> = {};
  if (search) filtersApplied["Search Query"] = search;

  return {
    title: "Job Work Inward Receipts",
    subtitle: "Job work return receipts and inward delivery challans from vendors",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
