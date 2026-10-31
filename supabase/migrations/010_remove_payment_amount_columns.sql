-- Migration 010: Remove Payment and Amount Columns from Scan and Print tables
-- Date: 2026-10-05
-- Description: Drops commercial pricing & payment status columns from scan and print tables

-- 1. Scan Table
ALTER TABLE public.scan 
    DROP COLUMN IF EXISTS payment,
    DROP COLUMN IF EXISTS amount;

-- 2. Print Table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'print') THEN
        ALTER TABLE public.print 
            DROP COLUMN IF EXISTS payment,
            DROP COLUMN IF EXISTS amount,
            DROP COLUMN IF EXISTS ramount;
    END IF;
END $$;
