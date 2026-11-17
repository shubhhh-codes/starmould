-- Canonical receipt links, atomic evidence finalization, and bounded history reads.
BEGIN;

-- Reuse the event associations introduced by the preceding contracts migration.
CREATE INDEX IF NOT EXISTS photo_events_document_photo ON public.photo_event_associations(movement_type,document_id,photo_id) WHERE document_id IS NOT NULL;
GRANT ALL ON public.photo_event_associations TO service_role;
GRANT USAGE ON SEQUENCE public.photo_event_associations_id_seq TO service_role;
ALTER TABLE public.movement_photos ADD COLUMN IF NOT EXISTS claim_batch_id text;

-- Only exact, existing IDs can be recovered automatically. No vendor/date guessing.
INSERT INTO public.photo_event_associations(photo_id,event_id,movement_type,document_id)
SELECT p.id,p.movement_type||':'||p.movement_id,p.movement_type,p.movement_id FROM public.movement_photos p
WHERE (p.movement_type='purchase_inward' AND EXISTS(SELECT 1 FROM public.po_inward d WHERE d.id=p.movement_id AND d.insrno=p.movement_number))
   OR (p.movement_type='jobwork_outward' AND EXISTS(SELECT 1 FROM public.challan d WHERE d.id=p.movement_id AND d.challanno=p.movement_number))
   OR (p.movement_type='jobwork_inward' AND EXISTS(SELECT 1 FROM public.inward d WHERE d.id=p.movement_id AND d.inchallanno=p.movement_number))
   OR (p.movement_type='dispatch' AND EXISTS(SELECT 1 FROM public.dispatch d WHERE d.id=p.movement_id AND d.challanno=p.movement_number))
ON CONFLICT DO NOTHING;

-- Preserve the verified source-line/partial-quantity inventory implementation unchanged.
-- The earlier photo RPC draft removed source-line guards; do not inherit that regression.
CREATE OR REPLACE FUNCTION public.create_inventory_document_before_photo_history(p_operation text, p_actor bigint, p_key text, p_body jsonb)
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
    IF p_operation IN ('purchase-receipt','jobwork-receipt') THEN
      IF plate_id IS NOT NULL AND plate_id<>(source_line->>'plateid')::bigint THEN
        RAISE EXCEPTION 'Receipt plate does not match source line' USING ERRCODE='22023';
      END IF;
      plate_id := (source_line->>'plateid')::bigint;
      item := item || jsonb_build_object('source_line_id',source_line_id,'plateid',plate_id,
        'qty',source_line->'qty','material',source_line->'material','materialtype',source_line->'materialtype','particulars',source_line->'particulars');
    END IF;
    IF plate_id IS NULL AND NOT (p_operation='dispatch' AND length(trim(coalesce(item->>'custom_plate_name','')))>0) THEN
      RAISE EXCEPTION 'Inventory plate identity required' USING ERRCODE='22023';
    END IF;
    IF plate_id IS NOT NULL AND plate_id<=0 THEN RAISE EXCEPTION 'Invalid plate identity' USING ERRCODE='22023'; END IF;
    IF p_operation='purchase' AND nullif(item->>'rate','') IS NOT NULL AND
      ((item->>'rate')::numeric<0 OR (item->>'rate')::numeric::text IN ('NaN','Infinity','-Infinity')) THEN
      RAISE EXCEPTION 'Invalid purchase rate' USING ERRCODE='22023';
    END IF;
    normalized := normalized || jsonb_build_array(item || jsonb_build_object('plateid',plate_id,'requested_qty',quantity));
  END LOOP;

  PERFORM id FROM public.subplate WHERE id IN (SELECT (i->>'plateid')::bigint FROM jsonb_array_elements(normalized) i) ORDER BY id FOR UPDATE;
  FOR group_line IN SELECT (i->>'plateid')::bigint plateid,sum((i->>'requested_qty')::numeric) quantity
    FROM jsonb_array_elements(normalized) i WHERE i->>'plateid' IS NOT NULL GROUP BY 1 ORDER BY 1 LOOP
    SELECT * INTO plate_record FROM public.subplate WHERE id=group_line.plateid AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active inventory plate required' USING ERRCODE='22023'; END IF;
    SELECT sc.* INTO project_record FROM public.scan sc WHERE sc.id=plate_record.mold_id OR
      (plate_record.mold_id IS NULL AND (sc.projectid=plate_record.projectid::text OR sc.id::text=plate_record.projectid::text OR sc.projectid=plate_record.mold_code))
      ORDER BY (sc.id=plate_record.mold_id) DESC LIMIT 1;
    IF NOT FOUND OR to_jsonb(project_record)->>'deleted_at' IS NOT NULL OR
      NOT (coalesce(project_code,'') IN (project_record.projectid,project_record.id::text)) OR
      customer_id::text IS DISTINCT FROM coalesce(to_jsonb(project_record)->>'customer_id',CASE WHEN project_record.cname::text ~ '^[0-9]+$' THEN project_record.cname::text END) THEN
      RAISE EXCEPTION 'Plate, project and customer do not match' USING ERRCODE='22023';
    END IF;
    project_code := project_record.projectid;
    IF p_operation='purchase' THEN
      SELECT coalesce(sum(pi.qty),0) INTO ordered FROM public.purchase_items pi JOIN public.purchase h ON h.id=pi.pid WHERE pi.plateid=plate_record.id AND h.status='1';
      IF group_line.quantity+ordered>plate_record.sqty THEN RAISE EXCEPTION 'Purchase exceeds remaining required quantity' USING ERRCODE='P0001'; END IF;
    ELSIF p_operation IN ('challan','dispatch') AND group_line.quantity>public.inventory_available_quantity(plate_record.id) THEN
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

  document_result := header || jsonb_build_object('items',coalesce(lines,'[]'::jsonb));
  UPDATE public.inventory_requests SET result=document_result WHERE actor_id=p_actor AND operation=p_operation AND request_key=p_key;
  RETURN document_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_inventory_document_before_photo_history(text,bigint,text,jsonb) FROM PUBLIC, anon, authenticated, app_realtime;

