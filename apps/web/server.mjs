/**
 * Tiny static + API proxy server for the Q-CMS public demo site.
 *
 * - Serves `apps/web/public/` on http://localhost:3002
 * - Proxies `/api/*` to the running Q-CMS API on :3000 so the browser
 *   doesn't need CORS for relative URLs.
 * - Adds a `/admin` link to the running admin (port 3001).
 *
 * Usage:
 *   node server.mjs                     # serves on :3002
 *   API_URL=http://localhost:3000 node server.mjs
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, 'public');
const PORT = Number(process.env.WEB_PORT ?? 3002);
const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function safeJoin(root, requested) {
  const decoded = decodeURIComponent(requested.split('?')[0]);
  const resolved = normalize(join(root, decoded));
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

async function serveStatic(req, res) {
  // Map directory → index.html
  let urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  // Dynamic-route fallbacks: serve the slug template when the URL
  // points at an entry that doesn't have a static file.
  const dynamicTemplates = [
    { pattern: /^\/articles\/[^/]+\/?$/, template: '/articles/[slug]/index.html' },
  ];
  let filePath = safeJoin(PUBLIC_DIR, urlPath);
  if (filePath && (!existsSync(filePath) || !statSync(filePath).isFile())) {
    for (const { pattern, template } of dynamicTemplates) {
      if (pattern.test(urlPath.replace(/\/index\.html$/, ''))) {
        const alt = safeJoin(PUBLIC_DIR, template);
        if (alt && existsSync(alt) && statSync(alt).isFile()) {
          filePath = alt;
          break;
        }
      }
    }
  }

  if (!filePath) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    // Fall back to 404 page
    const notFound = join(PUBLIC_DIR, '404.html');
    if (existsSync(notFound)) {
      const body = await readFile(notFound);
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
    } else {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
    }
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] ?? 'application/octet-stream';
  res.writeHead(200, {
    'content-type': mime,
    'cache-control': 'public, max-age=60',
    'x-admin-url': ADMIN_URL,
    'x-api-url': API_URL,
  });
  createReadStream(filePath).pipe(res);
}

async function proxyApi(req, res) {
  const target = `${API_URL}${req.url}`;
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        accept: req.headers['accept'] ?? 'application/json',
        // Forward any cookies the browser set on :3002
        cookie: req.headers['cookie'] ?? '',
      },
    });
    const body = await upstream.text();
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'public, max-age=30',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ errors: [{ title: 'Bad gateway', detail: String(err) }] }));
  }
}

const server = createServer(async (req, res) => {
  // CORS for direct API hits (not strictly needed because of proxy)
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url?.startsWith('/api/')) {
    await proxyApi(req, res);
    return;
  }
  await serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`✓ Public site on http://localhost:${PORT}`);
  console.log(`  proxying /api/* → ${API_URL}`);
  console.log(`  link to admin → ${ADMIN_URL}`);
});
