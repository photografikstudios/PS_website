// Pure gallery logic shared by the build (render + validation + tests) and the browser.
// No Node or DOM APIs here. One media collection (content/work.json "media") feeds every view.

/** Media type filter values used by the Real Estate gallery. */
export const TYPE_FILTERS = [
  { id: '', label: 'All media' },
  { id: 'video', label: 'Video' },
  { id: 'photo', label: 'Photo' },
  { id: 'drone', label: 'Drone' },
];

/** Compact per-item facts the browser needs to filter (derived from a media record). */
export const facts = (m, segments = [], views) => ({
  kind: m.type === 'video' ? 'video' : 'image',
  drone: (m.service || []).includes('drone'),
  packages: m.packageIds || [],
  segments,
  // Optional: the media-type views ('' = All, 'video', 'photo') a project card appears in. A project with both a film and
  // photos has two cards: the lead (All + its own type) and a still-led card that appears only under Photo.
  ...(views ? { views } : {}),
});

/** Does an item (facts) match the package + type filters? Empty filter = no constraint. */
export function matches(f, { pkg = '', seg = '', type = '' } = {}) {
  if (pkg && !f.packages.includes(pkg)) return false;
  if (seg && !(f.segments || []).includes(seg)) return false;
  if (f.views) return f.views.includes(type);
  if (type === 'video' && f.kind !== 'video') return false;
  if (type === 'photo' && f.kind !== 'image') return false;
  if (type === 'drone' && !f.drone) return false;
  return true;
}

/** Stable editorial order: higher sortPriority first; ties keep collection order. */
export function editorialOrder(list) {
  return list.map((m, i) => [m, i])
    .sort((a, b) => (b[0].sortPriority || 0) - (a[0].sortPriority || 0) || a[1] - b[1])
    .map(([m]) => m);
}

/** Segments a media record inherits from its project (evidence lives on the project, never on the house name). */
export function segmentsOf(m, projectBySlug) {
  const p = m.project ? projectBySlug[m.project] : null;
  return p && Array.isArray(p.segments) ? p.segments : [];
}

/** Result counts for each option of one filter, holding the other filter fixed. */
export function optionCounts(items, current, key, optionIds) {
  return Object.fromEntries(optionIds.map((id) => [id, items.filter((f) => matches(f, { ...current, [key]: id })).length]));
}

/** Validate media metadata so a bad tag fails the build instead of making a false claim on the page. */
export function validateMedia(work, packageIds, { thisYear = new Date().getFullYear() } = {}) {
  const errors = [];
  const seen = new Set();
  for (const m of work.media) {
    if (!m.id) { errors.push('media record without id'); continue; }
    if (seen.has(m.id)) errors.push(`${m.id} appears twice (keep one canonical record)`);
    seen.add(m.id);
    if (!Array.isArray(m.packageIds)) errors.push(`${m.id}: packageIds must be an array ([] when unknown)`);
    else for (const p of m.packageIds) if (!packageIds.includes(p)) errors.push(`${m.id}: unknown package "${p}"`);
    if (m.capturedYear !== null && m.capturedYear !== undefined
      && !(Number.isInteger(m.capturedYear) && m.capturedYear >= 2010 && m.capturedYear <= thisYear)) {
      errors.push(`${m.id}: capturedYear must be a year up to ${thisYear} or null`);
    }
    if (m.packageIds?.length && m.category !== 'real-estate') errors.push(`${m.id}: package tags only apply to real estate media`);
    if (typeof m.published !== 'boolean') errors.push(`${m.id}: published must be true or false`);
    if ('segments' in m) errors.push(`${m.id}: segments belong on the project, not the media record`);
  }
  const segIds = (work.taxonomy?.segment || []).map((s) => s.id);
  for (const p of work.projects || []) {
    if (p.segments === undefined) continue;
    if (!Array.isArray(p.segments)) { errors.push(`${p.slug}: segments must be an array`); continue; }
    for (const s of p.segments) if (!segIds.includes(s)) errors.push(`${p.slug}: unknown segment "${s}"`);
    // Projects created in the dashboard (no fixed path) are James's own entries: choosing a discipline there is the
    // owner's confirmation (Oct 3 2026; this check stopped his first save from deploying). The original projects still
    // need written evidence for any discipline.
    if (p.segments.length && !p.segmentSource && p.path) errors.push(`${p.slug}: segments need a segmentSource (evidence)`);
    if (p.segments.length && p.category !== 'architecture-design') errors.push(`${p.slug}: segments only apply to architecture & design projects`);
  }
  return errors;
}
