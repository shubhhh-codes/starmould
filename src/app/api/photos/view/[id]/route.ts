import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getFromR2Buffer, deleteFromR2 } from "@/lib/r2/client";
import { authorizePhotoAdmin } from "@/lib/photos/access";
import { authorizeHistoryPhoto } from "@/lib/photos/history-access";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: rawId } = await context.params;
  const photoId = Number(rawId);
  if (!photoId || isNaN(photoId)) {
    return NextResponse.json({ error: "Invalid photo ID" }, { status: 400 });
  }

  const { data: photo, error } = await supabaseAdmin.from("movement_photos")
    .select("id, movement_type, movement_id, subplate_id, stage_key, uploaded_by, deleted_at, r2_key, original_filename, mime_type")
    .eq("id", photoId).maybeSingle();
  if (error) return NextResponse.json({ error: "Photo verification unavailable" }, { status: 503 });
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  const access = await authorizeHistoryPhoto(req, photo);
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  if (photo.deleted_at) return NextResponse.json({ error: "Photo expired or removed" }, { status: 410 });
  const buffer = await getFromR2Buffer(photo.r2_key);
  if (!buffer) {
    return NextResponse.json(
      { error: "Photo file not found in storage." },
      { status: 404 }
    );
  }

  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  if (isDownload && !authorizePhotoAdmin(auth.user).allowed) return NextResponse.json({ error: "Only administrators can download photos" }, { status: 403 });
  const filename = photo.original_filename.endsWith(".webp")
    ? photo.original_filename
    : `${photo.original_filename.replace(/\.[^.]+$/, "")}.webp`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": photo.mime_type || "image/webp",
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
      "Content-Disposition": isDownload
        ? `attachment; filename="${encodeURIComponent(filename)}"`
        : "inline",
    },
  });
}

/**
 * DELETE /api/photos/view/[id]
 * Admin-only photo deletion
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // F01: Admin authorization check
  const adminCheck = authorizePhotoAdmin(auth.user);
  if (!adminCheck.allowed) {
    return NextResponse.json({ error: adminCheck.reason }, { status: 403 });
  }

  const { id: rawId } = await context.params;
  const photoId = Number(rawId);
  if (!photoId || isNaN(photoId)) {
    return NextResponse.json({ error: "Invalid photo ID" }, { status: 400 });
  }

  const { data: photo } = await supabaseAdmin
    .from("movement_photos")
    .select("id, r2_key")
    .eq("id", photoId)
    .single();

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  const reason = (body.reason as string) || "Manual deletion by Admin";

  // Soft-delete in database
  await supabaseAdmin
    .from("movement_photos")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: auth.user.id,
      deletion_reason: reason,
    })
    .eq("id", photoId);

  // If permanent hard deletion requested:
  if (body.permanent === true) {
    await deleteFromR2(photo.r2_key);
    await supabaseAdmin
      .from("photo_project_associations")
      .delete()
      .eq("photo_id", photoId);
    await supabaseAdmin
      .from("movement_photos")
      .delete()
      .eq("id", photoId);
  }

  return NextResponse.json({ success: true, message: "Photo removed successfully." });
}
