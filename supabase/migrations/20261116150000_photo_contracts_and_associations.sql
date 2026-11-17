-- ==============================================================================
-- Forward Migration: Photo Contracts, Event Associations, Upload Attempts, and Deletion Jobs
-- Migration: 20261116150000_photo_contracts_and_associations.sql
-- Date: 2026-11-16
-- ==============================================================================

-- 1. Table: photo_upload_attempts
-- Enforces idempotent file uploads per actor and prevents duplicate physical object creation
CREATE TABLE IF NOT EXISTS public.photo_upload_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id BIGINT NOT NULL REFERENCES public.users(id),
  client_upload_id TEXT NOT NULL,
  draft_id TEXT,
  event_id TEXT,
  movement_type TEXT NOT NULL,
  canonical_uploaded_at TIMESTAMPTZ NOT NULL,
  reserved_r2_key TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'processing',
  error_message TEXT,
  photo_id BIGINT REFERENCES public.movement_photos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  UNIQUE (actor_id, client_upload_id)
);

-- 2. Table: photo_event_associations
-- Maps a physical photo to logical movement, QC, or packing events (supports one-to-many receipts)
CREATE TABLE IF NOT EXISTS public.photo_event_associations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  photo_id BIGINT NOT NULL REFERENCES public.movement_photos(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  document_id BIGINT,
  document_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  UNIQUE (photo_id, event_id)
);

-- 3. Table: photo_deletion_jobs
-- Asynchronous retryable deletion queue for expired retention photos and admin cleanups
CREATE TABLE IF NOT EXISTS public.photo_deletion_jobs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  photo_id BIGINT NOT NULL REFERENCES public.movement_photos(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  generation INT NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'in_progress', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  confirmed_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('UTC', now())
);

-- 4. Essential Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_photo_upload_attempts_actor_client ON public.photo_upload_attempts(actor_id, client_upload_id);
CREATE INDEX IF NOT EXISTS idx_photo_event_associations_event_id ON public.photo_event_associations(event_id);
CREATE INDEX IF NOT EXISTS idx_photo_event_associations_document ON public.photo_event_associations(movement_type, document_id);
CREATE INDEX IF NOT EXISTS idx_photo_deletion_jobs_state_retry ON public.photo_deletion_jobs(state, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_movement_photos_server_uploaded_at ON public.movement_photos(server_uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_project_associations_project_id ON public.photo_project_associations(project_id);
CREATE INDEX IF NOT EXISTS idx_photo_project_associations_project_code ON public.photo_project_associations(project_code);

-- 5. Row-Level Security
ALTER TABLE public.photo_upload_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_event_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_deletion_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'photo_upload_attempts' AND policyname = 'service_role_all_photo_upload_attempts') THEN
    CREATE POLICY service_role_all_photo_upload_attempts ON public.photo_upload_attempts FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'photo_event_associations' AND policyname = 'service_role_all_photo_event_associations') THEN
    CREATE POLICY service_role_all_photo_event_associations ON public.photo_event_associations FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'photo_deletion_jobs' AND policyname = 'service_role_all_photo_deletion_jobs') THEN
    CREATE POLICY service_role_all_photo_deletion_jobs ON public.photo_deletion_jobs FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

