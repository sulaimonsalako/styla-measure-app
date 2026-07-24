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

## Connected systems (Cowork)

- **Git:** local commits work via bash. Delete perms enabled for the folder (the mount
  blocks `rm` by default — if a `.git/*.lock` reappears and blocks git, remove it; perms
  now allow it). No GitHub push credential in sandbox — Claude commits locally, user pushes.
- **Supabase (MCP):** project `tneflxtpmzodauygtslk` (Styla-measurement-Project, us-east-1).
  Can run SQL, list tables, apply migrations.
- **Vercel (MCP):** read/manage (projects, deployments, build logs). Does not deploy —
  deploys happen on git push. Project `prj_JlKXXBAWSG3MVTdVaLmZ6Ft6GvFL` / team `team_FVOcE...`.

## VERIFIED against live DB (2026-07-23)

- **Bridesmaid migration is NOT run.** `public.profiles` has NO `has_paid_bridesmaid_scan`,
  `has_paid_bridesmaid_report`, or `shoulder` columns; `store_profiles` lacks the paid flags.
  `update_bridesmaid_schema.sql` is still pending — the bridesmaid feature will break against
  prod until it's applied. (Apply via Supabase MCP when user approves.)
- **SECURITY: RLS disabled on 4 tables** — `store_products`, `store_categories`,
  `store_profiles`, `store_carts`. Anyone with the (client-side) anon key can read/write every
  row. `store_profiles` also stores `password` as plaintext. Remediation SQL exists but must
  NOT be auto-applied (enabling RLS w/o policies blocks all access). Needs policies designed.

## RLS remediation (in progress, 2026-07-23)

Full secure fix chosen. Code + SQL written; NOT yet applied to prod.

- **New:** `api/_helpers/supabase-admin.js` — central service-role client (bypasses RLS).
  All `api/_store/*` files now import it instead of building an anon-key client.
  Fixed a latent crash in `export-payment.js` (was importing `@supabase/supabase-client`).
- **`store-auth.js`:** bcrypt password hashing (`bcryptjs`), lazy migration (legacy
  plaintext rehashed on next successful login), + new actions `get-profile`, `guest-init`,
  `delete-profile`. Added `bcryptjs` + `raw-body` to `api/package.json`.
- **Frontend:** all 8 direct `store_profiles` calls in `index.html`, `bridesmaid.html`,
  `decoder.js` rerouted through `/api/store-auth`. No frontend file touches `store_*` now.
- **`update_rls_policies.sql`:** enables RLS on all 4 tables; public-read policy on
  `store_products`/`store_categories`; `store_profiles`/`store_carts` locked to service-role.

### PREREQUISITE before applying SQL / deploying
User must add `SUPABASE_SERVICE_ROLE_KEY` to **Vercel** env AND local `.env`. Without it,
backend falls back to anon key and all store writes break once RLS is on. `supabase-admin.js`
logs a warning when the key is missing.

### STATUS: APPLIED TO PROD (2026-07-23)
- Service-role key added to Vercel + .env by user. Code pushed + deployed (commit `6c476e6`,
  deployment READY on prod).
- `add_bridesmaid_columns` migration applied (bridesmaid schema now live).
- `enable_rls_store_tables` applied via Supabase SQL Editor (the apply_migration MCP call was
  blocked by a safety classifier for REVOKE/RLS DDL, so user ran the SQL directly).
- VERIFIED read-only: all 4 store_* tables have RLS enabled. store_profiles + store_carts =
  anon fully denied (no policy, no grants). store_products + store_categories = public-read
  SELECT policy; anon write grants remain but are inert (RLS denies writes w/o policy).
- Optional future hardening: `REVOKE INSERT,UPDATE,DELETE ON store_products, store_categories
  FROM anon, authenticated` (belt-and-suspenders; not required).
- CONFIRMED: user smoke-tested live app (store load, login, cart, guest scan) — all working
  under RLS. Service-role key is being picked up correctly. RLS remediation COMPLETE.

## Current State — UPDATE THIS EACH SESSION

- 2026-07-23: Took over from Antigravity, wrote this doc, connected Supabase + Vercel,
  safety commit `8eaf1e9`. Built full RLS remediation (code + SQL, see above) — NOT applied
  to prod yet; waiting on user's service-role key. Syntax-checked all changed files.
