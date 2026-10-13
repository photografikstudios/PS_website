// Page Media rules, where-used, and the dashboard's delete/undo function, on synthetic data only (Oct 13 2026).
// Nothing here touches GitHub: a small fake answers the requests api/cms-manage.js makes, built from the files on disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PAGES, checkPageMedia, pageMediaRefs } from '../src/lib/page-media-core.js';
import { whereUsed, planDeletion } from '../src/lib/usage-core.js';
import { parseNote } from '../src/lib/github-repo.js';
import { loadWork } from '../src/lib/work-load.js';
import { makeFileExists } from '../src/lib/field-notes-load.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = async (p) => JSON.parse(await readFile(join(root, p), 'utf8'));
const assets = await readJson('content/media-assets.json');
const fileExists = makeFileExists(root, new Set(Object.keys(assets.files)));

/** Every repository file the checks read, as text, keyed by path (what the fake GitHub serves). */
async function diskFiles() {
  const out = {};
  for (const dir of ['content/projects', 'content/media', 'content/field-notes', 'content/page-media']) {
    for (const f of await readdir(join(root, dir))) out[`${dir}/${f}`] = await readFile(join(root, dir, f), 'utf8');
  }
  for (const f of ['content/pages.json', 'content/legacy-articles.json', 'vercel.json', 'content/media-assets.json', 'content/poster-assets.json']) out[f] = await readFile(join(root, f), 'utf8');
  return out;
}
const repoFrom = (files) => {
  const dir = (d, ext) => Object.keys(files).filter((p) => p.startsWith(d + '/') && p.endsWith(ext)).map((p) => [p.slice(d.length + 1), files[p]]);
  return {
    projects: dir('content/projects', '.json').map(([n, t]) => ({ slug: n.replace(/\.json$/, ''), ...JSON.parse(t) })),
    media: dir('content/media', '.json').map(([n, t]) => ({ ...JSON.parse(t), id: n.replace(/\.json$/, '') })),
    notes: dir('content/field-notes', '.md').map(([n, t]) => parseNote(t, n)),
    pageMedia: Object.fromEntries(dir('content/page-media', '.json').map(([n, t]) => [n.replace(/\.json$/, ''), JSON.parse(t)])),
    pageText: JSON.parse(files['content/pages.json']), legacy: JSON.parse(files['content/legacy-articles.json']), vercel: JSON.parse(files['vercel.json']),
    pins: new Set(Object.keys(JSON.parse(files['content/media-assets.json']).files)), posterPins: new Set(Object.keys(JSON.parse(files['content/poster-assets.json']).files)),
  };
};
// Synthetic, disposable records: an unused photo with its own file, a photo sharing another photo's file, a project
// with one shared and one unshared upload, and a film used in a page section.
const QA_PHOTO = 'content/media/qa-unused-photo.json';
function withSynthetic(files) {
  const f = { ...files };
  const shared = JSON.parse(f['content/media/ph-clos-lighting.json']).src;
  f[QA_PHOTO] = JSON.stringify({ type: 'image', title: 'QA unused photo', src: '/images/library/qa-unused-photo-0a1b2c3d4e.jpg', alt: 'QA', category: 'commercial', service: ['photography'], published: false, rights: 'approved', packageIds: [], capturedYear: null });
  f['content/media/qa-shared-file.json'] = JSON.stringify({ type: 'image', title: 'QA shared file', src: shared, alt: 'QA', category: 'commercial', service: ['photography'], published: false, rights: 'approved', packageIds: [], capturedYear: null });
  f['content/projects/qa-project.json'] = JSON.stringify({ title: 'QA project', category: 'commercial', published: false, rights: 'approved', hero: '/images/projects/qa-project-own-1111111111.jpg', heroAlt: 'QA', photos: [{ image: shared, alt: 'QA shared' }, { image: '/images/projects/qa-project-own-2222222222.jpg', alt: 'QA own' }] });
  return f;
}

