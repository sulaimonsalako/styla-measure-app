// Size-sharing / connections API  (routed via store-api dispatcher as route=connections)
//
// Lets a user share their fit profile with someone else — for gifting, a personal
// stylist, or a partner — so the recipient can see their size and shop on their behalf.
//
// Actions (POST body { action, ... }):
//   create      { shared_with_email, relationship }         -> owner shares their size; emails an invite link
//   list        {}                                          -> { sharedByMe:[...], sharedWithMe:[...] }
//   accept      { token }                                   -> recipient accepts a share
//   revoke      { id }                                      -> owner revokes a share they created
//   get-profile { ownerId }                                 -> the shared person's fit profile (permission-checked)
//
// Auth: the caller's Supabase access token must be sent as `Authorization: Bearer <token>`
// (or body.accessToken). All DB access uses the service-role client; RLS denies the anon key.

import crypto from 'crypto';
import { supabaseAdmin } from '../_helpers/supabase-admin.js';
import { sendShareInviteEmail } from '../_helpers/email-helper.js';

const MEASURE_COLS = 'id, email, chest, waist, hips, belly, shoulder, height, inseam';

async function getUser(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token && req.body && req.body.accessToken) token = req.body.accessToken;
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (e) {
    return null;
  }
}

export default async function connections(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = req.body || {};
  const action = body.action;

  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const myId = user.id;
  const myEmail = (user.email || '').toLowerCase();

  try {
    // ---- CREATE: share my size with someone ----
    if (action === 'create') {
      const sharedWith = (body.shared_with_email || '').trim().toLowerCase();
      const relationship = (body.relationship || '').trim() || null;
      if (!sharedWith || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(sharedWith)) {
        return res.status(400).json({ error: 'A valid email is required.' });
      }
      if (sharedWith === myEmail) {
        return res.status(400).json({ error: "You can't share your size with yourself." });
      }

      // Reuse an existing pending/accepted share to the same person if present.
      const { data: existing } = await supabaseAdmin
        .from('profile_shares')
        .select('id, token, status')
        .eq('owner_id', myId)
        .eq('shared_with_email', sharedWith)
        .neq('status', 'revoked')
        .maybeSingle();

      let share = existing;
      if (!share) {
        const token = crypto.randomBytes(20).toString('hex');
        const { data: created, error: insErr } = await supabaseAdmin
          .from('profile_shares')
          .insert({
            owner_id: myId,
            owner_email: myEmail,
            shared_with_email: sharedWith,
            relationship,
            status: 'pending',
            token,
          })
          .select('id, token, status')
          .single();
        if (insErr) throw insErr;
        share = created;
      }

      const site = process.env.SITE_URL || 'https://www.styla.ca';
      const acceptUrl = `${site}/share.html?token=${share.token}`;

      // Best-effort invite email (never blocks the response).
      try {
        await sendShareInviteEmail(sharedWith, {
          ownerEmail: myEmail,
          relationship,
          acceptUrl,
        });
      } catch (mailErr) {
        console.error('[connections] invite email failed (non-fatal):', mailErr.message);
      }

      return res.status(200).json({ ok: true, share: { id: share.id, status: share.status }, link: acceptUrl });
    }

    // ---- LIST: both directions ----
    if (action === 'list') {
      const { data: sharedByMe } = await supabaseAdmin
        .from('profile_shares')
        .select('id, shared_with_email, relationship, status, created_at, accepted_at')
        .eq('owner_id', myId)
        .neq('status', 'revoked')
        .order('created_at', { ascending: false });

      const { data: sharedWithMe } = await supabaseAdmin
        .from('profile_shares')
        .select('id, owner_id, owner_email, relationship, status, created_at')
        .or(`shared_with_id.eq.${myId},shared_with_email.eq.${myEmail}`)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      return res.status(200).json({ sharedByMe: sharedByMe || [], sharedWithMe: sharedWithMe || [] });
    }

    // ---- ACCEPT: recipient accepts a share via token ----
    if (action === 'accept') {
      const token = (body.token || '').trim();
      if (!token) return res.status(400).json({ error: 'Missing token.' });

      const { data: share, error: findErr } = await supabaseAdmin
        .from('profile_shares')
        .select('id, owner_id, owner_email, shared_with_email, status')
        .eq('token', token)
        .maybeSingle();
      if (findErr) throw findErr;
      if (!share) return res.status(404).json({ error: 'This share link is invalid or has been revoked.' });

      const { error: updErr } = await supabaseAdmin
        .from('profile_shares')
        .update({ shared_with_id: myId, shared_with_email: myEmail, status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', share.id);
      if (updErr) throw updErr;

      return res.status(200).json({ ok: true, ownerId: share.owner_id, ownerEmail: share.owner_email });
    }

    // ---- REVOKE: owner removes a share ----
    if (action === 'revoke') {
      const id = body.id;
      if (!id) return res.status(400).json({ error: 'Missing id.' });
      const { error: revErr } = await supabaseAdmin
        .from('profile_shares')
        .update({ status: 'revoked' })
        .eq('id', id)
        .eq('owner_id', myId);
      if (revErr) throw revErr;
      return res.status(200).json({ ok: true });
    }

    // ---- GET-PROFILE: fetch a shared person's fit profile (permission-checked) ----
    if (action === 'get-profile') {
      const ownerId = body.ownerId;
      if (!ownerId) return res.status(400).json({ error: 'Missing ownerId.' });

      // Confirm an accepted share exists from ownerId to me.
      const { data: perm } = await supabaseAdmin
        .from('profile_shares')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('status', 'accepted')
        .or(`shared_with_id.eq.${myId},shared_with_email.eq.${myEmail}`)
        .maybeSingle();
      if (!perm) return res.status(403).json({ error: "You don't have access to this person's size." });

      const { data: profile, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select(MEASURE_COLS)
        .eq('id', ownerId)
        .maybeSingle();
      if (profErr) throw profErr;
      if (!profile) return res.status(404).json({ error: 'Profile not found.' });

      return res.status(200).json({ profile });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('connections error:', e);
    return res.status(500).json({ error: 'Sharing request failed', detail: String((e && e.message) || e) });
  }
}
