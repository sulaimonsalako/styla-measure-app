# STYLA Measure — Project State & Working Notes

> Living handoff doc. Update the "Current State" section at the end of each work session.
> Maintained by Claude (Cowork). Took over from Antigravity IDE on 2026-07-23.

## What this is

STYLA Measure — AI body-measurement + sizing platform. Users take a phone-based 3D
body scan (powered by 3DLook), get 80+ tailor-grade dimensions, and use them to find
their correct size across brands. Two sides:

- **B2C (shopper):** `index.html` — scan, dashboard/digital-twin profile, bookmarklet
  that recommends sizes on any brand's site. Monetized via $4.99 PDF export (Stripe).
- **B2B (brands):** `brands.html` — pilot waitlist; on-site fit recommender, aggregated
  body-data analytics, AI sizing widget.

## Architecture

- **Frontend:** Static HTML/CSS/JS (NOT a framework). Main pages at repo root:
  `index.html`, `brands.html`, `bridesmaid.html`, `bookmarklet.html`, `admin-uploader.html`.
  Shared: `style.css`, `main.js`, `decoder.js` (large — bookmarklet/sizing logic).
- **Backend:** Vercel serverless functions in `api/`. Routes are consolidated behind
  dispatcher files + `vercel.json` rewrites (e.g. `/api/3dlook/*` → `api/3dlook-api.js`
  which fans out to `api/_3dlook/*`; `/api/store-*` → `api/store-api.js` → `api/_store/*`).
  This pattern exists to stay under Vercel's Hobby function count limit — keep using it.
- **Sizing engine:** `api/_helpers/sizing-engine.js`, governed by the spec in
  `.agents/AGENTS.md` — tailor-grade constraint logic (hard vs adjustable measurements,
  ease, per-garment rules). This is the core IP, not simple number comparison.
- **Data:** Supabase (`profiles`, `store_profiles` tables). Schema setup in
  `setup_styla_supabase.sql` + incremental `update_*.sql` files.
- **Payments:** Stripe (LIVE keys in `.env`), webhook-driven, with localStorage caching
  to survive webhook propagation race conditions.
- **Scan provider:** 3DLook (aka TDLook) API. Single-vendor dependency = the core tech.
- **Deploy:** Vercel. Blog/`journal/` is a separate Next.js app proxied via rewrite to
  `journal-five-sand.vercel.app`.
- **Extensions:** `chrome-extension/` (MV3) + Safari build via `fastlane/`. Bookmarklet
  is the no-install alternative.

## Env / secrets (in `.env` — do NOT commit, do NOT paste values in chat)

AIRTABLE_PAT, GOOGLE_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_SECRET_KEY,
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (LIVE), STRIPE_WEBHOOK_SECRET, THREEDLOOK_API_KEY,
TDLOOK_API_KEY.

## In progress (as of handoff)

- **Bridesmaid / group-order feature** — `bridesmaid.html` (untracked, newest file,
  last edited 2026-07-23). Title: "Perfect Bridesmaid & Suit Sizing Matching."
  Multi-slide onboarding wizard → digital twin → "Brand Fit Match Report" behind a paywall.
  New Supabase columns staged in `update_bridesmaid_schema.sql` (NOT yet confirmed run):
  `has_paid_bridesmaid_scan`, `has_paid_bridesmaid_report`, `shoulder` on `profiles`;
  paid flags on `store_profiles`. This is the coordinator/group-order direction.

## Watch-outs

- **134 uncommitted changes** on the working tree at handoff, incl. many `api/*` files
  and all main HTML pages. `bridesmaid.html` + several images are untracked. Nothing is
  committed for the bridesmaid feature yet — commit carefully / in logical chunks.
- Confirm `update_bridesmaid_schema.sql` has actually been run in Supabase before relying
  on those columns.
- Function-count consolidation pattern is deliberate — don't split routes back out.
- Live Stripe keys are in use.

## Current State — UPDATE THIS EACH SESSION

- 2026-07-23: Claude took over from Antigravity. Read repo, wrote this doc. No code changed
  yet. Next step pending user direction (likely: finish/commit bridesmaid group-order feature).
