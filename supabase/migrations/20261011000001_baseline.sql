-- Baseline schema for Smart730 (self-hosted Supabase).
-- Every user-owned row and file is scoped to auth.uid(); anon has no access.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tax declarations ---------------------------------------------------------

CREATE TABLE public.tax_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  year integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'submitted')),
  quadro_a_data jsonb,
  quadro_b_data jsonb,
  quadro_c_data jsonb,
  quadro_d_data jsonb,
  quadro_e_data jsonb,
  quadro_f_data jsonb,
  quadro_g_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year)
);

ALTER TABLE public.tax_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tax declarations"
ON public.tax_declarations FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users insert own tax declarations"
ON public.tax_declarations FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users update own tax declarations"
ON public.tax_declarations FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users delete own tax declarations"
ON public.tax_declarations FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE TRIGGER update_tax_declarations_updated_at
BEFORE UPDATE ON public.tax_declarations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- GAIA knowledge base (read-only for signed-in users) ----------------------

CREATE TABLE public.gaia_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  question text NOT NULL,
  answer_simple text NOT NULL,
  answer_technical text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  sources jsonb,
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gaia_kb_keywords ON public.gaia_knowledge_base USING gin (keywords);

ALTER TABLE public.gaia_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read active knowledge base"
ON public.gaia_knowledge_base FOR SELECT TO authenticated
USING (active);

CREATE TRIGGER update_gaia_knowledge_base_updated_at
BEFORE UPDATE ON public.gaia_knowledge_base
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage: private per-user folders ({uid}/file) ---------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cu-documents', 'cu-documents', false, 10485760, ARRAY['application/pdf']);

CREATE POLICY "Users read own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cu-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Users upload own files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cu-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Users delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cu-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
