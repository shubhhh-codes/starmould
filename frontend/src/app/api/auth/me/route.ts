import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("sm_session");
  if (!cookie?.value) {
    // Default fallback admin user for development / offline intranet access
    return NextResponse.json({
      user: {
        id: 1,
        name: "Admin",
        username: "admin",
        role_id: 0,
        role: "Admin",
      },
    });
  }

  try {
    const user = JSON.parse(cookie.value);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({
      user: {
        id: 1,
        name: "Admin",
        username: "admin",
        role_id: 0,
        role: "Admin",
      },
    });
  }
}
