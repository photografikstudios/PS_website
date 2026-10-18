// Page Media (James, Oct 13 2026): every photo and video in a named section of the site's own pages is chosen in
// content/page-media/<page>.json and edited in /admin → Page Media. This file is the inventory of those sections and
// the rules each one follows. It runs in Node (build, tests) and in the browser (the dashboard), so no Node imports.
//
// A section's value is one item, or a list of items for sections that show several:
//   { "media": "<id>" }                 a photo or film from the shared library (content/media/<id>.json), or a site
//                                        film loop (/v/<id>-loop.mp4) for moving backgrounds
//   { "media": "<id>", "label": "…" }   the same, with the words a screen reader hears for a playing example
//   { "media": "<id>", "alt": "…" }     the same, with a description that replaces the library one in this place
//   { "src": "/images/…", "alt": "…" }  a photo file used only here (uploaded in Page Media, or an original site image)
// Optional keys kept as they are: "position" (crop position, e.g. "50% 22%").
//
// Not in Page Media on purpose: prices, policies, booking links and layout; galleries that fill themselves from the
// library (they are listed per page as "automatic" with where to change them); project and article pictures (edited in
// Projects and Field Notes).

export const KINDS = {
  heroLoop: 'Moving background at the top of the page (a film loop with a phone still)',
  loop: 'Playing example (a muted film loop)',
  film: 'Film with sound (plays when tapped)',
  photo: 'Photo',
  still: 'Photo, or the still frame of a film',
  loopOrPhoto: 'Playing example or photo',
  photoOrFilm: 'Photo, or a film with sound',
  gallery: 'Gallery: photos and films (films need a still)',
  filmGallery: 'Gallery: films',
  projectGallery: 'Gallery: projects',
  project: 'A project',
};
// Galleries (Codex review of 11c9abe: per-page control). A gallery's value is null or { mode: 'automatic', exclude: [ids] }
// (the page's automatic choice, minus what James left out on this page) or { mode: 'custom', items: [{ media }] }
// (exactly these, in this order). Project galleries use { project } items and slugs. Nothing here changes the library
// or any other page.
const G = (key, label, accepts, more = {}) => ({ key, label, accepts, gallery: true, required: false, empty: 'Automatic, as before.', ...more });
const GALLERY_KINDS = ['gallery', 'filmGallery', 'projectGallery', 'project'];
export const isGallery = (slot) => GALLERY_KINDS.includes(slot.accepts);
// Larger than any automatic gallery today (Home 146, Real Estate 98), so “My own selection” can always start from it.
export const GALLERY_MAX = 400;
const OPTIONAL = { required: false, empty: 'Nothing is shown here (the page stays text only).' };

const S = (key, label, accepts, more = {}) => ({ key, label, accepts, required: true, ...more });
const L = (key, label, accepts, min, max, more = {}) => ({ key, label, accepts, list: { min, max }, required: min > 0, ...more });

