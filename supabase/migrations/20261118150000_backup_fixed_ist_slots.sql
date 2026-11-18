-- Durable checkpoint: recover an uploaded SQL file after a process/DB interruption.
ALTER TABLE backup_control.jobs ADD COLUMN IF NOT EXISTS staged_manifest jsonb;
ALTER TABLE backup_control.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE backup_control.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('queued','running','completed','failed','expired','missed'));
-- Existing unfinished rows adopt the corrected same-day target; completed history stays intact.
UPDATE backup_control.jobs SET scheduled_at=
  ((scheduled_at AT TIME ZONE 'Asia/Kolkata')::date + CASE slot
    WHEN 'morning' THEN time '10:00' WHEN 'midday' THEN time '12:30'
    WHEN 'afternoon' THEN time '16:00' WHEN 'evening' THEN time '19:00' END)
  AT TIME ZONE 'Asia/Kolkata'
WHERE kind='scheduled' AND status IN ('queued','failed') AND lease_until IS NULL;
