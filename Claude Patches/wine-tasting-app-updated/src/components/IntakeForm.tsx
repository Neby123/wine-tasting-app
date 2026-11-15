import React, { useId, useRef, useState } from 'react';
import type { Wine } from '../types/wine';
import { SATURDAY_GRIGIO_LINEUP } from '../utils/mockData';
import { db } from '../utils/supabase';
import { useFormAriaSync } from '../hooks/useFormAriaSync';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Plus,
  Trash2,
  EyeOff,
  User,
  DollarSign,
  Wine as WineIcon,
  Sparkles,
  Loader2,
  Edit2,
  Check,
  X,
  PackagePlus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface IntakeFormProps {
  wines: Wine[];
  voterName: string;
  isHost: boolean;
  onAddWine: (wine: Omit<Wine, 'id' | 'session_id' | 'revealed'>) => Promise<void>;
  onAddWinesBatch?: (wines: Omit<Wine, 'id' | 'session_id' | 'revealed'>[]) => Promise<void>;
  onDeleteWine: (id: string) => Promise<void>;
  onUpdateWine?: (id: string, updates: Omit<Partial<Omit<Wine, 'id' | 'session_id'>>, 'vintage'> & { vintage?: string | null }) => Promise<void>;
  onStartTasting: () => Promise<void>;
  sessionName?: string;
  sessionDate?: string;
}

const STYLE_OPTIONS = [
  'Red - Light',
  'Red - Medium',
  'Red - Full-bodied',
  'White - Crisp',
  'White - Rich',
  'Rosé',
  'Sparkling',
  'Dessert',
  'Fortified'
];

