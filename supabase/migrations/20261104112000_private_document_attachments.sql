CREATE TABLE public.document_attachments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text NOT NULL CHECK (bucket IN ('subplate-photos','mould-attachments','general-attachments')),
  path text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('subplate','sample','purchase','quotation','challan','dispatch','inward','work','expense')),
  document_id bigint NOT NULL CHECK (document_id>0),
  uploaded_by bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bucket,path)
);
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_attachments FROM PUBLIC, anon, authenticated, app_realtime;
GRANT ALL ON public.document_attachments TO service_role;
GRANT USAGE ON SEQUENCE public.document_attachments_id_seq TO service_role;

-- Existing objects are preserved, but no historical document ownership is guessed/backfilled.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
SELECT id,id,false,5242880,ARRAY['image/jpeg','image/png','image/webp','image/gif']
FROM unnest(ARRAY['subplate-photos','mould-attachments','general-attachments']) id
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=EXCLUDED.allowed_mime_types;

-- Restrictive policy also defeats any older broad permissive object policy. Service role bypasses RLS.
CREATE POLICY business_attachments_private ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated,app_realtime
USING (bucket_id NOT IN ('subplate-photos','mould-attachments','general-attachments','database-backups'))
WITH CHECK (bucket_id NOT IN ('subplate-photos','mould-attachments','general-attachments','database-backups'));
