// Field Notes validation and launch checks. Pure functions, shared by the build and tests.

import { bodyRefs, parseBlocks } from './markdown.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Parse one article file: JSON front matter ({ ... } starting on line 1 and closed by a "}" on its own line,
 * the format Decap CMS writes for json-frontmatter) followed by the Markdown body.
 */
export function parseArticleFile(text, filename) {
  const src = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const base = filename.replace(/^.*\//, '').replace(/\.md$/, '');
  if (!src.startsWith('{')) throw new Error(`${filename}: front matter must start with "{" on the first line`);
  const close = src.search(/\n\}[ \t]*(\n|$)/);
  if (close < 0) throw new Error(`${filename}: front matter is not closed with "}" on its own line`);
  let fm;
  try { fm = JSON.parse(src.slice(0, close + 2)); } catch (e) { throw new Error(`${filename}: front matter is not valid JSON (${e.message})`); }
  const body = src.slice(close + 2).replace(/^[ \t]*\n/, '');
  const published = fm.published === true;
  return {
    file: filename,
    slug: (fm.slug || base).trim(),
    title: fm.title || '',
    published,
    status: published ? 'published' : 'draft',
    datePublished: fm.date ? String(fm.date).slice(0, 10) : null,
    dateModified: fm.updated ? String(fm.updated).slice(0, 10) : null,
    category: fm.category || '',
    summary: fm.excerpt || '',
    answer: fm.answer || '',
    hero: fm.hero || '',
    heroAlt: fm.heroAlt || '',
    author: { name: fm.author || 'Photografik Studios' },
    featured: fm.featured === true,
    relatedService: fm.relatedService || null,
    cta: fm.cta && fm.cta.href ? fm.cta : null,
    seo: { title: fm.seoTitle || '', description: fm.seoDescription || '', image: fm.ogImage || '' },
    approvedBy: fm.approvedBy || null,
    legacyUrls: Array.isArray(fm.legacyUrls) ? fm.legacyUrls : [],
    sources: Array.isArray(fm.sources) ? fm.sources : [],
    // Photo gallery added in the dashboard (several photos in one action), shown after the article text.
    photos: Array.isArray(fm.photos) ? fm.photos.filter((ph) => ph && ph.image) : [],
    body,
  };
}

/** Newest first; same-day articles keep file order. */
export const sortNewest = (list) => list.map((a, i) => [a, i]).sort(([a, i], [b, j]) => (b.datePublished || '').localeCompare(a.datePublished || '') || i - j).map(([a]) => a);

/**
 * Structural checks. Returns { errors, warnings }: errors fail the build (published articles and anything that
 * would break routing); an incomplete draft only warns, so a half-written draft saved from the CMS never blocks a deploy.
 * opts.fileExists(path) confirms uploaded images are committed; opts.mediaIds is the set of approved library media.
 */
export function checkFieldNotes(fn, legacy, work, opts = {}) {
  const errors = [];
  const warnings = [];
  const cats = new Set((fn.categories || []).map((c) => c.id));
  const mediaIds = opts.mediaIds || new Set(work.media.map((m) => m.id));
  const approvedMedia = new Set(work.media.filter((m) => m.rights === 'approved').map((m) => m.id));
  const slugs = new Map();
  const legacyOwners = new Map();
  for (const a of fn.articles) {
    const out = a.published ? errors : warnings;
    const tag = `${a.file || a.slug}`;
    if (!SLUG.test(a.slug || '')) errors.push(`${tag}: URL name "${a.slug}" may use only lowercase letters, numbers and single hyphens`);
    if (slugs.has(a.slug)) errors.push(`${tag}: URL name "${a.slug}" is already used by ${slugs.get(a.slug)}`);
    slugs.set(a.slug, tag);
    if (!a.title) out.push(`${tag}: title is required`);
    if (!cats.has(a.category)) out.push(`${tag}: unknown category "${a.category}"`);
    if (!a.summary) out.push(`${tag}: excerpt is required`);
    if (!DATE.test(a.datePublished || '')) out.push(`${tag}: publish date must be YYYY-MM-DD`);
    if (a.dateModified && !DATE.test(a.dateModified)) out.push(`${tag}: updated date must be YYYY-MM-DD`);
    if (!a.hero) out.push(`${tag}: hero image is required`);
    if (a.hero && !a.heroAlt) out.push(`${tag}: hero image alt text is required`);
    (a.photos || []).forEach((ph, i) => { if (!ph.alt) out.push(`${tag}: gallery photo ${i + 1} needs a description (alt text)`); });
    if (!parseBlocks(a.body).length) out.push(`${tag}: article content is empty`);
    if (a.seo?.title && a.seo.title.length > 70) out.push(`${tag}: SEO title over 70 characters`);
    if (a.seo?.description && a.seo.description.length > 160) out.push(`${tag}: meta description over 160 characters`);
    const refs = bodyRefs(a.body);
    for (const id of refs.media) {
      if (!mediaIds.has(id)) out.push(`${tag}: unknown library media ${id}`);
      else if (a.published && !approvedMedia.has(id)) errors.push(`${tag}: library media ${id} is not rights-approved`);
    }
    if (opts.fileExists) {
      for (const p of [a.hero, a.seo?.image, ...refs.images, ...(a.photos || []).map((ph) => ph.image)].filter(Boolean)) {
        if (/^https?:/i.test(p)) { out.push(`${tag}: ${p} is an outside link; upload the image instead`); continue; }
        if (!opts.fileExists(p)) out.push(`${tag}: image ${p} is not in the repository`);
      }
    }
    for (const u of a.legacyUrls || []) {
      if (legacyOwners.has(u)) errors.push(`${u} is claimed by ${legacyOwners.get(u)} and ${a.slug}`);
      legacyOwners.set(u, a.slug);
    }
  }
  for (const row of legacy.items) {
    if (row.status === 'mapped') {
      const slug = row.target.replace('/field-notes/', '');
      const art = fn.articles.find((a) => a.slug === slug);
      if (!art) errors.push(`legacy ${row.from} maps to missing article ${slug}`);
      else if (!(art.legacyUrls || []).includes(row.from)) errors.push(`legacy ${row.from} not listed in ${slug}.legacyUrls`);
    }
  }
  for (const [u, slug] of legacyOwners) {
    const row = legacy.items.find((r) => r.from === u);
    if (!row) errors.push(`${slug} lists legacy ${u} that is not in legacy-articles.json`);
  }
  return { errors, warnings };
}

/** Structural errors that should fail every build (kept for callers that only need the error list). */
export function validateFieldNotes(fn, legacy, work, opts) {
  return checkFieldNotes(fn, legacy, work, opts).errors;
}

/** Legacy URLs that would lose their answer if production went live now. */
export function legacyLaunchBlockers(fn, legacy) {
  const published = new Set(fn.articles.filter((a) => a.published === true).map((a) => `/field-notes/${a.slug}`));
  const anyPublished = published.size > 0;
  return legacy.items.filter((r) => {
    if (r.status === 'index') return !anyPublished;
    if (r.status === 'decision') return !r.approvedBy;
    if (r.status === 'mapped' && r.audit !== 'content-verified') return true;
    return !published.has(r.target);
  }).map((r) => `${r.from} (${r.status}${r.audit && r.audit !== 'content-verified' ? `, ${r.audit}` : ''}: ${r.target})`);
}
