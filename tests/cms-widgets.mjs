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
  if (v == null || v === false || v === true) return document.createTextNode(''); // React permits components to return null
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
    // A rebuilt <video> fires a fresh load error on every redraw here (React keeps the element), which would redraw for
    // ever; the preview's fallback is not what these checks are about.
    else if (k === 'onError' && v.type === 'video') continue;
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
// Two behaviours of the real Decap 3.16.3 that the acceptance walk on 94d5fb1 hit (opt in with decap: { stored }):
// - A control's props.entry, as its isValid sees it on Save, keeps the sibling values from when the control's own value
//   last changed (observed in real Decap 3.16.3 on Oct 14, with and without the control's own shouldComponentUpdate).
// - Its draft reducer sets hasChanged = !storedCopies.some((copy) => Immutable.is(draft.data, copy.data)); the copies can
//   include the version from before the last save. Immutable keeps null, undefined and a missing key apart.
const immEq = (a, b) => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a); const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && immEq(a[k], b[k]));
};
window.mountWidget = function (name, { field, value, entry, collection, decap }) {
  const host = document.createElement('div'); host.className = 'host-' + name; document.body.appendChild(host);
  const state = { value, entry: Object.assign({ data: {} }, entry) };
  const Ctrl = window.__registered[name];
  const m = { id: name + '#' + mounts.length, state, draw() {
    // React keeps the focused element across updates; this stand-in rebuilds the DOM, so it puts focus back on the
    // element with the same accessible name.
    const a = document.activeElement; const keyOf = (el) => (el.getAttribute('aria-label') || el.textContent.trim()) + '|' + el.tagName;
    const focusKey = a && host.contains(a) ? keyOf(a) : null;
    host.innerHTML = '';
    let entryProp = wrap(state.entry);
    if (decap && m.instance && m.lastValue === state.value) entryProp = m.lastEntry;
    m.lastValue = state.value; m.lastEntry = entryProp;
    const props = { value: state.value, onChange: (v) => { state.value = v && v.toJS ? v.toJS() : v; schedule(); }, field: wrap(field), forID: m.id.replace('#', '-'),
      entry: entryProp, collection: wrap({ name: collection }), getAsset: (p) => p, onPersistMedia: (file) => Promise.resolve({ payload: { path: 'static/images/library/' + file.name } }) };
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
  // Another field of the same entry was edited: Decap re-renders every control with the new entry.
  m.setSibling = (k, v) => { state.entry = Object.assign({}, state.entry, { data: Object.assign({}, state.entry.data, { [k]: v }) }); schedule(); };
  m.data = () => Object.assign({}, state.entry.data, { [field.name]: state.value });
  m.hasChanged = () => !((decap && decap.stored) || []).some((copy) => immEq(m.data(), copy));
  m.savedJson = () => JSON.parse(JSON.stringify(m.data())); // what Save writes to the file
  m.unmount = () => { mounts = mounts.filter((x) => x !== m); for (const [k, inst] of [...instances]) if (k.startsWith(m.id + ':')) { if (inst.componentWillUnmount) inst.componentWillUnmount(); instances.delete(k); } host.remove(); };
  mounts.push(m); m.draw(); return m;
};
window.CMS = { registerWidget: (n, c) => { window.__registered[n] = c; }, registerPreviewTemplate() {}, registerPreviewStyle() {}, registerEditorComponent() {}, registerLocale() {}, registerEventListener(l) { (window.__events = window.__events || {})[l.name] = l.handler; }, init() {} };
window.h = h; window.createClass = createClass; window.__unmountNamed = (name) => mounts.filter((m) => m.id.startsWith(name + '#')).forEach((m) => m.unmount()); window.__wrapForTest = (x) => wrap(x);
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
// A film's history on the branch, for following an import in the same open form (films whose slug starts "qa-life").
// commits: newest first; recs: the record at each commit; runs: import runs by the commit that started them.
const life = { commits: [], recs: {}, runs: {}, calls: 0 };
await page.route('https://api.github.com/**', (r) => {
  const u = r.request().url(); const j = (v) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
  if (/qa-life/.test(decodeURIComponent(u)) || Object.keys(life.recs).some((sha) => u.includes(sha))) {
    life.calls++;
    const ref = (u.match(/[?&]ref=([0-9a-f]{40})/) || [])[1];
    if (/\/contents\//.test(u)) return ref && life.recs[ref] ? j(life.recs[ref]) : r.fulfill({ status: 404, body: '{}' });
    if (/\/commits\?/.test(u)) return j(life.commits.map((c) => ({ sha: c.sha, commit: { committer: { date: c.date } } })));
    const sha = (u.match(/head_sha=([0-9a-f]{40})/) || [])[1];
    if (sha) return j({ workflow_runs: life.runs[sha] ? [life.runs[sha]] : [] });
    return j({});
  }
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
const check = async (name, fn) => { console.log('… ' + name); try { await fn(); results.push(['ok', name]); } catch (e) { results.push(['FAIL', name, e.message.slice(0, 900)]); } };
const valid = (cls) => page.evaluate((c) => { const m = window.__mounts?.[c]; return null; }, cls);

await check('registered widgets', async () => {
  const names = await page.evaluate(() => Object.keys(window.__registered).sort());
  for (const n of ['pgk-slot', 'pgk-page-note', 'pgk-manage', 'pgk-film-status', 'pgk-drive', 'pgk-live', 'pgk-captions', 'pgk-gallery', 'pgk-photo', 'pgk-publish']) assert.ok(names.includes(n), n);
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
  assert.equal(await page.evaluate(() => window.__slot3.state.value), undefined, 'removed from the page (no value), nothing deleted');
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
  // Opened while waiting, and the import has since recorded Ready in a later commit: say so here and offer Reload.
  Object.assign(life, { commits: [{ sha: 'b'.repeat(40), date: new Date().toISOString() }, { sha: 'c'.repeat(40), date: new Date(Date.now() - 60000).toISOString() }],
    recs: { ['b'.repeat(40)]: { type: 'video', src: '/v/qa-life-done.mp4', import: { state: 'ready', message: 'Imported from Google Drive.' } }, ['c'.repeat(40)]: { type: 'video', import: { state: 'waiting' } } }, runs: {} });
  await page.evaluate(() => { window.__f5 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: { state: 'waiting' }, entry: { slug: 'qa-life-done', data: { drive: 'https://drive.google.com/file/d/x/view' } }, collection: 'films' }); });
  await page.locator('.host-pgk-film-status').last().getByText('Ready: the new files are saved.').waitFor();
  assert.equal(await page.locator('.host-pgk-film-status').last().getByRole('button', { name: 'Reload' }).count(), 1);
  await page.evaluate(() => { window.__f4 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: undefined, entry: { slug: 'cs-jm2-architecture', data: { src: '/v/cs-jm2-architecture.mp4', rights: 'approved', published: false } }, collection: 'films' }); });
  assert.match(await page.locator('.host-pgk-film-status').last().innerText(), /Hidden draft: production leaves it out/);
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

await check('Decap 3.16.3 behaviour: taking the photo off an optional section after an earlier save can be saved; Save writes no key; reopened it is empty', async () => {
  // Codex, 94d5fb1: Contact started empty, a photo was uploaded and saved, then Take off this page left Save off.
  const field = await slotField('contact', 'introMedia'); const base = await pm('contact');
  const photo = { src: '/images/library/qa-above-the-form-0000000000.webp', alt: 'QA disposable photo' };
  const before = { ...base, introMedia: null }; const saved = { ...base, introMedia: photo };
  await page.evaluate(({ field, photo, before, saved }) => { window.__c1 = window.mountWidget('pgk-slot', { field, value: photo, entry: { slug: 'contact', data: saved }, collection: 'page-media', decap: { stored: [before, saved] } }); }, { field, photo, before, saved });
  const host = page.locator('.host-pgk-slot').last();
  assert.equal(await page.evaluate(() => window.__c1.hasChanged()), false, 'just saved');
  await host.getByRole('button', { name: 'Take off this page' }).click(); await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.__c1.hasChanged()), true, 'Save is offered after Take off this page');
  assert.equal(await page.evaluate(() => window.__c1.instance.isValid()), true);
  const written = await page.evaluate(() => window.__c1.savedJson());
  assert.ok(!('introMedia' in written), 'the file leaves the section out: ' + JSON.stringify(written));
  // Reopened from the saved file: empty, and the build's own check accepts it.
  await page.evaluate(({ field, written }) => { window.__c2 = window.mountWidget('pgk-slot', { field, value: written.introMedia, entry: { slug: 'contact', data: written }, collection: 'page-media' }); }, { field, written });
  assert.match(await page.locator('.host-pgk-slot').last().innerText(), /Nothing is shown here|Empty|Upload|library/i);
  const { checkPageMedia } = await import(join(root, 'src/lib/page-media-core.js'));
  const all = Object.fromEntries(await Promise.all(['about', 'agency-partnerships', 'agent-content', 'architecture-design', 'commercial', 'contact', 'creator-studios', 'field-notes', 'home', 'real-estate-pricing', 'real-estate'].map(async (f) => [f, await pm(f)])));
  all.contact = written;
  const res = checkPageMedia(all, { media: new Map(), loops: new Set(), heroLoops: new Set(), projects: new Set(), fileExists: () => true });
  assert.ok(!res.errors.some((e) => /contact/i.test(e)), res.errors.filter((e) => /contact/i.test(e)).join('; '));
  // The same applies to galleries going back to Automatic and the case study going back to Automatic.
  const gfield = await slotField('home', 'selectedWork');
  const custom = { mode: 'automatic', exclude: ['cs-demo-reel'] };
  await page.evaluate(({ gfield, custom }) => { window.__g9 = window.mountWidget('pgk-gallery-slot', { field: gfield, value: custom, entry: { slug: 'home', data: { selectedWork: custom } }, collection: 'page-media', decap: { stored: [{ selectedWork: null }, { selectedWork: custom }] } }); }, { gfield, custom });
  await page.locator('.host-pgk-gallery-slot').last().getByRole('button', { name: 'Put back' }).first().click(); await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.__g9.hasChanged()), true, 'Put back the last left-out item is saveable');
  assert.ok(!('selectedWork' in await page.evaluate(() => window.__g9.savedJson())));
  await page.evaluate(() => { window.__c1.unmount(); window.__c2.unmount(); window.__g9.unmount(); });
});

