import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
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
    "profiles",
  ];

  const counts: Record<string, number | string> = {};

  for (const table of tables) {
    try {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select("*", { count: "exact", head: true });
      counts[table] = error ? error.message : count ?? 0;
    } catch (err: unknown) {
      counts[table] = err instanceof Error ? err.message : "error";
    }
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    counts,
  });
}
