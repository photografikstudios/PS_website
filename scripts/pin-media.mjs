// One-time helper (run where the network is open, e.g. the Mac's own Terminal): downloads the web-ready media the
// review site serves (/v/...), saves each file under static/v/, and writes content/media-assets.json with every
// file's size and SHA-256. With --expect <sha256>, it refuses to write anything unless the whole set matches the
// aggregate fingerprint recorded independently (so a changed or truncated download cannot be committed).
//   node scripts/pin-media.mjs --expect <aggregate-sha256> [https://<deployment of this project>]
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishedOutputs, aggregateOf } from './media-outputs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const expect = args.includes('--expect') ? args[args.indexOf('--expect') + 1] : null;
const origin = (args.find((a) => /^https?:\/\//.test(a)) || 'https://ps-website-rust.vercel.app').replace(/\/$/, '');
if (/replit/i.test(origin)) { console.error('Replit is not accepted as a source.'); process.exit(2); }
const paths = await publishedOutputs(root);
const files = {}; const bufs = {}; const failed = [];
for (const p of paths) {
  try {
    const r = await fetch(origin + p);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    files[p] = { bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
    bufs[p] = buf;
  } catch (e) { failed.push(`${p}: ${e.message}`); }
}
if (failed.length) { console.error(`media pins: ${failed.length} downloads failed`); for (const f of failed) console.error('  ' + f); process.exit(1); }
const aggregate = createHash('sha256').update(aggregateOf(files)).digest('hex');
const totalBytes = Object.values(files).reduce((a, f) => a + f.bytes, 0);
console.log(`media pins: ${paths.length} files, ${totalBytes} bytes, aggregate ${aggregate}`);
if (expect && expect !== aggregate) { console.error(`Aggregate mismatch: expected ${expect}. Nothing was written.`); process.exit(1); }
for (const [p, buf] of Object.entries(bufs)) { const dest = join(root, 'static', p); await mkdir(dirname(dest), { recursive: true }); await writeFile(dest, buf); }
await writeFile(join(root, 'content/media-assets.json'), JSON.stringify({
  _readme: 'Web-ready media committed under static/v/ (encoded from the Drive originals by scripts/media.mjs). The build reuses these instead of downloading from Drive and re-encoding. Check with npm run check:media.',
  recordedFrom: origin, recordedAt: new Date().toISOString().slice(0, 10), count: paths.length, totalBytes, aggregate, files,
}, null, 2) + '\n');
console.log('media pins: saved under static/v/ and content/media-assets.json');
