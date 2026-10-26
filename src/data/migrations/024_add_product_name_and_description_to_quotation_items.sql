-- Migration 024: Add product_name and description to quotation_items

ALTER TABLE public.quotation_items
ADD COLUMN IF NOT EXISTS product_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

-- Backfill existing quotation_items:
-- If product_name is null, initialize it from product_description
UPDATE public.quotation_items
SET product_name = COALESCE(product_name, product_description)
WHERE product_name IS NULL;
