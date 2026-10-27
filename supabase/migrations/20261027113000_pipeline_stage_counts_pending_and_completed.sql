-- Migration: Update get_pipeline_stage_counts to return both Pending and Completed plates breakdown for KPI cards

CREATE OR REPLACE FUNCTION public.get_pipeline_stage_counts()
RETURNS json
LANGUAGE sql
STABLE
AS $function$
  SELECT json_build_object(
    'scantotal', (SELECT count(*) FROM public.scan WHERE status != 'completed'),
    
    -- Design Order
    'designPending', count(CASE WHEN (sp.design_by IS NULL OR sp.design_by = 0) THEN 1 END),
    'designCompleted', count(CASE WHEN (sp.design_by > 0) THEN 1 END),
    
    -- Purchase
    'orderPending', count(CASE WHEN (sp.order_by IS NULL OR sp.order_by = 0) THEN 1 END),
    'orderCompleted', count(CASE WHEN (sp.order_by > 0) THEN 1 END),
    
    -- Programming Work
    'programmingPending', count(CASE WHEN (sp.order_by > 0 OR sp.received_workby > 0) AND (sp.received_qcby IS NULL OR sp.received_qcby = 0) THEN 1 END),
    'programmingCompleted', count(CASE WHEN (sp.received_qcby > 0) THEN 1 END),
    
    -- Machining (VMC)
    'vmcPending', count(CASE WHEN (sp.received_qcby > 0) AND (sp.vmc_workby IS NULL OR sp.vmc_workby = 0) THEN 1 END),
    'vmcCompleted', count(CASE WHEN (sp.vmc_workby > 0) THEN 1 END),
    
    -- Drill & Tap
    'drilltapPending', count(CASE WHEN (sp.vmc_workby > 0) AND (sp.drilltap_workby IS NULL OR sp.drilltap_workby = 0) THEN 1 END),
    'drilltapCompleted', count(CASE WHEN (sp.drilltap_workby > 0) THEN 1 END),
    
    -- Final QC
    'finalqcPending', count(CASE WHEN (sp.drilltap_workby > 0) AND (sp.final_qcby IS NULL OR sp.final_qcby = 0) THEN 1 END),
    'finalqcCompleted', count(CASE WHEN (sp.final_qcby > 0) THEN 1 END),
    
    -- Packing
    'packingPending', count(CASE WHEN (sp.final_qcby > 0) AND (sp.packing_workby IS NULL OR sp.packing_workby = 0) THEN 1 END),
    'packingCompleted', count(CASE WHEN (sp.packing_workby > 0) THEN 1 END),

    -- Backwards compatibility aliases
    'designby', count(CASE WHEN (sp.design_by IS NULL OR sp.design_by = 0) THEN 1 END),
    'orderbytotal', count(CASE WHEN (sp.order_by IS NULL OR sp.order_by = 0) THEN 1 END),
    'receivedqcby', count(CASE WHEN (sp.order_by > 0 OR sp.received_workby > 0) AND (sp.received_qcby IS NULL OR sp.received_qcby = 0) THEN 1 END),
    'vmcworkby', count(CASE WHEN (sp.received_qcby > 0) AND (sp.vmc_workby IS NULL OR sp.vmc_workby = 0) THEN 1 END),
    'drilltapworkby', count(CASE WHEN (sp.vmc_workby > 0) AND (sp.drilltap_workby IS NULL OR sp.drilltap_workby = 0) THEN 1 END),
    'finalqcby', count(CASE WHEN (sp.drilltap_workby > 0) AND (sp.final_qcby IS NULL OR sp.final_qcby = 0) THEN 1 END),
    'packingworkby', count(CASE WHEN (sp.final_qcby > 0) AND (sp.packing_workby IS NULL OR sp.packing_workby = 0) THEN 1 END),
    'designMoulds', count(DISTINCT CASE WHEN (sp.design_by IS NULL OR sp.design_by = 0) THEN COALESCE(sp.mold_id::text, sp.projectid) END),
    'orderMoulds', count(DISTINCT CASE WHEN (sp.order_by IS NULL OR sp.order_by = 0) THEN COALESCE(sp.mold_id::text, sp.projectid) END),
    'programmingMoulds', count(DISTINCT CASE WHEN (sp.order_by > 0 OR sp.received_workby > 0) AND (sp.received_qcby IS NULL OR sp.received_qcby = 0) THEN COALESCE(sp.mold_id::text, sp.projectid) END),
    'vmcMoulds', count(DISTINCT CASE WHEN (sp.received_qcby > 0) AND (sp.vmc_workby IS NULL OR sp.vmc_workby = 0) THEN COALESCE(sp.mold_id::text, sp.projectid) END),
    'drilltapMoulds', count(DISTINCT CASE WHEN (sp.vmc_workby > 0) AND (sp.drilltap_workby IS NULL OR sp.drilltap_workby = 0) THEN COALESCE(sp.mold_id::text, sp.projectid) END),
    'finalqcMoulds', count(DISTINCT CASE WHEN (sp.drilltap_workby > 0) AND (sp.final_qcby IS NULL OR sp.final_qcby = 0) THEN COALESCE(sp.mold_id::text, sp.projectid) END),
    'packingMoulds', count(DISTINCT CASE WHEN (sp.final_qcby > 0) AND (sp.packing_workby IS NULL OR sp.packing_workby = 0) THEN COALESCE(sp.mold_id::text, sp.projectid) END)
  )
  FROM public.subplate sp
  LEFT JOIN public.scan s ON (s.id = sp.mold_id OR s.id::text = sp.projectid OR s.projectid = sp.projectid)
  WHERE sp.deleted_at IS NULL
    AND (s.status IS NULL OR s.status != 'completed');
$function$;

GRANT EXECUTE ON FUNCTION public.get_pipeline_stage_counts() TO anon, authenticated, service_role;
