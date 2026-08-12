-- ============================================================================
-- SUPABASE SECURITY ADVISOR REMEDIATION SCRIPT
-- Project: wine-tasting (rprjfaxsmwdzqwzycujh)
-- Resolves:
--   1. rls_disabled_in_public (CRITICAL)
--   2. sensitive_columns_exposed (CRITICAL)
-- ============================================================================

-- 1. Enable Row Level Security (RLS) on all public tables
ALTER TABLE IF EXISTS public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wishlist ENABLE ROW LEVEL SECURITY;

-- 2. Lock down app_settings table to protect host_passcode
-- Revoke direct table permissions from anon, authenticated, and public roles
REVOKE ALL ON TABLE public.app_settings FROM PUBLIC, anon, authenticated;

-- Ensure helper functions exist with SECURITY DEFINER
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_host()
RETURNS BOOLEAN AS $$
DECLARE
  passed_code TEXT;
  actual_code TEXT;
BEGIN
  passed_code := public.get_request_header('x-host-passcode');
  SELECT value INTO actual_code FROM public.app_settings WHERE key = 'host_passcode';
  RETURN passed_code = actual_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant EXECUTE permission on security functions to public/anon/authenticated
GRANT EXECUTE ON FUNCTION public.get_request_header(TEXT) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_host() TO PUBLIC, anon, authenticated;

-- 3. Re-enforce and recreate clean RLS policies for all tables

-- SESSIONS
DROP POLICY IF EXISTS "Allow public read on sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow host write on sessions" ON public.sessions;
CREATE POLICY "Allow public read on sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Allow host write on sessions" ON public.sessions FOR ALL USING (public.check_is_host());

-- WINES
DROP POLICY IF EXISTS "Allow public read on wines" ON public.wines;
DROP POLICY IF EXISTS "Allow host write on wines" ON public.wines;
CREATE POLICY "Allow public read on wines" ON public.wines FOR SELECT USING (true);
CREATE POLICY "Allow host write on wines" ON public.wines FOR ALL USING (public.check_is_host());

-- VOTES
DROP POLICY IF EXISTS "Allow public read on votes" ON public.votes;
DROP POLICY IF EXISTS "Allow public insert on votes" ON public.votes;
DROP POLICY IF EXISTS "Allow voter update on votes" ON public.votes;
DROP POLICY IF EXISTS "Allow voter or host delete on votes" ON public.votes;
CREATE POLICY "Allow public read on votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Allow public insert on votes" ON public.votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow voter update on votes" ON public.votes FOR UPDATE 
  USING (voter_token::text = public.get_request_header('x-voter-token'))
  WITH CHECK (voter_token::text = public.get_request_header('x-voter-token'));
CREATE POLICY "Allow voter or host delete on votes" ON public.votes FOR DELETE 
  USING (voter_token::text = public.get_request_header('x-voter-token') OR public.check_is_host());

-- HISTORY
DROP POLICY IF EXISTS "Allow public read on history" ON public.history;
DROP POLICY IF EXISTS "Allow host write on history" ON public.history;
CREATE POLICY "Allow public read on history" ON public.history FOR SELECT USING (true);
CREATE POLICY "Allow host write on history" ON public.history FOR ALL USING (public.check_is_host());

-- WISHLIST
DROP POLICY IF EXISTS "Allow public read on wishlist" ON public.wishlist;
DROP POLICY IF EXISTS "Allow public insert on wishlist" ON public.wishlist;
DROP POLICY IF EXISTS "Allow owner update on wishlist" ON public.wishlist;
DROP POLICY IF EXISTS "Allow owner delete on wishlist" ON public.wishlist;
CREATE POLICY "Allow public read on wishlist" ON public.wishlist FOR SELECT USING (true);
CREATE POLICY "Allow public insert on wishlist" ON public.wishlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow owner update on wishlist" ON public.wishlist FOR UPDATE
  USING (voter_token::text = public.get_request_header('x-voter-token'))
  WITH CHECK (voter_token::text = public.get_request_header('x-voter-token'));
CREATE POLICY "Allow owner delete on wishlist" ON public.wishlist FOR DELETE
  USING (voter_token::text = public.get_request_header('x-voter-token') OR public.check_is_host());

-- APP SETTINGS
DROP POLICY IF EXISTS "Deny direct read on app_settings" ON public.app_settings;
