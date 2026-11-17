// ==============================================================================
// Movement Photos: Canonical Project, Mould, and Event Association Resolvers
// Section 5 (F02) of Photo System Architecture
// ==============================================================================

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ResolvedProject {
  projectId: number | null;
  projectCode: string;
  mouldCode: string | null;
}

/**
 * Resolves canonical scan/project IDs and codes from caller-supplied codes or subplate IDs.
 * StarMould uses `scan.id` (numeric PK) and `scan.projectid` (canonical code string, e.g. "0001_TESTC_001").
 */
export async function resolveProjectAssociations(params: {
  projectCodes?: string[];
  mouldCode?: string | null;
  subplateId?: number | null;
}): Promise<ResolvedProject[]> {
  const cleanCodes = Array.from(
    new Set((params.projectCodes || []).map((c) => String(c).trim()).filter(Boolean))
  );

  const results: ResolvedProject[] = [];
  const handledCodes = new Set<string>();

  // If subplate ID provided, query subplate to resolve project and mould identity
  if (params.subplateId && Number.isSafeInteger(Number(params.subplateId))) {
    const { data: subplate } = await supabaseAdmin
      .from("subplate")
      .select("id, projectid, mold_id, mold_code")
      .eq("id", params.subplateId)
      .maybeSingle();

    if (subplate && subplate.projectid) {
      cleanCodes.push(subplate.projectid);
    }
  }

  if (cleanCodes.length > 0) {
    // Look up canonical projects in `scan` table by projectid OR numeric id
    const numericCandidates = cleanCodes.filter((c) => /^\d+$/.test(c)).map(Number);

    let query = supabaseAdmin.from("scan").select("id, projectid");

    if (numericCandidates.length > 0) {
      query = query.or(`projectid.in.(${cleanCodes.map((c) => `"${c}"`).join(",")}),id.in.(${numericCandidates.join(",")})`);
    } else {
      query = query.in("projectid", cleanCodes);
    }

    const { data: scans, error } = await query;
    if (error) {
      console.error("[PhotoAssociations] Failed to resolve projects from scan table:", error);
    }

    const scanMap = new Map<string, { id: number; projectid: string }>();
    if (scans) {
      for (const s of scans) {
        if (s.projectid) scanMap.set(s.projectid.toLowerCase(), s);
        scanMap.set(String(s.id), s);
      }
    }

    for (const code of cleanCodes) {
      const lower = code.toLowerCase();
      const matched = scanMap.get(lower) || scanMap.get(code);
      const canonicalCode = matched?.projectid || code;
      const canonicalId = matched?.id || null;

      if (!handledCodes.has(canonicalCode)) {
        handledCodes.add(canonicalCode);
        results.push({
          projectId: canonicalId,
          projectCode: canonicalCode,
          mouldCode: params.mouldCode || canonicalCode,
        });
      }
    }
  }

  return results;
}

/**
 * Links a set of physical photo records to projects in `photo_project_associations`.
 */
export async function linkPhotosToProjects(
  photoIds: number[],
  resolvedProjects: ResolvedProject[]
): Promise<{ success: boolean; insertedCount: number }> {
  if (photoIds.length === 0 || resolvedProjects.length === 0) {
    return { success: true, insertedCount: 0 };
  }

  const rows: Array<{
    photo_id: number;
    project_id: number | null;
    project_code: string;
    mould_code: string | null;
  }> = [];

  for (const photoId of photoIds) {
    for (const proj of resolvedProjects) {
      rows.push({
        photo_id: photoId,
        project_id: proj.projectId,
        project_code: proj.projectCode,
        mould_code: proj.mouldCode,
      });
    }
  }

  const { error } = await supabaseAdmin
    .from("photo_project_associations")
    .upsert(rows, { onConflict: "photo_id,project_code" });

  if (error) {
    console.error("[PhotoAssociations] Error linking photos to projects:", error);
    return { success: false, insertedCount: 0 };
  }

  return { success: true, insertedCount: rows.length };
}

/**
 * Links a set of physical photo records to an authoritative event in `photo_event_associations`.
 */
export async function linkPhotosToEvent(params: {
  photoIds: number[];
  eventId: string;
  movementType: string;
  documentId?: number | null;
  documentNumber?: string | null;
}): Promise<{ success: boolean; count: number }> {
  if (params.photoIds.length === 0 || !params.eventId) {
    return { success: true, count: 0 };
  }

  const rows = params.photoIds.map((photoId) => ({
    photo_id: photoId,
    event_id: params.eventId,
    movement_type: params.movementType,
    document_id: params.documentId || null,
    document_number: params.documentNumber || null,
  }));

  const { error } = await supabaseAdmin
    .from("photo_event_associations")
    .upsert(rows, { onConflict: "photo_id,event_id" });

  if (error) {
    console.error("[PhotoAssociations] Error linking photos to event:", error);
    return { success: false, count: 0 };
  }

  return { success: true, count: rows.length };
}

