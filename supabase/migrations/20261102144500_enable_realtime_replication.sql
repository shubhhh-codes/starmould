-- Enable Supabase Realtime Replication for Core Manufacturing Tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Idempotently add operational tables to the realtime publication
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['scan', 'subplate', 'purchase', 'po_inward', 'challan', 'dispatch'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Check if table exists in public schema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      -- Check if table is not already in the publication
      IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END IF;
  END LOOP;
END $$;
