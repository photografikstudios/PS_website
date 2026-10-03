// Checks for everything editable in /admin (projects, photos and films, page text, testimonials, FAQs).
// Published records are checked strictly: an error fails the build, so the previous deployment stays live and the
// editor sees the message in the Vercel build log. Drafts only produce warnings, so unfinished work can be saved.
// Messages are written for the owner, not for developers.

import { createHash } from 'node:crypto';

const STREET = /\b\d{1,6}[\s_-]+(?:[a-z]+[\s_-]+){0,3}(?:lane|ln|road|rd|street|st|avenue|ave|drive|dr|court|ct|way|place|pl|boulevard|blvd|highway|hwy|path|trail|terrace|circle|cir)\b/i;
// Camera and phone file names (PS_00314, DJI_0042, IMG_1234, DSC01234, _MG_5678…) must never reach the public site.
const CAMERA = /(?:^|[^a-z0-9])(?:ps|dji|img|dsc[fn]?|_?mg|mvi|gopr|pxl|gh0?\d)[_-]?\d{4,}/i;
export const looksLikeCameraName = (path) => typeof path === 'string' && CAMERA.test('/' + path.split('/').pop().replace(/\.[a-z0-9]+$/i, ''));
export const looksLikeAddress = (s) => typeof s === 'string' && (STREET.test(s.replace(/\.[a-z0-9]+$/i, '')) || /^\s*\d{1,6}\s+\S/.test(s));

export function checkContent({ work, fileExists, imageInfo = () => null, pageText = null, testimonials = null, faqs = null }) {
  const errors = []; const warnings = [];
  const cats = new Set((work.taxonomy?.category || []).map((c) => c.id));
  const projectSlugs = new Set(work.projects.map((p) => p.slug));
  const say = (live, msg) => (live ? errors : warnings).push(msg);
  const nameOf = (p) => `Project “${p.title || p.slug}”`;

  for (const p of work.projects) {
    const live = p.published !== false;
    const who = nameOf(p);
    if (!p.title) say(live, `${who}: add a title`);
    if (!cats.has(p.category)) say(live, `${who}: choose a service category`);
    // Projects created in the dashboard (no fixed path yet) need both texts; a few original Commercial projects
    // deliberately hold them until the client wording is approved, so for those it is only a note.
    const isNew = !p.path;
    if (!p.summary) say(live && isNew, `${who}: add a short description`);
    if (!p.story) say(live && isNew, `${who}: add the story / goal paragraph`);
    if (p.rights !== 'approved') say(live, `${who}: rights are not marked Approved. Keep it as a draft until the client or owner has agreed to the photos being shown`);
    if (looksLikeAddress(p.location)) say(live, `${who}: “Town or area” looks like a street address. Use the town only`);
    if (looksLikeAddress(p.title) || looksLikeAddress(p.shortTitle)) say(live, `${who}: the title looks like a street address. Use the client or a neutral name`);
    if (p.hero) {
      if (!p.heroAlt) say(live, `${who}: describe the hero image (alt text)`);
      if (!fileExists(p.hero)) say(live, `${who}: the hero image ${p.hero} is missing`);
      if (looksLikeAddress(p.hero.split('/').pop())) say(live, `${who}: the hero image file name looks like a street address. Rename the file and upload it again`);
      if (looksLikeCameraName(p.hero)) say(live, `${who}: the main image still has its camera file name (${p.hero.split('/').pop()}). Choose it again with Replace photo so the dashboard renames it`);
    }
    const own = work.media.filter((m) => m.project === p.slug);
    if (!p.hero && !own.length) say(live, `${who}: add a hero image or at least one photo`);
    for (const [i, ph] of (Array.isArray(p.photos) ? p.photos : []).entries()) {
      const label = `${who}, photo ${i + 1}`;
      if (!ph || !ph.image) { say(live, `${label}: choose an image`); continue; }
      if (!ph.alt) say(live, `${label}: describe the photo (alt text)`);
      if (looksLikeAddress(ph.image.split('/').pop())) say(live, `${label}: the file name looks like a street address. Rename the file and upload it again`);
      if (looksLikeCameraName(ph.image)) say(live, `${label}: still has its camera file name (${ph.image.split('/').pop()}). Remove it and add it again so the dashboard renames it`);
      if (!fileExists(ph.image)) { say(live, `${label}: ${ph.image} is missing`); continue; }
      const size = imageInfo(ph.image);
      if (size && size.width < 1200 && size.height < 1200) say(live, `${label}: the image is only ${size.width}×${size.height} px. Upload one at least 1,600 px on the long side`);
      else if (size && Math.max(size.width, size.height) < 1600) warnings.push(`${label}: ${size.width}×${size.height} px is small; 2,000–2,400 px on the long side looks sharper`);
    }
  }

  for (const m of work.media) {
    if (m.fromProject) continue; // checked with its project above
    const live = m.published !== false && m.rights === 'approved';
    if (m.type === 'image' && !m.alt) say(live, `Photo “${m.title || m.id}”: describe the photo (alt text)`);
    if (m.project && !projectSlugs.has(m.project)) say(live, `“${m.title || m.id}”: its project “${m.project}” does not exist`);
    if (m.type === 'image' && m.src && m.src.startsWith('/images/') && !fileExists(m.src)) say(live, `Photo “${m.title || m.id}”: ${m.src} is missing`);
    if (looksLikeAddress(m.location)) say(live, `“${m.title || m.id}”: “Town or area” looks like a street address`);
    if (m.type === 'image' && looksLikeCameraName(m.src)) say(live, `Photo “${m.title || m.id}”: still has its camera file name (${String(m.src).split('/').pop()}). Replace the photo so the dashboard renames it`);
  }

  if (pageText) {
    for (const [route, pg] of Object.entries(pageText.pages || {})) {
      for (const k of ['eyebrow', 'title', 'lede']) if (!pg[k]) errors.push(`Page text ${route}: “${k === 'lede' ? 'Intro paragraph' : k === 'title' ? 'Heading' : 'Small label'}” cannot be empty`);
      if (pg.title && pg.title.length > 90) errors.push(`Page text ${route}: keep the heading under 90 characters so it fits on a phone`);
      if (pg.lede && pg.lede.length > 360) errors.push(`Page text ${route}: keep the intro under 360 characters`);
      if (pg.image !== undefined) {
        if (!pg.image) errors.push(`Page text ${route}: choose a hero image`);
        else if (!fileExists(pg.image)) errors.push(`Page text ${route}: ${pg.image} is missing`);
        if (!pg.imageAlt) errors.push(`Page text ${route}: describe the hero image (alt text)`);
      }
    }
  }
  if (testimonials) {
    for (const r of testimonials.reviews || []) {
      if (!r.name || !r.quote) errors.push(`Testimonial ${r.name || '(no name)'}: name and quote are required`);
      if (r.excerpt && r.quote && !isVerbatimExcerpt(r.excerpt, r.quote)) errors.push(`Testimonial ${r.name}: the Home short version must use the quote's own words, in order, with “…” for any gap`);
      if (r.featured !== undefined && r.featured !== null && r.featured !== '' && !Number.isInteger(Number(r.featured))) errors.push(`Testimonial ${r.name}: “Show on About page, position” must be a whole number`);
    }
  }
  if (faqs) {
    for (const [page, list] of Object.entries(faqs)) {
      if (!Array.isArray(list)) continue;
      for (const f of list) if (!f.q || !f.a) errors.push(`FAQ on ${page}: every question needs an answer`);
    }
  }
  return { errors, warnings };
}

