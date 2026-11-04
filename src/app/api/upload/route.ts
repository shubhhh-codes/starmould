import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";
import { ATTACHMENT_BUCKETS, authorizeAttachment } from "@/lib/attachments";
import { readBoundedBody, RequestBodyTooLarge } from "@/lib/bounded-body";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function isValidImageMagicBytes(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // GIF: 47 49 46 38 ('GIF8')
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WEBP: 'RIFF' .... 'WEBP'
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return true;
  return false;
}

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") ?? "unknown").trim();
  const rateCheck = checkRateLimit(ip, 20, 15 * 60 * 1000, 15 * 60 * 1000, "upload");
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Upload rate limit exceeded. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds ?? 900) } }
    );
  }

  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;")) return NextResponse.json({ error: "Multipart form required" }, { status: 415 });
    const body = await readBoundedBody(req, MAX_FILE_SIZE + 64 * 1024);
    const formData = await new Response(body as BodyInit, { headers: { "Content-Type": contentType } }).formData();
    const file = formData.get("file") as File | null;
    const requestedBucket = (formData.get("bucket") as string) || "subplate-photos";
    if (!ATTACHMENT_BUCKETS.has(requestedBucket)) return NextResponse.json({ error: "Invalid attachment bucket" }, { status: 400 });
    const bucket = requestedBucket;
    const type = String(formData.get("documentType") || (bucket === "subplate-photos" ? "subplate" : bucket === "mould-attachments" ? "sample" : ""));
    const documentId = String(formData.get("documentId") || "");
    if ((bucket === "subplate-photos" && type !== "subplate") || (bucket === "mould-attachments" && type !== "sample")) {
      return NextResponse.json({ error: "Attachment bucket does not match document type" }, { status: 400 });
    }
    const access = await authorizeAttachment(req, type, documentId, true);
    if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 1. Validate File Size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    // 2. Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type (${file.type}). Only JPEG, PNG, WEBP, and GIF images are allowed.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Inspect buffer magic bytes
    if (!isValidImageMagicBytes(buffer)) {
      return NextResponse.json(
        { error: "Invalid image file header. Corrupted or unsupported format." },
        { status: 400 }
      );
    }

    // 4. Extract and sanitize file extension
    const originalName = file.name || "upload.jpg";
    const rawExt = originalName.split(".").pop()?.toLowerCase() || "jpg";
    const sanitizedExt = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : "jpg";

    // 5. Generate random cryptographic filename (prevents path traversal and collisions)
    const randomHex = crypto.randomBytes(16).toString("hex");
    const sanitizedFilename = `sm_${Date.now()}_${randomHex}.${sanitizedExt}`;

    const { data: info, error: infoError } = await supabaseAdmin.storage.getBucket(bucket);
    if (infoError || !info || info.public) return NextResponse.json({ error: "Private attachment storage unavailable" }, { status: 503 });

    // 5. Upload to private storage, then register the authorized resource reference.
    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(sanitizedFilename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("Supabase storage upload error:", uploadErr);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    const { error: referenceError } = await supabaseAdmin.from("document_attachments").insert({
      bucket, path: sanitizedFilename, document_type: type, document_id: Number(documentId), uploaded_by: access.user.id,
    });
    if (referenceError) {
      await supabaseAdmin.storage.from(bucket).remove([sanitizedFilename]);
      return NextResponse.json({ error: "Attachment registration failed" }, { status: 503 });
    }

    return NextResponse.json({
      filename: sanitizedFilename,
      path: uploadData?.path || sanitizedFilename,
      url: `/api/attachments?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(sanitizedFilename)}`,
      size: file.size,
      mimeType: file.type,
    }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof RequestBodyTooLarge) return NextResponse.json({ error: "Upload request exceeds size limit" }, { status: 413 });
    const message = err instanceof Error ? err.message : "Upload processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
