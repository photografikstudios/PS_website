// Verifies that every legacy /images|/media/photografik-2027/ file the built site references is committed under
// static/ with the exact size and SHA-256 pinned in content/legacy-assets.json. Exit 0 only when all are present
// and match, and no referenced file is unpinned. Run after a build:  npm run build && npm run check:legacy
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pinned = JSON.parse(await readFile(join(root, 'content/legacy-assets.json'), 'utf8')).files;
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
const problems = [];
let good = 0;
for (const r of [...refs].sort()) {
  const pin = pinned[r];
  if (!pin) { problems.push(`unpinned   static${r}`); continue; }
  let buf;
  try { buf = await readFile(join(root, 'static', r)); } catch { problems.push(`missing    static${r}`); continue; }
  const h = createHash('sha256').update(buf).digest('hex');
  if (buf.length !== pin.bytes || h !== pin.sha256) { problems.push(`mismatch   static${r} (${buf.length} bytes, ${h.slice(0, 12)})`); continue; }
  good++;
}
const unused = Object.keys(pinned).filter((k) => !refs.has(k));
console.log(`legacy assets referenced: ${refs.size}; committed and verified: ${good}; problems: ${problems.length}${unused.length ? `; pinned but no longer referenced: ${unused.length}` : ''}`);
for (const p of problems) console.log('  ' + p);
for (const u of unused) console.log('  unused     static' + u);
process.exit(problems.length ? 1 : 0);