REVOKE ALL ON FUNCTION public.create_inventory_document_before_photo_history(text,bigint,text,jsonb) FROM service_role;

CREATE OR REPLACE FUNCTION public.create_inventory_document(p_operation text,p_actor bigint,p_key text,p_body jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  prior public.inventory_requests;
  result jsonb;
  photo_type text;
  ids bigint[];
  locked_photo record;
  batch text := p_body->>'photoBatchId';
  matched integer := 0;
  codes text[];
BEGIN
  -- Same lock used by the original inventory RPC; protects replay and evidence claims together.
  PERFORM pg_advisory_xact_lock(714203,1);
  SELECT * INTO prior FROM public.inventory_requests WHERE actor_id=p_actor AND operation=p_operation AND request_key=p_key FOR UPDATE;
  IF prior.result IS NOT NULL THEN
    IF prior.request_payload IS DISTINCT FROM p_body THEN RAISE EXCEPTION 'Idempotency-Key already used with different payload' USING ERRCODE='P0001'; END IF;
    RETURN prior.result;
  END IF;
  photo_type := CASE p_operation WHEN 'purchase-receipt' THEN 'purchase_inward' WHEN 'challan' THEN 'jobwork_outward'
    WHEN 'jobwork-receipt' THEN 'jobwork_inward' WHEN 'dispatch' THEN 'dispatch' ELSE NULL END;
  IF photo_type IS NOT NULL THEN
    IF jsonb_typeof(p_body->'photoIds') IS DISTINCT FROM 'array' OR batch IS NULL OR batch !~ '^[a-zA-Z0-9_-]{8,128}$' THEN
      RAISE EXCEPTION 'Upload at least one photo before saving this movement' USING ERRCODE='22023';
    END IF;
    SELECT array_agg(DISTINCT value::bigint) INTO ids FROM jsonb_array_elements_text(p_body->'photoIds');
    IF coalesce(cardinality(ids),0)=0 OR array_position(ids,NULL) IS NOT NULL THEN
      RAISE EXCEPTION 'At least one valid photo is required' USING ERRCODE='22023';
    END IF;
    FOR locked_photo IN SELECT * FROM public.movement_photos WHERE id=ANY(ids) ORDER BY id FOR UPDATE LOOP
      IF locked_photo.uploaded_by<>p_actor OR locked_photo.deleted_at IS NOT NULL OR locked_photo.movement_type<>photo_type
        OR (locked_photo.claim_batch_id IS NOT NULL AND locked_photo.claim_batch_id<>batch)
        OR (locked_photo.claim_batch_id IS NULL AND EXISTS(SELECT 1 FROM public.photo_event_associations l WHERE l.photo_id=locked_photo.id AND l.document_id IS NOT NULL)) THEN
        RAISE EXCEPTION 'Photo does not belong to this movement draft' USING ERRCODE='22023';
      END IF;
      matched := matched+1;
    END LOOP;
    IF matched<>cardinality(ids) THEN RAISE EXCEPTION 'Photo evidence unavailable' USING ERRCODE='22023'; END IF;
  END IF;

  result := public.create_inventory_document_before_photo_history(p_operation,p_actor,p_key,p_body);
  IF photo_type IS NOT NULL THEN
    INSERT INTO public.photo_event_associations(photo_id,event_id,movement_type,document_id,document_number)
      SELECT unnest(ids),photo_type||':'||(result->>'id'),photo_type,(result->>'id')::bigint,
        coalesce(result->>'insrno',result->>'inchallanno',result->>'challanno') ON CONFLICT DO NOTHING;
    UPDATE public.movement_photos SET claim_batch_id=batch,
      movement_id=coalesce(movement_id,(result->>'id')::bigint),
      movement_number=coalesce(result->>'insrno',result->>'inchallanno',result->>'challanno'),updated_at=now()
      WHERE id=ANY(ids);
    -- Derive project associations from the actual source items and returned document, not browser labels.
    SELECT array_agg(DISTINCT code) INTO codes FROM (
      SELECT result->>'projectid' AS code
      UNION SELECT s.projectid FROM public.subplate s WHERE s.id IN
        (SELECT nullif(i->>'plateid','')::bigint FROM jsonb_array_elements(coalesce(result->'items','[]'::jsonb)) i)
    ) c WHERE coalesce(code,'')<>'';
    INSERT INTO public.photo_project_associations(photo_id,project_id,project_code,mould_code)
      SELECT photo_id,s.id,code,code FROM unnest(ids) photo_id CROSS JOIN unnest(codes) code
      LEFT JOIN public.scan s ON s.projectid=code
      ON CONFLICT(photo_id,project_code) DO UPDATE SET project_id=coalesce(EXCLUDED.project_id,photo_project_associations.project_id);
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.create_inventory_document(text,bigint,text,jsonb) FROM PUBLIC,anon,authenticated,app_realtime;
GRANT EXECUTE ON FUNCTION public.create_inventory_document(text,bigint,text,jsonb) TO service_role;

-- One relational scope definition powers both counts and the gallery.
CREATE FUNCTION public.photo_history_groups(p_scope jsonb,p_children boolean DEFAULT true)
RETURNS TABLE(group_id text,title text,event_date text,party text,movement_type text,document_id bigint,subplate_id bigint,stage_key text,sort_order integer)
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT 'purchase_inward:'||d.id,d.insrno::text,d.odate::text,v.vendor_name::text,'purchase_inward',d.id::bigint,NULL::bigint,NULL::text,1
  FROM public.po_inward d LEFT JOIN public.vendors v ON v.id=d.vname
  WHERE (p_scope->>'kind'='purchase_receipt' AND d.id=(p_scope->>'id')::bigint)
     OR (p_scope->>'kind'='purchase_order' AND p_children AND d.pid=(p_scope->>'id')::bigint)
  UNION ALL
  SELECT 'jobwork_outward:'||d.id,'Sent: '||d.challanno,d.chdate::text,v.vendor_name::text,'jobwork_outward',d.id::bigint,NULL::bigint,NULL::text,0
  FROM public.challan d LEFT JOIN public.vendors v ON v.id=d.vendorid WHERE p_scope->>'kind'='jobwork_outward' AND d.id=(p_scope->>'id')::bigint
  UNION ALL
  SELECT 'jobwork_inward:'||d.id,'Return: '||d.inchallanno,d.chdate::text,v.vendor_name::text,'jobwork_inward',d.id::bigint,NULL::bigint,NULL::text,1
  FROM public.inward d LEFT JOIN public.vendors v ON v.id=d.vendorid
  WHERE (p_scope->>'kind'='jobwork_receipt' AND d.id=(p_scope->>'id')::bigint)
     OR (p_scope->>'kind'='jobwork_outward' AND p_children AND d.challanid=(p_scope->>'id')::bigint)
  UNION ALL
  SELECT 'dispatch:'||d.id,d.challanno,d.chdate::text,c.customername::text,'dispatch',d.id::bigint,NULL::bigint,NULL::text,1
  FROM public.dispatch d LEFT JOIN public.customers c ON c.id=d.customerid WHERE p_scope->>'kind'='dispatch' AND d.id=(p_scope->>'id')::bigint
  UNION ALL
  SELECT 'stage:'||s.id||':'||(p_scope->>'stageKey'),
    (CASE p_scope->>'stageKey' WHEN 'vmc_qcby' THEN 'VMC QC' WHEN 'final_qcby' THEN 'Final QC' ELSE 'Packing' END)||' · '||s.platename,
    NULL::text,NULL::text,CASE WHEN p_scope->>'stageKey'='packing_workby' THEN 'packing' ELSE 'subplate_qc' END,
    NULL::bigint,s.id::bigint,p_scope->>'stageKey',1
  FROM public.subplate s WHERE p_scope->>'kind'='stage' AND s.id=(p_scope->>'id')::bigint;
$$;

CREATE FUNCTION public.photo_history_rows(p_scope jsonb,p_children boolean DEFAULT true)
RETURNS TABLE(group_id text,photo_id bigint) LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT DISTINCT g.group_id,p.id
  FROM public.photo_history_groups(p_scope,p_children) g JOIN public.movement_photos p ON
    (g.subplate_id IS NOT NULL AND p.subplate_id=g.subplate_id AND p.stage_key=g.stage_key AND p.movement_type=g.movement_type)
    OR (g.document_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.photo_event_associations l
      WHERE l.photo_id=p.id AND l.movement_type=g.movement_type AND l.document_id=g.document_id));
