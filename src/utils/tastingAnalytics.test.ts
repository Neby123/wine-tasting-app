import { describe, expect, it } from 'vitest';
import type { Vote, Wine, WineSession } from '../types/wine';
import {
  analyzeSessionLeaderboard,
  buildHistoryReport,
  getVoteScoreForLabel,
  getWineAppreciationIndex,
  hasHistoryDivergence,
} from './tastingAnalytics';

const baseSession: WineSession = {
  id: 'sess-1',
  name: 'Fifty Shades of Grigio',
  date: '2026-11-14T00:00:00Z',
  status: 'completed',
  match_winners: {},
};

const sampleWines: Wine[] = [
  {
    id: 'w1',
    session_id: 'sess-1',
    submitted_by: 'David',
    name: 'Luxury Reserve Pinot Grigio',
    price: 42,
    blind_label: 'A',
    revealed: true,
    varietal: 'Pinot Grigio',
    region: 'Alto Adige',
    country: 'Italy',
    style: 'Crisp White',
  },
  {
    id: 'w2',
    session_id: 'sess-1',
    submitted_by: 'Ben',
    name: 'Value Bottle Pinot Grigio',
    price: 12,
    blind_label: 'B',
    revealed: true,
    varietal: 'Pinot Grigio',
    region: 'Veneto',
    country: 'Italy',
    style: 'Light White',
  },
  {
    id: 'w3',
    session_id: 'sess-1',
    submitted_by: 'Monica',
    name: 'Overpriced Cellar Drop',
    price: 55,
    blind_label: 'C',
    revealed: true,
    varietal: 'Pinot Grigio',
    region: 'Friuli',
    country: 'Italy',
    style: 'Rich White',
  },
];

const standaloneVotes: Vote[] = [
  {
    id: 'v1',
    session_id: 'sess-1',
    voter_name: 'Alexcia',
    match_id: 'STANDALONE_A',
    wine_1_label: 'A',
    wine_2_label: 'A',
    slider_value: 84,
    notes_wine_1: ' Bright citrus and pear ',
    perceived_price_1: 'expensive',
    buy_again_1: 'yes',
    acidity_1: 4,
    body_1: 3,
    sweetness_1: 1,
  },
  {
    id: 'v2',
    session_id: 'sess-1',
    voter_name: 'Jack',
    match_id: 'STANDALONE_B',
    wine_1_label: 'B',
    wine_2_label: 'B',
    slider_value: 88,
    perceived_price_1: 'cheap',
    buy_again_1: 'yes',
    acidity_1: 3,
    body_1: 2,
    sweetness_1: 2,
  },
  {
    id: 'v3',
    session_id: 'sess-1',
    voter_name: 'Alexcia',
    match_id: 'STANDALONE_C',
    wine_1_label: 'C',
    wine_2_label: 'C',
    slider_value: 52,
    perceived_price_1: 'expensive',
    buy_again_1: 'no',
  },
];

