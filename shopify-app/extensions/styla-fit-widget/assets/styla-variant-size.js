/* GENERATED COPY of shared/variant-size.js — do not edit here.
 * Edit shared/variant-size.js and run: node tools/sync-shared.mjs
 * Theme app extensions can only load local assets, so this copy exists on
 * purpose; tools/sync-shared.mjs --check fails the build if it drifts. */
/* Which variant option axis actually holds the SIZE.
 *
 * Shopify's variant.option1/2/3 are POSITIONAL, not semantic. Plenty of stores
 * order their options Colour-first, and on those, reading v.option1 indexes
 * colour names as sizes: the widget then offers "Black / White" as sizes and
 * every fit lookup misses. Read product.options[] by NAME instead.
 *
 * One definition, used by the Shopify app (CJS), any browser surface, and the
 * adversarial harness -- same pattern as taxonomy.js / chart-keys.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.STYLA_VARIANT = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // Deliberately anchored: a "Size" option is named exactly that (in a handful of
  // languages), not merely something containing the word -- "Shoe Size Guide" or
  // "Sample Size" should not win the axis.
  var SIZE_OPTION = /^(size|sizes|taille|talla|gr(ö|oe)sse|groesse|tamanho|misura|maat|storlek|us size|uk size|eu size|size \(us\)|size \(uk\)|size \(eu\))$/i;

  function sizeAxisIndex(product) {
    var opts = (product && product.options) || [];
    for (var i = 0; i < opts.length; i++) {
      var n = String((opts[i] && opts[i].name) || '').trim();
      if (SIZE_OPTION.test(n)) return i;
    }
    return -1;
  }

  function variantSize(product, v) {
    if (!v) return null;
    var opts = (product && product.options) || [];
    var idx = sizeAxisIndex(product);
    if (idx >= 0) {
      var val = v['option' + (idx + 1)];
      if (val) return val;
    }
    // No named size axis. With exactly one option (or none recorded) option1 is
    // almost certainly the size. With several unnamed options, guessing is worse
    // than admitting we don't know -- returning null lets the caller skip it.
    if (opts.length <= 1) return v.option1 || null;
    return null;
  }

  return { SIZE_OPTION: SIZE_OPTION, sizeAxisIndex: sizeAxisIndex, variantSize: variantSize };
}));
