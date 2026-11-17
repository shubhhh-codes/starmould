BEGIN;
-- A deletion can finish while a verified move is switching its pointer. Queue the
-- final soft-delete as well so any newly published object is also removed.
CREATE OR REPLACE FUNCTION public.enqueue_photo_storage_move() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid bigint;
BEGIN
  IF TG_TABLE_NAME='movement_photos' THEN pid:=NEW.id;
  ELSIF TG_OP='DELETE' THEN pid:=OLD.photo_id;
  ELSE pid:=NEW.photo_id; END IF;
  INSERT INTO public.photo_storage_moves(photo_id) SELECT pid WHERE EXISTS(SELECT 1 FROM public.movement_photos WHERE id=pid)
  ON CONFLICT(photo_id) DO UPDATE SET revision=photo_storage_moves.revision+1,retry_at=now(),updated_at=now();
  RETURN NULL;
END $$;
CREATE TRIGGER photo_storage_deleted AFTER UPDATE OF deleted_at ON public.movement_photos
FOR EACH ROW WHEN(OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) EXECUTE FUNCTION public.enqueue_photo_storage_move();
COMMIT;
