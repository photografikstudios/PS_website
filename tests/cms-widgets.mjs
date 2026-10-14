// Dashboard widgets (src/admin/cms.js) in a real browser, without Decap: Decap itself loads from unpkg, which this
// test environment cannot reach, so a ~60-line stand-in provides the few things the widgets use (createClass, h,
// CMS.registerWidget, Immutable-style get/getIn/toJS). It catches runtime errors and checks behaviour; the real Decap
// walk on the deployed preview is still needed (Codex). Usage: node src/build.mjs && node tests/cms-widgets.mjs
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const configJs = await readFile(join(root, 'dist/admin/config.js'), 'utf8');
const cmsJs = await readFile(join(root, 'src/admin/cms.js'), 'utf8');

const harness = `
window.__registered = {}; window.__logs = [];
const instances = new Map(); let mounts = []; let pending = false;
function h(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false && c !== true) }; }
function createClass(spec) {
  // Like create-react-class (which Decap uses), every method is bound to its instance.
  function C(props) { for (const k of Object.keys(spec)) if (typeof spec[k] === 'function') this[k] = spec[k].bind(this); this.props = props; this.state = spec.getInitialState ? spec.getInitialState.call(this) : {}; }
  Object.assign(C.prototype, spec);
  C.prototype.setState = function (p) { Object.assign(this.state, typeof p === 'function' ? p(this.state) : p); schedule(); };
  C.prototype.forceUpdate = function () { schedule(); };
  C.isClass = true; return C;
}
function schedule() { if (pending) return; pending = true; setTimeout(() => { pending = false; mounts.forEach((m) => m.draw()); }, 0); }
const BOOL = ['disabled', 'hidden', 'multiple', 'muted', 'controls', 'checked', 'autoFocus', 'playsInline'];
let drawn = null; let newlyMounted = [];
function renderNode(v, path) {
  if (typeof v === 'string' || typeof v === 'number') return document.createTextNode(String(v));
  if (Array.isArray(v)) { const f = document.createDocumentFragment(); v.forEach((c, i) => f.appendChild(renderNode(c, path + '.' + i))); return f; }
  if (typeof v.type === 'function') {
    const props = Object.assign({}, v.props, { children: v.children });
    if (!v.type.isClass) return renderNode(v.type(props), path + ':f');
    const key = path + ':' + (v.props.key || '');
    let inst = instances.get(key);
    if (!inst || inst.constructor !== v.type) { if (inst && inst.componentWillUnmount) inst.componentWillUnmount(); inst = new v.type(props); instances.set(key, inst); if (inst.componentDidMount) newlyMounted.push([key, inst]); }
    if (drawn) drawn.add(key);
    inst.props = props; return renderNode(inst.render(), key);
  }
  const el = document.createElement(v.type);
  for (const [k, val] of Object.entries(v.props)) {
    if (k === 'key' || k === 'children') continue;
    if (k === 'ref') { if (typeof val === 'function') val(el); continue; }
    if (k === 'className') el.className = val;
    else if (k === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else if (k.startsWith('on') && typeof val === 'function') {
      const ev = k === 'onChange' ? (['SELECT'].includes(el.tagName) || ['checkbox', 'radio', 'file'].includes(v.props.type) ? 'change' : 'input') : k.slice(2).toLowerCase();
      el.addEventListener(ev, val);
    } else if (k === 'value') el.value = val;
    else if (BOOL.includes(k)) { el[k === 'autoFocus' ? 'autofocus' : k === 'playsInline' ? 'playsInline' : k] = !!val; if (val) el.setAttribute(k.toLowerCase(), ''); }
    else if (val !== undefined && val !== null) el.setAttribute(k, val);
  }
  v.children.forEach((c, i) => el.appendChild(renderNode(c, path + '.' + i)));
  return el;
}
const wrap = (x) => (x !== null && typeof x === 'object' ? { get: (k) => wrap(x[k]), getIn: (p) => p.reduce((a, k) => (a == null ? a : a[k]), x) && wrap(p.reduce((a, k) => (a == null ? a : a[k]), x)), toJS: () => JSON.parse(JSON.stringify(x)), _raw: x } : x);
window.mountWidget = function (name, { field, value, entry, collection }) {
  const host = document.createElement('div'); host.className = 'host-' + name; document.body.appendChild(host);
  const state = { value };
  const Ctrl = window.__registered[name];
  const m = { id: name + '#' + mounts.length, state, draw() {
    // React keeps the focused element across updates; this stand-in rebuilds the DOM, so it puts focus back on the
    // element with the same accessible name.
    const a = document.activeElement; const keyOf = (el) => (el.getAttribute('aria-label') || el.textContent.trim()) + '|' + el.tagName;
    const focusKey = a && host.contains(a) ? keyOf(a) : null;
    host.innerHTML = '';
    const props = { value: state.value, onChange: (v) => { state.value = v && v.toJS ? v.toJS() : v; schedule(); }, field: wrap(field), forID: m.id.replace('#', '-'),
      entry: wrap(Object.assign({ data: {} }, entry)), collection: wrap({ name: collection }), getAsset: (p) => p, onPersistMedia: (file) => Promise.resolve({ payload: { path: 'static/images/library/' + file.name } }) };
    drawn = new Set();
    host.appendChild(renderNode(h(Ctrl, props), m.id));
    // Like React: components that were not drawn this time are unmounted.
    for (const [k, inst] of [...instances]) if (k.startsWith(m.id + ':') && !drawn.has(k)) { if (inst.componentWillUnmount) inst.componentWillUnmount(); instances.delete(k); }
    drawn = null;
    // React calls componentDidMount on children before their parents.
    const fresh = newlyMounted.reverse(); newlyMounted = [];
    setTimeout(() => fresh.forEach(([k, i]) => instances.get(k) === i && i.componentDidMount()), 0);
    if (focusKey) { const again = Array.prototype.find.call(host.querySelectorAll('button, input, select, a'), (el) => keyOf(el) === focusKey); if (again) again.focus(); }
    m.instance = instances.get(m.id + ':');
  } };
  mounts.push(m); m.draw(); return m;
};
window.CMS = { registerWidget: (n, c) => { window.__registered[n] = c; }, registerPreviewTemplate() {}, registerPreviewStyle() {}, registerEditorComponent() {}, registerLocale() {}, registerEventListener() {}, init() {} };
window.h = h; window.createClass = createClass;
localStorage.setItem('decap-cms-user', JSON.stringify({ token: 'gho_${'x'.repeat(36)}', backendName: 'github' }));
`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); page.setDefaultTimeout(8000);
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
// Routes added later win in Playwright, so the catch-all page goes first.
await page.route('http://pgk.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
const manageCalls = []; let buildReply = { state: 'pending' }; const uploadsHead = '9'.repeat(40);
await page.route('**/api/cms-manage', async (route) => {
  const b = JSON.parse(route.request().postData()); manageCalls.push(b);
  const head = 'a'.repeat(40);
  const reply = (s, v) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(v) });
  if (b.action === 'head') return reply(200, { ok: true, head, build: buildReply });
  if (b.action === 'check' && b.key === 'ph-clos-lighting') return reply(200, { ok: true, head, name: 'CLOS Lighting', blocking: [{ text: 'Page Media › Commercial: “What we do”, Recurring production', href: '#/collections/page-media/entries/commercial' }], notes: [], files: [] });
  if (b.action === 'check') return reply(200, { ok: true, head, name: 'QA unused photo', blocking: [], notes: [], auto: ['Home: Selected work'], files: [{ path: '/images/library/qa.jpg', shared: [], pinned: false, removable: true }, { path: '/images/library/shared.jpg', shared: ['Photo “Other”'], pinned: false, removable: false }] });
  if (b.action === 'delete') return reply(200, { ok: true, commit: 'c'.repeat(40), removed: ['content/media/qa-unused-photo.json', 'static/images/library/qa.jpg'], message: 'Deleted photo “QA unused photo”.' });
  if (b.action === 'restore') return reply(200, { ok: true, commit: 'r'.repeat(40), restored: [], message: 'Restored.' });
  if (b.action === 'files') return reply(200, { ok: true, head: uploadsHead, files: [
    { path: '/images/library/qa-direct-upload-5f5f5f5f5f.jpg', shared: [], pinned: false, removable: true, bytes: 1200 },
    { path: '/images/library/qa-on-a-page.jpg', shared: ['Page Media › Send a Project Brief (contact): Above the form'], pinned: false, removable: false, bytes: 900 },
  ] });
  if (b.action === 'deleteFile') return reply(200, { ok: true, commit: 'd'.repeat(40), removed: ['static' + b.path], message: 'Deleted the file ' + b.path.split('/').pop() + '.' });
  return reply(400, { ok: false });
});
let statusReply = { commit: 'b'.repeat(40), builtAt: '2026-10-13T19:00:00Z', mode: 'review', held: [], reviewOnly: [{ collection: 'projects', id: '0123456789abcdef' }] };
await page.route('**/admin/status.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(statusReply) }));
// GitHub, as the film form asks it: the saved record, the commit that saved it, and the import run of that commit.
await page.route('https://api.github.com/**', (r) => {
  const u = r.request().url(); const j = (v) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
  if (/\/contents\/content\/media\/qa-film-done\.json/.test(u)) return j({ type: 'video', import: { state: 'ready' } });
  if (/\/contents\//.test(u)) return j({ type: 'video', import: { state: 'waiting' } });
  if (/\/commits\?/.test(u)) return j([{ sha: 'f'.repeat(40), commit: { committer: { date: new Date().toISOString() } } }]);
  if (/head_sha=f{40}/.test(u)) return j({ workflow_runs: [{ status: 'in_progress', created_at: '2026-10-13T19:20:00Z' }] });
  return j({});
});
await page.goto('http://pgk.test/admin/');
await page.addScriptTag({ content: harness });
await page.addScriptTag({ content: configJs });
await page.addScriptTag({ content: cmsJs });
const pm = (f) => readFile(join(root, 'content/page-media', f + '.json'), 'utf8').then(JSON.parse);
const slotField = async (file, key) => {
  const cfg = JSON.parse(configJs.match(/PHOTOGRAFIK_CMS_CONFIG = (\{.*\});/)[1]);
  return cfg.collections.find((c) => c.name === 'page-media').files.find((f) => f.name === file).fields.find((x) => x.name === key);
};
const results = [];
const check = async (name, fn) => { console.log('… ' + name); try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const valid = (cls) => page.evaluate((c) => { const m = window.__mounts?.[c]; return null; }, cls);

await check('registered widgets', async () => {
  const names = await page.evaluate(() => Object.keys(window.__registered).sort());
  for (const n of ['pgk-slot', 'pgk-page-note', 'pgk-manage', 'pgk-film-status', 'pgk-captions', 'pgk-gallery', 'pgk-photo', 'pgk-publish']) assert.ok(names.includes(n), n);
});

await check('Page Media single required section: shows the item, cannot be emptied, replace from the library', async () => {
  const field = await slotField('commercial', 'featureRecurring'); const value = (await pm('commercial')).featureRecurring;
  await page.evaluate(({ field, value }) => { window.__slot1 = window.mountWidget('pgk-slot', { field, value, entry: { slug: 'commercial' }, collection: 'page-media' }); }, { field, value });
  const host = page.locator('.host-pgk-slot').first();
  await host.locator('.pgk-row__title strong').first().waitFor();
  assert.match(await host.locator('.pgk-row__title').first().innerText(), /Photo/);
  assert.ok(await host.locator('img.pgk-thumb').first().getAttribute('src'));
  assert.equal(await host.getByRole('button', { name: 'Take off this page' }).isDisabled(), true, 'required: cannot be emptied');
  await host.getByRole('button', { name: 'Replace from library' }).click();
  const dlg = page.getByRole('dialog', { name: 'Choose from the library' }).last();
  await dlg.waitFor();
  const count = await dlg.locator('.pgk-modal__count').innerText();
  assert.match(count, /that fit this section/);
  await dlg.getByLabel('Search the library').fill('torella');
  await dlg.locator('.pgk-pick').first().click();
  await dlg.getByRole('button', { name: 'Use this' }).click();
  await page.waitForTimeout(50);
  const v = await page.evaluate(() => window.__slot1.state.value);
  assert.equal(v.media.startsWith('ph-torella') || v.media.includes('torella'), true, JSON.stringify(v));
  assert.equal(await page.evaluate(() => window.__slot1.instance.isValid()), true);
});

await check('Page Media list: reorder, take one off, spoken label required for playing examples', async () => {
  const field = await slotField('creator-studios', 'openingExamples'); const value = (await pm('creator-studios')).openingExamples;
  await page.evaluate(({ field, value }) => { window.__slot2 = window.mountWidget('pgk-slot', { field, value, entry: {}, collection: 'page-media' }); }, { field, value });
  const host = page.locator('.host-pgk-slot').nth(1);
  await host.getByRole('button', { name: 'Move item 1 down' }).click(); await page.waitForTimeout(30);
  let v = await page.evaluate(() => window.__slot2.state.value);
  assert.deepEqual(v.map((x) => x.media), [value[1].media, value[0].media, value[2].media]);
  await host.getByRole('button', { name: 'Take off this page' }).nth(2).click(); await page.waitForTimeout(30);
  v = await page.evaluate(() => window.__slot2.state.value);
  assert.equal(v.length, 2);
  await page.evaluate(() => { const v = window.__slot2.state.value; v[0].label = ''; window.__slot2.draw(); });
  const res = await page.evaluate(() => window.__slot2.instance.isValid());
  assert.match(res.error.message, /screen reader hears/);
});

await check('Page Media optional section on a text-only page: empty by default, a film can be added', async () => {
  const field = await slotField('contact', 'introMedia');
  await page.evaluate(({ field }) => { window.__slot3 = window.mountWidget('pgk-slot', { field, value: null, entry: {}, collection: 'page-media' }); }, { field });
  const host = page.locator('.host-pgk-slot').nth(2);
  assert.match(await host.locator('.pgk-slot__empty').innerText(), /page stays text only/);
  assert.equal(await page.evaluate(() => window.__slot3.instance.isValid()), true);
  await host.getByRole('button', { name: 'Choose from library' }).click();
  const dlg = page.getByRole('dialog', { name: 'Choose from the library' }).last();
  await dlg.locator('select[aria-label="Type"]').selectOption('film');
  await dlg.locator('.pgk-pick').first().click(); await dlg.getByRole('button', { name: 'Use this' }).click(); await page.waitForTimeout(30);
  const v = await page.evaluate(() => window.__slot3.state.value);
  assert.ok(v && v.media, JSON.stringify(v));
  await host.getByRole('button', { name: 'Take off this page' }).click(); await page.waitForTimeout(30);
  assert.equal(await page.evaluate(() => window.__slot3.state.value), null, 'removed from the page, nothing deleted');
});

await check('Where it is used: an in-use photo lists its places and cannot be deleted', async () => {
  await page.evaluate(() => { window.__m1 = window.mountWidget('pgk-manage', { field: { name: '_manage' }, value: undefined, entry: { slug: 'ph-clos-lighting', data: {} }, collection: 'photos' }); });
  const host = page.locator('.host-pgk-manage').first();
  await host.getByText('Used in 1 place:').waitFor();
  await host.getByRole('button', { name: 'Delete this photo…' }).click();
  const dlg = page.getByRole('dialog').last();
  await dlg.getByText('It cannot be deleted while it is used').waitFor();
  assert.equal(await dlg.getByRole('button', { name: 'Delete for good' }).count(), 0);
  await dlg.getByRole('button', { name: 'Close' }).click();
});

await check('Delete an unused synthetic photo: cancel first, then typed name, own file only, undo', async () => {
  await page.evaluate(() => { window.__m2 = window.mountWidget('pgk-manage', { field: { name: '_manage' }, value: undefined, entry: { slug: 'qa-unused-photo', data: {} }, collection: 'photos' }); });
  const host = page.locator('.host-pgk-manage').nth(1);
  await host.getByText('Not chosen for any page section').waitFor();
  assert.match(await host.innerText(), /Shown automatically in: Home: Selected work\. Deleting it simply takes it out of that/);
  await host.getByRole('button', { name: 'Delete this photo…' }).click();
  let dlg = page.getByRole('dialog').last();
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  assert.ok(!manageCalls.some((c) => c.action === 'delete'), 'cancel sends nothing');
  await host.getByRole('button', { name: 'Delete this photo…' }).click();
  dlg = page.getByRole('dialog').last();
  assert.match(await dlg.innerText(), /Keeps shared\.jpg: also used by Photo “Other”/);
  const del = dlg.getByRole('button', { name: 'Delete for good' });
  assert.equal(await del.isDisabled(), true);
  await dlg.getByRole('textbox').fill('qa unused photo');
  await page.waitForTimeout(30);
  await dlg.getByRole('button', { name: 'Delete for good' }).click();
  await page.getByRole('dialog').last().getByText('Removed in one saved change').waitFor();
  const sent = manageCalls.filter((c) => c.action === 'delete').pop();
  assert.deepEqual([sent.head, sent.files, sent.confirm], ['a'.repeat(40), ['/images/library/qa.jpg'], 'qa unused photo']);
  await page.getByRole('dialog').last().getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('dialog').last().getByText('Everything that was deleted is back').waitFor();
  assert.equal(manageCalls.filter((c) => c.action === 'restore').pop().commit, 'c'.repeat(40));
  // The finished dialog offers only “Back to the list” (it reloads the dashboard); the stand-in just removes it.
  await page.evaluate(() => window.__m2.instance.setState({ open: false })); await page.waitForTimeout(30);
});

await check('Film from Google Drive: new film starts waiting; failed shows the reason and Retry; running import is shown', async () => {
  await page.evaluate(() => { window.__f1 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: undefined, entry: { newRecord: true, data: { title: 'QA film' } }, collection: 'films' }); });
  await page.waitForTimeout(50);
  assert.deepEqual(await page.evaluate(() => window.__f1.state.value), { state: 'waiting' });
  await page.evaluate(() => { window.__f2 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: { state: 'failed', message: 'The file is larger than 200 MB.' }, entry: { slug: 'qa-film', data: { drive: 'https://drive.google.com/file/d/x/view' } }, collection: 'films' }); });
  const failed = page.locator('.host-pgk-film-status').nth(1);
  assert.match(await failed.innerText(), /larger than 200 MB/);
  await failed.getByRole('button', { name: 'Retry import' }).click(); await page.waitForTimeout(30);
  assert.deepEqual(await page.evaluate(() => window.__f2.state.value), { state: 'retry' });
  await page.evaluate(() => { window.__f3 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: { state: 'waiting' }, entry: { slug: 'qa-film-2', data: { drive: 'https://drive.google.com/file/d/x/view' } }, collection: 'films' }); });
  await page.locator('.host-pgk-film-status').nth(2).getByText('Importing from Google Drive now').waitFor();
  // The import recorded its result while the form was open: say so and offer Reload.
  await page.evaluate(() => { window.__f5 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: { state: 'waiting' }, entry: { slug: 'qa-film-done', data: { drive: 'https://drive.google.com/file/d/x/view' } }, collection: 'films' }); });
  await page.locator('.host-pgk-film-status').last().getByText('The import has finished.').waitFor();
  assert.equal(await page.locator('.host-pgk-film-status').last().getByRole('button', { name: 'Reload' }).count(), 1);
  await page.evaluate(() => { window.__f4 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: undefined, entry: { slug: 'cs-jm2-architecture', data: { src: '/v/cs-jm2-architecture.mp4', rights: 'approved', published: false } }, collection: 'films' }); });
  assert.match(await page.locator('.host-pgk-film-status').last().innerText(), /Hidden: not on the site/);
  // A new film cannot be saved without the Drive link of the file; a ready film offers Replace or re-import.
  assert.match((await page.evaluate(() => window.__f1.instance.isValid())).error.message, /Paste the Google Drive link/);
  await page.evaluate(() => { window.__f6 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: undefined, entry: { newRecord: true, data: { title: 'QA', drive: 'https://drive.google.com/file/d/1EbGdv-zpesjU69VLtemNIcRZyryzueF4/view' } }, collection: 'films' }); });
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.__f6.instance.isValid()), true);
  await page.evaluate(() => { window.__f7 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: { state: 'ready', message: 'Imported.' }, entry: { slug: 'qa-ready', data: { src: '/v/qa-ready.mp4', drive: 'https://drive.google.com/file/d/1EbGdv-zpesjU69VLtemNIcRZyryzueF4/view' } }, collection: 'films' }); });
  const ready = page.locator('.host-pgk-film-status').last();
  assert.match(await ready.innerText(), /never re-imports the film/);
  await ready.getByRole('button', { name: 'Replace or re-import from Google Drive' }).click(); await page.waitForTimeout(50);
  assert.deepEqual(await page.evaluate(() => window.__f7.state.value), { state: 'retry' });
  assert.match(await page.locator('.host-pgk-film-status').last().innerText(), /keeps playing the current copy/);
});

