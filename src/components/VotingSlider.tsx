import React, { useState, useEffect } from 'react';
import { Vote } from '../utils/mockData';
import { ChevronLeft, ChevronRight, ThumbsUp, Scale, Edit3, AlertCircle } from 'lucide-react';

interface VotingSliderProps {
  matchId: string;
  wine1Label: string;
  wine2Label: string;
  voterName: string;
  existingVote?: Vote;
  onSubmitVote: (
    sliderValue: number,
    notes1: string,
    notes2: string,
    extraMetrics?: {
      perceived_price_1?: 'cheap' | 'mid' | 'expensive';
      perceived_price_2?: 'cheap' | 'mid' | 'expensive';
      buy_again_1?: 'yes' | 'maybe' | 'no';
      buy_again_2?: 'yes' | 'maybe' | 'no';
      acidity_1?: number;
      acidity_2?: number;
      body_1?: number;
      body_2?: number;
      sweetness_1?: number;
      sweetness_2?: number;
    }
  ) => Promise<void>;
  onBackToBracket: () => void;
}

export default function VotingSlider({
  matchId,
  wine1Label,
  wine2Label,
  voterName,
  existingVote,
  onSubmitVote,
  onBackToBracket
}: VotingSliderProps) {
  const [sliderVal, setSliderVal] = useState(50);
  const [notes1, setNotes1] = useState('');
  const [notes2, setNotes2] = useState('');

  // Metrics 1-3
  const [perceivedPrice1, setPerceivedPrice1] = useState<'cheap' | 'mid' | 'expensive' | undefined>(undefined);
  const [perceivedPrice2, setPerceivedPrice2] = useState<'cheap' | 'mid' | 'expensive' | undefined>(undefined);
  const [buyAgain1, setBuyAgain1] = useState<'yes' | 'maybe' | 'no' | undefined>(undefined);
  const [buyAgain2, setBuyAgain2] = useState<'yes' | 'maybe' | 'no' | undefined>(undefined);
  const [acidity1, setAcidity1] = useState<number | undefined>(undefined);
  const [acidity2, setAcidity2] = useState<number | undefined>(undefined);
  const [body1, setBody1] = useState<number | undefined>(undefined);
  const [body2, setBody2] = useState<number | undefined>(undefined);
  const [sweetness1, setSweetness1] = useState<number | undefined>(undefined);
  const [sweetness2, setSweetness2] = useState<number | undefined>(undefined);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Initialize form with existing vote if available
  useEffect(() => {
    if (existingVote) {
      setSliderVal(existingVote.slider_value);
      setNotes1(existingVote.notes_wine_1 || '');
      setNotes2(existingVote.notes_wine_2 || '');
      setPerceivedPrice1(existingVote.perceived_price_1);
      setPerceivedPrice2(existingVote.perceived_price_2);
      setBuyAgain1(existingVote.buy_again_1);
      setBuyAgain2(existingVote.buy_again_2);
      setAcidity1(existingVote.acidity_1);
      setAcidity2(existingVote.acidity_2);
      setBody1(existingVote.body_1);
      setBody2(existingVote.body_2);
      setSweetness1(existingVote.sweetness_1);
      setSweetness2(existingVote.sweetness_2);
    } else {
      setSliderVal(50);
      setNotes1(''); setNotes2('');
      setPerceivedPrice1(undefined); setPerceivedPrice2(undefined);
      setBuyAgain1(undefined); setBuyAgain2(undefined);
      setAcidity1(undefined); setAcidity2(undefined);
      setBody1(undefined); setBody2(undefined);
      setSweetness1(undefined); setSweetness2(undefined);
    }
    setSuccess(false);
  }, [existingVote, matchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmitVote(sliderVal, notes1, notes2, {
        perceived_price_1: perceivedPrice1,
        perceived_price_2: perceivedPrice2,
        buy_again_1: buyAgain1,
        buy_again_2: buyAgain2,
        acidity_1: acidity1,
        acidity_2: acidity2,
        body_1: body1,
        body_2: body2,
        sweetness_1: sweetness1,
        sweetness_2: sweetness2
      });
      setSuccess(true);
      setTimeout(() => {
        onBackToBracket();
      }, 1200);
    } catch (err) {
      console.error("Failed to submit vote:", err);
      alert("Failed to submit vote. Please try again: " + (err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get description of preference
  const getPreferenceText = () => {
    if (sliderVal === 50) return { text: "Dead Even Tie", color: "text-slate-400" };
    if (sliderVal < 50) {
      const margin = 50 - sliderVal;
      if (margin <= 15) return { text: `Slight preference for Wine ${wine1Label}`, color: "text-wine-300" };
      if (margin <= 35) return { text: `Strong preference for Wine ${wine1Label}`, color: "text-wine-400 font-semibold" };
      return { text: `Absolute victory for Wine ${wine1Label}!`, color: "text-wine-500 font-extrabold uppercase tracking-wide" };
    } else {
      const margin = sliderVal - 50;
      if (margin <= 15) return { text: `Slight preference for Wine ${wine2Label}`, color: "text-wine-300" };
      if (margin <= 35) return { text: `Strong preference for Wine ${wine2Label}`, color: "text-wine-400 font-semibold" };
      return { text: `Absolute victory for Wine ${wine2Label}!`, color: "text-wine-500 font-extrabold uppercase tracking-wide" };
    }
  };

  const pref = getPreferenceText();

  // Opacities for the card glow highlight
  const wine1Weight = (100 - sliderVal) / 100;
  const wine2Weight = sliderVal / 100;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Header Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={onBackToBracket}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Bracket
        </button>
        <span className="text-xs bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-slate-400 font-mono">
          Voter: <strong className="text-slate-200 font-sans">{voterName}</strong>
        </span>
      </div>

      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-serif text-wine-100">Blind Tasting Matchup</h2>
        <p className="text-xs text-slate-500 uppercase tracking-widest">Match: {matchId}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Dynamic Side-by-Side Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Wine 1 Card */}
          <div 
            className="glass-panel rounded-2xl p-6 transition-all duration-300 relative overflow-hidden"
            style={{
              borderColor: `rgba(135, 28, 54, ${wine1Weight * 0.8})`,
              boxShadow: `0 10px 30px -10px rgba(135, 28, 54, ${wine1Weight * 0.3})`,
              transform: `scale(${0.98 + (wine1Weight * 0.04)})`
            }}
          >
            <div className="absolute -top-12 -left-12 w-24 h-24 rounded-full bg-wine-950/20 blur-2xl" />
            <div className="relative flex flex-col items-center text-center space-y-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black font-serif transition-colors"
                style={{
                  backgroundColor: wine1Weight > 0.5 ? '#871c36' : '#1e293b',
                  color: wine1Weight > 0.5 ? '#ffffff' : '#94a3b8'
                }}
              >
                {wine1Label}
              </div>
              <h3 className="text-xl font-bold text-slate-200 font-serif">Wine {wine1Label}</h3>
              
              {/* Metric 1: Perceived Price Category */}
              <div className="w-full space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Perceived Price Category</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'cheap', label: 'Cheap ($)' },
                    { id: 'mid', label: 'Mid ($$)' },
                    { id: 'expensive', label: 'Pricey ($$$)' }
                  ].map(tier => (
                    <button
                      type="button"
                      key={tier.id}
                      onClick={() => setPerceivedPrice1(perceivedPrice1 === tier.id ? undefined : tier.id as any)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        perceivedPrice1 === tier.id
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metric 2: Buy-Again Intent */}
              <div className="w-full space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Buy Again Intent</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'yes', label: '🍷 Yes!' },
                    { id: 'maybe', label: '🤔 Maybe' },
                    { id: 'no', label: '❌ Pass' }
                  ].map(intent => (
                    <button
                      type="button"
                      key={intent.id}
                      onClick={() => setBuyAgain1(buyAgain1 === intent.id ? undefined : intent.id as any)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        buyAgain1 === intent.id
                          ? intent.id === 'yes'
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : intent.id === 'maybe'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-rose-500/20 border-rose-400 text-rose-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {intent.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metric 3: 3-Pillar Sensory DNA (Smooth Sliders - Optional) */}
              <div className="w-full space-y-3 pt-3 border-t border-slate-850 text-left">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sensory DNA (Optional Sliders)</label>
                  <span className="text-[10px] text-slate-500">Slide 1-5</span>
                </div>

                <div className="space-y-3 bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                  {/* Acidity Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Acidity (Soft → Tart)</span>
                      <span className="text-wine-300 font-mono font-bold">{acidity1 ? `${acidity1}/5` : 'Not Set'}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={acidity1 || 3}
                      onChange={(e) => setAcidity1(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-wine-500"
                    />
                  </div>

                  {/* Body Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Body (Light → Full)</span>
                      <span className="text-wine-300 font-mono font-bold">{body1 ? `${body1}/5` : 'Not Set'}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={body1 || 3}
                      onChange={(e) => setBody1(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-wine-500"
                    />
                  </div>

                  {/* Sweetness Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Sweetness (Dry → Sweet)</span>
                      <span className="text-wine-300 font-mono font-bold">{sweetness1 ? `${sweetness1}/5` : 'Not Set'}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={sweetness1 || 3}
                      onChange={(e) => setSweetness1(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-wine-500"
                    />
                  </div>
                </div>
              </div>

              <div className="w-full space-y-1 text-left pt-2 border-t border-slate-850">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Tasting Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Aroma, flavor, body, finish..."
                  value={notes1}
                  onChange={(e) => setNotes1(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500 resize-none"
                />
              </div>

              {wine1Weight > 0.5 && (
                <div className="text-xs bg-wine-950/40 text-wine-300 px-3 py-1 rounded-full border border-wine-900/30 flex items-center gap-1">
                  <ThumbsUp className="w-3 h-3" /> Leaning Choice
                </div>
              )}
            </div>
          </div>

          {/* Wine 2 Card */}
          <div 
            className="glass-panel rounded-2xl p-6 transition-all duration-300 relative overflow-hidden"
            style={{
              borderColor: `rgba(135, 28, 54, ${wine2Weight * 0.8})`,
              boxShadow: `0 10px 30px -10px rgba(135, 28, 54, ${wine2Weight * 0.3})`,
              transform: `scale(${0.98 + (wine2Weight * 0.04)})`
            }}
          >
            <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-wine-950/20 blur-2xl" />
            <div className="relative flex flex-col items-center text-center space-y-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black font-serif transition-colors"
                style={{
                  backgroundColor: wine2Weight > 0.5 ? '#871c36' : '#1e293b',
                  color: wine2Weight > 0.5 ? '#ffffff' : '#94a3b8'
                }}
              >
                {wine2Label}
              </div>
              <h3 className="text-xl font-bold text-slate-200 font-serif">Wine {wine2Label}</h3>

              {/* Metric 1: Perceived Price Category */}
              <div className="w-full space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Perceived Price Category</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'cheap', label: 'Cheap ($)' },
                    { id: 'mid', label: 'Mid ($$)' },
                    { id: 'expensive', label: 'Pricey ($$$)' }
                  ].map(tier => (
                    <button
                      type="button"
                      key={tier.id}
                      onClick={() => setPerceivedPrice2(perceivedPrice2 === tier.id ? undefined : tier.id as any)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        perceivedPrice2 === tier.id
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metric 2: Buy-Again Intent */}
              <div className="w-full space-y-1 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Buy Again Intent</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'yes', label: '🍷 Yes!' },
                    { id: 'maybe', label: '🤔 Maybe' },
                    { id: 'no', label: '❌ Pass' }
                  ].map(intent => (
                    <button
                      type="button"
                      key={intent.id}
                      onClick={() => setBuyAgain2(buyAgain2 === intent.id ? undefined : intent.id as any)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        buyAgain2 === intent.id
                          ? intent.id === 'yes'
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : intent.id === 'maybe'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-rose-500/20 border-rose-400 text-rose-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {intent.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metric 3: 3-Pillar Sensory DNA (Smooth Sliders - Optional) */}
              <div className="w-full space-y-3 pt-3 border-t border-slate-850 text-left">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sensory DNA (Optional Sliders)</label>
                  <span className="text-[10px] text-slate-500">Slide 1-5</span>
                </div>

                <div className="space-y-3 bg-slate-950/40 p-3 rounded-xl border border-slate-900">
                  {/* Acidity Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Acidity (Soft → Tart)</span>
                      <span className="text-wine-300 font-mono font-bold">{acidity2 ? `${acidity2}/5` : 'Not Set'}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={acidity2 || 3}
                      onChange={(e) => setAcidity2(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-wine-500"
                    />
                  </div>

                  {/* Body Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Body (Light → Full)</span>
                      <span className="text-wine-300 font-mono font-bold">{body2 ? `${body2}/5` : 'Not Set'}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={body2 || 3}
                      onChange={(e) => setBody2(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-wine-500"
                    />
                  </div>

                  {/* Sweetness Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Sweetness (Dry → Sweet)</span>
                      <span className="text-wine-300 font-mono font-bold">{sweetness2 ? `${sweetness2}/5` : 'Not Set'}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={sweetness2 || 3}
                      onChange={(e) => setSweetness2(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-wine-500"
                    />
                  </div>
                </div>
              </div>

              <div className="w-full space-y-1 text-left pt-2 border-t border-slate-850">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Tasting Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Aroma, flavor, body, finish..."
                  value={notes2}
                  onChange={(e) => setNotes2(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500 resize-none"
                />
              </div>

              {wine2Weight > 0.5 && (
                <div className="text-xs bg-wine-950/40 text-wine-300 px-3 py-1 rounded-full border border-wine-900/30 flex items-center gap-1">
                  <ThumbsUp className="w-3 h-3" /> Leaning Choice
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Central Slider controls */}
        <div className="glass-panel rounded-2xl p-8 space-y-6 border border-wine-800/30">
          <div className="space-y-1 text-center">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Scale className="w-4 h-4 text-wine-400" /> Overall Rating Score (Required)
            </h3>
            <div className="flex justify-between text-[11px] font-semibold text-slate-400 px-1 pt-1">
              <span className="text-rose-400 font-serif">Awful</span>
              <span className="text-slate-500 font-normal font-mono">0 — 100 Numeric Scale</span>
              <span className="text-emerald-400 font-serif">Sheer Perfection</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">
            <span className="flex items-center gap-1"><ChevronLeft className="w-4 h-4 text-wine-500" /> Prefer Wine {wine1Label}</span>
            <span className="flex items-center gap-1 text-slate-500"><Scale className="w-3.5 h-3.5" /> 50/50</span>
            <span className="flex items-center gap-1">Prefer Wine {wine2Label} <ChevronRight className="w-4 h-4 text-wine-500" /></span>
          </div>

          <div className="relative pt-2 pb-2">
            <input
              type="range"
              min="0"
              max="100"
              value={sliderVal}
              onChange={(e) => setSliderVal(parseInt(e.target.value))}
              className="wine-slider"
            />
            {/* Center tick indicator */}
            <div className="absolute top-2.5 left-1/2 -ml-0.5 w-1 h-6 bg-slate-600 pointer-events-none rounded-full" />
          </div>

          {/* Explicit Numeric Scores Under Slider */}
          <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-900 text-center">
            <div className="space-y-0.5">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Wine {wine1Label} Score</p>
              <p className="text-xl font-bold font-mono text-wine-300">
                {100 - sliderVal} <span className="text-xs font-sans text-slate-500">/ 100</span>
              </p>
            </div>
            <div className="space-y-0.5 border-l border-slate-800">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Wine {wine2Label} Score</p>
              <p className="text-xl font-bold font-mono text-wine-300">
                {sliderVal} <span className="text-xs font-sans text-slate-500">/ 100</span>
              </p>
            </div>
          </div>

          {/* Qualitative interpretation */}
          <div className="text-center py-1">
            <p className={`text-base font-serif transition-colors ${pref.color}`}>
              {pref.text}
            </p>

            {sliderVal === 50 && (
              <div className="mt-4 max-w-md mx-auto bg-amber-950/20 border border-amber-900/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-300 text-left animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Score required for each wine!</p>
                  <p className="text-slate-400">Please move the slider to assign your rating scores for Wine {wine1Label} and Wine {wine2Label}.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={onBackToBracket}
            className="py-2.5 px-6 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting || sliderVal === 50}
            className={`py-2.5 px-8 text-white font-semibold rounded-lg text-sm shadow-lg transition-all ${
              sliderVal === 50
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none'
                : success 
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20' 
                  : 'bg-gradient-to-r from-wine-850 to-wine-600 hover:from-wine-700 hover:to-wine-500 shadow-wine-950/20'
            }`}
          >
            {isSubmitting 
              ? "Saving..." 
              : success 
                ? "Vote Logged!" 
                : sliderVal === 50
                  ? "Tie Not Allowed"
                  : existingVote 
                    ? "Update Vote" 
                    : "Submit Vote"}
          </button>
        </div>
      </form>
    </div>
  );
}
