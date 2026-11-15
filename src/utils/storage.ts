import type { TastingDraft } from '../types/wine';

const DRAFT_PREFIX = 'WINE_TASTING_DRAFTS_V1';

export const safeStorageGet = (key: string): string | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeStorageSet = (key: string, value: string): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or private-browsing security errors gracefully
  }
};

export const safeStorageRemove = (key: string): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage access errors gracefully
  }
};

/** Generates an RFC4122-compliant v4 UUID with WebCrypto fallback. */
export const generateUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const uuidMask = '10000000-1000-4000-8000-100000000000';
  return uuidMask.replace(/[018]/g, c => {
    const rand =
      typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
        ? crypto.getRandomValues(new Uint8Array(1))[0]
        : Math.floor(Math.random() * 16);
    return (+c ^ (rand & (15 >> (+c / 4)))).toString(16);
  });
};

const getDraftStorageKey = (sessionId: string, voterName: string): string => {
  const cleanVoter = (voterName || '').trim().toLowerCase() || '_anonymous_';
  return `${DRAFT_PREFIX}:${sessionId}:${cleanVoter}`;
};

export const loadSessionDrafts = (
  sessionId: string,
  voterName: string
): Record<string, TastingDraft> => {
  if (!sessionId || !(voterName || '').trim()) return {};
  const raw = safeStorageGet(getDraftStorageKey(sessionId, voterName));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, TastingDraft>) : {};
  } catch {
    return {};
  }
};

export const saveWineDraft = (
  sessionId: string,
  voterName: string,
  label: string,
  draft: TastingDraft
): Record<string, TastingDraft> => {
  const cleanVoter = (voterName || '').trim();
  if (!sessionId || !cleanVoter || !label) return {};
  const existing = loadSessionDrafts(sessionId, cleanVoter);
  const next: Record<string, TastingDraft> = {
    ...existing,
    [label]: draft
  };
  safeStorageSet(getDraftStorageKey(sessionId, cleanVoter), JSON.stringify(next));
  return next;
};

export const clearWineDraft = (
  sessionId: string,
  voterName: string,
  label: string
): Record<string, TastingDraft> => {
  const cleanVoter = (voterName || '').trim();
  if (!sessionId || !cleanVoter || !label) return {};
  const existing = loadSessionDrafts(sessionId, cleanVoter);
  if (!(label in existing)) return existing;
  const next = { ...existing };
  delete next[label];
  if (Object.keys(next).length === 0) {
    safeStorageRemove(getDraftStorageKey(sessionId, cleanVoter));
  } else {
    safeStorageSet(getDraftStorageKey(sessionId, cleanVoter), JSON.stringify(next));
  }
  return next;
};
