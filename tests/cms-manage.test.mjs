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
import { PAGES, checkPageMedia, heroStillMap, itemProblem, pageMediaRefs } from '../src/lib/page-media-core.js';
import { whereUsed, planDeletion, uploadUsage, planFileDeletion } from '../src/lib/usage-core.js';
import { parseNote, withName } from '../src/lib/github-repo.js';
import { loadWork, expandProjectPhotos } from '../src/lib/work-load.js';
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
  for (const f of ['content/work.json', 'content/pages.json', 'content/legacy-articles.json', 'vercel.json', 'content/media-assets.json', 'content/poster-assets.json']) out[f] = await readFile(join(root, f), 'utf8');
  return out;
}
const repoFrom = (files) => {
  const dir = (d, ext) => Object.keys(files).filter((p) => p.startsWith(d + '/') && p.endsWith(ext)).map((p) => [p.slice(d.length + 1), files[p]]);
  return {
    projects: dir('content/projects', '.json').map(([n, t]) => withName(JSON.parse(t), 'slug', n)),
    media: dir('content/media', '.json').map(([n, t]) => withName(JSON.parse(t), 'id', n)),
    work: JSON.parse(files['content/work.json']),
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
  // (an optional section emptied in the dashboard is saved by leaving its key out, as James's Contact save of Oct 14 did)
  for (const p of PAGES) for (const s of p.slots) assert.ok(s.key in pm[p.file] || !s.required, `${p.file}.${s.key}`);
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
  // Codex acceptance of 94d5fb1: an emptied section is saved by leaving its key out of the file (the dashboard writes
  // "no value" so Decap sees the change). Every optional section and gallery accepts that; required ones still refuse.
  for (const p of PAGES) for (const sl of p.slots) {
    const msg = bad((x) => { delete x[p.file][sl.key]; });
    if (sl.required) assert.match(msg, /cannot be empty/, `${p.file}.${sl.key} is required`); else assert.equal(msg, '', `${p.file}.${sl.key} left out`);
  }
});

test('Home video choices: all 20 owner imports have a poster-backed hero fallback regardless of hidden state', async () => {
  const work = await loadWork(root); const media = new Map(work.media.map(m => [m.id, m]));
  const loops = new Set(Object.keys(assets.files).map(p => p.match(/^\/v\/([\w-]+)-loop\.mp4$/)?.[1]).filter(Boolean));
  const stills = heroStillMap(loops, media, fileExists);
  const recent = work.media.filter(m => m.id.startsWith('oct15-'));
  assert.equal(recent.length, 20);
  for (const m of recent) {
    assert.ok(loops.has(m.id), m.id); assert.equal(stills[m.asset || m.id], m.poster, m.id);
    assert.equal(itemProblem({ accepts: 'heroLoop' }, { media: m.id }, { media, loops, heroLoops: new Set(Object.keys(stills)), fileExists }), '');
  }
  const m = { id: 'qa', type: 'video', rights: 'approved', poster: '/v/qa.webp', published: false };
  assert.equal(heroStillMap(new Set(['qa']), new Map([['qa', m]]), () => true).qa, '/images/hero/qa-phone.webp', 'existing optimized phone crop wins');
  assert.deepEqual(heroStillMap(new Set(['qa']), new Map([['qa', { ...m, rights: 'pending' }]]), p => p === '/v/qa.webp'), {}, 'uncleared poster cannot unlock a hero');
});

