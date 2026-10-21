-- Phase 1: Create public.vendors table with constraints, indexes, triggers, and RLS
-- Part of: Split customers into customers + vendors (Starmould ERP)

-- 1. Ensure pg_trgm extension exists for fast trigram text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create public.vendors table
CREATE TABLE IF NOT EXISTS public.vendors (
    id BIGSERIAL PRIMARY KEY,
    vendor_name VARCHAR(255) NOT NULL,
    initials VARCHAR(10),
    vendor_code VARCHAR(50),
    vendor_type VARCHAR(50) NOT NULL DEFAULT 'Supplier',
    city VARCHAR(100),
    gstin VARCHAR(20),
    pan VARCHAR(20),
    bank_name VARCHAR(255),
    account_no VARCHAR(100),
    ifsc_code VARCHAR(30),
    status_of_beneficiary VARCHAR(50),
    contact_person VARCHAR(255),
    mobile VARCHAR(50),
    mobile1 VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by BIGINT,
    deleted_at TIMESTAMPTZ,
    deleted_by BIGINT,
    CONSTRAINT check_vendors_vendor_type CHECK (vendor_type IN ('Supplier', 'Transporter'))
);

-- 3. Unique & Performance Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_vendor_code_unique 
    ON public.vendors(vendor_code) 
    WHERE deleted_at IS NULL AND vendor_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_vendor_code ON public.vendors(vendor_code);
CREATE INDEX IF NOT EXISTS idx_vendors_gstin ON public.vendors(gstin);
CREATE INDEX IF NOT EXISTS idx_vendors_city ON public.vendors(city);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON public.vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendors_deleted_at ON public.vendors(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vendors_name_trgm ON public.vendors USING gin (vendor_name gin_trgm_ops);

-- 4. updated_at Trigger
DROP TRIGGER IF EXISTS trigger_updated_at_vendors ON public.vendors;
CREATE TRIGGER trigger_updated_at_vendors 
    BEFORE UPDATE ON public.vendors 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Row Level Security (RLS) policies matching customers
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors viewable by authenticated users" ON public.vendors;
CREATE POLICY "Vendors viewable by authenticated users" 
    ON public.vendors FOR SELECT TO authenticated 
    USING (true);

DROP POLICY IF EXISTS "Vendors manageable by admin and managers" ON public.vendors;
CREATE POLICY "Vendors manageable by admin and managers" 
    ON public.vendors FOR ALL TO authenticated 
    USING (is_admin_or_manager()) 
    WITH CHECK (is_admin_or_manager());
