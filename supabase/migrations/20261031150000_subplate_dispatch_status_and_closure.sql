-- Migration: 20261031150000_subplate_dispatch_status_and_closure.sql
-- Description: Adds dispatch status, closure reason, closed_at, and closed_by to subplate table

ALTER TABLE subplate ADD COLUMN IF NOT EXISTS dispatch_status VARCHAR(50) DEFAULT NULL;
ALTER TABLE subplate ADD COLUMN IF NOT EXISTS closure_reason TEXT DEFAULT NULL;
ALTER TABLE subplate ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE subplate ADD COLUMN IF NOT EXISTS closed_by INT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_subplate_dispatch_status ON subplate(dispatch_status);
