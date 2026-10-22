-- Migration 011: Drop unused legacy ghost tables
-- Dropping gram_calc (Gram Master), print (3D Printing), and scanning_models (ghost table)

DROP TABLE IF EXISTS public.gram_calc CASCADE;
DROP TABLE IF EXISTS public.print CASCADE;
DROP TABLE IF EXISTS public.scanning_models CASCADE;
