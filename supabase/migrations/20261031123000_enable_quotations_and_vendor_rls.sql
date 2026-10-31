-- 20261031123000_enable_quotations_and_vendor_rls.sql
-- Security Hardening: Enable RLS on Quotations and ensure soft-deleted customers/vendors are filtered in RLS

-- 1. Enable Row Level Security on Quotations tables
ALTER TABLE IF EXISTS public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quotation_terms_presets ENABLE ROW LEVEL SECURITY;

-- Service role bypass
DROP POLICY IF EXISTS service_role_quotations ON public.quotations;
CREATE POLICY service_role_quotations ON public.quotations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_quotation_items ON public.quotation_items;
CREATE POLICY service_role_quotation_items ON public.quotation_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_quotation_presets ON public.quotation_terms_presets;
CREATE POLICY service_role_quotation_presets ON public.quotation_terms_presets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated Users: View active quotations
DROP POLICY IF EXISTS quotations_select_policy ON public.quotations;
CREATE POLICY quotations_select_policy ON public.quotations 
    FOR SELECT TO authenticated 
    USING (deleted_at IS NULL);

DROP POLICY IF EXISTS quotation_items_select_policy ON public.quotation_items;
CREATE POLICY quotation_items_select_policy ON public.quotation_items 
    FOR SELECT TO authenticated 
    USING (true);

DROP POLICY IF EXISTS quotation_presets_select_policy ON public.quotation_terms_presets;
CREATE POLICY quotation_presets_select_policy ON public.quotation_terms_presets 
    FOR SELECT TO authenticated 
    USING (true);

-- Management Users (Roles 0, 1, 5): Full management access
DROP POLICY IF EXISTS quotations_manage_policy ON public.quotations;
CREATE POLICY quotations_manage_policy ON public.quotations 
    FOR ALL TO authenticated 
    USING (public.current_user_role() IN (0, 1, 5))
    WITH CHECK (public.current_user_role() IN (0, 1, 5));

DROP POLICY IF EXISTS quotation_items_manage_policy ON public.quotation_items;
CREATE POLICY quotation_items_manage_policy ON public.quotation_items 
    FOR ALL TO authenticated 
    USING (public.current_user_role() IN (0, 1, 5))
    WITH CHECK (public.current_user_role() IN (0, 1, 5));

DROP POLICY IF EXISTS quotation_presets_manage_policy ON public.quotation_terms_presets;
CREATE POLICY quotation_presets_manage_policy ON public.quotation_terms_presets 
    FOR ALL TO authenticated 
    USING (public.current_user_role() IN (0, 1, 5))
    WITH CHECK (public.current_user_role() IN (0, 1, 5));

-- 2. Security Hardening on Customers & Vendors: Enforce deleted_at IS NULL for authenticated SELECT
DROP POLICY IF EXISTS "Customers viewable by authenticated users" ON public.customers;
CREATE POLICY "Customers viewable by authenticated users" 
    ON public.customers FOR SELECT TO authenticated 
    USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Vendors viewable by authenticated users" ON public.vendors;
CREATE POLICY "Vendors viewable by authenticated users" 
    ON public.vendors FOR SELECT TO authenticated 
    USING (deleted_at IS NULL);
