// Ingestion normalizer: turns ANY raw size chart (from parse-size-chart.js,
// generate-size-chart.js, a manual upload, or a feed) into the ONE canonical
// fit-envelope schema the engine and index read. See VISION.md.
//
// Output shape:
// {
//   gender, garment_category, garment_subclass, chart_type, fabric_type, units:'in',
//   measures: { chest:'circumference', thigh:'circumference (from flat)', ... },
//   sizes: [ { name:'M', chest:[38,40], waist:[31,33], hips:[41,43] }, ... ]
// }
//
// Ranges ARE the fit envelope. Single values become [v,v]. The engine already
// averages arrays, so this output is backward-compatible with runSizingEngine.

// Map every raw POM name onto the engine's canonical keys.
const KEY_MAP = {
  chest: 'chest', bust: 'chest', 'chest width': 'chest', 'bust width': 'chest',
  waist: 'waist', 'waist width': 'waist',
  belly: 'belly', abdomen: 'belly', tummy: 'belly',
  hip: 'hips', hips: 'hips', seat: 'hips',
  shoulder: 'shoulder', shoulders: 'shoulder', 'shoulder width': 'shoulder',
  sleeve: 'sleeve', 'sleeve length': 'sleeve',
  inseam: 'inseam',
  thigh: 'thigh',
  neck: 'neck', collar: 'neck',
  length: 'length', 'back length': 'length', 'body length': 'length',
  height: 'height',
};

// Which canonical keys are LENGTHS (matched directly) vs CIRCUMFERENCES (ease-based).
const LENGTH_KEYS = new Set(['sleeve', 'inseam', 'length', 'height', 'shoulder']);

/**
 * @param {object} raw  chart data: { sizes:[{name, <pom>:val|[min,max]}], chart_type, fabric_type, garment_category, garment_subclass, gender }
 * @param {object} opts { flatMeasures:[] }  raw POM names that are FLAT (half) and must be doubled to circumference.
 *                        This metadata comes from the parser/tagger — we never guess silently.
 */
export function normalizeChart(raw, opts = {}) {
  const flat = new Set((opts.flatMeasures || []).map((s) => s.toLowerCase()));
  const chartType = raw.chart_type || 'body';

  const out = {
    gender: (raw.gender || 'unisex'),
    garment_category: raw.garment_category || 'tops',
    garment_subclass: raw.garment_subclass || '',
    chart_type: chartType,
    fabric_type: raw.fabric_type || 'woven',
    units: 'in',
    measures: {},
    sizes: [],
    _normalized: true, // engine skips its own convention conversion when it sees this
  };

  // Measurement conventions -> canonical. Explicit tag wins; magnitude is fallback.
  //   shoulder canonical = FULL cross-back (seam-to-seam). half-shoulder -> x2.
  //   sleeve   canonical = SHOULDER-to-wrist. center-back-to-wrist -> minus half cross-back.
  const shoulderConv = (raw.shoulder_convention || 'auto');
  const sleeveConv = (raw.sleeve_convention || 'auto');
  function normalizeConventions(size) {
    if (size.shoulder) {
      const avg = (size.shoulder[0] + size.shoulder[1]) / 2;
      const isHalf = shoulderConv === 'half' || (shoulderConv === 'auto' && avg < 11);
      if (isHalf) size.shoulder = size.shoulder.map((x) => +(x * 2).toFixed(2));
    }
    if (size.sleeve) {
      const avg = (size.sleeve[0] + size.sleeve[1]) / 2;
      const isCenterBack = sleeveConv === 'center-back' || (sleeveConv === 'auto' && avg >= 26.5);
      if (isCenterBack) {
        // subtract half the cross-back (chart's own shoulder if present, else ~16")
        const halfCB = size.shoulder ? ((size.shoulder[0] + size.shoulder[1]) / 2) / 2 : 8;
        size.sleeve = size.sleeve.map((x) => +(x - halfCB - 0.5).toFixed(2));
      }
    }
  }

  for (const s of (raw.sizes || [])) {
    const size = { name: String(s.name) };
    for (const [rawKey, v] of Object.entries(s)) {
      if (rawKey === 'name') continue;
      const lk = rawKey.toLowerCase();
      const key = KEY_MAP[lk];
      if (!key) continue; // drop non-fit fields (rising_length, bottom_width, etc.)

      let range = Array.isArray(v)
        ? [Number(v[0]), Number(v[1])]
        : [Number(v), Number(v)];
      if (range.some((n) => Number.isNaN(n))) continue;

      const isFlat = flat.has(lk);
      if (isFlat) {
        range = range.map((x) => +(x * 2).toFixed(2)); // flat -> circumference
        out.measures[key] = 'circumference (from flat)';
      } else {
        out.measures[key] = LENGTH_KEYS.has(key) ? 'length' : 'circumference';
      }
      // keep the tighter range if two POMs map to the same key
      size[key] = size[key]
        ? [Math.min(size[key][0], range[0]), Math.max(size[key][1], range[1])]
        : range;
    }
    normalizeConventions(size); // shoulder half->full, sleeve center-back->shoulder-to-wrist
    out.sizes.push(size);
  }
  return out;
}

export default normalizeChart;
