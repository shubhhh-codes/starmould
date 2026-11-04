-- Additive only: historical receipts remain unchanged. New receipts record their exact source line.
ALTER TABLE public.purchase_inward_items ADD COLUMN IF NOT EXISTS purchase_item_id bigint;
ALTER TABLE public.inward_items ADD COLUMN IF NOT EXISTS challan_item_id bigint;
ALTER TABLE public.purchase_inward_items ADD CONSTRAINT purchase_receipt_source_line_fk
  FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_items(id) NOT VALID;
ALTER TABLE public.inward_items ADD CONSTRAINT jobwork_receipt_source_line_fk
  FOREIGN KEY (challan_item_id) REFERENCES public.challan_items(id) NOT VALID;
CREATE INDEX IF NOT EXISTS purchase_receipt_source_line_idx ON public.purchase_inward_items(purchase_item_id);
CREATE INDEX IF NOT EXISTS jobwork_receipt_source_line_idx ON public.inward_items(challan_item_id);

CREATE TABLE public.inventory_requests (
  actor_id bigint NOT NULL,
  operation text NOT NULL,
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 8 AND 128),
  request_payload jsonb NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id, operation, request_key)
);
ALTER TABLE public.inventory_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_requests FROM PUBLIC, anon, authenticated, app_realtime;
GRANT ALL ON public.inventory_requests TO service_role;

-- All inventory writers take this mutex before touching document/plate rows. This conservative
-- first implementation serializes inventory writes; plate locks still follow ascending ID order.
CREATE FUNCTION public.lock_inventory_writer() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(714203, 1);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_inventory_writer() FROM PUBLIC, anon, authenticated, app_realtime;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase','purchase_items','po_inward','purchase_inward_items',
    'challan','challan_items','inward','inward_items','dispatch','dispatch_items','subplate'] LOOP
    EXECUTE format('CREATE TRIGGER inventory_writer_mutex BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lock_inventory_writer()', t);
  END LOOP;
END;
$$;

