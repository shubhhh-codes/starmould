-- Migration: 20261023121500_customer_name_and_id_dual_schema.sql
-- Description: Implement Human-Readable Customer Names & Relational IDs across Scan, Purchases, and Inward tables

-- ============================================================================
-- 1. SCHEMA UPGRADES: ADD DEDICATED COLUMNS
-- ============================================================================

-- A. Mould Projects table (scan)
ALTER TABLE public.scan ADD COLUMN IF NOT EXISTS customer_id INTEGER;

-- B. Purchase Orders & Inward tables (store human-readable customer name)
ALTER TABLE public.purchase ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.po_inward ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- ============================================================================
-- 2. HISTORICAL DATA BACKFILL
-- ============================================================================

-- Backfill scan.customer_id for numeric cname values
UPDATE public.scan s
SET 
    customer_id = s.cname::integer,
    cname = c.customername
FROM public.customers c
WHERE s.cname ~ '^[0-9]+$'
  AND s.cname::integer = c.id;

-- For any scan rows where cname was text, resolve matching customer_id
UPDATE public.scan s
SET customer_id = c.id
FROM public.customers c
WHERE s.customer_id IS NULL
  AND LOWER(TRIM(s.cname)) = LOWER(TRIM(c.customername));

-- Backfill purchase.customer_name using cname (which stores customer id)
UPDATE public.purchase p
SET customer_name = c.customername
FROM public.customers c
WHERE p.cname = c.id
  AND (p.customer_name IS NULL OR p.customer_name = '');

-- Backfill po_inward.customer_name using cname
UPDATE public.po_inward pi
SET customer_name = c.customername
FROM public.customers c
WHERE pi.cname = c.id
  AND (pi.customer_name IS NULL OR pi.customer_name = '');

-- ============================================================================
-- 3. CONSTRAINTS & PERFORMANCE INDEXES
-- ============================================================================

-- Foreign key on scan.customer_id with RESTRICT protection (prevents accidental deletion of customers with moulds)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_scan_customer'
    ) THEN
        ALTER TABLE public.scan
        ADD CONSTRAINT fk_scan_customer
        FOREIGN KEY (customer_id) REFERENCES public.customers(id)
        ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scan_customer_id ON public.scan(customer_id);
CREATE INDEX IF NOT EXISTS idx_scan_cname_text ON public.scan(cname);
CREATE INDEX IF NOT EXISTS idx_purchase_customer_name ON public.purchase(customer_name);
CREATE INDEX IF NOT EXISTS idx_po_inward_customer_name ON public.po_inward(customer_name);

-- ============================================================================
-- 4. AUTOMATED CASCADE SYNC TRIGGER FOR CUSTOMER RENAMES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_customer_name_to_linked_tables()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.customername IS DISTINCT FROM OLD.customername THEN
        -- Sync to scan moulds
        UPDATE public.scan
        SET cname = NEW.customername,
            updated_at = NOW()
        WHERE customer_id = NEW.id;

        -- Sync to purchase orders
        UPDATE public.purchase
        SET customer_name = NEW.customername,
            updated_at = NOW()
        WHERE cname = NEW.id;

        -- Sync to po_inward
        UPDATE public.po_inward
        SET customer_name = NEW.customername,
            updated_at = NOW()
        WHERE cname = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_customer_name ON public.customers;
CREATE TRIGGER trg_sync_customer_name
AFTER UPDATE OF customername ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_name_to_linked_tables();

-- Trigger: When scan.customer_id is modified directly, auto-update scan.cname
CREATE OR REPLACE FUNCTION public.sync_cname_from_customer_id()
RETURNS TRIGGER AS $$
DECLARE
    v_name text;
BEGIN
    IF NEW.customer_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.customer_id IS DISTINCT FROM OLD.customer_id) THEN
        SELECT customername INTO v_name
        FROM public.customers
        WHERE id = NEW.customer_id;
        
        IF v_name IS NOT NULL THEN
            NEW.cname := v_name;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_cname_from_customer_id ON public.scan;
CREATE TRIGGER trg_sync_cname_from_customer_id
BEFORE INSERT OR UPDATE OF customer_id ON public.scan
FOR EACH ROW
EXECUTE FUNCTION public.sync_cname_from_customer_id();

