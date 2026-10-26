-- Migration 025: Drop subject and reference columns from quotations table
ALTER TABLE public.quotations DROP COLUMN IF EXISTS subject;
ALTER TABLE public.quotations DROP COLUMN IF EXISTS reference;
