import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
      { error: "Only administrators are authorized to check export job status." },
      { status: 403 }
    );
  }

  const { jobId } = await context.params;
  if (!jobId) {
    return NextResponse.json({ error: "Job ID required" }, { status: 400 });
  }

  const { data: job, error } = await supabaseAdmin
    .from("photo_export_jobs")
    .select("id, scope, target_codes, status, total_photos, archive_size_bytes, error_message, expires_at, created_at, downloaded_at")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job) {
    return NextResponse.json({ error: "Export job not found" }, { status: 404 });
  }

  const isExpired = new Date(job.expires_at).getTime() <= Date.now();

  return NextResponse.json({
    id: job.id,
    scope: job.scope,
    targetCodes: job.target_codes,
    status: isExpired && job.status !== "completed" ? "expired" : job.status,
    totalPhotos: job.total_photos,
    archiveSizeBytes: job.archive_size_bytes,
    errorMessage: job.error_message,
    expiresAt: job.expires_at,
    isReady: job.status === "completed" && !isExpired,
    downloadUrl: job.status === "completed" && !isExpired ? `/api/photos/export/${job.id}/download` : null,
  });
}

