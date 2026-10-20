-- Migration: 20261020161500_add_vendor_bank_and_tax_details.sql
-- Description: Add vendor code, city, GSTIN, PAN, and banking details to public.customers

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS vendor_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gstin VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pan VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS account_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_customers_vendor_code ON public.customers(vendor_code);
CREATE INDEX IF NOT EXISTS idx_customers_city ON public.customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_gstin ON public.customers(gstin);
