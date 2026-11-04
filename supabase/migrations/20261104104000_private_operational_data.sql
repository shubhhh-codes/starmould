-- Browser JWTs receive invalidation markers only. Business records use service-role APIs.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, app_realtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, app_realtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, app_realtime;

CREATE TABLE IF NOT EXISTS public.module_invalidations (
  module text PRIMARY KEY,
  version uuid NOT NULL DEFAULT gen_random_uuid()
);
ALTER TABLE public.module_invalidations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.module_invalidations FROM PUBLIC, anon, authenticated, app_realtime;
CREATE POLICY module_invalidations_read ON public.module_invalidations FOR SELECT TO app_realtime USING (true);
GRANT SELECT ON public.module_invalidations TO app_realtime;
GRANT ALL ON public.module_invalidations TO service_role;

CREATE OR REPLACE FUNCTION public.invalidate_module() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.module_invalidations(module, version) VALUES (TG_TABLE_NAME, gen_random_uuid())
    ON CONFLICT (module) DO UPDATE SET version = EXCLUDED.version;
  RETURN NULL;
END;
$$;

-- User-editable JWT metadata cannot regain operational access through definer RPCs.
DO $$
DECLARE routine record;
BEGIN
  FOR routine IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prosecdef LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, app_realtime', routine.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', routine.signature);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_module() FROM PUBLIC, anon, authenticated, app_realtime;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['scan','subplate','purchase','purchase_items','po_inward','purchase_inward_items',
    'challan','challan_items','inward','inward_items','dispatch','dispatch_items','app_config','customers','vendors','worklog','expense','quotations','quotation_items'] LOOP
    EXECUTE format('CREATE TRIGGER invalidate_module_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_module()', t);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND
     NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'module_invalidations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.module_invalidations;
  END IF;
END;
$$;

-- Explicitly close the previously unscoped financial aggregate RPC.
REVOKE ALL ON FUNCTION public.get_expense_totals() FROM PUBLIC, anon, authenticated, app_realtime;
GRANT EXECUTE ON FUNCTION public.get_expense_totals() TO service_role;
ALTER FUNCTION public.get_expense_totals() SET search_path = public, pg_temp;

-- Inventory views must apply caller permissions, including when a future grant is added.
DO $$
DECLARE view_name text;
BEGIN
  FOR view_name IN SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name LIKE 'view_%' LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', view_name);
  END LOOP;
END;
$$;
