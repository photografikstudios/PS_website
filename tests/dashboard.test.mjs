// Owner dashboard (/admin): content model, lossless split, form coverage, checks for drafts vs published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, cp } from 'node:fs/promises';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWork, expandProjectPhotos, slugify } from '../src/lib/work-load.js';
import { checkContent, looksLikeAddress, looksLikeCameraName, isVerbatimExcerpt, holdDashboardProjects, applyReviewOnly, dashboardStatus, statusId } from '../src/lib/content-check.js';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cmsConfig } from '../src/lib/cms-config.js';
import { createContext } from '../src/lib/html.js';
import { imageSize } from '../src/lib/image-size.js';
import { loadFieldNotes, makeFileExists } from '../src/lib/field-notes-load.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = async (p) => JSON.parse(await readFile(join(root, p), 'utf8'));
const work = await loadWork(root);
const site = await read('content/site.json');
const testimonials = await read('content/testimonials.json');
const pageText = await read('content/pages.json');
const faqs = await read('content/faqs.json');
const { fieldNotes } = await loadFieldNotes(root);
const fileExists = makeFileExists(root, new Set(Object.keys((await read('content/media-assets.json')).files)));
// A synthetic, published dashboard project (a copy of James's “Test” with its own name), added only to cloned data so
// these checks never depend on, or change, the Published switch James sets on his real Test project (Oct 13 2026).
const withSynthetic = (w) => {
  const base = w.projects.find((p) => p.slug === 'test');
  const qa = { ...structuredClone(base), slug: 'qa-synthetic', title: 'QA synthetic', published: true, reviewOnly: true };
  w.projects.push(qa);
  for (const m of expandProjectPhotos(root, qa)) w.media.push(m);
  return qa;
};

test('portfolio: original library plus the Oct 19 owner pack, one file each, names match ids, no load errors', async () => {
  // Projects James adds in the dashboard (no fixed path) sit beside the 13 originals and carry their photos inline.
  assert.deepEqual(work.loadErrors, []);
  const originals = work.projects.filter((p) => p.path);
  assert.equal(originals.length, 13);
  assert.equal(work.media.filter((m) => !m.fromProject).length, 359);
  assert.equal(work.importing.length, 0);
  const goldin = work.media.find(m => m.id === 'goldin-luxury-residence-film');
  assert.equal(goldin.published, true);
  assert.match(goldin._ownerAddressException, /James approved/, 'opening title explicitly accepted by the owner');
  assert.equal((await readdir(join(root, 'content/projects'))).length, work.projects.length);
  assert.equal((await readdir(join(root, 'content/media'))).length, 359);
  // James's 20 Drive videos of Oct 15 are owner assets, imported as hidden drafts with no page placement yet.
  const oct15 = work.media.filter((m) => (/^oct15-/.test(m.id) || m.id === 'waterfront-residence-cinematic-film'));
  assert.equal(oct15.length, 20);
  assert.ok(oct15.every((m) => m.type === 'video' && typeof m.published === 'boolean' && m.import && m.import.state === 'ready'), 'imported owner records; editor visibility decisions retained');
  assert.ok(originals.every((p) => p.published === true), 'original projects are explicitly published');
  const w = await read('content/work.json');
  assert.ok(!('projects' in w) && !('media' in w) && w.taxonomy, 'work.json keeps only the taxonomy');
  // file order is preserved through `order`
  const library = work.media.filter((m) => !m.fromProject);
  // (the Oct 15 owner videos start at 3000, leaving room before them, so orders rise but are not all 10 apart)
  const orders = library.map((m) => m.order);
  assert.ok(orders.every((o, i) => Number.isInteger(o) && (i === 0 || o > orders[i - 1])), 'orders rise in file order: ' + orders.join(','));
});

test('content checks: the current site passes; published problems are errors, draft problems are warnings', () => {
  const current = structuredClone(work);
  const first = checkContent({ work: current, fileExists, pageText, testimonials, faqs });
  holdDashboardProjects(current, first.errors);
  const ok = checkContent({ work: current, fileExists, pageText, testimonials, faqs });
  assert.deepEqual(ok.errors, []);
  const draft = { slug: 'new-house', title: '12 Ocean Road', category: 'architecture-design', location: '12 Ocean Road', rights: 'pending', published: false, photos: [{ image: '/images/projects/x.jpg' }] };
  const r1 = checkContent({ work: { ...current, projects: [...current.projects, draft] }, fileExists });
  assert.equal(r1.errors.length, 0);
  assert.ok(r1.warnings.some((w) => /street address/.test(w)) && r1.warnings.some((w) => /rights/.test(w)) && r1.warnings.some((w) => /alt text/.test(w)));
  const r2 = checkContent({ work: { ...current, projects: [...current.projects, { ...draft, published: true }] }, fileExists });
  for (const re of [/street address/, /rights are not marked Approved/, /describe the photo/, /short description/, /story/, /is missing/]) assert.ok(r2.errors.some((e) => re.test(e)), re);
  assert.ok(looksLikeAddress('99-hedges-lane-kitchen.jpg') && looksLikeAddress('123 Main St') && !looksLikeAddress('Amagansett') && !looksLikeAddress('yankee-hero.webp'));
  const badPage = checkContent({ work, fileExists, pageText: { pages: { '/': { eyebrow: '', title: 'x', lede: 'y' } } } });
  assert.ok(badPage.errors.some((e) => /cannot be empty/.test(e)));
});

