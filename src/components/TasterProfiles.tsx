import { useEffect, useMemo, useState } from 'react';
import { HistoricalTasting } from '../utils/mockData';
import { db } from '../utils/supabase';
import {
  Users, RefreshCw, TrendingDown, TrendingUp, Heart, Sparkles,
  Handshake, Swords, Wine as WineIcon, Grape, MapPin
} from 'lucide-react';

interface TasterProfilesProps {
  voterName: string;
}

// Flattened view of one wine as one voter experienced it
interface Experience {
  session: string;
  wineName: string;
  price?: number;
  varietal?: string;
  region?: string;
  style?: string;
  preference: number; // 0-100, how much this voter leaned toward this wine
}

interface Profile {
  name: string;
  events: number;
  decisions: number;         // decisive (non-tie) head-to-heads
  cheaperShare: number | null; // fraction of comparable picks that went to the cheaper wine
  avgPreferredPrice: number | null;
  contrarianShare: number | null; // fraction of matchups where they broke from the majority
  topStyle: [string, number] | null;
  topRegion: [string, number] | null;
  topVarietal: [string, number] | null;
  signatureWines: Experience[]; // their highest-rated wines
}

// preferred label for a vote; null on a tie
function preferredLabel(v: { wine_1_label: string; wine_2_label: string; slider_value: number }): string | null {
  if (v.slider_value === 50) return null;
  return v.slider_value < 50 ? v.wine_1_label : v.wine_2_label;
}

function topEntry(counts: Record<string, number>): [string, number] | null {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0];
}

