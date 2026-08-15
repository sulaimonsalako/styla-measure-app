/* What completes an outfit — the missing half of catalogue retrieval.
 *
 * The product index ranks by SEMANTIC SIMILARITY, which is exactly wrong for
 * styling. "What goes with this navy blazer?" embeds close to other navy
 * blazers, so the shopper gets four more blazers and no trousers. Similarity
 * answers "what else is like this"; styling needs "what else goes WITH this".
 *
 * So a styling question has to retrieve against DIFFERENT categories, chosen by
 * what actually completes the look. That's a small, stable, testable rule set —
 * it belongs in code, not in a prompt, because the model can't know which
 * categories a given store even has.
 *
 * Categories are the canonical Styla slugs (see shared/taxonomy.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.STYLA_OUTFIT = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // Ordered by how much they complete the look — the first entry is the one a
  // stylist would reach for first, and retrieval takes them in order.
  var PAIRS = {
    tops:         ['pants', 'skirts', 'shorts', 'outerwear'],
    'dress-shirts': ['pants', 'suits', 'outerwear'],
    pants:        ['tops', 'dress-shirts', 'outerwear'],
    shorts:       ['tops', 'outerwear'],
    skirts:       ['tops', 'outerwear'],
    leggings:     ['tops', 'outerwear'],
    // A dress is already a whole outfit — you layer and accessorise it, you
    // don't pair it with trousers.
    dresses:      ['outerwear'],
    jumpsuits:    ['outerwear'],
    bridesmaid:   ['outerwear'],
    bridal:       ['outerwear'],
    outerwear:    ['tops', 'pants', 'dresses', 'dress-shirts'],
    suits:        ['dress-shirts', 'outerwear'],
    swimwear:     ['outerwear', 'dresses'],
    // Foundation garments are bought FOR an outfit, so the useful pairing runs
    // the other way: what are you wearing this under?
    bras:         ['tops', 'dresses'],
    underwear:    ['pants', 'tops'],
    panties:      ['pants', 'dresses'],
    shapewear:    ['dresses', 'skirts', 'pants'],
    'boys-tops':    ['boys-bottoms'],
    'boys-bottoms': ['boys-tops'],
    'girls-tops':   ['girls-bottoms'],
    'girls-bottoms':['girls-tops'],
    // Only one infants slug exists, so there is nothing to pair TO. Returning
    // ['infants'] would be similarity dressed up as pairing -- the exact bug
    // this module exists to avoid. No complements is the honest answer.
    infants:      []
  };

  function complementsFor(category) {
    var key = String(category || '').trim().toLowerCase();
    return (PAIRS[key] || []).slice();
  }

  // Is the shopper asking us to BUILD something, or to judge/compare THIS item?
  // Only the first needs complementary retrieval; "does this run small" doesn't.
  var PAIRING = /\b(go(es)? with|pair(ed|s|ing)? with|wear (it|this) with|what (do i|should i|to) wear|style (it|this)|match(es|ing)? with|complete the (look|outfit)|outfit|full look|top(s)? for|bottom(s)? for|shoes for|goes over|layer)\b/i;
  var OCCASION = /\b(wedding|interview|work|office|date|party|funeral|christening|holiday|beach|dinner|brunch|casual|formal|black tie|smart casual|night out)\b/i;

  function needsComplements(message) {
    var m = String(message || '');
    return PAIRING.test(m) || OCCASION.test(m);
  }

  /**
   * Categories to retrieve for this message.
   * Returns [] when the question isn't about building an outfit, which tells the
   * caller to fall back to ordinary similarity retrieval.
   */
  function retrievalCategories(currentCategory, message, opts) {
    if (!needsComplements(message)) return [];
    var max = (opts && opts.max) || 3;
    var out = complementsFor(currentCategory);
    // An occasion question ("can I wear this to a wedding?") is partly about
    // whether the store has anything better suited, so keep the item's own
    // category in play too — but behind the things that complete the look.
    if (OCCASION.test(String(message || '')) && currentCategory && out.indexOf(currentCategory) < 0) {
      out = out.concat([String(currentCategory).toLowerCase()]);
    }
    return out.slice(0, max);
  }

  return { PAIRS: PAIRS, complementsFor: complementsFor,
           needsComplements: needsComplements, retrievalCategories: retrievalCategories };
}));
