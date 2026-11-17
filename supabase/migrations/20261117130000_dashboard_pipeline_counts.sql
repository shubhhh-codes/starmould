-- Dashboard totals, including purchase progress, in one database snapshot.
CREATE OR REPLACE FUNCTION public.get_dashboard_pipeline_counts()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  WITH active_keys AS (
    SELECT id::text AS key FROM public.scan WHERE status NOT IN ('completed', 'registered')
    UNION
    SELECT projectid FROM public.scan WHERE status NOT IN ('completed', 'registered') AND projectid <> ''
  ), active_plates AS (
    SELECT id, coalesce(nullif(sqty, 0), 1) AS required
    FROM public.subplate
    WHERE deleted_at IS NULL
      AND (mold_id::text IN (SELECT key FROM active_keys)
           OR projectid IN (SELECT key FROM active_keys))
  ), ordered AS (
    SELECT i.plateid, sum(i.qty) AS qty
    FROM public.purchase_items i
    JOIN public.purchase p ON p.id = i.pid AND p.status <> '0'
    JOIN active_plates a ON a.id = i.plateid
    GROUP BY i.plateid
  ), progress AS (
    SELECT a.required, coalesce(o.qty, 0) AS qty
    FROM active_plates a LEFT JOIN ordered o ON o.plateid = a.id
  )
  SELECT public.get_pipeline_stage_counts()::jsonb || jsonb_build_object(
    'orderPending', count(*) FILTER (WHERE qty < required),
    'orderbytotal', count(*) FILTER (WHERE qty < required),
    'orderPartial', count(*) FILTER (WHERE qty > 0 AND qty < required),
    'orderCompleted', count(*) FILTER (WHERE qty >= required)
  ) FROM progress;
$$;
REVOKE ALL ON FUNCTION public.get_dashboard_pipeline_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_pipeline_counts() TO service_role;
