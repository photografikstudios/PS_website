// Decap CMS configuration for the Field Notes editor (/admin). Generated at build time so the category list,
// the Photografik library picker and the Git branch always match the content being deployed.
export function cmsConfig({ site, fieldNotes, work, branch, repo }) {
  const cats = fieldNotes.categories.map((c) => ({ label: c.label, value: c.id }));
  const library = work.media.filter((m) => m.rights === 'approved' && (m.type === 'image' || m.poster))
    .map((m) => ({ label: `${m.title}${m.location ? `, ${m.location}` : ''} (${m.type === 'video' ? 'film' : 'photo'})`, value: m.id, image: m.type === 'video' ? m.poster : m.src }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const services = [
    ['Real Estate', '/real-estate'], ['Real Estate pricing', '/real-estate/pricing'], ['Agent Content', '/agent-content'],
    ['Architecture & Design', '/architecture-design'], ['Commercial', '/commercial'], ['Agency Partnerships', '/agency-partnerships'],
    ['LI Creator Studios', '/creator-studios'], ['Send a Project Brief (contact)', '/contact'],
  ].map(([label, value]) => ({ label, value }));
  const max = (n, what) => [`^[\\s\\S]{0,${n}}$`, `Keep the ${what} to ${n} characters or fewer`];
  const upload = { media_library: { config: { max_file_size: 5000000 } } };
  const date = { widget: 'datetime', format: 'YYYY-MM-DD', date_format: 'YYYY-MM-DD', time_format: false, picker_utc: true };
  const config = {
    load_config_file: false,
    backend: { name: 'github', repo, branch, base_url: site.cmsAuthOrigin || undefined, auth_endpoint: 'api/cms-auth', commit_messages: { create: 'Field Notes: create “{{slug}}”', update: 'Field Notes: update “{{slug}}”', delete: 'Field Notes: delete “{{slug}}”', uploadMedia: 'Field Notes: upload image {{path}}', deleteMedia: 'Field Notes: delete image {{path}}' } },
    local_backend: true,
    site_url: site.canonicalOrigin,
    display_url: site.canonicalOrigin,
    logo_url: site.media.logo,
    media_folder: 'static/images/field-notes',
    public_folder: '/images/field-notes',
    slug: { encoding: 'ascii', clean_accents: true, sanitize_replacement: '-' },
    collections: [{
      name: 'field-notes', label: 'Field Notes', label_singular: 'Field Note',
      description: 'Articles for photografikstudios.com/field-notes. Switch on “Published” only when the article is ready: drafts stay off the site, the Field Notes list and the sitemap.',
      folder: 'content/field-notes', create: true, delete: true, extension: 'md', format: 'json-frontmatter',
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
        { name: 'hero', label: 'Hero image', widget: 'image', choose_url: false, ...upload, hint: 'A web JPG or WebP about 2,400 pixels wide is plenty (5 MB limit). The site makes smaller sizes automatically.' },
        { name: 'heroAlt', label: 'Hero image description (alt text)', widget: 'string', hint: 'Describe the picture for people who cannot see it, e.g. “Kitchen with an island and pendant lights”.' },
        { name: 'answer', label: 'Short answer under the title', widget: 'text', required: false, hint: 'Optional. The direct answer in two or three sentences. If empty, the excerpt is shown.' },
        { name: 'body', label: 'Article', widget: 'markdown', modes: ['rich_text', 'raw'], buttons: ['bold', 'italic', 'link', 'heading-two', 'heading-three', 'quote', 'bulleted-list', 'numbered-list'], editor_components: ['image', 'libraryMedia'], hint: 'Use Heading 2 for each section. Quote = a highlighted note. Add pictures with the + button.' },
        { name: 'seoTitle', label: 'SEO title', widget: 'string', required: false, pattern: max(70, 'SEO title'), hint: 'Optional. Defaults to the title.' },
        { name: 'seoDescription', label: 'Meta description', widget: 'text', required: false, pattern: max(160, 'meta description'), hint: 'Optional. Defaults to the excerpt.' },
        { name: 'ogImage', label: 'Social sharing image', widget: 'image', required: false, choose_url: false, ...upload, hint: 'Optional. Defaults to the hero image.' },
        { name: 'slug', label: 'URL name', widget: 'string', required: false, pattern: ['^([a-z0-9]+(-[a-z0-9]+)*)?$', 'Lowercase letters, numbers and single hyphens only'], hint: 'Optional. Leave empty to use the title. Do not change it after publishing.' },
        { name: 'author', label: 'Author', widget: 'string', required: false, default: 'Photografik Studios' },
        { name: 'featured', label: 'Featured', widget: 'boolean', required: false, default: false },
        { name: 'relatedService', label: 'Related service', widget: 'select', required: false, options: services },
        { name: 'cta', label: 'Call to action at the end', widget: 'object', required: false, collapsed: true, fields: [
          { name: 'label', label: 'Button text', widget: 'string', default: 'Send a Project Brief' },
          { name: 'href', label: 'Button goes to', widget: 'select', options: services, default: '/contact' },
          { name: 'lead', label: 'Line above the button', widget: 'string', required: false },
        ] },
        { name: 'approvedBy', label: 'Approved by', widget: 'hidden', required: false },
        { name: 'legacyUrls', label: 'Old site addresses', widget: 'hidden', required: false },
        { name: 'sources', label: 'Sources', widget: 'hidden', required: false },
      ],
    }],
  };
  return { config, library, categories: cats };
}