await check('Captions: a file that is not WebVTT is refused with a reason', async () => {
  await page.evaluate(() => { window.__c1 = window.mountWidget('pgk-captions', { field: { name: 'captions' }, value: null, entry: { slug: 'qa-film', data: {} }, collection: 'films' }); });
  const host = page.locator('.host-pgk-captions');
  await host.locator('input[type=file]').setInputFiles({ name: 'notes.vtt', mimeType: 'text/vtt', buffer: Buffer.from('hello') });
  await host.getByText('This is not a WebVTT captions file').waitFor();
  await host.locator('input[type=file]').setInputFiles({ name: 'ok.vtt', mimeType: 'text/vtt', buffer: Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\nHi\n') });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__c1.state.value), '/captions/qa-film.vtt');
});

await check('Collection cards: the picture sits before Decap’s card body (grid) and beside the title (list), with plain labels', async () => {
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = '<a class="css-1-GridCardLink" href="#/collections/photos/entries/ph-dan-dan"><div class="css-2-CardBody"><h2>Dan</h2></div></a>'
      + '<a class="css-3-ListCardLink" href="#/collections/films/entries/agent-on-camera"><h2 class="css-4-ListCardTitle">Agent</h2></a>';
    document.body.appendChild(d);
  });
  // The stand-in redraws whole widgets (React would not), which keeps restarting the dashboard's 60 ms debounce; run it now.
  await page.evaluate(() => window.__pgkDecorate()); await page.waitForTimeout(50);
  const r = await page.evaluate(() => {
    const g = document.querySelector('a[href*="ph-dan-dan"]'); const l = document.querySelector('a[href*="agent-on-camera"]');
    return { gFirst: g.firstElementChild.className, inBody: !!g.querySelector('[class*="CardBody"] .pgk-card-thumb'), meta: g.querySelector('.pgk-card-meta')?.textContent,
      lFirst: l.firstElementChild.tagName + ' ' + l.firstElementChild.className, lMeta: l.querySelector('.pgk-card-meta')?.textContent, gDisplay: getComputedStyle(g).display };
  });
  assert.match(r.gFirst, /pgk-card-thumb pgk-card-thumb--grid/); assert.equal(r.inBody, false, 'not inside the body (no white band)');
  assert.match(r.meta, /LI Creator Studios|Creator/); assert.equal(r.gDisplay, 'flex');
  assert.match(r.lFirst, /VIDEO pgk-card-thumb pgk-card-thumb--list/, 'film without a still shows its first frame');
  assert.match(r.lMeta, /Agent Content · Shown/);
});

