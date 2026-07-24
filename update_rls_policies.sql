-- ============================================================================
-- STYLA Measure — Row Level Security remediation for store_* tables
-- ============================================================================
-- Context: the anon key ships in client-side HTML. With RLS disabled, anyone
-- with that key can read/write every row of these tables (including plaintext
-- passwords in store_profiles). This migration locks them down.
--
-- Access model after this migration:
--   * store_products / store_categories  -> PUBLIC READ, writes server-only
--   * store_profiles / store_carts        -> SERVER-ONLY (no anon access at all)
--
-- The backend now uses the SERVICE ROLE key (see api/_helpers/supabase-admin.js),
-- which bypasses RLS entirely, so all legitimate server operations keep working.
-- The frontend no longer touches store_profiles directly (routed through
-- /api/store-auth). PREREQUISITE: SUPABASE_SERVICE_ROLE_KEY must be set in the
-- backend env BEFORE applying this, or backend writes will start failing.
--
-- Safe to run more than once (drops policies before recreating).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CATALOG TABLES — public read, server-only writes
-- ----------------------------------------------------------------------------

ALTER TABLE public.store_products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read products"   ON public.store_products;
DROP POLICY IF EXISTS "public read categories" ON public.store_categories;

-- Anyone (anon + logged in) may READ the catalog. No INSERT/UPDATE/DELETE
-- policy exists, so writes are denied to anon/authenticated and only the
-- service role (backend) can modify catalog data.
CREATE POLICY "public read products"
  ON public.store_products
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "public read categories"
  ON public.store_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- 2. USER-DATA TABLES — server-only (no anon/authenticated policies at all)
-- ----------------------------------------------------------------------------
-- With RLS enabled and NO policies, the anon and authenticated roles are fully
-- denied. Only the service role (which bypasses RLS) can access these. This is
-- what protects store_profiles.password and every cart row.

ALTER TABLE public.store_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_carts    ENABLE ROW LEVEL SECURITY;

-- Defensive: drop any pre-existing permissive policies if they were added.
DROP POLICY IF EXISTS "public read profiles" ON public.store_profiles;
DROP POLICY IF EXISTS "public read carts"    ON public.store_carts;

-- Belt-and-suspenders: explicitly revoke table privileges from the client roles
-- so even a policy added by mistake later cannot expose these tables.
REVOKE ALL ON public.store_profiles FROM anon, authenticated;
REVOKE ALL ON public.store_carts    FROM anon, authenticated;

-- ============================================================================
-- Verification (run manually after applying):
--   SELECT tablename, rowsecurity FROM pg_tables
--     WHERE schemaname='public' AND tablename LIKE 'store_%';
--   -- rowsecurity should be true for all four.
--   SELECT * FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'store_%';
--   -- should show only the two "public read" SELECT policies.
-- ============================================================================
