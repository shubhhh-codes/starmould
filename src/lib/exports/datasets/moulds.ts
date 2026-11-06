import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";
import { getCachedCustomers } from "@/lib/cache";

interface BuildMouldsOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildMouldsDataset(options: BuildMouldsOptions): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, hasFinancialAccess, format } = options;

  // Row limits from Section 5.6 of System Design
  const maxRows = format === "pdf" ? 500 : 5000;

  // 1. Define columns
  const columns: ExportColumn[] = [
    { key: "projectid", header: "Mould Code", type: "string", width: 16 },
    { key: "customername", header: "Customer Name", type: "string", width: 24 },
    { key: "worktype", header: "Work Type", type: "string", width: 14 },
    { key: "description", header: "Description", type: "string", width: 30 },
    { key: "rdate", header: "Received Date", type: "date", width: 12 },
    { key: "cdate", header: "Target Date", type: "date", width: 12 },
    { key: "total_plates", header: "Plates", type: "number", width: 8 },
    { key: "status", header: "Status", type: "status", width: 12 },
  ];

  // 2. Build Supabase query
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
      created_at
    `)
    .order("id", { ascending: false });

  // Exclude Sample if standard production list
  if (filters.excludeSamples !== false) {
    query = query.neq("worktype", "Sample");
  }

  // Filter: status (Dashboard strictly excludes completed / registered moulds)
  if (filters.status && filters.status !== "ALL") {
    query = query.ilike("status", filters.status);
  } else {
    // Default dashboard moulds: strictly active manufacturing pipeline only
    // Exclude completed and registered projects (which belong to Project Register)
    query = query.not("status", "in", '("completed","registered","Completed","Registered")');
  }

  // Filter: customer
  if (filters.customer && filters.customer !== "ALL") {
    const isNum = !isNaN(Number(filters.customer));
    if (isNum) {
      query = query.eq("customer_id", Number(filters.customer));
    } else {
      query = query.eq("cname", filters.customer);
    }
  }

  // Filter: worktype
  if (filters.worktype && filters.worktype !== "ALL") {
    query = query.eq("worktype", filters.worktype);
  }

  // Scope: selected IDs
  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    const numIds = selectedIds.map(Number).filter((n) => !isNaN(n) && n > 0);
    if (numIds.length > 0) {
      query = query.in("id", numIds);
    }
  }

  // Limit query to maxRows + 1 to detect overflow
  query = query.limit(maxRows + 1);

  const { data: rawScans, error: scanErr } = await query;
  if (scanErr) {
    throw new Error(`Failed to query moulds for export: ${scanErr.message}`);
  }

  const filteredScans = (rawScans || []).filter((s) => {
    if (filters.status && filters.status !== "ALL") {
      return String(s.status || "").toLowerCase() === String(filters.status).toLowerCase();
    }
    const st = String(s.status || "").toLowerCase();
    return st !== "completed" && st !== "registered";
  });

  const allScans = filteredScans;
  if (allScans.length > maxRows) {
    throw new Error(
      `Export limit exceeded. Maximum allowable rows for ${format.toUpperCase()} is ${maxRows}. Please narrow down your search or filters.`
    );
  }

  // 3. Resolve Customer Names & Subplates
  const customers = await getCachedCustomers();
  const custMap = new Map((customers || []).map((c: any) => [c.id, c.customername]));
  const custNameMap = new Map((customers || []).map((c: any) => [c.customername?.toLowerCase().trim(), c.customername]));

  // Fetch all subplates for retrieved scan projects
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
      .select("id, platename, mold_id, projectid, mold_code, subprojectid, shape, material, width, height, length, weight, unit, sqty")
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

  // 4. Transform and filter by search if provided
  const queryStr = (search || "").trim().toLowerCase();

  const rows = allScans
    .map((s) => {
      const custName =
        (s.customer_id ? custMap.get(s.customer_id) : null) ||
        (s.cname ? (custMap.get(Number(s.cname)) || custNameMap.get(String(s.cname).toLowerCase().trim()) || s.cname) : "—");

      const plates = subplatesByScanId.get(s.id) || (s.projectid ? subplatesByScanCode.get(s.projectid) : null) || [];

      return {
        id: s.id,
        projectid: s.projectid || `#${s.id}`,
        customername: custName,
        worktype: s.worktype || "—",
        description: s.description || "—",
        rdate: s.rdate || null,
        cdate: s.cdate || null,
        total_plates: plates.length,
        status: s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : "Pending",
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

  // 5. Build filter summary for metadata header
  const filtersApplied: Record<string, string> = {};
  if (filters.status && filters.status !== "ALL") filtersApplied["Status"] = filters.status;
  if (filters.worktype && filters.worktype !== "ALL") filtersApplied["Work Type"] = filters.worktype;
  if (filters.customer && filters.customer !== "ALL") {
    filtersApplied["Customer"] = custMap.get(Number(filters.customer)) || String(filters.customer);
  }
  if (search) filtersApplied["Search Query"] = search;
  if (scope === "selected") filtersApplied["Scope"] = `${selectedIds?.length || 0} Selected Rows`;

  return {
    title: "Mould Projects Report",
    subtitle: "Active manufacturing pipeline and workpiece status",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
