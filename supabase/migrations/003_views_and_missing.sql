-- =============================================================================
-- StarMould ERP - Production Views & RLS Policies (Phase 1 Literal Port)
-- Source: MySQL sm_prod_080723_280326_2pm_live.sql dump
-- Paste this into Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tvfqhdhxwnpkhhrvxvfi/sql/new
-- =============================================================================

-- Ensure subplate column matches MySQL schema (projectid)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'subplate' AND column_name = 'project_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'subplate' AND column_name = 'projectid'
    ) THEN
        ALTER TABLE public.subplate RENAME COLUMN project_id TO projectid;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. view_dispatch_items_qty
-- Source: MySQL view_dispatch_items_qty
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_dispatch_items_qty AS 
SELECT 
    dispatch_items.plateid AS plateid,
    SUM(dispatch_items.qty) AS qty,
    dispatch_items.project AS projectid
FROM public.dispatch_items 
JOIN public.dispatch ON dispatch_items.dispatchid = dispatch.id
WHERE dispatch.status = '1'
GROUP BY dispatch_items.plateid, dispatch_items.project;

-- -----------------------------------------------------------------------------
-- 2. view_inward_items_qty
-- Source: MySQL view_inward_items_qty
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_inward_items_qty AS 
SELECT 
    inward_items.challanid AS challanid,
    inward_items.plateid AS plateid,
    inward_items.particulars AS particulars,
    SUM(inward_items.inward_qty) AS inward_qty
FROM public.inward_items
GROUP BY inward_items.challanid, inward_items.plateid, inward_items.particulars;

-- -----------------------------------------------------------------------------
-- 3. view_outword_items_qty
-- Source: MySQL view_outword_items_qty
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_outword_items_qty AS 
SELECT 
    challan_items.plateid AS plateid,
    SUM(challan_items.qty) AS qty,
    challan_items.project AS projectid
FROM public.challan_items 
JOIN public.challan ON challan_items.challanid = challan.id
WHERE challan.status = '1'
GROUP BY challan_items.plateid, challan_items.project;

-- -----------------------------------------------------------------------------
-- 4. view_pending_dispatch_qty
-- Source: MySQL view_pending_dispatch_qty
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_pending_dispatch_qty AS 
SELECT 
    subplate.projectid AS projectid,
    scan.projectid AS projectname,
    subplate.id AS plateid,
    subplate.platename AS platename,
    COALESCE(subplate.sqty, 0) AS sqty,
    subplate.sqty - COALESCE(view_dispatch_items_qty.qty, 0) AS pqty,
    COALESCE(view_dispatch_items_qty.qty, 0) AS oqty
FROM public.subplate
LEFT JOIN public.view_dispatch_items_qty ON subplate.id = view_dispatch_items_qty.plateid
JOIN public.scan ON subplate.projectid::text = scan.id::text
WHERE scan.status <> 'completed'
  AND subplate.design_by IS NOT NULL
  AND subplate.order_by IS NOT NULL
  AND subplate.received_workby IS NOT NULL
  AND subplate.received_qcby IS NOT NULL
  AND subplate.vmc_workby IS NOT NULL
  AND subplate.vmc_qcby IS NOT NULL
  AND subplate.drilltap_workby IS NOT NULL
  AND subplate.final_qcby IS NOT NULL
  AND subplate.packing_workby IS NOT NULL
  AND subplate.location = 'SM';

-- -----------------------------------------------------------------------------
-- 5. view_pending_inward_qty
-- Source: MySQL view_pending_inward_qty
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_pending_inward_qty AS 
SELECT 
    challan.id AS id,
    (SELECT customers.customername FROM public.customers WHERE customers.id = challan_items.customer) AS customername,
    (SELECT customers.customername FROM public.customers WHERE customers.id = challan.vendorid) AS vendorname,
    (SELECT customers.customername FROM public.customers WHERE customers.id = challan.vendortid) AS transportername,
    challan.vendorid AS vendorid,
    challan_items.customer AS customer,
    challan.challanno AS challanno,
    challan.vendortid AS vendortid,
    challan_items.project AS projectid,
    challan.created_by AS created_by,
    challan.chdate AS chdate,
    challan_items.plateid AS plateid,
    challan_items.particulars AS particulars,
    challan_items.qty AS qty,
    COALESCE(view_inward_items_qty.inward_qty, 0) AS inward_qty,
    challan_items.qty - COALESCE(view_inward_items_qty.inward_qty, 0) AS pending_qty,
    subplate.platename AS platename
FROM public.challan
JOIN public.challan_items ON challan.id = challan_items.challanid
LEFT JOIN public.view_inward_items_qty ON (
    challan_items.plateid = view_inward_items_qty.plateid
    AND challan_items.particulars = view_inward_items_qty.particulars
    AND challan.id = view_inward_items_qty.challanid
)
JOIN public.subplate ON challan_items.plateid = subplate.id
WHERE challan.status = '1';

