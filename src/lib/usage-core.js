// Where is this used, and is it safe to delete? (James, Oct 13 2026: real deletion in the dashboard.)
// Runs on the server (api/cms-manage.js) against the branch's current files just before a delete, and in the tests.
//
// repo = {
//   projects:  [{ slug, ...record }]            content/projects/*.json (slug = file name when the record has none)
//   media:     [{ id, ...record }]              content/media/*.json (library photos and films, not project uploads)
//   notes:     [{ slug, file, front, body }]    content/field-notes/*.md
//   pageMedia: { <file>: {...} }                content/page-media/*.json
//   work (taxonomy), pageText, legacy, vercel, pins: Set(paths), posterPins: Set(paths)
// }
// Returns { blocking: [{ text, href }], notes: [text], files: [{ path, shared: [text], pinned, removable }] }.
// Anything in `blocking` means: do not delete; the list says what still uses it and where to change that.

import { PAGES, pageMediaRefs } from './page-media-core.js';
import { bodyRefs } from './markdown.js';
import { checkContent } from './content-check.js';
import { expandProjectPhotos } from './work-load.js';

const SERVICE_ROUTE = { 'real-estate': '/real-estate', 'agent-content': '/agent-content', 'architecture-design': '/architecture-design', commercial: '/commercial', 'creator-studios': '/creator-studios' };
export const projectRoute = (p) => p.path || `${SERVICE_ROUTE[p.category] || ''}/${p.slug}`;
const pmHref = (file) => `#/collections/page-media/entries/${file}`;
const name = (r, fallback) => r.title || r.client || fallback;

