import { createClient } from '@supabase/supabase-js';
import { WineSession, Wine, Vote, HistoricalTasting, WishlistItem, WineEnrichment } from './mockData';

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

// Synchronously ensure voter token exists
const getOrGenerateVoterToken = () => {
  let token = localStorage.getItem('WINE_TASTING_VOTER_TOKEN');
  if (!token) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      token = crypto.randomUUID();
    } else {
      token = 'voter-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    localStorage.setItem('WINE_TASTING_VOTER_TOKEN', token);
  }
  return token;
};

const getHeaders = () => {
  return {
    'x-voter-token': getOrGenerateVoterToken(),
    'x-host-passcode': localStorage.getItem('WINE_TASTING_HOST_PASSCODE') || ''
  };
};

const config = getSBConfig();
export const supabase = config 
  ? createClient(config.url, config.key, {
      global: {
        headers: getHeaders()
      }
    })
  : null;

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

  getHistory: async (): Promise<HistoricalTasting[]> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('history')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      date: row.date,
      winnerName: row.winner_name,
      winnerPrice: Number(row.winner_price),
      winnerBroughtBy: row.winner_brought_by,
      winesCount: row.wines_count,
      groupWinner: row.group_winner,
      secondPlace: row.second_place,
      bestValue: row.best_value,
      giantKiller: row.giant_killer || undefined,
      wines: row.wines,
      votes: row.votes
    }));
  },

  addHistorySession: async (session: HistoricalTasting): Promise<void> => {
    const client = ensureClient();
    
    const dbRow = {
      id: session.id,
      name: session.name,
      date: session.date,
      winner_name: session.winnerName,
      winner_price: session.winnerPrice,
      winner_brought_by: session.winnerBroughtBy,
      wines_count: session.winesCount,
      group_winner: session.groupWinner,
      second_place: session.secondPlace,
      best_value: session.bestValue,
      giant_killer: session.giantKiller || null,
      wines: session.wines,
      votes: session.votes || []
    };

    const { error } = await client
      .from('history')
      .upsert(dbRow);

    if (error) throw error;
  },

  // --- Wishlist ("buy again") ---------------------------------------------

  getWishlist: async (voterName?: string): Promise<WishlistItem[]> => {
    const client = ensureClient();
    let query = client
      .from('wishlist')
      .select('*')
      .order('created_at', { ascending: false });

    if (voterName) {
      query = query.eq('voter_name', voterName);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as WishlistItem[];
  },

  addWishlistItem: async (item: Omit<WishlistItem, 'id' | 'created_at'>): Promise<WishlistItem> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('wishlist')
      .insert(item)
      .select()
      .single();
    if (error) throw error;
    return data as WishlistItem;
  },

  removeWishlistItem: async (id: string): Promise<void> => {
    const client = ensureClient();
    const { error } = await client
      .from('wishlist')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // --- Wine auto-fill (enrichment via Supabase Edge Function) --------------
  // Calls the `enrich-wine` edge function, which asks an LLM to infer stable
  // descriptive facts (varietal, region, country, style) from the name +
  // vintage. Price is returned only as a rough estimate — the real price you
  // paid at your store is what drives the value stats, so confirm it manually.
  enrichWine: async (
    name: string,
    vintage?: string,
    producer?: string
  ): Promise<WineEnrichment> => {
    const client = ensureClient();
    const { data, error } = await client.functions.invoke('enrich-wine', {
      body: { name, vintage, producer }
    });
    if (error) throw error;
    if (!data || typeof data !== 'object') {
      throw new Error('Auto-fill returned no data.');
    }
    return data as WineEnrichment;
  }
};
