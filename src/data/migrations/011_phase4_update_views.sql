-- Phase 4: Update Views to join public.vendors instead of public.customers for vendor/transporter lookups
-- Part of: Split customers into customers + vendors (Starmould ERP)

/* =========================================================================
   ROLLBACK REFERENCE: OLD DEFINITIONS OF MODIFIED VIEWS
   =========================================================================

-- OLD view_pending_inward_qty:
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
   FROM ((((((challan c
     JOIN challan_items ci ON ((c.id = ci.challanid)))
     LEFT JOIN customers cust ON ((ci.customer = cust.id)))
     LEFT JOIN customers vend ON ((c.vendorid = vend.id)))
     LEFT JOIN customers trans ON ((c.vendortid = trans.id)))
     LEFT JOIN view_inward_items_qty vii ON (((ci.plateid = vii.plateid) AND (ci.particulars = vii.particulars) AND (c.id = vii.challanid))))
     LEFT JOIN subplate sp ON ((ci.plateid = sp.id)))
  WHERE ((c.status)::text = '1'::text);

-- OLD view_po_pending_inward_qty:
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
   FROM (((((purchase p
     JOIN purchase_items pi ON ((p.id = pi.pid)))
     LEFT JOIN customers cust ON ((p.cname = cust.id)))
     LEFT JOIN customers vend ON ((p.vname = vend.id)))
     LEFT JOIN view_po_inward_items_qty vpi ON (((pi.plateid = vpi.plateid) AND (pi.material = vpi.material) AND (pi.materialtype = vpi.materialtype) AND (p.id = vpi.pid))))
     LEFT JOIN subplate sp ON ((pi.plateid = sp.id)))
  WHERE ((p.status)::text = '1'::text);
========================================================================= */

-- 1. Update view_pending_inward_qty to join public.vendors
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
   FROM ((((((public.challan c
     JOIN public.challan_items ci ON ((c.id = ci.challanid)))
     LEFT JOIN public.customers cust ON ((ci.customer = cust.id)))
     LEFT JOIN public.vendors vend ON ((c.vendorid = vend.id)))
     LEFT JOIN public.vendors trans ON ((c.vendortid = trans.id)))
     LEFT JOIN public.view_inward_items_qty vii ON (((ci.plateid = vii.plateid) AND (ci.particulars = vii.particulars) AND (c.id = vii.challanid))))
     LEFT JOIN public.subplate sp ON ((ci.plateid = sp.id)))
  WHERE ((c.status)::text = '1'::text);

-- 2. Update view_po_pending_inward_qty to join public.vendors
CREATE OR REPLACE VIEW public.view_po_pending_inward_qty 
WITH (security_invoker = true) AS
 SELECT p.id,
    cust.customername,
    vend.vendor_name AS vendorname,
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
     LEFT JOIN public.vendors vend ON ((p.vname = vend.id)))
     LEFT JOIN public.view_po_inward_items_qty vpi ON (((pi.plateid = vpi.plateid) AND (pi.material = vpi.material) AND (pi.materialtype = vpi.materialtype) AND (p.id = vpi.pid))))
     LEFT JOIN public.subplate sp ON ((pi.plateid = sp.id)))
  WHERE ((p.status)::text = '1'::text);

-- 3. Update get_table_counts() RPC to return vendors count alongside customers
CREATE OR REPLACE FUNCTION public.get_table_counts()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'customers', (SELECT count(*) FROM public.customers WHERE deleted_at IS NULL),
    'vendors', (SELECT count(*) FROM public.vendors WHERE deleted_at IS NULL),
    'subplates', (SELECT count(*) FROM public.subplate WHERE deleted_at IS NULL),
    'scans', (SELECT count(*) FROM public.scan),
    'purchases', (SELECT count(*) FROM public.purchase),
    'po_inwards', (SELECT count(*) FROM public.po_inward),
    'challans', (SELECT count(*) FROM public.challan),
    'inwards', (SELECT count(*) FROM public.inward),
    'dispatches', (SELECT count(*) FROM public.dispatch),
    'expenses', (SELECT count(*) FROM public.expense),
    'worklogs', (SELECT count(*) FROM public.worklog),
    'users', (SELECT count(*) FROM public.users WHERE deleted_at IS NULL)
  ) INTO result;
  RETURN result;
END;
$function$;
