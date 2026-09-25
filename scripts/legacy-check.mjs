// Lists legacy /images|/media/photografik-2027/ files referenced by the built site that are NOT committed under
// static/. While any are missing, a cold build (no Vercel cache) still reads them from media-sources legacyOrigin.
// Run after a build: node scripts/legacy-check.mjs   (exit 1 when any file would need the legacy origin)
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(html|xml)$/.test(e.name)) out.push(p);
  }
  return out;
}
const refs = new Set();
for (const f of await walk(join(root, 'dist'))) {
  const txt = decodeURIComponent((await readFile(f, 'utf8')).replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
  for (const m of txt.matchAll(/\/(?:images|media)\/photografik-2027\/[\w\-./]+?\.(?:webp|jpe?g|png|mp4)/g)) refs.add(m[0]);
}
const missing = [];
for (const r of [...refs].sort()) { try { await stat(join(root, 'static', r)); } catch { missing.push(r); } }
console.log(`legacy assets referenced: ${refs.size}; committed under static/: ${refs.size - missing.length}; still needing the legacy origin: ${missing.length}`);
for (const m of missing) console.log('  static' + m);
process.exit(missing.length ? 1 : 0);
