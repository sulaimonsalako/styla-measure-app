require('@shopify/shopify-api/adapters/node');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
// Load env: the Shopify CLI-managed local .env (if present) first, then the
// shared repo-root .env for the secrets the whole project uses (Supabase URL +
// service-role key, Google API key, etc.). dotenv never overrides already-set
// vars, so CLI-injected SHOPIFY_API_KEY/SECRET stay intact.
require('dotenv').config();
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const { shopifyApi, ApiVersion, RequestedTokenType } = require('@shopify/shopify-api');
// Shared definitions — one copy, used by the Styla admin and APIs too.
const SHARED_CHART = require('../../shared/chart-keys.js');
const SHARED_BRAND = require('../../shared/brand-attrs.js');

// Express App Initialization
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
// Raw body parser needed for Shopify webhook HMAC verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Supabase DB Client
const supabaseUrl = process.env.SUPABASE_URL || 'https://example.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Shopify API Configuration
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || 'mock_key',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || 'mock_secret',
  // Only what we use: catalog + collections (read_products), live stock
  // (read_inventory), and real shipping destinations (read_shipping) so Styla
  // never recommends a brand that can't deliver to the shopper.
  scopes: ['read_products', 'read_inventory', 'read_shipping'],
  hostName: process.env.HOST ? process.env.HOST.replace(/https:\/\//, '') : 'localhost:8080',
  apiVersion: ApiVersion.April24,
  isEmbeddedApp: true
});

// Helper: Fetch Shopify API wrapper
async function fetchShopifyAPI(shop, accessToken, endpoint, options = {}) {
  const { _raw, ...opts } = options;
  const url = `https://${shop}/admin/api/2024-04/${endpoint}`;
  const response = await fetch(url, {
    ...opts,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!response.ok) {
    throw new Error(`Shopify API error for ${endpoint}: ${response.statusText}`);
  }
  if (_raw) return { body: await response.json(), headers: response.headers };
  return response.json();
}

// Shopify pages with a cursor in the Link header. Without following it we only
// ever saw the first 250 products — harmless when sync was additive, but fatal
// once sync can DELETE what it doesn't see. `complete` tells the caller whether
// the whole catalog was actually retrieved; it is the guard on pruning.
async function fetchShopifyAllPages(shop, accessToken, path, key, maxPages = 40) {
  const items = [];
  let endpoint = path;
  let pages = 0;
  while (endpoint && pages < maxPages) {
    const { body, headers } = await fetchShopifyAPI(shop, accessToken, endpoint, { _raw: true });
    items.push(...(body[key] || []));
    pages += 1;
    const link = headers.get('link') || headers.get('Link') || '';
    const next = /<[^>]*[?&]page_info=([^>&]+)[^>]*>;\s*rel="next"/.exec(link);
    if (!next) { endpoint = null; break; }
    const base = path.split('?')[0];
    const limit = /[?&]limit=(\d+)/.exec(path);
    endpoint = `${base}?limit=${limit ? limit[1] : 250}&page_info=${next[1]}`;
  }
  // Ran out of page budget while a cursor was still pending => truncated.
  return { items, complete: !endpoint };
}

// --- Styla semantic index helpers -----------------------------------------
// Base URL of the Styla API (the product index + embeddings live there).
const STYLA_URL = process.env.STYLA_URL || 'https://www.styla.ca';
const stripHtml = (h) => String(h || '')
  .replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

// Map a Shopify product (REST list item OR webhook payload — same shape) into
// the shape Styla's /api/catalog-ingest expects.
// Build productId -> [collection titles]. Merchants group by collection, so this
// is a strong signal for categorising and for merchandising-aware recommendations.
async function fetchCollectionMap(shop, token) {
  const map = {};
  try {
    const [custom, smart] = await Promise.all([
      fetchShopifyAPI(shop, token, 'custom_collections.json?limit=250').catch(() => ({})),
      fetchShopifyAPI(shop, token, 'smart_collections.json?limit=250').catch(() => ({})),
    ]);
    const cols = [].concat(custom.custom_collections || [], smart.smart_collections || []);
    if (!cols.length) return map;
    // collects.json links products to collections (a few pages is plenty here).
    for (let page = 1, url = 'collects.json?limit=250'; page <= 4 && url; page++) {
      const data = await fetchShopifyAPI(shop, token, url).catch(() => null);
      const rows = (data && data.collects) || [];
      if (!rows.length) break;
      const byId = Object.fromEntries(cols.map((c) => [String(c.id), c.title]));
      rows.forEach((c) => {
        const title = byId[String(c.collection_id)];
        if (!title) return;
        const k = String(c.product_id);
        (map[k] = map[k] || []).push(title);
      });
      url = rows.length === 250 ? `collects.json?limit=250&since_id=${rows[rows.length - 1].id}` : null;
    }
  } catch (e) { console.error('collection map failed (non-fatal):', e.message); }
  return map;
}

function mapShopifyProduct(shop, p, collections) {
  return {
    collections: collections || [],
    external_id: String(p.id),
    handle: p.handle,
    url: `https://${shop}/products/${p.handle}`,
    title: p.title,
    description: stripHtml(p.body_html),
    vendor: p.vendor,
    product_type: p.product_type,
    // Shopify's Standard Product Category (structured taxonomy) when set — the
    // best signal for mapping to a Styla category; Styla's ingest also falls back
    // to product_type/title/tags. REST may not always include it, hence the guards.
    category: (p.category && (p.category.full_name || p.category.name)) || p.product_type || null,
    tags: p.tags ? String(p.tags).split(',').map((t) => t.trim()).filter(Boolean) : [],
    price: (p.variants && p.variants[0] && p.variants[0].price != null) ? Number(p.variants[0].price) : null,
    image_url: (p.image && p.image.src) || (p.images && p.images[0] && p.images[0].src) || null,
    variants: (p.variants || []).map((v) => ({ id: v.id, inventory_item_id: v.inventory_item_id, title: v.title, size: v.option1, price: v.price, available: variantSellable(v) })),
    // NOTE: the Admin REST API does NOT return variant.available (that's the
    // Storefront API). Derive it: untracked inventory or "continue" policy is
    // always sellable, otherwise require stock. Product must also be active.
    available: (p.status ? p.status === 'active' : true)
      && (Array.isArray(p.variants) && p.variants.length ? p.variants.some(variantSellable) : true),
  };
}

function variantSellable(v) {
  if (!v) return false;
  if (!v.inventory_management) return true;          // inventory not tracked
  if (v.inventory_policy === 'continue') return true; // oversell allowed
  return Number(v.inventory_quantity) > 0;
}

// Push upserts (products) and/or removals (remove: [externalId]) to the index.
async function pushToStylaIndex(shop, body) {
  const r = await fetch(`${STYLA_URL}/api/catalog-ingest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shop, domain: shop, ...body }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || out.error) throw new Error(out.error || 'Styla ingest failed.');
  return out;
}

// ----------------------------------------------------
// 1. Shopify OAuth Routes
// ----------------------------------------------------
app.get('/api/auth', async (req, res) => {
  const shop = req.query.shop;
  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }

  // Redirect to Shopify OAuth authorization screen
  res.redirect(await shopify.auth.begin({
    shop,
    callbackPath: '/api/auth/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res
  }));
});

app.get('/api/auth/callback', async (req, res) => {
  try {
    const callbackInfo = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res
    });

    const { session } = callbackInfo;
    const shop = session.shop;
    const accessToken = session.accessToken;

    // Save session in Supabase (merchant settings)
    const { error } = await supabase
      .from('merchant_sessions')
      .upsert({ shop, access_token: accessToken, created_at: new Date() });

    if (error) throw error;

    // Register webhooks automatically upon installation
    try {
      await registerShopifyWebhooks(shop, accessToken);
    } catch (whErr) {
      console.error('Failed to automatically register webhooks:', whErr);
    }

    // Redirect to the embedded App inside Shopify Admin
    const host = req.query.host;
    res.redirect(`https://${shop}/admin/apps/styla-fit-engine?host=${host}`);
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    res.status(500).send('OAuth Authentication Failed');
  }
});

