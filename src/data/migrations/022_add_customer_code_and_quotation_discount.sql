-- Migration 022: Add customer_code to customers and discount_amount to quotations

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50) DEFAULT NULL;

-- Backfill existing customers with code from initials or ID
UPDATE public.customers
SET customer_code = COALESCE(NULLIF(UPPER(TRIM(initials)), ''), 'CUST-' || LPAD(id::text, 3, '0'))
WHERE customer_code IS NULL;

-- Add discount_amount to quotations table
ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0;
