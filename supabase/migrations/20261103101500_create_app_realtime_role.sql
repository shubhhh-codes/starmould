-- Create app_realtime role with read-only permissions for Supabase Realtime WebSocket subscriptions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_realtime') THEN
    CREATE ROLE app_realtime NOLOGIN;
  END IF;

  GRANT app_realtime TO authenticator;
  GRANT USAGE ON SCHEMA public TO app_realtime;

  -- Read-only SELECT permissions on all 6 realtime operational tables (no insert/update/delete)
  GRANT SELECT ON public.scan, public.subplate, public.purchase, public.po_inward, public.challan, public.dispatch TO app_realtime;

  -- Remove legacy public read policies from scan & subplate so anon cannot read data
  DROP POLICY IF EXISTS "Allow authenticated read" ON public.scan;
  DROP POLICY IF EXISTS "Allow authenticated read" ON public.subplate;

  -- Create FOR SELECT policy for app_realtime on each of the 6 tables
  DROP POLICY IF EXISTS realtime_scan_select_app ON public.scan;
  CREATE POLICY realtime_scan_select_app ON public.scan FOR SELECT TO app_realtime USING (public.current_user_role() IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));

  DROP POLICY IF EXISTS realtime_subplate_select_app ON public.subplate;
  CREATE POLICY realtime_subplate_select_app ON public.subplate FOR SELECT TO app_realtime USING (public.current_user_role() IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));

  DROP POLICY IF EXISTS realtime_purchase_select_app ON public.purchase;
  CREATE POLICY realtime_purchase_select_app ON public.purchase FOR SELECT TO app_realtime USING (public.current_user_role() IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));

  DROP POLICY IF EXISTS realtime_po_inward_select_app ON public.po_inward;
  CREATE POLICY realtime_po_inward_select_app ON public.po_inward FOR SELECT TO app_realtime USING (public.current_user_role() IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));

  DROP POLICY IF EXISTS realtime_challan_select_app ON public.challan;
  CREATE POLICY realtime_challan_select_app ON public.challan FOR SELECT TO app_realtime USING (public.current_user_role() IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));

  DROP POLICY IF EXISTS realtime_dispatch_select_app ON public.dispatch;
  CREATE POLICY realtime_dispatch_select_app ON public.dispatch FOR SELECT TO app_realtime USING (public.current_user_role() IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
END $$;