// Register webhook helper
async function registerShopifyWebhooks(shop, accessToken) {
  const host = process.env.HOST || `https://${shop}`;
  const webhooksToRegister = ['app/uninstalled', 'products/create', 'products/update', 'products/delete', 'inventory_levels/update'];
  
  for (const topic of webhooksToRegister) {
    try {
      const payload = {
        webhook: {
          topic,
          address: `${host}/api/webhooks`,
          format: 'json'
        }
      };
      await fetchShopifyAPI(shop, accessToken, 'webhooks.json', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      console.log(`Registered Shopify webhook ${topic} for ${shop}`);
    } catch (err) {
      // Ignore if already registered
      console.log(`Webhook registration skipped/failed for topic ${topic}:`, err.message);
    }
  }
}

// ----------------------------------------------------
// 2. Shopify Webhook Handlers
// ----------------------------------------------------
app.post('/api/webhooks', async (req, res) => {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const topic = req.get('X-Shopify-Topic');
  const shop = req.get('X-Shopify-Shop-Domain');

  // Verify HMAC signature
  const generatedHash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET || 'mock_secret')
    .update(req.rawBody)
    .digest('base64');

  if (generatedHash !== hmac) {
    return res.status(401).send('Unauthorized webhook signature');
  }

  console.log(`Received Shopify Webhook: ${topic} for ${shop}`);
  const payload = req.body;

  try {
    if (topic === 'app/uninstalled') {
      await supabase.from('merchant_sessions').delete().eq('shop', shop);
      console.log(`Removed session for uninstalled shop: ${shop}`);
    } else if (topic === 'products/create' || topic === 'products/update') {
      const productId = String(payload.id);
      const title = payload.title;
      const handle = payload.handle;
      const imageUrl = payload.image ? payload.image.src : (payload.images && payload.images[0] ? payload.images[0].src : null);
      
      // Get unique variant sizes (e.g. S, M, L)
      const sizesSet = new Set();
      if (Array.isArray(payload.variants)) {
        payload.variants.forEach(v => {
          if (v.option1) sizesSet.add(v.option1);
          else if (v.title) sizesSet.add(v.title);
        });
      }
      const sizes = Array.from(sizesSet);

      // Check if product size chart already exists
      const { data: existing } = await supabase
        .from('product_size_charts')
        .select('*')
        .eq('shopify_product_id', productId)
        .maybeSingle();

      const defaultGrid = {};
      sizes.forEach(sz => {
        defaultGrid[sz] = {};
      });

      const sizeGrid = existing ? { ...defaultGrid, ...existing.size_grid } : defaultGrid;
      
      // Upsert product metadata and retain existing mapping grid
      await supabase
        .from('product_size_charts')
        .upsert({
          shopify_product_id: productId,
          title,
          handle,
          image_url: imageUrl,
          size_grid: sizeGrid,
          ease_profile_id: existing ? existing.ease_profile_id : 'regular',
          updated_at: new Date()
        });

      console.log(`Synced product metadata for ${title} (${productId}) via webhook`);

      // Keep the semantic index live: upsert this one product (content-hash
      // gate on Styla's side skips re-embedding if nothing meaningful changed).
      try {
        const { data: st } = await supabase.from('shop_settings').select('settings').eq('shop', shop).maybeSingle();
        const shared = ((st && st.settings) || {}).share_catalog !== false;
        await pushToStylaIndex(shop, { products: [mapShopifyProduct(shop, payload)], shared });
      } catch (e) { console.error('Styla index upsert (webhook) failed:', e.message); }
    } else if (topic === 'products/delete') {
      const productId = String(payload.id);
      await supabase.from('product_size_charts').delete().eq('shopify_product_id', productId);
      console.log(`Deleted product ${productId} via webhook`);

      // Remove it from the semantic index too.
      try { await pushToStylaIndex(shop, { remove: [productId] }); }
      catch (e) { console.error('Styla index remove (webhook) failed:', e.message); }
    } else if (topic === 'inventory_levels/update') {
      // Stock changed. Resolve inventory_item_id -> the indexed product (we store
      // it on each variant), then re-fetch that product so `available` stays true
      // to reality — keeps sold-out items out of recommendations.
      try {
        const invId = payload.inventory_item_id;
        const { data: brand } = await supabase.from('brands').select('id').eq('domain', shop).maybeSingle();
        if (invId && brand) {
          const { data: rows } = await supabase.from('catalog_products')
            .select('external_id').eq('brand_id', brand.id)
            .filter('variants', 'cs', JSON.stringify([{ inventory_item_id: invId }]));
          const ext = rows && rows[0] && rows[0].external_id;
          if (ext) {
            const { data: sess } = await supabase.from('merchant_sessions')
              .select('access_token').eq('shop', shop).maybeSingle();
            if (sess) {
              const one = await fetchShopifyAPI(shop, sess.access_token, `products/${ext}.json`);
              if (one && one.product) {
                const { data: st } = await supabase.from('shop_settings').select('settings').eq('shop', shop).maybeSingle();
                await pushToStylaIndex(shop, {
                  products: [mapShopifyProduct(shop, one.product)],
                  shared: ((st && st.settings) || {}).share_catalog !== false,
                });
              }
            }
          }
        }
      } catch (e) { console.error('inventory webhook failed (non-fatal):', e.message); }
    }
  } catch (err) {
    console.error(`Error processing webhook topic ${topic}:`, err);
  }

  res.status(200).send('Webhook verified');
});

