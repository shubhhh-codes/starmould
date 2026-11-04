import { NextRequest, NextResponse } from "next/server";
import { authorizeDocumentRead } from "@/lib/document-access";
import { createSecurePrintToken } from "@/lib/print-token";

export async function POST(req: NextRequest) {
  try {
    const { type, id, code } = await req.json();
    const access = await authorizeDocumentRead(req, type, id);
    if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });

    const token = createSecurePrintToken({ type, id, code });
    return NextResponse.json({ token, url: `/print/${type}/${token}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Token creation error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
