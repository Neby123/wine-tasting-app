import type { HistoricalTasting, Vote, Wine, WineSession } from '../types/wine';
import { extractCalendarDate } from './date';

export interface WineStatRow extends Wine {
  score: number;
  wins: number;
  ratingsCount: number;
  valueRatio: number;
}

export interface GiantKillerSummary {
  matchId: string;
  winner: WineStatRow;
  loser: WineStatRow;
  margin: number;
}

export interface SessionAwards {
  bestInShow: WineStatRow;
  peoplesChoice: WineStatRow;
  isRunnerUp: boolean;
  bestValue: WineStatRow;
  overpriced: WineStatRow;
  giantKillerMatch: GiantKillerSummary | null;
}

export interface LeaderboardAnalysis {
  bagLabels: string[];
  hasVotes: boolean;
  isStandaloneSession: boolean;
  wineStats: WineStatRow[];
  leaderboard: WineStatRow[];
  awards: SessionAwards | null;
}

export const normalizeVoterName = (name?: string | null): string => (name || '').trim();

export const isStandaloneVote = (v: Pick<Vote, 'match_id' | 'wine_1_label' | 'wine_2_label'>): boolean =>
  Boolean(v.match_id?.startsWith('STANDALONE_') || v.wine_1_label === v.wine_2_label);

export const getVoteScoreForLabel = (
  vote: Pick<Vote, 'match_id' | 'wine_1_label' | 'wine_2_label' | 'slider_value'>,
  label: string
): number | null => {
  if (vote.wine_1_label !== label && vote.wine_2_label !== label) return null;
  if (isStandaloneVote(vote)) return vote.slider_value;
  return vote.wine_1_label === label ? 100 - vote.slider_value : vote.slider_value;
};

export const getWineAppreciationIndex = (label: string, votes: Vote[]): number => {
  const wineVotes = votes.filter(v => v.wine_1_label === label || v.wine_2_label === label);
  if (wineVotes.length === 0) return 50;

  let scoreSum = 0;
  wineVotes.forEach(v => {
    const score = getVoteScoreForLabel(v, label);
    if (score !== null) scoreSum += score;
  });

  return Math.round(scoreSum / wineVotes.length);
};

export const computeMatchWinners = (votes: Vote[]): Record<string, string> => {
  const computed: Record<string, string> = {};
  const matchVotes: Record<string, { w1: string; w2: string; sum: number; count: number }> = {};

  votes.forEach(v => {
    if (isStandaloneVote(v)) return;
    if (!matchVotes[v.match_id]) {
      matchVotes[v.match_id] = { w1: v.wine_1_label, w2: v.wine_2_label, sum: 0, count: 0 };
    }
    matchVotes[v.match_id].sum += v.slider_value;
    matchVotes[v.match_id].count += 1;
  });

  Object.entries(matchVotes).forEach(([mId, data]) => {
    const avg = data.sum / data.count;
    computed[mId] = avg < 50 ? data.w1 : data.w2;
  });

  return computed;
};

export const getUniqueBagLabels = (wines: Wine[], votes: Vote[]): string[] => {
  const labelSet = new Set<string>();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < wines.length; i++) {
    labelSet.add(wines[i]?.blind_label || alphabet[i] || `W${i + 1}`);
  }
  votes.forEach(v => {
    if (v.wine_1_label) labelSet.add(v.wine_1_label);
    if (v.wine_2_label) labelSet.add(v.wine_2_label);
  });
  return Array.from(labelSet).sort();
};

