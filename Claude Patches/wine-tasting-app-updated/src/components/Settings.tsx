import React, { useId, useRef, useState } from 'react';
import { db, supabase } from '../utils/supabase';
import { safeStorageGet, safeStorageRemove, safeStorageSet } from '../utils/storage';
import { useFormAriaSync } from '../hooks/useFormAriaSync';
import {
  Save,
  Link as LinkIcon,
  Database,
  CheckCircle,
  Shield,
  ShieldCheck,
  User,
  Share2,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';

interface SettingsProps {
  voterName: string;
  isHost: boolean;
  onUpdateVoterName: (name: string) => void;
  onUpdateHostMode: (host: boolean) => void;
  onNotify?: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

export default function Settings({
  voterName,
  isHost,
  onUpdateVoterName,
  onUpdateHostMode,
  onNotify
}: SettingsProps) {
  const idBase = useId();
  const profileFormRef = useRef<HTMLFormElement>(null);
  const dbFormRef = useRef<HTMLFormElement>(null);

  const isConnected = !!supabase;
  const [name, setName] = useState(voterName);
  const [sbUrl, setSbUrl] = useState(() => safeStorageGet('WINE_TASTING_SB_URL') || '');
  const [sbKey, setSbKey] = useState(() => safeStorageGet('WINE_TASTING_SB_KEY') || '');
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcodeCheckState, setPasscodeCheckState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [passcodeCheckNote, setPasscodeCheckNote] = useState('');
  const [hostPasscode, setHostPasscode] = useState(() => safeStorageGet('WINE_TASTING_HOST_PASSCODE') || '1234');
  const [participants, setParticipants] = useState<string[]>(() => {
    const stored = safeStorageGet('WINE_TASTING_PARTICIPANTS');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fall back to default participant list on parse failure
      }
    }
    const defaultList = ['Ben', 'Monica', 'Jack', 'Alexcia', 'David', 'Abby'];
    safeStorageSet('WINE_TASTING_PARTICIPANTS', JSON.stringify(defaultList));
    return defaultList;
  });

  useFormAriaSync(profileFormRef, [name, isHost, hostPasscode]);
  useFormAriaSync(dbFormRef, [sbUrl, sbKey]);

  const handleVerifyPasscode = async (codeOverride?: string) => {
    const targetCode = (codeOverride !== undefined ? codeOverride : hostPasscode).trim();
    if (!targetCode) {
      setPasscodeCheckState('invalid');
      setPasscodeCheckNote('Enter a host passcode first.');
      return false;
    }
    if (!isConnected) {
      setPasscodeCheckState('idle');
      setPasscodeCheckNote('Saved locally. Connect Supabase below to verify against database RLS.');
      return true;
    }
    setPasscodeCheckState('checking');
    setPasscodeCheckNote('Checking passcode with Supabase...');
    const res = await db.verifyHostPasscode(targetCode);
    if (res.valid) {
      setPasscodeCheckState('valid');
      setPasscodeCheckNote('Verified by database host policy.');
      return true;
    }
    setPasscodeCheckState('invalid');
    setPasscodeCheckNote(res.reason || 'Incorrect host passcode.');
    return false;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const trimmedName = name.trim();
    if (!trimmedName && !isHost) {
      setErrorMsg('Please enter your taster name or enable Host Controls.');
      return;
    }

    if (trimmedName) {
      onUpdateVoterName(trimmedName);

      if (!participants.includes(trimmedName)) {
        const updated = [...participants, trimmedName];
        setParticipants(updated);
        safeStorageSet('WINE_TASTING_PARTICIPANTS', JSON.stringify(updated));
      }
    }

    const newPasscode = hostPasscode.trim() || '1234';
    if (!hostPasscode.trim()) setHostPasscode(newPasscode);
    safeStorageSet('WINE_TASTING_HOST_PASSCODE', newPasscode);

    if (isHost && isConnected) {
      await handleVerifyPasscode(newPasscode);
    }

    const msg = trimmedName ? 'Profile updated successfully!' : 'Host passcode updated!';
    setSavedMsg(msg);
    onNotify?.(msg, 'success');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const handleToggleHostMode = () => {
    const nextHost = !isHost;
    if (nextHost) {
      const code = hostPasscode.trim() || safeStorageGet('WINE_TASTING_HOST_PASSCODE') || '1234';
      if (!hostPasscode.trim()) setHostPasscode(code);
      safeStorageSet('WINE_TASTING_HOST_PASSCODE', code);
    } else {
      setPasscodeCheckState('idle');
      setPasscodeCheckNote('');
    }
    onUpdateHostMode(nextHost);
  };

  const handleSaveDB = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (sbUrl.trim() && sbKey.trim()) {
      safeStorageSet('WINE_TASTING_SB_URL', sbUrl.trim());
      safeStorageSet('WINE_TASTING_SB_KEY', sbKey.trim());
      setSavedMsg('Database credentials saved! Re-connecting...');
    } else {
      safeStorageRemove('WINE_TASTING_SB_URL');
      safeStorageRemove('WINE_TASTING_SB_KEY');
      setSavedMsg('Database disconnected.');
    }
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const getShareLink = () => {
    const url = safeStorageGet('WINE_TASTING_SB_URL') || (import.meta.env.VITE_SUPABASE_URL as string);
    const key = safeStorageGet('WINE_TASTING_SB_KEY') || (import.meta.env.VITE_SUPABASE_ANON_KEY as string);
    if (!url || !key) return window.location.origin + window.location.pathname;

    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?sb_url=${encodeURIComponent(url.trim())}&sb_key=${encodeURIComponent(key.trim())}`;
  };

  const shareLink = getShareLink();

  const handleCopyLink = async () => {
    if (!shareLink) return;
    setErrorMsg('');
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareLink);
      } else {
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
      onNotify?.('Room invite link copied to clipboard.', 'success');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      const msg = 'Could not copy link automatically. Select the URL field and copy manually.';
      setErrorMsg(msg);
      onNotify?.(msg, 'error');
    }
  };

  const participantSelectId = `${idBase}-participant-select`;
  const voterNameId = `${idBase}-voter-name`;
  const hostToggleLabelId = `${idBase}-host-label`;
  const passcodeId = `${idBase}-host-passcode`;
  const sbUrlId = `${idBase}-sb-url`;
  const sbKeyId = `${idBase}-sb-key`;
  const shareLinkId = `${idBase}-share-link`;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h2 className="text-3xl font-bold font-serif text-wine-100">App Settings</h2>
        <p className="text-slate-400 text-sm">
          Configure your identity, toggle host controls, or connect to a multiplayer database.
        </p>
      </div>

      {savedMsg && (
        <div role="status" aria-live="polite" className="text-center py-2.5 px-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold flex items-center justify-center gap-2 animate-scale-in shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-700" aria-hidden="true" /> {savedMsg}
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="py-2.5 px-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" /> {errorMsg}
        </div>
      )}

      {/* Profile Section */}
      <div className="glass-panel rounded-2xl p-6 space-y-4 bg-white border border-slate-800 shadow-xs">
        <h3 className="text-lg font-semibold text-slate-100 font-serif flex items-center gap-2 border-b border-slate-850 pb-3">
          <User className="w-5 h-5 text-amber-700" aria-hidden="true" />
          Voter Profile
        </h3>

        <form ref={profileFormRef} onSubmit={handleSaveProfile} noValidate className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor={participantSelectId} className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Select Previous Participant
              </label>
              <select
                id={participantSelectId}
                onChange={(e) => {
                  if (e.target.value) {
                    setName(e.target.value);
                  }
                }}
                value={participants.includes(name) ? name : ''}
                className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] shadow-xs"
              >
                <option value="">-- Choose Name or Type --</option>
                {participants.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor={voterNameId} className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Your Name / Participant Name
              </label>
              <input
                id={voterNameId}
                type="text"
                autoComplete="name"
                required={!isHost}
                data-error="Enter your name unless Host Controls are enabled."
                placeholder="e.g. Ben"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] font-semibold placeholder:text-slate-500 shadow-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-850/60 border border-slate-800 rounded-xl">
            <div className="space-y-0.5 pr-4">
              <span id={hostToggleLabelId} className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#6E172C]" aria-hidden="true" /> Host Controls
              </span>
              <p className="text-xs text-slate-500">
                Enables unbagging and mapping blind bottles to wines, resetting sessions, and finalizing datasets.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isHost}
              aria-labelledby={hostToggleLabelId}
              onClick={handleToggleHostMode}
              className="min-w-[48px] min-h-[44px] flex items-center justify-center focus:outline-none"
            >
              <span
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                  isHost ? 'bg-[#6E172C] justify-end' : 'bg-slate-700 justify-start'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white shadow-md transform" />
              </span>
            </button>
          </div>

          {isHost && (
            <div className="p-3.5 bg-slate-850/60 border border-slate-800 rounded-xl space-y-2.5">
              <label htmlFor={passcodeId} className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Host Passcode
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    id={passcodeId}
                    type={showPasscode ? 'text' : 'password'}
                    placeholder="Enter host passcode (default: 1234)"
                    value={hostPasscode}
                    autoComplete="current-password"
                    onChange={(e) => {
                      setHostPasscode(e.target.value);
                      setPasscodeCheckState('idle');
                      setPasscodeCheckNote('');
                    }}
                    className="w-full min-h-[44px] pl-3 pr-12 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] font-mono placeholder:text-slate-500 shadow-xs"
                  />
                  <button
                    type="button"
                    aria-pressed={showPasscode}
                    aria-label={showPasscode ? 'Hide host passcode' : 'Show host passcode'}
                    onClick={() => setShowPasscode(s => !s)}
                    className="absolute inset-y-0 right-0 min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-100"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleVerifyPasscode()}
                  disabled={passcodeCheckState === 'checking'}
                  className="min-h-[44px] px-4 py-2 bg-white border border-slate-800 hover:border-[#6E172C] text-slate-100 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4 text-[#6E172C]" aria-hidden="true" />
                  {passcodeCheckState === 'checking' ? 'Verifying...' : 'Verify Passcode'}
                </button>
              </div>
              {passcodeCheckNote && (
                <p
                  role={passcodeCheckState === 'invalid' ? 'alert' : 'status'}
                  className={`text-xs font-semibold ${
                    passcodeCheckState === 'valid'
                      ? 'text-emerald-800'
                      : passcodeCheckState === 'invalid'
                        ? 'text-rose-800'
                        : 'text-slate-500'
                  }`}
                >
                  {passcodeCheckNote}
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                Required for host operations like unbagging, resetting sessions, and revealing bottles.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="min-h-[44px] py-2 px-5 bg-white border border-slate-800 hover:border-[#6E172C] hover:text-[#6E172C] text-slate-100 font-semibold rounded-lg text-sm transition-all flex items-center gap-2 shadow-xs"
          >
            <Save className="w-4 h-4" aria-hidden="true" /> Save Profile
          </button>
        </form>
      </div>

      {/* Supabase Connection Section */}
      <div className="glass-panel rounded-2xl p-6 space-y-4 bg-white border border-slate-800 shadow-xs">
        <div className="flex justify-between items-center border-b border-slate-850 pb-3">
          <h3 className="text-lg font-semibold text-slate-100 font-serif flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-700" aria-hidden="true" />
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

        <form ref={dbFormRef} onSubmit={handleSaveDB} noValidate className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            All sessions, blind ratings, historical archives, and personal cellar wishlists are stored in and synchronized via Supabase across everyone's devices. Paste the SQL setup script from <code className="text-[#6E172C] bg-slate-850 px-1 py-0.5 rounded border border-slate-800">fix_security.sql</code> into your Supabase project dashboard if initializing a new project.
          </p>

          <div>
            <label htmlFor={sbUrlId} className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Supabase Project URL
            </label>
            <input
              id={sbUrlId}
              type="url"
              placeholder="https://your-project-id.supabase.co"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] font-mono placeholder:text-slate-500 shadow-xs"
            />
          </div>

          <div>
            <label htmlFor={sbKeyId} className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Supabase Anon Key
            </label>
            <input
              id={sbKeyId}
              type="text"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={sbKey}
              onChange={(e) => setSbKey(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-800 focus:border-[#6E172C] rounded-lg text-slate-100 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#6E172C] font-mono placeholder:text-slate-500 shadow-xs"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="min-h-[44px] py-2.5 px-5 bg-[#6E172C] hover:bg-[#5A1425] text-white font-semibold rounded-lg text-sm shadow-md transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" aria-hidden="true" /> Save Connection
            </button>
            {(sbUrl || sbKey) && (
              <button
                type="button"
                onClick={() => { setSbUrl(''); setSbKey(''); }}
                className="min-h-[44px] py-2.5 px-4 bg-white border border-slate-800 text-slate-400 hover:text-slate-100 text-sm rounded-lg transition-colors shadow-xs"
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
              <Share2 className="w-4 h-4 text-[#6E172C]" aria-hidden="true" /> Share Room Invitation
            </h4>
            <p className="text-xs text-slate-500">
              Copy this link and send it to your guests. Clicking it will automatically configure their browser and link them directly to this tasting session!
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <label htmlFor={shareLinkId} className="visually-hidden">Shareable room invite URL</label>
              <input
                id={shareLinkId}
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 min-h-[44px] px-3 py-2 bg-slate-850 border border-slate-800 rounded-lg text-slate-400 text-xs focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`min-h-[44px] py-2 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                  linkCopied
                    ? 'bg-emerald-700 text-white'
                    : 'bg-white border border-slate-800 hover:bg-slate-850 text-slate-100 shadow-xs'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" aria-hidden="true" />
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
