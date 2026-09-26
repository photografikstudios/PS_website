// One-time helper that makes the build self-contained: downloads each file pinned in content/legacy-assets.json
// from this project's review alias, refuses any copy whose size or SHA-256 differs, and saves it under
// static/<same path>. Commit static/ afterwards; `npm run check:legacy` must then exit 0. Replit is not used.
//
//   node scripts/fetch-legacy.mjs                 (uses recordedFrom in content/legacy-assets.json)
//   node scripts/fetch-legacy.mjs https://<another deployment of this project that serves the same files>
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pins = JSON.parse(await readFile(join(root, 'content/legacy-assets.json'), 'utf8'));
const origin = (process.argv[2] || pins.recordedFrom).replace(/\/$/, '');
if (!/^https:\/\//.test(origin) || /replit/i.test(origin)) { console.error('usage: node scripts/fetch-legacy.mjs [https://<deployment of this project>]  (Replit is not accepted)'); process.exit(2); }
const sha = (b) => createHash('sha256').update(b).digest('hex');
let saved = 0; let present = 0; const failed = [];
for (const [ref, pin] of Object.entries(pins.files)) {
  const dest = join(root, 'static', ref);
  try { if (sha(await readFile(dest)) === pin.sha256) { present++; continue; } } catch { /* not saved yet */ }
  try {
    const r = await fetch(origin + ref);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length !== pin.bytes || sha(buf) !== pin.sha256) throw new Error(`hash mismatch (${buf.length} bytes)`);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    saved++; console.log('saved static' + ref);
  } catch (e) { failed.push(`${ref}: ${e.message}`); }
}
console.log(`\nlegacy assets: ${saved} saved, ${present} already present, ${failed.length} failed (of ${Object.keys(pins.files).length})`);
for (const f of failed) console.log('  FAILED ' + f);
process.exit(failed.length ? 1 : 0);
