-- Migration 006: Add per-stage timestamp columns to subplate table
-- These timestamps auto-record WHEN each production stage assignment was made.
-- They complement the existing *_by (INT FK→users) columns.

ALTER TABLE subplate ADD COLUMN IF NOT EXISTS design_at       TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE subplate ADD COLUMN IF NOT EXISTS order_at        TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE subplate ADD COLUMN IF NOT EXISTS received_work_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE subplate ADD COLUMN IF NOT EXISTS received_qc_at  TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE subplate ADD COLUMN IF NOT EXISTS vmc_work_at     TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE subplate ADD COLUMN IF NOT EXISTS vmc_qc_at       TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE subplate ADD COLUMN IF NOT EXISTS drilltap_at     TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE subplate ADD COLUMN IF NOT EXISTS final_qc_at     TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE subplate ADD COLUMN IF NOT EXISTS packing_at      TIMESTAMPTZ DEFAULT NULL;

-- Performance indexes for pipeline stage queries
CREATE INDEX IF NOT EXISTS idx_subplate_design_at ON subplate (design_at) WHERE design_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subplate_packing_at ON subplate (packing_at) WHERE packing_at IS NOT NULL;
