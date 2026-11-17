import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  startProjectRetentionCycle,
  cancelProjectRetentionCycle,
  runRetentionCleanup,
  checkRetentionReminders,
  retryPendingDeletionJobs,
} from "@/lib/r2/retention";
import { authorizePhotoAdmin } from "@/lib/photos/access";
import { runPhotoStorageMoves } from "@/lib/photos/storage-moves";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // F01: Admin-only retention access
  const adminCheck = authorizePhotoAdmin(auth.user);
  if (!adminCheck.allowed) {
    return NextResponse.json({ error: adminCheck.reason }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const projectCode = searchParams.get("projectCode");

  let query = supabaseAdmin
    .from("photo_retention_cycles")
    .select(`
      id,
      project_id,
      project_code,
      registered_at,
      retention_deadline,
      is_active,
      reopened_at,
      reminder_7d_sent_at,
      reminder_3d_sent_at,
      reminder_1d_sent_at,
      photos_deleted_at,
      photos_deleted_count,
      total_bytes_freed,
      created_at
    `)
    .order("retention_deadline", { ascending: true });

  if (projectCode) {
    query = query.eq("project_code", projectCode);
  }

  const { data: cycles, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to fetch retention cycles" }, { status: 500 });
  }

  const now = Date.now();
  const enrichedCycles = (cycles || []).map((c) => {
    const deadlineMs = new Date(c.retention_deadline).getTime();
    const msRemaining = Math.max(0, deadlineMs - now);
    const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

    return {
      ...c,
      daysRemaining: c.is_active ? daysRemaining : null,
      isExpired: c.is_active && deadlineMs <= now,
    };
  });

  return NextResponse.json({ cycles: enrichedCycles });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Admin access check
  const adminCheck = authorizePhotoAdmin(auth.user);
  if (!adminCheck.allowed) {
    return NextResponse.json({ error: adminCheck.reason }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = body.action;

    if (action === "organize_storage") {
      return NextResponse.json({ success: true, result: await runPhotoStorageMoves(20) });
    }

    if (action === "start") {
      const { projectId, projectCode } = body;
      if (!projectId || !projectCode) {
        return NextResponse.json({ error: "projectId and projectCode required" }, { status: 400 });
      }
      const cycle = await startProjectRetentionCycle(Number(projectId), String(projectCode));
      return NextResponse.json({ success: true, cycle });
    }

    if (action === "cancel") {
      const { projectCode } = body;
      if (!projectCode) {
        return NextResponse.json({ error: "projectCode required" }, { status: 400 });
      }
      const ok = await cancelProjectRetentionCycle(String(projectCode));
      return NextResponse.json({ success: ok });
    }

    if (action === "cleanup") {
      await runPhotoStorageMoves(20);
      const result = await runRetentionCleanup();
      return NextResponse.json({ success: true, result });
    }

    if (action === "reminders") {
      const result = await checkRetentionReminders();
      return NextResponse.json({ success: true, result });
    }

    if (action === "retry_deletions") {
      const result = await retryPendingDeletionJobs();
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process retention request" }, { status: 500 });
  }
}