await check('Decap 3.16.3 behaviour: a Drive link typed after the film form opened is the one checked on Save (new film and re-import)', async () => {
  const link = 'https://drive.google.com/file/d/1EbGdv-zpesjU69VLtemNIcRZyryzueF4/view';
  // New film: Codex filled the form with James's valid link; Save refused it because the check read the form as opened.
  await page.evaluate(() => { window.__n1 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: undefined, entry: { newRecord: true, data: { title: 'QA CMS Drive import 2026-10-14' } }, collection: 'films', decap: { stored: [] } }); });
  await page.waitForTimeout(60);
  assert.match((await page.evaluate(() => window.__n1.instance.isValid())).error.message, /Paste the Google Drive link/, 'empty link is refused');
  await page.evaluate(() => { window.__d1 = window.mountWidget('pgk-drive', { field: { name: 'drive' }, value: '', entry: { newRecord: true, data: {} }, collection: 'films' }); });
  for (const [k, v] of [['service', ['podcast']], ['category', 'creator-studios'], ['published', false], ['captions', 'burned-in'], ['makeLoop', true], ['drive', link]]) await page.evaluate(([k, v]) => window.__n1.setSibling(k, v), [k, v]);
  await page.waitForTimeout(60);
  assert.match((await page.evaluate(() => window.__n1.instance.isValid())).error.message, /Paste the Google Drive link/, 'the form as it opened is not what counts');
  await page.locator('.host-pgk-drive').last().locator('input').fill(link); await page.waitForTimeout(60);
  assert.equal(await page.evaluate(() => window.__n1.instance.isValid()), true, 'the valid link typed into the form is accepted');
  assert.deepEqual(await page.evaluate(() => window.__n1.state.value), { state: 'waiting' }, 'saved as waiting, so the import starts');
  await page.locator('.host-pgk-drive').last().locator('input').fill('https://drive.google.com/drive/folders/abc'); await page.waitForTimeout(60);
  assert.match((await page.evaluate(() => window.__n1.instance.isValid())).error.message, /Paste the Google Drive link/, 'a folder link is still refused');
  // Ready film: Replace, then a new link and a new poster frame typed afterwards.
  await page.evaluate(() => { window.__d1.unmount(); window.__d2 = window.mountWidget('pgk-drive', { field: { name: 'drive' }, value: '', entry: { slug: 'qa-ready-2', data: {} }, collection: 'films' }); });
  await page.evaluate((link) => { window.__r1 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: { state: 'ready', message: 'Imported.' }, entry: { slug: 'qa-ready-2', data: { src: '/v/qa-ready-2.mp4', rights: 'approved', published: false, drive: '' } }, collection: 'films', decap: { stored: [] } }); }, link);
  const r = page.locator('.host-pgk-film-status').last();
  assert.equal(await page.evaluate(() => window.__r1.instance.isValid()), true, 'a ready film saves without a link when nothing is re-imported');
  await r.getByRole('button', { name: /^Replace/ }).evaluate((b) => b.click()); await page.waitForTimeout(60);
  assert.match((await page.evaluate(() => window.__r1.instance.isValid())).error.message, /Paste the Google Drive link/);
  await page.evaluate(() => window.__r1.setSibling('posterTime', 4.5));
  await page.locator('.host-pgk-drive').last().locator('input').fill(link.replace('/view', '/view?usp=sharing')); await page.waitForTimeout(60);
  assert.equal(await page.evaluate(() => window.__r1.instance.isValid()), true, 're-import with the link typed after Replace');
  await page.evaluate(() => { window.__n1.unmount(); window.__r1.unmount(); window.__d2.unmount(); });
  assert.match((await page.evaluate(() => { window.__r2 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: { state: 'retry' }, entry: { slug: 'qa-x', data: { drive: '' } }, collection: 'films' }); return window.__r2.instance.isValid(); })).error.message, /Paste the Google Drive link/, 'with no Drive field on screen, the saved value counts');
  await page.evaluate(() => window.__r2.unmount());
});

