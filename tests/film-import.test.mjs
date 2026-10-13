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
  assert.ok(w.media.every((m) => !(m.type === 'video' && m.drive && m.import && m.import.state !== 'ready')));
  assert.ok(Array.isArray(w.importing));
});
