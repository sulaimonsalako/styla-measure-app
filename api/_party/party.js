// Wedding-party API (routed via store-api dispatcher as route=party).
// Group fit: each member answers privately; the coordinator pays once ($29.99)
// to unlock the styles that fit EVERYONE, with each person's own size.
//
// Actions (POST body { action, ... }):
//   create-party    (auth)         { name, garment_category }          -> { id, token }
//   list-parties    (auth)         {}                                   -> { parties:[...] }
//   add-members     (auth owner)   { party_id, members:[{name,email}] } -> emails invites
//   get-party       (auth owner)   { party_id }                         -> { party, members }
//   party-info      (public)       { token }                           -> { name } (for the join page)
//   submit-member   (public)       { token, member_id, name, measurements } -> saves a member's fit
//   get-report      (auth owner)   { party_id }                        -> intersection report (needs has_paid_report)

import crypto from 'crypto';
import { supabaseAdmin } from '../_helpers/supabase-admin.js';
import { runSizingEngine } from '../_helpers/sizing-engine.js';
import { normalizeChart } from '../_helpers/normalize-chart.js';
import { sendWeddingInviteEmail } from '../_helpers/email-helper.js';

const SITE = process.env.SITE_URL || 'https://www.styla.ca';

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

async function ownedParty(partyId, userId) {
  const { data } = await supabaseAdmin.from('wedding_parties')
    .select('*').eq('id', partyId).eq('owner_id', userId).maybeSingle();
  return data || null;
}

