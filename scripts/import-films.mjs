// Add film from Google Drive (James, Oct 13 2026: “let's have them hosted on google drive instead”).
// The original stays in James's Drive. This step makes the web copies the site serves today, exactly like the existing
// Drive process (scripts/media.mjs): a 720p H.264 film with faststart, a poster frame and a 640 px card poster,
// committed under static/ and pinned by size and SHA-256 (content/media-assets.json, content/poster-assets.json).
//
// Runs in GitHub Actions (.github/workflows/film-import.yml) after the dashboard saves a film whose
// "import.state" is "waiting" or "retry"; it can also run locally. For each such film it:
//   1. reads the Google Drive link and downloads the file the way scripts/media.mjs does (no Google sign-in: the file
//      must already be shared “Anyone with the link can view”; this step never changes sharing in Drive);
//   2. refuses anything over 200 MB, anything that is not a video, and private files, with a plain reason;
//   3. encodes, pins, adds the film to content/media-sources.json and static/v/manifest.json, and marks the record
//      ready (or failed, with the reason). The film stays a draft until James switches Published on.
// Usage: node scripts/import-films.mjs            (FILM_IMPORT_LOCAL_DIR=<dir> uses <dir>/<drive id> instead of Drive; tests)
import { readFile, writeFile, readdir, mkdir, rm, stat } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { aggregateOf } from './media-outputs.mjs';

const root = process.env.FILM_IMPORT_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_BYTES = 200 * 1024 * 1024;
const FF = process.env.FFMPEG || 'ffmpeg';
const tmp = join(process.env.RUNNER_TEMP || '/tmp', 'pgk-film-import');

