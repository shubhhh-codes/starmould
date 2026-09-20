import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7); // YYYY-MM

    // 1. Fetch worklogs for the specified month
    const { data: worklogs, error: wErr } = await supabaseAdmin
      .from("worklog")
      .select("*")
      .gte("rdate", `${month}-01`)
      .lte("rdate", `${month}-31`);

    if (wErr) {
      return NextResponse.json({ error: wErr.message }, { status: 500 });
    }

    // Downtime accumulators (in minutes)
    const downtimeMinutes: Record<string, number> = {
      vmc: 0,
      electric: 0,
      setting: 0,
      chhol: 0,
      operator: 0,
      lunch: 0,
      noanywork: 0,
    };

    for (const log of worklogs || []) {
      const type = (log.worktype || "").toLowerCase().trim();
      const parseMin = (val: string | null) => {
        if (!val) return 0;
        const parts = val.split(":");
        return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
      };

      const mins = parseMin(log.work_hr);
      if (type.includes("vmc")) downtimeMinutes.vmc += mins;
      else if (type.includes("electric")) downtimeMinutes.electric += mins;
      else if (type.includes("setting")) downtimeMinutes.setting += mins;
      else if (type.includes("chhol")) downtimeMinutes.chhol += mins;
      else if (type.includes("operator")) downtimeMinutes.operator += mins;
      else if (type.includes("lunch")) downtimeMinutes.lunch += mins;
      else if (type.includes("noanywork") || type.includes("no work")) downtimeMinutes.noanywork += mins;
    }

    // Format minutes into HH:MM
    const formatHours = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const downtimeReports = Object.entries(downtimeMinutes).map(([key, mins]) => ({
      category: key.toUpperCase(),
      minutes: mins,
      formattedTime: formatHours(mins),
    }));

    // 2. Fetch project pipeline counts from scan_dashboard_stats or scan
    const { data: stats } = await supabaseAdmin
      .from("scan_dashboard_stats")
      .select("*");

    let totalPlates = 0;
    let designPending = 0;
    let vmcPending = 0;
    let finalQcPending = 0;
    let packingPending = 0;

    for (const s of stats || []) {
      totalPlates += Number(s.total_plates) || 0;
      designPending += Number(s.design_pending) || 0;
      vmcPending += Number(s.vmc_pending) || 0;
      finalQcPending += Number(s.finalqc_pending) || 0;
      packingPending += Number(s.packing_pending) || 0;
    }

    return NextResponse.json({
      month,
      downtimeReports,
      totalLogs: worklogs?.length || 0,
      pipelineCounts: {
        totalPlates,
        designPending,
        vmcPending,
        finalQcPending,
        packingPending,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
