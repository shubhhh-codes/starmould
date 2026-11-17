import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deleteFromR2, getFromR2Buffer, uploadToR2 } from "@/lib/r2/client";
import { LayoutContext, LayoutPhoto, photoObjectKey } from "./storage-layout";

export async function photoLayoutContext(photo: LayoutPhoto): Promise<LayoutContext> {
  const [projects, events, plate] = await Promise.all([
    supabaseAdmin.from("photo_project_associations").select("project_code,mould_code").eq("photo_id", photo.id),
    supabaseAdmin.from("photo_event_associations").select("event_id,document_id,document_number,created_at").eq("photo_id", photo.id).order("created_at"),
    photo.subplate_id ? supabaseAdmin.from("subplate").select("subprojectid,projectid").eq("id", photo.subplate_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (projects.error || events.error || plate.error) throw new Error("Could not resolve authoritative photo folders");
  // Canonical project codes are the mould folders used throughout the CRM.
  const moulds = (projects.data || []).map(p => p.project_code).filter(Boolean);
  if (plate.data?.projectid) moulds.push(plate.data.projectid);
  const linked = (events.data || []).filter(e => e.document_id);
  const eventId = events.data?.[0]?.event_id;
  const firstEvent = eventId ? await supabaseAdmin.from("photo_event_associations").select("created_at")
    .eq("event_id", eventId).order("created_at").limit(1).maybeSingle() : { data: null, error: null };
  if (firstEvent.error) throw new Error("Could not resolve photo event timestamp");
  return {
    moulds,
    documents: linked.map(e => ({ id: e.document_id, number: e.document_number })),
    subplateCode: plate.data?.subprojectid,
    eventId,
    eventTime: firstEvent.data?.created_at,
  };
}

/** Bounded, durable jobs. Failures leave the old DB pointer intact and are retried. */
export async function runPhotoStorageMoves(limit = 10, photoIds?: number[]) {
  const result = { moved: 0, unchanged: 0, failed: 0, cleaned: 0 };
  for (let i = 0; i < Math.min(limit, 50); i++) {
    const { data: job, error } = await supabaseAdmin.rpc("claim_photo_storage_move", { p_ids: photoIds || null });
    if (error) throw new Error(`Storage folder queue unavailable: ${error.message}`);
    if (!job) break;
    const photo = job.photo as LayoutPhoto & { deleted_at: string | null };
    let target = photo.r2_key;
    try {
      if (photo.deleted_at) {
        const prepared = await supabaseAdmin.rpc("prepare_photo_storage_move", { p_id: photo.id, p_token: job.token, p_target: target });
        if (prepared.error || !prepared.data) throw new Error("Deleted photo cleanup lease unavailable");
      } else {
        target = photoObjectKey(photo, await photoLayoutContext(photo));
        if (target !== photo.r2_key) {
          const prepared = await supabaseAdmin.rpc("prepare_photo_storage_move", { p_id: photo.id, p_token: job.token, p_target: target });
          if (prepared.error || !prepared.data) throw new Error("Photo folder lease unavailable");
          const body = await getFromR2Buffer(photo.r2_key);
          if (!body) throw new Error("Original photo object missing; restore before migrating");
          await uploadToR2({ key: target, body, contentType: "image/webp", metadata: { photoId: String(photo.id), uploadedAt: photo.server_uploaded_at } });
          const copy = await getFromR2Buffer(target);
          const hash = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
          if (!copy || copy.length !== body.length || hash(copy) !== hash(body)) throw new Error("Photo copy verification failed");
        }
      }
      const finished = await supabaseAdmin.rpc("finish_photo_storage_move", {
        p_id: photo.id, p_token: job.token, p_revision: job.revision, p_old: photo.r2_key, p_new: target,
      });
      if (finished.error) throw new Error(finished.error.message);
      if (finished.data) {
        if (target === photo.r2_key) result.unchanged++;
        else result.moved++;
      }
      // Retain the photo lease through cleanup. Another mover cannot copy back into a key being deleted.
      result.cleaned += await cleanOldPhotoKeys(photo.id);
      const released = await supabaseAdmin.rpc("release_photo_storage_move", { p_id: photo.id, p_token: job.token });
      if (released.error) throw new Error(released.error.message);
    } catch (error) {
      result.failed++;
      await supabaseAdmin.rpc("finish_photo_storage_move", {
        p_id: photo.id, p_token: job.token, p_revision: job.revision, p_old: photo.r2_key, p_new: target,
        p_error: error instanceof Error ? error.message : "Storage move failed",
      });
    }
  }
  return result;
}

async function cleanOldPhotoKeys(photoId: number): Promise<number> {
  let cleaned = 0;
  const oldKeys = await supabaseAdmin.from("photo_storage_old_keys").select("object_key,created_at").eq("photo_id", photoId).order("created_at").limit(50);
  if (oldKeys.error) throw new Error(oldKeys.error.message);
  for (const { object_key: key, created_at: createdAt } of oldKeys.data || []) {
    const references = await supabaseAdmin.from("movement_photos").select("id", { count: "exact", head: true }).eq("r2_key", key).is("deleted_at", null);
    if (references.error) throw new Error(references.error.message);
    if (references.count) {
      // A cancelled/replayed move may have journalled the current live key.
      const removed = await supabaseAdmin.from("photo_storage_old_keys").delete().eq("object_key", key);
      if (removed.error) throw new Error(removed.error.message);
      continue;
    }
    // A short read grace period prevents breaking requests that fetched the old pointer just before the move.
    if (Date.now() - Date.parse(createdAt) < 60_000) continue;
    if (await deleteFromR2(key)) {
      const removed = await supabaseAdmin.from("photo_storage_old_keys").delete().eq("object_key", key);
      if (removed.error) throw new Error(removed.error.message);
      cleaned++;
    }
  }
  return cleaned;
}

/** Folder maintenance must never report an already committed movement as failed. */
export async function tryPhotoStorageMoves(photoIds: number[]) {
  if (!photoIds.length) return;
  try { await runPhotoStorageMoves(Math.min(photoIds.length, 10), photoIds); }
  catch (error) { console.warn("[PhotoFolders] Durable queue will retry", error instanceof Error ? error.message : error); }
}
