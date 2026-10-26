-- Migration 016: Create Quotations and Quotation Terms Presets Tables

CREATE TABLE IF NOT EXISTS public.quotation_terms_presets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    price_terms TEXT,
    delivery_terms TEXT,
    payment_terms TEXT,
    validity_terms TEXT,
    force_majeure TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quotations (
    id SERIAL PRIMARY KEY,
    quotation_no VARCHAR(60) NOT NULL UNIQUE,
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id INTEGER REFERENCES public.customers(id) ON DELETE SET NULL,
    consignee_name VARCHAR(255) NOT NULL,
    consignee_address TEXT,
    consignee_gstin VARCHAR(50),
    consignee_pan VARCHAR(50),
    consignee_phone VARCHAR(50),
    consignee_email VARCHAR(150),
    state_code VARCHAR(50) DEFAULT '24 - Gujarat',
    subject TEXT,
    reference TEXT,
    tax_type VARCHAR(20) DEFAULT 'cgst_sgst',
    tax_rate NUMERIC(5,2) DEFAULT 18.00,
    taxable_amount NUMERIC(12,2) DEFAULT 0.00,
    cgst_amount NUMERIC(12,2) DEFAULT 0.00,
    sgst_amount NUMERIC(12,2) DEFAULT 0.00,
    igst_amount NUMERIC(12,2) DEFAULT 0.00,
    grand_total NUMERIC(12,2) DEFAULT 0.00,
    amount_in_words TEXT,
    bank_name VARCHAR(150) DEFAULT 'Central Bank Of India',
    bank_account_no VARCHAR(100) DEFAULT '5875819245',
    bank_ifsc VARCHAR(50) DEFAULT 'CBIN0281313',
    bank_branch VARCHAR(150) DEFAULT 'Saurashtra University Branch',
    bank_address TEXT DEFAULT 'Saurashtra University Campus, Rajkot',
    price_terms TEXT DEFAULT 'Ex-Works Rajkot, +18% GST Freight ,Transit Insurance At Actual.',
    delivery_terms TEXT DEFAULT '2 Days',
    payment_terms TEXT DEFAULT '100% advance before dispatch of goods.',
    validity_terms TEXT DEFAULT '10 DAYS',
    force_majeure TEXT DEFAULT 'This Clause Is Applicable.',
    notes TEXT,
    include_digital_stamp BOOLEAN DEFAULT true,
    status VARCHAR(30) DEFAULT 'Draft',
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.quotation_items (
    id SERIAL PRIMARY KEY,
    quotation_id INTEGER NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    sr_no INTEGER NOT NULL DEFAULT 1,
    product_description TEXT NOT NULL,
    qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'Nos',
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON public.quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_quotation_no ON public.quotations(quotation_no);
CREATE INDEX IF NOT EXISTS idx_quotations_quotation_date ON public.quotations(quotation_date);
CREATE INDEX IF NOT EXISTS idx_quotations_deleted_at ON public.quotations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON public.quotation_items(quotation_id);

-- Insert default Terms Preset if not already present
INSERT INTO public.quotation_terms_presets (title, price_terms, delivery_terms, payment_terms, validity_terms, force_majeure, is_default)
SELECT 
    'Standard StarMould Preset',
    'Ex-Works Rajkot, +18% GST Freight ,Transit Insurance At Actual.',
    '2 Days',
    '100% advance before dispatch of goods.',
    '10 DAYS',
    'This Clause Is Applicable.',
    true
WHERE NOT EXISTS (SELECT 1 FROM public.quotation_terms_presets WHERE title = 'Standard StarMould Preset');
