import React, { useState } from 'react';
import { Wine } from '../utils/mockData';
import { Plus, Trash2, EyeOff, User, DollarSign, Wine as WineIcon } from 'lucide-react';

interface IntakeFormProps {
  wines: Wine[];
  voterName: string;
  isHost: boolean;
  onAddWine: (wine: Omit<Wine, 'id' | 'session_id' | 'revealed'>) => Promise<void>;
  onDeleteWine: (id: string) => Promise<void>;
  onStartTasting: () => Promise<void>;
}

export default function IntakeForm({
  wines,
  voterName,
  isHost,
  onAddWine,
  onDeleteWine,
  onStartTasting
}: IntakeFormProps) {
  const [wineName, setWineName] = useState('');
  const [producer, setProducer] = useState('');
  const [vintage, setVintage] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voterName.trim()) {
      setErrorMsg("Please enter your name in the settings or at the top of the page first!");
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
        submitted_by: voterName,
        name: wineName.trim(),
        producer: producer.trim() || undefined,
        vintage: vintage.trim() || undefined,
        price: priceNum,
        tasting_notes: notes.trim() || undefined
      });
      // Clear form
      setWineName('');
      setProducer('');
      setVintage('');
      setPrice('');
      setNotes('');
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add wine");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h2 className="text-3xl font-bold font-serif text-wine-100">Wine Registry</h2>
        <p className="text-slate-400 text-sm">
          Every couple brings 2-3 bottles. Log your contributions below. Wine details are kept hidden from other tasters to preserve the blind taste test!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Side: Intake Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gold-300 flex items-center gap-2">
              <Plus className="w-5 h-5" /> Log a Bottle
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Contributor Name (You / Couple)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    disabled
                    value={voterName || "Please set your name in settings"}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-400 text-sm focus:outline-none"
                  />
                </div>
                {!voterName && (
                  <p className="text-rose-400 text-xs mt-1">Please enter your name at the top of the dashboard first.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Wine Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vintner's Reserve Chardonnay"
                  value={wineName}
                  onChange={(e) => setWineName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Producer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kendall-Jackson"
                    value={producer}
                    onChange={(e) => setProducer(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Vintage
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2021"
                    value={vintage}
                    onChange={(e) => setVintage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Price ($ USD) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                    <DollarSign className="w-4 h-4" />
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="24.99"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Tasting Notes / Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Butter, oak, apple, crisp finish (will be revealed at the end!)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500"
                />
              </div>

              {errorMsg && (
                <p className="text-rose-400 text-sm border border-rose-900/30 bg-rose-950/20 px-3 py-2 rounded-lg">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !voterName}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-wine-800 to-wine-600 hover:from-wine-700 hover:to-wine-500 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-500 text-white font-semibold rounded-lg text-sm shadow-lg hover:shadow-wine-950/50 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? "Saving..." : "Register Wine"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Logged Wines List */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <WineIcon className="w-5 h-5 text-wine-400" />
                Submitted Registry ({wines.length} of 8 bottles)
              </h3>
              {isHost && (
                <span className="text-xs bg-wine-900/50 border border-wine-700/50 px-2.5 py-1 rounded-full text-wine-300 font-semibold tracking-wide">
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

                  return (
                    <div key={wine.id} className="py-3 flex justify-between items-center group">
                      <div className="space-y-1">
                        {showDetails ? (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200">{wine.name}</span>
                              {wine.vintage && <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">{wine.vintage}</span>}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-3">
                              <span>By: <strong className="text-slate-300">{wine.submitted_by}</strong></span>
                              <span>•</span>
                              <span className="text-amber-400 font-medium">${wine.price.toFixed(2)}</span>
                              {wine.producer && (
                                <>
                                  <span>•</span>
                                  <span>Prod: {wine.producer}</span>
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
                              Logged by: <strong className="text-slate-300">{wine.submitted_by}</strong>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Delete actions (Host can delete anyone's, user can delete their own) */}
                      {(isHost || isOwnWine) && (
                        <button
                          onClick={() => onDeleteWine(wine.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                          title="Delete wine"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Host actions once exactly 8 wines are registered */}
            {isHost && (
              <div className="mt-6 border-t border-slate-800 pt-6 space-y-4">
                <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-300">Host Launch Pad</p>
                    <p className="text-xs text-slate-500">
                      {wines.length === 8 
                        ? "Ready to initiate! This will assign labels A-H randomly and launch the tournament bracket." 
                        : `Need exactly 8 wines to build the bracket (currently at ${wines.length}).`}
                    </p>
                  </div>
                  <button
                    onClick={onStartTasting}
                    disabled={wines.length !== 8}
                    className="py-2 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-500 text-slate-950 font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-950/20"
                  >
                    Generate Bracket
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
