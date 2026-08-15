/* Resolve a recommended size to a real Shopify variant, and describe what to do
 * with it. Pure: takes the product JSON the block prints, returns data. The DOM
 * poking and the cart POST live in the widget; this part is testable offline.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./variant-size.js'));
  // In the browser STYLA_VARIANT must already be loaded (the block orders the tags).
  else root.STYLA_PDP = factory(root.STYLA_VARIANT);
}(typeof self !== 'undefined' ? self : this, function (VAR) {

  // Which option index holds the size, by NAME. product.options is a plain array
  // of names, so wrap it in the shape variant-size.js expects.
  function sizeIndex(data) {
    var names = (data && data.options) || [];
    return VAR.sizeAxisIndex({ options: names.map(function (n) { return { name: n }; }) });
  }

  function norm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

  // Match leniently on the label the engine gave us: charts say "M", themes may
  // say "M" or "Medium"; charts say "32", themes may say "32" or "W32".
  function matches(optionValue, sizeName) {
    var a = norm(optionValue), b = norm(sizeName);
    if (!a || !b) return false;
    if (a === b) return true;
    var LONG = { xs: 'extra small', s: 'small', m: 'medium', l: 'large', xl: 'extra large' };
    if (LONG[b] === a || LONG[a] === b) return true;
    var na = a.replace(/[^0-9.]/g, ''), nb = b.replace(/[^0-9.]/g, '');
    return !!(na && na === nb);
  }

  // `current` is what the shopper already picked on the page (e.g. ["Black", null]).
  // Without it we'd hand back the first row that happens to match the size, which
  // on a colour-first product means switching them to a colour they didn't choose
  // — and possibly to a sold-out one.
  function findVariant(data, sizeName, current) {
    if (!data || !Array.isArray(data.variants)) return null;
    var idx = sizeIndex(data);
    if (idx < 0) {
      if (((data.options || []).length) !== 1) return null;   // ambiguous: don't guess
      idx = 0;
    }
    var cur = current || [];
    var pool = data.variants.filter(function (v) { return matches((v.options || [])[idx], sizeName); });
    if (!pool.length) return null;
    // 1) keeps every other option the shopper already chose, 2) at least in stock,
    // 3) whatever matched.
    var sameOthers = pool.filter(function (v) {
      return (v.options || []).every(function (val, i) {
        return i === idx || cur[i] == null || norm(val) === norm(cur[i]);
      });
    });
    var pick = function (list) { return list.filter(function (v) { return v.available !== false; })[0] || list[0]; };
    var hit = sameOthers.length ? pick(sameOthers) : pick(pool);
    if (!hit) return null;
    return { id: hit.id, title: hit.title, available: hit.available !== false,
             optionIndex: idx, optionName: (data.options || [])[idx] || null,
             optionValue: (hit.options || [])[idx] };
  }

  return { sizeIndex: sizeIndex, matches: matches, findVariant: findVariant };
}));
