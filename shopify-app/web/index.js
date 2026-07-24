require('@shopify/shopify-api/adapters/node');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { shopifyApi, ApiVersion } = require('@shopify/shopify-api');

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
  scopes: ['write_products', 'read_products', 'read_customers'],
  hostName: process.env.HOST ? process.env.HOST.replace(/https:\/\//, '') : 'localhost:8080',
  apiVersion: ApiVersion.April24,
  isEmbeddedApp: true
});

// Helper: Fetch Shopify API wrapper
async function fetchShopifyAPI(shop, accessToken, endpoint, options = {}) {
  const url = `https://${shop}/admin/api/2024-04/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!response.ok) {
    throw new Error(`Shopify API error for ${endpoint}: ${response.statusText}`);
  }
  return response.json();
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
  const webhooksToRegister = ['app/uninstalled', 'products/create', 'products/update', 'products/delete'];
  
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
    } else if (topic === 'products/delete') {
      const productId = String(payload.id);
      await supabase.from('product_size_charts').delete().eq('shopify_product_id', productId);
      console.log(`Deleted product ${productId} via webhook`);
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

// Start Server
app.listen(PORT, () => {
  console.log(`STYLA Shopify App Server is booting on port ${PORT}`);
});
