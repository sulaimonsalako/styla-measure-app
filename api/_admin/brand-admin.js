// Brand & Size Chart admin API (routed via store-api dispatcher as route=brand-admin).
// Full CRUD on brands + size charts, using the service-role client. Gated to admin
// accounts: the caller's Supabase access token must belong to an email in ADMIN_EMAILS.
//
// Body: { action, accessToken?, ... }  (token may also come from Authorization: Bearer)

import { supabaseAdmin } from '../_helpers/supabase-admin.js';
import { sendStylaMail } from '../_helpers/email-helper.js';

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


// Charts may be entered with the BRAND'S own column labels ("CHEST", "Hem",
// "胸围"). Map them onto the canonical keys the engine and the Styla admin read,
// while preserving the original table for the AI. Same contract as the Shopify app.
const CHART_KEY_MAP = {
  chest:'chest', bust:'chest', 'chest width':'chest', 'bust width':'chest', 'chest/bust':'chest', '\u80f8\u56f4':'chest',
  waist:'waist', 'waist width':'waist', '\u8170\u56f4':'waist',
  belly:'belly', abdomen:'belly', tummy:'belly',
  hip:'hips', hips:'hips', seat:'hips', hem:'hips', 'hem width':'hips', '\u6446\u56f4':'hips',
  shoulder:'shoulder', shoulders:'shoulder', 'shoulder width':'shoulder', '\u80a9\u5bbd':'shoulder',
  sleeve:'sleeve', 'sleeve length':'sleeve', '\u8896\u957f':'sleeve', 'short sleeve length':'sleeve',
  inseam:'inseam', 'inside leg':'inseam',
  thigh:'thigh', neck:'neck', collar:'neck', '\u9886\u56f4':'neck',
  length:'length', 'clothing length':'length', 'back length':'length', 'body length':'length', '\u8863\u957f':'length',
  height:'height',
};
function canonicalizeChart(cd) {
  if (!cd || !Array.isArray(cd.sizes)) return cd;
  const out = Object.assign({}, cd);
  out.display_columns = cd.columns || cd.display_columns || null;
  out.display_sizes = cd.sizes;
  out.sizes = cd.sizes.map((r) => {
    const o = { name: r.name };
    Object.keys(r).forEach((k) => {
      if (k === 'name') return;
      const key = CHART_KEY_MAP[String(k).trim().toLowerCase()];
      if (key && o[key] == null) o[key] = r[k];
    });
    return o;
  });
  return out;
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
        .from('brands').select('id, name, domain, logo_url, category_aliases, small_business, specialties, ships_worldwide, ships_to, origin_country, made_in, about').order('name');
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
        .from('brands').select('id, name, domain, logo_url, category_aliases, small_business, specialties, ships_worldwide, ships_to, origin_country, made_in, about').eq('id', b.id).maybeSingle();
      if (!brand) return res.status(404).json({ error: 'Brand not found.' });
      const { data: charts } = await supabaseAdmin
        .from('size_charts').select('id, category, subcategory, gender, chart_data, is_default, raw_source_url, source, verified, category_url, created_at')
        .eq('brand_id', b.id).order('created_at', { ascending: false });
      return res.status(200).json({ brand, charts: charts || [] });
    }

    if (action === 'create-brand') {
      if (!b.name) return res.status(400).json({ error: 'Brand name is required.' });
      const { data, error } = await supabaseAdmin.from('brands')
        .insert({ name: b.name, domain: b.domain || null, logo_url: b.logo_url || null,
                  origin_country: b.origin_country || null, made_in: b.made_in || null,
                  category_aliases: b.category_aliases || {} })
        .select('id').single();
      if (error) throw error;
      return res.status(200).json({ ok: true, id: data.id });
    }

    if (action === 'update-brand') {
      if (!b.id) return res.status(400).json({ error: 'Brand id required.' });
      const patch = {};
      ['name', 'domain', 'logo_url', 'origin_country', 'made_in', 'about'].forEach(k => { if (b[k] !== undefined) patch[k] = b[k]; });
      if (b.small_business !== undefined) patch.small_business = !!b.small_business;
      if (b.specialties !== undefined) patch.specialties = Array.isArray(b.specialties) ? b.specialties.filter(Boolean) : [];
      if (b.ships_worldwide !== undefined) patch.ships_worldwide = !!b.ships_worldwide;
      if (b.ships_to !== undefined) patch.ships_to = Array.isArray(b.ships_to) ? b.ships_to.filter(Boolean) : [];
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
          chart_data: canonicalizeChart(b.chart_data || {}),
          is_default: !!b.is_default,
          raw_source_url: b.raw_source_url || null,
          source: b.source || 'admin',
          verified: !!b.verified,
          category_url: b.category_url || null,
          subcategory: b.subcategory || null,
        }).select('id').single();
      if (error) throw error;
      if (b.is_default) await unsetOtherDefaults(b.brand_id, b.category, data.id);
      return res.status(200).json({ ok: true, id: data.id });
    }

    if (action === 'update-chart') {
      if (!b.id) return res.status(400).json({ error: 'chart id required.' });
      const patch = {};
      if (b.chart_data !== undefined) b.chart_data = canonicalizeChart(b.chart_data);
      ['category', 'subcategory', 'gender', 'chart_data', 'is_default', 'raw_source_url', 'source', 'verified', 'category_url'].forEach(k => {
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

    // ---- FEEDBACK QUEUE ----
    if (action === 'list-feedback') {
      const { data } = await supabaseAdmin.from('feedback')
        .select('id, email, type, brand_name, message, status, created_at')
        .order('created_at', { ascending: false }).limit(200);
      return res.status(200).json({ feedback: data || [] });
    }

    if (action === 'update-feedback') {
      if (!b.id || !b.status) return res.status(400).json({ error: 'id and status required.' });
      const { data: row } = await supabaseAdmin.from('feedback')
        .select('email, type, brand_name, status').eq('id', b.id).maybeSingle();
      const { error } = await supabaseAdmin.from('feedback').update({ status: b.status }).eq('id', b.id);
      if (error) throw error;
      // Brand request fulfilled -> tell the person who asked.
      if (b.status === 'done' && row && row.type === 'brand' && row.email && row.status !== 'done') {
        try {
          const bn = row.brand_name || 'The brand you asked for';
          await sendStylaMail(row.email, bn + ' is now on Styla 🎉',
            '<div style="font-family:Helvetica,Arial,sans-serif;background:#0b0b14;color:#fff;padding:36px 24px;max-width:600px;margin:0 auto;border-radius:8px">'
            + '<h2 style="font-family:Georgia,serif;margin:0 0 10px">' + bn + ' just landed on Styla</h2>'
            + '<p style="color:#cbd5e1;line-height:1.6">You asked, we added it. Your size in ' + bn + ' is already waiting in your matches.</p>'
            + '<a href="https://www.styla.ca/dashboard.html" style="display:inline-block;background:linear-gradient(135deg,#e11d48,#ff2a75);color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:100px;margin-top:8px">See my size</a></div>',
            bn + ' is now on Styla — see your size: https://www.styla.ca/dashboard.html');
        } catch (e) { /* non-fatal */ }
      }
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
