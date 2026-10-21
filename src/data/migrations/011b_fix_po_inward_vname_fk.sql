-- Fix po_inward vname foreign key: set legacy test orphan row (id=3403) to NULL and add FK constraint
-- Option (b) approved by user at Checkpoint C3

-- 1. Clear invalid test orphan vname on id=3403 (original value: vname=405, pid=3320, insrno='SM/PR/3391')
UPDATE public.po_inward 
SET vname = NULL 
WHERE id = 3403 AND vname = 405;

-- 2. Drop existing constraint if present and add foreign key to vendors(id)
ALTER TABLE public.po_inward DROP CONSTRAINT IF EXISTS fk_po_inward_vname;

ALTER TABLE public.po_inward 
  ADD CONSTRAINT fk_po_inward_vname 
  FOREIGN KEY (vname) REFERENCES public.vendors(id) ON DELETE RESTRICT;
