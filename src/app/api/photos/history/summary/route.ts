import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readBoundedBody } from "@/lib/bounded-body";
import { historyFailure, historyScopes } from "@/lib/photos/history";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = JSON.parse(new TextDecoder().decode(await readBoundedBody(req, 32768)));
    const { authorized, denied } = await historyScopes(req, body.scopes);
    if (!authorized.length) return NextResponse.json({ summaries: [], denied }, { headers: { "Cache-Control": "private, no-store" } });
    const { data, error } = await supabaseAdmin.rpc("photo_history_summary", { p_scopes: authorized });
    if (error) throw new Error("Gallery summary query failed");
    return NextResponse.json({ summaries: data, denied }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = historyFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
