CREATE TABLE IF NOT EXISTS public.login_budgets (
  identifier_hash text PRIMARY KEY CHECK (identifier_hash ~ '^[a-f0-9]{64}$'),
  attempts integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL,
  blocked_until timestamptz,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS login_budgets_expiry ON public.login_budgets(expires_at);
ALTER TABLE public.login_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_budgets FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_login_budget(p_keys text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  k text;
  budget public.login_budgets;
  at_time timestamptz := clock_timestamp();
  retry integer := 0;
BEGIN
  IF cardinality(p_keys) <> 2 OR EXISTS (SELECT 1 FROM unnest(p_keys) key WHERE key !~ '^[a-f0-9]{64}$') THEN
    RAISE EXCEPTION 'Invalid budget identifiers';
  END IF;
  DELETE FROM public.login_budgets WHERE expires_at < at_time;
  -- Stable ordering serializes every shared account/IP across application replicas.
  FOR k IN SELECT DISTINCT key FROM unnest(p_keys) key ORDER BY key LOOP
    INSERT INTO public.login_budgets(identifier_hash, window_start, expires_at)
      VALUES (k, at_time, at_time + interval '45 minutes') ON CONFLICT DO NOTHING;
    SELECT * INTO budget FROM public.login_budgets WHERE identifier_hash = k FOR UPDATE;
    IF budget.blocked_until > at_time THEN
      retry := greatest(retry, ceil(extract(epoch FROM budget.blocked_until - at_time))::integer);
    ELSIF budget.window_start + interval '15 minutes' <= at_time THEN
      UPDATE public.login_budgets SET attempts = 0, window_start = at_time, blocked_until = NULL
        WHERE identifier_hash = k;
    END IF;
  END LOOP;
  IF retry > 0 THEN RETURN jsonb_build_object('allowed', false, 'retry_after', retry); END IF;
  UPDATE public.login_budgets SET attempts = attempts + 1,
    blocked_until = CASE WHEN attempts + 1 >= 10 THEN at_time + interval '30 minutes' ELSE NULL END,
    expires_at = at_time + interval '45 minutes'
    WHERE identifier_hash = ANY(p_keys);
  RETURN jsonb_build_object('allowed', true, 'retry_after', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_login_budget(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_login_budget(text[]) TO service_role;
