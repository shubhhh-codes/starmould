-- Migration: 20261029161500_fix_mould_project_code_initials_matching.sql
-- Description: Ensure mould project code counter checks customer initials in addition to customer_id / cname,
-- and fix data inconsistency where Mould 1 had customer_id 1 with TESTC initials.

-- 1. Upgrade get_next_project_code_preview
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

    -- Calculate next customer mould count matching by customer_id, customer name, OR customer initials in projectid
    SELECT COALESCE(MAX((substring(projectid from '_([0-9]+)$'))::integer), 0) + 1
    INTO v_next_cust_num
    FROM public.scan
    WHERE (v_cust_id IS NOT NULL AND customer_id = v_cust_id)
       OR cname = p_customer_id
       OR cname = v_customer_name
       OR (v_initials IS NOT NULL AND v_initials <> 'GEN' AND projectid ~ ('^[0-9]+_' || v_initials || '_[0-9]+$'));

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

-- 2. Upgrade create_project_with_code
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
    -- 1. Acquire transaction-level advisory lock
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

    -- 4. Calculate next customer job count matching by customer_id, customer name, OR customer initials in projectid
    SELECT COALESCE(MAX((substring(projectid from '_([0-9]+)$'))::integer), 0) + 1
    INTO v_next_cust_num
    FROM public.scan
    WHERE (v_customer_id IS NOT NULL AND customer_id = v_customer_id)
       OR cname = p_cname
       OR cname = v_customer_name
       OR (v_initials IS NOT NULL AND v_initials <> 'GEN' AND projectid ~ ('^[0-9]+_' || v_initials || '_[0-9]+$'));

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

-- 3. Data correction:
-- Fix Mould 1 to be correctly associated with customer 83 (Test customer)
UPDATE public.scan
SET customer_id = 83, cname = 'Test customer'
WHERE id = 1 AND projectid = '0001_TESTC_001';

-- Fix Mould 2 to have projectid 0002_TESTC_002
UPDATE public.scan
SET projectid = '0002_TESTC_002'
WHERE id = 2 AND projectid = '0002_TESTC_001';

GRANT EXECUTE ON FUNCTION public.create_project_with_code(text, text, text, date, date, date, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_next_project_code_preview(text) TO service_role, authenticated;
