import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/scanning/preview-id - Fast atomic RPC preview of next Project Code
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, undefined, "nav_scanning");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId")?.trim() || null;

    // Single source of truth: Invoke atomic PostgreSQL RPC
    const { data, error } = await supabaseAdmin.rpc("get_next_project_code_preview", {
      p_customer_id: customerId,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to calculate preview ID";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
