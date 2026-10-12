-- Migration 003: Remove Payment and Amount Columns from Scan and Print tables
-- Date: 2026-10-05

ALTER TABLE public.scan 
    DROP COLUMN IF EXISTS payment,
    DROP COLUMN IF EXISTS amount;

ALTER TABLE public.print 
    DROP COLUMN IF EXISTS payment,
    DROP COLUMN IF EXISTS amount,
    DROP COLUMN IF EXISTS ramount;
