-- ------------------------------------------------------------------------------
-- 005_PERFORMANCE_INDEXES.SQL
-- StarMould Production ERP - High Traffic Query Performance Indexes
-- ------------------------------------------------------------------------------

-- 1. worklog: index scan_print_id for rapid aggregation in scanning and sample modules
CREATE INDEX IF NOT EXISTS idx_worklog_scan_print_id ON public.worklog(scan_print_id);

-- 2. subplate: composite index on (deleted_at, subprojectid) for project joins and un-deleted scans
CREATE INDEX IF NOT EXISTS idx_subplate_deleted_at_subprojectid ON public.subplate(deleted_at, subprojectid);

-- 3. scan: index cname for customer mould cascading
CREATE INDEX IF NOT EXISTS idx_scan_cname ON public.scan(cname);

-- 4. purchase_inward_items: composite index on (pid, pending_qty) for live PO tracking
CREATE INDEX IF NOT EXISTS idx_purchase_inward_items_pid_pending_qty ON public.purchase_inward_items(pid, pending_qty);

-- 5. Foreign key / lookup indexes on customerid and vendorid across registers
CREATE INDEX IF NOT EXISTS idx_challan_customerid ON public.challan(customerid);
CREATE INDEX IF NOT EXISTS idx_challan_vendorid ON public.challan(vendorid);
CREATE INDEX IF NOT EXISTS idx_inward_vendorid ON public.inward(vendorid);
CREATE INDEX IF NOT EXISTS idx_inward_customerid ON public.inward(customerid);
CREATE INDEX IF NOT EXISTS idx_purchase_cname ON public.purchase(cname);
CREATE INDEX IF NOT EXISTS idx_purchase_vname ON public.purchase(vname);