describe('tastingAnalytics', () => {
  it('computes appreciation scores consistently for standalone and H2H votes', () => {
    expect(getVoteScoreForLabel(standaloneVotes[0], 'A')).toBe(84);
    expect(getVoteScoreForLabel(standaloneVotes[0], 'B')).toBeNull();

    const h2hVote: Vote = {
      id: 'h1',
      session_id: 'sess-h2h',
      voter_name: 'David',
      match_id: 'M1',
      wine_1_label: 'A',
      wine_2_label: 'B',
      slider_value: 25, // leans toward wine 1 ('A') -> 75 for A, 25 for B
    };
    expect(getVoteScoreForLabel(h2hVote, 'A')).toBe(75);
    expect(getVoteScoreForLabel(h2hVote, 'B')).toBe(25);
    expect(getWineAppreciationIndex('Z', [])).toBe(50);
  });

  it('analyzes standalone leaderboard awards, runner-up deduplication, and standing upsets', () => {
    const analysis = analyzeSessionLeaderboard(baseSession, sampleWines, standaloneVotes);

    expect(analysis.hasVotes).toBe(true);
    expect(analysis.isStandaloneSession).toBe(true);
    expect(analysis.bagLabels).toEqual(['A', 'B', 'C']);

    // Wine B ($12, score 88) beats both A ($42, score 84) and C ($55, score 52)
    expect(analysis.leaderboard[0].blind_label).toBe('B');
    expect(analysis.awards?.bestInShow.blind_label).toBe('B');
    expect(analysis.awards?.peoplesChoice.blind_label).toBe('A');
    expect(analysis.awards?.isRunnerUp).toBe(true);
    expect(analysis.awards?.bestValue.blind_label).toBe('B');
    expect(analysis.awards?.overpriced.blind_label).toBe('C');

    // Largest price-differential upset: $12 B scored 88 > $55 C scored 52 (margin = 43)
    expect(analysis.awards?.giantKillerMatch?.matchId).toBe('STANDINGS_UPSET');
    expect(analysis.awards?.giantKillerMatch?.winner.blind_label).toBe('B');
    expect(analysis.awards?.giantKillerMatch?.loser.blind_label).toBe('C');
    expect(analysis.awards?.giantKillerMatch?.margin).toBe(43);
  });

  it('analyzes H2H wins and detects largest H2H price upset', () => {
    const h2hVotes: Vote[] = [
      {
        id: 'm1v1',
        session_id: 'sess-1',
        voter_name: 'Ben',
        match_id: 'QF_1',
        wine_1_label: 'A', // $42
        wine_2_label: 'B', // $12
        slider_value: 70, // prefers wine 2 ('B')
      },
      {
        id: 'm2v1',
        session_id: 'sess-1',
        voter_name: 'Ben',
        match_id: 'QF_2',
        wine_1_label: 'C', // $55
        wine_2_label: 'B', // $12
        slider_value: 80, // prefers wine 2 ('B')
      },
    ];

    const analysis = analyzeSessionLeaderboard(baseSession, sampleWines, h2hVotes);
    expect(analysis.isStandaloneSession).toBe(false);
    const wineB = analysis.wineStats.find(w => w.blind_label === 'B');
    expect(wineB?.wins).toBe(2);
    expect(analysis.awards?.bestInShow.blind_label).toBe('B');
    expect(analysis.awards?.peoplesChoice.blind_label).toBe('A');
    expect(analysis.awards?.isRunnerUp).toBe(true);
    expect(analysis.awards?.giantKillerMatch?.winner.blind_label).toBe('B');
    expect(analysis.awards?.giantKillerMatch?.loser.blind_label).toBe('C');
    expect(analysis.awards?.giantKillerMatch?.margin).toBe(43);
  });

  it('builds lossless history reports and detects late-vote or sensory divergence', () => {
    const report = buildHistoryReport(baseSession, sampleWines, standaloneVotes);

    expect(report.date).toBe('2026-11-14');
    expect(report.winnerName).toBe('Value Bottle Pinot Grigio');
    expect(report.votes).toHaveLength(3);
    expect(report.votes?.[0]).toMatchObject({
      voter_name: 'Alexcia',
      perceived_price_1: 'expensive',
      buy_again_1: 'yes',
      acidity_1: 4,
      body_1: 3,
      sweetness_1: 1,
    });

    // Exact match -> no divergence
    expect(hasHistoryDivergence(baseSession, sampleWines, standaloneVotes, report)).toBe(false);

    // Late vote added after reveal -> divergence detected
    const withLateVote: Vote[] = [
      ...standaloneVotes,
      {
        id: 'v4',
        session_id: 'sess-1',
        voter_name: 'David',
        match_id: 'STANDALONE_A',
        wine_1_label: 'A',
        wine_2_label: 'A',
        slider_value: 92,
      },
    ];
    expect(hasHistoryDivergence(baseSession, sampleWines, withLateVote, report)).toBe(true);

    // Same vote count, altered sensory field -> divergence detected
    const editedSensory = standaloneVotes.map((v, i) =>
      i === 0 ? { ...v, buy_again_1: 'maybe' as const } : v
    );
    expect(hasHistoryDivergence(baseSession, sampleWines, editedSensory, report)).toBe(true);

    // Non-completed session ignores divergence
    expect(
      hasHistoryDivergence({ ...baseSession, status: 'tasting' }, sampleWines, withLateVote, report)
    ).toBe(false);
  });
});
