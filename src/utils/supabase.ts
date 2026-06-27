import { createClient } from '@supabase/supabase-js';
import { WineSession, Wine, Vote, HistoricalTasting, HISTORICAL_SESSIONS } from './mockData';

const getSBConfig = () => {
  // Check URL params first (useful for guest invite links)
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('sb_url');
  const keyParam = params.get('sb_key');

  if (urlParam && keyParam) {
    localStorage.setItem('WINE_TASTING_SB_URL', urlParam);
    localStorage.setItem('WINE_TASTING_SB_KEY', keyParam);
    
    // Clean URL params so they don't linger in browser address bar
    const newUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, newUrl);
    
    return { url: urlParam, key: keyParam };
  }

  const lsUrl = localStorage.getItem('WINE_TASTING_SB_URL');
  const lsKey = localStorage.getItem('WINE_TASTING_SB_KEY');
  
  if (lsUrl && lsKey) {
    return { url: lsUrl, key: lsKey };
  }
  return null;
};

const config = getSBConfig();
export const supabase = config ? createClient(config.url, config.key) : null;

const ensureClient = () => {
  if (!supabase) {
    throw new Error("Supabase is not configured. Please enter your database URL and API key in Settings.");
  }
  return supabase;
};

export const db = {
  getSessions: async (): Promise<WineSession[]> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('sessions')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  getActiveSession: async (): Promise<WineSession | null> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('sessions')
      .select('*')
      .neq('status', 'completed')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  createSession: async (name: string): Promise<WineSession> => {
    const client = ensureClient();
    // Auto-complete any active sessions
    await client
      .from('sessions')
      .update({ status: 'completed' })
      .neq('status', 'completed');

    const newSession = {
      name,
      date: new Date().toISOString().split('T')[0],
      status: 'setup'
    };

    const { data, error } = await client
      .from('sessions')
      .insert(newSession)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateSessionStatus: async (sessionId: string, status: 'setup' | 'tasting' | 'completed'): Promise<WineSession | null> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('sessions')
      .update({ status })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateSessionMatchWinners: async (sessionId: string, matchWinners: Record<string, string>): Promise<WineSession | null> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('sessions')
      .update({ match_winners: matchWinners })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getWines: async (sessionId: string): Promise<Wine[]> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('wines')
      .select('*')
      .eq('session_id', sessionId);

    if (error) throw error;
    return data || [];
  },

  addWine: async (wine: Omit<Wine, 'id' | 'revealed'>): Promise<Wine> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('wines')
      .insert({ ...wine, revealed: false })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteWine: async (wineId: string): Promise<void> => {
    const client = ensureClient();
    const { error } = await client
      .from('wines')
      .delete()
      .eq('id', wineId);

    if (error) throw error;
  },

  mapAndRevealWines: async (sessionId: string, mapping: Record<string, string>): Promise<Wine[]> => {
    const client = ensureClient();
    const updates = Object.entries(mapping).map(([label, wineId]) => 
      client
        .from('wines')
        .update({ blind_label: label, revealed: true })
        .eq('id', wineId)
    );

    await Promise.all(updates);

    // Fetch all updated wines for this session
    const { data, error } = await client
      .from('wines')
      .select('*')
      .eq('session_id', sessionId);

    if (error) throw error;
    return data || [];
  },

  getVotes: async (sessionId: string): Promise<Vote[]> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('votes')
      .select('*')
      .eq('session_id', sessionId);

    if (error) throw error;
    return data || [];
  },

  submitVote: async (vote: Omit<Vote, 'id'>): Promise<Vote> => {
    const client = ensureClient();
    // Check for existing vote to overwrite
    const { data: existing, error: existErr } = await client
      .from('votes')
      .select('id')
      .eq('session_id', vote.session_id)
      .eq('voter_name', vote.voter_name)
      .eq('match_id', vote.match_id)
      .maybeSingle();

    if (existErr) throw existErr;

    if (existing) {
      const { data, error } = await client
        .from('votes')
        .update(vote)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await client
        .from('votes')
        .insert(vote)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  getHistory: (): HistoricalTasting[] => {
    const local = localStorage.getItem('WINE_TASTING_HISTORY');
    if (!local) {
      localStorage.setItem('WINE_TASTING_HISTORY', JSON.stringify(HISTORICAL_SESSIONS));
      return HISTORICAL_SESSIONS;
    }
    try {
      return JSON.parse(local);
    } catch {
      return HISTORICAL_SESSIONS;
    }
  },

  addHistorySession: (session: HistoricalTasting): void => {
    const history = db.getHistory();
    const updated = [session, ...history.filter(s => s.id !== session.id)];
    localStorage.setItem('WINE_TASTING_HISTORY', JSON.stringify(updated));
  }
};
