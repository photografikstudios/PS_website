// Field Notes validation and launch checks. Pure functions, shared by the build and tests.

const STATUSES = ['source-needed', 'draft', 'review', 'published'];

/** Structural errors that should fail every build. */
export function validateFieldNotes(fn, legacy, work) {
  const errors = [];
  const topics = new Set(fn.topics.map((t) => t.id));
  const mediaIds = new Set(work.media.map((m) => m.id));
  const slugs = new Set();
  const legacyOwners = new Map();
  for (const a of fn.articles) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug || '')) errors.push(`bad slug "${a.slug}"`);
    if (slugs.has(a.slug)) errors.push(`duplicate slug ${a.slug}`);
    slugs.add(a.slug);
    if (!STATUSES.includes(a.status)) errors.push(`${a.slug}: unknown status ${a.status}`);
    if (!topics.has(a.topic)) errors.push(`${a.slug}: unknown topic ${a.topic}`);
    if (a.status !== 'source-needed') {
      if (!a.title || !a.summary || !a.answer) errors.push(`${a.slug}: title, summary and a direct answer are required`);
      if (!a.sections?.length) errors.push(`${a.slug}: needs at least one section`);
      if (a.seo?.title && a.seo.title.length > 70) errors.push(`${a.slug}: SEO title over 70 characters`);
      if (a.seo?.description && a.seo.description.length > 160) errors.push(`${a.slug}: SEO description over 160 characters`);
      const refs = [a.hero?.media, ...(a.sections || []).map((s) => s.media)].filter(Boolean);
      for (const r of refs) if (!mediaIds.has(r)) errors.push(`${a.slug}: unknown media ${r}`);
    }
    if (a.status === 'published' && (!a.approvedBy || !a.datePublished)) errors.push(`${a.slug}: published needs approvedBy and datePublished`);
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
  return errors;
}

/** Legacy URLs that would lose their answer if production went live now. */
export function legacyLaunchBlockers(fn, legacy) {
  const published = new Set(fn.articles.filter((a) => a.status === 'published' && a.approvedBy).map((a) => `/field-notes/${a.slug}`));
  const anyPublished = published.size > 0;
  return legacy.items.filter((r) => {
    if (r.status === 'index') return !anyPublished;
    if (r.status === 'decision') return !r.approvedBy;
    return !published.has(r.target);
  }).map((r) => `${r.from} (${r.status}: ${r.target})`);
}
