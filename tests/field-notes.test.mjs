import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { checkFieldNotes, validateFieldNotes, legacyLaunchBlockers, parseArticleFile, sortNewest } from '../src/lib/field-notes-core.js';
import { loadFieldNotes, makeFileExists } from '../src/lib/field-notes-load.js';
import { renderArticle, inline, bodyRefs } from '../src/lib/markdown.js';
import { cmsConfig } from '../src/lib/cms-config.js';
import { validateLegal, numberSections } from '../src/lib/legal-core.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url)));
const { fieldNotes: fn, parseErrors } = await loadFieldNotes(root);
const legacy = await read('../content/legacy-articles.json');
const work = await read('../content/work.json');
const vercel = await read('../vercel.json');
const media = await read('../content/media-assets.json');
const site = await read('../content/site.json');
const legal = await read('../content/legal.json');
const fileExists = makeFileExists(root, new Set(Object.keys(media.files)));

test('Field Notes collection is valid', () => {
  assert.deepEqual(parseErrors, []);
  const r = checkFieldNotes(fn, legacy, work, { fileExists });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('James approved exactly the three Day 1 articles (Sep 30 2026); they are published, unchanged in URL', () => {
  const pub = fn.articles.filter((a) => a.published);
  assert.deepEqual(pub.map((a) => a.slug).sort(), ['how-to-prepare-a-home-for-listing-photos', 'listing-video-horizontal-or-vertical', 'twilight-drone-floor-plans']);
  for (const a of pub) assert.ok(a.approvedBy && /James, Sep 30 2026/.test(a.approvedBy) && a.datePublished, a.slug);
});

test('no internal review note survives in an approved article', () => {
  for (const a of fn.articles) assert.ok(!/review before publishing|draft for review/i.test(a.body), a.slug);
});

test('articles sort newest first; same-day articles keep file order', () => {
  const list = sortNewest([{ slug: 'a', datePublished: '2026-01-01' }, { slug: 'b', datePublished: '2026-03-01' }, { slug: 'c', datePublished: '2026-03-01' }]);
  assert.deepEqual(list.map((x) => x.slug), ['b', 'c', 'a']);
});

test('a new CMS article parses from the JSON front matter Decap writes, with the file name as the URL', () => {
  const text = '{\n  "title": "New note",\n  "published": false,\n  "date": "2026-10-07",\n  "category": "commercial",\n  "excerpt": "Short.",\n  "hero": "/images/field-notes/x.jpg",\n  "heroAlt": "A room"\n}\n## First\n\nHello **there**.\n';
  const a = parseArticleFile(text, 'content/field-notes/new-note.md');
  assert.equal(a.slug, 'new-note');
  assert.equal(a.published, false);
  assert.equal(a.status, 'draft');
  assert.match(renderArticle(a.body).html, /<h2 class="h3" id="first">First<\/h2>[\s\S]*<strong>there<\/strong>/);
});

test('an incomplete draft only warns; the same problems on a published article fail the build', () => {
  const draft = { slug: 'half', file: 'half.md', published: false, title: '', category: 'nope', summary: '', datePublished: null, hero: '', body: '', legacyUrls: [] };
  const r1 = checkFieldNotes({ ...fn, articles: [...fn.articles, draft] }, legacy, work);
  assert.deepEqual(r1.errors, []);
  assert.ok(r1.warnings.length >= 4);
  const r2 = checkFieldNotes({ ...fn, articles: [...fn.articles, { ...draft, published: true }] }, legacy, work);
  assert.ok(r2.errors.length >= 4);
});

test('bad URL names and duplicates always fail', () => {
  const dup = { ...fn.articles[0], file: 'dup.md' };
  assert.ok(validateFieldNotes({ ...fn, articles: [...fn.articles, dup] }, legacy, work).some((e) => e.includes('already used')));
  assert.ok(validateFieldNotes({ ...fn, articles: [...fn.articles, { ...fn.articles[0], slug: 'Bad Slug', legacyUrls: [] }] }, legacy, work).some((e) => e.includes('URL name')));
});

test('uploaded images must be committed; outside image links are refused', () => {
  const a = { ...fn.articles[0], slug: 'img-test', legacyUrls: [], hero: '/images/field-notes/missing.jpg', body: '## A\n\n![Alt](https://example.com/x.jpg)' };
  const errs = validateFieldNotes({ ...fn, articles: [...fn.articles, a] }, legacy, work, { fileExists });
  assert.ok(errs.some((e) => e.includes('missing.jpg')) && errs.some((e) => e.includes('outside link')), errs.join('\n'));
});

test('Markdown is escaped and links are limited to safe schemes', () => {
  assert.equal(inline('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
  assert.ok(!inline('[x](javascript:alert(1))').includes('href'));
  assert.equal(inline('[Pricing](/real-estate/pricing)'), '<a href="/real-estate/pricing">Pricing</a>');
  assert.deepEqual(bodyRefs('::media[re-floorplan]\n\n![A](/images/field-notes/a.jpg "Cap")'), { images: ['/images/field-notes/a.jpg'], media: ['re-floorplan'] });
});

test('CMS config: Git-backed, own sign-in endpoint, drafts off by default, uploads into the repo', () => {
  const { config, categories } = cmsConfig({ site, fieldNotes: fn, work, branch: 'redesign/2027-preview', repo: 'photografikstudios/PS_website' });
  assert.equal(config.backend.name, 'github');
  assert.equal(config.backend.branch, 'redesign/2027-preview');
  assert.equal(config.backend.auth_endpoint, 'api/cms-auth');
  const c = config.collections[0];
  assert.equal(c.folder, 'content/field-notes');
  assert.equal(c.format, 'json-frontmatter');
  assert.equal(c.fields.find((f) => f.name === 'published').default, false);
  assert.equal(config.media_folder, 'static/images/field-notes');
  assert.deepEqual(categories.map((x) => x.label), ['Real Estate', 'Architecture & Design', 'Commercial', 'Agent Content', 'Production / Behind the Scenes']);
  for (const name of ['title', 'slug', 'date', 'category', 'excerpt', 'hero', 'heroAlt', 'body', 'published', 'seoTitle', 'seoDescription', 'ogImage', 'author', 'featured', 'relatedService', 'cta', 'updated']) assert.ok(c.fields.some((f) => f.name === name), name);
});

test('legal pages: Photografik general policies first, Creator supplement last, no text invented', () => {
  assert.deepEqual(validateLegal(legal), []);
  assert.equal(legal.effectiveDate, '2026-09-30');
  for (const page of Object.values(legal.pages)) {
    assert.deepEqual(page.groups.map((g) => g.id), ['general', 'creator']);
    const nums = numberSections(page).flatMap((g) => g.sections.map((s) => s.n));
    assert.deepEqual(nums, nums.map((_, i) => i + 1));
  }
  assert.equal(legal.pages.licensing.groups[0].sections.length, 15);
  if (!legal.ready) for (const page of Object.values(legal.pages)) for (const g of page.groups) for (const s of g.sections) assert.equal(s.blocks.length, 0, `${s.title} has text before the source document arrived`);
  assert.ok(validateLegal({ ...legal, ready: true }).length > 0, 'ready cannot be set without the text and checksum');
});

test('every legacy article URL has exactly one redirect, matching the inventory', () => {
  const redirects = vercel.redirects.filter((r) => r.source.startsWith('/articles') || ['/blog-1', '/insights'].includes(r.source));
  assert.equal(redirects.length, legacy.items.length);
  for (const row of legacy.items) {
    const r = redirects.filter((x) => x.source === row.from);
    assert.equal(r.length, 1, row.from);
    if (row.status === 'index' || row.status === 'mapped') assert.equal(r[0].destination, row.target, row.from);
    // Never send a specific article to Home.
    if (row.status !== 'index') assert.notEqual(r[0].destination, '/', row.from);
  }
});

test('mapped legacy articles land on their own refreshed article, not a loosely related page', () => {
  for (const row of legacy.items.filter((r) => r.status === 'mapped')) {
    const slug = row.target.replace('/field-notes/', '');
    assert.ok(fn.articles.find((a) => a.slug === slug).legacyUrls.includes(row.from));
  }
});

test('production launch stays blocked until every legacy URL has an approved destination', () => {
  const none = { articles: fn.articles.map((a) => ({ ...a, published: false })) };
  assert.equal(legacyLaunchBlockers(none, legacy).length, legacy.items.length);
  assert.ok(legacyLaunchBlockers(fn, legacy).length > 0, 'still blocked with the three Day 1 articles published');
  const approved = { articles: fn.articles.map((a) => ({ ...a, published: true })) };
  const decided = { items: legacy.items.map((r) => (r.status === 'decision' ? { ...r, approvedBy: 'James' } : r)) };
  const left = legacyLaunchBlockers(approved, decided);
  assert.ok(left.every((l) => l.includes('planned') || l.includes('title-only')), left.join('\n'));
});

test('a mapped redirect matched only by title keeps production blocked until its content is compared', () => {
  const titleOnly = legacy.items.filter((r) => r.status === 'mapped' && r.audit !== 'content-verified');
  assert.ok(titleOnly.length > 0, 'update this test once every mapped row is content-verified');
  const approved = { articles: fn.articles.map((a) => ({ ...a, published: true })) };
  const left = legacyLaunchBlockers(approved, legacy);
  for (const r of titleOnly) assert.ok(left.some((l) => l.startsWith(r.from)), r.from);
  const verified = legacy.items.filter((r) => r.status === 'mapped' && r.audit === 'content-verified');
  for (const r of verified) assert.ok(!left.some((l) => l.startsWith(r.from)), r.from);
});
