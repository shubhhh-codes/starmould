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
      worker.name === "fallback" && Date.now() - new Date(worker.last_seen).getTime() < 6 * 60000);
    const fallbackEnabled = status.workers.some((worker: { name: string; fallback_enabled: boolean }) =>
      worker.name === "fallback" && worker.fallback_enabled);
    return NextResponse.json({ configured: true, ...status, workerHealthy, fallbackEnabled }, { headers });
  } catch { return backupUnavailable(); }
}
export async function POST(req: NextRequest) {
  const auth = await authorizeBackupAdmin(req, true);
  if (auth instanceof NextResponse) return auth;
  if (!jobsEnabled()) return backupUnavailable();
  const key = req.headers.get("idempotency-key") || "";
  if (!/^[a-f0-9-]{36}$/i.test(key)) return NextResponse.json({ error: "A valid idempotency key is required" }, { status: 400 });
  try {
    const job = await backupStore().enqueueManual(auth.id, key);
    return NextResponse.json({ job: publicJob(job) }, { status: 202, headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "BACKUPS_PAUSED") return NextResponse.json({ error: "Backups are paused" }, { status: 409, headers });
    if (code === "BACKUP_QUEUE_FULL") return NextResponse.json({ error: "Backup queue is full. Please wait." }, { status: 429, headers });
    return backupUnavailable();
  }
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
