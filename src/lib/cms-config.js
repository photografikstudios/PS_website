// Decap CMS configuration for the owner dashboard (/admin). Generated at build time so the category lists, the
// library pickers and the Git branch always match the content being deployed.
// Sections: Projects, Photos, Films, Page Media, Page text, Testimonials, FAQs, Field Notes. Pricing, legal policies, booking
// links and page layout are deliberately not editable here (they stay on the reviewed code path).
// Every field a record already has is declared (unknown ones as hidden fields), so saving a form never drops data.

import { PAGES as PAGE_MEDIA, KINDS, isGallery } from './page-media-core.js';

const max = (n, what) => [`^[\\s\\S]{0,${n}}$`, `Keep the ${what} to ${n} characters or fewer`];
const date = { widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: false, picker_utc: true };
const FOCAL = [
  { label: 'Centre (default)', value: 'center' }, { label: 'Top', value: 'top' }, { label: 'Upper third (faces, ceilings)', value: 'upper-third' },
  { label: 'Bottom', value: 'bottom' }, { label: 'Left', value: 'left' }, { label: 'Right', value: 'right' },
];
const ORIENT = [{ label: 'Work it out from the file', value: 'auto' }, { label: 'Landscape', value: 'horizontal' }, { label: 'Portrait', value: 'vertical' }];
const hint = {
  published: 'Off = draft. A draft is saved and shows on the preview with a Draft note, but the live site, its galleries and the sitemap leave it out.',
  alt: 'Describe the picture for people who cannot see it, e.g. “Kitchen with a marble island and brass pendant lights”. Kept as image metadata, not shown as a caption. No street addresses.',
  caption: 'Optional visible note or credit, separate from the photo name and alt text. Leave blank for no caption. Shown in project galleries, photo viewers and Field Notes; compact gallery thumbnails stay uncluttered.',
  location: 'Town or area only (e.g. “Amagansett”). Never a street address.',
  focal: 'Which part of the photo must stay in view when a card crops it.',
};

/** Hidden fields for every key the records have that the form does not show, so saving keeps them. */
// “Where it is used, and delete” panel (src/admin/cms.js → /api/cms-manage). Saves nothing into the record.
const section = (name, label, text = '') => ({ name: `_section_${name}`, label, widget: 'pgk-section', required: false, text });
const arrange = (fields, groups) => {
  const used = new Set(); const out = [];
  for (const [name, label, names, text] of groups) {
    out.push(section(name, label, text));
    for (const n of names) { const f = fields.find((f) => f.name === n); if (f) { out.push(f); used.add(n); } }
  }
  return [...out, ...fields.filter((f) => !used.has(f.name))];
};
const MANAGE = { name: '_manage', label: 'Where it is used, and delete', widget: 'pgk-manage', required: false };
function keep(records, shown) {
  const keys = new Set();
  for (const r of records) for (const k of Object.keys(r)) if (!shown.has(k)) keys.add(k);
  return [...keys].sort().map((k) => ({ name: k, label: k, widget: 'hidden', required: false }));
}

