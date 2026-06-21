import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const PORT = 3000;
const STORE_DIR = path.join(process.cwd(), 'store');
const API_DIR = path.join(process.cwd(), 'api');

// Load .env variables
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          process.env[key] = val;
        }
      }
    }
    console.log("Loaded environment variables from .env");
  }
} catch (err) {
  console.error("Failed to load .env file:", err);
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // API routing
  if (pathname.startsWith('/api/')) {
    let apiName = pathname.substring(5); // e.g. "store-auth"
    
    // Rewrite legacy store-* endpoints to store-api.js router
    if (apiName.startsWith('store-')) {
      apiName = 'store-api';
    }
    
    const apiPath = path.join(API_DIR, `${apiName}.js`);
    
    if (fs.existsSync(apiPath)) {
      try {
        // Dynamically import API module
        const apiModule = await import(`file://${apiPath}?update=${Date.now()}`);
        
        // Mock Vercel request object
        const vercelReq = req;
        vercelReq.query = Object.fromEntries(parsedUrl.searchParams);
        
        // Check if body parsing is needed
        const config = apiModule.config || {};
        const useBodyParser = !(config.api && config.api.bodyParser === false);
        
        if (useBodyParser) {
          let body = '';
          await new Promise((resolve) => {
            req.on('data', chunk => body += chunk);
            req.on('end', resolve);
          });
          
          if (body) {
            try {
              vercelReq.body = JSON.parse(body);
            } catch {
              vercelReq.body = body;
            }
          } else {
            vercelReq.body = {};
          }
        }

        // Mock Vercel response object
        const vercelRes = {
          statusCode: 200,
          status(code) {
            this.statusCode = code;
            res.statusCode = code;
            return this;
          },
          setHeader(name, value) {
            res.setHeader(name, value);
            return this;
          },
          json(data) {
            res.statusCode = this.statusCode;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return this;
          },
          send(data) {
            res.statusCode = this.statusCode;
            if (typeof data === 'object') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            } else {
              res.end(data);
            }
            return this;
          },
          end(data) {
            res.statusCode = this.statusCode;
            res.end(data);
            return this;
          }
        };

        await apiModule.default(vercelReq, vercelRes);
        return;
      } catch (err) {
        console.error(`Error in API /api/${apiName}:`, err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'API Internal Server Error' }));
        return;
      }
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `API endpoint /api/${apiName} not found` }));
      return;
    }
  }

  // Static files serving
  if (pathname === '/' || pathname === '/store' || pathname === '/store/') {
    pathname = '/store/index.html';
  }

  let filePath = path.join(process.cwd(), pathname);
  
  // Security check: ensure path is within cwd
  if (!filePath.startsWith(process.cwd())) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.statusCode = 404;
    res.end('File Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Local dev server started at http://localhost:${PORT}/store/index.html`);
});
