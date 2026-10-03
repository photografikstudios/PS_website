// Minimal local server that mimics the Vercel config: cleanUrls, redirects, 404 page, /api/inquiry.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.webm': 'video/webm', '.mp4': 'video/mp4', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.avif': 'image/avif' };

function matchRedirect(path, query) {
  // Mirrors the parts of Vercel's redirect matching this site uses: exact paths, /:path* prefixes,
  // and `has` query conditions whose named captures fill :name in the destination. The query string passes through.
  for (const r of config.redirects) {
    let caps = {};
    if (r.has) {
      const ok = r.has.every((h) => {
        if (h.type !== 'query') return false;
        const v = query.get(h.key); if (v === null) return false;
        if (!h.value) return true;
        const m = new RegExp(`^(?:${h.value})$`).exec(v); if (!m) return false;
        caps = { ...caps, ...(m.groups || {}) }; return true;
      });
      if (!ok) continue;
    }
    if (r.missing && r.missing.some((m) => m.type === 'query' && query.has(m.key))) continue;
    let hit = false;
    if (r.source.endsWith('/:path*')) { const base = r.source.replace('/:path*', ''); hit = path === base || path.startsWith(base + '/'); } else hit = r.source === path;
    if (!hit) continue;
    let dest = r.destination.replace(/:(\w+)/g, (all, k) => (k in caps ? caps[k] : all));
    const qs = query.toString();
    if (qs) { const [a, frag] = dest.split('#'); dest = `${a}${a.includes('?') ? '&' : '?'}${qs}${frag !== undefined ? `#${frag}` : ''}`; }
    return { ...r, destination: dest };
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
    const redirect = matchRedirect(path.replace(/\/$/, '') || '/', url.searchParams);
    if (redirect) { res.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination }); return res.end(); }
    // Vercel order: redirects first, then rewrites.
    // vercel.json rewrite: /work?category=… is answered by api/legacy-work.js (a clean 307).
    const rw = (config.rewrites || []).find((r) => r.source === (path.replace(/\/$/, '') || '/') && (r.has || []).every((h) => h.type === 'query' && url.searchParams.has(h.key)));
    if (rw && rw.destination === '/api/legacy-work') {
      const { default: handler } = await import(join(root, 'api/legacy-work.js'));
      const r = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end() { res.writeHead(this.statusCode, this.headers); res.end(); } };
      return handler({ method: req.method, query: Object.fromEntries(url.searchParams) }, r);
    }
    const file = (path.endsWith('.html') ? null : await tryFile(join(dist, path)))
      || (path === '/' && await tryFile(join(dist, 'index.html')))
      || await tryFile(join(dist, path.replace(/\/$/, '') + '.html'))
      || (path !== '/' && await tryFile(join(dist, path.replace(/\/$/, ''), 'index.html'))); // directory index, e.g. /admin
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
