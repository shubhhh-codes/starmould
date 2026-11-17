import { after, NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readBoundedBody } from "@/lib/bounded-body";
import { photoExistsInStorage } from "@/lib/r2/client";
import { tryPhotoStorageMoves } from "@/lib/photos/storage-moves";
const headers = { "Cache-Control": "private, no-store" };
async function admin(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth;
  if (auth.user.role_id !== 0) return { error: "Administrator required", status: 403 };
  return auth;
}
export async function GET(req: NextRequest) {
  const auth = await admin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const photoId = Number(req.nextUrl.searchParams.get("photoId"));
  if (photoId) {
    const { data: photo, error } = await supabaseAdmin.from("movement_photos").select("movement_type").eq("id", photoId).is("deleted_at", null).maybeSingle();
    if (error || !photo) return NextResponse.json({ error: "Photo unavailable" }, { status: 404 });
    const definitions: Record<string, [string, string, string]> = { purchase_inward: ["po_inward", "insrno", "odate"], jobwork_outward: ["challan", "challanno", "chdate"], jobwork_inward: ["inward", "inchallanno", "chdate"], dispatch: ["dispatch", "challanno", "chdate"] };
    const definition = definitions[photo.movement_type];
    if (!definition) return NextResponse.json({ error: "Unsupported recovery type" }, { status: 400 });
    const [table, number, date] = definition;
    const search = (req.nextUrl.searchParams.get("search") || "").slice(0, 100).replace(/[\\%_]/g, "\\$&");
    let query = supabaseAdmin.from(table).select(`id,${number},${date},projectid`).order("id", { ascending: false }).limit(30);
    if (search) query = query.ilike(number, `%${search}%`);
    const result = await query;
    if (result.error) return NextResponse.json({ error: "Record search unavailable" }, { status: 503 });
    return NextResponse.json({ records: (result.data || []).map((r: unknown) => { const row = r as Record<string, unknown>; return { id: row.id, number: row[number], date: row[date], project: row.projectid }; }) }, { headers });
  }
  const offset = Number(req.nextUrl.searchParams.get("offset") || 0);
  if (!Number.isSafeInteger(offset) || offset < 0) return NextResponse.json({ error: "Invalid offset" }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc("photo_history_unlinked", { p_offset: offset });
  if (error) return NextResponse.json({ error: "Recovery list unavailable. Check gallery migration." }, { status: 503 });
  const ids = (data.photos as { id: number }[]).map(photo => photo.id);
  const objects = ids.length ? await supabaseAdmin.from("movement_photos").select("id,r2_key,claim_batch_id").in("id", ids) : { data: [], error: null };
  if (objects.error) return NextResponse.json({ error: "Photo storage verification unavailable" }, { status: 503 });
  const availability = new Map<number, boolean | null>();
  for (let start = 0; start < (objects.data || []).length; start += 5) {
    await Promise.all((objects.data || []).slice(start, start + 5).map(async photo => {
      try { availability.set(photo.id, await photoExistsInStorage(photo.r2_key)); }
      catch { availability.set(photo.id, null); }
    }));
  }
  const drafts = new Set((objects.data || []).filter(photo => photo.claim_batch_id).map(photo => photo.id));
  return NextResponse.json({ ...data, photos: data.photos.map((photo: { id: number }) => ({ ...photo, storageAvailable: availability.get(photo.id) ?? null, draftPending: drafts.has(photo.id) })) }, { headers });
}
export async function POST(req: NextRequest) {
  const auth = await admin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = JSON.parse(new TextDecoder().decode(await readBoundedBody(req, 8192)));
    if (!Number.isSafeInteger(body.photoId) || body.photoId <= 0 || !Array.isArray(body.documentIds) || body.documentIds.length < 1 || body.documentIds.length > 20 || body.documentIds.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) <= 0) || typeof body.reason !== "string" || body.reason.trim().length < 5 || body.reason.length > 500) return NextResponse.json({ error: "Select records and provide a reason" }, { status: 400 });
    const { data: photo, error: photoError } = await supabaseAdmin.from("movement_photos").select("r2_key,claim_batch_id").eq("id", body.photoId).is("deleted_at", null).maybeSingle();
    if (photoError) return NextResponse.json({ error: "Photo verification unavailable" }, { status: 503 });
    if (photo?.claim_batch_id) return NextResponse.json({ error: "This photo belongs to a movement draft. Complete its original movement instead of reassigning it." }, { status: 409 });
    if (!photo || !await photoExistsInStorage(photo.r2_key)) return NextResponse.json({ error: "Photo file is missing from storage. Restore the file before linking." }, { status: 409 });
    const { error } = await supabaseAdmin.rpc("photo_history_recover", { p_photo: body.photoId, p_documents: [...new Set(body.documentIds)], p_actor: auth.user.id, p_reason: body.reason.trim() });
    if (error) return NextResponse.json({ error: "Could not link photo. It may already be linked; refresh and retry." }, { status: 409 });
    after(() => tryPhotoStorageMoves([body.photoId]));
    return NextResponse.json({ success: true }, { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof SyntaxError ? "Invalid recovery request" : "Photo recovery temporarily unavailable" }, { status: error instanceof SyntaxError ? 400 : 503 }); }
}
