ALTER TABLE public.subplate
  ADD COLUMN IF NOT EXISTS po_bypassed boolean NOT NULL DEFAULT false;

ALTER TABLE public.scan
  ADD COLUMN IF NOT EXISTS register_closure_reason text,
  ADD COLUMN IF NOT EXISTS register_closure_notes text;

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
        SUM(ci.qty) AS outward_qty,
        COALESCE(ins.returned_qty, 0) AS returned_qty,
        GREATEST(0, SUM(ci.qty) - COALESCE(ins.returned_qty, 0)) AS pending_at_vendor
    FROM challan_items ci
    JOIN challan c ON ci.challanid = c.id
    LEFT JOIN vendors v ON c.vendorid = v.id
    LEFT JOIN inward_sum ins ON ci.challanid = ins.challanid AND ci.plateid = ins.plateid
    WHERE c.status = '1' AND ci.plateid IS NOT NULL
    GROUP BY ci.plateid, ci.challanid, c.vendorid, v.vendor_name, v.initials, ins.returned_qty
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
    -- Confirmed in-house stock is used when no commercial PO is active.
    GREATEST(
        0,
        CASE WHEN sp.po_bypassed AND po.po_ordered_qty IS NULL THEN sp.sqty
             ELSE COALESCE(poi.po_inward_qty, 0) END
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
    COALESCE(disp.customer_dispatched_qty, 0)::integer AS customer_dispatched_qty,
    (sp.po_bypassed AND po.po_ordered_qty IS NULL) AS po_bypassed
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
    sp.po_bypassed,
    po.po_ordered_qty,
    poi.po_inward_qty,
    disp.customer_dispatched_qty;

CREATE OR REPLACE FUNCTION public.inventory_available_quantity(p_plate bigint) RETURNS numeric
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT COALESCE((
    SELECT b.available_sm_qty
    FROM public.view_subplate_jobwork_balance b
    WHERE b.plateid = p_plate
  ), 0)::numeric;
$$;

CREATE OR REPLACE FUNCTION public.bypass_subplate_purchase(p_plate bigint, p_actor bigint)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  plate public.subplate;
  project public.scan;
  balance record;
BEGIN
  -- Share the inventory document lock so a concurrent PO or challan cannot race this decision.
  PERFORM pg_advisory_xact_lock(714203, 1);
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_actor AND status = 1 AND role_id IN (0, 1, 2, 5)
  ) THEN
    RAISE EXCEPTION 'Only management or purchase staff can confirm in-house material' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO plate FROM public.subplate WHERE id = p_plate AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active subplate not found'; END IF;
  SELECT * INTO project FROM public.scan sc WHERE sc.id = plate.mold_id OR (plate.mold_id IS NULL AND
    (sc.projectid = plate.mold_code OR sc.projectid = plate.projectid OR sc.id::text = plate.projectid))
    ORDER BY (sc.projectid = plate.mold_code) DESC NULLS LAST, sc.id LIMIT 1 FOR UPDATE;

  IF NOT FOUND OR project.status IN ('completed', 'registered') THEN
    RAISE EXCEPTION 'An active mould project is required';
  END IF;
  IF plate.subplate_type <> 'repair' AND lower(trim(COALESCE(project.worktype, ''))) NOT IN ('rework', 'sample') THEN
    RAISE EXCEPTION 'Only repair, Rework or Sample subplates can proceed without a purchase order';
  END IF;

  SELECT * INTO STRICT balance FROM public.view_subplate_jobwork_balance WHERE plateid = p_plate;
  IF balance.has_po OR balance.po_inward_qty > 0 THEN
    RAISE EXCEPTION 'This subplate has a commercial purchase or inward receipt';
  END IF;
  IF plate.po_bypassed THEN RETURN to_jsonb(plate); END IF;
  IF balance.outward_jobwork_qty > 0 OR balance.customer_dispatched_qty > 0 OR
     plate.location = 'Customer' OR COALESCE(plate.dispatch_status, '') IN ('partial', 'dispatched') THEN
    RAISE EXCEPTION 'Confirm in-house material only while all pieces are at Star Mould';
  END IF;

  UPDATE public.subplate SET po_bypassed = true, order_by = p_actor, received_workby = p_actor,
    order_at = now(), received_work_at = now(), updated_at = now(), location = 'In-House'
    WHERE id = p_plate RETURNING * INTO plate;
  RETURN to_jsonb(plate);
