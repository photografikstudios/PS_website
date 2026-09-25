// One-time helper to make the cold build Replit-free: downloads every legacy /images|/media/photografik-2027/
// file the built site references from a deployment that already serves them (e.g. the review alias), and
// saves each one under static/ at the same path. Commit static/ afterwards; `npm run check:legacy` must exit 0.
//
//   SKIP_MEDIA=1 node src/build.mjs && node scripts/fetch-legacy.mjs https://ps-website-rust.vercel.app
import { readFile, readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const origin = (process.argv[2] || '').replace(/\/$/, '');
if (!/^https:\/\//.test(origin)) { console.error('usage: node scripts/fetch-legacy.mjs https://<deployment that serves the files>'); process.exit(2); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else if (/\.(html|xml)$/.test(e.name)) out.push(p);
  }
  return out;
}
const refs = new Set();
for (const f of await walk(join(root, 'dist'))) {
  const txt = decodeURIComponent((await readFile(f, 'utf8')).replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
  for (const m of txt.matchAll(/\/(?:images|media)\/photografik-2027\/[\w\-./]+?\.(?:webp|jpe?g|png|mp4)/g)) refs.add(m[0]);
}
let ok = 0; let skipped = 0; const failed = [];
for (const ref of [...refs].sort()) {
  const dest = join(root, 'static', ref);
  try { if ((await stat(dest)).size > 0) { skipped++; continue; } } catch { /* not yet saved */ }
  const r = await fetch(origin + ref);
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !/image|video/.test(type)) { failed.push(`${ref} (${r.status} ${type})`); continue; }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  ok++; console.log('saved static' + ref);
}
console.log(`\nlegacy assets: ${ok} saved, ${skipped} already present, ${failed.length} failed`);
for (const f of failed) console.log('  FAILED ' + f);
process.exit(failed.length ? 1 : 0);
