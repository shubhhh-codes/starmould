-- 20261019090000_app_config_and_security.sql
-- Consolidated: app_config, must_change_password flag, and delta sync indexes

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial empty config rows
INSERT INTO public.app_config (key, value) 
VALUES ('role_permissions', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, value)
VALUES ('role_menu_orders', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS (service role can bypass)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.app_config;
CREATE POLICY "Service role only" ON public.app_config
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Add forced password reset flag to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Delta sync query optimization indexes
CREATE INDEX IF NOT EXISTS idx_scan_updated_at ON public.scan (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_created_at ON public.scan (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subplate_updated_at ON public.subplate (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_subplate_created_at ON public.subplate (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subplate_mold_id ON public.subplate (mold_id);
