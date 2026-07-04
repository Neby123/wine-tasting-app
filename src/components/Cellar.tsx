import { useEffect, useMemo, useState } from 'react';
import { HistoricalTasting, WishlistItem } from '../utils/mockData';
import { db } from '../utils/supabase';
import {
  Search, BookmarkPlus, Trash2, Plus, Star, RefreshCw,
  Wine as WineIcon, MapPin, Grape, AlertCircle
} from 'lucide-react';

interface CellarProps {
  voterName: string;
}

interface SearchRow {
  key: string;
  name: string;
  price?: number;
  score: number;
  varietal?: string;
  region?: string;
  style?: string;
  event: string;
  historyId: string;
}

export default function Cellar({ voterName }: CellarProps) {
  const [history, setHistory] = useState<HistoricalTasting[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  // Manual add form
  const [mName, setMName] = useState('');
  const [mProducer, setMProducer] = useState('');
  const [mPrice, setMPrice] = useState('');
  const [mNote, setMNote] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [h, w] = await Promise.all([
        db.getHistory(),
        voterName ? db.getWishlist(voterName) : Promise.resolve([] as WishlistItem[])
      ]);
      setHistory(h);
      setWishlist(w);
    } catch (err) {
      console.error('Error loading cellar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [voterName]);

  // Flatten every wine ever tasted into a searchable list
  const allWines = useMemo<SearchRow[]>(() => {
    const rows: SearchRow[] = [];
    history.forEach(s => {
      s.wines.forEach((w, i) => {
        rows.push({
          key: `${s.id}-${i}`,
          name: w.name,
          price: w.price,
          score: w.score,
          varietal: w.varietal,
          region: w.region,
          style: w.style,
          event: s.name,
          historyId: s.id
        });
      });
    });
    return rows.sort((a, b) => b.score - a.score);
  }, [history]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allWines.slice(0, 12);
    return allWines.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.varietal || '').toLowerCase().includes(q) ||
      (r.region || '').toLowerCase().includes(q) ||
      (r.style || '').toLowerCase().includes(q) ||
      r.event.toLowerCase().includes(q)
    ).slice(0, 40);
  }, [query, allWines]);

  const wishlistNames = useMemo(
    () => new Set(wishlist.map(w => w.wine_name.toLowerCase())),
    [wishlist]
  );

  const addFromSearch = async (row: SearchRow) => {
    if (!voterName || busy) return;
    setBusy(true);
    try {
      const item = await db.addWishlistItem({
        voter_name: voterName,
        wine_name: row.name,
        varietal: row.varietal,
        region: row.region,
        price: row.price,
        source_history_id: row.historyId
      });
      setWishlist(prev => [item, ...prev]);
    } catch (err) {
      console.error('Add to wishlist failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const addManual = async () => {
    if (!voterName || !mName.trim() || busy) return;
    setBusy(true);
    try {
      const priceNum = parseFloat(mPrice);
      const item = await db.addWishlistItem({
        voter_name: voterName,
        wine_name: mName.trim(),
        producer: mProducer.trim() || undefined,
        price: isNaN(priceNum) ? undefined : priceNum,
        note: mNote.trim() || undefined
      });
      setWishlist(prev => [item, ...prev]);
      setMName(''); setMProducer(''); setMPrice(''); setMNote('');
    } catch (err) {
      console.error('Manual add failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await db.removeWishlistItem(id);
      setWishlist(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      console.error('Remove failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <RefreshCw className="w-8 h-8 text-wine-500 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Opening the cellar…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex justify-between items-center border-b border-slate-900 pb-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold font-serif text-wine-100 flex items-center gap-2">
            <Star className="w-7 h-7 text-gold-400" /> My Cellar
          </h2>
          <p className="text-slate-400 text-sm">
            Your buy-again list, plus every wine you've ever tasted — searchable.
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

      {!voterName && (
        <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4 flex items-start gap-2.5 text-sm text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <p>Set your name in Settings to keep a personal wishlist. You can still search the archive below.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Wishlist */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gold-300 flex items-center gap-2">
              <Star className="w-5 h-5" /> Buy-again list {wishlist.length > 0 && <span className="text-slate-500 text-sm font-normal">({wishlist.length})</span>}
            </h3>

            {wishlist.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Nothing saved yet. Search the archive and tap the bookmark, or add one below.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/60 max-h-[360px] overflow-y-auto pr-1">
                {wishlist.map(w => (
                  <div key={w.id} className="py-3 flex justify-between items-start group gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{w.wine_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {[w.producer, w.varietal, w.region].filter(Boolean).join(' · ')}
                        {typeof w.price === 'number' ? ` · $${w.price.toFixed(2)}` : ''}
                      </p>
                      {w.note && <p className="text-[11px] text-slate-400 italic mt-0.5 truncate">“{w.note}”</p>}
                    </div>
                    <button
                      onClick={() => remove(w.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 shrink-0"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {voterName && (
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Add manually</p>
                <input className={inputClass} placeholder="Wine name" value={mName} onChange={e => setMName(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} placeholder="Producer" value={mProducer} onChange={e => setMProducer(e.target.value)} />
                  <input className={inputClass} type="number" step="0.01" min="0" placeholder="Price" value={mPrice} onChange={e => setMPrice(e.target.value)} />
                </div>
                <input className={inputClass} placeholder="Note (optional)" value={mNote} onChange={e => setMNote(e.target.value)} />
                <button
                  onClick={addManual}
                  disabled={!mName.trim() || busy}
                  className="w-full py-2 px-4 bg-gradient-to-r from-wine-800 to-wine-600 hover:from-wine-700 hover:to-wine-500 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-500 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add to list
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Archive search */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <Search className="w-5 h-5 text-wine-400" /> Search past wines
            </h3>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search by name, grape, region, style, or event…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500"
              />
            </div>

            {!query && (
              <p className="text-[11px] text-slate-500">Showing your top-rated wines. Type to search all {allWines.length} bottles.</p>
            )}

            {results.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <WineIcon className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No matches.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 max-h-[440px] overflow-y-auto pr-1">
                {results.map(r => {
                  const saved = wishlistNames.has(r.name.toLowerCase());
                  return (
                    <div key={r.key} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{r.name}</p>
                        <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-slate-400">{r.event}</span>
                          {typeof r.price === 'number' && <span className="text-amber-400">${r.price.toFixed(2)}</span>}
                          {r.varietal && <span className="inline-flex items-center gap-1"><Grape className="w-3 h-3" />{r.varietal}</span>}
                          {r.region && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{r.region}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-wine-300 w-12 text-right">{r.score}/100</span>
                        {voterName && (
                          <button
                            onClick={() => addFromSearch(r)}
                            disabled={saved || busy}
                            className={`p-1.5 rounded-lg transition-colors ${
                              saved
                                ? 'text-emerald-400'
                                : 'text-slate-500 hover:text-gold-300 hover:bg-slate-800'
                            }`}
                            title={saved ? 'On your list' : 'Add to buy-again list'}
                          >
                            <BookmarkPlus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
