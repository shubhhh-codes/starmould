-- 004_rls_policies.sql
-- StarMould ERP: Role-Based Row Level Security Policies (Roles 0–4)
-- Role 0: Admin (Full ERP Access)
-- Role 1: Manager (Operations, Logistics, Reports, Financial Viewing)
-- Role 2: Supervisor (Floor Operations, Movements, QC, Worklog)
-- Role 3: Designer (CAD/CAM, Scanning, Subplate Pipeline)
-- Role 4: Worker (Worklog, Assigned Machine Tasks)

-- Enable RLS on all primary tables
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subplate ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS print ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS po_inward ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_inward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS challan ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS challan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inward ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS worklog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gram_calc ENABLE ROW LEVEL SECURITY;

-- Helper function to extract user's role_id from JWT / session claim
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS integer AS $$
BEGIN
  RETURN COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role_id')::integer,
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role_id')::integer,
    NULL -- Safe fallback: never default to Admin (0)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 1. Service Role full bypass on all tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users', 'customers', 'subplate', 'scan', 'print',
    'purchase', 'purchase_items', 'po_inward', 'purchase_inward_items',
    'challan', 'challan_items', 'inward', 'inward_items',
    'dispatch', 'dispatch_items', 'expense', 'worklog', 'gram_calc'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS service_role_all ON public.%I', t);
    EXECUTE format('CREATE POLICY service_role_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- 2. Users table policy: Admins only for mutations, authenticated for read
DROP POLICY IF EXISTS users_select_policy ON public.users;
CREATE POLICY users_select_policy ON public.users FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS users_admin_all ON public.users;
CREATE POLICY users_admin_all ON public.users FOR ALL TO authenticated USING (public.current_user_role() = 0);

-- 3. Financials (Expense & Gram): Admins (0) and Managers (1) only
DROP POLICY IF EXISTS expense_role_policy ON public.expense;
CREATE POLICY expense_role_policy ON public.expense FOR ALL TO authenticated USING (public.current_user_role() IN (0, 1));

DROP POLICY IF EXISTS gram_calc_read_all ON public.gram_calc;
CREATE POLICY gram_calc_read_all ON public.gram_calc FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS gram_calc_admin_write ON public.gram_calc;
CREATE POLICY gram_calc_admin_write ON public.gram_calc FOR ALL TO authenticated USING (public.current_user_role() IN (0, 1));

-- 4. Operational Tables (Purchase, Movements, Dispatch, Subplate, Scan, Print): Roles 0, 1, 2, 3
DROP POLICY IF EXISTS operational_scan_policy ON public.scan;
CREATE POLICY operational_scan_policy ON public.scan FOR ALL TO authenticated USING (public.current_user_role() IN (0, 1, 2, 3, 4));

DROP POLICY IF EXISTS operational_subplate_policy ON public.subplate;
CREATE POLICY operational_subplate_policy ON public.subplate FOR ALL TO authenticated USING (public.current_user_role() IN (0, 1, 2, 3));

DROP POLICY IF EXISTS operational_worklog_policy ON public.worklog;
CREATE POLICY operational_worklog_policy ON public.worklog FOR ALL TO authenticated USING (public.current_user_role() IN (0, 1, 2, 3, 4));

DROP POLICY IF EXISTS operational_movements_challan ON public.challan;
CREATE POLICY operational_movements_challan ON public.challan FOR ALL TO authenticated USING (public.current_user_role() IN (0, 1, 2));

DROP POLICY IF EXISTS operational_movements_inward ON public.inward;
CREATE POLICY operational_movements_inward ON public.inward FOR ALL TO authenticated USING (public.current_user_role() IN (0, 1, 2));

DROP POLICY IF EXISTS operational_movements_purchase ON public.purchase;
CREATE POLICY operational_movements_purchase ON public.purchase FOR ALL TO authenticated USING (public.current_user_role() IN (0, 1, 2));

DROP POLICY IF EXISTS operational_movements_dispatch ON public.dispatch;
CREATE POLICY operational_movements_dispatch ON public.dispatch FOR ALL TO authenticated USING (public.current_user_role() IN (0, 1, 2));
