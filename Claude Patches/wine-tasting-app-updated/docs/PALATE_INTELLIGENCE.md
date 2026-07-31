# Palate Intelligence — Taster Profiles, Cellar, Auto-fill

This branch turns the data you already collect into cross-event intelligence about
people, adds a personal "buy again" cellar, and lets the intake form auto-fill wine
details from just a name + vintage.

## What's new

**1. Taster Profiles (new "Palate" tab)** — `src/components/TasterProfiles.tsx`
Cross-event palate analysis computed entirely from existing history:
- Price instinct: blind, how often each person picks the cheaper vs. pricier wine.
- Average price of the wines they favor.
- Contrarian index: how often they break from the group's majority pick.
- Taste signature: their most-favored style / grape / region (populates as wines get tagged).
- Signature wines: the bottles they personally rated highest, with event + price.
- Agreement matrix: who each taster's "palate twin" and "opposite palate" are, with a
  full agreement bar chart against everyone else.

**2. My Cellar (new "Cellar" tab)** — `src/components/Cellar.tsx`
- Personal, per-person wishlist ("buy again") stored in a new `wishlist` table.
- Search across every wine ever tasted (by name, grape, region, style, or event),
  each showing its score and price, with one-tap save to your list.
- Manual add for bottles you discover outside a tasting.

**3. Wine detail auto-fill** — `src/components/IntakeForm.tsx` + `supabase/functions/enrich-wine/`
- New "Auto-fill details" button infers varietal, region, country, and style from the
  wine name (+ vintage/producer) via an LLM, filling only the fields you left blank.
- New descriptive fields (varietal / region / country / style) on every wine, so the
  app can reason about *style*, not just individual bottles. These feed the profiles.
- **Price is deliberately manual.** Auto-fill returns only a rough price *estimate* as a
  starting point; the price that matters for your value/giant-killer stats is what you
  actually paid at your store, which no external source knows.

## Files changed
- `schema.sql` — added wine metadata columns + `wishlist` table (for fresh installs).
- `migrations/002_wine_metadata_and_wishlist.sql` — **additive, idempotent** migration for prod.
- `src/utils/mockData.ts` — new types (`WineEnrichment`, `WishlistItem`) + extended `Wine`.
- `src/utils/supabase.ts` — wishlist CRUD + `enrichWine()`.
- `src/App.tsx` — new tabs + history snapshot now stores wine metadata.
- `src/components/IntakeForm.tsx` — auto-fill + new fields.
- `src/components/TasterProfiles.tsx`, `src/components/Cellar.tsx` — new views.
- `supabase/functions/enrich-wine/index.ts` — edge function for auto-fill.

## Deploy steps (in order)

### 1. Database — run the ADDITIVE migration (NOT schema.sql)
In the Supabase dashboard → SQL Editor, run:
```
migrations/002_wine_metadata_and_wishlist.sql
```
This only ADDs columns/table; it never drops data. **Do not re-run `schema.sql` on
production** — that file drops tables for a clean local rebuild and would erase history.

### 2. Edge function — for auto-fill
```bash
supabase functions deploy enrich-wine --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key
# optional: pick a model (defaults to a fast, cheap one)
supabase secrets set ENRICH_MODEL=claude-haiku-4-5-20251001
```
The key lives only in Supabase (server-side) and is never shipped to the browser.
If you skip this step, everything else still works — the auto-fill button will just
report that the service is unavailable and you enter details manually.

### 3. App — build & deploy (Vercel picks this up on push)
```bash
npm install
npm run build     # tsc + vite; must pass before deploying
npm run dev       # to test locally at http://localhost:3000
```

## Pushing to GitHub
```bash
# from your existing clone of the repo
git checkout -b feat/palate-intelligence
git apply /path/to/palate-intelligence.patch   # if applying the patch
# (or copy the changed files in from the provided folder)
git add -A
git commit -m "Add taster profiles, cellar, and wine auto-fill"
git push -u origin feat/palate-intelligence
# then open a PR on GitHub
```

## Note on verification
This was type-checked against the project's strict flags (`strict`,
`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`) with zero errors in the
new code. It was **not** run through a full `npm run build` here (no network to install
dependencies), so run `npm run build` locally once before merging — it uses the same
public React/Supabase APIs the existing code already uses.
