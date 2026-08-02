// Notifications (routed via store-api dispatcher as route=notifications).
// Social-style inbox for the logged-in user. Notifications are DERIVED from
// existing tables — no separate write path — with an unread light driven by
// profiles.notifications_seen_at.
//
// Actions (POST body { action, ... }, auth required):
//   list           {}                 -> { items:[...], unread:N }
//   mark-seen      {}                 -> clears the unread light (sets seen-at = now)
//   respond-share  { id, accept }     -> accept/decline a size-share invited to me

import { supabaseAdmin } from '../_helpers/supabase-admin.js';

async function getUser(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token && req.body && req.body.accessToken) token = req.body.accessToken;
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (e) { return null; }
}

const SITE = process.env.SITE_URL || 'https://www.styla.ca';

export default async function notifications(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const b = req.body || {};
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const myId = user.id;
  const myEmail = (user.email || '').toLowerCase();

  try {
    if (b.action === 'mark-seen') {
      await supabaseAdmin.from('profiles').update({ notifications_seen_at: new Date().toISOString() }).eq('id', myId);
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'respond-share') {
      if (!b.id) return res.status(400).json({ error: 'Missing id.' });
      const { data: share } = await supabaseAdmin.from('profile_shares')
        .select('id, shared_with_email, owner_email, owner_id, status').eq('id', b.id).maybeSingle();
      if (!share) return res.status(404).json({ error: 'Not found.' });

      const isShareOffer = share.status === 'pending' && (share.shared_with_email || '').toLowerCase() === myEmail; // I'm the shopper
      const isRequest = share.status === 'requested' && (share.owner_email || '').toLowerCase() === myEmail;        // I'm the source
      if (!isShareOffer && !isRequest) return res.status(403).json({ error: 'This request is not for you.' });

      let upd;
      if (!b.accept) upd = { status: 'declined', declined_at: new Date().toISOString() };
      else if (isRequest) upd = { owner_id: myId, owner_email: myEmail, status: 'accepted', accepted_at: new Date().toISOString() };
      else upd = { shared_with_id: myId, status: 'accepted', accepted_at: new Date().toISOString() };
      await supabaseAdmin.from('profile_shares').update(upd).eq('id', share.id);
      return res.status(200).json({ ok: true, accepted: !!b.accept });
    }

    if (b.action === 'list') {
      const { data: prof } = await supabaseAdmin.from('profiles')
        .select('notifications_seen_at').eq('id', myId).maybeSingle();
      const seenAt = prof && prof.notifications_seen_at ? new Date(prof.notifications_seen_at).getTime() : 0;
      const items = [];

      // 1a) Someone shared THEIR size with me (I can shop for them) — awaiting my accept.
      const { data: incoming } = await supabaseAdmin.from('profile_shares')
        .select('id, owner_email, relationship, status, created_at')
        .eq('shared_with_email', myEmail).eq('status', 'pending')
        .order('created_at', { ascending: false });
      (incoming || []).forEach(s => items.push({
        kind: 'share_offer', id: s.id, at: s.created_at,
        title: (s.owner_email || 'Someone') + ' shared their size with you',
        body: 'Accept to shop for them with confidence' + (s.relationship ? ' (' + s.relationship + ')' : '') + '.',
        actions: ['accept', 'decline'],
      }));

      // 1b) Someone asked to shop for ME (they need my size) — awaiting my approval.
      const { data: requests } = await supabaseAdmin.from('profile_shares')
        .select('id, shared_with_email, relationship, status, created_at')
        .eq('owner_email', myEmail).eq('status', 'requested')
        .order('created_at', { ascending: false });
      (requests || []).forEach(s => items.push({
        kind: 'shop_request', id: s.id, at: s.created_at,
        title: (s.shared_with_email || 'Someone') + ' wants to shop for you',
        body: 'Approve to let them see your size (never your measurements)' + (s.relationship ? ' (' + s.relationship + ')' : '') + '.',
        actions: ['accept', 'decline'],
      }));

      // 2) Wedding-party invites sent to MY email, not yet completed (actionable).
      const { data: invites } = await supabaseAdmin.from('party_members')
        .select('id, party_id, status, created_at').eq('email', myEmail).eq('status', 'invited')
        .order('created_at', { ascending: false });
      if ((invites || []).length) {
        const pids = invites.map(i => i.party_id);
        const { data: parties } = await supabaseAdmin.from('wedding_parties')
          .select('id, name, token, owner_email').in('id', pids);
        const pmap = {}; (parties || []).forEach(p => { pmap[p.id] = p; });
        invites.forEach(iv => {
          const p = pmap[iv.party_id]; if (!p) return;
          items.push({
            kind: 'party_invite', id: iv.id, at: iv.created_at,
            title: 'You’re invited to ' + (p.name || 'a wedding party'),
            body: (p.owner_email || 'The coordinator') + ' needs your size. Use your saved fit — no quiz.',
            join_url: SITE + '/start.html?party=' + p.token + '&member=' + iv.id,
            actions: ['join'],
          });
        });
      }

      // 3) Info: shares I created that were accepted (no action, just news).
      const { data: accepted } = await supabaseAdmin.from('profile_shares')
        .select('id, shared_with_email, accepted_at').eq('owner_id', myId).eq('status', 'accepted')
        .order('accepted_at', { ascending: false }).limit(10);
      (accepted || []).forEach(s => { if (s.accepted_at) items.push({
        kind: 'share_accepted', id: 'acc_' + s.id, at: s.accepted_at,
        title: (s.shared_with_email || 'Someone') + ' accepted your size share',
        body: 'They can now see your size and shop for you.',
        actions: [],
      }); });

      items.sort((a, c) => new Date(c.at).getTime() - new Date(a.at).getTime());
      const unread = items.filter(i => new Date(i.at).getTime() > seenAt).length;
      return res.status(200).json({ items, unread });
    }

    return res.status(400).json({ error: `Unknown action: ${b.action}` });
  } catch (e) {
    console.error('notifications error:', e);
    return res.status(500).json({ error: 'Could not load notifications', detail: String((e && e.message) || e) });
  }
}
