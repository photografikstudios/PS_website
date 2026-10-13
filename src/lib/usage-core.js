// Where is this used? (James, Oct 13 2026: real deletion in the dashboard, with references protected.)
// One answer for the build's tests and for the signed-in dashboard, which runs this file against the branch's current
// files just before a delete. No Node imports: it also runs in the browser.
//
// repo = {
//   projects:  [{ slug, ...record }]            content/projects/*.json
//   media:     [{ id, ...record }]              content/media/*.json (library photos and films, not project uploads)
//   notes:     [{ slug, file, front, body }]    content/field-notes/*.md
//   pageMedia: { <file>: {...} }                content/page-media/*.json
//   pageText, legacy, vercel, pins: Set(paths), posterPins: Set(paths)
// }
// Returns { blocking: [{ text, href }], notes: [text], files: [{ path, shared: [text], pinned, removable }] }.
// Anything in `blocking` means: do not delete; the list says what still uses it and where to change that.

import { PAGES, pageMediaRefs } from './page-media-core.js';

const SERVICE_ROUTE = { 'real-estate': '/real-estate', 'agent-content': '/agent-content', 'architecture-design': '/architecture-design', commercial: '/commercial', 'creator-studios': '/creator-studios' };
export const projectRoute = (p) => p.path || `${SERVICE_ROUTE[p.category] || ''}/${p.slug}`;
const pmHref = (file) => `#/collections/page-media/entries/${file}`;
const name = (r, fallback) => r.title || r.client || fallback;

/** Picture files a record points at (its own files: an upload or the still of a film). */
function filesOf(collection, rec) {
  if (collection === 'photos') return [rec.src];
  if (collection === 'films') return [];
  if (collection === 'projects') return [rec.hero, ...(Array.isArray(rec.photos) ? rec.photos.map((x) => x && x.image) : [])];
  if (collection === 'field-notes') return [rec.front.hero, rec.front.ogImage, ...(Array.isArray(rec.front.photos) ? rec.front.photos.map((x) => x && x.image) : [])];
  return [];
}

/** Every place a picture file is referenced, except by `self` ({ collection, key }). */
function fileRefs(path, repo, self) {
  const out = [];
  const isSelf = (c, k) => self && self.collection === c && self.key === k;
  for (const m of repo.media) {
    if (isSelf(m.type === 'video' ? 'films' : 'photos', m.id)) continue;
    if (m.src === path || m.poster === path || m.thumb === path) out.push(`${m.type === 'video' ? 'Film' : 'Photo'} “${name(m, m.id)}”`);
  }
  for (const p of repo.projects) {
    if (isSelf('projects', p.slug)) continue;
    if (p.hero === path || (Array.isArray(p.photos) && p.photos.some((x) => x && x.image === path))) out.push(`Project “${name(p, p.slug)}”`);
  }
  for (const n of repo.notes) {
    if (isSelf('field-notes', n.slug)) continue;
    const f = n.front;
    if (f.hero === path || f.ogImage === path || (Array.isArray(f.photos) && f.photos.some((x) => x && x.image === path)) || String(n.body).includes(`(${path})`)) out.push(`Field Note “${f.title || n.slug}”`);
  }
  for (const r of pageMediaRefs(repo.pageMedia)) if (r.src === path) out.push(`Page Media › ${r.page}: ${r.label}`);
  for (const [route, pg] of Object.entries((repo.pageText && repo.pageText.pages) || {})) if (pg && pg.image === path) out.push(`Page text › ${route}`);
  return out;
}

