import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createSecurePrintToken } from "@/lib/print-token";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { type, id, code } = await req.json();
    if (!type || !id) {
      return NextResponse.json({ error: "Missing type or id" }, { status: 400 });
    }

    const token = createSecurePrintToken({ type, id, code });
    return NextResponse.json({ token, url: `/print/${type}/${token}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Token creation error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
