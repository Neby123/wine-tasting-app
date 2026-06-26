import { useState } from 'react';
import { HistoricalTasting, mockDB } from '../utils/mockData';
import { Trophy, Calendar, DollarSign, Award, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface HistoryProps {
  onRefresh?: () => void;
}

export default function History({ onRefresh }: HistoryProps) {
  const [sessions, setSessions] = useState<HistoricalTasting[]>(() => mockDB.getHistory());
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const handleToggleExpand = (id: string) => {
    setExpandedSessionId(expandedSessionId === id ? null : id);
  };

  const handleRefresh = () => {
    const refreshed = mockDB.getHistory();
    setSessions(refreshed);
    if (onRefresh) onRefresh();
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
                    <p className="text-xs text-slate-500">
                      Brought by: {session.winnerBroughtBy}
                    </p>
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
                            <th className="py-2.5 px-3">Contributor</th>
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
                              <td className="py-2.5 px-3 text-slate-400">{wine.submitted_by}</td>
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
                    <span>Winner brought by: <strong className="text-slate-400">{session.winnerBroughtBy}</strong></span>
                    <span>Second Place: <strong className="text-slate-400">{session.secondPlace}</strong></span>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
