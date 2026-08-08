// Shipping logic lives in shared/brand-attrs.js so the Shopify app, the Styla
// admin and these APIs all use ONE definition. This file only re-exports it.
import shared from '../../shared/brand-attrs.js';

export const EU_COUNTRIES = shared.EU_COUNTRIES;
export const SHIP_REGIONS = shared.SHIP_REGIONS;
export const shipsTo = shared.shipsTo;
export default shipsTo;