await check('Saved vs on the site: building, then a failed build is said plainly with its report', async () => {
  await page.waitForFunction(() => !document.querySelector('.pgk-sitepill').hidden, null, { timeout: 5000 });
  assert.equal(await page.locator('.pgk-sitepill').innerText(), 'Site updating…');
  buildReply = { state: 'failure', url: 'https://vercel.com/report' };
  await page.evaluate(() => window.__pgkCheckSite());
  await page.waitForFunction(() => /Site update failed/.test(document.querySelector('.pgk-sitepill').textContent));
  assert.equal(await page.locator('.pgk-sitepill a').getAttribute('href'), 'https://vercel.com/report');
  assert.match(await page.locator('.pgk-sitepill').getAttribute('title'), /could not be updated with your latest save/);
  buildReply = { state: 'unknown' };
  await page.evaluate(() => window.__pgkCheckSite());
  await page.waitForFunction(() => /Saved, waiting for the site/.test(document.querySelector('.pgk-sitepill').textContent));
});

await check('Dialogs by keyboard: focus stays inside, Escape closes, focus returns to the button that opened it', async () => {
  const field = await slotField('commercial', 'featureFilm'); const value = (await pm('commercial')).featureFilm;
  await page.evaluate(({ field, value }) => { window.__k1 = window.mountWidget('pgk-slot', { field, value, entry: {}, collection: 'page-media' }); }, { field, value });
  const host = page.locator('.host-pgk-slot').last();
  const opener = host.getByRole('button', { name: 'Replace from library' });
  await opener.focus();
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);

  const dlg = page.getByRole('dialog', { name: 'Choose from the library' }).last(); await dlg.waitFor();
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Search the library', 'focus starts in the dialog');
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')), 'Tab stays inside');
  await page.keyboard.press('Shift+Tab'); assert.ok(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')), 'Shift+Tab stays inside');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  assert.equal(await page.getByRole('dialog', { name: 'Choose from the library' }).count(), 0, 'Escape closes');
  const fb = await page.evaluate(() => ({ t: document.activeElement.textContent.trim().slice(0, 40), tag: document.activeElement.tagName, host: document.activeElement.closest('[class^=host-]')?.className }));
  assert.equal(fb.t, 'Replace from library', 'focus back on the opener ' + JSON.stringify(fb));
  // The delete dialog: same rules; Escape is a cancel and sends nothing.
  const before = manageCalls.filter((c) => c.action === 'delete').length;
  const m = page.locator('.host-pgk-manage').nth(1);
  await m.getByRole('button', { name: 'Delete this photo…' }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('dialog').last().waitFor(); await page.waitForTimeout(50);
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')), 'Tab stays inside the delete dialog');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  assert.equal(await page.locator('.host-pgk-manage [role=dialog]').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Delete this photo…');
  assert.equal(manageCalls.filter((c) => c.action === 'delete').length, before);
});