test('project photos become ordinary media records that inherit the project (draft stays draft)', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'pgk-'));
  await mkdir(join(tmp, 'static/images/projects'), { recursive: true });
  // a 1,200 × 1,800 portrait PNG header is enough for the size reader
  const png = Buffer.alloc(33); png.writeUInt32BE(0x89504e47, 0); png.writeUInt32BE(1200, 16); png.writeUInt32BE(1800, 20);
  await writeFile(join(tmp, 'static/images/projects/Great Room.png'), png);
  const p = { slug: 'shelter-island-house', title: 'Shelter Island House', category: 'architecture-design', location: 'Shelter Island', client: 'Studio X', rights: 'approved', published: false, sortPriority: 2,
    photos: [{ image: '/images/projects/Great Room.png', alt: 'Great room', caption: '  Design: Studio X  ', focal: 'top', photoType: 'drone' }, { image: '/images/projects/Great Room.png', alt: 'Again' }] };
  const out = expandProjectPhotos(tmp, p);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'shelter-island-house-great-room');
  assert.equal(out[1].id, 'shelter-island-house-great-room-2');
  assert.equal(out[0].orientation, 'vertical');
  assert.equal(out[0].focal, 'top');
  assert.deepEqual(out[0].service, ['photography', 'drone']);
  assert.deepEqual(out[1].service, ['photography']);
  assert.equal(out[1].focal, undefined);
  assert.equal(out[0].caption, 'Design: Studio X');
  assert.equal(out[0].alt, 'Great room');
  assert.equal(out[1].caption, undefined, 'no caption inferred from a description or title');
  for (const m of out) {
    assert.equal(m.project, p.slug); assert.equal(m.category, p.category); assert.equal(m.published, false);
    assert.equal(m.rights, 'approved'); assert.equal(m.sortPriority, 2); assert.deepEqual(m.packageIds, []);
  }
  assert.equal(slugify('IMG_0042 Kitchen.JPG'), 'img-0042-kitchen');
});

test('dashboard config: sections, no pricing/legal/booking, every existing field kept, policy FAQs not editable', async () => {
  const { config } = cmsConfig({ site, fieldNotes, work, branch: 'redesign/2027-preview', repo: 'photografikstudios/PS_website', testimonials });
  const names = config.collections.map((c) => c.name);
  assert.deepEqual(names, ['projects', 'photos', 'films', 'page-media', 'page-text', 'testimonials', 'faqs', 'field-notes']);
  const files = JSON.stringify(config.collections.map((c) => c.folder || c.files.map((f) => f.file)));
  // Whole paths: Page Media's own content/page-media/real-estate-pricing.json holds only that page's pictures.
  for (const f of ['pricing.json', 'legal.json', 'offers.json', 'site.json', 'faqs-policy.json', 'seo.json']) assert.ok(!files.includes(`"content/${f}"`), f);
  const col = (n) => config.collections.find((c) => c.name === n);
  const fieldNames = (c) => new Set(c.fields.map((f) => f.name));
  for (const p of work.projects) for (const k of Object.keys(p)) assert.ok(fieldNames(col('projects')).has(k), `project field ${k}`);
  for (const m of work.media.filter((x) => x.type === 'image' && !x.fromProject)) for (const k of Object.keys(m)) assert.ok(fieldNames(col('photos')).has(k), `photo field ${k}`);
  for (const m of work.media.filter((x) => x.type === 'video')) for (const k of Object.keys(m)) assert.ok(fieldNames(col('films')).has(k), `film field ${k}`);
  // Oct 13 2026: films are added from Google Drive; nothing is deleted through Decap's own (unchecked) Delete.
  assert.equal(col('films').create, true);
  for (const c of config.collections) assert.equal(c.delete, false, `${c.name}: no unchecked native delete`);
  for (const n of ['projects', 'photos', 'films', 'field-notes']) assert.equal(col(n).fields.filter((f) => f.widget === 'pgk-manage').length, 1, `${n}: where-used and delete panel`);
  assert.equal(col('projects').fields.find((f) => f.name === 'published').default, false);
  assert.equal(col('photos').fields.find((f) => f.name === 'published').default, false);
  const delivered = col('projects').fields.find((f) => f.name === 'services');
  assert.equal(delivered.widget, 'select');
  assert.equal(delivered.multiple, true);
  assert.deepEqual(delivered.options.map((o) => o.value), work.taxonomy.service.map((s) => s.id));
  assert.equal(col('projects').fields.find((f) => f.name === 'serviceDetails').widget, 'text');
  assert.equal(col('projects').fields.find((f) => f.name === 'delivered').widget, 'hidden');
  const policy = await read('content/faqs-policy.json');
  const editable = faqs['real-estate'].map((f) => f.q);
  assert.ok(policy['real-estate'].every((f) => !editable.includes(f.q)) && policy['real-estate'].some((f) => /reschedule/i.test(f.q)));
});

test('image size reader: PNG, JPEG and WebP headers', async () => {
  const webp = await readFile(join(root, 'static/images/photografik-2027/curated/yankee-hero.webp'));
  assert.deepEqual(imageSize(webp), { width: 1334, height: 2000, type: 'webp' });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x06, 0x40, 0x09, 0x60, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(imageSize(jpg), { width: 2400, height: 1600, type: 'jpeg' });
});

