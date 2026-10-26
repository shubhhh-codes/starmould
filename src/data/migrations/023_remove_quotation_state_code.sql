-- Migration: Remove state_code column from quotations table
-- Applied directly to Supabase PostgreSQL database

ALTER TABLE quotations DROP COLUMN IF EXISTS state_code;
