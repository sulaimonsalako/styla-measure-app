// GET /api/size-chart?id=<uuid>   (routed via store-api dispatcher)
// Public, read-only view of one size chart so a merchant can render it anywhere
// — their product page, a size-guide modal, an email. Returns only presentation
// data; nothing about the shopper, the brand's settings or other charts.

import { supabaseAdmin } from '../_helpers/supabase-admin.js';

export default async function sizeChartPublic(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const id = url.searchParams.get('id');
    if (!id) return res.status(400).json({ error: 'Missing chart id.' });

    const { data, error } = await supabaseAdmin
      .from('size_charts').select('id, chart_data, verified').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Chart not found.' });

    const cd = data.chart_data || {};
    // Prefer the brand's own table exactly as they entered it; fall back to the
    // canonical one when a chart predates display_sizes.
    const sizes = (cd.display_sizes && cd.display_sizes.length) ? cd.display_sizes : (cd.sizes || []);
    const columns = (cd.display_columns && cd.display_columns.length)
      ? cd.display_columns
      : [...new Set(sizes.flatMap((s) => Object.keys(s).filter((k) => k !== 'name')))];

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      id: data.id,
      name: cd.name || null,
      units: 'in',
      columns,
      sizes,
      length_options: cd.length_options || null,
      notes: cd.notes || null,
      verified: !!data.verified,
    });
  } catch (e) {
    console.error('size-chart public error:', e);
    return res.status(500).json({ error: 'Could not load that chart.' });
  }
}
