/* SINGLE SOURCE OF TRUTH — brand attributes and shipping regions.
 * Shared by the Shopify app, the Styla admin and the discovery APIs.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.STYLA_BRAND = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  // Brands whose patterns are DRAFTED for a body, not scaled from standard sizes.
  var SPECIALTIES = [
    { key:'big-and-tall', label:'Big & tall' },
    { key:'plus-size',    label:'Plus size' },
    { key:'petite',       label:'Petite' },
    { key:'tall',         label:'Tall' },
    { key:'maternity',    label:'Maternity' },
    { key:'adaptive',     label:'Adaptive' },
  ];

  var ORIGINS = [
    { code:'',   name:'—' },
    { code:'CA', name:'Canada' },        { code:'US', name:'United States' },
    { code:'GB', name:'United Kingdom' },{ code:'IE', name:'Ireland' },
    { code:'FR', name:'France' },        { code:'IT', name:'Italy' },
    { code:'ES', name:'Spain' },         { code:'PT', name:'Portugal' },
    { code:'DE', name:'Germany' },       { code:'NL', name:'Netherlands' },
    { code:'SE', name:'Sweden' },        { code:'DK', name:'Denmark' },
    { code:'AU', name:'Australia' },     { code:'NZ', name:'New Zealand' },
    { code:'JP', name:'Japan' },         { code:'KR', name:'South Korea' },
    { code:'CN', name:'China' },         { code:'IN', name:'India' },
    { code:'TR', name:'Turkey' },        { code:'BR', name:'Brazil' },
    { code:'MX', name:'Mexico' },        { code:'ZA', name:'South Africa' },
    { code:'NG', name:'Nigeria' },       { code:'GH', name:'Ghana' },
    { code:'KE', name:'Kenya' },
  ];

  var EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV',
    'LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];

  // Region key -> the ISO country codes it covers.
  var SHIP_REGIONS = [
    { key:'us',   label:'United States',  countries:['US'] },
    { key:'ca',   label:'Canada',         countries:['CA'] },
    { key:'uk',   label:'United Kingdom', countries:['GB'] },
    { key:'eu',   label:'European Union', countries:EU_COUNTRIES },
    { key:'au',   label:'Australia',      countries:['AU'] },
    { key:'nz',   label:'New Zealand',    countries:['NZ'] },
    { key:'intl', label:'Rest of world',  countries:[] },
  ];

  // Single-country regions, for turning Shopify shipping zones into region keys.
  var SINGLE_REGION = { US:'us', CA:'ca', GB:'uk', AU:'au', NZ:'nz' };

  /**
   * Can this brand deliver to the shopper? Unknown data must never hide a brand.
   * @param {object} brand   { ships_worldwide, ships_to }
   * @param {string} country ISO-3166 alpha-2, e.g. 'GB'
   */
  function shipsTo(brand, country) {
    if (!country) return true;
    var cc = String(country).trim().toUpperCase();
    if (!brand) return true;
    if (brand.ships_worldwide) return true;
    var list = Array.isArray(brand.ships_to) ? brand.ships_to : [];
    if (!list.length) return true;
    if (list.indexOf('intl') > -1) return true;
    return list.some(function (key) {
      var k = String(key).toLowerCase();
      if (k === cc.toLowerCase()) return true;              // raw country code
      var region = SHIP_REGIONS.filter(function (r) { return r.key === k; })[0];
      return region ? region.countries.indexOf(cc) > -1 : false;
    });
  }

  /** Shopify shipping_zones -> { worldwide, ships_to } in our stored shape. */
  function mapShopifyZones(zones) {
    var codes = {}, worldwide = false;
    (zones || []).forEach(function (z) {
      (z.countries || []).forEach(function (c) {
        var code = String(c.code || '').toUpperCase();
        if (!code) return;
        if (code === '*') worldwide = true;                 // Shopify "Rest of world"
        else codes[code] = 1;
      });
    });
    var list = Object.keys(codes);
    var regions = {};
    list.forEach(function (c) { if (SINGLE_REGION[c]) regions[SINGLE_REGION[c]] = 1; });
    // only claim 'eu' when the WHOLE region is covered, so partial coverage
    // never over-claims
    if (EU_COUNTRIES.every(function (c) { return codes[c]; })) regions.eu = 1;
    var ships_to = Object.keys(regions).concat(list.map(function (c) { return c.toLowerCase(); }));
    return { worldwide: worldwide, ships_to: ships_to.filter(function (v, i, a) { return a.indexOf(v) === i; }),
             countryCount: list.length };
  }

  return { SPECIALTIES: SPECIALTIES, ORIGINS: ORIGINS, EU_COUNTRIES: EU_COUNTRIES,
           SHIP_REGIONS: SHIP_REGIONS, SINGLE_REGION: SINGLE_REGION,
           shipsTo: shipsTo, mapShopifyZones: mapShopifyZones };
}));
