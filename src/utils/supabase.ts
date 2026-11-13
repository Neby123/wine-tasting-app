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

  const rawUrl = (urlParam || localStorage.getItem('WINE_TASTING_SB_URL') || (import.meta.env.VITE_SUPABASE_URL as string) || '').trim();
  const rawKey = (keyParam || localStorage.getItem('WINE_TASTING_SB_KEY') || (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '').trim();
  
  if (rawUrl && rawKey) {
    const url = rawUrl.replace(/\/+$/, '');
    return { url, key: rawKey };
  }
  return null;
};

// Synchronously ensure voter token exists (RFC4122 compliant UUID)
const getOrGenerateVoterToken = () => {
  let token = localStorage.getItem('WINE_TASTING_VOTER_TOKEN');
  if (!token) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      token = crypto.randomUUID();
    } else {
      const uuidMask = '10000000-1000-4000-8000-100000000000';
      token = uuidMask.replace(/[018]/g, c =>
        (+c ^ (typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(1))[0] : Math.floor(Math.random() * 16)) & 15 >> +c / 4).toString(16)
      );
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

/** Explicit column lists avoid exposing private ownership tokens over PostgREST. */
const WINE_PUBLIC_COLUMNS = 'id,session_id,submitted_by,name,producer,vintage,price,varietal,region,country,style,tasting_notes,blind_label,revealed,created_at';
const VOTE_PUBLIC_COLUMNS = 'id,session_id,voter_name,match_id,wine_1_label,wine_2_label,slider_value,notes_wine_1,notes_wine_2,created_at';
const WISHLIST_PUBLIC_COLUMNS = 'id,voter_name,wine_name,producer,vintage,varietal,region,price,source_session_id,source_history_id,note,created_at';

/**
 * Serializes optional standalone sensory/value metrics into notes_wine_2 as a
 * versioned JSON envelope and strips extra client-only fields so PostgREST never
 * raises PGRST204 if extended columns are absent from the live votes table.
 * Includes voter_token matching the x-voter-token header so RLS INSERT policies pass.
 */
const serializeVoteForDb = (vote: Omit<Vote, 'id'>) => {
  const isStandalone = vote.match_id?.startsWith('STANDALONE_') || vote.wine_1_label === vote.wine_2_label;
  let notesWine2: string | null = vote.notes_wine_2 || null;

  if (isStandalone) {
    const meta: Record<string, unknown> = {};
    if (vote.perceived_price_1 !== undefined) meta.perceived_price_1 = vote.perceived_price_1;
    if (vote.buy_again_1 !== undefined) meta.buy_again_1 = vote.buy_again_1;
    if (vote.acidity_1 !== undefined) meta.acidity_1 = vote.acidity_1;
    if (vote.body_1 !== undefined) meta.body_1 = vote.body_1;
    if (vote.sweetness_1 !== undefined) meta.sweetness_1 = vote.sweetness_1;
    notesWine2 = Object.keys(meta).length > 0 ? JSON.stringify({ __v: 1, ...meta }) : null;
  }

  return {
    session_id: vote.session_id,
    voter_name: (vote.voter_name || '').trim(),
    match_id: vote.match_id,
    wine_1_label: vote.wine_1_label,
    wine_2_label: vote.wine_2_label,
    slider_value: vote.slider_value,
    notes_wine_1: vote.notes_wine_1 || null,
    notes_wine_2: notesWine2,
    voter_token: getOrGenerateVoterToken()
  };
};

