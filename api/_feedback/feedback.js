// User feedback & requests (routed via store-api dispatcher as route=feedback).
// action 'submit' { type: brand|bug|idea|other, brand_name?, message } — auth required.

import { supabaseAdmin } from '../_helpers/supabase-admin.js';

export default async function feedback(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token && req.body && req.body.accessToken) token = req.body.accessToken;
  if (!token) return res.status(401).json({ error: 'Log in to send feedback.' });

  let user;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data || !data.user) return res.status(401).json({ error: 'Log in to send feedback.' });
    user = data.user;
  } catch (e) { return res.status(401).json({ error: 'Log in to send feedback.' }); }

  const b = req.body || {};
  if (b.action !== 'submit') return res.status(400).json({ error: `Unknown action: ${b.action}` });

  const type = ['brand', 'bug', 'idea', 'other'].includes(b.type) ? b.type : 'other';
  const message = (b.message || '').trim().slice(0, 2000);
  const brandName = (b.brand_name || '').trim().slice(0, 120) || null;
  if (!message && !brandName) return res.status(400).json({ error: 'Tell us a little more first.' });

  try {
    const { error } = await supabaseAdmin.from('feedback').insert({
      user_id: user.id,
      email: (user.email || '').toLowerCase(),
      type, brand_name: brandName, message: message || null,
    });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('feedback error:', e);
    return res.status(500).json({ error: 'Could not save your feedback — try again.' });
  }
}
