# Fix: stop losing your place (tab persistence + error boundary)

## The bug

People reported being "kicked back to the main page" while using the app —
classically while reading the History page on a phone.

**Cause.** The active tab lived only in React memory, initialised to `intake`,
with no URL, storage, or router behind it. Any full page reload threw that away
and reset to the default. With no active tasting session, the app then falls
through to the "Initialize Tasting Session" start screen — the "main page" in
the report.

The reload itself is usually the browser's doing: mobile browsers (iOS Safari
especially) discard backgrounded tabs to save memory and silently reload them on
return. Lingering on History, switching apps, and coming back reproduced it.

A second path to the same symptom: there was no error boundary, so any single
render error unmounted the whole app.

## The fix

Two small, self-contained changes. No database or config work; frontend only.

1. **Tab lives in the URL hash** (`#history`, `#palate`, …). `App.tsx` now
   initialises the tab from the hash and keeps the two in sync both ways. A
   reload restores your place; views are deep-linkable and the browser back
   button steps through tabs. The existing guest-invite link cleanup already
   preserves the hash, so there's no conflict.

2. **Error boundary** (`src/components/ErrorBoundary.tsx`, wrapping `<App />` in
   `main.tsx`). A render error now shows a recovery card — Reload, or Return to
   start — instead of dropping the person on the start screen with no message.

## Files touched

- `src/App.tsx` — `TabValue` type + `getTabFromHash()` helper; tab initialised
  from the hash; two `useEffect`s to sync tab and hash.
- `src/components/ErrorBoundary.tsx` — new.
- `src/main.tsx` — wrap `<App />` in `<ErrorBoundary>`.

## Verify

Type-checked under the project's exact strict flags; this branch adds zero new
type errors versus its base. A full `npm run build` was **not** run here (no
network for `npm install`) — run it locally before merging.

Quick manual check after deploy: open History, reload the page (or background
the tab on a phone and return) — you should land back on History, not the start
screen. The URL should read `…/#history`.
