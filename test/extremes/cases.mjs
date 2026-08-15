// Extreme / adversarial fixtures for the Shopify widget stack.
// Nothing here is realistic on purpose. The point is to find the edge where the
// sizing engine, the chart canonicaliser or the size-label parser stops being
// honest -- either by crashing, by emitting NaN/undefined, or (worst) by
// returning a confident recommendation it has no evidence for.

// ---------------------------------------------------------------- BODIES ----
export const BODIES = [
  // -- plausible baseline, so we can tell a real regression from a fixture --
  { id: 'normal-woman',      user: { chest: 36, waist: 29, hips: 39, height: 65 } },
  { id: 'normal-man',        user: { chest: 40, waist: 34, hips: 40, height: 70, neck: 15.5, sleeve: 25 } },

  // -- size extremes --
  { id: 'tiny-child',        user: { chest: 20, waist: 18, hips: 21, height: 40 } },
  { id: 'preemie',           user: { chest: 8,  waist: 7,  hips: 8,  height: 15 } },
  { id: 'very-large',        user: { chest: 72, waist: 68, hips: 75, height: 78 } },
  { id: 'world-record',      user: { chest: 130, waist: 120, hips: 135, height: 107 } },

  // -- degenerate numbers --
  { id: 'all-zero',          user: { chest: 0, waist: 0, hips: 0, height: 0 } },
  { id: 'negative',          user: { chest: -36, waist: -29, hips: -39, height: -65 } },
  { id: 'infinity',          user: { chest: Infinity, waist: 29, hips: 39, height: 65 } },
  { id: 'nan',               user: { chest: NaN, waist: 29, hips: 39, height: 65 } },
  { id: 'float-noise',       user: { chest: 36.000000000001, waist: 28.999999999, hips: 39.4999999, height: 65.5 } },
  { id: 'huge-float',        user: { chest: 1e12, waist: 1e12, hips: 1e12, height: 1e12 } },
  { id: 'tiny-float',        user: { chest: 1e-12, waist: 1e-12, hips: 1e-12, height: 1e-12 } },

  // -- wrong types (what a bad client actually sends) --
  { id: 'strings',           user: { chest: '36', waist: '29', hips: '39', height: '65' } },
  { id: 'string-with-unit',  user: { chest: '36in', waist: '29 in', hips: '39"', height: "5'5\"" } },
  { id: 'null-values',       user: { chest: null, waist: null, hips: null, height: null } },
  { id: 'empty-object',      user: {} },
  { id: 'array-values',      user: { chest: [36, 38], waist: [29], hips: 39, height: 65 } },
  { id: 'object-values',     user: { chest: { v: 36 }, waist: 29, hips: 39, height: 65 } },

  // -- units confusion: a cm body scored against an inch chart --
  { id: 'cm-body-as-inches', user: { chest: 91, waist: 74, hips: 99, height: 165 } },

  // -- contradictory / anatomically impossible --
  { id: 'chest-under-waist', user: { chest: 28, waist: 44, hips: 30, height: 68 } },
  { id: 'waist-over-hips',   user: { chest: 40, waist: 50, hips: 32, height: 70 } },
  { id: 'one-dim-only',      user: { waist: 31 } },
  { id: 'height-only',       user: { height: 68 } },
  { id: 'thigh-only',        user: { thigh: 23 } },
  { id: 'neck-sleeve-only',  user: { neck: 16, sleeve: 34 } },

  // -- the dimensions added in the 2026-08-11 migration --
  { id: 'full-9-dim',        user: { chest: 40, waist: 34, hips: 40, belly: 36, shoulder: 18,
                                     height: 70, inseam: 32, thigh: 23, neck: 15.5, sleeve: 25 } },
];

// ---------------------------------------------------------------- CHARTS ----
const row = (name, o) => ({ name, ...o });

