-- Fix users table trigger to allow UPDATE (soft delete and status updates)
-- The old trg_protect_super_admin was mistakenly attached to UPDATE with a function returning OLD,
-- causing all UPDATEs on users (including setting deleted_at or status) to be silently discarded.

DROP TRIGGER IF EXISTS trg_protect_super_admin ON public.users;
DROP TRIGGER IF EXISTS trg_protect_super_admin_delete ON public.users;

-- Ensure prevent_super_admin_deletion returns OLD on DELETE, or NEW on UPDATE
CREATE OR REPLACE FUNCTION prevent_super_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.id = '1' 
     OR LOWER(COALESCE(OLD.username, '')) = 'admin' 
     OR LOWER(COALESCE(OLD.email, '')) = 'admin@star.in' 
  THEN
    RAISE EXCEPTION 'CRITICAL SECURITY ERROR: Super Admin account (admin / ID 1) is permanently locked and cannot be deleted from the database under any circumstances.'
      USING ERRCODE = 'check_violation';
  END IF;
  
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Dedicated DELETE-only protection trigger
CREATE TRIGGER trg_protect_super_admin_delete
BEFORE DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION prevent_super_admin_deletion();
