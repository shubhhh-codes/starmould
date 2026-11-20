-- Migration: Add subplate_type column to subplates table
-- Purpose: Distinguish 'repair' subplates (mould returned for rework) from 'new_make' subplates
-- Repair subplates do not require dimensions/material/shape; New Make subplates do.

ALTER TABLE subplate
  ADD COLUMN IF NOT EXISTS subplate_type TEXT NOT NULL DEFAULT 'new_make'
  CHECK (subplate_type IN ('new_make', 'repair'));

-- All existing subplates are treated as 'new_make' (safe backward-compatible default)
UPDATE subplate SET subplate_type = 'new_make' WHERE subplate_type IS NULL;

-- Index for fast filtering by type
CREATE INDEX IF NOT EXISTS idx_subplate_type ON subplate(subplate_type);

COMMENT ON COLUMN subplate.subplate_type IS
  'new_make = fresh subplate being manufactured; repair = existing mould returned for rework, no dimensions needed';