export function whereUsed(target, repo) {
  const { collection, key } = target;
  const blocking = []; const notes = [];
  let rec = null;
  if (collection === 'photos' || collection === 'films') rec = repo.media.find((m) => m.id === key);
  else if (collection === 'projects') rec = repo.projects.find((p) => p.slug === key);
  else if (collection === 'field-notes') rec = repo.notes.find((n) => n.slug === key || n.file === `${key}.md`);
  if (!rec) return { blocking: [{ text: 'This item could not be found in the latest saved version of the site. Reload the dashboard and try again.' }], notes, files: [] };

  if (collection === 'photos' || collection === 'films') {
    const id = rec.id;
    for (const r of pageMediaRefs(repo.pageMedia)) if (r.media === id) blocking.push({ text: `Page Media › ${r.page}: ${r.label}`, href: pmHref(r.file) });
    for (const p of repo.projects) if (Array.isArray(p.films) && p.films.includes(id)) blocking.push({ text: `Project “${name(p, p.slug)}”, Films from the library`, href: `#/collections/projects/entries/${p.slug}` });
    for (const n of repo.notes) if (new RegExp(`^::media\\[${id.replace(/[-]/g, '\\-')}\\]\\s*$`, 'm').test(n.body)) blocking.push({ text: `Field Note “${n.front.title || n.slug}”, in the article text`, href: `#/collections/field-notes/entries/${n.slug}` });
    if (rec.project) {
      const p = repo.projects.find((x) => x.slug === rec.project);
      notes.push(`It belongs to the project “${p ? name(p, p.slug) : rec.project}”. Deleting it takes it off that project page too.`);
    }
    if (collection === 'films') notes.push('The video files themselves stay on the site’s storage. They can be removed later in a reviewed cleanup.');
  }

  if (collection === 'projects') {
    const route = projectRoute(rec);
    const own = repo.media.filter((m) => m.project === rec.slug);
    for (const m of own) blocking.push({ text: `${m.type === 'video' ? 'Film' : 'Photo'} “${name(m, m.id)}” belongs to this project. Delete it, or choose another project for it`, href: `#/collections/${m.type === 'video' ? 'films' : 'photos'}/entries/${m.id}` });
    for (const n of repo.notes) if (String(n.body).includes(`](${route})`) || String(n.body).includes(`](${route}#`)) blocking.push({ text: `Field Note “${n.front.title || n.slug}” links to this project page`, href: `#/collections/field-notes/entries/${n.slug}` });
    for (const r of (repo.vercel && repo.vercel.redirects) || []) if (r.destination === route) blocking.push({ text: `An old web address (${r.source}) sends visitors to this project page. That redirect is changed in a reviewed code update, not here` });
    if (rec.path) notes.push('This is one of the original site projects. Its page address goes away with it.');
    const uploads = (Array.isArray(rec.photos) ? rec.photos : []).filter((x) => x && x.image).length;
    if (uploads) notes.push(`Its ${uploads} uploaded ${uploads === 1 ? 'photo goes' : 'photos go'} with it.`);
  }

  if (collection === 'field-notes') {
    const route = `/field-notes/${rec.slug}`;
    for (const row of (repo.legacy && repo.legacy.items) || []) if (row.target === route) blocking.push({ text: `An old blog address (${row.from}) is mapped to this article. Change that mapping in a reviewed update first` });
    for (const r of (repo.vercel && repo.vercel.redirects) || []) if (r.destination === route) blocking.push({ text: `An old web address (${r.source}) sends visitors to this article` });
    for (const n of repo.notes) if (n !== rec && (String(n.body).includes(`](${route})`) || String(n.body).includes(`](${route}#`))) blocking.push({ text: `Field Note “${n.front.title || n.slug}” links to this article`, href: `#/collections/field-notes/entries/${n.slug}` });
  }

  const self = { collection, key };
  const files = [...new Set(filesOf(collection, rec).filter((p) => typeof p === 'string' && p.startsWith('/')))].map((path) => {
    const shared = fileRefs(path, repo, self);
    const pinned = (repo.pins && repo.pins.has(path)) || (repo.posterPins && repo.posterPins.has(path)) || path.startsWith('/v/') || path.startsWith('/images/photografik-2027/');
    return { path, shared, pinned, removable: !shared.length && !pinned && /^\/images\/(library|projects|field-notes)\/[^/]+$/.test(path) };
  });
  return { blocking, notes, files };
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
