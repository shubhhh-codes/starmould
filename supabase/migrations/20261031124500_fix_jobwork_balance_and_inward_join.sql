-- 20261031124500_fix_jobwork_balance_and_inward_join.sql
-- Inventory Accuracy: Deduct customer dispatches from jobwork balance view & ensure NULL-safe inward particulars join

-- 1. Real-time Job Work Balance & Location View with Dispatch Deduction
DROP VIEW IF EXISTS public.view_subplate_jobwork_balance CASCADE;

CREATE OR REPLACE VIEW public.view_subplate_jobwork_balance AS
WITH inward_sum AS (
    SELECT 
        ii.challanid,
        ii.plateid,
        COALESCE(SUM(ii.inward_qty), 0) AS returned_qty
    FROM public.inward_items ii
    JOIN public.inward i ON ii.inchallanid = i.id
    WHERE i.status = '1'
    GROUP BY ii.challanid, ii.plateid
),
challan_active AS (
    SELECT 
        ci.plateid,
        ci.challanid,
        c.vendorid,
        v.vendor_name,
        v.initials AS vendor_initials,
        ci.qty AS outward_qty,
        COALESCE(ins.returned_qty, 0) AS returned_qty,
        GREATEST(0, ci.qty - COALESCE(ins.returned_qty, 0)) AS pending_at_vendor
    FROM public.challan_items ci
    JOIN public.challan c ON ci.challanid = c.id
    LEFT JOIN public.vendors v ON c.vendorid = v.id
    LEFT JOIN inward_sum ins ON ci.challanid = ins.challanid AND ci.plateid = ins.plateid
    WHERE c.status = '1'
),
dispatch_sum AS (
    SELECT 
        di.plateid,
        COALESCE(SUM(di.qty), 0) AS dispatched_qty
    FROM public.dispatch_items di
    JOIN public.dispatch d ON di.dispatchid = d.id
    WHERE d.status = '1' AND di.plateid IS NOT NULL
    GROUP BY di.plateid
)
SELECT 
    sp.id AS plateid,
    sp.platename,
    sp.projectid,
    sp.sqty AS total_qty,
    COALESCE(SUM(ca.pending_at_vendor), 0)::integer AS outward_jobwork_qty,
    COALESCE(ds.dispatched_qty, 0)::integer AS customer_dispatched_qty,
    GREATEST(0, sp.sqty - COALESCE(SUM(ca.pending_at_vendor), 0) - COALESCE(ds.dispatched_qty, 0))::integer AS available_sm_qty,
    STRING_AGG(DISTINCT ca.vendor_name, ', ') FILTER (WHERE ca.pending_at_vendor > 0) AS active_vendors,
    STRING_AGG(DISTINCT ca.vendor_initials, ', ') FILTER (WHERE ca.pending_at_vendor > 0) AS active_vendor_initials
FROM public.subplate sp
LEFT JOIN challan_active ca ON sp.id = ca.plateid
LEFT JOIN dispatch_sum ds ON sp.id = ds.plateid
WHERE sp.deleted_at IS NULL
GROUP BY sp.id, sp.platename, sp.projectid, sp.sqty, ds.dispatched_qty;

-- 2. NULL-Safe Job Work Inward Quantity View
CREATE OR REPLACE VIEW public.view_pending_inward_qty 
WITH (security_invoker = true) AS
 SELECT c.id,
    cust.customername,
    vend.vendor_name AS vendorname,
    trans.vendor_name AS transportername,
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
   FROM public.challan c
     JOIN public.challan_items ci ON c.id = ci.challanid
     LEFT JOIN public.customers cust ON ci.customer = cust.id
     LEFT JOIN public.vendors vend ON c.vendorid = vend.id
     LEFT JOIN public.vendors trans ON c.vendortid = trans.id
     LEFT JOIN public.view_inward_items_qty vii ON (
         ci.plateid = vii.plateid 
         AND COALESCE(ci.particulars, '') = COALESCE(vii.particulars, '') 
         AND c.id = vii.challanid
     )
     LEFT JOIN public.subplate sp ON ci.plateid = sp.id
  WHERE c.status = '1';
