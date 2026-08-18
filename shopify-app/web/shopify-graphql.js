/* GraphQL Admin API layer — the replacement for fetchShopifyAPI().
 *
 * WHY THIS EXISTS
 * Shopify made the REST Admin API legacy in October 2024, and since 1 April
 * 2025 every NEW public app submitted to the App Store must be built
 * exclusively on the GraphQL Admin API. This app is 13 REST call sites across
 * 9 endpoints, so this is a submission blocker, not a tidy-up.
 *
 * DESIGN: RETURN REST SHAPES.
 * Every function here returns the shape the existing code already expects —
 * `p.body_html`, `p.image.src`, `v.inventory_quantity`, `z.countries[].code`.
 * That is deliberate. mapShopifyProduct(), variantSellable() and
 * mapShopifyZones() stay untouched, so the port can be done and verified ONE
 * CALL SITE AT A TIME instead of as a single unreviewable rewrite.
 *
 * THE ID TRAP — read before touching anything.
 * GraphQL returns `gid://shopify/Product/123`. The catalogue stores
 * external_id as the bare numeric id, and prune-on-sync deletes rows whose
 * external_id is absent from the pull. Return a gid and the very first
 * authoritative sync deletes the merchant's entire indexed catalogue and
 * re-adds it under new ids. Always use legacyResourceId.
 *
 * NOT WIRED IN YET. Nothing imports this. Port one call, test it, keep going.
 */
'use strict';

// GraphQL is versioned by URL string only — this file uses plain fetch, and the
// @shopify/shopify-api package is used solely for OAuth. So the version below
// can move independently of the library, and none of this needs v9 upgrading.
const API_VERSION = '2026-07';

class ShopifyGraphQLError extends Error {
  constructor(message, { query, variables, errors, status } = {}) {
    super(message);
    this.name = 'ShopifyGraphQLError';
    this.query = query; this.variables = variables; this.errors = errors; this.status = status;
  }
}

/**
 * One request. Throws on transport errors AND on GraphQL `errors`, because a
 * GraphQL error arrives with HTTP 200 and a null field — silently turning into
 * "this shop has no products" if you only check response.ok.
 */
async function gql(shop, accessToken, query, variables = {}) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new ShopifyGraphQLError(`Shopify GraphQL HTTP ${res.status}`, { query, variables, status: res.status });
  const json = await res.json();
  if (json.errors && json.errors.length)
    throw new ShopifyGraphQLError(json.errors.map((e) => e.message).join('; '), { query, variables, errors: json.errors });
  return json.data;
}

/** gid://shopify/Product/123 -> "123". Only for ids we did not ask legacy for. */
const numericId = (gid) => String(gid || '').split('/').pop();

// ---------------------------------------------------------------- products --

const PRODUCT_FIELDS = `
  legacyResourceId
  handle
  title
  descriptionHtml
  productType
  vendor
  tags
  status
  category { fullName name }
  featuredImage { url }
  images(first: 10) { nodes { url } }
  options { name values }
  variants(first: 100) {
    nodes {
      legacyResourceId
      title
      price
      inventoryQuantity
      inventoryPolicy
      selectedOptions { name value }
      inventoryItem { legacyResourceId tracked }
    }
  }
`;

/**
 * Shape a GraphQL product like a REST one.
 *
 * `inventory_management` is the subtle one. REST returns the string "shopify"
 * or null, and variantSellable() treats null as "not tracked, always
 * sellable". GraphQL exposes the same fact as inventoryItem.tracked, so it has
 * to be inverted back into that string or every untracked variant flips to
 * unsellable and the widget starts telling shoppers their size is sold out.
 */