/** Pages, in the order of the site menu. `file` is content/page-media/<file>.json. */
export const PAGES = [
  {
    file: 'home', route: '/', label: 'Home',
    slots: [
      S('hero', 'Top of the page: moving background', 'heroLoop'),
      S('listingsTile', '“For your listings” tile: photo', 'photo', { alt: 'required' }),
      S('brandTile', '“For your brand” tile: photo', 'photo', { alt: 'required' }),
      S('pathRealEstate', '“Who we work with”, 01 Real estate: playing example', 'loop'),
      S('pathArchitecture', '“Who we work with”, 02 Architecture & builders: playing example', 'loop'),
      S('pathCommercial', '“Who we work with”, 03 Business & brand: playing example', 'loop'),
      S('pathCreator', '“Who we work with”, 04 LI Creator Studios: playing example', 'loop'),
      S('closing', 'Closing “Next step” band: background photo', 'photo', { alt: 'decorative' }),
      G('selectedWork', 'Selected work (Videos / Photos)', 'gallery', { auto: 'Every photo and film that is shown, newest first; “Show first” on a photo or film moves it up everywhere.' }),
    ],
  },
  {
    file: 'real-estate', route: '/real-estate', label: 'Real Estate',
    slots: [
      S('hero', 'Top of the page: moving background', 'heroLoop'),
      S('coverageFilm', '“What goes into a listing campaign”: playing example', 'loop', { labelled: true }),
      S('featurePhotography', 'Service block “Photography”: picture', 'still'),
      S('featureVideo', 'Service block “Horizontal and vertical film”: picture', 'still'),
      S('featureDrone', 'Service block “Drone”: picture', 'still'),
      S('featureFloorPlan', 'Service block “Floor plans”: picture', 'still', { required: false, empty: 'A simple drawn floor plan is shown instead.' }),
      S('featureTwilight', 'Service block “Twilight and day-to-night”: picture', 'still'),
      S('featureAgent', 'Service block “You, on camera”: picture', 'still'),
      G('portfolio', 'Real estate portfolio', 'gallery', { auto: 'Every Real Estate photo and film that is shown.' }),
    ],
  },
  {
    file: 'real-estate-pricing', route: '/real-estate/pricing', label: 'Real Estate pricing',
    slots: [
      S('loopLuxury', 'Package card “Luxury Media”: playing example', 'loop', { labelled: true }),
      S('loopSignature', 'Package card “Signature”: playing example', 'loop', { labelled: true }),
      S('loopSocial', 'Package card “Social Media”: playing example', 'loop', { labelled: true }),
      L('starterStills', 'Package card “Listing Starter”: photos that take turns', 'photo', 1, 6),
      S('rowPhotography', 'Photo tab, “Photography” row: small picture', 'still', { required: false, empty: 'The row shows no picture.' }),
      S('rowPhotoFloorPlan', 'Photo tab, “Photography + floor plan” row: small picture', 'still', { required: false, empty: 'The row shows no picture.' }),
      S('rowFloorPlan', 'Photo tab, “Floor plan” row: small picture', 'still', { required: false, empty: 'The row shows no picture.' }),
      S('rowExteriorDrone', 'Photo tab, “Exterior-only ground + drone photography” row: small picture', 'still', { required: false, empty: 'The row shows no picture.' }),
      S('rowTwilight', 'Photo tab, “Twilight photography” row: small picture', 'still', { required: false, empty: 'The row shows no picture.' }),
    ],
  },
  {
    file: 'agent-content', route: '/agent-content', label: 'Agent Content',
    slots: [
      S('hero', 'Top of the page: moving background', 'heroLoop'),
      S('whyFilm', '“Why it matters”: film with sound', 'film'),
      S('shootDayPhoto', '“How the shoot day works”: photo', 'photo'),
      G('examples', 'Examples (films beside “Fair questions”)', 'filmGallery', { auto: 'Every other Agent Content film that is shown.' }),
    ],
  },
  {
    file: 'architecture-design', route: '/architecture-design', label: 'Architecture & Design',
    slots: [
      S('hero', 'Top of the page: moving background', 'heroLoop'),
      S('introPhoto', '“Who this is for”: photo', 'photo', { notInGallery: true }),
      S('storyPhoto', '“Which story should we tell?”, Project photography: photo', 'photo', { notInGallery: true }),
      S('storyBrand', '“Which story should we tell?”, Brand story and interviews: picture', 'still'),
      S('detailPhoto', '“How we help”: photo', 'photo', { notInGallery: true }),
      L('designDetail', '“Design in detail”: four photos', 'photo', 1, 4),
      S('stepTell', '“How it works”, 01 Tell us: picture', 'still'),
      S('stepPlan', '“How it works”, 02 Plan: picture', 'still'),
      S('stepProduce', '“How it works”, 03 Produce: picture', 'still'),
      S('closing', 'Closing band: background photo', 'photo', { alt: 'decorative' }),
      G('selectedWork', 'Selected work', 'gallery', { auto: 'One card per Architecture & Design project plus uncredited photos and films; the three photos chosen above are left out so nothing repeats.' }),
    ],
    automatic: [
      ['“Project film” picture', 'The first film in Selected work.', '#/collections/films'],
    ],
  },
  {
    file: 'commercial', route: '/commercial', label: 'Commercial',
    slots: [
      S('hero', 'Top of the page: moving background', 'heroLoop'),
      S('featureBrand', '“What we do”, Brand and team photography: picture', 'still'),
      S('featureFilm', '“What we do”, Film and short-form: picture', 'still'),
      S('featureStudio', '“What we do”, Podcasts and studio days: picture', 'still'),
      S('featureRecurring', '“What we do”, Recurring production: picture', 'still'),
      S('agencyPhoto', '“For agencies”: picture', 'still'),
      S('closing', 'Closing band: background photo', 'photo', { alt: 'decorative' }),
      G('caseStudy', 'Case study: which project', 'project', { auto: 'RevivaLuxe, or the first client project.' }),
      G('clientWork', 'Client work: which projects, in which order', 'projectGallery', { auto: 'Every Commercial project with media, RevivaLuxe, Rachel Lynch Pools and Tortorella Pools first.' }),
    ],
    automatic: [
      ['Each project’s own films and photos', 'Edited in Projects.', '#/collections/projects'],
    ],
  },
  {
    file: 'agency-partnerships', route: '/agency-partnerships', label: 'Agency Partnerships',
    slots: [
      S('hero', 'Top of the page: photo', 'photo', { alt: 'required' }),
      S('askFirstMedia', '“What we ask first”: optional photo or film', 'photoOrFilm', OPTIONAL),
    ],
  },
  {
    file: 'creator-studios', route: '/creator-studios', label: 'LI Creator Studios',
    slots: [
      S('hero', 'Top of the page: moving background', 'heroLoop'),
      L('openingExamples', '“The person behind the business”: three examples beside the text', 'loopOrPhoto', 1, 3, { labelled: true }),
      S('sessionPodcast', 'Session card “Single studio session”: photo', 'photo'),
      S('sessionContent', 'Session card “General studio content”: photo', 'photo'),
      S('sessionMonthly', 'Session card “Monthly Content”: photo', 'photo'),
      S('sessionOther', 'Any other session card: photo', 'photo'),
      S('spaceReel', '“The space”: playing reel (with controls)', 'loop', { labelled: true }),
      S('formatPodcasts', 'Formats, Podcasts and guest conversations: picture', 'still'),
      S('formatMulticam', 'Formats, Multi-camera interviews: picture', 'still'),
      S('formatLongform', 'Formats, Long-form episodes: picture', 'still'),
      S('formatSolo', 'Formats, Solo on-camera pieces: picture', 'still'),
      S('formatShort', 'Formats, Short-form clips and reels: picture', 'still'),
      S('formatPlanned', 'Formats, Planned for your channels: picture', 'still'),
      L('conversations', '“Conversations and relationships”: three photos', 'photo', 1, 3),
    ],
  },
  {
    file: 'about', route: '/about', label: 'About',
    slots: [
      S('teamMedia', '“The team”: optional photo or film', 'photoOrFilm', OPTIONAL),
      S('clientVideo', 'Client reviews: video review (film with sound)', 'film', { required: false, empty: 'The first written review leads instead.' }),
      S('closing', 'Closing “Next step” band: background photo', 'photo', { alt: 'decorative' }),
    ],
  },
  {
    file: 'contact', route: '/contact', label: 'Send a Project Brief (contact)',
    slots: [S('introMedia', 'Above the form: optional photo or film', 'photoOrFilm', OPTIONAL)],
  },
  {
    file: 'field-notes', route: '/field-notes', label: 'Field Notes (list page)',
    slots: [S('hero', 'Top of the list page: photo', 'photo', { required: false, empty: 'The top of the page shows no photo.' })],
    automatic: [['Articles', 'Each article’s pictures are edited in Field Notes.', '#/collections/field-notes']],
  },
];

