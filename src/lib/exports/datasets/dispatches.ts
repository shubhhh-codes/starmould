import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";
import { getCachedCustomers, getCachedVendors } from "@/lib/cache";

interface BuildDispatchesOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildDispatchesDataset(
  options: BuildDispatchesOptions
): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "sr_no",          header: "Sr. No",          type: "number", width: 8,  center: true },
    { key: "challanno",      header: "Dispatch No.",    type: "string", width: 18, center: true },
    { key: "chdate",         header: "Dispatch Date",   type: "date",   width: 14, center: true },
    { key: "customername",   header: "Customer",        type: "string", width: 28, center: true },
    { key: "projectid",      header: "Mould Project",   type: "string", width: 18, center: true },
    { key: "invoiceno",      header: "Invoice No.",     type: "string", width: 16, center: true },
    { key: "vehicleno",      header: "Vehicle No.",     type: "string", width: 16, center: true },
    { key: "transportername",header: "Transporter",     type: "string", width: 22, center: true },
    { key: "deliverytype",   header: "Delivery Type",   type: "string", width: 18, center: true },
    { key: "item_count",     header: "Total Items",     type: "number", width: 12, center: true },
    { key: "created_by",     header: "Created By",      type: "string", width: 16, center: true },
  ];

  let query = supabaseAdmin
    .from("dispatch")
    .select("id, challanno, customerid, vendortid, projectid, chdate, invoiceno, vehicleno, deliverytype, created_by, created_at")
    .order("id", { ascending: false })
    .limit(maxRows + 1);

  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  }

  const [res, customers, vendors] = await Promise.all([
    query,
    getCachedCustomers().catch(() => []),
    getCachedVendors().catch(() => []),
  ]);

  if (res.error) throw new Error(`Failed to query dispatches: ${res.error.message}`);

  const allDispatches = res.data || [];
  const dispatchIds = allDispatches.map((d) => d.id);

  let items: any[] = [];
  if (dispatchIds.length > 0) {
    const { data: itemData } = await supabaseAdmin
      .from("dispatch_items")
      .select("dispatchid, id")
      .in("dispatchid", dispatchIds.slice(0, 1000));
    items = itemData || [];
  }

  const itemCountMap = new Map<number, number>();
  for (const it of items) {
    itemCountMap.set(it.dispatchid, (itemCountMap.get(it.dispatchid) || 0) + 1);
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

  const formatted = allDispatches.map((d) => {
    const cName = custMap.get(d.customerid) || "";
    const tName = vendMap.get(d.vendortid) || "";

    return {
      id: d.id,
      challanno: d.challanno || "",
      chdate: d.chdate ? String(d.chdate).split("T")[0] : "",
      customername: cName,
      projectid: d.projectid || "",
      invoiceno: d.invoiceno || "",
      vehicleno: d.vehicleno || "",
      transportername: tName,
      deliverytype: d.deliverytype || "",
      item_count: itemCountMap.get(d.id) || 0,
      created_by: d.created_by || "",
    };
  });

  const filtered = formatted.filter((d) => {
    if (!queryStr) return true;
    return (
      d.challanno.toLowerCase().includes(queryStr) ||
      d.customername.toLowerCase().includes(queryStr) ||
      d.projectid.toLowerCase().includes(queryStr) ||
      d.invoiceno.toLowerCase().includes(queryStr) ||
      d.vehicleno.toLowerCase().includes(queryStr) ||
      d.transportername.toLowerCase().includes(queryStr) ||
      d.created_by.toLowerCase().includes(queryStr)
    );
  });

  const rows = filtered.map((d, idx) => ({
    sr_no: idx + 1,
    ...d,
  }));

  const filtersApplied: Record<string, string> = {};
  if (search) filtersApplied["Search Query"] = search;

  return {
    title: "Client Dispatch Challans",
    subtitle: "Finished mould components and project deliveries dispatched to clients",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
