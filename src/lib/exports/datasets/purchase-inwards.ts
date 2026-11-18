import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";
import { getCachedCustomers, getCachedVendors } from "@/lib/cache";

interface BuildPurchaseInwardsOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildPurchaseInwardsDataset(
  options: BuildPurchaseInwardsOptions
): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;
  const isHistoryTab = filters.tab === "inward_history";

  if (isHistoryTab) {
    const columns: ExportColumn[] = [
      { key: "sr_no",        header: "Sr. No",         type: "number", width: 8,  center: true },
      { key: "insrno",       header: "Inward No.",     type: "string", width: 16, center: true },
      { key: "inpono",       header: "PO No.",         type: "string", width: 18, center: true },
      { key: "idate",        header: "Inward Date",    type: "date",   width: 14, center: true },
      { key: "vendorname",   header: "Supplier",       type: "string", width: 28, center: true },
      { key: "customername", header: "Customer",       type: "string", width: 26, center: true },
      { key: "projectid",    header: "Mould Code",     type: "string", width: 18, center: true },
      { key: "platename",    header: "Plate Name",     type: "string", width: 24, center: true },
      { key: "material",     header: "Material / Size",type: "string", width: 22, center: true },
      { key: "inward_qty",   header: "Received Qty",   type: "number", width: 14, center: true },
    ];

    let query = supabaseAdmin
      .from("po_inward")
      .select("id, insrno, inpono, idate, vname, cname, projectid, created_at")
      .order("id", { ascending: false })
      .limit(maxRows + 1);

    const { data: receipts, error } = await query;
    if (error) throw new Error(`Failed to query purchase inward receipts: ${error.message}`);

    const allReceipts = receipts || [];
    const receiptIds = allReceipts.map((r) => r.id);

    let items: any[] = [];
    if (receiptIds.length > 0) {
      const { data: rItems } = await supabaseAdmin
        .from("purchase_inward_items")
        .select("*")
        .in("inpid", receiptIds)
        .limit(10000);
      items = rItems || [];
    }

    const itemsByReceipt = new Map<number, any[]>();
    for (const item of items) {
      const list = itemsByReceipt.get(item.inpid) || [];
      list.push(item);
      itemsByReceipt.set(item.inpid, list);
    }

    const [customers, vendors] = await Promise.all([
      getCachedCustomers(),
      getCachedVendors(),
    ]);
    const custMap = new Map((customers || []).map((c: any) => [c.id, c.customername]));
    const vendMap = new Map((vendors || []).map((v: any) => [v.id, v.vendor_name]));

    const queryStr = (search || "").trim().toLowerCase();

    const flatRows: any[] = [];
    for (const r of allReceipts) {
      const rItems = itemsByReceipt.get(r.id) || [{}];
      const vName = vendMap.get(r.vname) || (r.vname ? String(r.vname) : "");
      const cName = custMap.get(r.cname) || (r.cname ? String(r.cname) : "");

      for (const it of rItems) {
        flatRows.push({
          insrno:       r.insrno || "",
          inpono:       r.inpono || "",
          idate:        r.idate || "",
          vendorname:   vName,
          customername: cName,
          projectid:    r.projectid || "",
          platename:    it.platename || it.material || "",
          material:     it.imaterial || it.material || "",
          inward_qty:   it.inward_qty != null ? Number(it.inward_qty) : "",
        });
      }
    }

    const filtered = flatRows.filter((row) => {
      if (!queryStr) return true;
      return (
        row.insrno.toLowerCase().includes(queryStr) ||
        row.inpono.toLowerCase().includes(queryStr) ||
        row.vendorname.toLowerCase().includes(queryStr) ||
        row.customername.toLowerCase().includes(queryStr) ||
        row.projectid.toLowerCase().includes(queryStr) ||
        row.platename.toLowerCase().includes(queryStr)
      );
    });

    const rows = filtered.map((r, idx) => ({
      sr_no: idx + 1,
      ...r,
    }));

    return {
      title: "Purchase Inward Receipts",
      subtitle: "Material gate receipts and inward logs against purchase orders",
      columns,
      rows,
      totalCount: rows.length,
      generatedAt: new Date().toISOString(),
      filtersApplied: { Tab: "Inward Receipt Log", ...(search ? { Search: search } : {}) },
    };
  }

  // Default: Pending Receive Items
  const columns: ExportColumn[] = [
    { key: "sr_no",        header: "Sr. No",        type: "number", width: 8,  center: true },
    { key: "srno",         header: "PO No.",        type: "string", width: 18, center: true },
    { key: "odate",        header: "Order Date",    type: "date",   width: 14, center: true },
    { key: "vendorname",   header: "Supplier",      type: "string", width: 28, center: true },
    { key: "customername", header: "Customer",      type: "string", width: 26, center: true },
    { key: "projectid",    header: "Mould Code",    type: "string", width: 18, center: true },
    { key: "platename",    header: "Plate Name",    type: "string", width: 24, center: true },
    { key: "materialtype", header: "Material Type", type: "string", width: 16, center: true },
    { key: "qty",          header: "Ordered Qty",   type: "number", width: 13, center: true },
    { key: "inward_qty",   header: "Received Qty",  type: "number", width: 13, center: true },
    { key: "pending_qty",  header: "Pending Qty",   type: "number", width: 13, center: true },
  ];

  let query = supabaseAdmin
    .from("view_po_pending_inward_qty")
    .select("*")
    .gt("pending_qty", 0)
    .order("id", { ascending: false })
    .limit(maxRows + 1);

  const { data: rawItems, error } = await query;
  if (error) throw new Error(`Failed to query pending purchase inward items: ${error.message}`);

  const allItems = rawItems || [];
  const queryStr = (search || "").trim().toLowerCase();

  const filtered = allItems.filter((it) => {
    if (!queryStr) return true;
    return (
      (it.srno         && String(it.srno).toLowerCase().includes(queryStr))         ||
      (it.vendorname   && String(it.vendorname).toLowerCase().includes(queryStr))   ||
      (it.customername && String(it.customername).toLowerCase().includes(queryStr)) ||
      (it.projectid    && String(it.projectid).toLowerCase().includes(queryStr))    ||
      (it.platename    && String(it.platename).toLowerCase().includes(queryStr))    ||
      (it.materialtype && String(it.materialtype).toLowerCase().includes(queryStr))
    );
  });

  const rows = filtered.map((it, idx) => ({
    sr_no:        idx + 1,
    srno:         it.srno || "",
    odate:        it.odate || "",
    vendorname:   it.vendorname || "",
    customername: it.customername || "",
    projectid:    it.projectid || "",
    platename:    it.platename || "",
    materialtype: it.materialtype || "",
    qty:          it.qty != null ? Number(it.qty) : "",
    inward_qty:   it.inward_qty != null ? Number(it.inward_qty) : 0,
    pending_qty:  it.pending_qty != null ? Number(it.pending_qty) : "",
  }));

  return {
    title: "Pending Purchase Inward Items",
    subtitle: "Open material items pending inward receipt from active purchase orders",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied: { Tab: "Pending Receive", ...(search ? { Search: search } : {}) },
  };
}
