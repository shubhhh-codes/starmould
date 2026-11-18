import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";

interface BuildSubplatesOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildSubplatesDataset(
  options: BuildSubplatesOptions
): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "sr_no",      header: "Sr. No",      type: "number", width: 8,  center: true },
    { key: "platename",  header: "Plate Name",  type: "string", width: 22, center: true },
    { key: "mold_code",  header: "Mould Code",  type: "string", width: 18, center: true },
    { key: "shape",      header: "Shape",       type: "string", width: 14, center: true },
    { key: "material",   header: "Material",    type: "string", width: 16, center: true },
    { key: "dimensions", header: "Dimensions",  type: "string", width: 22, center: true },
    { key: "weight",     header: "Weight (kg)", type: "number", width: 14, center: true },
    { key: "sqty",       header: "Qty",         type: "number", width: 10, center: true },
    { key: "location",   header: "Location",    type: "string", width: 16, center: true },
    { key: "status",     header: "Status",      type: "string", width: 14, center: true },
  ];

  let query = supabaseAdmin
    .from("subplate")
    .select("id, platename, mold_code, projectid, shape, material, width, height, length, weight, unit, sqty, location, dispatch_status, status, created_at")
    .is("deleted_at", null)
    .order("id", { ascending: false })
    .limit(maxRows + 1);

  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  }

  const { data: rawSubplates, error } = await query;
  if (error) throw new Error(`Failed to query subplates: ${error.message}`);

  const allSubplates = rawSubplates || [];
  const queryStr = (search || "").trim().toLowerCase();

  const formatted = allSubplates.map((sp) => {
    const dimParts = [sp.width, sp.height, sp.length].filter((x) => x != null && x !== "");
    const dimStr = dimParts.length > 0 ? `${dimParts.join(" × ")} ${sp.unit || "mm"}` : "";
    return {
      id:         sp.id,
      platename:  sp.platename || "",
      mold_code:  sp.mold_code || (sp.projectid ? String(sp.projectid) : ""),
      shape:      sp.shape || "",
      material:   sp.material || "",
      dimensions: dimStr,
      weight:     sp.weight != null ? Number(sp.weight) : "",
      sqty:       sp.sqty != null ? Number(sp.sqty) : 1,
      location:   sp.location || "",
      status:     sp.dispatch_status || sp.status || "Active",
    };
  });

  const filtered = formatted.filter((sp) => {
    if (!queryStr) return true;
    return (
      sp.platename.toLowerCase().includes(queryStr) ||
      sp.mold_code.toLowerCase().includes(queryStr) ||
      sp.shape.toLowerCase().includes(queryStr) ||
      sp.material.toLowerCase().includes(queryStr) ||
      sp.location.toLowerCase().includes(queryStr)
    );
  });

  const rows = filtered.map((sp, idx) => ({
    sr_no: idx + 1,
    ...sp,
  }));

  const filtersApplied: Record<string, string> = {};
  if (search) filtersApplied["Search Query"] = search;

  return {
    title: "Subplates Master Directory",
    subtitle: "Complete inventory of mould components, steel plates, dimensions, and machining weights",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
