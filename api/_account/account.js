// Account management API (routed via store-api dispatcher as route=account).
// Currently: delete-account — permanently removes the user's auth account and data.

import { supabaseAdmin } from '../_helpers/supabase-admin.js';

export default async function account(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token && req.body && req.body.accessToken) token = req.body.accessToken;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  let user;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data || !data.user) return res.status(401).json({ error: 'Not authenticated' });
    user = data.user;
  } catch (e) { return res.status(401).json({ error: 'Not authenticated' }); }

  const action = (req.body || {}).action;

  try {
    if (action === 'delete-account') {
      const uid = user.id;
      const email = (user.email || '').toLowerCase();

      // Data rows first (FKs on profiles cascade to parties/shares, but be explicit).
      await supabaseAdmin.from('profile_shares').delete().or(`owner_id.eq.${uid},shared_with_id.eq.${uid}`);
      await supabaseAdmin.from('wedding_parties').delete().eq('owner_id', uid);
      await supabaseAdmin.from('profiles').delete().eq('id', uid);
      if (email) { try { await supabaseAdmin.from('store_profiles').delete().eq('username', email); } catch (e) {} }

      // Finally the auth user (requires the service-role key).
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
      if (delErr) throw delErr;

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('account error:', e);
    return res.status(500).json({ error: 'Account request failed', detail: String((e && e.message) || e) });
  }
}
