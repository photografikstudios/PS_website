// Media ingest: add, tag, check and publish Google Drive footage without copying records.
// One canonical record per piece lives in content/work.json "media"; its Drive source lives in
// content/media-sources.json under the same id. Nothing is published automatically.
//
//   node scripts/ingest.mjs candidates links.txt        list Drive files in a pasted list that are not ingested yet
//   node scripts/ingest.mjs add <drive link|id> --id re-sagaponack-2026 --type video --title "Sagaponack listing film"
//        [--category real-estate] [--location "Sagaponack"] [--service video,drone] [--year 2026] [--packages signature]
//        [--loop 4,10] [--poster-at 6]
//   node scripts/ingest.mjs tag <id> [--year 2025|unknown] [--packages luxury-media,signature|none] [--priority 10]
//        [--title "..."] [--alt "..."] [--location "..."]
//   node scripts/ingest.mjs status [id]                   what each record still needs before it can be published
//   node scripts/ingest.mjs publish <id> --rights-approved   after checking title, rights, tags and playback on the preview
//   node scripts/ingest.mjs unpublish <id>
//
// After add/tag: commit, deploy a preview (the build encodes new Drive files), check the piece on the
// preview (it shows a "Needs approval" tag), then publish and deploy again.

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = { work: join(root, 'content/work.json'), sources: join(root, 'content/media-sources.json'), pricing: join(root, 'content/pricing.json') };
const load = async (f) => JSON.parse(await readFile(f, 'utf8'));
const save = (f, d) => writeFile(f, JSON.stringify(d, null, 2) + '\n');

const [cmd, ...rest] = process.argv.slice(2);
const BOOL = new Set(['--rights-approved']);
const pos = rest.filter((a, i) => !a.startsWith('--') && (i === 0 || !rest[i - 1].startsWith('--') || BOOL.has(rest[i - 1])));
const opt = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
const flag = (name) => rest.includes(`--${name}`);
const die = (msg) => { console.error(msg); process.exit(1); };

/** Accepts a bare id or any Drive URL form (file/d/<id>/view, open?id=, uc?id=). */
const driveId = (s) => (String(s).match(/\/d\/([\w-]{20,})/) || String(s).match(/[?&]id=([\w-]{20,})/) || String(s).match(/^([\w-]{20,})$/) || [])[1];

const work = await load(files.work);
const sources = await load(files.sources);
const pricing = await load(files.pricing);
const packageIds = pricing.packages.map((p) => p.id);
const byId = (id) => work.media.find((m) => m.id === id) || die(`No media record "${id}".`);

function parsePackages(v) {
  if (v === undefined) return undefined;
  if (v === 'none' || v === '') return [];
  const list = v.split(',').map((s) => s.trim());
  for (const p of list) if (!packageIds.includes(p)) die(`Unknown package "${p}". Use: ${packageIds.join(', ')}`);
  return list;
}
function parseYear(v) {
  if (v === undefined) return undefined;
  if (v === 'unknown') return null;
  const y = Number(v);
  if (!Number.isInteger(y) || y < 2010 || y > new Date().getFullYear()) die(`Year must be 2010–${new Date().getFullYear()} or "unknown".`);
  return y;
}

/** What a record still needs before it may be published. Package tags and year are optional but reported. */
function needs(m) {
  const hard = [];
  const soft = [];
  if (m.rights !== 'approved') hard.push('rights not confirmed');
  if (!m.title || /^untitled/i.test(m.title)) hard.push('title');
  if (m.type === 'image' && !m.alt) hard.push('alt text');
  if (m.type === 'video' && m.dialogue && !m.captions) hard.push('captions (has dialogue)');
  if (m.capturedYear == null) soft.push('capture year unknown');
  if (m.category === 'real-estate' && !m.packageIds?.length) soft.push('no verified package');
  return { hard, soft };
}

