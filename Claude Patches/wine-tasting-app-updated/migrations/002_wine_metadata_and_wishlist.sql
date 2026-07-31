-- ============================================================================
-- Migration 002: Wine metadata + Wishlist + style-aware analytics
-- ----------------------------------------------------------------------------
-- SAFE TO RUN ON PRODUCTION. This script is purely ADDITIVE and idempotent.
-- It does NOT drop or truncate any table, so your existing sessions, wines,
-- votes, and history archives are untouched.
--
-- Do NOT run schema.sql against production — that file DROPs tables for a
-- clean local rebuild and would erase your history. Run THIS file instead,
-- in the Supabase dashboard - SQL Editor.
-- ============================================================================

-- 1. Descriptive metadata on wines so the app can reason about STYLE, not just
--    individual bottles. All nullable; existing rows are unaffected.
ALTER TABLE wines ADD COLUMN IF NOT EXISTS varietal TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS region   TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS country  TEXT;
ALTER TABLE wines ADD COLUMN IF NOT EXISTS style    TEXT; -- e.g. 'Red - Full-bodied', 'Rosé', 'Sparkling'

-- 2. Personal wishlist / "buy again" list. Scoped per voter via voter_token,
--    the same privacy pattern already used for votes.
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_name TEXT NOT NULL,
  wine_name TEXT NOT NULL,
  producer TEXT,
  vintage TEXT,
  varietal TEXT,
  region TEXT,
  price NUMERIC,
  source_session_id UUID,          -- optional link to the tasting it came from
  source_history_id TEXT,          -- optional link to a history archive id
  note TEXT,
  voter_token UUID NOT NULL DEFAULT COALESCE(
    NULLIF(get_request_header('x-voter-token'), ''),
    gen_random_uuid()::text
  )::uuid,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

-- Everyone can read the group's wishlist (so people can see "who wants what"),
-- anyone can add, but you can only remove/edit YOUR OWN entries (matched by the
-- browser's voter token). DROP-then-CREATE keeps this idempotent.
DROP POLICY IF EXISTS "Allow public read on wishlist"   ON wishlist;
DROP POLICY IF EXISTS "Allow public insert on wishlist" ON wishlist;
DROP POLICY IF EXISTS "Allow owner update on wishlist"  ON wishlist;
DROP POLICY IF EXISTS "Allow owner delete on wishlist"  ON wishlist;

CREATE POLICY "Allow public read on wishlist"   ON wishlist FOR SELECT USING (true);
CREATE POLICY "Allow public insert on wishlist" ON wishlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow owner update on wishlist"  ON wishlist FOR UPDATE
  USING (voter_token::text = get_request_header('x-voter-token'))
  WITH CHECK (voter_token::text = get_request_header('x-voter-token'));
CREATE POLICY "Allow owner delete on wishlist"  ON wishlist FOR DELETE
  USING (
    voter_token::text = get_request_header('x-voter-token')
    OR check_is_host()
  );

-- Done. No data was modified; only structure was added.
