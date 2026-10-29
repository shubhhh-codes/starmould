-- Migration: Fix view_inward_items_qty and view_po_inward_items_qty to filter by active parent status ('1')
-- Cancelled/deleted inward records (status = '0') should not reduce pending inward quantities.

CREATE OR REPLACE VIEW public.view_inward_items_qty
WITH (security_invoker = true) AS
SELECT 
    ii.challanid AS challanid,
    ii.plateid AS plateid,
    ii.particulars AS particulars,
    COALESCE(SUM(ii.inward_qty), 0::bigint) AS inward_qty
FROM public.inward_items ii
JOIN public.inward i ON ii.inchallanid = i.id
WHERE i.status = '1'
GROUP BY ii.challanid, ii.plateid, ii.particulars;

CREATE OR REPLACE VIEW public.view_po_inward_items_qty
WITH (security_invoker = true) AS
SELECT 
    pii.pid AS pid,
    pii.plateid AS plateid,
    pii.material AS material,
    pii.materialtype AS materialtype,
    COALESCE(SUM(pii.inward_qty), 0::bigint) AS inward_qty
FROM public.purchase_inward_items pii
JOIN public.po_inward pi ON pii.inpid = pi.id
WHERE pi.status = '1'
GROUP BY pii.pid, pii.plateid, pii.material, pii.materialtype;
