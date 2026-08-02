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
import { sendShareInviteEmail, sendStylaMail } from '../_helpers/email-helper.js';

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

    // ---- REQUEST: ask someone to let ME shop for them (they become the source) ----
    if (action === 'request') {
      const targetEmail = (body.owner_email || body.email || '').trim().toLowerCase();
      const relationship = (body.relationship || '').trim() || null;
      if (!targetEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(targetEmail)) {
        return res.status(400).json({ error: 'A valid email is required.' });
      }
      if (targetEmail === myEmail) return res.status(400).json({ error: "You can't request your own size." });

      // Reuse an existing non-revoked connection with this person in this direction.
      const { data: existing } = await supabaseAdmin
        .from('profile_shares')
        .select('id, token, status')
        .eq('shared_with_id', myId)
        .eq('owner_email', targetEmail)
        .neq('status', 'revoked')
        .maybeSingle();

      let row = existing;
      if (!row) {
        const token = crypto.randomBytes(20).toString('hex');
        const { data: created, error: insErr } = await supabaseAdmin
          .from('profile_shares')
          .insert({
            owner_id: null, owner_email: targetEmail,
            shared_with_id: myId, shared_with_email: myEmail,
            relationship, status: 'requested', token,
          })
          .select('id, token, status')
          .single();
        if (insErr) throw insErr;
        row = created;
      }

      const site = process.env.SITE_URL || 'https://www.styla.ca';
      const acceptUrl = `${site}/share.html?token=${row.token}`;
      try {
        await sendStylaMail(targetEmail, `${myEmail} wants to shop for you on Styla`,
          `<div style="font-family:Helvetica,Arial,sans-serif;background:#0b0b14;color:#fff;padding:34px 24px;max-width:600px;margin:0 auto;border-radius:8px">`
          + `<h2 style="font-family:Georgia,serif;margin:0 0 10px">${myEmail} wants to shop for you</h2>`
          + `<p style="color:#cbd5e1;line-height:1.6">They'd like to buy you the right size. Approve it and they'll see your Styla size (never your measurements). Already have a Styla account? Just log in — no need to make a new one.</p>`
          + `<a href="${acceptUrl}" style="display:inline-block;background:linear-gradient(135deg,#e11d48,#ff2a75);color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:100px;margin-top:8px">Review the request</a></div>`,
          `${myEmail} wants to shop for you on Styla. Review: ${acceptUrl}`);
      } catch (mailErr) { console.error('[connections] request email failed:', mailErr.message); }

      return res.status(200).json({ ok: true, request: { id: row.id, status: row.status }, link: acceptUrl });
    }

    // ---- INFO: what kind of invite is this token? (so the accept page shows the right copy) ----
    if (action === 'info') {
      const token = (body.token || '').trim();
      if (!token) return res.status(400).json({ error: 'Missing token.' });
      const { data: s } = await supabaseAdmin.from('profile_shares')
        .select('status, owner_email, shared_with_email, relationship').eq('token', token).maybeSingle();
      if (!s) return res.status(404).json({ error: 'This link is invalid or has been revoked.' });
      // 'requested' -> I'm being asked to share MY size (I'm the owner). Otherwise a share offer.
      const kind = s.status === 'requested' ? 'request' : 'offer';
      return res.status(200).json({
        kind, status: s.status, relationship: s.relationship || null,
        counterpart: kind === 'request' ? s.shared_with_email : s.owner_email,
      });
    }

    // ---- LIST: both directions, all live statuses ----
    if (action === 'list') {
      // People I can shop for (accepted, I'm the shopper) + outgoing requests I made.
      const { data: iCanShopFor } = await supabaseAdmin
        .from('profile_shares')
        .select('id, owner_id, owner_email, relationship, status, created_at')
        .or(`shared_with_id.eq.${myId},shared_with_email.eq.${myEmail}`)
        .neq('status', 'revoked')
        .order('created_at', { ascending: false });

      // People who can shop for me (my size is shared) + requests awaiting my approval.
      const { data: canShopForMe } = await supabaseAdmin
        .from('profile_shares')
        .select('id, shared_with_email, relationship, status, created_at, accepted_at')
        .or(`owner_id.eq.${myId},owner_email.eq.${myEmail}`)
        .neq('status', 'revoked')
        .order('created_at', { ascending: false });

      // sharedWithMe keeps the old shape (accepted only) so the widgets keep working.
      const sharedWithMe = (iCanShopFor || []).filter((r) => r.status === 'accepted' && r.owner_id);
      return res.status(200).json({
        sharedWithMe,
        iCanShopFor: iCanShopFor || [],
        canShopForMe: canShopForMe || [],
        sharedByMe: canShopForMe || [], // backward-compat alias
      });
    }

    // ---- ACCEPT: role-aware. A share offer -> I'm the shopper. A request -> I'm the source. ----
    if (action === 'accept') {
      const token = (body.token || '').trim();
      if (!token) return res.status(400).json({ error: 'Missing token.' });

      const { data: share, error: findErr } = await supabaseAdmin
        .from('profile_shares')
        .select('id, owner_id, owner_email, shared_with_email, status')
        .eq('token', token)
        .maybeSingle();
      if (findErr) throw findErr;
      if (!share) return res.status(404).json({ error: 'This link is invalid or has been revoked.' });
      if (share.status === 'accepted') return res.status(200).json({ ok: true, already: true, ownerId: share.owner_id });

      let upd;
      if (share.status === 'requested') {
        // Someone asked to shop for ME -> I approve, becoming the source.
        upd = { owner_id: myId, owner_email: myEmail, status: 'accepted', accepted_at: new Date().toISOString() };
      } else {
        // Someone shared THEIR size with me -> I'm the shopper.
        upd = { shared_with_id: myId, shared_with_email: myEmail, status: 'accepted', accepted_at: new Date().toISOString() };
      }
      const { error: updErr } = await supabaseAdmin.from('profile_shares').update(upd).eq('id', share.id);
      if (updErr) throw updErr;
      return res.status(200).json({ ok: true, ownerId: share.status === 'requested' ? myId : share.owner_id });
    }

    // ---- DECLINE: decline an incoming invite/request by token ----
    if (action === 'decline' || action === 'respond-decline') {
      const token = (body.token || '').trim();
      if (!token) return res.status(400).json({ error: 'Missing token.' });
      await supabaseAdmin.from('profile_shares')
        .update({ status: 'declined', declined_at: new Date().toISOString() })
        .eq('token', token).neq('status', 'accepted');
      return res.status(200).json({ ok: true });
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