test('Page Media: the committed choices pass, and each rule refuses what it should', async () => {
  const work = await loadWork(root);
  const media = new Map(work.media.filter((m) => m.rights === 'approved').map((m) => [m.id, m]));
  const loops = new Set(Object.keys(assets.files).map((p) => p.match(/^\/v\/([\w-]+)-loop\.mp4$/)?.[1]).filter(Boolean));
  const heroLoops = new Set([...loops].filter((id) => existsSync(join(root, 'static/images/hero', `${id}-phone.webp`))));
  const lib = { media, loops, heroLoops, fileExists };
  const pm = Object.fromEntries(await Promise.all(PAGES.map(async (p) => [p.file, await readJson(`content/page-media/${p.file}.json`)])));
  assert.deepEqual(checkPageMedia(pm, lib).errors, []);
  // Every inventory section is present in its file, and the counts match the pages.
  for (const p of PAGES) for (const s of p.slots) assert.ok(s.key in pm[p.file], `${p.file}.${s.key}`);
  assert.ok(pageMediaRefs(pm).length >= 60, 'sections across every page');
  const bad = (edit) => { const x = structuredClone(pm); edit(x); return checkPageMedia(x, lib).errors.join(' | '); };
  assert.match(bad((x) => { x.home.hero = null; }), /cannot be empty/);
  assert.match(bad((x) => { x.home.hero = { media: 'ph-dan-dan' }; }), /no moving background/);
  assert.match(bad((x) => { x['real-estate'].coverageFilm = { media: 're-hamptons-beachfront' }; }), /screen reader/);
  assert.match(bad((x) => { x['agency-partnerships'].hero = { src: x['agency-partnerships'].hero.src, alt: '' }; }), /describe the photo/);
  assert.match(bad((x) => { x['agent-content'].whyFilm = { media: 're-lloyd-harbor-front' }; }), /is a photo; this section needs a film/);
  assert.match(bad((x) => { x.commercial.featureFilm = { media: 'not-in-library' }; }), /not in the library/);
  assert.match(bad((x) => { x.home.extra = { media: 'ph-dan-dan' }; }), /not a section of this page/);
  assert.match(bad((x) => { x['architecture-design'].designDetail = [...x['architecture-design'].designDetail, { media: 'ph-dan-dan' }]; }), /no more than 4/);
  assert.match(bad((x) => { x.contact.introMedia = { src: '/images/library/missing.jpg', alt: 'x' }; }), /is missing/);
  assert.equal(bad((x) => { x.contact.introMedia = null; x.about.teamMedia = { media: 'cs-demo-reel' }; }), '', 'optional sections take a photo or a film, or stay empty');
});

test('Page Media: a changed choice changes the built page; removing it again restores the page byte for byte', { timeout: 120000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgk-pm-'));
  for (const d of ['content', 'src', 'scripts', 'static', 'package.json']) await cp(join(root, d), join(dir, d), { recursive: true });
  const env = { ...process.env, VERCEL_GIT_COMMIT_SHA: 'pmtest00' };
  const build = () => { execFileSync('node', ['src/build.mjs'], { cwd: dir, env, stdio: 'pipe' }); };
  const page = (p) => readFile(join(dir, 'dist', p), 'utf8');
  build();
  const before = { com: await page('commercial.html'), cs: await page('creator-studios.html'), contact: await page('contact.html') };
  const edit = async (f, fn) => { const p = join(dir, 'content/page-media', `${f}.json`); const v = JSON.parse(await readFile(p, 'utf8')); fn(v); await writeFile(p, JSON.stringify(v, null, 2) + '\n'); };
  // Replace a photo, reorder and remove playing examples, add a film to a text-only page.
  await edit('commercial', (v) => { v.featureBrand = { media: 'ph-torella-aerial' }; });
  await edit('creator-studios', (v) => { v.openingExamples = [v.openingExamples[1], v.openingExamples[0]]; });
  await edit('contact', (v) => { v.introMedia = { media: 'cs-demo-reel' }; });
  build();
  const com = await page('commercial.html'); const cs = await page('creator-studios.html'); const contact = await page('contact.html');
  assert.ok(com.includes('ph-torella-aerial') && !com.includes('ph-revivaluxe-portrait.webp'), 'replaced photo');
  const loops = [...cs.matchAll(/class="cs-loop"><[^>]*?\/v\/([\w-]+)-loop\.mp4|<source src="\/v\/([\w-]+)-loop\.mp4"/g)].map((m) => m[1] || m[2]);
  assert.ok(cs.indexOf('/v/cs-noah-knows-short-loop.mp4') < cs.indexOf('/v/cs-ifcu-clip-loop.mp4'), 'reordered: ' + loops.join());
  assert.ok(!cs.includes('cs-podcast-ep23-short-loop.mp4'), 'removed from the page');
  assert.match(contact, /<figure class="pm-extra pm-extra--film"><div class="vplayer[^"]*" data-video data-id="cs-demo-reel"/);
  // Back to the committed choices: identical pages.
  for (const f of ['commercial', 'creator-studios', 'contact']) await cp(join(root, 'content/page-media', `${f}.json`), join(dir, 'content/page-media', `${f}.json`));
  build();
  assert.equal(await page('commercial.html'), before.com); assert.equal(await page('creator-studios.html'), before.cs); assert.equal(await page('contact.html'), before.contact);
  // A broken choice stops the build with a plain reason (the live site keeps the previous version).
  await edit('home', (v) => { v.hero = null; });
  assert.throws(build, (e) => /Page Media Home, Top of the page: moving background: choose an item; this section cannot be empty/.test(String(e.stderr)));
  await rm(dir, { recursive: true, force: true });
});

