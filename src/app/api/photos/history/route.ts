import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { readBoundedBody } from "@/lib/bounded-body";
import { historyFailure, readHistoryPage } from "@/lib/photos/history";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = JSON.parse(new TextDecoder().decode(await readBoundedBody(req, 32768)));
    return NextResponse.json(await readHistoryPage(req, body), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = historyFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
