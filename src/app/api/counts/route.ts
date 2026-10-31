import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCached, invalidateCache } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Only invalidate server cache if authenticated Admin explicitly supplies bust flag (Issue #19)
  const isFresh =
    (req.nextUrl.searchParams.get("fresh") === "true" ||
      req.nextUrl.searchParams.get("bust") === "true") &&
    auth.user.role_id === 0;

  if (isFresh) {
    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");
  }

  const tables = [
    "customers",
    "vendors",
    "subplate",
    "scan",
    "purchase",
    "purchase_items",
    "po_inward",
    "purchase_inward_items",
    "challan",
    "challan_items",
    "inward",
    "inward_items",
    "dispatch",
    "dispatch_items",
    "expense",
    "worklog",
    "users",
    "quotations",
  ];

  const fetchTableCounts = async () => {
    // 1. Fast aggregation RPC (1 roundtrip instead of individual queries)
    try {
      const { data: rpcCounts, error: rpcErr } = await supabaseAdmin.rpc("get_table_counts");
      if (!rpcErr && rpcCounts && typeof rpcCounts === "object") {
        const countsObj = { ...(rpcCounts as Record<string, number | string>) };
        // Normalize singular aliases so both counts.subplate and counts.subplates work
        if (countsObj.subplates !== undefined) countsObj.subplate = countsObj.subplates;
        if (countsObj.scans !== undefined) countsObj.scan = countsObj.scans;
        if (countsObj.purchases !== undefined) countsObj.purchase = countsObj.purchases;
        if (countsObj.challans !== undefined) countsObj.challan = countsObj.challans;
        if (countsObj.dispatches !== undefined) countsObj.dispatch = countsObj.dispatches;
        if (countsObj.expenses !== undefined) countsObj.expense = countsObj.expenses;
        if (countsObj.worklogs !== undefined) countsObj.worklog = countsObj.worklogs;
        return countsObj;
      }
    } catch {
      // Fallback to table queries
    }

    const resCounts: Record<string, number | string> = {};
    const softDeletableTables = new Set(["customers", "vendors", "users", "subplate", "quotations"]);

    const pluralMap: Record<string, string> = {
      subplate: "subplates",
      scan: "scans",
      purchase: "purchases",
      po_inward: "po_inwards",
      challan: "challans",
      inward: "inwards",
      dispatch: "dispatches",
      expense: "expenses",
      worklog: "worklogs",
      quotation: "quotations",
    };

    await Promise.all(
      tables.map(async (table) => {
        try {
          let query = supabaseAdmin.from(table).select("*", { count: "exact", head: true });
          if (softDeletableTables.has(table)) {
            query = query.is("deleted_at", null);
          } else if (table === "scan") {
            query = query.neq("status", "completed");
          }
          const { count, error } = await query;
          const val = error ? error.message : count ?? 0;
          resCounts[table] = val;
          const pluralKey = pluralMap[table];
          if (pluralKey) {
            resCounts[pluralKey] = val;
          }
        } catch (err: unknown) {
          resCounts[table] = err instanceof Error ? err.message : "error";
        }
      })
    );
    return resCounts;
  };

  const counts = isFresh
    ? await fetchTableCounts()
    : await getCached("api_counts_all", 3, fetchTableCounts);

  const fetchPipelineCounts = async () => {
    let pipelineData: any = null;
    try {
      const { data, error } = await supabaseAdmin.rpc("get_pipeline_stage_counts");
      if (!error && data) pipelineData = data;
      if (error) console.warn("RPC get_pipeline_stage_counts error:", error.message);
    } catch (err) {
      console.warn("RPC get_pipeline_stage_counts fallback:", err);
    }

    // Direct database fallback if RPC is ever unreachable
    if (!pipelineData) {
      try {
        const { data: subplates } = await supabaseAdmin
          .from("subplate")
          .select("id, sqty, design_by, order_by, received_workby, received_qcby, vmc_workby, drilltap_workby, final_qcby, packing_workby")
          .is("deleted_at", null)
          .limit(100000);

        if (subplates) {
          const dp = subplates.filter((sp) => !sp.design_by || Number(sp.design_by) === 0).length;
          const dc = subplates.filter((sp) => sp.design_by && Number(sp.design_by) > 0).length;
          const op = subplates.filter((sp) => !sp.order_by || Number(sp.order_by) === 0).length;
          const oc = subplates.filter((sp) => sp.order_by && Number(sp.order_by) > 0).length;
          const pp = subplates.filter((sp) => ((sp.order_by && Number(sp.order_by) > 0) || (sp.received_workby && Number(sp.received_workby) > 0)) && (!sp.received_qcby || Number(sp.received_qcby) === 0)).length;
          const pc = subplates.filter((sp) => sp.received_qcby && Number(sp.received_qcby) > 0).length;
          const vp = subplates.filter((sp) => sp.received_qcby && Number(sp.received_qcby) > 0 && (!sp.vmc_workby || Number(sp.vmc_workby) === 0)).length;
          const vc = subplates.filter((sp) => sp.vmc_workby && Number(sp.vmc_workby) > 0).length;
          const dtp = subplates.filter((sp) => sp.vmc_workby && Number(sp.vmc_workby) > 0 && (!sp.drilltap_workby || Number(sp.drilltap_workby) === 0)).length;
          const dtc = subplates.filter((sp) => sp.drilltap_workby && Number(sp.drilltap_workby) > 0).length;
          const fqp = subplates.filter((sp) => sp.drilltap_workby && Number(sp.drilltap_workby) > 0 && (!sp.final_qcby || Number(sp.final_qcby) === 0)).length;
          const fqc = subplates.filter((sp) => sp.final_qcby && Number(sp.final_qcby) > 0).length;
          const pakp = subplates.filter((sp) => sp.final_qcby && Number(sp.final_qcby) > 0 && (!sp.packing_workby || Number(sp.packing_workby) === 0)).length;
          const pakc = subplates.filter((sp) => sp.packing_workby && Number(sp.packing_workby) > 0).length;

          pipelineData = {
            scantotal: Number(counts?.scan ?? 0),
            designPending: dp, designCompleted: dc,
            orderPending: op, orderCompleted: oc, orderPartial: 0,
            programmingPending: pp, programmingCompleted: pc,
            vmcPending: vp, vmcCompleted: vc,
            drilltapPending: dtp, drilltapCompleted: dtc,
            finalqcPending: fqp, finalqcCompleted: fqc,
            packingPending: pakp, packingCompleted: pakc,
            designby: dp, orderbytotal: op, receivedqcby: pp,
            vmcworkby: vp, drilltapworkby: dtp, finalqcby: fqp, packingworkby: pakp,
          };
        }
      } catch (fallbackErr) {
        console.warn("Direct pipeline count fallback error:", fallbackErr);
      }
    }

    // Accurately compute partial / full / pending PO counts
    if (pipelineData) {
      try {
        const [subplatesRes, poItemsRes] = await Promise.all([
          supabaseAdmin
            .from("subplate")
            .select("id, sqty")
            .is("deleted_at", null)
            .limit(100000),
          supabaseAdmin
            .from("purchase_items")
            .select("plateid, qty, purchase:pid!inner(status)")
            .neq("purchase.status", "0"),
        ]);

        if (subplatesRes.data) {
          const orderedMap: Record<number, number> = {};
          if (poItemsRes.data) {
            for (const item of poItemsRes.data) {
              const pid = Number(item.plateid);
              orderedMap[pid] = (orderedMap[pid] || 0) + (Number(item.qty) || 0);
            }
          }

          let pending = 0;
          let partial = 0;
          let completed = 0;

          for (const sp of subplatesRes.data) {
            const ord = orderedMap[sp.id] || 0;
            const total = Number(sp.sqty) || 1;
            if (ord >= total) {
              completed++;
            } else if (ord > 0) {
              partial++;
            } else {
              pending++;
            }
          }

          pipelineData.orderPending = pending;
          pipelineData.orderPartial = partial;
          pipelineData.orderCompleted = completed;
          pipelineData.orderbytotal = pending;
        }
      } catch (err) {
        console.warn("Error calculating accurate partial PO counts:", err);
      }
    }

    return pipelineData;
  };

  const pipeline = isFresh
    ? await fetchPipelineCounts()
    : await getCached("api_pipeline_stage_counts", 3, fetchPipelineCounts);

  const response = NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    counts,
    pipeline,
  });
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
