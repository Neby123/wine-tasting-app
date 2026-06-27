import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { Save, Link as LinkIcon, Database, CheckCircle, Shield, User, Share2 } from 'lucide-react';

interface SettingsProps {
  voterName: string;
  isHost: boolean;
  onUpdateVoterName: (name: string) => void;
  onUpdateHostMode: (host: boolean) => void;
}

export default function Settings({
  voterName,
  isHost,
  onUpdateVoterName,
  onUpdateHostMode
}: SettingsProps) {
  const isConnected = !!supabase;
  const [name, setName] = useState(voterName);
  const [sbUrl, setSbUrl] = useState(() => localStorage.getItem('WINE_TASTING_SB_URL') || '');
  const [sbKey, setSbKey] = useState(() => localStorage.getItem('WINE_TASTING_SB_KEY') || '');
  const [savedMsg, setSavedMsg] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [participants, setParticipants] = useState<string[]>(() => {
    const stored = localStorage.getItem('WINE_TASTING_PARTICIPANTS');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    const defaultList = ['Ben', 'Monica', 'Jack', 'Alexcia', 'David', 'Abby'];
    localStorage.setItem('WINE_TASTING_PARTICIPANTS', JSON.stringify(defaultList));
    return defaultList;
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    onUpdateVoterName(trimmedName);

    // Save name to participants list if it's new
    if (!participants.includes(trimmedName)) {
      const updated = [...participants, trimmedName];
      setParticipants(updated);
      localStorage.setItem('WINE_TASTING_PARTICIPANTS', JSON.stringify(updated));
    }

    setSavedMsg("Profile updated successfully!");
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const handleSaveDB = (e: React.FormEvent) => {
    e.preventDefault();
    if (sbUrl.trim() && sbKey.trim()) {
      localStorage.setItem('WINE_TASTING_SB_URL', sbUrl.trim());
      localStorage.setItem('WINE_TASTING_SB_KEY', sbKey.trim());
      setSavedMsg("Database credentials saved! Re-connecting...");
    } else {
      localStorage.removeItem('WINE_TASTING_SB_URL');
      localStorage.removeItem('WINE_TASTING_SB_KEY');
      setSavedMsg("Database disconnected. Running in Local Storage Mode.");
    }
    setTimeout(() => {
      window.location.reload(); // Reload to re-initialize supabase client
    }, 1500);
  };

  // Generate share link
  const getShareLink = () => {
    const url = localStorage.getItem('WINE_TASTING_SB_URL');
    const key = localStorage.getItem('WINE_TASTING_SB_KEY');
    if (!url || !key) return '';

    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?sb_url=${encodeURIComponent(url)}&sb_key=${encodeURIComponent(key)}`;
  };

  const shareLink = getShareLink();

  const handleCopyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h2 className="text-3xl font-bold font-serif text-wine-100">App Settings</h2>
        <p className="text-slate-400 text-sm">
          Configure your identity, toggle host controls, or connect to a multiplayer database.
        </p>
      </div>

      {savedMsg && (
        <div className="text-center py-2 px-4 bg-emerald-950/30 border border-emerald-900/30 rounded-xl text-emerald-300 text-sm font-semibold flex items-center justify-center gap-2 animate-scale-in">
          <CheckCircle className="w-4 h-4" /> {savedMsg}
        </div>
      )}

      {/* Profile Section */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gold-300 flex items-center gap-2 border-b border-slate-850 pb-3">
          <User className="w-5 h-5 text-gold-400" />
          Voter Profile
        </h3>
        
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Select Previous Participant
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setName(e.target.value);
                  }
                }}
                value={participants.includes(name) ? name : ""}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500"
              >
                <option value="">-- Choose Name or Type &rarr; --</option>
                {participants.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Your Name / Participant Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ben"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500 font-semibold"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl">
            <div className="space-y-0.5 pr-4">
              <label className="text-sm font-semibold text-slate-350 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-wine-400" /> Host Controls
              </label>
              <p className="text-xs text-slate-500">
                Enables resolving bracket match winners, resetting sessions, and finalizing datasets.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateHostMode(!isHost)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                isHost ? 'bg-wine-600 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-md transform" />
            </button>
          </div>

          <button
            type="submit"
            className="py-2 px-5 bg-slate-900 border border-slate-800 hover:border-wine-800 hover:text-wine-200 text-slate-300 font-semibold rounded-lg text-sm transition-all flex items-center gap-2 shadow-md"
          >
            <Save className="w-4 h-4" /> Save Profile
          </button>
        </form>
      </div>

      {/* Supabase Connection Section */}
      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-850 pb-3">
          <h3 className="text-lg font-semibold text-gold-300 flex items-center gap-2">
            <Database className="w-5 h-5 text-gold-400" />
            Database Configuration
          </h3>
          <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
            !isConnected 
              ? 'bg-slate-950 border-slate-850 text-slate-400' 
              : 'bg-emerald-950/40 border-emerald-900/30 text-emerald-400'
          }`}>
            {!isConnected ? 'Not Connected (Setup Required)' : 'Supabase Multiplayer Connected'}
          </span>
        </div>

        <form onSubmit={handleSaveDB} className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            By default, data is saved directly in your browser (LocalStorage). To synchronize scoring in real-time across multiple participants' devices, enter your free Supabase credentials below. Paste the SQL setup script from <code className="text-wine-300 bg-slate-950 px-1 py-0.5 rounded border border-slate-900">schema.sql</code> into your Supabase project dashboard first.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://your-project-id.supabase.co"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-255 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Supabase Anon Key
            </label>
            <input
              type="text"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={sbKey}
              onChange={(e) => setSbKey(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-wine-500 rounded-lg text-slate-255 text-sm focus:outline-none focus:ring-1 focus:ring-wine-500 font-mono"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="py-2.5 px-5 bg-gradient-to-r from-wine-800 to-wine-600 hover:from-wine-700 hover:to-wine-500 text-white font-semibold rounded-lg text-sm shadow-md transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> Save Connection
            </button>
            {(sbUrl || sbKey) && (
              <button
                type="button"
                onClick={() => { setSbUrl(''); setSbKey(''); }}
                className="py-2.5 px-4 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-sm rounded-lg transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </form>

        {/* Shareable Link (Multiplayer Invitation) */}
        {isConnected && shareLink && (
          <div className="mt-6 border-t border-slate-850 pt-6 space-y-3">
            <h4 className="text-sm font-semibold text-slate-350 flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-wine-400" /> Share Room Invitation
            </h4>
            <p className="text-xs text-slate-500">
              Copy this link and send it to your guests. Clicking it will automatically configure their browser and link them directly to this tasting session!
            </p>
            
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 text-xs focus:outline-none font-mono"
              />
              <button
                onClick={handleCopyLink}
                className={`py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  linkCopied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                {linkCopied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
