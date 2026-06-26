import React, { useState, useEffect } from 'react';
import { Vote } from '../utils/mockData';
import { ChevronLeft, ChevronRight, ThumbsUp, Scale, Edit3 } from 'lucide-react';

interface VotingSliderProps {
  matchId: string;
  wine1Label: string;
  wine2Label: string;
  voterName: string;
  existingVote?: Vote;
  onSubmitVote: (sliderValue: number, notes1: string, notes2: string) => Promise<void>;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Initialize form with existing vote if available
  useEffect(() => {
    if (existingVote) {
      setSliderVal(existingVote.slider_value);
      setNotes1(existingVote.notes_wine_1 || '');
      setNotes2(existingVote.notes_wine_2 || '');
    } else {
      setSliderVal(50);
      setNotes1('');
      setNotes2('');
    }
    setSuccess(false);
  }, [existingVote, matchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmitVote(sliderVal, notes1, notes2);
      setSuccess(true);
      setTimeout(() => {
        onBackToBracket();
      }, 1200); // Wait briefly to show success state before returning
    } catch (err) {
      console.error(err);
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
              
              <div className="w-full space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Tasting Notes
                </label>
                <textarea
                  rows={4}
                  placeholder="Aroma, flavor, body, tanins, finish..."
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
              
              <div className="w-full space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Tasting Notes
                </label>
                <textarea
                  rows={4}
                  placeholder="Aroma, flavor, body, tanins, finish..."
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
        <div className="glass-panel rounded-2xl p-8 space-y-6">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span className="flex items-center gap-1"><ChevronLeft className="w-4 h-4 text-wine-500" /> Prefer {wine1Label}</span>
            <span className="flex items-center gap-1"><Scale className="w-4 h-4" /> Equal Tie</span>
            <span className="flex items-center gap-1">Prefer {wine2Label} <ChevronRight className="w-4 h-4 text-wine-500" /></span>
          </div>

          <div className="relative pt-4 pb-2">
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

          {/* Qualitative interpretation */}
          <div className="text-center py-2">
            <p className={`text-base font-serif transition-colors ${pref.color}`}>
              {pref.text}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              Margin: {sliderVal === 50 ? "Even" : `${Math.abs(50 - sliderVal)}% preference`} (Value: {sliderVal})
            </p>
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
            disabled={isSubmitting}
            className={`py-2.5 px-8 text-white font-semibold rounded-lg text-sm shadow-lg transition-all ${
              success 
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20' 
                : 'bg-gradient-to-r from-wine-850 to-wine-600 hover:from-wine-700 hover:to-wine-500 shadow-wine-950/20'
            }`}
          >
            {isSubmitting 
              ? "Saving..." 
              : success 
                ? "Vote Logged!" 
                : existingVote 
                  ? "Update Vote" 
                  : "Submit Vote"}
          </button>
        </div>
      </form>
    </div>
  );
}
