import authHandler from './_store/store-auth.js';
import exportPaymentHandler from './_store/export-payment.js';
import rankBrandsHandler from './_match/rank-brands.js';
import widgetSizeHandler from './_match/widget-size.js';
import connectionsHandler from './_share/connections.js';
import brandAdminHandler from './_admin/brand-admin.js';
import brandSyncHandler from './_admin/brand-sync.js';
import partyHandler from './_party/party.js';
import accountHandler from './_account/account.js';
import feedbackHandler from './_feedback/feedback.js';
import subscribeHandler from './_subscribe/subscribe.js';
import notificationsHandler from './_notifications/notifications.js';
import catalogIngestHandler from './_catalog/ingest.js';
import catalogSearchHandler from './_catalog/search.js';

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

  // Leave the raw stream intact for export-payment — its Stripe webhook needs the
  // unparsed body for signature verification (it reads the raw body itself).
  const isRawPassthrough = route === 'export-payment' || pathname.includes('/export-payment');
  if (!isRawPassthrough && req.method === 'POST') {
    try {
      const rawBody = await getRawBody(req);
      const rawString = rawBody.toString('utf8');
      req.body = rawString ? JSON.parse(rawString) : {};
    } catch (err) {
      console.error("Failed to parse body in store-api router:", err);
      req.body = {};
    }
  }

  if (route === 'store-auth' || pathname.includes('/store-auth')) {
    return authHandler(req, res);
  } else if (route === 'export-payment' || pathname.includes('/export-payment')) {
    return exportPaymentHandler(req, res);
  } else if (route === 'rank-brands' || pathname.includes('/rank-brands')) {
    return rankBrandsHandler(req, res);
  } else if (route === 'widget-size' || pathname.includes('/widget-size')) {
    return widgetSizeHandler(req, res);
  } else if (route === 'connections' || pathname.includes('/connections')) {
    return connectionsHandler(req, res);
  } else if (route === 'brand-admin' || pathname.includes('/brand-admin')) {
    return brandAdminHandler(req, res);
  } else if (route === 'brand-sync' || pathname.includes('/brand-sync')) {
    return brandSyncHandler(req, res);
  } else if (route === 'party' || pathname.includes('/party')) {
    return partyHandler(req, res);
  } else if (route === 'account' || pathname.includes('/account')) {
    return accountHandler(req, res);
  } else if (route === 'feedback' || pathname.includes('/feedback')) {
    return feedbackHandler(req, res);
  } else if (route === 'subscribe' || pathname.includes('/subscribe')) {
    return subscribeHandler(req, res);
  } else if (route === 'notifications' || pathname.includes('/notifications')) {
    return notificationsHandler(req, res);
  } else if (route === 'catalog-ingest' || pathname.includes('/catalog-ingest')) {
    return catalogIngestHandler(req, res);
  } else if (route === 'catalog-search' || pathname.includes('/catalog-search')) {
    return catalogSearchHandler(req, res);
  } else {
    return res.status(404).json({ error: `Store API endpoint not found: ${pathname} (route parameter: ${route})` });
  }
}
