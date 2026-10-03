// Decap CMS configuration for the owner dashboard (/admin). Generated at build time so the category lists, the
// library pickers and the Git branch always match the content being deployed.
// Sections: Projects, Photos, Films, Page text, Testimonials, FAQs, Field Notes. Pricing, legal policies, booking
// links and page layout are deliberately not editable here (they stay on the reviewed code path).
// Every field a record already has is declared (unknown ones as hidden fields), so saving a form never drops data.

const max = (n, what) => [`^[\\s\\S]{0,${n}}$`, `Keep the ${what} to ${n} characters or fewer`];
const date = { widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: false, picker_utc: true };
const FOCAL = [
  { label: 'Centre (default)', value: 'center' }, { label: 'Top', value: 'top' }, { label: 'Upper third (faces, ceilings)', value: 'upper-third' },
  { label: 'Bottom', value: 'bottom' }, { label: 'Left', value: 'left' }, { label: 'Right', value: 'right' },
];
const ORIENT = [{ label: 'Work it out from the file', value: 'auto' }, { label: 'Landscape', value: 'horizontal' }, { label: 'Portrait', value: 'vertical' }];
const hint = {
  published: 'Off = draft. A draft is saved and shows on the preview with a Draft note, but the live site, its galleries and the sitemap leave it out.',
  alt: 'Describe the picture for people who cannot see it, e.g. “Kitchen with a marble island and brass pendant lights”. No street addresses.',
  location: 'Town or area only (e.g. “Amagansett”). Never a street address.',
  focal: 'Which part of the photo must stay in view when a card crops it.',
};

/** Hidden fields for every key the records have that the form does not show, so saving keeps them. */
function keep(records, shown) {
  const keys = new Set();
  for (const r of records) for (const k of Object.keys(r)) if (!shown.has(k)) keys.add(k);
  return [...keys].sort().map((k) => ({ name: k, label: k, widget: 'hidden', required: false }));
}

