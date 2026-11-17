import { supabaseAdmin } from "@/lib/supabase/admin";
import { deleteFromR2 } from "./client";

export interface RetentionCycleRecord {
  id: number;
  project_id: number;
  project_code: string;
  registered_at: string;
  retention_deadline: string;
  is_active: boolean;
  reopened_at?: string | null;
  reminder_7d_sent_at?: string | null;
  reminder_3d_sent_at?: string | null;
  reminder_1d_sent_at?: string | null;
  photos_deleted_at?: string | null;
  photos_deleted_count?: number;
  total_bytes_freed?: number;
}

/**
 * Initiates or resets a 30-day photo retention cycle when a project moves into Project Register.
 */
export async function startProjectRetentionCycle(
  projectId: number,
  projectCode: string
): Promise<RetentionCycleRecord | null> {
  const now = new Date();
  const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // exactly 30 days

  // Deactivate any prior open cycle for this project
  await supabaseAdmin
    .from("photo_retention_cycles")
    .update({ is_active: false })
    .eq("project_code", projectCode)
    .eq("is_active", true);

  const { data, error } = await supabaseAdmin
    .from("photo_retention_cycles")
    .insert({
      project_id: projectId,
      project_code: projectCode,
      registered_at: now.toISOString(),
      retention_deadline: deadline.toISOString(),
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("[Retention] Failed to start retention cycle:", error);
    return null;
  }

  return data;
}

/**
 * Cancels pending deletion when a project is reopened.
 */
export async function cancelProjectRetentionCycle(
  projectCode: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("photo_retention_cycles")
    .update({
      is_active: false,
      reopened_at: new Date().toISOString(),
    })
    .eq("project_code", projectCode)
    .eq("is_active", true);

  if (error) {
    console.error("[Retention] Failed to cancel retention cycle:", error);
    return false;
  }

  return true;
}

/**
 * Executes automatic retention cleanup for expired cycles (>= 30 days).
 * Adheres strictly to the multi-project safety rule:
 * A shared photo is deleted ONLY IF every project linked to it has completed its 30-day retention.
 */
export async function runRetentionCleanup(): Promise<{
  processedCycles: number;
  deletedPhotosCount: number;
  totalBytesFreed: number;
}> {
  const nowIso = new Date().toISOString();

  // 1. Find all active expired cycles
  const { data: expiredCycles, error: cyclesError } = await supabaseAdmin
    .from("photo_retention_cycles")
    .select("id, project_id, project_code, retention_deadline")
    .eq("is_active", true)
    .lte("retention_deadline", nowIso);

  if (cyclesError || !expiredCycles || expiredCycles.length === 0) {
    return { processedCycles: 0, deletedPhotosCount: 0, totalBytesFreed: 0 };
  }

  let totalDeletedPhotos = 0;
  let totalBytesFreed = 0;

  for (const cycle of expiredCycles) {
    // 2. Fetch all photo associations for this project
    const { data: assocs } = await supabaseAdmin
      .from("photo_project_associations")
      .select("photo_id")
      .eq("project_code", cycle.project_code);

    const candidatePhotoIds = (assocs || []).map((a) => a.photo_id);
    if (candidatePhotoIds.length === 0) {
      // Mark cycle completed
      await supabaseAdmin
        .from("photo_retention_cycles")
        .update({
          is_active: false,
          photos_deleted_at: nowIso,
          photos_deleted_count: 0,
          total_bytes_freed: 0,
        })
        .eq("id", cycle.id);
      continue;
    }

    let cycleDeletedCount = 0;
    let cycleBytesFreed = 0;

    for (const photoId of candidatePhotoIds) {
      // 3. Multi-project link safety check:
      // Find all projects linked to this photo
      const { data: siblingAssocs } = await supabaseAdmin
        .from("photo_project_associations")
        .select("project_code")
        .eq("photo_id", photoId);

      const siblingCodes = (siblingAssocs || []).map((s) => s.project_code);

      // Check if any sibling project is still active (not expired)
      let canDelete = true;
      if (siblingCodes.length > 1) {
        // Find if any sibling has an active project or non-expired retention cycle
        const { data: activeSiblingCycles } = await supabaseAdmin
          .from("photo_retention_cycles")
          .select("project_code, retention_deadline, is_active")
          .in("project_code", siblingCodes)
          .eq("is_active", true)
          .gt("retention_deadline", nowIso);

        if (activeSiblingCycles && activeSiblingCycles.length > 0) {
          // A sibling project is still in retention or active!
          canDelete = false;
        }
      }

      if (canDelete) {
        // Fetch photo metadata
        const { data: photo } = await supabaseAdmin
          .from("movement_photos")
          .select("id, r2_key, file_size_bytes, deleted_at")
          .eq("id", photoId)
          .single();

        if (photo && !photo.deleted_at) {
          // Enqueue retryable deletion job in photo_deletion_jobs (Requirement F09)
          const { data: jobRow } = await supabaseAdmin
            .from("photo_deletion_jobs")
            .insert({
              photo_id: photoId,
              reason: `Automatic 30-day retention expired for project ${cycle.project_code}`,
              state: "in_progress",
              attempts: 1,
            })
            .select("id")
            .maybeSingle();

          try {
            // Delete from Cloudflare R2
            await deleteFromR2(photo.r2_key);

            // Soft delete in database
            await supabaseAdmin
              .from("movement_photos")
              .update({
                deleted_at: nowIso,
                deletion_reason: `Automatic 30-day retention expired for project ${cycle.project_code}`,
              })
              .eq("id", photoId);

            if (jobRow?.id) {
              await supabaseAdmin
                .from("photo_deletion_jobs")
                .update({
                  state: "completed",
                  confirmed_deleted_at: nowIso,
                  updated_at: nowIso,
                })
                .eq("id", jobRow.id);
            }

            cycleDeletedCount++;
            cycleBytesFreed += Number(photo.file_size_bytes) || 0;
          } catch (r2Err: any) {
            console.error(`[Retention] R2 deletion failed for photo ${photoId}:`, r2Err);
            if (jobRow?.id) {
              await supabaseAdmin
                .from("photo_deletion_jobs")
                .update({
                  state: "failed",
                  last_error: r2Err.message || String(r2Err),
                  next_retry_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                  updated_at: nowIso,
                })
                .eq("id", jobRow.id);
            }
          }
        }
      }
    }

    // Mark cycle completed
    await supabaseAdmin
      .from("photo_retention_cycles")
      .update({
        is_active: false,
        photos_deleted_at: nowIso,
        photos_deleted_count: cycleDeletedCount,
        total_bytes_freed: cycleBytesFreed,
      })
      .eq("id", cycle.id);

    totalDeletedPhotos += cycleDeletedCount;
    totalBytesFreed += cycleBytesFreed;
  }

  return {
    processedCycles: expiredCycles.length,
    deletedPhotosCount: totalDeletedPhotos,
    totalBytesFreed,
  };
}

/**
 * Evaluates active retention cycles and flags 7-day, 3-day, and 1-day reminders (Requirement F10).
 */
export async function checkRetentionReminders(): Promise<{
  remindersSent: Array<{ cycleId: number; projectCode: string; milestone: "7d" | "3d" | "1d" }>;
}> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const in7Days = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: activeCycles } = await supabaseAdmin
    .from("photo_retention_cycles")
    .select("id, project_id, project_code, retention_deadline, reminder_7d_sent_at, reminder_3d_sent_at, reminder_1d_sent_at")
    .eq("is_active", true)
    .gt("retention_deadline", nowIso)
    .lte("retention_deadline", in7Days);

  const remindersSent: Array<{ cycleId: number; projectCode: string; milestone: "7d" | "3d" | "1d" }> = [];

  for (const c of activeCycles || []) {
    const deadlineMs = new Date(c.retention_deadline).getTime();
    const msRemaining = deadlineMs - now;
    const hoursRemaining = msRemaining / (1000 * 60 * 60);

    // 1-day milestone (< 24 hours remaining)
    if (hoursRemaining <= 24 && !c.reminder_1d_sent_at) {
      await supabaseAdmin
        .from("photo_retention_cycles")
        .update({ reminder_1d_sent_at: nowIso })
        .eq("id", c.id);
      remindersSent.push({ cycleId: c.id, projectCode: c.project_code, milestone: "1d" });
    }
    // 3-day milestone (<= 72 hours remaining)
    else if (hoursRemaining <= 72 && !c.reminder_3d_sent_at) {
      await supabaseAdmin
        .from("photo_retention_cycles")
        .update({ reminder_3d_sent_at: nowIso })
        .eq("id", c.id);
      remindersSent.push({ cycleId: c.id, projectCode: c.project_code, milestone: "3d" });
    }
    // 7-day milestone (<= 168 hours remaining)
    else if (hoursRemaining <= 168 && !c.reminder_7d_sent_at) {
      await supabaseAdmin
        .from("photo_retention_cycles")
        .update({ reminder_7d_sent_at: nowIso })
        .eq("id", c.id);
      remindersSent.push({ cycleId: c.id, projectCode: c.project_code, milestone: "7d" });
    }
  }

  return { remindersSent };
}

