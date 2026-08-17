// Centralized server-side Supabase client.
//
// Uses the SERVICE ROLE key, which bypasses Row Level Security (RLS). This is
// safe ONLY on the server (Vercel serverless functions) and must NEVER be
// imported into client-side code. With RLS enabled on the store_* tables, the
// anon key can no longer read/write store_profiles or store_carts, so all
// backend access must go through this admin client.
//
// Falls back to the anon key if the service role key is not configured, so the
// app keeps working during rollout — but a warning is logged because writes to
// RLS-protected tables will fail under the anon key once RLS is on.

import { createClient } from '@supabase/supabase-js';

// SUPABASE_URL and the anon key are public (they ship in the client HTML), so we
// fall back to hardcoded values if the env vars are missing — this keeps the
// server from crashing with "supabaseUrl is required" and lets READ paths work
// via the public-read RLS policies. The SERVICE ROLE key is secret and stays
// env-only; without it, writes to RLS-protected tables will fail (as intended).
const PUBLIC_URL = 'https://tneflxtpmzodauygtslk.supabase.co';
const PUBLIC_ANON = 'sb_publishable_ofY7_ihU8ztHhxLohqXQLg_fypNnb2M';

const supabaseUrl = process.env.SUPABASE_URL || PUBLIC_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || PUBLIC_ANON;

if (!serviceRoleKey) {
  console.warn(
    '[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to the anon key. ' +
    'Reads work via public-read policies, but backend WRITES to RLS-protected tables will FAIL ' +
    'until this key is configured in Vercel.'
  );
}

const key = serviceRoleKey || anonKey;

export const supabaseAdmin = createClient(supabaseUrl, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// True when a real service role key is in use (RLS bypass active).
export const hasServiceRole = Boolean(serviceRoleKey);

export default supabaseAdmin;
