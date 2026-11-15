import React, { useState } from 'react';
import { Wine, Vote } from '../utils/mockData';
import { ChevronDown, ChevronUp, CheckCircle, DollarSign, Heart, Sliders, Edit3, Sparkles, UserCheck } from 'lucide-react';

interface TastingSheetProps {
  wines: Wine[];
  voterName: string;
  votes: Vote[];
  onSubmitStandaloneRating: (
    wineLabel: string,
    score: number,
    notes?: string,
    extraMetrics?: {
      perceivedPrice?: 'cheap' | 'mid' | 'expensive';
      buyAgain?: 'yes' | 'maybe' | 'no';
      acidity?: number;
      body?: number;
      sweetness?: number;
    }
  ) => Promise<void>;
  onUpdateVoterName?: (name: string) => void;
  sessionName?: string;
  sessionDate?: string;
}

const QUICK_TASTERS = ['Ben', 'Monica', 'Jack', 'Alexcia', 'David', 'Abby'];

export const getScoreVerdict = (score: number): string => {
  if (score <= 39) return "Cooking Wine";
  if (score <= 54) return "Table Pour";
  if (score <= 69) return "Solid Sipper";
  if (score <= 84) return "Crowd Pleaser";
  if (score <= 94) return "Sommelier's Pick ✨";
  return "Hall of Fame 🏆";
};

