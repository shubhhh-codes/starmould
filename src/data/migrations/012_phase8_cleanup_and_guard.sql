-- Phase 8: Soft-delete vendor/transport rows from public.customers and apply insertion guard constraint
-- ONLY TO BE EXECUTED AFTER USER CONFIRMATION AT CHECKPOINT C

-- 1. Soft-delete vendor and transporter rows from customers
UPDATE public.customers 
SET 
    deleted_at = NOW(),
    updated_at = NOW() 
WHERE usertype IN ('Vendor', 'Transport') 
  AND deleted_at IS NULL;

-- 2. Add guard constraint to prevent future vendor/transporter inserts into customers
ALTER TABLE public.customers
    DROP CONSTRAINT IF EXISTS check_customers_no_active_vendors;

ALTER TABLE public.customers
    ADD CONSTRAINT check_customers_no_active_vendors 
    CHECK (usertype NOT IN ('Vendor', 'Transport') OR deleted_at IS NOT NULL) 
    NOT VALID;

-- 3. Validate constraint
ALTER TABLE public.customers 
    VALIDATE CONSTRAINT check_customers_no_active_vendors;