/** The file id in a Google Drive link (file/d/<id>, open?id=<id>, uc?id=<id>), or a bare id. */
export function driveFileId(link) {
  const s = String(link || '').trim();
  const m = s.match(/\/file\/d\/([\w-]{20,})/) || s.match(/[?&]id=([\w-]{20,})/) || s.match(/^([\w-]{25,})$/);
  if (/\/drive\/(u\/\d+\/)?folders\//.test(s)) return null; // a folder, not a file
  return m ? m[1] : null;
}

class TooBig extends Error {}
async function download(driveId, file) {
  if (process.env.FILM_IMPORT_LOCAL_DIR) {
    const src = join(process.env.FILM_IMPORT_LOCAL_DIR, driveId);
    if (!existsSync(src)) throw new Error('This Google Drive file could not be downloaded. Check that the link is to the film itself and that it is shared “Anyone with the link can view”.');
    if ((await stat(src)).size > MAX_BYTES) throw new TooBig();
    await writeFile(file, await readFile(src)); return;
  }
  const r = await fetch(`https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`, { redirect: 'follow' });
  const type = r.headers.get('content-type') || '';
  if (!r.ok || /text\/html/.test(type)) throw new Error('Google Drive did not hand over the file. It is probably private: in Drive, choose Share → “Anyone with the link can view”, then press Retry import. (The dashboard never changes sharing for you.)');
  if (!/video|octet-stream/.test(type)) throw new Error(`Google Drive sent a ${type || 'file of unknown type'}, not a video.`);
  if (Number(r.headers.get('content-length') || 0) > MAX_BYTES) throw new TooBig();
  let n = 0;
  const limit = new Transform({ transform(chunk, _e, cb) { n += chunk.length; cb(n > MAX_BYTES ? new TooBig() : null, chunk); } });
  await pipeline(Readable.fromWeb(r.body), limit, createWriteStream(file));
}

function probe(file) {
  let txt = '';
  try { execFileSync(FF, ['-hide_banner', '-i', file], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { txt = String(e.stderr); }
  const vm = txt.match(/Video:.*?, (\d{2,5})x(\d{2,5})/);
  if (!vm) throw new Error('This file is not a video the site can use. Export an MP4 or MOV and try again.');
  const dm = txt.match(/Duration: (\d+):(\d+):([\d.]+)/);
  let [w, h] = [Number(vm[1]), Number(vm[2])];
  if (/rotation of -?90|rotate\s*:\s*-?90/.test(txt)) [w, h] = [h, w];
  return { w, h, d: dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : 0, audio: /Audio:/.test(txt) };
}
const run = (args) => execFileSync(FF, ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const pin = async (p) => { const buf = await readFile(p); return { bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') }; };
const readJson = async (p) => JSON.parse(await readFile(join(root, p), 'utf8'));
const writeJson = (p, v) => writeFile(join(root, p), JSON.stringify(v, null, 2) + '\n');

/** Encodes one film and returns what to record. Same settings as scripts/media.mjs. */
async function encode(id, src, rec) {
  const { w, h, d, audio } = probe(src);
  const vertical = h > w;
  const full = join(root, 'static/v', `${id}.mp4`); const poster = join(root, 'static/v', `${id}.webp`); const card = join(root, 'static/images/posters-sm', `${id}.webp`);
  await mkdir(dirname(full), { recursive: true }); await mkdir(dirname(card), { recursive: true });
  run(['-i', src, '-vf', `${vertical ? 'scale=720:-2' : 'scale=-2:720'}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27',
    '-maxrate', '2500k', '-bufsize', '5000k', ...(audio ? ['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : ['-an']), '-movflags', '+faststart', full]);
  const at = Math.min(Number(rec.posterTime ?? 3) || 0, Math.max(0, d - 1));
  run(['-ss', String(at), '-i', full, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '78', poster]);
  run(['-i', poster, '-vf', `${vertical ? 'scale=-2:640' : 'scale=640:-2'}:flags=lanczos`, '-c:v', 'libwebp', '-quality', '76', card]);
  // Optional playing excerpt for Page Media (muted, up to 25 s from the start), the same settings as scripts/media.mjs.
  let loop = null;
  if (rec.makeLoop) {
    loop = [0, Math.max(1, Math.min(25, Math.floor(d)))];
    run(['-ss', '0', '-t', String(loop[1]), '-i', src, '-an', '-vf', `${vertical ? 'scale=540:-2' : 'scale=-2:540'}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264',
      '-preset', 'veryfast', '-crf', '28', '-maxrate', '1500k', '-bufsize', '6000k', '-movflags', '+faststart', join(root, 'static/v', `${id}-loop.mp4`)]);
  }
  return { orientation: vertical ? 'vertical' : 'horizontal', duration: Math.round(d), width: w, height: h, posterAt: at, loop };
}

export async function importFilms({ now = new Date().toISOString() } = {}) {
  const dir = join(root, 'content/media');
  const todo = [];
  for (const f of (await readdir(dir)).filter((x) => x.endsWith('.json')).sort()) {
    const rec = JSON.parse(await readFile(join(dir, f), 'utf8'));
    if (rec.type === 'video' && rec.drive && rec.import && ['waiting', 'retry'].includes(rec.import.state)) todo.push({ id: f.replace(/\.json$/, ''), file: join(dir, f), rec });
  }
  const results = [];
  for (const { id, file, rec } of todo) {
    await mkdir(tmp, { recursive: true });
    const src = join(tmp, `${id}.src`);
    try {
      const driveId = driveFileId(rec.drive);
      if (!driveId) throw new Error('Paste the Google Drive link of the film file (it looks like drive.google.com/file/d/…). A folder link will not work.');
      try { await download(driveId, src); } catch (e) { if (e instanceof TooBig) throw new Error('The file is larger than 200 MB. Export a smaller finished version (for example 1080p H.264) and try again.'); throw e; }
      const meta = await encode(id, src, rec);
      // Pins and manifests, exactly as the committed media expects them.
      const assets = await readJson('content/media-assets.json');
      for (const n of [`${id}.mp4`, `${id}.webp`, ...(meta.loop ? [`${id}-loop.mp4`] : [])]) assets.files[`/v/${n}`] = await pin(join(root, 'static/v', n));
      const manifest = JSON.parse(await readFile(join(root, 'static/v/manifest.json'), 'utf8'));
      manifest[id] = { orientation: meta.orientation, duration: meta.duration, width: meta.width, height: meta.height };
      await writeFile(join(root, 'static/v/manifest.json'), JSON.stringify(manifest));
      assets.files['/v/manifest.json'] = await pin(join(root, 'static/v/manifest.json'));
      assets.count = Object.keys(assets.files).length;
      assets.totalBytes = Object.values(assets.files).reduce((a, x) => a + x.bytes, 0);
      assets.aggregate = createHash('sha256').update(aggregateOf(assets.files)).digest('hex');
      await writeJson('content/media-assets.json', assets);
      const posters = await readJson('content/poster-assets.json');
      posters.files[`/images/posters-sm/${id}.webp`] = await pin(join(root, 'static/images/posters-sm', `${id}.webp`));
      await writeJson('content/poster-assets.json', posters);
      const sources = await readJson('content/media-sources.json');
      sources.items = sources.items.filter((it) => it.id !== id);
      sources.items.push({ id, drive: driveId, posterAt: meta.posterAt, ...(meta.loop ? { loop: meta.loop } : {}), _note: `Added from the dashboard (Add film from Google Drive), ${now.slice(0, 10)}. The original stays in Drive.` });
      await writeJson('content/media-sources.json', sources);
      delete rec.makeLoop;
      Object.assign(rec, { src: `/v/${id}.mp4`, poster: `/v/${id}.webp`, orientation: meta.orientation, duration: meta.duration, source: 'drive',
        import: { state: 'ready', at: now, message: `Imported from Google Drive (${meta.width}×${meta.height}, ${meta.duration} s). The original stays in Drive.` } });
      results.push({ id, state: 'ready' });
    } catch (e) {
      rec.import = { state: 'failed', at: now, message: String(e.message || e).slice(0, 400) };
      results.push({ id, state: 'failed', message: rec.import.message });
    } finally { await rm(src, { force: true }); }
    await writeFile(file, JSON.stringify(rec, null, 2) + '\n');
  }
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const results = await importFilms();
  for (const r of results) console.log(`film import: ${r.id} ${r.state}${r.message ? `: ${r.message}` : ''}`);
  if (!results.length) console.log('film import: nothing waiting');
}
