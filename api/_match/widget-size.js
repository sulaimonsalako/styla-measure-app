// POST /api/widget-size  (routed via store-api dispatcher)
// Returns a shopper's recommended size for ONE brand — powers the embeddable
// product-page widget. Accepts either a computed guest profile or a logged-in
// shopper's access token (their saved profile is loaded server-side).
//
// Body: { profile?, accessToken?, brand?|brandId?, category?, gender? }
// Returns: { size, score, spectrum, category, fits }

import { supabaseAdmin } from '../_helpers/supabase-admin.js';
import { runSizingEngine } from '../_helpers/sizing-engine.js';
import { normalizeChart } from '../_helpers/normalize-chart.js';
import { toStylaCategory } from '../_helpers/style-category.js';
import { productMatchesRules, hasRules } from '../_helpers/chart-rules.js';
import SZ from '../../shared/size-conversion.js';

// Pick a garment length/proportion variant (Petite/Regular/Tall…) from the
// shopper's height (inches). Prefer an option whose height range contains the
// shopper; else the nearest by range midpoint.
// Length bands are published against total height, but a garment's length is
// really about PROPORTION: two people of the same height can need different
// lengths if one is long in the leg and short in the torso. When we know the
// shopper's inseam we compute their leg-to-height ratio (population average is
// ~0.46) and shift the effective height used for the lookup, so a long-torso
// shopper isn't handed a hem that sits short on them.
const AVG_LEG_RATIO = 0.46;
function proportionAdjust(height, inseam) {
  if (!height || !inseam) return { effective: height, note: null };
  const ratio = inseam / height;
  const delta = (ratio - AVG_LEG_RATIO) * height; // inches of leg above/below average
  if (Math.abs(delta) < 1) return { effective: height, note: null };
  // Long legs read "taller" for hems/inseams; a long torso reads "shorter".
  return {
    effective: height + delta,
    note: delta > 0 ? 'longer legs than average for your height' : 'longer torso than average for your height',
  };
}

function pickLength(height, options, inseam) {
  if (!height || !Array.isArray(options) || !options.length) return null;
  const adj = proportionAdjust(Number(height), inseam ? Number(inseam) : null);
  const h = adj.effective;
  for (const o of options) {
    const lo = o.height_min != null ? o.height_min : -Infinity;
    const hi = o.height_max != null ? o.height_max : Infinity;
    if (h >= lo && h <= hi) return { name: o.name, inseam: o.inseam != null ? o.inseam : null, reason: adj.note };
  }
  let best = null, bd = Infinity;
  for (const o of options) {
    const lo = o.height_min != null ? o.height_min : (o.height_max != null ? o.height_max - 6 : h);
    const hi = o.height_max != null ? o.height_max : (o.height_min != null ? o.height_min + 6 : h);
    const d = Math.abs((lo + hi) / 2 - h);
    if (d < bd) { bd = d; best = o; }
  }
  return best ? { name: best.name, inseam: best.inseam != null ? best.inseam : null } : null;
}

// Suits/blazers/trousers often encode the length variant IN the size label
// (38S / 38R / 38L, "40 Long"). The engine sizes on girth, which can't tell those
// apart — so once we know the shopper's height we filter the candidates down to
// the right length family before choosing.
const LENGTH_ALIASES = {
  s: 'short', short: 'short', p: 'petite', petite: 'petite',
  r: 'regular', reg: 'regular', regular: 'regular', m: 'regular',
  l: 'long', long: 'long', t: 'tall', tall: 'tall', x: 'xlong', xl: 'xlong',
};
function variantOfSize(name) {
  const s = String(name || '').trim().toLowerCase();
  // "40 long", "40-long", "40 r"
  const words = s.split(/[\s\-_/]+/).filter(Boolean);
  if (words.length > 1) {
    const last = LENGTH_ALIASES[words[words.length - 1]];
    if (last) return last;
  }
  // "38S", "40R" — digits followed by a single letter
  const m = s.match(/^\d+\s*([a-z]{1,2})$/);
  if (m && LENGTH_ALIASES[m[1]]) return LENGTH_ALIASES[m[1]];
  return null;
}
function normVariant(name) {
  const v = String(name || '').trim().toLowerCase();
  return LENGTH_ALIASES[v] || v || null;
}

