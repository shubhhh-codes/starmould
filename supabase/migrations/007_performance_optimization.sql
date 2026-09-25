-- ==============================================================================
-- StarMould ERP - Migration 007: Performance & Scalability Optimization
-- Target: PostgreSQL 15+ / Supabase
-- Features: GIN Trigram fast search, Stage Partial Indexes, Optimized JOIN Views, VACUUM stats
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ------------------------------------------------------------------------------
-- 2. GIN TRIGRAM SEARCH INDEXES (Sub-millisecond ILIKE '%...%' searches)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON public.customers USING gin (customername gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_scan_projectid_trgm ON public.scan USING gin (projectid gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_scan_desc_trgm ON public.scan USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_subplate_name_trgm ON public.subplate USING gin (platename gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_challan_no_trgm ON public.challan USING gin (challanno gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inward_no_trgm ON public.inward USING gin (inchallanno gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_purchase_srno_trgm ON public.purchase USING gin (srno gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_po_inward_srno_trgm ON public.po_inward USING gin (insrno gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dispatch_challanno_trgm ON public.dispatch USING gin (challanno gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dispatch_invoiceno_trgm ON public.dispatch USING gin (invoiceno gin_trgm_ops);

-- ------------------------------------------------------------------------------
-- 3. PARTIAL & COMPOSITE STAGE / FILTER INDEXES
-- ------------------------------------------------------------------------------
-- Active / In-progress subplates (packing not completed)
CREATE INDEX IF NOT EXISTS idx_subplate_in_progress
  ON public.subplate (projectid, location)
  WHERE packing_workby IS NULL;

-- Subplates pending design
CREATE INDEX IF NOT EXISTS idx_subplate_pending_design
  ON public.subplate (projectid, location)
  WHERE design_by IS NULL;

-- Subplates pending order
CREATE INDEX IF NOT EXISTS idx_subplate_pending_order
  ON public.subplate (projectid, location)
  WHERE design_by IS NOT NULL AND order_by IS NULL;

-- Subplates ready for dispatch (all 9 stages completed & location SM)
CREATE INDEX IF NOT EXISTS idx_subplate_dispatch_eligible
  ON public.subplate (id, projectid, platename, sqty)
  WHERE design_by IS NOT NULL
    AND order_by IS NOT NULL
    AND received_workby IS NOT NULL
    AND received_qcby IS NOT NULL
    AND vmc_workby IS NOT NULL
    AND vmc_qcby IS NOT NULL
    AND drilltap_workby IS NOT NULL
    AND final_qcby IS NOT NULL
    AND packing_workby IS NOT NULL
    AND location = 'SM';

-- Active dispatch items
CREATE INDEX IF NOT EXISTS idx_dispatch_active_id
  ON public.dispatch (id, chdate DESC)
  WHERE status = '1';

CREATE INDEX IF NOT EXISTS idx_dispatch_items_composite
  ON public.dispatch_items (dispatchid, plateid, project, qty);

-- Active challans and inward
CREATE INDEX IF NOT EXISTS idx_challan_active_id
  ON public.challan (id, chdate DESC)
  WHERE status = '1';

CREATE INDEX IF NOT EXISTS idx_inward_composite_lookup
  ON public.inward_items (challanid, plateid, particulars, inward_qty);

-- Active purchase orders and PO inward
CREATE INDEX IF NOT EXISTS idx_purchase_active_id
  ON public.purchase (id, odate DESC)
  WHERE status = '1';

CREATE INDEX IF NOT EXISTS idx_purchase_inward_composite
  ON public.purchase_inward_items (pid, plateid, material, materialtype, inward_qty);

-- Sorting & Pagination composite indexes
CREATE INDEX IF NOT EXISTS idx_worklog_user_date ON public.worklog (userid, rdate DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_worklog_project_date ON public.worklog (projectid, rdate DESC);
CREATE INDEX IF NOT EXISTS idx_expense_cust_date ON public.expense (customerid, rdate DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_scan_status_rdate ON public.scan (status, rdate DESC, id DESC);

-- ------------------------------------------------------------------------------
-- 4. DROP EXISTING VIEWS FOR CLEAN RE-CREATION
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_po_pending_outword_qty CASCADE;
DROP VIEW IF EXISTS public.view_po_pending_inward_qty CASCADE;
DROP VIEW IF EXISTS public.view_po_outword_items_qty CASCADE;
DROP VIEW IF EXISTS public.view_po_inward_items_qty CASCADE;
DROP VIEW IF EXISTS public.view_pending_outword_qty CASCADE;
DROP VIEW IF EXISTS public.view_pending_inward_qty CASCADE;
DROP VIEW IF EXISTS public.view_pending_dispatch_qty CASCADE;
DROP VIEW IF EXISTS public.view_outword_items_qty CASCADE;
DROP VIEW IF EXISTS public.view_inward_items_qty CASCADE;
DROP VIEW IF EXISTS public.view_dispatch_items_qty CASCADE;

-- ------------------------------------------------------------------------------
-- 5. OPTIMIZED JOIN-BASED POSTGRES VIEWS
-- ------------------------------------------------------------------------------

-- 1. view_dispatch_items_qty
CREATE VIEW public.view_dispatch_items_qty AS
SELECT 
    di.plateid AS plateid,
    COALESCE(SUM(di.qty), 0) AS qty,
    di.project AS projectid
FROM public.dispatch_items di
JOIN public.dispatch d ON di.dispatchid = d.id
WHERE d.status = '1'
GROUP BY di.plateid, di.project;

-- 2. view_inward_items_qty
CREATE VIEW public.view_inward_items_qty AS
SELECT 
    ii.challanid AS challanid,
    ii.plateid AS plateid,
    ii.particulars AS particulars,
    COALESCE(SUM(ii.inward_qty), 0) AS inward_qty
FROM public.inward_items ii
GROUP BY ii.challanid, ii.plateid, ii.particulars;

-- 3. view_outword_items_qty
CREATE VIEW public.view_outword_items_qty AS
SELECT 
    ci.plateid AS plateid,
    COALESCE(SUM(ci.qty), 0) AS qty,
    ci.project AS projectid
FROM public.challan_items ci
JOIN public.challan c ON ci.challanid = c.id
WHERE c.status = '1'
GROUP BY ci.plateid, ci.project;

-- 4. view_pending_dispatch_qty
CREATE VIEW public.view_pending_dispatch_qty AS
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
WHERE sc.status <> 'completed'
  AND sp.design_by IS NOT NULL
  AND sp.order_by IS NOT NULL
  AND sp.received_workby IS NOT NULL
  AND sp.received_qcby IS NOT NULL
  AND sp.vmc_workby IS NOT NULL
  AND sp.vmc_qcby IS NOT NULL
  AND sp.drilltap_workby IS NOT NULL
  AND sp.final_qcby IS NOT NULL
  AND sp.packing_workby IS NOT NULL
  AND sp.location = 'SM';

-- 5. view_pending_inward_qty
CREATE VIEW public.view_pending_inward_qty AS
SELECT 
    c.id AS id,
    cust.customername AS customername,
    vend.customername AS vendorname,
    trans.customername AS transportername,
    c.vendorid AS vendorid,
    ci.customer AS customer,
    c.challanno AS challanno,
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
LEFT JOIN public.customers cust ON ci.customer = cust.id
LEFT JOIN public.customers vend ON c.vendorid = vend.id
LEFT JOIN public.customers trans ON c.vendortid = trans.id
LEFT JOIN public.view_inward_items_qty vii ON (
    ci.plateid = vii.plateid 
    AND ci.particulars = vii.particulars 
    AND c.id = vii.challanid
)
LEFT JOIN public.subplate sp ON ci.plateid = sp.id
WHERE c.status = '1';

-- 6. view_pending_outword_qty
CREATE VIEW public.view_pending_outword_qty AS
SELECT 
    sp.projectid AS projectid,
    sc.projectid AS projectname,
    sp.id AS plateid,
    sp.platename AS platename,
    COALESCE(sp.sqty, 0) AS sqty,
    COALESCE(sp.sqty, 0) - COALESCE(voi.qty, 0) AS pqty,
    COALESCE(voi.qty, 0) AS oqty
FROM public.subplate sp
LEFT JOIN public.view_outword_items_qty voi ON sp.id = voi.plateid
JOIN public.scan sc ON (sp.projectid = sc.id::text OR sp.projectid = sc.projectid)
WHERE sc.status <> 'completed'
  AND sp.design_by IS NOT NULL
  AND sp.order_by IS NOT NULL
  AND sp.received_workby IS NOT NULL
  AND sp.location = 'SM';

-- 7. view_po_inward_items_qty
CREATE VIEW public.view_po_inward_items_qty AS
SELECT 
    pii.pid AS pid,
    pii.plateid AS plateid,
    pii.material AS material,
    pii.materialtype AS materialtype,
    COALESCE(SUM(pii.inward_qty), 0) AS inward_qty
FROM public.purchase_inward_items pii
GROUP BY pii.pid, pii.plateid, pii.material, pii.materialtype;

-- 8. view_po_outword_items_qty
CREATE VIEW public.view_po_outword_items_qty AS
SELECT 
    pi.plateid AS plateid,
    COALESCE(SUM(pi.qty), 0) AS qty,
    p.projectid AS projectid
FROM public.purchase_items pi
JOIN public.purchase p ON pi.pid = p.id
WHERE p.status = '1'
GROUP BY pi.plateid, p.projectid;

-- 9. view_po_pending_inward_qty
CREATE VIEW public.view_po_pending_inward_qty AS
SELECT 
    p.id AS id,
    cust.customername AS customername,
    vend.customername AS vendorname,
    p.vname AS vname,
    p.cname AS cname,
    p.srno AS srno,
    p.pno AS pno,
    p.projectid AS projectid,
    p.created_by AS created_by,
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
LEFT JOIN public.customers cust ON p.cname = cust.id
LEFT JOIN public.customers vend ON p.vname = vend.id
LEFT JOIN public.view_po_inward_items_qty vpi ON (
    pi.plateid = vpi.plateid 
    AND pi.material = vpi.material 
    AND pi.materialtype = vpi.materialtype 
    AND p.id = vpi.pid
)
LEFT JOIN public.subplate sp ON pi.plateid = sp.id
WHERE p.status = '1';

-- 10. view_po_pending_outword_qty
CREATE VIEW public.view_po_pending_outword_qty AS
SELECT 
    sp.projectid AS projectid,
    sc.projectid AS projectname,
    sp.id AS plateid,
    sp.platename AS platename,
    COALESCE(sp.sqty, 0) AS sqty,
    COALESCE(sp.sqty, 0) - COALESCE(vpoi.qty, 0) AS pqty,
    COALESCE(vpoi.qty, 0) AS oqty
FROM public.subplate sp
LEFT JOIN public.view_po_outword_items_qty vpoi ON sp.id = vpoi.plateid
JOIN public.scan sc ON (sp.projectid = sc.id::text OR sp.projectid = sc.projectid)
WHERE sc.status <> 'completed'
  AND sp.design_by IS NOT NULL
  AND sp.order_by IS NOT NULL
  AND sp.location = 'SM';

-- ------------------------------------------------------------------------------
-- 6. PERMISSIONS
-- ------------------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;
