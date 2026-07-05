import webhookHandler from './_3dlook/webhook.js';
import initSessionHandler from './_3dlook/init-session.js';
import checkStatusHandler from './_3dlook/check-status.js';
import saveMeasurementsHandler from './_3dlook/save-measurements.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const route = url.searchParams.get('route');

  if (route === 'init-session' || pathname.includes('/init-session')) {
    return initSessionHandler(req, res);
  } else if (route === 'check-status' || pathname.includes('/check-status')) {
    return checkStatusHandler(req, res);
  } else if (route === 'save-measurements' || pathname.includes('/save-measurements')) {
    return saveMeasurementsHandler(req, res);
  } else if (route === 'webhook' || pathname.includes('/webhook')) {
    return webhookHandler(req, res);
  } else {
    return res.status(404).json({ error: `3DLook API endpoint not found: ${pathname} (route parameter: ${route})` });
  }
}
