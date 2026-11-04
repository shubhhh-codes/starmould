CREATE OR REPLACE FUNCTION public.replace_quotation_document(p_id bigint, p_header jsonb, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  original jsonb;
  saved jsonb;
  lines jsonb;
  assignments text;
BEGIN
  SELECT to_jsonb(q) INTO original FROM public.quotations q WHERE q.id = p_id AND q.deleted_at IS NULL FOR UPDATE;
  IF original IS NULL THEN RAISE EXCEPTION 'Quotation not found'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Quotation requires items';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) item WHERE
    (item->>'qty')::numeric <= 0 OR (item->>'qty')::numeric <> trunc((item->>'qty')::numeric) OR
    (item->>'unit_price')::numeric < 0 OR
    round((item->>'qty')::numeric * (item->>'unit_price')::numeric, 2) <> (item->>'total_amount')::numeric) THEN
    RAISE EXCEPTION 'Invalid quotation line';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_header) key WHERE key IN ('id', 'created_at', 'created_by', 'deleted_at') OR
    NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.quotations'::regclass AND attname = key AND attnum > 0 AND NOT attisdropped)) THEN
    RAISE EXCEPTION 'Invalid quotation header field';
  END IF;
  SELECT string_agg(format('%I = incoming.%I', key, key), ', ') INTO assignments FROM jsonb_object_keys(p_header) key;
  IF assignments IS NULL THEN RAISE EXCEPTION 'Quotation header required'; END IF;
  EXECUTE format('UPDATE public.quotations q SET %s FROM jsonb_populate_record(NULL::public.quotations, $1) incoming WHERE q.id = $2 RETURNING to_jsonb(q)', assignments)
    INTO saved USING original || p_header, p_id;
  DELETE FROM public.quotation_items WHERE quotation_id = p_id;
  INSERT INTO public.quotation_items(quotation_id, sr_no, product_name, description, product_description, qty, unit, unit_price, total_amount)
    SELECT p_id, ordinal::integer, item->>'product_name', item->>'description', item->>'product_description',
      (item->>'qty')::numeric, COALESCE(item->>'unit', 'Nos'), (item->>'unit_price')::numeric, (item->>'total_amount')::numeric
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS entry(item, ordinal);
  SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.sr_no), '[]'::jsonb) INTO lines FROM public.quotation_items i WHERE i.quotation_id = p_id;
  RETURN saved || jsonb_build_object('items', lines);
END;
$$;
REVOKE ALL ON FUNCTION public.replace_quotation_document(bigint,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_quotation_document(bigint,jsonb,jsonb) TO service_role;