// ----------------------------------------------------
// 3. Catalog Sync Trigger Endpoint (React Panel / Admin Init)
// ----------------------------------------------------
app.post('/api/sync/catalog', async (req, res) => {
  const { shop } = req.body;
  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter.' });
  }

  try {
    // 1. Retrieve access token
    const { data: sessionData, error: sessErr } = await supabase
      .from('merchant_sessions')
      .select('access_token')
      .eq('shop', shop)
      .maybeSingle();

    if (sessErr || !sessionData) {
      return res.status(404).json({ error: 'Merchant session not found. Please re-authenticate.' });
    }

    const accessToken = sessionData.access_token;
    
    // 2. Fetch products from Shopify Admin REST API
    console.log(`Fetching product catalog for ${shop}...`);
    const data = await fetchShopifyAPI(shop, accessToken, 'products.json?limit=250');
    const products = data.products || [];

    let count = 0;
    for (const p of products) {
      const productId = String(p.id);
      const title = p.title;
      const handle = p.handle;
      const imageUrl = p.image ? p.image.src : (p.images && p.images[0] ? p.images[0].src : null);
      
      const sizesSet = new Set();
      if (Array.isArray(p.variants)) {
        p.variants.forEach(v => {
          if (v.option1) sizesSet.add(v.option1);
          else if (v.title) sizesSet.add(v.title);
        });
      }
      const sizes = Array.from(sizesSet);

      const { data: existing } = await supabase
        .from('product_size_charts')
        .select('*')
        .eq('shopify_product_id', productId)
        .maybeSingle();

      const defaultGrid = {};
      sizes.forEach(sz => {
        defaultGrid[sz] = {};
      });

      const sizeGrid = existing ? { ...defaultGrid, ...existing.size_grid } : defaultGrid;

      await supabase
        .from('product_size_charts')
        .upsert({
          shopify_product_id: productId,
          title,
          handle,
          image_url: imageUrl,
          size_grid: sizeGrid,
          ease_profile_id: existing ? existing.ease_profile_id : 'regular',
          updated_at: new Date()
        });

      count++;
    }

    res.status(200).json({ success: true, message: `Successfully synced ${count} products.` });

  } catch (err) {
    console.error('Catalog Sync Error:', err);
    res.status(500).json({ error: 'Failed to synchronize product catalog.', details: err.message });
  }
});

// ----------------------------------------------------
// 4. Shopify App Proxy Endpoint (Secure Storefront Fit Calculation)
// ----------------------------------------------------
app.get('/api/proxy/recommendation', async (req, res) => {
  const query = req.query;
  const signature = query.signature;
  
  if (!signature) {
    return res.status(401).send('Missing App Proxy signature');
  }

  const sortedParams = Object.keys(query)
    .filter(k => k !== 'signature')
    .sort()
    .map(k => `${k}=${Array.isArray(query[k]) ? query[k].join(',') : query[k]}`)
    .join('');

  const computedSignature = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET || 'mock_secret')
    .update(sortedParams)
    .digest('hex');

  // In production, enforce signature check
  // if (computedSignature !== signature) return res.status(401).send('Invalid signature');

  const { product_id, customer_id } = query;
  if (!product_id) {
    return res.status(400).json({ error: 'Missing product_id' });
  }

  try {
    // 1. Fetch Size Chart & POMs from Supabase
    const { data: chart } = await supabase
      .from('product_size_charts')
      .select('*')
      .eq('shopify_product_id', product_id)
      .single();

    // 2. Fetch Digital Twin measurements
    let twin = null;
    if (customer_id) {
      const { data: shopper } = await supabase
        .from('shoppers')
        .select('twin_measurements')
        .eq('shopify_customer_id', customer_id)
        .single();
      if (shopper) twin = shopper.twin_measurements;
    }

    if (!chart || !twin) {
      return res.json({
        recommendedSize: null,
        status: 'missing_data',
        message: 'Please complete your 3D scan profile to get fit recommendations.'
      });
    }

    // 3. Run Styla Fit Engine logic
    const recommendation = calculateStylaFit(chart, twin);
    res.json(recommendation);

  } catch (err) {
    console.error('Fit Proxy Error:', err);
    res.status(500).json({ error: 'Internal recommendation engine error' });
  }
});

// Fit Engine Calculation Implementation (STYLA Rule Book compliant)
function calculateStylaFit(chart, twin) {
  const sizeGrid = chart.size_grid || {}; // maps size names to POM dimensions
  const easeProfile = chart.ease_profile_id || 'regular';
  
  // Stretch factor extraction (Default: No Stretch)
  // Categories: 'no-stretch' (0.00), 'slight' (0.02), 'moderate' (0.04), 'high' (0.07), 'compression' (0.10)
  const stretchFactor = 0.00; 

  // Define Category-Specific Ease Requirements (Principle 2 & 3)
  // Defaulting to Men's shirt ease profile values based on easeProfile
  let requiredChestEase = 4.0;
  let requiredWaistEase = 2.0;
  let requiredHipsEase = 2.0;

  if (easeProfile === 'slim') {
    requiredChestEase = 2.0;
    requiredWaistEase = 1.0;
    requiredHipsEase = 1.0;
  } else if (easeProfile === 'oversized') {
    requiredChestEase = 10.0;
    requiredWaistEase = 8.0;
    requiredHipsEase = 8.0;
  }

  const sizes = Object.keys(sizeGrid);
  if (sizes.length === 0) {
    return { recommendedSize: null, status: 'missing_sizes', message: 'Size chart is empty.' };
  }

  const evaluations = [];

  for (const size of sizes) {
    const measurements = sizeGrid[size] || {};
    
    // Parse dimensions (flat widths are doubled to circumference)
    // We try both flat names and absolute circumferences
    const flatChest = measurements['Chest Width (Flat)'] || measurements['Chest'] || measurements['chest'] || null;
    const flatWaist = measurements['Waist Width (Flat)'] || measurements['Waist'] || measurements['waist'] || null;
    const flatHips = measurements['Hips Width (Flat)'] || measurements['Hips'] || measurements['hips'] || null;
    const shoulders = measurements['Shoulders'] || measurements['Shoulder Width'] || measurements['shoulders'] || null;
    const sleeve = measurements['Sleeve Length'] || measurements['Sleeve'] || measurements['sleeve'] || null;

    const finishedChest = flatChest ? flatChest * 2 : null;
    const finishedWaist = flatWaist ? flatWaist * 2 : null;
    const finishedHips = flatHips ? flatHips * 2 : null;

    const sizeAnalysis = {
      size,
      rejected: false,
      reasons: [],
      score: 0,
      details: []
    };

    // Helper to evaluate constraints (Category A: Chest, Hips, Shoulders. Category B: Waist)
    const checkConstraint = (name, label, finished, bodyVal, requiredEase, isCritical) => {
      if (finished === null || bodyVal === null) return;
      
      // Calculate active ease and stretch recovery compensation (Formula 1)
      const stretchCompensation = stretchFactor * bodyVal;
      const targetFinished = bodyVal + requiredEase - stretchCompensation;
      const diff = finished - targetFinished;
      
      let status = 'ok';
      let hex = '#10b981'; // Green (Excellent/Good)

      if (diff < -1.0) {
        status = 'error';
        hex = '#ef4444'; // Red (Reject)
        if (isCritical) {
          sizeAnalysis.rejected = true;
          sizeAnalysis.reasons.push(`${label} is too small.`);
        }
      } else if (diff >= -1.0 && diff < -0.25) {
        status = 'warn';
        hex = '#f59e0b'; // Amber (Tight)
      } else if (diff > 3.0) {
        status = 'loose';
        hex = '#3b82f6'; // Blue (Loose/Oversized)
      }

      sizeAnalysis.details.push({
        name,
        label,
        ease: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}"`,
        status,
        hex
      });

      // Fit score logic: penalize deviations
      sizeAnalysis.score -= Math.abs(diff);
      if (diff < 0) sizeAnalysis.score -= Math.abs(diff) * 2; // heavier penalty for being too tight
    };

    // Run constraint checks (Category A and B)
    if (finishedChest) checkConstraint('chest', 'Chest', finishedChest, twin.chest, requiredChestEase, true);
    if (finishedHips) checkConstraint('hips', 'Hips', finishedHips, twin.hips, requiredHipsEase, true);
    if (shoulders) checkConstraint('shoulders', 'Shoulders', shoulders, twin.shoulders, 0.2, true); // shoulders need close fit (+0.2")
    if (finishedWaist) checkConstraint('waist', 'Waist', finishedWaist, twin.waist, requiredWaistEase, false); // waist is semi-critical

    evaluations.push(sizeAnalysis);
  }

  // Filter out rejected sizes
  const validSizes = evaluations.filter(e => !e.rejected);

  let recommendedSize = null;
  let analysisDetails = [];
  let designIntent = "Design intended for comfortable movement.";

  if (validSizes.length > 0) {
    // Smallest size that fits (Principle 1)
    // Sort by size index or select size with the best score (closest to design ease)
    validSizes.sort((a, b) => b.score - a.score);
    recommendedSize = validSizes[0].size;
    analysisDetails = validSizes[0].details;
  } else {
    // If all reject, recommend the one with the minimum critical compromise
    evaluations.sort((a, b) => b.score - a.score);
    recommendedSize = evaluations[0].size;
    analysisDetails = evaluations[0].details;
    designIntent = "All available sizes are physically tight. Sizing up is highly recommended.";
  }

  return {
    recommendedSize,
    matchRate: recommendedSize ? 92 : 50,
    designIntent,
    measurements: analysisDetails
  };
}

