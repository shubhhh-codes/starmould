-- Migration 015: Indexes for Delta Incremental Sync
-- Optimizes query performance for `updated_at > since` delta synchronization

CREATE INDEX IF NOT EXISTS idx_scan_updated_at ON public.scan (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_created_at ON public.scan (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subplate_updated_at ON public.subplate (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_subplate_created_at ON public.subplate (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subplate_mold_id ON public.subplate (mold_id);
