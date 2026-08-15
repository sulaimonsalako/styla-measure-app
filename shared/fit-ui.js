/* Styla fit-UI presentation layer — ONE definition for every surface.
 *
 * The Shopify theme-app-extension widget and the styla.ca-hosted widget.html
 * (which the bookmarklet and the universal embed both iframe) had grown two
 * separate copies of this logic. They drifted twice; widget.html ended up with
 * no unit switching, no structured fit facts and no "estimated from a label"
 * badge, so the same shopper got a visibly worse answer through the bookmarklet
 * than through a merchant install.
 *
 * Everything here is pure presentation: no DOM, no network, no storage. That is
 * deliberate — it makes the layer testable offline (see test/extremes) and safe
 * to load on a merchant's storefront.
 *
 * The engine ALWAYS reports inches. Language and units are client concerns.
 *
 * SOURCE OF TRUTH. The Shopify extension needs a physical copy in its assets
 * folder (theme extensions can only load local assets) — run
 * `node tools/sync-shared.mjs` after editing, and the extremes harness fails if
 * the copy has drifted.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.STYLA_FIT_UI = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // ---------------------------------------------------------------- i18n ----
  // Only English ships. Adding a locale means adding real translations here;
  // a missing key falls back to English rather than showing the raw key.
  var STR = {
    en: {
      dim_chest: 'Chest', dim_waist: 'Waist', dim_hips: 'Hips', dim_belly: 'Stomach',
      dim_shoulder: 'Shoulder', dim_sleeve: 'Sleeve', dim_inseam: 'Inseam',
      dim_thigh: 'Thigh', dim_neck: 'Neck', dim_length: 'Length', dim_rise: 'Rise',
      dim_leg_opening: 'Leg opening', dim_height: 'Height',
      v_slim: 'Snug', v_ideal: 'Ideal', v_relaxed: 'Relaxed', v_oversized: 'Oversized',
      fit_ease: '{v} ease', fit_ideal: 'ideal ~{v}', fit_tight: '{v} too tight',
      fit_info: '{v}',
      conf_match: '{v}% match',
      v_fit_ideal: 'Should fit you well',
      v_fit_slim: 'Snug on you',
      v_fit_relaxed: 'Relaxed on you',
      v_fit_oversized: 'Oversized on you',
      v_fit_tight: 'Likely too tight',
      conf_label: 'Estimated from {system} {size}',
      conf_label_hint: 'Based on standard sizing for that label, not your own measurements.',
      conf_brand: 'Matched to your {size} at {brand}',
      no_size: "We can't size this one",
      no_size_why: "This size chart doesn't list the measurements we compare, so we won't guess.",
      low_score: "We can't confidently recommend a size here",
      low_score_why: 'Nothing on this chart is close enough to your measurements to call it a fit.'
    }
  };
  var LOCALE = 'en';
  function setLocale(v) { if (v) LOCALE = String(v).slice(0, 2).toLowerCase(); return LOCALE; }
  function getLocale() { return LOCALE; }
  function t(key, vars) {
    var dict = STR[LOCALE] || STR.en;
    var out = (dict[key] !== undefined ? dict[key] : STR.en[key]);
    if (out === undefined) return key;
    if (vars) Object.keys(vars).forEach(function (k) { out = out.replace('{' + k + '}', vars[k]); });
    return out;
  }
  function addLocale(code, dict) { if (code && dict) STR[String(code).slice(0, 2).toLowerCase()] = dict; }

  // --------------------------------------------------------------- units ----
  var UNIT = 'in';
  function setUnit(u) { UNIT = (u === 'cm') ? 'cm' : 'in'; return UNIT; }
  function getUnit() { return UNIT; }
  function len(inches) {
    if (inches == null || inches === '' || isNaN(inches) || !isFinite(inches)) return '';
    if (UNIT === 'cm') return (Math.round(inches * 2.54 * 10) / 10) + ' cm';
    return (Math.round(inches * 10) / 10) + '"';
  }
  function toIn(v, from) { var n = parseFloat(v); if (!isFinite(n)) return null; return from === 'cm' ? n / 2.54 : n; }
  function fromIn(v, to) { var n = parseFloat(v); if (!isFinite(n)) return null; return to === 'cm' ? n * 2.54 : n; }
  function ftin(v) {
    if (v == null || !isFinite(v)) return '—';
    var f = Math.floor(v / 12), i = Math.round(v - f * 12);
    if (i === 12) { f += 1; i = 0; }
    return f + "'" + i + '"';
  }
  // Accepts 5'5", 5 ft 5, 5-5, 165cm, 1.65m, 65. Returns inches, or null.
  function parseHeight(raw) {
    if (raw == null) return null;
    var s = String(raw).trim().toLowerCase().replace(/′/g, "'").replace(/″|”/g, '"');
    if (!s) return null;
    var m = s.match(/^(\d+(?:\.\d+)?)\s*m$/);                       // 1.65 m
    if (m) return (parseFloat(m[1]) * 100) / 2.54;
    m = s.match(/^(\d+(?:\.\d+)?)\s*(?:cm|centimet(?:er|re)s?)$/);   // 165 cm
    if (m) return parseFloat(m[1]) / 2.54;
    m = s.match(/^(\d+)\s*(?:'|ft|feet|foot)\s*(\d+(?:\.\d+)?)?\s*(?:"|in|inch(?:es)?)?$/);  // 5'5"
    if (m) return parseInt(m[1], 10) * 12 + (m[2] ? parseFloat(m[2]) : 0);
    m = s.match(/^(\d+)\s*-\s*(\d+(?:\.\d+)?)$/);                   // 5-5
    if (m) return parseInt(m[1], 10) * 12 + parseFloat(m[2]);
    m = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?)?$/);        // 65 / 65in
    if (m) {
      var n = parseFloat(m[1]);
      if (!isFinite(n) || n <= 0) return null;
      return n > 100 ? n / 2.54 : n;   // >100 can only be centimetres
    }
    return null;
  }

  // ----------------------------------------------------------- fit facts ----
  // The engine used to send finished English prose with inch marks baked in
  // ("Ideal fit (4.5\" ease · ideal ~3\")"), which was untranslatable and
  // un-convertible. It now sends structured facts and the sentence is composed
  // here, so language and units are both decided client-side.
  function factText(f) {
    if (!f) return '';
    if (f.verdict === 'info') return t('fit_info', { v: len(f.value) });
    if (!f.ok) return t('fit_tight', { v: len(Math.abs(f.ease)) });
    var bits = [t('fit_ease', { v: len(f.ease) })];
    if (f.ideal != null) bits.push(t('fit_ideal', { v: len(f.ideal) }));
    return bits.join(' · ');
  }
  function factLabel(f, key) { return t('dim_' + (f && f.dim ? f.dim : key)); }
  function factBadge(f) {
    if (!f) return '';
    if (f.verdict === 'info') return '';
    if (!f.ok) return t('v_slim');
    return t('v_' + f.verdict) || '';
  }

  // ------------------------------------------------------------- labels ----
  function statusFor(text) {
    var s = (text || '').toLowerCase();
    if (/too tight|too short|too narrow|tight \(/.test(s)) return 'err';
    if (/snug|slim|tight collar|cropped/.test(s)) return 'warn';
    if (/perfect|ideal/.test(s)) return 'ok';
    if (/relaxed|loose|long|oversized|puddle/.test(s)) return 'warn';
    return 'ok';
  }
  function badgeFor(text) {
    var s = (text || '').toLowerCase();
    if (/too tight|too short|too narrow/.test(s)) return 'Too tight';
    if (/snug|slim/.test(s)) return 'Snug';
    if (/perfect|ideal/.test(s)) return 'Ideal';
    if (/relaxed|loose|long/.test(s)) return 'Relaxed';
    if (/oversized|puddle/.test(s)) return 'Oversized';
    return 'Good';
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  // Chart columns, size names and fit notes are merchant-authored and get injected
  // as HTML (tables, comparison rows) — escape everything.
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Shoppers and brands must know WHICH sleeve and WHICH shoulder we compare.
  // Canonical: sleeve = shoulder seam -> wrist; shoulder = full cross-back.
  var DIM_LABELS = {
    sleeve: 'Sleeve (shoulder → wrist)',
    shoulder: 'Shoulder (cross-back)',
    chest: 'Chest', waist: 'Waist', hips: 'Hips', belly: 'Belly',
    inseam: 'Inseam', neck: 'Neck', thigh: 'Thigh', length: 'Length', height: 'Height'
  };
  function dimLabel(k) { return DIM_LABELS[k] || cap(k); }

  // --------------------------------------------------------- honesty ----
  // A label-derived answer is a size BAND, not a body. Saying "94% match" for it
  // implies a precision we don't have, so it gets different wording.
  function confidenceLabel(res) {
    if (!res) return { text: '', hint: '' };
    var df = res.derived_from;
    if (df && df.label)
      return { text: t('conf_label', { system: String(df.system || '').toUpperCase(), size: df.size }),
               hint: t('conf_label_hint') };
    if (df && df.brandChart)
      return { text: t('conf_brand', { size: df.size, brand: res.source_brand || 'that brand' }), hint: '' };
    if (res.score == null) return { text: '', hint: '' };
    return { text: t('conf_match', { v: res.score }), hint: '' };
  }

  // "93% match" is a number a shopper cannot calibrate — is that good? — and it
  // invites doubt at the exact moment you want confidence. Lead with what it
  // MEANS; keep the number as the tooltip for anyone who wants it.
  function verdictLabel(res) {
    if (!res) return { text: '', hint: '' };
    var df = res.derived_from;
    if (df && (df.label || df.brandChart)) return confidenceLabel(res);
    var spec = res.spectrum || res.fit_spectrum;
    var key = spec === 'slim' || spec === 'tight' ? 'v_fit_slim'
            : spec === 'relaxed' ? 'v_fit_relaxed'
            : spec === 'oversized' ? 'v_fit_oversized'
            : res.fits === false ? 'v_fit_tight' : 'v_fit_ideal';
    return { text: t(key),
             hint: (typeof res.score === 'number') ? t('conf_match', { v: res.score }) : '' };
  }

  // The single decision both surfaces must agree on: may we show this as a
  // recommendation at all? Getting this wrong is the worst failure in the product
  // — a confident size the shopper trusts and returns.
  //
  //  - no result / no size            -> nothing to show
  //  - insufficient_data              -> engine compared NOTHING (set server-side)
  //  - every candidate has no breakdown -> same thing, detected from the payload
  //  - score below `minScore`         -> compared something, but nothing is close.
  //    Off by default (0); the threshold is a product decision. See QA fixtures
  //    05/06/12, which score 0% with dimensions compared and would otherwise be
  //    rendered as "S · 0% match".
  function shouldDecline(res, opts) {
    var minScore = (opts && typeof opts.minScore === 'number') ? opts.minScore : 0;
    if (!res || !res.size) return { decline: true, reason: 'no-size' };
    if (res.insufficient_data) return { decline: true, reason: 'insufficient-data' };
    var cands = res.candidates;
    if (Array.isArray(cands) && cands.length && cands.every(function (c) {
      return !c || !c.breakdown || !Object.keys(c.breakdown).length;
    })) return { decline: true, reason: 'no-overlap' };
    if (minScore > 0 && typeof res.score === 'number' && res.score < minScore)
      return { decline: true, reason: 'below-floor' };
    return { decline: false, reason: null };
  }
  function declineCopy(reason) {
    if (reason === 'below-floor') return { title: t('low_score'), body: t('low_score_why') };
    return { title: t('no_size'), body: t('no_size_why') };
  }

  return {
    // i18n
    STR: STR, t: t, setLocale: setLocale, getLocale: getLocale, addLocale: addLocale,
    // units
    setUnit: setUnit, getUnit: getUnit, len: len, toIn: toIn, fromIn: fromIn,
    ftin: ftin, parseHeight: parseHeight,
    // facts
    factText: factText, factLabel: factLabel, factBadge: factBadge,
    // labels
    statusFor: statusFor, badgeFor: badgeFor, cap: cap, esc: esc,
    DIM_LABELS: DIM_LABELS, dimLabel: dimLabel,
    // honesty
    confidenceLabel: confidenceLabel, verdictLabel: verdictLabel,
    shouldDecline: shouldDecline, declineCopy: declineCopy
  };
}));