export const slotsOf = (file) => (PAGES.find((p) => p.file === file) || { slots: [] }).slots;
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const isItem = (v) => v && typeof v === 'object' && !Array.isArray(v);

/**
 * Checks content/page-media against the inventory. `lib` describes what exists:
 *   media: Map id → record (rights-approved library photos and films), loops: Set of loop asset ids,
 *   heroLoops: Set of loop ids with a phone still, fileExists(path).
 * Returns { errors, warnings } in plain words for the owner.
 */
export function checkPageMedia(pm, lib) {
  const errors = []; const warnings = [];
  for (const page of PAGES) {
    const values = pm[page.file];
    if (!values) { errors.push(`Page Media: the ${page.label} page file is missing (content/page-media/${page.file}.json)`); continue; }
    const known = new Set(['_about', ...page.slots.map((s) => s.key)]);
    for (const k of Object.keys(values)) if (!known.has(k)) errors.push(`Page Media ${page.label}: “${k}” is not a section of this page`);
    for (const slot of page.slots) {
      const where = `Page Media ${page.label}, ${slot.label}`;
      const v = values[slot.key];
      if (isGallery(slot)) { galleryProblems(slot, v, lib, where, errors, warnings); continue; }
      const items = asList(v);
      if (slot.list && v != null && !Array.isArray(v)) { errors.push(`${where}: should be a list`); continue; }
      if (!slot.list && Array.isArray(v)) { errors.push(`${where}: choose one item, not a list`); continue; }
      if (!items.length) { if (slot.required) errors.push(`${where}: choose ${slot.list ? 'at least one item' : 'an item'}; this section cannot be empty`); continue; }
      if (slot.list && items.length < slot.list.min) errors.push(`${where}: choose at least ${slot.list.min}`);
      if (slot.list && items.length > slot.list.max) errors.push(`${where}: choose no more than ${slot.list.max}`);
      for (const [i, it] of items.entries()) {
        const at = slot.list ? `${where}, item ${i + 1}` : where;
        if (!isItem(it)) { errors.push(`${at}: not a valid choice`); continue; }
        const problem = itemProblem(slot, it, lib);
        if (problem) errors.push(`${at}: ${problem}`);
        else {
          const m = it.media ? lib.media.get(it.media) : null;
          if (m && m.published === false) warnings.push(`${at}: “${m.title || m.id}” is hidden in ${m.type === 'video' ? 'Films' : 'Photos'}, so the live site leaves it out of this section (the review site still shows it)`);
        }
      }
    }
  }
  return { errors, warnings };
}

