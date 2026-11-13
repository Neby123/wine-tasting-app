import { useEffect, useMemo, useRef, useState } from 'react';
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
  const loadSeqRef = useRef(0);

  // Manual add form
  const [mName, setMName] = useState('');
  const [mProducer, setMProducer] = useState('');
  const [mPrice, setMPrice] = useState('');
  const [mNote, setMNote] = useState('');

  const load = async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const cleanName = (voterName || '').trim();
      let wishlistLoaded = false;

      const [dbItems, h] = await Promise.all([
        cleanName
          ? db.getWishlist(cleanName).then(items => {
              wishlistLoaded = true;
              return items;
            }).catch(err => {
              console.warn('DB wishlist load error:', err);
              return [] as WishlistItem[];
            })
          : Promise.resolve([] as WishlistItem[]),
        db.getHistory().catch(err => {
          console.warn('DB history load error:', err);
          return [] as HistoricalTasting[];
        })
      ]);

      if (seq !== loadSeqRef.current) return;

      if (wishlistLoaded && cleanName) {
        try {
          localStorage.removeItem(`WINE_TASTING_WISHLIST_${cleanName.toLowerCase()}`);
        } catch {
          // Ignore storage cleanup error
        }
      }

      setHistory(h);
      setWishlist(dbItems);
    } catch (err) {
      if (seq === loadSeqRef.current) {
        console.error('Error loading cellar:', err);
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [voterName]);

  // Flatten every wine ever tasted into a searchable list
  const allWines = useMemo<SearchRow[]>(() => {
    const rows: SearchRow[] = [];
    history.forEach(s => {
      (s.wines || []).forEach((w, i) => {
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
    const cleanName = (voterName || '').trim();
    if (!cleanName || busy) return;
    setBusy(true);

    try {
      const dbItem = await db.addWishlistItem({
        voter_name: cleanName,
        wine_name: row.name,
        varietal: row.varietal,
        region: row.region,
        price: row.price,
        source_history_id: row.historyId
      });
      if (!dbItem || !dbItem.id) {
        throw new Error('Wishlist save returned empty record');
      }
      setWishlist(prev => [
        dbItem,
        ...prev.filter(w => w.wine_name.toLowerCase() !== row.name.toLowerCase())
      ]);
    } catch (err) {
      console.error('Failed to add wine to wishlist:', err);
      alert('Failed to save wine to your cellar list. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const addManual = async () => {
    const cleanName = (voterName || '').trim();
    if (!cleanName || !mName.trim() || busy) return;
    setBusy(true);

    const priceNum = parseFloat(mPrice);
    try {
      const dbItem = await db.addWishlistItem({
        voter_name: cleanName,
        wine_name: mName.trim(),
        producer: mProducer.trim() || undefined,
        price: isNaN(priceNum) ? undefined : priceNum,
        note: mNote.trim() || undefined
      });
      if (!dbItem || !dbItem.id) {
        throw new Error('Wishlist save returned empty record');
      }
      setWishlist(prev => [dbItem, ...prev]);
      setMName(''); setMProducer(''); setMPrice(''); setMNote('');
    } catch (err) {
      console.error('Failed to add manual wine to wishlist:', err);
      alert('Failed to save wine to your cellar list. Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!id || busy) return;
    setBusy(true);

    try {
      await db.removeWishlistItem(id);
      setWishlist(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      console.error('Failed to remove wine from wishlist:', err);
      alert('Failed to remove wine from your cellar list. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] placeholder:text-slate-500 shadow-xs";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <RefreshCw className="w-8 h-8 text-[#6E172C] animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Opening the cellar…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold font-serif text-wine-100 flex items-center gap-2">
            <Star className="w-7 h-7 text-amber-700" /> My Cellar
          </h2>
          <p className="text-slate-400 text-sm">
            Your buy-again list, plus every wine you've ever tasted — searchable.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg border border-slate-800 bg-white text-slate-400 hover:text-slate-100 hover:border-[#6E172C] transition-colors shadow-xs"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {!voterName && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-2.5 text-sm text-amber-900 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
          <p>Set your name in Settings to keep a personal wishlist. You can still search the archive below.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Wishlist */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4 bg-white border border-slate-800 shadow-xs">
            <h3 className="text-lg font-semibold text-slate-100 font-serif flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-700" /> Buy-again list {wishlist.length > 0 && <span className="text-slate-500 text-sm font-normal">({wishlist.length})</span>}
            </h3>

            {wishlist.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Nothing saved yet. Search the archive and tap the bookmark, or add one below.
              </p>
            ) : (
              <div className="divide-y divide-slate-800 max-h-[360px] overflow-y-auto pr-1">
                {wishlist.map(w => (
                  <div key={w.id} className="py-3 flex justify-between items-start group gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{w.wine_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {[w.producer, w.varietal, w.region].filter(Boolean).join(' · ')}
                        {typeof w.price === 'number' ? ` · $${w.price.toFixed(2)}` : ''}
                      </p>
                      {w.note && <p className="text-[11px] text-slate-400 italic mt-0.5 truncate">“{w.note}”</p>}
                    </div>
                    <button
                      onClick={() => remove(w.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 shrink-0"
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
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Add manually</p>
                <input className={inputClass} placeholder="Wine name" value={mName} onChange={e => setMName(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} placeholder="Producer" value={mProducer} onChange={e => setMProducer(e.target.value)} />
                  <input className={inputClass} type="number" step="0.01" min="0" placeholder="Price" value={mPrice} onChange={e => setMPrice(e.target.value)} />
                </div>
                <input className={inputClass} placeholder="Note (optional)" value={mNote} onChange={e => setMNote(e.target.value)} />
                <button
                  onClick={addManual}
                  disabled={!mName.trim() || busy}
                  className="w-full py-2 px-4 bg-[#6E172C] hover:bg-[#5A1425] disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add to list
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Archive search */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4 bg-white border border-slate-800 shadow-xs">
            <h3 className="text-lg font-semibold text-slate-100 font-serif flex items-center gap-2">
              <Search className="w-5 h-5 text-[#6E172C]" /> Search past wines
            </h3>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search by name, grape, region, style, or event…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] placeholder:text-slate-500 shadow-xs"
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
              <div className="divide-y divide-slate-800 max-h-[440px] overflow-y-auto pr-1">
                {results.map(r => {
                  const saved = wishlistNames.has(r.name.toLowerCase());
                  return (
                    <div key={r.key} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate">{r.name}</p>
                        <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-slate-400">{r.event}</span>
                          {typeof r.price === 'number' && <span className="text-amber-800 font-bold font-mono">${r.price.toFixed(2)}</span>}
                          {r.varietal && <span className="inline-flex items-center gap-1"><Grape className="w-3 h-3 text-amber-700" />{r.varietal}</span>}
                          {r.region && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-700" />{r.region}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-[#6E172C] w-12 text-right font-mono">{r.score}/100</span>
                        {voterName && (
                          <button
                            onClick={() => addFromSearch(r)}
                            disabled={saved || busy}
                            className={`p-1.5 rounded-lg transition-colors ${
                              saved
                                ? 'text-emerald-800 bg-emerald-50 border border-emerald-200'
                                : 'text-slate-400 hover:text-amber-800 hover:bg-amber-50'
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
