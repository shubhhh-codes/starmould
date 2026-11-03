-- Fix Realtime RLS Security: restore restricted write scope to operational policies
-- and create dedicated FOR SELECT policies for realtime subscriptions across roles 0..10.
-- Supersedes 20261102145500.

DO $$
BEGIN
  -- 1. Restore operational_scan_policy write scope (roles 0,1,2,3,4)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'scan' AND policyname = 'operational_scan_policy') THEN
    ALTER POLICY operational_scan_policy ON public.scan USING (public.current_user_role() IN (0, 1, 2, 3, 4));
  END IF;

  -- 2. Restore operational_subplate_policy write scope (roles 0,1,2,3)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subplate' AND policyname = 'operational_subplate_policy') THEN
    ALTER POLICY operational_subplate_policy ON public.subplate USING (public.current_user_role() IN (0, 1, 2, 3));
  END IF;

  -- 3. Dedicated SELECT policy for realtime scan subscriptions (all operational roles 0..10)
  DROP POLICY IF EXISTS realtime_scan_select ON public.scan;
  CREATE POLICY realtime_scan_select ON public.scan FOR SELECT TO authenticated USING (public.current_user_role() IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));

  -- 4. Dedicated SELECT policy for realtime subplate subscriptions (all operational roles 0..10)
  DROP POLICY IF EXISTS realtime_subplate_select ON public.subplate;
  CREATE POLICY realtime_subplate_select ON public.subplate FOR SELECT TO authenticated USING (public.current_user_role() IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
END $$;
