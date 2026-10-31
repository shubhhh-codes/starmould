-- 20261031130000_protect_akshay_and_atomic_expense_rpc.sql
-- System Protection: Protect Akshay account and provide atomic advisory-locked expense procedure

-- 1. Upgrade trigger to protect both Super Admin and Akshay
CREATE OR REPLACE FUNCTION prevent_super_admin_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.id::text = '1' 
       OR OLD.id::text = '2'
       OR LOWER(COALESCE(OLD.username, '')) = 'admin' 
       OR LOWER(COALESCE(OLD.email, '')) = 'admin@star.in' 
       OR LOWER(COALESCE(OLD.username, '')) = 'akshay'
       OR LOWER(COALESCE(OLD.email, '')) = 'akshay@star.in'
    THEN
      RAISE EXCEPTION 'CRITICAL SECURITY ERROR: Protected system account (Admin / Akshay) is permanently locked and cannot be deleted from the database.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.id::text = '1' 
        OR OLD.id::text = '2'
        OR LOWER(COALESCE(OLD.username, '')) = 'admin' 
        OR LOWER(COALESCE(OLD.email, '')) = 'admin@star.in'
        OR LOWER(COALESCE(OLD.username, '')) = 'akshay'
        OR LOWER(COALESCE(OLD.email, '')) = 'akshay@star.in')
       AND (NEW.deleted_at IS NOT NULL OR NEW.status = 0)
    THEN
      RAISE EXCEPTION 'CRITICAL SECURITY ERROR: Protected system account (Admin / Akshay) cannot be deactivated or soft-deleted.'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Atomic Expense Ledger Stored Procedure with Transaction-Level Advisory Lock
CREATE OR REPLACE FUNCTION public.create_expense_entry(
    p_rdate date,
    p_customerid integer,
    p_description text,
    p_payment_type text,
    p_payment_mode text,
    p_amount numeric,
    p_user_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev_balance numeric := 0;
    v_new_balance numeric := 0;
    v_new_row record;
BEGIN
    -- Acquire exclusive transaction-level advisory lock on expense ledger
    PERFORM pg_advisory_xact_lock(hashtext('expense_ledger_mutation'));

    -- Fetch the exact latest cumulative balance
    SELECT COALESCE(balance, 0)
    INTO v_prev_balance
    FROM public.expense
    ORDER BY id DESC
    LIMIT 1;

    IF p_payment_type = 'Credit' THEN
        v_new_balance := v_prev_balance + p_amount;
    ELSIF p_payment_type = 'Debit' THEN
        v_new_balance := v_prev_balance - p_amount;
    ELSE
        -- Outstanding preserves cash balance
        v_new_balance := v_prev_balance;
    END IF;

    INSERT INTO public.expense (
        rdate,
        customerid,
        description,
        payment_type,
        payment_mode,
        amount,
        balance,
        created_at,
        updated_at
    ) VALUES (
        COALESCE(p_rdate, CURRENT_DATE),
        COALESCE(p_customerid, 0),
        COALESCE(NULLIF(TRIM(p_description), ''), 'expense'),
        COALESCE(p_payment_type, 'Debit'),
        COALESCE(NULLIF(TRIM(p_payment_mode), ''), 'Cash'),
        p_amount,
        v_new_balance,
        NOW(),
        NOW()
    )
    RETURNING * INTO v_new_row;

    RETURN to_jsonb(v_new_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_expense_entry(date, integer, text, text, text, numeric, integer) TO service_role;