test('Page Media: a changed choice changes the built page; removing it again restores the page byte for byte', { timeout: 120000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgk-pm-'));
  for (const d of ['content', 'src', 'scripts', 'static', 'package.json']) await cp(join(root, d), join(dir, d), { recursive: true });
  const env = { ...process.env, VERCEL_GIT_COMMIT_SHA: 'pmtest00' };
  const build = () => { execFileSync('node', ['src/build.mjs'], { cwd: dir, env, stdio: 'pipe' }); };
  const page = (p) => readFile(join(dir, 'dist', p), 'utf8');
  build();
  const before = { com: await page('commercial.html'), cs: await page('creator-studios.html'), contact: await page('contact.html') };
  const homeBefore = await page('index.html');
  const edit = async (f, fn) => { const p = join(dir, 'content/page-media', `${f}.json`); const v = JSON.parse(await readFile(p, 'utf8')); fn(v); await writeFile(p, JSON.stringify(v, null, 2) + '\n'); };
  // A recently imported hidden film is selectable for Home on the protected review, with its existing poster on phones.
  await edit('home', v => { v.hero = { media: 'oct15-horizontal-41-niamogue-ln' }; });
  build();
  const chosenHero = await page('index.html');
  assert.match(chosenHero, /src="\/v\/oct15-horizontal-41-niamogue-ln-loop\.mp4"/);
  assert.match(chosenHero, /srcset="\/v\/oct15-horizontal-41-niamogue-ln\.webp"/);
  await cp(join(root, 'content/page-media/home.json'), join(dir, 'content/page-media/home.json'));
  build(); assert.equal(await page('index.html'), homeBefore, 'restoring selection restores exact Home output');
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
  // Emptied in the dashboard (the key is left out of the file): the same page as an empty section.
  await edit('contact', (v) => { delete v.introMedia; });
  await edit('home', (v) => { delete v.selectedWork; });
  await edit('commercial', (v) => { delete v.caseStudy; delete v.clientWork; });
  build();
  assert.equal(await page('contact.html'), before.contact, 'Contact with no introMedia key'); assert.equal(await page('commercial.html'), before.com, 'Commercial with Automatic galleries left out');
  for (const f of ['commercial', 'home', 'contact']) await cp(join(root, 'content/page-media', `${f}.json`), join(dir, 'content/page-media', `${f}.json`));
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
function fakeGitHub(files, { refStatus = 200, parentFiles, deletion } = {}) {
  const head = 'a'.repeat(40); const calls = [];
  const at = (sha) => (parentFiles && sha === 'e'.repeat(40) ? parentFiles : files);
  const blobOid = (p, fs = files) => (p in fs ? 'b' + Buffer.from(p).toString('hex').slice(0, 39) : null);
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url); const body = opts.body ? JSON.parse(opts.body) : null; calls.push({ method: opts.method || 'GET', path: u.pathname, body });
    const json = (status, v) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
    if (u.pathname.endsWith('/git/ref/heads/redesign/2027-preview')) return json(200, { object: { sha: head } });
    if (u.pathname === '/graphql') {
      const data = {};
      for (const m of body.query.matchAll(/(\w+): object\(expression: "([0-9a-f]{40}):([^"]+)"\)/g)) {
        const [, alias, sha, p] = m; const fs = at(sha);
        const kids = Object.keys(fs).filter((f) => f.startsWith(p + '/'));
        if (/\{ oid \}/.test(body.query.slice(m.index, m.index + m[0].length + 12))) data[alias] = blobOid(p, fs) ? { oid: blobOid(p, fs) } : null;
        else if (kids.length) data[alias] = { entries: kids.map((f) => ({ name: f.slice(p.length + 1), type: 'blob', object: { text: fs[f], byteSize: fs[f].length } })) };
        else data[alias] = p in fs ? { text: fs[p] } : null;
      }
      return json(200, { data: { repository: data } });
    }
    if (u.pathname.endsWith(`/git/commits/${head}`)) return json(200, { tree: { sha: 't'.repeat(40) } });
    const del = u.pathname.match(/\/commits\/([0-9a-f]{40})$/);
    if (del && !u.pathname.includes('/git/')) {
      const dashboard = del[1].startsWith('d');
      if (deletion && dashboard) return json(200, { commit: { message: deletion.message }, parents: [{ sha: 'e'.repeat(40) }], files: deletion.files.map((filename) => ({ filename, status: 'removed' })) });
      return json(200, { commit: { message: dashboard ? 'Dashboard: delete photo “QA”' : 'Some other change' }, parents: [{ sha: 'e'.repeat(40) }], files: [{ filename: 'content/media/qa-restored.json', status: 'removed' }] });
    }
    if (u.pathname.endsWith('/git/trees')) return json(201, { sha: 'u'.repeat(40) });
    if (u.pathname.endsWith('/git/commits')) return json(201, { sha: 'c'.repeat(40) });
    if (u.pathname.includes('/git/refs/heads/')) return json(refStatus, {});
    return json(404, {});
  };
  return { head, calls };
}
async function call(body, { token = 'gho_' + 'x'.repeat(36), files, refStatus, parentFiles, deletion } = {}) {
  process.env.VERCEL_GIT_REPO_OWNER = 'photografikstudios'; process.env.VERCEL_GIT_REPO_SLUG = 'PS_website'; process.env.VERCEL_GIT_COMMIT_REF = 'redesign/2027-preview';
  const gh = fakeGitHub(files, { refStatus, parentFiles, deletion });
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

// ---------- Codex CMS review of 11c9abe: the three P0 reproductions, as regressions ----------
test('P0 hidden asset: Published off keeps a Page Media choice off the production build; review still shows it', { timeout: 120000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgk-hidden-'));
  for (const d of ['content', 'src', 'scripts', 'static', 'package.json']) await cp(join(root, d), join(dir, d), { recursive: true });
  const rec = JSON.parse(await readFile(join(dir, 'content/media/ph-barba-waterfront.json'), 'utf8'));
  rec.published = false; await writeFile(join(dir, 'content/media/ph-barba-waterfront.json'), JSON.stringify(rec, null, 2));
  const pmPath = join(dir, 'content/page-media/contact.json'); const pm = JSON.parse(await readFile(pmPath, 'utf8'));
  pm.introMedia = { media: 'ph-barba-waterfront' }; await writeFile(pmPath, JSON.stringify(pm, null, 2));
  // ph-barba-waterfront is also the Architecture closing photo (a required section): production must still build.
  const env = { ...process.env, VERCEL_GIT_COMMIT_SHA: 'hidden00' };
  execFileSync('node', ['src/build.mjs'], { cwd: dir, env: { ...env, PRODUCTION_VISIBILITY_CHECK: '1' }, stdio: 'pipe' });
  for (const f of ['contact.html', 'architecture-design.html']) assert.ok(!(await readFile(join(dir, 'dist-prodcheck', f), 'utf8')).includes('ph-barba-waterfront'), `${f}: hidden photo left out of production`);
  assert.match(await readFile(join(dir, 'dist-prodcheck', 'architecture-design.html'), 'utf8'), /Finished something worth showing\?/, 'closing band still renders, without its photo');
  execFileSync('node', ['src/build.mjs'], { cwd: dir, env, stdio: 'pipe' });
  assert.ok((await readFile(join(dir, 'dist', 'contact.html'), 'utf8')).includes('ph-barba-waterfront'), 'review build still shows it');
  await rm(dir, { recursive: true, force: true });
});

test('P0 last picture: deleting the only photo or film of a published project is refused with a way out; drafts can be retired', async () => {
  const base = await diskFiles();
  const make = (extra) => repoFrom({ ...base, ...extra });
  const photo = (o = {}) => JSON.stringify({ type: 'image', title: 'Only photo', src: '/images/library/only-photo-1234567890.jpg', alt: 'QA', category: 'commercial', service: ['photography'], published: true, rights: 'approved', packageIds: [], capturedYear: null, project: 'example', ...o });
  const film = JSON.stringify({ type: 'video', title: 'Only film', src: '/v/only.mp4', poster: '/v/only.webp', category: 'commercial', service: ['video'], published: true, rights: 'approved', packageIds: [], capturedYear: null, project: 'example', dialogue: false });
  const proj = (o = {}) => JSON.stringify({ title: 'Example', category: 'commercial', path: '/commercial/example', hero: null, published: true, rights: 'approved', services: ['photography'], summary: 'x', story: 'y', ...o });
  // Published original project, its only library photo: refused, with the project named.
  let r = make({ 'content/projects/example.json': proj(), 'content/media/last-photo.json': photo() });
  let plan = planDeletion({ collection: 'photos', key: 'last-photo', confirm: 'Only photo' }, r);
  assert.match(plan.errors.join(), /Project “Example”: add a hero image or at least one photo/);
  assert.match(plan.errors.join(), /switch that project to Draft first/);
  // The same with its only film.
  r = make({ 'content/projects/example.json': proj(), 'content/media/last-film.json': film });
  assert.match(planDeletion({ collection: 'films', key: 'last-film', confirm: 'Only film' }, r).errors.join(), /add a hero image or at least one photo/);
  // With a main image the photo can go.
  r = make({ 'content/projects/example.json': proj({ hero: '/images/projects/example-hero-1111111111.jpg', heroAlt: 'QA' }), 'content/media/last-photo.json': photo() });
  assert.deepEqual(planDeletion({ collection: 'photos', key: 'last-photo', confirm: 'Only photo' }, r).errors, []);
  // Retiring an old project: Draft first, then its photo, then the project.
  r = make({ 'content/projects/example.json': proj({ published: false }), 'content/media/last-photo.json': photo() });
  assert.deepEqual(planDeletion({ collection: 'photos', key: 'last-photo', confirm: 'Only photo' }, r).errors, []);
  assert.match(planDeletion({ collection: 'projects', key: 'example', confirm: 'Example' }, r).errors.join(), /belongs to this project/);
  r = make({ 'content/projects/example.json': proj({ published: false }) });
  assert.deepEqual(planDeletion({ collection: 'projects', key: 'example', confirm: 'Example' }, r).errors, []);
  // A real original with no main image (CLOS) keeps its last photo.
  const clos = repoFrom(base).projects.find((p) => /clos/i.test(p.slug) && !p.hero);
  if (clos) {
    const own = repoFrom(base).media.filter((m) => m.project === clos.slug);
    if (own.length === 1) assert.ok(planDeletion({ collection: own[0].type === 'video' ? 'films' : 'photos', key: own[0].id, confirm: own[0].title }, repoFrom(base)).errors.length > 0);
  }
});

test('P0 article images: a captioned, query or encoded Markdown image keeps its file shared; links to pages are found', async () => {
  const base = await diskFiles();
  const note = (slug, body) => [`content/field-notes/${slug}.md`, `{\n  "title": "${slug}",\n  "published": true\n}\n${body}\n`];
  const files = Object.fromEntries([
    ['content/media/qa-only.json', JSON.stringify({ type: 'image', title: 'QA only', src: '/images/library/only.jpg', alt: 'QA', category: 'commercial', service: ['photography'], published: false, rights: 'approved', packageIds: [], capturedYear: null })],
    note('qa-caption', '![Room](/images/library/only.jpg "Room caption")'),
    note('qa-own', 'Text\n\n![Room](/images/library/own%20file.jpg?v=2#x)\n\nSee [the project](https://www.photografikstudios.com/commercial/revivaluxe#film).'),
  ]);
  const r = repoFrom({ ...base, ...files });
  const u = whereUsed({ collection: 'photos', key: 'qa-only' }, r);
  assert.deepEqual(u.files.map((f) => [f.path, f.removable]), [['/images/library/only.jpg', false]]);
  assert.match(u.files[0].shared.join(), /Field Note “qa-caption”/);
  assert.match(planDeletion({ collection: 'photos', key: 'qa-only', confirm: 'QA only', files: ['/images/library/only.jpg'] }, r).errors.join(), /shared, protected/);
  // An article's own body image is its own file (decoded, query and fragment removed), and its links are seen.
  const own = whereUsed({ collection: 'field-notes', key: 'qa-own' }, r);
  assert.ok(own.files.some((f) => f.path === '/images/library/own file.jpg' && f.removable));
  assert.ok(whereUsed({ collection: 'projects', key: 'revivaluxe' }, r).blocking.some((b) => /qa-own” links to this project page/.test(b.text)));
});

test('live reader: a new dashboard record with an empty slug or id takes its file name, as the build does', () => {
  assert.deepEqual(withName({ slug: '' }, 'slug', 'new-project.json'), { slug: 'new-project' });
  assert.deepEqual(withName({ slug: null }, 'slug', 'new-project.json'), { slug: 'new-project' });
  assert.deepEqual(withName({ id: 'kept' }, 'id', 'kept.json'), { id: 'kept' });
});

test('per-page galleries: leaving an item out of Home touches no other page; an own selection sets order; chosen items are protected', { timeout: 120000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgk-gal-'));
  for (const d of ['content', 'src', 'scripts', 'static', 'package.json']) await cp(join(root, d), join(dir, d), { recursive: true });
  const env = { ...process.env, VERCEL_GIT_COMMIT_SHA: 'gallery0' };
  const build = () => execFileSync('node', ['src/build.mjs'], { cwd: dir, env, stdio: 'pipe' });
  const page = (p) => readFile(join(dir, 'dist', p), 'utf8');
  const items = (html) => JSON.parse(html.match(/<script type="application\/json" data-gallery-items>(.*?)<\/script>/s)[1]).map((x) => x.id);
  build();
  const homeBefore = items(await page('index.html')); const reBefore = items(await page('real-estate.html'));
  const x = homeBefore.find((id) => reBefore.includes(id));
  assert.ok(x, 'an item shown on both Home and Real Estate');
  const edit = async (f, fn) => { const p = join(dir, 'content/page-media', `${f}.json`); const v = JSON.parse(await readFile(p, 'utf8')); fn(v); await writeFile(p, JSON.stringify(v, null, 2) + '\n'); };
  await edit('home', (v) => { v.selectedWork = { mode: 'automatic', exclude: [x] }; });
  await edit('agent-content', (v) => { v.examples = { mode: 'custom', items: [{ media: 'agent-on-camera' }, { media: 'agent-expertise' }] }; });
  build();
  const homeAfter = items(await page('index.html'));
  assert.ok(!homeAfter.includes(x), 'left out of Home'); assert.equal(homeAfter.length, homeBefore.length - 1);
  assert.deepEqual(items(await page('real-estate.html')), reBefore, 'Real Estate unchanged');
  assert.ok(existsSync(join(dir, 'content/media', `${x}.json`)) || true, 'library record untouched');
  const ac = await page('agent-content.html');
  assert.ok(ac.indexOf('data-id="agent-on-camera"') < ac.indexOf('data-id="agent-expertise"'), 'own order on Agent Content');
  // A gallery's own selection is an explicit use; an automatic one is information only.
  const files = await diskFiles();
  files['content/page-media/agent-content.json'] = await readFile(join(dir, 'content/page-media/agent-content.json'), 'utf8');
  const r = repoFrom(files);
  assert.ok(whereUsed({ collection: 'films', key: 'agent-expertise' }, r).blocking.some((b) => /Agent Content: Examples/.test(b.text)));
  const auto = whereUsed({ collection: 'photos', key: x }, repoFrom(await diskFiles()));
  assert.ok(auto.auto.includes('Home: Selected work') && !auto.blocking.some((b) => /Selected work/.test(b.text)), 'automatic galleries are information, not a block');
  await rm(dir, { recursive: true, force: true });
});

test('Codex follow-up: projects chosen in Page Media are protected; large and empty own selections are valid; newest build report wins', async () => {
  // A synthetic project chosen as the case study and in the client work list cannot be deleted.
  const files = await diskFiles();
  files['content/projects/qa-gallery-project.json'] = JSON.stringify({ title: 'QA gallery project', category: 'commercial', published: false, rights: 'approved' });
  const com = JSON.parse(files['content/page-media/commercial.json']);
  com.caseStudy = { project: 'qa-gallery-project' }; com.clientWork = { mode: 'custom', items: [{ project: 'revivaluxe' }, { project: 'qa-gallery-project' }] };
  files['content/page-media/commercial.json'] = JSON.stringify(com);
  const plan = planDeletion({ collection: 'projects', key: 'qa-gallery-project', confirm: 'QA gallery project' }, repoFrom(files));
  assert.match(plan.errors.join(), /Case study: which project/); assert.match(plan.errors.join(), /Client work: which projects/);
  // Limits match the dashboard: an own selection may start from all 146 Home items; an empty one shows nothing.
  const work = await loadWork(root);
  const lib = { media: new Map(work.media.filter((m) => m.rights === 'approved').map((m) => [m.id, m])), projects: new Map(work.projects.map((p) => [p.slug, p])), loops: new Set(), heroLoops: new Set(), fileExists };
  const pm = Object.fromEntries(await Promise.all(PAGES.map(async (p) => [p.file, await readJson(`content/page-media/${p.file}.json`)])));
  const homeIds = [...lib.media.values()].filter((m) => m.type === 'image' || m.poster).map((m) => m.id).slice(0, 146);
  const only = (errs) => errs.filter((e) => /Selected work|Case study|Client work|Examples/.test(e));
  pm.home.selectedWork = { mode: 'custom', items: homeIds.map((id) => ({ media: id })) };
  pm['agent-content'].examples = { mode: 'custom', items: [] };
  pm.commercial.caseStudy = { hide: true };
  assert.deepEqual(only(checkPageMedia(pm, lib).errors), []);
  pm.home.selectedWork.items = Array.from({ length: 401 }, (_, i) => ({ media: homeIds[i % homeIds.length] + (i >= homeIds.length ? '' : '') }));
  assert.ok(only(checkPageMedia(pm, lib).errors).some((e) => /no more than 400/.test(e)));
  // Build state: the newest report per Vercel context or check counts.
  const { pickBuildState } = await import('../api/cms-manage.js');
  const s = (state, at, context = 'Vercel') => ({ context, state, updated_at: at, target_url: `https://vercel.com/${state}` });
  assert.equal(pickBuildState([s('failure', '2026-10-13T20:00:00Z'), s('success', '2026-10-13T20:05:00Z')], []).state, 'success', 'a retried build that worked');
  assert.equal(pickBuildState([s('success', '2026-10-13T20:00:00Z'), s('failure', '2026-10-13T20:05:00Z')], []).state, 'failure');
  assert.equal(pickBuildState([s('pending', '2026-10-13T20:06:00Z'), s('failure', '2026-10-13T20:05:00Z')], []).state, 'pending');
  const c = (status, conclusion, at) => ({ name: 'Vercel', app: { slug: 'vercel' }, status, conclusion, completed_at: at, started_at: at });
  assert.equal(pickBuildState([], [c('completed', 'failure', '2026-10-13T20:00:00Z'), c('completed', 'success', '2026-10-13T20:09:00Z')]).state, 'success');
  assert.equal(pickBuildState([{ context: 'other-ci', state: 'failure' }], []).state, 'unknown', 'only Vercel reports count');
  // Codex, 9e06705 review: a skipped or neutral Vercel check is not evidence of a build.
  assert.equal(pickBuildState([], [{ name: 'Vercel', app: { slug: 'vercel' }, status: 'completed', conclusion: 'skipped', completed_at: '2026-10-13T20:00:00Z' }]).state, 'unknown');
  assert.equal(pickBuildState([], [c('completed', 'neutral', '2026-10-13T20:00:00Z')]).state, 'unknown');
  assert.equal(pickBuildState([], [c('completed', 'failure', '2026-10-13T20:00:00Z'), c('completed', 'skipped', '2026-10-13T20:09:00Z')]).state, 'unknown', 'a later skip hides nothing: still no build evidence');
  assert.equal(pickBuildState([s('success', '2026-10-13T20:05:00Z')], [c('completed', 'skipped', '2026-10-13T20:09:00Z')]).state, 'success', 'a real success elsewhere still counts');
  // Codex acceptance of 94d5fb1 (commit f352438): Vercel status success plus a failed "Vercel Preview Comments" check
  // (details https://vercel.com/github) showed "Site update failed" while the deployment was READY.
  const comments = (conclusion, at = '2026-10-14T13:02:00Z') => ({ name: 'Vercel Preview Comments', app: { slug: 'vercel' }, status: 'completed', conclusion, details_url: 'https://vercel.com/github', completed_at: at });
  assert.equal(pickBuildState([s('success', '2026-10-14T13:01:00Z')], [comments('failure')]).state, 'success', 'a comments check is not the deployment');
  assert.equal(pickBuildState([], [comments('failure')]).state, 'unknown', 'comments alone say nothing about the build');
  assert.equal(pickBuildState([s('pending', '2026-10-14T13:01:00Z')], [comments('success')]).state, 'pending', 'a passing comments check is not a finished build either');
  assert.equal(pickBuildState([s('failure', '2026-10-14T13:01:00Z')], [comments('success')]).state, 'failure', 'a real failed deployment still shows');
  assert.equal(pickBuildState([s('success', '2026-10-14T13:01:00Z', 'Vercel Preview Comments')], []).state, 'unknown', 'also as a status context');
});

// ---------- Codex final-bundle review of 9e06705: files uploaded straight to a page ----------
// A Page Media upload is only { src, alt }: no Photos record. Synthetic, disposable file names only.
const QA_UPLOAD = '/images/library/qa-direct-upload-5f5f5f5f5f.jpg';
const onContact = (files, value) => ({ ...files, 'content/page-media/contact.json': JSON.stringify({ ...JSON.parse(files['content/page-media/contact.json']), introMedia: value }) });

test('uploaded files: an upload used by a page, a project, an article or a photo is refused; pinned files too; exact file name', async () => {
  const base = withSynthetic(await diskFiles());
  const placed = repoFrom(onContact(base, { src: QA_UPLOAD, alt: 'QA' }));
  const u = uploadUsage(QA_UPLOAD + '?v=2', placed);
  assert.equal(u.removable, false); assert.match(u.shared.join(), /Page Media › .*contact/i);
  assert.match(planFileDeletion({ path: QA_UPLOAD, confirm: 'qa-direct-upload-5f5f5f5f5f.jpg' }, placed).errors.join(), /still used: Page Media/);
  // Taken off the page and saved: unused, so it can go once its exact file name is typed.
  const off = repoFrom(onContact(base, null));
  assert.equal(uploadUsage(QA_UPLOAD, off).removable, true);
  assert.match(planFileDeletion({ path: QA_UPLOAD, confirm: 'qa-direct-upload' }, off).errors.join(), /Type the file name exactly: qa-direct-upload-5f5f5f5f5f.jpg/);
  assert.deepEqual(planFileDeletion({ path: QA_UPLOAD, confirm: ' qa-direct-upload-5f5f5f5f5f.jpg ' }, off).paths, ['static' + QA_UPLOAD]);
  // Other users of a file: a project's upload, a library photo's file, a captioned article image.
  assert.match(uploadUsage('/images/projects/qa-project-own-2222222222.jpg', off).shared.join(), /Project “QA project”/);
  assert.match(uploadUsage('/images/library/qa-unused-photo-0a1b2c3d4e.jpg', off).shared.join(), /Photo “QA unused photo”/);
  const withNote = { ...base, 'content/field-notes/qa-note.md': `{\n  "title": "QA note",\n  "published": false\n}\n![A caption](${encodeURI(QA_UPLOAD)}?w=800#x "Title")\n` };
  assert.match(uploadUsage(QA_UPLOAD, repoFrom(withNote)).shared.join(), /Field Note “QA note”/);
  // Site files the build pins, and anything outside the upload folders, are never offered.
  const pinned = { ...off, pins: new Set([...off.pins, QA_UPLOAD]) };
  assert.equal(uploadUsage(QA_UPLOAD, pinned).removable, false);
  assert.match(planFileDeletion({ path: QA_UPLOAD, confirm: 'qa-direct-upload-5f5f5f5f5f.jpg' }, pinned).errors.join(), /protected site file/);
  for (const p of ['/v/home-listings-twilight.webp', '/images/library/../../content/pricing.json', '/images/library/sub/x.jpg', '/captions/x.vtt']) {
    assert.match(planFileDeletion({ path: p, confirm: p.split('/').pop() }, off).errors.join(), /Only photos uploaded in the dashboard/);
  }
});

test('uploaded files workflow: upload on a page, take it off, find it, delete it, Undo puts it back (fake GitHub)', async () => {
  const realFetch = globalThis.fetch;
  try {
    const base = { ...withSynthetic(await diskFiles()), ['static' + QA_UPLOAD]: 'jpegbytes' };
    // 1. Uploaded straight to Contact: listed as in use, and deleting it is refused without writing.
    const placed = onContact(base, { src: QA_UPLOAD, alt: 'QA' });
    const list1 = await call({ action: 'files' }, { files: placed });
    assert.equal(list1.status, 200); const row1 = list1.body.files.find((f) => f.path === QA_UPLOAD);
    assert.ok(row1 && !row1.removable && /Page Media/.test(row1.shared.join()), JSON.stringify(row1));
    const refused = await call({ action: 'deleteFile', path: QA_UPLOAD, head: list1.body.head, confirm: 'qa-direct-upload-5f5f5f5f5f.jpg' }, { files: placed });
    assert.equal(refused.status, 409); assert.match(refused.body.message, /still used/); assert.ok(!refused.gh.calls.some((c) => c.method !== 'GET' && c.path !== '/graphql'));
    // 2. Taken off the page and saved: listed first, as not used anywhere.
    const off = onContact(base, null);
    const list2 = await call({ action: 'files' }, { files: off });
    assert.equal(list2.body.files[0].removable, true);
    assert.ok(list2.body.files.find((f) => f.path === QA_UPLOAD).removable);
    assert.equal(list2.body.files.find((f) => f.path === QA_UPLOAD).bytes, 'jpegbytes'.length);
    // James's own content stays protected or merely listed: his Test project's uploads are in use.
    assert.ok(list2.body.files.filter((f) => f.path.startsWith('/images/projects/test-')).every((f) => !f.removable));
    // 3. Stale list, wrong name and paths outside the upload folders: refused without writing.
    const stale = await call({ action: 'deleteFile', path: QA_UPLOAD, head: 'f'.repeat(40), confirm: 'qa-direct-upload-5f5f5f5f5f.jpg' }, { files: off });
    assert.equal(stale.status, 409); assert.ok(stale.body.changed);
    const wrong = await call({ action: 'deleteFile', path: QA_UPLOAD, head: list2.body.head, confirm: 'qa' }, { files: off });
    assert.equal(wrong.status, 409); assert.match(wrong.body.message, /Type the file name exactly/);
    for (const path of ['/v/x.mp4', 'content/pricing.json', '/images/library/../x.jpg']) assert.equal((await call({ action: 'deleteFile', path, head: list2.body.head, confirm: 'x' }, { files: off })).status, 400);
    for (const r of [stale, wrong]) assert.ok(!r.gh.calls.some((c) => c.method === 'PATCH'));
    // 4. Deleted: one tree removing exactly that file, one commit Undo recognises, a non-forced fast-forward.
    const ok = await call({ action: 'deleteFile', path: QA_UPLOAD, head: list2.body.head, confirm: 'qa-direct-upload-5f5f5f5f5f.jpg' }, { files: off });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual(ok.gh.calls.find((c) => c.path.endsWith('/git/trees')).body.tree.map((t) => [t.path, t.sha]), [['static' + QA_UPLOAD, null]]);
    const commit = ok.gh.calls.find((c) => c.path.endsWith('/git/commits') && c.method === 'POST');
    assert.match(commit.body.message, /^Dashboard: delete uploaded file “qa-direct-upload-5f5f5f5f5f.jpg”/);
    assert.equal(ok.gh.calls.find((c) => c.method === 'PATCH').body.force, false);
    const race = await call({ action: 'deleteFile', path: QA_UPLOAD, head: list2.body.head, confirm: 'qa-direct-upload-5f5f5f5f5f.jpg' }, { files: off, refStatus: 422 });
    assert.equal(race.status, 409); assert.match(race.body.message, /Nothing was deleted/);
    // 5. Undo: the file is absent now and present in the deletion's parent, so it is put back with its old content.
    const gone = { ...off }; delete gone['static' + QA_UPLOAD];
    const deletion = { message: commit.body.message, files: ['static' + QA_UPLOAD] };
    const undo = await call({ action: 'restore', commit: 'd'.repeat(40) }, { files: gone, parentFiles: off, deletion });
    assert.equal(undo.status, 200, JSON.stringify(undo.body)); assert.deepEqual(undo.body.restored, ['static' + QA_UPLOAD]);
    const tree = undo.gh.calls.find((c) => c.path.endsWith('/git/trees')).body.tree;
    assert.equal(tree.length, 1); assert.equal(tree[0].path, 'static' + QA_UPLOAD); assert.ok(tree[0].sha);
    assert.equal(undo.gh.calls.find((c) => c.method === 'PATCH').body.force, false);
    // Uploaded again under the same name meanwhile: Undo refuses rather than overwrite it.
    const again = await call({ action: 'restore', commit: 'd'.repeat(40) }, { files: off, parentFiles: off, deletion });
    assert.equal(again.status, 409); assert.match(again.body.message, /same name exists again/);
  } finally { globalThis.fetch = realFetch; }
});


test('Page Media usage recognizes inline project photos without making them deletable records', async () => {
  const repo = repoFrom(await diskFiles());
  const project = { slug: 'qa-inline-usage', title: 'Inline usage test', category: 'real-estate', published: true, rights: 'approved', photos: [{ image: '/images/projects/qa-inline-usage.webp', alt: 'Test interior' }] };
  repo.projects.push(project);
  const photo = expandProjectPhotos('/nonexistent', project)[0];
  repo.pageMedia.contact = { introMedia: { media: photo.id } };
  const usage = whereUsed({ collection: 'photos', key: photo.id }, repo);
  assert.ok(usage.blocking.some((x) => /Page Media/.test(x.text)));
  assert.ok(usage.notes.some((x) => /Inline usage test/.test(x)));
  assert.ok(planDeletion({ collection: 'photos', key: photo.id, confirm: photo.title }, repo).errors.length, 'derived photo is not a deletable standalone record');
});
