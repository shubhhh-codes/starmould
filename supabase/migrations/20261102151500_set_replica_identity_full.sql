-- Migration: Set REPLICA IDENTITY FULL on all core operational tables
-- Purpose: Ensures PostgreSQL WAL includes complete old row data on DELETE operations.
-- This enables Supabase Realtime WebSocket engine to evaluate Row-Level Security (RLS) policies 
-- without dropping DELETE events, enabling sub-50ms instant real-time synchronization across all tabs and devices.

ALTER TABLE public.scan REPLICA IDENTITY FULL;
ALTER TABLE public.subplate REPLICA IDENTITY FULL;
ALTER TABLE public.purchase REPLICA IDENTITY FULL;
ALTER TABLE public.po_inward REPLICA IDENTITY FULL;
ALTER TABLE public.challan REPLICA IDENTITY FULL;
ALTER TABLE public.dispatch REPLICA IDENTITY FULL;
