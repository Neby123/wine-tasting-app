import { useEffect, useId, useRef, useState } from 'react';
import type { BuyAgainIntent, PerceivedPriceTier, TastingDraft, Vote, Wine } from '../types/wine';
import {
  loadSessionDrafts,
  saveWineDraft,
  clearWineDraft,
  promoteAnonymousDrafts
} from '../utils/storage';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  DollarSign,
  Heart,
  Sliders,
  Edit3,
  Sparkles,
  UserCheck,
  AlertCircle,
  Save
} from 'lucide-react';

interface TastingSheetProps {
  sessionId?: string;
  wines: Wine[];
  voterName: string;
  votes: Vote[];
  onSubmitStandaloneRating: (
    wineLabel: string,
    score: number,
    notes?: string,
    extraMetrics?: {
      perceivedPrice?: PerceivedPriceTier;
      buyAgain?: BuyAgainIntent;
      acidity?: number;
      body?: number;
      sweetness?: number;
    }
  ) => Promise<void>;
  onUpdateVoterName?: (name: string) => void;
  onNotify?: (message: string, tone?: 'success' | 'error' | 'info') => void;
  sessionName?: string;
  sessionDate?: string;
}

const QUICK_TASTERS = ['Ben', 'Monica', 'Jack', 'Alexcia', 'David', 'Abby'];

export const getScoreVerdict = (score: number): string => {
  if (score <= 39) return 'Cooking Wine';
  if (score <= 54) return 'Table Pour';
  if (score <= 69) return 'Solid Sipper';
  if (score <= 84) return 'Crowd Pleaser';
  if (score <= 94) return "Sommelier's Pick ✨";
  return 'Hall of Fame 🏆';
};

