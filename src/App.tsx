import React, { useState, useEffect } from 'react';
import { db, isMockMode } from './utils/supabase';
import { WineSession, Wine, Vote, initMockDB } from './utils/mockData';
import IntakeForm from './components/IntakeForm';
import Brackets from './components/Brackets';
import VotingSlider from './components/VotingSlider';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Settings from './components/Settings';
import { Wine as WineIcon, Trophy, Layers, ClipboardList, History as HistoryIcon, Settings as SettingsIcon, PlusCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  // Initialize mock DB on load
  useEffect(() => {
    initMockDB();
  }, []);

  // Profile States
  const [voterName, setVoterName] = useState(() => localStorage.getItem('WINE_TASTING_VOTER_NAME') || '');
  const [isHost, setIsHost] = useState(() => localStorage.getItem('WINE_TASTING_IS_HOST') === 'true');

  // DB States
  const [activeSession, setActiveSession] = useState<WineSession | null>(null);
  const [wines, setWines] = useState<Wine[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation States
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'brackets' | 'intake' | 'history' | 'settings'>('intake');
  const [currentMatch, setCurrentMatch] = useState<{ id: string; wine1: string; wine2: string } | null>(null);
  
  // New session input
  const [newSessionName, setNewSessionName] = useState('Day de Rosé');
  const [creatingSession, setCreatingSession] = useState(false);

  // Load active session and data
  const loadData = async () => {
    try {
      const session = await db.getActiveSession();
      setActiveSession(session);
      
      if (session) {
        const [winesData, votesData] = await Promise.all([
          db.getWines(session.id),
          db.getVotes(session.id)
        ]);
        setWines(winesData);
        setVotes(votesData);

        // Auto redirect tab if tasting starts and we are on intake
        if (session.status === 'tasting' && currentTab === 'intake') {
          setCurrentTab('brackets');
        }
      } else {
        setWines([]);
        setVotes([]);
      }
    } catch (err) {
      console.error("Error loading database:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Poll for updates in background (multiplayer synchronization)
  useEffect(() => {
    const timer = setInterval(() => {
      // Only poll if we have an active session in progress
      if (activeSession && activeSession.status !== 'completed') {
        loadData();
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [activeSession]);

  // Profile Save Actions
  const handleUpdateVoterName = (name: string) => {
    setVoterName(name);
    localStorage.setItem('WINE_TASTING_VOTER_NAME', name);
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
      const session = await db.createSession(newSessionName.trim());
      setActiveSession(session);
      setWines([]);
      setVotes([]);
      setCurrentTab('intake');
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingSession(false);
    }
  };

  const handleAddWine = async (wineData: Omit<Wine, 'id' | 'session_id' | 'revealed'>) => {
    if (!activeSession) return;
    const newWine = await db.addWine({
      ...wineData,
      session_id: activeSession.id
    });
    setWines(prev => [...prev, newWine]);
  };

  const handleDeleteWine = async (wineId: string) => {
    await db.deleteWine(wineId);
    setWines(prev => prev.filter(w => w.id !== wineId));
  };

  const handleStartTasting = async () => {
    if (!activeSession) return;
    
    setLoading(true);
    try {
      // Shift status to tasting (labels A-H are physically on bags, no DB labels yet)
      const updatedSession = await db.updateSessionStatus(activeSession.id, 'tasting');
      setActiveSession(updatedSession);
      await loadData();
      setCurrentTab('brackets');
    } catch (err) {
      console.error(err);
      alert("Failed to start tasting session: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveMatch = async (matchId: string, winnerLabel: string) => {
    if (!activeSession) return;
    
    // Update local state copy
    const updatedWinners = {
      ...(activeSession.match_winners || {}),
      [matchId]: winnerLabel
    };

    // Update in Database
    const updatedSession = await db.updateSessionMatchWinners(activeSession.id, updatedWinners);
    setActiveSession(updatedSession);
    await loadData();
  };

  const handleRevealWines = async (mapping: Record<string, string>) => {
    if (!activeSession) return;
    setLoading(true);
    try {
      // 1. Save mapping and reveal wines in database
      const updatedWines = await db.mapAndRevealWines(activeSession.id, mapping);
      
      // 2. Set session status to completed
      const updatedSession = await db.updateSessionStatus(activeSession.id, 'completed');

      // 3. Compile history report
      const getWineAppreciationIndex = (label: string) => {
        const wineVotes = votes.filter(v => v.wine_1_label === label || v.wine_2_label === label);
        if (wineVotes.length === 0) return 50;
        let scoreSum = 0;
        wineVotes.forEach(v => {
          scoreSum += (v.wine_1_label === label) ? (100 - v.slider_value) : v.slider_value;
        });
        return Math.round(scoreSum / wineVotes.length);
      };

      const wineStats = updatedWines.map(w => {
        const label = w.blind_label || '';
        const score = getWineAppreciationIndex(label);
        let wins = 0;
        Object.values(updatedSession?.match_winners || {}).forEach(winner => {
          if (winner === label) wins++;
        });
        return {
          ...w,
          score,
          wins,
          valueRatio: score / Math.max(1, w.price)
        };
      });

      const sorted = [...wineStats].sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.score - a.score;
      });

      const bestValue = [...wineStats].sort((a, b) => b.valueRatio - a.valueRatio)[0];
      const bisLabel = updatedSession?.match_winners?.['F'];
      const bisWine = wineStats.find(w => w.blind_label === bisLabel);

      // Find giant killer match
      let giantKillerMatch: string | undefined = undefined;
      let maxMargin = 0;
      const matchesList = [
        { id: 'Q1', w1: 'A', w2: 'B' },
        { id: 'Q2', w1: 'C', w2: 'D' },
        { id: 'Q3', w1: 'E', w2: 'F' },
        { id: 'Q4', w1: 'G', w2: 'H' },
        { id: 'S1', w1: updatedSession?.match_winners?.['Q1'], w2: updatedSession?.match_winners?.['Q2'] },
        { id: 'S2', w1: updatedSession?.match_winners?.['Q3'], w2: updatedSession?.match_winners?.['Q4'] },
        { id: 'F', w1: updatedSession?.match_winners?.['S1'], w2: updatedSession?.match_winners?.['S2'] }
      ];

      matchesList.forEach(m => {
        const winnerLabel = updatedSession?.match_winners?.[m.id];
        if (!winnerLabel || !m.w1 || !m.w2) return;
        const loserLabel = winnerLabel === m.w1 ? m.w2 : m.w1;
        const winner = wineStats.find(w => w.blind_label === winnerLabel);
        const loser = wineStats.find(w => w.blind_label === loserLabel);

        if (winner && loser && winner.price < loser.price) {
          const margin = loser.price - winner.price;
          if (margin > maxMargin) {
            maxMargin = margin;
            giantKillerMatch = `${winner.name} ($${winner.price.toFixed(2)}) beat ${loser.name} ($${loser.price.toFixed(2)})`;
          }
        }
      });

      const report = {
        id: activeSession.id,
        name: activeSession.name,
        date: activeSession.date,
        winnerName: bisWine?.name || "Unknown",
        winnerPrice: bisWine?.price || 0,
        winnerBroughtBy: bisWine?.submitted_by || "Unknown",
        winesCount: updatedWines.length,
        groupWinner: bisWine ? `${bisWine.name} ($${bisWine.price.toFixed(2)})` : "N/A",
        secondPlace: sorted[1] ? `${sorted[1].name} ($${sorted[1].price.toFixed(2)})` : "N/A",
        bestValue: bestValue ? `${bestValue.name} ($${bestValue.price.toFixed(2)})` : "N/A",
        giantKiller: giantKillerMatch,
        wines: wineStats.map(w => ({
          name: w.name,
          price: w.price,
          submitted_by: w.submitted_by,
          blind_label: w.blind_label || undefined,
          score: w.score,
          wins: w.wins
        }))
      };

      // Add to archive
      await db.addHistorySession(report);

      setActiveSession(updatedSession);
      await loadData();
      setCurrentTab('dashboard');
    } catch (err) {
      console.error(err);
      alert("Failed to reveal wines: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = async () => {
    if (!window.confirm("Are you sure you want to delete this session and restart? All current entries and votes will be lost.")) return;
    if (!activeSession) return;
    
    setLoading(true);
    try {
      await db.updateSessionStatus(activeSession.id, 'completed');
      setActiveSession(null);
      setWines([]);
      setVotes([]);
      setCurrentTab('settings');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Vote Actions
  const handleSelectMatch = (matchId: string, wine1: string, wine2: string) => {
    if (!voterName) {
      alert("Please set your Name/Participant name in settings before tasting!");
      setCurrentTab('settings');
      return;
    }
    setCurrentMatch({ id: matchId, wine1, wine2 });
  };

  const handleSubmitVote = async (sliderValue: number, notes1: string, notes2: string) => {
    if (!activeSession || !currentMatch) return;

    await db.submitVote({
      session_id: activeSession.id,
      voter_name: voterName,
      match_id: currentMatch.id,
      wine_1_label: currentMatch.wine1,
      wine_2_label: currentMatch.wine2,
      slider_value: sliderValue,
      notes_wine_1: notes1 || undefined,
      notes_wine_2: notes2 || undefined
    });

    await loadData();
  };

  // Check existing vote
  const getExistingVote = () => {
    if (!currentMatch) return undefined;
    return votes.find(v => 
      v.match_id === currentMatch.id && 
      v.voter_name.toLowerCase() === voterName.toLowerCase()
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-12">
      {/* Top Banner Navigation */}
      <header className="glass-panel sticky top-0 z-50 border-b border-slate-800/80 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-wine-800 to-wine-600 flex items-center justify-center shadow-lg shadow-wine-950/40">
            <WineIcon className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold font-serif tracking-tight text-wine-100 flex items-center gap-1.5">
              Grand Taste Tourney
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">
              {isMockMode ? "Mock Sandbox Mode" : "Multiplayer Active"}
            </p>
          </div>
        </div>

        {/* Global User status info */}
        <nav className="flex flex-wrap items-center bg-slate-950/60 p-1 border border-slate-850 rounded-xl text-xs font-semibold gap-1">
          {activeSession && (
            <>
              <button
                onClick={() => { setCurrentMatch(null); setCurrentTab('intake'); }}
                disabled={activeSession.status !== 'setup'}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentTab === 'intake' && !currentMatch
                    ? 'bg-wine-850 text-wine-200' 
                    : 'text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none'
                }`}
              >
                <ClipboardList className="w-4 h-4" /> Register ({wines.length})
              </button>

              <button
                onClick={() => { setCurrentMatch(null); setCurrentTab('brackets'); }}
                disabled={activeSession.status === 'setup'}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentTab === 'brackets' || currentMatch
                    ? 'bg-wine-850 text-wine-200' 
                    : 'text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none'
                }`}
              >
                <Layers className="w-4 h-4" /> Bracket
              </button>

              <button
                onClick={() => { setCurrentMatch(null); setCurrentTab('dashboard'); }}
                disabled={activeSession.status === 'setup'}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentTab === 'dashboard' && !currentMatch
                    ? 'bg-wine-850 text-wine-200' 
                    : 'text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none'
                }`}
              >
                <Trophy className="w-4 h-4" /> Standings & Stats
              </button>
            </>
          )}

          <button
            onClick={() => { setCurrentMatch(null); setCurrentTab('history'); }}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              currentTab === 'history' && !currentMatch
                ? 'bg-wine-850 text-wine-200' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HistoryIcon className="w-4 h-4" /> History
          </button>

          <button
            onClick={() => { setCurrentMatch(null); setCurrentTab('settings'); }}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
              currentTab === 'settings' && !currentMatch
                ? 'bg-wine-850 text-wine-200' 
                : 'text-slate-400 hover:text-slate-200'
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
        ) : (currentTab === 'settings' || currentTab === 'history') ? (
          /* Settings and History are accessible even without active session */
          <div className="space-y-6">
            {currentTab === 'history' && <History voterName={voterName} onRefresh={loadData} />}
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
              <WineIcon className="w-16 h-16 text-wine-400 mx-auto drop-shadow-[0_0_15px_rgba(135,28,54,0.3)] animate-pulse" />
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
                    placeholder="e.g. Day de Rosé"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500 font-semibold"
                  />
                </div>

                {!voterName && (
                  <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <div className="space-y-1">
                      <p className="font-semibold mb-0.5">Profile Name Required</p>
                      <p className="text-slate-400">Set your name in settings first so the app can register your wine contributions.</p>
                      <button
                        type="button"
                        onClick={() => setCurrentTab('settings')}
                        className="text-amber-400 font-bold hover:underline block text-left"
                      >
                        Go to Settings &rarr;
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creatingSession || !voterName}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-wine-800 to-wine-600 hover:from-wine-700 hover:to-wine-500 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-600 disabled:font-medium text-white font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-wine-950/20"
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
        ) : currentMatch ? (
          /* Active Slider Evaluator view */
          <VotingSlider
            matchId={currentMatch.id}
            wine1Label={currentMatch.wine1}
            wine2Label={currentMatch.wine2}
            voterName={voterName}
            existingVote={getExistingVote()}
            onSubmitVote={handleSubmitVote}
            onBackToBracket={() => setCurrentMatch(null)}
          />
        ) : (
          /* Main Views Router */
          <div>
            {currentTab === 'intake' && (
              <IntakeForm
                wines={wines}
                voterName={voterName}
                isHost={isHost}
                onAddWine={handleAddWine}
                onDeleteWine={handleDeleteWine}
                onStartTasting={handleStartTasting}
              />
            )}

            {currentTab === 'brackets' && (
              <Brackets
                wines={wines}
                votes={votes}
                voterName={voterName}
                revealed={wines.some(w => w.revealed)}
                matchWinners={activeSession.match_winners || {}}
                onSelectMatch={handleSelectMatch}
              />
            )}

            {currentTab === 'dashboard' && (
              <Dashboard
                session={activeSession}
                wines={wines}
                votes={votes}
                isHost={isHost}
                matchWinners={activeSession.match_winners || {}}
                onResolveMatch={handleResolveMatch}
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