export default async function party(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const b = req.body || {};
  const action = b.action;

  try {
    // ---- Public: minimal party info for a member's join page ----
    if (action === 'party-info') {
      const { data } = await supabaseAdmin.from('wedding_parties')
        .select('name, garment_category').eq('token', b.token).maybeSingle();
      if (!data) return res.status(404).json({ error: 'This party link is invalid.' });
      return res.status(200).json({ name: data.name, garment_category: data.garment_category });
    }

    // ---- Public: a member submits their fit (no account needed) ----
    if (action === 'submit-member') {
      const { token, member_id, name, measurements } = b;
      if (!token || !member_id || !measurements) return res.status(400).json({ error: 'Missing details.' });
      const { data: pt } = await supabaseAdmin.from('wedding_parties').select('id').eq('token', token).maybeSingle();
      if (!pt) return res.status(404).json({ error: 'Invalid party link.' });
      const { error } = await supabaseAdmin.from('party_members')
        .update({ name: name || undefined, measurements, status: 'completed' })
        .eq('id', member_id).eq('party_id', pt.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ---- Everything below needs an authenticated coordinator ----
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    if (action === 'create-party') {
      if (!b.name) return res.status(400).json({ error: 'Party name is required.' });
      const token = crypto.randomBytes(12).toString('hex');
      const { data, error } = await supabaseAdmin.from('wedding_parties')
        .insert({ owner_id: user.id, owner_email: (user.email || '').toLowerCase(),
                  name: b.name, garment_category: b.garment_category || 'dresses', token })
        .select('id, token').single();
      if (error) throw error;
      return res.status(200).json({ ok: true, id: data.id, token: data.token });
    }

    if (action === 'list-parties') {
      const { data: parties } = await supabaseAdmin.from('wedding_parties')
        .select('id, name, garment_category, has_paid_report, created_at')
        .eq('owner_id', user.id).order('created_at', { ascending: false });
      const ids = (parties || []).map(p => p.id);
      let counts = {};
      if (ids.length) {
        const { data: mem } = await supabaseAdmin.from('party_members').select('party_id, status').in('party_id', ids);
        (mem || []).forEach(m => {
          counts[m.party_id] = counts[m.party_id] || { total: 0, done: 0 };
          counts[m.party_id].total++;
          if (m.status === 'completed') counts[m.party_id].done++;
        });
      }
      return res.status(200).json({ parties: (parties || []).map(p => ({ ...p, members: counts[p.id] || { total: 0, done: 0 } })) });
    }

    if (action === 'get-party') {
      const p = await ownedParty(b.party_id, user.id);
      if (!p) return res.status(404).json({ error: 'Party not found.' });
      const { data: members } = await supabaseAdmin.from('party_members')
        .select('id, name, email, status, created_at').eq('party_id', p.id).order('created_at');
      return res.status(200).json({ party: p, members: members || [] });
    }

    if (action === 'add-members') {
      const p = await ownedParty(b.party_id, user.id);
      if (!p) return res.status(404).json({ error: 'Party not found.' });
      const list = (b.members || []).filter(m => m && m.email);
      if (!list.length) return res.status(400).json({ error: 'Add at least one member with an email.' });
      const rows = list.map(m => ({ party_id: p.id, name: m.name || null, email: m.email.trim().toLowerCase(), status: 'invited' }));
      const { data: inserted, error } = await supabaseAdmin.from('party_members').insert(rows).select('id, name, email');
      if (error) throw error;
      // Best-effort invites.
      for (const m of (inserted || [])) {
        try {
          await sendWeddingInviteEmail(m.email, {
            coordinatorName: (user.email || 'A friend'),
            partyName: p.name,
            inviteUrl: `${SITE}/start.html?party=${p.token}&member=${m.id}`,
          });
        } catch (e) { /* non-fatal */ }
      }
      return res.status(200).json({ ok: true, added: (inserted || []).length });
    }

    if (action === 'get-report') {
      const p = await ownedParty(b.party_id, user.id);
      if (!p) return res.status(404).json({ error: 'Party not found.' });
      if (!p.has_paid_report) return res.status(402).json({ error: 'Report locked. Unlock the party report to view matches.' });

      const { data: members } = await supabaseAdmin.from('party_members')
        .select('id, name, measurements, status').eq('party_id', p.id);
      const done = (members || []).filter(m => m.status === 'completed' && m.measurements);
      if (done.length < 1) return res.status(200).json({ styles: [], note: 'No members have completed their fit yet.' });

      const { data: charts } = await supabaseAdmin.from('size_charts')
        .select('id, brand_id, category, gender, chart_data');
      const { data: brandRows } = await supabaseAdmin.from('brands').select('id, name, logo_url');
      const brandMap = {}; (brandRows || []).forEach(x => { brandMap[x.id] = x; });

      const cat = p.garment_category;
      const styles = [];
      for (const c of (charts || [])) {
        const cd = c.chart_data || {};
        const chartCat = (cd.garment_category || c.category);
        if (cat && chartCat !== cat) continue;
        const norm = normalizeChart(cd, { flatMeasures: cd.flat_measures || [] });
        if (!norm.sizes.length) continue;

        const perMember = [];
        let fitsAll = true;
        let worst = 100;
        for (const m of done) {
          const mm = m.measurements || {};
          const userBody = { chest: mm.chest, waist: mm.waist, belly: mm.belly ?? mm.waist, hips: mm.hips,
                             shoulder: mm.shoulder, inseam: mm.inseam, neck: mm.neck };
          const r = runSizingEngine(userBody, norm);
          if (r.warning || !r.recommended_size) { fitsAll = false; break; }
          worst = Math.min(worst, r.fit_match_score);
          perMember.push({ name: m.name || 'Member', size: r.recommended_size, score: r.fit_match_score });
        }
        if (!fitsAll) continue;
        const brand = brandMap[c.brand_id] || {};
        styles.push({ brand: brand.name || 'Unknown', logo: brand.logo_url || null,
                      category: norm.garment_category, group_score: worst, members: perMember });
      }
      styles.sort((a, b2) => b2.group_score - a.group_score);
      return res.status(200).json({ styles: styles.slice(0, 20), memberCount: done.length });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('party error:', e);
    return res.status(500).json({ error: 'Party request failed', detail: String((e && e.message) || e) });
  }
}
