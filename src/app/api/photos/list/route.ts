import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/photos/access";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const movementType = searchParams.get("movementType");
  const movementId = searchParams.get("movementId") ? Number(searchParams.get("movementId")) : null;
  const movementNumber = searchParams.get("movementNumber")?.trim();
  const subplateId = searchParams.get("subplateId") ? Number(searchParams.get("subplateId")) : null;
  const stageKey = searchParams.get("stageKey")?.trim();
  const projectCode = searchParams.get("projectCode")?.trim();
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const cursor = searchParams.get("cursor") ? Number(searchParams.get("cursor")) : null;

  const isAdmin = isAdminUser(auth.user);

  // Non-admins must supply at least one scope filter to prevent whole-bucket dumping
  if (!isAdmin && !movementType && !movementId && !movementNumber && !subplateId && !projectCode) {
    return NextResponse.json(
      { error: "Filter required (movementType, movementId, subplateId, or projectCode)" },
      { status: 400 }
    );
  }

  let query = supabaseAdmin
    .from("movement_photos")
    .select(`
      id,
      r2_key,
      original_filename,
      file_size_bytes,
      mime_type,
      width,
      height,
      movement_type,
      movement_id,
      movement_number,
      party_name,
      subplate_id,
      stage_key,
      notes,
      watermark_text,
      server_uploaded_at,
      created_at,
      uploaded_by,
      users:uploaded_by ( id, name )
    `)
    .is("deleted_at", null)
    .order("id", { ascending: false });

  if (cursor) {
    query = query.lt("id", cursor);
  }

  if (movementType) {
    query = query.eq("movement_type", movementType);
  }

  if (movementId) {
    query = query.eq("movement_id", movementId);
  }

  if (movementNumber) {
    query = query.eq("movement_number", movementNumber);
  }

  if (subplateId) {
    query = query.eq("subplate_id", subplateId);
  }

  if (stageKey) {
    query = query.eq("stage_key", stageKey);
  }

  // Non-admin scope restriction: can only view if uploaded by self or within authorized movement types
  if (!isAdmin) {
    query = query.eq("uploaded_by", auth.user.id);
  }

  // If projectCode filter is requested, query through associations
  if (projectCode) {
    const { data: associations } = await supabaseAdmin
      .from("photo_project_associations")
      .select("photo_id")
      .eq("project_code", projectCode);

    const photoIds = (associations || []).map((a) => a.photo_id);
    if (photoIds.length === 0) {
      return NextResponse.json(
        { photos: [], nextCursor: null },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
    query = query.in("id", photoIds);
  }

  const { data: photos, error } = await query.limit(limit + 1);

  if (error) {
    console.error("[Photos List API] Database error:", error);
    return NextResponse.json({ error: "Failed to fetch photos" }, { status: 500 });
  }

  const items = photos || [];
  const hasMore = items.length > limit;
  const returnedPhotos = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? returnedPhotos[returnedPhotos.length - 1]?.id : null;

  const enrichedPhotos = returnedPhotos.map((p: any) => ({
    ...p,
    view_url: `/api/photos/view/${p.id}`,
    download_url: `/api/photos/view/${p.id}?download=1`,
  }));

  return NextResponse.json(
    { photos: enrichedPhotos, nextCursor },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
