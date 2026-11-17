import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getFromR2Buffer } from "@/lib/r2/client";
import { authorizePhotoAdmin } from "@/lib/photos/access";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Admin access check (Section 2 & F01)
  const adminCheck = authorizePhotoAdmin(auth.user);
  if (!adminCheck.allowed) {
    return NextResponse.json(
      { error: "Only administrators are authorized to download photo backup archives." },
      { status: 403 }
    );
  }

  const { jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: "Job ID required" }, { status: 400 });
  }

  const { data: job, error } = await supabaseAdmin
    .from("photo_export_jobs")
    .select("id, status, r2_archive_key, archive_size_bytes, expires_at, target_codes")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job) {
    return NextResponse.json({ error: "Export job not found" }, { status: 404 });
  }

  if (job.status !== "completed" || !job.r2_archive_key) {
    return NextResponse.json(
      { error: `Export archive is not ready (current status: ${job.status}).` },
      { status: 409 }
    );
  }

  if (new Date(job.expires_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "This photo export archive has expired (48-hour download window passed)." },
      { status: 410 }
    );
  }

  const archiveBuffer = await getFromR2Buffer(job.r2_archive_key);
  if (!archiveBuffer) {
    return NextResponse.json(
      { error: "Archive file could not be retrieved from storage." },
      { status: 404 }
    );
  }

  // Record download timestamp
  await supabaseAdmin
    .from("photo_export_jobs")
    .update({ downloaded_at: new Date().toISOString() })
    .eq("id", jobId);

  const filename = `${job.id}.zip`;

  return new NextResponse(new Uint8Array(archiveBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(archiveBuffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}

