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

export default async function widgetSize(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    let { profile, accessToken, brand, brandId, category, gender } = req.body || {};

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

    // Resolve the brand id from a name if needed.
    let bId = brandId;
    if (!bId && brand) {
      const { data: brows } = await supabaseAdmin.from('brands').select('id, name');
      const m = (brows || []).find(b => b.name && b.name.toLowerCase() === String(brand).toLowerCase());
      if (m) bId = m.id;
    }

    let query = supabaseAdmin.from('size_charts').select('id, brand_id, category, gender, chart_data');
    if (bId) query = query.eq('brand_id', bId);
    const { data: charts, error } = await query;
    if (error) throw error;
    if (!charts || !charts.length) return res.status(404).json({ error: 'No size chart found for this brand.' });

    // Prefer the requested category, then gender, else fall back to what exists.
    let chosen = charts;
    if (category) {
      const byCat = charts.filter(c => ((c.chart_data && c.chart_data.garment_category) || c.category) === category);
      if (byCat.length) chosen = byCat;
    }
    if (gender) {
      const byGender = chosen.filter(c => !c.gender || c.gender.toLowerCase() === 'unisex' || c.gender.toLowerCase() === String(gender).toLowerCase());
      if (byGender.length) chosen = byGender;
    }

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
      fits: !r.warning,
    });
  } catch (e) {
    console.error('widget-size error:', e);
    return res.status(500).json({ error: 'Failed to compute size', detail: String((e && e.message) || e) });
  }
}
