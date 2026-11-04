import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { BackupResult } from "./engine";

const bucket = "database-backups";
export async function retainBackup(backup: BackupResult) {
  const storage = supabaseAdmin.storage.from(bucket);
  const { data: bucketInfo, error: bucketError } = await supabaseAdmin.storage.getBucket(bucket);
  if (bucketError || !bucketInfo || bucketInfo.public) throw new Error("Private backup bucket unavailable");
  const prefix = `${Date.now()}-${crypto.randomUUID()}`;
  const objects: { bucket: string; path: string; size: number; sha256: string }[] = [];
  for (const [format, content] of [["sql", backup.sqlContent], ["json", backup.jsonContent]] as const) {
    if (!content) throw new Error("Backup content missing");
    const body = Buffer.from(content, "utf8");
    const path = `${prefix}.${format}`;
    const sha256 = crypto.createHash("sha256").update(body).digest("hex");
    const { error } = await storage.upload(path, body, { contentType: "application/octet-stream", upsert: false });
    if (error) throw new Error("Backup upload failed");
    const { data, error: readError } = await storage.download(path);
    if (readError || !data) throw new Error("Backup persistence verification failed");
    const persisted = Buffer.from(await data.arrayBuffer());
    if (persisted.length !== body.length || crypto.createHash("sha256").update(persisted).digest("hex") !== sha256) {
      throw new Error("Backup checksum mismatch");
    }
    objects.push({ bucket, path, size: body.length, sha256 });
  }
  // List before removing so pagination offsets cannot skip objects after a deletion.
  const expired: string[] = [];
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list("", { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error || !data) throw new Error("Backup retention listing failed");
    expired.push(...data.filter((object) => /^\d+-[a-f0-9-]+\.(sql|json)$/.test(object.name) &&
      object.created_at && Date.parse(object.created_at) < cutoff).map((object) => object.name));
    if (data.length < 1000) break;
  }
  for (let start = 0; start < expired.length; start += 100) {
    const { error } = await storage.remove(expired.slice(start, start + 100));
    if (error) throw new Error("Backup retention cleanup failed");
  }
  return objects;
}
