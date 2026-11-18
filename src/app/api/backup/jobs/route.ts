import { NextRequest, NextResponse } from "next/server";
import { authorizeBackupAdmin, backupStore, backupUnavailable, jobsEnabled, publicJob } from "@/lib/backup/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const auth = await authorizeBackupAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!jobsEnabled()) return NextResponse.json({ configured: false, jobs: [], workers: [] }, { headers });
  try {
    const store = backupStore();
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const job = await store.get(id);
      if (!job) return NextResponse.json({ error: "Backup not found" }, { status: 404, headers });
      return NextResponse.json({ job: publicJob(job) }, { headers });
    }
    const status = await store.status();
    const workerHealthy = status.workers.some((worker: { name: string; last_seen: string }) =>
      worker.name === "server-cron" && Date.now() - new Date(worker.last_seen).getTime() < 3 * 60000);
    const fallbackEnabled = status.workers.some((worker: { name: string; fallback_enabled: boolean }) =>
      worker.name === "server-cron" && worker.fallback_enabled);
    return NextResponse.json({ configured: true, ...status, workerHealthy, fallbackEnabled }, { headers });
  } catch { return backupUnavailable(); }
}
export async function PATCH(req: NextRequest) {
  const auth = await authorizeBackupAdmin(req, true);
  if (auth instanceof NextResponse) return auth;
  if (!jobsEnabled()) return backupUnavailable();
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (typeof body?.paused !== "boolean") return NextResponse.json({ error: "paused must be a boolean" }, { status: 400 });
  try {
    await backupStore().pause(body.paused);
    return NextResponse.json({ paused: body.paused }, { headers });
  } catch { return backupUnavailable(); }
}