// ----------------------------------------------------
// 5. Admin Dashboard API Routes (For React Panel)
// ----------------------------------------------------
app.get('/api/analytics', async (req, res) => {
  res.json({
    returnRate: { current: '4.2%', previous: '8.4%', diff: '-4.2%' },
    sizeMatches: 14821,
    protectedRevenue: '$84,320.00'
  });
});

app.get('/api/products', async (req, res) => {
  const { data, error } = await supabase.from('product_size_charts').select('*');
  if (error) return res.status(500).json(error);
  res.json(data || []);
});

app.post('/api/size-chart', async (req, res) => {
  const { shopify_product_id, size_grid, ease_profile_id } = req.body;
  const { data, error } = await supabase
    .from('product_size_charts')
    .upsert({ shopify_product_id, size_grid, ease_profile_id, updated_at: new Date() });
  
  if (error) return res.status(500).json(error);
  res.json({ success: true, data });
});

// ----------------------------------------------------
// 5. Merchant self-service: manage size charts (writes into Styla's real
//    brands/size_charts so the storefront widget + AI use them immediately).
// ----------------------------------------------------
const path = require('path');
// Serve static assets by explicit path, but DO NOT auto-serve public/index.html
// at "/" — that file is a stale prebuilt React mock. "/" (and any app path) is
// handled by serveApp -> charts.html, the real, no-build merchant tool.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
// Serve the repo's shared modules so charts.html uses the SAME definitions as
// the Styla admin and the APIs — no duplicated taxonomy/attribute lists.
app.use('/shared', express.static(path.join(__dirname, '..', '..', 'shared')));
// App home (embedded) = the size-chart manager. Serve it at / and /charts so the
// app loads a real page instead of "Invalid path" when Shopify opens it.
function serveApp(req, res) { res.sendFile(path.join(__dirname, 'public', 'charts.html')); }
app.get('/', serveApp);
app.get('/charts', serveApp);

async function shopInstalled(shop) {
  if (!shop) return false;
  const { data } = await supabase.from('merchant_sessions').select('shop').eq('shop', shop).maybeSingle();
  return !!data;
}
// Production-secure shop identity: verify the Shopify App Bridge session token
// (a JWT signed with our app secret). Falls back to ?shop= only for local dev.
async function getShopFromReq(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const payload = await shopify.session.decodeSessionToken(auth.slice(7));
      const dest = payload.dest || payload.iss || '';
      const shop = String(dest).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
      if (shop) return { shop, verified: true };
    } catch (e) {
      return { shop: null, verified: false, error: 'Invalid or expired session token.' };
    }
  }
  const shop = String(req.query.shop || (req.body && req.body.shop) || '').toLowerCase();
  return { shop, verified: false };
}
async function requireShop(req, res) {
  const { shop, verified, error } = await getShopFromReq(req);
  if (error) { res.status(401).json({ error }); return null; }
  // A verified token is trusted; otherwise (dev, no App Bridge) require an installed shop.
  if (!shop || (!verified && !(await shopInstalled(shop)))) { res.status(401).json({ error: 'Shop not connected — open this from your Shopify admin.' }); return null; }
  return shop;
}
// A connected shop maps to a Styla brand keyed by its domain, so widget-size
// resolves this store's charts by domain with no extra config.
// Resolve the ONE brand row for this store. A store has two identities: the
// myshopify domain the app talks to, and the public storefront domain the Styla
// admin curates against. We match on either so a Shopify install attaches to the
// brand Styla already knows — otherwise the dashboard and the widget would read
// different charts for the same brand.
async function ensureBrandForShop(shop) {
  const myshopify = String(shop || '').toLowerCase();
  if (!myshopify) return null;

  // 1) already linked by myshopify domain?
  let { data: brand } = await supabase.from('brands').select('id').eq('shopify_domain', myshopify).maybeSingle();
  if (brand) return brand.id;

  // 2) look up the store's PUBLIC domain and match an existing Styla brand on it.
  let primary = null, shopName = null;
  try {
    const { data: sess } = await supabase.from('merchant_sessions').select('access_token').eq('shop', myshopify).maybeSingle();
    if (sess) {
      const info = await fetchShopifyAPI(myshopify, sess.access_token, 'shop.json');
      primary = info && info.shop && String(info.shop.domain || '').toLowerCase().replace(/^www\./, '');
      shopName = info && info.shop && info.shop.name;
    }
  } catch (e) { /* fall through to myshopify-only identity */ }

  const candidates = [myshopify, primary].filter(Boolean);
  const { data: found } = await supabase.from('brands').select('id, domain').in('domain', candidates);
  if (found && found.length) {
    brand = found[0];
    await supabase.from('brands').update({ shopify_domain: myshopify }).eq('id', brand.id); // link for next time
    return brand.id;
  }

  // 3) genuinely new brand
  const { data: created, error } = await supabase.from('brands')
    .insert({ name: shopName || myshopify.replace('.myshopify.com', ''), domain: primary || myshopify, shopify_domain: myshopify })
    .select('id').single();
  if (error) throw error;
  return created ? created.id : null;
}

// Get an Admin API access token for this shop. Modern Shopify installs are
// "managed" (no OAuth redirect through /api/auth/callback), so merchant_sessions
// may be empty — in that case we exchange the App Bridge session token for an
// offline access token (token exchange) and cache it. This is what makes catalog
// sync work without a classic reinstall.
async function getOfflineToken(req) {
  const auth = req.headers.authorization || '';
  const sessionToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const { shop } = await getShopFromReq(req);
  if (!shop) return null;

  const { data: existing } = await supabase
    .from('merchant_sessions').select('access_token').eq('shop', shop).maybeSingle();
  if (existing && existing.access_token) return existing.access_token;

  if (!sessionToken) return null;
  try {
    const { session } = await shopify.auth.tokenExchange({
      shop,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    });
    const token = session && session.accessToken;
    if (token) {
      await supabase.from('merchant_sessions')
        .upsert({ shop, access_token: token, scope: session.scope || null, updated_at: new Date() });
      try { await registerShopifyWebhooks(shop, token); } catch (e) { /* best-effort */ }
    }
    return token || null;
  } catch (e) {
    console.error('Token exchange failed for', shop, '-', e.message);
    return null;
  }
}

