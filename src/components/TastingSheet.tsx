import React, { useState } from 'react';
import { Wine, Vote } from '../utils/mockData';
import { ChevronDown, ChevronUp, CheckCircle, DollarSign, Heart, Sliders, Edit3, Sparkles } from 'lucide-react';

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
}

export default function TastingSheet({
  wines,
  voterName,
  votes,
  onSubmitStandaloneRating
}: TastingSheetProps) {
  // Track which wine card accordions are expanded (default: ALL COLLAPSED)
  const [expandedLabels, setExpandedLabels] = useState<Record<string, boolean>>({});

  // Local draft states for each wine evaluation card
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [perceivedPrices, setPerceivedPrices] = useState<Record<string, 'cheap' | 'mid' | 'expensive' | undefined>>({});
  const [buyAgainIntents, setBuyAgainIntents] = useState<Record<string, 'yes' | 'maybe' | 'no' | undefined>>({});
  const [acidities, setAcidities] = useState<Record<string, number | undefined>>({});
  const [bodies, setBodies] = useState<Record<string, number | undefined>>({});
  const [sweetnesses, setSweetnesses] = useState<Record<string, number | undefined>>({});
  const [savingLabel, setSavingLabel] = useState<string | null>(null);

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
      if (v.voter_name === voterName) {
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

  // Calculate personal leaderboard from scores
  const ratedWinesCount = wines.filter(w => {
    const label = w.blind_label || w.id;
    return votes.some(v => v.voter_name === voterName && (v.wine_1_label === label || v.match_id === `STANDALONE_${label}`));
  }).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header Greeting Banner */}
      <div className="glass-panel p-6 rounded-2xl border-wine-800/30 text-center space-y-2 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-wine-500/10 rounded-full blur-3xl" />
        <span className="text-xs bg-wine-950/60 border border-wine-800/40 text-wine-300 font-mono px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Taster: <strong>{voterName}</strong>
        </span>
        <h2 className="text-2xl font-bold font-serif text-slate-100">Blind Tasting Sheet</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Taste at your own pace. Expand any wine card below to log your rating and notes.
        </p>

        {/* Progress Bar */}
        <div className="pt-2 flex items-center justify-between text-xs font-semibold text-slate-400 max-w-xs mx-auto">
          <span>Completed: {ratedWinesCount} of {wines.length}</span>
          <span className="text-wine-300 font-mono">{Math.round((ratedWinesCount / (wines.length || 1)) * 100)}%</span>
        </div>
        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800 max-w-xs mx-auto">
          <div 
            className="bg-gradient-to-r from-wine-600 to-amber-500 h-full transition-all duration-500 rounded-full"
            style={{ width: `${(ratedWinesCount / (wines.length || 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Accordion Cards for Wines (A through F) */}
      <div className="space-y-3">
        {wines.map((wine, idx) => {
          const label = wine.blind_label || String.fromCharCode(65 + idx);
          const isExpanded = !!expandedLabels[label];
          
          // Check if this wine has been rated
          const existingVote = votes.find(v => v.voter_name === voterName && (v.wine_1_label === label || v.match_id === `STANDALONE_${label}`));
          const currentScore = scores[label] ?? (existingVote ? existingVote.slider_value : 50);

          return (
            <div 
              key={wine.id || label}
              className={`glass-panel rounded-2xl border transition-all duration-300 overflow-hidden ${
                isExpanded 
                  ? 'border-wine-500/50 shadow-xl shadow-wine-950/20' 
                  : existingVote 
                    ? 'border-emerald-900/40 bg-emerald-950/10' 
                    : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* COLLAPSED HEADER BAR (Tappable to expand/collapse) */}
              <button
                type="button"
                onClick={() => toggleAccordion(label)}
                className="w-full p-4 flex items-center justify-between text-left transition-colors hover:bg-slate-900/40"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold font-serif text-lg ${
                    existingVote ? 'bg-wine-700 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {label}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-200 font-serif">Wine {label}</h3>
                    <p className="text-xs text-slate-500">
                      {existingVote ? `Rated: ${existingVote.slider_value}/100` : 'Not rated yet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {existingVote && (
                    <span className="text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> {existingVote.slider_value}/100
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
                <div className="p-5 pt-2 border-t border-slate-850/80 space-y-6 bg-slate-950/40 animate-fade-in">
                  
                  {/* OVERALL RATING SCORE SLIDER (REQUIRED) */}
                  <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-300 uppercase tracking-wider">
                      <span className="text-rose-400 font-serif">Awful</span>
                      <span className="text-slate-400 font-mono text-[10px]">0 — 100 Scale (Required)</span>
                      <span className="text-emerald-400 font-serif">Sheer Perfection</span>
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

                    {/* Numeric Score Indicator */}
                    <div className="inline-block bg-wine-950/80 border border-wine-800/60 px-6 py-2 rounded-xl text-center">
                      <p className="text-[10px] text-wine-300 font-bold uppercase tracking-wider">YOUR SCORE FOR WINE {label}</p>
                      <p className="text-2xl font-black font-mono text-white">
                        {currentScore} <span className="text-xs font-normal text-slate-400">/ 100</span>
                      </p>
                    </div>
                  </div>

                  {/* METRIC 1: PERCEIVED PRICE CATEGORY (OPTIONAL) */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-amber-400" /> Perceived Price Category (Optional)
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
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
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
                      <Heart className="w-3 h-3 text-rose-400" /> Buy Again Intent (Optional)
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
                              ? intent.id === 'yes'
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                                : intent.id === 'maybe'
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                : 'bg-rose-500/20 border-rose-400 text-rose-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {intent.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* METRIC 3: 3-PILLAR SENSORY DNA (OPTIONAL SMOOTH SLIDERS) */}
                  <div className="space-y-3 pt-2 border-t border-slate-850 text-left">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Sliders className="w-3 h-3 text-wine-400" /> Sensory DNA (Optional Sliders)
                      </label>
                      <span className="text-[10px] text-slate-500">1 to 5</span>
                    </div>

                    <div className="space-y-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                      {/* Acidity Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-medium">Acidity (Soft → Tart)</span>
                          <span className="text-wine-300 font-mono font-bold">
                            {acidities[label] ? `${acidities[label]}/5` : 'Not Set'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={acidities[label] || 3}
                          onChange={(e) => setAcidities(prev => ({ ...prev, [label]: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-wine-500"
                        />
                      </div>

                      {/* Body Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-medium">Body (Light → Full)</span>
                          <span className="text-wine-300 font-mono font-bold">
                            {bodies[label] ? `${bodies[label]}/5` : 'Not Set'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={bodies[label] || 3}
                          onChange={(e) => setBodies(prev => ({ ...prev, [label]: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-wine-500"
                        />
                      </div>

                      {/* Sweetness Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300 font-medium">Sweetness (Dry → Sweet)</span>
                          <span className="text-wine-300 font-mono font-bold">
                            {sweetnesses[label] ? `${sweetnesses[label]}/5` : 'Not Set'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={sweetnesses[label] || 3}
                          onChange={(e) => setSweetnesses(prev => ({ ...prev, [label]: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-wine-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* FREEFORM TASTING NOTES (OPTIONAL) */}
                  <div className="space-y-1 text-left pt-2 border-t border-slate-850">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" /> Tasting Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Aroma, flavor notes, finish..."
                      value={notes[label] || ''}
                      onChange={(e) => setNotes(prev => ({ ...prev, [label]: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-wine-500 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500 resize-none"
                    />
                  </div>

                  {/* SAVE RATING BUTTON */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSaveWineRating(label)}
                      disabled={savingLabel === label}
                      className="w-full sm:w-auto py-2.5 px-6 bg-gradient-to-r from-wine-800 to-wine-600 hover:from-wine-700 hover:to-wine-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-wine-950/20 transition-all flex items-center justify-center gap-2"
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