await check('Page Media gallery: leave out on this page only, own selection with order, back to Automatic', async () => {
  const field = await slotField('home', 'selectedWork');
  await page.evaluate(({ field }) => { window.__g1 = window.mountWidget('pgk-gallery-slot', { field, value: null, entry: {}, collection: 'page-media' }); }, { field });
  const host = page.locator('.host-pgk-gallery-slot').last();
  await host.getByRole('button', { name: 'Leave out on this page' }).first().click(); await page.waitForTimeout(30);
  let v = await page.evaluate(() => window.__g1.state.value);
  assert.equal(v.mode, 'automatic'); assert.equal(v.exclude.length, 1);
  await host.getByRole('button', { name: 'Put back' }).click(); await page.waitForTimeout(30);
  assert.equal(await page.evaluate(() => window.__g1.state.value), null, 'nothing left out: plain Automatic again');
  await host.getByLabel(/My own selection/).click(); await page.waitForTimeout(30);
  v = await page.evaluate(() => window.__g1.state.value);
  assert.equal(v.mode, 'custom'); assert.ok(v.items.length > 20, 'starts from what Automatic shows');
  const first = v.items[0].media; const second = v.items[1].media;
  await host.getByRole('button', { name: 'Move item 1 down' }).evaluate((b) => b.click()); await page.waitForTimeout(30);
  v = await page.evaluate(() => window.__g1.state.value);
  assert.deepEqual([v.items[0].media, v.items[1].media], [second, first]);
  await host.getByRole('button', { name: 'Take off this page' }).first().evaluate((b) => b.click()); await page.waitForTimeout(30);
  assert.equal((await page.evaluate(() => window.__g1.state.value)).items[0].media, first);
  await host.getByLabel(/Automatic: /).click(); await page.waitForTimeout(30);
  assert.equal(await page.evaluate(() => window.__g1.state.value), null);
  // Commercial case study: a project, or Automatic.
  const cf = await slotField('commercial', 'caseStudy');
  await page.evaluate(({ cf }) => { window.__g2 = window.mountWidget('pgk-gallery-slot', { field: cf, value: null, entry: {}, collection: 'page-media' }); }, { cf });
  await page.locator('.host-pgk-gallery-slot').last().locator('select').selectOption('torella-pools'); await page.waitForTimeout(30);
  assert.deepEqual(await page.evaluate(() => window.__g2.state.value), { project: 'torella-pools' });
});