app.get('/api/merchant/charts', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const brandId = await ensureBrandForShop(shop);
    const { data: charts } = await supabase.from('size_charts')
      .select('id, category, subcategory, gender, chart_data, verified, is_default, source, created_at')
      .eq('brand_id', brandId).order('created_at', { ascending: false });
    res.json({ shop, brandId, charts: charts || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const canonicalizeChart = SHARED_CHART.canonicalizeChart;

app.post('/api/merchant/charts', async (req, res) => {
  try {
    const s = await requireShop(req, res); if (!s) return;
    let { id, category, subcategory, gender, chart_data, is_default } = req.body || {};
    if (!chart_data || !(chart_data.sizes || []).length) return res.status(400).json({ error: 'Add at least one size.' });
    chart_data = canonicalizeChart(chart_data, category);
    const brandId = await ensureBrandForShop(s);
    // category/gender are OPTIONAL now: null = a store-default chart that applies
    // to every product; a category/gender narrows it to specific items.
    const row = {
      brand_id: brandId, category: category || null, subcategory: subcategory || null, gender: gender || null,
      chart_data, is_default: is_default !== false, source: 'brand', verified: false,
    };
    // NOTE: every write below is error-checked. These used to be fire-and-forget,
    // so a rejected insert (e.g. a NOT NULL column) still reported "Saved".
    let werr = null;
    if (id) {
      // Editing the MEASUREMENTS must not silently drop the chart's assignment
      // (rules / categories / gender) — the editor doesn't send those.
      const { data: prev } = await supabase.from('size_charts')
        .select('chart_data, category, gender').eq('id', id).eq('brand_id', brandId).maybeSingle();
      if (prev) {
        const pd = prev.chart_data || {};
        row.chart_data = Object.assign({}, row.chart_data, {
          rules: pd.rules || row.chart_data.rules || null,
          categories: (pd.categories && pd.categories.length) ? pd.categories : (row.chart_data.categories || []),
          applies_all: pd.applies_all !== undefined ? pd.applies_all : !!row.chart_data.applies_all,
          garment_category: pd.garment_category || row.chart_data.garment_category || null,
          gender: pd.gender !== undefined ? pd.gender : (row.chart_data.gender || null),
        });
        row.category = prev.category ?? row.category;
        row.gender = prev.gender ?? row.gender;
      }
      ({ error: werr } = await supabase.from('size_charts').update(row).eq('id', id).eq('brand_id', brandId));
    } else {
      // A chart is identified by its NAME within a brand (categories are assigned
      // later and may be null, so they can't be the key).
      const nm = (chart_data.name || '').trim();
      let existing = null;
      if (nm) {
        const { data } = await supabase.from('size_charts')
          .select('id, chart_data').eq('brand_id', brandId);
        existing = (data || []).find((c) => String(((c.chart_data || {}).name) || '').trim().toLowerCase() === nm.toLowerCase()) || null;
      }
      if (existing) ({ error: werr } = await supabase.from('size_charts').update(row).eq('id', existing.id));
      else ({ error: werr } = await supabase.from('size_charts').insert(row));
    }
    if (werr) return res.status(500).json({ error: 'Could not save the chart: ' + werr.message });

    // Improvement flywheel: record what the AI parsed vs what the merchant saved.
    try {
      const parsed = req.body && req.body.parsed;
      let edited = null;
      if (parsed) {
        edited =
          JSON.stringify(parsed.length_options || []) !== JSON.stringify(chart_data.length_options || []) ||
          String(parsed.notes || '').trim() !== String(chart_data.notes || '').trim() ||
          (parsed.sizes || []).length !== (chart_data.sizes || []).length;
      }
      await supabase.from('chart_parse_feedback').insert({
        brand_id: brandId, shop_domain: s, ai_output: parsed || null,
        final: chart_data, category: row.category, gender: row.gender, edited,
      });
    } catch (e) { /* best-effort — never block a save */ }

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/merchant/delete-chart', async (req, res) => {
  try {
    const s = await requireShop(req, res); if (!s) return;
    const { id } = req.body || {};
    const brandId = await ensureBrandForShop(s);
    await supabase.from('size_charts').delete().eq('id', id).eq('brand_id', brandId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Step 2 of the app: LINK an existing chart to categories / whole store / gender.
// Body: { id, categories:[slug], applies_all:bool, gender }
app.post('/api/merchant/link-chart', async (req, res) => {
  try {
    const s = await requireShop(req, res); if (!s) return;
    const brandId = await ensureBrandForShop(s);
    const { id, categories, applies_all, gender, rules, name } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing chart id.' });
    const { data: chart } = await supabase.from('size_charts')
      .select('chart_data').eq('id', id).eq('brand_id', brandId).maybeSingle();
    if (!chart) return res.status(404).json({ error: 'Chart not found.' });
    const cd = Object.assign({}, chart.chart_data || {});
    if (name !== undefined && String(name).trim()) cd.name = String(name).trim(); // renameable
    // Rules ACCUMULATE. Each assignment made in the picker adds a group, so
    // assigning the same chart from two different filter sets keeps both —
    // previously the second one silently replaced the first.
    if (rules !== undefined) {
      if (!rules) { cd.rules = null; }
      else {
        const incoming = Array.isArray(rules.groups)
          ? rules.groups
          : [{ match: rules.match || 'all', conditions: rules.conditions || [] }];
        const existing = (cd.rules && Array.isArray(cd.rules.groups)) ? cd.rules.groups
          : (cd.rules && Array.isArray(cd.rules.conditions) && cd.rules.conditions.length
              ? [{ match: cd.rules.match || 'all', conditions: cd.rules.conditions }]
              : []);
        const key = (g) => JSON.stringify([g.match || 'all',
          (g.conditions || []).map((c) => [c.field, c.op, String(c.value || '').toLowerCase()]).sort()]);
        const seen = new Set(existing.map(key));
        incoming.forEach((g) => { if ((g.conditions || []).length && !seen.has(key(g))) { existing.push(g); seen.add(key(g)); } });
        cd.rules = existing.length ? { match: 'any', groups: existing } : null;
      }
    }
    if (categories !== undefined) {
      cd.categories = Array.isArray(categories) ? categories.filter(Boolean) : [];
      // The engine reads garment_category for its per-garment ease rules (a suit
      // is not eased like a t-shirt). Keep it in step with the linked category,
      // exactly as the Styla admin writes it — same field, same meaning.
      cd.garment_category = cd.categories[0] || null;
    }
    if (applies_all !== undefined) cd.applies_all = !!applies_all;
    if (gender !== undefined) cd.gender = gender || null;
    const upd = { chart_data: cd, category: cd.categories[0] || null };
    if (gender !== undefined) upd.gender = gender || null;
    await supabase.from('size_charts').update(upd).eq('id', id).eq('brand_id', brandId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------
// 6. Push the store's catalog into Styla's SEMANTIC product index so the AI can
//    reason across the whole catalog (smarter answers + the discovery feed).
//    Keyed by shop domain -> the same Styla brand the size charts use, so an
//    ingested product lines up with this store's charts automatically.
// ----------------------------------------------------
// The full catalog sync, shared by the manual button and the automatic
// reconcile below. One implementation so the two can never drift.
async function runFullSync(shop, accessToken) {
  const [pulled, colMap] = await Promise.all([
    fetchShopifyAllPages(shop, accessToken, 'products.json?limit=250&published_status=published', 'products'),
    fetchCollectionMap(shop, accessToken),
  ]);
  const products = pulled.items.map((p) => mapShopifyProduct(shop, p, colMap[String(p.id)]));
  if (!products.length) {
    // Deliberately NOT authoritative: an empty result is far more likely to be
    // a scope/permission problem than a genuinely empty store, and treating it
    // as truth would wipe the merchant's whole index.
    return { synced: 0, removed: 0, partial: false, empty: true };
  }

  // Free tier: share the catalog into Styla discovery unless the merchant opted out.
  const { data: st } = await supabase.from('shop_settings').select('settings').eq('shop', shop).maybeSingle();
  const shared = ((st && st.settings) || {}).share_catalog !== false;

  // Keep shipping destinations fresh off the store's real zones (best-effort).
  try { await syncShippingForShop(shop, await ensureBrandForShop(shop)); }
  catch (e) { console.error('shipping sync skipped:', e.message); }

  // A full sync is the source of truth: anything in the index that is NOT in
  // this pull has been deleted or unpublished in Shopify, so it must go. Only
  // claim authority when every page came back.
  const out = await pushToStylaIndex(shop, { products, shared, authoritative: pulled.complete });
  await markSynced(shop);
  return {
    synced: products.length,
    embedded: out.embedded || 0,
    skipped: out.skipped || 0,
    removed: out.removed || 0,
    partial: !pulled.complete,
    empty: false,
  };
}

async function markSynced(shop) {
  const { data: row } = await supabase.from('shop_settings').select('settings').eq('shop', shop).maybeSingle();
  const settings = Object.assign({}, (row && row.settings) || {}, { last_full_sync: new Date().toISOString() });
  await supabase.from('shop_settings').upsert({ shop, settings });
}

// Self-healing reconcile.
//
// Webhooks keep the index live, but only while the app is reachable. A delete
// that lands during a deploy, a dropped dev tunnel, or an exhausted Shopify
// retry is lost permanently -- nothing would ever notice it. This closes that
// hole: whenever the merchant opens the app, if the last full sync is over a
// day old we quietly re-reconcile in the background.
//
// Cheap by design: the content_hash gate means unchanged products are not
// re-embedded, so a repeat sync costs a catalog read and no AI spend.
const RECONCILE_AFTER_MS = 24 * 60 * 60 * 1000;
const reconciling = new Set();

async function maybeAutoReconcile(shop, accessToken) {
  if (!shop || !accessToken || reconciling.has(shop)) return;
  try {
    const { data: row } = await supabase.from('shop_settings').select('settings').eq('shop', shop).maybeSingle();
    const last = ((row && row.settings) || {}).last_full_sync;
    if (last && (Date.now() - new Date(last).getTime()) < RECONCILE_AFTER_MS) return;

    // Claim the slot BEFORE the await so two tabs opening at once can't both run it.
    reconciling.add(shop);
    await markSynced(shop);

    runFullSync(shop, accessToken)
      .then((r) => console.log(`Auto-reconcile ${shop}: ${r.synced} synced, ${r.removed} removed`))
      .catch((e) => console.error('Auto-reconcile failed for', shop, '-', e.message))
      .finally(() => reconciling.delete(shop));
  } catch (e) {
    reconciling.delete(shop);
    console.error('Auto-reconcile check failed:', e.message);
  }
}

app.post('/api/merchant/sync-catalog', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;

    const accessToken = await getOfflineToken(req);
    if (!accessToken) return res.status(401).json({ error: 'Could not authorize with Shopify. Reopen the app from your admin and try again.' });

    const r = await runFullSync(shop, accessToken);
    if (r.empty) return res.json({ ok: true, synced: 0, message: 'No published products found to sync.' });

    res.json({
      ok: true, synced: r.synced, embedded: r.embedded, skipped: r.skipped,
      removed: r.removed, partial: r.partial,
      message: `Synced ${r.synced} products to Styla AI (${r.embedded} newly indexed, ${r.skipped} unchanged`
        + (r.removed ? `, ${r.removed} removed` : '') + ').'
        + (r.partial ? ' Catalog was too large to read in one pass \u2014 stale products were left in place.' : ''),
    });
  } catch (e) {
    console.error('sync-catalog error:', e);
    res.status(500).json({ error: 'Failed to sync catalog to Styla.', detail: e.message });
  }
});

// --- Assign size charts to products ----------------------------------------
// Default behavior needs NO assignment: the storefront widget auto-matches a
// product's type -> category -> chart. These endpoints add an optional
// per-product (or per-type) OVERRIDE for brands who keep a chart per product.
//
// List the store's synced products + their current chart assignment.
// ---- Is the widget ACTUALLY on the storefront? ----
//
// A theme app block with target "section" has to be placed by the merchant, and
// placement is stored per theme — so switching themes silently removes it. The
// merchant gets no signal: the app looks configured, charts are assigned, and
// nothing renders. That's the worst failure mode we have, because they conclude
// Styla doesn't work rather than that a block is missing.
//
// This reads the LIVE theme's product template (read_themes, read-only) and looks
// for our block. Deliberately conservative: anything we can't determine is
// reported as 'unknown', never as 'not placed', so we don't cry wolf.
const BLOCK_MARKER = '/blocks/styla-widget/';

async function widgetPlacement(shop, accessToken) {
  // 1. the live theme
  const themes = await fetchShopifyAPI(shop, accessToken, 'themes.json');
  const live = (themes.themes || []).find((t) => t.role === 'main');
  if (!live) return { status: 'unknown', reason: 'No live theme returned.' };

  // 2. its product template
  const tryAsset = async (key) => {
    try {
      const r = await fetchShopifyAPI(shop, accessToken,
        `themes/${live.id}/assets.json?asset[key]=${encodeURIComponent(key)}`);
      return r && r.asset ? r.asset.value : null;
    } catch (e) { return null; }
  };

  let value = await tryAsset('templates/product.json');
  let vintage = false;
  if (!value) { value = await tryAsset('templates/product.liquid'); vintage = !!value; }
  if (!value) {
    return { status: 'unknown', theme: live.name,
             reason: 'Could not read the product template.' };
  }

  if (vintage) {
    // Vintage (non-sectioned) themes can't take app blocks at all.
    return { status: 'unsupported', theme: live.name,
             reason: 'This theme uses an older template format that cannot host app blocks.' };
  }

  // 3. our block, either inline in the template or inside a referenced section
  if (value.indexOf(BLOCK_MARKER) >= 0) {
    return { status: 'placed', theme: live.name };
  }
  let tpl = null;
  try { tpl = JSON.parse(value); } catch (e) {
    return { status: 'unknown', theme: live.name, reason: 'Product template was not valid JSON.' };
  }
  // Sectioned themes may point at shared sections/*.json holding the blocks.
  const sectionKeys = Object.values(tpl.sections || {})
    .map((sec) => sec && sec.type).filter(Boolean)
    .map((t) => `sections/${t}.json`);
  for (const key of [...new Set(sectionKeys)]) {
    const sv = await tryAsset(key);
    if (sv && sv.indexOf(BLOCK_MARKER) >= 0) return { status: 'placed', theme: live.name };
  }

  return {
    status: 'missing', theme: live.name, themeId: live.id,
    reason: 'The Styla block is not in your live theme\'s product page.',
  };
}

app.get('/api/merchant/widget-status', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const accessToken = await getOfflineToken(req);
    if (!accessToken) return res.json({ status: 'unknown', reason: 'Not authorized with Shopify yet.' });

    let out;
    try { out = await widgetPlacement(shop, accessToken); }
    catch (e) {
      // Most likely the merchant hasn't re-consented to read_themes yet. Never
      // report "missing" off the back of an error.
      console.error('widget-status failed:', e.message);
      out = { status: 'unknown', reason: 'Could not read your theme (the app may need reauthorising).' };
    }
    if (out.themeId) {
      out.editorUrl = `https://${shop.replace('.myshopify.com','')}.myshopify.com/admin/themes/${out.themeId}/editor?template=product`;
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/merchant/products', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const brandId = await ensureBrandForShop(shop);

    // Opening the app is the natural moment to self-heal: fire-and-forget, so
    // the merchant never waits on it and a failure can't break the page.
    getOfflineToken(req).then((t) => maybeAutoReconcile(shop, t)).catch(() => {});
    const { data: products } = await supabase.from('catalog_products')
      .select('id, external_id, title, product_type, category, vendor, tags, collections, url, image_url, size_chart_id')
      .eq('brand_id', brandId)
      .order('product_type', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true });
    res.json({ shop, brandId, products: products || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Assign a chart to specific product(s) or to a whole product type.
// Body: { externalId? | externalIds?[] | productType?, chartId? }  (chartId=null clears the override)
app.post('/api/merchant/assign-chart', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const brandId = await ensureBrandForShop(shop);
    let { externalId, externalIds, productType, chartId } = req.body || {};
    chartId = chartId || null;

    // A provided chart must belong to this store.
    if (chartId) {
      const { data: c } = await supabase.from('size_charts')
        .select('id').eq('id', chartId).eq('brand_id', brandId).maybeSingle();
      if (!c) return res.status(400).json({ error: 'That chart was not found for this store.' });
    }

    // Resolve the target products.
    let q = supabase.from('catalog_products').select('id, url').eq('brand_id', brandId);
    const ids = externalIds || (externalId ? [externalId] : null);
    if (ids) q = q.in('external_id', ids.map(String));
    else if (productType) q = q.eq('product_type', productType);
    else return res.status(400).json({ error: 'Specify externalId, externalIds, or productType.' });
    const { data: targets } = await q;
    if (!targets || !targets.length) return res.json({ ok: true, updated: 0 });

    // 1) record the assignment on the catalog row
    await supabase.from('catalog_products')
      .update({ size_chart_id: chartId }).in('id', targets.map((t) => t.id));

    // 2) mirror to products_cache (url -> chart) — the per-URL override the
    //    storefront widget-size resolver reads first.
    for (const t of targets) {
      if (!t.url) continue;
      if (chartId) {
        await supabase.from('products_cache')
          .upsert({ url: t.url, brand_id: brandId, size_chart_id: chartId, source: 'merchant' }, { onConflict: 'url' });
      } else {
        await supabase.from('products_cache').delete().eq('url', t.url).eq('brand_id', brandId);
      }
    }

    res.json({ ok: true, updated: targets.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------
// 6b. Category review — every store labels products differently. Show each of
//     the store's own product types, what Styla mapped it to, and let the
//     merchant correct it. The correction is saved as a brand alias AND
//     backfilled onto the already-indexed products.
// ----------------------------------------------------
app.get('/api/merchant/categories', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const brandId = await ensureBrandForShop(shop);
    const { data: rows } = await supabase.from('catalog_products')
      .select('product_type, category').eq('brand_id', brandId);
    const { data: brand } = await supabase.from('brands').select('category_aliases').eq('id', brandId).maybeSingle();
    const aliases = (brand && brand.category_aliases) || {};

    const groups = {};
    (rows || []).forEach((r) => {
      const t = r.product_type || '(no type)';
      groups[t] = groups[t] || { type: t, count: 0, mapped: r.category || null };
      groups[t].count++;
      if (r.category) groups[t].mapped = r.category;
    });
    const list = Object.values(groups).map((g) => ({
      ...g, alias: aliases[String(g.type).toLowerCase()] || null,
    })).sort((a, b) => b.count - a.count);
    res.json({ types: list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/merchant/map-category', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const brandId = await ensureBrandForShop(shop);
    const { productType, category } = req.body || {};
    if (!productType) return res.status(400).json({ error: 'Missing productType.' });

    const { data: brand } = await supabase.from('brands').select('category_aliases').eq('id', brandId).maybeSingle();
    const aliases = Object.assign({}, (brand && brand.category_aliases) || {});
    const key = String(productType).toLowerCase();
    if (category) aliases[key] = category; else delete aliases[key];
    await supabase.from('brands').update({ category_aliases: aliases }).eq('id', brandId);

    // Backfill the already-indexed products so the change takes effect now.
    let q = supabase.from('catalog_products').update({ category: category || null }).eq('brand_id', brandId);
    q = (productType === '(no type)') ? q.is('product_type', null) : q.eq('product_type', productType);
    await q;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------
// 6b2. Real shipping destinations, read from the store's own Shopify shipping
//      zones — more trustworthy than a merchant ticking boxes from memory.
//      Maps onto the SAME structure api/_helpers/shipping.js reads:
//      brands.ships_worldwide + brands.ships_to (region keys AND raw ISO codes,
//      both of which shipsTo() understands).
// ----------------------------------------------------
async function readShippingZones(shop, token) {
  const data = await fetchShopifyAPI(shop, token, 'shipping_zones.json');
  return SHARED_BRAND.mapShopifyZones((data && data.shipping_zones) || []);
}

async function syncShippingForShop(shop, brandId) {
  const { data: sess } = await supabase.from('merchant_sessions')
    .select('access_token').eq('shop', shop).maybeSingle();
  if (!sess) return null;
  const z = await readShippingZones(shop, sess.access_token);
  await supabase.from('brands')
    .update({ ships_worldwide: z.worldwide, ships_to: z.ships_to }).eq('id', brandId);
  return z;
}

app.post('/api/merchant/sync-shipping', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const brandId = await ensureBrandForShop(shop);
    const z = await syncShippingForShop(shop, brandId);
    if (!z) return res.status(404).json({ error: 'Merchant session not found.' });
    res.json({
      ok: true, ships_worldwide: z.worldwide, ships_to: z.ships_to, countries: z.countryCount,
      message: z.worldwide
        ? 'Reads as worldwide shipping.'
        : (z.countryCount ? ('Found ' + z.countryCount + ' destination countries in your Shopify shipping zones.')
                          : 'No shipping zones found — set them in Shopify Settings → Shipping.'),
    });
  } catch (e) {
    // read_shipping may not be granted yet on an older install
    res.status(500).json({ error: /403|scope/i.test(e.message || '') ? 'Reinstall the app to grant shipping access.' : e.message });
  }
});

// ----------------------------------------------------
// 6c. Get discovered on Styla — the brand links ONE chart per Styla category so
//     shoppers browsing Styla ("show me dresses that fit me") can be matched to
//     this brand. Separate from product-page assignment.
// ----------------------------------------------------
app.get('/api/merchant/styla-index', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const brandId = await ensureBrandForShop(shop);
    const { data: brand } = await supabase.from('brands')
      .select('name, about, small_business, specialties, ships_worldwide, ships_to, origin_country, made_in').eq('id', brandId).maybeSingle();
    const { data: charts } = await supabase.from('size_charts')
      .select('id, chart_data, source, verified').eq('brand_id', brandId);

    // category -> chart id (first chart claiming it wins; UI enforces one each)
    const mapping = {};
    (charts || []).forEach((c) => {
      ((c.chart_data || {}).categories || []).forEach((cat) => { if (!mapping[cat]) mapping[cat] = c.id; });
    });
    // A sample image per Styla category, taken from the merchant's OWN catalog —
    // so the category tiles show their clothes, not stock art.
    const { data: prods } = await supabase.from('catalog_products')
      .select('category, image_url').eq('brand_id', brandId).not('image_url', 'is', null);
    const catImage = {};
    (prods || []).forEach((p) => { if (p.category && !catImage[p.category]) catImage[p.category] = p.image_url; });

    const { data: st } = await supabase.from('shop_settings').select('settings').eq('shop', shop).maybeSingle();
    res.json({
      brand: brand || {},
      mapping,
      catImage,
      sharing: (((st && st.settings) || {}).share_catalog !== false),
      charts: (charts || []).map((c) => ({
        id: c.id, name: (c.chart_data || {}).name || 'Untitled chart',
        sizes: ((c.chart_data || {}).sizes || []).length, source: c.source, verified: c.verified,
      })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/merchant/styla-index', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const brandId = await ensureBrandForShop(shop);
    const { category, chartId, small_business, about, specialties, ships_worldwide, ships_to, origin_country, made_in } = req.body || {};

    // brand-level discovery flags
    const patch = {};
    if (small_business !== undefined) patch.small_business = !!small_business;
    if (about !== undefined) patch.about = String(about || '').slice(0, 500);
    if (specialties !== undefined) patch.specialties = Array.isArray(specialties) ? specialties.filter(Boolean) : [];
    if (ships_worldwide !== undefined) patch.ships_worldwide = !!ships_worldwide;
    if (ships_to !== undefined) patch.ships_to = Array.isArray(ships_to) ? ships_to.filter(Boolean) : [];
    if (origin_country !== undefined) patch.origin_country = origin_country || null;
    if (made_in !== undefined) patch.made_in = String(made_in || '').slice(0, 120) || null;
    if (Object.keys(patch).length) await supabase.from('brands').update(patch).eq('id', brandId);

    // one chart per Styla category: clear the category off every other chart first
    if (category) {
      const { data: charts } = await supabase.from('size_charts')
        .select('id, chart_data').eq('brand_id', brandId);
      for (const c of (charts || [])) {
        const cd = Object.assign({}, c.chart_data || {});
        const cats = new Set(cd.categories || []);
        const shouldHave = (c.id === chartId);
        if (shouldHave) cats.add(category); else cats.delete(category);
        const next = [...cats];
        if (JSON.stringify(next) !== JSON.stringify(cd.categories || [])) {
          cd.categories = next;
          cd.garment_category = next[0] || null;   // keep the engine's ease rules in step
          await supabase.from('size_charts')
            .update({ chart_data: cd, category: next[0] || null }).eq('id', c.id);
        }
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------
// 7. Settings & preferences (lobby card 3)
// ----------------------------------------------------
app.get('/api/merchant/settings', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const { data } = await supabase.from('shop_settings').select('settings').eq('shop', shop).maybeSingle();
    res.json({ settings: (data && data.settings) || {} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/merchant/settings', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const incoming = (req.body && req.body.settings) || {};
    const { data: cur } = await supabase.from('shop_settings').select('settings').eq('shop', shop).maybeSingle();
    const merged = Object.assign({}, (cur && cur.settings) || {}, incoming);
    await supabase.from('shop_settings').upsert({ shop, settings: merged, updated_at: new Date() });
    res.json({ ok: true, settings: merged });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------
// 8. Analytics (lobby card 4) — REAL setup/coverage numbers computed from the
//    store's own charts + synced catalog. (Shopper-facing metrics such as
//    recommendations served / sizes chosen require event logging, not built yet.)
// ----------------------------------------------------
app.get('/api/merchant/analytics', async (req, res) => {
  try {
    const shop = await requireShop(req, res); if (!shop) return;
    const brandId = await ensureBrandForShop(shop);

    const { data: charts } = await supabase.from('size_charts')
      .select('id, category, chart_data').eq('brand_id', brandId);
    const { data: products } = await supabase.from('catalog_products')
      .select('title, product_type, category, size_chart_id').eq('brand_id', brandId);

    const cs = charts || [], ps = products || [];
    const catsOf = (c) => {
      const cd = c.chart_data || {};
      if (Array.isArray(cd.categories) && cd.categories.length) return cd.categories;
      const one = cd.garment_category || c.category;
      return one ? [one] : [];
    };
    const hasStoreWide = cs.some((c) => (c.chart_data || {}).applies_all);
    const linkedCats = new Set();
    cs.forEach((c) => catsOf(c).forEach((x) => linkedCats.add(x)));
    const linkedCharts = cs.filter((c) => (c.chart_data || {}).applies_all || catsOf(c).length).length;

    // A product is "covered" if it has a per-product chart, or a store-wide chart
    // exists, or its category has a linked chart.
    const NON_APPAREL = new Set(['giftcard', 'gift card', 'gift_card', 'gift cards']);
    const apparel = ps.filter((p) => !NON_APPAREL.has(String(p.product_type || '').toLowerCase()));
    const covered = [], uncovered = [];
    apparel.forEach((p) => {
      const ok = !!p.size_chart_id || hasStoreWide || (p.category && linkedCats.has(p.category));
      (ok ? covered : uncovered).push(p);
    });
    const gaps = {};
    uncovered.forEach((p) => {
      const k = p.category || p.product_type || 'Uncategorized';
      gaps[k] = (gaps[k] || 0) + 1;
    });

    res.json({
      charts: cs.length,
      chartsLinked: linkedCharts,
      storeWide: hasStoreWide,
      productsSynced: ps.length,
      apparelProducts: apparel.length,
      covered: covered.length,
      uncovered: uncovered.length,
      coveragePct: apparel.length ? Math.round((covered.length / apparel.length) * 100) : 0,
      gaps: Object.keys(gaps).map((k) => ({ group: k, count: gaps[k] })).sort((a, b) => b.count - a.count),
      note: 'Setup coverage. Shopper metrics (recommendations served, sizes chosen, returns) need fit-event logging — not built yet.',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Catch-all: any non-API GET renders the app UI (the chart manager). This makes
// the embedded app load a real page no matter what path Shopify requests.
app.get(/^(?!\/api\/).*/, serveApp);

// Start Server
app.listen(PORT, () => {
  console.log(`STYLA Shopify App Server is booting on port ${PORT}`);
});
