// POST /api/rank-brands  (routed via store-api dispatcher)
// Body: { profile:{chest,waist,hips,shoulder,sleeve,inseam,thigh,neck,belly},
//         category?, gender?, limit? }
// Returns: { matches: [{ brand, category, recommended_size, score, spectrum, fits }] }
//
// Reads every size_chart, normalizes it to the fit-envelope schema on read, runs
// the sizing engine, and ranks brands by fit. Ranking is scoped by category when
// one is provided (rank dresses against dresses, not against jeans).

import { supabaseAdmin } from '../_helpers/supabase-admin.js';
import { runSizingEngine } from '../_helpers/sizing-engine.js';
import { normalizeChart } from '../_helpers/normalize-chart.js';

export default async function rankBrands(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { profile = {}, category, gender, limit } = req.body || {};

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
    };

    const { data: charts, error } = await supabaseAdmin
      .from('size_charts')
      .select('id, brand_id, category, gender, chart_data');
    if (error) throw error;

    const { data: brandRows, error: bErr } = await supabaseAdmin
      .from('brands')
      .select('id, name');
    if (bErr) throw bErr;
    const brandMap = {};
    (brandRows || []).forEach(function(b){ brandMap[b.id] = b.name; });

    const matches = [];
    for (const c of (charts || [])) {
      const cd = c.chart_data || {};
      const cat = cd.garment_category || c.category;

      if (category && cat !== category) continue;
      if (gender && c.gender && c.gender.toLowerCase() !== 'unisex' &&
          gender.toLowerCase() !== c.gender.toLowerCase()) continue;

      const norm = normalizeChart(cd, { flatMeasures: cd.flat_measures || [] });
      if (!norm.sizes.length) continue;

      const r = runSizingEngine(user, norm);
      matches.push({
        brand: brandMap[c.brand_id] || 'Unknown',
        category: norm.garment_category,
        recommended_size: r.recommended_size,
        score: r.fit_match_score,
        spectrum: r.fit_spectrum,
        fits: !r.warning,
      });
    }

    matches.sort((a, b) => b.score - a.score);
    return res.status(200).json({ matches: limit ? matches.slice(0, Number(limit)) : matches });
  } catch (e) {
    console.error('rank-brands error:', e);
    return res.status(500).json({ error: 'Failed to rank brands', detail: String((e && e.message) || e) });
  }
}
