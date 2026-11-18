import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";
import { getCachedCustomers, getCachedVendors } from "@/lib/cache";

interface BuildChallansOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildChallansDataset(
  options: BuildChallansOptions
): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "sr_no",          header: "Sr. No",          type: "number", width: 8,  center: true },
    { key: "challanno",      header: "Challan No.",     type: "string", width: 18, center: true },
    { key: "chdate",         header: "Challan Date",    type: "date",   width: 14, center: true },
    { key: "vendorname",     header: "Vendor / Party",  type: "string", width: 28, center: true },
    { key: "customername",   header: "Customer",        type: "string", width: 28, center: true },
    { key: "projectid",      header: "Mould Project",   type: "string", width: 18, center: true },
    { key: "transportername",header: "Transporter",     type: "string", width: 22, center: true },
    { key: "item_count",     header: "Total Items",     type: "number", width: 12, center: true },
    { key: "status_label",   header: "Status",          type: "string", width: 14, center: true },
    { key: "created_by",     header: "Created By",      type: "string", width: 16, center: true },
  ];

  let query = supabaseAdmin
    .from("challan")
    .select("id, challanno, customerid, vendorid, vendortid, projectid, chdate, status, created_by, created_at")
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

  if (res.error) throw new Error(`Failed to query outward challans: ${res.error.message}`);

  const allChallans = res.data || [];
  const challanIds = allChallans.map((c) => c.id);

  let items: any[] = [];
  if (challanIds.length > 0) {
    const { data: itemData } = await supabaseAdmin
      .from("challan_items")
      .select("challanid, id")
      .in("challanid", challanIds.slice(0, 1000));
    items = itemData || [];
  }

  const itemCountMap = new Map<number, number>();
  for (const it of items) {
    itemCountMap.set(it.challanid, (itemCountMap.get(it.challanid) || 0) + 1);
  }

  const custMap = new Map<string | number, string>();
  for (const c of customers || []) {
    custMap.set(c.id, c.name || c.cname || "");
    custMap.set(Number(c.id), c.name || c.cname || "");
  }

  const vendMap = new Map<string | number, string>();
  for (const v of vendors || []) {
    vendMap.set(v.id, v.name || v.vname || "");
    vendMap.set(Number(v.id), v.name || v.vname || "");
  }

  const queryStr = (search || "").trim().toLowerCase();

  const formatted = allChallans.map((c) => {
    const cName = custMap.get(c.customerid) || "";
    const vName = vendMap.get(c.vendorid) || "";
    const tName = vendMap.get(c.vendortid) || "";
    const statusLabel = String(c.status) === "1" ? "Active" : "Closed";

    return {
      id: c.id,
      challanno: c.challanno || "",
      chdate: c.chdate ? String(c.chdate).split("T")[0] : "",
      vendorname: vName,
      customername: cName,
      projectid: c.projectid || "",
      transportername: tName,
      item_count: itemCountMap.get(c.id) || 0,
      status_label: statusLabel,
      created_by: c.created_by || "",
    };
  });

  const filtered = formatted.filter((c) => {
    if (!queryStr) return true;
    return (
      c.challanno.toLowerCase().includes(queryStr) ||
      c.customername.toLowerCase().includes(queryStr) ||
      c.vendorname.toLowerCase().includes(queryStr) ||
      c.projectid.toLowerCase().includes(queryStr) ||
      c.transportername.toLowerCase().includes(queryStr) ||
      c.created_by.toLowerCase().includes(queryStr)
    );
  });

  const rows = filtered.map((c, idx) => ({
    sr_no: idx + 1,
    ...c,
  }));

  const filtersApplied: Record<string, string> = {};
  if (filters.status && filters.status !== "ALL") filtersApplied["Status"] = filters.status;
  if (search) filtersApplied["Search Query"] = search;

  return {
    title: "Outward Job Work Challans",
    subtitle: "Job work and delivery challan register dispatched to vendors",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