test('where-used: in-use items are protected, unused ones list only their own unshared files', async () => {
  const repo = repoFrom(withSynthetic(await diskFiles()));
  // A photo used by page sections cannot be deleted; the answer names the sections.
  const used = whereUsed({ collection: 'photos', key: 'ph-clos-lighting' }, repo);
  assert.ok(used.blocking.some((b) => /Page Media › Commercial: “What we do”, Recurring production/.test(b.text)), JSON.stringify(used.blocking));
  // The replacement film is used in three sections; the replaced JM2 clip in none.
  assert.equal(whereUsed({ collection: 'films', key: 'cs-podcast-ep23-short' }, repo).blocking.length, 3);
  assert.equal(whereUsed({ collection: 'films', key: 'cs-jm2-architecture' }, repo).blocking.length, 0);
  // An unused synthetic photo: its own upload can go with it.
  const qa = whereUsed({ collection: 'photos', key: 'qa-unused-photo' }, repo);
  assert.deepEqual(qa.blocking, []); assert.deepEqual(qa.files.map((f) => [f.path, f.removable]), [['/images/library/qa-unused-photo-0a1b2c3d4e.jpg', true]]);
  // A photo whose file another record also uses: the file is kept and the other user is named.
  const sh = whereUsed({ collection: 'photos', key: 'qa-shared-file' }, repo);
  assert.equal(sh.files[0].removable, false); assert.ok(sh.files[0].shared.some((s) => /CLOS/i.test(s) || /QA project/.test(s)), sh.files[0].shared.join());
  // A project with one shared and one unshared upload, plus its own hero.
  const pr = whereUsed({ collection: 'projects', key: 'qa-project' }, repo);
  assert.deepEqual(pr.blocking, []);
  assert.deepEqual(pr.files.filter((f) => f.removable).map((f) => f.path).sort(), ['/images/projects/qa-project-own-1111111111.jpg', '/images/projects/qa-project-own-2222222222.jpg']);
  assert.ok(pr.files.some((f) => !f.removable && f.shared.length));
  // An original project with library photos of its own: those must be moved or deleted first.
  assert.ok(whereUsed({ collection: 'projects', key: 'revivaluxe' }, repo).blocking.length > 0);
  // A Field Note that an old blog address is mapped to cannot be deleted.
  const mapped = repo.notes.find((n) => repo.legacy.items.some((r) => r.target === `/field-notes/${n.slug}`));
  if (mapped) assert.ok(whereUsed({ collection: 'field-notes', key: mapped.slug }, repo).blocking.some((b) => /old blog address/.test(b.text)));
});