function toRestProduct(node) {
  if (!node) return null;
  return {
    id: node.legacyResourceId,
    handle: node.handle,
    title: node.title,
    body_html: node.descriptionHtml,
    product_type: node.productType,
    vendor: node.vendor,
    tags: node.tags || [],                       // REST sends a CSV string; callers accept both
    status: String(node.status || '').toLowerCase(),   // GraphQL says ACTIVE, REST says active
    category: node.category ? { full_name: node.category.fullName, name: node.category.name } : null,
    image: node.featuredImage ? { src: node.featuredImage.url } : null,
    images: ((node.images && node.images.nodes) || []).map((i) => ({ src: i.url })),
    options: (node.options || []).map((o) => ({ name: o.name, values: o.values })),
    variants: ((node.variants && node.variants.nodes) || []).map((v) => ({
      id: v.legacyResourceId,
      inventory_item_id: v.inventoryItem ? v.inventoryItem.legacyResourceId : null,
      title: v.title,
      price: v.price,
      inventory_quantity: v.inventoryQuantity,
      inventory_policy: String(v.inventoryPolicy || '').toLowerCase(),   // CONTINUE -> continue
      inventory_management: (v.inventoryItem && v.inventoryItem.tracked) ? 'shopify' : null,
      // variantSize() resolves the size axis by option NAME, and REST gives it
      // option1/2/3 positionally. Provide both so it keeps working either way.
      options: (v.selectedOptions || []).map((o) => o.value),
      option1: (v.selectedOptions || [])[0] ? v.selectedOptions[0].value : null,
      option2: (v.selectedOptions || [])[1] ? v.selectedOptions[1].value : null,
      option3: (v.selectedOptions || [])[2] ? v.selectedOptions[2].value : null,
      selectedOptions: v.selectedOptions || [],
    })),
  };
}

