-- Migration 009: Fix RLS role helper to never default unauthenticated/no-JWT requests to Admin (0)
-- Replaces default 0 with NULL so non-authenticated users get zero privileged access.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS integer AS $$
BEGIN
  RETURN COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role_id')::integer,
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role_id')::integer,
    NULL -- Safe fallback: never default to Admin (0)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
