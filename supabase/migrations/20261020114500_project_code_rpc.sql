-- Migration: 20261020114500_project_code_rpc.sql
-- Description: Concurrency-safe atomic project code generation & preview RPCs

-- 1. Ensure absolute uniqueness on projectid (0 duplicates verified across 1,463 rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_projectid_unique ON public.scan(projectid);

-- 2. Performance expression indexes for fast substring integer extraction
CREATE INDEX IF NOT EXISTS idx_scan_projectid_global_num ON public.scan((substring(projectid from '^([0-9]+)')::integer));
CREATE INDEX IF NOT EXISTS idx_scan_projectid_cust_num ON public.scan(cname, (substring(projectid from '_([0-9]+)$')::integer));

-- ------------------------------------------------------------------------------
-- 3. PREVIEW RPC: get_next_project_code_preview
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_next_project_code_preview(p_customer_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_next_global_num integer;
    v_cid_str text;
    v_initials text;
    v_next_cust_num integer;
    v_cust_count_str text;
    v_projectid text;
BEGIN
    -- Derive next global number from projectid leading digits (immune to serial id gaps)
    SELECT COALESCE(MAX((substring(projectid from '^([0-9]+)'))::integer), 0) + 1
    INTO v_next_global_num
    FROM public.scan;

    v_cid_str := LPAD(v_next_global_num::text, 4, '0');

    -- If no customer provided yet, return tentative global prefix
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

    -- Lookup customer initials
    SELECT TRIM(initials)
    INTO v_initials
    FROM public.customers
    WHERE id = p_customer_id::integer;

    IF v_initials IS NULL OR v_initials = '' THEN
        v_initials := 'GEN';
    END IF;

    -- High-water mark calculation for customer index (safe substring extraction)
    SELECT COALESCE(MAX((substring(projectid from '_([0-9]+)$'))::integer), 0) + 1
    INTO v_next_cust_num
    FROM public.scan
    WHERE cname = p_customer_id;

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

-- ------------------------------------------------------------------------------
-- 4. ATOMIC CREATION RPC: create_project_with_code
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_project_with_code(
    p_cname text,
    p_description text,
    p_worktype text DEFAULT 'Pulp Mould',
    p_rdate date DEFAULT CURRENT_DATE,
    p_cdate date DEFAULT CURRENT_DATE,
    p_dispatchdate date DEFAULT CURRENT_DATE,
    p_note text DEFAULT '',
    p_subnote text DEFAULT '',
    p_created_by integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
    v_next_global_num integer;
    v_cid_str text;
    v_initials text;
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

    -- 3. Lookup customer initials
    SELECT TRIM(initials)
    INTO v_initials
    FROM public.customers
    WHERE id = p_cname::integer;

    IF v_initials IS NULL OR v_initials = '' THEN
        v_initials := 'GEN';
    END IF;

    -- 4. Calculate next customer job count using high-water mark
    SELECT COALESCE(MAX((substring(projectid from '_([0-9]+)$'))::integer), 0) + 1
    INTO v_next_cust_num
    FROM public.scan
    WHERE cname = p_cname;

    v_cust_count_str := LPAD(v_next_cust_num::text, 3, '0');
    v_projectid := v_cid_str || '_' || v_initials || '_' || v_cust_count_str;

    -- 5. Insert atomically inside the lock
    INSERT INTO public.scan (
        projectid,
        rdate,
        cdate,
        dispatchdate,
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
        p_cname,
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

-- ------------------------------------------------------------------------------
-- 5. FUNCTION PERMISSIONS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_next_project_code_preview(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_project_code_preview(text) TO service_role;

REVOKE ALL ON FUNCTION public.create_project_with_code(text, text, text, date, date, date, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_project_with_code(text, text, text, date, date, date, text, text, integer) TO service_role;
