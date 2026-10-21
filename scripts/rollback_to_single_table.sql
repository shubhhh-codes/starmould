-- EMERGENCY ROLLBACK SCRIPT: Reverts Starmould ERP schema back to single customers table

-- 1. Remove guard constraint if applied
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS check_customers_no_active_vendors;

-- 2. Restore any soft-deleted vendor rows from backup if Phase 8 was executed
UPDATE public.customers c
SET deleted_at = b.deleted_at
FROM public.customers_backup_20261021 b
WHERE c.id = b.id AND c.usertype IN ('Vendor', 'Transport');

-- 3. Copy back any new vendors created after cutover (id > 662 or not in customers) into customers
INSERT INTO public.customers (
    id,
    customername,
    initials,
    vendor_code,
    city,
    gstin,
    pan,
    bank_name,
    account_no,
    ifsc_code,
    contact_person,
    status_of_beneficiary,
    mobile,
    mobile1,
    email,
    address,
    usertype,
    created_at,
    created_by,
    updated_at,
    updated_by,
    deleted_at,
    deleted_by
)
SELECT 
    v.id,
    v.vendor_name AS customername,
    v.initials,
    v.vendor_code,
    v.city,
    v.gstin,
    v.pan,
    v.bank_name,
    v.account_no,
    v.ifsc_code,
    v.contact_person,
    v.status_of_beneficiary,
    v.mobile,
    v.mobile1,
    v.email,
    v.address,
    CASE WHEN v.vendor_type = 'Transporter' THEN 'Transport' ELSE 'Vendor' END AS usertype,
    v.created_at,
    v.created_by,
    v.updated_at,
    v.updated_by,
    v.deleted_at,
    v.deleted_by
FROM public.vendors v
WHERE v.id > 662 OR NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = v.id)
ON CONFLICT (id) DO UPDATE SET
    customername = EXCLUDED.customername,
    vendor_code = EXCLUDED.vendor_code,
    city = EXCLUDED.city,
    gstin = EXCLUDED.gstin,
    pan = EXCLUDED.pan,
    bank_name = EXCLUDED.bank_name,
    account_no = EXCLUDED.account_no,
    ifsc_code = EXCLUDED.ifsc_code,
    contact_person = EXCLUDED.contact_person,
    updated_at = EXCLUDED.updated_at;

-- Resynchronize customers sequence
SELECT setval(pg_get_serial_sequence('public.customers','id'), COALESCE(MAX(id),0)+1, false) FROM public.customers;

-- 4. Drop Foreign Keys referencing public.vendors
ALTER TABLE public.challan DROP CONSTRAINT IF EXISTS fk_challan_vendorid;
ALTER TABLE public.challan DROP CONSTRAINT IF EXISTS fk_challan_vendortid;
ALTER TABLE public.inward DROP CONSTRAINT IF EXISTS fk_inward_vendorid;
ALTER TABLE public.inward DROP CONSTRAINT IF EXISTS fk_inward_vendortid;
ALTER TABLE public.purchase DROP CONSTRAINT IF EXISTS fk_purchase_vname;
ALTER TABLE public.po_inward DROP CONSTRAINT IF EXISTS fk_po_inward_vname;
ALTER TABLE public.dispatch DROP CONSTRAINT IF EXISTS fk_dispatch_vendortid;

-- 5. Restore original Views to join public.customers
CREATE OR REPLACE VIEW public.view_pending_inward_qty AS
 SELECT c.id,
    cust.customername,
    vend.customername AS vendorname,
    trans.customername AS transportername,
    c.vendorid,
    ci.customer,
    c.challanno,
    c.vendortid,
    ci.project AS projectid,
    c.created_by,
    c.chdate,
    ci.plateid,
    ci.particulars,
    ci.qty,
    COALESCE(vii.inward_qty, (0)::bigint) AS inward_qty,
    (COALESCE(ci.qty, 0) - COALESCE(vii.inward_qty, (0)::bigint)) AS pending_qty,
    sp.platename
   FROM ((((((public.challan c
     JOIN public.challan_items ci ON ((c.id = ci.challanid)))
     LEFT JOIN public.customers cust ON ((ci.customer = cust.id)))
     LEFT JOIN public.customers vend ON ((c.vendorid = vend.id)))
     LEFT JOIN public.customers trans ON ((c.vendortid = trans.id)))
     LEFT JOIN public.view_inward_items_qty vii ON (((ci.plateid = vii.plateid) AND (ci.particulars = vii.particulars) AND (c.id = vii.challanid))))
     LEFT JOIN public.subplate sp ON ((ci.plateid = sp.id)))
  WHERE ((c.status)::text = '1'::text);

CREATE OR REPLACE VIEW public.view_po_pending_inward_qty AS
 SELECT p.id,
    cust.customername,
    vend.customername AS vendorname,
    p.vname,
    p.cname,
    p.srno,
    p.pno,
    p.projectid,
    p.created_by,
    p.odate,
    pi.plateid,
    pi.material,
    pi.materialtype,
    pi.qty,
    COALESCE(vpi.inward_qty, (0)::bigint) AS inward_qty,
    (COALESCE(pi.qty, 0) - COALESCE(vpi.inward_qty, (0)::bigint)) AS pending_qty,
    sp.platename
   FROM (((((public.purchase p
     JOIN purchase_items pi ON ((p.id = pi.pid)))
     LEFT JOIN public.customers cust ON ((p.cname = cust.id)))
     LEFT JOIN public.customers vend ON ((p.vname = vend.id)))
     LEFT JOIN public.view_po_inward_items_qty vpi ON (((pi.plateid = vpi.plateid) AND (pi.material = vpi.material) AND (pi.materialtype = vpi.materialtype) AND (p.id = vpi.pid))))
     LEFT JOIN public.subplate sp ON ((pi.plateid = sp.id)))
  WHERE ((p.status)::text = '1'::text);