if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, 'dashboard-widgets-1280.png'), fullPage: true });
await check('Uploaded files: an upload taken off every page is found, deleted only by its exact name, and Undo puts it back; Escape returns focus', async () => {
  const link = page.locator('.pgk-slot__note .pgk-linkbtn').first();
  assert.match(await page.locator('.pgk-slot__note').first().innerText(), /A photo uploaded straight to this page is a file of its own/);
  assert.ok(!/open it in Photos/i.test(await page.locator('body').innerText()), 'no misleading Photos wording');
  await link.focus(); await link.click();
  const dlg = page.getByRole('dialog', { name: 'Uploaded files' });
  await dlg.getByText('1 not used · 1 in use or protected').waitFor();
  assert.match(await dlg.innerText(), /qa-on-a-page\.jpg Used in: Page Media › Send a Project Brief/);
  assert.equal(await dlg.getByRole('button', { name: 'Delete qa-on-a-page.jpg' }).count(), 0, 'a file in use offers no delete');
  await dlg.getByRole('button', { name: 'Delete qa-direct-upload-5f5f5f5f5f.jpg' }).click();
  const box = dlg.getByRole('textbox', { name: 'Type the file name to confirm' });
  await box.waitFor(); assert.ok(await box.evaluate((e) => e === document.activeElement), 'focus moves to the name box');
  const go = dlg.getByRole('button', { name: 'Delete for good' });
  await box.fill('qa-direct-upload'); assert.equal(await go.isDisabled(), true);
  await page.keyboard.press('Escape'); await page.waitForTimeout(30);
  assert.equal(await dlg.count(), 1, 'Escape first only cancels the confirm'); assert.ok(!manageCalls.some((c) => c.action === 'deleteFile'), 'cancel sends nothing');
  await dlg.getByRole('button', { name: 'Delete qa-direct-upload-5f5f5f5f5f.jpg' }).click();
  await box.fill('qa-direct-upload-5f5f5f5f5f.jpg'); await go.click();
  await dlg.getByText('Deleted the file qa-direct-upload-5f5f5f5f5f.jpg.').waitFor();
  const sent = manageCalls.filter((c) => c.action === 'deleteFile').pop();
  assert.deepEqual([sent.path, sent.head, sent.confirm], ['/images/library/qa-direct-upload-5f5f5f5f5f.jpg', uploadsHead, 'qa-direct-upload-5f5f5f5f5f.jpg']);
  const undo = dlg.getByRole('button', { name: 'Undo deleting qa-direct-upload-5f5f5f5f5f.jpg' });
  assert.ok(await undo.evaluate((e) => e === document.activeElement), 'focus moves to Undo');
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  assert.ok(await dlg.evaluate((d) => d.contains(document.activeElement)), 'Tab stays inside');
  await undo.click();
  await dlg.getByText('Restored qa-direct-upload-5f5f5f5f5f.jpg.').waitFor();
  assert.equal(manageCalls.filter((c) => c.action === 'restore').pop().commit, 'd'.repeat(40));
  await page.keyboard.press('Escape'); await page.waitForTimeout(30);
  assert.equal(await dlg.count(), 0);
  assert.ok(await link.evaluate((e) => e === document.activeElement), 'focus returns to the Uploaded files link: ' + await page.evaluate(() => document.activeElement.outerHTML.slice(0, 120) + ' ' + document.querySelectorAll('.pgk-slot__note .pgk-linkbtn').length));
});

