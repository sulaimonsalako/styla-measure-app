// POST /api/catalog-ingest  (routed via store-api dispatcher)
// Ingests/updates a store's product catalog into the semantic index.
//
// Body: {
//   brand?|brandId?, shop?|domain?,        // how to key the catalog
//   products: [{
//     external_id|id, handle, url, title, description, vendor,
//     product_type, category, tags, price, currency, image_url|image,
//     variants, available
//   }]
// }
//
// Products are keyed by (brand_id, external_id). Only products whose searchable
// text changed since last time are re-embedded (content_hash gate), so repeat
// syncs are cheap. Returns counts: received / indexed / embedded / skipped.

import crypto from 'crypto';
import { supabaseAdmin } from '../_helpers/supabase-admin.js';
import { embedMany, toVectorLiteral } from '../_helpers/embeddings.js';
import { normDom } from './retrieve.js';

// The text we actually embed — title carries the most signal, then type/tags,
// then the description. Kept compact on purpose.
function docText(p) {
  const tags = Array.isArray(p.tags) ? p.tags.join(' ') : (p.tags || '');
  return [p.title, p.product_type, tags, p.description].filter(Boolean).join('. ').slice(0, 8000);
}
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const toTags = (t) => (Array.isArray(t) ? t : (t ? String(t).split(',').map((s) => s.trim()) : [])).filter(Boolean);

export default async function catalogIngest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    let { brand, brandId, domain, shop, products, remove } = req.body || {};
    const shopDom = normDom(shop || domain);

    const hasProducts = Array.isArray(products) && products.length > 0;
    const hasRemove = Array.isArray(remove) && remove.length > 0;
    if (!hasProducts && !hasRemove) {
      return res.status(400).json({ error: 'Provide products to ingest or remove.' });
    }
    if (hasProducts && products.length > 500) products = products.slice(0, 500); // protect the function

    // Resolve (or create) the brand this catalog belongs to.
    let bId = brandId || null;
    let aliases = {};
    const { data: brows } = await supabaseAdmin.from('brands').select('id, name, domain, category_aliases');
    const match = (brows || []).find((b) =>
      (bId && b.id === bId) ||
      (!bId && brand && b.name && b.name.toLowerCase() === String(brand).toLowerCase()) ||
      (!bId && shopDom && b.domain && normDom(b.domain) === shopDom));
    if (match) { bId = match.id; aliases = match.category_aliases || {}; }
    else if (shopDom || brand) {
      const { data: nb } = await supabaseAdmin.from('brands')
        .insert({ name: brand || shopDom, domain: shopDom || null }).select('id').maybeSingle();
      if (nb) bId = nb.id;
    }
    if (!bId) return res.status(400).json({ error: 'Could not resolve a brand. Pass brandId, brand, or shop/domain.' });

    // Removals (e.g. products/delete webhook) — drop them from the index.
    if (hasRemove) {
      await supabaseAdmin.from('catalog_products')
        .delete().eq('brand_id', bId).in('external_id', remove.map(String));
      if (!hasProducts) return res.status(200).json({ ok: true, removed: remove.length });
    }

    const canonCat = (raw) => {
      const k = String(raw || '').toLowerCase().trim();
      if (!k) return null;
      return aliases[k] || k;
    };

    // What's already indexed — so we can skip re-embedding unchanged products.
    const extIds = products.map((p) => String(p.external_id || p.id || '')).filter(Boolean);
    const { data: existing } = await supabaseAdmin
      .from('catalog_products').select('external_id, content_hash')
      .eq('brand_id', bId).in('external_id', extIds);
    const prevHash = Object.fromEntries((existing || []).map((r) => [r.external_id, r.content_hash]));

    // Build a normalized row per product + decide which need a fresh embedding.
    const rows = products.map((p) => {
      const ext = String(p.external_id || p.id || '');
      if (!ext) return null;
      const text = docText(p);
      const h = sha1(text);
      return {
        ext, text, h,
        needsEmbed: !prevHash[ext] || prevHash[ext] !== h,
        base: {
          brand_id: bId,
          shop_domain: shopDom || null,
          external_id: ext,
          handle: p.handle || null,
          url: p.url || null,
          title: p.title || '(untitled)',
          description: p.description || null,
          vendor: p.vendor || null,
          product_type: p.product_type || null,
          category: canonCat(p.category || p.product_type),
          tags: toTags(p.tags),
          price: p.price != null && p.price !== '' ? Number(p.price) : null,
          currency: p.currency || 'USD',
          image_url: p.image_url || p.image || null,
          variants: p.variants || [],
          available: p.available !== false,
          content_hash: h,
        },
      };
    }).filter(Boolean);

    // Embed only the changed/new ones.
    const changed = rows.filter((r) => r.needsEmbed);
    let vecs = [];
    if (changed.length) vecs = await embedMany(changed.map((r) => r.text), 'RETRIEVAL_DOCUMENT');

    // Two uniform upserts (PostgREST needs consistent keys per batch):
    // (a) changed rows carry the new embedding; (b) unchanged rows update
    // metadata only and leave their existing embedding untouched.
    const changedPayload = changed.map((r, i) => ({
      ...r.base,
      embedding: toVectorLiteral(vecs[i]),
    }));
    const unchangedPayload = rows.filter((r) => !r.needsEmbed).map((r) => r.base);

    if (changedPayload.length) {
      const { error } = await supabaseAdmin.from('catalog_products')
        .upsert(changedPayload, { onConflict: 'brand_id,external_id' });
      if (error) throw error;
    }
    if (unchangedPayload.length) {
      const { error } = await supabaseAdmin.from('catalog_products')
        .upsert(unchangedPayload, { onConflict: 'brand_id,external_id' });
      if (error) throw error;
    }

    return res.status(200).json({
      ok: true,
      brandId: bId,
      received: products.length,
      indexed: rows.length,
      embedded: changed.length,
      skipped: rows.length - changed.length,
    });
  } catch (e) {
    console.error('catalog-ingest error:', e);
    return res.status(500).json({ error: 'Failed to ingest catalog', detail: String((e && e.message) || e) });
  }
}