export default function IntakeForm({
  wines,
  voterName,
  isHost,
  onAddWine,
  onAddWinesBatch,
  onDeleteWine,
  onUpdateWine,
  onStartTasting,
  sessionName,
  sessionDate
}: IntakeFormProps) {
  const [submittedBy, setSubmittedBy] = useState(voterName || '');
  const [wineName, setWineName] = useState('');

  // Pre-fill submittedBy when voterName changes
  React.useEffect(() => {
    if (voterName && !submittedBy) {
      setSubmittedBy(voterName);
    }
  }, [voterName]);
  const [producer, setProducer] = useState('');
  const [vintage, setVintage] = useState('');
  const [price, setPrice] = useState('');
  const [varietal, setVarietal] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [style, setStyle] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState('');
  const [priceIsEstimate, setPriceIsEstimate] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lineupContributor, setLineupContributor] = useState('Ben & Monica');
  const [editingWineId, setEditingWineId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSubmittedBy, setEditSubmittedBy] = useState('');
  const [editVintage, setEditVintage] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [showPresetLineup, setShowPresetLineup] = useState(false);
  const [enrichNotice, setEnrichNotice] = useState('');
  const [pendingDeleteWine, setPendingDeleteWine] = useState<Wine | null>(null);
  const [deletingWineId, setDeletingWineId] = useState<string | null>(null);
  const bulkLoadingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldIdBase = useId();

  useFormAriaSync(formRef, [submittedBy, wineName, price, errorMsg]);

  const handleFillFromLineup = (bottle: typeof SATURDAY_GRIGIO_LINEUP[number]) => {
    setWineName(bottle.name);
    setProducer(bottle.producer || '');
    setVintage(bottle.vintage || '');
    setPrice(String(bottle.price));
    setVarietal(bottle.varietal || '');
    setRegion(bottle.region || '');
    setCountry(bottle.country || '');
    setStyle(bottle.style || '');
    setNotes(bottle.tasting_notes || '');
    setPriceIsEstimate(false);
    setErrorMsg('');
    setEnrichMsg(`Loaded "${bottle.name}" into form — confirm contributor & price, then click Register Wine.`);
  };

  const handleLoadAllLineup = async () => {
    if (bulkLoadingRef.current) return;
    const existingNames = new Set(wines.map(w => w.name.trim().toLowerCase()));
    const missing = SATURDAY_GRIGIO_LINEUP.filter(b => !existingNames.has(b.name.trim().toLowerCase()));
    if (missing.length === 0) return;

    bulkLoadingRef.current = true;
    setBulkLoading(true);
    setErrorMsg('');
    try {
      const payload = missing.map(bottle => ({
        ...bottle,
        submitted_by: lineupContributor.trim() || voterName || bottle.submitted_by
      }));
      if (onAddWinesBatch) {
        await onAddWinesBatch(payload);
      } else {
        for (const item of payload) {
          await onAddWine(item);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load lineup bottles.');
    } finally {
      bulkLoadingRef.current = false;
      setBulkLoading(false);
    }
  };

  const startEditingWine = (wine: Wine) => {
    setEditingWineId(wine.id);
    setEditName(wine.name);
    setEditSubmittedBy(wine.submitted_by);
    setEditVintage(wine.vintage || '');
    setEditPrice(String(wine.price));
  };

  const cancelEditingWine = () => {
    setEditingWineId(null);
  };

  const saveEditedWine = async (wineId: string) => {
    if (!onUpdateWine) return;
    const parsedPrice = parseFloat(editPrice);
    if (!editName.trim() || !editSubmittedBy.trim() || isNaN(parsedPrice) || parsedPrice < 0) {
      setErrorMsg('Please enter a valid wine name, contributor, and price.');
      return;
    }
    setSavingEdit(true);
    setErrorMsg('');
    try {
      await onUpdateWine(wineId, {
        name: editName.trim(),
        ...(isHost ? { submitted_by: editSubmittedBy.trim() } : {}),
        vintage: editVintage.trim() || null,
        price: parsedPrice
      });
      setEditingWineId(null);
    } catch {
      setErrorMsg('Failed to update bottle details.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAutofill = async () => {
    if (!wineName.trim()) {
      setErrorMsg('Enter at least a wine name before auto-filling.');
      return;
    }
    setErrorMsg('');
    setEnrichMsg('');
    setEnrichNotice('');
    setEnriching(true);
    try {
      const info = await db.enrichWine(wineName.trim(), vintage.trim() || undefined, producer.trim() || undefined);
      // Only fill fields the user hasn't already typed, so manual entries win.
      if (info.producer && !producer.trim()) setProducer(info.producer);
      if (info.varietal && !varietal.trim()) setVarietal(info.varietal);
      if (info.region && !region.trim()) setRegion(info.region);
      if (info.country && !country.trim()) setCountry(info.country);
      if (info.style && !style.trim()) setStyle(info.style);
      if (info.estimated_price_usd && !price.trim()) {
        setPrice(String(info.estimated_price_usd));
        setPriceIsEstimate(true);
      }
      setEnrichMsg(info.descriptor ? `Filled: ${info.descriptor}` : 'Details filled in. Review and adjust as needed.');
    } catch (err: unknown) {
      setEnrichMsg('');
      const msg = err instanceof Error ? err.message : 'the enrichment service is not reachable.';
      setEnrichNotice(
        msg.toLowerCase().includes('not deployed')
          ? msg
          : `Auto-fill unavailable: ${msg} You can still enter details manually.`
      );
    } finally {
      setEnriching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const contributor = submittedBy.trim() || voterName.trim();
    if (!contributor) {
      setErrorMsg("Please enter who brought this bottle!");
      return;
    }
    if (!wineName.trim() || !price.trim()) {
      setErrorMsg("Wine Name and Price are required.");
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMsg("Please enter a valid price.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await onAddWine({
        submitted_by: contributor,
        name: wineName.trim(),
        producer: producer.trim() || undefined,
        vintage: vintage.trim() || undefined,
        price: priceNum,
        varietal: varietal.trim() || undefined,
        region: region.trim() || undefined,
        country: country.trim() || undefined,
        style: style.trim() || undefined,
        tasting_notes: notes.trim() || undefined
      });
      // Clear form
      setWineName('');
      setProducer('');
      setVintage('');
      setPrice('');
      setVarietal('');
      setRegion('');
      setCountry('');
      setStyle('');
      setNotes('');
      setEnrichMsg('');
      setPriceIsEstimate(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add wine");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteWine = async () => {
    if (!pendingDeleteWine) return;
    const targetId = pendingDeleteWine.id;
    setDeletingWineId(targetId);
    setErrorMsg('');
    try {
      await onDeleteWine(targetId);
      setPendingDeleteWine(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to remove bottle from registry.');
    } finally {
      setDeletingWineId(null);
    }
  };

  const inputClass =
    "w-full min-h-[44px] px-3 py-2 bg-white border border-slate-700 focus:border-[#821D35] rounded-lg text-slate-100 placeholder:text-slate-500 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#821D35] font-medium";

  const contributorId = `${fieldIdBase}-contributor`;
  const wineNameId = `${fieldIdBase}-wine-name`;
  const producerId = `${fieldIdBase}-producer`;
  const vintageId = `${fieldIdBase}-vintage`;
  const varietalId = `${fieldIdBase}-varietal`;
  const styleId = `${fieldIdBase}-style`;
  const regionId = `${fieldIdBase}-region`;
  const countryId = `${fieldIdBase}-country`;
  const priceId = `${fieldIdBase}-price`;
  const notesId = `${fieldIdBase}-notes`;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center max-w-xl mx-auto space-y-2">
        {sessionName && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-wine-900 border border-wine-700 text-wine-200 text-xs font-semibold">
            <WineIcon className="w-3.5 h-3.5 text-[#6E172C]" aria-hidden="true" />
            <span>{sessionName}</span>
            {sessionDate && <span className="text-slate-500 font-mono">• {sessionDate}</span>}
          </div>
        )}
        <h2 className="text-3xl font-bold font-serif text-wine-100">Wine Registry</h2>
        <p className="text-slate-400 text-sm">
          Every participant logs their bottle details below. Wine details are kept hidden from other tasters to preserve the blind taste test!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Side: Intake Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-wine-200 flex items-center gap-2">
              <Plus className="w-5 h-5 text-wine-400" aria-hidden="true" /> Log a Bottle
            </h3>

            <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="field-group">
                <label htmlFor={contributorId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Brought By / Contributor <span className="text-rose-400">*</span>
                </label>
                <div className="space-y-2">
                  {/* Quick Preset Selector for guest couples */}
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick contributor presets">
                    {['Ben & Monica', 'Jack & Alexcia', 'David & Abby'].map(couple => (
                      <button
                        type="button"
                        key={couple}
                        aria-pressed={submittedBy === couple}
                        onClick={() => setSubmittedBy(couple)}
                        className={`min-h-[44px] py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                          submittedBy === couple
                            ? 'bg-[#6E172C] text-white border-[#5A1425] shadow-xs'
                            : 'bg-white border-slate-800 text-slate-300 hover:bg-slate-850'
                        }`}
                      >
                        {couple}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <User className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <input
                      id={contributorId}
                      type="text"
                      required
                      autoComplete="name"
                      data-error="Enter who brought this bottle."
                      placeholder="e.g. Jack & Alexcia"
                      value={submittedBy}
                      onChange={(e) => setSubmittedBy(e.target.value)}
                      className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-white border border-slate-700 focus:border-[#821D35] rounded-lg text-slate-100 placeholder:text-slate-500 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#821D35] font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor={wineNameId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Wine Name <span className="text-rose-400">*</span>
                </label>
                <input
                  id={wineNameId}
                  type="text"
                  required
                  data-error="Wine name is required."
                  placeholder="e.g. Vintner's Reserve Chardonnay"
                  value={wineName}
                  onChange={(e) => setWineName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={producerId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Producer
                  </label>
                  <input
                    id={producerId}
                    type="text"
                    placeholder="e.g. Kendall-Jackson"
                    value={producer}
                    onChange={(e) => setProducer(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={vintageId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Vintage
                  </label>
                  <input
                    id={vintageId}
                    type="text"
                    placeholder="e.g. 2021"
                    value={vintage}
                    onChange={(e) => setVintage(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Auto-fill: infer descriptive details from name + vintage */}
              <div className="rounded-xl border border-wine-800/40 bg-wine-950/40 p-3 space-y-2">
                <button
                  type="button"
                  onClick={handleAutofill}
                  disabled={enriching || !wineName.trim()}
                  className="w-full min-h-[44px] py-2 px-4 bg-gradient-to-r from-[#821D35] to-[#5A1425] hover:from-[#6E172C] hover:to-[#3D0C17] disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  {enriching ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
                  {enriching ? 'Looking up…' : 'Auto-fill details'}
                </button>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Fills varietal, region, country &amp; style from the name. Price comes back only as a rough estimate — set it to what you actually paid, since value stats depend on it.
                </p>
                {enrichMsg && (
                  <p className="text-xs text-emerald-800 flex items-start gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" /> {enrichMsg}
                  </p>
                )}
                {enrichNotice && (
                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1.5 font-medium">
                    {enrichNotice}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={varietalId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Varietal / Grape
                  </label>
                  <input
                    id={varietalId}
                    type="text"
                    placeholder="e.g. Pinot Noir"
                    value={varietal}
                    onChange={(e) => setVarietal(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={styleId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Style
                  </label>
                  <select
                    id={styleId}
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Select —</option>
                    {STYLE_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={regionId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Region
                  </label>
                  <input
                    id={regionId}
                    type="text"
                    placeholder="e.g. Willamette Valley"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={countryId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Country
                  </label>
                  <input
                    id={countryId}
                    type="text"
                    placeholder="e.g. USA"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor={priceId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Price ($ USD) <span className="text-rose-400">*</span>
                  {priceIsEstimate && (
                    <span className="ml-2 text-[10px] text-amber-800 normal-case tracking-normal font-medium">estimate — set to what you paid</span>
                  )}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <DollarSign className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <input
                    id={priceId}
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    data-error="Enter a valid non-negative price."
                    placeholder="24.99"
                    value={price}
                    onChange={(e) => { setPrice(e.target.value); setPriceIsEstimate(false); }}
                    className={`w-full min-h-[44px] pl-9 pr-3 py-2 bg-white border rounded-lg text-slate-100 placeholder:text-slate-500 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#821D35] ${priceIsEstimate ? 'border-amber-400' : 'border-slate-700 focus:border-[#821D35]'}`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor={notesId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Tasting Notes / Description
                </label>
                <textarea
                  id={notesId}
                  rows={3}
                  placeholder="Butter, oak, apple, crisp finish (will be revealed at the end!)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`auto-grow ${inputClass}`}
                />
              </div>

              {errorMsg && (
                <p role="alert" className="text-rose-800 text-sm border border-rose-300 bg-rose-50 px-3 py-2 rounded-lg font-medium">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[48px] py-2.5 px-4 bg-gradient-to-r from-[#821D35] to-[#5A1425] hover:from-[#6E172C] hover:to-[#3D0C17] disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-white font-semibold rounded-lg text-sm shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? "Saving..." : "Register Wine"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Optional Host Lineup Preset + Logged Wines List */}
        <div className="lg:col-span-3 space-y-6">
          {isHost && (
            <div className="glass-panel rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 shadow-sm overflow-hidden">
              <button
                type="button"
                aria-expanded={showPresetLineup}
                onClick={() => setShowPresetLineup(prev => !prev)}
                className="w-full min-h-[52px] px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-amber-100/60 transition-colors"
              >
                <div className="flex items-center gap-2 font-serif font-bold text-sm sm:text-base text-amber-950">
                  <PackagePlus className="w-4 h-4 text-amber-800 shrink-0" aria-hidden="true" />
                  <span>Optional Host Template: 11/14 Pinot Grigio Lineup ({SATURDAY_GRIGIO_LINEUP.length} Bottles)</span>
                </div>
                {showPresetLineup ? (
                  <ChevronUp className="w-4 h-4 text-amber-900 shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-amber-900 shrink-0" aria-hidden="true" />
                )}
              </button>

              {showPresetLineup && (
                <div className="p-5 pt-2 border-t border-amber-200/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-amber-900/80">
                      Quick-load historical Pinot Grigio sample bottles or edit prices/contributors inline below.
                    </p>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        aria-label="Default contributor when bulk-loading"
                        value={lineupContributor}
                        onChange={(e) => setLineupContributor(e.target.value)}
                        className="min-h-[44px] px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-amber-950 font-medium focus:outline-none focus:border-[#821D35]"
                        title="Default contributor when bulk-loading"
                      >
                        {['Ben & Monica', 'Jack & Alexcia', 'David & Abby'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleLoadAllLineup}
                        disabled={bulkLoading || SATURDAY_GRIGIO_LINEUP.every(b => wines.some(w => w.name.trim().toLowerCase() === b.name.trim().toLowerCase()))}
                        className="min-h-[44px] py-1.5 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-[#1E1814] font-bold rounded-lg text-xs transition-all whitespace-nowrap shadow-xs"
                      >
                        {bulkLoading ? 'Loading…' : 'Load All 6 Bottles'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SATURDAY_GRIGIO_LINEUP.map((bottle) => {
                      const alreadyAdded = wines.some(w => w.name.trim().toLowerCase() === bottle.name.trim().toLowerCase());
                      return (
                        <div
                          key={bottle.name}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                            alreadyAdded
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-white border-amber-200/80 text-amber-950 shadow-xs'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold truncate text-slate-100">{bottle.name}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {bottle.vintage} · {bottle.region} · <span className="text-amber-800 font-bold">${bottle.price.toFixed(2)}</span>
                            </p>
                          </div>
                          {alreadyAdded ? (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                              ✓ Added
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleFillFromLineup(bottle)}
                              className="min-h-[44px] text-xs font-semibold px-3 py-1 rounded-lg bg-white hover:bg-slate-850 border border-slate-700 hover:border-slate-600 text-slate-200 shrink-0 transition-colors shadow-xs"
                            >
                              Fill Form
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <WineIcon className="w-5 h-5 text-wine-400" />
                Submitted Registry ({wines.length} bottle{wines.length === 1 ? '' : 's'})
              </h3>
              {isHost && (
                <span className="text-xs bg-wine-900 border border-wine-700 px-2.5 py-1 rounded-full text-wine-200 font-semibold tracking-wide shadow-xs">
                  Host View (Uncensored)
                </span>
              )}
            </div>

            {wines.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <WineIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No wines registered yet. Be the first to log a bottle!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 max-h-[420px] overflow-y-auto pr-2">
                {wines.map((wine) => {
                  const isOwnWine = wine.submitted_by.toLowerCase() === voterName.toLowerCase();
                  const showDetails = isHost || isOwnWine;
                  const isEditing = editingWineId === wine.id;

                  return (
                    <div key={wine.id} className="py-3 flex justify-between items-center gap-3 group">
                      {isEditing && showDetails ? (
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                          <input
                            type="text"
                            aria-label="Edit wine name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Wine name"
                            className="sm:col-span-2 min-h-[44px] px-2.5 py-1.5 bg-white border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-[#821D35]"
                          />
                          <input
                            type="text"
                            aria-label="Edit contributor"
                            value={editSubmittedBy}
                            onChange={(e) => setEditSubmittedBy(e.target.value)}
                            disabled={!isHost}
                            placeholder="Brought by"
                            className="min-h-[44px] px-2.5 py-1.5 bg-white border border-slate-700 disabled:opacity-50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-[#821D35]"
                          />
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              aria-label="Edit vintage year"
                              value={editVintage}
                              onChange={(e) => setEditVintage(e.target.value)}
                              placeholder="Year"
                              className="w-16 min-h-[44px] px-2 py-1.5 bg-white border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-[#821D35]"
                            />
                            <input
                              type="number"
                              aria-label="Edit price"
                              step="0.01"
                              min="0"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              placeholder="Price"
                              className="w-24 min-h-[44px] px-2 py-1.5 bg-white border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-[#821D35]"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 min-w-0">
                          {showDetails ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-100">{wine.name}</span>
                                {wine.vintage && <span className="text-xs bg-slate-850 border border-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">{wine.vintage}</span>}
                              </div>
                              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>By: <strong className="text-slate-200">{wine.submitted_by}</strong></span>
                                <span>•</span>
                                <span className="text-amber-800 font-bold">${wine.price.toFixed(2)}</span>
                                {wine.varietal && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-300">{wine.varietal}</span>
                                  </>
                                )}
                                {wine.region && (
                                  <>
                                    <span>•</span>
                                    <span>{wine.region}</span>
                                  </>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 text-slate-400">
                                <EyeOff className="w-4 h-4 text-slate-500" />
                                <span className="italic text-slate-500">Hidden Blind Selection</span>
                              </div>
                              <div className="text-xs text-slate-400">
                                Logged by: <strong className="text-slate-200">{wine.submitted_by}</strong>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Edit & Delete actions (Host or wine owner - always visible on mobile) */}
                      {(isHost || isOwnWine) && (
                        <div className="flex items-center gap-1 shrink-0">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={savingEdit}
                                onClick={() => saveEditedWine(wine.id)}
                                aria-label={`Save changes for ${wine.name}`}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Save changes"
                              >
                                <Check className="w-4 h-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditingWine}
                                aria-label={`Cancel editing ${wine.name}`}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-850 rounded-lg transition-colors"
                                title="Cancel edit"
                              >
                                <X className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </>
                          ) : (
                            <>
                              {onUpdateWine && showDetails && (
                                <button
                                  type="button"
                                  onClick={() => startEditingWine(wine)}
                                  aria-label={`Edit ${wine.name}`}
                                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-amber-800 hover:bg-amber-50 rounded-lg opacity-100 transition-colors"
                                  title="Edit bottle details"
                                >
                                  <Edit2 className="w-4 h-4" aria-hidden="true" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setPendingDeleteWine(wine)}
                                aria-label={`Remove ${showDetails ? wine.name : `${wine.submitted_by}'s bottle`}`}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg opacity-100 transition-colors"
                                title="Delete wine"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Host actions to launch tasting */}
            {isHost && (
              <div className="mt-6 border-t border-slate-800 pt-6 space-y-4">
                <div className="bg-slate-850/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-100">Host Launch Pad</p>
                    <p className="text-xs text-slate-400">
                      {wines.length >= 1
                        ? `Ready to initiate! Place your ${wines.length} bottle${wines.length === 1 ? '' : 's'} into blind bags (A, B, C...) in random order. Once ready, click Start Tasting Session.`
                        : "Register at least 1 bottle to launch the tasting session."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onStartTasting}
                    disabled={wines.length < 1 || bulkLoading || isSubmitting || savingEdit}
                    className="min-h-[48px] py-2.5 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-[#1E1814] font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                  >
                    Start Tasting Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteWine)}
        tone="danger"
        title="Remove Bottle from Registry?"
        message={
          pendingDeleteWine
            ? `Remove ${isHost || pendingDeleteWine.submitted_by.toLowerCase() === voterName.toLowerCase() ? `"${pendingDeleteWine.name}"` : `${pendingDeleteWine.submitted_by}'s bottle`} from this session? This cannot be undone.`
            : ''
        }
        confirmLabel="Remove Bottle"
        busy={deletingWineId !== null}
        onConfirm={handleConfirmDeleteWine}
        onCancel={() => {
          if (deletingWineId === null) setPendingDeleteWine(null);
        }}
      />
    </div>
  );
}
