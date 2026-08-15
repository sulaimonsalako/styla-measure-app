/* GENERATED COPY of shared/size-conversion.js — do not edit here.
 * Edit shared/size-conversion.js and run: node tools/sync-shared.mjs
 * Theme app extensions can only load local assets, so this copy exists on
 * purpose; tools/sync-shared.mjs --check fails the build if it drifts. */
/* SINGLE SOURCE OF TRUTH — international size labels -> body measurements.
 *
 * UMD, same as the other shared modules:
 *   Vercel API (ESM)   import sz from '../../shared/size-conversion.js'
 *   Shopify app (CJS)  require('../../shared/size-conversion.js')
 *   Browser            <script src="/shared/size-conversion.js"> -> window.STYLA_SIZES
 *
 * WHAT THIS IS AND ISN'T
 * A size label is a NOMINAL position on a scale, not a measurement. "UK 12" is a
 * band that different brands cut differently — vanity sizing has been drifting
 * for decades. These tables are the standard body measurements each label is
 * *supposed* to correspond to, so they are a reasonable starting point and NOT a
 * substitute for a scan or a tape measure. Anything derived from them should be
 * presented as an estimate.
 *
 * The exact path is inverting a BRAND's own chart: if the shopper says "I'm a 12
 * at <brand>" and we hold that chart, read the body measurements straight off it
 * instead of using these tables. See invertBrandChart() below.
 *
 * All measurements are INCHES (the sizing engine's unit).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.STYLA_SIZES = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // Women's apparel. Row = one band across every system.
  // bust / waist / hip in inches.
  var WOMEN = [
    { us: '0',  uk: '4',  eu: '32', au: '4',  it: '36', fr: '32', chest: 31.5, waist: 24.0, hips: 34.0 },
    { us: '2',  uk: '6',  eu: '34', au: '6',  it: '38', fr: '34', chest: 32.5, waist: 25.0, hips: 35.0 },
    { us: '4',  uk: '8',  eu: '36', au: '8',  it: '40', fr: '36', chest: 34.0, waist: 26.5, hips: 36.5 },
    { us: '6',  uk: '10', eu: '38', au: '10', it: '42', fr: '38', chest: 35.0, waist: 27.5, hips: 37.5 },
    { us: '8',  uk: '12', eu: '40', au: '12', it: '44', fr: '40', chest: 36.5, waist: 29.0, hips: 39.0 },
    { us: '10', uk: '14', eu: '42', au: '14', it: '46', fr: '42', chest: 38.0, waist: 30.5, hips: 40.5 },
    { us: '12', uk: '16', eu: '44', au: '16', it: '48', fr: '44', chest: 39.5, waist: 32.0, hips: 42.0 },
    { us: '14', uk: '18', eu: '46', au: '18', it: '50', fr: '46', chest: 41.5, waist: 34.0, hips: 44.0 },
    { us: '16', uk: '20', eu: '48', au: '20', it: '52', fr: '48', chest: 43.5, waist: 36.0, hips: 46.0 },
    { us: '18', uk: '22', eu: '50', au: '22', it: '54', fr: '50', chest: 45.5, waist: 38.0, hips: 48.0 },
    { us: '20', uk: '24', eu: '52', au: '24', it: '56', fr: '52', chest: 47.5, waist: 40.0, hips: 50.0 },
  ];

  // Men's tops/tailoring. US and UK share the chest-inch number; EU adds ~10.
  // AU tracks US/UK for jackets.
  var MEN = [
    { us: '34', uk: '34', eu: '44', au: '34', chest: 34, waist: 28, alpha: 'XS'  },
    { us: '36', uk: '36', eu: '46', au: '36', chest: 36, waist: 30, alpha: 'S'   },
    { us: '38', uk: '38', eu: '48', au: '38', chest: 38, waist: 32, alpha: 'S'   },
    { us: '40', uk: '40', eu: '50', au: '40', chest: 40, waist: 34, alpha: 'M'   },
    { us: '42', uk: '42', eu: '52', au: '42', chest: 42, waist: 36, alpha: 'L'   },
    { us: '44', uk: '44', eu: '54', au: '44', chest: 44, waist: 38, alpha: 'XL'  },
    { us: '46', uk: '46', eu: '56', au: '46', chest: 46, waist: 41, alpha: 'XXL' },
    { us: '48', uk: '48', eu: '58', au: '48', chest: 48, waist: 43, alpha: 'XXL' },
  ];

  var WOMEN_ALPHA = { XS: '2', S: '6', M: '8', L: '12', XL: '16', XXL: '20' };

  var SYSTEMS = [
    { id: 'us', label: 'US' }, { id: 'uk', label: 'UK' }, { id: 'eu', label: 'EU' },
    { id: 'au', label: 'AUS' }, { id: 'it', label: 'IT' }, { id: 'fr', label: 'FR' },
  ];

  var norm = function (v) { return String(v == null ? '' : v).trim().toUpperCase(); };

  /** Find the band for a label in a given system. Returns null when unknown. */
  function findRow(gender, system, size) {
    var table = (gender === 'men') ? MEN : WOMEN;
    var sys = String(system || 'us').toLowerCase();
    var want = norm(size);
    if (!want) return null;

    // Alpha sizes (S / M / L) map onto the numeric scale first.
    if (/^(XS|S|M|L|XL|XXL|XXXL)$/.test(want)) {
      if (gender === 'men') {
        var byAlpha = MEN.filter(function (r) { return r.alpha === (want === 'XXXL' ? 'XXL' : want); });
        return byAlpha.length ? byAlpha[Math.floor(byAlpha.length / 2)] : null;
      }
      want = WOMEN_ALPHA[want === 'XXXL' ? 'XXL' : want];
      sys = 'us';
    }
    want = want.replace(/[^0-9]/g, '');   // "UK 12" / "12W" -> "12"
    if (!want) return null;

    var exact = table.filter(function (r) { return r[sys] === want; })[0];
    if (exact) return exact;

    // Nearest neighbour in that system, so an odd or half size still resolves.
    var n = parseInt(want, 10);
    if (isNaN(n)) return null;
    var best = null, bestGap = Infinity;
    table.forEach(function (r) {
      var v = parseInt(r[sys], 10);
      if (isNaN(v)) return;
      var gap = Math.abs(v - n);
      if (gap < bestGap) { bestGap = gap; best = r; }
    });
    // Refuse absurd matches — "EU 12" isn't a women's apparel size and should
    // surface as unknown rather than silently becoming an EU 32.
    return bestGap <= 3 ? best : null;
  }

  // No label at all? Derive girths from height and build. Cruder, but a
  // gift-buyer who has never seen a label still deserves an answer. Tuned so an
  // average build lands mid-band: 5'5" woman ~ US 8, 5'10" man ~ 40.
  var HEIGHT_RATIO = {
    women: { chest: 0.562, waist: 0.446, hips: 0.600 },
    men:   { chest: 0.571, waist: 0.486, hips: 0.530 },
  };

  // A men's SUIT/jacket number is the chest in inches (US/UK). That makes it the
  // single most informative thing a man knows about himself, so it beats the
  // alpha tables when we have it. Drop (chest - waist) is ~6" on a modern cut.
  function fromSuitSize(suit, system) {
    // Don't GUESS whether "50" is a US 50 or a EU 50 (which is a US 40) — the
    // MEN table already carries us/uk/eu/au columns, so resolve it properly
    // against whichever system the shopper told us.
    var row = findRow('men', system || 'us', suit);
    if (row) return { chest: row.chest, waist: row.waist, hips: +(row.waist + 4).toFixed(1) };

    // Outside the table: in US/UK/AU a jacket number IS the chest in inches.
    var sys = String(system || 'us').toLowerCase();
    if (sys !== 'us' && sys !== 'uk' && sys !== 'au') return null;
    var n = parseFloat(String(suit).replace(/[^0-9.]/g, ''));
    if (isNaN(n) || n < 30 || n > 60) return null;
    return { chest: n, waist: +(n - 6).toFixed(1), hips: +(n - 4).toFixed(1) };
  }

  /**
   * Turn a known size label into estimated body measurements.
   * @param {object} o {gender, system, size, heightIn, build}
   * @returns {object|null} profile in inches, or null if the label is unusable
   */
  function toMeasurements(o) {
    o = o || {};
    // Priority: a men's suit number (chest in inches) -> a labelled size in a
    // known system -> height and build alone.
    var base = null, how = null;
    if (o.suit) { base = fromSuitSize(o.suit, o.system); how = 'suit'; }
    if (!base && o.size) {
      var row = findRow(o.gender, o.system, o.size);
      if (row) { base = { chest: row.chest, waist: row.waist,
                          hips: (row.hips != null ? row.hips : row.waist + 2) }; how = 'label'; }
      else if (!o.heightIn) return null;   // a bad label and nothing to fall back on
    }
    if (!base && o.heightIn) {
      var r = HEIGHT_RATIO[o.gender === 'men' ? 'men' : 'women'];
      base = { chest: o.heightIn * r.chest, waist: o.heightIn * r.waist, hips: o.heightIn * r.hips };
      how = 'height';
    }
    if (!base) return null;

    // Build nudges the girths; it can't be read off a label.
    var adj = o.build === 'slim' ? -1.0 : o.build === 'curvy' ? 1.5 : 0;
    var p = {
      chest: +(base.chest + adj).toFixed(1),
      waist: +(base.waist + adj).toFixed(1),
      hips: +(base.hips + (o.build === 'curvy' ? adj + 0.5 : adj)).toFixed(1),
    };
    p.belly = p.waist;

    // Height is NOT encoded in any size label. Without it we cannot judge
    // Short/Regular/Long, inseam or dress length — so it's required input.
    if (o.heightIn) {
      p.height = o.heightIn;
      p.inseam = Math.round(o.heightIn * (o.gender === 'men' ? 0.44 : 0.45));
    }
    if (o.gender === 'men') p.neck = +(12.5 + (p.chest - 38) * 0.15).toFixed(1);

    p.estimated = true;
    p.confidence = how;                      // 'suit' | 'label' | 'height'
    p.derived_from = (how === 'suit')
      ? { suit: String(o.suit), label: true }
      : (how === 'label')
        ? { system: String(o.system || 'us').toLowerCase(), size: String(o.size), label: true }
        : { heightOnly: true };
    return p;
  }

  /** Every equivalent label for a band — "UK 12 = EU 40 = US 8". */
  function equivalents(gender, system, size) {
    var row = findRow(gender, system, size);
    if (!row) return null;
    var out = {};
    SYSTEMS.forEach(function (s) { if (row[s.id]) out[s.id] = row[s.id]; });
    return out;
  }

  /**
   * THE EXACT PATH. If we hold the chart of the brand the shopper named, read the
   * body measurements straight off it instead of guessing from a nominal table.
   * @param {object} chart  a chart_data-shaped object ({sizes:[{name, chest,...}]})
   * @param {string} size   the size the shopper says they wear there
   */
  function invertBrandChart(chart, size) {
    var rows = (chart && (chart.sizes || chart.display_sizes)) || [];
    var want = norm(size).replace(/\s+/g, '');
    var hit = rows.filter(function (r) { return norm(r.name).replace(/\s+/g, '') === want; })[0];
    if (!hit) return null;
    var mid = function (v) {
      if (v == null) return undefined;
      if (Array.isArray(v)) return (parseFloat(v[0]) + parseFloat(v[1])) / 2;
      var n = parseFloat(v); return isNaN(n) ? undefined : n;
    };
    var p = { chest: mid(hit.chest), waist: mid(hit.waist), hips: mid(hit.hips),
              shoulder: mid(hit.shoulder), sleeve: mid(hit.sleeve), inseam: mid(hit.inseam),
              neck: mid(hit.neck), thigh: mid(hit.thigh) };
    Object.keys(p).forEach(function (k) { if (p[k] === undefined) delete p[k]; });
    if (!p.chest && !p.waist) return null;
    p.belly = p.waist;
    p.derived_from = { brandChart: true, size: String(size) };
    return p;
  }

  /**
   * Parse free text like "I'm a 12 UK" / "size 16 US" / "I wear a medium".
   * Used so the chat can pick it up without a form.
   */
  function parseSizeText(text) {
    var s = String(text || '');
    var sys = null;
    var m = s.match(/\b(us|uk|eu|euro|european|aus|au|australian|it|italian|fr|french)\b/i);
    if (m) {
      var k = m[1].toLowerCase();
      sys = k === 'euro' || k === 'european' ? 'eu'
          : k === 'aus' || k === 'australian' ? 'au'
          : k === 'italian' ? 'it' : k === 'french' ? 'fr' : k;
    }
    var alpha = s.match(/\b(xs|s|m|l|xl|xxl|small|medium|large)\b/i);
    var num = s.match(/\b(?:size\s*)?(\d{1,2})\b/i);
    var size = num ? num[1]
      : alpha ? ({ small: 'S', medium: 'M', large: 'L' }[alpha[1].toLowerCase()] || alpha[1].toUpperCase())
      : null;
    if (!size) return null;
    return { system: sys, size: size, hasSystem: !!sys };
  }

  return {
    WOMEN: WOMEN, MEN: MEN, SYSTEMS: SYSTEMS,
    findRow: findRow, toMeasurements: toMeasurements, equivalents: equivalents,
    invertBrandChart: invertBrandChart, parseSizeText: parseSizeText,
    fromSuitSize: fromSuitSize, HEIGHT_RATIO: HEIGHT_RATIO,
  };
}));
