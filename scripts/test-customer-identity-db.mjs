// Exercises the migration in one transaction, always rolled back.
// Existing customer initials are never edited; only temporary test customers are used.
import fs from 'node:fs';
import { query } from './db_helper.mjs';

const migration = fs.readFileSync(new URL('../supabase/migrations/20261105180000_editable_customer_initials.sql', import.meta.url), 'utf8');
const fingerprintSql = `SELECT
  (SELECT md5(coalesce(string_agg(id::text || ':' || initials || ':' || coalesce(customer_code,'') || ':' || coalesce(pan_code,''), ',' ORDER BY id),'')) FROM public.customers) AS customers,
  (SELECT md5(coalesce(string_agg(id::text || ':' || projectid, ',' ORDER BY id),'')) FROM public.scan) AS moulds`;
const before = (await query(fingerprintSql)).rows[0];
await query(`BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';
${migration}
-- Avoid advancing real identity sequences, even during rolled-back tests.
CREATE TEMP SEQUENCE identity_test_scan_ids INCREMENT -1 MINVALUE -2147000000 MAXVALUE -1 START -1000000;
ALTER TABLE public.scan ALTER COLUMN id SET DEFAULT nextval('pg_temp.identity_test_scan_ids');
DO $$
DECLARE
  first_project jsonb;
  second_project jsonb;
  other_project jsonb;
  preview jsonb;
BEGIN
  INSERT INTO public.customers(id, customername, initials, customer_code, pan_code, usertype)
  VALUES (-2147000000, 'Identity test A', 'ZZQAA', 'IDENTITY-TEST-A', 'IDENTITY-TEST-A', 'Customer');

  first_project := public.create_project_with_code('IDENTITY-TEST-A', 'Identity test first mould');
  IF first_project->>'projectid' NOT LIKE '%_ZZQAA_001' THEN RAISE EXCEPTION 'Unexpected first project code'; END IF;
  UPDATE public.customers SET initials = 'ZZQAB' WHERE id = -2147000000;
  preview := public.get_next_project_code_preview('IDENTITY-TEST-A');
  IF preview->>'custCountStr' <> '002' OR preview->>'initials' <> 'ZZQAB' THEN
    RAISE EXCEPTION 'Initials edit reset numbering or preview retained old initials';
  END IF;
  second_project := public.create_project_with_code('IDENTITY-TEST-A', 'Identity test second mould');
  IF second_project->>'projectid' <> preview->>'projectid' THEN RAISE EXCEPTION 'Preview and creation disagree'; END IF;
  IF (SELECT projectid FROM public.scan WHERE id = (first_project->>'id')::bigint) <> first_project->>'projectid' THEN
    RAISE EXCEPTION 'Historical mould code was rewritten';
  END IF;

  INSERT INTO public.customers(id, customername, initials, customer_code, pan_code, usertype)
  VALUES (-2146999999, 'Identity test B', 'ZZQAA', 'IDENTITY-TEST-B', 'IDENTITY-TEST-B', 'Customer');
  other_project := public.create_project_with_code('IDENTITY-TEST-B', 'Initials reuse test');
  IF other_project->>'projectid' NOT LIKE '%_ZZQAA_001' THEN RAISE EXCEPTION 'Reused initials mixed customer counters'; END IF;

  BEGIN
    UPDATE public.customers SET initials = 'ZZQAA' WHERE id = -2147000000;
    RAISE EXCEPTION 'Duplicate initials accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.customers SET initials = 'AB1' WHERE id = -2147000000;
    RAISE EXCEPTION 'Invalid initials accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.customers SET customer_code = 'CHANGED' WHERE id = -2147000000;
    RAISE EXCEPTION 'Customer code changed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.customers SET pan_code = 'CHANGED' WHERE id = -2147000000;
    RAISE EXCEPTION 'Customer code alias changed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE public.customers SET mobile = '9876543210' WHERE id = -2147000000;
  IF (SELECT initials FROM public.customers WHERE id = -2147000000) <> 'ZZQAB' THEN RAISE EXCEPTION 'Ordinary edit changed initials'; END IF;

  -- The original customer's counter is independent of the second customer.
  preview := public.get_next_project_code_preview('IDENTITY-TEST-A');
  IF preview->>'custCountStr' <> '003' THEN RAISE EXCEPTION 'Deleted mould counter reused'; END IF;

  -- Padding must not truncate 1000 to 100 or 10000 to 1000.
  UPDATE public.scan SET projectid = '10000_ZZQAB_1000' WHERE id = (second_project->>'id')::bigint;
  preview := public.get_next_project_code_preview('IDENTITY-TEST-A');
  IF preview->>'custCountStr' <> '1001' OR length(preview->>'cidStr') < 5 THEN RAISE EXCEPTION 'Sequence overflow truncated'; END IF;
  IF (public.get_next_project_code_preview('MISSING-IDENTITY-TEST')->>'isComplete')::boolean THEN RAISE EXCEPTION 'Missing customer accepted'; END IF;
END;
$$;
ROLLBACK;`);
const after = (await query(fingerprintSql)).rows[0];
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Customer or mould identity changed during verification');
console.log('Database migration test passed; all test writes rolled back and existing identities unchanged.');
