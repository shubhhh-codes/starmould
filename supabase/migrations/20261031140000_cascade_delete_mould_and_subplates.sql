-- ==============================================================================
-- Migration: Cascade Delete Mould, Subplates & Worklogs + Database Integrity
-- Date: 2026-10-31
-- Description:
--   1. Purges all soft-deleted / orphaned subplates and worklogs from database.
--   2. Adds Foreign Key fk_subplate_mold_id with ON DELETE CASCADE.
--   3. Adds PostgreSQL BEFORE DELETE Triggers on public.scan and public.subplate
--      to guarantee 100% cascade cleanup of child records at the DB kernel level.
-- ==============================================================================

-- 1. PURGE ORPHANED AND SOFT-DELETED SUBPLATES
-- Delete all subplates marked deleted_at or referencing non-existent scans
DELETE FROM public.worklog
WHERE subplateid ~ '^[0-9]+$' 
  AND NOT EXISTS (SELECT 1 FROM public.subplate sp WHERE sp.id = subplateid::bigint);

DELETE FROM public.subplate
WHERE deleted_at IS NOT NULL
   OR (mold_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.scan sc WHERE sc.id = mold_id))
   OR NOT EXISTS (
        SELECT 1 FROM public.scan sc 
        WHERE sc.id = subplate.mold_id 
           OR sc.projectid = subplate.mold_code 
           OR (subplate.projectid ~ '^[0-9]+$' AND sc.id = subplate.projectid::bigint)
           OR sc.projectid = subplate.projectid
      );

-- Clean up any worklogs linked to deleted scan projects
DELETE FROM public.worklog
WHERE scan_print_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.scan sc WHERE sc.id = scan_print_id);

-- 2. ADD FOREIGN KEY CONSTRAINT WITH CASCADE ON subplate.mold_id
-- Ensure mold_id matches scan.id where valid, or nullify invalid ones
UPDATE public.subplate sp
SET mold_id = NULL
WHERE mold_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.scan sc WHERE sc.id = sp.mold_id);

ALTER TABLE public.subplate
  DROP CONSTRAINT IF EXISTS fk_subplate_mold_id;

ALTER TABLE public.subplate
  ADD CONSTRAINT fk_subplate_mold_id
  FOREIGN KEY (mold_id)
  REFERENCES public.scan(id)
  ON DELETE CASCADE;

-- 3. POSTGRESQL BEFORE DELETE TRIGGER ON public.scan
-- Automatically cascades deletions to subplate and worklog tables even if deleted via raw SQL
CREATE OR REPLACE FUNCTION public.fn_cascade_delete_scan_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Cascade delete operator worklogs
  DELETE FROM public.worklog 
  WHERE scan_print_id = OLD.id 
     OR (OLD.projectid IS NOT NULL AND projectid = OLD.projectid);

  -- 2. Cascade delete all child subplates matching by mold_id, mold_code, or projectid
  DELETE FROM public.subplate
  WHERE mold_id = OLD.id 
     OR (OLD.projectid IS NOT NULL AND mold_code = OLD.projectid)
     OR projectid = OLD.id::text 
     OR (OLD.projectid IS NOT NULL AND projectid = OLD.projectid);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_delete_scan ON public.scan;
CREATE TRIGGER trg_cascade_delete_scan
BEFORE DELETE ON public.scan
FOR EACH ROW
EXECUTE FUNCTION public.fn_cascade_delete_scan_cleanup();

-- 4. POSTGRESQL BEFORE DELETE TRIGGER ON public.subplate
-- Automatically cascades deletions to worklog table when a subplate is deleted
CREATE OR REPLACE FUNCTION public.fn_cascade_delete_subplate_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.worklog 
  WHERE subplateid = OLD.id::text 
     OR (OLD.subprojectid IS NOT NULL AND subplateid = OLD.subprojectid);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_delete_subplate ON public.subplate;
CREATE TRIGGER trg_cascade_delete_subplate
BEFORE DELETE ON public.subplate
FOR EACH ROW
EXECUTE FUNCTION public.fn_cascade_delete_subplate_cleanup();
