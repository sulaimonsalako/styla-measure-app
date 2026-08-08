// Where a brand ships. Discovery must never recommend a brand that can't deliver
// to the shopper — a Scottish shopper shouldn't be shown a US-only label.
//
// Brands declare either `ships_worldwide` or a list of regions/countries in
// `ships_to`. Regions are stored as friendly keys ('eu', 'uk', 'us'…) and matched
// against the shopper's ISO country code.

export const EU_COUNTRIES = [
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV',
  'LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
];

// Region key -> the ISO country codes it covers.
export const SHIP_REGIONS = [
  { key: 'us',   label: 'United States',    countries: ['US'] },
  { key: 'ca',   label: 'Canada',           countries: ['CA'] },
  { key: 'uk',   label: 'United Kingdom',   countries: ['GB'] },
  { key: 'eu',   label: 'European Union',   countries: EU_COUNTRIES },
  { key: 'au',   label: 'Australia',        countries: ['AU'] },
  { key: 'nz',   label: 'New Zealand',      countries: ['NZ'] },
  { key: 'intl', label: 'Rest of world',    countries: [] }, // explicit catch-all
];

/**
 * Can this brand deliver to the shopper?
 * @param {object} brand   { ships_worldwide, ships_to }
 * @param {string} country shopper's ISO-3166 alpha-2 code (e.g. 'GB')
 * @returns {boolean} true when it ships there, or when we simply don't know
 *                    (unknown data must not silently hide brands).
 */
export function shipsTo(brand, country) {
  if (!country) return true;                       // no shopper location -> don't filter
  const cc = String(country).trim().toUpperCase();
  if (!brand) return true;
  if (brand.ships_worldwide) return true;
  const list = Array.isArray(brand.ships_to) ? brand.ships_to : [];
  if (!list.length) return true;                   // brand hasn't said -> don't penalise it
  if (list.includes('intl')) return true;
  return list.some((key) => {
    const k = String(key).toLowerCase();
    if (k === cc.toLowerCase()) return true;       // a raw country code was stored
    const region = SHIP_REGIONS.find((r) => r.key === k);
    return region ? region.countries.includes(cc) : false;
  });
}

export default shipsTo;
