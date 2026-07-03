-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS wines CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS history CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;

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
  tasting_notes TEXT,
  image_url TEXT,
  blind_label TEXT, -- 'A', 'B', 'C', ..., 'H'
  revealed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Helper function to safely extract request headers in Supabase
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    NULLIF(get_request_header('x-voter-token'), ''),
    gen_random_uuid()::text
  )::uuid,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
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

-- Revoke all direct permissions on app_settings from public
-- This makes it impossible for public roles (anon/authenticated) to read app_settings directly
CREATE POLICY "Deny direct read on app_settings" ON app_settings FOR ALL USING (false);

-- Security Definer function to check host passcode
CREATE OR REPLACE FUNCTION check_is_host()
RETURNS BOOLEAN AS $$
DECLARE
  passed_code TEXT;
  actual_code TEXT;
END;
$$;
CREATE OR REPLACE FUNCTION check_is_host()
RETURNS BOOLEAN AS $$
DECLARE
  passed_code TEXT;
  actual_code TEXT;
BEGIN
  passed_code := get_request_header('x-host-passcode');
  SELECT value INTO actual_code FROM app_settings WHERE key = 'host_passcode';
  RETURN passed_code = actual_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for sessions
CREATE POLICY "Allow public read on sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Allow host write on sessions" ON sessions FOR ALL USING (check_is_host());

-- RLS Policies for wines
CREATE POLICY "Allow public read on wines" ON wines FOR SELECT USING (true);
CREATE POLICY "Allow host write on wines" ON wines FOR ALL USING (check_is_host());

-- RLS Policies for votes
CREATE POLICY "Allow public read on votes" ON votes FOR SELECT USING (true);
CREATE POLICY "Allow public insert on votes" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow voter update on votes" ON votes FOR UPDATE 
USING (
  voter_token::text = get_request_header('x-voter-token')
)
WITH CHECK (
  voter_token::text = get_request_header('x-voter-token')
);
CREATE POLICY "Allow voter or host delete on votes" ON votes FOR DELETE 
USING (
  voter_token::text = get_request_header('x-voter-token')
  OR check_is_host()
);

-- RLS Policies for history
CREATE POLICY "Allow public read on history" ON history FOR SELECT USING (true);
CREATE POLICY "Allow host write on history" ON history FOR ALL USING (check_is_host());

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