test('delete plan: exact name, only unshared files, never anything in use', async () => {
  const repo = repoFrom(withSynthetic(await diskFiles()));
  assert.match(planDeletion({ collection: 'photos', key: 'qa-unused-photo', confirm: 'wrong' }, repo).errors.join(), /Type the name exactly: QA unused photo/);
  const ok = planDeletion({ collection: 'photos', key: 'qa-unused-photo', confirm: ' qa unused  PHOTO ', files: ['/images/library/qa-unused-photo-0a1b2c3d4e.jpg'] }, repo);
  assert.deepEqual(ok.errors, []); assert.deepEqual(ok.paths, [QA_PHOTO, 'static/images/library/qa-unused-photo-0a1b2c3d4e.jpg']);
  const shared = JSON.parse((await diskFiles())['content/media/ph-clos-lighting.json']).src;
  assert.match(planDeletion({ collection: 'photos', key: 'qa-shared-file', confirm: 'QA shared file', files: [shared] }, repo).errors.join(), /shared, protected/);
  assert.match(planDeletion({ collection: 'photos', key: 'ph-clos-lighting', confirm: 'CLOS Lighting' }, repo).errors.join(), /still used/);
  assert.match(planDeletion({ collection: 'films', key: 'qa-unused-photo', confirm: 'QA unused photo' }, repo).errors.join(), /not a film/);
  assert.match(planDeletion({ collection: 'pricing', key: 'x' }, repo).errors.join(), /cannot be deleted here/);
  assert.match(planDeletion({ collection: 'photos', key: '../content/pricing' }, repo).errors.join(), /cannot be deleted here/);
});

