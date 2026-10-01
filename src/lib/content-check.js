// Checks for everything editable in /admin (projects, photos and films, page text, testimonials, FAQs).
// Published records are checked strictly: an error fails the build, so the previous deployment stays live and the
// editor sees the message in the Vercel build log. Drafts only produce warnings, so unfinished work can be saved.
// Messages are written for the owner, not for developers.

const STREET = /\b\d{1,6}[\s_-]+(?:[a-z]+[\s_-]+){0,3}(?:lane|ln|road|rd|street|st|avenue|ave|drive|dr|court|ct|way|place|pl|boulevard|blvd|highway|hwy|path|trail|terrace|circle|cir)\b/i;
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
    }
    const own = work.media.filter((m) => m.project === p.slug);
    if (!p.hero && !own.length) say(live, `${who}: add a hero image or at least one photo`);
    for (const [i, ph] of (Array.isArray(p.photos) ? p.photos : []).entries()) {
      const label = `${who}, photo ${i + 1}`;
      if (!ph || !ph.image) { say(live, `${label}: choose an image`); continue; }
      if (!ph.alt) say(live, `${label}: describe the photo (alt text)`);
      if (looksLikeAddress(ph.image.split('/').pop())) say(live, `${label}: the file name looks like a street address. Rename the file and upload it again`);
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
