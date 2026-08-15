/* Structured attributes from the product text we ALREADY pull.
 *
 * Styling advice needs colour, material and formality — "pair it with the
 * charcoal wool trousers", not "pair it with trousers". Those usually live in
 * Shopify metafields, which the REST product list does not return inline (one
 * extra call per product, or move the pull to GraphQL).
 *
 * But most of it is already in the title, tags, options and description we pull
 * today. Extracting deterministically from those costs nothing, adds no API
 * calls, and is testable offline — which makes it the right first pass. A
 * metafield/LLM pass can layer on top later and overwrite what it knows better.
 *
 * Deliberately conservative: it returns null rather than guessing. A wrong
 * colour is worse than no colour, because the AI will state it as fact.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.STYLA_ATTRS = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // Colour FAMILIES, not shades. "Ecru", "bone" and "ivory" all style like white;
  // the family is what matters for pairing, and it's what a shopper says.
  var COLOURS = {
    black:  ['black', 'jet', 'onyx', 'noir'],
    white:  ['white', 'ivory', 'ecru', 'bone', 'cream', 'off-white', 'optic'],
    grey:   ['grey', 'gray', 'charcoal', 'slate', 'heather', 'graphite', 'ash'],
    navy:   ['navy', 'midnight'],
    blue:   ['blue', 'cobalt', 'azure', 'denim', 'indigo', 'sky', 'teal'],
    green:  ['green', 'olive', 'khaki', 'sage', 'emerald', 'forest', 'moss'],
    brown:  ['brown', 'tan', 'camel', 'chocolate', 'coffee', 'taupe', 'chestnut', 'cognac'],
    beige:  ['beige', 'sand', 'stone', 'oat', 'nude', 'biscuit'],
    red:    ['red', 'burgundy', 'wine', 'crimson', 'maroon', 'rust', 'brick'],
    pink:   ['pink', 'blush', 'rose', 'fuchsia', 'magenta'],
    purple: ['purple', 'lilac', 'lavender', 'plum', 'aubergine', 'violet'],
    yellow: ['yellow', 'mustard', 'gold', 'ochre'],
    orange: ['orange', 'terracotta', 'apricot', 'coral'],
    multi:  ['multi', 'floral', 'print', 'striped', 'stripe', 'check', 'plaid', 'leopard']
  };

  var MATERIALS = {
    cotton: ['cotton', 'poplin', 'twill', 'chino', 'jersey', 'denim'],
    linen:  ['linen'],
    wool:   ['wool', 'merino', 'cashmere', 'tweed', 'flannel', 'alpaca', 'mohair'],
    silk:   ['silk', 'satin', 'charmeuse'],
    leather:['leather', 'suede', 'nubuck'],
    synthetic: ['polyester', 'nylon', 'acrylic', 'viscose', 'rayon', 'modal', 'lyocell', 'tencel', 'elastane', 'spandex'],
    knit:   ['knit', 'ribbed', 'cable knit']
  };

  // Warmth matters for "is the linen one cooler?" and for occasion advice.
  var WARMTH = { linen: 'cool', cotton: 'moderate', silk: 'cool',
                 synthetic: 'moderate', knit: 'warm', wool: 'warm', leather: 'warm' };

  var FORMAL = {
    formal:   ['black tie', 'tuxedo', 'tux', 'evening gown', 'formal', 'ball gown'],
    smart:    ['suit', 'blazer', 'tailored', 'dress shirt', 'oxford', 'chino', 'loafer', 'occasion', 'wedding', 'business'],
    casual:   ['t-shirt', 'tee', 'hoodie', 'sweatshirt', 'jogger', 'sneaker', 'lounge', 'everyday', 'weekend'],
    active:   ['performance', 'training', 'running', 'gym', 'yoga', 'activewear', 'athletic']
  };

  function haystack(p) {
    p = p || {};
    var parts = [p.title, p.product_type, p.description, p.body_html,
                 (p.tags || []).join ? (p.tags || []).join(' ') : p.tags];
    (p.options || []).forEach(function (o) {
      if (o && o.values && o.values.join) parts.push(o.name + ' ' + o.values.join(' '));
    });
    return String(parts.filter(Boolean).join(' ')).toLowerCase().replace(/<[^>]+>/g, ' ');
  }

  // Whole-word match only. Without the boundary, "coral" matches inside
  // "corallium" and "tan" matches inside "rectangular" — which is exactly how a
  // colour extractor starts confidently lying.
  function firstMatch(text, table) {
    var best = null, bestAt = Infinity;
    Object.keys(table).forEach(function (key) {
      table[key].forEach(function (term) {
        var re = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        var m = re.exec(text);
        if (m && m.index < bestAt) { bestAt = m.index; best = key; }
      });
    });
    return best;
  }

  function allMatches(text, table) {
    return Object.keys(table).filter(function (key) {
      return table[key].some(function (term) {
        return new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(text);
      });
    });
  }

  /**
   * @returns {{colour:string|null, colours:string[], material:string|null,
   *            materials:string[], warmth:string|null, formality:string|null}}
   */
  function extract(product) {
    var text = haystack(product);
    if (!text.trim()) return { colour: null, colours: [], material: null, materials: [], warmth: null, formality: null };

    // A Colour option is authoritative — it's the merchant naming it, not prose.
    var colour = null;
    (product && product.options || []).forEach(function (o) {
      if (colour) return;
      if (!/^colou?r$/i.test(String((o && o.name) || '').trim())) return;
      var vals = (o.values || []).join(' ').toLowerCase();
      colour = firstMatch(vals, COLOURS);
    });
    if (!colour) colour = firstMatch(text, COLOURS);

    var materials = allMatches(text, MATERIALS);
    var material = materials.length === 1 ? materials[0] : firstMatch(text, MATERIALS);

    return {
      colour: colour,
      colours: allMatches(text, COLOURS),
      material: material,
      materials: materials,
      warmth: material ? (WARMTH[material] || null) : null,
      formality: firstMatch(text, FORMAL)
    };
  }

  return { COLOURS: COLOURS, MATERIALS: MATERIALS, FORMAL: FORMAL, WARMTH: WARMTH, extract: extract };
}));
