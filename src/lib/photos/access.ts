// ==============================================================================
// Movement Photos: Centralized Server Access & Authorization Control
// Section 4 (F01) of Photo System Architecture
// ==============================================================================

import { SessionUser } from "@/lib/auth";
import { loadEffectiveConfig } from "@/lib/permissions/loader";
import { MovementType } from "./types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export function isAdminUser(user: { role_id?: number; role?: string } | null | undefined): boolean {
  if (!user) return false;
  return user.role_id === 0 || user.role?.toLowerCase() === "admin";
}

const MOVEMENT_PERMISSION_MAP: Record<MovementType, { writeAction: string; readNav: string; allowedRoles?: number[] }> = {
  purchase_inward: {
    writeAction: "action_create_purchase_inward",
    readNav: "nav_purchase",
    allowedRoles: [0, 1, 5], // Admin, Manager, Purchase Incharge
  },
  jobwork_outward: {
    writeAction: "action_create_challan",
    readNav: "nav_challan",
    allowedRoles: [0, 1, 5, 9], // Admin, Manager, Purchase Incharge, Dispatch
  },
  jobwork_inward: {
    writeAction: "action_create_inward",
    readNav: "nav_inward",
    allowedRoles: [0, 1, 5, 7], // Admin, Manager, Purchase Incharge, QC
  },
  subplate_qc: {
    writeAction: "action_edit_subplate",
    readNav: "nav_subplate",
    allowedRoles: [0, 1, 2, 6, 7], // Admin, Manager, Supervisor, VMC, QC
  },
  packing: {
    writeAction: "action_create_dispatch",
    readNav: "nav_dispatch",
    allowedRoles: [0, 1, 2, 9], // Admin, Manager, Supervisor, Dispatch
  },
  dispatch: {
    writeAction: "action_create_dispatch",
    readNav: "nav_dispatch",
    allowedRoles: [0, 1, 9], // Admin, Manager, Dispatch
  },
};

/**
 * Checks if the caller has write authorization to capture/upload photos for a specific movement type.
 */
export async function authorizePhotoUpload(
  user: SessionUser,
  movementType: MovementType
): Promise<{ allowed: boolean; reason?: string }> {
  if (isAdminUser(user)) return { allowed: true };

  const config = MOVEMENT_PERMISSION_MAP[movementType];
  if (!config) {
    return { allowed: false, reason: `Unknown movement type "${movementType}"` };
  }

  const { permissions } = await loadEffectiveConfig();
  const rolePerms = permissions[user.role_id] || {};

  // Check specific granular action permission if configured
  if (rolePerms[config.writeAction] === true) {
    return { allowed: true };
  }

  // Fallback to allowed roles
  if (config.allowedRoles && config.allowedRoles.includes(user.role_id)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `User role (${user.role || user.role_id}) does not have permission to record photos for ${movementType}`,
  };
}

/**
 * Authorizes read access to view or download a specific photo record.
 */
export async function authorizePhotoView(
  user: SessionUser,
  photoId: number
): Promise<{ allowed: boolean; photo?: any; reason?: string }> {
  // Query photo with association metadata
  const { data: photo, error } = await supabaseAdmin
    .from("movement_photos")
    .select("id, movement_type, uploaded_by, deleted_at, r2_key, original_filename, file_size_bytes, mime_type, server_uploaded_at")
    .eq("id", photoId)
    .maybeSingle();

  if (error || !photo) {
    return { allowed: false, reason: "Photo not found" };
  }

  if (photo.deleted_at && !isAdminUser(user)) {
    return { allowed: false, reason: "Photo has been deleted or retention period expired" };
  }

  if (isAdminUser(user)) {
    return { allowed: true, photo };
  }

  // User can always view their own uploaded photo
  if (photo.uploaded_by === user.id) {
    return { allowed: true, photo };
  }

  // Check navigation permission for this movement category
  const config = MOVEMENT_PERMISSION_MAP[photo.movement_type as MovementType];
  if (config) {
    const { permissions } = await loadEffectiveConfig();
    const rolePerms = permissions[user.role_id] || {};
    if (rolePerms[config.readNav] === true || rolePerms[config.writeAction] === true) {
      return { allowed: true, photo };
    }
    if (config.allowedRoles && config.allowedRoles.includes(user.role_id)) {
      return { allowed: true, photo };
    }
  }

  return { allowed: false, reason: "Unauthorized to view photo evidence for this movement" };
}

/**
 * Checks if the caller is authorized for admin-exclusive photo storage operations
 * (ZIP backups, bulk export, permanent deletion, bucket stats, manual retention).
 */
export function authorizePhotoAdmin(user: SessionUser): { allowed: boolean; reason?: string } {
  if (isAdminUser(user)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: "Restricted to Super Administrators. You do not have permission for photo storage management.",
  };
}

