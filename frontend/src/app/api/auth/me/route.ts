import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ user: null, error: auth.error }, { status: 401 });
  }

  return NextResponse.json({ user: auth.user });
}
