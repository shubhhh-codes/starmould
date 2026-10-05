-- Migration 011: Update Stage 2 and Stage 4 Documentation in Subplate Table
-- Date: 2026-10-05
-- Description: Updates metadata/comments for subplate production pipeline stages:
--   Stage 2: Purchase (column: order_by, timestamp: order_at)
--   Stage 4: Programming Work (column: received_qcby, timestamp: received_qc_at)

COMMENT ON COLUMN public.subplate.order_by IS 'Stage 2: Purchase staff assignment';
COMMENT ON COLUMN public.subplate.order_at IS 'Stage 2: Purchase assignment timestamp';

COMMENT ON COLUMN public.subplate.received_qcby IS 'Stage 4: Programming Work staff assignment';
COMMENT ON COLUMN public.subplate.received_qc_at IS 'Stage 4: Programming Work assignment timestamp';