test('a draft project with photos: preview shows it with a Draft note; production leaves it out everywhere', { timeout: 120000 }, async () => {
  const { execFileSync } = await import('node:child_process');
  const { symlink, readFile: rf } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  const tmp = await mkdtemp(join(tmpdir(), 'pgk-site-'));
  for (const d of ['src', 'content', 'vercel.json', 'package.json']) await cp(join(root, d), join(tmp, d), { recursive: true });
  await mkdir(join(tmp, 'static/images/projects'), { recursive: true });
  // static/ is large: link its subfolders instead of copying, and add the new upload beside them
  for (const d of await readdir(join(root, 'static'))) if (d !== 'images') await symlink(join(root, 'static', d), join(tmp, 'static', d));
  for (const d of await readdir(join(root, 'static/images'))) if (d !== 'projects') await symlink(join(root, 'static/images', d), join(tmp, 'static/images', d));
  if (existsSync(join(root, 'static/images/projects'))) for (const f of await readdir(join(root, 'static/images/projects'))) await symlink(join(root, 'static/images/projects', f), join(tmp, 'static/images/projects', f));
  await cp(join(root, 'static/images/photografik-2027/curated/yankee-hero.webp'), join(tmp, 'static/images/projects/shelter-island-great-room.webp'));
  await writeFile(join(tmp, 'content/projects/shelter-island-house.json'), JSON.stringify({
    title: 'Shelter Island House', category: 'architecture-design', client: 'Studio X', location: 'Shelter Island', services: ['photography'],
    summary: 'Project photography of a new house.', story: 'Coverage planned around the architect’s portfolio.', rights: 'approved', published: false,
    hero: '/images/projects/shelter-island-great-room.webp', heroAlt: 'Timber house main image', heroCaption: 'Design: Studio X & partners',
    photos: [{ image: '/images/projects/shelter-island-great-room.webp', alt: 'Great room with timber trusses', focal: 'upper-third', caption: 'A note <script>not markup</script>' }],
  }, null, 2));
  const env = { ...process.env, VERCEL: '', VERCEL_ENV: '', CI: '', VERCEL_GIT_COMMIT_SHA: '2222222222222222222222222222222222222222' };
  const run = (extra) => execFileSync('node', ['src/build.mjs'], { cwd: tmp, env: { ...env, ...extra }, stdio: 'pipe' }).toString();
  run({});
  const page = await rf(join(tmp, 'dist/architecture-design/shelter-island-house.html'), 'utf8');
  assert.ok(/Draft, not published/.test(page) && /Great room with timber trusses/.test(page) && /object-position: 50% 30%/.test(page), 'review build shows the draft with its photo and focus');
  assert.ok(page.includes('<p class="photo-caption">Design: Studio X &amp; partners</p>'));
  assert.ok(page.includes('<p class="photo-caption">A note &lt;script&gt;not markup&lt;/script&gt;</p>'));
  assert.ok(page.includes('alt="Great room with timber trusses"'), 'caption never replaces alt text');
  assert.ok(!/shelter-island-house/.test(await rf(join(tmp, 'dist/sitemap.xml'), 'utf8')), 'draft never in the sitemap');
  run({ PRODUCTION_VISIBILITY_CHECK: '1' });
  assert.ok(!existsSync(join(tmp, 'dist-prodcheck/architecture-design/shelter-island-house.html')), 'no page in production');
  for (const f of ['architecture-design.html', 'index.html', 'sitemap.xml']) assert.ok(!/shelter-island/.test(await rf(join(tmp, 'dist-prodcheck', f), 'utf8')), `${f} leaves the draft out`);
  // Publish: switch on, rebuild: the project and its photo appear in production and the sitemap
  const pf = join(tmp, 'content/projects/shelter-island-house.json');
  await writeFile(pf, (await rf(pf, 'utf8')).replace('"published": false', '"published": true'));
  run({ PRODUCTION_VISIBILITY_CHECK: '1' });
  const live = await rf(join(tmp, 'dist-prodcheck/architecture-design/shelter-island-house.html'), 'utf8');
  assert.ok(!/Draft, not published/.test(live) && /Great room with timber trusses/.test(live));
  assert.ok(/architecture-design\/shelter-island-house/.test(await rf(join(tmp, 'dist-prodcheck/sitemap.xml'), 'utf8')));
  assert.ok(/shelter-island-house/.test(await rf(join(tmp, 'dist-prodcheck/architecture-design.html'), 'utf8')), 'appears in the A&D gallery');
});

test('Home review excerpt is a verbatim shortening of the full quote, and Home links to About reviews', async () => {
  const t = JSON.parse(await readFile(join(root, 'content/testimonials.json'), 'utf8'));
  for (const r of t.reviews.filter((x) => x.excerpt)) assert.ok(isVerbatimExcerpt(r.excerpt, r.quote), r.name);
  assert.equal(isVerbatimExcerpt('His response is fantastic.', 'His response and turn-around time is fantastic.'), false);
  const bad = checkContent({ work: { projects: [], media: [] }, fileExists: () => true, testimonials: { reviews: [{ name: 'A', quote: 'One two three.', excerpt: 'One … four.' }] } });
  assert.ok(bad.errors.some((e) => /short version/.test(e)));
  const home = await readFile(join(root, 'src/pages.js'), 'utf8');
  assert.match(home, /href="\/about#reviews"[^>]*>More reviews →<\/a>/);
});

