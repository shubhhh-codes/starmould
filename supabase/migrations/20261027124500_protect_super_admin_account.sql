-- Protect Super Admin account from being deleted or soft-deleted
CREATE OR REPLACE FUNCTION prevent_super_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if target is Super Admin
  IF (OLD.username = 'admin' OR OLD.email = 'admin@star.in' OR OLD.id = 1) THEN
    IF (TG_OP = 'DELETE') THEN
      RAISE EXCEPTION 'Super Admin account is permanently locked and cannot be deleted.';
    END IF;
    IF (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Super Admin account is permanently locked and cannot be soft-deleted.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_super_admin ON public.users;
CREATE TRIGGER trg_protect_super_admin
BEFORE UPDATE OR DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION prevent_super_admin_deletion();