await check('Film import in the same open form: Ready → Replace → Save follows this request; the old Ready never counts; success and failure show here', async () => {
  const sha = (c) => c.repeat(40); const t = (min) => new Date(Date.now() + min * 60000).toISOString();
  const link = 'https://drive.google.com/file/d/1EbGdv-zpesjU69VLtemNIcRZyryzueF4/view';
  const ready0 = { type: 'video', title: 'QA life', src: '/v/qa-life.mp4', poster: '/v/qa-life.webp', drive: link, import: { state: 'ready', at: t(-60), message: 'Imported.' } };
  Object.assign(life, { commits: [{ sha: sha('1'), date: t(-60) }], recs: { [sha('1')]: ready0 }, runs: {} });
  await page.evaluate(() => { window.__pgkFilmPollMs = 600000; });
  await page.evaluate((rec) => { window.__L1 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: rec.import, entry: { slug: 'qa-life', data: rec }, collection: 'films' }); window.__L1d = window.mountWidget('pgk-drive', { field: { name: 'drive' }, value: rec.drive, entry: { slug: 'qa-life', data: rec }, collection: 'films' }); }, ready0);
  const host = page.locator('.host-pgk-film-status').last();
  await host.getByRole('button', { name: 'Replace or re-import from Google Drive' }).evaluate((b) => b.click()); await page.waitForTimeout(120);
  assert.deepEqual(await page.evaluate(() => window.__L1.state.value), { state: 'retry' });
  assert.match(await host.innerText(), /Not saved yet/, 'nothing is followed before Save');
  assert.match(await host.innerText(), /Paste the new Drive link above/, 'the link field is above the status');
  // Saved, but GitHub's list still shows only the old Ready revision (a cache): keep waiting, never "finished".
  await page.evaluate((link) => window.__events.postSave({ entry: window.__wrapForTest({ slug: 'qa-life', data: { import: { state: 'retry' }, drive: link, posterTime: 5 } }) }), link);
  await page.waitForTimeout(150);
  assert.ok(!/Ready: the new copy|finished/i.test(await host.innerText()), 'old Ready is not the result: ' + await host.innerText());
  assert.match(await host.innerText(), /Waiting to import/);
  // The save commit appears, then its run starts.
  life.commits.unshift({ sha: sha('2'), date: t(0) }); life.recs[sha('2')] = { ...ready0, drive: link, posterTime: 5, import: { state: 'retry' } };
  life.runs[sha('2')] = { status: 'in_progress', created_at: t(0), run_started_at: t(0) };
  await page.evaluate(() => window.__L1.instance.pollNow()); await host.getByText('Importing from Google Drive now').waitFor({ timeout: 4000 });
  assert.equal(await page.evaluate(() => window.__L1.instance.isValid()), true, 'other edits can still be saved while it imports');
  // The import records Ready in a later commit: shown in this form, with the new copy, and saving is held until reload.
  life.runs[sha('2')] = { status: 'completed', conclusion: 'success', updated_at: t(1) };
  life.commits.unshift({ sha: sha('3'), date: t(2) }); life.recs[sha('3')] = { ...ready0, src: '/v/qa-life-r2.mp4', poster: '/v/qa-life-r2.webp', asset: 'qa-life-r2', posterTime: 5, import: { state: 'ready', at: t(1), message: 'Replaced with a new copy from Google Drive (1280×720, 21 s).' } };
  await page.evaluate(() => window.__L1.instance.pollNow()); await host.getByText('Ready: the new files are saved.').waitFor({ timeout: 4000 });
  assert.match(await host.innerText(), /Ready: the new files are saved\. Replaced with a new copy/);
  assert.equal(await host.locator('video').getAttribute('src'), '/v/qa-life-r2.mp4');
  assert.equal(await host.getByRole('button', { name: 'Reload' }).count(), 1);
  assert.match((await page.evaluate(() => window.__L1.instance.isValid())).error.message, /Reload this page before saving again/);
  const calls = life.calls; await page.waitForTimeout(200); assert.equal(life.calls, calls, 'following stops once finished');
  await page.evaluate(() => { window.__L1.unmount(); window.__L1d.unmount(); });

  // Failure, same form: Retry → Save → the import records Failed → its reason and Retry show here.
  const ready1 = life.recs[sha('3')];
  await page.evaluate((rec) => { window.__L2 = window.mountWidget('pgk-film-status', { field: { name: 'import' }, value: rec.import, entry: { slug: 'qa-life', data: rec }, collection: 'films' }); window.__L2d = window.mountWidget('pgk-drive', { field: { name: 'drive' }, value: rec.drive, entry: { slug: 'qa-life', data: rec }, collection: 'films' }); }, ready1);
  const host2 = page.locator('.host-pgk-film-status').last();
  await host2.getByRole('button', { name: 'Replace or re-import from Google Drive' }).evaluate((b) => b.click()); await page.waitForTimeout(120);
  await page.evaluate((link) => window.__events.postSave({ entry: window.__wrapForTest({ slug: 'qa-life', data: { import: { state: 'retry' }, drive: link } }) }), link);
  life.commits.unshift({ sha: sha('4'), date: t(3) }); life.recs[sha('4')] = { ...ready1, import: { state: 'retry' } };
  life.commits.unshift({ sha: sha('5'), date: t(4) }); life.recs[sha('5')] = { ...ready1, import: { state: 'failed', at: t(4), message: 'Google Drive refused the download: the file is not shared “Anyone with the link can view”.' } };
  await page.evaluate(() => window.__L2.instance.pollNow()); await host2.getByText('The import did not work.').waitFor({ timeout: 4000 });
  assert.match(await host2.innerText(), /The import did not work\. Google Drive refused the download/);
  assert.equal(await host2.getByRole('button', { name: 'Retry import' }).count(), 1);
  assert.equal((await page.evaluate(() => window.__L2.state.value)).state, 'failed');
  // Unmounted while following: no further requests.
  await host2.getByRole('button', { name: 'Retry import' }).evaluate((b) => b.click()); await page.waitForTimeout(80);
  await page.evaluate((link) => window.__events.postSave({ entry: window.__wrapForTest({ slug: 'qa-life', data: { import: { state: 'retry' }, drive: link } }) }), link);
  await page.waitForTimeout(150); await page.evaluate(() => { window.__L2.unmount(); window.__L2d.unmount(); });
  const after = life.calls; await page.evaluate(() => { window.__pgkFilmPollMs = 30; }); await page.waitForTimeout(250);
  assert.equal(life.calls, after, 'no polling after the form closes');
  await page.evaluate(() => { window.__pgkFilmPollMs = 600000; });
});

