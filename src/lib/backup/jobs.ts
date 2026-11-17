import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createPool, Store } from "../../../scripts/backup/control.cjs";

const globalBackup = globalThis as typeof globalThis & { backupStore?: Store };
export function backupStore() {
  if (!globalBackup.backupStore) globalBackup.backupStore = new Store(createPool());
  return globalBackup.backupStore;
}
export async function authorizeBackupAdmin(req: NextRequest, mutation = false) {
  const auth = await authenticateRequest(req, [0]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role_id !== 0) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  if (mutation && (req.headers.get("origin") !== req.nextUrl.origin ||
    req.headers.get("sec-fetch-site") === "cross-site")) {
    return NextResponse.json({ error: "Same-origin request required" }, { status: 403 });
  }
  return auth.user;
}
export function jobsEnabled() { return process.env.BACKUP_JOBS_ENABLED === "true"; }
export function backupUnavailable() {
  return NextResponse.json({ error: "Backup service is not configured or is unavailable. Check the backup runbook." },
    { status: 503, headers: { "Cache-Control": "no-store" } });
}
export function publicJob(job: Record<string, unknown>) {
  const { id, kind, slot, status, source, attempts, scheduled_at, captured_at, completed_at, created_at, error_code } = job;
  return { id, kind, slot, status, source, attempts, scheduled_at, captured_at, completed_at, created_at, error_code };
}
