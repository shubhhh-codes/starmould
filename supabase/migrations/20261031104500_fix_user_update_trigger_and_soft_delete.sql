-- Fix users table trigger to allow UPDATE (soft delete and status updates for regular users)
-- while permanently protecting Super Admin (ID 1 / admin) against DELETE, soft-delete, and deactivation.

DROP TRIGGER IF EXISTS trg_protect_super_admin ON public.users;
DROP TRIGGER IF EXISTS trg_protect_super_admin_delete ON public.users;

CREATE OR REPLACE FUNCTION prevent_super_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.id::text = '1' 
       OR LOWER(COALESCE(OLD.username, '')) = 'admin' 
       OR LOWER(COALESCE(OLD.email, '')) = 'admin@star.in' 
    THEN
      RAISE EXCEPTION 'CRITICAL SECURITY ERROR: Super Admin account (admin / ID 1) is permanently locked and cannot be deleted from the database under any circumstances.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.id::text = '1' 
        OR LOWER(COALESCE(OLD.username, '')) = 'admin' 
        OR LOWER(COALESCE(OLD.email, '')) = 'admin@star.in')
       AND (NEW.deleted_at IS NOT NULL OR NEW.status = 0)
    THEN
      RAISE EXCEPTION 'CRITICAL SECURITY ERROR: Super Admin account (admin / ID 1) cannot be deactivated or soft-deleted.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_super_admin
BEFORE DELETE OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION prevent_super_admin_deletion();
