-- ==============================================================================
-- Forward Migration: Atomic Movement and Photo Finalization in Inventory RPC
-- Migration: 20261116160000_atomic_photo_link_in_inventory.sql
-- Date: 2026-11-16
-- Section 6 (F03) of Photo System Architecture
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_inventory_document(p_operation text, p_actor bigint, p_key text, p_body jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  prior public.inventory_requests;
  actor public.users;
  source jsonb;
  source_line jsonb;
  item jsonb;
  normalized jsonb := '[]'::jsonb;
  header jsonb;
  document_result jsonb;
  lines jsonb;
  plate_record public.subplate;
  project_record public.scan;
  group_line record;
  balance record;
  source_id bigint;
  source_line_id bigint;
  plate_id bigint;
  quantity numeric;
  received numeric;
  legacy_received numeric;
  ordered numeric;
  source_count integer;
  document_id bigint;
  customer_id bigint;
  vendor_id bigint;
  transport_id bigint;
  project_code text;
  document_number text;
  suffix text := to_char(timezone('Asia/Kolkata',now()), 'DDMMYYYY');
  at_time timestamptz := now();
  p_elem jsonb;
  p_id bigint;
  ev_id text;
  m_type text;
BEGIN
  IF p_operation NOT IN ('purchase','purchase-receipt','challan','jobwork-receipt','dispatch') OR
    p_key IS NULL OR p_key !~ '^[A-Za-z0-9_-]{8,128}$' THEN
    RAISE EXCEPTION 'Valid operation and Idempotency-Key required' USING ERRCODE='22023';
  END IF;
  IF jsonb_typeof(p_body->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Document items required' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_body->'items') NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Document requires 1 to 500 lines' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.inventory_requests(actor_id,operation,request_key,request_payload)
    VALUES(p_actor,p_operation,p_key,p_body) ON CONFLICT DO NOTHING;
  SELECT * INTO prior FROM public.inventory_requests WHERE actor_id=p_actor AND operation=p_operation AND request_key=p_key FOR UPDATE;
  IF prior.request_payload IS DISTINCT FROM p_body THEN RAISE EXCEPTION 'Idempotency-Key already used with different payload' USING ERRCODE='P0001'; END IF;
  IF prior.result IS NOT NULL THEN RETURN prior.result; END IF;
  PERFORM pg_advisory_xact_lock(714203, 1);
  SELECT * INTO actor FROM public.users WHERE id=p_actor AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active actor required' USING ERRCODE='22023'; END IF;

  IF p_operation='purchase-receipt' THEN
    source_id := coalesce(p_body->>'pid',p_body->>'poid')::bigint;
    SELECT to_jsonb(h) INTO source FROM public.purchase h WHERE id=source_id AND status='1' FOR UPDATE;
    IF source IS NULL THEN RAISE EXCEPTION 'Active purchase order required' USING ERRCODE='22023'; END IF;
    customer_id := (source->>'cname')::bigint; vendor_id := (source->>'vname')::bigint; project_code := source->>'projectid';
  ELSIF p_operation='jobwork-receipt' THEN
    source_id := (p_body->>'challanid')::bigint;
    SELECT to_jsonb(h) INTO source FROM public.challan h WHERE id=source_id AND status='1' FOR UPDATE;
    IF source IS NULL THEN RAISE EXCEPTION 'Active challan required' USING ERRCODE='22023'; END IF;
    customer_id := (source->>'customerid')::bigint; vendor_id := (source->>'vendorid')::bigint;
    transport_id := (source->>'vendortid')::bigint; project_code := source->>'projectid';
  ELSE
    customer_id := coalesce(p_body->>'cname',p_body->>'customerid')::bigint;
    vendor_id := coalesce(p_body->>'vname',p_body->>'vendorid')::bigint;
    transport_id := coalesce(nullif(nullif(p_body->>'vendortid',''),'0')::bigint,vendor_id);
    project_code := p_body->>'projectid';
  END IF;
  IF customer_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.customers WHERE id=customer_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Active customer required' USING ERRCODE='22023';
  END IF;
  IF p_operation IN ('purchase','challan') AND (vendor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.vendors WHERE id=vendor_id AND deleted_at IS NULL)) THEN
    RAISE EXCEPTION 'Active vendor required' USING ERRCODE='22023';
  END IF;
  IF p_operation IN ('challan','dispatch') AND (transport_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.vendors WHERE id=transport_id AND deleted_at IS NULL)) THEN
    RAISE EXCEPTION 'Active transporter required' USING ERRCODE='22023';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_body->'items') LOOP
    quantity := (CASE WHEN p_operation IN ('purchase-receipt','jobwork-receipt') THEN item->>'inward_qty' ELSE item->>'qty' END)::numeric;
    IF quantity IS NULL OR quantity::text IN ('NaN','Infinity','-Infinity') OR quantity<=0 OR quantity<>trunc(quantity) OR quantity>2147483647 THEN
      RAISE EXCEPTION 'Quantities must be positive finite integers' USING ERRCODE='22023';
    END IF;
    plate_id := nullif(item->>'plateid','')::bigint;
    source_line_id := coalesce(item->>'source_line_id',item->>'purchase_item_id',item->>'challan_item_id')::bigint;
    IF p_operation='purchase-receipt' THEN
      SELECT count(*),min(id) INTO source_count,source_line_id FROM public.purchase_items
        WHERE pid=source_id AND ((source_line_id IS NOT NULL AND id=source_line_id) OR (source_line_id IS NULL AND plateid=plate_id));
      IF source_count<>1 THEN RAISE EXCEPTION 'Select an unambiguous purchase source line' USING ERRCODE='22023'; END IF;
      SELECT to_jsonb(pi) INTO source_line FROM public.purchase_items pi WHERE id=source_line_id;
    ELSIF p_operation='jobwork-receipt' THEN
      SELECT count(*),min(id) INTO source_count,source_line_id FROM public.challan_items
        WHERE challanid=source_id AND ((source_line_id IS NOT NULL AND id=source_line_id) OR (source_line_id IS NULL AND plateid=plate_id));
      IF source_count<>1 THEN RAISE EXCEPTION 'Select an unambiguous challan source line' USING ERRCODE='22023'; END IF;
      SELECT to_jsonb(ci) INTO source_line FROM public.challan_items ci WHERE id=source_line_id;
    END IF;

    IF plate_id IS NOT NULL THEN
      SELECT * INTO plate_record FROM public.subplate WHERE id=plate_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Subplate % not found',plate_id USING ERRCODE='22023'; END IF;
      IF project_code IS NOT NULL AND coalesce(plate_record.projectid::text,plate_record.mold_code) IS DISTINCT FROM project_code THEN
        RAISE EXCEPTION 'Subplate does not belong to specified project' USING ERRCODE='22023';
      END IF;
      IF plate_record.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Subplate % deleted',plate_id USING ERRCODE='22023'; END IF;
      IF p_operation='purchase' AND plate_record.order_by IS NOT NULL AND plate_record.order_by>0 THEN
        RAISE EXCEPTION 'Subplate % already ordered',plate_id USING ERRCODE='P0001';
      END IF;
      IF p_operation IN ('challan','dispatch') AND (plate_record.received_workby IS NULL OR plate_record.received_workby<=0) THEN
        RAISE EXCEPTION 'Subplate % raw material not received',plate_id USING ERRCODE='P0001';
      END IF;
      IF p_operation='dispatch' AND (plate_record.final_qcby IS NULL OR plate_record.final_qcby<=0) THEN
        RAISE EXCEPTION 'Subplate % final QC required before dispatch',plate_id USING ERRCODE='P0001';
      END IF;
      IF p_operation='dispatch' AND plate_record.location='Customer' AND plate_record.dispatch_status='dispatched' THEN
        RAISE EXCEPTION 'Subplate % already fully dispatched',plate_id USING ERRCODE='P0001';
      END IF;
    ELSIF p_operation NOT IN ('purchase','dispatch') THEN
      RAISE EXCEPTION 'Subplate required for operation' USING ERRCODE='22023';
    END IF;

    normalized := normalized || jsonb_build_array(
      coalesce(source_line,'{}'::jsonb) || item || jsonb_build_object(
        'plateid',plate_id,'source_line_id',source_line_id,'requested_qty',quantity,
        'qty',coalesce(source_line->>'qty',item->>'qty',quantity::text)::numeric,
        'customer_id',customer_id,'vendor_id',vendor_id,'transport_id',transport_id,'project_code',project_code
      )
    );
  END LOOP;

  IF p_operation IN ('challan','dispatch') THEN
    FOR group_line IN SELECT (i->>'plateid')::bigint plateid,sum((i->>'requested_qty')::numeric) requested
      FROM jsonb_array_elements(normalized) i WHERE (i->>'plateid') IS NOT NULL GROUP BY 1 LOOP
      SELECT * INTO balance FROM public.view_subplate_jobwork_balance WHERE plateid=group_line.plateid;
      IF p_operation='challan' AND group_line.requested>coalesce(balance.available_for_jobwork,0) THEN
        RAISE EXCEPTION 'Insufficient subplate balance available for job work' USING ERRCODE='P0001';
      END IF;
      IF p_operation='dispatch' AND group_line.requested>coalesce(balance.available_for_dispatch,0) THEN
        RAISE EXCEPTION 'Insufficient subplate balance available for dispatch' USING ERRCODE='P0001';
      END IF;
    END LOOP;
  END IF;

  FOR group_line IN SELECT (i->>'plateid')::bigint plateid,sum((i->>'requested_qty')::numeric) requested
    FROM jsonb_array_elements(normalized) i WHERE (i->>'plateid') IS NOT NULL GROUP BY 1 LOOP
    SELECT * INTO plate_record FROM public.subplate WHERE id=group_line.plateid;
    IF p_operation='purchase-receipt' AND plate_record.location IS DISTINCT FROM 'Vendor' AND
      EXISTS(SELECT 1 FROM public.purchase_inward_items WHERE plateid=group_line.plateid) AND group_line.requested>coalesce(plate_record.sqty,1) THEN
      RAISE EXCEPTION 'Receipt quantity exceeds subplate requirement' USING ERRCODE='P0001';
    END IF;
    IF p_operation='challan' AND group_line.requested>coalesce(plate_record.sqty,1) THEN
      RAISE EXCEPTION 'Challan quantity exceeds subplate requirement' USING ERRCODE='P0001';
    END IF;
    IF p_operation='dispatch' AND group_line.requested>coalesce(plate_record.sqty,1) THEN
      RAISE EXCEPTION 'Insufficient physical inventory' USING ERRCODE='P0001';
    END IF;
  END LOOP;

  IF p_operation IN ('purchase-receipt','jobwork-receipt') THEN
    FOR group_line IN SELECT (i->>'source_line_id')::bigint lineid,(i->>'plateid')::bigint plateid,
      max((i->>'qty')::numeric) quantity,sum((i->>'requested_qty')::numeric) requested
      FROM jsonb_array_elements(normalized) i GROUP BY 1,2 LOOP
      IF p_operation='purchase-receipt' THEN
        SELECT coalesce(sum(i.inward_qty),0),coalesce(sum(i.inward_qty) FILTER(WHERE i.purchase_item_id IS NULL),0)
          INTO received,legacy_received FROM public.purchase_inward_items i JOIN public.po_inward h ON h.id=i.inpid
          WHERE i.pid=source_id AND i.plateid=group_line.plateid AND h.status='1' AND (i.purchase_item_id=group_line.lineid OR i.purchase_item_id IS NULL);
        SELECT count(*) INTO source_count FROM public.purchase_items WHERE pid=source_id AND plateid=group_line.plateid;
      ELSE
        SELECT coalesce(sum(i.inward_qty),0),coalesce(sum(i.inward_qty) FILTER(WHERE i.challan_item_id IS NULL),0)
          INTO received,legacy_received FROM public.inward_items i JOIN public.inward h ON h.id=i.inchallanid
          WHERE i.challanid=source_id AND i.plateid=group_line.plateid AND h.status='1' AND (i.challan_item_id=group_line.lineid OR i.challan_item_id IS NULL);
        SELECT count(*) INTO source_count FROM public.challan_items WHERE challanid=source_id AND plateid=group_line.plateid;
      END IF;
      IF source_count>1 AND legacy_received>0 THEN RAISE EXCEPTION 'Legacy receipt source allocation requires review' USING ERRCODE='P0001'; END IF;
      IF received+group_line.requested>group_line.quantity THEN RAISE EXCEPTION 'Receipt exceeds remaining source quantity' USING ERRCODE='P0001'; END IF;
    END LOOP;
  END IF;

  IF p_operation='purchase' THEN
    document_number := public.next_inventory_number('public.purchase','srno','SMPO'||suffix);
    INSERT INTO public.purchase(srno,purchaseid,odate,vname,cname,customer_name,projectid,status,created_by)
      SELECT document_number,coalesce(max(purchaseid),1010)+1,coalesce(nullif(p_body->>'odate','')::date,current_date),vendor_id,customer_id,
        (SELECT customername FROM public.customers WHERE id=customer_id),project_code,'1',actor.name FROM public.purchase
      RETURNING id,to_jsonb(purchase) INTO document_id,header;
    INSERT INTO public.purchase_items(pid,plateid,material,materialtype,qty,rate)
      SELECT document_id,(i->>'plateid')::bigint,coalesce(i->>'material',''),coalesce(i->>'materialtype',''),(i->>'requested_qty')::integer,nullif(i->>'rate','')::numeric FROM jsonb_array_elements(normalized) i;
    UPDATE public.subplate SET order_by=p_actor,order_at=at_time,updated_at=at_time WHERE id IN(SELECT (i->>'plateid')::bigint FROM jsonb_array_elements(normalized) i);
    SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) INTO lines FROM public.purchase_items i WHERE pid=document_id;
  ELSIF p_operation='purchase-receipt' THEN
    document_number := public.next_inventory_number('public.po_inward','insrno','SM/PR/');
    INSERT INTO public.po_inward(pid,insrno,inpono,cname,vname,projectid,odate,status,created_by)
      VALUES(source_id,document_number,p_body->>'inpono',customer_id,vendor_id,project_code,coalesce(nullif(p_body->>'odate','')::date,current_date),'1',p_actor)
      RETURNING id,to_jsonb(po_inward) INTO document_id,header;
    INSERT INTO public.purchase_inward_items(inpid,pid,purchase_item_id,plateid,material,imaterial,materialtype,qty,inward_qty)
      SELECT document_id,source_id,(i->>'source_line_id')::bigint,(i->>'plateid')::bigint,coalesce(i->>'material',''),coalesce(i->>'material',''),coalesce(i->>'materialtype',''),(i->>'qty')::integer,(i->>'requested_qty')::integer FROM jsonb_array_elements(normalized) i;
    UPDATE public.subplate SET received_workby=p_actor,received_work_at=at_time,location='In-House',updated_at=at_time WHERE id IN(SELECT (i->>'plateid')::bigint FROM jsonb_array_elements(normalized) i);
    SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) INTO lines FROM public.purchase_inward_items i WHERE inpid=document_id;
  ELSIF p_operation='challan' THEN
    document_number := coalesce(nullif(trim(p_body->>'challanno'),''),public.next_inventory_number('public.challan','challanno','SMJC'||suffix));
    INSERT INTO public.challan(challanno,customerid,vendorid,vendortid,projectid,chdate,status,created_by)
      VALUES(document_number,customer_id,vendor_id,transport_id,project_code,coalesce(nullif(p_body->>'chdate','')::date,current_date),'1',actor.name)
      RETURNING id,to_jsonb(challan) INTO document_id,header;
    INSERT INTO public.challan_items(challanid,plateid,particulars,customer,project,qty)
      SELECT document_id,(i->>'plateid')::bigint,coalesce(i->>'particulars',i->>'platename','Mould Plate'),customer_id,project_code,(i->>'requested_qty')::integer FROM jsonb_array_elements(normalized) i;
    SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) INTO lines FROM public.challan_items i WHERE challanid=document_id;
  ELSIF p_operation='jobwork-receipt' THEN
    document_number := coalesce(nullif(trim(p_body->>'inchallanno'),''),public.next_inventory_number('public.inward','inchallanno','SMIW'||suffix));
    INSERT INTO public.inward(challanid,inchallanno,customerid,vendorid,vendortid,projectid,chdate,status,created_by)
      VALUES(source_id,document_number,customer_id,vendor_id,transport_id,project_code,coalesce(nullif(p_body->>'chdate','')::date,current_date),'1',p_actor)
      RETURNING id,to_jsonb(inward) INTO document_id,header;
    INSERT INTO public.inward_items(challanid,inchallanid,challan_item_id,plateid,particulars,customer,project,qty,inward_qty,pending_qty)
      SELECT source_id,document_id,(i->>'source_line_id')::bigint,(i->>'plateid')::bigint,coalesce(i->>'particulars','Mould Plate'),customer_id,project_code,(i->>'qty')::integer,(i->>'requested_qty')::integer,0 FROM jsonb_array_elements(normalized) i;
    SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) INTO lines FROM public.inward_items i WHERE inchallanid=document_id;
  ELSE
    document_number := coalesce(nullif(trim(p_body->>'challanno'),''),public.next_inventory_number('public.dispatch','challanno','SMDC'||suffix));
    INSERT INTO public.dispatch(challanno,chdate,customerid,vendortid,projectid,invoiceno,vehicleno,deliverytype,freightmode,freightcharge,noofcases,status,created_by)
      VALUES(document_number,coalesce(nullif(p_body->>'chdate','')::date,current_date),customer_id,transport_id,coalesce(project_code,''),coalesce(nullif(p_body->>'invoiceno',''),'N/A'),coalesce(nullif(p_body->>'vehicleno',''),'N/A'),coalesce(nullif(p_body->>'deliverytype',''),'Door Delivery'),coalesce(nullif(p_body->>'freightmode',''),'To Pay'),coalesce(nullif(p_body->>'freightcharge',''),'N/A'),coalesce(nullif(p_body->>'noofcases',''),'1'),'1',actor.name)
      RETURNING id,to_jsonb(dispatch) INTO document_id,header;
    INSERT INTO public.dispatch_items(dispatchid,plateid,custom_plate_name,custom_plate_qty,customer,project,particulars,condition,work,qty)
      SELECT document_id,(i->>'plateid')::bigint,i->>'custom_plate_name',CASE WHEN i->>'plateid' IS NULL THEN (i->>'requested_qty')::integer ELSE NULL END,customer_id,coalesce(project_code,''),coalesce(i->>'particulars',''),coalesce(i->>'condition',''),coalesce(i->>'work',''),(i->>'requested_qty')::integer FROM jsonb_array_elements(normalized) i;
    
    -- Update subplates based on cumulative delivered quantity vs required sqty
    UPDATE public.subplate sp
      SET location = CASE
            WHEN COALESCE((
              SELECT sum(di.qty)
              FROM public.dispatch_items di
              JOIN public.dispatch d ON d.id = di.dispatchid
              WHERE di.plateid = sp.id AND d.status = '1'
            ), 0) >= sp.sqty THEN 'Customer'
            ELSE 'SM'
          END,
          dispatch_status = CASE
            WHEN COALESCE((
              SELECT sum(di.qty)
              FROM public.dispatch_items di
              JOIN public.dispatch d ON d.id = di.dispatchid
              WHERE di.plateid = sp.id AND d.status = '1'
            ), 0) >= sp.sqty THEN 'dispatched'
            ELSE 'partial'
          END,
          packing_workby = CASE
            WHEN COALESCE((
              SELECT sum(di.qty)
              FROM public.dispatch_items di
              JOIN public.dispatch d ON d.id = di.dispatchid
              WHERE di.plateid = sp.id AND d.status = '1'
            ), 0) >= sp.sqty THEN coalesce(sp.packing_workby, p_actor)
            ELSE sp.packing_workby
          END,
          packing_at = CASE
            WHEN COALESCE((
              SELECT sum(di.qty)
              FROM public.dispatch_items di
              JOIN public.dispatch d ON d.id = di.dispatchid
              WHERE di.plateid = sp.id AND d.status = '1'
            ), 0) >= sp.sqty THEN coalesce(sp.packing_at, at_time)
            ELSE sp.packing_at
          END,
          updated_at = at_time
      WHERE id IN (SELECT (i->>'plateid')::bigint FROM jsonb_array_elements(normalized) i);

    -- Only complete the mould project if EVERY subplate is 100% dispatched and all required stages completed
    UPDATE public.scan sc SET status='completed',dispatchdate=current_date,updated_at=at_time WHERE sc.projectid=project_code
      AND EXISTS(SELECT 1 FROM public.subplate sp WHERE (sp.mold_id=sc.id OR sp.projectid::text=sc.projectid OR sp.mold_code=sc.projectid) AND sp.deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM public.subplate sp WHERE (sp.mold_id=sc.id OR sp.projectid::text=sc.projectid OR sp.mold_code=sc.projectid) AND sp.deleted_at IS NULL AND
        (coalesce(sp.design_by,0)<=0 OR coalesce(sp.order_by,0)<=0 OR coalesce(sp.received_workby,0)<=0 OR coalesce(sp.received_qcby,0)<=0 OR coalesce(sp.vmc_workby,0)<=0 OR coalesce(sp.vmc_qcby,0)<=0 OR coalesce(sp.drilltap_workby,0)<=0 OR coalesce(sp.final_qcby,0)<=0 OR coalesce(sp.packing_workby,0)<=0 OR sp.dispatch_status IS DISTINCT FROM 'dispatched'));
    SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) INTO lines FROM public.dispatch_items i WHERE dispatchid=document_id;
  END IF;

  IF p_operation IN ('challan','jobwork-receipt','dispatch') THEN
    FOR balance IN SELECT plateid,available_sm_qty,active_vendor_initials FROM public.view_subplate_jobwork_balance
      WHERE plateid IN(SELECT (i->>'plateid')::bigint FROM jsonb_array_elements(normalized) i) LOOP
      IF balance.plateid IS NOT NULL THEN
        UPDATE public.subplate SET location=CASE
          WHEN dispatch_status='dispatched' THEN 'Customer'
          WHEN balance.active_vendor_initials IS NULL THEN 'SM'
          WHEN balance.available_sm_qty>0 THEN 'SM, '||balance.active_vendor_initials
          ELSE balance.active_vendor_initials
        END, updated_at=at_time WHERE id=balance.plateid;
      END IF;
    END LOOP;
  END IF;

  -- Atomic photo association (Section 6: F03)
  IF (p_body ? 'photo_ids' OR p_body ? 'photoIds') AND jsonb_typeof(coalesce(p_body->'photo_ids', p_body->'photoIds')) = 'array' THEN
    ev_id := coalesce(p_body->>'eventId', p_body->>'event_id', p_body->>'photoBatchId', 'event_' || p_operation || '_' || document_id::text);
    m_type := CASE
      WHEN p_operation = 'purchase-receipt' THEN 'purchase_inward'
      WHEN p_operation = 'challan' THEN 'jobwork_outward'
      WHEN p_operation = 'jobwork-receipt' THEN 'jobwork_inward'
      WHEN p_operation = 'dispatch' THEN 'dispatch'
      ELSE p_operation
    END;

    FOR p_elem IN SELECT * FROM jsonb_array_elements(coalesce(p_body->'photo_ids', p_body->'photoIds')) LOOP
      p_id := nullif(p_elem#>>'{}', '')::bigint;
      IF p_id IS NOT NULL THEN
        UPDATE public.movement_photos
        SET movement_id = document_id,
            movement_number = document_number,
            updated_at = at_time
        WHERE id = p_id;

        INSERT INTO public.photo_event_associations (photo_id, event_id, movement_type, document_id, document_number)
        VALUES (p_id, ev_id, m_type, document_id, document_number)
        ON CONFLICT (photo_id, event_id) DO UPDATE
          SET document_id = EXCLUDED.document_id,
              document_number = EXCLUDED.document_number;
      END IF;
    END LOOP;
  END IF;

  document_result := header || jsonb_build_object('items',coalesce(lines,'[]'::jsonb));
  UPDATE public.inventory_requests SET result=document_result WHERE actor_id=p_actor AND operation=p_operation AND request_key=p_key;
  RETURN document_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_inventory_document(text,bigint,text,jsonb) FROM PUBLIC, anon, authenticated, app_realtime;
GRANT EXECUTE ON FUNCTION public.create_inventory_document(text,bigint,text,jsonb) TO service_role;