export default function TasterProfiles({ voterName }: TasterProfilesProps) {
  const [sessions, setSessions] = useState<HistoricalTasting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await db.getHistory();
      setSessions(data);
    } catch (err) {
      console.error('Error loading history for profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // All distinct voters across all archived events
  const voters = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => (s.votes || []).forEach(v => set.add(v.voter_name)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  // Default the selection to the current user if they're in the data
  useEffect(() => {
    if (selected) return;
    if (voters.length === 0) return;
    const mine = voters.find(v => v.toLowerCase() === voterName.toLowerCase());
    setSelected(mine || voters[0]);
  }, [voters, voterName, selected]);

  const profiles = useMemo<Record<string, Profile>>(() => {
    const result: Record<string, Profile> = {};

    for (const voter of voters) {
      const experiences: Experience[] = [];
      const eventsSet = new Set<string>();
      let decisions = 0;
      let comparable = 0;
      let cheaper = 0;
      let priceSum = 0;
      let priceCount = 0;
      const styleCounts: Record<string, number> = {};
      const regionCounts: Record<string, number> = {};
      const varietalCounts: Record<string, number> = {};

      for (const s of sessions) {
        const votes = (s.votes || []).filter(v => v.voter_name.toLowerCase() === voter.toLowerCase());
        if (votes.length === 0) continue;
        eventsSet.add(s.id);

        // label -> wine snapshot for this session
        const byLabel: Record<string, HistoricalTasting['wines'][number]> = {};
        s.wines.forEach(w => { if (w.blind_label) byLabel[w.blind_label] = w; });

        // accumulate per-wine preference for signature-wine detection
        const prefByLabel: Record<string, { sum: number; n: number }> = {};

        for (const v of votes) {
          const pref = preferredLabel(v);
          if (pref !== null) {
            decisions++;
            const other = pref === v.wine_1_label ? v.wine_2_label : v.wine_1_label;
            const pw = byLabel[pref];
            const ow = byLabel[other];
            if (pw && ow && typeof pw.price === 'number' && typeof ow.price === 'number' && pw.price !== ow.price) {
              comparable++;
              if (pw.price < ow.price) cheaper++;
            }
            if (pw && typeof pw.price === 'number') { priceSum += pw.price; priceCount++; }
            if (pw?.style) styleCounts[pw.style] = (styleCounts[pw.style] || 0) + 1;
            if (pw?.region) regionCounts[pw.region] = (regionCounts[pw.region] || 0) + 1;
            if (pw?.varietal) varietalCounts[pw.varietal] = (varietalCounts[pw.varietal] || 0) + 1;
          }

          // preference value toward each side (for signature wines)
          for (const label of [v.wine_1_label, v.wine_2_label]) {
            const val = label === v.wine_1_label ? (100 - v.slider_value) : v.slider_value;
            if (!prefByLabel[label]) prefByLabel[label] = { sum: 0, n: 0 };
            prefByLabel[label].sum += val;
            prefByLabel[label].n += 1;
          }
        }

        Object.entries(prefByLabel).forEach(([label, agg]) => {
          const w = byLabel[label];
          if (!w) return;
          experiences.push({
            session: s.name,
            wineName: w.name,
            price: w.price,
            varietal: w.varietal,
            region: w.region,
            style: w.style,
            preference: Math.round(agg.sum / agg.n)
          });
        });
      }

      const signatureWines = experiences
        .sort((a, b) => b.preference - a.preference)
        .slice(0, 3);

      result[voter] = {
        name: voter,
        events: eventsSet.size,
        decisions,
        cheaperShare: comparable > 0 ? cheaper / comparable : null,
        avgPreferredPrice: priceCount > 0 ? priceSum / priceCount : null,
        contrarianShare: null, // filled below (needs cross-voter majority)
        topStyle: topEntry(styleCounts),
        topRegion: topEntry(regionCounts),
        topVarietal: topEntry(varietalCounts),
        signatureWines
      };
    }

    // Contrarian index: how often each voter broke from the majority pick
    const contrarian: Record<string, { broke: number; total: number }> = {};
    voters.forEach(v => { contrarian[v] = { broke: 0, total: 0 }; });

    for (const s of sessions) {
      const byMatch: Record<string, { voter: string; pref: string }[]> = {};
      for (const v of (s.votes || [])) {
        const pref = preferredLabel(v);
        if (pref === null) continue;
        (byMatch[v.match_id] ||= []).push({ voter: v.voter_name, pref });
      }
      Object.values(byMatch).forEach(entries => {
        const tally: Record<string, number> = {};
        entries.forEach(e => { tally[e.pref] = (tally[e.pref] || 0) + 1; });
        const top = topEntry(tally);
        if (!top) return;
        const [majorityLabel, majorityCount] = top;
        // require a clear majority (not a 50/50 split)
        const isClear = entries.filter(e => e.pref === majorityLabel).length === majorityCount &&
          majorityCount * 2 !== entries.length;
        if (!isClear) return;
        entries.forEach(e => {
          const c = contrarian[e.voter];
          if (!c) return;
          c.total++;
          if (e.pref !== majorityLabel) c.broke++;
        });
      });
    }
    voters.forEach(v => {
      const c = contrarian[v];
      if (result[v] && c.total > 0) result[v].contrarianShare = c.broke / c.total;
    });

    return result;
  }, [sessions, voters]);

  // Agreement of the selected voter with every other voter
  const agreements = useMemo(() => {
    if (!selected) return [];
    const out: { other: string; share: number; shared: number }[] = [];
    for (const other of voters) {
      if (other === selected) continue;
      let same = 0;
      let shared = 0;
      for (const s of sessions) {
        const mine = (s.votes || []).filter(v => v.voter_name === selected);
        const theirs = (s.votes || []).filter(v => v.voter_name === other);
        for (const a of mine) {
          const b = theirs.find(t => t.match_id === a.match_id);
          if (!b) continue;
          const pa = preferredLabel(a);
          const pb = preferredLabel(b);
          if (pa === null || pb === null) continue;
          shared++;
          if (pa === pb) same++;
        }
      }
      if (shared > 0) out.push({ other, share: same / shared, shared });
    }
    return out.sort((a, b) => b.share - a.share);
  }, [selected, voters, sessions]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <RefreshCw className="w-8 h-8 text-wine-500 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Analyzing palates…</p>
      </div>
    );
  }

  const profile = selected ? profiles[selected] : undefined;
  const ally = agreements[0];
  const rival = agreements.length > 0 ? agreements[agreements.length - 1] : undefined;

  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex justify-between items-center border-b border-slate-900 pb-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold font-serif text-wine-100 flex items-center gap-2">
            <Users className="w-7 h-7 text-wine-400" /> Taster Profiles
          </h2>
          <p className="text-slate-400 text-sm">
            What each person actually likes — measured blind, across every tasting.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-wine-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {voters.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No completed tastings with votes yet. Profiles appear once you finish an event.</p>
        </div>
      ) : (
        <>
          {/* Voter selector */}
          <div className="flex flex-wrap gap-2">
            {voters.map(v => (
              <button
                key={v}
                onClick={() => setSelected(v)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  selected === v
                    ? 'bg-wine-800 border-wine-600 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-wine-800'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {profile && (
            <div className="space-y-6">
              {/* Headline stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel rounded-2xl p-4 space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Events</p>
                  <p className="text-2xl font-black font-serif text-slate-100">{profile.events}</p>
                  <p className="text-[11px] text-slate-500">{profile.decisions} head-to-heads judged</p>
                </div>

                <div className="glass-panel rounded-2xl p-4 space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Price Instinct</p>
                  {profile.cheaperShare === null ? (
                    <p className="text-sm text-slate-500 pt-1">Not enough data</p>
                  ) : profile.cheaperShare >= 0.5 ? (
                    <>
                      <p className="text-2xl font-black font-serif text-emerald-300 flex items-center gap-1">
                        <TrendingDown className="w-5 h-5" /> {pct(profile.cheaperShare)}
                      </p>
                      <p className="text-[11px] text-slate-500">picks the cheaper wine (blind)</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-black font-serif text-amber-300 flex items-center gap-1">
                        <TrendingUp className="w-5 h-5" /> {pct(1 - profile.cheaperShare)}
                      </p>
                      <p className="text-[11px] text-slate-500">picks the pricier wine (blind)</p>
                    </>
                  )}
                </div>

                <div className="glass-panel rounded-2xl p-4 space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Avg Pick Price</p>
                  <p className="text-2xl font-black font-serif text-slate-100">
                    {profile.avgPreferredPrice === null ? '—' : `$${profile.avgPreferredPrice.toFixed(0)}`}
                  </p>
                  <p className="text-[11px] text-slate-500">of wines they favored</p>
                </div>

                <div className="glass-panel rounded-2xl p-4 space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Contrarian</p>
                  <p className="text-2xl font-black font-serif text-slate-100">
                    {profile.contrarianShare === null ? '—' : pct(profile.contrarianShare)}
                  </p>
                  <p className="text-[11px] text-slate-500">breaks from the group</p>
                </div>
              </div>

              {/* Taste signature */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gold-300 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" /> {profile.name}'s taste signature
                </h3>

                {(profile.topStyle || profile.topRegion || profile.topVarietal) ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.topStyle && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-wine-950/40 border border-wine-900/50 text-wine-200 text-xs font-semibold">
                        <WineIcon className="w-3.5 h-3.5" /> {profile.topStyle[0]}
                      </span>
                    )}
                    {profile.topVarietal && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold">
                        <Grape className="w-3.5 h-3.5" /> {profile.topVarietal[0]}
                      </span>
                    )}
                    {profile.topRegion && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold">
                        <MapPin className="w-3.5 h-3.5" /> {profile.topRegion[0]}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Style, grape and region insights unlock once wines are tagged with those details.
                    Use “Auto-fill details” when registering wines going forward.
                  </p>
                )}

                <div className="space-y-2 pt-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-wine-400" /> Wines they loved most
                  </p>
                  {profile.signatureWines.length === 0 ? (
                    <p className="text-xs text-slate-500">No standout picks recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {profile.signatureWines.map((w, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-950/50 border border-slate-800/60 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{w.wineName}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {w.session}
                              {typeof w.price === 'number' ? ` · $${w.price.toFixed(2)}` : ''}
                              {w.varietal ? ` · ${w.varietal}` : ''}
                            </p>
                          </div>
                          <span className="shrink-0 ml-3 text-xs font-black text-wine-300">{w.preference}/100</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Agreement */}
              <div className="glass-panel rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                  <Handshake className="w-5 h-5 text-wine-400" /> Who {profile.name} agrees with
                </h3>

                {agreements.length === 0 ? (
                  <p className="text-xs text-slate-500">No overlapping votes with other tasters yet.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {ally && (
                        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3">
                          <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1.5 flex-wrap">
                            <Handshake className="w-3.5 h-3.5 shrink-0" /> Palate twin <span className="text-emerald-500 font-normal lowercase tracking-normal">(AKA Taste Bud)</span>
                          </p>
                          <p className="text-sm font-semibold text-slate-200 mt-1">{ally.other}</p>
                          <p className="text-[11px] text-slate-500">{pct(ally.share)} agreement over {ally.shared} shared calls</p>
                        </div>
                      )}
                      {rival && rival.other !== ally?.other && (
                        <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3">
                          <p className="text-[10px] uppercase tracking-widest text-rose-400 font-bold flex items-center gap-1.5 flex-wrap">
                            <Swords className="w-3.5 h-3.5 shrink-0" /> Opposite palate <span className="text-rose-500 font-normal lowercase tracking-normal">(AKA Flavor Foil)</span>
                          </p>
                          <p className="text-sm font-semibold text-slate-200 mt-1">{rival.other}</p>
                          <p className="text-[11px] text-slate-500">{pct(rival.share)} agreement over {rival.shared} shared calls</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {agreements.map(a => (
                        <div key={a.other} className="flex items-center gap-3">
                          <span className="w-20 shrink-0 text-xs text-slate-400 truncate">{a.other}</span>
                          <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-wine-700 to-wine-500"
                              style={{ width: pct(a.share) }}
                            />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs font-bold text-slate-300">{pct(a.share)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
