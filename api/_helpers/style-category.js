// Map ANY product signal (Shopify Standard Product Category, product type, title,
// tags) onto one of Styla's 14 canonical clothing categories — the key the sizing
// engine and chart-matching use. Primary matching is by category; per-product
// override is the fallback. (We deliberately do NOT match by collection.)
//
// Order matters: more specific rules win (bridesmaid before dress; suit before
// blazer/jacket so a "Suit Blazer" is a suit, a standalone "Blazer" is outerwear).

const RULES = [
  ['bridesmaid', /bridesmaid/],
  ['bridal', /bridal|wedding\s*(gown|dress)/],
  ['dresses', /dress|gown|frock/],
  ['jumpsuits', /jumpsuit|romper|playsuit/],
  ['suits', /\bsuit|tuxedo|\btux\b|three[-\s]?piece/],
  ['outerwear', /jacket|coat|blazer|parka|overcoat|windbreaker|outerwear|puffer|anorak/],
  ['shorts', /\bshorts?\b/],
  ['leggings', /legging/],
  ['pants', /\bpant|trouser|jean|denim|chino|slack|cargo/],
  ['skirts', /\bskirt/],
  ['swimwear', /swim|bikini|one[-\s]?piece|trunks|swimsuit/],
  ['bras', /\bbra\b|bralette|lingerie/],
  ['shapewear', /shapewear|bodysuit|shaper|\bslip\b/],
  ['tops', /shirt|\btee\b|t-shirt|\btop\b|blouse|knit|sweater|hoodie|cardigan|polo|tank|jersey|camisole|turtleneck/],
];

/**
 * @param {object} f { category, product_type, title, tags }
 * @returns {string|null} a Styla category slug, or null if nothing matched.
 */
export function toStylaCategory(f) {
  f = f || {};
  const tags = Array.isArray(f.tags) ? f.tags.join(' ') : (f.tags || '');
  const hay = [f.category, f.product_type, f.title, tags].filter(Boolean).join(' ').toLowerCase();
  if (!hay) return null;
  for (const [slug, re] of RULES) if (re.test(hay)) return slug;
  return null;
}

export default toStylaCategory;