export const CHARTS = [
  { id: 'normal-alpha', chart: { chart_type: 'body', garment_category: 'tops', fabric_type: 'woven', sizes: [
      row('XS', { chest: 34, waist: 27, hips: 37 }), row('S', { chest: 36, waist: 29, hips: 39 }),
      row('M', { chest: 38, waist: 31, hips: 41 }), row('L', { chest: 41, waist: 34, hips: 44 }),
      row('XL', { chest: 44, waist: 37, hips: 47 }) ] } },

  { id: 'normal-ranges', chart: { chart_type: 'body', garment_category: 'tops', fabric_type: 'knits', sizes: [
      row('S', { chest: [34, 36], waist: [27, 29], hips: [37, 39] }),
      row('M', { chest: [36, 38], waist: [29, 31], hips: [39, 41] }),
      row('L', { chest: [38, 41], waist: [31, 34], hips: [41, 44] }) ] } },

  // -- structural extremes --
  { id: 'empty-chart',   chart: { sizes: [] } },
  { id: 'no-sizes-key',  chart: {} },
  { id: 'null-sizes',    chart: { sizes: null } },
  { id: 'single-size',   chart: { garment_category: 'tops', sizes: [row('OS', { chest: 40, waist: 34, hips: 40 })] } },
  { id: 'sixty-sizes',   chart: { garment_category: 'tops', sizes: Array.from({ length: 60 }, (_, k) =>
      row('SZ' + k, { chest: 20 + k * 0.5, waist: 16 + k * 0.5, hips: 22 + k * 0.5 })) } },
  { id: 'nameless-rows', chart: { garment_category: 'tops', sizes: [
      row(undefined, { chest: 36, waist: 29 }), row('', { chest: 38, waist: 31 }) ] } },
  { id: 'duplicate-names', chart: { garment_category: 'tops', sizes: [
      row('M', { chest: 36, waist: 29 }), row('M', { chest: 40, waist: 33 }) ] } },

  // -- no usable measurements at all: must NOT produce a confident answer --
  { id: 'all-null-cols', chart: { garment_category: 'tops', sizes: [
      row('S', { chest: null, waist: null }), row('M', { chest: null, waist: null }) ] } },
  { id: 'name-only',     chart: { garment_category: 'tops', sizes: [row('S', {}), row('M', {}), row('L', {})] } },
  { id: 'height-only-chart', chart: { garment_category: 'outerwear', sizes: [
      row('R', { height: 68 }), row('T', { height: 74 }) ] } },

  // -- values that are wrong rather than missing --
  { id: 'reversed',      chart: { garment_category: 'tops', sizes: [
      row('S', { chest: 44, waist: 37 }), row('M', { chest: 40, waist: 33 }), row('L', { chest: 36, waist: 29 }) ] } },
  { id: 'all-identical', chart: { garment_category: 'tops', sizes: [
      row('S', { chest: 38, waist: 31 }), row('M', { chest: 38, waist: 31 }), row('L', { chest: 38, waist: 31 }) ] } },
  { id: 'cm-values',     chart: { garment_category: 'tops', sizes: [
      row('S', { chest: 91, waist: 74, hips: 99 }), row('M', { chest: 97, waist: 80, hips: 105 }) ] } },
  { id: 'half-width',    chart: { garment_category: 'tops', sizes: [
      row('S', { chest: 18, waist: 14.5 }), row('M', { chest: 19, waist: 15.5 }) ] } },
  { id: 'chest-under-waist', chart: { garment_category: 'tops', sizes: [
      row('S', { chest: 28, waist: 40 }), row('M', { chest: 30, waist: 42 }) ] } },
  { id: 'zero-values',   chart: { garment_category: 'tops', sizes: [
      row('S', { chest: 0, waist: 0 }), row('M', { chest: 0, waist: 0 }) ] } },
  { id: 'negative-values', chart: { garment_category: 'tops', sizes: [
      row('S', { chest: -36, waist: -29 }), row('M', { chest: -38, waist: -31 }) ] } },
  { id: 'nan-values',    chart: { garment_category: 'tops', sizes: [
      row('S', { chest: NaN, waist: 29 }), row('M', { chest: 38, waist: NaN }) ] } },
  { id: 'string-values', chart: { garment_category: 'tops', sizes: [
      row('S', { chest: '36', waist: '29' }), row('M', { chest: '38', waist: '31' }) ] } },
  { id: 'inverted-range', chart: { garment_category: 'tops', sizes: [
      row('S', { chest: [38, 34], waist: [31, 27] }) ] } },
  { id: 'overlap-ranges', chart: { garment_category: 'tops', sizes: [
      row('S', { chest: [34, 40] }), row('M', { chest: [35, 41] }), row('L', { chest: [36, 42] }) ] } },
  { id: 'gapped-ranges', chart: { garment_category: 'tops', sizes: [
      row('S', { chest: [34, 35] }), row('M', { chest: [44, 45] }) ] } },
  { id: 'huge-values',   chart: { garment_category: 'tops', sizes: [
      row('S', { chest: 1e9, waist: 1e9 }), row('M', { chest: 2e9, waist: 2e9 }) ] } },

  // -- category / fabric permutations that change the ease model --
  { id: 'bottoms-critical', chart: { garment_category: 'bottoms', fabric_type: 'woven', sizes: [
      row('28', { waist: 28, hips: 37, inseam: 32, thigh: 22 }),
      row('30', { waist: 30, hips: 39, inseam: 32, thigh: 23 }),
      row('32', { waist: 32, hips: 41, inseam: 32, thigh: 24 }) ] } },
  { id: 'activewear', chart: { garment_category: 'tops', fabric_type: 'activewear', sizes: [
      row('S', { chest: 34, waist: 27 }), row('M', { chest: 36, waist: 29 }) ] } },
  { id: 'unknown-category', chart: { garment_category: 'wingsuit', fabric_type: 'chainmail', sizes: [
      row('S', { chest: 36, waist: 29 }), row('M', { chest: 38, waist: 31 }) ] } },
  { id: 'suit-structured', chart: { garment_category: 'outerwear', garment_subclass: 'tailored blazer', sizes: [
      row('38R', { chest: 38, waist: 32, shoulder: 17.5, sleeve: 24 }),
      row('40R', { chest: 40, waist: 34, shoulder: 18, sleeve: 24.5 }) ] } },
];