-- ============================================================================
-- 5. ATOMIC RPC UPGRADE: create_project_with_code
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_project_with_code(
    p_cname text,
    p_description text,
    p_worktype text DEFAULT 'Pulp Mould'::text,
    p_rdate date DEFAULT CURRENT_DATE,
    p_cdate date DEFAULT CURRENT_DATE,
    p_dispatchdate date DEFAULT CURRENT_DATE,
    p_note text DEFAULT ''::text,
    p_subnote text DEFAULT ''::text,
    p_created_by integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_global_num integer;
    v_cid_str text;
    v_initials text;
    v_customer_id integer;
    v_customer_name text;
    v_next_cust_num integer;
    v_cust_count_str text;
    v_projectid text;
    v_new_project record;
BEGIN
    -- 1. Acquire transaction-level advisory lock (released automatically on COMMIT/ROLLBACK)
    PERFORM pg_advisory_xact_lock(hashtext('project_code_generation'));

    -- 2. Derive next global sequence from existing project codes
    SELECT COALESCE(MAX((substring(projectid from '^([0-9]+)'))::integer), 0) + 1
    INTO v_next_global_num
    FROM public.scan;

    v_cid_str := LPAD(v_next_global_num::text, 4, '0');

    -- 3. Resolve customer ID, Initials, and Human-Readable Company Name
    IF p_cname ~ '^[0-9]+$' THEN
        v_customer_id := p_cname::integer;
        SELECT TRIM(initials), TRIM(customername)
        INTO v_initials, v_customer_name
        FROM public.customers
        WHERE id = v_customer_id;
    ELSE
        SELECT id, TRIM(initials), TRIM(customername)
        INTO v_customer_id, v_initials, v_customer_name
        FROM public.customers
        WHERE LOWER(TRIM(customername)) = LOWER(TRIM(p_cname))
        LIMIT 1;
    END IF;

    IF v_initials IS NULL OR v_initials = '' THEN
        v_initials := 'GEN';
    END IF;

    IF v_customer_name IS NULL OR v_customer_name = '' THEN
        v_customer_name := TRIM(p_cname);
    END IF;

    -- 4. Calculate next customer job count using high-water mark (stable by customer_id)
    SELECT COALESCE(MAX((substring(projectid from '_([0-9]+)$'))::integer), 0) + 1
    INTO v_next_cust_num
    FROM public.scan
    WHERE (v_customer_id IS NOT NULL AND customer_id = v_customer_id)
       OR cname = p_cname
       OR cname = v_customer_name;

    v_cust_count_str := LPAD(v_next_cust_num::text, 3, '0');
    v_projectid := v_cid_str || '_' || v_initials || '_' || v_cust_count_str;

    -- 5. Insert atomically inside the lock
    INSERT INTO public.scan (
        projectid,
        rdate,
        cdate,
        dispatchdate,
        customer_id,
        cname,
        description,
        worktype,
        status,
        mail_done,
        note,
        subnote,
        created_by,
        created_at,
        updated_at
    )
    VALUES (
        v_projectid,
        COALESCE(p_rdate, CURRENT_DATE),
        COALESCE(p_cdate, CURRENT_DATE),
        COALESCE(p_dispatchdate, CURRENT_DATE),
        v_customer_id,
        v_customer_name,
        TRIM(p_description),
        COALESCE(NULLIF(TRIM(p_worktype), ''), 'Pulp Mould'),
        'pending',
        0,
        COALESCE(TRIM(p_note), ''),
        COALESCE(TRIM(p_subnote), ''),
        p_created_by,
        NOW(),
        NOW()
    )
    RETURNING * INTO v_new_project;

    RETURN to_jsonb(v_new_project);
END;
$$;

-- ============================================================================
-- 6. ATOMIC RPC UPGRADE: get_next_project_code_preview
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_next_project_code_preview(p_customer_id text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
    v_next_global_num integer;
    v_cid_str text;
    v_initials text;
    v_cust_id integer;
    v_customer_name text;
    v_next_cust_num integer;
    v_cust_count_str text;
    v_projectid text;
BEGIN
    SELECT COALESCE(MAX((substring(projectid from '^([0-9]+)'))::integer), 0) + 1
    INTO v_next_global_num
    FROM public.scan;

    v_cid_str := LPAD(v_next_global_num::text, 4, '0');

    IF p_customer_id IS NULL OR TRIM(p_customer_id) = '' THEN
        RETURN jsonb_build_object(
            'nextId', v_next_global_num,
            'cidStr', v_cid_str,
            'initials', NULL,
            'custCountStr', NULL,
            'projectid', NULL,
            'previewCode', v_cid_str || '_???_???',
            'isComplete', false
        );
    END IF;

    IF p_customer_id ~ '^[0-9]+$' THEN
        v_cust_id := p_customer_id::integer;
        SELECT TRIM(initials), TRIM(customername)
        INTO v_initials, v_customer_name
        FROM public.customers
        WHERE id = v_cust_id;
    ELSE
        SELECT id, TRIM(initials), TRIM(customername)
        INTO v_cust_id, v_initials, v_customer_name
        FROM public.customers
        WHERE LOWER(TRIM(customername)) = LOWER(TRIM(p_customer_id))
        LIMIT 1;
    END IF;

    IF v_initials IS NULL OR v_initials = '' THEN
        v_initials := 'GEN';
    END IF;

    IF v_customer_name IS NULL OR v_customer_name = '' THEN
        v_customer_name := TRIM(p_customer_id);
    END IF;

    SELECT COALESCE(MAX((substring(projectid from '_([0-9]+)$'))::integer), 0) + 1
    INTO v_next_cust_num
    FROM public.scan
    WHERE (v_cust_id IS NOT NULL AND customer_id = v_cust_id)
       OR cname = p_customer_id
       OR cname = v_customer_name;

    v_cust_count_str := LPAD(v_next_cust_num::text, 3, '0');
    v_projectid := v_cid_str || '_' || v_initials || '_' || v_cust_count_str;

    RETURN jsonb_build_object(
        'nextId', v_next_global_num,
        'cidStr', v_cid_str,
        'initials', v_initials,
        'custCountStr', v_cust_count_str,
        'projectid', v_projectid,
        'previewCode', v_projectid,
        'isComplete', true
    );
END;
$$;

-- ============================================================================
-- 7. REFRESH DEPENDENT VIEWS FOR INSTANT RECOGNITION
-- ============================================================================

CREATE OR REPLACE VIEW public.view_molds_overview AS
SELECT 
    sc.id AS mold_id,
    sc.projectid AS mold_code,
    sc.description AS mold_name,
    COALESCE(c.customername, sc.cname)::varchar(255) AS customer_name,
    COALESCE(c.initials, 'GEN')::varchar(50) AS customer_initials,
    sc.worktype AS work_type,
    sc.rdate AS order_date,
    sc.cdate AS target_date,
    sc.dispatchdate AS dispatch_date,
    sc.status,
    count(sp.id) AS total_subplates,
    count(
        CASE
            WHEN sp.packing_workby IS NOT NULL AND sp.packing_workby > 0 THEN 1
            ELSE NULL::integer
        END
    ) AS completed_subplates,
    CASE
        WHEN count(sp.id) = 0 THEN 0::numeric
        ELSE round(count(
            CASE
                WHEN sp.packing_workby IS NOT NULL AND sp.packing_workby > 0 THEN 1
                ELSE NULL::integer
            END
        )::numeric / count(sp.id)::numeric * 100::numeric, 1)
    END AS completion_percentage
FROM public.scan sc
LEFT JOIN public.customers c ON sc.customer_id = c.id OR sc.cname = c.customername OR sc.cname = c.id::text
LEFT JOIN public.subplate sp ON (sp.mold_id = sc.id OR sp.projectid ~ '^[0-9]+$' AND sp.projectid::bigint = sc.id OR sp.projectid = sc.projectid) AND sp.deleted_at IS NULL
GROUP BY sc.id, sc.projectid, sc.description, c.customername, sc.cname, c.initials, sc.worktype, sc.rdate, sc.cdate, sc.dispatchdate, sc.status;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.create_project_with_code(text, text, text, date, date, date, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_next_project_code_preview(text) TO service_role, authenticated;