export function cmsConfig({ site, fieldNotes, work, branch, repo, testimonials = { reviews: [] } }) {
  const cats = fieldNotes.categories.map((c) => ({ label: c.label, value: c.id }));
  const workCats = work.taxonomy.category.map((c) => ({ label: c.label, value: c.id }));
  const services = work.taxonomy.service.map((c) => ({ label: c.label, value: c.id }));
  const segments = (work.taxonomy.segment || []).map((c) => ({ label: c.label, value: c.id }));
  const fileMedia = work.media.filter((m) => !m.fromProject);
  // Only media the site shows (no drafts, no review-only test photos): this list is in the public /admin/config.js.
  const testOnly = new Set(work.projects.filter((p) => p.reviewOnly === true).map((p) => p.slug));
  const library = work.media.filter((m) => m.rights === 'approved' && m.published !== false && !testOnly.has(m.project) && (m.type === 'image' || m.poster))
    .map((m) => ({ label: `${m.title}${m.location ? `, ${m.location}` : ''} (${m.type === 'video' ? 'film' : 'photo'})`, value: m.id, image: m.type === 'video' ? m.poster : m.src }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const servicePages = [
    ['Real Estate', '/real-estate'], ['Real Estate pricing', '/real-estate/pricing'], ['Agent Content', '/agent-content'],
    ['Architecture & Design', '/architecture-design'], ['Commercial', '/commercial'], ['Agency Partnerships', '/agency-partnerships'],
    ['LI Creator Studios', '/creator-studios'], ['Send a Project Brief (contact)', '/contact'],
  ].map(([label, value]) => ({ label, value }));
  const upload = { media_library: { config: { max_file_size: 5000000 } } };
  // Our own upload widgets (src/admin/cms.js) save into the same folders as before; the paths are stated per field.
  const projectMedia = { media_folder: '/static/images/projects', public_folder: '/images/projects' };
  const notesMedia = { media_folder: '/static/images/field-notes', public_folder: '/images/field-notes' };
  const imageHint = 'A web JPG or WebP, 2,000–2,400 px on the long side (5 MB limit). Name the file after the client or subject, never the street address. The site makes the smaller sizes automatically.';

  // ---------- Projects ----------
  const projectFields = [
    { name: 'title', label: 'Project name', widget: 'string', pattern: max(80, 'name'), hint: 'Usually the client, builder or designer, e.g. “Yankee Barn Builders”. No street addresses.' },
    { name: 'published', label: 'Published', widget: 'pgk-publish', default: false, required: false, hint: hint.published },
    { name: 'category', label: 'Service', widget: 'select', options: workCats, hint: 'Which service page and gallery the project belongs to. Do not change it after publishing (the web address depends on it).' },
    { name: 'shortTitle', label: 'Short name for cards', widget: 'string', required: false, pattern: max(40, 'short name') },
    { name: 'client', label: 'Client name shown', widget: 'string', required: false, hint: 'Leave empty if the client has not agreed to be named.' },
    { name: 'location', label: 'Town or area', widget: 'string', required: false, hint: hint.location },
    { name: 'segments', label: 'Disciplines (Architecture & Design filters)', widget: 'select', multiple: true, required: false, options: segments, hint: 'Only for Architecture & Design: who the work was for (architect, builder, designer…).' },
    { name: 'segmentSource', label: 'segmentSource', widget: 'hidden', required: false },
    { name: 'services', label: 'Services delivered', widget: 'list', required: false, field: { name: 'service', label: 'Service', widget: 'string' }, hint: 'Shown on the project page, e.g. “Project photography”, “Architecture film”.' },
    { name: 'summary', label: 'Short description', widget: 'text', required: false, pattern: max(200, 'description'), hint: 'One sentence for cards and search results.' },
    { name: 'story', label: 'Story / goal', widget: 'text', required: false, pattern: max(700, 'story'), hint: 'The paragraph under the project name: what the work was for and how it was planned.' },
    { name: 'goal', label: 'Goal (Commercial only)', widget: 'text', required: false },
    { name: 'blurbApproved', label: 'Client approved this wording (Commercial only)', widget: 'boolean', required: false, hint: 'Commercial project texts show only after the client has approved them.' },
    { name: 'delivered', label: 'What was delivered (Commercial only)', widget: 'list', required: false, field: { name: 'item', label: 'Item', widget: 'string' } },
    { name: 'hero', label: 'Main image', widget: 'pgk-photo', required: false, ...projectMedia, hint: `Optional: without one, the first photo or film below leads the page. ${imageHint}` },
    { name: 'heroAlt', label: 'Main image description (alt text)', widget: 'string', required: false, hint: hint.alt },
    { name: 'heroFocal', label: 'Main image focus', widget: 'select', required: false, default: 'center', options: FOCAL, hint: hint.focal },
    { name: 'heroOrientation', label: 'Main image shape', widget: 'select', required: false, default: 'auto', options: ORIENT },
    { name: 'photos', label: 'Photos', widget: 'pgk-gallery', required: false, default: [], ...projectMedia, hint: `Choose several photos at once, then describe each one. Use the arrows to change the order. Photos already on the site for this project are in the Photos section. ${imageHint}` },
    { name: 'films', label: 'Films from the library', widget: 'relation', collection: 'films', search_fields: ['title', 'location'], value_field: '{{slug}}', display_fields: ['title', 'location'], multiple: true, required: false, hint: 'Choose films that are already on the site. New films need the video upload step (see the guide).' },
    // James, Oct 2 2026: media he adds himself is approved, so the rights question is not in the routine form. New
    // records are saved as approved; existing records keep whatever they already hold (a hidden field never rewrites
    // a stored value), so historic pending items stay pending and still cannot be published by accident.
    { name: 'rights', label: 'rights', widget: 'hidden', default: 'approved' },
    { name: 'rightsNote', label: 'rightsNote', widget: 'hidden', required: false },
    // Marks a project used only to try out the dashboard (James's “Test”): review builds show it with a note, production never builds it.
    { name: 'reviewOnly', label: 'reviewOnly', widget: 'hidden', required: false },
    { name: 'sortPriority', label: 'Show first (0 = normal, higher = earlier)', widget: 'number', value_type: 'int', required: false, default: 0, hint: 'Raises the project’s new photos in the Home and service galleries.' },
    { name: 'order', label: 'Position in project lists', widget: 'number', value_type: 'int', required: false, hint: 'Lower numbers come first (the original projects use 10, 20, 30…).' },
  ];
  const projectShown = new Set(projectFields.map((f) => f.name));

  // ---------- Photos and films (one file per item in content/media) ----------
  const mediaCommon = [
    { name: 'title', label: 'Title', widget: 'string', hint: 'For your reference and the gallery label.' },
    { name: 'published', label: 'Published', widget: 'boolean', default: false, hint: hint.published },
    { name: 'project', label: 'Project', widget: 'relation', collection: 'projects', search_fields: ['title'], value_field: '{{slug}}', display_fields: ['title'], required: false, hint: 'Optional: the project page this belongs to.' },
    { name: 'category', label: 'Service', widget: 'select', options: workCats },
    { name: 'service', label: 'Type of work', widget: 'select', multiple: true, options: services },
    { name: 'location', label: 'Town or area', widget: 'string', required: false, hint: hint.location },
    { name: 'client', label: 'Client name shown', widget: 'string', required: false },
    { name: 'sortPriority', label: 'Show first (0 = normal, higher = earlier)', widget: 'number', value_type: 'int', default: 0, hint: 'Higher numbers move it up in the Home Selected Work and service galleries.' },
    { name: 'featured', label: 'Featured', widget: 'boolean', required: false, default: false },
  ];
  const photoFields = [
    { name: 'type', label: 'type', widget: 'hidden', default: 'image' },
    ...mediaCommon.slice(0, 2),
    { name: 'src', label: 'Photo', widget: 'pgk-photo', media_folder: '/static/images/library', public_folder: '/images/library', hint: `Replacing the file keeps the same place on the site. ${imageHint}` },
    { name: 'alt', label: 'Description (alt text)', widget: 'string', hint: hint.alt },
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
  const filmFields = [
    ...mediaCommon.slice(0, 2),
    { name: 'alt', label: 'Description of the film', widget: 'string', required: false, hint: 'What the film shows, for screen readers.' },
    ...mediaCommon.slice(2),
  ];
  const photoShown = new Set(photoFields.map((f) => f.name));
  const filmShown = new Set(filmFields.map((f) => f.name));
  const photos = fileMedia.filter((m) => m.type === 'image');
  const films = fileMedia.filter((m) => m.type === 'video');

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
        description: 'Portfolio projects for every service. Switch on Published when the photos are described and the project is ready to show.',
        folder: 'content/projects', create: true, delete: false, extension: 'json', format: 'json',
        slug: '{{slug}}', identifier_field: 'title', media_folder: '/static/images/projects', public_folder: '/images/projects',
        summary: "{{title}} · {{category}} · {{published | ternary('Published', 'Draft')}}",
        sortable_fields: ['order', 'title', 'category'],
        view_filters: [{ label: 'Drafts', field: 'published', pattern: false }, { label: 'Published', field: 'published', pattern: true }],
        view_groups: [{ label: 'Service', field: 'category' }],
        preview_path: '{{fields.category}}/{{slug}}',
        fields: [...projectFields, ...keep(work.projects, projectShown)],
      },
      {
        name: 'photos', label: 'Photos', label_singular: 'Photo',
        description: 'Every photo in the galleries. Replace a picture, fix its description or focus, change where it shows, or hide it.',
        folder: 'content/media', filter: { field: 'type', value: 'image' }, create: true, delete: false, extension: 'json', format: 'json',
        slug: '{{slug}}', identifier_field: 'title', media_folder: '/static/images/library', public_folder: '/images/library',
        summary: "{{title}} · {{category}} · {{published | ternary('Published', 'Hidden')}}",
        sortable_fields: ['title', 'category', 'sortPriority'],
        view_filters: [{ label: 'Hidden', field: 'published', pattern: false }],
        view_groups: [{ label: 'Service', field: 'category' }],
        fields: [...photoFields, ...keep(photos, photoShown)],
      },
      {
        name: 'films', label: 'Films', label_singular: 'Film',
        description: 'Films already on the site. Change the title, description, project or order, or hide one. Adding a new film is a separate upload step.',
        folder: 'content/media', filter: { field: 'type', value: 'video' }, create: false, delete: false, extension: 'json', format: 'json',
        identifier_field: 'title', summary: "{{title}} · {{category}} · {{published | ternary('Published', 'Hidden')}}",
        sortable_fields: ['title', 'category', 'sortPriority'], view_groups: [{ label: 'Service', field: 'category' }],
        fields: [...filmFields, ...keep(films, filmShown)],
      },
      {
        name: 'page-text', label: 'Page text', label_singular: 'Page text', delete: false,
        description: 'The heading and intro at the top of each main page. Layout, buttons, prices and booking links are not changed here.',
        files: [{
          name: 'pages', label: 'Page headings and intros', file: 'content/pages.json',
          fields: [
            { name: '_readme', label: '_readme', widget: 'hidden' },
            { name: 'pages', label: 'Pages', widget: 'object', fields: [
              pageFields('/', 'Home'), pageFields('/real-estate', 'Real Estate'), pageFields('/agent-content', 'Agent Content'),
              pageFields('/architecture-design', 'Architecture & Design'), pageFields('/commercial', 'Commercial'),
              pageFields('/agency-partnerships', 'Agency Partnerships', [
                { name: 'image', label: 'Hero image', widget: 'pgk-photo', media_folder: '/static/images/library', public_folder: '/images/library', hint: imageHint },
                { name: 'imageAlt', label: 'Hero image description (alt text)', widget: 'string', hint: hint.alt },
              ]),
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
            { name: 'reviews', label: 'Reviews', label_singular: 'review', widget: 'list', summary: '{{fields.name}} · {{fields.featured}}', fields: [
              { name: 'name', label: 'Name', widget: 'string' },
              { name: 'org', label: 'Company / role', widget: 'string', required: false },
              { name: 'source', label: 'Source', widget: 'select', options: [{ label: 'Google review', value: 'google' }, { label: 'Website testimonial / written approval', value: 'site' }] },
              { name: 'quote', label: 'Quote (word for word)', widget: 'text', hint: 'Copy it exactly. Shorten only with “…”.' },
              { name: 'excerpt', label: 'Short version for the Home page (optional)', widget: 'text', required: false, hint: 'Only words from the quote, in the same order, with “…” where words are left out. The full quote stays on About.' },
              { name: 'featured', label: 'Show on About page, position', widget: 'number', value_type: 'int', required: false, hint: '1 = first. Leave empty to keep it in reserve (not shown).' },
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
        description: 'Articles for photografikstudios.com/field-notes. Switch on “Published” only when the article is ready: drafts stay off the site, the Field Notes list and the sitemap.',
        folder: 'content/field-notes', create: true, delete: true, extension: 'md', format: 'json-frontmatter',
        media_folder: '/static/images/field-notes', public_folder: '/images/field-notes',
        slug: '{{slug}}', identifier_field: 'title', summary: "{{title}} · {{date}} · {{published | ternary('Published', 'Draft')}}",
        sortable_fields: ['date', 'title', 'category'], view_filters: [{ label: 'Drafts', field: 'published', pattern: false }, { label: 'Published', field: 'published', pattern: true }],
        preview_path: 'field-notes/{{slug}}',
        fields: [
          { name: 'title', label: 'Title', widget: 'string', pattern: max(110, 'title') },
          { name: 'published', label: 'Published', widget: 'boolean', default: false, required: false, hint: 'Off = draft. Drafts are saved to the site files but never shown publicly.' },
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
          { name: 'featured', label: 'Featured', widget: 'boolean', required: false, default: false },
          { name: 'relatedService', label: 'Related service', widget: 'select', required: false, options: servicePages },
          { name: 'cta', label: 'Call to action at the end', widget: 'object', required: false, collapsed: true, fields: [
            { name: 'label', label: 'Button text', widget: 'string', default: 'Send a Project Brief' },
            { name: 'href', label: 'Button goes to', widget: 'select', options: servicePages, default: '/contact' },
            { name: 'lead', label: 'Line above the button', widget: 'string', required: false },
          ] },
          { name: 'approvedBy', label: 'Approved by', widget: 'hidden', required: false },
          { name: 'legacyUrls', label: 'Old site addresses', widget: 'hidden', required: false },
          { name: 'sources', label: 'Sources', widget: 'hidden', required: false },
        ],
      },
    ],
  };
  return { config, library, categories: cats };
}
