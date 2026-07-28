// Journal email capture (routed via store-api dispatcher as route=subscribe).
// Adapted from the journal pack's api/subscribe.js:
//  - lives under the store-api dispatcher (we are at Vercel's 12-function limit)
//  - uses the shared supabaseAdmin client (service role; RLS keeps the list unreadable)
//  - notification email goes through SendGrid (sendStylaMail) instead of Resend

import { supabaseAdmin } from '../_helpers/supabase-admin.js';
import { sendStylaMail } from '../_helpers/email-helper.js';

const NOTIFY_TO = 'contact@styla.ca';

// Crude in-memory rate limit — resets on cold start, enough to stop casual abuse.
const seen = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 5;
  const hits = (seen.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 5000) seen.clear();
  return hits.length > max;
}

export default async function subscribe(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many requests' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const email = String((body && body.email) || '').trim().toLowerCase();
  const source = String((body && body.source) || 'unknown').slice(0, 120);
  const bust = body && body.bust != null ? Number(body.bust) : null;
  const brandsNoSize = body && body.brandsNoSize != null ? Number(body.brandsNoSize) : null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const row = {
    email,
    source,
    bust_inches: Number.isFinite(bust) ? bust : null,
    brands_no_size: Number.isFinite(brandsNoSize) ? brandsNoSize : null,
    user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
    meta: { referer: String(req.headers.referer || '').slice(0, 500) },
  };

  try {
    const { error } = await supabaseAdmin
      .from('journal_subscribers')
      .upsert(row, { onConflict: 'email' });
    if (error) {
      console.error('subscribe: supabase error', error);
      return res.status(500).json({ error: 'Could not save that. Try again?' });
    }
  } catch (err) {
    console.error('subscribe: supabase upsert failed', err);
    return res.status(500).json({ error: 'Could not save that. Try again?' });
  }

  // Best-effort notification — never fail the request because of it.
  try {
    const lines = [
      'Email: ' + email,
      'Source: ' + source,
      row.bust_inches ? 'Bust entered: ' + row.bust_inches + '"' : null,
      row.brands_no_size != null ? 'Brands with no size for her: ' + row.brands_no_size : null,
    ].filter(Boolean);
    await sendStylaMail(NOTIFY_TO, 'New Journal signup — ' + source,
      '<pre style="font-family:Helvetica,Arial,sans-serif;font-size:14px">' + lines.join('\n') + '</pre>',
      lines.join('\n'));
  } catch (err) {
    console.error('subscribe: notification email failed', err);
  }

  return res.status(200).json({ ok: true });
}
