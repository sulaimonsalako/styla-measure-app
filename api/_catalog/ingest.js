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
// STATIC import, deliberately. createRequire() is invisible to Vercel's module
// tracer, so shared/product-attrs.js would not be bundled and this file would
// throw at IMPORT time -- which takes down api/store-api.js, and with it every
// route's CORS headers. The browser then reports a CORS failure and the real
// error is never seen. A static import is traced and bundled.
import PRODUCT_ATTRS from '../../shared/product-attrs.js';
const deriveAttrsRaw = PRODUCT_ATTRS.extract;
const deriveAttrs = (p) => deriveAttrsRaw({
  title: p.title, product_type: p.product_type, description: p.description,
  body_html: p.body_html, tags: p.tags, options: p.options });
import { embedMany, toVectorLiteral } from '../_helpers/embeddings.js';
import { normDom } from './retrieve.js';
import { toStylaCategory } from '../_helpers/style-category.js';

// The text we actually embed — title carries the most signal, then type/tags,
// then the description. Kept compact on purpose.
function docText(p) {
  const tags = Array.isArray(p.tags) ? p.tags.join(' ') : (p.tags || '');
  const cols = Array.isArray(p.collections) ? p.collections.join(' ') : (p.collections || '');
  return [p.title, p.product_type, cols, tags, p.description].filter(Boolean).join('. ').slice(0, 8000);
}
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const toTags = (t) => (Array.isArray(t) ? t : (t ? String(t).split(',').map((s) => s.trim()) : [])).filter(Boolean);

export default async function catalogIngest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    let { brand, brandId, domain, shop, products, remove, shared, authoritative } = req.body || {};
    const shopDom = normDom(shop || domain);
    // Free tier: brands are shared into Styla's cross-brand discovery by default.
    const isShared = shared !== false;

    const hasProducts = Array.isArray(products) && products.length > 0;
    const hasRemove = Array.isArray(remove) && remove.length > 0;
    if (!hasProducts && !hasRemove) {
      return res.status(400).json({ error: 'Provide products to ingest or remove.' });
    }
    // A truncated batch must never be treated as the complete catalog, or the
    // slice we dropped would be deleted as "missing".
    let truncated = false;
    if (hasProducts && products.length > 500) { products = products.slice(0, 500); truncated = true; }
    const isAuthoritative = authoritative === true && hasProducts && !truncated;

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

    // Shopify's Standard Product Taxonomy -> Styla categories, mapped once in our
    // DB so merchants never translate their own labels. PRIORITY wins first (the
    // broad "…> Clothing" catch-all is the longest string but the weakest signal),
    // then longer/more-specific patterns.
    const { data: taxRows } = await supabaseAdmin
      .from('shopify_category_map').select('pattern, styla_category, priority');
    const taxMap = (taxRows || []).slice().sort(
      (a, b) => (b.priority - a.priority) || (b.pattern.length - a.pattern.length)
    );
    const fromShopifyTaxonomy = (path) => {
      const p = String(path || '').toLowerCase();
      if (!p) return undefined;
      for (const r of taxMap) if (p.includes(r.pattern)) return r.styla_category; // may be null = not clothing
      return undefined; // no rule matched -> let the fallbacks decide
    };

    // Priority: merchant's explicit alias -> Shopify's standard taxonomy ->
    // keyword inference from type/title/collections/tags -> unmapped.
    const catFor = (p) => {
      const raw = String(p.category || p.product_type || '').toLowerCase().trim();
      if (raw && aliases[raw]) return aliases[raw];
      const viaTax = fromShopifyTaxonomy(p.category);
      if (viaTax !== undefined) return viaTax;
      return toStylaCategory({ category: p.category, product_type: p.product_type, title: p.title, tags: p.tags, collections: p.collections });
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
          category: catFor(p),
          tags: toTags(p.tags),
          collections: toTags(p.collections),
          price: p.price != null && p.price !== '' ? Number(p.price) : null,
          currency: p.currency || 'USD',
          image_url: p.image_url || p.image || null,
          // Styling attributes. The producer (the Shopify app) sends these; for
          // any other feed we derive them here from the same text, so no source
          // silently lands with an empty attrs and drops out of styling answers.
          attrs: (p.attrs && Object.keys(p.attrs).length) ? p.attrs : deriveAttrs(p),
          variants: p.variants || [],
          available: p.available !== false,
          shared: isShared,
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

    // Reconcile: a full sync is the source of truth, so anything still indexed
    // for this shop that wasn't in the pull no longer exists (deleted, archived
    // or unpublished) and must stop being recommended. Webhooks handle live
    // deletes; this catches everything missed while the app was uninstalled,
    // the server was down, or a webhook simply failed.
    //
    // Scoped to shop_domain when we have one so a brand selling through more
    // than one storefront can't have one shop's sync delete another's rows.
    let removedStale = 0;
    const keep = rows.map((r) => r.ext);
    // rows can be empty even when products isn't (every item missing an id).
    // An empty keep-list would build `not in ()` — invalid SQL at best, a
    // full wipe at worst — so require something to keep before deleting.
    if (isAuthoritative && keep.length) {
      let q = supabaseAdmin.from('catalog_products').delete().eq('brand_id', bId);
      if (shopDom) q = q.eq('shop_domain', shopDom);
      const { data: gone, error: delErr } = await q
        .not('external_id', 'in', `(${keep.map((id) => `"${id}"`).join(',')})`)
        .select('external_id');
      if (delErr) console.error('catalog-ingest prune failed:', delErr.message);
      else removedStale = (gone || []).length;
    }

    return res.status(200).json({
      ok: true,
      brandId: bId,
      received: products.length,
      indexed: rows.length,
      embedded: changed.length,
      skipped: rows.length - changed.length,
      removed: (hasRemove ? remove.length : 0) + removedStale,
      pruned: removedStale,
      authoritative: isAuthoritative,
    });
  } catch (e) {
    console.error('catalog-ingest error:', e);
    return res.status(500).json({ error: 'Failed to ingest catalog', detail: String((e && e.message) || e) });
  }
}
