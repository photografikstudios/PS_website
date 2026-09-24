// Minimal local server that mimics the Vercel config: cleanUrls, redirects, 404 page, /api/inquiry.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.webm': 'video/webm', '.mp4': 'video/mp4' };

function matchRedirect(path) {
  for (const r of config.redirects) {
    if (r.source.endsWith('/:path*')) {
      const base = r.source.replace('/:path*', '');
      if (path === base || path.startsWith(base + '/')) return r;
    } else if (r.source === path) return r;
  }
  return null;
}

async function tryFile(p) { try { if ((await stat(p)).isFile()) return p; } catch {} return null; }

export function start(port = 0) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = decodeURIComponent(url.pathname);
    if (path === '/api/inquiry') {
      const { default: handler } = await import(join(root, 'api/inquiry.js'));
      let raw = ''; for await (const c of req) raw += c;
      const r = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(o) { res.writeHead(this.statusCode, { 'Content-Type': 'application/json', ...this.headers }); res.end(JSON.stringify(o)); } };
      return handler({ method: req.method, body: raw }, r);
    }
    const redirect = matchRedirect(path.replace(/\/$/, '') || '/');
    if (redirect) { res.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination }); return res.end(); }
    const file = (path.endsWith('.html') ? null : await tryFile(join(dist, path)))
      || (path === '/' && await tryFile(join(dist, 'index.html')))
      || await tryFile(join(dist, path.replace(/\/$/, '') + '.html'));
    if (!file) { res.writeHead(404, { 'Content-Type': types['.html'] }); return res.end(await readFile(join(dist, '404.html'))); }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await start(Number(process.env.PORT) || 4173);
  console.log(`Serving dist on http://localhost:${s.address().port}`);
}
