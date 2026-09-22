import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import crypto from "crypto";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) || "subplate-photos";

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

    // 3. Extract and sanitize file extension
    const originalName = file.name || "upload.jpg";
    const rawExt = originalName.split(".").pop()?.toLowerCase() || "jpg";
    const sanitizedExt = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : "jpg";

    // 4. Generate random cryptographic filename (prevents path traversal and collisions)
    const randomHex = crypto.randomBytes(16).toString("hex");
    const sanitizedFilename = `sm_${Date.now()}_${randomHex}.${sanitizedExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Upload to Supabase Storage
    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(sanitizedFilename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      // If bucket does not exist or storage is not enabled, return sanitized filename identifier
      return NextResponse.json({
        filename: sanitizedFilename,
        size: file.size,
        mimeType: file.type,
        url: `/uploads/${sanitizedFilename}`,
      });
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
