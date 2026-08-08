/* SINGLE SOURCE OF TRUTH — mapping a brand's own measurement column labels onto
 * the canonical keys the fit engine and the Styla admin read.
 *
 * Used by BOTH chart entry points (Shopify app and Styla admin) so a chart saved
 * in either place stores an identical structure:
 *   sizes            -> canonical keys (chest, waist, hips, sleeve…) for the engine
 *   display_sizes    -> the brand's table exactly as entered, for the AI
 *   display_columns  -> the brand's own headers
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.STYLA_CHART_KEYS = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  var CHART_KEY_MAP = {
    chest:'chest', bust:'chest', 'chest width':'chest', 'bust width':'chest', 'chest/bust':'chest', '胸围':'chest',
    waist:'waist', 'waist width':'waist', '腰围':'waist',
    belly:'belly', abdomen:'belly', tummy:'belly',
    hip:'hips', hips:'hips', seat:'hips', hem:'hips', 'hem width':'hips', '摆围':'hips',
    shoulder:'shoulder', shoulders:'shoulder', 'shoulder width':'shoulder', '肩宽':'shoulder',
    sleeve:'sleeve', 'sleeve length':'sleeve', '袖长':'sleeve',
    'short sleeve length':'sleeve', '短袖长':'sleeve',
    inseam:'inseam', 'inside leg':'inseam',
    thigh:'thigh',
    neck:'neck', collar:'neck', '领围':'neck',
    length:'length', 'clothing length':'length', 'back length':'length', 'body length':'length', '衣长':'length',
    height:'height',
  };

  function canonicalizeChart(cd, category) {
    if (!cd || !Array.isArray(cd.sizes)) return cd;
    var out = {};
    for (var k in cd) if (Object.prototype.hasOwnProperty.call(cd, k)) out[k] = cd[k];

    if (!out.garment_category) out.garment_category = category || (out.categories || [])[0] || null;
    if (!out.chart_type) out.chart_type = 'body';

    out.display_columns = cd.columns || cd.display_columns || null;
    out.display_sizes = cd.sizes;
    out.sizes = cd.sizes.map(function (r) {
      var o = { name: r.name };
      Object.keys(r).forEach(function (col) {
        if (col === 'name') return;
        var key = CHART_KEY_MAP[String(col).trim().toLowerCase()];
        if (key && o[key] == null) o[key] = r[col];   // first mapped column wins
      });
      return o;
    });
    return out;
  }

  return { CHART_KEY_MAP: CHART_KEY_MAP, canonicalizeChart: canonicalizeChart };
}));
