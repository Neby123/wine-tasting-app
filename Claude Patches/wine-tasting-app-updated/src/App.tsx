import React, { useState, useEffect, useId, useRef, useCallback } from 'react';
import { db, supabase } from './utils/supabase';
import type {
  WineSession,
  Wine,
  Vote,
  ToastMessage,
  BuyAgainIntent,
  PerceivedPriceTier
} from './types/wine';
import { getLocalCalendarDateString, extractCalendarDate } from './utils/date';
import { safeStorageGet, safeStorageSet, safeStorageRemove, generateUuid } from './utils/storage';
import { buildHistoryReport, hasHistoryDivergence } from './utils/tastingAnalytics';
import { useFormAriaSync } from './hooks/useFormAriaSync';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ToastRegion } from './components/ToastRegion';
import IntakeForm from './components/IntakeForm';
import TastingSheet from './components/TastingSheet';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Settings from './components/Settings';
import TasterProfiles from './components/TasterProfiles';
import Cellar from './components/Cellar';
import {
  Wine as WineIcon,
  Trophy,
  ClipboardList,
  History as HistoryIcon,
  Settings as SettingsIcon,
  PlusCircle,
  AlertCircle,
  RefreshCw,
  Users,
  Star,
  FileText
} from 'lucide-react';

const TAB_VALUES = ['dashboard', 'tasting', 'intake', 'history', 'settings', 'palate', 'cellar'] as const;
type TabValue = typeof TAB_VALUES[number];

const TAB_TITLES: Record<TabValue, string> = {
  intake: 'Register Bottles',
  tasting: 'Tasting Sheet',
  dashboard: 'Standings & Stats',
  history: 'Historical Archives',
  palate: 'Palate Profiles',
  cellar: 'My Cellar',
  settings: 'Settings'
};

