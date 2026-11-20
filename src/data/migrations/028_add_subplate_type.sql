-- Migration 028: Add subplate_type to subplate table
-- Distinguishes 'new_make' (fresh manufacturing, requires dimensions) and 'repair' (existing mould rework, no dimensions required)

ALTER TABLE subplate
  ADD COLUMN IF NOT EXISTS subplate_type TEXT NOT NULL DEFAULT 'new_make'
  CHECK (subplate_type IN ('new_make', 'repair'));

UPDATE subplate SET subplate_type = 'new_make' WHERE subplate_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_subplate_type ON subplate(subplate_type);
