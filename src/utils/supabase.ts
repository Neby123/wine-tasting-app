import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { mockDB, WineSession, Wine, Vote, HistoricalTasting } from './mockData';

// Fetch credentials from LocalStorage or URL params
const getSupabaseConfig = () => {
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

export const config = getSupabaseConfig();
export const isMockMode = !config;

export const supabase: SupabaseClient | null = config 
  ? createClient(config.url, config.key) 
  : null;

// Unified database provider that routes calls to Supabase or MockDB
export const db = {
  getSessions: async (): Promise<WineSession[]> => {
    if (isMockMode || !supabase) return mockDB.getSessions();
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Supabase error fetching sessions, using mock:", err);
      return mockDB.getSessions();
    }
  },

  getActiveSession: async (): Promise<WineSession | null> => {
    if (isMockMode || !supabase) return mockDB.getActiveSession();
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .neq('status', 'completed')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Supabase error fetching active session, using mock:", err);
      return mockDB.getActiveSession();
    }
  },

  createSession: async (name: string): Promise<WineSession> => {
    if (isMockMode || !supabase) return mockDB.createSession(name);
    try {
      // Auto-complete any active sessions
      await supabase
        .from('sessions')
        .update({ status: 'completed' })
        .neq('status', 'completed');

      const newSession = {
        name,
        date: new Date().toISOString().split('T')[0],
        status: 'setup'
      };

      const { data, error } = await supabase
        .from('sessions')
        .insert(newSession)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Supabase error creating session, using mock:", err);
      return mockDB.createSession(name);
    }
  },

  updateSessionStatus: async (sessionId: string, status: 'setup' | 'tasting' | 'completed'): Promise<WineSession | null> => {
    if (isMockMode || !supabase) return mockDB.updateSessionStatus(sessionId, status);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .update({ status })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Supabase error updating session status, using mock:", err);
      return mockDB.updateSessionStatus(sessionId, status);
    }
  },

  updateSessionMatchWinners: async (sessionId: string, matchWinners: Record<string, string>): Promise<WineSession | null> => {
    if (isMockMode || !supabase) return mockDB.updateSessionMatchWinners(sessionId, matchWinners);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .update({ match_winners: matchWinners })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Supabase error updating session match winners, using mock:", err);
      return mockDB.updateSessionMatchWinners(sessionId, matchWinners);
    }
  },

  getWines: async (sessionId: string): Promise<Wine[]> => {
    if (isMockMode || !supabase) return mockDB.getWines(sessionId);
    try {
      const { data, error } = await supabase
        .from('wines')
        .select('*')
        .eq('session_id', sessionId);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Supabase error fetching wines, using mock:", err);
      return mockDB.getWines(sessionId);
    }
  },

  addWine: async (wine: Omit<Wine, 'id' | 'revealed'>): Promise<Wine> => {
    if (isMockMode || !supabase) return mockDB.addWine(wine);
    try {
      const { data, error } = await supabase
        .from('wines')
        .insert({ ...wine, revealed: false })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Supabase error adding wine, using mock:", err);
      return mockDB.addWine(wine);
    }
  },

  deleteWine: async (wineId: string): Promise<void> => {
    if (isMockMode || !supabase) return mockDB.deleteWine(wineId);
    try {
      const { error } = await supabase
        .from('wines')
        .delete()
        .eq('id', wineId);

      if (error) throw error;
    } catch (err) {
      console.error("Supabase error deleting wine, using mock:", err);
      mockDB.deleteWine(wineId);
    }
  },

  mapAndRevealWines: async (sessionId: string, mapping: Record<string, string>): Promise<Wine[]> => {
    if (isMockMode || !supabase) return mockDB.mapAndRevealWines(sessionId, mapping);
    try {
      const updates = Object.entries(mapping).map(([label, wineId]) => 
        supabase
          .from('wines')
          .update({ blind_label: label, revealed: true })
          .eq('id', wineId)
      );

      await Promise.all(updates);

      // Fetch all updated wines for this session
      const { data, error } = await supabase
        .from('wines')
        .select('*')
        .eq('session_id', sessionId);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Supabase error mapping and revealing wines, using mock:", err);
      return mockDB.mapAndRevealWines(sessionId, mapping);
    }
  },

  getVotes: async (sessionId: string): Promise<Vote[]> => {
    if (isMockMode || !supabase) return mockDB.getVotes(sessionId);
    try {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', sessionId);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Supabase error fetching votes, using mock:", err);
      return mockDB.getVotes(sessionId);
    }
  },

  submitVote: async (vote: Omit<Vote, 'id'>): Promise<Vote> => {
    if (isMockMode || !supabase) return mockDB.submitVote(vote);
    try {
      // Check for existing vote to overwrite
      const { data: existing, error: existErr } = await supabase
        .from('votes')
        .select('id')
        .eq('session_id', vote.session_id)
        .eq('voter_name', vote.voter_name)
        .eq('match_id', vote.match_id)
        .maybeSingle();

      if (existErr) throw existErr;

      if (existing) {
        const { data, error } = await supabase
          .from('votes')
          .update(vote)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('votes')
          .insert(vote)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    } catch (err) {
      console.error("Supabase error submitting vote, using mock:", err);
      return mockDB.submitVote(vote);
    }
  },

  getHistory: async (): Promise<HistoricalTasting[]> => {
    return mockDB.getHistory();
  },

  addHistorySession: async (session: HistoricalTasting): Promise<void> => {
    mockDB.addHistorySession(session);
  }
};
