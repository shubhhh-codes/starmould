import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCached, invalidateCache } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const isFresh =
    req.nextUrl.searchParams.get("fresh") === "true" ||
    req.headers.get("cache-control")?.includes("no-cache") ||
    req.headers.get("pragma") === "no-cache";

  if (isFresh) {
    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");
  }

  const tables = [
    "customers",
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
  ];

  const fetchTableCounts = async () => {
    // 1. Fast aggregation RPC (1 roundtrip instead of 16 individual queries)
    try {
      const { data: rpcCounts, error: rpcErr } = await supabaseAdmin.rpc("get_table_counts");
      if (!rpcErr && rpcCounts && typeof rpcCounts === "object") {
        return rpcCounts as Record<string, number | string>;
      }
    } catch {
      // Fallback to table queries
    }

    const resCounts: Record<string, number | string> = {};
    const softDeletableTables = new Set(["customers", "users", "subplate"]);

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
          resCounts[table] = error ? error.message : count ?? 0;
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
    try {
      const { data, error } = await supabaseAdmin.rpc("get_pipeline_stage_counts");
      if (!error && data) return data;
    } catch (err) {
      console.warn("RPC get_pipeline_stage_counts fallback:", err);
    }
    return null;
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