$$;

CREATE FUNCTION public.photo_history_summary(p_scopes jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('key',entry->>'key','summary',summary)),'[]'::jsonb)
  FROM jsonb_array_elements(p_scopes) entry CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'availableCount',count(DISTINCT p.id) FILTER(WHERE p.deleted_at IS NULL),
      'expiredCount',count(DISTINCT p.id) FILTER(WHERE p.deleted_at IS NOT NULL AND p.deletion_reason ILIKE '%retention%'),
      'removedCount',count(DISTINCT p.id) FILTER(WHERE p.deleted_at IS NOT NULL AND coalesce(p.deletion_reason,'') NOT ILIKE '%retention%')) AS summary
    FROM public.photo_history_rows(entry->'scope',coalesce((entry->>'includeChildren')::boolean,true)) r
    JOIN public.movement_photos p ON p.id=r.photo_id
  ) totals;
$$;

CREATE FUNCTION public.photo_history_page(p_scope jsonb,p_children boolean DEFAULT true,p_group_offset integer DEFAULT 0,p_group_id text DEFAULT NULL,p_photo_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
WITH groups AS MATERIALIZED (SELECT * FROM public.photo_history_groups(p_scope,p_children)),
rows AS MATERIALIZED (SELECT r.*,p.deleted_at,p.deletion_reason FROM public.photo_history_rows(p_scope,p_children) r JOIN public.movement_photos p ON p.id=r.photo_id),
page AS (SELECT * FROM groups WHERE p_group_id IS NULL OR group_id=p_group_id
  ORDER BY sort_order,event_date DESC NULLS LAST,group_id OFFSET greatest(p_group_offset,0) LIMIT 20)
SELECT jsonb_build_object(
  'title',CASE p_scope->>'kind'
    WHEN 'purchase_order' THEN coalesce((SELECT 'Purchase order · '||srno FROM public.purchase WHERE id=(p_scope->>'id')::bigint),'Purchase order')
    WHEN 'purchase_receipt' THEN 'Purchase inward photos' WHEN 'jobwork_outward' THEN 'Jobwork outward and returns'
    WHEN 'jobwork_receipt' THEN 'Jobwork inward photos' WHEN 'dispatch' THEN 'Dispatch photos' ELSE 'Stage photos' END,
  'summary',(SELECT summary FROM jsonb_to_recordset(public.photo_history_summary(jsonb_build_array(jsonb_build_object('key','scope','scope',p_scope,'includeChildren',p_children)))) x(key text,summary jsonb)),
  'nextGroupOffset',CASE WHEN p_group_id IS NULL AND (SELECT count(*) FROM groups)>p_group_offset+20 THEN p_group_offset+20 ELSE NULL END,
  'groups',coalesce((SELECT jsonb_agg(jsonb_build_object('id',g.group_id,'title',g.title,'eventDate',g.event_date,'party',g.party,
    'availableCount',(SELECT count(*) FROM rows r WHERE r.group_id=g.group_id AND r.deleted_at IS NULL),
    'expiredCount',(SELECT count(*) FROM rows r WHERE r.group_id=g.group_id AND r.deleted_at IS NOT NULL AND r.deletion_reason ILIKE '%retention%'),
    'removedCount',(SELECT count(*) FROM rows r WHERE r.group_id=g.group_id AND r.deleted_at IS NOT NULL AND coalesce(r.deletion_reason,'') NOT ILIKE '%retention%'),
    'nextPhotoOffset',CASE WHEN (SELECT count(*) FROM rows r WHERE r.group_id=g.group_id AND r.deleted_at IS NULL)>p_photo_offset+24 THEN p_photo_offset+24 ELSE NULL END,
    'photos',(SELECT coalesce(jsonb_agg(to_jsonb(items) ORDER BY items.server_uploaded_at,items.id),'[]'::jsonb) FROM (
      SELECT p.id,p.original_filename,p.server_uploaded_at,coalesce(u.name,'Unknown user') AS uploader_name,p.width,p.height
      FROM rows r JOIN public.movement_photos p ON p.id=r.photo_id LEFT JOIN public.users u ON u.id=p.uploaded_by
      WHERE r.group_id=g.group_id AND r.deleted_at IS NULL ORDER BY p.server_uploaded_at,p.id OFFSET greatest(p_photo_offset,0) LIMIT 24
    ) items)) ORDER BY g.sort_order,g.event_date DESC NULLS LAST,g.group_id) FROM page g),'[]'::jsonb));
$$;

REVOKE ALL ON FUNCTION public.photo_history_groups(jsonb,boolean),public.photo_history_rows(jsonb,boolean),public.photo_history_summary(jsonb),public.photo_history_page(jsonb,boolean,integer,text,integer) FROM PUBLIC,anon,authenticated,app_realtime;
GRANT EXECUTE ON FUNCTION public.photo_history_groups(jsonb,boolean),public.photo_history_rows(jsonb,boolean),public.photo_history_summary(jsonb),public.photo_history_page(jsonb,boolean,integer,text,integer) TO service_role;
CREATE TABLE public.photo_history_recovery_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  photo_id bigint NOT NULL REFERENCES public.movement_photos(id),
  actor_id bigint NOT NULL REFERENCES public.users(id), document_ids bigint[] NOT NULL, reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.photo_history_recovery_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.photo_history_recovery_log TO service_role;
GRANT USAGE ON SEQUENCE public.photo_history_recovery_log_id_seq TO service_role;
CREATE FUNCTION public.photo_history_unlinked(p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
WITH candidates AS MATERIALIZED (
  SELECT p.id,p.movement_type,p.movement_number,p.party_name,p.server_uploaded_at,p.original_filename,
    coalesce(u.name,'Unknown user') AS uploader_name,p.width,p.height
  FROM public.movement_photos p LEFT JOIN public.users u ON u.id=p.uploaded_by
  WHERE p.deleted_at IS NULL AND p.movement_type IN ('purchase_inward','jobwork_outward','jobwork_inward','dispatch')
    AND NOT EXISTS(SELECT 1 FROM public.photo_event_associations l WHERE l.photo_id=p.id AND l.document_id IS NOT NULL)
), page AS (SELECT * FROM candidates ORDER BY server_uploaded_at DESC,id DESC OFFSET greatest(p_offset,0) LIMIT 20)
SELECT jsonb_build_object('photos',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page p),'[]'::jsonb),'total',(SELECT count(*) FROM candidates),
  'nextOffset',CASE WHEN (SELECT count(*) FROM candidates)>p_offset+20 THEN p_offset+20 ELSE NULL END);
