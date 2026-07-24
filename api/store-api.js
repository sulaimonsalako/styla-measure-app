import authHandler from './_store/store-auth.js';
import cartHandler from './_store/store-cart.js';
import categoriesHandler from './_store/store-categories.js';
import paymentHandler from './_store/store-payment.js';
import productsHandler from './_store/store-products.js';
import exportPaymentHandler from './_store/export-payment.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const route = url.searchParams.get('route');

  // Read body if it's not store-payment (which handles raw stream itself)
  const isPayment = route === 'store-payment' || pathname.includes('/store-payment');
  if (!isPayment && req.method === 'POST') {
    try {
      const rawBody = await getRawBody(req);
      const rawString = rawBody.toString('utf8');
      if (rawString) {
        req.body = JSON.parse(rawString);
      } else {
        req.body = {};
      }
    } catch (err) {
      console.error("Failed to parse body in store-api router:", err);
      req.body = {};
    }
  }

  if (route === 'store-auth' || pathname.includes('/store-auth')) {
    return authHandler(req, res);
  } else if (route === 'store-cart' || pathname.includes('/store-cart')) {
    return cartHandler(req, res);
  } else if (route === 'store-categories' || pathname.includes('/store-categories')) {
    return categoriesHandler(req, res);
  } else if (route === 'store-payment' || pathname.includes('/store-payment')) {
    return paymentHandler(req, res);
  } else if (route === 'store-products' || pathname.includes('/store-products')) {
    return productsHandler(req, res);
  } else if (route === 'export-payment' || pathname.includes('/export-payment')) {
    return exportPaymentHandler(req, res);
  } else {
    return res.status(404).json({ error: `Store API endpoint not found: ${pathname} (route parameter: ${route})` });
  }
}