await check('Project Published: a description corrected after switching Published on saves without switching again; a missing one still blocks', async () => {
  const photos = [{ image: '/images/projects/qa-pub-1111111111.jpg', alt: '' }];
  const data = { title: 'QA publish', category: 'commercial', summary: 'One line.', story: 'A story.', photos };
  // Only one project form is open in Decap; here earlier tests left other Photos fields on the page.
  await page.evaluate(() => window.__unmountNamed('pgk-gallery'));
  await page.evaluate((data) => {
    window.__P1 = window.mountWidget('pgk-publish', { field: { name: 'published' }, value: false, entry: { slug: 'qa-publish', data }, collection: 'projects', decap: { stored: [] } });
    window.__P1g = window.mountWidget('pgk-gallery', { field: { name: 'photos', media_folder: '/static/images/projects', public_folder: '/images/projects' }, value: data.photos, entry: { slug: 'qa-publish', data }, collection: 'projects' });
  }, data);
  await page.locator('.host-pgk-publish').last().getByRole('switch').check(); await page.waitForTimeout(60);
  assert.match((await page.evaluate(() => window.__P1.instance.isValid())).error.message, /describe photo 1/);
  // The description is written after the switch (Decap still hands the switch the form from when it was turned on).
  await page.locator('.host-pgk-gallery').last().locator('input[type="text"]').first().fill('Front of the QA building at dusk'); await page.waitForTimeout(60);
  await page.evaluate(() => window.__P1.setSibling('photos', window.__P1g.state.value));
  await page.waitForFunction(() => window.__P1.instance.isValid() === true, null, { timeout: 3000 }).catch(() => {});
  assert.equal(await page.evaluate(() => window.__P1.instance.isValid()), true, 'saves without switching Published again');
  await page.locator('.host-pgk-gallery').last().locator('input[type="text"]').first().fill(''); await page.waitForTimeout(60);
  await page.waitForFunction(() => window.__P1.instance.isValid() !== true, null, { timeout: 3000 }).catch(() => {});
  assert.match((await page.evaluate(() => window.__P1.instance.isValid())).error.message, /describe photo 1/, 'removing it again blocks again');
  // The other inputs it needs are current too (the project name field reports itself).
  await page.evaluate(() => { window.__P1t = window.mountWidget('pgk-live', { field: { name: 'title', inner: 'string' }, value: 'QA publish', entry: {}, collection: 'projects' }); });
  await page.locator('.host-pgk-live').last().locator('input').fill(''); await page.waitForTimeout(150);
  await page.waitForFunction(() => window.__P1.instance.isValid() !== true, null, { timeout: 3000 }).catch(() => {});
  assert.match((await page.evaluate(() => window.__P1.instance.isValid())).error.message, /add a project name/);
  await page.evaluate(() => { window.__P1.unmount(); window.__P1g.unmount(); window.__P1t.unmount(); });
});

