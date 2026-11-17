BEGIN;
CREATE TABLE public.photo_storage_moves (
  photo_id bigint PRIMARY KEY REFERENCES public.movement_photos(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 1,
  applied_revision bigint NOT NULL DEFAULT 0,
  lease_token uuid,
  leased_until timestamptz,
  retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.photo_storage_old_keys (
  object_key text PRIMARY KEY,
  photo_id bigint NOT NULL REFERENCES public.movement_photos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.photo_storage_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_storage_old_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.photo_storage_moves,public.photo_storage_old_keys FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.photo_storage_moves,public.photo_storage_old_keys TO service_role;

CREATE FUNCTION public.enqueue_photo_storage_move() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid bigint;
BEGIN
  IF TG_TABLE_NAME='movement_photos' THEN pid:=NEW.id;
  ELSIF TG_OP='DELETE' THEN pid:=OLD.photo_id;
  ELSE pid:=NEW.photo_id; END IF;
  INSERT INTO public.photo_storage_moves(photo_id) SELECT pid WHERE EXISTS(SELECT 1 FROM public.movement_photos WHERE id=pid AND deleted_at IS NULL)
  ON CONFLICT(photo_id) DO UPDATE SET revision=photo_storage_moves.revision+1,retry_at=now(),updated_at=now();
  RETURN NULL;
END $$;
CREATE TRIGGER photo_storage_insert AFTER INSERT ON public.movement_photos FOR EACH ROW EXECUTE FUNCTION public.enqueue_photo_storage_move();
CREATE TRIGGER photo_storage_stage AFTER UPDATE OF subplate_id,stage_key,movement_type ON public.movement_photos FOR EACH ROW EXECUTE FUNCTION public.enqueue_photo_storage_move();
CREATE TRIGGER photo_storage_project AFTER INSERT OR UPDATE OR DELETE ON public.photo_project_associations FOR EACH ROW EXECUTE FUNCTION public.enqueue_photo_storage_move();
CREATE TRIGGER photo_storage_event AFTER INSERT OR UPDATE OR DELETE ON public.photo_event_associations FOR EACH ROW EXECUTE FUNCTION public.enqueue_photo_storage_move();

CREATE FUNCTION public.claim_photo_storage_move(p_ids bigint[] DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.photo_storage_moves; p public.movement_photos;
BEGIN
  SELECT * INTO j FROM public.photo_storage_moves WHERE retry_at<=now() AND (leased_until IS NULL OR leased_until<now())
    AND (revision>applied_revision OR EXISTS(SELECT 1 FROM public.photo_storage_old_keys k WHERE k.photo_id=photo_storage_moves.photo_id))
    AND (p_ids IS NULL OR photo_id=ANY(p_ids)) ORDER BY updated_at,photo_id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.photo_storage_moves SET lease_token=gen_random_uuid(),leased_until=now()+interval '1 hour' WHERE photo_id=j.photo_id RETURNING * INTO j;
  SELECT * INTO p FROM public.movement_photos WHERE id=j.photo_id;
  RETURN jsonb_build_object('photo',to_jsonb(p),'token',j.lease_token,'revision',j.revision);
END $$;

-- The pointer and retry identity change in one transaction, only after verified copy.
CREATE FUNCTION public.prepare_photo_storage_move(p_id bigint,p_token uuid,p_target text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM 1 FROM public.photo_storage_moves WHERE photo_id=p_id AND lease_token=p_token AND leased_until>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.photo_storage_old_keys(object_key,photo_id) VALUES(p_target,p_id) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.prepare_photo_storage_move(bigint,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_photo_storage_move(bigint,uuid,text) TO service_role;

CREATE FUNCTION public.finish_photo_storage_move(p_id bigint,p_token uuid,p_revision bigint,p_old text,p_new text,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.photo_storage_moves; p public.movement_photos;
BEGIN
  SELECT * INTO j FROM public.photo_storage_moves WHERE photo_id=p_id FOR UPDATE;
  IF NOT FOUND OR j.lease_token IS DISTINCT FROM p_token OR j.leased_until<=now() THEN RETURN false; END IF;
  SELECT * INTO p FROM public.movement_photos WHERE id=p_id FOR UPDATE;
  IF p_error IS NOT NULL THEN
    IF p_new<>p_old THEN INSERT INTO public.photo_storage_old_keys(object_key,photo_id) VALUES(p_new,p_id) ON CONFLICT DO NOTHING; END IF;
    UPDATE public.photo_storage_moves SET lease_token=NULL,leased_until=NULL,retry_at=now()+interval '5 minutes',last_error=left(p_error,1000) WHERE photo_id=p_id;
    RETURN false;
  END IF;
  IF p.deleted_at IS NOT NULL OR p.r2_key IS DISTINCT FROM p_old OR j.revision<>p_revision THEN
    IF p_new<>p_old THEN INSERT INTO public.photo_storage_old_keys(object_key,photo_id) VALUES(p_new,p_id) ON CONFLICT DO NOTHING; END IF;
    IF p.deleted_at IS NOT NULL THEN UPDATE public.photo_storage_moves SET applied_revision=revision WHERE photo_id=p_id; END IF;
    RETURN false;
  END IF;
  UPDATE public.movement_photos SET r2_key=p_new WHERE id=p_id;
  UPDATE public.photo_upload_attempts SET reserved_r2_key=p_new WHERE photo_id=p_id;
  DELETE FROM public.photo_storage_old_keys WHERE object_key=p_new AND photo_id=p_id;
  IF p_new<>p_old THEN INSERT INTO public.photo_storage_old_keys(object_key,photo_id) VALUES(p_old,p_id) ON CONFLICT DO NOTHING; END IF;
  UPDATE public.photo_storage_moves SET applied_revision=p_revision,last_error=NULL WHERE photo_id=p_id;
  RETURN true;
END $$;
CREATE FUNCTION public.release_photo_storage_move(p_id bigint,p_token uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.photo_storage_moves SET lease_token=NULL,leased_until=NULL,
    retry_at=CASE WHEN revision>applied_revision THEN now() ELSE now()+interval '1 minute' END
  WHERE photo_id=p_id AND lease_token=p_token;
$$;
REVOKE ALL ON FUNCTION public.release_photo_storage_move(bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_photo_storage_move(bigint,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.enqueue_photo_storage_move(), public.claim_photo_storage_move(bigint[]), public.finish_photo_storage_move(bigint,uuid,bigint,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_photo_storage_move(bigint[]), public.finish_photo_storage_move(bigint,uuid,bigint,text,text,text) TO service_role;
INSERT INTO public.photo_storage_moves(photo_id) SELECT id FROM public.movement_photos WHERE deleted_at IS NULL;
NOTIFY pgrst,'reload schema';
COMMIT;
