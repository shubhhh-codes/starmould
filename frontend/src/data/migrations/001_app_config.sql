-- Run this migration in Supabase SQL Editor
-- Creates the app_config table for storing dynamic ERP configuration (permissions, menu orders, etc.)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial empty config rows
INSERT INTO app_config (key, value) 
VALUES ('role_permissions', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value)
VALUES ('role_menu_orders', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS (service role can bypass)
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role only" ON app_config
  USING (false);