test('sign-in: trims pasted keys, asks GitHub only for public_repo, and keeps the 503 message without keys', async () => {
  const { default: auth } = await import('../api/cms-auth.js');
  const run = (env) => {
    const saved = { id: process.env.CMS_GITHUB_CLIENT_ID, secret: process.env.CMS_GITHUB_CLIENT_SECRET };
    Object.assign(process.env, env);
    for (const k of Object.keys(env)) if (env[k] === undefined) delete process.env[k];
    const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b; } };
    auth({ headers: { host: 'example.vercel.app' } }, res);
    process.env.CMS_GITHUB_CLIENT_ID = saved.id ?? ''; process.env.CMS_GITHUB_CLIENT_SECRET = saved.secret ?? '';
    if (saved.id === undefined) delete process.env.CMS_GITHUB_CLIENT_ID; if (saved.secret === undefined) delete process.env.CMS_GITHUB_CLIENT_SECRET;
    return res;
  };
  const ok = run({ CMS_GITHUB_CLIENT_ID: ' Ov23exampleId ', CMS_GITHUB_CLIENT_SECRET: ' s3cret ' });
  assert.equal(ok.statusCode, 302);
  const u = new URL(ok.headers.location);
  assert.equal(u.searchParams.get('client_id'), 'Ov23exampleId');
  assert.equal(u.searchParams.get('scope'), 'public_repo');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://example.vercel.app/api/cms-callback');
  const none = run({ CMS_GITHUB_CLIENT_ID: undefined, CMS_GITHUB_CLIENT_SECRET: undefined });
  assert.equal(none.statusCode, 503);
  assert.match(none.body, /not set up yet/);
});

// Codex, Session 56 review: the saved Test project must pass the filename guard without losing James's photos, stay
// marked review-only, and a held project must say why in the dashboard, while the originals stay strict.
test('camera file names: caught on dashboard records, none on the original portfolio', () => {
  for (const n of ['/images/projects/5-ps_00519.jpg', 'PS_00314.jpg', '/x/DJI_0042.JPG', 'IMG_1234.jpeg', 'DSC01234.jpg', '_MG_5678.jpg', 'PXL_20260101_1234.jpg']) assert.equal(looksLikeCameraName(n), true, n);
  for (const n of ['/images/projects/test-fc560c9d51.jpg', '/v/re-hamptons-beachfront.webp', 'upload-check-52e73f4795.png', 'call_plk7npqwfjep2upn6i7x37lu.png']) assert.equal(looksLikeCameraName(n), false, n);
  const originals = structuredClone(work);
  originals.projects = originals.projects.filter((p) => p.path);
  originals.media = originals.media.filter((m) => originals.projects.some((p) => p.slug === m.project) || !m.fromProject);
  const { errors, warnings } = checkContent({ work: originals, fileExists, pageText, testimonials, faqs });
  assert.deepEqual([...errors, ...warnings].filter((e) => /camera file name/.test(e)), []);
});

test('Test project: clean file names, same photos byte for byte, originals kept, review-only', async () => {
  const t = work.projects.find((p) => p.slug === 'test');
  assert.equal(t.reviewOnly, true);
  assert.equal(typeof t.published, 'boolean', 'James’s Published switch is left as he set it (Oct 13 2026: off)');
  const sha = async (p) => createHash('sha256').update(await readFile(join(root, 'static', p))).digest('hex');
  assert.equal(t.hero, '/images/projects/test-fc560c9d51.jpg');
  assert.ok(t.photos.length >= 1, 'the original review photo is still present');
  assert.equal(t.photos[0].image, '/images/projects/test-cec9ddbd88.jpg');
  assert.equal(t.photos[0].alt, 'test test');
  assert.equal(await sha(t.hero), await sha('/images/projects/5-ps_00519.jpg'));
  assert.equal(await sha(t.photos[0].image), await sha('/images/projects/4-ps_00374.jpg'));
  for (const f of ['1-ps_00314.jpg', '2-ps_00319.jpg', '3-ps_00339.jpg', '4-ps_00374.jpg', '5-ps_00519.jpg', 'call_plk7npqwfjep2upn6i7x37lu.png']) assert.ok(fileExists('/images/projects/' + f), `original upload kept: ${f}`);
  const { errors } = checkContent({ work: structuredClone(work), fileExists, pageText, testimonials, faqs });
  assert.deepEqual(errors.filter((e) => e.includes('“Test”')), []);
});

test('held projects: a dashboard project with a problem is held with its reasons; an original is never held', () => {
  const w = structuredClone(work);
  w.projects = w.projects.filter((p) => p.slug !== 'real-estate-test');
  w.media = w.media.filter((m) => m.project !== 'real-estate-test');
  const t = withSynthetic(w);
  t.photos[0].alt = ''; t.hero = '/images/projects/5-ps_00519.jpg';
  const orig = w.projects.find((p) => p.path);
  orig.heroAlt = ''; orig.hero = orig.hero || '/images/projects/test-fc560c9d51.jpg';
  const first = checkContent({ work: w, fileExists, pageText, testimonials, faqs });
  const held = holdDashboardProjects(w, first.errors);
  assert.deepEqual(held.map((x) => x.slug), ['qa-synthetic']);
  assert.ok(held[0].reasons.some((r) => /photo 1: describe the photo/.test(r)), held[0].reasons.join(' | '));
  assert.ok(held[0].reasons.some((r) => /camera file name/.test(r)), held[0].reasons.join(' | '));
  assert.equal(t.published, false);
  assert.ok(w.media.filter((m) => m.project === 'qa-synthetic' && m.fromProject).every((m) => m.published === false));
  const again = checkContent({ work: w, fileExists, pageText, testimonials, faqs });
  assert.ok(again.errors.some((e) => e.startsWith(`Project “${orig.title}”`)), 'the original project still fails the build');
  assert.equal(orig.published, true);
});