const isSameVoter = (a?: string, b?: string) =>
  (a || '').trim().toLowerCase() !== '' &&
  (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

export default function TastingSheet({
  wines,
  voterName,
  votes,
  onSubmitStandaloneRating,
  onUpdateVoterName,
  sessionName,
  sessionDate
}: TastingSheetProps) {
  // Track which wine card accordions are expanded (default: ALL COLLAPSED)
  const [expandedLabels, setExpandedLabels] = useState<Record<string, boolean>>({});
  const [switchingTaster, setSwitchingTaster] = useState(false);
  const [customTasterName, setCustomTasterName] = useState('');

  // Local draft states for each wine evaluation card
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [perceivedPrices, setPerceivedPrices] = useState<Record<string, 'cheap' | 'mid' | 'expensive' | undefined>>({});
  const [buyAgainIntents, setBuyAgainIntents] = useState<Record<string, 'yes' | 'maybe' | 'no' | undefined>>({});
  const [acidities, setAcidities] = useState<Record<string, number | undefined>>({});
  const [bodies, setBodies] = useState<Record<string, number | undefined>>({});
  const [sweetnesses, setSweetnesses] = useState<Record<string, number | undefined>>({});
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const prevVoterRef = React.useRef(voterName);

  // Initialize draft states from existing votes if present
  React.useEffect(() => {
    const newScores: Record<string, number> = {};
    const newNotes: Record<string, string> = {};
    const newPrices: Record<string, 'cheap' | 'mid' | 'expensive' | undefined> = {};
    const newBuyAgain: Record<string, 'yes' | 'maybe' | 'no' | undefined> = {};
    const newAcidity: Record<string, number | undefined> = {};
    const newBody: Record<string, number | undefined> = {};
    const newSweetness: Record<string, number | undefined> = {};

    votes.forEach(v => {
      if (isSameVoter(v.voter_name, voterName)) {
        const label = v.wine_1_label;
        newScores[label] = v.slider_value;
        newNotes[label] = v.notes_wine_1 || '';
        newPrices[label] = v.perceived_price_1;
        newBuyAgain[label] = v.buy_again_1;
        newAcidity[label] = v.acidity_1;
        newBody[label] = v.body_1;
        newSweetness[label] = v.sweetness_1;
      }
    });

    if (prevVoterRef.current !== voterName) {
      prevVoterRef.current = voterName;
      setExpandedLabels({});
      setScores(newScores);
      setNotes(newNotes);
      setPerceivedPrices(newPrices);
      setBuyAgainIntents(newBuyAgain);
      setAcidities(newAcidity);
      setBodies(newBody);
      setSweetnesses(newSweetness);
      return;
    }

    setScores(prev => ({ ...newScores, ...prev }));
    setNotes(prev => ({ ...newNotes, ...prev }));
    setPerceivedPrices(prev => ({ ...newPrices, ...prev }));
    setBuyAgainIntents(prev => ({ ...newBuyAgain, ...prev }));
    setAcidities(prev => ({ ...newAcidity, ...prev }));
    setBodies(prev => ({ ...newBody, ...prev }));
    setSweetnesses(prev => ({ ...newSweetness, ...prev }));
  }, [votes, voterName]);

  const toggleAccordion = (label: string) => {
    setExpandedLabels(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const handleSaveWineRating = async (label: string) => {
    if (!voterName.trim()) {
      alert('Please select or enter your taster name at the top first.');
      return;
    }
    const currentScore = scores[label] ?? 50;
    setSavingLabel(label);
    try {
      await onSubmitStandaloneRating(
        label,
        currentScore,
        notes[label] || undefined,
        {
          perceivedPrice: perceivedPrices[label],
          buyAgain: buyAgainIntents[label],
          acidity: acidities[label],
          body: bodies[label],
          sweetness: sweetnesses[label]
        }
      );
      // Auto collapse on successful save
      setExpandedLabels(prev => ({ ...prev, [label]: false }));
    } catch (err) {
      console.error(`Failed to save rating for Wine ${label}:`, err);
      alert(`Failed to save rating for Wine ${label}. Please try again.`);
    } finally {
      setSavingLabel(null);
    }
  };

  const bagLabels = Array.from({ length: wines.length || 6 }, (_, idx) => String.fromCharCode(65 + idx));

  // Calculate personal leaderboard from scores
  const ratedWinesCount = bagLabels.filter((label) => {
    return votes.some(v => 
      isSameVoter(v.voter_name, voterName) && 
      (v.wine_1_label === label || v.match_id === `STANDALONE_${label}`)
    );
  }).length;

  const totalWinesCount = bagLabels.length;
  const progressPercent = Math.round((ratedWinesCount / totalWinesCount) * 100);

  const handleSelectTaster = (selectedName: string) => {
    const trimmed = selectedName.trim();
    if (!trimmed || !onUpdateVoterName) return;
    onUpdateVoterName(trimmed);
    setSwitchingTaster(false);
    setCustomTasterName('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header Greeting Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center space-y-2 relative overflow-hidden bg-slate-900/80">
        <div className="absolute top-0 right-0 w-32 h-32 bg-wine-200/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-xs bg-wine-900 border border-wine-700 text-wine-200 font-mono px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Taster: <strong className="text-wine-100">{voterName || 'Unselected'}</strong>
          </span>
          {onUpdateVoterName && voterName.trim() && (
            <button
              type="button"
              onClick={() => setSwitchingTaster(s => !s)}
              className="text-[11px] text-slate-400 hover:text-wine-200 underline underline-offset-2 transition-colors"
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
          Taste at your own pace. Expand any wine card below to log your rating and notes.
        </p>

        {/* Progress Bar */}
        <div className="pt-2 flex items-center justify-between text-xs font-semibold text-slate-400 max-w-xs mx-auto">
          <span>Completed: {ratedWinesCount} of {totalWinesCount}</span>
          <span className="text-wine-300 font-mono font-bold">{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden border border-slate-800 max-w-xs mx-auto">
          <div 
            className="bg-gradient-to-r from-[#821D35] to-amber-600 h-full transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Inline Taster Selection Prompt when voterName is missing or switching */}
      {(!voterName.trim() || switchingTaster) && (
        <div className="rounded-2xl p-5 border border-amber-300 bg-amber-50 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-amber-900 text-sm font-bold">
            <UserCheck className="w-4 h-4 text-amber-800" />
            <span>{voterName.trim() ? 'Switch Active Taster' : 'Select Your Taster Name to Begin'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_TASTERS.map(nameOption => (
              <button
                key={nameOption}
                type="button"
                onClick={() => handleSelectTaster(nameOption)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
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
              className="flex gap-2 pt-1"
            >
              <input
                type="text"
                value={customTasterName}
                onChange={(e) => setCustomTasterName(e.target.value)}
                placeholder="Or enter a custom name..."
                className="flex-1 px-3 py-1.5 bg-white border border-slate-700 focus:border-[#821D35] rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#821D35]"
              />
              <button
                type="submit"
                disabled={!customTasterName.trim()}
                className="px-4 py-1.5 bg-[#6E172C] hover:bg-[#5A1425] disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Set Name
              </button>
            </form>
          )}
        </div>
      )}

      {/* Accordion Cards for Wines (A through F) */}
      <div className="space-y-3">
        {bagLabels.map((label) => {
          const isExpanded = !!expandedLabels[label];
          
          // Check if this wine has been rated
          const existingVote = votes.find(v => isSameVoter(v.voter_name, voterName) && (v.wine_1_label === label || v.match_id === `STANDALONE_${label}`));
          const currentScore = scores[label] ?? (existingVote ? existingVote.slider_value : 50);

          return (
            <div 
              key={label}
              className={`glass-panel rounded-2xl border transition-all duration-300 overflow-hidden ${
                isExpanded 
                  ? 'border-wine-300/70 shadow-lg bg-white/95' 
                  : existingVote 
                    ? 'border-emerald-300/60 bg-emerald-50/40' 
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
              }`}
            >
              {/* COLLAPSED HEADER BAR (Tappable to expand/collapse) */}
              <button
                type="button"
                onClick={() => toggleAccordion(label)}
                className="w-full p-4 flex items-center justify-between text-left transition-colors hover:bg-slate-850/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold font-serif text-lg bg-[#6E172C] text-white shadow-sm ring-2 ring-[#F0CFD6]">
                    {label}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 font-serif">Wine {label}</h3>
                    <p className="text-xs text-slate-500">
                      {existingVote ? `Rated: ${existingVote.slider_value}/100` : 'Not rated yet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {existingVote && (
                    <span className="text-xs font-mono font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-700" /> {existingVote.slider_value}/100
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {/* EXPANDED CONTENT AREA */}
              {isExpanded && (
                <div className="p-5 pt-3 border-t border-slate-800 space-y-6 bg-slate-950/70 animate-fade-in">
                  
                  {/* OVERALL RATING SCORE SLIDER (REQUIRED) */}
                  <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-800 text-center shadow-xs">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <span className="text-rose-700 font-serif">Awful</span>
                      <span className="text-slate-500 font-mono text-[10px]">0 — 100 Scale (Required)</span>
                      <span className="text-emerald-700 font-serif">Sheer Perfection</span>
                    </div>

                    <div className="relative pt-2 pb-1">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentScore}
                        onChange={(e) => setScores(prev => ({ ...prev, [label]: parseInt(e.target.value) }))}
                        className="wine-slider"
                      />
                    </div>

                    {/* Numeric Score Indicator & Playful Verdict */}
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
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-amber-700" /> Perceived Price Category (Optional)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'cheap', label: 'Cheap ($)' },
                        { id: 'mid', label: 'Mid ($$)' },
                        { id: 'expensive', label: 'Pricey ($$$)' }
                      ].map(tier => (
                        <button
                          type="button"
                          key={tier.id}
                          onClick={() => setPerceivedPrices(prev => ({ ...prev, [label]: prev[label] === tier.id ? undefined : tier.id as any }))}
                          className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                            perceivedPrices[label] === tier.id
                              ? 'bg-[#6E172C] text-white border-[#5A1425] shadow-sm'
                              : 'bg-white border-slate-800 text-slate-300 hover:bg-slate-850'
                          }`}
                        >
                          {tier.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* METRIC 2: BUY AGAIN INTENT (OPTIONAL) */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Heart className="w-3 h-3 text-rose-700" /> Buy Again Intent (Optional)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'yes', label: '🍷 Yes!' },
                        { id: 'maybe', label: '🤔 Maybe' },
                        { id: 'no', label: '❌ Pass' }
                      ].map(intent => (
                        <button
                          type="button"
                          key={intent.id}
                          onClick={() => setBuyAgainIntents(prev => ({ ...prev, [label]: prev[label] === intent.id ? undefined : intent.id as any }))}
                          className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                            buyAgainIntents[label] === intent.id
                              ? 'bg-[#6E172C] text-white border-[#5A1425] shadow-sm'
                              : 'bg-white border-slate-800 text-slate-300 hover:bg-slate-850'
                          }`}
                        >
                          {intent.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* METRIC 3: 3-PILLAR SENSORY DNA (OPTIONAL 1-5 PICKERS) */}
                  <div className="space-y-3 pt-2 border-t border-slate-800 text-left">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Sliders className="w-3 h-3 text-wine-400" /> Sensory DNA (Optional)
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">1 to 5</span>
                    </div>

                    <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                      {/* Acidity 1-5 Buttons */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-200 font-medium">Acidity</span>
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
                                onClick={() => setAcidities(prev => ({ ...prev, [label]: isSelected ? undefined : num }))}
                                className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
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
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-200 font-medium">Body</span>
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
                                onClick={() => setBodies(prev => ({ ...prev, [label]: isSelected ? undefined : num }))}
                                className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
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
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-200 font-medium">Sweetness</span>
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
                                onClick={() => setSweetnesses(prev => ({ ...prev, [label]: isSelected ? undefined : num }))}
                                className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
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
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" /> Tasting Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Aroma, flavor notes, finish..."
                      value={notes[label] || ''}
                      onChange={(e) => setNotes(prev => ({ ...prev, [label]: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-slate-700 focus:border-[#821D35] rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#821D35] resize-none"
                    />
                  </div>

                  {/* SAVE RATING BUTTON */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSaveWineRating(label)}
                      disabled={savingLabel === label || !voterName.trim()}
                      className="w-full sm:w-auto py-2.5 px-6 bg-gradient-to-r from-[#821D35] to-[#5A1425] hover:from-[#6E172C] hover:to-[#3D0C17] disabled:from-slate-800 disabled:to-slate-850 disabled:text-slate-500 text-white font-semibold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      {savingLabel === label ? 'Saving Rating...' : `Save Rating for Wine ${label}`}
                    </button>
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