END;
$$;
REVOKE ALL ON FUNCTION public.bypass_subplate_purchase(bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bypass_subplate_purchase(bigint, bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.lock_register_inventory()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(714203, 1);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_vendor_jobwork_return()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  pending record;
BEGIN
  IF NEW.status NOT IN ('completed', 'registered') OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT sp.platename, b.outward_jobwork_qty, b.active_vendors INTO pending
  FROM public.subplate sp
  JOIN public.view_subplate_jobwork_balance b ON b.plateid = sp.id
  WHERE (sp.mold_id = NEW.id OR (sp.mold_id IS NULL AND
    (sp.projectid = NEW.id::text OR sp.projectid = NEW.projectid OR sp.mold_code = NEW.projectid)))
    AND b.outward_jobwork_qty > 0
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Plate "%": % pcs pending at %. Record an Inward Challan before moving to Project Register.',
      pending.platename, pending.outward_jobwork_qty, COALESCE(pending.active_vendors, 'vendor');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS register_inventory_lock ON public.scan;
CREATE TRIGGER register_inventory_lock BEFORE UPDATE OF status ON public.scan
FOR EACH STATEMENT EXECUTE FUNCTION public.lock_register_inventory();

DROP TRIGGER IF EXISTS register_vendor_gate ON public.scan;
CREATE TRIGGER register_vendor_gate BEFORE UPDATE OF status ON public.scan
FOR EACH ROW EXECUTE FUNCTION public.require_vendor_jobwork_return();

-- Reversing a return after registration would put a registered plate back at a vendor.
CREATE OR REPLACE FUNCTION public.protect_registered_jobwork_return()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.status = '1' AND NEW.status IS DISTINCT FROM OLD.status AND EXISTS (
    SELECT 1
    FROM public.inward_items ii
    JOIN public.subplate sp ON sp.id = ii.plateid
    JOIN public.view_subplate_jobwork_balance b ON b.plateid = sp.id
    JOIN public.scan sc ON sc.id = sp.mold_id OR (sp.mold_id IS NULL AND
      (sc.projectid = sp.projectid OR sc.id::text = sp.projectid OR sc.projectid = sp.mold_code))
    WHERE ii.inchallanid = NEW.id AND b.outward_jobwork_qty > 0
      AND sc.status IN ('completed', 'registered')
  ) THEN
    RAISE EXCEPTION 'Reopen the project before cancelling this Inward Challan.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inward_register_lock ON public.inward;
CREATE TRIGGER inward_register_lock BEFORE UPDATE OF status ON public.inward
FOR EACH STATEMENT EXECUTE FUNCTION public.lock_register_inventory();

DROP TRIGGER IF EXISTS inward_register_gate ON public.inward;
CREATE TRIGGER inward_register_gate AFTER UPDATE OF status ON public.inward
FOR EACH ROW EXECUTE FUNCTION public.protect_registered_jobwork_return();

-- Outward movements share the same transaction lock as registration.
CREATE OR REPLACE FUNCTION public.require_active_jobwork_project()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM new_jobwork_rows ci
    JOIN public.challan c ON c.id = ci.challanid AND c.status = '1'
    JOIN public.subplate sp ON sp.id = ci.plateid AND sp.deleted_at IS NULL
    JOIN public.scan sc ON sc.id = sp.mold_id OR (sp.mold_id IS NULL AND
      (sc.projectid = sp.projectid OR sc.id::text = sp.projectid OR sc.projectid = sp.mold_code))
    WHERE sc.status IN ('completed', 'registered')
  ) THEN
    RAISE EXCEPTION 'Reopen the project before sending material on Outward Job Work.';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS outward_register_lock ON public.challan_items;
CREATE TRIGGER outward_register_lock BEFORE INSERT ON public.challan_items
FOR EACH STATEMENT EXECUTE FUNCTION public.lock_register_inventory();

DROP TRIGGER IF EXISTS outward_register_gate ON public.challan_items;
CREATE TRIGGER outward_register_gate AFTER INSERT ON public.challan_items
REFERENCING NEW TABLE AS new_jobwork_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.require_active_jobwork_project();
