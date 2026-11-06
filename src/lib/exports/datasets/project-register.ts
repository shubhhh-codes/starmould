import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";
import { getCachedCustomers } from "@/lib/cache";

interface BuildProjectRegisterOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildProjectRegisterDataset(
  options: BuildProjectRegisterOptions
): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "projectid", header: "Mould Code", type: "string", width: 16 },
    { key: "customername", header: "Customer Name", type: "string", width: 24 },
    { key: "worktype", header: "Work Type", type: "string", width: 14 },
    { key: "description", header: "Description", type: "string", width: 30 },
    { key: "rdate", header: "Received Date", type: "date", width: 12 },
    { key: "dispatchdate", header: "Dispatch Date", type: "date", width: 12 },
    { key: "total_plates", header: "Total Plates", type: "number", width: 10 },
    { key: "dispatched_plates", header: "Dispatched", type: "number", width: 10 },
    { key: "closed_plates", header: "Closed w/o Challan", type: "number", width: 12 },
    { key: "scan_hr", header: "Machining Hr", type: "number", width: 10 },
    { key: "status", header: "Status", type: "status", width: 12 },
  ];

  let query = supabaseAdmin
    .from("scan")
    .select(`
      id,
      projectid,
      cname,
      customer_id,
      description,
      worktype,
      status,
      rdate,
      cdate,
      dispatchdate,
      scan_hr,
      created_at
    `)
    // Strictly completed / registered moulds for Project Register
    .in("status", ["completed", "registered", "Completed", "Registered"])
    .order("id", { ascending: false });

  if (filters.worktype && filters.worktype !== "ALL") {
    query = query.eq("worktype", filters.worktype);
  }

  if (filters.customer && filters.customer !== "ALL") {
    const isNum = !isNaN(Number(filters.customer));
    if (isNum) {
      query = query.eq("customer_id", Number(filters.customer));
    } else {
      query = query.eq("cname", filters.customer);
    }
  }

  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  }

  query = query.limit(maxRows + 1);

  const { data: rawScans, error: scanErr } = await query;
  if (scanErr) {
    throw new Error(`Failed to query project register for export: ${scanErr.message}`);
  }

  const allScans = rawScans || [];
  if (allScans.length > maxRows) {
    throw new Error(
      `Export limit exceeded. Maximum allowable rows for ${format.toUpperCase()} is ${maxRows}. Please narrow down your search or filters.`
    );
  }

  const customers = await getCachedCustomers();
  const custMap = new Map((customers || []).map((c: any) => [c.id, c.customername]));
  const custNameMap = new Map((customers || []).map((c: any) => [c.customername?.toLowerCase().trim(), c.customername]));

  const scanIds = allScans.map((s) => s.id);
  const scanCodes = allScans.map((s) => s.projectid).filter(Boolean);

  const subplatesByScanId = new Map<number, any[]>();
  const subplatesByScanCode = new Map<string, any[]>();

  if (scanIds.length > 0) {
    const orClauses: string[] = [`mold_id.in.(${scanIds.join(",")})`, `projectid.in.(${scanIds.join(",")})`];
    if (scanCodes.length > 0) {
      orClauses.push(`mold_code.in.(${scanCodes.map((c) => `"${c}"`).join(",")})`);
    }

    const { data: subplates } = await supabaseAdmin
      .from("subplate")
      .select("id, platename, mold_id, projectid, mold_code, subprojectid, shape, material, width, height, length, weight, unit, sqty, location, dispatch_status")
      .or(orClauses.join(","))
      .is("deleted_at", null)
      .order("id", { ascending: true });

    if (subplates) {
      for (const sp of subplates) {
        const moldId = sp.mold_id || (Number(sp.projectid) || null);
        if (moldId) {
          const list = subplatesByScanId.get(moldId) || [];
          list.push(sp);
          subplatesByScanId.set(moldId, list);
        }
        if (sp.mold_code) {
          const list = subplatesByScanCode.get(sp.mold_code) || [];
          list.push(sp);
          subplatesByScanCode.set(sp.mold_code, list);
        }
      }
    }
  }

  const queryStr = (search || "").trim().toLowerCase();

  const rows = allScans
    .map((s) => {
      const custName =
        (s.customer_id ? custMap.get(s.customer_id) : null) ||
        (s.cname ? (custMap.get(Number(s.cname)) || custNameMap.get(String(s.cname).toLowerCase().trim()) || s.cname) : "—");

      const plates = subplatesByScanId.get(s.id) || (s.projectid ? subplatesByScanCode.get(s.projectid) : null) || [];
      const dispCount = plates.filter((sp: any) => sp.location === "Customer" || sp.dispatch_status === "dispatched").length;
      const closedCount = plates.filter((sp: any) => sp.dispatch_status === "closed_without_challan").length;

      return {
        id: s.id,
        projectid: s.projectid || `#${s.id}`,
        customername: custName,
        worktype: s.worktype || "—",
        description: s.description || "—",
        rdate: s.rdate || null,
        dispatchdate: s.dispatchdate || null,
        total_plates: plates.length,
        dispatched_plates: dispCount,
        closed_plates: closedCount,
        scan_hr: Number(s.scan_hr) || 0,
        status: s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : "Completed",
        subplates: plates.map((sp: any) => ({
          id: sp.id,
          platename: sp.platename || "—",
          subprojectid: sp.subprojectid || "—",
          shape: sp.shape || "—",
          material: sp.material || "—",
          width: sp.width != null ? Number(sp.width) : null,
          height: sp.height != null ? Number(sp.height) : null,
          length: sp.length != null ? Number(sp.length) : null,
          weight: sp.weight != null ? Number(sp.weight) : null,
          unit: sp.unit || "mm",
          sqty: sp.sqty != null ? Number(sp.sqty) : 1,
        })),
      };
    })
    .filter((row) => {
      if (!queryStr) return true;
      const matchMould =
        row.projectid.toLowerCase().includes(queryStr) ||
        row.customername.toLowerCase().includes(queryStr) ||
        row.description.toLowerCase().includes(queryStr) ||
        row.worktype.toLowerCase().includes(queryStr);
      if (matchMould) return true;
      return row.subplates.some((sp: any) =>
        sp.platename.toLowerCase().includes(queryStr) ||
        sp.subprojectid.toLowerCase().includes(queryStr) ||
        sp.material.toLowerCase().includes(queryStr)
      );
    });

  const filtersApplied: Record<string, string> = { "Archive": "Completed / Registered" };
  if (filters.worktype && filters.worktype !== "ALL") filtersApplied["Work Type"] = filters.worktype;
  if (filters.customer && filters.customer !== "ALL") {
    filtersApplied["Customer"] = custMap.get(Number(filters.customer)) || String(filters.customer);
  }
  if (search) filtersApplied["Search Query"] = search;
  if (scope === "selected") filtersApplied["Scope"] = `${selectedIds?.length || 0} Selected Rows`;

  return {
    title: "Completed Mould Register",
    subtitle: "Permanent historical archive of finished moulds, component lifecycles, and audit records",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