/** Hydrates optional sensory/value metrics stored in notes_wine_2 back onto standalone Vote objects. */
const hydrateVoteFromDb = (row: any): Vote => {
  const vote: Vote = { ...row };
  const isStandalone = vote.match_id?.startsWith('STANDALONE_') || vote.wine_1_label === vote.wine_2_label;
  if (isStandalone && typeof row.notes_wine_2 === 'string' && row.notes_wine_2.trim().startsWith('{')) {
    try {
      const meta = JSON.parse(row.notes_wine_2);
      const hasKnownMeta = meta && typeof meta === 'object' && (
        meta.__v === 1 ||
        meta.perceived_price_1 !== undefined ||
        meta.buy_again_1 !== undefined ||
        meta.acidity_1 !== undefined ||
        meta.body_1 !== undefined ||
        meta.sweetness_1 !== undefined
      );
      if (hasKnownMeta) {
        if (meta.perceived_price_1 !== undefined) vote.perceived_price_1 = meta.perceived_price_1;
        if (meta.buy_again_1 !== undefined) vote.buy_again_1 = meta.buy_again_1;
        if (meta.acidity_1 !== undefined) vote.acidity_1 = meta.acidity_1;
        if (meta.body_1 !== undefined) vote.body_1 = meta.body_1;
        if (meta.sweetness_1 !== undefined) vote.sweetness_1 = meta.sweetness_1;
        vote.notes_wine_2 = undefined;
      }
    } catch {
      // Ignore malformed legacy notes_wine_2
    }
  }
  return vote;
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
    // 1. Look for currently active session (setup or tasting)
    const { data: active, error: activeErr } = await client
      .from('sessions')
      .select('*')
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeErr) throw activeErr;
    if (active) return active;

    // 2. If no setup/tasting session, check for a session completed today
    const today = new Date().toISOString().split('T')[0];
    const { data: recent, error: recentErr } = await client
      .from('sessions')
      .select('*')
      .eq('status', 'completed')
      .gte('date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentErr) throw recentErr;
    return recent || null;
  },

  createSession: async (name: string, date?: string): Promise<WineSession> => {
    const client = ensureClient();
    // Complete previously open active sessions if any exist
    const { data: activeSessions } = await client
      .from('sessions')
      .select('id')
      .neq('status', 'completed');

    if (activeSessions && activeSessions.length > 0) {
      const activeIds = activeSessions.map(s => s.id);
      await client
        .from('sessions')
        .update({ status: 'completed' })
        .in('id', activeIds);
    }

    const newSession = {
      name,
      date: date || new Date().toISOString().split('T')[0],
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
      .select(WINE_PUBLIC_COLUMNS)
      .eq('session_id', sessionId);

    if (error) throw error;
    return data || [];
  },

  addWine: async (wine: Omit<Wine, 'id' | 'revealed'>): Promise<Wine> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('wines')
      .insert({ ...wine, revealed: false })
      .select(WINE_PUBLIC_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  },

  addWinesBatch: async (winesToAdd: Omit<Wine, 'id' | 'revealed'>[]): Promise<Wine[]> => {
    if (winesToAdd.length === 0) return [];
    const client = ensureClient();
    const rows = winesToAdd.map(w => ({ ...w, revealed: false }));
    const { data, error } = await client
      .from('wines')
      .insert(rows)
      .select(WINE_PUBLIC_COLUMNS);

    if (error) throw error;
    return data || [];
  },

  deleteWine: async (wineId: string): Promise<void> => {
    const client = ensureClient();
    const { error } = await client
      .from('wines')
      .delete()
      .eq('id', wineId);

    if (error) throw error;
  },

  updateWine: async (wineId: string, updates: Omit<Partial<Omit<Wine, 'id' | 'session_id'>>, 'vintage'> & { vintage?: string | null }): Promise<Wine> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('wines')
      .update(updates)
      .eq('id', wineId)
      .select(WINE_PUBLIC_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  },

  mapAndRevealWines: async (sessionId: string, mapping: Record<string, string>): Promise<Wine[]> => {
    const client = ensureClient();
    const updates = Object.entries(mapping).map(([label, wineId]) => 
      client
        .from('wines')
        .update({ blind_label: label, revealed: true })
        .eq('id', wineId)
    );

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      // Rollback any partially revealed wines
      await Promise.all(
        Object.values(mapping).map(wineId =>
          client.from('wines').update({ revealed: false, blind_label: null }).eq('id', wineId)
        )
      );
      throw new Error(`Failed to reveal wines: ${errors[0].error?.message || 'Update failed'}`);
    }

    // Fetch all updated wines for this session
    const { data, error } = await client
      .from('wines')
      .select(WINE_PUBLIC_COLUMNS)
      .eq('session_id', sessionId);

    if (error) throw error;
    return data || [];
  },

  getVotes: async (sessionId: string): Promise<Vote[]> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('votes')
      .select(VOTE_PUBLIC_COLUMNS)
      .eq('session_id', sessionId);

    if (error) throw error;
    return (data || []).map(hydrateVoteFromDb);
  },

  submitVote: async (vote: Omit<Vote, 'id'>): Promise<Vote> => {
    const client = ensureClient();
    const dbPayload = serializeVoteForDb(vote);

    // Atomic upsert keyed on unique constraint (session_id, voter_name, match_id)
    const { data: upserted, error: upsertErr } = await client
      .from('votes')
      .upsert(dbPayload, { onConflict: 'session_id,voter_name,match_id' })
      .select(VOTE_PUBLIC_COLUMNS)
      .single();

    if (!upsertErr && upserted) {
      return hydrateVoteFromDb(upserted);
    }

    // Only fall back when the live table lacks the unique constraint (SQLSTATE 42P10)
    const errCode = (upsertErr as any)?.code;
    if (upsertErr && errCode !== '42P10') {
      throw upsertErr;
    }

    const { data: existing, error: existErr } = await client
      .from('votes')
      .select('id')
      .eq('session_id', dbPayload.session_id)
      .eq('voter_name', dbPayload.voter_name)
      .eq('match_id', dbPayload.match_id)
      .maybeSingle();

    if (existErr) throw existErr;

    if (existing) {
      const { data, error } = await client
        .from('votes')
        .update(dbPayload)
        .eq('id', existing.id)
        .select(VOTE_PUBLIC_COLUMNS)
        .single();
      if (error) throw error;
      return hydrateVoteFromDb(data);
    } else {
      const { data, error } = await client
        .from('votes')
        .insert(dbPayload)
        .select(VOTE_PUBLIC_COLUMNS)
        .single();
      if (error) {
        // Retry as update if a concurrent request inserted first (SQLSTATE 23505)
        if ((error as any)?.code === '23505') {
          const { data: raced } = await client
            .from('votes')
            .select('id')
            .eq('session_id', dbPayload.session_id)
            .eq('voter_name', dbPayload.voter_name)
            .eq('match_id', dbPayload.match_id)
            .maybeSingle();
          if (raced) {
            const { data: updated, error: updateErr } = await client
              .from('votes')
              .update(dbPayload)
              .eq('id', raced.id)
              .select(VOTE_PUBLIC_COLUMNS)
              .single();
            if (updateErr) throw updateErr;
            return hydrateVoteFromDb(updated);
          }
        }
        throw error;
      }
      return hydrateVoteFromDb(data);
    }
  },

  getHistory: async (): Promise<HistoricalTasting[]> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('history')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return data.map(row => ({
      id: row.id,
      name: row.name,
      date: (row.date || '').split('T')[0],
      winnerName: row.winner_name,
      winnerPrice: Number(row.winner_price),
      winnerBroughtBy: row.winner_brought_by,
      winesCount: row.wines_count,
      groupWinner: row.group_winner,
      secondPlace: row.second_place,
      bestValue: row.best_value,
      giantKiller: row.giant_killer || undefined,
      wines: Array.isArray(row.wines) ? row.wines : [],
      votes: Array.isArray(row.votes) ? row.votes.map(hydrateVoteFromDb) : []
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
    try {
      const client = ensureClient();
      let query = client
        .from('wishlist')
        .select(WISHLIST_PUBLIC_COLUMNS)
        .order('created_at', { ascending: false });

      const cleanVoter = (voterName || '').trim();
      if (cleanVoter) {
        const escaped = cleanVoter.replace(/[\\%_]/g, ch => `\\${ch}`);
        query = query.ilike('voter_name', escaped);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("getWishlist query error, returning empty array:", error);
        return [];
      }
      const rows = (data || []) as WishlistItem[];
      return cleanVoter
        ? rows.filter(r => (r.voter_name || '').trim().toLowerCase() === cleanVoter.toLowerCase())
        : rows;
    } catch (err) {
      console.warn("getWishlist caught error, returning empty array:", err);
      return [];
    }
  },

  addWishlistItem: async (item: Omit<WishlistItem, 'id' | 'created_at'>): Promise<WishlistItem> => {
    const client = ensureClient();
    const { data, error } = await client
      .from('wishlist')
      .insert({ ...item, voter_token: getOrGenerateVoterToken() })
      .select(WISHLIST_PUBLIC_COLUMNS)
      .single();
    if (error) throw error;
    return data as WishlistItem;
  },

  removeWishlistItem: async (id: string): Promise<void> => {
    if (!id) return;
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