test('review-only: production never builds the Test project; review keeps it', () => {
  const r = structuredClone(work); withSynthetic(r);
  const jamesTest = r.projects.find((p) => p.slug === 'test').published;
  assert.deepEqual(applyReviewOnly(r, true), [{ slug: 'test', title: 'Test' }, { slug: 'qa-synthetic', title: 'QA synthetic' }]);
  assert.equal(r.projects.find((p) => p.slug === 'qa-synthetic').published, true, 'review keeps a published review-only project');
  assert.equal(r.projects.find((p) => p.slug === 'test').published, jamesTest, 'review never changes James’s switch');
  const prod = structuredClone(work); withSynthetic(prod);
  applyReviewOnly(prod, false);
  for (const slug of ['test', 'qa-synthetic']) {
    assert.equal(prod.projects.find((p) => p.slug === slug).published, false);
    assert.ok(prod.media.filter((m) => m.project === slug).every((m) => m.published === false));
  }
});

test('dashboard config: project Published uses the status switch, drafts by default; reviewOnly kept hidden', () => {
  const conf = cmsConfig({ site, fieldNotes, work, branch: 'redesign/2027-preview', repo: 'photografikstudios/PS_website', testimonials }).config;
  const f = conf.collections.find((c) => c.name === 'projects').fields;
  const pub = f.find((x) => x.name === 'published');
  assert.equal(pub.widget, 'pgk-publish'); assert.equal(pub.default, false);
  assert.equal(f.find((x) => x.name === 'reviewOnly').widget, 'hidden');
  assert.equal(f.filter((x) => x.name === 'reviewOnly').length, 1);
});

// Codex, Session 57 source review: /admin/status.json and /admin/config.js are public static files.
test('status file never names a project: opaque ids, file names removed, no review-only list in production', () => {
  const held = [{ slug: 'smith-residence', title: 'Smith Residence', reasons: ['photo 1: still has its camera file name (5-ps_00519.jpg). Remove it and add it again', 'the hero image /images/projects/smith-residence-ab12.jpg is missing'] }];
  for (const reviewMode of [true, false]) {
    const st = dashboardStatus({ held, reviewOnly: [{ slug: 'test', title: 'Test' }], reviewMode });
    const text = JSON.stringify(st);
    assert.ok(!/smith|Smith|ps_00519|\.jpg/.test(text), text);
    assert.equal(st.held[0].id, statusId('smith-residence'));
    assert.match(st.held[0].reasons[0], /camera file name \(a photo file\)/);
    assert.deepEqual(st.reviewOnly, reviewMode ? [{ collection: 'projects', id: statusId('test') }] : []);
    assert.ok(!/"title"|"slug"/.test(text));
  }
  assert.match(statusId('test'), /^[0-9a-f]{16}$/);
});

test('production build: no review-only or draft project name, photo or reason in any public file', () => {
  execFileSync(process.execPath, ['src/build.mjs'], { cwd: root, env: { ...process.env, PRODUCTION_VISIBILITY_CHECK: '1', VERCEL: '', VERCEL_ENV: '', CI: '' }, stdio: 'pipe' });
  const out = join(root, 'dist-prodcheck');
  const status = JSON.parse(readFileSync(join(out, 'admin/status.json'), 'utf8'));
  assert.equal(status.mode, 'production'); assert.deepEqual(status.reviewOnly, []);
  const cfg = readFileSync(join(out, 'admin/config.js'), 'utf8');
  const thumbs = JSON.parse(cfg.match(/PHOTOGRAFIK_THUMBS = (\{.*?\});\n/)[1]);
  const drafts = work.projects.filter((p) => p.published === false || p.reviewOnly === true);
  for (const p of drafts) {
    assert.ok(!(p.slug in thumbs.projects), `${p.slug} has no thumbnail entry`);
    for (const ph of p.photos || []) assert.ok(!cfg.includes(ph.image), `${ph.image} not in config.js`);
    if (p.hero) assert.ok(!cfg.includes(p.hero), `${p.hero} not in config.js`);
  }
  assert.ok(!existsSync(join(out, 'architecture-design/test.html')), 'no Test page in production');
});

// James, Sep 27 2026: no street addresses on the public site, including media URLs and file names. Drive imports take
// the Drive file name as their id, so a film shown under an approved title could still publish "772-pulaski-rd" in its
// /v/ path (Oct 17). This checks every public page and file production would serve as text, so every linked URL.
test('production build: no street address in any public page or in the media URLs and file names it links', () => {
  const out = join(root, 'dist-prodcheck');
  execFileSync(process.execPath, ['src/build.mjs'], { cwd: root, env: { ...process.env, PRODUCTION_VISIBILITY_CHECK: '1', VERCEL: '', VERCEL_ENV: '', CI: '' }, stdio: 'pipe' });
  const suffix = '(?:ln|lane|la|rd|road|st|street|ave|avenue|hwy|highway|dr|drive|ct|court|pl|place|way|path|blvd|boulevard)';
  const street = new RegExp(`\\b\\d{1,5}[- ][a-z]+(?:[- ][a-z]+)*[- ]${suffix}\\b|\\b\\d{1,5}[- ](?:montauk|montuak|pulaski|sunset|school|niamogue|hobart|point[- ]pleas+ant|georgian|rose[- ]hill)\\b`, 'gi');
  const hits = new Set();
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  // Pages, sitemap, robots and captions. /admin (noindex) lists hidden drafts on purpose so they can be chosen, and
  // v/manifest.json names every committed file; both are noted in the handoff rather than tested here.
  for (const f of walk(out)) {
    const rel = f.slice(out.length + 1);
    if (rel.startsWith('admin/')) continue;
    if (/\.(html|xml|txt|vtt)$/.test(f)) for (const m of readFileSync(f, 'utf8').matchAll(street)) hits.add(`${rel}: ${m[0]}`);
  }
  assert.deepEqual([...hits].slice(0, 12), []);
});

