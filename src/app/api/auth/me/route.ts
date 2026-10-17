import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ user: null, error: auth.error }, { status: 401 });
  }

  const response = NextResponse.json({ user: auth.user });
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return response;
}
