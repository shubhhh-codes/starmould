import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const isHttps = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const res = NextResponse.json({ success: true });
  res.cookies.set("sm_session", "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
  });
  return res;
}
