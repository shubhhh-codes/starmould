-- ==============================================================================
-- Movement Photos, Project Associations, Retention Cycles, and Export Jobs
-- Migration: 20261116123000_movement_photos_and_retention.sql
-- Date: 2026-11-16
-- ==============================================================================

-- 1. Table: movement_photos
CREATE TABLE IF NOT EXISTS public.movement_photos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/webp',
  width INTEGER,
  height INTEGER,
  movement_type TEXT NOT NULL CHECK (
    movement_type IN (
      'purchase_inward',
      'jobwork_outward',
      'jobwork_inward',
      'subplate_qc',
      'packing',
      'dispatch'
    )
  ),
  movement_id BIGINT,
  movement_number TEXT,
  party_name TEXT,
  subplate_id BIGINT REFERENCES public.subplate(id) ON DELETE SET NULL,
  stage_key TEXT,
  notes TEXT,
  watermark_text TEXT NOT NULL,
  server_uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  uploaded_by BIGINT NOT NULL REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ,
  deletion_reason TEXT,
  deleted_by BIGINT REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

-- 2. Table: photo_project_associations
-- Allows a single physical movement photo (e.g. multi-mould dispatch) to be linked across projects without duplicating stored bytes.
CREATE TABLE IF NOT EXISTS public.photo_project_associations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  photo_id BIGINT NOT NULL REFERENCES public.movement_photos(id) ON DELETE CASCADE,
  project_id BIGINT REFERENCES public.scan(id) ON DELETE SET NULL,
  project_code TEXT NOT NULL,
  mould_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  UNIQUE (photo_id, project_code)
);

-- 3. Table: photo_retention_cycles
-- Tracks 30-day photo retention once a project moves into Project Register.
CREATE TABLE IF NOT EXISTS public.photo_retention_cycles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.scan(id) ON DELETE CASCADE,
  project_code TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL,
  retention_deadline TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  reopened_at TIMESTAMPTZ,
  reminder_7d_sent_at TIMESTAMPTZ,
  reminder_3d_sent_at TIMESTAMPTZ,
  reminder_1d_sent_at TIMESTAMPTZ,
  photos_deleted_at TIMESTAMPTZ,
  photos_deleted_count INTEGER DEFAULT 0,
  total_bytes_freed BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

-- 4. Table: photo_export_jobs
-- Tracks admin project/mould/bulk ZIP exports.
CREATE TABLE IF NOT EXISTS public.photo_export_jobs (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('project', 'mould', 'bulk')),
  target_codes TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'expired')),
  r2_archive_key TEXT,
  total_photos INTEGER DEFAULT 0,
  archive_size_bytes BIGINT DEFAULT 0,
  created_by BIGINT NOT NULL REFERENCES public.users(id),
  error_message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_movement_photos_type_id
  ON public.movement_photos(movement_type, movement_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_movement_photos_subplate
  ON public.movement_photos(subplate_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_photo_project_associations_code
  ON public.photo_project_associations(project_code);

CREATE INDEX IF NOT EXISTS idx_photo_project_associations_photo
  ON public.photo_project_associations(photo_id);

CREATE INDEX IF NOT EXISTS idx_photo_retention_cycles_active
  ON public.photo_retention_cycles(is_active, retention_deadline)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_photo_export_jobs_status
  ON public.photo_export_jobs(status, expires_at);

-- 6. Row Level Security Configuration
ALTER TABLE public.movement_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_project_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_retention_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_export_jobs ENABLE ROW LEVEL SECURITY;

-- Grants to service_role
GRANT ALL ON public.movement_photos TO service_role;
GRANT ALL ON public.photo_project_associations TO service_role;
GRANT ALL ON public.photo_retention_cycles TO service_role;
GRANT ALL ON public.photo_export_jobs TO service_role;

GRANT USAGE ON SEQUENCE public.movement_photos_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.photo_project_associations_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.photo_retention_cycles_id_seq TO service_role;

-- Authenticated Read / Write access via CRM policy
CREATE POLICY movement_photos_read ON public.movement_photos
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY photo_project_associations_read ON public.photo_project_associations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY photo_retention_cycles_read ON public.photo_retention_cycles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY photo_export_jobs_read ON public.photo_export_jobs
  FOR SELECT TO authenticated
  USING (true);