/** A site path as the renderer serves it: no query, no fragment, decoded, without the site's own address in front. */
export function sitePath(u) {
  let s = String(u || '').trim().replace(/^https?:\/\/(www\.)?photografikstudios\.com/i, '').split(/[?#]/)[0];
  try { s = decodeURI(s); } catch { /* keep as written */ }
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
}
/** Images and library media an article body really shows (the site's own Markdown parser), and the pages it links to. */
function noteRefs(n) {
  const refs = bodyRefs(String(n.body || ''));
  const links = [...String(n.body || '').matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map((m) => sitePath(m[1]));
  return { images: refs.images.map(sitePath), media: refs.media, links };
}

/** Picture files a record points at (its own files: an upload or the still of a film). */
function filesOf(collection, rec) {
  if (collection === 'photos') return [rec.src];
  if (collection === 'films') return [];
  if (collection === 'projects') return [rec.hero, ...(Array.isArray(rec.photos) ? rec.photos.map((x) => x && x.image) : [])];
  if (collection === 'field-notes') return [rec.front.hero, rec.front.ogImage, ...(Array.isArray(rec.front.photos) ? rec.front.photos.map((x) => x && x.image) : []), ...noteRefs(rec).images];
  return [];
}

/** Every place a picture file is referenced, except by `self` ({ collection, key }). */
function fileRefs(path, repo, self) {
  const out = [];
  const same = (p) => typeof p === 'string' && sitePath(p) === path;
  const isSelf = (c, k) => self && self.collection === c && self.key === k;
  for (const m of repo.media) {
    if (isSelf(m.type === 'video' ? 'films' : 'photos', m.id)) continue;
    if (same(m.src) || same(m.poster) || same(m.thumb)) out.push(`${m.type === 'video' ? 'Film' : 'Photo'} “${name(m, m.id)}”`);
  }
  for (const p of repo.projects) {
    if (isSelf('projects', p.slug)) continue;
    if (same(p.hero) || (Array.isArray(p.photos) && p.photos.some((x) => x && same(x.image)))) out.push(`Project “${name(p, p.slug)}”`);
  }
  for (const n of repo.notes) {
    if (isSelf('field-notes', n.slug)) continue;
    const f = n.front;
    if (same(f.hero) || same(f.ogImage) || (Array.isArray(f.photos) && f.photos.some((x) => x && same(x.image))) || noteRefs(n).images.includes(path)) out.push(`Field Note “${f.title || n.slug}”`);
  }
  for (const r of pageMediaRefs(repo.pageMedia)) if (same(r.src)) out.push(`Page Media › ${r.page}: ${r.label}`);
  for (const [route, pg] of Object.entries((repo.pageText && repo.pageText.pages) || {})) if (pg && same(pg.image)) out.push(`Page text › ${route}`);
  return out;
}

/** The portfolio as the build assembles it (project uploads become photos, project films join their project). */
function assemble(repo, without = {}) {
  const projects = repo.projects.filter((p) => !(without.projects && without.projects.has(p.slug))).map((p) => ({ ...p }));
  const media = repo.media.filter((m) => !(without.media && without.media.has(m.id))).map((m) => ({ ...m }));
  const byId = new Map(media.map((m) => [m.id, m]));
  for (const p of projects) {
    for (const m of expandProjectPhotos('/nonexistent', p)) if (!byId.has(m.id)) { byId.set(m.id, m); media.push(m); }
    for (const id of Array.isArray(p.films) ? p.films : []) { const m = byId.get(id); if (m && !m.project) m.project = p.slug; }
  }
  return { taxonomy: (repo.work && repo.work.taxonomy) || {}, projects, media };
}
/**
 * What the site's own content checks would newly complain about if this item were gone: the build's rules, run on the
 * branch's current files with and without it (Codex CMS review: deleting a published project's last photo passed every
 * where-used check, then broke the next build). Picture files are assumed present; only relations are compared.
 */
export function consequences(repo, without) {
  const run = (w) => checkContent({ work: w, fileExists: () => true }).errors;
  const before = new Set(run(assemble(repo)));
  return run(assemble(repo, without)).filter((e) => !before.has(e));
}

/**
 * Galleries that show a photo or film automatically (informative only: deleting it simply takes it out of them).
 * Mirrors the automatic rules in src/pages.js and respects each page's own gallery choice in Page Media.
 */
function autoGalleries(m, repo) {
  if (m.rights !== 'approved' || m.published === false || m.gallery === false || m.category === 'about') return [];
  const pm = repo.pageMedia || {}; const card = m.type !== 'video' || !!m.poster;
  const where = [];
  const add = (file, key, label, rule) => {
    const g = pm[file] && pm[file][key];
    if (g && g.mode === 'custom') return; // an own selection lists its items explicitly (a blocking use)
    if (g && Array.isArray(g.exclude) && g.exclude.includes(m.id)) return;
    if (rule) where.push(label);
  };
  const pmId = (file, key) => pm[file] && pm[file][key] && pm[file][key].media;
  add('home', 'selectedWork', 'Home: Selected work', card);
  add('real-estate', 'portfolio', 'Real Estate: portfolio', card && m.category === 'real-estate');
  add('agent-content', 'examples', 'Agent Content: examples', m.type === 'video' && m.category === 'agent-content' && m.id !== pmId('agent-content', 'whyFilm'));
  add('architecture-design', 'selectedWork', 'Architecture & Design: Selected work', card && m.category === 'architecture-design'
    && !['introPhoto', 'storyPhoto', 'detailPhoto'].some((k) => pmId('architecture-design', k) === m.id));
  if (m.project) { const p = repo.projects.find((x) => x.slug === m.project); if (p && p.published !== false) where.push(`its project page “${name(p, p.slug)}”`); }
  return where;
}

export function whereUsed(target, repo) {
  const { collection, key } = target;
  const blocking = []; const notes = [];
  let rec = null;
  if (collection === 'photos' || collection === 'films') rec = repo.media.find((m) => m.id === key);
  else if (collection === 'projects') rec = repo.projects.find((p) => p.slug === key);
  else if (collection === 'field-notes') rec = repo.notes.find((n) => n.slug === key || n.file === `${key}.md`);
  if (!rec) return { blocking: [{ text: 'This item could not be found in the latest saved version of the site. Reload the dashboard and try again.' }], notes, files: [], auto: [] };
  const auto = collection === 'photos' || collection === 'films' ? autoGalleries(rec, repo) : [];

  if (collection === 'photos' || collection === 'films') {
    const id = rec.id;
    for (const r of pageMediaRefs(repo.pageMedia)) if (r.media === id) blocking.push({ text: `Page Media › ${r.page}: ${r.label}`, href: pmHref(r.file) });
    for (const p of repo.projects) if (Array.isArray(p.films) && p.films.includes(id)) blocking.push({ text: `Project “${name(p, p.slug)}”, Films from the library`, href: `#/collections/projects/entries/${p.slug}` });
    for (const n of repo.notes) if (noteRefs(n).media.includes(id)) blocking.push({ text: `Field Note “${n.front.title || n.slug}”, in the article text`, href: `#/collections/field-notes/entries/${n.slug}` });
    if (rec.project) {
      const p = repo.projects.find((x) => x.slug === rec.project);
      notes.push(`It belongs to the project “${p ? name(p, p.slug) : rec.project}”. Deleting it takes it off that project page too.`);
    }
    if (collection === 'films') notes.push('The video files themselves stay on the site’s storage. They can be removed later in a reviewed cleanup.');
  }

  if (collection === 'projects') {
    const route = projectRoute(rec);
    for (const r of pageMediaRefs(repo.pageMedia)) if (r.project === rec.slug) blocking.push({ text: `Page Media › ${r.page}: ${r.label}`, href: pmHref(r.file) });
    const own = repo.media.filter((m) => m.project === rec.slug);
    for (const m of own) blocking.push({ text: `${m.type === 'video' ? 'Film' : 'Photo'} “${name(m, m.id)}” belongs to this project. Delete it, or choose another project for it`, href: `#/collections/${m.type === 'video' ? 'films' : 'photos'}/entries/${m.id}` });
    for (const n of repo.notes) if (noteRefs(n).links.includes(route)) blocking.push({ text: `Field Note “${n.front.title || n.slug}” links to this project page`, href: `#/collections/field-notes/entries/${n.slug}` });
    for (const r of (repo.vercel && repo.vercel.redirects) || []) if (r.destination === route) blocking.push({ text: `An old web address (${r.source}) sends visitors to this project page. That redirect is changed in a reviewed code update, not here` });
    if (rec.path) notes.push('This is one of the original site projects. Its page address goes away with it.');
    const uploads = (Array.isArray(rec.photos) ? rec.photos : []).filter((x) => x && x.image).length;
    if (uploads) notes.push(`Its ${uploads} uploaded ${uploads === 1 ? 'photo goes' : 'photos go'} with it.`);
  }

  if (collection === 'field-notes') {
    const route = `/field-notes/${rec.slug}`;
    for (const row of (repo.legacy && repo.legacy.items) || []) if (row.target === route) blocking.push({ text: `An old blog address (${row.from}) is mapped to this article. Change that mapping in a reviewed update first` });
    for (const r of (repo.vercel && repo.vercel.redirects) || []) if (r.destination === route) blocking.push({ text: `An old web address (${r.source}) sends visitors to this article` });
    for (const n of repo.notes) if (n !== rec && noteRefs(n).links.includes(route)) blocking.push({ text: `Field Note “${n.front.title || n.slug}” links to this article`, href: `#/collections/field-notes/entries/${n.slug}` });
  }

  // Would the site still build and show everything that is published? (Checked on the branch's current files.)
  if (collection !== 'field-notes' && !(collection === 'projects' && blocking.length)) {
    const without = collection === 'projects' ? { projects: new Set([rec.slug]) } : { media: new Set([rec.id]) };
    for (const e of consequences(repo, without)) {
      const m = e.match(/^Project “([^”]+)”/); const p = m && repo.projects.find((x) => name(x, x.slug) === m[1] || x.title === m[1]);
      blocking.push({ text: `Without it, a published page would break: ${e}. ${p ? `Add another photo or a main image to “${name(p, p.slug)}”, or switch that project to Draft first. To retire an old project: switch it to Draft, delete its photos and films, then delete the project.` : 'Fix that first, then delete.'}`, href: p ? `#/collections/projects/entries/${p.slug}` : undefined });
    }
  }

  const self = { collection, key };
  const files = [...new Set(filesOf(collection, rec).filter((p) => typeof p === 'string' && p.startsWith('/')).map(sitePath))].map((path) => {
    const shared = fileRefs(path, repo, self);
    const pinned = (repo.pins && repo.pins.has(path)) || (repo.posterPins && repo.posterPins.has(path)) || path.startsWith('/v/') || path.startsWith('/images/photografik-2027/');
    return { path, shared, pinned, removable: !shared.length && !pinned && /^\/images\/(library|projects|field-notes)\/[^/]+$/.test(path) };
  });
  return { blocking, notes, files, auto };
}

/** The page sections that list `id`, in words (for the where-used panel on a photo or film). */
export const pageSectionsUsing = (id, pageMedia) => pageMediaRefs(pageMedia).filter((r) => r.media === id).map((r) => ({ text: `${r.page}: ${r.label}`, href: pmHref(r.file), route: r.route }));
export { PAGES };

// ---------- Deletion plan (used by api/cms-manage.js; pure, so it is unit-tested) ----------
export const COLLECTIONS = {
  photos: { path: (k) => `content/media/${k}.json`, type: 'image', label: 'photo' },
  films: { path: (k) => `content/media/${k}.json`, type: 'video', label: 'film' },
  projects: { path: (k) => `content/projects/${k}.json`, label: 'project' },
  'field-notes': { path: (k) => `content/field-notes/${k}.md`, label: 'Field Note' },
};
export const KEY = /^[a-z0-9][a-z0-9-]{0,99}$/;
/** The name the owner types to confirm: the title as shown in the dashboard, else the file name. */
export function displayName(collection, rec) {
  if (!rec) return '';
  if (collection === 'field-notes') return String(rec.front.title || rec.slug).trim();
  return String(rec.title || rec.id || rec.slug).trim();
}
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * What a confirmed deletion removes, in one commit: the record, plus only the picture files the owner ticked that
 * nothing else uses. Refuses anything still in use, a wrong type, a name that was not typed exactly, or a file that is
 * shared, pinned or outside the dashboard's own upload folders.
 */
export function planDeletion({ collection, key, confirm, files = [] }, repo) {
  const c = COLLECTIONS[collection];
  if (!c || !KEY.test(String(key || ''))) return { errors: ['This kind of item cannot be deleted here.'] };
  let rec = null;
  if (collection === 'photos' || collection === 'films') rec = repo.media.find((m) => m.id === key);
  else if (collection === 'projects') rec = repo.projects.find((p) => p.slug === key);
  else rec = repo.notes.find((n) => n.file === `${key}.md`);
  if (!rec) return { errors: ['This item is not in the latest saved version of the site. Reload the dashboard.'] };
  if (c.type && (rec.type || 'image') !== c.type) return { errors: [`This is not a ${c.label}.`] };
  const usage = whereUsed({ collection, key: collection === 'field-notes' ? rec.slug : key }, repo);
  const errors = [];
  if (usage.blocking.length) errors.push('It is still used: ' + usage.blocking.map((b) => b.text).join('; ') + '.');
  if (norm(confirm) !== norm(displayName(collection, rec))) errors.push(`Type the name exactly: ${displayName(collection, rec)}`);
  const removable = new Map(usage.files.filter((f) => f.removable).map((f) => [f.path, f]));
  for (const f of files) if (!removable.has(f)) errors.push(`The file ${f} is shared, protected or not this item’s own upload, so it is kept.`);
  if (errors.length) return { errors, usage };
  return { errors: [], usage, name: displayName(collection, rec), paths: [c.path(key), ...files.map((f) => `static${f}`)] };
}

// ---------- Uploaded files (Codex review of 9e06705: a photo uploaded straight to a page has no Photos record) ----------
export const UPLOAD_PATH = /^\/images\/(library|projects|field-notes)\/[^/]+\.(jpe?g|png|webp|gif|avif)$/i;
/** Who uses one uploaded file, on the branch's current files. Pinned site files are never removable. */
export function uploadUsage(path, repo) {
  const p = sitePath(path);
  const shared = fileRefs(p, repo, null);
  const pinned = (repo.pins && repo.pins.has(p)) || (repo.posterPins && repo.posterPins.has(p));
  return { path: p, shared, pinned, removable: UPLOAD_PATH.test(p) && !shared.length && !pinned };
}
/** Deleting one unused upload: exact file name typed, nothing uses it, not pinned, inside the upload folders. */
export function planFileDeletion({ path, confirm }, repo) {
  const p = sitePath(path);
  if (!UPLOAD_PATH.test(p)) return { errors: ['Only photos uploaded in the dashboard can be deleted here.'] };
  const u = uploadUsage(p, repo);
  const errors = [];
  if (u.shared.length) errors.push('It is still used: ' + u.shared.join('; ') + '.');
  if (u.pinned) errors.push('It is a protected site file.');
  const fileName = p.split('/').pop();
  if (String(confirm || '').trim() !== fileName) errors.push(`Type the file name exactly: ${fileName}`);
  return errors.length ? { errors, usage: u } : { errors: [], usage: u, name: fileName, paths: [`static${p}`] };
}
