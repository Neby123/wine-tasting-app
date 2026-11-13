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
  const [hostPasscode, setHostPasscode] = useState(() => localStorage.getItem('WINE_TASTING_HOST_PASSCODE') || '');
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

    // Save host passcode to localStorage
    const oldPasscode = localStorage.getItem('WINE_TASTING_HOST_PASSCODE') || '';
    const newPasscode = hostPasscode.trim();
    localStorage.setItem('WINE_TASTING_HOST_PASSCODE', newPasscode);

    if (oldPasscode !== newPasscode) {
      setSavedMsg("Host passcode updated! Re-initializing connection...");
      setTimeout(() => window.location.reload(), 1000);
      return;
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
    const url = localStorage.getItem('WINE_TASTING_SB_URL') || (import.meta.env.VITE_SUPABASE_URL as string);
    const key = localStorage.getItem('WINE_TASTING_SB_KEY') || (import.meta.env.VITE_SUPABASE_ANON_KEY as string);
    if (!url || !key) return window.location.origin + window.location.pathname;

    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?sb_url=${encodeURIComponent(url.trim())}&sb_key=${encodeURIComponent(key.trim())}`;
  };

  const shareLink = getShareLink();

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        // Fallback for non-HTTPS contexts (e.g. local network)
        const textarea = document.createElement('textarea');
        textarea.value = shareLink;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Could not copy link automatically. Please select and copy this URL manually:\n\n' + shareLink);
    }
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
        <div className="text-center py-2 px-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold flex items-center justify-center gap-2 animate-scale-in shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-700" /> {savedMsg}
        </div>
      )}

      {/* Profile Section */}
      <div className="glass-panel rounded-2xl p-6 space-y-4 bg-white border border-slate-800 shadow-xs">
        <h3 className="text-lg font-semibold text-slate-100 font-serif flex items-center gap-2 border-b border-slate-850 pb-3">
          <User className="w-5 h-5 text-amber-700" />
          Voter Profile
        </h3>
        
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Select Previous Participant
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setName(e.target.value);
                  }
                }}
                value={participants.includes(name) ? name : ""}
                className="w-full px-3 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] shadow-xs"
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
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Your Name / Participant Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ben"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] font-semibold placeholder:text-slate-500 shadow-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-850/60 border border-slate-800 rounded-xl">
            <div className="space-y-0.5 pr-4">
              <label className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#6E172C]" /> Host Controls
              </label>
              <p className="text-xs text-slate-500">
                Enables unbagging and mapping blind bottles to wines, resetting sessions, and finalizing datasets.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateHostMode(!isHost)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                isHost ? 'bg-[#6E172C] justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-md transform" />
            </button>
          </div>

          {isHost && (
            <div className="p-3.5 bg-slate-850/60 border border-slate-800 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Host Passcode
              </label>
              <input
                type="password"
                placeholder="Enter host passcode (default: 1234)"
                value={hostPasscode}
                onChange={(e) => setHostPasscode(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] font-mono placeholder:text-slate-500 shadow-xs"
              />
              <p className="text-[10px] text-slate-500">
                Required for host operations like settling matchups and revealing bottles.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="py-2 px-5 bg-white border border-slate-800 hover:border-[#6E172C] hover:text-[#6E172C] text-slate-100 font-semibold rounded-lg text-sm transition-all flex items-center gap-2 shadow-xs"
          >
            <Save className="w-4 h-4" /> Save Profile
          </button>
        </form>
      </div>

      {/* Supabase Connection Section */}
      <div className="glass-panel rounded-2xl p-6 space-y-4 bg-white border border-slate-800 shadow-xs">
        <div className="flex justify-between items-center border-b border-slate-850 pb-3">
          <h3 className="text-lg font-semibold text-slate-100 font-serif flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-700" />
            Database Configuration
          </h3>
          <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
            !isConnected 
              ? 'bg-slate-850 border-slate-800 text-slate-500' 
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {!isConnected ? 'Not Connected (Setup Required)' : 'Supabase Multiplayer Connected'}
          </span>
        </div>

        <form onSubmit={handleSaveDB} className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            By default, data is saved directly in your browser (LocalStorage). To synchronize scoring in real-time across multiple participants' devices, enter your free Supabase credentials below. Paste the SQL setup script from <code className="text-[#6E172C] bg-slate-850 px-1 py-0.5 rounded border border-slate-800">schema.sql</code> into your Supabase project dashboard first.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://your-project-id.supabase.co"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] font-mono placeholder:text-slate-500 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Supabase Anon Key
            </label>
            <input
              type="text"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={sbKey}
              onChange={(e) => setSbKey(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] font-mono placeholder:text-slate-500 shadow-xs"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="py-2.5 px-5 bg-[#6E172C] hover:bg-[#5A1425] text-white font-semibold rounded-lg text-sm shadow-md transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> Save Connection
            </button>
            {(sbUrl || sbKey) && (
              <button
                type="button"
                onClick={() => { setSbUrl(''); setSbKey(''); }}
                className="py-2.5 px-4 bg-white border border-slate-800 text-slate-400 hover:text-slate-100 text-sm rounded-lg transition-colors shadow-xs"
              >
                Disconnect
              </button>
            )}
          </div>
        </form>

        {/* Shareable Link (Multiplayer Invitation) */}
        {isConnected && shareLink && (
          <div className="mt-6 border-t border-slate-800 pt-6 space-y-3">
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-[#6E172C]" /> Share Room Invitation
            </h4>
            <p className="text-xs text-slate-500">
              Copy this link and send it to your guests. Clicking it will automatically configure their browser and link them directly to this tasting session!
            </p>
            
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 px-3 py-2 bg-slate-850 border border-slate-800 rounded-lg text-slate-400 text-xs focus:outline-none font-mono"
              />
              <button
                onClick={handleCopyLink}
                className={`py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  linkCopied 
                    ? 'bg-emerald-700 text-white' 
                    : 'bg-white border border-slate-800 hover:bg-slate-850 text-slate-100 shadow-xs'
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
