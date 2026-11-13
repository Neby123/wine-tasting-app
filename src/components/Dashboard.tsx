import React, { useState, useEffect } from 'react';
import { Wine, Vote, WineSession } from '../utils/mockData';
import { Trophy, DollarSign, Award, Eye, Shield, Users, RefreshCw, BarChart2 } from 'lucide-react';

interface DashboardProps {
  session: WineSession;
  wines: Wine[];
  votes: Vote[];
  isHost: boolean;
  matchWinners: Record<string, string>;
  onRevealWines: (mapping: Record<string, string>) => Promise<void>;
  onResetSession: () => Promise<void>;
}

export default function Dashboard({
  session,
  wines,
  votes,
  isHost,
  matchWinners,
  onRevealWines,
  onResetSession
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'analysis'>('status');
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const bagLabels = wines.length > 0
    ? wines.map((w, idx) => w.blind_label || String.fromCharCode(65 + idx))
    : ['A', 'B', 'C', 'D', 'E', 'F'];

  useEffect(() => {
    if (wines.length > 0) {
      setMapping(prev => {
        const next: Record<string, string> = {};
        bagLabels.forEach(label => {
          next[label] = prev[label] || '';
        });
        return next;
      });
    }
  }, [wines.length]);

  const selectedWineIds = Object.values(mapping).filter(Boolean);
  const hasDuplicates = selectedWineIds.length !== new Set(selectedWineIds).size;
  const targetCount = wines.length > 0 ? wines.length : bagLabels.length;
  const canSubmitReveal = selectedWineIds.length === targetCount && !hasDuplicates;
  const isRevealed = wines.some(w => w.revealed);

  useEffect(() => {
    if (isRevealed) {
      setActiveTab('analysis');
    }
  }, [isRevealed]);

  // Find unique individual voters in this session
  const getUniqueVoters = () => {
    const voterNames = new Set<string>();

    // Always split couple names from wine submitted_by fields
    wines.forEach(w => {
      if (w.submitted_by) {
        const parts = w.submitted_by.split(/\s*&\s*|\s*\/\s*|\s+\band\b\s+/i);
        parts.forEach(p => {
          const clean = p.trim();
          if (clean) voterNames.add(clean);
        });
      }
    });

    // Also add all actual individual voters who have submitted votes
    votes.forEach(v => {
      if (v.voter_name) voterNames.add(v.voter_name);
    });

    // Default to individual participants list if still empty
    if (voterNames.size === 0) {
      ['Ben', 'Monica', 'Jack', 'Alexcia', 'David', 'Abby'].forEach(p => voterNames.add(p));
    }

    return Array.from(voterNames).filter(Boolean);
  };

  const allVoters = getUniqueVoters();

  // ----------------------------------------------------
  // ADVANCED ANALYTICS & MATH CALCULATIONS
  // ----------------------------------------------------

  // Calculate Appreciation Index (0-100) for each wine
  // For each vote containing wine's label, add score:
  // if wine is wine_1, score is (100 - slider_value)
  // if wine is wine_2, score is slider_value
  const getWineAppreciationIndex = (label: string) => {
    const wineVotes = votes.filter(
      v => v.wine_1_label === label || v.wine_2_label === label
    );

    if (wineVotes.length === 0) return 50; // Neutral baseline

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

  // Compile full table of wine stats
  const wineStats = isRevealed
    ? wines.map(w => {
        const label = w.blind_label || '';
        const score = getWineAppreciationIndex(label);
        
        // Count head-to-head battle victories across all votes cast by tasters
        let wins = 0;
        votes.forEach(v => {
          if (v.match_id?.startsWith('STANDALONE_') || v.wine_1_label === v.wine_2_label) return;
          if (v.wine_1_label === label && v.slider_value < 50) wins++;
          if (v.wine_2_label === label && v.slider_value > 50) wins++;
        });
        if (wins === 0) {
          Object.values(matchWinners).forEach(winner => {
            if (winner === label) wins++;
          });
        }

        const ratingsCount = votes.filter(
          v => v.wine_1_label === label || v.wine_2_label === label
        ).length;

        return {
          ...w,
          score,
          wins,
          ratingsCount,
          valueRatio: score / Math.max(1, w.price || 1) // score per dollar
        };
      })
    : (wines.length > 0 ? wines.map((w, idx) => w.blind_label || String.fromCharCode(65 + idx)) : ['A', 'B', 'C', 'D', 'E', 'F']).map(label => {
        const score = getWineAppreciationIndex(label);
        
        let wins = 0;
        votes.forEach(v => {
          if (v.match_id?.startsWith('STANDALONE_') || v.wine_1_label === v.wine_2_label) return;
          if (v.wine_1_label === label && v.slider_value < 50) wins++;
          if (v.wine_2_label === label && v.slider_value > 50) wins++;
        });
        if (wins === 0) {
          Object.values(matchWinners).forEach(winner => {
            if (winner === label) wins++;
          });
        }
        const ratingsCount = votes.filter(
          v => v.wine_1_label === label || v.wine_2_label === label
        ).length;

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
          ratingsCount,
          valueRatio: 0
        };
      });

  const hasStandaloneVotes = votes.some(v => v.match_id?.startsWith('STANDALONE_') || v.wine_1_label === v.wine_2_label);
  const hasHeadToHeadVotes = votes.some(v => v.match_id && !v.match_id.startsWith('STANDALONE_') && v.wine_1_label !== v.wine_2_label);
  const isStandaloneSession = hasStandaloneVotes && !hasHeadToHeadVotes;

  // Sort stats by average appreciation score (primary) and head-to-head wins (secondary)
  const leaderboard = [...wineStats].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.wins - a.wins;
  });

  // Calculate Awards
  const getAwards = () => {
    if (wines.length === 0) return null;

    // 1. Best in Show (Grand Champion: Highest scoring wine)
    const bestInShow = leaderboard[0];

    // 2. People's Choice (Highest average rating)
    const peoplesChoice = [...wineStats].sort((a, b) => b.score - a.score)[0];

    // 3. Best Value (Highest rating-to-price ratio, preferring winners or >= 50 score in standalone mode)
    const bestValuePool = wineStats.filter(w => w.wins > 0);
    const qualifiedPool = bestValuePool.length > 0
      ? bestValuePool
      : wineStats.filter(w => w.score >= 50);
    const finalValuePool = qualifiedPool.length > 0 ? qualifiedPool : wineStats;
    const bestValue = [...finalValuePool].sort((a, b) => b.valueRatio - a.valueRatio)[0];

    // 4. Overpriced (Lowest rating-to-price ratio, filter to expensive ones > $20)
    const expensiveWines = wineStats.filter(w => w.price >= 20);
    const overpriced = expensiveWines.length > 0 
      ? [...expensiveWines].sort((a, b) => a.valueRatio - b.valueRatio)[0]
      : [...wineStats].sort((a, b) => a.valueRatio - b.valueRatio)[0];

    // 5. Giant Killer: Cheapest wine that outperformed a significantly more expensive wine
    let giantKillerMatch: any = null;

    votes.forEach(v => {
      if (v.match_id?.startsWith('STANDALONE_') || v.wine_1_label === v.wine_2_label) return;
      const w1 = wineStats.find(w => w.blind_label === v.wine_1_label);
      const w2 = wineStats.find(w => w.blind_label === v.wine_2_label);
      if (!w1 || !w2) return;

      const winner = v.slider_value < 50 ? w1 : v.slider_value > 50 ? w2 : null;
      const loser = winner === w1 ? w2 : w1;

      if (winner && loser && (winner.price ?? 0) < (loser.price ?? 0)) {
        const margin = (loser.price ?? 0) - (winner.price ?? 0);
        if (!giantKillerMatch || margin > giantKillerMatch.margin) {
          giantKillerMatch = { matchId: v.match_id, winner, loser, margin };
        }
      }
    });

    if (!giantKillerMatch && wineStats.length >= 2) {
      const sortedByPrice = [...wineStats].filter(w => typeof w.price === 'number' && w.price > 0).sort((a, b) => (a.price || 0) - (b.price || 0));
      if (sortedByPrice.length >= 2) {
        const cheapest = sortedByPrice[0];
        const pricierOutperformed = sortedByPrice.slice(1).find(w => w.price > cheapest.price && cheapest.score > w.score);
        if (pricierOutperformed) {
          giantKillerMatch = {
            matchId: 'Decoupled Rating',
            winner: cheapest,
            loser: pricierOutperformed,
            margin: pricierOutperformed.price - cheapest.price
          };
        }
      }
    }

    return {
      bestInShow,
      peoplesChoice,
      bestValue,
      overpriced,
      giantKiller: giantKillerMatch
    };
  };

  const awards = getAwards();

  const handleConfirmReveal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitReveal) return;
    await onRevealWines(mapping);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Session Title Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-wine-950 text-[#6E172C] border border-wine-800/80 font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              {session.status === 'setup' ? 'Setup Mode' : session.status === 'tasting' ? 'Tasting In Progress' : 'Completed'}
            </span>
            <span className="text-slate-500 font-mono text-xs">{(session.date || '').split('T')[0]}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-slate-100">{session.name}</h2>
        </div>

        {/* Global actions */}
        <div className="flex gap-3">
          {isHost && (
            <button
              onClick={onResetSession}
              className="py-2 px-4 border border-slate-800 bg-white hover:bg-slate-850 text-slate-400 hover:text-slate-100 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset Session
            </button>
          )}
        </div>
      </div>

      {/* Grand Champion Banner */}
      {isRevealed && awards && awards.bestInShow && (
        <div className="glass-panel border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-gold-950/70 to-rose-50/50 rounded-2xl p-6 text-center space-y-3 shadow-lg shadow-amber-900/5 animate-scale-in">
          <div className="inline-flex items-center gap-2 bg-amber-100/90 border border-amber-300 px-3.5 py-1 rounded-full text-amber-900 text-xs font-extrabold uppercase tracking-widest">
            <Trophy className="w-4 h-4 text-amber-700 animate-bounce" /> {session.name} Champion (Best in Show)
          </div>
          <h3 className="text-3xl sm:text-4xl font-bold font-serif text-slate-100">
            {awards.bestInShow.name}
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-4 text-sm text-slate-400">
            <span>Brought by: <strong className="text-amber-900 font-bold">{awards.bestInShow.submitted_by}</strong></span>
            <span>•</span>
            <span>Price: <strong className="text-emerald-800 font-bold">${awards.bestInShow.price}</strong></span>
            <span>•</span>
            <span>Appreciation Score: <strong className="text-[#6E172C] font-bold">{awards.bestInShow.score} / 100</strong></span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('status')}
          className={`pb-3 px-6 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'status' 
              ? 'border-[#6E172C] text-[#6E172C]' 
              : 'border-transparent text-slate-500 hover:text-slate-100'
          }`}
        >
          <Users className="w-4 h-4" /> Live Tasting Status
        </button>
        {isRevealed && (
          <button
            onClick={() => setActiveTab('analysis')}
            className={`pb-3 px-6 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'analysis' 
                ? 'border-[#6E172C] text-[#6E172C]' 
                : 'border-transparent text-slate-500 hover:text-slate-100'
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Value Analysis & Awards
          </button>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* VIEW 1: LIVE STATUS / TASTING WORKFLOW */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'status' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1 & 2: Host Unbag & Reveal Tool or Completed View */}
          <div className="lg:col-span-2 space-y-6">
            {!isRevealed ? (
              isHost ? (
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold font-serif text-slate-100 flex items-center gap-2">
                        <Eye className="w-5.5 h-5.5 text-[#6E172C]" />
                        Unbag & Reveal Bottles
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        When tasting is complete, unbag each physical bottle ({bagLabels[0]}-{bagLabels[bagLabels.length - 1]}) and map its blind letter to its true wine identity below.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleConfirmReveal} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {bagLabels.map((label) => (
                        <div key={label} className="flex items-center gap-3 bg-slate-850/60 p-3 border border-slate-800 rounded-xl">
                          <span className="w-8 h-8 rounded-full bg-[#6E172C] text-white font-black font-serif flex items-center justify-center text-sm shadow-xs">
                            {label}
                          </span>
                          <div className="flex-1">
                            <select
                              value={mapping[label] || ''}
                              onChange={(e) => setMapping(prev => ({ ...prev, [label]: e.target.value }))}
                              className="w-full bg-white border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-[#6E172C] shadow-xs"
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
                      <p className="text-rose-800 text-xs border border-rose-200 bg-rose-50 px-3 py-2 rounded-lg font-medium">
                        Error: You have assigned the same wine to multiple bags. Please ensure each wine is assigned uniquely.
                      </p>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!canSubmitReveal}
                        className="py-3 px-8 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-[#1E1814] font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/10"
                      >
                        <Eye className="w-4 h-4" /> Save Reveal & Map Results
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="glass-panel rounded-2xl p-8 text-center space-y-4">
                  <Trophy className="w-16 h-16 text-amber-600 mx-auto drop-shadow-sm animate-pulse" />
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold font-serif text-slate-100">Tasting In Progress!</h3>
                    <p className="text-sm text-slate-400 max-w-sm mx-auto">
                      Fill in your 0–100 ratings on the Tasting Sheet tab. When everyone finishes, the Host will unbag and reveal the wines!
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="glass-panel rounded-2xl p-8 text-center space-y-4">
                <Trophy className="w-16 h-16 text-amber-600 mx-auto drop-shadow-sm" />
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold font-serif text-slate-100">Tasting Completed & Revealed</h3>
                  <p className="text-sm text-slate-400 max-w-sm mx-auto">
                    All bottles have been unbagged and mapped. Check the <strong>Value Analysis & Awards</strong> tab above for trophies and price breakdowns!
                  </p>
                </div>
              </div>
            )}

            {/* Sub-results Leaderboard */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 border-b border-slate-850 pb-3">
                <Trophy className="w-5 h-5 text-amber-600" />
                Current Standings
              </h3>
              
              <div className="divide-y divide-slate-800 max-h-[300px] overflow-y-auto pr-2">
                {leaderboard.map((wine, idx) => (
                  <div key={wine.id} className="py-2.5 flex justify-between items-center text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-500 font-bold w-4">#{idx+1}</span>
                      <span className="w-6 h-6 rounded-full bg-slate-850 border border-slate-800 flex items-center justify-center text-[10px] font-black text-slate-100">
                        {wine.blind_label}
                      </span>
                      <span className="font-medium text-slate-100">
                        {isRevealed ? wine.name : `Wine ${wine.blind_label}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-6 text-xs text-slate-400">
                      <span>
                        {isStandaloneSession ? 'Ratings' : 'Wins'}: <strong className="text-slate-100">{isStandaloneSession ? wine.ratingsCount : wine.wins}</strong>
                      </span>
                      <span>Appreciation: <strong className="text-slate-100">{wine.score}/100</strong></span>
                      {isRevealed && <span className="text-amber-800 font-semibold font-mono">${wine.price.toFixed(0)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3: Voter Check-in Card */}
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2 border-b border-slate-850 pb-3">
                <Users className="w-5 h-5 text-[#6E172C]" />
                Voters Room
              </h3>
              
              <div className="space-y-3">
                {allVoters.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No active tasters registered yet.</p>
                ) : (
                  allVoters.map((name) => {
                    const votesCount = votes.filter(v => (v.voter_name || '').toLowerCase() === name.toLowerCase()).length;
                    const expectedVotes = wines.length > 0 ? wines.length : 6;
                    const isComplete = votesCount >= expectedVotes;
                    return (
                      <div key={name} className="flex justify-between items-center text-xs bg-slate-850/50 px-3 py-2 rounded-lg border border-slate-800">
                        <span className="font-semibold text-slate-100">{name}</span>
                        {isComplete ? (
                          <span className="text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold flex items-center gap-1">
                            ✓ Complete ({votesCount}/{expectedVotes})
                          </span>
                        ) : votesCount > 0 ? (
                          <span className="text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-bold">
                            In Progress ({votesCount}/{expectedVotes})
                          </span>
                        ) : (
                          <span className="text-slate-500 bg-white border border-slate-800 px-2.5 py-0.5 rounded-full">
                            Not Started (0/{expectedVotes})
                          </span>
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
      {/* ---------------------------------------------------- */}
      {activeTab === 'analysis' && isRevealed && awards && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Medal Awards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Award 1: Best in Show */}
            {awards.bestInShow && (
              <div className="glass-panel border-2 border-amber-300 bg-gradient-to-b from-amber-50 via-gold-950/60 to-white rounded-2xl p-5 text-center relative overflow-hidden flex flex-col justify-between min-h-[180px] shadow-sm">
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-400/10 rounded-bl-full blur-sm" />
                <div className="space-y-2">
                  <Trophy className="w-8 h-8 text-amber-700 mx-auto" />
                  <p className="text-[10px] text-amber-900 font-extrabold uppercase tracking-widest">Grand Champion (Best in Show)</p>
                  <h4 className="text-base font-bold text-slate-100 font-serif leading-tight line-clamp-2">{awards.bestInShow.name}</h4>
                </div>
                <div className="text-xs text-slate-500 mt-3 pt-2 border-t border-amber-200 flex justify-between items-center">
                  <span>By: <strong className="text-slate-100">{awards.bestInShow.submitted_by}</strong></span>
                  <span className="text-amber-900 font-bold font-mono">${awards.bestInShow.price}</span>
                </div>
              </div>
            )}

            {/* Award 2: People's Choice */}
            {awards.peoplesChoice && (
              <div className="glass-panel border-2 border-rose-200 bg-gradient-to-b from-rose-50 via-wine-950/60 to-white rounded-2xl p-5 text-center relative overflow-hidden flex flex-col justify-between min-h-[180px] shadow-sm">
                <div className="absolute top-0 right-0 w-16 h-16 bg-rose-400/10 rounded-bl-full blur-sm" />
                <div className="space-y-2">
                  <Award className="w-8 h-8 text-rose-700 mx-auto" />
                  <p className="text-[10px] text-rose-800 font-extrabold uppercase tracking-widest">Highest Rated ({awards.peoplesChoice.score}/100)</p>
                  <h4 className="text-base font-bold text-slate-100 font-serif leading-tight line-clamp-2">{awards.peoplesChoice.name}</h4>
                </div>
                <div className="text-xs text-slate-500 mt-3 pt-2 border-t border-rose-200 flex justify-between items-center">
                  <span>By: <strong className="text-slate-100">{awards.peoplesChoice.submitted_by}</strong></span>
                  <span className="text-amber-900 font-bold font-mono">${awards.peoplesChoice.price}</span>
                </div>
              </div>
            )}

            {/* Award 3: Best Value */}
            {awards.bestValue && (
              <div className="glass-panel border-2 border-emerald-200 bg-gradient-to-b from-emerald-50 via-emerald-50/40 to-white rounded-2xl p-5 text-center relative overflow-hidden flex flex-col justify-between min-h-[180px] shadow-sm">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-400/10 rounded-bl-full blur-sm" />
                <div className="space-y-2">
                  <DollarSign className="w-8 h-8 text-emerald-700 mx-auto" />
                  <p className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-widest">Best Value (Score/Price)</p>
                  <h4 className="text-base font-bold text-slate-100 font-serif leading-tight line-clamp-2">{awards.bestValue.name}</h4>
                </div>
                <div className="text-xs text-slate-500 mt-3 pt-2 border-t border-emerald-200 flex justify-between items-center">
                  <span>By: <strong className="text-slate-100">{awards.bestValue.submitted_by}</strong></span>
                  <span className="text-emerald-800 font-bold font-mono">${awards.bestValue.price}</span>
                </div>
              </div>
            )}

            {/* Award 4: Giant Killer */}
            <div className="glass-panel border-2 border-purple-200 bg-gradient-to-b from-purple-50 via-purple-50/40 to-white rounded-2xl p-5 text-center relative overflow-hidden flex flex-col justify-between min-h-[180px] shadow-sm">
              <div className="absolute top-0 right-0 w-16 h-16 bg-purple-400/10 rounded-bl-full blur-sm" />
              <div className="space-y-2">
                <Shield className="w-8 h-8 text-purple-700 mx-auto" />
                <p className="text-[10px] text-purple-900 font-extrabold uppercase tracking-widest">Giant Killer (Cheapest Win)</p>
                {awards.giantKiller ? (
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-100 leading-tight line-clamp-2">
                      {awards.giantKiller.winner.name} (${awards.giantKiller.winner.price.toFixed(0)})
                    </h4>
                    <p className="text-[9px] text-purple-800 font-bold uppercase tracking-wider">Defeated</p>
                    <h4 className="text-xs text-slate-500 leading-tight line-clamp-1">
                      {awards.giantKiller.loser.name} (${awards.giantKiller.loser.price.toFixed(0)})
                    </h4>
                  </div>
                ) : (
                  <h4 className="text-sm font-medium text-slate-500 pt-3">No major giant killings. Price followed expectations!</h4>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-3 pt-2 border-t border-purple-200 flex justify-between items-center">
                <span>Margin:</span>
                <span className="text-purple-800 font-bold font-mono">
                  {awards.giantKiller ? `$${awards.giantKiller.margin.toFixed(2)} diff` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Scatter Plot: Appreciation Index vs Price */}
          <div className="glass-panel rounded-2xl p-6 space-y-6">
            <div className="border-b border-slate-850 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Price vs. Value Chart</h3>
                <p className="text-xs text-slate-500">Analyze the correlation between a wine's cost and its average score. Optimal region: top left!</p>
              </div>
            </div>

            {/* SVG Responsive Chart */}
            <div className="w-full h-80 bg-white border border-slate-800 rounded-xl relative p-4 flex flex-col justify-between shadow-inner">
              {/* Grid axes and plot */}
              <div className="flex-1 w-full relative border-l border-b border-slate-800">
                
                {/* Horizontal guide lines (Score) */}
                {[25, 50, 75, 100].map(level => (
                  <div 
                    key={level}
                    className="absolute left-0 right-0 border-t border-slate-800/80 flex justify-end text-[9px] text-slate-400 font-mono pr-2"
                    style={{ bottom: `${level}%`, transform: 'translateY(-50%)' }}
                  >
                    Score: {level}
                  </div>
                ))}

                {/* Quad labels */}
                <div className="absolute top-2 left-2 text-[8px] font-bold text-emerald-800/60 uppercase tracking-widest">Smart Buy (High Quality, Low Price)</div>
                <div className="absolute top-2 right-2 text-[8px] font-bold text-amber-800/60 uppercase tracking-widest">Splurge Worthy (High Quality, High Price)</div>
                <div className="absolute bottom-2 left-2 text-[8px] font-bold text-slate-500/60 uppercase tracking-widest">Neutral (Low Quality, Low Price)</div>
                <div className="absolute bottom-2 right-2 text-[8px] font-bold text-rose-800/60 uppercase tracking-widest">Overpriced (Low Quality, High Price)</div>

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
                      <div className="w-4 h-4 rounded-full bg-[#821D35] hover:bg-amber-600 border border-white hover:scale-125 transition-transform flex items-center justify-center text-[9px] font-black text-white shadow-sm" />
                      
                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute bottom-6 left-1/2 -translate-x-1/2 w-48 bg-white border border-slate-800 rounded-lg p-2.5 shadow-xl z-20 text-xs space-y-1">
                        <p className="font-bold text-slate-100 line-clamp-1">{w.name}</p>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Rating: <strong className="text-slate-100">{w.score}/100</strong></span>
                          <span>Price: <strong className="text-amber-800 font-mono">${w.price.toFixed(2)}</strong></span>
                        </div>
                        <p className="text-[9px] text-slate-500">Brought by: {w.submitted_by}</p>
                      </div>

                      {/* Label below dot */}
                      <span className="absolute top-4 left-1/2 -translate-x-1/2 font-bold text-[10px] text-slate-500 font-serif">
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
            <h3 className="text-lg font-semibold text-slate-100">Wine Specifications Breakdown</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                    <th className="py-3 px-2">Label</th>
                    <th className="py-3 px-4">Wine</th>
                    <th className="py-3 px-4">Contributor</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4 text-center">{isStandaloneSession ? 'Ratings' : 'Wins'}</th>
                    <th className="py-3 px-4 text-center">Appreciation Score</th>
                    <th className="py-3 px-4">Tasting Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {leaderboard.map(w => (
                    <tr key={w.id} className="hover:bg-slate-850/50">
                      <td className="py-3 px-2 font-black font-serif text-wine-400">
                        <span className="w-6 h-6 rounded-full bg-[#6E172C] text-white flex items-center justify-center font-bold text-xs">{w.blind_label}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100">{w.name}</div>
                        <div className="text-[10px] text-slate-500">{w.producer} {w.vintage && `(${w.vintage})`}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-400">{w.submitted_by}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-800">${w.price.toFixed(2)}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-100">{isStandaloneSession ? w.ratingsCount : w.wins}</td>
                      <td className="py-3 px-4 text-center font-bold text-[#6E172C]">{w.score}/100</td>
                      <td className="py-3 px-4 text-slate-400 line-clamp-1 max-w-xs">{w.tasting_notes || "N/A"}</td>
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
