-- Phase 2: Data migration - ID-preserving backfill from customers to vendors
-- Part of: Split customers into customers + vendors (Starmould ERP)

-- 1. Backfill vendors and transporters preserving exact primary key IDs
INSERT INTO public.vendors (
    id,
    vendor_name,
    initials,
    vendor_code,
    vendor_type,
    city,
    gstin,
    pan,
    bank_name,
    account_no,
    ifsc_code,
    status_of_beneficiary,
    contact_person,
    mobile,
    mobile1,
    email,
    address,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
)
SELECT 
    id,
    customername AS vendor_name,
    initials,
    vendor_code,
    CASE 
        WHEN usertype = 'Transport' THEN 'Transporter'
        ELSE 'Supplier'
    END AS vendor_type,
    city,
    gstin,
    pan,
    bank_name,
    account_no,
    COALESCE(ifsc_code, ifsc) AS ifsc_code,
    status_of_beneficiary,
    contact_person,
    mobile,
    mobile1,
    email,
    address,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
FROM public.customers
WHERE usertype IN ('Vendor', 'Transport')
ON CONFLICT (id) DO NOTHING;

-- 2. Sequence fix: Ensure nextval starts safely after the max existing ID
SELECT setval(pg_get_serial_sequence('public.vendors','id'), COALESCE(MAX(id),0)+1, false) FROM public.vendors;
