-- No client storage policy grants access to this bucket; service_role owns the lifecycle.
INSERT INTO storage.buckets (id, name, public)
VALUES ('database-backups', 'database-backups', false)
ON CONFLICT (id) DO UPDATE SET public = false;
