// Writes a package/year tagging queue for James from the shared media collection.
// It lists what each real estate piece visibly contains and which packages include those deliverables.
// "Consistent with" is NOT a tag: a record is tagged only after James confirms what was delivered
// (node scripts/ingest.mjs tag <id> --packages ... --year ...).
// Usage: node scripts/tag-queue.mjs > TAGGING_QUEUE.md
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadWork } from '../src/lib/work-load.js';

const work = await loadWork(fileURLToPath(new URL('..', import.meta.url)));
const pricing = JSON.parse(await readFile(new URL('../content/pricing.json', import.meta.url)));
const pk = pricing.packages;

// Which package feature a piece of media evidences.
const evidence = (m) => {
  const f = [];
  if (m.type === 'video' && m.orientation === 'horizontal') f.push('film');
  if (m.type === 'video' && m.orientation === 'vertical') f.push('reel');
  if (m.type === 'image') f.push(/twilight|dusk/i.test(m.title) ? 'twilight' : 'interior');
  if ((m.service || []).includes('drone')) f.push('drone');
  return f;
};
const label = { film: 'horizontal film', reel: 'vertical reel', interior: 'photography', twilight: 'twilight photography', drone: 'drone' };

const rows = work.media.filter((m) => m.category === 'real-estate');
const out = [];
out.push('# Real estate media: package and year tagging queue');
out.push('');
out.push(`Generated from content/media (${rows.length} real estate records). Nothing here is a tag yet.`);
out.push('"Consistent with" lists every package whose HD Photo Hub inclusions cover what the piece shows. It narrows the question; it does not answer it. Please confirm the package actually booked (or "none/à la carte") and the shoot year for each, then run the command shown.');
out.push('');
out.push('| # | Record | What it shows | Consistent with | Current tag | Year | Confirm with |');
out.push('|---|---|---|---|---|---|---|');
rows.forEach((m, i) => {
  const ev = evidence(m);
  const fits = pk.filter((p) => ev.every((k) => (k === 'interior' ? p.features.interior : p.features[k]))).map((p) => p.name);
  out.push(`| ${i + 1} | \`${m.id}\` ${m.title}${m.location ? `, ${m.location}` : ''} | ${ev.map((k) => label[k]).join(' + ')} | ${fits.join(', ') || 'no single package (à la carte)'} | ${m.packageIds.length ? m.packageIds.join(', ') : 'untagged'} | ${m.capturedYear ?? 'unknown'} | \`node scripts/ingest.mjs tag ${m.id} --packages <id or none> --year <yyyy>\` |`);
});
out.push('');
out.push('Package ids: ' + pk.map((p) => `\`${p.id}\` (${p.name})`).join(', ') + '.');
console.log(out.join('\n'));
