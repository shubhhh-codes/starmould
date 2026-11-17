import { createHash } from "node:crypto";

export interface LayoutPhoto {
  id: number;
  r2_key: string;
  movement_type: string;
  stage_key: string | null;
  subplate_id: number | null;
  server_uploaded_at: string;
  claim_batch_id?: string | null;
}
export interface LayoutContext {
  moulds: string[];
  documents: { id: number; number: string | null }[];
  subplateCode?: string | null;
  eventId?: string | null;
  eventTime?: string | null;
}

/** Object keys are relative to the bucket. Never prepend the bucket name. */
export function folderSegment(value: string, fallback = "unknown"): string {
  const cleaned = value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/\s+/g, "_")
    .replace(/^\.+|[. ]+$/g, "");
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  if (cleaned.length <= 100) return cleaned;
  return `${cleaned.slice(0, 80)}_${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;
}

export function istFileTime(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error("Photo upload timestamp is missing or invalid");
  return new Date(ms + 330 * 60_000).toISOString().slice(0, 19).replace("T", "_").replaceAll(":", "-") + "_IST";
}

export function photoCategory(type: string, stage?: string | null): string {
  if (type === "subplate_qc") {
    if (stage === "vmc_qcby") return "vmc_qc";
    if (stage === "final_qcby") return "final_qc";
    return "qc";
  }
  const categories: Record<string, string> = {
    purchase_inward: "purchase_inward", jobwork_outward: "outward_jobwork",
    jobwork_inward: "inward_jobwork", packing: "packing", dispatch: "dispatch",
  };
  if (!categories[type]) throw new Error("Unsupported photo category");
  return categories[type];
}

export function photoFilename(photo: LayoutPhoto): string {
  // Keep the upload identity on subsequent moves; legacy names use the permanent DB ID.
  const existing = photo.r2_key.split("/").pop() || "";
  if (/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_IST_[a-zA-Z0-9-]+\.webp$/.test(existing)) return existing;
  return `${istFileTime(photo.server_uploaded_at)}_p${photo.id}.webp`;
}

export function photoObjectKey(photo: LayoutPhoto, context: LayoutContext, exportMould?: string): string {
  const moulds = [...new Set(context.moulds.filter(Boolean))].sort();
  const category = photoCategory(photo.movement_type, photo.stage_key);
  const stage = photo.movement_type === "subplate_qc" || photo.movement_type === "packing";
  const docs = [...new Map(context.documents.map(d => [d.id, d])).values()].sort((a, b) => a.id - b.id);
  const filename = photoFilename(photo);
  const base = exportMould ? folderSegment(exportMould) : moulds.length > 1 ? "shared" : moulds.length === 1 ? folderSegment(moulds[0]) : "_unlinked";
  if (stage && photo.subplate_id && moulds.length) {
    const item = `${folderSegment(context.subplateCode || `SUBPLATE-${photo.subplate_id}`)}__${photo.subplate_id}`;
    const event = context.eventId ? createHash("sha256").update(context.eventId).digest("hex").slice(0, 16) : `legacy-p${photo.id}`;
    return `${base}/${category}/${item}/${istFileTime(context.eventTime || photo.server_uploaded_at)}_${event}/${filename}`;
  }
  if (docs.length && moulds.length) {
    const document = docs.map(d => `${folderSegment(d.number || `RECORD-${d.id}`)}__${d.id}`).join("+");
    return `${base}/${category}/${folderSegment(document)}/${filename}`;
  }
  if (photo.claim_batch_id) return exportMould
    ? `${base}/${category}/_pending-${folderSegment(photo.claim_batch_id)}/${filename}`
    : `_pending/${folderSegment(photo.claim_batch_id)}/${category}/${filename}`;
  return moulds.length ? `${base}/${category}/${filename}` : `_unlinked/${category}/${filename}`;
}
