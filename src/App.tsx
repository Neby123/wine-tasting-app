import React, { useState, useEffect } from 'react';
import { db, supabase } from './utils/supabase';
import { WineSession, Wine, Vote } from './utils/mockData';
import IntakeForm from './components/IntakeForm';
import TastingSheet from './components/TastingSheet';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Settings from './components/Settings';
import TasterProfiles from './components/TasterProfiles';
import Cellar from './components/Cellar';
import { Wine as WineIcon, Trophy, ClipboardList, History as HistoryIcon, Settings as SettingsIcon, PlusCircle, AlertCircle, RefreshCw, Users, Star, FileText } from 'lucide-react';

const TAB_VALUES = ['dashboard', 'tasting', 'intake', 'history', 'settings', 'palate', 'cellar'] as const;
type TabValue = typeof TAB_VALUES[number];

const getTabFromHash = (): TabValue => {
  const raw = window.location.hash.replace(/^#/, '');
  return (TAB_VALUES as readonly string[]).includes(raw) ? (raw as TabValue) : 'intake';
};

export default function App() {

  // Profile States
  const [voterName, setVoterName] = useState(() => localStorage.getItem('WINE_TASTING_VOTER_NAME') || '');
  const [isHost, setIsHost] = useState(() => localStorage.getItem('WINE_TASTING_IS_HOST') === 'true');

  // DB States
  const [activeSession, setActiveSession] = useState<WineSession | null>(null);
  const [wines, setWines] = useState<Wine[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation States
  const [currentTab, setCurrentTab] = useState<TabValue>(getTabFromHash);
  
  // New session input
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionDate, setNewSessionDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [creatingSession, setCreatingSession] = useState(false);

  const loadSeqRef = React.useRef(0);
  const revealingRef = React.useRef(false);

  // Load active session and data
  const loadData = async () => {
    const seq = ++loadSeqRef.current;
    try {
      const session = await db.getActiveSession();
      if (seq !== loadSeqRef.current) return;
      setActiveSession(session);
      
      if (session) {
        if (session.status === 'tasting') {
          setCurrentTab(prev => (prev === 'intake' ? 'tasting' : prev));
        } else if (session.status === 'completed') {
          setCurrentTab(prev => (prev === 'intake' ? 'dashboard' : prev));
        }
        const [winesData, votesData] = await Promise.all([
          db.getWines(session.id),
          db.getVotes(session.id)
        ]);
        if (seq !== loadSeqRef.current) return;
        setWines(winesData);
        setVotes(votesData);
      } else {
        setWines([]);
        setVotes([]);
      }
    } catch (err) {
      console.error("Error loading database:", err);
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  };

  // Initial load & verified cleanup of legacy local/mock keys
  useEffect(() => {
    loadData();
    const cleanupLegacyStorage = async () => {
      if (!supabase) return;
      try {
        const { data: existingRows, error } = await supabase.from('history').select('id');
        if (error) return;
        localStorage.removeItem('WINE_TASTING_MOCK_HISTORY');
        const rawHistory = localStorage.getItem('WINE_TASTING_HISTORY');
        if (rawHistory) {
          const parsed = JSON.parse(rawHistory);
          const existingIds = new Set((existingRows || []).map(r => r.id));
          if (!Array.isArray(parsed) || parsed.every((s: any) => s?.id && existingIds.has(s.id))) {
            localStorage.removeItem('WINE_TASTING_HISTORY');
          }
        }
      } catch {
        // Leave local storage untouched if verification fails
      }
    };
    cleanupLegacyStorage();
  }, []);

  // Reflect the active tab into the URL hash. Guarded on difference so this
  // doesn't fight the hashchange listener below. Assigning location.hash adds a
  // history entry, so the browser back button steps through tabs.
  useEffect(() => {
    if (getTabFromHash() !== currentTab) {
      window.location.hash = currentTab;
    }
  }, [currentTab]);

  // Reflect hash changes (back/forward, or a shared deep link) back into state.
  useEffect(() => {
    const onHashChange = () => {
      const next = getTabFromHash();
      setCurrentTab(prev => (prev === next ? prev : next));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Supabase Realtime subscriptions for live multiplayer synchronization
  useEffect(() => {
    if (!activeSession || activeSession.status === 'completed') return;
    const client = supabase;
    if (!client) return;

    console.log(`Setting up Realtime subscriptions for active session: ${activeSession.id}`);
    const channel = client.channel(`active-session-${activeSession.id}`);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${activeSession.id}`
        },
        async (payload) => {
          console.log('Realtime session update payload:', payload);
          const newSession = payload.new as WineSession;
          // Guard against DELETE events which return empty {} for payload.new
          if (!newSession || !newSession.id) {
            setActiveSession(null);
            setWines([]);
            setVotes([]);
          } else {
            setActiveSession(newSession);
            if (newSession.status === 'completed') {
              const [w, v] = await Promise.all([
                db.getWines(newSession.id),
                db.getVotes(newSession.id)
              ]);
              setWines(w);
              setVotes(v);
              setCurrentTab('dashboard');
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wines',
          filter: `session_id=eq.${activeSession.id}`
        },
        async () => {
          console.log('Realtime wines update detected');
          const updatedWines = await db.getWines(activeSession.id);
          setWines(updatedWines);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `session_id=eq.${activeSession.id}`
        },
        async () => {
          console.log('Realtime votes update detected');
          const updatedVotes = await db.getVotes(activeSession.id);
          setVotes(updatedVotes);
        }
      )
      .subscribe((status, err) => {
        console.log(`Realtime channel status: ${status}`, err);
      });

    return () => {
      console.log('Cleaning up Realtime channel');
      client.removeChannel(channel);
    };
  }, [activeSession?.id]);

  // Fallback polling (every 10 seconds) as a safety net
  useEffect(() => {
    const timer = setInterval(() => {
      if (activeSession && activeSession.status !== 'completed') {
        console.log('Fallback polling for updates...');
        loadData();
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [activeSession?.id]);

  // Profile Save Actions
  const handleUpdateVoterName = (name: string) => {
    const trimmed = (name || '').trim();
    setVoterName(trimmed);
    localStorage.setItem('WINE_TASTING_VOTER_NAME', trimmed);
  };

  const handleUpdateHostMode = (host: boolean) => {
    setIsHost(host);
    localStorage.setItem('WINE_TASTING_IS_HOST', host ? 'true' : 'false');
  };

  // Session Management Actions
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;

    setCreatingSession(true);
    try {
      const session = await db.createSession(newSessionName.trim(), newSessionDate.trim());
      setActiveSession(session);
      setWines([]);
      setVotes([]);
      setCurrentTab('intake');
    } catch (err) {
      console.error("Failed to create session:", err);
      const msg = (err as Error).message || String(err);
      if (msg.includes("Failed to fetch")) {
        alert("Connection Failed: Unable to reach your Supabase database. Please go to Settings -> Database Configuration and double check your Supabase URL and Anon Key.");
      } else {
        alert("Failed to initialize session: " + msg);
      }
    } finally {
      setCreatingSession(false);
    }
  };

  const handleAddWine = async (wineData: Omit<Wine, 'id' | 'session_id' | 'revealed'>) => {
    if (!activeSession) return;
    try {
      const newWine = await db.addWine({
        ...wineData,
        session_id: activeSession.id
      });
      setWines(prev => [...prev, newWine]);
    } catch (err) {
      console.error('Failed to add wine:', err);
      alert('Failed to add wine. Please check your connection and try again.');
    }
  };

  const handleAddWinesBatch = async (winesData: Omit<Wine, 'id' | 'session_id' | 'revealed'>[]) => {
    if (!activeSession || winesData.length === 0) return;
    try {
      const inserted = await db.addWinesBatch(
        winesData.map(w => ({ ...w, session_id: activeSession.id }))
      );
      setWines(prev => [...prev, ...inserted]);
    } catch (err) {
      console.error('Failed to add batch wines:', err);
      throw err;
    }
  };

  const handleDeleteWine = async (wineId: string) => {
    try {
      await db.deleteWine(wineId);
      setWines(prev => prev.filter(w => w.id !== wineId));
    } catch (err) {
      console.error('Failed to delete wine:', err);
      alert('Failed to delete wine. Please check your connection and try again.');
    }
  };

  const handleUpdateWine = async (wineId: string, updates: Omit<Partial<Omit<Wine, 'id' | 'session_id'>>, 'vintage'> & { vintage?: string | null }) => {
    try {
      const updated = await db.updateWine(wineId, updates);
      setWines(prev => prev.map(w => w.id === wineId ? updated : w));
    } catch (err) {
      console.error('Failed to update wine:', err);
      alert('Unable to update bottle details. Ensure the session is in setup mode or enable Host Mode in Settings.');
      throw err;
    }
  };

  const handleStartTasting = async () => {
    if (!activeSession) return;
    
    setLoading(true);
    try {
      // Shift status to tasting (labels A-F are physically on bags, no DB labels yet)
      const updatedSession = await db.updateSessionStatus(activeSession.id, 'tasting');
      setActiveSession(updatedSession);
      await loadData();
      setCurrentTab('tasting');
    } catch (err) {
      console.error(err);
      alert("Failed to start tasting session. Check your host connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevealWines = async (mapping: Record<string, string>) => {
    if (!activeSession || revealingRef.current) return;
    revealingRef.current = true;
    setLoading(true);
    try {
      // 1. Fetch latest wines & votes so late submissions during reveal are never dropped
      const [latestWinesRaw, latestVotesRaw] = await Promise.all([
        db.getWines(activeSession.id).catch(() => wines),
        db.getVotes(activeSession.id).catch(() => votes)
      ]);
      const sourceWines = latestWinesRaw.length > 0 ? latestWinesRaw : wines;
      const sourceVotes = latestVotesRaw.length > 0 ? latestVotesRaw : votes;

      // 2. Build idempotent archive report first (upsert keyed by session.id)
      const labelByWineId: Record<string, string> = {};
      Object.entries(mapping).forEach(([label, wineId]) => {
        labelByWineId[wineId] = label;
      });
      const mappedWinesPreview = sourceWines.map(w => ({
        ...w,
        blind_label: labelByWineId[w.id] || w.blind_label,
        revealed: Boolean(labelByWineId[w.id] || w.revealed)
      }));

      const getWineAppreciationIndex = (label: string) => {
        const wineVotes = sourceVotes.filter(v => v.wine_1_label === label || v.wine_2_label === label);
        if (wineVotes.length === 0) return 50;
        let scoreSum = 0;
        wineVotes.forEach(v => {
          if (v.match_id?.startsWith('STANDALONE_') || v.wine_1_label === v.wine_2_label) {
            scoreSum += v.slider_value;
          } else if (v.wine_1_label === label) {
            scoreSum += (100 - v.slider_value);
          } else {
            scoreSum += v.slider_value;
          }
        });
        return Math.round(scoreSum / wineVotes.length);
      };

      const wineStats = mappedWinesPreview.map(w => {
        const label = w.blind_label || '';
        const score = getWineAppreciationIndex(label);
        return {
          ...w,
          score,
          wins: 0,
          valueRatio: score / Math.max(1, w.price || 1)
        };
      });

      const sorted = [...wineStats].sort((a, b) => b.score - a.score);
      const bisWine = sorted[0];
      const bestValuePool = wineStats.filter(w => w.score >= 50);
      const finalValuePool = bestValuePool.length > 0 ? bestValuePool : wineStats;
      const bestValue = [...finalValuePool].sort((a, b) => b.valueRatio - a.valueRatio)[0];

      // Dynamic Giant Killer calculation: largest price upset (cheaper wine beating pricier wine)
      let giantKillerMatch: string | undefined = undefined;
      const sortedByPrice = [...wineStats]
        .filter(w => typeof w.price === 'number' && w.price > 0)
        .sort((a, b) => a.price - b.price);
      let bestMargin = 0;
      let bestScoreDiff = -1;
      for (let i = 0; i < sortedByPrice.length; i++) {
        for (let j = i + 1; j < sortedByPrice.length; j++) {
          const cheaper = sortedByPrice[i];
          const pricier = sortedByPrice[j];
          if (pricier.price > cheaper.price && cheaper.score > pricier.score) {
            const margin = pricier.price - cheaper.price;
            const scoreDiff = cheaper.score - pricier.score;
            if (margin > bestMargin || (margin === bestMargin && scoreDiff > bestScoreDiff)) {
              bestMargin = margin;
              bestScoreDiff = scoreDiff;
              giantKillerMatch = `${cheaper.name} ($${cheaper.price.toFixed(2)}) beat ${pricier.name} ($${pricier.price.toFixed(2)})`;
            }
          }
        }
      }

      const report = {
        id: activeSession.id,
        name: activeSession.name,
        date: (activeSession.date || '').split('T')[0],
        winnerName: bisWine?.name || (sorted[0] ? sorted[0].name : "Unknown"),
        winnerPrice: bisWine?.price || (sorted[0] ? sorted[0].price : 0),
        winnerBroughtBy: bisWine?.submitted_by || (sorted[0] ? sorted[0].submitted_by : "Unknown"),
        winesCount: mappedWinesPreview.length,
        groupWinner: bisWine ? `${bisWine.name} ($${bisWine.price.toFixed(2)})` : (sorted[0] ? `${sorted[0].name} ($${sorted[0].price.toFixed(2)})` : "N/A"),
        secondPlace: sorted[1] ? `${sorted[1].name} ($${sorted[1].price.toFixed(2)})` : "N/A",
        bestValue: bestValue ? `${bestValue.name} ($${bestValue.price.toFixed(2)})` : "N/A",
        giantKiller: giantKillerMatch,
        wines: wineStats.map(w => ({
          name: w.name,
          price: w.price,
          submitted_by: w.submitted_by,
          blind_label: w.blind_label || undefined,
          score: w.score,
          wins: w.wins,
          varietal: w.varietal,
          region: w.region,
          country: w.country,
          style: w.style
        })),
        votes: sourceVotes.map(v => ({
          voter_name: v.voter_name,
          match_id: v.match_id,
          wine_1_label: v.wine_1_label,
          wine_2_label: v.wine_2_label,
          slider_value: v.slider_value,
          notes_wine_1: v.notes_wine_1 || undefined,
          notes_wine_2: v.notes_wine_2 || undefined,
          perceived_price_1: v.perceived_price_1,
          buy_again_1: v.buy_again_1,
          acidity_1: v.acidity_1,
          body_1: v.body_1,
          sweetness_1: v.sweetness_1
        }))
      };

      // 2. Persist idempotent history archive BEFORE mutating wines/session state
      await db.addHistorySession(report);

      // 3. Reveal wines (db.mapAndRevealWines rolls back on partial failure)
      const updatedWines = await db.mapAndRevealWines(activeSession.id, mapping);

      // 4. Mark session completed (rollback reveal flags if status update fails)
      let updatedSession: WineSession | null = null;
      try {
        updatedSession = await db.updateSessionStatus(activeSession.id, 'completed');
      } catch (statusErr) {
        const sbClient = supabase;
        if (sbClient) {
          const rollbackRes = await Promise.all(
            Object.values(mapping).map(wineId =>
              sbClient.from('wines').update({ revealed: false, blind_label: null }).eq('id', wineId)
            )
          );
          rollbackRes.forEach(r => {
            if (r.error) console.error('Wine reveal rollback error:', r.error);
          });
        }
        throw statusErr;
      }

      // 5. Sync buy-again intents to Supabase ONLY for current device owner
      // so another voter's wishlist entries are never stamped with the host's voter_token.
      try {
        const actingVoterLower = (voterName || '').trim().toLowerCase();
        const existingCloudWishlist = actingVoterLower
          ? await db.getWishlist(voterName.trim()).catch(() => [])
          : [];
        const cloudWishKeys = new Set(
          existingCloudWishlist.map(w => `${(w.voter_name || '').trim().toLowerCase()}::${(w.wine_name || '').trim().toLowerCase()}`)
        );

        for (const v of sourceVotes) {
          if (v.buy_again_1 !== 'yes' || !v.voter_name) continue;
          const matchedWine = updatedWines.find(w => w.blind_label === v.wine_1_label);
          if (!matchedWine) continue;
          const voterClean = (v.voter_name || '').trim();
          if (!voterClean) continue;
          const wishKey = `${voterClean.toLowerCase()}::${matchedWine.name.trim().toLowerCase()}`;
          if (actingVoterLower && voterClean.toLowerCase() === actingVoterLower && !cloudWishKeys.has(wishKey)) {
            cloudWishKeys.add(wishKey);
            await db.addWishlistItem({
              voter_name: voterClean,
              wine_name: matchedWine.name,
              producer: matchedWine.producer,
              vintage: matchedWine.vintage,
              varietal: matchedWine.varietal,
              region: matchedWine.region,
              price: matchedWine.price,
              source_session_id: activeSession.id,
              source_history_id: report.id,
              note: v.notes_wine_1 || undefined
            }).catch((wishErr) => {
              console.warn('Cloud wishlist sync skipped:', wishErr);
            });
          }
        }
      } catch {
        // Best-effort wishlist sync should never block reveal
      }

      setWines(updatedWines);
      setVotes(sourceVotes);
      setActiveSession(updatedSession);
      setCurrentTab('dashboard');
    } catch (err) {
      console.error('Failed to reveal wines:', err);
      await loadData().catch(() => {});
      alert("Failed to reveal wines. Ensure Host Mode is enabled in Settings and try again.");
    } finally {
      revealingRef.current = false;
      setLoading(false);
    }
  };

  const handleResetSession = async () => {
    if (!window.confirm("Are you sure you want to end this tasting session and start fresh?")) return;
    if (!activeSession) return;
    
    setLoading(true);
    try {
      await db.updateSessionStatus(activeSession.id, 'completed');
      setActiveSession(null);
      setWines([]);
      setVotes([]);
      setCurrentTab('intake');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Vote Actions
  const handleSubmitStandaloneRating = async (
    wineLabel: string,
    score: number,
    notes?: string,
    extraMetrics?: {
      perceivedPrice?: 'cheap' | 'mid' | 'expensive';
      buyAgain?: 'yes' | 'maybe' | 'no';
      acidity?: number;
      body?: number;
      sweetness?: number;
    }
  ) => {
    if (!activeSession) return;

    try {
      await db.submitVote({
        session_id: activeSession.id,
        voter_name: voterName,
        match_id: `STANDALONE_${wineLabel}`,
        wine_1_label: wineLabel,
        wine_2_label: wineLabel,
        slider_value: score,
        notes_wine_1: notes || undefined,
        perceived_price_1: extraMetrics?.perceivedPrice,
        buy_again_1: extraMetrics?.buyAgain,
        acidity_1: extraMetrics?.acidity,
        body_1: extraMetrics?.body,
        sweetness_1: extraMetrics?.sweetness
      });

      await loadData();
    } catch (err) {
      console.error('Failed to submit standalone rating:', err);
      throw err;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-12">
      {/* Top Banner Navigation */}
      <header className="glass-panel sticky top-0 z-50 border-b border-slate-800/80 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <button
          onClick={() => setCurrentTab(
            activeSession?.status === 'tasting'
              ? 'tasting'
              : activeSession?.status === 'completed'
                ? 'dashboard'
                : 'intake'
          )}
          className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
          title="Return to Home / Active Session"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#821D35] to-[#5A1425] flex items-center justify-center shadow-md shadow-wine-200/20 group-hover:scale-105 transition-transform">
            <WineIcon className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold font-serif tracking-tight text-wine-100 flex items-center gap-2 flex-wrap group-hover:text-wine-200 transition-colors">
              <span>Grand Taste Tourney</span>
              {activeSession && (
                <span className="text-[11px] font-sans font-bold px-2.5 py-0.5 rounded-full bg-wine-900 border border-wine-700 text-wine-200 tracking-normal">
                  {activeSession.name}
                </span>
              )}
            </h1>
            <p className="text-[10px] text-slate-500 tracking-wider font-mono font-medium">
              Blind Tasting Club • 0–100 Flight • {supabase ? "Multiplayer Connected" : "Connection Pending (Check Settings)"}
            </p>
          </div>
        </button>

        {/* Global User status info */}
        <nav className="flex flex-wrap items-center bg-slate-850/90 p-1 border border-slate-800 rounded-xl text-xs font-semibold gap-1 shadow-sm">
          {(!activeSession || activeSession.status === 'completed') && (
            <button
              onClick={() => {
                setActiveSession(null);
                setWines([]);
                setVotes([]);
                setCurrentTab('intake');
              }}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                !activeSession && currentTab === 'intake'
                  ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-wine-400" /> New Session
            </button>
          )}

          {activeSession && (
            <>
              <button
                onClick={() => setCurrentTab('intake')}
                disabled={activeSession.status !== 'setup'}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentTab === 'intake'
                    ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 disabled:opacity-30 disabled:pointer-events-none'
                }`}
              >
                <ClipboardList className="w-4 h-4" /> Register ({wines.length})
              </button>

              <button
                onClick={() => setCurrentTab('tasting')}
                disabled={activeSession.status === 'setup'}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentTab === 'tasting'
                    ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 disabled:opacity-30 disabled:pointer-events-none'
                }`}
              >
                <FileText className="w-4 h-4 text-wine-400" /> Tasting Sheet
              </button>

              <button
                onClick={() => setCurrentTab('dashboard')}
                disabled={activeSession.status === 'setup'}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentTab === 'dashboard'
                    ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 disabled:opacity-30 disabled:pointer-events-none'
                }`}
              >
                <Trophy className="w-4 h-4 text-gold-400" /> Standings & Stats
              </button>
            </>
          )}

          <button
            onClick={() => setCurrentTab('history')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              currentTab === 'history'
                ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60'
            }`}
          >
            <HistoryIcon className="w-4 h-4" /> History
          </button>

          <button
            onClick={() => setCurrentTab('palate')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              currentTab === 'palate'
                ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60'
            }`}
          >
            <Users className="w-4 h-4" /> Palate
          </button>

          <button
            onClick={() => setCurrentTab('cellar')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              currentTab === 'cellar'
                ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60'
            }`}
          >
            <Star className="w-4 h-4" /> Cellar
          </button>

          <button
            onClick={() => setCurrentTab('settings')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              currentTab === 'settings'
                ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60'
            }`}
          >
            <SettingsIcon className="w-4 h-4" /> Settings
          </button>
        </nav>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 pt-8">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <RefreshCw className="w-8 h-8 text-wine-500 animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Fetching tasting board...</p>
          </div>
        ) : (currentTab === 'settings' || currentTab === 'history' || currentTab === 'palate' || currentTab === 'cellar') ? (
          /* These views are accessible even without an active session */
          <div className="space-y-6">
            {currentTab === 'history' && <History voterName={voterName} onRefresh={loadData} />}
            {currentTab === 'palate' && <TasterProfiles voterName={voterName} />}
            {currentTab === 'cellar' && <Cellar voterName={voterName} />}
            {currentTab === 'settings' && (
              <Settings
                voterName={voterName}
                isHost={isHost}
                onUpdateVoterName={handleUpdateVoterName}
                onUpdateHostMode={handleUpdateHostMode}
              />
            )}
          </div>
        ) : !activeSession ? (
          /* Session Initialization Screen */
          <div className="max-w-md mx-auto py-24 space-y-8 animate-scale-in">
            <div className="text-center space-y-3">
              <WineIcon className="w-16 h-16 text-wine-400 mx-auto drop-shadow-[0_4px_12px_rgba(110,23,44,0.15)] animate-pulse" />
              <h2 className="text-3xl font-bold font-serif text-slate-100">Initialize Tasting Session</h2>
              <p className="text-sm text-slate-400">
                Ready to taste? Start a session to invite participants and log wines.
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 space-y-6">
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Session Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fifty Shades of Grigio"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-700 focus:border-[#821D35] rounded-lg text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#821D35] font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Event Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-700 focus:border-[#821D35] rounded-lg text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#821D35] font-semibold font-mono"
                  />
                </div>

                {!voterName && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 shadow-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold mb-0.5 text-amber-900">Profile Name Required</p>
                      <p className="text-amber-800">Set your name in settings first so the app can register your wine contributions.</p>
                      <button
                        type="button"
                        onClick={() => setCurrentTab('settings')}
                        className="text-amber-900 font-bold hover:underline block text-left"
                      >
                        Go to Settings &rarr;
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creatingSession || !voterName}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#821D35] to-[#5A1425] hover:from-[#6E172C] hover:to-[#3D0C17] disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-white font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" /> {creatingSession ? "Creating..." : "Initialize Session"}
                </button>
              </form>
            </div>

            {/* Quick Link to View History */}
            <div className="text-center">
              <button
                onClick={() => setCurrentTab('history')}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                <HistoryIcon className="w-3.5 h-3.5" /> View Historical Tasting Archives
              </button>
            </div>
          </div>
        ) : (
          /* Main Views Router */
          <div>
            {currentTab === 'intake' && (
              <IntakeForm
                wines={wines}
                voterName={voterName}
                isHost={isHost}
                sessionName={activeSession.name}
                sessionDate={(activeSession.date || '').split('T')[0]}
                onAddWine={handleAddWine}
                onAddWinesBatch={handleAddWinesBatch}
                onDeleteWine={handleDeleteWine}
                onUpdateWine={handleUpdateWine}
                onStartTasting={handleStartTasting}
              />
            )}

            {currentTab === 'tasting' && (
              <TastingSheet
                wines={wines}
                voterName={voterName}
                votes={votes}
                sessionName={activeSession.name}
                sessionDate={(activeSession.date || '').split('T')[0]}
                onSubmitStandaloneRating={handleSubmitStandaloneRating}
                onUpdateVoterName={handleUpdateVoterName}
              />
            )}

            {currentTab === 'dashboard' && (
              <Dashboard
                session={activeSession}
                wines={wines}
                votes={votes}
                isHost={isHost}
                matchWinners={activeSession.match_winners || {}}
                onRevealWines={handleRevealWines}
                onResetSession={handleResetSession}
              />
            )}
          </div>
        )}

      </main>
    </div>
  );
}