-- -----------------------------------------------------------------------------
-- 6. view_pending_outword_qty
-- Source: MySQL view_pending_outword_qty
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_pending_outword_qty AS 
SELECT 
    subplate.projectid AS projectid,
    scan.projectid AS projectname,
    subplate.id AS plateid,
    subplate.platename AS platename,
    COALESCE(subplate.sqty, 0) AS sqty,
    subplate.sqty - COALESCE(view_outword_items_qty.qty, 0) + COALESCE((
        SELECT SUM(view_inward_items_qty.inward_qty)
        FROM public.view_inward_items_qty
        WHERE subplate.id = view_inward_items_qty.plateid
        GROUP BY view_inward_items_qty.plateid
        LIMIT 1
    ), 0) AS pqty,
    COALESCE(view_outword_items_qty.qty, 0) AS oqty
FROM public.subplate
LEFT JOIN public.view_outword_items_qty ON subplate.id = view_outword_items_qty.plateid
JOIN public.scan ON subplate.projectid::text = scan.id::text
WHERE scan.status <> 'completed';

-- -----------------------------------------------------------------------------
-- 7. view_po_inward_items_qty
-- Source: MySQL view_po_inward_items_qty
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_po_inward_items_qty AS 
SELECT 
    purchase_inward_items.pid AS pid,
    purchase_inward_items.plateid AS plateid,
    purchase_inward_items.material AS material,
    purchase_inward_items.materialtype AS materialtype,
    SUM(purchase_inward_items.inward_qty) AS inward_qty
FROM public.purchase_inward_items
GROUP BY purchase_inward_items.pid, purchase_inward_items.plateid, purchase_inward_items.material, purchase_inward_items.materialtype;

-- -----------------------------------------------------------------------------
-- 8. view_po_outword_items_qty
-- Source: MySQL view_po_outword_items_qty
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_po_outword_items_qty AS 
SELECT 
    purchase_items.plateid AS plateid,
    SUM(purchase_items.qty) AS qty,
    purchase.projectid AS projectid
FROM public.purchase_items
JOIN public.purchase ON purchase_items.pid = purchase.id
WHERE purchase.status = '1'
GROUP BY purchase_items.plateid, purchase.projectid;

-- -----------------------------------------------------------------------------
-- 9. view_po_pending_inward_qty
-- Source: MySQL view_po_pending_inward_qty
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_po_pending_inward_qty AS 
SELECT 
    purchase.id AS id,
    (SELECT customers.customername FROM public.customers WHERE customers.id = purchase.cname) AS customername,
    (SELECT customers.customername FROM public.customers WHERE customers.id = purchase.vname) AS vendorname,
    purchase.vname AS vname,
    purchase.cname AS cname,
    purchase.srno AS srno,
    purchase.pno AS pno,
    purchase.projectid AS projectid,
    purchase.odate AS odate,
    purchase_items.plateid AS plateid,
    purchase_items.material AS material,
    purchase_items.materialtype AS materialtype,
    purchase_items.qty AS qty,
    COALESCE(view_po_inward_items_qty.inward_qty, 0) AS inward_qty,
    purchase_items.qty - COALESCE(view_po_inward_items_qty.inward_qty, 0) AS pending_qty,
    subplate.platename AS platename
FROM public.purchase
JOIN public.purchase_items ON purchase.id = purchase_items.pid
LEFT JOIN public.view_po_inward_items_qty ON (
    purchase_items.plateid = view_po_inward_items_qty.plateid
    AND purchase_items.material = view_po_inward_items_qty.material
    AND purchase_items.materialtype = view_po_inward_items_qty.materialtype
    AND purchase.id = view_po_inward_items_qty.pid
)
JOIN public.subplate ON purchase_items.plateid = subplate.id
WHERE purchase.status = '1';

-- -----------------------------------------------------------------------------
-- 10. view_po_pending_outword_qty
-- Source: MySQL view_po_pending_outword_qty
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_po_pending_outword_qty AS 
SELECT 
    subplate.projectid AS projectid,
    scan.projectid AS projectname,
    subplate.id AS plateid,
    subplate.platename AS platename,
    subplate.unit AS unit,
    subplate.material AS material,
    subplate.length AS length,
    subplate.width AS width,
    subplate.height AS height,
    COALESCE(subplate.sqty, 0) AS sqty,
    subplate.sqty - COALESCE(view_po_outword_items_qty.qty, 0) + COALESCE((
        SELECT SUM(view_po_inward_items_qty.inward_qty)
        FROM public.view_po_inward_items_qty
        WHERE subplate.id = view_po_inward_items_qty.plateid
        GROUP BY view_po_inward_items_qty.plateid
        LIMIT 1
    ), 0) AS pqty,
    COALESCE(view_po_outword_items_qty.qty, 0) AS oqty
FROM public.subplate
LEFT JOIN public.view_po_outword_items_qty ON subplate.id = view_po_outword_items_qty.plateid
JOIN public.scan ON subplate.projectid::text = scan.id::text
WHERE scan.status <> 'completed';

-- -----------------------------------------------------------------------------
-- 11. Read access policies for tables
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'customers', 'subplate', 'scan', 'purchase', 'purchase_items',
        'po_inward', 'purchase_inward_items', 'challan', 'challan_items',
        'inward', 'inward_items', 'dispatch', 'dispatch_items',
        'expense', 'worklog', 'profiles', 'gram_calc', 'print'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated read" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Allow authenticated read" ON public.%I FOR SELECT USING (true)', t);
        END IF;
    END LOOP;
END $$;