await check('Bottom note: the review-only test note is one line, opens for details, can be hidden; a held project stays; neither covers the save pill', async () => {
  const bar = page.locator('.pgk-statusbar');
  await bar.waitFor();
  const box = await bar.boundingBox(); const pillBox = await page.locator('.pgk-sitepill').boundingBox();
  assert.ok(box.height < 60, 'one line: ' + box.height);
  assert.ok(pillBox.x + pillBox.width <= box.x || pillBox.y + pillBox.height <= box.y, 'pill not covered ' + JSON.stringify([pillBox, box]));
  assert.match(await bar.innerText(), /1 review-only test project/); assert.ok(!/build b{7}/.test(await bar.innerText()), 'build details folded away');
  await bar.getByRole('button', { name: 'Hide this note' }).click();
  await page.waitForTimeout(50); assert.equal(await bar.isHidden(), true);
  statusReply = { ...statusReply, held: [{ collection: 'projects', id: 'fedcba9876543210', reasons: ['describe photo 1'] }] };
  await page.evaluate(() => fetch('/admin/status.json').then(() => {})); // the dashboard re-reads every minute; ask now
  await page.evaluate(() => window.__pgkReloadStatus && window.__pgkReloadStatus());
  await page.waitForFunction(() => /1 project is not on the site/.test(document.querySelector('.pgk-statusbar').textContent));
  assert.equal(await page.locator('.pgk-statusbar .pgk-statusbar__x').count(), 0, 'a held alert cannot be hidden');
});

await check('Phone width: Page Media rows fit without sideways scrolling', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 0, 'overflow ' + over);
});

if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, 'dashboard-widgets-390.png'), fullPage: true });
await browser.close();
for (const r of results) console.log(r.join('  '));
console.log(errors.length ? 'page errors:\n' + errors.join('\n') : 'page errors: none');
const failed = results.filter((r) => r[0] === 'FAIL').length + errors.length;
console.log(`dashboard widgets: ${results.length - results.filter((r) => r[0] === 'FAIL').length}/${results.length}`);
process.exit(failed ? 1 : 0);
