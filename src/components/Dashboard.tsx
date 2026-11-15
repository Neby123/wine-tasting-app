import React, { useState, useEffect, useId } from 'react';
import type { Wine, Vote, WineSession } from '../types/wine';
import { analyzeSessionLeaderboard, type WineStatRow } from '../utils/tastingAnalytics';
import { extractCalendarDate } from '../utils/date';
import { Trophy, DollarSign, Award, Eye, Shield, Users, RefreshCw, BarChart2, AlertTriangle, X } from 'lucide-react';

interface DashboardProps {
  session: WineSession;
  wines: Wine[];
  votes: Vote[];
  isHost: boolean;
  matchWinners: Record<string, string>;
  onRevealWines: (mapping: Record<string, string>) => Promise<void>;
  onResetSession: () => Promise<void>;
  hasLateArchiveDesync?: boolean;
  syncingArchive?: boolean;
  onSyncArchive?: () => Promise<void>;
}

export default function Dashboard({
  session,
  wines,
  votes,
  isHost,
  matchWinners,
  onRevealWines,
  onResetSession,
  hasLateArchiveDesync = false,
  syncingArchive = false,
  onSyncArchive
}: DashboardProps) {
  const idBase = useId();
  const [activeTab, setActiveTab] = useState<'status' | 'analysis'>('status');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [revealError, setRevealError] = useState('');
  const [selectedChartWine, setSelectedChartWine] = useState<WineStatRow | null>(null);

  const bagLabels = Array.from({ length: wines.length || 6 }, (_, idx) => String.fromCharCode(65 + idx));

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

  // Compute standings, awards, and chart stats via shared pure analytics engine
  const {
    isStandaloneSession,
    wineStats,
    leaderboard,
    awards
  } = analyzeSessionLeaderboard(session, wines, votes, matchWinners);

  const handleConfirmReveal = async (e: React.FormEvent) => {
    e.preventDefault();
    setRevealError('');
    if (hasDuplicates) {
      setRevealError('You assigned the same wine to multiple bags. Select each wine only once.');
      return;
    }
    if (selectedWineIds.length !== targetCount) {
      setRevealError(`Select a bottle for all ${targetCount} blind bags before revealing.`);
      return;
    }
    try {
      await onRevealWines(mapping);
    } catch (err: unknown) {
      setRevealError(
        err instanceof Error ? err.message : 'Failed to reveal wines. Ensure Host Mode is enabled in Settings.'
      );
    }
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
            <span className="text-slate-500 font-mono text-xs">{extractCalendarDate(session.date)}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-slate-100">{session.name}</h2>
        </div>

        {/* Global actions */}
        <div className="flex gap-3">
          {isHost && (
            <button
              type="button"
              onClick={onResetSession}
              className="min-h-[44px] py-2 px-4 border border-slate-800 bg-white hover:bg-slate-850 text-slate-400 hover:text-slate-100 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Reset Session
            </button>
          )}
        </div>
      </div>

      {/* Late Vote Archive Desync Alert for Host */}
      {isHost && hasLateArchiveDesync && onSyncArchive && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-start gap-2.5 text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs leading-relaxed">
              <strong className="font-bold block">Late ratings logged after reveal</strong>
              Standings reflect new or updated votes submitted after this session was archived. Re-sync so History, Palate, and Cellar match live votes.
            </div>
          </div>
          <button
            type="button"
            onClick={onSyncArchive}
            disabled={syncingArchive}
            className="min-h-[44px] px-4 py-2 bg-[#6E172C] hover:bg-[#5A1425] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-xs"
          >
            {syncingArchive ? 'Syncing Archive...' : 'Sync History Archive'}
          </button>
        </div>
      )}

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
      <div className="flex border-b border-slate-800" role="tablist" aria-label="Dashboard views">
        <button
          id={`${idBase}-tab-status`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'status'}
          aria-controls={`${idBase}-panel-status`}
          onClick={() => setActiveTab('status')}
          className={`min-h-[44px] pb-3 px-6 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'status'
              ? 'border-[#6E172C] text-[#6E172C]'
              : 'border-transparent text-slate-500 hover:text-slate-100'
          }`}
        >
          <Users className="w-4 h-4" aria-hidden="true" /> Live Tasting Status
        </button>
        {isRevealed && (
          <button
            id={`${idBase}-tab-analysis`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'analysis'}
            aria-controls={`${idBase}-panel-analysis`}
            onClick={() => setActiveTab('analysis')}
            className={`min-h-[44px] pb-3 px-6 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'analysis'
                ? 'border-[#6E172C] text-[#6E172C]'
                : 'border-transparent text-slate-500 hover:text-slate-100'
            }`}
          >
            <BarChart2 className="w-4 h-4" aria-hidden="true" /> Value Analysis &amp; Awards
          </button>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* VIEW 1: LIVE STATUS / TASTING WORKFLOW */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'status' && (
        <div
          id={`${idBase}-panel-status`}
          role="tabpanel"
          aria-labelledby={`${idBase}-tab-status`}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          
          {/* Column 1 & 2: Host Unbag & Reveal Tool or Completed View */}
          <div className="lg:col-span-2 space-y-6">
            {!isRevealed ? (
              isHost ? (
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold font-serif text-slate-100 flex items-center gap-2">
                        <Eye className="w-5.5 h-5.5 text-[#6E172C]" aria-hidden="true" />
                        Unbag &amp; Reveal Bottles
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        When tasting is complete, unbag each physical bottle ({bagLabels[0]}-{bagLabels[bagLabels.length - 1]}) and map its blind letter to its true wine identity below.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleConfirmReveal} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {bagLabels.map((label) => {
                        const selectId = `${idBase}-bag-select-${label}`;
                        return (
                          <div key={label} className="flex items-center gap-3 bg-slate-850/60 p-3 border border-slate-800 rounded-xl">
                            <span className="w-8 h-8 rounded-full bg-[#6E172C] text-white font-black font-serif flex items-center justify-center text-sm shadow-xs shrink-0">
                              {label}
                            </span>
                            <div className="flex-1 min-w-0">
                              <label htmlFor={selectId} className="visually-hidden">
                                Mapped wine for Bag {label}
                              </label>
                              <select
                                id={selectId}
                                value={mapping[label] || ''}
                                onChange={(e) => {
                                  setMapping(prev => ({ ...prev, [label]: e.target.value }));
                                  setRevealError('');
                                }}
                                className="w-full min-h-[44px] bg-white border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-[#6E172C] shadow-xs"
                              >
                                <option value="">-- Select Bag {label} Wine --</option>
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
                        );
                      })}
                    </div>

                    {(hasDuplicates || revealError) && (
                      <p role="alert" className="text-rose-800 text-xs border border-rose-200 bg-rose-50 px-3 py-2 rounded-lg font-medium">
                        {revealError || 'Error: You have assigned the same wine to multiple bags. Please ensure each wine is assigned uniquely.'}
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        {canSubmitReveal
                          ? `All ${targetCount} bags mapped uniquely and ready to reveal.`
                          : `${selectedWineIds.length} of ${targetCount} bags mapped.`}
                      </span>
                      <button
                        type="submit"
                        disabled={!canSubmitReveal}
                        className="min-h-[48px] py-3 px-8 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-[#1E1814] font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/10"
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" /> Save Reveal &amp; Map Results
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
        <div
          id={`${idBase}-panel-analysis`}
          role="tabpanel"
          aria-labelledby={`${idBase}-tab-analysis`}
          className="space-y-8 animate-fade-in"
        >
          
          {/* Medal Awards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Award 1: Best in Show */}
            {awards.bestInShow && (
              <div className="glass-panel border-2 border-amber-300 bg-gradient-to-b from-amber-50 via-gold-950/60 to-white rounded-2xl p-5 text-center relative overflow-hidden flex flex-col justify-between min-h-[180px] shadow-sm">
                <div className="absolute top-0 right-0 w-16 h-16 bg-amber-400/10 rounded-bl-full blur-sm" />
                <div className="space-y-2">
                  <Trophy className="w-8 h-8 text-amber-700 mx-auto" aria-hidden="true" />
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
                  <Award className="w-8 h-8 text-rose-700 mx-auto" aria-hidden="true" />
                  <p className="text-[10px] text-rose-800 font-extrabold uppercase tracking-widest">
                    {awards.isRunnerUp ? `Runner-Up (${awards.peoplesChoice.score}/100)` : `Highest Rated (${awards.peoplesChoice.score}/100)`}
                  </p>
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
                  <DollarSign className="w-8 h-8 text-emerald-700 mx-auto" aria-hidden="true" />
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
                <Shield className="w-8 h-8 text-purple-700 mx-auto" aria-hidden="true" />
                <p className="text-[10px] text-purple-900 font-extrabold uppercase tracking-widest">Giant Killer (Cheapest Win)</p>
                {awards.giantKillerMatch ? (
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-100 leading-tight line-clamp-2">
                      {awards.giantKillerMatch.winner.name} (${awards.giantKillerMatch.winner.price.toFixed(0)})
                    </h4>
                    <p className="text-[9px] text-purple-800 font-bold uppercase tracking-wider">Defeated</p>
                    <h4 className="text-xs text-slate-500 leading-tight line-clamp-1">
                      {awards.giantKillerMatch.loser.name} (${awards.giantKillerMatch.loser.price.toFixed(0)})
                    </h4>
                  </div>
                ) : (
                  <h4 className="text-sm font-medium text-slate-500 pt-3">No major giant killings. Price followed expectations!</h4>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-3 pt-2 border-t border-purple-200 flex justify-between items-center">
                <span>Margin:</span>
                <span className="text-purple-800 font-bold font-mono">
                  {awards.giantKillerMatch ? `$${awards.giantKillerMatch.margin.toFixed(2)} diff` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Scatter Plot: Appreciation Index vs Price */}
          <div className="glass-panel rounded-2xl p-6 space-y-6">
            <div className="border-b border-slate-850 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Price vs. Value Chart</h3>
                <p className="text-xs text-slate-500">Tap or select any bottle point to inspect exact score and price details. Optimal region: top left!</p>
              </div>
            </div>

            {/* Interactive Scatter Chart */}
            <div className="w-full h-80 bg-white border border-slate-800 rounded-xl relative p-4 flex flex-col justify-between shadow-inner">
              <div className="flex-1 w-full relative border-l border-b border-slate-800">
                {[25, 50, 75, 100].map(level => (
                  <div
                    key={level}
                    className="absolute left-0 right-0 border-t border-slate-800/80 flex justify-end text-[9px] text-slate-400 font-mono pr-2"
                    style={{ bottom: `${level}%`, transform: 'translateY(-50%)' }}
                  >
                    Score: {level}
                  </div>
                ))}

                <div className="absolute top-2 left-2 text-[8px] font-bold text-emerald-800/60 uppercase tracking-widest">Smart Buy (High Quality, Low Price)</div>
                <div className="absolute top-2 right-2 text-[8px] font-bold text-amber-800/60 uppercase tracking-widest">Splurge Worthy (High Quality, High Price)</div>
                <div className="absolute bottom-2 left-2 text-[8px] font-bold text-slate-500/60 uppercase tracking-widest">Neutral (Low Quality, Low Price)</div>
                <div className="absolute bottom-2 right-2 text-[8px] font-bold text-rose-800/60 uppercase tracking-widest">Overpriced (Low Quality, High Price)</div>

                {wineStats.map(w => {
                  const maxPriceVal = Math.max(...wineStats.map(x => x.price), 100);
                  const minPriceVal = Math.min(...wineStats.map(x => x.price), 5);
                  const priceDiff = maxPriceVal - minPriceVal;
                  const xPct = priceDiff > 0 ? ((w.price - minPriceVal) / priceDiff) * 90 + 5 : 50;
                  const yPct = w.score;
                  const isSelected = selectedChartWine?.id === w.id;

                  return (
                    <div
                      key={w.id}
                      className="absolute z-10"
                      style={{
                        left: `${xPct}%`,
                        bottom: `${yPct}%`,
                        transform: 'translate(-50%, 50%)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedChartWine(isSelected ? null : w)}
                        aria-pressed={isSelected}
                        aria-label={`Wine ${w.blind_label}: ${w.name}, score ${w.score} out of 100, price $${w.price.toFixed(2)}`}
                        className="w-8 h-8 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6E172C]"
                      >
                        <span
                          className={`w-4 h-4 rounded-full border border-white transition-transform flex items-center justify-center shadow-sm ${
                            isSelected ? 'bg-amber-600 scale-125 ring-2 ring-amber-400' : 'bg-[#821D35] hover:bg-amber-600 hover:scale-125'
                          }`}
                        />
                      </button>

                      <span className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 font-bold text-[10px] text-slate-500 font-serif">
                        {w.blind_label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-2 px-1">
                <span>Cheapest (${Math.min(...wineStats.map(x => x.price)).toFixed(0)})</span>
                <span className="font-sans font-bold uppercase tracking-wider">Price Axis</span>
                <span>Most Expensive (${Math.max(...wineStats.map(x => x.price)).toFixed(0)})</span>
              </div>
            </div>

            {/* Tap / Keyboard Accessible Plot Inspector */}
            {selectedChartWine && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-slate-800 bg-white p-3.5 flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="min-w-0 space-y-0.5 text-xs">
                  <p className="font-bold text-slate-100 truncate">
                    Wine {selectedChartWine.blind_label}: {selectedChartWine.name}
                  </p>
                  <p className="text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Rating: <strong className="text-[#6E172C] font-mono">{selectedChartWine.score}/100</strong></span>
                    <span>Price: <strong className="text-amber-800 font-mono">${selectedChartWine.price.toFixed(2)}</strong></span>
                    <span>Brought by: <strong className="text-slate-200">{selectedChartWine.submitted_by}</strong></span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedChartWine(null)}
                  aria-label="Close chart point details"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-850"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {/* Full stats breakdown table */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 id={`${idBase}-specs-heading`} className="text-lg font-semibold text-slate-100">Wine Specifications Breakdown</h3>

            <div role="region" aria-labelledby={`${idBase}-specs-heading`} tabIndex={0} className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <caption className="visually-hidden">Wine specifications and appreciation scores breakdown</caption>
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase font-bold tracking-wider">
                    <th scope="col" className="py-3 px-2">Label</th>
                    <th scope="col" className="py-3 px-4">Wine</th>
                    <th scope="col" className="py-3 px-4">Contributor</th>
                    <th scope="col" className="py-3 px-4">Price</th>
                    <th scope="col" className="py-3 px-4 text-center">{isStandaloneSession ? 'Ratings' : 'Wins'}</th>
                    <th scope="col" className="py-3 px-4 text-center">Appreciation Score</th>
                    <th scope="col" className="py-3 px-4">Tasting Notes</th>
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