export default async function widgetSize(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    let { profile, accessToken, brand, brandId, category, gender, productUrl, chartId, domain, knownSize } = req.body || {};
    const normDom = (d) => String(d || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

    // The on-site widget is the paid feature. A store can switch it off (e.g. it
    // only wants free catalog sharing). Fail OPEN when there's no settings row —
    // non-Shopify stores and the bookmarklet must keep working.
    if (domain) {
      const { data: st } = await supabaseAdmin
        .from('shop_settings').select('settings').eq('shop', normDom(domain)).maybeSingle();
      if (st && st.settings && st.settings.widget_enabled === false) {
        return res.status(403).json({ error: 'The Styla size widget is turned off for this store.', widget_disabled: true });
      }
    }

    // "I'm a 12 UK" — turn a size LABEL into body measurements. Done here rather
    // than in the widget so there's one conversion table, and so we can later
    // invert the named brand's own chart (exact) instead of the nominal table
    // (approximate) without shipping new widget code.
    if (!profile && knownSize && knownSize.size) {
      let derived = null;

      // Exact path first: did they tell us WHICH brand that size is from, and do
      // we hold that brand's chart?
      if (knownSize.brand) {
        const { data: b } = await supabaseAdmin.from('brands')
          .select('id, name').ilike('name', String(knownSize.brand).trim()).maybeSingle();
        if (b) {
          const { data: charts } = await supabaseAdmin.from('size_charts')
            .select('chart_data').eq('brand_id', b.id).limit(5);
          for (const c of (charts || [])) {
            derived = SZ.invertBrandChart(c.chart_data || {}, knownSize.size);
            if (derived) { derived.source_brand = b.name; break; }
          }
        }
      }

      // Otherwise the standard tables for that system.
      if (!derived) {
        derived = SZ.toMeasurements({
          gender: knownSize.gender, system: knownSize.system, size: knownSize.size,
          suit: knownSize.suit,                 // men's jacket number = chest in inches
          heightIn: knownSize.heightIn, build: knownSize.build,
        });
      }
      if (!derived) {
        return res.status(200).json({
          unknown_size: true,
          message: `We don't recognise ${String(knownSize.size)} as a ${String(knownSize.system || '').toUpperCase()} size. Check the system, or enter your measurements.`,
        });
      }
      if (knownSize.heightIn && !derived.height) {
        derived.height = knownSize.heightIn;
        derived.inseam = derived.inseam || Math.round(knownSize.heightIn * (knownSize.gender === 'men' ? 0.44 : 0.45));
      }
      profile = derived;
    }

    // Logged-in shopper: load their saved profile with the service-role client.
    if (accessToken && !profile) {
      const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
      if (!error && data && data.user) {
        const { data: prof } = await supabaseAdmin
          .from('profiles')
          .select('chest,waist,hips,belly,shoulder,height,inseam')
          .eq('id', data.user.id)
          .maybeSingle();
        if (prof) profile = prof;
      }
    }
    if (!profile) return res.status(400).json({ error: 'No profile or valid session provided.' });

    // Signed in but the profile has no body data yet (account created, quiz not
    // taken). This is NOT a missing-size-chart problem — tell the caller so the
    // widget can ask for measurements instead of blaming the brand.
    if (!profile.chest && !profile.waist && !profile.hips) {
      return res.status(200).json({ needs_profile: true, message: 'No measurements saved yet.' });
    }

    const user = {
      chest: profile.chest,
      waist: profile.waist,
      belly: profile.belly ?? profile.waist,
      hips: profile.hips,
      shoulder: profile.shoulder,
      sleeve: profile.sleeve,
      inseam: profile.inseam,
      thigh: profile.thigh,
      neck: profile.neck,
      height: profile.height,
      // Provenance travels with the body so the widget can say "estimated from
      // UK 12" instead of showing a match % it hasn't earned.
      derived_from: profile.derived_from || null,
    };

    // Live stock for THIS product, per size label — lets the widget say "your size
    // is in stock" and lets the AI answer it truthfully instead of guessing.
    let stockBySize = null, catalogProduct = null;
    if (productUrl) {
      const { data: cp } = await supabaseAdmin.from('catalog_products')
        .select('external_id, handle, title, url, product_type, vendor, tags, collections, category, variants, available')
        .eq('url', productUrl).maybeSingle();
      if (cp) {
        catalogProduct = cp;
        const vs = Array.isArray(cp.variants) ? cp.variants : [];
        if (vs.length) {
          stockBySize = {};
          vs.forEach((v) => {
            const label = String(v.size || v.title || '').trim();
            if (label) stockBySize[label] = v.available !== false;
          });
        }
      }
    }
    const stockFor = (sizeName) => {
      if (!stockBySize || sizeName == null) return null;
      const want = String(sizeName).trim().toLowerCase();
      const key = Object.keys(stockBySize).find((k) => k.toLowerCase() === want);
      return key ? stockBySize[key] : null;
    };

    // Helper: normalize a chart row + run the engine, returning the API payload.
    function resultFor(cd, resolvedBy) {
      let norm = normalizeChart(cd || {}, { flatMeasures: (cd && cd.flat_measures) || [] });
      if (!norm.sizes.length) return null;

      // If sizes carry a length variant (38S/38R/38L) and we know the shopper's
      // height, keep only the matching family so we don't hand a 6'2" shopper a
      // Short jacket that happens to score well on chest.
      let lengthNote = null;
      const variants = cd && (cd.length_variants || cd.length_options);
      if (user.height && Array.isArray(variants) && variants.length) {
        const tagged = norm.sizes.filter((s) => variantOfSize(s.name));
        if (tagged.length) {
          const pick = pickLength(user.height, variants, user.inseam);
          const want = pick && normVariant(pick.name);
          if (want) {
            const keep = norm.sizes.filter((s) => {
              const v = variantOfSize(s.name);
              return !v || v === want;                 // untagged sizes stay eligible
            });
            if (keep.length) {
              norm = Object.assign({}, norm, { sizes: keep });
              lengthNote = pick.name;
            }
          }
        }
      }
      const r = runSizingEngine(user, norm);
      return {
        size: r.recommended_size,
        score: r.fit_match_score,
        spectrum: r.fit_spectrum,
        category: norm.garment_category,
        subcategory: (cd && cd.subcategory) || null,
        fits: !r.warning,
        resolvedBy,
        explanation: r.explanation,
        breakdown: r.fit_breakdown,      // English prose (back-compat)
        facts: r.fit_facts,              // structured — lets the widget translate + show cm
        derived_from: user.derived_from || null,   // 'estimated from UK 12' vs a real profile
        candidates: r.candidates,        // every size's fit, for the "try other sizes" picker
        chart: (cd && cd.sizes) ? { columns: cd.columns || null, sizes: cd.sizes, length_options: cd.length_options || null, notes: cd.notes || null } : null, // full table + context for the AI
        recommendedLength: pickLength(user.height, (cd && (cd.length_options || cd.length_variants)), user.inseam) || (lengthNote ? { name: lengthNote } : null),
        lengthOptions: (cd && (cd.length_options || cd.length_variants)) || null,
        notes: (cd && cd.notes) || null,
        stock: stockBySize,                       // { "M": true, "L": false }
        inStock: stockFor(r.recommended_size),    // stock for THEIR size (null = unknown)
        measurements: { chest: user.chest, waist: user.waist, hips: user.hips, belly: user.belly },
      };
    }

    // 1) EXACT CHART OVERRIDE (for the minority of brands with per-design charts):
    //    explicit chartId, or a product URL mapped in products_cache -> size_chart_id.
    let overrideChartId = chartId || null;
    if (!overrideChartId && productUrl) {
      const { data: pc } = await supabaseAdmin
        .from('products_cache').select('size_chart_id').eq('url', productUrl).maybeSingle();
      if (pc && pc.size_chart_id) overrideChartId = pc.size_chart_id;
    }
    if (overrideChartId) {
      const { data: chart } = await supabaseAdmin
        .from('size_charts').select('id, chart_data').eq('id', overrideChartId).maybeSingle();
      if (chart) {
        const out = resultFor(chart.chart_data, 'product');
        if (out) return res.status(200).json(out);
      }
    }

    // 2) DEFAULT: brand + category (category comes from the store platform —
    //    Shopify product.type / collection, Woo category — passed by the widget).
    // Resolve the brand (id + category aliases) from id or name.
    let bId = brandId;
    let aliases = {};
    {
      const { data: brows } = await supabaseAdmin.from('brands').select('id, name, domain, category_aliases');
      const m = (brows || []).find(b =>
        (bId && b.id === bId) ||
        (!bId && brand && b.name && b.name.toLowerCase() === String(brand).toLowerCase()) ||
        (!bId && !brand && domain && b.domain && normDom(b.domain) === normDom(domain)));
      if (m) { bId = m.id; aliases = m.category_aliases || {}; }
    }

    // Map the platform's category name onto our canonical category: brand alias
    // first, then the keyword mapper (e.g. "Maxi Dress" -> "dresses"), else as-is.
    let canonCategory = category;
    if (category) {
      const k = String(category).toLowerCase();
      canonCategory = (aliases && aliases[k]) || toStylaCategory({ product_type: category, category }) || category;
    }

    let query = supabaseAdmin.from('size_charts').select('id, brand_id, category, gender, chart_data, is_default');
    if (bId) query = query.eq('brand_id', bId);
    const { data: charts, error } = await query;
    if (error) throw error;
    if (!charts || !charts.length) return res.status(404).json({ error: 'No size chart found for this brand.' });

    // RULE-BASED MATCHING (preferred): if the merchant built match rules
    // (collection is X, tag is Y, …), evaluate them against this product's real
    // attributes from the synced catalog. Same evaluator the app's live preview
    // uses, so what they saw is what shoppers get.
    {
      const ruleCharts = charts.filter((c) => hasRules(c.chart_data));
      if (ruleCharts.length) {
        let prod = null;
        if (productUrl) {
          const { data } = await supabaseAdmin.from('catalog_products')
            .select('external_id, handle, title, url, product_type, vendor, tags, collections, category')
            .eq('url', productUrl).maybeSingle();
          prod = data || null;
        }
        // Fall back to whatever the widget told us about the page.
        if (!prod) prod = { product_type: category || null, category: canonCategory || null, url: productUrl || null };
        const hit = ruleCharts.find((c) => productMatchesRules(prod, c.chart_data.rules));
        if (hit) {
          const out = resultFor(hit.chart_data, 'rules');
          if (out) return res.status(200).json(out);
        }
      }
    }

    // Resolve the chart from the merchant's EXPLICIT links (step 2 of the app):
    //   - a chart linked to the product's category wins;
    //   - else a chart the merchant marked "apply to my whole store" (applies_all);
    //   - else none (the widget shows "no chart" rather than guessing).
    // catsOf reads chart_data.categories[] (new), falling back to the legacy single
    // category so older charts keep working.
    const catsOf = (c) => {
      const cd = c.chart_data || {};
      if (Array.isArray(cd.categories) && cd.categories.length) return cd.categories;
      const one = cd.garment_category || c.category;
      return one ? [one] : [];
    };
    const general = charts.filter(c => c.chart_data && c.chart_data.applies_all);
    let chosen;
    if (canonCategory) {
      const exact = charts.filter(c => catsOf(c).includes(canonCategory));
      chosen = exact.length ? exact : general;
    } else {
      chosen = general;
    }
    if (!chosen.length) return res.status(404).json({ error: 'No size chart is linked to this product yet.' });
    if (gender) {
      const byGender = chosen.filter(c => !c.gender || c.gender.toLowerCase() === 'unisex' || c.gender.toLowerCase() === String(gender).toLowerCase());
      if (byGender.length) chosen = byGender;
    }
    // Among the survivors, prefer the brand's default chart for this category.
    chosen = chosen.slice().sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));

    const c = chosen[0];
    const cd = c.chart_data || {};
    const norm = normalizeChart(cd, { flatMeasures: cd.flat_measures || [] });
    if (!norm.sizes.length) return res.status(404).json({ error: 'Size chart is empty.' });

    const r = runSizingEngine(user, norm);
    return res.status(200).json({
      size: r.recommended_size,
      score: r.fit_match_score,
      spectrum: r.fit_spectrum,
      category: norm.garment_category,
      subcategory: cd.subcategory || null,
      fits: !r.warning,
      resolvedBy: 'brand-category',
      explanation: r.explanation,
      breakdown: r.fit_breakdown,
      facts: r.fit_facts,
      derived_from: user.derived_from || null,
      candidates: r.candidates,        // every size's fit, for the "try other sizes" picker
      chart: cd.sizes ? { columns: cd.columns || null, sizes: cd.sizes, length_options: cd.length_options || null, notes: cd.notes || null } : null, // full table + context for the AI
      recommendedLength: pickLength(user.height, cd.length_options, user.inseam),
      lengthOptions: cd.length_options || null,
      notes: cd.notes || null,
      stock: stockBySize,
      inStock: stockFor(r.recommended_size),
      measurements: { chest: user.chest, waist: user.waist, hips: user.hips, belly: user.belly },
    });
  } catch (e) {
    console.error('widget-size error:', e);
    return res.status(500).json({ error: 'Failed to compute size', detail: String((e && e.message) || e) });
  }
}