// -------------------------------------------------- WIDGET INPUT STRINGS ----
// Fed to the size-label parser (STYLA_SIZES.parseSizeText).
export const SIZE_INPUTS = [
  '12 EU', '16 US', '14 AUS', 'US 8', 'uk10', 'IT 44', 'FR 38', 'DE 36',
  'M', 'medium', 'X-Large', 'xxl', '2XL', 'OS', 'one size',
  '38R', '40L', '32x34', '32/34', 'W32 L34',
  '', '   ', null, undefined, 0, 42, -1, NaN, Infinity,
  'null', 'undefined', 'NaN', '[]', '{}',
  '🍕', '👗👗👗', 'médium', 'ＭＥＤＩＵＭ', 'МЕДИУМ',
  'a'.repeat(5000),
  '<script>alert(1)</script>', '"; DROP TABLE size_charts;--', "' OR '1'='1",
  '{{constructor.constructor("return process")()}}', '../../etc/passwd',
  '  ', '\n\n\t', '99999999999999999999',
  'size 12 but I usually wear 14 in dresses and 10 in tops',
];

// ------------------------------------------------------- CHART COL LABELS ----
// Fed to the canonicaliser (STYLA_CHART_KEYS.canonKeyFor). Right-hand side is
// what a human reviewer would say the column means; null = genuinely unmappable.
export const COLUMN_LABELS = [
  ['Chest', 'chest'], ['CHEST (IN)', 'chest'], ['Bust', 'chest'], ['BUST (cm)', 'chest'],
  ['Chest circumference', 'chest'], ['Body Chest', 'chest'], ['chest_in', 'chest'],
  ['Waist', 'waist'], ['Natural Waist', 'waist'], ['WAIST (INCHES)', 'waist'],
  ['Hip', 'hips'], ['Hips', 'hips'], ['Low Hips', 'hips'], ['Seat', 'hips'],
  ['Inseam', 'inseam'], ['Inside Leg', 'inseam'], ['Sleeve Length', 'sleeve'],
  ['Shoulder', 'shoulder'], ['Across Shoulder', 'shoulder'], ['Neck', 'neck'],
  ['Thigh', 'thigh'], ['胸围', 'chest'], ['腰围', 'waist'],
  // Length and Height ARE real chart columns the engine reads (garment length is
  // the 4th most common column merchants publish), so mapping them is correct --
  // an earlier version of this file wrongly expected null here.
  ['Length', 'length'], ['Height', 'height'],
  // genuinely ambiguous or meaningless -- must return null, not a wrong guess
  ['Size', null], ['US', null], ['EU', null],
  ['', null], ['   ', null], ['Chest / Waist', null], ['Notes', null], ['Color', null],
  ['Sleeve or Shoulder', null], ['🍕', null], ['a'.repeat(500), null],
];

// ------------------------------------------------------ PRODUCT / CATALOG ----
// Shapes the widget receives from Shopify. Exercises category inference and the
// variant option axis (see the known option-axis bug in LIVERPOOL.md).
export const PRODUCTS = [
  { id: 'normal',        title: 'Slim Fit Denim Jean', product_type: 'Jeans',
    options: [{ name: 'Size', values: ['28', '30', '32'] }] },
  { id: 'colour-first',  title: 'Crew Tee', product_type: 'T-Shirts',
    options: [{ name: 'Color', values: ['Black', 'White'] }, { name: 'Size', values: ['S', 'M', 'L'] }] },
  { id: 'no-options',    title: 'Gift Card', product_type: 'Gift Card', options: [] },
  { id: 'no-size-axis',  title: 'Scented Candle', product_type: 'Home',
    options: [{ name: 'Scent', values: ['Fig', 'Cedar'] }] },
  { id: 'empty-title',   title: '', product_type: '', options: [{ name: 'Size', values: ['M'] }] },
  { id: 'null-title',    title: null, product_type: null, options: null },
  { id: 'emoji-title',   title: '👖👖 JEANS 👖👖', product_type: '👖', options: [{ name: 'Size', values: ['M'] }] },
  { id: 'long-title',    title: 'Jean '.repeat(400), product_type: 'Jeans',
    options: [{ name: 'Size', values: ['30'] }] },
  { id: 'ambiguous',     title: 'Dress Shirt Jacket Pant Short Skirt', product_type: 'Apparel',
    options: [{ name: 'Size', values: ['M'] }] },
  { id: 'unmapped-type', title: 'Wingsuit', product_type: 'Extreme Sports Equipment',
    options: [{ name: 'Size', values: ['M'] }] },
  { id: 'html-title',    title: '<b>Jeans</b> &amp; <i>More</i>', product_type: 'Jeans',
    options: [{ name: 'Size', values: ['32'] }] },
];
