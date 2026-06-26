-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS wines CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Realtime subscriptions on all tables for live updates
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table wines;
alter publication supabase_realtime add table votes;
