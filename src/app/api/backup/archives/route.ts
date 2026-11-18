import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { storageConfig } from "../../../../../scripts/backup/storage.cjs";
import { authorizeBackupAdmin, backupUnavailable, backupStore } from "@/lib/backup/jobs";
import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { backupFilename } from "../../../../../scripts/backup/names.cjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const auth = await authorizeBackupAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const key = req.nextUrl.searchParams.get("key");
  const prefix = process.env.BACKUP_R2_PREFIX || 'database';
  if (key && (!key.startsWith(prefix + '/') || !key.endsWith(".sql") || key.includes("..") || /[\r\n]/.test(key))) {
    return NextResponse.json({ error: "Invalid backup key" }, { status: 400 });
  }
  try {
    const { client, bucket } = storageConfig();
    try {
      if (key) {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        const original = key.split("/").at(-1)!;
        const filename = original === 'database.sql' && head.LastModified ? backupFilename(head.LastModified.toISOString()) : original.replace(/[^a-zA-Z0-9._-]/g, "-");
        const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key,
          ResponseContentDisposition: `attachment; filename="${filename}"` }), { expiresIn: 60 });
        return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
      }
      const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix + '/',
        MaxKeys: 100, ContinuationToken: req.nextUrl.searchParams.get("cursor") || undefined }));
      return NextResponse.json({ bucket, files: (result.Contents || []).filter(item => item.Key?.endsWith(".sql")).map(item => ({
        key: item.Key, filename: item.Key!.split('/').at(-1) === 'database.sql' && item.LastModified ? backupFilename(item.LastModified.toISOString()) : item.Key!.split('/').at(-1), size: item.Size || 0, modified: item.LastModified?.toISOString() || null,
      })), nextCursor: result.IsTruncated ? result.NextContinuationToken : null }, { headers: { "Cache-Control": "no-store" } });
    } finally { client.destroy(); }
  } catch { return backupUnavailable(); }
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeBackupAdmin(req, true);
  if (auth instanceof NextResponse) return auth;
  let key;
  try { key = (await req.json()).key; } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (typeof key !== 'string' || !key.startsWith((process.env.BACKUP_R2_PREFIX || 'database') + '/') || !key.endsWith('.sql') || key.includes('..') || /[\r\n]/.test(key)) {
    return NextResponse.json({ error: "Invalid SQL backup key" }, { status: 400 });
  }
  try {
    const { client, bucket } = storageConfig();
    try { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); }
    finally { client.destroy(); }
    let metadataUpdated = true;
    try {
      await backupStore().pool.query(`UPDATE backup_control.jobs SET status='expired',manifest=NULL,error_code='DELETED_BY_ADMIN'
        WHERE status='completed' AND manifest->'files' @> $1::jsonb`, [JSON.stringify([{ key }])]);
    } catch { metadataUpdated = false; }
    return NextResponse.json({ deleted: true, metadataUpdated }, { headers: { "Cache-Control": "no-store" } });
  } catch { return backupUnavailable(); }
}
