// Map ANY product signal (Shopify Standard Product Category, product type, title,
// tags) onto one of Styla's 14 canonical clothing categories — the key the sizing
// engine and chart-matching use. Primary matching is by category; per-product
// override is the fallback. (We deliberately do NOT match by collection.)
//
// Order matters: more specific rules win (bridesmaid before dress; suit before
// blazer/jacket so a "Suit Blazer" is a suit, a standalone "Blazer" is outerwear).

const RULES = [
  // kids first — "boys' jeans" must not fall through to adult pants
  ['infants', /\b(infant|newborn|baby|babies|onesie|bodysuit)\b|\b(0-3|3-6|6-9|9-12|12-18|18-24)\s*m/],
  ['boys-tops', /\b(boy|boys)('s)?\b.*\b(top|tee|t-shirt|shirt|sweater|hoodie|jumper)\b/],
  ['boys-bottoms', /\bboys?('s|’s|')?\b.*\b(bottoms?|pants?|trousers?|jeans?|shorts?|joggers?)\b/],
  ['girls-tops', /\bgirls?('s|’s|')?\b.*\b(tops?|tee|t-shirts?|shirts?|blouses?|sweaters?|hoodies?)\b/],
  ['girls-bottoms', /\bgirls?('s|’s|')?\b.*\b(bottoms?|pants?|trousers?|jeans?|skirts?|leggings?)\b/],

  // These must beat the broader rules below: "dress shirt" is not a dress, and
  // "panties" must not be caught by the pants rule.
  ['dress-shirts', /dress\s*shirt|formal\s*shirt|tuxedo\s*shirt|business\s*shirt/],
  ['panties', /\bpant(y|ies)\b|\bthongs?\b|boyshort|knicker/],
  ['underwear', /\bunderwear\b|\bboxers?\b|\bbriefs?\b|undershirt/],

  ['bridesmaid', /bridesmaid/],
  ['bridal', /bridal|wedding\s*(gown|dress)/],
  ['dresses', /dress|gown|frock/],
  ['jumpsuits', /jumpsuit|romper|playsuit/],
  ['suits', /\bsuit|tuxedo|\btux\b|three[-\s]?piece/],
  ['outerwear', /jacket|coat|blazer|parka|overcoat|windbreaker|outerwear|puffer|anorak/],
  ['shorts', /\bshorts?\b/],
  ['leggings', /legging/],
  ['pants', /\bpants?\b|trouser|jeans?\b|denim|chino|slack|cargo/],
  ['skirts', /\bskirt/],
  ['swimwear', /swim|bikini|one[-\s]?piece|trunks|swimsuit/],
  ['bras', /\bbra\b|bralette|lingerie/],
  ['shapewear', /shapewear|bodysuit|shaper|\bslip\b/],
  ['tops', /shirt|\btee\b|t-shirt|\btop\b|blouse|knit|sweater|hoodie|cardigan|polo|tank|jersey|camisole|turtleneck/],
];

/**
 * @param {object} f { category, product_type, title, tags, collections }
 * @returns {string|null} a Styla category slug, or null if nothing matched.
 */
export function toStylaCategory(f) {
  f = f || {};
  const join = (v) => (Array.isArray(v) ? v.join(' ') : (v || ''));
  // Priority: Shopify's structured category, then type, then title, then the
  // merchant's own groupings (collections/tags) as the weakest signal.
  const hay = [f.category, f.product_type, f.title, join(f.collections), join(f.tags)]
    .filter(Boolean).join(' ').toLowerCase();
  if (!hay) return null;
  for (const [slug, re] of RULES) if (re.test(hay)) return slug;
  return null;
}

export default toStylaCategory;
