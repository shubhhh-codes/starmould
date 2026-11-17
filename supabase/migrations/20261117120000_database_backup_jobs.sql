-- Private coordinator. Access is through trusted server PostgreSQL credentials,
-- never the browser/PostgREST API. No production data is modified.
CREATE SCHEMA IF NOT EXISTS backup_control;
REVOKE ALL ON SCHEMA backup_control FROM PUBLIC;
CREATE TABLE IF NOT EXISTS backup_control.settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  paused boolean NOT NULL DEFAULT false,
  enabled_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO backup_control.settings(singleton) VALUES (true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS backup_control.jobs (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('scheduled','manual')),
  slot text,
  scheduled_at timestamptz NOT NULL,
  requested_by bigint,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','expired')),
  source text,
  generation integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  deadline timestamptz,
  retry_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  captured_at timestamptz,
  completed_at timestamptz,
  error_code text,
  manifest jsonb,
  CHECK ((kind = 'scheduled' AND slot IN ('morning','midday','afternoon','evening')) OR
         (kind = 'manual' AND slot IS NULL)),
  CHECK (status <> 'completed' OR manifest IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS backup_jobs_pending ON backup_control.jobs(status,scheduled_at);
CREATE TABLE IF NOT EXISTS backup_control.workers (
  name text PRIMARY KEY,
  last_seen timestamptz NOT NULL DEFAULT clock_timestamp(),
  fallback_enabled boolean NOT NULL DEFAULT true
);
ALTER TABLE backup_control.workers ADD COLUMN IF NOT EXISTS fallback_enabled boolean NOT NULL DEFAULT true;
REVOKE ALL ON ALL TABLES IN SCHEMA backup_control FROM PUBLIC;
-- Schema is deliberately not added to Supabase's exposed schemas.
