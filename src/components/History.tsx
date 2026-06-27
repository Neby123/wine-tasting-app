import { useState } from 'react';
import { HistoricalTasting } from '../utils/mockData';
import { db } from '../utils/supabase';
import { Trophy, Calendar, DollarSign, Award, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface HistoryProps {
  voterName: string;
  onRefresh?: () => void;
}

export default function History({ voterName, onRefresh }: HistoryProps) {
  const [sessions, setSessions] = useState<HistoricalTasting[]>(() => db.getHistory());
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [selectedVoterName, setSelectedVoterName] = useState<Record<string, string>>({});

  const handleToggleExpand = (id: string) => {
    setExpandedSessionId(expandedSessionId === id ? null : id);
  };

  const handleRefresh = () => {
    const refreshed = db.getHistory();
    setSessions(refreshed);
    if (onRefresh) onRefresh();
  };

  const getPersonalNotesForLabel = (label: string, voter: string, sessionVotes?: any[]) => {
    if (!sessionVotes) return null;
    const votes = sessionVotes.filter(v => 
      v.voter_name.toLowerCase() === voter.toLowerCase() && 
      (v.wine_1_label === label || v.wine_2_label === label)
    );
    if (votes.length === 0) return null;
    
    return votes.map(v => {
      const isWine1 = v.wine_1_label === label;
      const preferenceVal = isWine1 ? (100 - v.slider_value) : v.slider_value;
      const notes = isWine1 ? v.notes_wine_1 : v.notes_wine_2;
      const opponent = isWine1 ? v.wine_2_label : v.wine_1_label;
      
      return {
        matchId: v.match_id,
        opponent,
        notes: notes?.trim(),
        score: preferenceVal
      };
    });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex justify-between items-center border-b border-slate-900 pb-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold font-serif text-wine-100">Historical Archives</h2>
          <p className="text-slate-400 text-sm">
            Review winners, ratings, and price-value performance metrics from past wine tastings.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 border border-slate-850 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-colors flex items-center gap-1.5"
          title="Reload history data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessionId === session.id;
          
          // Sort participating wines for this session
          const sortedWines = [...session.wines].sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.score - a.score;
          });
          const hasContributors = session.wines.some(w => w.submitted_by && w.submitted_by !== 'Guest');

          return (
            <div 
              key={session.id} 
              className={`glass-panel rounded-2xl overflow-hidden border transition-all duration-300 ${
                isExpanded ? 'border-wine-800/40' : 'border-slate-800/60'
              }`}
            >
              {/* Session Summary Bar */}
              <div 
                onClick={() => handleToggleExpand(session.id)}
                className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-900/30 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{session.date}</span>
                    <span>•</span>
                    <span>{session.winesCount} Wines Tested</span>
                  </div>
                  <h3 className="text-xl font-bold font-serif text-slate-100">{session.name}</h3>
                </div>

                <div className="flex items-center gap-6">
                  {/* Quick Winner Badge */}
                  <div className="text-right">
                    <p className="text-[10px] text-gold-400 font-extrabold uppercase tracking-widest flex items-center justify-end gap-1">
                      <Trophy className="w-3 h-3" /> Winner
                    </p>
                    <p className="text-sm font-semibold text-slate-250 leading-tight">
                      {session.winnerName}
                    </p>
                    {session.winnerBroughtBy && session.winnerBroughtBy !== 'Guest' && (
                      <p className="text-xs text-slate-500">
                        Brought by: {session.winnerBroughtBy}
                      </p>
                    )}
                  </div>

                  {/* Expand icon */}
                  <div className="text-slate-500 bg-slate-950 p-2 rounded-full border border-slate-850">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Expanded Details Section */}
              {isExpanded && (
                <div className="border-t border-slate-850 bg-slate-950/40 p-6 space-y-6 animate-scale-in">
                  
                  {/* Quick Medals Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 space-y-1">
                      <p className="text-[9px] text-gold-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> Best in Show
                      </p>
                      <p className="text-xs font-semibold text-slate-350">{session.groupWinner}</p>
                    </div>

                    <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 space-y-1">
                      <p className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                        <DollarSign className="w-3 h-3" /> Best Value Selection
                      </p>
                      <p className="text-xs font-semibold text-slate-350">{session.bestValue}</p>
                    </div>

                    <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 space-y-1">
                      <p className="text-[9px] text-purple-400 font-extrabold uppercase tracking-widest flex items-center gap-1">
                        <Award className="w-3 h-3" /> Giant Killer Match
                      </p>
                      <p className="text-xs font-semibold text-slate-350 line-clamp-1">{session.giantKiller || "No giant killer matches logged"}</p>
                    </div>
                  </div>

                  {/* Wines Table */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tournament Results & Specs</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-900 text-slate-500 font-bold">
                            <th className="py-2.5 px-2">Rank</th>
                            {session.wines[0]?.blind_label && <th className="py-2.5 px-2 text-center">Label</th>}
                            <th className="py-2.5 px-3">Wine Details</th>
                            {hasContributors && <th className="py-2.5 px-3">Contributor</th>}
                            <th className="py-2.5 px-3">Price</th>
                            <th className="py-2.5 px-3 text-center">Wins</th>
                            <th className="py-2.5 px-3 text-center">Appreciation Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/60 text-slate-300">
                          {sortedWines.map((wine, idx) => (
                            <tr key={wine.name} className="hover:bg-slate-900/10">
                              <td className="py-2.5 px-2 font-mono text-slate-500 font-bold">#{idx+1}</td>
                              {wine.blind_label && (
                                <td className="py-2.5 px-2 text-center font-bold text-wine-400 font-serif">
                                  {wine.blind_label}
                                </td>
                              )}
                              <td className="py-2.5 px-3 font-semibold text-slate-200">{wine.name}</td>
                              {hasContributors && <td className="py-2.5 px-3 text-slate-400">{wine.submitted_by}</td>}
                              <td className="py-2.5 px-3 font-mono font-bold text-amber-500">${wine.price.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-200">{wine.wins}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-wine-300">{wine.score}/100</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Price vs Performance chart summary */}
                  <div className="pt-2 border-t border-slate-900 text-[10px] text-slate-500 flex justify-between items-center">
                    {session.winnerBroughtBy && session.winnerBroughtBy !== 'Guest' ? (
                      <span>Winner brought by: <strong className="text-slate-400">{session.winnerBroughtBy}</strong></span>
                    ) : (
                      <span></span>
                    )}
                    <span>Second Place: <strong className="text-slate-400">{session.secondPlace}</strong></span>
                  </div>

                  {/* Individual Tasting Journal Section */}
                  {session.votes && session.votes.length > 0 && (() => {
                    const uniqueVoters = Array.from(new Set(session.votes.map(v => v.voter_name))).sort();
                    const activeVoter = selectedVoterName[session.id] || (uniqueVoters.includes(voterName) ? voterName : uniqueVoters[0] || "");
                    
                    return (
                      <div className="border-t border-slate-900 pt-6 mt-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <h4 className="text-sm font-bold text-wine-200 font-serif">Historical Tasting Journal</h4>
                            <p className="text-xs text-slate-500">Review individual brackets, ratings, and notes logged during this session.</p>
                          </div>
                          
                          {uniqueVoters.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 font-medium">Taster Journal for:</span>
                              <select
                                value={activeVoter}
                                onChange={(e) => setSelectedVoterName(prev => ({ ...prev, [session.id]: e.target.value }))}
                                className="px-2.5 py-1 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-wine-500 font-semibold"
                              >
                                {uniqueVoters.map(v => (
                                  <option key={v} value={v}>{v}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {activeVoter ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((label) => {
                              const wineDetail = session.wines.find(w => w.blind_label === label);
                              const evaluations = getPersonalNotesForLabel(label, activeVoter, session.votes);
                              
                              return (
                                <div 
                                  key={label}
                                  className={`glass-panel rounded-xl p-4.5 space-y-3 flex flex-col justify-between min-h-[140px] relative overflow-hidden transition-all duration-300 ${
                                    evaluations ? 'border-wine-800/20 bg-slate-900/30' : 'opacity-30 bg-slate-950/15'
                                  }`}
                                >
                                  <div className="space-y-2.5">
                                    <div className="flex justify-between items-start">
                                      <span className="w-7 h-7 rounded-full bg-wine-900/60 border border-wine-850 text-white font-extrabold font-serif flex items-center justify-center text-xs shadow-inner">
                                        {label}
                                      </span>
                                      {evaluations && evaluations.length > 0 && (
                                        <span className="text-[9px] bg-slate-950 px-2 py-0.5 border border-slate-850 text-slate-400 rounded-full font-mono font-semibold">
                                          {evaluations.length} {evaluations.length === 1 ? 'Match' : 'Matches'}
                                        </span>
                                      )}
                                    </div>

                                    <div>
                                      <h5 className="text-xs font-bold text-wine-200 font-serif line-clamp-1">
                                        {wineDetail ? wineDetail.name : `Wine ${label}`}
                                      </h5>
                                      {wineDetail && (
                                        <p className="text-[10px] text-slate-500 font-medium">
                                          ${wineDetail.price.toFixed(2)} • By {wineDetail.submitted_by}
                                        </p>
                                      )}
                                    </div>

                                    {evaluations && evaluations.length > 0 ? (
                                      <div className="space-y-1.5 pt-1">
                                        {evaluations.map((ev, eIdx) => {
                                          const isWin = ev.score > 50;
                                          const opponentWine = session.wines.find(w => w.blind_label === ev.opponent);
                                          const opponentName = opponentWine ? opponentWine.name : `Wine ${ev.opponent}`;
                                          
                                          const roundNames: Record<string, string> = { 
                                            Q1: 'Quarterfinal', 
                                            Q2: 'Quarterfinal', 
                                            Q3: 'Quarterfinal', 
                                            Q4: 'Quarterfinal', 
                                            S1: 'Semifinal', 
                                            S2: 'Semifinal', 
                                            F: 'Final' 
                                          };
                                          const roundName = roundNames[ev.matchId] || ev.matchId;

                                          return (
                                            <div key={eIdx} className="text-[10px] leading-relaxed bg-slate-950/40 p-2 rounded border border-slate-900/85 space-y-1">
                                              <div className="flex justify-between items-start gap-2">
                                                <div className="flex flex-col">
                                                  <span className="text-slate-500 text-[8px] font-extrabold uppercase tracking-widest leading-none mb-0.5">{roundName}</span>
                                                  <span className="text-slate-300 font-semibold line-clamp-1">vs {opponentName}</span>
                                                </div>
                                                <span className={`shrink-0 font-bold ${isWin ? 'text-emerald-400' : 'text-slate-500 line-through'}`}>
                                                  {isWin ? 'Win' : 'Loss'}
                                                </span>
                                              </div>
                                              {ev.notes && (
                                                <p className="text-slate-450 italic mt-0.5 font-sans">
                                                  "{ev.notes}"
                                                </p>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-[10px] text-slate-500 italic">No matches logged.</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-xs text-slate-500 bg-slate-950/30 border border-slate-900 rounded-xl">
                            Select a taster from the dropdown to display their journal.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