function galleryProblems(slot, v, lib, where, errors, warnings) {
  if (v == null) return;
  if (slot.accepts === 'project') {
    if (isItem(v) && v.hide === true) return; // James chose to show no case study
    if (!isItem(v) || typeof v.project !== 'string') errors.push(`${where}: choose a project, or Automatic`);
    else if (lib.projects && !lib.projects.has(v.project)) errors.push(`${where}: the project “${v.project}” does not exist`);
    return;
  }
  if (!isItem(v) || !['automatic', 'custom'].includes(v.mode)) { errors.push(`${where}: choose Automatic or your own selection`); return; }
  const byProject = slot.accepts === 'projectGallery';
  if (v.mode === 'automatic') {
    if (v.exclude != null && (!Array.isArray(v.exclude) || v.exclude.some((x) => typeof x !== 'string'))) errors.push(`${where}: the left-out list is not valid`);
    return;
  }
  // An empty own selection is allowed on purpose: the gallery then shows nothing on this page.
  if (!Array.isArray(v.items)) { errors.push(`${where}: the selection is not valid`); return; }
  if (v.items.length > GALLERY_MAX) errors.push(`${where}: choose no more than ${GALLERY_MAX}`);
  const seen = new Set();
  v.items.forEach((it, i) => {
    const at = `${where}, item ${i + 1}`;
    const id = isItem(it) ? (byProject ? it.project : it.media) : null;
    if (typeof id !== 'string') { errors.push(`${at}: not a valid choice`); return; }
    if (seen.has(id)) errors.push(`${at}: chosen twice`); seen.add(id);
    if (byProject) { if (lib.projects && !lib.projects.has(id)) errors.push(`${at}: the project “${id}” does not exist`); return; }
    const m = lib.media.get(id);
    if (!m) errors.push(`${at}: “${id}” is not in the library (or its rights are not approved)`);
    else if (slot.accepts === 'filmGallery' && m.type !== 'video') errors.push(`${at}: “${m.title || id}” is a photo; this gallery shows films`);
    else if (slot.accepts === 'gallery' && m.type === 'video' && !m.poster) errors.push(`${at}: “${m.title || id}” has no still for its card`);
    else if (m.published === false) warnings.push(`${at}: “${m.title || id}” is hidden, so the live site leaves it out (the review site still shows it)`);
  });
}

