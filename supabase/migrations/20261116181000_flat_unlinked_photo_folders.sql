BEGIN;
-- Relocate old per-photo folders. The photo ID remains in the filename to avoid collisions.
INSERT INTO public.photo_storage_moves(photo_id)
SELECT id FROM public.movement_photos
WHERE deleted_at IS NULL AND (r2_key LIKE '%/_unlinked-PHOTO-%/%' OR r2_key LIKE '_unlinked/%/PHOTO-%/%')
ON CONFLICT(photo_id) DO UPDATE SET revision=photo_storage_moves.revision+1,retry_at=now(),updated_at=now();
COMMIT;
