import { after, NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readBoundedBody, RequestBodyTooLarge } from "@/lib/bounded-body";
import { processAndWatermarkPhoto } from "@/lib/r2/watermark";
import { uploadToR2, deleteFromR2 } from "@/lib/r2/client";
import { authorizePhotoUpload } from "@/lib/photos/access";
import { resolveProjectAssociations, linkPhotosToProjects, linkPhotosToEvent } from "@/lib/photos/associations";
import { MovementType } from "@/lib/photos/types";
import { folderSegment, istFileTime, photoCategory } from "@/lib/photos/storage-layout";
import { tryPhotoStorageMoves } from "@/lib/photos/storage-moves";

export const runtime = "nodejs";

const MAX_RAW_UPLOAD_SIZE = 35 * 1024 * 1024; // 35 MB

const VALID_MOVEMENT_TYPES = new Set<MovementType>([
  "purchase_inward",
  "jobwork_outward",
  "jobwork_inward",
  "subplate_qc",
  "packing",
  "dispatch",
]);

function isValidImageMagicBytes(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // WEBP: 'RIFF' .... 'WEBP'
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return true;
  // GIF: GIF8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // TIFF: 'II' or 'MM'
  if ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
      (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a)) return true;
  // HEIC / AVIF / ftyp
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") return true;
  return false;
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
      return NextResponse.json({ error: "Multipart form required" }, { status: 415 });
    }

    const bodyBytes = await readBoundedBody(req, MAX_RAW_UPLOAD_SIZE);
    const formData = await new Response(bodyBytes as BodyInit, {
      headers: { "Content-Type": contentType },
    }).formData();

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No photo file provided" }, { status: 400 });
    }

    const rawMovementType = String(formData.get("movementType") || "").trim().toLowerCase();
    if (!VALID_MOVEMENT_TYPES.has(rawMovementType as MovementType)) {
      return NextResponse.json(
        { error: `Invalid movementType. Must be one of: ${Array.from(VALID_MOVEMENT_TYPES).join(", ")}` },
        { status: 400 }
      );
    }
    const movementType = rawMovementType as MovementType;
    const actions: Record<MovementType, string> = { purchase_inward: "action_create_purchase_inward", jobwork_outward: "action_create_challan", jobwork_inward: "action_create_inward", subplate_qc: "action_edit_subplate", packing: "action_create_dispatch", dispatch: "action_create_dispatch" };
    const writeAccess = await authenticateRequest(req, undefined, actions[movementType]);
    if ("error" in writeAccess) return NextResponse.json({ error: writeAccess.error }, { status: writeAccess.status });
    const photoBatchId = String(formData.get("photoBatchId") || "");
    if (photoBatchId && !/^[a-zA-Z0-9_-]{8,128}$/.test(photoBatchId)) return NextResponse.json({ error: "Invalid photo draft" }, { status: 400 });

    // F01: Authorize caller for this movement type
    const authCheck = await authorizePhotoUpload(auth.user, movementType);
    if (!authCheck.allowed) {
      return NextResponse.json({ error: authCheck.reason || "Unauthorized" }, { status: 403 });
    }

    const clientUploadId = formData.get("clientUploadId") ? String(formData.get("clientUploadId")).trim() : null;
    const draftId = formData.get("draftId") ? String(formData.get("draftId")).trim() : null;
    const eventId = formData.get("eventId") ? String(formData.get("eventId")).trim() : null;
    const movementId = formData.get("movementId") ? Number(formData.get("movementId")) : null;
    const movementNumber = formData.get("movementNumber") ? String(formData.get("movementNumber")).trim() : null;
    const partyName = formData.get("partyName") ? String(formData.get("partyName")).trim() : null;
    const subplateId = formData.get("subplateId") ? Number(formData.get("subplateId")) : null;
    const subplateCode = formData.get("subplateCode") ? String(formData.get("subplateCode")).trim() : null;
    const stageKey = formData.get("stageKey") ? String(formData.get("stageKey")).trim() : null;
    const mouldCode = formData.get("mouldCode") ? String(formData.get("mouldCode")).trim() : null;
    const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;

    // Parse project codes
    let projectCodes: string[] = [];
    const rawProjectCodes = formData.get("projectCodes");
    if (rawProjectCodes) {
      try {
        const parsed = JSON.parse(String(rawProjectCodes));
        if (Array.isArray(parsed)) {
          projectCodes = parsed.map((c) => String(c).trim()).filter(Boolean);
        }
      } catch {
        projectCodes = String(rawProjectCodes)
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
      }
    }

    // F05: Idempotency check via client_upload_id
    if (clientUploadId) {
      const { data: existingAttempt } = await supabaseAdmin
        .from("photo_upload_attempts")
        .select("photo_id, processing_status")
        .eq("actor_id", auth.user.id)
        .eq("client_upload_id", clientUploadId)
        .maybeSingle();

      if (existingAttempt?.photo_id && existingAttempt.processing_status === "ready") {
        const { data: existingPhoto } = await supabaseAdmin
          .from("movement_photos")
          .select("*")
          .eq("id", existingAttempt.photo_id)
          .maybeSingle();

        if (existingPhoto) {
          return NextResponse.json(
            {
              success: true,
              photo: {
                ...existingPhoto,
                view_url: `/api/photos/view/${existingPhoto.id}`,
                download_url: `/api/photos/view/${existingPhoto.id}?download=1`,
              },
            },
            { headers: { "Cache-Control": "private, no-store" } }
          );
        }
      }
    }

    // Convert file to buffer and validate magic bytes
    const arrayBuffer = await file.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);

    if (!isValidImageMagicBytes(rawBuffer)) {
      return NextResponse.json(
        { error: "Invalid image format. Supported formats: JPEG, PNG, WEBP, GIF, TIFF, HEIC, AVIF" },
        { status: 400 }
      );
    }

    // Authoritative Server Upload Timestamp (UTC canonical)
    const serverUploadedAt = new Date();

    // Process & permanent watermark overlay (lossy WebP with extended footer banner)
    const processed = await processAndWatermarkPhoto({
      imageBuffer: rawBuffer,
      movementType,
      movementNumber,
      partyName,
      subplateCode,
      stageKey,
      serverUploadedAt,
    });

    // Generate unique R2 storage key
    const uniqueSuffix = crypto.randomBytes(8).toString("hex");
    const filename = `${istFileTime(serverUploadedAt.toISOString())}_${uniqueSuffix}.webp`;
    const r2Key = `_pending/${folderSegment(photoBatchId || draftId || eventId || uniqueSuffix)}/${photoCategory(movementType, stageKey)}/${filename}`;

    // Record upload attempt in DB if clientUploadId provided
    if (clientUploadId) {
      await supabaseAdmin.from("photo_upload_attempts").upsert(
        {
          actor_id: auth.user.id,
          client_upload_id: clientUploadId,
          draft_id: draftId,
          event_id: eventId,
          movement_type: movementType,
          canonical_uploaded_at: serverUploadedAt.toISOString(),
          reserved_r2_key: r2Key,
          processing_status: "processing",
        },
        { onConflict: "actor_id,client_upload_id" }
      );
    }

    // Upload to Cloudflare R2
    await uploadToR2({
      key: r2Key,
      body: processed.buffer,
      contentType: "image/webp",
      metadata: {
        movementType,
        movementNumber: movementNumber || "",
        partyName: partyName || "",
        uploadedBy: String(auth.user.id),
      },
    });

    // Insert into movement_photos
    const { data: photoRecord, error: insertError } = await supabaseAdmin
      .from("movement_photos")
      .insert({
        r2_key: r2Key,
        original_filename: file.name || "photo.webp",
        file_size_bytes: processed.sizeBytes,
        mime_type: "image/webp",
        width: processed.width,
        height: processed.height,
        movement_type: movementType,
        movement_id: movementId,
        movement_number: movementNumber,
        party_name: partyName,
        subplate_id: subplateId,
        stage_key: stageKey,
        notes,
        watermark_text: processed.watermarkText,
        server_uploaded_at: serverUploadedAt.toISOString(),
        uploaded_by: auth.user.id,
        claim_batch_id: photoBatchId || null,
      })
      .select()
      .single();

    if (insertError || !photoRecord) {
      await deleteFromR2(r2Key);
      console.error("[Photos API] Database insert failed:", insertError);
      return NextResponse.json({ error: "Failed to record photo metadata in database" }, { status: 500 });
    }

    // Mark upload attempt as ready
    if (clientUploadId) {
      await supabaseAdmin
        .from("photo_upload_attempts")
        .update({
          photo_id: photoRecord.id,
          processing_status: "ready",
          updated_at: new Date().toISOString(),
        })
        .eq("actor_id", auth.user.id)
        .eq("client_upload_id", clientUploadId);
    }

    // F02: Canonical project and mould associations
    const resolvedProjects = await resolveProjectAssociations({
      projectCodes,
      mouldCode,
      subplateId,
    });
    if (resolvedProjects.length > 0) {
      await linkPhotosToProjects([photoRecord.id], resolvedProjects);
    }

    // Event association if eventId provided
    if (eventId) {
      await linkPhotosToEvent({
        photoIds: [photoRecord.id],
        eventId,
        movementType,
        documentId: movementId,
        documentNumber: movementNumber,
      });
    }

    after(() => tryPhotoStorageMoves([photoRecord.id]));
    return NextResponse.json(
      {
        success: true,
        photo: {
          id: photoRecord.id,
          photo_batch_id: photoRecord.claim_batch_id,
          r2_key: photoRecord.r2_key,
          original_filename: photoRecord.original_filename,
          file_size_bytes: photoRecord.file_size_bytes,
          mime_type: photoRecord.mime_type,
          width: photoRecord.width,
          height: photoRecord.height,
          movement_type: photoRecord.movement_type,
          movement_id: photoRecord.movement_id,
          movement_number: photoRecord.movement_number,
          party_name: photoRecord.party_name,
          subplate_id: photoRecord.subplate_id,
          stage_key: photoRecord.stage_key,
          watermark_text: photoRecord.watermark_text,
          server_uploaded_at: photoRecord.server_uploaded_at,
          created_at: photoRecord.created_at,
          view_url: `/api/photos/view/${photoRecord.id}`,
          download_url: `/api/photos/view/${photoRecord.id}?download=1`,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: unknown) {
    if (err instanceof RequestBodyTooLarge) {
      return NextResponse.json({ error: "File exceeds maximum upload size (35MB)" }, { status: 413 });
    }
    const message = err instanceof Error ? err.message : "Failed to process photo upload";
    console.error("[Photos API] Upload processing error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
