-- 005_performance_optimization_v2.sql
-- Idempotent, safe migration for StarMould ERP performance optimization

-- 1. Composite & Partial Indexes for Critical Query Paths
CREATE INDEX IF NOT EXISTS idx_subplate_projectid_active 
  ON public.subplate(projectid) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scan_worktype_status_active 
  ON public.scan(status, worktype) 
  WHERE status <> 'completed';

CREATE INDEX IF NOT EXISTS idx_inward_items_inchallan_plate 
  ON public.inward_items(inchallanid, plateid);

CREATE INDEX IF NOT EXISTS idx_challan_items_challan_plate 
  ON public.challan_items(challanid, plateid);

-- 2. Fast Aggregation RPC Function for Dashboard Table Counts (Collapses 16 queries into 1)
CREATE OR REPLACE FUNCTION public.get_table_counts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'customers', (SELECT count(*) FROM public.customers WHERE deleted_at IS NULL),
    'subplates', (SELECT count(*) FROM public.subplate WHERE deleted_at IS NULL),
    'scans', (SELECT count(*) FROM public.scan),
    'purchases', (SELECT count(*) FROM public.purchase),
    'po_inwards', (SELECT count(*) FROM public.po_inward),
    'challans', (SELECT count(*) FROM public.challan),
    'inwards', (SELECT count(*) FROM public.inward),
    'dispatches', (SELECT count(*) FROM public.dispatch),
    'expenses', (SELECT count(*) FROM public.expense),
    'worklogs', (SELECT count(*) FROM public.worklog),
    'users', (SELECT count(*) FROM public.users WHERE deleted_at IS NULL)
  ) INTO result;
  RETURN result;
END;
$$;

-- 3. Fast Aggregation RPC Function for Expense Debit/Credit Totals
CREATE OR REPLACE FUNCTION public.get_expense_totals()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'totalCredit', COALESCE(SUM(CASE WHEN payment_type = 'Credit' THEN amount ELSE 0 END), 0),
    'totalDebit', COALESCE(SUM(CASE WHEN payment_type = 'Debit' THEN amount ELSE 0 END), 0),
    'totalOutstanding', COALESCE(SUM(CASE WHEN payment_type = 'Outstanding' THEN amount ELSE 0 END), 0),
    'totalCount', count(*)
  ) INTO result
  FROM public.expense;
  RETURN result;
END;
$$;

-- 4. Fast Aggregation RPC Function for Report Workflow Summary
CREATE OR REPLACE FUNCTION public.get_report_workflow_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  counts_result json;
  total_subplates bigint;
BEGIN
  SELECT count(*) INTO total_subplates FROM public.subplate WHERE deleted_at IS NULL;

  SELECT json_build_object(
    'pulpMould', count(*) FILTER (WHERE lower(trim(coalesce(worktype, ''))) LIKE '%pulp%'),
    'tf', count(*) FILTER (WHERE lower(trim(coalesce(worktype, ''))) LIKE '%tf%'),
    'rework', count(*) FILTER (WHERE lower(trim(coalesce(worktype, ''))) LIKE '%rework%' OR lower(trim(coalesce(worktype, ''))) LIKE '%r.e.%'),
    'machinePart', count(*) FILTER (WHERE lower(trim(coalesce(worktype, ''))) LIKE '%machine%'),
    'accessories', count(*) FILTER (WHERE lower(trim(coalesce(worktype, ''))) LIKE '%accessories%'),
    'sample', count(*) FILTER (WHERE lower(trim(coalesce(worktype, ''))) LIKE '%sample%'),
    'other', count(*) FILTER (
      WHERE NOT (
        lower(trim(coalesce(worktype, ''))) LIKE '%pulp%' OR
        lower(trim(coalesce(worktype, ''))) LIKE '%tf%' OR
        lower(trim(coalesce(worktype, ''))) LIKE '%rework%' OR
        lower(trim(coalesce(worktype, ''))) LIKE '%r.e.%' OR
        lower(trim(coalesce(worktype, ''))) LIKE '%machine%' OR
        lower(trim(coalesce(worktype, ''))) LIKE '%accessories%' OR
        lower(trim(coalesce(worktype, ''))) LIKE '%sample%'
      )
    ),
    'totalProjects', count(*)
  ) INTO counts_result
  FROM public.scan;

  RETURN json_build_object(
    'workflowCounts', counts_result,
    'totalSubplates', total_subplates
  );
END;
$$;
