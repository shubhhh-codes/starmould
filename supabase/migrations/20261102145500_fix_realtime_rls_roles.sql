-- Allow all authenticated manufacturing roles to receive realtime events on scan and subplate
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'scan' AND policyname = 'operational_scan_policy') THEN
    ALTER POLICY operational_scan_policy ON public.scan USING (public.current_user_role() IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subplate' AND policyname = 'operational_subplate_policy') THEN
    ALTER POLICY operational_subplate_policy ON public.subplate USING (public.current_user_role() IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
  END IF;
END $$;