/** What is wrong with one item in a section, or '' when it fits. */
export function itemProblem(slot, it, lib) {
  if (it.src && it.media) return 'choose either a library item or a photo file, not both';
  if (it.src) {
    if (!['photo', 'still', 'loopOrPhoto', 'photoOrFilm'].includes(slot.accepts)) return 'this section needs a film, not a photo file';
    if (!/^\/(images|v)\/[^?#]+\.(jpe?g|png|webp)$/i.test(it.src)) return `${it.src} is not a site photo file`;
    if (!lib.fileExists(it.src)) return `${it.src} is missing`;
    if (slot.alt !== 'decorative' && !it.alt) return 'describe the photo (alt text)';
    return '';
  }
  if (!it.media) return 'choose an item';
  const m = lib.media.get(it.media);
  const isLoop = lib.loops.has(it.media);
  switch (slot.accepts) {
    case 'heroLoop':
      if (!isLoop) return `“${it.media}” has no moving background version (a film loop)`;
      if (!lib.heroLoops.has(it.media)) return `“${it.media}” has no phone still for the top of the page yet`;
      return '';
    case 'loop':
      if (!isLoop) return `“${it.media}” has no playing version (a film loop)`;
      return slot.labelled && !it.label ? 'add the words a screen reader hears for this example' : '';
    case 'film':
      if (!m) return `“${it.media}” is not in the library (or its rights are not approved)`;
      if (m.type !== 'video') return `“${m.title || m.id}” is a photo; this section needs a film`;
      return '';
    case 'photo':
      if (!m) return `“${it.media}” is not in the library (or its rights are not approved)`;
      return m.type === 'image' ? '' : `“${m.title || m.id}” is a film; this section needs a photo`;
    case 'still':
      if (!m) return `“${it.media}” is not in the library (or its rights are not approved)`;
      return m.type === 'image' || m.poster ? '' : `“${m.title || m.id}” has no still frame`;
    case 'photoOrFilm':
      if (!m) return `“${it.media}” is not in the library (or its rights are not approved)`;
      return m.type === 'image' || m.type === 'video' ? '' : 'choose a photo or a film';
    case 'loopOrPhoto':
      if (m && m.type === 'image') return '';
      if (!isLoop) return `“${it.media}” is neither a photo nor a playing example`;
      return slot.labelled && !it.label ? 'add the words a screen reader hears for this example' : '';
    default: return 'unknown section type';
  }
}

/** Every library id and file a page section uses: [{ page, file, key, label, media?, src? }] (for where-used). */
export function pageMediaRefs(pm) {
  const out = [];
  for (const page of PAGES) {
    const values = (pm && pm[page.file]) || {};
    for (const slot of page.slots) {
      const v = values[slot.key];
      // A gallery uses only what James chose himself (an automatic gallery depends on the library, not on one item).
      const items = isGallery(slot) ? (slot.accepts === 'project' ? asList(v).filter((x) => x && x.project) : v && v.mode === 'custom' && Array.isArray(v.items) ? v.items : []) : asList(v);
      for (const it of items) {
        if (!isItem(it)) continue;
        out.push({ page: page.label, route: page.route, file: page.file, key: slot.key, label: slot.label, media: it.media || null, src: it.src || null, project: it.project || null });
      }
    }
  }
  return out;
}

/** Existing phone crops remain preferred; imported films can use their checked poster without another import. */
export function heroStillMap(loops, media, fileExists) {
  const out = {};
  for (const id of loops) {
    const m = media.get(id); const asset = m?.asset || id;
    const phone = `/images/hero/${asset}-phone.webp`;
    if (fileExists(phone)) out[asset] = phone;
    else if (m?.type === 'video' && m.rights === 'approved' && m.poster && fileExists(m.poster)) out[asset] = m.poster;
  }
  return out;
}
