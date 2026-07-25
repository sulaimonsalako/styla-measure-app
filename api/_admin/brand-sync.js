// Brand product sync (routed via store-api dispatcher as route=brand-sync). Admin-gated.
//
// Pulls a brand's product catalog into products_cache so the recommender can resolve
// categories per product and stays current with simple setup.
//
//   action 'sync-shopify' { brand_id, domain }        -> fetch {domain}/products.json (public, no app needed)
//   action 'sync-manual'  { brand_id, products:[...] } -> upsert a provided list (Woo/custom feeds)
//
// Each product row: { brand_id, url, title, category (product_type), source }.

import { supabaseAdmin } from '../_helpers/supabase-admin.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'sulaimonasalako@gmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

async function isAdmin(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token && req.body && req.body.accessToken) token = req.body.accessToken;
  if (!token) return false;
  try {
    const { data } = await supabaseAdmin.auth.getUser(token);
    return !!(data && data.user && ADMIN_EMAILS.includes((data.user.email || '').toLowerCase()));
  } catch (e) { return false; }
}

function cleanDomain(d) {
  return String(d || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

async function upsertProducts(rows) {
  if (!rows.length) return 0;
  // Chunk to keep payloads reasonable.
  let total = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabaseAdmin.from('products_cache').upsert(chunk, { onConflict: 'url' });
    if (error) throw error;
    total += chunk.length;
  }
  return total;
}

export default async function brandSync(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin access required.' });

  const b = req.body || {};
  try {
    if (b.action === 'sync-shopify') {
      if (!b.brand_id || !b.domain) return res.status(400).json({ error: 'brand_id and domain are required.' });
      const domain = cleanDomain(b.domain);
      const now = new Date().toISOString();
      const rows = [];
      // Shopify exposes /products.json publicly, paginated up to 250/page.
      for (let page = 1; page <= 20; page++) {
        let json;
        try {
          const r = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'StylaBot/1.0' },
          });
          if (!r.ok) break;
          json = await r.json();
        } catch (e) { break; }
        const products = (json && json.products) || [];
        if (!products.length) break;
        for (const p of products) {
          if (!p.handle) continue;
          rows.push({
            brand_id: b.brand_id,
            url: `https://${domain}/products/${p.handle}`,
            title: (p.title || '').slice(0, 300),
            category: (p.product_type || '').toLowerCase() || null,
            source: 'shopify',
            updated_at: now,
          });
        }
        if (products.length < 250) break;
      }
      if (!rows.length) {
        return res.status(404).json({ error: `No products found at ${domain}/products.json. Is it a Shopify store and public?` });
      }
      const count = await upsertProducts(rows);
      return res.status(200).json({ ok: true, synced: count });
    }

    if (b.action === 'sync-manual') {
      if (!b.brand_id || !Array.isArray(b.products)) return res.status(400).json({ error: 'brand_id and products[] required.' });
      const now = new Date().toISOString();
      const rows = b.products.filter(p => p && p.url).map(p => ({
        brand_id: b.brand_id,
        url: p.url,
        title: (p.title || '').slice(0, 300),
        category: (p.category || p.product_type || '').toLowerCase() || null,
        source: p.source || 'custom',
        updated_at: now,
      }));
      const count = await upsertProducts(rows);
      return res.status(200).json({ ok: true, synced: count });
    }

    return res.status(400).json({ error: `Unknown action: ${b.action}` });
  } catch (e) {
    console.error('brand-sync error:', e);
    return res.status(500).json({ error: 'Sync failed', detail: String((e && e.message) || e) });
  }
}
