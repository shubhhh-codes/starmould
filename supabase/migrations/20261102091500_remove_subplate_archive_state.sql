-- Migration: 20261102091500_remove_subplate_archive_state.sql
-- Description: Removes subplate archive / closed_without_challan state completely so plates stay in active state in all conditions.

-- 1. Reset any subplates marked with closed_without_challan or closure metadata
UPDATE public.subplate
SET 
  dispatch_status = NULL,
  closure_reason = NULL,
  closed_at = NULL,
  closed_by = NULL
WHERE dispatch_status = 'closed_without_challan' 
   OR closure_reason IS NOT NULL 
   OR closed_at IS NOT NULL;
