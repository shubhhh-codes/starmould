import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runPhotoStorageMoves } from "@/lib/photos/storage-moves";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  const actual = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expected || !actual || Buffer.byteLength(expected) !== Buffer.byteLength(actual) || !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try { return NextResponse.json(await runPhotoStorageMoves(20), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Storage maintenance unavailable" }, { status: 503 }); }
}