/** Replaces: fetchShopifyAllPages(... 'products.json?limit=250', 'products') */
async function fetchAllProducts(shop, accessToken, { pageSize = 100, maxPages = 200 } = {}) {
  const QUERY = `query Products($n: Int!, $cursor: String) {
    products(first: $n, after: $cursor) {
      nodes { ${PRODUCT_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const out = [];
  let cursor = null, pages = 0;
  // Cursor pagination, same contract as the Link-header loop it replaces: the
  // caller treats a full read as authoritative and PRUNES anything missing, so
  // a truncated read must be visible, never silently short.
  for (;;) {
    const data = await gql(shop, accessToken, QUERY, { n: pageSize, cursor });
    const conn = data.products;
    out.push(...(conn.nodes || []).map(toRestProduct));
    pages += 1;
    if (!conn.pageInfo.hasNextPage) return { products: out, complete: true, pages };
    if (pages >= maxPages) return { products: out, complete: false, pages };
    cursor = conn.pageInfo.endCursor;
  }
}

/** Replaces: fetchShopifyAPI(shop, token, `products/${id}.json`) */
async function fetchProduct(shop, accessToken, productId) {
  const QUERY = `query Product($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`;
  const gid = String(productId).startsWith('gid://') ? String(productId) : `gid://shopify/Product/${productId}`;
  const data = await gql(shop, accessToken, QUERY, { id: gid });
  return { product: toRestProduct(data.product) };
}

// ------------------------------------------------------------- collections --

/**
 * Replaces THREE REST calls at once: custom_collections.json,
 * smart_collections.json and the collects.json pagination loop.
 *
 * GraphQL has no custom/smart split and exposes membership directly on the
 * collection, so the whole "fetch both kinds, page through collects, join by
 * id" dance collapses into one query.
 *
 * @returns {Object} productId -> [collection titles], as the REST code built.
 */
async function fetchCollectionsMap(shop, accessToken, { collections = 100, perCollection = 250 } = {}) {
  const QUERY = `query Collections($n: Int!, $p: Int!, $cursor: String) {
    collections(first: $n, after: $cursor) {
      nodes { title products(first: $p) { nodes { legacyResourceId } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const map = {};
  let cursor = null;
  for (;;) {
    const data = await gql(shop, accessToken, QUERY, { n: collections, p: perCollection, cursor });
    for (const c of data.collections.nodes || []) {
      for (const p of (c.products && c.products.nodes) || []) {
        (map[String(p.legacyResourceId)] = map[String(p.legacyResourceId)] || []).push(c.title);
      }
    }
    if (!data.collections.pageInfo.hasNextPage) return map;
    cursor = data.collections.pageInfo.endCursor;
  }
}

// -------------------------------------------------------------------- shop --

/** Replaces: fetchShopifyAPI(shop, token, 'shop.json') */
async function fetchShop(shop, accessToken) {
  const QUERY = `query { shop { name myshopifyDomain primaryDomain { host } } }`;
  const data = await gql(shop, accessToken, QUERY);
  const s = data.shop || {};
  return { shop: { name: s.name, domain: (s.primaryDomain && s.primaryDomain.host) || s.myshopifyDomain, myshopify_domain: s.myshopifyDomain } };
}

// ---------------------------------------------------------------- shipping --

/**
 * Replaces: fetchShopifyAPI(shop, token, 'shipping_zones.json')
 *
 * The one real shape change. REST returned a flat zone list; GraphQL nests
 * zones under delivery profiles and location groups. Flattened back to
 * [{ countries: [{ code }] }] because shared/brand-attrs.js mapShopifyZones()
 * reads exactly that, and "*" still has to survive — it is how Shopify says
 * "Rest of world", which is what sets brands.ships_worldwide.
 */
async function fetchShippingZones(shop, accessToken) {
  const QUERY = `query {
    deliveryProfiles(first: 20) {
      nodes {
        profileLocationGroups {
          locationGroupZones(first: 50) {
            nodes { zone { name countries { code { countryCode restOfWorld } } } }
          }
        }
      }
    }
  }`;
  const data = await gql(shop, accessToken, QUERY);
  const zones = [];
  for (const profile of (data.deliveryProfiles && data.deliveryProfiles.nodes) || []) {
    for (const group of profile.profileLocationGroups || []) {
      for (const z of (group.locationGroupZones && group.locationGroupZones.nodes) || []) {
        const zone = z.zone || {};
        zones.push({
          name: zone.name,
          countries: (zone.countries || []).map((c) => ({
            code: (c.code && c.code.restOfWorld) ? '*' : (c.code && c.code.countryCode) || '',
          })),
        });
      }
    }
  }
  return { shipping_zones: zones };
}

// ------------------------------------------------------------------ themes --

/** Replaces: fetchShopifyAPI(shop, token, 'themes.json') + find(role === 'main') */
async function fetchLiveTheme(shop, accessToken) {
  const QUERY = `query { themes(first: 1, roles: [MAIN]) { nodes { id name role } } }`;
  const data = await gql(shop, accessToken, QUERY);
  const t = ((data.themes && data.themes.nodes) || [])[0];
  return t ? { id: t.id, legacy_id: numericId(t.id), name: t.name, role: 'main' } : null;
}

/**
 * Replaces: themes/{id}/assets.json?asset[key]=...
 * `themeId` is the GRAPHQL gid from fetchLiveTheme, not the numeric id.
 */
async function fetchThemeAsset(shop, accessToken, themeId, key) {
  const QUERY = `query ThemeFile($id: ID!, $names: [String!]!) {
    theme(id: $id) {
      files(filenames: $names, first: 1) {
        nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } }
      }
    }
  }`;
  const data = await gql(shop, accessToken, QUERY, { id: themeId, names: [key] });
  const node = ((data.theme && data.theme.files && data.theme.files.nodes) || [])[0];
  const content = node && node.body && node.body.content;
  return typeof content === 'string' ? content : null;
}

/** Replaces: themes/{id}/assets.json (listing) -> array of asset keys */
async function listThemeAssets(shop, accessToken, themeId, { pageSize = 250, maxPages = 20 } = {}) {
  const QUERY = `query ThemeFiles($id: ID!, $n: Int!, $cursor: String) {
    theme(id: $id) {
      files(first: $n, after: $cursor) { nodes { filename } pageInfo { hasNextPage endCursor } }
    }
  }`;
  const keys = [];
  let cursor = null, pages = 0;
  for (;;) {
    const data = await gql(shop, accessToken, QUERY, { id: themeId, n: pageSize, cursor });
    const files = (data.theme && data.theme.files) || { nodes: [], pageInfo: {} };
    keys.push(...(files.nodes || []).map((f) => f.filename));
    pages += 1;
    if (!files.pageInfo.hasNextPage || pages >= maxPages) return keys;
    cursor = files.pageInfo.endCursor;
  }
}

// ---------------------------------------------------------------- webhooks --
//
// webhooks.json has NO replacement here, on purpose. Every topic this app uses
// is now declared in shopify.app.toml and applied by `shopify app deploy`, so
// registerWebhooks() and its REST POST should be deleted rather than ported.
// Add products/create|update|delete and inventory_levels/update to the
// [[webhooks.subscriptions]] block alongside the compliance topics.

module.exports = {
  API_VERSION, gql, ShopifyGraphQLError, toRestProduct, numericId,
  fetchAllProducts, fetchProduct, fetchCollectionsMap, fetchShop,
  fetchShippingZones, fetchLiveTheme, fetchThemeAsset, listThemeAssets,
};