switch (cmd) {
  case 'candidates': {
    const list = pos[0] ? await readFile(pos[0], 'utf8') : die('Give a text file of pasted Drive links.');
    const known = new Set(sources.items.map((s) => s.drive));
    const ids = [...new Set(list.split(/\s+/).map(driveId).filter(Boolean))];
    const fresh = ids.filter((id) => !known.has(id));
    console.log(`${ids.length} Drive files in the list, ${ids.length - fresh.length} already ingested, ${fresh.length} new:`);
    for (const id of fresh) console.log(`  ${id}   → node scripts/ingest.mjs add ${id} --id <slug> --type video|image --title "..."`);
    break;
  }
  case 'add': {
    const drive = driveId(pos[0]) || die('Give a Drive link or file id.');
    const id = opt('id') || die('--id is required (lowercase-with-dashes, stable forever).');
    if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(id)) die('--id must be lowercase letters, digits and dashes.');
    if (work.media.some((m) => m.id === id) || sources.items.some((s) => s.id === id)) die(`"${id}" already exists. Use tag to change it.`);
    const dup = sources.items.find((s) => s.drive === drive);
    if (dup) die(`That Drive file is already ingested as "${dup.id}". One canonical record per piece.`);
    const type = opt('type');
    if (!['video', 'image'].includes(type)) die('--type video|image is required.');
    const category = opt('category') || 'real-estate';
    if (!work.taxonomy.category.some((c) => c.id === category)) die(`Unknown category "${category}".`);
    const service = (opt('service') || (type === 'video' ? 'video' : 'photography')).split(',');
    const src = { id, drive, ...(type === 'image' ? { image: true } : {}) };
    if (opt('loop')) src.loop = opt('loop').split(',').map(Number);
    if (opt('poster-at')) src.posterAt = Number(opt('poster-at'));
    sources.items.push(src);
    const rec = {
      id, type, project: null, title: opt('title') || `Untitled ${id}`, service, category,
      orientation: opt('orientation') || 'horizontal',
      src: type === 'video' ? `/v/${id}.mp4` : `/v/${id}.webp`,
      ...(type === 'video' ? { poster: `/v/${id}.webp`, dialogue: false, captions: null, transcript: null } : { thumb: `/v/${id}-sm.webp` }),
      featured: false, rights: 'pending', alt: opt('alt') || null, location: opt('location') || null, client: null, source: 'drive',
      published: false, packageIds: parsePackages(opt('packages')) || [], capturedYear: parseYear(opt('year')) ?? null, sortPriority: Number(opt('priority') || 0),
    };
    work.media.push(rec);
    await save(files.sources, sources);
    await save(files.work, work);
    console.log(`Added "${id}" as UNPUBLISHED. Deploy a preview to encode it, then check it there.`);
    console.log('The build reports the true orientation in /v/manifest.json; update --orientation with tag if it is vertical.');
    break;
  }
  case 'tag': {
    const m = byId(pos[0]);
    const pk = parsePackages(opt('packages'));
    const yr = parseYear(opt('year'));
    if (pk !== undefined) m.packageIds = pk;
    if (yr !== undefined) m.capturedYear = yr;
    if (opt('priority') !== undefined) m.sortPriority = Number(opt('priority'));
    for (const k of ['title', 'alt', 'location', 'orientation']) if (opt(k) !== undefined) m[k] = opt(k);
    await save(files.work, work);
    console.log(`Updated ${m.id}: packages [${m.packageIds.join(', ')}], year ${m.capturedYear ?? 'unknown'}, priority ${m.sortPriority}.`);
    break;
  }
  case 'status': {
    const list = pos[0] ? [byId(pos[0])] : work.media;
    for (const m of list) {
      const n = needs(m);
      const state = m.published ? 'published' : n.hard.length ? 'blocked  ' : 'ready    ';
      console.log(`${state}  ${m.id.padEnd(34)} ${String(m.capturedYear ?? '—').padEnd(5)} [${(m.packageIds || []).join(',')}]${n.hard.length ? `  needs: ${n.hard.join(', ')}` : ''}${n.soft.length ? `  note: ${n.soft.join(', ')}` : ''}`);
    }
    break;
  }
  case 'publish': {
    const m = byId(pos[0]);
    if (flag('rights-approved')) m.rights = 'approved';
    const n = needs(m);
    if (n.hard.length) die(`Not published. ${m.id} needs: ${n.hard.join(', ')}.${m.rights !== 'approved' ? ' Add --rights-approved once James confirms usage rights.' : ''}`);
    m.published = true;
    await save(files.work, work);
    console.log(`Published ${m.id}.${n.soft.length ? ` Note: ${n.soft.join(', ')}.` : ''}`);
    break;
  }
  case 'unpublish': {
    const m = byId(pos[0]);
    m.published = false;
    await save(files.work, work);
    console.log(`Unpublished ${m.id}.`);
    break;
  }
  default:
    console.log('Usage: node scripts/ingest.mjs candidates|add|tag|status|publish|unpublish (see the header of this file).');
}
