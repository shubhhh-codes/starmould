import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import crypto from "crypto";

const ALLOWED_BUCKETS = new Set(["subplate-photos", "mould-attachments", "general-attachments"]);
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
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const requestedBucket = (formData.get("bucket") as string) || "subplate-photos";
    const bucket = ALLOWED_BUCKETS.has(requestedBucket) ? requestedBucket : "subplate-photos";

    if (!file) {
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

    // 5. Upload to Supabase Storage
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

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(sanitizedFilename);

    return NextResponse.json({
      filename: sanitizedFilename,
      path: uploadData?.path || sanitizedFilename,
      url: publicUrlData.publicUrl,
      size: file.size,
      mimeType: file.type,
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