export const analyzeSessionLeaderboard = (
  session: Pick<WineSession, 'id' | 'match_winners'>,
  wines: Wine[],
  votes: Vote[],
  externalMatchWinners: Record<string, string> = {}
): LeaderboardAnalysis => {
  const bagLabels = getUniqueBagLabels(wines, votes);
  const anyRevealed = wines.some(w => w.revealed);
  const effectiveWinners =
    Object.keys(externalMatchWinners).length > 0
      ? externalMatchWinners
      : computeMatchWinners(votes);

  const countWinsForLabel = (label: string): number => {
    let wins = 0;
    votes.forEach(v => {
      if (isStandaloneVote(v)) return;
      if (v.wine_1_label === label && v.slider_value < 50) wins++;
      if (v.wine_2_label === label && v.slider_value > 50) wins++;
    });
    if (wins === 0) {
      Object.values(effectiveWinners).forEach(winner => {
        if (winner === label) wins++;
      });
    }
    return wins;
  };

  const countRatingsForLabel = (label: string): number =>
    votes.filter(v => v.wine_1_label === label || v.wine_2_label === label).length;

  const wineStats: WineStatRow[] = anyRevealed
    ? wines.map(w => {
        const label = w.blind_label || '';
        const score = getWineAppreciationIndex(label, votes);
        const wins = countWinsForLabel(label);
        const ratingsCount = countRatingsForLabel(label);
        return {
          ...w,
          score,
          wins,
          ratingsCount,
          valueRatio: score / Math.max(1, w.price || 1)
        };
      })
    : bagLabels.map(label => {
        const score = getWineAppreciationIndex(label, votes);
        const wins = countWinsForLabel(label);
        const ratingsCount = countRatingsForLabel(label);
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

  const hasStandaloneVotes = votes.some(v => isStandaloneVote(v));
  const hasHeadToHeadVotes = votes.some(v => !isStandaloneVote(v) && Boolean(v.match_id));
  const isStandaloneSession = hasStandaloneVotes && !hasHeadToHeadVotes;

  const leaderboard = [...wineStats].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.wins - a.wins;
  });

  let awards: SessionAwards | null = null;
  if (wineStats.length > 0) {
    const bestInShow = leaderboard[0];
    const sortedByScore = [...wineStats].sort((a, b) => b.score - a.score);
    let peoplesChoice = sortedByScore[0];
    let isRunnerUp = false;
    if (peoplesChoice && bestInShow && peoplesChoice.id === bestInShow.id && leaderboard.length >= 2) {
      peoplesChoice = leaderboard[1];
      isRunnerUp = true;
    }

    const bestValuePool = wineStats.filter(w => w.wins > 0);
    const qualifiedPool = bestValuePool.length > 0 ? bestValuePool : wineStats.filter(w => w.score >= 50);
    const finalValuePool = qualifiedPool.length > 0 ? qualifiedPool : wineStats;
    const bestValue = [...finalValuePool].sort((a, b) => b.valueRatio - a.valueRatio)[0];

    const expensiveWines = wineStats.filter(w => w.price >= 20);
    const overpriced =
      expensiveWines.length > 0
        ? [...expensiveWines].sort((a, b) => a.valueRatio - b.valueRatio)[0]
        : [...wineStats].sort((a, b) => a.valueRatio - b.valueRatio)[0];

    let giantKillerMatch: GiantKillerSummary | null = null;
    votes.forEach(v => {
      if (isStandaloneVote(v)) return;
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
      const sortedByPrice = [...wineStats]
        .filter(w => typeof w.price === 'number' && w.price > 0)
        .sort((a, b) => (a.price || 0) - (b.price || 0));
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
              giantKillerMatch = {
                matchId: 'STANDINGS_UPSET',
                winner: cheaper,
                loser: pricier,
                margin
              };
            }
          }
        }
      }
    }

    awards = {
      bestInShow,
      peoplesChoice,
      isRunnerUp,
      bestValue,
      overpriced,
      giantKillerMatch
    };
  }

  return {
    bagLabels,
    hasVotes: votes.length > 0,
    isStandaloneSession,
    wineStats,
    leaderboard,
    awards
  };
};

export const buildHistoryReport = (
  session: WineSession,
  mappedWines: Wine[],
  sourceVotes: Vote[]
): HistoricalTasting => {
  const analysis = analyzeSessionLeaderboard(session, mappedWines, sourceVotes);
  const sorted = analysis.leaderboard;
  const bisWine = analysis.awards?.bestInShow || sorted[0];
  const bestValue = analysis.awards?.bestValue;
  const giantKillerMatch = analysis.awards?.giantKillerMatch;

  return {
    id: session.id,
    name: session.name,
    date: extractCalendarDate(session.date),
    winnerName: bisWine?.name || 'Unknown',
    winnerPrice: bisWine?.price || 0,
    winnerBroughtBy: bisWine?.submitted_by || 'Unknown',
    winesCount: mappedWines.length,
    groupWinner: bisWine ? `${bisWine.name} ($${bisWine.price.toFixed(2)})` : 'N/A',
    secondPlace: sorted[1] ? `${sorted[1].name} ($${sorted[1].price.toFixed(2)})` : 'N/A',
    bestValue: bestValue ? `${bestValue.name} ($${bestValue.price.toFixed(2)})` : 'N/A',
    giantKiller: giantKillerMatch
      ? `${giantKillerMatch.winner.name} ($${giantKillerMatch.winner.price.toFixed(2)}) beat ${giantKillerMatch.loser.name} ($${giantKillerMatch.loser.price.toFixed(2)})`
      : undefined,
    wines: analysis.wineStats.map(w => ({
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
      voter_name: normalizeVoterName(v.voter_name),
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
};

export const hasHistoryDivergence = (
  session: WineSession,
  wines: Wine[],
  votes: Vote[],
  historyRow?: HistoricalTasting | null
): boolean => {
  if (!historyRow || session.status !== 'completed' || !wines.some(w => w.revealed)) return false;
  const archivedVotes = historyRow.votes || [];
  if (archivedVotes.length !== votes.length) return true;

  const currentReport = buildHistoryReport(session, wines, votes);
  const currentSignature = JSON.stringify(
    currentReport.wines
      .map(w => ({ label: w.blind_label || w.name, score: w.score, wins: w.wins }))
      .sort((a, b) => a.label.localeCompare(b.label))
  );
  const archivedSignature = JSON.stringify(
    (historyRow.wines || [])
      .map(w => ({ label: w.blind_label || w.name, score: w.score, wins: w.wins }))
      .sort((a, b) => a.label.localeCompare(b.label))
  );
  if (currentSignature !== archivedSignature) return true;

  const archivedVoteKeys = new Set(
    archivedVotes.map(
      v =>
        `${normalizeVoterName(v.voter_name).toLowerCase()}|${v.match_id}|${v.slider_value}|${v.notes_wine_1 || ''}|${v.perceived_price_1 || ''}|${v.buy_again_1 || ''}|${v.acidity_1 || ''}|${v.body_1 || ''}|${v.sweetness_1 || ''}`
    )
  );
  return votes.some(
    v =>
      !archivedVoteKeys.has(
        `${normalizeVoterName(v.voter_name).toLowerCase()}|${v.match_id}|${v.slider_value}|${v.notes_wine_1 || ''}|${v.perceived_price_1 || ''}|${v.buy_again_1 || ''}|${v.acidity_1 || ''}|${v.body_1 || ''}|${v.sweetness_1 || ''}`
      )
  );
};
