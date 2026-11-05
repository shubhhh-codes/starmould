
-- Refuse to guess ownership in older databases. Link legacy moulds explicitly first.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.scan WHERE customer_id IS NULL) THEN
    RAISE EXCEPTION 'Link all moulds to customer_id before enabling editable initials';
  END IF;
  IF EXISTS (SELECT 1 FROM public.customers WHERE deleted_at IS NULL
             GROUP BY upper(btrim(initials)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Resolve duplicate customer initials before applying this migration';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_initials_active_unique
  ON public.customers (upper(btrim(initials))) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.guard_customer_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.customer_code IS DISTINCT FROM OLD.customer_code
       OR NEW.pan_code IS DISTINCT FROM OLD.pan_code THEN
      RAISE EXCEPTION 'Customer Code cannot be changed after creation.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.initials IS DISTINCT FROM OLD.initials
     OR (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
    IF NEW.initials IS NULL OR NEW.initials !~ '^[A-Z]{1,5}$' THEN
      RAISE EXCEPTION 'Initials must contain 1–5 letters (A–Z).' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_customer_identity ON public.customers;
CREATE TRIGGER trg_guard_customer_identity BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_identity();

-- Editable customer initials; immutable account codes; numbering by customer identity.
-- No existing initials, customer codes, mould codes, or document records are rewritten.

-- 1. Upgrade get_next_project_code_preview to strictly validate customer existence
CREATE OR REPLACE FUNCTION public.get_next_project_code_preview(
    p_customer_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

    v_cid_str := LPAD(v_next_global_num::text, GREATEST(4, length(v_next_global_num::text)), '0');

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

    -- 3. Find the highest existing mould suffix for this customer ID.
    SELECT COALESCE(MAX((substring(projectid from '_([0-9]+)$'))::integer), 0) + 1
    INTO v_next_cust_num
    FROM public.scan
    WHERE customer_id = v_cust_id;

    v_cust_count_str := LPAD(v_next_cust_num::text, GREATEST(3, length(v_next_cust_num::text)), '0');
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
SET search_path = public, pg_temp
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

    v_cid_str := LPAD(v_next_global_num::text, GREATEST(4, length(v_next_global_num::text)), '0');

    -- 3. Resolve customer ID, Initials, and Human-Readable Company Name
    IF p_cname ~ '^[0-9]+$' THEN
        SELECT id, TRIM(initials), TRIM(customername)
        INTO v_customer_id, v_initials, v_customer_name
        FROM public.customers
        WHERE id = p_cname::integer AND deleted_at IS NULL FOR SHARE;
    ELSE
        SELECT id, TRIM(initials), TRIM(customername)
        INTO v_customer_id, v_initials, v_customer_name
        FROM public.customers
        WHERE (LOWER(TRIM(customername)) = LOWER(TRIM(p_cname))
           OR (customer_code IS NOT NULL AND UPPER(TRIM(customer_code)) = UPPER(TRIM(p_cname)))
           OR (pan_code IS NOT NULL AND UPPER(TRIM(pan_code)) = UPPER(TRIM(p_cname))))
          AND deleted_at IS NULL
        LIMIT 1 FOR SHARE;
    END IF;

    -- Strictly validate that customer exists in customer master before inserting
    IF v_customer_id IS NULL OR v_customer_name IS NULL THEN
        RAISE EXCEPTION 'Customer identifier "%" does not exist in customers master.', p_cname
            USING ERRCODE = '23503'; -- foreign_key_violation
    END IF;

    IF v_initials IS NULL OR v_initials = '' THEN
        v_initials := 'GEN';
    END IF;

    -- 4. Count by stable customer ID; never match another customer's historical initials.
    SELECT COALESCE(MAX((substring(projectid from '_([0-9]+)$'))::integer), 0) + 1
    INTO v_next_cust_num
    FROM public.scan
    WHERE customer_id = v_customer_id;

    v_cust_count_str := LPAD(v_next_cust_num::text, GREATEST(3, length(v_next_cust_num::text)), '0');
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
GRANT EXECUTE ON FUNCTION public.get_next_project_code_preview(text) TO service_role;

REVOKE ALL ON FUNCTION public.create_project_with_code(text, text, text, date, date, date, text, text, integer) FROM PUBLIC, anon, authenticated, app_realtime;
REVOKE ALL ON FUNCTION public.get_next_project_code_preview(text) FROM PUBLIC, anon, authenticated, app_realtime;
REVOKE ALL ON FUNCTION public.guard_customer_identity() FROM PUBLIC, anon, authenticated, app_realtime;
