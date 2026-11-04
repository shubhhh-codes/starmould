-- Read model includes exact source-line IDs without assigning historical receipts to guessed lines.
CREATE FUNCTION public.pending_inventory_receipt_lines(p_kind text) RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT to_jsonb(h) || jsonb_build_object('source_line_id',pi.id,'plateid',pi.plateid,
    'qty',pi.qty,'material',pi.material,'materialtype',pi.materialtype,'rate',pi.rate,
    'platename',sp.platename,'subprojectid',sp.subprojectid,'shape',sp.shape,'length',sp.length,
    'width',sp.width,'height',sp.height,'weight',sp.weight,'unit',sp.unit,
    'customername',c.customername,'vendorname',v.vendor_name,
    'inward_qty',r.received,'pending_qty',greatest(0,pi.qty-r.received),
    'source_allocation_requires_review',r.legacy>0 AND duplicates.line_count>1)
  FROM public.purchase h JOIN public.purchase_items pi ON pi.pid=h.id JOIN public.subplate sp ON sp.id=pi.plateid
  LEFT JOIN public.customers c ON c.id=h.cname LEFT JOIN public.vendors v ON v.id=h.vname
  CROSS JOIN LATERAL (SELECT count(*) line_count FROM public.purchase_items other WHERE other.pid=h.id AND other.plateid=pi.plateid) duplicates
  CROSS JOIN LATERAL (SELECT coalesce(sum(ii.inward_qty),0) received,
    coalesce(sum(ii.inward_qty) FILTER(WHERE ii.purchase_item_id IS NULL),0) legacy
    FROM public.purchase_inward_items ii JOIN public.po_inward receipt ON receipt.id=ii.inpid
    WHERE ii.pid=h.id AND ii.plateid=pi.plateid AND receipt.status='1' AND (ii.purchase_item_id=pi.id OR ii.purchase_item_id IS NULL)) r
  WHERE p_kind='purchase' AND h.status='1' AND sp.deleted_at IS NULL AND pi.qty>r.received
  UNION ALL
  SELECT to_jsonb(h) || jsonb_build_object('source_line_id',ci.id,'plateid',ci.plateid,
    'qty',ci.qty,'particulars',ci.particulars,'customer',h.customerid,
    'platename',sp.platename,'subprojectid',sp.subprojectid,
    'customername',c.customername,'vendorname',v.vendor_name,
    'inward_qty',r.received,'pending_qty',greatest(0,ci.qty-r.received),
    'source_allocation_requires_review',r.legacy>0 AND duplicates.line_count>1)
  FROM public.challan h JOIN public.challan_items ci ON ci.challanid=h.id JOIN public.subplate sp ON sp.id=ci.plateid
  LEFT JOIN public.customers c ON c.id=h.customerid LEFT JOIN public.vendors v ON v.id=h.vendorid
  CROSS JOIN LATERAL (SELECT count(*) line_count FROM public.challan_items other WHERE other.challanid=h.id AND other.plateid=ci.plateid) duplicates
  CROSS JOIN LATERAL (SELECT coalesce(sum(ii.inward_qty),0) received,
    coalesce(sum(ii.inward_qty) FILTER(WHERE ii.challan_item_id IS NULL),0) legacy
    FROM public.inward_items ii JOIN public.inward receipt ON receipt.id=ii.inchallanid
    WHERE ii.challanid=h.id AND ii.plateid=ci.plateid AND receipt.status='1' AND (ii.challan_item_id=ci.id OR ii.challan_item_id IS NULL)) r
  WHERE p_kind='jobwork' AND h.status='1' AND sp.deleted_at IS NULL AND ci.qty>r.received;
$$;
REVOKE ALL ON FUNCTION public.pending_inventory_receipt_lines(text) FROM PUBLIC, anon, authenticated, app_realtime;
GRANT EXECUTE ON FUNCTION public.pending_inventory_receipt_lines(text) TO service_role;
