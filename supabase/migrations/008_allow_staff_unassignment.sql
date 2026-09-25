-- Migration 008: Allow NULL values for staff assignment columns across all tables
-- This ensures admins and managers can unassign mistakenly assigned staff.

-- 1. Table: scan (Scanning Master, Sample & Rework)
ALTER TABLE public.scan ALTER COLUMN scan_by DROP NOT NULL;
ALTER TABLE public.scan ALTER COLUMN scan_by SET DEFAULT NULL;

ALTER TABLE public.scan ALTER COLUMN modeldesign_by DROP NOT NULL;
ALTER TABLE public.scan ALTER COLUMN modeldesign_by SET DEFAULT NULL;

ALTER TABLE public.scan ALTER COLUMN qc_by DROP NOT NULL;
ALTER TABLE public.scan ALTER COLUMN qc_by SET DEFAULT NULL;

UPDATE public.scan SET scan_by = NULL WHERE scan_by = 0;
UPDATE public.scan SET modeldesign_by = NULL WHERE modeldesign_by = 0;
UPDATE public.scan SET qc_by = NULL WHERE qc_by = 0;

-- 2. Table: print (Printing & CAM Master)
ALTER TABLE public.print ALTER COLUMN print_by DROP NOT NULL;
ALTER TABLE public.print ALTER COLUMN print_by SET DEFAULT NULL;

ALTER TABLE public.print ALTER COLUMN qc_by DROP NOT NULL;
ALTER TABLE public.print ALTER COLUMN qc_by SET DEFAULT NULL;

UPDATE public.print SET print_by = NULL WHERE print_by = 0;
UPDATE public.print SET qc_by = NULL WHERE qc_by = 0;

-- 3. Table: subplate (Subplate Workpiece 9-Stage Tracking)
ALTER TABLE public.subplate ALTER COLUMN design_by DROP NOT NULL;
ALTER TABLE public.subplate ALTER COLUMN order_by DROP NOT NULL;
ALTER TABLE public.subplate ALTER COLUMN received_workby DROP NOT NULL;
ALTER TABLE public.subplate ALTER COLUMN received_qcby DROP NOT NULL;
ALTER TABLE public.subplate ALTER COLUMN vmc_workby DROP NOT NULL;
ALTER TABLE public.subplate ALTER COLUMN vmc_qcby DROP NOT NULL;
ALTER TABLE public.subplate ALTER COLUMN drilltap_workby DROP NOT NULL;
ALTER TABLE public.subplate ALTER COLUMN final_qcby DROP NOT NULL;
ALTER TABLE public.subplate ALTER COLUMN packing_workby DROP NOT NULL;

UPDATE public.subplate SET design_by = NULL WHERE design_by = 0;
UPDATE public.subplate SET order_by = NULL WHERE order_by = 0;
UPDATE public.subplate SET received_workby = NULL WHERE received_workby = 0;
UPDATE public.subplate SET received_qcby = NULL WHERE received_qcby = 0;
UPDATE public.subplate SET vmc_workby = NULL WHERE vmc_workby = 0;
UPDATE public.subplate SET vmc_qcby = NULL WHERE vmc_qcby = 0;
UPDATE public.subplate SET drilltap_workby = NULL WHERE drilltap_workby = 0;
UPDATE public.subplate SET final_qcby = NULL WHERE final_qcby = 0;
UPDATE public.subplate SET packing_workby = NULL WHERE packing_workby = 0;
