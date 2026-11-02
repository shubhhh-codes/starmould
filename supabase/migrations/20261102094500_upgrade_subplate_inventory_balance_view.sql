-- Migration: 20261102094500_upgrade_subplate_inventory_balance_view.sql
-- Description: Upgrades view_subplate_jobwork_balance to strictly require Purchase Inward before material can physically exist in Star Mould.

DROP VIEW IF EXISTS public.view_subplate_jobwork_balance CASCADE;

CREATE OR REPLACE VIEW public.view_subplate_jobwork_balance AS
WITH 
-- 1. PO Ordered Qty
po_ordered AS (
    SELECT 
        pi.plateid,
        COALESCE(SUM(pi.qty), 0)::integer AS po_ordered_qty
    FROM purchase_items pi
    JOIN purchase p ON pi.pid = p.id
    WHERE p.status = '1' AND pi.plateid IS NOT NULL
    GROUP BY pi.plateid
),
-- 2. PO Inward Qty
po_inward_agg AS (
    SELECT 
        pii.plateid,
        COALESCE(SUM(pii.inward_qty), 0)::integer AS po_inward_qty
    FROM purchase_inward_items pii
    JOIN po_inward pin ON pii.inpid = pin.id
    WHERE pin.status = '1' AND pii.plateid IS NOT NULL
    GROUP BY pii.plateid
),
-- 3. Job Work Inward Qty
inward_sum AS (
    SELECT 
        ii.challanid,
        ii.plateid,
        COALESCE(SUM(ii.inward_qty), 0)::integer AS returned_qty
    FROM inward_items ii
    JOIN inward i ON ii.inchallanid = i.id
    WHERE i.status = '1' AND ii.plateid IS NOT NULL
    GROUP BY ii.challanid, ii.plateid
),
-- 4. Active Outward Challans
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
    FROM challan_items ci
    JOIN challan c ON ci.challanid = c.id
    LEFT JOIN vendors v ON c.vendorid = v.id
    LEFT JOIN inward_sum ins ON ci.challanid = ins.challanid AND ci.plateid = ins.plateid
    WHERE c.status = '1' AND ci.plateid IS NOT NULL
),
-- 5. Customer Dispatched Qty
dispatch_sum AS (
    SELECT 
        di.plateid,
        COALESCE(SUM(di.qty), 0)::integer AS customer_dispatched_qty
    FROM dispatch_items di
    JOIN dispatch d ON di.dispatchid = d.id
    WHERE d.status = '1' AND di.plateid IS NOT NULL
    GROUP BY di.plateid
)
SELECT 
    sp.id AS plateid,
    sp.platename,
    sp.projectid,
    sp.sqty AS total_qty,
    -- Outward Jobwork Qty at vendors
    COALESCE(SUM(ca.pending_at_vendor), 0)::integer AS outward_jobwork_qty,
    -- Physical Available In-House Qty at Star Mould workshop:
    -- Under strict lifecycle, raw steel DOES NOT exist in Star Mould until received via Purchase Inward!
    GREATEST(
        0,
        COALESCE(poi.po_inward_qty, 0)
        - COALESCE(SUM(ca.pending_at_vendor), 0) 
        - COALESCE(disp.customer_dispatched_qty, 0)
    )::integer AS available_sm_qty,
    STRING_AGG(DISTINCT ca.vendor_name, ', ') FILTER (WHERE ca.pending_at_vendor > 0) AS active_vendors,
    STRING_AGG(DISTINCT ca.vendor_initials, ', ') FILTER (WHERE ca.pending_at_vendor > 0) AS active_vendor_initials,
    -- Enriched lifecycle columns
    COALESCE(po.po_ordered_qty, 0) AS po_ordered_qty,
    COALESCE(poi.po_inward_qty, 0) AS po_inward_qty,
    GREATEST(0, COALESCE(po.po_ordered_qty, 0) - COALESCE(poi.po_inward_qty, 0)) AS pending_po_inward_qty,
    CASE WHEN po.po_ordered_qty IS NOT NULL AND po.po_ordered_qty > 0 THEN TRUE ELSE FALSE END AS has_po,
    COALESCE(disp.customer_dispatched_qty, 0)::integer AS customer_dispatched_qty
FROM subplate sp
LEFT JOIN po_ordered po ON sp.id = po.plateid
LEFT JOIN po_inward_agg poi ON sp.id = poi.plateid
LEFT JOIN challan_active ca ON sp.id = ca.plateid
LEFT JOIN dispatch_sum disp ON sp.id = disp.plateid
WHERE sp.deleted_at IS NULL
GROUP BY 
    sp.id, 
    sp.platename, 
    sp.projectid, 
    sp.sqty, 
    po.po_ordered_qty, 
    poi.po_inward_qty, 
    disp.customer_dispatched_qty;

GRANT SELECT ON public.view_subplate_jobwork_balance TO anon, authenticated, service_role;
