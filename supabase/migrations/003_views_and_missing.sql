-- =============================================================================
-- StarMould ERP - Missing Views & Reconstructed Tables for Supabase
-- Paste this into Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tvfqhdhxwnpkhhrvxvfi/sql/new
-- =============================================================================

-- 1. Reconstructed tables: gram_calc and print
CREATE TABLE IF NOT EXISTS public.gram_calc (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    min_weight NUMERIC(10, 4) NOT NULL,
    max_weight NUMERIC(10, 4) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.print (
    id BIGSERIAL PRIMARY KEY,
    plateid BIGINT NOT NULL,
    pdate DATE NOT NULL,
    created_by VARCHAR(100) NULL,
    updated_by VARCHAR(100) NULL,
    status VARCHAR(50) DEFAULT '1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Pending Quantity Views (10 views)

-- 1. view_outword_items_qty
CREATE OR REPLACE VIEW public.view_outword_items_qty AS
SELECT 
    ci.plateid AS plateid,
    COALESCE(SUM(ci.qty), 0) AS qty,
    c.projectid AS projectid
FROM public.challan_items ci
JOIN public.challan c ON ci.challanid = c.id
WHERE c.status = '1'
GROUP BY ci.plateid, c.projectid;

-- 2. view_inward_items_qty
CREATE OR REPLACE VIEW public.view_inward_items_qty AS
SELECT 
    ii.challanid AS challanid,
    ii.plateid AS plateid,
    ii.particulars AS particulars,
    COALESCE(SUM(ii.inward_qty), 0) AS inward_qty
FROM public.inward_items ii
GROUP BY ii.challanid, ii.plateid, ii.particulars;

-- 3. view_dispatch_items_qty
CREATE OR REPLACE VIEW public.view_dispatch_items_qty AS
SELECT 
    di.plateid AS plateid,
    COALESCE(SUM(di.qty), 0) AS qty,
    d.projectid AS projectid
FROM public.dispatch_items di
JOIN public.dispatch d ON di.dispatchid = d.id
WHERE d.status = '1'
GROUP BY di.plateid, d.projectid;

-- 4. view_pending_dispatch_qty
CREATE OR REPLACE VIEW public.view_pending_dispatch_qty AS
SELECT 
    sp.projectid AS projectid,
    sc.projectid AS projectname,
    sp.id AS plateid,
    sp.platename AS platename,
    COALESCE(sp.sqty, 0) AS sqty,
    COALESCE(sp.sqty, 0) - COALESCE(vdi.qty, 0) AS pqty,
    COALESCE(vdi.qty, 0) AS oqty
FROM public.subplate sp
LEFT JOIN public.view_dispatch_items_qty vdi ON sp.id = vdi.plateid
JOIN public.scan sc ON (sp.projectid = sc.id::text OR sp.projectid = sc.projectid)
WHERE sc.status <> 'completed';

-- 5. view_pending_inward_qty
CREATE OR REPLACE VIEW public.view_pending_inward_qty AS
SELECT 
    c.id AS id,
    (SELECT customername FROM public.customers WHERE customers.id = c.customerid) AS customername,
    (SELECT customername FROM public.customers WHERE customers.id = c.vendorid) AS vendorname,
    (SELECT customername FROM public.customers WHERE customers.id = c.vendortid) AS transportname,
    c.challanno AS challanno,
    c.customerid AS customerid,
    c.vendorid AS vendorid,
    c.vendortid AS vendortid,
    ci.project AS projectid,
    c.created_by AS created_by,
    c.chdate AS chdate,
    ci.plateid AS plateid,
    ci.particulars AS particulars,
    ci.qty AS qty,
    COALESCE(vii.inward_qty, 0) AS inward_qty,
    COALESCE(ci.qty, 0) - COALESCE(vii.inward_qty, 0) AS pending_qty,
    sp.platename AS platename
FROM public.challan c
JOIN public.challan_items ci ON c.id = ci.challanid
LEFT JOIN public.view_inward_items_qty vii ON (
    ci.plateid = vii.plateid 
    AND ci.particulars = vii.particulars 
    AND c.id = vii.challanid
)
JOIN public.subplate sp ON ci.plateid = sp.id
WHERE c.status = '1';

-- 6. view_pending_outword_qty
CREATE OR REPLACE VIEW public.view_pending_outword_qty AS
SELECT 
    sp.projectid AS projectid,
    sc.projectid AS projectname,
    sp.id AS plateid,
    sp.platename AS platename,
    COALESCE(sp.sqty, 0) AS sqty,
    COALESCE(sp.sqty, 0) - COALESCE(voi.qty, 0) + COALESCE((
        SELECT SUM(vii.inward_qty)
        FROM public.view_inward_items_qty vii
        WHERE sp.id = vii.plateid
    ), 0) AS pqty,
    COALESCE(voi.qty, 0) AS oqty
FROM public.subplate sp
LEFT JOIN public.view_outword_items_qty voi ON sp.id = voi.plateid
JOIN public.scan sc ON (sp.projectid = sc.id::text OR sp.projectid = sc.projectid)
WHERE sc.status <> 'completed';

-- 7. view_po_inward_items_qty
CREATE OR REPLACE VIEW public.view_po_inward_items_qty AS
SELECT 
    pii.pid AS pid,
    pii.plateid AS plateid,
    pii.material AS material,
    pii.materialtype AS materialtype,
    COALESCE(SUM(pii.inward_qty), 0) AS inward_qty
FROM public.purchase_inward_items pii
GROUP BY pii.pid, pii.plateid, pii.material, pii.materialtype;

-- 8. view_po_outword_items_qty
CREATE OR REPLACE VIEW public.view_po_outword_items_qty AS
SELECT 
    pi.plateid AS plateid,
    COALESCE(SUM(pi.qty), 0) AS qty,
    p.projectid AS projectid
FROM public.purchase_items pi
JOIN public.purchase p ON pi.pid = p.id
WHERE p.status = '1'
GROUP BY pi.plateid, p.projectid;

-- 9. view_po_pending_inward_qty
CREATE OR REPLACE VIEW public.view_po_pending_inward_qty AS
SELECT 
    p.id AS id,
    (SELECT customername FROM public.customers WHERE customers.id = p.cname) AS customername,
    (SELECT customername FROM public.customers WHERE customers.id = p.vname) AS vendorname,
    p.vname AS vname,
    p.cname AS cname,
    p.srno AS srno,
    p.pno AS pno,
    p.projectid AS projectid,
    p.odate AS odate,
    pi.plateid AS plateid,
    pi.material AS material,
    pi.materialtype AS materialtype,
    pi.qty AS qty,
    COALESCE(vpi.inward_qty, 0) AS inward_qty,
    COALESCE(pi.qty, 0) - COALESCE(vpi.inward_qty, 0) AS pending_qty,
    sp.platename AS platename
FROM public.purchase p
JOIN public.purchase_items pi ON p.id = pi.pid
LEFT JOIN public.view_po_inward_items_qty vpi ON (
    pi.plateid = vpi.plateid 
    AND pi.material = vpi.material 
    AND pi.materialtype = vpi.materialtype 
    AND p.id = vpi.pid
)
JOIN public.subplate sp ON pi.plateid = sp.id
WHERE p.status = '1';

-- 10. view_po_pending_outword_qty
CREATE OR REPLACE VIEW public.view_po_pending_outword_qty AS
SELECT 
    sp.projectid AS projectid,
    sc.projectid AS projectname,
    sp.id AS plateid,
    sp.platename AS platename,
    sp.unit AS unit,
    sp.material AS material,
    sp.length AS length,
    sp.width AS width,
    sp.height AS height,
    COALESCE(sp.sqty, 0) AS sqty,
    COALESCE(sp.sqty, 0) - COALESCE(vpo.qty, 0) + COALESCE((
        SELECT SUM(vpi.inward_qty)
        FROM public.view_po_inward_items_qty vpi
        WHERE sp.id = vpi.plateid
    ), 0) AS pqty,
    COALESCE(vpo.qty, 0) AS oqty
FROM public.subplate sp
LEFT JOIN public.view_po_outword_items_qty vpo ON sp.id = vpo.plateid
JOIN public.scan sc ON (sp.projectid = sc.id::text OR sp.projectid = sc.projectid)
WHERE sc.status <> 'completed';

-- 3. Read access policies for tables
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
        EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated read" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Allow authenticated read" ON public.%I FOR SELECT USING (true)', t);
    END LOOP;
END $$;
