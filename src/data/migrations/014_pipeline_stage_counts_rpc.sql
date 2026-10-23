-- Migration 014: Pipeline Stage Counts Fast Aggregation RPC
-- Replaces client-side 2.2MB bulk fetch of 6,862 subplates with single database aggregation

CREATE OR REPLACE FUNCTION public.get_pipeline_stage_counts()
RETURNS json
LANGUAGE sql
STABLE
AS $$
SELECT json_build_object(
  'scantotal', (SELECT count(*) FROM public.scan WHERE status != 'completed'),
  'designby', count(CASE WHEN sp.design_by > 0 THEN 1 END),
  'orderbytotal', count(CASE WHEN sp.order_by > 0 THEN 1 END),
  'receivedqcby', count(CASE WHEN sp.received_workby > 0 OR sp.received_qcby > 0 THEN 1 END),
  'vmcworkby', count(CASE WHEN sp.vmc_workby > 0 THEN 1 END),
  'drilltapworkby', count(CASE WHEN sp.drilltap_workby > 0 THEN 1 END),
  'finalqcby', count(CASE WHEN sp.final_qcby > 0 THEN 1 END),
  'packingworkby', count(CASE WHEN sp.packing_workby > 0 THEN 1 END),
  'designMoulds', count(DISTINCT CASE WHEN sp.design_by > 0 THEN COALESCE(sp.mold_id::text, sp.projectid) END),
  'orderMoulds', count(DISTINCT CASE WHEN sp.order_by > 0 THEN COALESCE(sp.mold_id::text, sp.projectid) END),
  'programmingMoulds', count(DISTINCT CASE WHEN sp.received_workby > 0 OR sp.received_qcby > 0 THEN COALESCE(sp.mold_id::text, sp.projectid) END),
  'vmcMoulds', count(DISTINCT CASE WHEN sp.vmc_workby > 0 THEN COALESCE(sp.mold_id::text, sp.projectid) END),
  'drilltapMoulds', count(DISTINCT CASE WHEN sp.drilltap_workby > 0 THEN COALESCE(sp.mold_id::text, sp.projectid) END),
  'finalqcMoulds', count(DISTINCT CASE WHEN sp.final_qcby > 0 THEN COALESCE(sp.mold_id::text, sp.projectid) END),
  'packingMoulds', count(DISTINCT CASE WHEN sp.packing_workby > 0 THEN COALESCE(sp.mold_id::text, sp.projectid) END)
)
FROM public.subplate sp
WHERE sp.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_pipeline_stage_counts() TO anon, authenticated, service_role;
