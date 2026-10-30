-- Migration 027: Real-time Job Work Balance & Location View
-- Provides instantaneous available quantity in Star Mould (SM) vs active outward quantity at vendors

CREATE OR REPLACE VIEW view_subplate_jobwork_balance AS
WITH inward_sum AS (
    SELECT 
        ii.challanid,
        ii.plateid,
        COALESCE(SUM(ii.inward_qty), 0) AS returned_qty
    FROM inward_items ii
    JOIN inward i ON ii.inchallanid = i.id
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
    FROM challan_items ci
    JOIN challan c ON ci.challanid = c.id
    LEFT JOIN vendors v ON c.vendorid = v.id
    LEFT JOIN inward_sum ins ON ci.challanid = ins.challanid AND ci.plateid = ins.plateid
    WHERE c.status = '1'
)
SELECT 
    sp.id AS plateid,
    sp.platename,
    sp.projectid,
    sp.sqty AS total_qty,
    COALESCE(SUM(ca.pending_at_vendor), 0)::integer AS outward_jobwork_qty,
    GREATEST(0, sp.sqty - COALESCE(SUM(ca.pending_at_vendor), 0))::integer AS available_sm_qty,
    STRING_AGG(DISTINCT ca.vendor_name, ', ') FILTER (WHERE ca.pending_at_vendor > 0) AS active_vendors,
    STRING_AGG(DISTINCT ca.vendor_initials, ', ') FILTER (WHERE ca.pending_at_vendor > 0) AS active_vendor_initials
FROM subplate sp
LEFT JOIN challan_active ca ON sp.id = ca.plateid
WHERE sp.deleted_at IS NULL
GROUP BY sp.id, sp.platename, sp.projectid, sp.sqty;
