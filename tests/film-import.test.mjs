// Add film from Google Drive: the import step on synthetic films in a throwaway copy (never the real content).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, writeFile, readFile, truncate } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let hasFfmpeg = true; try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { hasFfmpeg = false; }

test('Drive links: file links and ids are read; folders and other links are refused', async () => {
  const { driveFileId } = await import('../scripts/import-films.mjs');
  const id = '1lLiXcO-L60Jx7NlHQPGEZHlmSXs7ntsa';
  assert.equal(driveFileId(`https://drive.google.com/file/d/${id}/view?usp=sharing`), id);
  assert.equal(driveFileId(`https://drive.google.com/open?id=${id}`), id);
  assert.equal(driveFileId(id), id);
  assert.equal(driveFileId('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345'), null);
  assert.equal(driveFileId('https://example.com/film.mp4'), null);
});

test('film import: a synthetic Drive film becomes pinned web copies and a ready draft; private, oversized and folder links fail with a reason', { skip: !hasFfmpeg && 'ffmpeg not installed', timeout: 120000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgk-film-'));
  await mkdir(join(dir, 'content/media'), { recursive: true });
  await mkdir(join(dir, 'static/v'), { recursive: true });
  for (const f of ['media-assets.json', 'poster-assets.json', 'media-sources.json']) await cp(join(root, 'content', f), join(dir, 'content', f));
  await cp(join(root, 'static/v/manifest.json'), join(dir, 'static/v/manifest.json'));
  const drive = join(dir, 'drive'); await mkdir(drive);
  const ok = 'QAsyntheticFilmOkAAAAAAAAAAAAA1'; const big = 'QAsyntheticFilmBigAAAAAAAAAAAA2';
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '4', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', join(drive, ok) + '.mp4']);
  await cp(join(drive, ok) + '.mp4', join(drive, ok));
  await writeFile(join(drive, big), ''); await truncate(join(drive, big), 201 * 1024 * 1024);
  const film = (id, link) => writeFile(join(dir, 'content/media', `${id}.json`), JSON.stringify({ type: 'video', title: `QA ${id}`, drive: link, category: 'real-estate', service: ['video'], published: false, rights: 'approved', packageIds: [], capturedYear: null, posterTime: 1, import: { state: 'waiting' } }));
  await film('qa-film-ok', `https://drive.google.com/file/d/${ok}/view`);
  await film('qa-film-big', `https://drive.google.com/file/d/${big}/view`);
  await film('qa-film-private', 'https://drive.google.com/file/d/QAsyntheticFilmPrivateAAAAAA3/view');
  await film('qa-film-folder', 'https://drive.google.com/drive/folders/QAsyntheticFolderAAAAAAAAAAA4');
  process.env.FILM_IMPORT_ROOT = dir; process.env.FILM_IMPORT_LOCAL_DIR = drive;
  const { importFilms } = await import(`../scripts/import-films.mjs?run=${Date.now()}`);
  const results = Object.fromEntries((await importFilms({ now: '2026-10-13T20:00:00Z' })).map((r) => [r.id, r]));
  delete process.env.FILM_IMPORT_ROOT; delete process.env.FILM_IMPORT_LOCAL_DIR;

  assert.equal(results['qa-film-ok'].state, 'ready');
  const rec = JSON.parse(await readFile(join(dir, 'content/media/qa-film-ok.json'), 'utf8'));
  assert.equal(rec.src, '/v/qa-film-ok.mp4'); assert.equal(rec.poster, '/v/qa-film-ok.webp');
  assert.equal(rec.orientation, 'horizontal'); assert.equal(rec.duration, 4); assert.equal(rec.published, false, 'stays a draft');
  assert.match(rec.import.message, /original stays in Drive/);
  const assets = JSON.parse(await readFile(join(dir, 'content/media-assets.json'), 'utf8'));
  for (const p of ['/v/qa-film-ok.mp4', '/v/qa-film-ok.webp', '/v/manifest.json']) {
    const buf = await readFile(join(dir, 'static', p));
    assert.equal(assets.files[p].sha256, createHash('sha256').update(buf).digest('hex'), `${p} pinned`);
  }
  assert.equal(assets.count, Object.keys(assets.files).length);
  const posters = JSON.parse(await readFile(join(dir, 'content/poster-assets.json'), 'utf8'));
  assert.ok(posters.files['/images/posters-sm/qa-film-ok.webp']);
  const sources = JSON.parse(await readFile(join(dir, 'content/media-sources.json'), 'utf8'));
  assert.equal(sources.items.find((i) => i.id === 'qa-film-ok').drive, ok);
  assert.ok(JSON.parse(await readFile(join(dir, 'static/v/manifest.json'), 'utf8'))['qa-film-ok']);

  assert.equal(results['qa-film-big'].state, 'failed'); assert.match(results['qa-film-big'].message, /larger than 200 MB/);
  assert.equal(results['qa-film-private'].state, 'failed'); assert.match(results['qa-film-private'].message, /Anyone with the link/);
  assert.equal(results['qa-film-folder'].state, 'failed'); assert.match(results['qa-film-folder'].message, /folder link will not work/);
  assert.ok(!existsSync(join(dir, 'static/v/qa-film-big.mp4')), 'nothing written for a failed film');
});

test('loader: a film still importing (or failed) never reaches the site', async () => {
  const { loadWork } = await import('../src/lib/work-load.js');
  const w = await loadWork(root);
  assert.ok(w.media.every((m) => !(m.type === 'video' && m.drive && m.import && m.import.state !== 'ready' && !m.src)));
  assert.ok(Array.isArray(w.importing));
});

