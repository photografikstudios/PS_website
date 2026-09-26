// Verifies that every web-ready file the published catalog needs is committed under static/v/ and matches
// content/media-assets.json (size + SHA-256). Exit 0 only when all are present and match.
//   npm run check:media            (or: node scripts/media-check.mjs --static <dir>)
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishedOutputs } from './media-outputs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = process.argv.includes('--static') ? process.argv[process.argv.indexOf('--static') + 1] : join(root, 'static');
let pins = { files: {} };
try { pins = JSON.parse(await readFile(join(root, 'content/media-assets.json'), 'utf8')); } catch { /* not pinned yet */ }
const need = await publishedOutputs(root);
const problems = []; let good = 0;
for (const p of need) {
  const pin = pins.files[p];
  if (!pin) { problems.push(`unpinned   static${p}`); continue; }
  let buf; try { buf = await readFile(join(staticDir, p)); } catch { problems.push(`missing    static${p}`); continue; }
  const h = createHash('sha256').update(buf).digest('hex');
  if (buf.length !== pin.bytes || h !== pin.sha256) { problems.push(`mismatch   static${p}`); continue; }
  good++;
}
console.log(`web-ready media needed: ${need.length}; committed and verified: ${good}; problems: ${problems.length}`);
for (const p of problems.slice(0, 40)) console.log('  ' + p);
if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
process.exit(problems.length ? 1 : 0);