/**
 * Retries failed or queued deletion jobs from `photo_deletion_jobs`.
 */
export async function retryPendingDeletionJobs(limit = 50): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const nowIso = new Date().toISOString();
  const { data: jobs } = await supabaseAdmin
    .from("photo_deletion_jobs")
    .select("id, photo_id, attempts, movement_photos ( id, r2_key, file_size_bytes )")
    .in("state", ["queued", "failed"])
    .lt("attempts", 5)
    .lte("next_retry_at", nowIso)
    .limit(limit);

  let succeeded = 0;
  let failed = 0;

  for (const job of jobs || []) {
    const photo = (job as any).movement_photos;
    if (!photo?.r2_key) {
      await supabaseAdmin
        .from("photo_deletion_jobs")
        .update({ state: "completed", confirmed_deleted_at: nowIso, updated_at: nowIso })
        .eq("id", job.id);
      succeeded++;
      continue;
    }

    try {
      await deleteFromR2(photo.r2_key);
      await supabaseAdmin
        .from("movement_photos")
        .update({ deleted_at: nowIso, deletion_reason: "Retry queue deletion completed" })
        .eq("id", job.photo_id);

      await supabaseAdmin
        .from("photo_deletion_jobs")
        .update({ state: "completed", confirmed_deleted_at: nowIso, updated_at: nowIso })
        .eq("id", job.id);
      succeeded++;
    } catch (err: any) {
      failed++;
      await supabaseAdmin
        .from("photo_deletion_jobs")
        .update({
          attempts: job.attempts + 1,
          last_error: err.message || String(err),
          next_retry_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          updated_at: nowIso,
        })
        .eq("id", job.id);
    }
  }

  return { attempted: (jobs || []).length, succeeded, failed };
}

