// Shared catalog retrieval — the read side of the product index.
// Embeds a natural-language query and runs the pgvector hybrid match RPC.
// Used by both /api/catalog-search (the discovery/search endpoint) and the
// fit-chat (so the AI can reason across a store's whole catalog, not just the
// product on the current page).

import { supabaseAdmin } from '../_helpers/supabase-admin.js';
import { embedOne } from '../_helpers/embeddings.js';

export const normDom = (d) =>
  String(d || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

/**
 * @param {object} o
 * @param {string} o.query      natural-language query ("linen dress for a wedding")
 * @param {string} [o.brandId]
 * @param {string} [o.shop]     shop domain (Shopify) — filters to that store
 * @param {string} [o.category] canonical Styla category to constrain to
 * @param {number} [o.count]    max results (default 12)
 * @returns {Promise<Array>} ranked products with a `similarity` score
 */
export async function retrieveCatalog({ query, brandId = null, shop = null, category = null, count = 12 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  const embedding = await embedOne(q, 'RETRIEVAL_QUERY');
  if (!embedding) return [];

  // Cross-brand discovery (no store scope) may only surface brands that opted in
  // to sharing. A search scoped to one store is that store's own catalog shown to
  // its own shopper, so it is never filtered.
  const scoped = Boolean(brandId || shop);

  const { data, error } = await supabaseAdmin.rpc('match_catalog_products', {
    query_embedding: embedding,
    match_brand_id: brandId || null,
    match_shop: shop ? normDom(shop) : null,
    filter_category: category || null,
    query_text: q,
    match_count: Math.min(Math.max(Number(count) || 12, 1), 50),
    only_shared: !scoped,
  });
  if (error) throw error;
  return data || [];
}
