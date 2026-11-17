import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getR2UsageStats, isR2Configured, getR2BucketName } from "@/lib/r2/client";
import { authorizePhotoAdmin } from "@/lib/photos/access";

export const runtime = "nodejs";

const TEN_GB_BYTES = 10 * 1024 * 1024 * 1024; // 10,737,418,240 bytes
const EIGHT_GB_BYTES = 8 * 1024 * 1024 * 1024;
const NINE_GB_BYTES = 9 * 1024 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // F01: Admin-only stats access
  const adminCheck = authorizePhotoAdmin(auth.user);
  if (!adminCheck.allowed) {
    return NextResponse.json({ error: adminCheck.reason }, { status: 403 });
  }

  try {
    // 1. Measured R2 bucket storage usage
    const r2Stats = await getR2UsageStats();

    // 2. Database aggregate stats
    const { data: dbPhotos, error: dbError } = await supabaseAdmin
      .from("movement_photos")
      .select("movement_type, file_size_bytes, deleted_at");

    if (dbError) {
      console.error("[Photos Stats] DB Error:", dbError);
    }

    const photosList = dbPhotos || [];
    let activeCount = 0;
    let activeBytes = 0;
    let deletedCount = 0;

    const breakdownByType: Record<string, { count: number; bytes: number }> = {
      purchase_inward: { count: 0, bytes: 0 },
      jobwork_outward: { count: 0, bytes: 0 },
      jobwork_inward: { count: 0, bytes: 0 },
      subplate_qc: { count: 0, bytes: 0 },
      packing: { count: 0, bytes: 0 },
      dispatch: { count: 0, bytes: 0 },
    };

    for (const p of photosList) {
      if (p.deleted_at) {
        deletedCount++;
      } else {
        activeCount++;
        const size = Number(p.file_size_bytes) || 0;
        activeBytes += size;
        if (breakdownByType[p.movement_type]) {
          breakdownByType[p.movement_type].count++;
          breakdownByType[p.movement_type].bytes += size;
        }
      }
    }

    // Storage tier classification
    // Use measured R2 bytes if available, fallback to DB sum
    const totalBytes = r2Stats.totalBytes > 0 ? r2Stats.totalBytes : activeBytes;
    const usagePercent = Math.min(100, (totalBytes / TEN_GB_BYTES) * 100);

    let thresholdStatus: "normal" | "warning" | "urgent" | "critical" = "normal";
    let alertMessage: string | null = null;

    if (totalBytes >= TEN_GB_BYTES) {
      thresholdStatus = "critical";
      alertMessage =
        "Photo storage has crossed the 10 GB target allowance. Uploads continue normally, but admin action to clean up expired projects is strongly recommended.";
    } else if (totalBytes >= NINE_GB_BYTES) {
      thresholdStatus = "urgent";
      alertMessage =
        "Photo storage has reached 9 GB (90% of target). Please download project backup archives.";
    } else if (totalBytes >= EIGHT_GB_BYTES) {
      thresholdStatus = "warning";
      alertMessage =
        "Photo storage is above 8 GB (80% of target). Backup and deletion workflows are active.";
    }

    // 3. Active retention cycles & upcoming deletions
    const nowIso = new Date().toISOString();
    const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: retentionCycles } = await supabaseAdmin
      .from("photo_retention_cycles")
      .select("id, project_code, registered_at, retention_deadline, is_active")
      .eq("is_active", true)
      .order("retention_deadline", { ascending: true });

    const upcomingDeletions = (retentionCycles || []).filter(
      (c) => c.retention_deadline <= inSevenDays
    );

    return NextResponse.json({
      storage: {
        r2Configured: isR2Configured(),
        bucketName: getR2BucketName(),
        totalBytes,
        totalBytesFormatted: formatBytes(totalBytes),
        targetLimitBytes: TEN_GB_BYTES,
        targetLimitFormatted: "10.00 GB",
        usagePercent: Number(usagePercent.toFixed(2)),
        thresholdStatus,
        alertMessage,
        reconciledAt: new Date().toISOString(),
      },
      counts: {
        activePhotos: activeCount,
        deletedPhotos: deletedCount,
        breakdownByType,
      },
      retention: {
        activeCyclesCount: (retentionCycles || []).length,
        upcomingDeletionsCount: upcomingDeletions.length,
        upcomingDeletionsList: upcomingDeletions.slice(0, 5),
      },
    });
  } catch (err: any) {
    console.error("[Photos Stats API] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to calculate stats" }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

