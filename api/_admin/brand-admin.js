// Brand & Size Chart admin API (routed via store-api dispatcher as route=brand-admin).
// Full CRUD on brands + size charts, using the service-role client. Gated to admin
// accounts: the caller's Supabase access token must belong to an email in ADMIN_EMAILS.
//
// Body: { action, accessToken?, ... }  (token may also come from Authorization: Bearer)

import { supabaseAdmin } from '../_helpers/supabase-admin.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'sulaimonasalako@gmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

async function getAdmin(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token && req.body && req.body.accessToken) token = req.body.accessToken;
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data || !data.user) return null;
    const email = (data.user.email || '').toLowerCase();
    return ADMIN_EMAILS.includes(email) ? data.user : null;
  } catch (e) { return null; }
}

export default async function brandAdmin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const admin = await getAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Admin access required.' });

  const b = req.body || {};
  const action = b.action;

  try {
    // ---- BRANDS ----
    if (action === 'list-brands') {
      const { data: brands } = await supabaseAdmin
        .from('brands').select('id, name, domain, logo_url, category_aliases').order('name');
      const { data: charts } = await supabaseAdmin
        .from('size_charts').select('id, brand_id');
      const counts = {};
      (charts || []).forEach(c => { counts[c.brand_id] = (counts[c.brand_id] || 0) + 1; });
      return res.status(200).json({
        brands: (brands || []).map(x => ({ ...x, chart_count: counts[x.id] || 0 })),
      });
    }

    if (action === 'get-brand') {
      const { data: brand } = await supabaseAdmin
        .from('brands').select('id, name, domain, logo_url, category_aliases').eq('id', b.id).maybeSingle();
      if (!brand) return res.status(404).json({ error: 'Brand not found.' });
      const { data: charts } = await supabaseAdmin
        .from('size_charts').select('id, category, gender, chart_data, is_default, raw_source_url, created_at')
        .eq('brand_id', b.id).order('created_at', { ascending: false });
      return res.status(200).json({ brand, charts: charts || [] });
    }

    if (action === 'create-brand') {
      if (!b.name) return res.status(400).json({ error: 'Brand name is required.' });
      const { data, error } = await supabaseAdmin.from('brands')
        .insert({ name: b.name, domain: b.domain || null, logo_url: b.logo_url || null,
                  category_aliases: b.category_aliases || {} })
        .select('id').single();
      if (error) throw error;
      return res.status(200).json({ ok: true, id: data.id });
    }

    if (action === 'update-brand') {
      if (!b.id) return res.status(400).json({ error: 'Brand id required.' });
      const patch = {};
      ['name', 'domain', 'logo_url'].forEach(k => { if (b[k] !== undefined) patch[k] = b[k]; });
      if (b.category_aliases !== undefined) patch.category_aliases = b.category_aliases || {};
      const { error } = await supabaseAdmin.from('brands').update(patch).eq('id', b.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete-brand') {
      if (!b.id) return res.status(400).json({ error: 'Brand id required.' });
      await supabaseAdmin.from('size_charts').delete().eq('brand_id', b.id);
      const { error } = await supabaseAdmin.from('brands').delete().eq('id', b.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    // ---- SIZE CHARTS ----
    if (action === 'create-chart') {
      if (!b.brand_id) return res.status(400).json({ error: 'brand_id required.' });
      const { data, error } = await supabaseAdmin.from('size_charts')
        .insert({
          brand_id: b.brand_id,
          category: b.category || null,
          gender: b.gender || null,
          chart_data: b.chart_data || {},
          is_default: !!b.is_default,
          raw_source_url: b.raw_source_url || null,
        }).select('id').single();
      if (error) throw error;
      if (b.is_default) await unsetOtherDefaults(b.brand_id, b.category, data.id);
      return res.status(200).json({ ok: true, id: data.id });
    }

    if (action === 'update-chart') {
      if (!b.id) return res.status(400).json({ error: 'chart id required.' });
      const patch = {};
      ['category', 'gender', 'chart_data', 'is_default', 'raw_source_url'].forEach(k => {
        if (b[k] !== undefined) patch[k] = b[k];
      });
      const { error } = await supabaseAdmin.from('size_charts').update(patch).eq('id', b.id);
      if (error) throw error;
      if (b.is_default && b.brand_id) await unsetOtherDefaults(b.brand_id, b.category, b.id);
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete-chart') {
      if (!b.id) return res.status(400).json({ error: 'chart id required.' });
      const { error } = await supabaseAdmin.from('size_charts').delete().eq('id', b.id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('brand-admin error:', e);
    return res.status(500).json({ error: 'Admin request failed', detail: String((e && e.message) || e) });
  }
}

async function unsetOtherDefaults(brandId, category, keepId) {
  let q = supabaseAdmin.from('size_charts').update({ is_default: false }).eq('brand_id', brandId).neq('id', keepId);
  if (category) q = q.eq('category', category);
  await q;
}