// ---------- api/cms-manage.js against a fake GitHub ----------
function fakeGitHub(files, { refStatus = 200 } = {}) {
  const head = 'a'.repeat(40); const calls = [];
  const blobOid = (p) => (p in files ? 'b' + Buffer.from(p).toString('hex').slice(0, 39) : null);
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url); const body = opts.body ? JSON.parse(opts.body) : null; calls.push({ method: opts.method || 'GET', path: u.pathname, body });
    const json = (status, v) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
    if (u.pathname.endsWith('/git/ref/heads/redesign/2027-preview')) return json(200, { object: { sha: head } });
    if (u.pathname === '/graphql') {
      const data = {};
      for (const m of body.query.matchAll(/(\w+): object\(expression: "([0-9a-f]{40}):([^"]+)"\)/g)) {
        const [, alias, , p] = m;
        const kids = Object.keys(files).filter((f) => f.startsWith(p + '/'));
        if (/\{ oid \}/.test(body.query.slice(m.index, m.index + m[0].length + 12))) data[alias] = blobOid(p) ? { oid: blobOid(p) } : null;
        else if (kids.length) data[alias] = { entries: kids.map((f) => ({ name: f.slice(p.length + 1), type: 'blob', object: { text: files[f] } })) };
        else data[alias] = p in files ? { text: files[p] } : null;
      }
      return json(200, { data: { repository: data } });
    }
    if (u.pathname.endsWith(`/git/commits/${head}`)) return json(200, { tree: { sha: 't'.repeat(40) } });
    const del = u.pathname.match(/\/commits\/([0-9a-f]{40})$/);
    if (del && !u.pathname.includes('/git/')) {
      const dashboard = del[1].startsWith('d');
      return json(200, { commit: { message: dashboard ? 'Dashboard: delete photo “QA”' : 'Some other change' }, parents: [{ sha: 'e'.repeat(40) }], files: [{ filename: 'content/media/qa-restored.json', status: 'removed' }] });
    }
    if (u.pathname.endsWith('/git/trees')) return json(201, { sha: 'u'.repeat(40) });
    if (u.pathname.endsWith('/git/commits')) return json(201, { sha: 'c'.repeat(40) });
    if (u.pathname.includes('/git/refs/heads/')) return json(refStatus, {});
    return json(404, {});
  };
  return { head, calls };
}
async function call(body, { token = 'gho_' + 'x'.repeat(36), files, refStatus } = {}) {
  process.env.VERCEL_GIT_REPO_OWNER = 'photografikstudios'; process.env.VERCEL_GIT_REPO_SLUG = 'PS_website'; process.env.VERCEL_GIT_COMMIT_REF = 'redesign/2027-preview';
  const gh = fakeGitHub(files, { refStatus });
  const { default: handler } = await import('../api/cms-manage.js');
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(t) { this.body = JSON.parse(t); } };
  await handler({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
  return { status: res.statusCode, body: res.body, gh };
}

test('delete function: checks live data, needs the reviewed version, removes everything in one fast-forward commit', async () => {
  const realFetch = globalThis.fetch;
  try {
    const files = withSynthetic(await diskFiles());
    files['static/images/library/qa-unused-photo-0a1b2c3d4e.jpg'] = 'x';
    assert.equal((await call({ action: 'check', collection: 'photos', key: 'qa-unused-photo' }, { token: '', files })).status, 401);
    assert.equal((await call({ action: 'check', collection: 'pricing', key: 'x' }, { files })).status, 400);
    const check = await call({ action: 'check', collection: 'photos', key: 'qa-unused-photo' }, { files });
    assert.equal(check.status, 200); assert.equal(check.body.name, 'QA unused photo'); assert.deepEqual(check.body.blocking, []);
    // Cancelled: nothing is sent but checks. Stale: refused without writing.
    const stale = await call({ action: 'delete', collection: 'photos', key: 'qa-unused-photo', head: 'f'.repeat(40), confirm: 'QA unused photo' }, { files });
    assert.equal(stale.status, 409); assert.ok(stale.body.changed); assert.ok(!stale.gh.calls.some((c) => c.method !== 'GET' && c.path !== '/graphql'));
    // In use: refused.
    const inUse = await call({ action: 'delete', collection: 'photos', key: 'ph-clos-lighting', head: check.gh.head, confirm: 'CLOS Lighting' }, { files });
    assert.equal(inUse.status, 409); assert.match(inUse.body.message, /still used/);
    // Unused, with its own file: one tree that removes exactly two paths, one commit, a non-forced ref update.
    const ok = await call({ action: 'delete', collection: 'photos', key: 'qa-unused-photo', head: check.gh.head, confirm: 'QA unused photo', files: ['/images/library/qa-unused-photo-0a1b2c3d4e.jpg'] }, { files });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const tree = ok.gh.calls.find((c) => c.path.endsWith('/git/trees'));
    assert.deepEqual(tree.body.tree.map((t) => [t.path, t.sha]), [[QA_PHOTO, null], ['static/images/library/qa-unused-photo-0a1b2c3d4e.jpg', null]]);
    assert.equal(ok.gh.calls.filter((c) => c.path.endsWith('/git/commits') && c.method === 'POST').length, 1);
    assert.equal(ok.gh.calls.find((c) => c.method === 'PATCH').body.force, false);
    // A save at the same moment: the fast-forward fails and the answer says nothing was deleted.
    const race = await call({ action: 'delete', collection: 'photos', key: 'qa-unused-photo', head: check.gh.head, confirm: 'QA unused photo' }, { files, refStatus: 422 });
    assert.equal(race.status, 409); assert.match(race.body.message, /Nothing was deleted/);
  } finally { globalThis.fetch = realFetch; }
});

test('undo: only a dashboard deletion can be undone, and only while its files are still absent', async () => {
  const realFetch = globalThis.fetch;
  try {
    const files = await diskFiles();
    const other = await call({ action: 'restore', commit: 'f'.repeat(40) }, { files });
    assert.equal(other.status, 400); assert.match(other.body.message, /Only a deletion made from the dashboard/);
    // The removed file is absent now, but the fake has no earlier version of it: refused, nothing written.
    const missing = await call({ action: 'restore', commit: 'd'.repeat(40) }, { files });
    assert.equal(missing.status, 409); assert.ok(!missing.gh.calls.some((c) => c.method === 'PATCH'));
    // It exists again under the same name: refused.
    const again = await call({ action: 'restore', commit: 'd'.repeat(40) }, { files: { ...files, 'content/media/qa-restored.json': '{}' } });
    assert.equal(again.status, 409); assert.match(again.body.message, /same name exists again/);
  } finally { globalThis.fetch = realFetch; }
});
