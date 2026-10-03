// Owner dashboard (/admin): content model, lossless split, form coverage, checks for drafts vs published.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWork, expandProjectPhotos, slugify } from '../src/lib/work-load.js';
import { checkContent, looksLikeAddress, isVerbatimExcerpt } from '../src/lib/content-check.js';
import { cmsConfig } from '../src/lib/cms-config.js';
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

test('portfolio: 13 original projects and 128 media records, one file each, names match ids, no load errors', async () => {
  // Projects James adds in the dashboard (no fixed path) sit beside the 13 originals and carry their photos inline.
  assert.deepEqual(work.loadErrors, []);
  const originals = work.projects.filter((p) => p.path);
  assert.equal(originals.length, 13);
  assert.equal(work.media.filter((m) => !m.fromProject).length, 128);
  assert.equal((await readdir(join(root, 'content/projects'))).length, work.projects.length);
  assert.equal((await readdir(join(root, 'content/media'))).length, 128);
  assert.ok(originals.every((p) => p.published === true), 'original projects are explicitly published');
  const w = await read('content/work.json');
  assert.ok(!('projects' in w) && !('media' in w) && w.taxonomy, 'work.json keeps only the taxonomy');
  // file order is preserved through `order`
  const library = work.media.filter((m) => !m.fromProject);
  assert.deepEqual(library.map((m) => m.order), library.map((_, i) => (i + 1) * 10));
});

test('content checks: the current site passes; published problems are errors, draft problems are warnings', () => {
  const ok = checkContent({ work, fileExists, pageText, testimonials, faqs });
  assert.deepEqual(ok.errors, []);
  const draft = { slug: 'new-house', title: '12 Ocean Road', category: 'architecture-design', location: '12 Ocean Road', rights: 'pending', published: false, photos: [{ image: '/images/projects/x.jpg' }] };
  const r1 = checkContent({ work: { ...work, projects: [...work.projects, draft] }, fileExists });
  assert.equal(r1.errors.length, 0);
  assert.ok(r1.warnings.some((w) => /street address/.test(w)) && r1.warnings.some((w) => /rights/.test(w)) && r1.warnings.some((w) => /alt text/.test(w)));
  const r2 = checkContent({ work: { ...work, projects: [...work.projects, { ...draft, published: true }] }, fileExists });
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
    photos: [{ image: '/images/projects/Great Room.png', alt: 'Great room', focal: 'top' }, { image: '/images/projects/Great Room.png', alt: 'Again' }] };
  const out = expandProjectPhotos(tmp, p);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'shelter-island-house-great-room');
  assert.equal(out[1].id, 'shelter-island-house-great-room-2');
  assert.equal(out[0].orientation, 'vertical');
  assert.equal(out[0].focal, 'top');
  assert.equal(out[1].focal, undefined);
  for (const m of out) {
    assert.equal(m.project, p.slug); assert.equal(m.category, p.category); assert.equal(m.published, false);
    assert.equal(m.rights, 'approved'); assert.equal(m.sortPriority, 2); assert.deepEqual(m.packageIds, []);
  }
  assert.equal(slugify('IMG_0042 Kitchen.JPG'), 'img-0042-kitchen');
});

test('dashboard config: sections, no pricing/legal/booking, every existing field kept, policy FAQs not editable', async () => {
  const { config } = cmsConfig({ site, fieldNotes, work, branch: 'redesign/2027-preview', repo: 'photografikstudios/PS_website', testimonials });
  const names = config.collections.map((c) => c.name);
  assert.deepEqual(names, ['projects', 'photos', 'films', 'page-text', 'testimonials', 'faqs', 'field-notes']);
  const files = JSON.stringify(config.collections.map((c) => c.folder || c.files.map((f) => f.file)));
  for (const f of ['pricing.json', 'legal.json', 'offers.json', 'site.json', 'faqs-policy.json', 'seo.json']) assert.ok(!files.includes(f), f);
  const col = (n) => config.collections.find((c) => c.name === n);
  const fieldNames = (c) => new Set(c.fields.map((f) => f.name));
  for (const p of work.projects) for (const k of Object.keys(p)) assert.ok(fieldNames(col('projects')).has(k), `project field ${k}`);
  for (const m of work.media.filter((x) => x.type === 'image' && !x.fromProject)) for (const k of Object.keys(m)) assert.ok(fieldNames(col('photos')).has(k), `photo field ${k}`);
  for (const m of work.media.filter((x) => x.type === 'video')) for (const k of Object.keys(m)) assert.ok(fieldNames(col('films')).has(k), `film field ${k}`);
  assert.equal(col('films').create, false);
  assert.equal(col('projects').fields.find((f) => f.name === 'published').default, false);
  assert.equal(col('photos').fields.find((f) => f.name === 'published').default, false);
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
    title: 'Shelter Island House', category: 'architecture-design', client: 'Studio X', location: 'Shelter Island', services: ['Project photography'],
    summary: 'Project photography of a new house.', story: 'Coverage planned around the architect’s portfolio.', rights: 'approved', published: false,
    photos: [{ image: '/images/projects/shelter-island-great-room.webp', alt: 'Great room with timber trusses', focal: 'upper-third' }],
  }, null, 2));
  const env = { ...process.env, VERCEL: '', VERCEL_ENV: '', CI: '', VERCEL_GIT_COMMIT_SHA: '2222222222222222222222222222222222222222' };
  const run = (extra) => execFileSync('node', ['src/build.mjs'], { cwd: tmp, env: { ...env, ...extra }, stdio: 'pipe' }).toString();
  run({});
  const page = await rf(join(tmp, 'dist/architecture-design/shelter-island-house.html'), 'utf8');
  assert.ok(/Draft, not published/.test(page) && /Great room with timber trusses/.test(page) && /object-position: 50% 30%/.test(page), 'review build shows the draft with its photo and focus');
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
