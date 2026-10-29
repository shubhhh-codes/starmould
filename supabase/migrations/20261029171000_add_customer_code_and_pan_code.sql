-- Migration: Add customer_code and pan_code with unique indexes to public.customers
-- Date: 2026-10-29

-- 1. Ensure customer_code and pan_code columns exist
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pan_code VARCHAR(50);

-- 2. Populate pan_code from customer_code if null
UPDATE public.customers
SET pan_code = customer_code
WHERE pan_code IS NULL AND customer_code IS NOT NULL;

-- 3. Populate customer_code from pan_code if null
UPDATE public.customers
SET customer_code = pan_code
WHERE customer_code IS NULL AND pan_code IS NOT NULL;

-- 4. If any customer still has null customer_code, generate based on initials / ID
UPDATE public.customers
SET customer_code = COALESCE(NULLIF(UPPER(TRIM(initials)), ''), 'STC' || LPAD(id::text, 5, '0')),
    pan_code = COALESCE(NULLIF(UPPER(TRIM(initials)), ''), 'STC' || LPAD(id::text, 5, '0'))
WHERE customer_code IS NULL;

-- 5. Create unique partial index on customer_code (matching vendors table pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_customer_code_unique
  ON public.customers(customer_code)
  WHERE deleted_at IS NULL AND customer_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_customer_code
  ON public.customers(customer_code);

CREATE INDEX IF NOT EXISTS idx_customers_pan_code
  ON public.customers(pan_code);