await check('Videos from the computer never reach Decap’s upload: stopped before it reads them, with the Google Drive route; photos and .vtt still upload', async () => {
  // A stand-in for Decap's Media assets dialog: its upload input, and a listener on the page root standing in for
  // Decap/React reading the chosen file (that read is what overflowed for James's video).
  await page.evaluate(() => {
    const d = document.createElement('div'); d.setAttribute('role', 'dialog'); d.id = 'qa-media';
    d.innerHTML = '<h1>Media assets</h1><div class="qa-bar"><label><span>Upload</span><input type="file" id="qa-media-input" multiple hidden></label><button type="button" aria-label="Close">Close</button></div>';
    document.body.appendChild(d); window.__persisted = [];
    document.body.addEventListener('change', (e) => { if (e.target.id === 'qa-media-input') window.__persisted.push(...[...e.target.files].map((f) => f.name)); });
    document.body.addEventListener('drop', (e) => { if (e.target.closest && e.target.closest('#qa-media')) { e.preventDefault(); window.__persisted.push(...[...e.dataTransfer.files].map((f) => 'drop:' + f.name)); } });
    window.__pgkDecorate();
  });
  await page.waitForTimeout(150);
  const dlg = page.locator('#qa-media');
  assert.match(await dlg.innerText(), /Add a video from Google Drive/);
  assert.match(await dlg.innerText(), /Upload a photo or file/);
  assert.equal(await page.locator('#qa-media-input').getAttribute('accept'), 'image/*,.pdf,.vtt,text/vtt');
  const input = page.locator('#qa-media-input');
  const mp4 = { name: 'drafther-ep-1-final.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(64 * 1024) };
  await input.setInputFiles(mp4); await page.waitForTimeout(80);
  assert.deepEqual(await page.evaluate(() => window.__persisted), [], 'the video never reached the upload');
  const help = page.getByRole('dialog', { name: 'Add videos from Google Drive' });
  assert.match(await help.innerText(), /“drafther-ep-1-final\.mp4” is a video, so it was not uploaded here\. Videos are too large/);
  assert.match(await help.innerText(), /Podcast Clips folder in Google Drive[\s\S]*Anyone with the link[\s\S]*Films → New Film/);
  assert.equal(await help.getByRole('link', { name: 'Open the Podcast Clips folder' }).getAttribute('href'), 'https://drive.google.com/drive/folders/1GvCxSc15_ewOlikI7bD8UnRJumJK-gkN');
  assert.equal(await help.getByRole('link', { name: 'Go to Films → New Film' }).getAttribute('href'), '#/collections/films/new');
  assert.equal(await page.evaluate(() => document.getElementById('qa-media-input').value), '', 'the choice is cleared');
  await page.keyboard.press('Escape'); await page.waitForTimeout(50); assert.equal(await help.count(), 0);
  // A .mov a browser reports with no type, and a mixed selection: both stopped as a whole.
  await input.setInputFiles({ name: 'IMG_0420.MOV', mimeType: '', buffer: Buffer.alloc(1024) }); await page.waitForTimeout(80);
  await input.setInputFiles([{ name: 'kitchen.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(1024) }, { name: 'tour.m4v', mimeType: 'video/x-m4v', buffer: Buffer.alloc(1024) }]); await page.waitForTimeout(80);
  assert.deepEqual(await page.evaluate(() => window.__persisted), []);
  assert.match(await help.innerText(), /choose the photos again without the video/);
  await help.getByRole('button', { name: 'Close' }).click();
  // Photos and captions files go through as before.
  await input.setInputFiles({ name: 'kitchen.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(1024) }); await page.waitForTimeout(50);
  await input.setInputFiles({ name: 'agent-on-camera.vtt', mimeType: 'text/vtt', buffer: Buffer.from('WEBVTT\n') }); await page.waitForTimeout(50);
  assert.deepEqual(await page.evaluate(() => window.__persisted), ['kitchen.jpg', 'agent-on-camera.vtt']);
  // Dropped on the dialog: the same check.
  await page.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array(1024)], 'walkthrough.mp4', { type: 'video/mp4' })); document.querySelector('#qa-media h1').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); });
  await page.waitForTimeout(80);
  assert.deepEqual(await page.evaluate(() => window.__persisted), ['kitchen.jpg', 'agent-on-camera.vtt'], 'a dropped video is stopped too');
  await help.getByRole('button', { name: 'Close' }).click();
  // The button in the dialog opens the same steps.
  await dlg.getByRole('button', { name: 'Add a video from Google Drive' }).click();
  assert.match(await help.innerText(), /Videos are too large for this upload/);
  await help.getByRole('button', { name: 'Close' }).click();
  await page.evaluate(() => document.getElementById('qa-media').remove());
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

await check('Card thumbnail that fails (a cached 404 from an import in progress): one retry at a fresh address, then the plain broken style', async () => {
  // Every card image here fails to decode (the test server answers with a page), which exercises the retry branch.
  const id = await page.evaluate(() => Object.keys(window.PHOTOGRAFIK_THUMBS.films).find((k) => /^oct15-/.test(k)) || Object.keys(window.PHOTOGRAFIK_THUMBS.films)[0]);
  await page.evaluate((id) => { const d = document.createElement('div'); d.id = 'qa-cards'; d.innerHTML = '<a class="css-9-GridCardLink" href="#/collections/films/entries/' + id + '"><div class="css-9-CardBody"><h2>QA</h2></div></a>'; document.body.appendChild(d); window.__pgkDecorate(); }, id);
  const img = page.locator('#qa-cards img.pgk-card-thumb');
  await page.waitForFunction(() => { const i = document.querySelector('#qa-cards img.pgk-card-thumb'); return i && i.classList.contains('pgk-card-thumb--broken'); }, null, { timeout: 5000 });
  assert.equal(await img.getAttribute('data-pgk-retried'), '1', 'retried once');
  assert.equal(await img.getAttribute('src'), null, 'then given up, no endless retries');
  await page.evaluate(() => document.getElementById('qa-cards').remove());
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
  assert.equal(await page.evaluate(() => window.__g1.state.value), undefined, 'nothing left out: plain Automatic again (no value)');
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
  assert.equal(await page.evaluate(() => window.__g1.state.value), undefined);
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
  await box.waitFor(); await page.waitForFunction(() => document.activeElement && document.activeElement.getAttribute('aria-label') === 'Type the file name to confirm', null, { timeout: 2000 }).catch(() => {});
  assert.ok(await box.evaluate((e) => e === document.activeElement), 'focus moves to the name box');
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
  // The stand-in redraws the DOM, so compare the place, not the element: the Uploaded files link of the same section.
  assert.ok(await page.evaluate(() => { const a = document.activeElement; const l = document.querySelector('.pgk-slot__note .pgk-linkbtn'); return !!a && a.matches('.pgk-slot__note .pgk-linkbtn') && a.closest('[id]') === l.closest('[id]'); }), 'focus returns to the Uploaded files link');
});

await check('Placement actions retain integers, reverse priority direction, and undo without touching siblings', async () => {
  await page.evaluate(() => { window.__order = window.mountWidget('pgk-placement', { field: { name: 'sortPriority' }, value: 37, entry: { data: { title: 'Unchanged' } } }); });
  const host = page.locator('.host-pgk-placement').last();
  await host.getByRole('button', { name: 'Move higher in galleries' }).click();
  await page.waitForFunction(() => window.__order.state.value === 47);
  await host.getByRole('button', { name: 'Normal placement', exact: true }).click();
  await page.waitForFunction(() => window.__order.state.value === 0);
  await host.getByRole('button', { name: 'Undo placement change' }).click();
  await page.waitForFunction(() => window.__order.state.value === 37);
  assert.equal(await page.evaluate(() => window.__order.state.entry.data.title), 'Unchanged');
  await page.evaluate(() => { window.__order.unmount(); window.__order2 = window.mountWidget('pgk-placement', { field: { name: 'order', direction: 'ascending' }, value: 37, entry: {} }); });
  await page.locator('.host-pgk-placement').last().getByRole('button', { name: 'Earlier in project lists' }).click();
  await page.waitForFunction(() => window.__order2.state.value === 27);
  await page.evaluate(() => window.__order2.unmount());
});
await check('Testimonial visibility preserves exact order when toggled off/on, with quote untouched', async () => {
  await page.evaluate(() => { window.__review = window.mountWidget('pgk-review-display', { field: { name: 'featured' }, value: 7, entry: { data: { quote: 'Exact quotation.', approval: 'approved' } } }); });
  const host = page.locator('.host-pgk-review-display').last();
  await host.getByRole('switch').uncheck(); await page.waitForFunction(() => window.__review.state.value === undefined);
  await host.getByRole('switch').check(); await page.waitForFunction(() => window.__review.state.value === 7);
  await host.getByRole('button', { name: 'Move earlier' }).click(); await page.waitForFunction(() => window.__review.state.value === 6);
  assert.deepEqual(await page.evaluate(() => window.__review.state.entry.data), { quote: 'Exact quotation.', approval: 'approved' });
  await page.evaluate(() => window.__review.unmount());
});
await check('Category URL protection blocks changing a previously shown project; drafts remain editable', async () => {
  await page.evaluate(() => { window.PHOTOGRAFIK_PROJECTS.push({ slug: 'qa-url-lock', cat: 'commercial', hidden: false }); window.__category = window.mountWidget('pgk-category', { field: { name: 'category', options: [{ label: 'Commercial', value: 'commercial' }] }, value: 'architecture-design', entry: { slug: 'qa-url-lock' } }); });
  const host = page.locator('.host-pgk-category').last();
  assert.equal(await host.getByRole('combobox').isDisabled(), true);
  assert.match((await page.evaluate(() => window.__category.instance.isValid())).error.message, /reviewed redirect/);
  await page.evaluate(() => { window.__category.unmount(); window.__draftcat = window.mountWidget('pgk-category', { field: { name: 'category', options: [] }, value: 'commercial', entry: { newRecord: true } }); });
  assert.equal(await page.locator('.host-pgk-category').last().getByRole('combobox').isEnabled(), true);
  await page.evaluate(() => window.__draftcat.unmount());
});
await check('New Film visibility cannot bypass import readiness, and never asserts a completed publish', async () => {
  await page.evaluate(() => { window.__vis = window.mountWidget('pgk-visibility', { field: { name: 'published' }, value: true, entry: { newRecord: true, data: {} }, collection: 'films' }); });
  assert.match((await page.evaluate(() => window.__vis.instance.isValid())).error.message, /hidden draft first/);
  assert.match(await page.locator('.host-pgk-visibility').last().innerText(), /does not confirm publication/);
  await page.evaluate(() => window.__vis.unmount());
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
