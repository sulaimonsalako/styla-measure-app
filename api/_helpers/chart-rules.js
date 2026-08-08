// Rule-based chart → product matching.
//
// A chart carries `rules` in chart_data:
//   { match:'any'|'all', conditions:[ {field, op, value}, ... ] }
//
// field:  'all' | 'collection' | 'product_type' | 'tag' | 'vendor' | 'product' | 'category'
// op:     'is' | 'is_not' | 'contains'
//
// Matching runs against the store's OWN attributes (collections, tags, vendors,
// types) as they come from the platform — no taxonomy translation required — so
// this same evaluator powers both the merchant's live match preview and the
// storefront size lookup. Identical logic in both places is the point.

const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();
const arr = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v])).map(norm).filter(Boolean);

/** Values on the product that a given condition field looks at. */
function fieldValues(product, field) {
  const p = product || {};
  switch (field) {
    case 'collection':   return arr(p.collections);
    case 'tag':          return arr(p.tags);
    case 'product_type': return arr(p.product_type);
    case 'vendor':       return arr(p.vendor);
    case 'category':     return arr(p.category);
    case 'product':      return arr([p.external_id, p.handle, p.title, p.url]);
    default:             return [];
  }
}

function conditionMatches(product, cond) {
  if (!cond || !cond.field) return false;
  if (cond.field === 'all') return true;                 // "All products"
  const want = norm(cond.value);
  if (!want) return false;
  const have = fieldValues(product, cond.field);
  const hit = (cond.op === 'contains')
    ? have.some((v) => v.includes(want))
    : have.some((v) => v === want);
  return cond.op === 'is_not' ? !hit : hit;
}

/**
 * @param {object} product  a catalog_products row (collections, tags, vendor, product_type, category, external_id, handle, title, url)
 * @param {object} rules    { match:'any'|'all', conditions:[...] }
 * @returns {boolean}
 */
export function productMatchesRules(product, rules) {
  if (!rules) return false;

  // Preferred shape: GROUPS. Each group is one saved assignment (e.g. "collection
  // is Men AND tag is Premium"); a product matches if it satisfies ANY group.
  // This is what lets the same chart be assigned from several different filter
  // sets without each one overwriting the last.
  if (Array.isArray(rules.groups) && rules.groups.length) {
    return rules.groups.some((g) => {
      if (!g || !Array.isArray(g.conditions) || !g.conditions.length) return false;
      const res = g.conditions.map((c) => conditionMatches(product, c));
      return g.match === 'any' ? res.some(Boolean) : res.every(Boolean);
    });
  }

  // Legacy shape: a single flat condition list.
  if (!Array.isArray(rules.conditions) || !rules.conditions.length) return false;
  const results = rules.conditions.map((c) => conditionMatches(product, c));
  return rules.match === 'all' ? results.every(Boolean) : results.some(Boolean);
}

/** True when a chart has usable rules (so we know to prefer them over legacy fields). */
export function hasRules(chartData) {
  const r = chartData && chartData.rules;
  if (!r) return false;
  if (Array.isArray(r.groups) && r.groups.some((g) => g && (g.conditions || []).length)) return true;
  return Array.isArray(r.conditions) && r.conditions.length > 0;
}

export default productMatchesRules;