test('film import on the latest branch: owner edits made during the import are kept; changed links and finished films are skipped', { skip: !hasFfmpeg && 'ffmpeg not installed', timeout: 120000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgk-film-race-'));
  await mkdir(join(dir, 'content/media'), { recursive: true }); await mkdir(join(dir, 'static/v'), { recursive: true });
  for (const f of ['media-assets.json', 'poster-assets.json', 'media-sources.json']) await cp(join(root, 'content', f), join(dir, 'content', f));
  await cp(join(root, 'static/v/manifest.json'), join(dir, 'static/v/manifest.json'));
  const drive = join(dir, 'drive'); await mkdir(drive);
  const ids = { a: 'QAraceFilmAAAAAAAAAAAAAAAAAAAA1', b: 'QAraceFilmBBBBBBBBBBBBBBBBBBBB2', c: 'QAraceFilmCCCCCCCCCCCCCCCCCCCC3', d: 'QAraceFilmDDDDDDDDDDDDDDDDDDDD4', e: 'QAraceFilmEEEEEEEEEEEEEEEEEEEE5' };
  for (const v of Object.values(ids)) execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25', '-t', '2', '-c:v', 'libx264', '-f', 'mp4', join(drive, v)]);
  const rec = (id, link, more = {}) => ({ type: 'video', title: `QA ${id}`, drive: `https://drive.google.com/file/d/${link}/view`, category: 'real-estate', service: ['video'], published: false, rights: 'approved', packageIds: [], capturedYear: null, posterTime: 1, import: { state: 'waiting' }, ...more });
  const put = (id, r) => writeFile(join(dir, 'content/media', `${id}.json`), JSON.stringify(r, null, 2));
  await put('qa-a', rec('a', ids.a)); await put('qa-b', rec('b', ids.b)); await put('qa-c', rec('c', ids.c)); await put('qa-d', rec('d', ids.d));
  // A film already on the site being replaced with a new export: it keeps its current copy while it waits.
  await put('qa-e', rec('e', ids.e, { src: '/v/qa-e.mp4', poster: '/v/qa-e.webp', import: { state: 'retry' }, published: true }));
  process.env.FILM_IMPORT_ROOT = dir; process.env.FILM_IMPORT_LOCAL_DIR = drive;
  const mod = await import(`../scripts/import-films.mjs?race=${Date.now()}`);
  const out = join(dir, 'out');
  assert.equal((await mod.encodeWaiting(out)).filter((r) => r.state === 'ready').length, 5);
  assert.ok(!existsSync(join(dir, 'static/v/qa-a.mp4')), 'encoding alone changes nothing in the repository');
  // Meanwhile: James renames film A, changes film B's link, and another run already finished film C.
  await put('qa-a', rec('a', ids.a, { title: 'Renamed by James', alt: 'Owner text' }));
  await put('qa-b', rec('b', 'QAraceFilmNEWNEWNEWNEWNEWNEWN4'));
  await put('qa-c', rec('c', ids.c, { src: '/v/qa-c.mp4', import: { state: 'ready', at: 'earlier', message: 'done' } }));
  await put('qa-d', rec('d', ids.d, { posterTime: 0 }));
  const applied = Object.fromEntries((await mod.applyResults(out)).map((r) => [r.id, r]));
  delete process.env.FILM_IMPORT_ROOT; delete process.env.FILM_IMPORT_LOCAL_DIR;
  const read = async (id) => JSON.parse(await readFile(join(dir, 'content/media', `${id}.json`), 'utf8'));
  const a = await read('qa-a');
  assert.equal(a.import.state, 'ready'); assert.equal(a.title, 'Renamed by James'); assert.equal(a.alt, 'Owner text'); assert.equal(a.src, '/v/qa-a.mp4');
  assert.equal(applied['qa-b'].state, 'skipped'); assert.equal((await read('qa-b')).import.state, 'waiting', 'the new link waits for the next run');
  assert.equal(applied['qa-c'].state, 'skipped'); assert.equal((await read('qa-c')).import.message, 'done', 'not imported twice');
  assert.equal(applied['qa-d'].state, 'skipped', 'poster frame changed during encoding: old output not used'); assert.equal((await read('qa-d')).import.state, 'waiting');
  assert.equal((await read('qa-e')).import.state, 'ready', 'replacement recorded'); assert.equal((await read('qa-e')).src, '/v/qa-e.mp4');
  const assets = JSON.parse(await readFile(join(dir, 'content/media-assets.json'), 'utf8'));
  assert.ok(assets.files['/v/qa-a.mp4'] && !assets.files['/v/qa-b.mp4'] && !assets.files['/v/qa-c.mp4'], 'only the recorded film is pinned');
});

test('loader: a film being replaced keeps playing its current copy; a new film appears only when ready', async () => {
  const { loadWork } = await import('../src/lib/work-load.js');
  const dir = await mkdtemp(join(tmpdir(), 'pgk-film-load-'));
  for (const d of ['content']) await cp(join(root, d), join(dir, d), { recursive: true });
  const base = { type: 'video', category: 'real-estate', service: ['video'], rights: 'approved', packageIds: [], capturedYear: null, published: true, drive: 'https://drive.google.com/file/d/QAloadAAAAAAAAAAAAAAAAAAAAAA1/view' };
  await writeFile(join(dir, 'content/media/qa-new.json'), JSON.stringify({ ...base, title: 'New', import: { state: 'waiting' } }));
  await writeFile(join(dir, 'content/media/qa-replacing.json'), JSON.stringify({ ...base, title: 'Replacing', src: '/v/qa-replacing.mp4', poster: '/v/qa-replacing.webp', import: { state: 'retry' } }));
  const w = await loadWork(dir);
  assert.ok(!w.media.some((m) => m.id === 'qa-new')); assert.ok(w.media.some((m) => m.id === 'qa-replacing'));
});