const getTabFromHash = (): TabValue => {
  const raw = window.location.hash.replace(/^#/, '');
  return (TAB_VALUES as readonly string[]).includes(raw) ? (raw as TabValue) : 'intake';
};

export default function App() {
  const formIdBase = useId();
  const initFormRef = useRef<HTMLFormElement>(null);

  // Profile States
  const [voterName, setVoterName] = useState(() => safeStorageGet('WINE_TASTING_VOTER_NAME') || '');
  const [isHost, setIsHost] = useState(() => safeStorageGet('WINE_TASTING_IS_HOST') === 'true');

  // DB States
  const [activeSession, setActiveSession] = useState<WineSession | null>(null);
  const [wines, setWines] = useState<Wine[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hasLateArchiveDesync, setHasLateArchiveDesync] = useState(false);
  const [syncingArchive, setSyncingArchive] = useState(false);

  // Navigation & Dialog/Toast States
  const [currentTab, setCurrentTab] = useState<TabValue>(getTabFromHash);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resettingSession, setResettingSession] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // New session input
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionDate, setNewSessionDate] = useState(() => getLocalCalendarDateString());
  const [sessionFormError, setSessionFormError] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  const loadSeqRef = useRef(0);
  const desyncSeqRef = useRef(0);
  const revealingRef = useRef(false);

  useFormAriaSync(initFormRef, [newSessionName, newSessionDate, sessionFormError]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, tone: ToastMessage['tone'] = 'info') => {
      const id = generateUuid();
      setToasts(prev => [...prev.slice(-3), { id, message, tone }]);
      const durationMs = tone === 'error' ? 7000 : 4500;
      window.setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, durationMs);
    },
    []
  );

  // Check whether late guest votes have diverged from the frozen History archive
  const refreshArchiveDesyncStatus = useCallback(
    async (session: WineSession | null, currentWines: Wine[], currentVotes: Vote[]) => {
      if (!session || session.status !== 'completed' || !currentWines.some(w => w.revealed)) {
        setHasLateArchiveDesync(false);
        return;
      }
      const seq = ++desyncSeqRef.current;
      try {
        const hist = await db.getHistory();
        if (seq !== desyncSeqRef.current) return;
        const match = hist.find(h => h.id === session.id);
        setHasLateArchiveDesync(hasHistoryDivergence(session, currentWines, currentVotes, match));
      } catch {
        // Leave existing state unchanged if history read fails transiently
      }
    },
    []
  );

  // Load active session and data
  const loadData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    if (!supabase) {
      setActiveSession(null);
      setWines([]);
      setVotes([]);
      setHasLateArchiveDesync(false);
      setLoadError('Supabase is not configured. Please enter your database URL and API key in Settings.');
      setLoading(false);
      return;
    }
    try {
      const session = await db.getActiveSession();
      if (seq !== loadSeqRef.current) return;
      setLoadError('');
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
        void refreshArchiveDesyncStatus(session, winesData, votesData);
      } else {
        setWines([]);
        setVotes([]);
        setHasLateArchiveDesync(false);
      }
    } catch (err) {
      console.error('Error loading database:', err);
      if (seq === loadSeqRef.current) {
        const msg = err instanceof Error ? err.message : 'Unable to reach database.';
        setLoadError(msg);
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [refreshArchiveDesyncStatus]);

  // Initial load & verified cleanup of legacy local/mock keys
  useEffect(() => {
    loadData();
    const cleanupLegacyStorage = async () => {
      if (!supabase) return;
      try {
        const { data: existingRows, error } = await supabase.from('history').select('id');
        if (error) return;
        safeStorageRemove('WINE_TASTING_MOCK_HISTORY');
        const rawHistory = safeStorageGet('WINE_TASTING_HISTORY');
        if (rawHistory) {
          const parsed = JSON.parse(rawHistory);
          const existingIds = new Set((existingRows || []).map(r => r.id));
          if (!Array.isArray(parsed) || parsed.every((s: { id?: string }) => s?.id && existingIds.has(s.id))) {
            safeStorageRemove('WINE_TASTING_HISTORY');
          }
        }
      } catch {
        // Leave local storage untouched if verification fails
      }
    };
    cleanupLegacyStorage();
  }, [loadData]);

  // Dynamic document title reflecting active view and tasting event
  useEffect(() => {
    const viewLabel = TAB_TITLES[currentTab];
    document.title = activeSession
      ? `${viewLabel} · ${activeSession.name} — Grand Taste Tourney`
      : `${viewLabel} — Grand Taste Tourney`;
  }, [currentTab, activeSession]);

  // Reflect active tab into URL hash
  useEffect(() => {
    if (getTabFromHash() !== currentTab) {
      window.location.hash = currentTab;
    }
  }, [currentTab]);

  // Reflect hash changes back into state
  useEffect(() => {
    const onHashChange = () => {
      const next = getTabFromHash();
      setCurrentTab(prev => (prev === next ? prev : next));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Supabase Realtime subscriptions for active sessions (including late votes after reveal)
  useEffect(() => {
    if (!activeSession) return;
    const client = supabase;
    if (!client) return;

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
          const newSession = payload.new as WineSession;
          if (!newSession || !newSession.id) {
            setActiveSession(null);
            setWines([]);
            setVotes([]);
            setHasLateArchiveDesync(false);
          } else {
            setActiveSession(newSession);
            if (newSession.status === 'completed') {
              const [w, v] = await Promise.all([
                db.getWines(newSession.id),
                db.getVotes(newSession.id)
              ]);
              setWines(w);
              setVotes(v);
              setCurrentTab(prev => (prev === 'intake' || prev === 'tasting' ? 'dashboard' : prev));
              void refreshArchiveDesyncStatus(newSession, w, v);
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
          const updatedVotes = await db.getVotes(activeSession.id);
          setVotes(updatedVotes);
          void refreshArchiveDesyncStatus(activeSession, wines, updatedVotes);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [activeSession?.id, activeSession?.status, refreshArchiveDesyncStatus, wines]);

  // Fallback polling (10s while open, 25s when completed to catch late guest ratings)
  useEffect(() => {
    if (!activeSession) return;
    const intervalMs = activeSession.status === 'completed' ? 25000 : 10000;
    const timer = window.setInterval(() => {
      void loadData();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [activeSession?.id, activeSession?.status, loadData]);

  // Refresh data when tab regains visibility after mobile backgrounding
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadData();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loadData]);

  // Profile Save Actions
  const handleUpdateVoterName = (name: string) => {
    const trimmed = (name || '').trim();
    setVoterName(trimmed);
    safeStorageSet('WINE_TASTING_VOTER_NAME', trimmed);
  };

  const handleUpdateHostMode = (host: boolean) => {
    setIsHost(host);
    safeStorageSet('WINE_TASTING_IS_HOST', host ? 'true' : 'false');
  };

  // Session Management Actions
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionFormError('');
    if (!newSessionName.trim()) {
      setSessionFormError('Enter a session title before initializing.');
      return;
    }
    if (!voterName.trim()) {
      setSessionFormError('Set your profile name in Settings first so contributions track correctly.');
      return;
    }

    setCreatingSession(true);
    try {
      const session = await db.createSession(newSessionName.trim(), newSessionDate.trim());
      setActiveSession(session);
      setWines([]);
      setVotes([]);
      setHasLateArchiveDesync(false);
      setCurrentTab('intake');
      addToast(`Started session "${session.name}".`, 'success');
    } catch (err) {
      console.error('Failed to create session:', err);
      const msg = (err as Error).message || String(err);
      const formatted = msg.includes('Failed to fetch')
        ? 'Connection Failed: Unable to reach Supabase. Check Settings -> Database Configuration.'
        : `Failed to initialize session: ${msg}`;
      setSessionFormError(formatted);
      addToast(formatted, 'error');
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
      addToast(`Added "${newWine.name}" to the registry.`, 'success');
    } catch (err) {
      console.error('Failed to add wine:', err);
      addToast('Failed to add bottle. Check your connection and try again.', 'error');
      throw err;
    }
  };

  const handleAddWinesBatch = async (winesData: Omit<Wine, 'id' | 'session_id' | 'revealed'>[]) => {
    if (!activeSession || winesData.length === 0) return;
    try {
      const inserted = await db.addWinesBatch(
        winesData.map(w => ({ ...w, session_id: activeSession.id }))
      );
      setWines(prev => [...prev, ...inserted]);
      addToast(`Loaded ${inserted.length} bottles into registry.`, 'success');
    } catch (err) {
      console.error('Failed to add batch wines:', err);
      addToast('Failed to bulk-load bottles.', 'error');
      throw err;
    }
  };

  const handleDeleteWine = async (wineId: string) => {
    try {
      await db.deleteWine(wineId);
      setWines(prev => prev.filter(w => w.id !== wineId));
      addToast('Bottle removed from registry.', 'info');
    } catch (err) {
      console.error('Failed to delete wine:', err);
      addToast('Failed to delete bottle. Check your host/owner permissions and try again.', 'error');
      throw err;
    }
  };

  const handleUpdateWine = async (
    wineId: string,
    updates: Omit<Partial<Omit<Wine, 'id' | 'session_id'>>, 'vintage'> & { vintage?: string | null }
  ) => {
    try {
      const updated = await db.updateWine(wineId, updates);
      setWines(prev => prev.map(w => (w.id === wineId ? updated : w)));
      addToast('Bottle details updated.', 'success');
    } catch (err) {
      console.error('Failed to update wine:', err);
      addToast('Unable to update bottle details. Ensure session is in setup or enable Host Mode.', 'error');
      throw err;
    }
  };

  const handleStartTasting = async () => {
    if (!activeSession) return;

    setLoading(true);
    try {
      const updatedSession = await db.updateSessionStatus(activeSession.id, 'tasting');
      setActiveSession(updatedSession);
      await loadData();
      setCurrentTab('tasting');
      addToast('Tasting session is now live!', 'success');
    } catch (err) {
      console.error(err);
      addToast('Failed to start tasting session. Verify Host Mode is active in Settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const syncHistoryArchiveNow = useCallback(
    async (sessionOverride?: WineSession, winesOverride?: Wine[], votesOverride?: Vote[]) => {
      const targetSession = sessionOverride || activeSession;
      if (!targetSession) return;
      setSyncingArchive(true);
      try {
        const [freshWines, freshVotes] = await Promise.all([
          winesOverride ? Promise.resolve(winesOverride) : db.getWines(targetSession.id).catch(() => wines),
          votesOverride ? Promise.resolve(votesOverride) : db.getVotes(targetSession.id).catch(() => votes)
        ]);
        const report = buildHistoryReport(targetSession, freshWines, freshVotes);
        await db.addHistorySession(report);
        setWines(freshWines);
        setVotes(freshVotes);
        setHasLateArchiveDesync(false);
        addToast('History archive synchronized with latest ratings.', 'success');
      } catch (err) {
        console.error('Failed to sync history archive:', err);
        addToast('Failed to sync history archive. Verify Host Mode & passcode in Settings.', 'error');
      } finally {
        setSyncingArchive(false);
      }
    },
    [activeSession, wines, votes, addToast]
  );

  const handleRevealWines = async (mapping: Record<string, string>) => {
    if (!activeSession || revealingRef.current) return;
    revealingRef.current = true;
    setLoading(true);
    try {
      const [latestWinesRaw, latestVotesRaw] = await Promise.all([
        db.getWines(activeSession.id).catch(() => wines),
        db.getVotes(activeSession.id).catch(() => votes)
      ]);
      const sourceWines = latestWinesRaw.length > 0 ? latestWinesRaw : wines;
      const sourceVotes = latestVotesRaw.length > 0 ? latestVotesRaw : votes;

      const labelByWineId: Record<string, string> = {};
      Object.entries(mapping).forEach(([label, wineId]) => {
        labelByWineId[wineId] = label;
      });
      const mappedWinesPreview = sourceWines.map(w => ({
        ...w,
        blind_label: labelByWineId[w.id] || w.blind_label,
        revealed: Boolean(labelByWineId[w.id] || w.revealed)
      }));

      const report = buildHistoryReport(activeSession, mappedWinesPreview, sourceVotes);

      // Persist idempotent history archive BEFORE mutating wines/session state
      await db.addHistorySession(report);

      // Reveal wines (rolls back on partial failure)
      const updatedWines = await db.mapAndRevealWines(activeSession.id, mapping);

      // Mark session completed (rolls back reveal flags if status update fails)
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

      // Best-effort personal wishlist sync for acting voter's "buy_again = yes" picks
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
        // Best-effort wishlist sync never blocks reveal
      }

      setWines(updatedWines);
      setVotes(sourceVotes);
      setActiveSession(updatedSession);
      setHasLateArchiveDesync(false);
      setCurrentTab('dashboard');
      addToast('Wines unbagged & session archived!', 'success');
    } catch (err) {
      console.error('Failed to reveal wines:', err);
      await loadData().catch(() => {});
      addToast('Failed to reveal wines. Verify Host Mode & passcode in Settings.', 'error');
      throw err;
    } finally {
      revealingRef.current = false;
      setLoading(false);
    }
  };

  const handleRequestResetSession = async () => {
    setResetConfirmOpen(true);
  };

  const handleConfirmResetSession = async () => {
    if (!activeSession) {
      setResetConfirmOpen(false);
      return;
    }
    setResettingSession(true);
    try {
      await db.updateSessionStatus(activeSession.id, 'completed');
      setActiveSession(null);
      setWines([]);
      setVotes([]);
      setHasLateArchiveDesync(false);
      setCurrentTab('intake');
      setResetConfirmOpen(false);
      addToast('Session closed. Ready to initialize a fresh tasting.', 'info');
    } catch (err) {
      console.error(err);
      addToast('Failed to reset session. Verify Host Mode & connection.', 'error');
    } finally {
      setResettingSession(false);
    }
  };

  // Vote Actions
  const handleSubmitStandaloneRating = async (
    wineLabel: string,
    score: number,
    notes?: string,
    extraMetrics?: {
      perceivedPrice?: PerceivedPriceTier;
      buyAgain?: BuyAgainIntent;
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

      const [latestWines, latestVotes] = await Promise.all([
        db.getWines(activeSession.id),
        db.getVotes(activeSession.id)
      ]);
      setWines(latestWines);
      setVotes(latestVotes);

      if (activeSession.status === 'completed' && latestWines.some(w => w.revealed)) {
        if (isHost) {
          const report = buildHistoryReport(activeSession, latestWines, latestVotes);
          await db.addHistorySession(report).catch(() => {
            setHasLateArchiveDesync(true);
          });
        } else {
          setHasLateArchiveDesync(true);
        }
      }
    } catch (err) {
      console.error('Failed to submit standalone rating:', err);
      throw err;
    }
  };

  const sessionTitleInputId = `${formIdBase}-session-title`;
  const sessionDateInputId = `${formIdBase}-session-date`;

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-12">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Top Banner Navigation */}
      <header className="glass-panel sticky top-0 z-40 border-b border-slate-800/80 px-4 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() =>
            setCurrentTab(
              activeSession?.status === 'tasting'
                ? 'tasting'
                : activeSession?.status === 'completed'
                  ? 'dashboard'
                  : 'intake'
            )
          }
          className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
          title="Return to Home / Active Session"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#821D35] to-[#5A1425] flex items-center justify-center shadow-md shadow-wine-200/20 group-hover:scale-105 transition-transform shrink-0">
            <WineIcon className="w-5.5 h-5.5 text-white" aria-hidden="true" />
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
              Blind Tasting Club • 0–100 Flight • {supabase ? 'Multiplayer Connected' : 'Connection Pending (Check Settings)'}
            </p>
          </div>
        </button>

        {/* Global Navigation */}
        <nav aria-label="Primary sections" className="flex flex-wrap items-center bg-slate-850/90 p-1 border border-slate-800 rounded-xl text-xs font-semibold gap-1 shadow-sm">
          {(!activeSession || activeSession.status === 'completed') && (
            <button
              type="button"
              aria-current={!activeSession && currentTab === 'intake' ? 'page' : undefined}
              onClick={() => {
                setActiveSession(null);
                setWines([]);
                setVotes([]);
                setHasLateArchiveDesync(false);
                setCurrentTab('intake');
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                !activeSession && currentTab === 'intake'
                  ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-wine-400" aria-hidden="true" /> New Session
            </button>
          )}

          {activeSession && (
            <>
              <button
                type="button"
                aria-current={currentTab === 'intake' ? 'page' : undefined}
                onClick={() => setCurrentTab('intake')}
                disabled={activeSession.status !== 'setup'}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentTab === 'intake'
                    ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 disabled:opacity-30 disabled:pointer-events-none'
                }`}
              >
                <ClipboardList className="w-4 h-4" aria-hidden="true" /> Register ({wines.length})
              </button>

              <button
                type="button"
                aria-current={currentTab === 'tasting' ? 'page' : undefined}
                onClick={() => setCurrentTab('tasting')}
                disabled={activeSession.status === 'setup'}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentTab === 'tasting'
                    ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 disabled:opacity-30 disabled:pointer-events-none'
                }`}
              >
                <FileText className="w-4 h-4 text-wine-400" aria-hidden="true" /> Tasting Sheet
              </button>

              <button
                type="button"
                aria-current={currentTab === 'dashboard' ? 'page' : undefined}
                onClick={() => setCurrentTab('dashboard')}
                disabled={activeSession.status === 'setup'}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentTab === 'dashboard'
                    ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 disabled:opacity-30 disabled:pointer-events-none'
                }`}
              >
                <Trophy className="w-4 h-4 text-gold-400" aria-hidden="true" /> Standings &amp; Stats
              </button>
            </>
          )}

          <button
            type="button"
            aria-current={currentTab === 'history' ? 'page' : undefined}
            onClick={() => setCurrentTab('history')}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              currentTab === 'history'
                ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60'
            }`}
          >
            <HistoryIcon className="w-4 h-4" aria-hidden="true" /> History
          </button>

          <button
            type="button"
            aria-current={currentTab === 'palate' ? 'page' : undefined}
            onClick={() => setCurrentTab('palate')}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              currentTab === 'palate'
                ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60'
            }`}
          >
            <Users className="w-4 h-4" aria-hidden="true" /> Palate
          </button>

          <button
            type="button"
            aria-current={currentTab === 'cellar' ? 'page' : undefined}
            onClick={() => setCurrentTab('cellar')}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              currentTab === 'cellar'
                ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60'
            }`}
          >
            <Star className="w-4 h-4" aria-hidden="true" /> Cellar
          </button>

          <button
            type="button"
            aria-current={currentTab === 'settings' ? 'page' : undefined}
            onClick={() => setCurrentTab('settings')}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              currentTab === 'settings'
                ? 'bg-white shadow-sm border border-slate-800 text-wine-200 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/60'
            }`}
          >
            <SettingsIcon className="w-4 h-4" aria-hidden="true" /> Settings
          </button>
        </nav>
      </header>

      {/* Main Container */}
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 sm:pt-8 focus:outline-none">
        {loadError && (
          <div role="alert" className="mb-6 bg-rose-50 border border-rose-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900 text-xs shadow-sm">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold">Database connection issue</p>
                <p className="text-rose-800">{loadError}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void loadData();
                }}
                className="min-h-[44px] px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl transition-colors"
              >
                Retry Connection
              </button>
              <button
                type="button"
                onClick={() => setCurrentTab('settings')}
                className="min-h-[44px] px-4 py-2 bg-white border border-rose-300 text-rose-900 font-semibold rounded-xl hover:bg-rose-100 transition-colors"
              >
                Settings
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <RefreshCw className="w-8 h-8 text-wine-500 animate-spin" aria-hidden="true" />
            <p className="text-sm text-slate-500 font-medium">Fetching tasting board...</p>
          </div>
        ) : (currentTab === 'settings' || currentTab === 'history' || currentTab === 'palate' || currentTab === 'cellar') ? (
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
                onNotify={addToast}
              />
            )}
          </div>
        ) : !activeSession ? (
          /* Session Initialization Screen */
          <div className="max-w-md mx-auto py-16 sm:py-24 space-y-8 animate-scale-in">
            <div className="text-center space-y-3">
              <WineIcon className="w-16 h-16 text-wine-400 mx-auto drop-shadow-[0_4px_12px_rgba(110,23,44,0.15)] animate-pulse" aria-hidden="true" />
              <h2 className="text-3xl font-bold font-serif text-slate-100">Initialize Tasting Session</h2>
              <p className="text-sm text-slate-400">
                Ready to taste? Start a session to invite participants and log wines.
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-6 space-y-6">
              <form ref={initFormRef} onSubmit={handleCreateSession} noValidate className="space-y-4">
                <div className="field-group">
                  <label htmlFor={sessionTitleInputId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Session Title
                  </label>
                  <input
                    id={sessionTitleInputId}
                    type="text"
                    required
                    data-error="Session title is required."
                    placeholder="e.g. Friday Night Cabernet Flight"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-700 focus:border-[#821D35] rounded-lg text-slate-100 placeholder:text-slate-500 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#821D35] font-semibold"
                  />
                </div>

                <div className="field-group">
                  <label htmlFor={sessionDateInputId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Event Date
                  </label>
                  <input
                    id={sessionDateInputId}
                    type="date"
                    required
                    data-error="Event date is required."
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-700 focus:border-[#821D35] rounded-lg text-slate-100 placeholder:text-slate-500 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#821D35] font-semibold font-mono"
                  />
                </div>

                {!voterName && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 shadow-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-semibold mb-0.5 text-amber-900">Profile Name Required</p>
                      <p className="text-amber-800">Set your name in settings first so the app can register your wine contributions.</p>
                      <button
                        type="button"
                        onClick={() => setCurrentTab('settings')}
                        className="min-h-[36px] text-amber-900 font-bold hover:underline block text-left"
                      >
                        Go to Settings &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {sessionFormError && (
                  <p role="alert" className="text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-300 px-3 py-2 rounded-lg">
                    {sessionFormError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={creatingSession}
                  className="w-full min-h-[48px] py-2.5 px-4 bg-gradient-to-r from-[#821D35] to-[#5A1425] hover:from-[#6E172C] hover:to-[#3D0C17] disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-white font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" aria-hidden="true" /> {creatingSession ? 'Creating...' : 'Initialize Session'}
                </button>
              </form>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setCurrentTab('history')}
                className="min-h-[44px] px-4 text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center justify-center gap-1 mx-auto"
              >
                <HistoryIcon className="w-3.5 h-3.5" aria-hidden="true" /> View Historical Tasting Archives
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
                sessionDate={extractCalendarDate(activeSession.date)}
                onAddWine={handleAddWine}
                onAddWinesBatch={handleAddWinesBatch}
                onDeleteWine={handleDeleteWine}
                onUpdateWine={handleUpdateWine}
                onStartTasting={handleStartTasting}
              />
            )}

            {currentTab === 'tasting' && (
              <TastingSheet
                sessionId={activeSession.id}
                wines={wines}
                voterName={voterName}
                votes={votes}
                sessionName={activeSession.name}
                sessionDate={extractCalendarDate(activeSession.date)}
                onSubmitStandaloneRating={handleSubmitStandaloneRating}
                onUpdateVoterName={handleUpdateVoterName}
                onNotify={addToast}
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
                onResetSession={handleRequestResetSession}
                hasLateArchiveDesync={hasLateArchiveDesync}
                syncingArchive={syncingArchive}
                onSyncArchive={() => syncHistoryArchiveNow()}
              />
            )}
          </div>
        )}
      </main>

      <ConfirmDialog
        open={resetConfirmOpen}
        tone="danger"
        title="End Tasting Session?"
        message={
          activeSession
            ? `Mark "${activeSession.name}" completed and return to the New Session screen? Unrevealed bottles will not be automatically revealed.`
            : 'End this session and start fresh?'
        }
        confirmLabel="End Session"
        busy={resettingSession}
        onConfirm={handleConfirmResetSession}
        onCancel={() => {
          if (!resettingSession) setResetConfirmOpen(false);
        }}
      />

      <ToastRegion
        toasts={toasts}
        onDismiss={dismissToast}
        suppressed={resetConfirmOpen}
      />
    </div>
  );
}
