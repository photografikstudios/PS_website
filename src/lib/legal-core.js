// Legal pages (/terms, /licensing): structure checks. The text itself comes only from the supplied document.
const BLOCK_TYPES = new Set(['p', 'ul', 'ol', 'h3', 'table']);

export function validateLegal(legal) {
  const errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(legal.effectiveDate || '')) errors.push('effectiveDate must be YYYY-MM-DD');
  for (const [key, page] of Object.entries(legal.pages || {})) {
    if (!page.route || !page.title) errors.push(`${key}: route and title are required`);
    const ids = page.groups.map((g) => g.id);
    if (ids[0] !== 'general') errors.push(`${key}: the Photografik general group must come first`);
    for (const g of page.groups) for (const s of g.sections) {
      for (const b of s.blocks || []) if (!BLOCK_TYPES.has(b.type)) errors.push(`${key}: "${s.title}" has an unknown block type ${b.type}`);
    }
  }
  if (legal.ready === true) {
    if (!legal.source?.sha256) errors.push('ready is true but the source document checksum is not recorded');
    for (const [key, page] of Object.entries(legal.pages || {})) {
      for (const g of page.groups) {
        if (!g.sections.length) errors.push(`${key}: group ${g.id} has no sections`);
        for (const s of g.sections) if (!s.blocks?.length) errors.push(`${key}: "${s.title}" has no text`);
      }
    }
  }
  return errors;
}

/** Sections numbered continuously across groups (general first, then the Creator supplement). */
export function numberSections(page) {
  let n = 0;
  return page.groups.map((g) => ({ ...g, sections: g.sections.map((s) => ({ ...s, n: ++n, id: `section-${n}` })) }));
}
