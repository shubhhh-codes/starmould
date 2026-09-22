import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

// Exact 7 downtime project codes tracked in ReportController.php:
// 0113_STM_002: VMC Fault
// 0114_STM_003: Electric Fault
// 0115_STM_004: Setting Time
// 0116_STM_005: Chhol Clearing
// 0117_STM_006: Operator Fault
// 0120_STM_007: Lunch Time
// 0130_STM_008: No Any Work

const DOWNTIME_PROJECTS: Record<string, string> = {
  "0113_STM_002": "vmc",
  "0114_STM_003": "electric",
  "0115_STM_004": "setting",
  "0116_STM_005": "chhol",
  "0117_STM_006": "operator",
  "0120_STM_007": "lunch",
  "0130_STM_008": "noanywork",
};

function parseTimeToHours(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(":");
  const h = parseFloat(parts[0]) || 0;
  const m = parseFloat(parts[1]) || 0;
  const s = parseFloat(parts[2]) || 0;
  return h + m / 60 + s / 3600;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") || "2023";

    // 1. Fetch worklogs for downtime calculation
    const { data: worklogs, error: wErr } = await supabaseAdmin
      .from("worklog")
      .select("id, projectid, work_hr, rdate, customerid")
      .order("rdate", { ascending: true });

    if (wErr) {
      return NextResponse.json({ error: wErr.message }, { status: 500 });
    }

    // Group downtime by month
    const monthsMap: Record<string, {
      month: string;
      vmc: number;
      electric: number;
      setting: number;
      chhol: number;
      operator: number;
      lunch: number;
      noanywork: number;
      totalHours: number;
    }> = {};

    for (const log of worklogs || []) {
      const dtCategory = DOWNTIME_PROJECTS[log.projectid];
      if (!dtCategory) continue;

      const dateStr = log.rdate || "";
      const monthKey = dateStr.slice(0, 7); // YYYY-MM
      if (!monthKey) continue;

      if (!monthsMap[monthKey]) {
        const d = new Date(`${monthKey}-01`);
        const monthLabel = d.toLocaleString("default", { month: "short", year: "numeric" });
        monthsMap[monthKey] = {
          month: monthLabel,
          vmc: 0,
          electric: 0,
          setting: 0,
          chhol: 0,
          operator: 0,
          lunch: 0,
          noanywork: 0,
          totalHours: 0,
        };
      }

      const hours = parseTimeToHours(log.work_hr);
      (monthsMap[monthKey] as any)[dtCategory] += hours;
      monthsMap[monthKey].totalHours += hours;
    }

    // Format numbers
    const downtimeRecords = Object.values(monthsMap).map((m) => ({
      ...m,
      vmc: Math.round(m.vmc * 100) / 100,
      electric: Math.round(m.electric * 100) / 100,
      setting: Math.round(m.setting * 100) / 100,
      chhol: Math.round(m.chhol * 100) / 100,
      operator: Math.round(m.operator * 100) / 100,
      lunch: Math.round(m.lunch * 100) / 100,
      noanywork: Math.round(m.noanywork * 100) / 100,
      totalHours: Math.round(m.totalHours * 100) / 100,
    }));

    // 2. Fetch scan table task counts by worktype
    const { data: scans, error: sErr } = await supabaseAdmin
      .from("scan")
      .select("id, worktype, amount, status, rdate");

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }

    const workflowCounts = {
      pulpMould: 0,
      tf: 0,
      rework: 0,
      machinePart: 0,
      accessories: 0,
      sample: 0,
      other: 0,
      totalProjects: (scans || []).length,
    };

    for (const s of scans || []) {
      const wt = (s.worktype || "").toLowerCase().trim();
      if (wt.includes("pulp")) workflowCounts.pulpMould++;
      else if (wt.includes("tf")) workflowCounts.tf++;
      else if (wt.includes("rework") || wt.includes("r.e.")) workflowCounts.rework++;
      else if (wt.includes("machine")) workflowCounts.machinePart++;
      else if (wt.includes("accessories")) workflowCounts.accessories++;
      else if (wt.includes("sample")) workflowCounts.sample++;
      else workflowCounts.other++;
    }

    // 3. Fetch subplate pipeline stats
    const { count: totalSubplates } = await supabaseAdmin
      .from("subplate")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      downtimeRecords,
      workflowCounts,
      totalSubplates: totalSubplates || 0,
      totalWorklogs: (worklogs || []).length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
