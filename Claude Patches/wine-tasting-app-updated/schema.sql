-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS wines CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS history CASCADE;
DROP TABLE IF EXISTS wishlist CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;

-- Helper functions to safely extract request headers and UUID tokens before table creation
CREATE OR REPLACE FUNCTION get_request_header(header_name TEXT)
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

-- Safe UUID parser for RLS policies (never raises 22P02 on missing or malformed header)
CREATE OR REPLACE FUNCTION safe_header_uuid(header_name TEXT)
RETURNS UUID AS $$
DECLARE
  raw_val TEXT;
BEGIN
  raw_val := NULLIF(trim(get_request_header(header_name)), '');
  IF raw_val IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN raw_val::uuid;
EXCEPTION WHEN invalid_text_representation OR OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Sessions table: tracks individual tasting events (e.g. Day de Rosé, Rumble di Reds)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  status TEXT NOT NULL DEFAULT 'setup', -- 'setup', 'tasting', 'completed'
  match_winners JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g., {"Q1": "A", "Q2": "D"}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Wines table: tracks wines brought by couples, and random blind letters assigned
CREATE TABLE wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL,
  name TEXT NOT NULL,
  producer TEXT,
  vintage TEXT,
  price NUMERIC NOT NULL,
  varietal TEXT,
  region TEXT,
  country TEXT,
  style TEXT, -- e.g. 'Red - Full-bodied', 'Rosé', 'Sparkling'
  tasting_notes TEXT,
  image_url TEXT,
  blind_label TEXT, -- 'A', 'B', 'C', ..., 'H'
  revealed BOOLEAN NOT NULL DEFAULT false,
  owner_token UUID DEFAULT COALESCE(
    safe_header_uuid('x-voter-token'),
    gen_random_uuid()
  ),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Votes table: tracks individual tastings of blind pairings
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  voter_name TEXT NOT NULL,
  match_id TEXT NOT NULL, -- e.g., 'Q1', 'Q2', 'Q3', 'Q4', 'S1', 'S2', 'F'
  wine_1_label TEXT NOT NULL,
  wine_2_label TEXT NOT NULL,
  slider_value NUMERIC NOT NULL, -- 0-100 (0 = 100% wine_1, 100 = 100% wine_2, 50 = tie)
  notes_wine_1 TEXT,
  notes_wine_2 TEXT,
  voter_token UUID NOT NULL DEFAULT COALESCE(
    safe_header_uuid('x-voter-token'),
    gen_random_uuid()
  ),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  CONSTRAINT votes_session_voter_match_unique UNIQUE (session_id, voter_name, match_id)
);

