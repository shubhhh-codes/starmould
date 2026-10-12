import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCached } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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

  const counts = await getCached("api_counts_all", 15, async () => {
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
  });

  const response = NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    counts,
  });
  response.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
  return response;
}
