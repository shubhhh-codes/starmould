-- 20261026120000_create_quotations_and_presets.sql
-- Create quotations, quotation items, and modular terms presets

CREATE TABLE IF NOT EXISTS public.quotations (
    id SERIAL PRIMARY KEY,
    quotation_no VARCHAR(60) NOT NULL UNIQUE,
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id INTEGER REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_code VARCHAR(50),
    consignee_name VARCHAR(255) NOT NULL,
    consignee_address TEXT,
    consignee_gstin VARCHAR(50),
    consignee_pan VARCHAR(50),
    consignee_phone VARCHAR(50),
    consignee_email VARCHAR(150),
    tax_type VARCHAR(20) DEFAULT 'cgst_sgst',
    tax_rate NUMERIC(5,2) DEFAULT 18.00,
    taxable_amount NUMERIC(12,2) DEFAULT 0.00,
    discount_amount NUMERIC(12,2) DEFAULT 0.00,
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
    price_terms TEXT DEFAULT 'Prices are in Indian Rupees (₹), firm and fixed, Ex-Works Rajkot. GST @ [18]% extra as applicable. Freight and transit insurance [extra at actuals / included].',
    delivery_terms TEXT DEFAULT '[__] days from receipt of a clear Purchase Order together with the advance payment; subject to material availability and production capacity.',
    payment_terms TEXT DEFAULT '[50% advance along with Purchase Order, balance 50% before dispatch / within __ days of invoice]. Payment by NEFT / RTGS / cheque in favour of Starmould Technology Pvt. Ltd.',
    validity_terms TEXT DEFAULT 'This quotation is valid for [15] days from the date of issue. Prices and delivery are subject to change thereafter.',
    order_confirmation TEXT DEFAULT 'Manufacturing starts only after receipt of advance payment and a written Purchase Order.',
    warranty_terms TEXT DEFAULT '[__ months] against manufacturing defects only; excludes misuse, mishandling, overloading or external damage.',
    jurisdiction_terms TEXT DEFAULT 'Subject to Rajkot, Gujarat jurisdiction only.',
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
    product_name VARCHAR(255),
    description TEXT,
    product_description TEXT NOT NULL,
    qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'Nos',
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quotation_terms_presets (
    id SERIAL PRIMARY KEY,
    term_type VARCHAR(50) NOT NULL DEFAULT 'price',
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON public.quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_quotation_no ON public.quotations(quotation_no);
CREATE INDEX IF NOT EXISTS idx_quotations_quotation_date ON public.quotations(quotation_date);
CREATE INDEX IF NOT EXISTS idx_quotations_deleted_at ON public.quotations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON public.quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_presets_term_type ON public.quotation_terms_presets(term_type);

-- Seed standard presets if empty
INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default)
SELECT 'price', 'Ex-Works Rajkot (Standard)', 'Prices are in Indian Rupees (₹), firm and fixed, Ex-Works Rajkot. GST @ [18]% extra as applicable. Freight and transit insurance extra at actuals.', true
WHERE NOT EXISTS (SELECT 1 FROM public.quotation_terms_presets WHERE term_type = 'price' AND is_default = true);

INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default)
SELECT 'delivery', 'Standard Manufacturing Cycle', '[__] days from receipt of a clear Purchase Order together with the advance payment; subject to material availability and production capacity.', true
WHERE NOT EXISTS (SELECT 1 FROM public.quotation_terms_presets WHERE term_type = 'delivery' AND is_default = true);

INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default)
SELECT 'payment', '50% Advance, 50% Before Dispatch', '50% advance along with Purchase Order, balance 50% before dispatch of goods. Payment by NEFT / RTGS in favour of Starmould Technology Pvt. Ltd.', true
WHERE NOT EXISTS (SELECT 1 FROM public.quotation_terms_presets WHERE term_type = 'payment' AND is_default = true);

INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default)
SELECT 'validity', '15 Days Validity', 'This quotation is valid for 15 days from the date of issue. Prices and delivery are subject to change thereafter.', true
WHERE NOT EXISTS (SELECT 1 FROM public.quotation_terms_presets WHERE term_type = 'validity' AND is_default = true);

INSERT INTO public.quotation_terms_presets (term_type, title, content, is_default)
SELECT 'force_majeure', 'Standard Force Majeure', 'This Clause Is Applicable.', true
WHERE NOT EXISTS (SELECT 1 FROM public.quotation_terms_presets WHERE term_type = 'force_majeure' AND is_default = true);