const isSameVoter = (a?: string, b?: string) =>
  (a || '').trim().toLowerCase() !== '' &&
  (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

export default function TastingSheet({
  sessionId = 'active-session',
  wines,
  voterName,
  votes,
  onSubmitStandaloneRating,
  onUpdateVoterName,
  onNotify,
  sessionName,
  sessionDate
}: TastingSheetProps) {
  const headingIdBase = useId();
  const tasterPromptRef = useRef<HTMLDivElement>(null);
  const customNameInputRef = useRef<HTMLInputElement>(null);

  // Track which wine card accordions are expanded (default: ALL COLLAPSED)
  const [expandedLabels, setExpandedLabels] = useState<Record<string, boolean>>({});
  const [switchingTaster, setSwitchingTaster] = useState(false);
  const [customTasterName, setCustomTasterName] = useState('');
  const [nameAlert, setNameAlert] = useState('');

  // Local draft states for each wine evaluation card
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [perceivedPrices, setPerceivedPrices] = useState<Record<string, PerceivedPriceTier | undefined>>({});
  const [buyAgainIntents, setBuyAgainIntents] = useState<Record<string, BuyAgainIntent | undefined>>({});
  const [acidities, setAcidities] = useState<Record<string, number | undefined>>({});
  const [bodies, setBodies] = useState<Record<string, number | undefined>>({});
  const [sweetnesses, setSweetnesses] = useState<Record<string, number | undefined>>({});

  // Dirty-state & error tracking so polling never clobbers active edits
  const [dirtyLabels, setDirtyLabels] = useState<Record<string, boolean>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [savedNoticeLabel, setSavedNoticeLabel] = useState<string | null>(null);
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const prevContextRef = useRef({ sessionId, voterName });
  const dirtyRef = useRef(dirtyLabels);
  dirtyRef.current = dirtyLabels;

  // Hydrate drafts from localStorage + reconcile against Supabase votes without clobbering dirty edits
  useEffect(() => {
    const contextChanged =
      prevContextRef.current.sessionId !== sessionId ||
      prevContextRef.current.voterName !== voterName;

    const dbScores: Record<string, number> = {};
    const dbNotes: Record<string, string> = {};
    const dbPrices: Record<string, PerceivedPriceTier | undefined> = {};
    const dbBuyAgain: Record<string, BuyAgainIntent | undefined> = {};
    const dbAcidity: Record<string, number | undefined> = {};
    const dbBody: Record<string, number | undefined> = {};
    const dbSweetness: Record<string, number | undefined> = {};

    votes.forEach(v => {
      if (isSameVoter(v.voter_name, voterName)) {
        const label = v.wine_1_label;
        dbScores[label] = v.slider_value;
        dbNotes[label] = v.notes_wine_1 || '';
        dbPrices[label] = v.perceived_price_1;
        dbBuyAgain[label] = v.buy_again_1;
        dbAcidity[label] = v.acidity_1;
        dbBody[label] = v.body_1;
        dbSweetness[label] = v.sweetness_1;
      }
    });

    const storedDrafts = loadSessionDrafts(sessionId, voterName);

    if (contextChanged) {
      const wasUnnamed = !prevContextRef.current.voterName.trim();
      if (wasUnnamed && voterName.trim()) {
        promoteAnonymousDrafts(sessionId, voterName);
      }
      prevContextRef.current = { sessionId, voterName };
      setExpandedLabels(prev => (wasUnnamed ? prev : {}));
      setCardErrors({});
      setSavedNoticeLabel(null);
      setNameAlert('');

      const activeDrafts = loadSessionDrafts(sessionId, voterName);

      const initScores = { ...dbScores };
      const initNotes = { ...dbNotes };
      const initPrices = { ...dbPrices };
      const initBuyAgain = { ...dbBuyAgain };
      const initAcidity = { ...dbAcidity };
      const initBody = { ...dbBody };
      const initSweetness = { ...dbSweetness };
      const initDirty: Record<string, boolean> = {};

      Object.entries(activeDrafts).forEach(([label, draft]) => {
        initScores[label] = draft.score;
        initNotes[label] = draft.notes || '';
        initPrices[label] = draft.perceivedPrice;
        initBuyAgain[label] = draft.buyAgain;
        initAcidity[label] = draft.acidity;
        initBody[label] = draft.body;
        initSweetness[label] = draft.sweetness;
        initDirty[label] = true;
      });

      setScores(initScores);
      setNotes(initNotes);
      setPerceivedPrices(initPrices);
      setBuyAgainIntents(initBuyAgain);
      setAcidities(initAcidity);
      setBodies(initBody);
      setSweetnesses(initSweetness);
      setDirtyLabels(initDirty);
      return;
    }

    const currentDirty = dirtyRef.current;

    const mergeRecord = <T,>(
      prevMap: Record<string, T>,
      dbMap: Record<string, T>,
      pickDraft: (draft: TastingDraft) => T
    ): Record<string, T> => {
      const next: Record<string, T> = { ...dbMap };
      Object.keys(currentDirty).forEach(label => {
        if (currentDirty[label] && label in prevMap) {
          next[label] = prevMap[label];
        }
      });
      Object.entries(storedDrafts).forEach(([label, draft]) => {
        if (currentDirty[label] || !(label in next)) {
          next[label] = pickDraft(draft);
        }
      });
      return next;
    };

    setScores(prev => mergeRecord(prev, dbScores, d => d.score));
    setNotes(prev => mergeRecord(prev, dbNotes, d => d.notes || ''));
    setPerceivedPrices(prev => mergeRecord(prev, dbPrices, d => d.perceivedPrice));
    setBuyAgainIntents(prev => mergeRecord(prev, dbBuyAgain, d => d.buyAgain));
    setAcidities(prev => mergeRecord(prev, dbAcidity, d => d.acidity));
    setBodies(prev => mergeRecord(prev, dbBody, d => d.body));
    setSweetnesses(prev => mergeRecord(prev, dbSweetness, d => d.sweetness));

    if (Object.keys(storedDrafts).length > 0) {
      setDirtyLabels(prev => {
        const next = { ...prev };
        Object.keys(storedDrafts).forEach(lbl => {
          if (next[lbl] === undefined) next[lbl] = true;
        });
        return next;
      });
    }
  }, [votes, voterName, sessionId]);

  const bagLabels = Array.from({ length: wines.length || 6 }, (_, idx) => String.fromCharCode(65 + idx));
  const unsavedLabels = bagLabels.filter(label => Boolean(dirtyLabels[label]));

  // Warn guests before closing tab if unsaved local drafts remain
  useEffect(() => {
    if (unsavedLabels.length === 0) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedLabels.length]);

  const persistLabelDraft = (label: string, overrides: Partial<TastingDraft>) => {
    const existingVote = votes.find(
      v => isSameVoter(v.voter_name, voterName) && (v.wine_1_label === label || v.match_id === `STANDALONE_${label}`)
    );
    const nextDraft: TastingDraft = {
      score: overrides.score !== undefined ? overrides.score : (scores[label] ?? existingVote?.slider_value ?? 50),
      notes: overrides.notes !== undefined ? overrides.notes : notes[label],
      perceivedPrice: 'perceivedPrice' in overrides ? overrides.perceivedPrice : perceivedPrices[label],
      buyAgain: 'buyAgain' in overrides ? overrides.buyAgain : buyAgainIntents[label],
      acidity: 'acidity' in overrides ? overrides.acidity : acidities[label],
      body: 'body' in overrides ? overrides.body : bodies[label],
      sweetness: 'sweetness' in overrides ? overrides.sweetness : sweetnesses[label],
      updatedAt: Date.now()
    };

    setDirtyLabels(prev => ({ ...prev, [label]: true }));
    setCardErrors(prev => {
      if (!prev[label]) return prev;
      const next = { ...prev };
      delete next[label];
      return next;
    });
    if (savedNoticeLabel === label) setSavedNoticeLabel(null);
    saveWineDraft(sessionId, voterName, label, nextDraft);
  };

  const toggleAccordion = (label: string) => {
    setExpandedLabels(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const focusTasterPicker = (reason: string) => {
    setNameAlert(reason);
    onNotify?.(reason, 'error');
    if (typeof window !== 'undefined') {
      tasterPromptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      customNameInputRef.current?.focus();
    }
  };

  const saveSingleLabel = async (label: string, collapseAfterSave: boolean): Promise<boolean> => {
    if (!voterName.trim()) {
      const msg = 'Please select or enter your taster name at the top first.';
      setCardErrors(prev => ({ ...prev, [label]: msg }));
      focusTasterPicker(msg);
      return false;
    }

    const existingVote = votes.find(
      v => isSameVoter(v.voter_name, voterName) && (v.wine_1_label === label || v.match_id === `STANDALONE_${label}`)
    );
    const currentScore = scores[label] ?? existingVote?.slider_value ?? 50;

    setSavingLabel(label);
    setCardErrors(prev => {
      if (!prev[label]) return prev;
      const next = { ...prev };
      delete next[label];
      return next;
    });

    try {
      await onSubmitStandaloneRating(
        label,
        currentScore,
        notes[label]?.trim() || undefined,
        {
          perceivedPrice: perceivedPrices[label],
          buyAgain: buyAgainIntents[label],
          acidity: acidities[label],
          body: bodies[label],
          sweetness: sweetnesses[label]
        }
      );
      clearWineDraft(sessionId, voterName, label);
      setDirtyLabels(prev => {
        const next = { ...prev };
        delete next[label];
        return next;
      });
      setSavedNoticeLabel(label);
      if (collapseAfterSave) {
        setExpandedLabels(prev => ({ ...prev, [label]: false }));
      }
      onNotify?.(`Saved Wine ${label} (${currentScore}/100) for ${voterName.trim()}.`, 'success');
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : `Failed to save rating for Wine ${label}. Your draft is preserved locally — please retry.`;
      setCardErrors(prev => ({ ...prev, [label]: message }));
      onNotify?.(message, 'error');
      return false;
    } finally {
      setSavingLabel(null);
    }
  };

  const handleSaveAllUnsaved = async () => {
    if (unsavedLabels.length === 0 || savingAll) return;
    if (!voterName.trim()) {
      focusTasterPicker('Select or enter your taster name before saving unsaved drafts.');
      return;
    }
    setSavingAll(true);
    let savedCount = 0;
    let firstFailed: string | null = null;
    try {
      for (const label of [...unsavedLabels]) {
        const ok = await saveSingleLabel(label, false);
        if (ok) {
          savedCount++;
        } else if (!firstFailed) {
          firstFailed = label;
        }
      }
      if (firstFailed) {
        onNotify?.(
          `Saved ${savedCount} rating(s), but Wine ${firstFailed} failed — draft retained for retry.`,
          'error'
        );
      } else if (savedCount > 0) {
        onNotify?.(`All ${savedCount} unsaved wine rating${savedCount === 1 ? '' : 's'} saved to the database.`, 'success');
      }
    } finally {
      setSavingAll(false);
    }
  };

  const ratedWinesCount = bagLabels.filter(label =>
    votes.some(
      v => isSameVoter(v.voter_name, voterName) && (v.wine_1_label === label || v.match_id === `STANDALONE_${label}`)
    )
  ).length;

  const totalWinesCount = bagLabels.length;
  const progressPercent = totalWinesCount > 0 ? Math.round((ratedWinesCount / totalWinesCount) * 100) : 0;

  const handleSelectTaster = (selectedName: string) => {
    const trimmed = selectedName.trim();
    if (!trimmed || !onUpdateVoterName) return;
    onUpdateVoterName(trimmed);
    setSwitchingTaster(false);
    setCustomTasterName('');
    setNameAlert('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header Greeting Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center space-y-2 relative overflow-hidden bg-slate-900/80">
        <div className="absolute top-0 right-0 w-32 h-32 bg-wine-200/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-xs bg-wine-900 border border-wine-700 text-wine-200 font-mono px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
            Taster: <strong className="text-wine-100">{voterName || 'Unselected'}</strong>
          </span>
          {onUpdateVoterName && voterName.trim() && (
            <button
              type="button"
              onClick={() => setSwitchingTaster(s => !s)}
              className="touch-target px-2.5 py-1 text-xs font-semibold text-slate-400 hover:text-wine-200 underline underline-offset-2 transition-colors rounded-lg"
            >
              {switchingTaster ? 'Cancel' : 'Switch Taster'}
            </button>
          )}
        </div>
        <p className="text-[11px] font-mono font-semibold uppercase tracking-widest text-wine-300">
          Blind Tasting Sheet{sessionDate ? ` • ${sessionDate}` : ''}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold font-serif text-slate-100">
          {sessionName || 'Blind Tasting Sheet'}
        </h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Taste at your own pace. Expand any wine card below to log your rating and notes. Drafts stay backed up locally until saved.
        </p>

        {/* Progress Bar */}
        <div className="pt-2 flex items-center justify-between text-xs font-semibold text-slate-400 max-w-xs mx-auto">
          <span>Saved: {ratedWinesCount} of {totalWinesCount}</span>
          <span className="text-wine-300 font-mono font-bold">{progressPercent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tasting completion progress"
          className="w-full bg-slate-850 h-2 rounded-full overflow-hidden border border-slate-800 max-w-xs mx-auto"
        >
          <div
            className="bg-gradient-to-r from-[#821D35] to-amber-600 h-full transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Unsaved Drafts Sticky Banner */}
      {unsavedLabels.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl p-4 border border-amber-300 bg-amber-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-start gap-2.5 text-amber-950">
            <AlertCircle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs leading-relaxed">
              <strong className="font-bold">
                Unsaved drafts for Wine{unsavedLabels.length === 1 ? '' : 's'} {unsavedLabels.join(', ')}.
              </strong>{' '}
              Your edits are cached in this browser, but will not count in standings until saved to the database.
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveAllUnsaved}
            disabled={savingAll || savingLabel !== null}
            className="min-h-[44px] px-4 py-2 bg-[#6E172C] hover:bg-[#5A1425] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            {savingAll ? 'Saving All...' : `Save All Unsaved Ratings (${unsavedLabels.length})`}
          </button>
        </div>
      )}

      {/* Inline Taster Selection Prompt when voterName is missing or switching */}
      {(!voterName.trim() || switchingTaster) && (
        <div
          ref={tasterPromptRef}
          className="rounded-2xl p-5 border border-amber-300 bg-amber-50 space-y-3 shadow-sm"
        >
          <div className="flex items-center gap-2 text-amber-900 text-sm font-bold">
            <UserCheck className="w-4 h-4 text-amber-800" aria-hidden="true" />
            <span>{voterName.trim() ? 'Switch Active Taster' : 'Select Your Taster Name to Begin'}</span>
          </div>
          {nameAlert && (
            <p role="alert" className="text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-300 px-3 py-2 rounded-lg">
              {nameAlert}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {QUICK_TASTERS.map(nameOption => (
              <button
                key={nameOption}
                type="button"
                onClick={() => handleSelectTaster(nameOption)}
                className={`min-h-[44px] px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                  isSameVoter(voterName, nameOption)
                    ? 'bg-[#6E172C] text-white border-[#5A1425] shadow-sm'
                    : 'bg-white border-slate-800 text-slate-300 hover:bg-slate-850'
                }`}
              >
                {nameOption}
              </button>
            ))}
          </div>
          {onUpdateVoterName && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSelectTaster(customTasterName);
              }}
              className="flex flex-col sm:flex-row gap-2 pt-1"
            >
              <label htmlFor={`${headingIdBase}-custom-taster`} className="visually-hidden">
                Custom taster name
              </label>
              <input
                ref={customNameInputRef}
                id={`${headingIdBase}-custom-taster`}
                type="text"
                autoComplete="name"
                value={customTasterName}
                onChange={(e) => setCustomTasterName(e.target.value)}
                placeholder="Or enter a custom name..."
                className="flex-1 min-h-[44px] px-3 py-2 bg-white border border-slate-700 focus:border-[#821D35] rounded-lg text-base sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#821D35]"
              />
              <button
                type="submit"
                disabled={!customTasterName.trim()}
                className="min-h-[44px] px-4 py-2 bg-[#6E172C] hover:bg-[#5A1425] disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Set Name
              </button>
            </form>
          )}
        </div>
      )}

      {/* Accordion Cards for Wines */}
      <div className="space-y-3">
        {bagLabels.map((label) => {
          const isExpanded = !!expandedLabels[label];
          const isDirty = !!dirtyLabels[label];
          const cardError = cardErrors[label];
          const existingVote = votes.find(
            v => isSameVoter(v.voter_name, voterName) && (v.wine_1_label === label || v.match_id === `STANDALONE_${label}`)
          );
          const currentScore = scores[label] ?? (existingVote ? existingVote.slider_value : 50);

          const triggerId = `${headingIdBase}-trigger-${label}`;
          const panelId = `${headingIdBase}-panel-${label}`;
          const sliderId = `${headingIdBase}-slider-${label}`;
          const priceLegendId = `${headingIdBase}-price-${label}`;
          const buyAgainLegendId = `${headingIdBase}-buyagain-${label}`;
          const acidityLegendId = `${headingIdBase}-acidity-${label}`;
          const bodyLegendId = `${headingIdBase}-body-${label}`;
          const sweetnessLegendId = `${headingIdBase}-sweetness-${label}`;
          const notesId = `${headingIdBase}-notes-${label}`;

          return (
            <div
              key={label}
              className={`glass-panel rounded-2xl border transition-all duration-300 overflow-hidden ${
                cardError
                  ? 'border-rose-400 bg-rose-50/30 shadow-md'
                  : isDirty
                    ? 'border-amber-400 shadow-md bg-amber-50/35'
                    : isExpanded
                      ? 'border-wine-300/70 shadow-lg bg-white/95'
                      : existingVote
                        ? 'border-emerald-300/60 bg-emerald-50/40'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
              }`}
            >
              {/* WAI-ARIA Disclosure Header inside Heading */}
              <h3>
                <button
                  id={triggerId}
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => toggleAccordion(label)}
                  className="w-full min-h-[60px] p-4 flex items-center justify-between gap-2 text-left transition-colors hover:bg-slate-850/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold font-serif text-lg bg-[#6E172C] text-white shadow-sm ring-2 ring-[#F0CFD6] shrink-0">
                      {label}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-base font-bold text-slate-100 font-serif">Wine {label}</span>
                      <span className="block text-xs text-slate-500">
                        {isDirty
                          ? `Unsaved draft (${currentScore}/100)`
                          : existingVote
                            ? `Saved: ${existingVote.slider_value}/100`
                            : 'Not rated yet'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isDirty ? (
                      <span className="text-xs font-mono font-bold bg-amber-100 border border-amber-300 text-amber-950 px-2.5 py-1 rounded-full shadow-xs">
                        Unsaved draft
                      </span>
                    ) : existingVote ? (
                      <span className="text-xs font-mono font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" /> {existingVote.slider_value}/100
                      </span>
                    ) : savedNoticeLabel === label ? (
                      <span className="text-xs font-semibold text-emerald-800">Saved</span>
                    ) : null}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" aria-hidden="true" />
                    )}
                  </div>
                </button>
              </h3>

              {/* EXPANDED CONTENT AREA */}
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                hidden={!isExpanded}
                className="accordion-panel p-5 pt-3 border-t border-slate-800 space-y-6 bg-slate-950/70"
              >
                {isExpanded && (
                  <>
                    {/* OVERALL RATING SCORE SLIDER (REQUIRED) */}
                    <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-800 text-center shadow-xs">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <span className="text-rose-700 font-serif">Awful</span>
                        <label htmlFor={sliderId} className="text-slate-500 font-mono text-[10px]">
                          Wine {label} Score: 0 — 100 Scale (Required)
                        </label>
                        <span className="text-emerald-700 font-serif">Sheer Perfection</span>
                      </div>

                      <div className="relative py-2">
                        <input
                          id={sliderId}
                          type="range"
                          min="0"
                          max="100"
                          value={currentScore}
                          aria-valuetext={`${currentScore} out of 100 — ${getScoreVerdict(currentScore)}`}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setScores(prev => ({ ...prev, [label]: val }));
                            persistLabelDraft(label, { score: val });
                          }}
                          className="wine-slider"
                        />
                      </div>

                      <div className="inline-block bg-wine-900 border border-wine-700 px-6 py-2.5 rounded-xl text-center shadow-xs">
                        <p className="text-[10px] text-wine-200 font-bold uppercase tracking-wider">YOUR SCORE FOR WINE {label}</p>
                        <p className="text-3xl font-black font-mono text-wine-50">
                          {currentScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
                        </p>
                        <div className="mt-1.5 inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-serif font-semibold bg-white/90 border border-wine-700/60 text-[#5A1425] shadow-xs">
                          {getScoreVerdict(currentScore)}
                        </div>
                      </div>
                    </div>

                    {/* METRIC 1: PERCEIVED PRICE CATEGORY (OPTIONAL) */}
                    <div className="space-y-1.5 text-left" role="group" aria-labelledby={priceLegendId}>
                      <p id={priceLegendId} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-amber-700" aria-hidden="true" /> Perceived Price Category (Optional)
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: 'cheap', label: 'Cheap ($)' },
                          { id: 'mid', label: 'Mid ($$)' },
                          { id: 'expensive', label: 'Pricey ($$$)' }
                        ] as const).map(tier => {
                          const isSelected = perceivedPrices[label] === tier.id;
                          return (
                            <button
                              type="button"
                              key={tier.id}
                              aria-pressed={isSelected}
                              onClick={() => {
                                const nextVal = isSelected ? undefined : tier.id;
                                setPerceivedPrices(prev => ({ ...prev, [label]: nextVal }));
                                persistLabelDraft(label, { perceivedPrice: nextVal });
                              }}
                              className={`min-h-[44px] py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                                isSelected
                                  ? 'bg-[#6E172C] text-white border-[#5A1425] shadow-sm'
                                  : 'bg-white border-slate-800 text-slate-300 hover:bg-slate-850'
                              }`}
                            >
                              {tier.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* METRIC 2: BUY AGAIN INTENT (OPTIONAL) */}
                    <div className="space-y-1.5 text-left" role="group" aria-labelledby={buyAgainLegendId}>
                      <p id={buyAgainLegendId} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-700" aria-hidden="true" /> Buy Again Intent (Optional)
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: 'yes', label: '🍷 Yes!' },
                          { id: 'maybe', label: '🤔 Maybe' },
                          { id: 'no', label: '❌ Pass' }
                        ] as const).map(intent => {
                          const isSelected = buyAgainIntents[label] === intent.id;
                          return (
                            <button
                              type="button"
                              key={intent.id}
                              aria-pressed={isSelected}
                              onClick={() => {
                                const nextVal = isSelected ? undefined : intent.id;
                                setBuyAgainIntents(prev => ({ ...prev, [label]: nextVal }));
                                persistLabelDraft(label, { buyAgain: nextVal });
                              }}
                              className={`min-h-[44px] py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                                isSelected
                                  ? 'bg-[#6E172C] text-white border-[#5A1425] shadow-sm'
                                  : 'bg-white border-slate-800 text-slate-300 hover:bg-slate-850'
                              }`}
                            >
                              {intent.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* METRIC 3: 3-PILLAR SENSORY DNA (OPTIONAL 1-5 PICKERS) */}
                    <div className="space-y-3 pt-2 border-t border-slate-800 text-left">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Sliders className="w-3 h-3 text-wine-400" aria-hidden="true" /> Sensory DNA (Optional)
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono">1 to 5</span>
                      </div>

                      <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                        {/* Acidity 1-5 Buttons */}
                        <div className="space-y-1.5" role="group" aria-labelledby={acidityLegendId}>
                          <div className="flex justify-between items-center text-xs">
                            <span id={acidityLegendId} className="text-slate-200 font-medium">Acidity</span>
                            <span className="text-wine-300 font-mono font-bold">
                              {acidities[label] ? `${acidities[label]} / 5` : <span className="text-slate-500 font-normal italic">Optional</span>}
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {[1, 2, 3, 4, 5].map((num) => {
                              const isSelected = acidities[label] === num;
                              return (
                                <button
                                  key={num}
                                  type="button"
                                  aria-pressed={isSelected}
                                  aria-label={`Acidity ${num} out of 5`}
                                  onClick={() => {
                                    const nextVal = isSelected ? undefined : num;
                                    setAcidities(prev => ({ ...prev, [label]: nextVal }));
                                    persistLabelDraft(label, { acidity: nextVal });
                                  }}
                                  className={`min-h-[44px] py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                    isSelected
                                      ? 'bg-[#6E172C] text-white border-[#5A1425] shadow-sm scale-[1.02]'
                                      : 'bg-white border-slate-800 text-slate-300 hover:bg-slate-850'
                                  }`}
                                >
                                  {num}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 font-medium px-0.5">
                            <span>1 (Soft)</span>
                            <span>5 (Tart)</span>
                          </div>
                        </div>

                        {/* Body 1-5 Buttons */}
                        <div className="space-y-1.5" role="group" aria-labelledby={bodyLegendId}>
                          <div className="flex justify-between items-center text-xs">
                            <span id={bodyLegendId} className="text-slate-200 font-medium">Body</span>
                            <span className="text-wine-300 font-mono font-bold">
                              {bodies[label] ? `${bodies[label]} / 5` : <span className="text-slate-500 font-normal italic">Optional</span>}
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {[1, 2, 3, 4, 5].map((num) => {
                              const isSelected = bodies[label] === num;
                              return (
                                <button
                                  key={num}
                                  type="button"
                                  aria-pressed={isSelected}
                                  aria-label={`Body ${num} out of 5`}
                                  onClick={() => {
                                    const nextVal = isSelected ? undefined : num;
                                    setBodies(prev => ({ ...prev, [label]: nextVal }));
                                    persistLabelDraft(label, { body: nextVal });
                                  }}
                                  className={`min-h-[44px] py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                    isSelected
                                      ? 'bg-[#6E172C] text-white border-[#5A1425] shadow-sm scale-[1.02]'
                                      : 'bg-white border-slate-800 text-slate-300 hover:bg-slate-850'
                                  }`}
                                >
                                  {num}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 font-medium px-0.5">
                            <span>1 (Light)</span>
                            <span>5 (Full)</span>
                          </div>
                        </div>

                        {/* Sweetness 1-5 Buttons */}
                        <div className="space-y-1.5" role="group" aria-labelledby={sweetnessLegendId}>
                          <div className="flex justify-between items-center text-xs">
                            <span id={sweetnessLegendId} className="text-slate-200 font-medium">Sweetness</span>
                            <span className="text-wine-300 font-mono font-bold">
                              {sweetnesses[label] ? `${sweetnesses[label]} / 5` : <span className="text-slate-500 font-normal italic">Optional</span>}
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {[1, 2, 3, 4, 5].map((num) => {
                              const isSelected = sweetnesses[label] === num;
                              return (
                                <button
                                  key={num}
                                  type="button"
                                  aria-pressed={isSelected}
                                  aria-label={`Sweetness ${num} out of 5`}
                                  onClick={() => {
                                    const nextVal = isSelected ? undefined : num;
                                    setSweetnesses(prev => ({ ...prev, [label]: nextVal }));
                                    persistLabelDraft(label, { sweetness: nextVal });
                                  }}
                                  className={`min-h-[44px] py-1.5 text-xs font-bold rounded-lg border transition-all ${
                                    isSelected
                                      ? 'bg-[#6E172C] text-white border-[#5A1425] shadow-sm scale-[1.02]'
                                      : 'bg-white border-slate-800 text-slate-300 hover:bg-slate-850'
                                  }`}
                                >
                                  {num}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 font-medium px-0.5">
                            <span>1 (Bone Dry)</span>
                            <span>5 (Sweet)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* FREEFORM TASTING NOTES (OPTIONAL) */}
                    <div className="space-y-1 text-left pt-2 border-t border-slate-800">
                      <label htmlFor={notesId} className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" /> Tasting Notes (Optional)
                      </label>
                      <textarea
                        id={notesId}
                        rows={2}
                        placeholder="Aroma, flavor notes, finish..."
                        value={notes[label] || ''}
                        onChange={(e) => {
                          const nextNote = e.target.value;
                          setNotes(prev => ({ ...prev, [label]: nextNote }));
                          persistLabelDraft(label, { notes: nextNote });
                        }}
                        className="auto-grow w-full px-3 py-2 bg-white border border-slate-700 focus:border-[#821D35] rounded-xl text-slate-100 placeholder:text-slate-500 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#821D35]"
                      />
                    </div>

                    {cardError && (
                      <p role="alert" className="text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-300 px-3 py-2.5 rounded-xl flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" aria-hidden="true" />
                        <span>{cardError}</span>
                      </p>
                    )}

                    {/* SAVE RATING BUTTON */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => saveSingleLabel(label, true)}
                        disabled={savingLabel === label || savingAll}
                        className="w-full sm:w-auto min-h-[48px] py-2.5 px-6 bg-gradient-to-r from-[#821D35] to-[#5A1425] hover:from-[#6E172C] hover:to-[#3D0C17] disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-white font-semibold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                      >
                        {savingLabel === label ? 'Saving Rating...' : `Save Rating for Wine ${label}`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