/**
 * Projects created in the dashboard (no fixed path) that are switched to Published but fail a check are held back as
 * drafts, with the reasons kept for the project page and the dashboard status (/admin/status.json), instead of
 * stopping the whole site from updating. The original projects (fixed path) are never held: their errors still fail
 * the build. Returns [{ slug, title, reasons }]; mutates the held projects and their own photos.
 */
export function holdDashboardProjects(work, errors) {
  const held = [];
  for (const p of work.projects) {
    if (p.path || p.published === false) continue;
    const tag = `Project “${p.title || p.slug}”`;
    const mine = errors.filter((e) => e === tag || e.startsWith(tag + ':') || e.startsWith(tag + ','));
    if (!mine.length) continue;
    p.published = false;
    p._held = mine.map((e) => e.slice(tag.length).replace(/^[,:]\s*/, ''));
    for (const m of work.media) if (m.project === p.slug && m.fromProject) m.published = false;
    held.push({ slug: p.slug, title: p.title || p.slug, reasons: p._held });
  }
  return held;
}

/** Review-only test projects (reviewOnly: true) never exist in a production build, whatever Published says. */
export function applyReviewOnly(work, reviewMode) {
  const list = work.projects.filter((p) => p.reviewOnly === true);
  if (!reviewMode) for (const p of list) {
    p.published = false;
    for (const m of work.media) if (m.project === p.slug) m.published = false;
  }
  return list.map((p) => ({ slug: p.slug, title: p.title || p.slug }));
}

/** True when every “…”-separated piece of the excerpt appears in the quote, in order (a verbatim shortening). */
export function isVerbatimExcerpt(excerpt, quote) {
  const parts = String(excerpt).split(/\s*(?:…|\.\.\.)\s*/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return false;
  let at = 0;
  for (const part of parts) {
    const i = quote.indexOf(part, at);
    if (i < 0) return false;
    at = i + part.length;
  }
  return true;
}

/** Opaque id for a dashboard entry in the public status file: the dashboard hashes the open entry's name the same way. */
export const statusId = (slug) => createHash('sha256').update('pgk:' + slug).digest('hex').slice(0, 16);
/** File names in a reason can carry a client or project name: the public status file says "a photo file" instead. */
const scrubReason = (r) => String(r).replace(/[^\s()“”"']*\.(?:jpe?g|png|webp|avif|gif|mp4|mov)\b/gi, 'a photo file');

/**
 * What /admin/status.json says. It is a public static file (Codex, Session 57 review), and the familiar review link is
 * public too, so no build names a project in it: each held or review-only entry carries only an opaque id that the
 * signed-in dashboard matches to the entries it loads, and file names are removed from the reasons. A production
 * build lists no review-only entries (they do not exist there).
 */
export function dashboardStatus({ held, reviewOnly, reviewMode, commit = null, branch = null, builtAt = new Date().toISOString() }) {
  return {
    commit, branch, builtAt, mode: reviewMode ? 'review' : 'production',
    held: held.map((h) => ({ collection: 'projects', id: statusId(h.slug), reasons: h.reasons.map(scrubReason) })),
    reviewOnly: reviewMode ? reviewOnly.map((r) => ({ collection: 'projects', id: statusId(r.slug) })) : [],
  };
}