export function cmsConfig({ site, fieldNotes, work, branch, repo, testimonials = { reviews: [] }, reviewMode = false }) {
  const cats = fieldNotes.categories.map((c) => ({ label: c.label, value: c.id }));
  const workCats = work.taxonomy.category.map((c) => ({ label: c.label, value: c.id }));
  const services = work.taxonomy.service.map((c) => ({ label: c.label, value: c.id }));
  const segments = (work.taxonomy.segment || []).map((c) => ({ label: c.label, value: c.id }));
  const fileMedia = work.media.filter((m) => !m.fromProject);
  // Folder and tag suggestions are written into /admin/config.js, which production serves publicly. Outside the review
  // version, only records the public site shows may contribute names (no hidden drafts, imports or review-only tests).
  const reviewOnlySlugs = new Set(work.projects.filter((p) => p.reviewOnly === true).map((p) => p.slug));
  const organizationRecords = (reviewMode ? [...work.projects, ...work.media, ...(work.importing || [])] : [...work.projects, ...work.media])
    .filter((r) => reviewMode || (r.published !== false && r.rights === 'approved' && !reviewOnlySlugs.has(r.slug) && !reviewOnlySlugs.has(r.project)));
  const folders = [...new Set(organizationRecords.map((m) => m.libraryFolder).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()))].sort();
  const tags = [...new Set(organizationRecords.flatMap((m) => Array.isArray(m.tags) ? m.tags : []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()))].sort();
  const organizationFields = () => [
    { name: 'libraryFolder', label: 'Library folder', widget: 'pgk-folder', required: false, options: folders, hint: 'Choose an existing folder or type a new one, e.g. Bellard Brothers. This organizes the library without moving files or changing where they appear.' },
    { name: 'tags', label: 'Tags', widget: 'pgk-tags', required: false, options: tags, hint: 'Reusable labels such as kitchen, exterior, pool or drone. Press Enter or comma to add each tag. Tags do not publish or place a photo.' },
  ];
  // Decap tests a filter pattern against the field as text: a list reads 'List [ "pool", "pool house" ]' (or
  // "pool,pool house" as a plain array). Match one whole tag, so "Tag: pool" does not also list "pool house".
  const tagPattern = (tag) => `(?:^|[\\[,] ?"?)${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:"? ?[,\\]]|$)`;
  const tagFilters = tags.map((tag) => ({ label: `Tag: ${tag}`, field: 'tags', pattern: tagPattern(tag) }));
  // Only media the site shows (no drafts, no review-only test photos): this list is in the public /admin/config.js.
  const testOnly = new Set(work.projects.filter((p) => p.reviewOnly === true).map((p) => p.slug));
  const library = work.media.filter((m) => m.rights === 'approved' && m.published !== false && !testOnly.has(m.project) && (m.type === 'image' || m.poster))
    .map((m) => ({ label: `${m.title}${m.location ? `, ${m.location}` : ''} (${m.type === 'video' ? 'film' : 'photo'})`, value: m.id, image: m.type === 'video' ? m.poster : m.src, type: m.type, alt: m.alt || '', caption: m.type === 'image' ? m.caption || '' : '' }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const servicePages = [
    ['Real Estate', '/real-estate'], ['Real Estate pricing', '/real-estate/pricing'], ['Agent Content', '/agent-content'],
    ['Architecture & Design', '/architecture-design'], ['Commercial', '/commercial'], ['Agency Partnerships', '/agency-partnerships'],
    ['LI Creator Studios', '/creator-studios'], ['Send a Project Brief (contact)', '/contact'],
  ].map(([label, value]) => ({ label, value }));
  // Our own upload widgets (src/admin/cms.js) save into the same folders as before; the paths are stated per field.
  const projectMedia = { media_folder: '/static/images/projects', public_folder: '/images/projects' };
  const notesMedia = { media_folder: '/static/images/field-notes', public_folder: '/images/field-notes' };
  const imageHint = 'A web JPG or WebP, 2,000–2,400 px on the long side (5 MB limit). Name the file after the client or subject, never the street address. The site makes the smaller sizes automatically.';

  // ---------- Projects ----------
  const projectFields = [
    { name: 'title', label: 'Project name', widget: 'pgk-live', inner: 'string', pattern: max(80, 'name'), hint: 'Usually the client, builder or designer, e.g. “Yankee Barn Builders”. No street addresses.' },
    { name: 'published', label: 'Show on site', widget: 'pgk-publish', default: false, required: false, hint: 'Off = Hidden draft. On = Show on site after Save, validation and a successful website update. The status at the bottom confirms the website update.' },
    { name: 'urlCategory', label: 'urlCategory', widget: 'hidden', required: false },
    { name: 'category', label: 'Service page', widget: 'pgk-category', inner: 'select', options: workCats, hint: 'Where visitors find this project. Previously shown projects keep this category to protect their web address; a move needs a reviewed redirect.' },
    { name: 'shortTitle', label: 'Short name for cards', widget: 'string', required: false, pattern: max(40, 'short name') },
    { name: 'client', label: 'Client name shown', widget: 'string', required: false, hint: 'Leave empty if the client has not agreed to be named.' },
    { name: 'location', label: 'Town or area', widget: 'string', required: false, hint: hint.location },
    { name: 'segments', label: 'Who the work is for (disciplines)', widget: 'select', multiple: true, required: false, options: segments, hint: 'Only for Architecture & Design: who the work was for (architect, builder, designer…).' },
    { name: 'segmentSource', label: 'segmentSource', widget: 'hidden', required: false },
    { name: 'services', label: 'What we delivered (services)', widget: 'select', multiple: true, required: false, options: services, hint: 'Choose every standard type delivered. These same types are used by the gallery filters; the Service field above chooses the project gallery.' },
    { name: 'serviceDetails', label: 'Special work or client details', widget: 'text', required: false, pattern: max(300, 'special work description'), hint: 'Optional: describe unusual deliverables or a special client brief in your own words. This appears separately on the project page and does not create a new gallery filter.' },
    { name: 'summary', label: 'Short description', widget: 'pgk-live', inner: 'text', required: false, pattern: max(200, 'description'), hint: 'One sentence for cards and search results.' },
    { name: 'story', label: 'Story / goal', widget: 'pgk-live', inner: 'text', required: false, pattern: max(700, 'story'), hint: 'The paragraph under the project name: what the work was for and how it was planned.' },
    { name: 'goal', label: 'Goal (Commercial only)', widget: 'text', required: false },
    { name: 'blurbApproved', label: 'Client approved this wording (Commercial only)', widget: 'boolean', required: false, hint: 'Commercial project texts show only after the client has approved them.' },
    { name: 'delivered', label: 'delivered', widget: 'hidden', required: false },
    { name: 'hero', label: 'Main image', widget: 'pgk-photo', required: false, ...projectMedia, hint: `Optional: without one, the first photo or film below leads the page. ${imageHint}` },
    { name: 'heroAlt', label: 'Main image description (alt text)', widget: 'pgk-live', inner: 'string', required: false, hint: hint.alt },
    { name: 'heroCaption', label: 'Main image caption (optional)', widget: 'string', required: false, pattern: max(300, 'caption'), hint: 'A visible note or credit under the main project photo. Leave blank for no caption; the description above stays as alt text.' },
    { name: 'heroFocal', label: 'Main image focus', widget: 'select', required: false, default: 'center', options: FOCAL, hint: hint.focal },
    { name: 'heroOrientation', label: 'Main image shape', widget: 'select', required: false, default: 'auto', options: ORIENT },
    ...organizationFields(),
    { name: 'photos', label: 'Photos', widget: 'pgk-gallery', required: false, default: [], ...projectMedia, hint: `Choose several photos at once, then describe each one. Use the arrows to change the order. Photos already on the site for this project are in the Photos section. ${imageHint}` },
    { name: 'films', label: 'Films from the library', widget: 'relation', collection: 'films', search_fields: ['title', 'location'], value_field: '{{slug}}', display_fields: ['title', 'location'], multiple: true, required: false, hint: 'Choose films that are already on the site. New films need the video upload step (see the guide).' },
    // James, Oct 2 2026: media he adds himself is approved, so the rights question is not in the routine form. New
    // records are saved as approved; existing records keep whatever they already hold (a hidden field never rewrites
    // a stored value), so historic pending items stay pending and still cannot be published by accident.
    { name: 'rights', label: 'rights', widget: 'hidden', default: 'approved' },
    { name: 'rightsNote', label: 'rightsNote', widget: 'hidden', required: false },
    // Marks a project used only to try out the dashboard (James's “Test”): review builds show it with a note, production never builds it.
    { name: 'reviewOnly', label: 'reviewOnly', widget: 'hidden', required: false },
    { name: 'sortPriority', label: 'Gallery placement', widget: 'pgk-placement', required: false, default: 0, hint: 'Raises the project’s new photos in the Home and service galleries.' },
    { name: 'order', label: 'Project list order', widget: 'pgk-placement', direction: 'ascending', required: false, hint: 'Earlier in project lists and when gallery priorities tie. This does not change the separate gallery priority.' },
  ];
  const projectShown = new Set(projectFields.map((f) => f.name));

  // ---------- Photos and films (one file per item in content/media) ----------
  const mediaCommon = [
    { name: 'title', label: 'Title', widget: 'string', hint: 'For your reference and the gallery label.' },
    { name: 'published', label: 'Show on site', widget: 'pgk-visibility', default: false, hint: 'Off = Hidden draft. On = Show on site after Save, validation and a successful website update. The status at the bottom confirms the website update.' },
    { name: 'project', label: 'Project', widget: 'relation', collection: 'projects', search_fields: ['title'], value_field: '{{slug}}', display_fields: ['title'], required: false, hint: 'Optional: the project page this belongs to.' },
    ...organizationFields(),
    { name: 'category', label: 'Service page', widget: 'select', options: workCats },
    { name: 'service', label: 'Type of work', widget: 'select', multiple: true, options: services },
    { name: 'location', label: 'Town or area', widget: 'string', required: false, hint: hint.location },
    { name: 'client', label: 'Client name shown', widget: 'string', required: false },
    { name: 'sortPriority', label: 'Gallery placement', widget: 'pgk-placement', default: 0, hint: 'Higher numbers move it up in the Home Selected Work and service galleries.' },
    { name: 'featured', label: 'Featured work & ordering', widget: 'pgk-featured', required: false, default: false },
  ];
  const photoFields = [
    { name: 'type', label: 'type', widget: 'hidden', default: 'image' },
    ...mediaCommon.slice(0, 2),
    { name: 'src', label: 'Photo', widget: 'pgk-photo', media_folder: '/static/images/library', public_folder: '/images/library', hint: `Replacing the file keeps the same place on the site. ${imageHint}` },
    { name: 'alt', label: 'Description (alt text)', widget: 'string', hint: hint.alt },
    { name: 'caption', label: 'Visible caption (optional)', widget: 'string', required: false, pattern: max(300, 'caption'), hint: hint.caption },
    { name: 'focal', label: 'Focus', widget: 'select', required: false, default: 'center', options: FOCAL, hint: hint.focal },
    { name: 'orientation', label: 'Shape', widget: 'select', default: 'horizontal', options: ORIENT.slice(1) },
    ...mediaCommon.slice(2),
    { name: 'rights', label: 'rights', widget: 'hidden', default: 'approved' },
    { name: '_rights', label: '_rights', widget: 'hidden', required: false },
    { name: 'packageIds', label: 'packageIds', widget: 'hidden', default: [] },
    { name: 'capturedYear', label: 'capturedYear', widget: 'hidden', default: null },
    { name: 'source', label: 'source', widget: 'hidden', default: 'upload' },
  ];
  // Films: the video files and their captions are managed on the review path; here only how they are shown.
  // Films. New ones come from Google Drive (James, Oct 13 2026): paste the Drive link and save; the import step
  // (.github/workflows/film-import.yml → scripts/import-films.mjs) makes the web copies the site serves, the poster and
  // the card poster, and marks the film ready. The original stays in Drive. Existing films keep their files.
  const filmFields = [
    { name: 'type', label: 'type', widget: 'hidden', default: 'video' },
    ...mediaCommon.slice(0, 2),
    { name: 'import', label: 'Import status & preview', widget: 'pgk-film-status', required: false },
    { name: 'drive', label: 'Google Drive link (new films)', widget: 'pgk-drive', required: false, pattern: ['^(https://drive\\.google\\.com/(file/d/|open\\?id=|uc\\?id=)[\\w-]{20,}[^\\s]*)?$', 'Paste the link of the film file in Google Drive (drive.google.com/file/d/…), not a folder'], hint: 'In Drive: right-click the finished film → Share → Copy link. It must be shared “Anyone with the link can view” (the dashboard never changes sharing). Under 200 MB. Leave empty for films already on the site.' },
    { name: 'makeLoop', label: 'Also make a playing excerpt (new films)', widget: 'boolean', required: false, hint: 'A muted excerpt of up to 25 seconds, so the film can also be a playing example in Page Media sections.' },
    { name: 'alt', label: 'Description of the film', widget: 'string', required: false, hint: 'What the film shows, for screen readers.' },
    { name: 'posterTime', label: 'Poster frame (seconds into the film)', widget: 'number', value_type: 'int', required: false, default: 3, hint: 'The still shown before the film plays.' },
    { name: 'dialogue', label: 'Does the film have speech?', widget: 'boolean', required: false, default: true, hint: 'Films with speech need captions before the live site can launch.' },
    { name: 'captions', label: 'Captions', widget: 'pgk-captions', required: false, media_folder: '/static/captions', public_folder: '/captions' },
    { name: 'captionsStatus', label: 'Captions approved', widget: 'select', required: false, default: 'machine-draft', options: [{ label: 'Draft: not approved yet (for example machine captions)', value: 'machine-draft' }, { label: 'Approved by James', value: 'approved' }], hint: 'Burned-in captions and caption files both show with the sound off. A caption file is shown by default on the site.' },
    ...mediaCommon.slice(2).map((f) => f.name === 'service' ? { ...f, default: ['video'] } : f),
    { name: 'rights', label: 'rights', widget: 'hidden', default: 'approved' },
    { name: 'packageIds', label: 'packageIds', widget: 'hidden', default: [] },
    { name: 'capturedYear', label: 'capturedYear', widget: 'hidden', default: null },
    { name: 'source', label: 'source', widget: 'hidden', default: 'drive' },
  ];
  const photoShown = new Set(photoFields.map((f) => f.name));
  const filmShown = new Set(filmFields.map((f) => f.name));
  const photos = fileMedia.filter((m) => m.type === 'image');
  const films = [...fileMedia.filter((m) => m.type === 'video'), ...(work.importing || [])];
  const catFilters = workCats.map((c) => ({ label: c.label, field: 'category', pattern: `^${c.value}$` }));

  const pageFields = (route, label, extra = []) => ({ name: route, label, widget: 'object', collapsed: true, fields: [
    { name: 'eyebrow', label: 'Small label above the heading', widget: 'string', pattern: max(60, 'label') },
    { name: 'title', label: 'Heading', widget: 'string', pattern: max(70, 'heading'), hint: 'Plain text.' },
    { name: 'titleEm', label: 'Highlighted ending of the heading (italic)', widget: 'string', required: false, pattern: max(50, 'highlighted ending'), hint: 'Shown in italics after the heading, e.g. “how you work.”' },
    { name: 'lede', label: 'Intro paragraph', widget: 'text', pattern: max(360, 'intro') },
    ...extra,
  ] });

  const config = {
    load_config_file: false,
    backend: {
      name: 'github', repo, branch, base_url: site.cmsAuthOrigin || undefined, auth_endpoint: 'api/cms-auth',
      commit_messages: { create: '{{collection}}: create “{{slug}}” (dashboard)', update: '{{collection}}: update “{{slug}}” (dashboard)', delete: '{{collection}}: delete “{{slug}}” (dashboard)', uploadMedia: 'Dashboard: upload {{path}}', deleteMedia: 'Dashboard: delete {{path}}' },
    },
    local_backend: true,
    site_url: site.canonicalOrigin,
    display_url: site.canonicalOrigin,
    logo_url: site.media.logo,
    media_folder: 'static/images/library',
    public_folder: '/images/library',
    slug: { encoding: 'ascii', clean_accents: true, sanitize_replacement: '-' },
    collections: [
      {
        name: 'projects', label: 'Projects', label_singular: 'Project',
        description: 'Portfolio projects for every service. Choose Show on site when the photos are described and the project is ready to show.',
        folder: 'content/projects', create: true, delete: false, extension: 'json', format: 'json',
        slug: '{{slug}}', identifier_field: 'title', media_folder: '/static/images/projects', public_folder: '/images/projects',
        summary: "{{title}} · {{published | ternary('Show requested', 'Hidden draft')}}",
        sortable_fields: ['order', 'title', 'category'],
        view_filters: [{ label: 'Drafts', field: 'published', pattern: false }, { label: 'Show on site', field: 'published', pattern: true }, ...catFilters],
        view_groups: [{ label: 'Service', field: 'category' }],
        preview_path: '{{fields.category}}/{{slug}}',
        fields: [...arrange(projectFields, [
          ['details', 'Project Details', ['title', 'category', 'shortTitle', 'client', 'location', 'services', 'segments']],
          ['story', 'Story & Description', ['summary', 'story', 'serviceDetails', 'goal', 'blurbApproved']],
          ['media', 'Photography & Films', ['hero', 'heroAlt', 'heroCaption', 'heroFocal', 'heroOrientation', 'photos', 'films']],
          ['organization', 'Organize uploaded photos', ['libraryFolder', 'tags'], 'Applies to all photos uploaded in this project, including a batch upload. Existing library items keep their own organization.'],
          ['display', 'Display & Publishing', ['published', 'sortPriority', 'order']],
          ['advanced', 'Advanced', [], 'Rights and file metadata are preserved automatically. Use the checked panel below for usage, deletion and recovery.'],
        ]), ...keep(work.projects, projectShown), MANAGE],
      },
      {
        name: 'photos', label: 'Photos', label_singular: 'Photo',
        description: 'Organize photos with Library folder and Tags. Use Group by → Library folder or Filter → Tag to find them. Service page controls website placement; folders and tags only organize the library. For a batch, use Projects → Photos and set its folder and tags once. Photos uploaded inside a Project are edited there and are available in the library pickers.',
        folder: 'content/media', filter: { field: 'type', value: 'image' }, create: true, delete: false, extension: 'json', format: 'json',
        slug: '{{slug}}', identifier_field: 'title', media_folder: '/static/images/library', public_folder: '/images/library',
        summary: "{{title}} · {{published | ternary('Shown', 'Hidden')}}",
        sortable_fields: ['title', 'libraryFolder', 'category', 'sortPriority'],
        view_filters: [{ label: 'Shown', field: 'published', pattern: true }, { label: 'Hidden', field: 'published', pattern: false }, ...catFilters, { label: 'Drone photos', field: 'service', pattern: 'drone' }, ...tagFilters],
        view_groups: [{ label: 'Library folder', field: 'libraryFolder' }, { label: 'Service', field: 'category' }, { label: 'Shown or hidden', field: 'published' }],
        fields: [...arrange(photoFields, [
          ['photo', 'Photo & Description', ['title', 'src', 'alt', 'category', 'published']],
          ['organization', 'Organize in the library', ['libraryFolder', 'tags']],
          ['presentation', 'Presentation', ['caption', 'focal', 'orientation']],
          ['placement', 'Gallery Placement', ['project', 'service', 'location', 'client', 'sortPriority', 'featured']],
          ['advanced', 'Advanced', [], 'Existing rights and source metadata are kept automatically.'],
        ]), ...keep(photos, photoShown), MANAGE],
      },
      {
        name: 'films', label: 'Films', label_singular: 'Film',
        description: 'Every film in the library. Add a film from Google Drive with “New Film” (the original stays in your Drive), change how a film is shown, hide it, or delete it for good.',
        folder: 'content/media', filter: { field: 'type', value: 'video' }, create: true, delete: false, extension: 'json', format: 'json',
        slug: '{{slug}}', identifier_field: 'title', summary: "{{title}} · {{published | ternary('Shown', 'Hidden')}}",
        sortable_fields: ['title', 'libraryFolder', 'category', 'sortPriority'],
        view_filters: [{ label: 'Shown', field: 'published', pattern: true }, { label: 'Hidden', field: 'published', pattern: false }, ...catFilters, ...tagFilters],
        view_groups: [{ label: 'Library folder', field: 'libraryFolder' }, { label: 'Service', field: 'category' }, { label: 'Shown or hidden', field: 'published' }],
        fields: [...arrange(filmFields, [
          ['film', 'Add or update a film', ['title', 'drive', 'category', 'import', 'published'], 'Title → Drive link → service → Save as a hidden draft. Wait for Ready, then choose Show on site and Save. Website updated confirms deployment, not just a saved switch.'],
          ['organization', 'Organize in the library', ['libraryFolder', 'tags']],
          ['presentation', 'Presentation', ['makeLoop', 'posterTime']],
          ['access', 'Captions & Accessibility', ['alt', 'dialogue', 'captions', 'captionsStatus']],
          ['placement', 'Gallery Placement', ['project', 'service', 'location', 'client', 'sortPriority', 'featured']],
          ['advanced', 'Advanced', [], 'Existing rights, source and file metadata are kept automatically. Replace or retry through Import status above.'],
        ]), ...keep(films, filmShown), MANAGE],
      },
      {
        name: 'page-text', label: 'Page text', label_singular: 'Page text', delete: false,
        description: 'The heading and intro at the top of each main page. Pictures and films are in Page Media. Layout, buttons, prices and booking links are not changed here.',
        files: [{
          name: 'pages', label: 'Page headings and intros', file: 'content/pages.json',
          fields: [
            { name: '_readme', label: '_readme', widget: 'hidden' },
            { name: 'pages', label: 'Pages', widget: 'object', fields: [
              pageFields('/', 'Home'), pageFields('/real-estate', 'Real Estate'), pageFields('/agent-content', 'Agent Content'),
              pageFields('/architecture-design', 'Architecture & Design'), pageFields('/commercial', 'Commercial'),
              pageFields('/agency-partnerships', 'Agency Partnerships'),
              pageFields('/creator-studios', 'LI Creator Studios'), pageFields('/about', 'About'),
            ] },
          ],
        }],
      },
      {
        name: 'testimonials', label: 'Testimonials', delete: false,
        description: 'Client reviews on the About page. Quotes must be word for word from the client (Google review or written approval).',
        files: [{
          name: 'testimonials', label: 'Client reviews', file: 'content/testimonials.json',
          fields: [
            { name: '_readme', label: '_readme', widget: 'hidden' }, { name: 'google', label: 'google', widget: 'hidden' }, { name: 'video', label: 'video', widget: 'hidden' },
            { name: 'reviews', label: 'Reviews', label_singular: 'review', widget: 'list', summary: '{{fields.name}}', fields: [
              { name: 'name', label: 'Name', widget: 'string' },
              { name: 'org', label: 'Company / role', widget: 'string', required: false },
              { name: 'source', label: 'Source', widget: 'select', options: [{ label: 'Google review', value: 'google' }, { label: 'Website testimonial / written approval', value: 'site' }] },
              { name: 'quote', label: 'Quote (word for word)', widget: 'text', hint: 'Copy it exactly. Shorten only with “…”.' },
              { name: 'excerpt', label: 'Short version for the Home page (optional)', widget: 'text', required: false, hint: 'Only words from the quote, in the same order, with “…” where words are left out. The full quote stays on About.' },
              { name: 'featured', label: 'Display on About', widget: 'pgk-review-display', required: false, hint: 'Keep in reserve or show on About. Earlier/later changes the order among displayed reviews; quotes and approvals stay unchanged.' },
              { name: 'approval', label: 'approval', widget: 'hidden', default: 'approved' },
              { name: 'id', label: 'id', widget: 'hidden', required: false },
              ...keep(testimonials.reviews || [], new Set(['name', 'org', 'source', 'quote', 'excerpt', 'featured', 'approval', 'id'])),
            ] },
          ],
        }],
      },
      {
        name: 'faqs', label: 'FAQs', delete: false,
        description: 'General questions and answers. Answers about cancellations, rescheduling, refunds, sharing or licensing are kept with the policies and are not edited here.',
        files: [{
          name: 'faqs', label: 'Real Estate “Good to know”', file: 'content/faqs.json',
          fields: [
            { name: '_readme', label: '_readme', widget: 'hidden' },
            { name: 'real-estate', label: 'Questions', label_singular: 'question', widget: 'list', summary: '{{fields.q}}', fields: [
              { name: 'q', label: 'Question', widget: 'string' },
              { name: 'a', label: 'Answer', widget: 'text', hint: 'Do not state cancellation, refund or licensing terms here; those come from the policies.' },
              { name: 'approval', label: 'approval', widget: 'hidden', default: 'approved' },
              { name: 'approvedBy', label: 'approvedBy', widget: 'hidden', required: false },
            ] },
          ],
        }],
      },
      {
        name: 'field-notes', label: 'Field Notes', label_singular: 'Field Note',
        description: 'Articles for photografikstudios.com/field-notes. Choose “Show on site” only when the article is ready: drafts stay off the site, the Field Notes list and the sitemap.',
        folder: 'content/field-notes', create: true, delete: false, extension: 'md', format: 'json-frontmatter',
        media_folder: '/static/images/field-notes', public_folder: '/images/field-notes',
        slug: '{{slug}}', identifier_field: 'title', summary: "{{title}} · {{date}} · {{published | ternary('Show requested', 'Hidden draft')}}",
        sortable_fields: ['date', 'title', 'category'], view_filters: [{ label: 'Drafts', field: 'published', pattern: false }, { label: 'Show on site', field: 'published', pattern: true }],
        preview_path: 'field-notes/{{slug}}',
        fields: arrange([
          { name: 'title', label: 'Title', widget: 'string', pattern: max(110, 'title') },
          { name: 'published', label: 'Show on site', widget: 'pgk-visibility', default: false, required: false, hint: 'Off = draft. Drafts are saved to the site files but never shown publicly.' },
          { name: 'date', label: 'Publish date', ...date, default: '{{now}}' },
          { name: 'updated', label: 'Updated date', ...date, required: false, hint: 'Only if you revise a published article.' },
          { name: 'category', label: 'Category', widget: 'select', options: cats },
          { name: 'excerpt', label: 'Short excerpt', widget: 'text', hint: 'One or two sentences for the Field Notes list.', pattern: max(220, 'excerpt') },
          { name: 'hero', label: 'Hero image', widget: 'pgk-photo', ...notesMedia, hint: 'A web JPG or WebP about 2,400 pixels wide is plenty (5 MB limit). The site makes smaller sizes automatically.' },
          { name: 'heroAlt', label: 'Hero image description (alt text)', widget: 'string', hint: 'Describe the picture for people who cannot see it, e.g. “Kitchen with an island and pendant lights”.' },
          { name: 'answer', label: 'Short answer under the title', widget: 'text', required: false, hint: 'Optional. The direct answer in two or three sentences. If empty, the excerpt is shown.' },
          { name: 'body', label: 'Article', widget: 'markdown', modes: ['rich_text', 'raw'], buttons: ['bold', 'italic', 'link', 'heading-two', 'heading-three', 'quote', 'bulleted-list', 'numbered-list'], editor_components: ['image', 'libraryMedia'], hint: 'Use Heading 2 for each section. Quote = a highlighted note. Add pictures with the + button.' },
          { name: 'photos', label: 'Photo gallery (optional)', widget: 'pgk-gallery', required: false, default: [], ...notesMedia, hint: 'Choose several photos at once; each needs a short description. They appear as a gallery after the article text.' },
          { name: 'seoTitle', label: 'SEO title', widget: 'string', required: false, pattern: max(70, 'SEO title'), hint: 'Optional. Defaults to the title.' },
          { name: 'seoDescription', label: 'Meta description', widget: 'text', required: false, pattern: max(160, 'meta description'), hint: 'Optional. Defaults to the excerpt.' },
          { name: 'ogImage', label: 'Social sharing image', widget: 'pgk-photo', required: false, ...notesMedia, hint: 'Optional. Defaults to the hero image.' },
          { name: 'slug', label: 'URL name', widget: 'string', required: false, pattern: ['^([a-z0-9]+(-[a-z0-9]+)*)?$', 'Lowercase letters, numbers and single hyphens only'], hint: 'Optional. Leave empty to use the title. Do not change it after publishing.' },
          { name: 'author', label: 'Author', widget: 'string', required: false, default: 'Photografik Studios' },
          { name: 'featured', label: 'Featured work & ordering', widget: 'pgk-featured', required: false, default: false },
          { name: 'relatedService', label: 'Related service', widget: 'select', required: false, options: servicePages },
          { name: 'cta', label: 'Call to action at the end', widget: 'object', required: false, collapsed: true, fields: [
            { name: 'label', label: 'Button text', widget: 'string', default: 'Send a Project Brief' },
            { name: 'href', label: 'Button goes to', widget: 'select', options: servicePages, default: '/contact' },
            { name: 'lead', label: 'Line above the button', widget: 'string', required: false },
          ] },
          { name: 'approvedBy', label: 'Approved by', widget: 'hidden', required: false },
          { name: 'legacyUrls', label: 'Old site addresses', widget: 'hidden', required: false },
          { name: 'sources', label: 'Sources', widget: 'hidden', required: false },
          MANAGE,
        ], [
          ['writing', 'Writing', ['title', 'category', 'hero', 'heroAlt', 'excerpt', 'answer', 'body', 'photos']],
          ['publishing', 'Publishing', ['published', 'date', 'updated', 'featured']],
          ['related', 'Related content', ['relatedService', 'cta']],
          ['seo', 'SEO (optional)', ['seoTitle', 'seoDescription', 'ogImage']],
          ['advanced', 'Advanced', ['slug', 'author', '_manage'], 'Keep an existing URL name. A published URL move needs a reviewed redirect.'],
        ]),
      },
    ],
  };
  // Page Media (James, Oct 13 2026): every named photo and video section of the site's own pages, one entry per page.
  // Each section is a pgk-slot widget (src/admin/cms.js) that knows what it accepts; the build checks the same rules.
  config.collections.splice(3, 0, {
    name: 'page-media', label: 'Page Media', label_singular: 'page', delete: false,
    description: 'The photos and films in each section of the site’s pages. Choose from the library, upload a photo, change the order, or take an item off a page. Taking something off a page never deletes it from the library.',
    files: PAGE_MEDIA.map((pg) => ({
      name: pg.file, label: pg.label, file: `content/page-media/${pg.file}.json`,
      fields: [
        { name: '_about', label: 'About this page', widget: 'pgk-page-note', required: false, pageLabel: pg.label, route: pg.route, automatic: pg.automatic || [] },
        ...pg.slots.map((sl) => ({
          name: sl.key, label: sl.label, widget: isGallery(sl) ? 'pgk-gallery-slot' : 'pgk-slot', required: false, accepts: sl.accepts, kind: KINDS[sl.accepts],
          pageLabel: pg.label, sectionLabel: sl.label, device: sl.accepts === 'heroLoop' ? 'Desktop: muted film; phone: still fallback (motion depends on device and reduced-motion settings).' : 'Desktop and mobile; layout and crop adapt to the screen.', galleryKey: `${pg.file}.${sl.key}`, auto: sl.auto || '',
          multiple: !!sl.list, min: sl.list ? sl.list.min : sl.required ? 1 : 0, max: sl.list ? sl.list.max : 1, mustHave: !!sl.required,
          labelled: !!sl.labelled, altMode: sl.alt || 'library', empty: sl.empty || '', route: pg.route,
          media_folder: '/static/images/library', public_folder: '/images/library',
          hint: sl.empty ? `Optional. When empty: ${sl.empty}` : undefined,
        })),
      ],
    })),
  });
  return { config, library, categories: cats };
}