$$;
CREATE FUNCTION public.photo_history_recover(p_photo bigint,p_documents bigint[],p_actor bigint,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE photo public.movement_photos; doc jsonb; target bigint; code text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_actor AND role_id=0 AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  IF coalesce(cardinality(p_documents),0) NOT BETWEEN 1 AND 20 OR coalesce(length(trim(p_reason)),0)<5 THEN RAISE EXCEPTION 'Select records and provide a recovery reason' USING ERRCODE='22023'; END IF;
  SELECT * INTO photo FROM public.movement_photos WHERE id=p_photo FOR UPDATE;
  IF NOT FOUND OR photo.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Photo unavailable' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.photo_event_associations WHERE photo_id=p_photo AND document_id IS NOT NULL) THEN RAISE EXCEPTION 'Photo already linked; refresh recovery list' USING ERRCODE='22023'; END IF;
  FOREACH target IN ARRAY p_documents LOOP
    doc := NULL;
    IF photo.movement_type='purchase_inward' THEN SELECT to_jsonb(d) INTO doc FROM public.po_inward d WHERE id=target;
    ELSIF photo.movement_type='jobwork_outward' THEN SELECT to_jsonb(d) INTO doc FROM public.challan d WHERE id=target;
    ELSIF photo.movement_type='jobwork_inward' THEN SELECT to_jsonb(d) INTO doc FROM public.inward d WHERE id=target;
    ELSIF photo.movement_type='dispatch' THEN SELECT to_jsonb(d) INTO doc FROM public.dispatch d WHERE id=target; END IF;
    IF doc IS NULL THEN RAISE EXCEPTION 'Target record unavailable' USING ERRCODE='22023'; END IF;
    INSERT INTO public.photo_event_associations(photo_id,event_id,movement_type,document_id,document_number)
      VALUES(p_photo,photo.movement_type||':'||target,photo.movement_type,target,coalesce(doc->>'insrno',doc->>'inchallanno',doc->>'challanno')) ON CONFLICT DO NOTHING;
    code := doc->>'projectid';
    IF coalesce(code,'')<>'' THEN
      INSERT INTO public.photo_project_associations(photo_id,project_id,project_code,mould_code)
        SELECT p_photo,s.id,code,code FROM (VALUES(1)) dummy(n) LEFT JOIN public.scan s ON s.projectid=code
        ON CONFLICT(photo_id,project_code) DO UPDATE SET project_id=coalesce(EXCLUDED.project_id,photo_project_associations.project_id);
    END IF;
  END LOOP;
  INSERT INTO public.photo_history_recovery_log(photo_id,actor_id,document_ids,reason) VALUES(p_photo,p_actor,p_documents,p_reason);
END $$;
REVOKE ALL ON FUNCTION public.photo_history_unlinked(integer),public.photo_history_recover(bigint,bigint[],bigint,text) FROM PUBLIC,anon,authenticated,app_realtime;
GRANT EXECUTE ON FUNCTION public.photo_history_unlinked(integer),public.photo_history_recover(bigint,bigint[],bigint,text) TO service_role;
COMMIT;
