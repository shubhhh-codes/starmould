import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generatePhotoBackupZip } from "@/lib/r2/export-zip";
import { uploadToR2 } from "@/lib/r2/client";
import { authorizePhotoAdmin } from "@/lib/photos/access";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Admin access check (Section 2 & F01: Only admins can export ZIP archives)
  const adminCheck = authorizePhotoAdmin(auth.user);
  if (!adminCheck.allowed) {
    return NextResponse.json(
      { error: "Only administrators are authorized to generate and download photo backup archives." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    let projectCodes: string[] = [];

    if (Array.isArray(body.projectCodes)) {
      projectCodes = body.projectCodes.map((p: any) => String(p).trim()).filter(Boolean);
    } else if (body.projectCode) {
      projectCodes = [String(body.projectCode).trim()];
    }

    if (projectCodes.length === 0) {
      return NextResponse.json(
        { error: "At least one project code is required for photo backup export." },
        { status: 400 }
      );
    }

    const mouldCode = body.mouldCode ? String(body.mouldCode).trim() : null;
    const scope = (body.scope || (projectCodes.length > 1 ? "bulk" : mouldCode ? "mould" : "project")) as
      | "project"
      | "mould"
      | "bulk";

    const jobId = `EXP_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // 1. Enqueue background export job (Requirement F11)
    const { error: insertErr } = await supabaseAdmin
      .from("photo_export_jobs")
      .insert({
        id: jobId,
        scope,
        target_codes: projectCodes,
        status: "queued",
        created_by: auth.user.id,
        expires_at: expiresAt,
      });

    if (insertErr) {
      console.error("[PhotoExport] Failed to create export job record:", insertErr);
      return NextResponse.json(
        { error: "Failed to queue export job in database." },
        { status: 500 }
      );
    }

    // 2. Execute ZIP generation in background
    (async () => {
      try {
        await supabaseAdmin
          .from("photo_export_jobs")
          .update({ status: "processing" })
          .eq("id", jobId);

        const exportResult = await generatePhotoBackupZip({
          scope,
          projectCodes,
          mouldCode,
          userId: auth.user.id,
        });

        if (exportResult.totalPhotos === 0) {
          await supabaseAdmin
            .from("photo_export_jobs")
            .update({
              status: "failed",
              error_message: "No movement photos found for the specified project/mould criteria.",
            })
            .eq("id", jobId);
          return;
        }

        const r2ArchiveKey = `exports/${jobId}/${exportResult.filename}`;
        await uploadToR2({
          key: r2ArchiveKey,
          body: exportResult.zipBuffer,
          contentType: "application/zip",
          metadata: {
            exportId: jobId,
            totalPhotos: String(exportResult.totalPhotos),
          },
        });

        await supabaseAdmin
          .from("photo_export_jobs")
          .update({
            status: "completed",
            r2_archive_key: r2ArchiveKey,
            total_photos: exportResult.totalPhotos,
            archive_size_bytes: exportResult.totalBytes,
          })
          .eq("id", jobId);
      } catch (err: any) {
        console.error(`[Export Worker] Export job ${jobId} failed:`, err);
        await supabaseAdmin
          .from("photo_export_jobs")
          .update({
            status: "failed",
            error_message: err.message || "Archive generation failed",
          })
          .eq("id", jobId);
      }
    })();

    // 3. Return HTTP 202 Accepted with jobId
    return NextResponse.json(
      {
        success: true,
        jobId,
        message: "Photo export archive queued for generation.",
        status: "queued",
        statusUrl: `/api/photos/export/${jobId}`,
        downloadUrl: `/api/photos/export/${jobId}/download`,
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error("[Photo Export API] Error queuing archive:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process photo backup request." },
      { status: 500 }
    );
  }
}
