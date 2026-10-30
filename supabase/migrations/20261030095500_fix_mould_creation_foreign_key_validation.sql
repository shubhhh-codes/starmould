-- Migration: 20261030095500_fix_mould_creation_foreign_key_validation.sql
-- Description: Fix foreign key constraint violation on scan table by strictly validating
-- customer existence in both get_next_project_code_preview and create_project_with_code.

-- 1. Upgrade get_next_project_code_preview to strictly validate customer existence
CREATE OR REPLACE FUNCTION public.get_next_project_code_preview(
    p_customer_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    -- 1. Derive next global sequence from existing project codes
    SELECT COALESCE(MAX((substring(projectid from '^([0-9]+)'))::integer), 0) + 1
    INTO v_next_global_num
    FROM public.scan;

    v_cid_str := LPAD(v_next_global_num::text, 4, '0');

    -- If no customer provided, return incomplete preview
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

    -- 2. Resolve customer by ID, Customer Code, or Company Name (strictly active customers)
    IF p_customer_id ~ '^[0-9]+$' THEN
        SELECT id, TRIM(initials), TRIM(customername)
        INTO v_cust_id, v_initials, v_customer_name
        FROM public.customers
        WHERE id = p_customer_id::integer AND deleted_at IS NULL;
    ELSE
        SELECT id, TRIM(initials), TRIM(customername)
        INTO v_cust_id, v_initials, v_customer_name
        FROM public.customers
        WHERE (LOWER(TRIM(customername)) = LOWER(TRIM(p_customer_id))
           OR (customer_code IS NOT NULL AND UPPER(TRIM(customer_code)) = UPPER(TRIM(p_customer_id)))
           OR (pan_code IS NOT NULL AND UPPER(TRIM(pan_code)) = UPPER(TRIM(p_customer_id))))
          AND deleted_at IS NULL
        LIMIT 1;
    END IF;

    -- If customer not found in customer master, do NOT fake initials with 'GEN' or mark complete
    IF v_cust_id IS NULL THEN
        RETURN jsonb_build_object(
            'nextId', v_next_global_num,
            'cidStr', v_cid_str,
            'initials', NULL,
            'custCountStr', NULL,
            'projectid', NULL,
            'previewCode', v_cid_str || '_???_???',
            'isComplete', false,
            'error', 'Customer not found'
        );
    END IF;

    IF v_initials IS NULL OR v_initials = '' THEN
        v_initials := 'GEN';
    END IF;

    -- 3. Calculate next customer mould count matching by customer_id, customer name, OR initials
    SELECT COALESCE(MAX((substring(projectid from '_([0-9]+)$'))::integer), 0) + 1
    INTO v_next_cust_num
    FROM public.scan
    WHERE customer_id = v_cust_id
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

-- 2. Upgrade create_project_with_code to validate customer existence before insert
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
        SELECT id, TRIM(initials), TRIM(customername)
        INTO v_customer_id, v_initials, v_customer_name
        FROM public.customers
        WHERE id = p_cname::integer AND deleted_at IS NULL;
    ELSE
        SELECT id, TRIM(initials), TRIM(customername)
        INTO v_customer_id, v_initials, v_customer_name
        FROM public.customers
        WHERE (LOWER(TRIM(customername)) = LOWER(TRIM(p_cname))
           OR (customer_code IS NOT NULL AND UPPER(TRIM(customer_code)) = UPPER(TRIM(p_cname)))
           OR (pan_code IS NOT NULL AND UPPER(TRIM(pan_code)) = UPPER(TRIM(p_cname))))
          AND deleted_at IS NULL
        LIMIT 1;
    END IF;

    -- Strictly validate that customer exists in customer master before inserting
    IF v_customer_id IS NULL OR v_customer_name IS NULL THEN
        RAISE EXCEPTION 'Customer identifier "%" does not exist in customers master.', p_cname
            USING ERRCODE = '23503'; -- foreign_key_violation
    END IF;

    IF v_initials IS NULL OR v_initials = '' THEN
        v_initials := 'GEN';
    END IF;

    -- 4. Calculate next customer job count matching by customer_id, customer name, OR customer initials in projectid
    SELECT COALESCE(MAX((substring(projectid from '_([0-9]+)$'))::integer), 0) + 1
    INTO v_next_cust_num
    FROM public.scan
    WHERE customer_id = v_customer_id
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

-- 3. Ensure permissions are granted
GRANT EXECUTE ON FUNCTION public.create_project_with_code(text, text, text, date, date, date, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_next_project_code_preview(text) TO service_role, authenticated;
