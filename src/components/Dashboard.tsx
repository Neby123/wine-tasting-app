import React, { useState } from 'react';
import { Wine, Vote, WineSession } from '../utils/mockData';
import { Trophy, DollarSign, Award, Eye, Shield, Users, RefreshCw, BarChart2 } from 'lucide-react';

interface DashboardProps {
  session: WineSession;
  wines: Wine[];
  votes: Vote[];
  isHost: boolean;
  matchWinners: Record<string, string>;
  onResolveMatch: (matchId: string, winnerLabel: string) => Promise<void>;
  onRevealWines: (mapping: Record<string, string>) => Promise<void>;
  onResetSession: () => Promise<void>;
}

export default function Dashboard({
  session,
  wines,
  votes,
  isHost,
  matchWinners,
  onResolveMatch,
  onRevealWines,
  onResetSession
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'analysis'>('status');
  const [mapping, setMapping] = useState<Record<string, string>>({
    A: '', B: '', C: '', D: '', E: '', F: '', G: '', H: ''
  });

  const selectedWineIds = Object.values(mapping).filter(Boolean);
  const hasDuplicates = selectedWineIds.length !== new Set(selectedWineIds).size;
  const canSubmitReveal = selectedWineIds.length === 8 && !hasDuplicates;
  const isRevealed = wines.some(w => w.revealed);

  // Determine current active match that needs resolving
  // Q1 -> Q2 -> Q3 -> Q4 -> S1 -> S2 -> F
  const getActiveMatch = () => {
    if (!matchWinners['Q1']) return { id: 'Q1', wine1: 'A', wine2: 'B' };
    if (!matchWinners['Q2']) return { id: 'Q2', wine1: 'C', wine2: 'D' };
    if (!matchWinners['Q3']) return { id: 'Q3', wine1: 'E', wine2: 'F' };
    if (!matchWinners['Q4']) return { id: 'Q4', wine1: 'G', wine2: 'H' };
    if (!matchWinners['S1']) return { id: 'S1', wine1: matchWinners['Q1'], wine2: matchWinners['Q2'] };
    if (!matchWinners['S2']) return { id: 'S2', wine1: matchWinners['Q3'], wine2: matchWinners['Q4'] };
    if (!matchWinners['F']) return { id: 'F', wine1: matchWinners['S1'], wine2: matchWinners['S2'] };
    return null;
  };

  const activeMatch = getActiveMatch();

  // Find unique voters in this session
  const getUniqueVoters = () => {
    const voterNames = new Set<string>();
    votes.forEach(v => voterNames.add(v.voter_name));
    // Also include logged contributors as likely voters
    wines.forEach(w => voterNames.add(w.submitted_by));
    return Array.from(voterNames).filter(Boolean);
  };

  const allVoters = getUniqueVoters();

  // For the active match, see who has voted
  const activeMatchVotes = activeMatch 
    ? votes.filter(v => v.match_id === activeMatch.id) 
    : [];

  const activeVotersList = activeMatchVotes.map(v => v.voter_name.toLowerCase());

  // Calculate live average for active match
  const getActiveMatchStats = () => {
    if (activeMatchVotes.length === 0) return { wine1Pct: 50, wine2Pct: 50, totalVotes: 0 };
    
    // Average slider value (0-100)
    const sum = activeMatchVotes.reduce((acc, v) => acc + v.slider_value, 0);
    const avg = sum / activeMatchVotes.length;

    // Slider value is preference for wine 2 (0=wine1, 100=wine2)
    const wine2Pct = Math.round(avg);
    const wine1Pct = 100 - wine2Pct;

    return {
      wine1Pct,
      wine2Pct,
      totalVotes: activeMatchVotes.length
    };
  };

  const activeStats = getActiveMatchStats();

  // ----------------------------------------------------
  // ADVANCED ANALYTICS & MATH CALCULATIONS
  // ----------------------------------------------------

  // Calculate Appreciation Index (0-100) for each wine
  // For each vote containing wine's label, add score:
  // if wine is wine_1, score is (100 - slider_value)
  // if wine is wine_2, score is slider_value
  const getWineAppreciationIndex = (label: string): number => {
    const wineVotes = votes.filter(v => v.wine_1_label === label || v.wine_2_label === label);
    if (wineVotes.length === 0) return 50; // Neutral baseline

    let scoreSum = 0;
    wineVotes.forEach(v => {
      if (v.wine_1_label === label) {
        scoreSum += (100 - v.slider_value);
      } else {
        scoreSum += v.slider_value;
      }
    });

    return Math.round(scoreSum / wineVotes.length);
  };

  // Compile full table of wine stats
  const wineStats = isRevealed
    ? wines.map(w => {
        const label = w.blind_label || '';
        const score = getWineAppreciationIndex(label);
        
        // Count bracket wins
        let wins = 0;
        Object.values(matchWinners).forEach(winner => {
          if (winner === label) wins++;
        });

        return {
          ...w,
          score,
          wins,
          valueRatio: score / Math.max(1, w.price) // score per dollar
        };
      })
    : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(label => {
        const score = getWineAppreciationIndex(label);
        
        // Count bracket wins
        let wins = 0;
        Object.values(matchWinners).forEach(winner => {
          if (winner === label) wins++;
        });

        return {
          id: `label-${label}`,
          session_id: session.id,
          submitted_by: 'Anonymous',
          name: `Wine ${label}`,
          producer: undefined,
          vintage: undefined,
          price: 0,
          tasting_notes: undefined,
          blind_label: label,
          revealed: false,
          score,
          wins,
          valueRatio: 0
        };
      });

  // Sort stats by wins (primary) and appreciation index (secondary)
  const leaderboard = [...wineStats].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.score - a.score;
  });

  // Calculate Awards
  const getAwards = () => {
    if (wines.length === 0) return null;

    // 1. Best in Show (Final bracket winner)
    const bisLabel = matchWinners['F'];
    const bestInShow = wineStats.find(w => w.blind_label === bisLabel);

    // 2. People's Choice (Highest average rating)
    const peoplesChoice = [...wineStats].sort((a, b) => b.score - a.score)[0];

    // 3. Best Value (Highest rating-to-price ratio, must have won at least 1 match)
    const bestValueWines = wineStats.filter(w => w.wins > 0);
    const bestValue = bestValueWines.length > 0
      ? [...bestValueWines].sort((a, b) => b.valueRatio - a.valueRatio)[0]
      : [...wineStats].sort((a, b) => b.valueRatio - a.valueRatio)[0];

    // 4. Overpriced (Lowest rating-to-price ratio, filter to expensive ones > $20)
    const expensiveWines = wineStats.filter(w => w.price >= 20);
    const overpriced = expensiveWines.length > 0 
      ? [...expensiveWines].sort((a, b) => a.valueRatio - b.valueRatio)[0]
      : [...wineStats].sort((a, b) => a.valueRatio - b.valueRatio)[0];

    // 5. Giant Killer: Cheapest wine that won a match against an expensive wine
    // Scan all completed matches
    let giantKillerMatch: any = null;

    const matchesList = [
      { id: 'Q1', w1: 'A', w2: 'B' },
      { id: 'Q2', w1: 'C', w2: 'D' },
      { id: 'Q3', w1: 'E', w2: 'F' },
      { id: 'Q4', w1: 'G', w2: 'H' },
      { id: 'S1', w1: matchWinners['Q1'], w2: matchWinners['Q2'] },
      { id: 'S2', w1: matchWinners['Q3'], w2: matchWinners['Q4'] },
      { id: 'F', w1: matchWinners['S1'], w2: matchWinners['S2'] }
    ];

    matchesList.forEach(m => {
      const winnerLabel = matchWinners[m.id];
      if (!winnerLabel || !m.w1 || !m.w2) return;

      const loserLabel = winnerLabel === m.w1 ? m.w2 : m.w1;
      const winner = wineStats.find(w => w.blind_label === winnerLabel);
      const loser = wineStats.find(w => w.blind_label === loserLabel);

      if (winner && loser && winner.price < loser.price) {
        const margin = loser.price - winner.price;
        if (!giantKillerMatch || margin > giantKillerMatch.margin) {
          giantKillerMatch = { matchId: m.id, winner, loser, margin };
        }
      }
    });

    return {
      bestInShow,
      peoplesChoice,
      bestValue,
      overpriced,
      giantKiller: giantKillerMatch
    };
  };

  const awards = getAwards();

  // Resolve active match using current voting average
  const handleAutoResolve = async () => {
    if (!activeMatch) return;
    const winner = activeStats.wine1Pct >= activeStats.wine2Pct ? activeMatch.wine1 : activeMatch.wine2;
    await onResolveMatch(activeMatch.id, winner);
  };

  const handleResolveWinner = async (label: string) => {
    if (!activeMatch) return;
    await onResolveMatch(activeMatch.id, label);
  };

  const handleConfirmReveal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitReveal) return;
    await onRevealWines(mapping);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Session Title Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-wine-900 text-wine-300 font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              {session.status === 'setup' ? 'Setup Mode' : session.status === 'tasting' ? 'Tasting In Progress' : 'Completed'}
            </span>
            <span className="text-slate-500 font-mono text-xs">{session.date}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-slate-100">{session.name}</h2>
        </div>

        {/* Global actions */}
        <div className="flex gap-3">

          {isHost && (
            <button
              onClick={onResetSession}
              className="py-2 px-4 border border-slate-850 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset Session
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-850">
        <button
          onClick={() => setActiveTab('status')}
          className={`pb-3 px-6 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'status' 
              ? 'border-wine-500 text-wine-200' 
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" /> Live Tasting Status
        </button>
        {isRevealed && (
          <button
            onClick={() => setActiveTab('analysis')}
            className={`pb-3 px-6 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'analysis' 
                ? 'border-wine-500 text-wine-200' 
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Value Analysis & Awards
          </button>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* VIEW 1: LIVE STATUS / TASTING WORKFLOW */}
      // ----------------------------------------------------
      {activeTab === 'status' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1 & 2: Active Match Control (Host & Voter views) */}
          <div className="lg:col-span-2 space-y-6">
            {activeMatch ? (
              <div className="glass-panel rounded-2xl p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                  <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-wine-400" />
                    Active Matchup: {activeMatch.id}
                  </h3>
                  <span className="text-xs bg-slate-950 text-slate-400 font-mono px-3 py-1 rounded-full border border-slate-850">
                    Total Votes Cast: {activeStats.totalVotes}
                  </span>
                </div>

                {/* Live average visualization */}
                <div className="space-y-4">
                  <div className="flex justify-between text-2xl font-black font-serif px-2">
                    <span className="text-wine-400">Wine {activeMatch.wine1} ({activeStats.wine1Pct}%)</span>
                    <span className="text-wine-400">({activeStats.wine2Pct}%) Wine {activeMatch.wine2}</span>
                  </div>

                  <div className="h-6 bg-slate-950 rounded-full overflow-hidden border border-slate-850 flex shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-wine-900 to-wine-600 transition-all duration-500" 
                      style={{ width: `${activeStats.wine1Pct}%` }}
                    />
                    <div 
                      className="bg-gradient-to-r from-slate-800 to-slate-900 transition-all duration-500" 
                      style={{ width: `${activeStats.wine2Pct}%` }}
                    />
                  </div>

                  <p className="text-center text-xs text-slate-500 italic">
                    The bar shifts left for Wine {activeMatch.wine1} and right for Wine {activeMatch.wine2} based on live votes.
                  </p>
                </div>

                {/* Host resolve actions */}
                {isHost && (
                  <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-5 space-y-4">
                    <p className="text-sm font-semibold text-slate-350 flex items-center gap-1.5">
                      Host Resolution Panel
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        onClick={() => handleResolveWinner(activeMatch.wine1)}
                        className="py-2.5 px-4 bg-slate-900 border border-slate-800 hover:border-wine-800 hover:text-wine-200 text-slate-300 text-xs font-semibold rounded-lg transition-all"
                      >
                        Force Win Wine {activeMatch.wine1}
                      </button>
                      <button
                        onClick={handleAutoResolve}
                        disabled={activeStats.totalVotes === 0}
                        className="py-2.5 px-4 bg-wine-800 hover:bg-wine-700 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-950 text-white text-xs font-semibold rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        Resolve by Votes ({activeStats.wine1Pct >= activeStats.wine2Pct ? activeMatch.wine1 : activeMatch.wine2} wins)
                      </button>
                      <button
                        onClick={() => handleResolveWinner(activeMatch.wine2)}
                        className="py-2.5 px-4 bg-slate-900 border border-slate-800 hover:border-wine-800 hover:text-wine-200 text-slate-300 text-xs font-semibold rounded-lg transition-all"
                      >
                        Force Win Wine {activeMatch.wine2}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : !isRevealed ? (
              isHost ? (
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold font-serif text-slate-100 flex items-center gap-2">
                        <Eye className="w-5.5 h-5.5 text-wine-400" />
                        Reveal & Map Bottles
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Unbag each bottle A-H and select its true identity from the registered wines.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleConfirmReveal} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((label) => (
                        <div key={label} className="flex items-center gap-3 bg-slate-950/60 p-3 border border-slate-850 rounded-xl">
                          <span className="w-8 h-8 rounded-full bg-wine-800 text-white font-black font-serif flex items-center justify-center">
                            {label}
                          </span>
                          <div className="flex-1">
                            <select
                              value={mapping[label] || ''}
                              onChange={(e) => setMapping(prev => ({ ...prev, [label]: e.target.value }))}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-wine-500"
                            >
                              <option value="">-- Mapped Wine --</option>
                              {wines.map(w => {
                                const isSelectedElsewhere = Object.entries(mapping).some(([lbl, id]) => lbl !== label && id === w.id);
                                return (
                                  <option key={w.id} value={w.id} disabled={isSelectedElsewhere}>
                                    {w.name} (${w.price.toFixed(0)}) - {w.submitted_by} {isSelectedElsewhere ? '(already mapped)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>

                    {hasDuplicates && (
                      <p className="text-rose-400 text-xs border border-rose-950/30 bg-rose-950/15 px-3 py-2 rounded-lg">
                        Error: You have assigned the same wine to multiple bags. Please ensure each wine is assigned uniquely.
                      </p>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!canSubmitReveal}
                        className="py-2.5 px-8 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-500 text-slate-950 font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-950/20"
                      >
                        <Eye className="w-4 h-4" /> Save Reveal & Map Results
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="glass-panel rounded-2xl p-8 text-center space-y-4">
                  <Trophy className="w-16 h-16 text-gold-400 mx-auto drop-shadow-[0_0_15px_rgba(212,175,55,0.3)] animate-pulse" />
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold font-serif text-slate-200">Bracket Completed!</h3>
                    <p className="text-sm text-slate-400 max-w-sm mx-auto">
                      All matches have been evaluated. Waiting for the Host to unbag and reveal the wines... Standby for the final stats and value breakdown!
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="glass-panel rounded-2xl p-8 text-center space-y-4">
                <Trophy className="w-16 h-16 text-gold-400 mx-auto drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]" />
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold font-serif text-slate-200">Tasting Completed & Revealed</h3>
                  <p className="text-sm text-slate-400 max-w-sm mx-auto">
                    The results have been computed. Check the "Value Analysis & Awards" tab to see winners, awards, and price comparisons!
                  </p>
                </div>
              </div>
            )}

            {/* Sub-results Leaderboard */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-850 pb-3">
                <Trophy className="w-5 h-5 text-gold-400" />
                Current Standings
              </h3>
              
              <div className="divide-y divide-slate-850/60 max-h-[300px] overflow-y-auto pr-2">
                {leaderboard.map((wine, idx) => (
                  <div key={wine.id} className="py-2.5 flex justify-between items-center text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-500 font-bold w-4">#{idx+1}</span>
                      <span className="w-6 h-6 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] font-black text-slate-300">
                        {wine.blind_label}
                      </span>
                      <span className="font-medium text-slate-300">
                        {isRevealed ? wine.name : `Wine ${wine.blind_label}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-6 text-xs text-slate-400">
                      <span>Wins: <strong className="text-slate-200">{wine.wins}</strong></span>
                      <span>Appreciation: <strong className="text-slate-200">{wine.score}/100</strong></span>
                      {isRevealed && <span className="text-amber-400 font-semibold">${wine.price.toFixed(0)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3: Voter Check-in Card */}
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-850 pb-3">
                <Users className="w-5 h-5 text-blue-400" />
                Voters Room
              </h3>
              
              <div className="space-y-3">
                {allVoters.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No active tasters registered yet.</p>
                ) : (
                  allVoters.map((name) => {
                    const hasVotedActive = activeMatch ? activeVotersList.includes(name.toLowerCase()) : false;
                    return (
                      <div key={name} className="flex justify-between items-center text-xs bg-slate-950/40 px-3 py-2 rounded-lg border border-slate-850/40">
                        <span className="font-semibold text-slate-350">{name}</span>
                        {activeMatch ? (
                          hasVotedActive ? (
                            <span className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-900/30 font-bold">Voted</span>
                          ) : (
                            <span className="text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">Tasting...</span>
                          )
                        ) : (
                          <span className="text-slate-500">Ready</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* VIEW 2: VALUE ANALYSIS & AWARDS */}
      // ----------------------------------------------------
      {activeTab === 'analysis' && isRevealed && awards && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Medal Awards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Award 1: Best in Show */}
            {awards.bestInShow && (
              <div className="glass-panel border-gold-600/30 bg-gradient-to-b from-gold-950/10 to-slate-950/40 rounded-2xl p-5 text-center relative overflow-hidden flex flex-col justify-between min-h-[180px]">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gold-400/5 rounded-bl-full blur-sm" />
                <div className="space-y-2">
                  <Trophy className="w-8 h-8 text-gold-400 mx-auto" />
                  <p className="text-[10px] text-gold-300 font-extrabold uppercase tracking-widest">Bracket Winner</p>
                  <h4 className="text-base font-bold text-slate-100 font-serif leading-tight line-clamp-2">{awards.bestInShow.name}</h4>
                </div>
                <div className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-850 flex justify-between items-center">
                  <span>By: <strong>{awards.bestInShow.submitted_by}</strong></span>
                  <span className="text-amber-400 font-semibold">${awards.bestInShow.price}</span>
                </div>
              </div>
            )}

            {/* Award 2: People's Choice */}
            {awards.peoplesChoice && (
              <div className="glass-panel border-wine-800/30 bg-gradient-to-b from-wine-950/10 to-slate-950/40 rounded-2xl p-5 text-center relative overflow-hidden flex flex-col justify-between min-h-[180px]">
                <div className="absolute top-0 right-0 w-16 h-16 bg-wine-500/5 rounded-bl-full blur-sm" />
                <div className="space-y-2">
                  <Award className="w-8 h-8 text-rose-400 mx-auto" />
                  <p className="text-[10px] text-rose-400 font-extrabold uppercase tracking-widest">Highest Rated ({awards.peoplesChoice.score}/100)</p>
                  <h4 className="text-base font-bold text-slate-100 font-serif leading-tight line-clamp-2">{awards.peoplesChoice.name}</h4>
                </div>
                <div className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-850 flex justify-between items-center">
                  <span>By: <strong>{awards.peoplesChoice.submitted_by}</strong></span>
                  <span className="text-amber-400 font-semibold">${awards.peoplesChoice.price}</span>
                </div>
              </div>
            )}

            {/* Award 3: Best Value */}
            {awards.bestValue && (
              <div className="glass-panel border-emerald-800/30 bg-gradient-to-b from-emerald-950/10 to-slate-950/40 rounded-2xl p-5 text-center relative overflow-hidden flex flex-col justify-between min-h-[180px]">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-full blur-sm" />
                <div className="space-y-2">
                  <DollarSign className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">Best Value (Score/Price)</p>
                  <h4 className="text-base font-bold text-slate-100 font-serif leading-tight line-clamp-2">{awards.bestValue.name}</h4>
                </div>
                <div className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-850 flex justify-between items-center">
                  <span>By: <strong>{awards.bestValue.submitted_by}</strong></span>
                  <span className="text-emerald-400 font-bold">${awards.bestValue.price}</span>
                </div>
              </div>
            )}

            {/* Award 4: Giant Killer */}
            <div className="glass-panel border-purple-800/30 bg-gradient-to-b from-purple-950/10 to-slate-950/40 rounded-2xl p-5 text-center relative overflow-hidden flex flex-col justify-between min-h-[180px]">
              <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-bl-full blur-sm" />
              <div className="space-y-2">
                <Shield className="w-8 h-8 text-purple-400 mx-auto" />
                <p className="text-[10px] text-purple-400 font-extrabold uppercase tracking-widest">Giant Killer (Cheapest Win)</p>
                {awards.giantKiller ? (
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-100 leading-tight line-clamp-2">
                      {awards.giantKiller.winner.name} (${awards.giantKiller.winner.price.toFixed(0)})
                    </h4>
                    <p className="text-[9px] text-purple-300 font-bold uppercase tracking-wider">Defeated</p>
                    <h4 className="text-xs text-slate-400 leading-tight line-clamp-1">
                      {awards.giantKiller.loser.name} (${awards.giantKiller.loser.price.toFixed(0)})
                    </h4>
                  </div>
                ) : (
                  <h4 className="text-sm font-medium text-slate-500 pt-3">No major giant killings. Price followed expectations!</h4>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-850 flex justify-between items-center">
                <span>Margin:</span>
                <span className="text-purple-400 font-bold">
                  {awards.giantKiller ? `$${awards.giantKiller.margin.toFixed(2)} diff` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Scatter Plot: Appreciation Index vs Price */}
          <div className="glass-panel rounded-2xl p-6 space-y-6">
            <div className="border-b border-slate-850 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-slate-200">Price vs. Value Chart</h3>
                <p className="text-xs text-slate-500">Analyze the correlation between a wine's cost and its average score. Optimal region: top left!</p>
              </div>
            </div>

            {/* SVG Responsive Chart */}
            <div className="w-full h-80 bg-slate-950/80 border border-slate-900 rounded-xl relative p-4 flex flex-col justify-between">
              {/* Grid axes and plot */}
              <div className="flex-1 w-full relative border-l border-b border-slate-800">
                
                {/* Horizontal guide lines (Score) */}
                {[25, 50, 75, 100].map(level => (
                  <div 
                    key={level}
                    className="absolute left-0 right-0 border-t border-slate-900/60 flex justify-end text-[9px] text-slate-600 font-mono pr-2"
                    style={{ bottom: `${level}%`, transform: 'translateY(-50%)' }}
                  >
                    Score: {level}
                  </div>
                ))}

                {/* Quad labels */}
                <div className="absolute top-2 left-2 text-[8px] font-bold text-emerald-500/40 uppercase tracking-widest">Smart Buy (High Quality, Low Price)</div>
                <div className="absolute top-2 right-2 text-[8px] font-bold text-gold-500/40 uppercase tracking-widest">Splurge Worthy (High Quality, High Price)</div>
                <div className="absolute bottom-2 left-2 text-[8px] font-bold text-slate-600/40 uppercase tracking-widest">Neutral (Low Quality, Low Price)</div>
                <div className="absolute bottom-2 right-2 text-[8px] font-bold text-rose-500/40 uppercase tracking-widest">Overpriced (Low Quality, High Price)</div>

                {/* Plot dots */}
                {wineStats.map(w => {
                  // Normalize price to 0-100 scale for plotting
                  // Let's assume min price is $10, max price is $100 for bounds
                  const maxPriceVal = Math.max(...wineStats.map(x => x.price), 100);
                  const minPriceVal = Math.min(...wineStats.map(x => x.price), 5);
                  const priceDiff = maxPriceVal - minPriceVal;
                  
                  const xPct = priceDiff > 0 ? ((w.price - minPriceVal) / priceDiff) * 90 + 5 : 50;
                  const yPct = w.score; // Score is already 0-100

                  return (
                    <div 
                      key={w.id}
                      className="absolute group z-10 cursor-pointer"
                      style={{ 
                        left: `${xPct}%`, 
                        bottom: `${yPct}%`,
                        transform: 'translate(-50%, 50%)'
                      }}
                    >
                      {/* Interactive plot point */}
                      <div className="w-4 h-4 rounded-full bg-wine-500 hover:bg-gold-400 border border-white/60 hover:scale-125 transition-transform flex items-center justify-center text-[9px] font-black text-white" />
                      
                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute bottom-6 left-1/2 -translate-x-1/2 w-48 bg-slate-900 border border-slate-800 rounded-lg p-2.5 shadow-2xl z-20 text-xs space-y-1">
                        <p className="font-bold text-slate-100 line-clamp-1">{w.name}</p>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Rating: <strong>{w.score}/100</strong></span>
                          <span>Price: <strong className="text-amber-400">${w.price.toFixed(2)}</strong></span>
                        </div>
                        <p className="text-[9px] text-slate-500">Brought by: {w.submitted_by}</p>
                      </div>

                      {/* Label below dot */}
                      <span className="absolute top-4 left-1/2 -translate-x-1/2 font-bold text-[10px] text-slate-400 font-serif">
                        {w.blind_label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Axis labels */}
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-2 px-1">
                <span>Cheapest (${Math.min(...wineStats.map(x => x.price)).toFixed(0)})</span>
                <span className="font-sans font-bold uppercase tracking-wider">Price Axis</span>
                <span>Most Expensive (${Math.max(...wineStats.map(x => x.price)).toFixed(0)})</span>
              </div>
            </div>
          </div>

          {/* Full stats breakdown table */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Wine Specifications Breakdown</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                    <th className="py-3 px-2">Label</th>
                    <th className="py-3 px-4">Wine</th>
                    <th className="py-3 px-4">Contributor</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4 text-center">Wins</th>
                    <th className="py-3 px-4 text-center">Appreciation Score</th>
                    <th className="py-3 px-4">Tasting Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40 text-slate-300">
                  {leaderboard.map(w => (
                    <tr key={w.id} className="hover:bg-slate-900/20">
                      <td className="py-3 px-2 font-black font-serif text-wine-400">
                        <span className="w-6 h-6 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center">{w.blind_label}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{w.name}</div>
                        <div className="text-[10px] text-slate-500">{w.producer} {w.vintage && `(${w.vintage})`}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-400">{w.submitted_by}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-500">${w.price.toFixed(2)}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-200">{w.wins}</td>
                      <td className="py-3 px-4 text-center font-bold text-wine-300">{w.score}/100</td>
                      <td className="py-3 px-4 text-slate-450 line-clamp-1 max-w-xs">{w.tasting_notes || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
