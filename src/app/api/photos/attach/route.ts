import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

/** Movement creation now links evidence transactionally; generic reassignment is closed. */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ error: "Save photo evidence with the movement. Administrators can recover old unlinked uploads in Photo Storage." }, { status: 409 });
}