// Oct 18: James corrected the project to "Tortorella Pools"; its film and photo kept the old spelling in their
// visible title, alt text and client label. A project's media must name the client the way the project does.
test('project media name the client exactly as their project does (Tortorella Pools)', () => {
  const bySlug = Object.fromEntries(work.projects.map((p) => [p.slug, p]));
  const off = work.media.filter((m) => !m.fromProject && bySlug[m.project]?.client && m.client && m.client !== bySlug[m.project].client).map((m) => `${m.id}: ${m.client}`);
  assert.deepEqual(off, []);
  const t = bySlug['torella-pools'];
  assert.equal(t.client, 'Tortorella Pools'); assert.equal(t.path, '/commercial/torella-pools');
  for (const m of work.media.filter((x) => x.project === 'torella-pools' && !x.fromProject)) for (const k of ['title', 'alt', 'client']) assert.ok(!/\bTorella\b/.test(m[k] || ''), `${m.id} ${k}: ${m[k]}`);
});

test('Oct 11 owner photo pack: 26 records traced to a verified original, pinned, street-free, town from HDPH, uncredited, excluded property absent', async () => {
  // Session 59. Source mapping in the public repo is the HDPH site id, the original file name (withheld when it names
  // the street) and the original's SHA-256; the street-level mapping stays in the private brief folder.
  const TOWN_BY_SITE = { 3468716: 'Bridgehampton', 3461445: 'Southampton', 3311429: 'Southold', 3311995: 'Sagaponack', 3236185: 'Lloyd Harbor', 3445820: 'Westhampton Beach', 3426607: 'Southold', 3441330: 'Sag Harbor', 3134520: 'Huntington', 3212349: 'Great Neck', 3290223: 'Water Mill' };
  const EXCLUDED_SITE_IDS = ['3478411', '3463819']; // owner exclusion (Oct 11 2026): never used, in any form
  const pack = work.media.filter((m) => /^(re|ad)26-/.test(m.id));
  assert.equal(pack.length, 26);
  const { items } = await read('content/media-sources.json');
  const pins = (await read('content/media-assets.json')).files;
  const manifest = await read('static/v/manifest.json');
  const sites = new Set();
  for (const m of pack) {
    const src = items.find((i) => i.id === m.id);
    assert.ok(src && src.image, `${m.id}: in media-sources`);
    const site = /^hdph:(\d{7})$/.exec(src.source)?.[1];
    assert.ok(site, `${m.id}: HDPH source site id`);
    sites.add(site);
    assert.match(src._note, new RegExp(`HDPH source site ${site}, original .+, \\d+x\\d+, SHA-256 [0-9a-f]{64} `), `${m.id}: traceable note`);
    for (const f of [m.src, m.thumb]) assert.ok(pins[f], `${m.id}: ${f} pinned`);
    assert.ok(manifest[m.id] && manifest[m.id].orientation === m.orientation, `${m.id}: manifest`);
    assert.equal(m.rights, 'approved'); assert.equal(m.published, true);
    // Town only, read from the HDPH listing record on Oct 12 2026 (James signed in).
    assert.equal(m.location, TOWN_BY_SITE[site], `${m.id}: town from the HDPH listing`);
    assert.ok(m.alt.endsWith(' in ' + m.location), `${m.id}: alt names the town`);
    if (m.id === 'ad26-firehouse-front') {
      assert.equal(m.project, 'long-island-building-systems', 'Oct 19 exact duplicate supplied in this client folder');
      assert.equal(m.client, 'Long Island Building Systems');
    } else assert.ok(m.project === null && m.client === null, `${m.id}: no invented project or client`);
    assert.ok(!m.packageIds.length && m.capturedYear === null, `${m.id}: no invented package or year`);
    assert.equal(m.category, m.id.startsWith('re26-') ? 'real-estate' : 'architecture-design');
    for (const t of [m.alt, m.title, m.id, src._note, m._rights]) assert.ok(!looksLikeAddress(t) && !/\b(lane|ln|road|rd|way)\b/i.test(t.replace(/^.*?SHA-256 [0-9a-f]{64}/, '')), `${m.id}: no street in "${t.slice(0, 60)}"`);
  }
  assert.equal(sites.size, 11, 'all eleven pack properties are represented');
  for (const id of EXCLUDED_SITE_IDS) assert.ok(!sites.has(id));
  let hits = '';
  try { hits = execFileSync('grep', ['-rlE', EXCLUDED_SITE_IDS.join('|'), 'content', 'src', 'static', 'scripts'], { cwd: root, encoding: 'utf8' }); } catch (e) { if (e.status !== 1) throw e; }
  assert.equal(hits, '', 'excluded property ids appear in: ' + hits);
});

