import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PhotoHistoryScope } from "./history-types";

const definitions = {
  purchase_order: { table: "purchase", permission: "nav_purchase" },
  purchase_receipt: { table: "po_inward", permission: "nav_purchase_inward" },
  jobwork_outward: { table: "challan", permission: "nav_challan" },
  jobwork_receipt: { table: "inward", permission: "nav_inward" },
  dispatch: { table: "dispatch", permission: "nav_dispatch" },
  stage: { table: "subplate", permission: "nav_subplate" },
} as const;

export async function authorizePhotoHistory(req: NextRequest, scope: PhotoHistoryScope) {
  const definition = definitions[scope.kind];
  const auth = await authenticateRequest(req, undefined, definition.permission);
  if ("error" in auth) return auth;
  const { data, error } = await supabaseAdmin.from(definition.table).select("*").eq("id", scope.id).maybeSingle();
  if (error) return { error: "Photo history verification temporarily unavailable", status: 503 };
  if (!data || data.deleted_at) return { error: "Record not found", status: 404 };
  // Parent access must never imply permission to see restricted child receipt evidence.
  let includeChildren = true;
  if (scope.kind === "purchase_order" || scope.kind === "jobwork_outward") {
    const child = await authenticateRequest(req, undefined, scope.kind === "purchase_order" ? "nav_purchase_inward" : "nav_inward");
    if ("error" in child && child.status !== 403) return child;
    includeChildren = !("error" in child);
  }
  return { user: auth.user, includeChildren };
}

export async function authorizeHistoryPhoto(req: NextRequest, photo: { id: number; movement_type: string; movement_id: number | null; subplate_id: number | null; stage_key: string | null; uploaded_by: number }) {
  const session = await authenticateRequest(req);
  if ("error" in session) return session;
  if (session.user.role_id === 0) return session;
  const { data: links, error } = await supabaseAdmin.from("photo_event_associations").select("movement_type, document_id").eq("photo_id", photo.id).not("document_id", "is", null);
  if (error) return { error: "Photo association verification unavailable", status: 503 };
  const candidates = links || [];
  const kinds = { purchase_inward: "purchase_receipt", jobwork_outward: "jobwork_outward", jobwork_inward: "jobwork_receipt", dispatch: "dispatch" } as const;
  for (const link of candidates) {
    const kind = kinds[link.movement_type as keyof typeof kinds];
    if (!kind) continue;
    const access = await authorizePhotoHistory(req, { kind, id: link.document_id });
    if (!("error" in access)) return access;
    if (access.status === 503) return access;
  }
  if (photo.subplate_id && ["vmc_qcby", "final_qcby", "packing_workby"].includes(photo.stage_key || "")) {
    return authorizePhotoHistory(req, { kind: "stage", id: photo.subplate_id, stageKey: photo.stage_key as "vmc_qcby" });
  }
  // Uncommitted previews belong only to the uploader and still require the current write permission.
  if (!candidates.length) {
    const actions: Record<string, string> = { purchase_inward: "action_create_purchase_inward", jobwork_outward: "action_create_challan", jobwork_inward: "action_create_inward", dispatch: "action_create_dispatch", subplate_qc: "action_edit_subplate", packing: "action_create_dispatch" };
    const action = actions[photo.movement_type];
    if (action) {
      const auth = await authenticateRequest(req, undefined, action);
      if (!("error" in auth) && auth.user.id === photo.uploaded_by) return auth;
    }
  }
  return { error: "Access denied to photo history", status: 403 };
}
