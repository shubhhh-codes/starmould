CREATE OR REPLACE FUNCTION public.replace_purchase_document(p_id bigint, p_header jsonb, p_items jsonb, p_actor bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  saved jsonb;
  lines jsonb;
  old_plates bigint[];
  plate record;
  requested numeric;
  already_ordered numeric;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Purchase requires items'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) item WHERE
    item->>'plateid' IS NULL OR item->>'qty' IS NULL OR
    (item->>'qty')::numeric <= 0 OR (item->>'qty')::numeric <> trunc((item->>'qty')::numeric) OR
    ((item->>'rate') IS NOT NULL AND ((item->>'rate')::numeric < 0 OR (item->>'rate')::numeric = 'NaN'::numeric))) THEN
    RAISE EXCEPTION 'Invalid purchase line';
  END IF;
  PERFORM 1 FROM public.purchase WHERE id = p_id AND status <> '0' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active purchase not found'; END IF;
  SELECT array_agg(plateid) INTO old_plates FROM public.purchase_items WHERE pid = p_id;
  -- Lock all affected inventory rows in a consistent order before checking balances.
  PERFORM id FROM public.subplate WHERE id = ANY(COALESCE(old_plates, '{}'::bigint[])) OR
    id IN (SELECT (item->>'plateid')::bigint FROM jsonb_array_elements(p_items) item) ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) item WHERE NOT EXISTS
    (SELECT 1 FROM public.subplate sp WHERE sp.id = (item->>'plateid')::bigint AND sp.deleted_at IS NULL)) THEN RAISE EXCEPTION 'Invalid plate'; END IF;
  FOR plate IN SELECT (item->>'plateid')::bigint id, sum((item->>'qty')::numeric) quantity
    FROM jsonb_array_elements(p_items) item GROUP BY 1 LOOP
    SELECT sqty INTO requested FROM public.subplate WHERE id = plate.id;
    SELECT COALESCE(sum(pi.qty),0) INTO already_ordered FROM public.purchase_items pi
      JOIN public.purchase po ON po.id = pi.pid WHERE pi.plateid = plate.id AND po.status <> '0' AND po.id <> p_id;
    IF plate.quantity + already_ordered > requested THEN RAISE EXCEPTION 'Purchase exceeds remaining plate quantity'; END IF;
  END LOOP;
  -- Existing receipts retain their source-line identities. Editing a received PO needs a dedicated reconciliation workflow.
  IF EXISTS (SELECT 1 FROM public.purchase_inward_items pi JOIN public.po_inward r ON r.id = pi.inpid
    WHERE pi.pid = p_id AND r.status <> '0') THEN RAISE EXCEPTION 'Received purchase cannot be replaced'; END IF;
  UPDATE public.purchase SET odate = (p_header->>'odate')::date, vname = (p_header->>'vname')::bigint,
    cname = (p_header->>'cname')::bigint, projectid = p_header->>'projectid', updated_at = now()
    WHERE id = p_id RETURNING to_jsonb(purchase) INTO saved;
  DELETE FROM public.purchase_items WHERE pid = p_id;
  INSERT INTO public.purchase_items(pid, plateid, material, materialtype, qty, rate, created_at, updated_at)
    SELECT p_id, (item->>'plateid')::bigint, COALESCE(item->>'material',''), COALESCE(item->>'materialtype',''),
      (item->>'qty')::numeric, NULLIF(item->>'rate','')::numeric, now(), now() FROM jsonb_array_elements(p_items) item;
  UPDATE public.subplate sp SET order_by = NULL, order_at = NULL, updated_at = now()
    WHERE sp.id = ANY(old_plates) AND NOT EXISTS (SELECT 1 FROM public.purchase_items pi JOIN public.purchase po
      ON po.id = pi.pid WHERE pi.plateid = sp.id AND po.status <> '0');
  UPDATE public.subplate SET order_by = p_actor, order_at = now(), updated_at = now()
    WHERE id IN (SELECT (item->>'plateid')::bigint FROM jsonb_array_elements(p_items) item);
  SELECT COALESCE(jsonb_agg(to_jsonb(pi) ORDER BY pi.id),'[]'::jsonb) INTO lines FROM public.purchase_items pi WHERE pi.pid = p_id;
  RETURN saved || jsonb_build_object('items',lines);
END;
$$;
REVOKE ALL ON FUNCTION public.replace_purchase_document(bigint,jsonb,jsonb,bigint) FROM PUBLIC, anon, authenticated, app_realtime;
GRANT EXECUTE ON FUNCTION public.replace_purchase_document(bigint,jsonb,jsonb,bigint) TO service_role;
