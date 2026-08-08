// POST /api/catalog-search  (routed via store-api dispatcher)
// Semantic search over a store's catalog — the read API behind the AI answers
// and the discovery feed.
//
// Body: {
//   query,                              // "linen dress for a summer wedding"
//   brand?|brandId?, shop?|domain?,     // scope to a store/brand
//   category?, count?,                  // optional filters
//   fitsMe?,                            // when true, annotate each product with the
//   accessToken? | profile?, gender?    // shopper's size + whether it fits
// }
// Returns: { products: [{ ...product, recommendedSize?, fits? }] }

import { supabaseAdmin } from '../_helpers/supabase-admin.js';
import { runSizingEngine } from '../_helpers/sizing-engine.js';
import { normalizeChart } from '../_helpers/normalize-chart.js';
import { retrieveCatalog, normDom } from './retrieve.js';

export default async function catalogSearch(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    let { query, brand, brandId, domain, shop, category, count, fitsMe, accessToken, profile, gender } = req.body || {};
    const shopDom = normDom(shop || domain);

    // Resolve brand from name/domain when an id isn't given (so callers can pass
    // whatever they have). Cache the brand's charts for the fits-me pass.
    let bId = brandId || null;
    let aliases = {};
    const { data: brows } = await supabaseAdmin.from('brands').select('id, name, domain, category_aliases');
    const match = (brows || []).find((b) =>
      (bId && b.id === bId) ||
      (!bId && brand && b.name && b.name.toLowerCase() === String(brand).toLowerCase()) ||
      (!bId && shopDom && b.domain && normDom(b.domain) === shopDom));
    if (match) { bId = match.id; aliases = match.category_aliases || {}; }

    const canonCat = category
      ? (aliases[String(category).toLowerCase()] || String(category).toLowerCase())
      : null;

    let products = await retrieveCatalog({
      query, brandId: bId, shop: shopDom || null, category: canonCat, count,
    });

    // Attach brand info so the shopper sees who makes it — and can choose to
    // support small businesses.
    if (products.length) {
      const ids = [...new Set(products.map((p) => p.brand_id).filter(Boolean))];
      if (ids.length) {
        const { data: bs } = await supabaseAdmin.from('brands')
          .select('id, name, domain, small_business, about').in('id', ids);
        const byId = Object.fromEntries((bs || []).map((b) => [b.id, b]));
        products = products.map((p) => {
          const b = byId[p.brand_id];
          return b ? { ...p, brand: { name: b.name, domain: b.domain, small_business: !!b.small_business, about: b.about || null } } : p;
        });
      }
      // Optional filter: only small businesses.
      if (req.body && req.body.smallBusinessOnly) {
        products = products.filter((p) => p.brand && p.brand.small_business);
      }
    }

    if (!fitsMe || !products.length) {
      return res.status(200).json({ products });
    }

    // --- fits-me annotation -------------------------------------------------
    // Load the shopper's measurements (saved profile via token, or passed inline).
    if (accessToken && !profile) {
      const { data: au } = await supabaseAdmin.auth.getUser(accessToken);
      if (au && au.user) {
        const { data: prof } = await supabaseAdmin.from('profiles')
          .select('chest,waist,hips,belly,shoulder,height,inseam').eq('id', au.user.id).maybeSingle();
        if (prof) profile = prof;
      }
    }
    if (!profile) return res.status(200).json({ products }); // no measurements → skip annotation

    const user = {
      chest: profile.chest, waist: profile.waist, belly: profile.belly ?? profile.waist,
      hips: profile.hips, shoulder: profile.shoulder, sleeve: profile.sleeve,
      inseam: profile.inseam, thigh: profile.thigh, neck: profile.neck,
    };

    // Chart resolution: prefer a product's own chart, else a brand chart for its
    // category. Fetch the candidate charts in one round-trip.
    const chartIds = [...new Set(products.map((p) => p.size_chart_id).filter(Boolean))];
    const chartById = {};
    if (chartIds.length) {
      const { data: cs } = await supabaseAdmin.from('size_charts').select('id, chart_data').in('id', chartIds);
      (cs || []).forEach((c) => { chartById[c.id] = c.chart_data; });
    }
    let brandCharts = [];
    if (bId) {
      const { data: bc } = await supabaseAdmin.from('size_charts')
        .select('category, gender, chart_data, is_default').eq('brand_id', bId);
      brandCharts = bc || [];
    }

    const pickBrandChart = (cat) => {
      let pool = brandCharts;
      if (cat) {
        const byCat = pool.filter((c) => ((c.chart_data && c.chart_data.garment_category) || c.category) === cat);
        if (byCat.length) pool = byCat;
      }
      if (gender) {
        const byG = pool.filter((c) => !c.gender || c.gender.toLowerCase() === 'unisex' || c.gender.toLowerCase() === String(gender).toLowerCase());
        if (byG.length) pool = byG;
      }
      pool = pool.slice().sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
      return pool[0] ? pool[0].chart_data : null;
    };

    const annotated = products.map((p) => {
      const cd = (p.size_chart_id && chartById[p.size_chart_id]) || pickBrandChart(p.category);
      if (!cd) return p;
      try {
        const norm = normalizeChart(cd, { flatMeasures: cd.flat_measures || [] });
        if (!norm.sizes.length) return p;
        const r = runSizingEngine(user, norm);
        return { ...p, recommendedSize: r.recommended_size, fits: !r.warning, fitScore: r.fit_match_score };
      } catch (_) { return p; }
    });

    return res.status(200).json({ products: annotated });
  } catch (e) {
    console.error('catalog-search error:', e);
    return res.status(500).json({ error: 'Failed to search catalog', detail: String((e && e.message) || e) });
  }
}