test('GA4: existing stream in production; review previews only on ?ga_debug=1 as internal debug traffic', async () => {
  const { ga4Tag } = await import('../src/layout.js');
  assert.equal(site.analytics.ga4MeasurementId, 'G-BT3BZQBFS5', 'existing Photografik stream (James, Oct 13)');
  assert.equal(ga4Tag({ analytics: { ga4MeasurementId: '' } }, false), '', 'no ID, no tag');
  const prod = ga4Tag(site, false);
  assert.match(prod, /googletagmanager\.com\/gtag\/js\?id=G-BT3BZQBFS5"/);
  assert.match(prod, /gtag\('config','G-BT3BZQBFS5'\)/);
  assert.ok(!/debug_mode|traffic_type/.test(prod), 'production hits are normal traffic');
  const review = ga4Tag(site, true);
  assert.ok(!/<script async src=/.test(review), 'review never loads GA unconditionally');
  assert.match(review, /ga_debug=1/); assert.match(review, /debug_mode:true,traffic_type:'internal'/);
  assert.throws(() => ga4Tag({ analytics: { ga4MeasurementId: 'UA-1234-1' } }, false), /not a GA4 Measurement ID/);
  const js = readFileSync(join(root, 'src/assets/site.js'), 'utf8');
  assert.match(js, /window\.gtag\('event', name, gaParams\(payload\)\)/, 'track() forwards allow-listed params to GA4');
});


test('usability: flat fields retain data keys, Film essentials come first, sections and controlled editors', () => {
  const { config } = cmsConfig({ site, fieldNotes, work, branch: 'redesign/2027-preview', repo: 'photografikstudios/PS_website', testimonials });
  const col = (n) => config.collections.find((c) => c.name === n);
  const visible = (n) => col(n).fields.filter((f) => f.widget !== 'hidden' && f.widget !== 'pgk-section');
  assert.deepEqual(visible('films').slice(0, 5).map((f) => f.name), ['title', 'drive', 'category', 'import', 'published']);
  assert.deepEqual(col('films').fields.filter((f) => f.widget === 'pgk-section').map((f) => f.label), ['Add or update a film', 'Organize in the library', 'Presentation', 'Captions & Accessibility', 'Gallery Placement', 'Advanced']);
  assert.deepEqual(col('field-notes').fields.filter((f) => f.widget === 'pgk-section').map((f) => f.label), ['Writing', 'Publishing', 'Related content', 'SEO (optional)', 'Advanced']);
  assert.deepEqual(visible('field-notes').slice(0, 5).map((f) => f.name), ['title', 'category', 'hero', 'heroAlt', 'excerpt']);
  assert.equal(col('projects').fields.find((f) => f.name === 'category').widget, 'pgk-category');
  assert.equal(col('projects').fields.find((f) => f.name === 'order').direction, 'ascending');
  for (const name of ['films', 'photos', 'projects']) assert.equal(col(name).fields.find((f) => f.name === 'sortPriority').widget, 'pgk-placement');
  const review = col('testimonials').files[0].fields.find((f) => f.name === 'reviews');
  assert.equal(review.fields.find((f) => f.name === 'featured').widget, 'pgk-review-display');
  assert.equal(review.fields.find((f) => f.name === 'approval').widget, 'hidden');
  for (const name of ['projects', 'photos', 'films', 'field-notes']) {
    const names = col(name).fields.map((f) => f.name); assert.equal(names.length, new Set(names).size, 'no repeated data keys');
    for (const f of col(name).fields.filter((f) => f.widget === 'pgk-section')) assert.equal(f.default, undefined, 'display-only section has no saved default');
  }
  for (const page of col('page-media').files) for (const f of page.fields.filter((f) => f.galleryKey)) {
    assert.ok(f.pageLabel && f.sectionLabel && f.device, page.name + '.' + f.name);
  }
});


test('library folders and tags organize records without changing placement, IDs or file URLs', () => {
  const w = structuredClone(work);
  const photo = w.media.find((m) => m.type === 'image' && !m.fromProject);
  photo.libraryFolder = 'Client samples'; photo.tags = ['pool', 'before+after'];
  const result = cmsConfig({ site, fieldNotes, work: w, branch: 'redesign/2027-preview', repo: 'photografikstudios/PS_website', testimonials });
  for (const name of ['photos', 'films', 'projects']) {
    const fields = result.config.collections.find((c) => c.name === name).fields;
    assert.equal(fields.filter((f) => f.name === 'libraryFolder').length, 1);
    assert.equal(fields.find((f) => f.name === 'libraryFolder').widget, 'pgk-folder');
    assert.equal(fields.find((f) => f.name === 'tags').widget, 'pgk-tags');
  }
  const c = result.config.collections.find((c) => c.name === 'photos');
  assert.ok(c.view_groups.some((g) => g.field === 'libraryFolder'));
  const tag = c.view_filters.find((f) => f.label === 'Tag: before+after');
  assert.ok(new RegExp(tag.pattern).test('before+after'));
  assert.ok(!new RegExp(tag.pattern).test('beforeeeeeafter'));
  const project = { slug: 'qa-organized', title: 'QA client', category: 'architecture-design', published: false, rights: 'pending', libraryFolder: 'Client samples', tags: ['exterior'], photos: [{ image: '/images/projects/qa-front.jpg', alt: 'Front elevation' }] };
  const expanded = expandProjectPhotos(root, project)[0];
  assert.deepEqual([expanded.libraryFolder, expanded.tags, expanded.src, expanded.id, expanded.category, expanded.published, expanded.rights], ['Client samples', ['exterior'], '/images/projects/qa-front.jpg', 'qa-organized-qa-front', 'architecture-design', false, 'pending']);
  expanded.tags.push('different'); assert.deepEqual(project.tags, ['exterior']);
  const original = work.media.find((m) => m.id === photo.id);
  for (const key of ['id', 'src', 'category', 'published', 'rights', 'sortPriority']) assert.deepEqual(photo[key], original[key]);
});

test('Oct 19 client media: 180 source photos, canonical reuse, usable thumbnails and accurate responsive widths', async () => {
  const { createHash } = await import('node:crypto');
  const { imageSize } = await import('../src/lib/image-size.js');
  const pack = await read('docs/owner-media-2026-10-19.json');
  assert.equal(pack.photos.length, 180);
  assert.equal(new Set(pack.photos.map(p => p.driveId)).size, 180);
  assert.equal(new Set(pack.photos.map(p => p.record)).size, 180);
  assert.equal(pack.photos.filter(p => p.action === 'added').length, 174);
  assert.equal(pack.photos.filter(p => p.action === 'reused existing record').length, 6);
  for (const p of pack.photos) {
    const m = work.media.find(m => m.id === p.record);
    assert.ok(m, p.record); assert.equal(m.libraryFolder, p.client); assert.ok(m.tags.length);
    assert.equal(m.rights, 'approved'); assert.equal(m.type, 'image');
    if (['BPE Ironworks', 'Rachel Lynch Pools', 'Evolution Unlimited', 'RevivaLuxe'].includes(p.client)) assert.equal(m.category, 'commercial');
    if (p.action !== 'added') continue;
    assert.equal(m.src, p.src); assert.equal(m.thumb, p.thumb);
    const full = await readFile(join(root, 'static', m.src)); const small = await readFile(join(root, 'static', m.thumb));
    assert.equal(createHash('sha256').update(full).digest('hex'), p.sha256);
    assert.equal(createHash('sha256').update(small).digest('hex'), p.thumbSha256);
    const a = imageSize(full), b = imageSize(small);
    assert.ok(Math.max(a.width, a.height) <= 2500); assert.ok(Math.max(b.width, b.height) <= 900);
    assert.ok(b.width < a.width && b.height < a.height);
    const ctx = createContext({ site, reviewMode: true, onVercel: true, imageInfo: u => u === m.src ? a : u === m.thumb ? b : null });
    const html = ctx.img(m.src, { thumb: m.thumb });
    assert.ok(html.includes(`${m.thumb} ${b.width}w, ${m.src} ${a.width}w`));
    assert.ok(!html.includes('/_vercel/image'));
  }
  assert.equal(pack.videos.filter(v => v.action === 'imported').length, 10);
  assert.equal(pack.videos.filter(v => v.action === 'reused existing film').length, 1);
  for (const v of pack.videos.filter(v => v.action === 'imported')) {
    const m = work.media.find(m => m.id === v.record);
    assert.equal(m.import.state, 'ready'); assert.ok(fileExists(m.src) && fileExists(m.poster));
    if (v.speech) { assert.equal(m.captionsStatus, 'machine-draft'); assert.ok(fileExists(m.captions)); }
  }
});

// Claude review, Oct 19: folder and tag names go into /admin/config.js, which production serves publicly.
test('library folders and tags: production suggestions come only from shown records; tag filters match whole tags', () => {
  const w = structuredClone(work);
  const hidden = w.media.find((m) => !m.fromProject && m.published === false);
  const shown = w.media.find((m) => !m.fromProject && m.type === 'image' && m.published !== false);
  const draftProject = w.projects.find((p) => p.reviewOnly === true) || w.projects.find((p) => p.published === false);
  w.media.push({ id: 'qa-unapproved-media', type: 'image', published: true, rights: 'pending', libraryFolder: 'QA Unapproved Client', tags: ['qa-unapproved-tag'] });
  hidden.libraryFolder = 'QA Hidden Client'; hidden.tags = ['qa-hidden-tag'];
  draftProject.libraryFolder = 'QA Draft Project'; draftProject.tags = ['qa-draft-tag'];
  shown.libraryFolder = 'QA Shown Client'; shown.tags = ['pool', 'pool house'];
  const conf = (reviewMode) => JSON.stringify(cmsConfig({ site, fieldNotes, work: w, branch: 'redesign/2027-preview', repo: 'photografikstudios/PS_website', testimonials, reviewMode }).config);
  const prod = conf(false); const review = conf(true);
  for (const s of ['QA Hidden Client', 'qa-hidden-tag', 'QA Draft Project', 'qa-draft-tag', 'QA Unapproved Client', 'qa-unapproved-tag']) { assert.ok(!prod.includes(s), `${s} not in the public config`); assert.ok(review.includes(s), `${s} offered in the review editor`); }
  assert.ok(prod.includes('QA Shown Client') && prod.includes('pool house'));
  const photos = cmsConfig({ site, fieldNotes, work: w, branch: 'redesign/2027-preview', repo: 'photografikstudios/PS_website', testimonials }).config.collections.find((c) => c.name === 'photos');
  const pool = new RegExp(photos.view_filters.find((f) => f.label === 'Tag: pool').pattern);
  // Decap compares the pattern with the field as text: Immutable lists read 'List [ "a", "b" ]', plain arrays "a,b".
  for (const [tags, want] of [[['pool'], true], [['exterior', 'pool'], true], [['pool house'], false], [['swimming pool'], false]]) {
    assert.equal(pool.test(`List [ ${tags.map((t) => JSON.stringify(t)).join(', ')} ]`), want, `List ${tags}`);
    assert.equal(pool.test(String(tags)), want, `array ${tags}`);
  }
});

test('library folders and tags: a street address is caught like other address fields; ordinary tags pass', () => {
  const w = structuredClone(work);
  const shown = w.media.find((m) => !m.fromProject && m.type === 'image' && m.published !== false && m.rights === 'approved');
  shown.tags = ['360 tour', 'kitchen']; shown.libraryFolder = 'Bellard Brothers';
  const ok = checkContent({ work: w, fileExists: () => true });
  assert.ok(!ok.errors.some((e) => /library folder or tag/.test(e)));
  shown.tags = ['26 Sunset Ave'];
  assert.ok(checkContent({ work: w, fileExists: () => true }).errors.some((e) => /library folder or tag looks like a street address/.test(e)));
});