-- History table: tracks completed tournament archives
CREATE TABLE history (
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

-- App Settings table: stores app configuration parameters (like the host passcode)
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed default host passcode
INSERT INTO app_settings (key, value) VALUES ('host_passcode', '1234') ON CONFLICT (key) DO NOTHING;

-- Enable Row Level Security on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Revoke all direct permissions on app_settings from public/anon/authenticated
-- This makes it impossible for public roles to read app_settings directly via REST API
REVOKE ALL ON TABLE app_settings FROM PUBLIC, anon, authenticated;

-- Security Definer function to check host passcode
CREATE OR REPLACE FUNCTION check_is_host()
RETURNS BOOLEAN AS $$
DECLARE
  passed_code TEXT;
  actual_code TEXT;
BEGIN
  passed_code := get_request_header('x-host-passcode');
  IF passed_code IS NULL OR trim(passed_code) = '' THEN
    RETURN false;
  END IF;
  SELECT value INTO actual_code FROM app_settings WHERE key = 'host_passcode';
  RETURN COALESCE(passed_code = actual_code, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION get_request_header(TEXT) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION safe_header_uuid(TEXT) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION check_is_host() TO PUBLIC, anon, authenticated;

-- Prevent guests from altering ownership/session/reveal columns on wines
CREATE OR REPLACE FUNCTION enforce_wine_guest_update_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT COALESCE(check_is_host(), false) THEN
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

CREATE TRIGGER trg_enforce_wine_guest_update_immutability
  BEFORE UPDATE ON wines
  FOR EACH ROW
  EXECUTE FUNCTION enforce_wine_guest_update_immutability();

-- RLS Policies for sessions
CREATE POLICY "Allow public read on sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Allow host write on sessions" ON sessions FOR ALL USING (check_is_host());

-- RLS Policies for wines (restrict guest inserts/edits/deletes to own unrevealed wines in setup)
CREATE POLICY "Allow public read on wines" ON wines FOR SELECT USING (true);
CREATE POLICY "Allow guest insert on wines during setup" ON wines FOR INSERT 
WITH CHECK (
  check_is_host()
  OR (
    revealed = false
    AND blind_label IS NULL
    AND safe_header_uuid('x-voter-token') IS NOT NULL
    AND owner_token = safe_header_uuid('x-voter-token')
    AND EXISTS (
      SELECT 1 FROM sessions WHERE id = wines.session_id AND status = 'setup'
    )
  )
);
CREATE POLICY "Allow guest update on wines during setup" ON wines FOR UPDATE
USING (
  (
    owner_token IS NOT NULL
    AND owner_token = safe_header_uuid('x-voter-token')
    AND revealed = false
    AND EXISTS (
      SELECT 1 FROM sessions WHERE id = wines.session_id AND status = 'setup'
    )
  )
  OR check_is_host()
)
WITH CHECK (
  (
    owner_token IS NOT NULL
    AND owner_token = safe_header_uuid('x-voter-token')
    AND revealed = false
    AND blind_label IS NULL
    AND EXISTS (
      SELECT 1 FROM sessions WHERE id = wines.session_id AND status = 'setup'
    )
  )
  OR check_is_host()
);
CREATE POLICY "Allow guest delete on wines during setup" ON wines FOR DELETE
USING (
  (
    owner_token IS NOT NULL
    AND owner_token = safe_header_uuid('x-voter-token')
    AND revealed = false
    AND EXISTS (
      SELECT 1 FROM sessions WHERE id = wines.session_id AND status = 'setup'
    )
  )
  OR check_is_host()
);
CREATE POLICY "Allow host write on wines" ON wines FOR ALL USING (check_is_host());

-- RLS Policies for votes
CREATE POLICY "Allow public read on votes" ON votes FOR SELECT USING (true);
CREATE POLICY "Allow authenticated voter insert on votes" ON votes FOR INSERT 
WITH CHECK (
  safe_header_uuid('x-voter-token') IS NOT NULL
  AND voter_token = safe_header_uuid('x-voter-token')
);
CREATE POLICY "Allow voter update on votes" ON votes FOR UPDATE 
USING (
  safe_header_uuid('x-voter-token') IS NOT NULL
  AND voter_token = safe_header_uuid('x-voter-token')
)
WITH CHECK (
  safe_header_uuid('x-voter-token') IS NOT NULL
  AND voter_token = safe_header_uuid('x-voter-token')
);
CREATE POLICY "Allow voter or host delete on votes" ON votes FOR DELETE 
USING (
  (safe_header_uuid('x-voter-token') IS NOT NULL AND voter_token = safe_header_uuid('x-voter-token'))
  OR check_is_host()
);

-- RLS Policies for history
CREATE POLICY "Allow public read on history" ON history FOR SELECT USING (true);
CREATE POLICY "Allow host write on history" ON history FOR ALL USING (check_is_host());

-- Wishlist table: personal "buy again" lists, scoped per voter via voter_token
CREATE TABLE wishlist (
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
  voter_token UUID NOT NULL DEFAULT COALESCE(
    safe_header_uuid('x-voter-token'),
    gen_random_uuid()
  ),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on wishlist"   ON wishlist FOR SELECT USING (true);
CREATE POLICY "Allow owner insert on wishlist"  ON wishlist FOR INSERT 
WITH CHECK (
  safe_header_uuid('x-voter-token') IS NOT NULL
  AND voter_token = safe_header_uuid('x-voter-token')
);
CREATE POLICY "Allow owner update on wishlist"  ON wishlist FOR UPDATE
  USING (safe_header_uuid('x-voter-token') IS NOT NULL AND voter_token = safe_header_uuid('x-voter-token'))
  WITH CHECK (safe_header_uuid('x-voter-token') IS NOT NULL AND voter_token = safe_header_uuid('x-voter-token'));
CREATE POLICY "Allow owner delete on wishlist"  ON wishlist FOR DELETE
  USING (
    (safe_header_uuid('x-voter-token') IS NOT NULL AND voter_token = safe_header_uuid('x-voter-token'))
    OR check_is_host()
  );

-- Column-level SELECT hardening so bearer tokens cannot be harvested via REST API
REVOKE SELECT ON TABLE wines FROM anon, authenticated;
GRANT SELECT (id, session_id, submitted_by, name, producer, vintage, price, varietal, region, country, style, tasting_notes, image_url, blind_label, revealed, created_at) ON TABLE wines TO anon, authenticated;

REVOKE SELECT ON TABLE votes FROM anon, authenticated;
GRANT SELECT (id, session_id, voter_name, match_id, wine_1_label, wine_2_label, slider_value, notes_wine_1, notes_wine_2, created_at) ON TABLE votes TO anon, authenticated;

REVOKE SELECT ON TABLE wishlist FROM anon, authenticated;
GRANT SELECT (id, voter_name, wine_name, producer, vintage, varietal, region, price, source_session_id, source_history_id, note, created_at) ON TABLE wishlist TO anon, authenticated;

-- Enable Realtime subscriptions on all active tables
-- (If publication supabase_realtime doesn't exist, we fallback)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
    ALTER PUBLICATION supabase_realtime ADD TABLE wines;
    ALTER PUBLICATION supabase_realtime ADD TABLE votes;
  END IF;
END $$;

-- Enable full replica identity for realtime update tracking
ALTER TABLE sessions REPLICA IDENTITY FULL;
ALTER TABLE wines REPLICA IDENTITY FULL;
ALTER TABLE votes REPLICA IDENTITY FULL;

-- Additional high-yield metrics on votes (Metrics 1-3)
ALTER TABLE votes ADD COLUMN IF NOT EXISTS perceived_price_1 TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS perceived_price_2 TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS buy_again_1 TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS buy_again_2 TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS acidity_1 NUMERIC;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS acidity_2 NUMERIC;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS body_1 NUMERIC;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS body_2 NUMERIC;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS sweetness_1 NUMERIC;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS sweetness_2 NUMERIC;
