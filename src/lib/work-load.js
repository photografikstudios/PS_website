// Node-only loader for the portfolio: content/work.json keeps the readme and the gallery taxonomy, and every project
// and media record lives in its own file (content/projects/<slug>.json, content/media/<id>.json) so the /admin
// dashboard can edit one record at a time. The build, scripts and tests all read the collection through here, so
// the assembled { projects, media } arrays are exactly what work.json used to hold.
// Order: `order` (ascending) is the list position the old single file had; records without it go last, by file name.
// `sortPriority` still decides what shows first in galleries; `order` only breaks ties, as file order did before.
//
// Dashboard additions (all optional, absent on the 13 original projects):
//   project.photos  [{ image, alt, focal, orientation }]  photos uploaded in the project form. Each becomes a normal
//                   media record `<slug>-<file name>` that inherits the project's category, client, location, rights,
//                   visibility and priority, so every gallery, filter and project page treats it like any other photo.
//   project.films   [media id]  existing library films added to the project (they must not belong to another one).
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { imageSize, orientationOf } from './image-size.js';

const byOrder = (a, b) => (num(a.rec.order) ?? Infinity) - (num(b.rec.order) ?? Infinity) || a.file.localeCompare(b.file);
const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v));
export const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');

async function readDir(dir, key) {
  if (!existsSync(dir)) return { records: [], errors: [] };
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const rows = []; const errors = [];
  for (const file of files) {
    const name = file.replace(/\.json$/, '');
    try {
      const rec = JSON.parse(await readFile(join(dir, file), 'utf8'));
      // New records made in /admin take their web name from the file name (generated once from the title).
      if (rec[key] === undefined || rec[key] === '') rec[key] = name;
      else if (rec[key] !== name) errors.push(`${file}: "${key}" must match the file name (found "${rec[key]}")`);
      rows.push({ file, rec });
    } catch (e) { errors.push(`${file}: ${e.message}`); }
  }
  return { records: rows.sort(byOrder).map((r) => r.rec), errors };
}

/** Site path of an uploaded image (/images/...) to the committed file under static/. */
export const staticFile = (root, p) => (typeof p === 'string' && p.startsWith('/') && !p.includes('..') ? join(root, 'static', decodeURIComponent(p.split(/[?#]/)[0])) : null);

/** Media records for the photos uploaded in a project form. */
export function expandProjectPhotos(root, p) {
  const out = [];
  const used = new Set();
  (Array.isArray(p.photos) ? p.photos : []).forEach((ph, i) => {
    if (!ph || !ph.image) return;
    let id = `${p.slug}-${slugify(ph.image.split('/').pop()) || `photo-${i + 1}`}`;
    for (let n = 2; used.has(id); n++) id = `${p.slug}-${slugify(ph.image.split('/').pop())}-${n}`;
    used.add(id);
    const f = staticFile(root, ph.image);
    const size = f && existsSync(f) ? imageSize(readFileSync(f)) : null;
    out.push({
      id, type: 'image', project: p.slug, title: p.title, service: ['photography'], category: p.category,
      orientation: ph.orientation && ph.orientation !== 'auto' ? ph.orientation : size ? orientationOf(size) : 'horizontal',
      src: ph.image, featured: false, rights: p.rights || 'pending', alt: ph.alt || null, location: p.location || null,
      client: p.client || null, source: 'upload', published: p.published !== false, packageIds: [], capturedYear: null,
      sortPriority: num(p.sortPriority) || 0, ...(ph.focal && ph.focal !== 'center' ? { focal: ph.focal } : {}),
      ...(size ? { width: size.width, height: size.height } : {}), fromProject: true,
    });
  });
  return out;
}

/** { _readme, taxonomy, projects, media, loadErrors } */
export async function loadWork(root) {
  const base = JSON.parse(await readFile(join(root, 'content', 'work.json'), 'utf8'));
  const projects = await readDir(join(root, 'content', 'projects'), 'slug');
  const media = await readDir(join(root, 'content', 'media'), 'id');
  const errors = [...projects.errors, ...media.errors];
  // A replaced photo keeps no stale phone-size version: the -sm.webp thumb only belongs to its own /v/ still.
  for (const m of media.records) if (m.thumb && !(typeof m.src === 'string' && m.src.startsWith('/v/') && m.thumb === m.src.replace(/\.webp$/, '-sm.webp'))) delete m.thumb;
  for (const p of projects.records) {
    if (p.hero && (!p.heroOrientation || p.heroOrientation === 'auto')) {
      const f = staticFile(root, p.hero);
      const size = f && existsSync(f) ? imageSize(readFileSync(f)) : null;
      p.heroOrientation = size ? orientationOf(size) : 'horizontal';
    }
    if (!p.heroOrientation) p.heroOrientation = 'horizontal';
  }
  const all = [...media.records];
  const byId = new Map(all.map((m) => [m.id, m]));
  for (const p of projects.records) {
    for (const m of expandProjectPhotos(root, p)) {
      if (byId.has(m.id)) { errors.push(`${p.slug}: photo id "${m.id}" is already used; rename the image file`); continue; }
      byId.set(m.id, m); all.push(m);
    }
    for (const id of Array.isArray(p.films) ? p.films : []) {
      const m = byId.get(id);
      if (!m) errors.push(`${p.slug}: film "${id}" is not in the library`);
      else if (m.type !== 'video') errors.push(`${p.slug}: "${id}" is a photo, not a film`);
      else if (m.project && m.project !== p.slug) errors.push(`${p.slug}: film "${id}" already belongs to project "${m.project}"`);
      else m.project = p.slug;
    }
  }
  return { ...base, projects: projects.records, media: all, loadErrors: errors };
}

/** The fields the build adds for bookkeeping only; strip them when comparing with the pre-split work.json. */
export const bookkeeping = ['order'];
