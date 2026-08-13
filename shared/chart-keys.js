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

  // Real charts don't label a column "waist". They say "Waist (in)", "WAIST (IN)",
  // "Hip Circumference", "Natural Waist", "Sleeve length (in)". An exact lookup
  // dropped every one of those — silently, so the column was parsed, shown in the
  // editor, and then discarded on save. Clean the label first, then match.
  var UNITS = /\b(in|ins|inch|inches|cm|cms|centimet(?:er|re)s?|mm)\b/g;
  var NOISE = /\b(body|garment|finished|measurement|measurements|circumference|girth|size|approx|approximate|relaxed|natural|full)\b/g;

  function cleanLabel(col) {
    return String(col == null ? '' : col)
      .toLowerCase()
      .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ')  // drop "(in)", "[cm]"
      .replace(/["\u2033\u201d]/g, ' ')                  // inch marks
      .replace(UNITS, ' ')
      .replace(/[^a-z0-9\u4e00-\u9fff\/ ]+/g, ' ')      // keep CJK and the slash in "chest/bust"
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Longest canonical phrases first, so "sleeve length" wins over "sleeve" and
  // "chest width" over "chest".
  var KEYS_BY_LENGTH = null;
  function keysByLength() {
    if (!KEYS_BY_LENGTH) {
      KEYS_BY_LENGTH = Object.keys(CHART_KEY_MAP).sort(function (a, b) { return b.length - a.length; });
    }
    return KEYS_BY_LENGTH;
  }

  /**
   * A brand's column label -> canonical engine key, or null.
   * Exact match on the cleaned label, then with filler words removed, then a
   * containment pass that only fires when EXACTLY ONE canonical term appears —
   * so "waist to hip" stays ambiguous rather than being guessed at.
   */
  function canonKeyFor(col) {
    var c = cleanLabel(col);
    if (!c) return null;
    if (CHART_KEY_MAP[c]) return CHART_KEY_MAP[c];

    var stripped = c.replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
    if (stripped && CHART_KEY_MAP[stripped]) return CHART_KEY_MAP[stripped];

    var hits = [];
    keysByLength().forEach(function (k) {
      if (k.length < 3) return;                    // don't match on fragments
      if (hits.indexOf(CHART_KEY_MAP[k]) >= 0) return;
      var re = /[a-z]/.test(k)
        ? new RegExp('(^|[^a-z])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)')
        : new RegExp(k);                           // CJK has no word boundaries
      if (re.test(stripped || c)) hits.push(CHART_KEY_MAP[k]);
    });
    // "Inseam Length" hits both inseam and length. In a phrase like that,
    // length/height is a qualifier on the real measurement, not the measurement
    // itself — so drop it when something more specific is present.
    if (hits.length > 1) {
      var specific = hits.filter(function (h) { return h !== 'length' && h !== 'height'; });
      if (specific.length === 1) return specific[0];
    }
    return hits.length === 1 ? hits[0] : null;
  }

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
        var key = canonKeyFor(col);
        if (key && o[key] == null) o[key] = r[col];   // first mapped column wins
      });
      return o;
    });
    return out;
  }

  return { CHART_KEY_MAP: CHART_KEY_MAP, canonicalizeChart: canonicalizeChart,
           canonKeyFor: canonKeyFor, cleanLabel: cleanLabel };
}));
