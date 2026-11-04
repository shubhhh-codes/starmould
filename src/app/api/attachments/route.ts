import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { ATTACHMENT_BUCKETS, authorizeAttachment } from "@/lib/attachments";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const bucket = req.nextUrl.searchParams.get("bucket") || "";
  const path = req.nextUrl.searchParams.get("path") || "";
  if (!ATTACHMENT_BUCKETS.has(bucket) || !/^sm_\d+_[a-f0-9]{32}\.(jpg|jpeg|png|webp|gif)$/.test(path)) {
    return NextResponse.json({ error: "Invalid attachment reference" }, { status: 400 });
  }
  const { data: reference, error } = await supabaseAdmin.from("document_attachments")
    .select("document_type, document_id").eq("bucket", bucket).eq("path", path).maybeSingle();
  if (error) return NextResponse.json({ error: "Attachment lookup temporarily unavailable" }, { status: 503 });
  if (!reference) return NextResponse.json({ error: "Attachment not found or awaiting historical allocation review" }, { status: 404 });
  const access = await authorizeAttachment(req, reference.document_type, String(reference.document_id));
  if ("error" in access) return NextResponse.json({ error: access.error }, { status: access.status });
  const { data: info, error: infoError } = await supabaseAdmin.storage.getBucket(bucket);
  if (infoError || !info || info.public) return NextResponse.json({ error: "Private attachment storage unavailable" }, { status: 503 });
  const { data, error: signError } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60);
  if (signError || !data) return NextResponse.json({ error: "Attachment read temporarily unavailable" }, { status: 503 });
  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
