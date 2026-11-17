// ==============================================================================
// Movement Photos: Core Types, Identifiers, and Shared Contracts
// Section 3 of Photo System Architecture
// ==============================================================================

export type PhotoState =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "deletion_queued"
  | "deleting"
  | "delete_failed"
  | "deleted";

export type MovementType =
  | "purchase_inward"
  | "jobwork_outward"
  | "jobwork_inward"
  | "subplate_qc"
  | "packing"
  | "dispatch";

export interface PhotoRecord {
  id: number;
  r2_key: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  width: number | null;
  height: number | null;
  movement_type: MovementType;
  movement_id: number | null;
  movement_number: string | null;
  party_name: string | null;
  subplate_id: number | null;
  stage_key: string | null;
  notes: string | null;
  watermark_text: string;
  state: PhotoState;
  draft_id: string | null;
  event_id: string | null;
  client_upload_id: string | null;
  server_uploaded_at: string;
  uploaded_by: number;
  deleted_at: string | null;
  deletion_reason: string | null;
  created_at: string;
  updated_at: string;
  view_url?: string;
  download_url?: string;
}

export interface PhotoProjectAssociation {
  id: number;
  photo_id: number;
  project_id: number | null;
  project_code: string;
  mould_code: string | null;
  created_at: string;
}

export interface PhotoUploadAttempt {
  id: number;
  actor_id: number;
  client_upload_id: string;
  draft_id: string;
  event_id: string;
  movement_type: MovementType;
  canonical_uploaded_at: string;
  reserved_r2_key: string;
  processing_status: PhotoState;
  error_message: string | null;
  photo_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PhotoEventAssociation {
  id: number;
  photo_id: number;
  event_id: string;
  movement_type: MovementType;
  document_id: number | null;
  document_number: string | null;
  created_at: string;
}

export interface PhotoRetentionCycle {
  id: number;
  project_id: number;
  project_code: string;
  generation: number;
  registered_at: string;
  deletion_deadline: string;
  is_active: boolean;
  cancelled_at: string | null;
  photos_deleted_at: string | null;
  created_at: string;
}

export interface PhotoDeletionJob {
  id: number;
  photo_id: number;
  reason: string;
  generation: number;
  state: "queued" | "in_progress" | "completed" | "failed";
  attempts: number;
  last_error: string | null;
  next_retry_at: string;
  confirmed_deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhotoExportJob {
  id: number;
  scope_type: "project" | "mould" | "bulk_projects";
  scope_params: Record<string, unknown>;
  requester_id: number;
  status: "pending" | "processing" | "completed" | "failed" | "expired";
  r2_key: string | null;
  file_size_bytes: number | null;
  total_photos: number;
  error_message: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface FinalizeMovementPhotosInput {
  draftId?: string;
  eventId: string;
  movementType: MovementType;
  movementId?: number;
  movementNumber?: string;
  partyName?: string;
  photoIds: number[];
  projectCodes: string[];
  mouldCode?: string;
  subplateId?: number;
  subplateCode?: string;
}

