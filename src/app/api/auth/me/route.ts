import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { rolePermissionVersion } from "@/lib/permissions/version";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    const response = NextResponse.json({ user: null, error: auth.error }, { status: auth.status });
    if (auth.status === 401) response.cookies.delete("sm_session");
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return response;
  }

  let version: string;
  try { version = await rolePermissionVersion(auth.user.role_id); } catch {
    return NextResponse.json({ error: "Permission verification temporarily unavailable" }, { status: 503 });
  }
  const response = NextResponse.json({ user: { ...auth.user, permissions_version: version } });
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return response;
}
