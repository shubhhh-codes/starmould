import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "../../../../../../scripts/backup/storage.cjs";
import { authorizeBackupAdmin, backupStore, backupUnavailable, jobsEnabled } from "@/lib/backup/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await authorizeBackupAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!jobsEnabled()) return backupUnavailable();
  const id = req.nextUrl.searchParams.get("id");
  const format = req.nextUrl.searchParams.get("format") || "sql";
  if (!id || format !== "sql") return NextResponse.json({ error: "Invalid backup request" }, { status: 400 });
  try {
    const job = await backupStore().get(id);
    if (!job || job.status !== "completed" || !job.manifest ||
      Date.now() - new Date(job.completed_at).getTime() >= 90 * 86400000) {
      return NextResponse.json({ error: "Completed backup unavailable or expired" }, { status: 404 });
    }
    const file = job.manifest.files.find((item: { format: string }) => item.format === format);
    if (!file) return NextResponse.json({ error: "Backup format unavailable" }, { status: 404 });
    const { client, bucket } = storageConfig();
    try {
      const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: file.key,
        ResponseContentType: "application/octet-stream",
        ResponseContentDisposition: `attachment; filename="${file.key.split("/").at(-1)?.replace(/[^a-zA-Z0-9_.-]/g, "_") || "starmould_backup.sql"}"` }), { expiresIn: 60 });
      return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    } finally { client.destroy(); }
  } catch { return backupUnavailable(); }
}
