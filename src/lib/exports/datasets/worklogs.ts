import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";
import { getCachedCustomers, getCachedUsers } from "@/lib/cache";

interface BuildWorklogsOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildWorklogsDataset(
  options: BuildWorklogsOptions
): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "sr_no",          header: "Sr. No",      type: "number", width: 8,  center: true },
    { key: "rdate",          header: "Date",        type: "date",   width: 13, center: true },
    { key: "customername",   header: "Customer",    type: "string", width: 26, center: true },
    { key: "projectid",      header: "Mould Code",  type: "string", width: 16, center: true },
    { key: "subplateid",     header: "Subplate",    type: "string", width: 14, center: true },
    { key: "username",       header: "Staff",       type: "string", width: 18, center: true },
    { key: "work_hr",        header: "Duration",    type: "string", width: 12, center: true },
    { key: "starttime",      header: "Start Time",  type: "string", width: 12, center: true },
    { key: "endtime",        header: "End Time",    type: "string", width: 12, center: true },
    { key: "workdescription", header: "Description", type: "string", width: 36 }, // Left-aligned description
  ];

  let query = supabaseAdmin
    .from("worklog")
    .select("id, rdate, customerid, projectid, subplateid, work_hr, starttime, endtime, workdescription, userid, created_at")
    .order("id", { ascending: false })
    .limit(maxRows + 1);

  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  }

  const [res, customers, users] = await Promise.all([
    query,
    getCachedCustomers().catch(() => []),
    getCachedUsers().catch(() => []),
  ]);

  if (res.error) throw new Error(`Failed to query worklogs: ${res.error.message}`);

  const custMap = new Map<string | number, string>();
  for (const c of customers || []) {
    custMap.set(c.id, c.name || c.cname || "");
    custMap.set(String(c.id), c.name || c.cname || "");
  }

  const userMap = new Map<string | number, string>();
  for (const u of users || []) {
    userMap.set(u.id, u.name || u.username || "");
    userMap.set(Number(u.id), u.name || u.username || "");
  }

  const allLogs = res.data || [];
  const queryStr = (search || "").trim().toLowerCase();

  const formatted = allLogs.map((w) => {
    const custName = custMap.get(w.customerid) || "";
    const staffName = userMap.get(w.userid) || "";
    return {
      id: w.id,
      rdate: w.rdate ? String(w.rdate).split("T")[0] : "",
      customername: custName,
      projectid: w.projectid || "",
      subplateid: w.subplateid || "",
      username: staffName,
      work_hr: w.work_hr || "",
      starttime: w.starttime || "",
      endtime: w.endtime || "",
      workdescription: w.workdescription || "",
    };
  });

  const filtered = formatted.filter((w) => {
    if (!queryStr) return true;
    return (
      w.projectid.toLowerCase().includes(queryStr) ||
      w.customername.toLowerCase().includes(queryStr) ||
      w.username.toLowerCase().includes(queryStr) ||
      w.subplateid.toLowerCase().includes(queryStr) ||
      w.workdescription.toLowerCase().includes(queryStr)
    );
  });

  const rows = filtered.map((w, idx) => ({
    sr_no: idx + 1,
    ...w,
  }));

  const filtersApplied: Record<string, string> = {};
  if (search) filtersApplied["Search Query"] = search;

  return {
    title: "Production Work Logs",
    subtitle: "Departmental activity records, machine cycles, staff hours, and production notes",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
