-- ============================================================================
-- COMPLETE SELF-HEALING SUPABASE SECURITY & SCHEMA MIGRATION
-- Fixes: missing tables, missing columns (voter_token), rls_disabled_in_public, sensitive_columns_exposed
-- ============================================================================

BEGIN;

-- STEP 1: Ensure all required tables exist
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  status TEXT NOT NULL DEFAULT 'setup',
  match_winners JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL,
  name TEXT NOT NULL,
  producer TEXT,
  vintage TEXT,
  price NUMERIC NOT NULL,
  varietal TEXT,
  region TEXT,
  country TEXT,
  style TEXT,
  tasting_notes TEXT,
  image_url TEXT,
  blind_label TEXT,
  revealed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  voter_name TEXT NOT NULL,
  match_id TEXT NOT NULL,
  wine_1_label TEXT NOT NULL,
  wine_2_label TEXT NOT NULL,
  slider_value NUMERIC NOT NULL,
  notes_wine_1 TEXT,
  notes_wine_2 TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.history (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  winner_name TEXT NOT NULL,
  winner_price NUMERIC NOT NULL,
  winner_brought_by TEXT NOT NULL,
  wines_count INTEGER NOT NULL,
  group_winner TEXT NOT NULL,
  second_place TEXT NOT NULL,
  best_value TEXT NOT NULL,
  giant_killer TEXT,
  wines JSONB NOT NULL DEFAULT '[]'::jsonb,
  votes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_name TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  producer TEXT,
  vintage TEXT,
  varietal TEXT,
  region TEXT,
  price NUMERIC,
  source_session_id UUID,
  source_history_id TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- STEP 2: Explicitly add all missing columns to existing tables (prevents 42703 column missing errors)
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS voter_token UUID DEFAULT gen_random_uuid();
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS perceived_price_1 TEXT;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS perceived_price_2 TEXT;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS buy_again_1 TEXT;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS buy_again_2 TEXT;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS acidity_1 NUMERIC;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS acidity_2 NUMERIC;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS body_1 NUMERIC;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS body_2 NUMERIC;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS sweetness_1 NUMERIC;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS sweetness_2 NUMERIC;

ALTER TABLE public.wishlist ADD COLUMN IF NOT EXISTS voter_token UUID DEFAULT gen_random_uuid();

ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS varietal TEXT;
ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS style TEXT;
ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS blind_label TEXT;
ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS revealed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS owner_token UUID;

-- Seed default host passcode if missing
INSERT INTO public.app_settings (key, value) 
VALUES ('host_passcode', '1234') 
ON CONFLICT (key) DO NOTHING;

-- STEP 3: Enable Row Level Security (RLS) on all tables (resolves rls_disabled_in_public)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

-- STEP 4: Lock down app_settings table (resolves sensitive_columns_exposed)
REVOKE ALL ON TABLE public.app_settings FROM PUBLIC, anon, authenticated;

-- Ensure helper functions exist with SECURITY DEFINER and locked search_path
CREATE OR REPLACE FUNCTION public.get_request_header(header_name TEXT)
RETURNS TEXT AS $$
DECLARE
  headers_str TEXT;
BEGIN
  headers_str := current_setting('request.headers', true);
  IF headers_str IS NULL OR headers_str = '' THEN
    RETURN '';
  END IF;
  RETURN COALESCE((headers_str::json)->>header_name, '');
EXCEPTION WHEN OTHERS THEN
  RETURN '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.check_is_host()
RETURNS BOOLEAN AS $$
DECLARE
  passed_code TEXT;
  actual_code TEXT;
BEGIN
  passed_code := public.get_request_header('x-host-passcode');
  IF passed_code IS NULL OR trim(passed_code) = '' THEN
    RETURN false;
  END IF;
  SELECT value INTO actual_code FROM public.app_settings WHERE key = 'host_passcode';
  RETURN COALESCE(passed_code = actual_code, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Grant EXECUTE permission on security functions
CREATE OR REPLACE FUNCTION public.safe_header_uuid(header_name TEXT)
RETURNS UUID AS $$
DECLARE
  raw_val TEXT;
BEGIN
  raw_val := NULLIF(trim(public.get_request_header(header_name)), '');
  IF raw_val IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN raw_val::uuid;
EXCEPTION WHEN invalid_text_representation OR OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_request_header(TEXT) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.safe_header_uuid(TEXT) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_host() TO PUBLIC, anon, authenticated;

-- Ensure server-side token defaults match request header when omitted
ALTER TABLE public.votes ALTER COLUMN voter_token SET DEFAULT COALESCE(public.safe_header_uuid('x-voter-token'), gen_random_uuid());
ALTER TABLE public.wishlist ALTER COLUMN voter_token SET DEFAULT COALESCE(public.safe_header_uuid('x-voter-token'), gen_random_uuid());
ALTER TABLE public.wines ALTER COLUMN owner_token SET DEFAULT COALESCE(public.safe_header_uuid('x-voter-token'), gen_random_uuid());

-- Ensure unique constraint/index exists for atomic vote upserts (dedupe legacy duplicates first)
DELETE FROM public.votes v
USING (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY session_id, voter_name, match_id ORDER BY created_at DESC NULLS LAST, id DESC) AS rn
  FROM public.votes
) dups
WHERE v.id = dups.id AND dups.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS votes_session_voter_match_unique_idx
  ON public.votes (session_id, voter_name, match_id);

-- Prevent guests from altering ownership/session/reveal columns on wines
CREATE OR REPLACE FUNCTION public.enforce_wine_guest_update_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT COALESCE(public.check_is_host(), false) THEN
    IF NEW.session_id IS DISTINCT FROM OLD.session_id
      OR NEW.owner_token IS DISTINCT FROM OLD.owner_token
      OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
      OR NEW.revealed IS DISTINCT FROM OLD.revealed
      OR NEW.blind_label IS DISTINCT FROM OLD.blind_label THEN
      RAISE EXCEPTION 'Guests cannot modify protected wine metadata';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_wine_guest_update_immutability ON public.wines;
CREATE TRIGGER trg_enforce_wine_guest_update_immutability
  BEFORE UPDATE ON public.wines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_wine_guest_update_immutability();

-- STEP 5: Re-enforce clean RLS policies for all tables

-- SESSIONS
DROP POLICY IF EXISTS "Allow public read on sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow host write on sessions" ON public.sessions;
CREATE POLICY "Allow public read on sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Allow host write on sessions" ON public.sessions FOR ALL USING (public.check_is_host());

-- WINES
DROP POLICY IF EXISTS "Allow public read on wines" ON public.wines;
DROP POLICY IF EXISTS "Allow guest insert on wines during setup" ON public.wines;
DROP POLICY IF EXISTS "Allow guest update on wines during setup" ON public.wines;
DROP POLICY IF EXISTS "Allow guest delete on wines during setup" ON public.wines;
DROP POLICY IF EXISTS "Allow host write on wines" ON public.wines;
CREATE POLICY "Allow public read on wines" ON public.wines FOR SELECT USING (true);
CREATE POLICY "Allow guest insert on wines during setup" ON public.wines FOR INSERT
WITH CHECK (
  public.check_is_host()
  OR (
    revealed = false
    AND blind_label IS NULL
    AND public.safe_header_uuid('x-voter-token') IS NOT NULL
    AND owner_token = public.safe_header_uuid('x-voter-token')
    AND EXISTS (
      SELECT 1 FROM public.sessions WHERE id = wines.session_id AND status = 'setup'
    )
  )
);
CREATE POLICY "Allow guest update on wines during setup" ON public.wines FOR UPDATE
USING (
  (
    owner_token IS NOT NULL
    AND owner_token = public.safe_header_uuid('x-voter-token')
    AND revealed = false
    AND EXISTS (
      SELECT 1 FROM public.sessions WHERE id = wines.session_id AND status = 'setup'
    )
  )
  OR public.check_is_host()
)
WITH CHECK (
  (
    owner_token IS NOT NULL
    AND owner_token = public.safe_header_uuid('x-voter-token')
    AND revealed = false
    AND blind_label IS NULL
    AND EXISTS (
      SELECT 1 FROM public.sessions WHERE id = wines.session_id AND status = 'setup'
    )
  )
  OR public.check_is_host()
);
CREATE POLICY "Allow guest delete on wines during setup" ON public.wines FOR DELETE
USING (
  (
    owner_token IS NOT NULL
    AND owner_token = public.safe_header_uuid('x-voter-token')
    AND revealed = false
    AND EXISTS (
      SELECT 1 FROM public.sessions WHERE id = wines.session_id AND status = 'setup'
    )
  )
  OR public.check_is_host()
);
CREATE POLICY "Allow host write on wines" ON public.wines FOR ALL USING (public.check_is_host());

-- VOTES
DROP POLICY IF EXISTS "Allow public read on votes" ON public.votes;
DROP POLICY IF EXISTS "Allow public insert on votes" ON public.votes;
DROP POLICY IF EXISTS "Allow authenticated voter insert on votes" ON public.votes;
DROP POLICY IF EXISTS "Allow voter update on votes" ON public.votes;
DROP POLICY IF EXISTS "Allow voter or host delete on votes" ON public.votes;
CREATE POLICY "Allow public read on votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Allow authenticated voter insert on votes" ON public.votes FOR INSERT
WITH CHECK (
  public.safe_header_uuid('x-voter-token') IS NOT NULL
  AND voter_token = public.safe_header_uuid('x-voter-token')
);
CREATE POLICY "Allow voter update on votes" ON public.votes FOR UPDATE 
  USING (public.safe_header_uuid('x-voter-token') IS NOT NULL AND voter_token = public.safe_header_uuid('x-voter-token'))
  WITH CHECK (public.safe_header_uuid('x-voter-token') IS NOT NULL AND voter_token = public.safe_header_uuid('x-voter-token'));
CREATE POLICY "Allow voter or host delete on votes" ON public.votes FOR DELETE 
  USING ((public.safe_header_uuid('x-voter-token') IS NOT NULL AND voter_token = public.safe_header_uuid('x-voter-token')) OR public.check_is_host());

-- HISTORY
DROP POLICY IF EXISTS "Allow public read on history" ON public.history;
DROP POLICY IF EXISTS "Allow host write on history" ON public.history;
CREATE POLICY "Allow public read on history" ON public.history FOR SELECT USING (true);
CREATE POLICY "Allow host write on history" ON public.history FOR ALL USING (public.check_is_host());

-- WISHLIST
DROP POLICY IF EXISTS "Allow public read on wishlist" ON public.wishlist;
DROP POLICY IF EXISTS "Allow public insert on wishlist" ON public.wishlist;
DROP POLICY IF EXISTS "Allow owner insert on wishlist" ON public.wishlist;
DROP POLICY IF EXISTS "Allow owner update on wishlist" ON public.wishlist;
DROP POLICY IF EXISTS "Allow owner delete on wishlist" ON public.wishlist;
CREATE POLICY "Allow public read on wishlist" ON public.wishlist FOR SELECT USING (true);
CREATE POLICY "Allow owner insert on wishlist" ON public.wishlist FOR INSERT
WITH CHECK (
  public.safe_header_uuid('x-voter-token') IS NOT NULL
  AND voter_token = public.safe_header_uuid('x-voter-token')
);
CREATE POLICY "Allow owner update on wishlist" ON public.wishlist FOR UPDATE
  USING (public.safe_header_uuid('x-voter-token') IS NOT NULL AND voter_token = public.safe_header_uuid('x-voter-token'))
  WITH CHECK (public.safe_header_uuid('x-voter-token') IS NOT NULL AND voter_token = public.safe_header_uuid('x-voter-token'));
CREATE POLICY "Allow owner delete on wishlist" ON public.wishlist FOR DELETE
  USING ((public.safe_header_uuid('x-voter-token') IS NOT NULL AND voter_token = public.safe_header_uuid('x-voter-token')) OR public.check_is_host());

-- Column-level SELECT hardening so bearer tokens cannot be harvested via REST API
REVOKE SELECT ON TABLE public.wines FROM anon, authenticated;
GRANT SELECT (id, session_id, submitted_by, name, producer, vintage, price, varietal, region, country, style, tasting_notes, image_url, blind_label, revealed, created_at) ON TABLE public.wines TO anon, authenticated;

REVOKE SELECT ON TABLE public.votes FROM anon, authenticated;
GRANT SELECT (id, session_id, voter_name, match_id, wine_1_label, wine_2_label, slider_value, notes_wine_1, notes_wine_2, created_at) ON TABLE public.votes TO anon, authenticated;

REVOKE SELECT ON TABLE public.wishlist FROM anon, authenticated;
GRANT SELECT (id, voter_name, wine_name, producer, vintage, varietal, region, price, source_session_id, source_history_id, note, created_at) ON TABLE public.wishlist TO anon, authenticated;

-- APP SETTINGS
DROP POLICY IF EXISTS "Deny direct read on app_settings" ON public.app_settings;

COMMIT;
