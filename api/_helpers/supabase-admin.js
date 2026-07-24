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

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';

if (!serviceRoleKey) {
  console.warn(
    '[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to the anon key. ' +
    'Once RLS is enabled on store_* tables, backend writes will FAIL until this key is configured.'
  );
}

const key = serviceRoleKey || anonKey;

export const supabaseAdmin = createClient(supabaseUrl, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// True when a real service role key is in use (RLS bypass active).
export const hasServiceRole = Boolean(serviceRoleKey);

export default supabaseAdmin;
