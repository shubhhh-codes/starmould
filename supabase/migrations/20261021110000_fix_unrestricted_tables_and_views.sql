-- Migration: Fix UNRESTRICTED tables and views in Supabase
-- 1. Enable RLS on password_resets table
-- 2. Set security_invoker = true on all views so they enforce underlying table RLS

-- 1. Secure password_resets table
ALTER TABLE IF EXISTS public.password_resets ENABLE ROW LEVEL SECURITY;

-- Deny public anon/authenticated access to password_resets (only service_role bypasses)
REVOKE ALL ON TABLE public.password_resets FROM anon, authenticated;

-- 2. Enable security_invoker on all views (PostgreSQL 15+)
-- This ensures the querying user's permissions and RLS policies on underlying tables are respected.
DO $$
DECLARE
    v text;
    views text[] := ARRAY[
        'view_dispatch_items_qty',
        'view_inward_items_qty',
        'view_outword_items_qty',
        'view_pending_dispatch_qty',
        'view_pending_inward_qty',
        'view_pending_outword_qty',
        'view_po_inward_items_qty',
        'view_po_outword_items_qty',
        'view_po_pending_inward_qty',
        'view_po_pending_outword_qty'
    ];
BEGIN
    FOREACH v IN ARRAY views LOOP
        IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = v) THEN
            EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true);', v);
        END IF;
    END LOOP;
END $$;