CREATE FUNCTION public.next_inventory_number(p_table regclass, p_column text, p_prefix text) RETURNS text
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE sequence_number bigint;
BEGIN
  IF p_table NOT IN ('public.purchase'::regclass, 'public.po_inward'::regclass, 'public.challan'::regclass,
    'public.inward'::regclass, 'public.dispatch'::regclass) OR p_column NOT IN ('srno','insrno','challanno','inchallanno') THEN
    RAISE EXCEPTION 'Invalid document numbering target' USING ERRCODE = '22023';
  END IF;
  -- Called under the inventory mutex. Prefixes are server-owned and contain no regex operators.
  EXECUTE format('SELECT coalesce(max(substring(%I from $2)::bigint),0)+1 FROM %s WHERE %I ~ $1', p_column, p_table, p_column)
    INTO sequence_number USING '^' || p_prefix || '[0-9]+$', length(p_prefix)+1;
  RETURN p_prefix || lpad(sequence_number::text, greatest(3,length(sequence_number::text)), '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_inventory_number(regclass,text,text) FROM PUBLIC, anon, authenticated, app_realtime;

-- Aggregate outward lines BEFORE subtracting returns, including legacy duplicate-plate lines.
CREATE FUNCTION public.inventory_available_quantity(p_plate bigint) RETURNS numeric
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT
    coalesce((SELECT sum(i.inward_qty) FROM public.purchase_inward_items i JOIN public.po_inward h ON h.id=i.inpid
      WHERE i.plateid=p_plate AND h.status='1'),0)
    - coalesce((SELECT sum(greatest(0,o.quantity-coalesce(r.quantity,0))) FROM
      (SELECT ci.challanid,sum(ci.qty) quantity FROM public.challan_items ci JOIN public.challan c ON c.id=ci.challanid
        WHERE ci.plateid=p_plate AND c.status='1' GROUP BY ci.challanid) o
      LEFT JOIN (SELECT ii.challanid,sum(ii.inward_qty) quantity FROM public.inward_items ii JOIN public.inward h ON h.id=ii.inchallanid
        WHERE ii.plateid=p_plate AND h.status='1' GROUP BY ii.challanid) r ON r.challanid=o.challanid),0)
    - coalesce((SELECT sum(di.qty) FROM public.dispatch_items di JOIN public.dispatch d ON d.id=di.dispatchid
      WHERE di.plateid=p_plate AND d.status='1'),0);
$$;
REVOKE ALL ON FUNCTION public.inventory_available_quantity(bigint) FROM PUBLIC, anon, authenticated, app_realtime;

CREATE FUNCTION public.create_inventory_document(p_operation text, p_actor bigint, p_key text, p_body jsonb)
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
    UPDATE public.subplate SET location='Customer',dispatch_status='dispatched',packing_workby=p_actor,packing_at=at_time,updated_at=at_time WHERE id IN(SELECT (i->>'plateid')::bigint FROM jsonb_array_elements(normalized) i);
    -- Preserve project completion behavior; every required stage must be assigned.
    UPDATE public.scan sc SET status='completed',dispatchdate=current_date,updated_at=at_time WHERE sc.projectid=project_code
      AND EXISTS(SELECT 1 FROM public.subplate sp WHERE (sp.mold_id=sc.id OR sp.projectid::text=sc.projectid OR sp.mold_code=sc.projectid) AND sp.deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM public.subplate sp WHERE (sp.mold_id=sc.id OR sp.projectid::text=sc.projectid OR sp.mold_code=sc.projectid) AND sp.deleted_at IS NULL AND
        (coalesce(sp.design_by,0)<=0 OR coalesce(sp.order_by,0)<=0 OR coalesce(sp.received_workby,0)<=0 OR coalesce(sp.received_qcby,0)<=0 OR coalesce(sp.vmc_workby,0)<=0 OR coalesce(sp.vmc_qcby,0)<=0 OR coalesce(sp.drilltap_workby,0)<=0 OR coalesce(sp.final_qcby,0)<=0 OR coalesce(sp.packing_workby,0)<=0));
    SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) INTO lines FROM public.dispatch_items i WHERE dispatchid=document_id;
  END IF;

  IF p_operation IN ('challan','jobwork-receipt') THEN
    FOR balance IN SELECT plateid,available_sm_qty,active_vendor_initials FROM public.view_subplate_jobwork_balance
      WHERE plateid IN(SELECT (i->>'plateid')::bigint FROM jsonb_array_elements(normalized) i) LOOP
      UPDATE public.subplate SET location=CASE WHEN balance.active_vendor_initials IS NULL THEN 'SM' WHEN balance.available_sm_qty>0 THEN 'SM, '||balance.active_vendor_initials ELSE balance.active_vendor_initials END,updated_at=at_time WHERE id=balance.plateid;
    END LOOP;
  END IF;
  document_result := header || jsonb_build_object('items',coalesce(lines,'[]'::jsonb));
  UPDATE public.inventory_requests SET result=document_result WHERE actor_id=p_actor AND operation=p_operation AND request_key=p_key;
  RETURN document_result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_inventory_document(text,bigint,text,jsonb) FROM PUBLIC, anon, authenticated, app_realtime;
GRANT EXECUTE ON FUNCTION public.create_inventory_document(text,bigint,text,jsonb) TO service_role;

-- The edit RPC must acquire the same lock BEFORE its initial header/plate row locks.
ALTER FUNCTION public.replace_purchase_document(bigint,jsonb,jsonb,bigint) RENAME TO replace_purchase_document_v1;
CREATE FUNCTION public.replace_purchase_document(p_id bigint,p_header jsonb,p_items jsonb,p_actor bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(714203,1);
  RETURN public.replace_purchase_document_v1(p_id,p_header,p_items,p_actor);
END;
$$;
REVOKE ALL ON FUNCTION public.replace_purchase_document(bigint,jsonb,jsonb,bigint) FROM PUBLIC, anon, authenticated, app_realtime;
GRANT EXECUTE ON FUNCTION public.replace_purchase_document(bigint,jsonb,jsonb,bigint) TO service_role;
