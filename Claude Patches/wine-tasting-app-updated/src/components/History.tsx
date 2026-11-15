import { useState, useEffect, useId } from 'react';
import type { HistoricalTasting } from '../types/wine';
import { extractCalendarDate } from '../utils/date';
import { db } from '../utils/supabase';
import { Trophy, Calendar, DollarSign, Award, ChevronDown, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react';

interface HistoryProps {
  voterName: string;
  onRefresh?: () => void;
}

export default function History({ voterName, onRefresh }: HistoryProps) {
  const idBase = useId();
  const [sessions, setSessions] = useState<HistoricalTasting[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [selectedVoterName, setSelectedVoterName] = useState<Record<string, string>>({});

  const loadHistoryData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await db.getHistory();
      setSessions(data || []);
    } catch (err) {
      console.error("Error loading history:", err);
      setLoadError(err instanceof Error ? err.message : 'Unable to load historical tasting archives.');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistoryData();
  }, []);

  const handleToggleExpand = (id: string) => {
    setExpandedSessionId(expandedSessionId === id ? null : id);
  };

  const handleRefresh = async () => {
    await loadHistoryData();
    if (onRefresh) onRefresh();
  };

  const getPersonalNotesForLabel = (label: string, voter: string, sessionVotes?: HistoricalTasting['votes']) => {
    if (!sessionVotes) return null;
    const votes = sessionVotes.filter(v =>
      (v.voter_name || '').trim().toLowerCase() === voter.trim().toLowerCase() &&
      (v.wine_1_label === label || v.wine_2_label === label)
    );
    if (votes.length === 0) return null;

    return votes.map(v => {
      const isStandalone = v.match_id?.startsWith('STANDALONE_') || v.wine_1_label === v.wine_2_label;
      const isWine1 = v.wine_1_label === label;
      const preferenceVal = isStandalone ? v.slider_value : (isWine1 ? (100 - v.slider_value) : v.slider_value);
      const notes = isWine1 ? v.notes_wine_1 : v.notes_wine_2;
      const opponent = isStandalone ? undefined : (isWine1 ? v.wine_2_label : v.wine_1_label);

      return {
        matchId: isStandalone ? 'Standalone Rating' : v.match_id,
        opponent,
        notes: notes?.trim(),
        score: preferenceVal,
        isStandalone,
        perceivedPrice: v.perceived_price_1,
        buyAgain: v.buy_again_1,
        acidity: v.acidity_1,
        body: v.body_1,
        sweetness: v.sweetness_1
      };
    });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold font-serif text-wine-100">Historical Archives</h2>
          <p className="text-slate-400 text-sm">
            Review winners, ratings, and price-value performance metrics from past wine tastings.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Reload history data"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 border border-slate-800 bg-white hover:bg-slate-850 text-slate-400 hover:text-slate-100 rounded-lg text-xs transition-colors shadow-xs"
          title="Reload history data"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {loadError && (
        <div role="alert" className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs text-rose-900">
          <span className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
            {loadError}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            className="min-h-[36px] px-3 py-1 bg-rose-700 text-white font-bold rounded-lg hover:bg-rose-800 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="w-8 h-8 text-[#6E172C] animate-spin" aria-hidden="true" />
        </div>
      ) : sessions.length === 0 && !loadError ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 border border-slate-800 bg-white shadow-sm">
          No historical wine tasting sessions found in the database.
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
          const isExpanded = expandedSessionId === session.id;
          
          const sessionWines = session.wines || [];
          const sessionVotes = session.votes || [];

          // Calculate wins and rating counts for each wine
          const winesWithStats = sessionWines.map(w => {
            let wins = w.wins || 0;
            if (wins === 0 && sessionVotes.length > 0) {
              sessionVotes.forEach(v => {
                if (v.match_id?.startsWith('STANDALONE_') || v.wine_1_label === v.wine_2_label) return;
                if (v.wine_1_label === w.blind_label && v.slider_value < 50) wins++;
                if (v.wine_2_label === w.blind_label && v.slider_value > 50) wins++;
              });
            }
            const ratingsCount = sessionVotes.filter(
              v => v.wine_1_label === w.blind_label || v.wine_2_label === w.blind_label
            ).length;
            return { ...w, wins, ratingsCount };
          });

          const hasStandaloneVotes = sessionVotes.some(v => v.match_id?.startsWith('STANDALONE_') || v.wine_1_label === v.wine_2_label);
          const hasHeadToHeadVotes = sessionVotes.some(v => v.match_id && !v.match_id.startsWith('STANDALONE_') && v.wine_1_label !== v.wine_2_label);
          const isStandaloneArchive = hasStandaloneVotes && !hasHeadToHeadVotes;

          // Sort participating wines for this session
          const sortedWines = [...winesWithStats].sort((a, b) => {
            if (isStandaloneArchive) {
              return b.score - a.score;
            }
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.score - a.score;
          });
          const hasContributors = sessionWines.some(w => w.submitted_by && w.submitted_by !== 'Guest');
          const topWine = sortedWines[0];

          // Dynamic resolution of winner details if saved as Unknown or N/A
          const displayWinner = (session.winnerName && session.winnerName !== 'Unknown') 
            ? session.winnerName 
            : (topWine ? topWine.name : 'Unknown');
          const displayBroughtBy = (session.winnerBroughtBy && session.winnerBroughtBy !== 'Unknown') 
            ? session.winnerBroughtBy 
            : (topWine ? topWine.submitted_by : '');
          const displayGroupWinner = (session.groupWinner && session.groupWinner !== 'N/A' && !session.groupWinner.includes('Unknown'))
            ? session.groupWinner
            : (topWine ? `${topWine.name} ($${Number(topWine.price ?? 0).toFixed(2)})` : 'N/A');

          // Compute Giant Killer match if missing or fallback
          let displayGiantKiller = session.giantKiller;
          if (!displayGiantKiller || displayGiantKiller === 'No giant killer matches logged') {
            if (sessionVotes.length > 0) {
              let maxMargin = 0;
              sessionVotes.forEach(v => {
                if (v.match_id?.startsWith('STANDALONE_') || v.wine_1_label === v.wine_2_label) return;
                const w1 = sessionWines.find(w => w.blind_label === v.wine_1_label);
                const w2 = sessionWines.find(w => w.blind_label === v.wine_2_label);
                if (w1 && w2 && typeof w1.price === 'number' && typeof w2.price === 'number') {
                  if (v.slider_value < 50 && w1.price < w2.price) {
                    const margin = w2.price - w1.price;
                    if (margin > maxMargin) {
                      maxMargin = margin;
                      displayGiantKiller = `${w1.name} ($${w1.price.toFixed(2)}) beat ${w2.name} ($${w2.price.toFixed(2)})`;
                    }
                  } else if (v.slider_value > 50 && w2.price < w1.price) {
                    const margin = w1.price - w2.price;
                    if (margin > maxMargin) {
                      maxMargin = margin;
                      displayGiantKiller = `${w2.name} ($${w2.price.toFixed(2)}) beat ${w1.name} ($${w1.price.toFixed(2)})`;
                    }
                  }
                }
              });
            }

            if (!displayGiantKiller && sessionWines.length >= 2) {
              const pricedWines = [...sessionWines]
                .filter(w => typeof w.price === 'number' && w.price > 0)
                .sort((a, b) => a.price - b.price);
              let bestMargin = 0;
              let bestScoreDiff = -1;
              for (let i = 0; i < pricedWines.length; i++) {
                for (let j = i + 1; j < pricedWines.length; j++) {
                  const cheaper = pricedWines[i];
                  const pricier = pricedWines[j];
                  if (pricier.price > cheaper.price && cheaper.score > pricier.score) {
                    const margin = pricier.price - cheaper.price;
                    const scoreDiff = cheaper.score - pricier.score;
                    if (margin > bestMargin || (margin === bestMargin && scoreDiff > bestScoreDiff)) {
                      bestMargin = margin;
                      bestScoreDiff = scoreDiff;
                      displayGiantKiller = `${cheaper.name} ($${cheaper.price.toFixed(2)}) beat ${pricier.name} ($${pricier.price.toFixed(2)})`;
                    }
                  }
                }
              }
            }
          }

          const triggerId = `${idBase}-trigger-${session.id}`;
          const panelId = `${idBase}-panel-${session.id}`;
          const tableHeadingId = `${idBase}-table-${session.id}`;
          const voterSelectId = `${idBase}-voter-${session.id}`;

          return (
            <div
              key={session.id}
              className={`glass-panel rounded-2xl overflow-hidden border transition-all duration-300 ${
                isExpanded ? 'border-[#6E172C]/40 bg-white shadow-md' : 'border-slate-800 bg-white shadow-xs'
              }`}
            >
              {/* WAI-ARIA Accessible Disclosure Session Bar */}
              <h3 className="text-xl font-bold font-serif text-slate-100">
                <button
                  id={triggerId}
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => handleToggleExpand(session.id)}
                  className="w-full p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left hover:bg-slate-850/40 transition-colors"
                >
                  <span className="space-y-2 block">
                    <span className="flex items-center gap-2 text-xs font-sans font-normal text-slate-500">
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{extractCalendarDate(session.date)}</span>
                      <span>•</span>
                      <span>{session.winesCount} Wines Tested</span>
                    </span>
                    <span className="block text-xl font-bold font-serif text-slate-100">{session.name}</span>
                  </span>

                  <span className="flex items-center gap-6 font-sans">
                    <span className="text-right block">
                      <span className="text-[10px] text-amber-800 font-extrabold uppercase tracking-widest flex items-center justify-end gap-1">
                        <Trophy className="w-3 h-3 text-amber-600" aria-hidden="true" /> Winner
                      </span>
                      <span className="block text-sm font-semibold text-slate-100 leading-tight">
                        {displayWinner}
                      </span>
                      {displayBroughtBy && displayBroughtBy !== 'Guest' && (
                        <span className="block text-xs font-normal text-slate-400">
                          Brought by: <strong className="text-slate-100">{displayBroughtBy}</strong>
                        </span>
                      )}
                    </span>

                    <span className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 bg-slate-850 p-2 rounded-full border border-slate-800 shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
                    </span>
                  </span>
                </button>
              </h3>

              {/* Expanded Details Section */}
              {isExpanded && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  className="border-t border-slate-800 bg-slate-950/60 p-6 space-y-6 animate-scale-in"
                >
                  
                  {/* Quick Medals Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-1 shadow-xs">
                      <p className="text-[9px] text-amber-900 font-extrabold uppercase tracking-widest flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-amber-700" aria-hidden="true" /> Best in Show
                      </p>
                      <p className="text-xs font-semibold text-slate-100">{displayGroupWinner}</p>
                    </div>

                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 space-y-1 shadow-xs">
                      <p className="text-[9px] text-emerald-800 font-extrabold uppercase tracking-widest flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-emerald-700" aria-hidden="true" /> Best Value Selection
                      </p>
                      <p className="text-xs font-semibold text-slate-100">{session.bestValue}</p>
                    </div>

                    <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-4 space-y-1 shadow-xs">
                      <p className="text-[9px] text-purple-900 font-extrabold uppercase tracking-widest flex items-center gap-1">
                        <Award className="w-3 h-3 text-purple-700" aria-hidden="true" /> Giant Killer Match
                      </p>
                      <p className="text-xs font-semibold text-slate-100 line-clamp-1">{displayGiantKiller || "No giant killer matches logged"}</p>
                    </div>
                  </div>

                  {/* Wines Table */}
                  <div className="space-y-3">
                    <h4 id={tableHeadingId} className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tournament Results &amp; Specs</h4>
                    <div role="region" aria-labelledby={tableHeadingId} tabIndex={0} className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <caption className="visually-hidden">{session.name} tournament standings and wine pricing</caption>
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                            <th scope="col" className="py-2.5 px-2">Rank</th>
                            {sessionWines[0]?.blind_label && <th scope="col" className="py-2.5 px-2 text-center">Label</th>}
                            <th scope="col" className="py-2.5 px-3">Wine Details</th>
                            {hasContributors && <th scope="col" className="py-2.5 px-3">Contributor</th>}
                            <th scope="col" className="py-2.5 px-3">Price</th>
                            <th scope="col" className="py-2.5 px-3 text-center">{isStandaloneArchive ? 'Ratings' : 'Wins'}</th>
                            <th scope="col" className="py-2.5 px-3 text-center">Appreciation Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {sortedWines.map((wine, idx) => (
                            <tr key={wine.name} className="hover:bg-slate-850/50">
                              <td className="py-2.5 px-2 font-mono text-slate-500 font-bold">#{idx+1}</td>
                              {wine.blind_label && (
                                <td className="py-2.5 px-2 text-center font-bold font-serif">
                                  <span className="w-6 h-6 rounded-full bg-[#6E172C] text-white inline-flex items-center justify-center text-xs font-bold shadow-xs">{wine.blind_label}</span>
                                </td>
                              )}
                              <td className="py-2.5 px-3 font-semibold text-slate-100">{wine.name}</td>
                              {hasContributors && <td className="py-2.5 px-3 text-slate-400">{wine.submitted_by}</td>}
                              <td className="py-2.5 px-3 font-mono font-bold text-amber-800">${Number(wine.price ?? 0).toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-100">
                                {isStandaloneArchive ? wine.ratingsCount : wine.wins}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-[#6E172C]">{wine.score}/100</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Price vs Performance chart summary */}
                  <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center">
                    {session.winnerBroughtBy && session.winnerBroughtBy !== 'Guest' ? (
                      <span>Winner brought by: <strong className="text-slate-100">{session.winnerBroughtBy}</strong></span>
                    ) : (
                      <span></span>
                    )}
                    <span>Second Place: <strong className="text-slate-100">{session.secondPlace}</strong></span>
                  </div>

                  {/* Individual Tasting Journal Section */}
                  {session.votes && session.votes.length > 0 && (() => {
                    const uniqueVoters = Array.from(new Set(session.votes.map(v => v.voter_name))).sort();
                    const activeVoter = selectedVoterName[session.id] || (uniqueVoters.includes(voterName) ? voterName : uniqueVoters[0] || "");
                    
                    return (
                      <div className="border-t border-slate-800 pt-6 mt-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <h4 className="text-sm font-bold text-wine-100 font-serif">Historical Tasting Journal</h4>
                            <p className="text-xs text-slate-500">Review individual ratings, notes, and price-performance metrics logged during this session.</p>
                          </div>
                          
                          {uniqueVoters.length > 0 && (
                            <div className="flex items-center gap-2">
                              <label htmlFor={voterSelectId} className="text-xs text-slate-400 font-medium">Taster Journal for:</label>
                              <select
                                id={voterSelectId}
                                value={activeVoter}
                                onChange={(e) => setSelectedVoterName(prev => ({ ...prev, [session.id]: e.target.value }))}
                                className="min-h-[44px] px-2.5 py-1 bg-white border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-[#6E172C] font-semibold shadow-xs"
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
                            {(sessionWines.length > 0 && sessionWines.every(w => w.blind_label)
                              ? sessionWines.map(w => w.blind_label!).sort()
                              : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
                            ).map((label) => {
                              const wineDetail = sessionWines.find(w => w.blind_label === label);
                              const evaluations = getPersonalNotesForLabel(label, activeVoter, sessionVotes);
                              const isStandaloneGroup = evaluations && evaluations.every(ev => ev.isStandalone);
                              
                              return (
                                <div 
                                  key={label}
                                  className={`glass-panel rounded-xl p-4.5 space-y-3 flex flex-col justify-between min-h-[140px] relative overflow-hidden transition-all duration-300 ${
                                    evaluations ? 'border-wine-800/40 bg-white shadow-xs' : 'opacity-40 bg-slate-850/40 border-slate-800'
                                  }`}
                                >
                                  <div className="space-y-2.5">
                                    <div className="flex justify-between items-start">
                                      <span className="w-7 h-7 rounded-full bg-[#6E172C] text-white font-extrabold font-serif flex items-center justify-center text-xs shadow-xs">
                                        {label}
                                      </span>
                                      {evaluations && evaluations.length > 0 && (
                                        <span className="text-[9px] bg-slate-850 px-2 py-0.5 border border-slate-800 text-slate-500 rounded-full font-mono font-semibold">
                                          {evaluations.length} {isStandaloneGroup ? (evaluations.length === 1 ? 'Rating' : 'Ratings') : (evaluations.length === 1 ? 'Match' : 'Matches')}
                                        </span>
                                      )}
                                    </div>

                                    <div>
                                      <h5 className="text-xs font-bold text-slate-100 font-serif line-clamp-1">
                                        {wineDetail ? wineDetail.name : `Wine ${label}`}
                                      </h5>
                                      {wineDetail && (
                                        <p className="text-[10px] text-slate-500 font-medium">
                                          ${Number(wineDetail.price ?? 0).toFixed(2)} • By {wineDetail.submitted_by}
                                        </p>
                                      )}
                                    </div>

                                    {evaluations && evaluations.length > 0 ? (
                                      <div className="space-y-1.5 pt-1">
                                        {evaluations.map((ev, eIdx) => {
                                          const isWin = ev.score > 50;
                                          const opponentWine = sessionWines.find(w => w.blind_label === ev.opponent);
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
                                            <div key={eIdx} className="text-[10px] leading-relaxed bg-slate-850/70 p-2 rounded border border-slate-800 space-y-1">
                                              <div className="flex justify-between items-start gap-2">
                                                <div className="flex flex-col">
                                                  <span className="text-slate-500 text-[8px] font-extrabold uppercase tracking-widest leading-none mb-0.5">{roundName}</span>
                                                  {ev.opponent && <span className="text-slate-100 font-semibold line-clamp-1">vs {opponentName}</span>}
                                                </div>
                                                {ev.isStandalone ? (
                                                  <span className="shrink-0 font-bold text-emerald-800 font-mono">
                                                    {ev.score}/100
                                                  </span>
                                                ) : (
                                                  <span className={`shrink-0 font-bold ${isWin ? 'text-emerald-800' : 'text-slate-400 line-through'}`}>
                                                    {isWin ? 'Win' : 'Loss'}
                                                  </span>
                                                )}
                                              </div>
                                              {ev.notes && (
                                                <p className="text-slate-400 italic mt-0.5 font-sans">
                                                  "{ev.notes}"
                                                </p>
                                              )}
                                              {(ev.perceivedPrice || ev.buyAgain || ev.acidity || ev.body || ev.sweetness) && (
                                                <div className="flex flex-wrap gap-1 pt-1">
                                                  {ev.perceivedPrice && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-slate-800 text-amber-800 font-mono font-semibold">
                                                      {ev.perceivedPrice === 'cheap' ? '$' : ev.perceivedPrice === 'mid' ? '$$' : '$$$'}
                                                    </span>
                                                  )}
                                                  {ev.buyAgain && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-slate-800 text-slate-200 font-semibold">
                                                      {ev.buyAgain === 'yes' ? 'Buy Again' : ev.buyAgain === 'maybe' ? 'Maybe' : 'Pass'}
                                                    </span>
                                                  )}
                                                  {ev.acidity !== undefined && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-slate-800 text-slate-400 font-mono">
                                                      Acid {ev.acidity}/5
                                                    </span>
                                                  )}
                                                  {ev.body !== undefined && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-slate-800 text-slate-400 font-mono">
                                                      Body {ev.body}/5
                                                    </span>
                                                  )}
                                                  {ev.sweetness !== undefined && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-slate-800 text-slate-400 font-mono">
                                                      Sweet {ev.sweetness}/5
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-[10px] text-slate-500 italic">No ratings logged.</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-xs text-slate-500 bg-white border border-slate-800 rounded-xl">
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
      )}
    </div>
  );
}
