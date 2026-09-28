// Video pipeline: Google Drive originals -> web-ready files in dist/v/.
// Runs after src/build.mjs on Vercel. Zero dependencies; downloads a static ffmpeg on first run.
// Encoded outputs are kept in node_modules/.cache/pgk-media so later builds reuse them.
//
// For each item in content/media-sources.json this writes:
//   /v/<id>.mp4      full film, H.264/AAC, 720p (horizontal) or 720x1280 (vertical), faststart
//   /v/<id>.webp     poster frame
//   /v/<id>-loop.mp4 short muted loop (only when "loop" is set), for the hero and home tiles
//
// Skip entirely with SKIP_MEDIA=1 (local tests). Items that fail are reported, never fatal.

import { readFile, mkdir, copyFile, stat, rm, writeFile } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Rights-pending candidates are a local, owner-only review. They can never be built on Vercel or CI, and they go to a
// separate dist-candidates/ folder, so the deployable dist/ cannot contain them even by mistake.
const candidateBuild = process.env.INCLUDE_RIGHTS_PENDING === '1';
if (candidateBuild && (process.env.VERCEL || process.env.CI || process.env.VERCEL_ENV)) {
  console.error('Refusing to build: INCLUDE_RIGHTS_PENDING=1 is set in a Vercel/CI environment. Rights-pending media never enter a deployable build.');
  process.exit(1);
}
const distDir = candidateBuild ? 'dist-candidates' : 'dist';
const out = join(root, distDir, 'v');
const cache = join(root, 'node_modules', '.cache', 'pgk-media');
const tmp = '/tmp/pgk-media-src';
const VERSION = 'v3'; // bump to force re-encoding

if (process.env.SKIP_MEDIA === '1') { console.log('media: skipped (SKIP_MEDIA=1)'); process.exit(0); }

const { items: allItems } = JSON.parse(await readFile(join(root, 'content/media-sources.json'), 'utf8'));
// Rights gate (mirrors src/build.mjs): never encode or publish files for media whose rights James has not confirmed.
const workRecords = JSON.parse(await readFile(join(root, 'content/work.json'), 'utf8')).media;
const pendingIds = new Set(workRecords.filter((m) => m.rights !== 'approved').map((m) => m.id));
const items = candidateBuild ? allItems : allItems.filter((it) => !pendingIds.has(it.id));
if (allItems.length !== items.length) console.log(`media: rights gate skipped ${allItems.length - items.length} pending item(s)`);
await mkdir(out, { recursive: true });
await mkdir(cache, { recursive: true });
await mkdir(tmp, { recursive: true });

const has = async (p) => { try { return (await stat(p)).size > 0; } catch { return false; } };

async function ensureFfmpeg() {
  const dir = join(cache, 'ffmpeg-static');
  const bin = join(dir, 'ffmpeg');
  if (await has(bin)) return bin;
  await mkdir(dir, { recursive: true });
  console.log('media: fetching static ffmpeg');
  try {
    const tar = join(tmp, 'ff.tar.xz');
    const r = await fetch('https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz');
    if (!r.ok) throw new Error(`status ${r.status}`);
    await pipeline(Readable.fromWeb(r.body), createWriteStream(tar));
    execSync(`tar -xJf ${tar} -C ${tmp} && cp ${tmp}/ffmpeg-*-static/ffmpeg ${bin}`);
  } catch (e) {
    console.log(`media: xz build unavailable (${e.message}); using gzip build`);
    const r = await fetch('https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64.gz');
    if (!r.ok) throw new Error(`ffmpeg download ${r.status}`);
    const { createGunzip } = await import('node:zlib');
    await pipeline(Readable.fromWeb(r.body), createGunzip(), createWriteStream(bin));
    execSync(`chmod +x ${bin}`);
  }
  return bin;
}

async function download(id, driveId) {
  const file = join(tmp, `${id}.src`);
  const url = `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;
  const r = await fetch(url, { redirect: 'follow' });
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !/video|image|octet-stream/.test(type)) throw new Error(`drive ${r.status} ${type}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(file));
  return file;
}

const probe = (ff, file) => {
  let txt = '';
  try { execFileSync(ff, ['-hide_banner', '-i', file], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { txt = String(e.stderr); }
  const dm = txt.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const vm = txt.match(/Video:.*?, (\d{2,5})x(\d{2,5})/);
  const rot = /rotation of -?90|rotate\s*:\s*-?90/.test(txt);
  let [w, h] = vm ? [Number(vm[1]), Number(vm[2])] : [1920, 1080];
  if (rot) [w, h] = [h, w];
  return { w, h, d: dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : 0 };
};

const run = (ff, args) => execFileSync(ff, ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

// ---------- Committed web-ready media (content/media-assets.json) ----------
// When an item's encoded outputs are committed under static/v/ with the size and SHA-256 pinned in
// content/media-assets.json, the build reuses them (build.mjs has already copied static/ into dist/) and does not
// download from Drive or run ffmpeg for that item. Items without committed outputs (e.g. newly added media) still
// go through the Drive pipeline below.
const { createHash: mediaHash } = await import('node:crypto');
const { outputsFor } = await import('./media-outputs.mjs');
let mediaPins = { files: {} };
try { mediaPins = JSON.parse(await readFile(join(root, 'content/media-assets.json'), 'utf8')); } catch { /* none yet */ }
let committedManifest = {};
try { committedManifest = JSON.parse(await readFile(join(root, 'static/v/manifest.json'), 'utf8')); } catch { /* none yet */ }
const pinOk = async (name) => {
  const pin = mediaPins.files[`/v/${name}`];
  if (!pin) return false;
  try {
    const buf = await readFile(join(root, 'static/v', name));
    return buf.length === pin.bytes && mediaHash('sha256').update(buf).digest('hex') === pin.sha256;
  } catch { return false; }
};
const committedItems = new Set();
for (const it of items) {
  if (!committedManifest[it.id]) continue;
  let ok = true;
  for (const name of outputsFor(it)) if (!(await pinOk(name))) { ok = false; break; }
  if (ok) committedItems.add(it.id);
}
console.log(`media: ${committedItems.size}/${items.length} items use committed, pinned web-ready files (no Drive download, no encode)`);
const needEncode = items.some((it) => !committedItems.has(it.id));
// Fail fast: deployable builds use only committed, pinned media. Encoding from Drive is a deliberate local step
// for adding new approved media (MEDIA_ALLOW_ENCODE=1 node scripts/media.mjs, then node scripts/pin-media.mjs --from-dist).
if (needEncode && process.env.MEDIA_ALLOW_ENCODE !== '1') {
  const missing = items.filter((it) => !committedItems.has(it.id)).map((it) => it.id);
  console.error(`media: ${missing.length} item(s) lack committed, pinned web-ready files: ${missing.join(', ')}`);
  console.error('media: refusing to download from Drive or encode in this build. Commit static/v + content/media-assets.json (npm run pin:media), or run locally with MEDIA_ALLOW_ENCODE=1.');
  process.exit(1);
}
const ff = needEncode ? await ensureFfmpeg() : null;
const manifest = {};
let failed = 0;
const t0 = Date.now();

for (const it of items) {
  if (committedItems.has(it.id)) { manifest[it.id] = committedManifest[it.id]; continue; }
  if (it.montage) continue; // assembled below from already-encoded films
  // Loop-only clips (a muted excerpt and its poster, cut by hand from a staged original; see the item's _note) have no
  // Drive re-encode path: they must be committed and pinned.
  if (it.loopOnly) { failed++; console.error(`media: FAILED ${it.id}: loop-only clip is not committed and pinned under static/v`); continue; }
  if (it.image) {
    // Stills: full-size WebP (max 2000px wide) for the lightbox and a 900px card version.
    const big = join(cache, `${it.id}-img1.webp`);
    const sm = join(cache, `${it.id}-img1-sm.webp`);
    const meta = join(cache, `${it.id}-img1.json`);
    try {
      if (!(await has(big)) || !(await has(sm)) || !(await has(meta))) {
        const src = await download(it.id, it.drive);
        const { w, h } = probe(ff, src);
        run(ff, ['-i', src, '-vf', "scale='min(2000,iw)':-2:flags=lanczos", '-c:v', 'libwebp', '-quality', '80', big]);
        run(ff, ['-i', src, '-vf', "scale='min(900,iw)':-2:flags=lanczos", '-c:v', 'libwebp', '-quality', '76', sm]);
        await writeFile(meta, JSON.stringify({ orientation: h > w ? 'vertical' : 'horizontal', width: w, height: h }));
        await rm(src, { force: true });
        console.log(`media: image ${it.id} ${w}x${h}`);
      }
      await copyFile(big, join(out, `${it.id}.webp`));
      await copyFile(sm, join(out, `${it.id}-sm.webp`));
      manifest[it.id] = JSON.parse(await readFile(meta, 'utf8'));
    } catch (e) { failed++; console.error(`media: FAILED ${it.id}: ${e.message}`); }
    continue;
  }
  const key = `${it.id}-${VERSION}`;
  const full = join(cache, `${key}.mp4`);
  const poster = join(cache, `${key}.webp`);
  const loop = join(cache, `${key}${it.loopHeight === 720 ? '-h720' : ''}-loop.mp4`);
  const meta = join(cache, `${key}.json`);
  const need = !(await has(full)) || !(await has(poster)) || !(await has(meta)) || (it.loop && !(await has(loop)));
  try {
    if (need) {
      const t = Date.now();
      const src = await download(it.id, it.drive);
      const { w, h, d } = probe(ff, src);
      const vertical = h > w;
      const scale = vertical ? 'scale=720:-2:flags=lanczos' : 'scale=-2:720:flags=lanczos';
      run(ff, ['-i', src, '-vf', `${scale},format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27',
        '-maxrate', '2500k', '-bufsize', '5000k', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', full]);
      const at = Math.min(it.posterAt ?? 3, Math.max(0, d - 1));
      run(ff, ['-ss', String(at), '-i', full, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '78', poster]);
      if (it.loop) {
        const [start, len] = it.loop;
        const lscale = vertical ? 'scale=540:-2' : `scale=-2:${it.loopHeight || 540}`;
        run(ff, ['-ss', String(start), '-t', String(len), '-i', src, '-an', '-vf', `${lscale}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264',
          '-preset', 'veryfast', '-crf', '28', '-maxrate', it.loopHeight >= 1080 ? '3500k' : it.loopHeight > 540 ? '2500k' : '1500k', '-bufsize', '6000k', '-movflags', '+faststart', loop]);
      }
      await writeFile(meta, JSON.stringify({ orientation: vertical ? 'vertical' : 'horizontal', duration: Math.round(d), width: w, height: h }));
      await rm(src, { force: true });
      console.log(`media: encoded ${it.id} (${vertical ? 'vertical' : 'horizontal'}, ${Math.round(d)}s) in ${Math.round((Date.now() - t) / 1000)}s`);
    } else {
      console.log(`media: cached ${it.id}`);
    }
    await copyFile(full, join(out, `${it.id}.mp4`));
    await copyFile(poster, join(out, `${it.id}.webp`));
    if (it.loop) await copyFile(loop, join(out, `${it.id}-loop.mp4`));
    manifest[it.id] = JSON.parse(await readFile(meta, 'utf8'));
  } catch (e) {
    failed++;
    console.error(`media: FAILED ${it.id}: ${e.message}`);
  }
}
// ---------- Montages: silent 16:9 loops cut from films encoded above (e.g. the Work page reel) ----------
for (const it of items.filter((i) => i.montage && !committedItems.has(i.id))) {
  const key = `${it.id}-${VERSION}-${it.montage.map((s) => s.join('_')).join('.')}`.replace(/[^\w.-]/g, '');
  const loop = join(cache, `${key}-loop.mp4`);
  const poster = join(cache, `${key}.webp`);
  try {
    if (!(await has(loop)) || !(await has(poster))) {
      const args = [];
      const parts = [];
      it.montage.forEach(([src, start, len], i) => {
        const f = join(cache, `${src}-${VERSION}.mp4`);
        args.push('-ss', String(start), '-t', String(len), '-i', f);
        parts.push(`[${i}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=30,format=yuv420p[v${i}]`);
      });
      for (const [src] of it.montage) if (!(await has(join(cache, `${src}-${VERSION}.mp4`)))) throw new Error(`montage source ${src} not encoded`);
      const filter = `${parts.join(';')};${it.montage.map((_, i) => `[v${i}]`).join('')}concat=n=${it.montage.length}:v=1:a=0[out]`;
      run(ff, [...args, '-filter_complex', filter, '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27',
        '-maxrate', '3000k', '-bufsize', '6000k', '-movflags', '+faststart', loop]);
      run(ff, ['-ss', '1', '-i', loop, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '78', poster]);
      console.log(`media: montage ${it.id} from ${it.montage.length} films`);
    }
    await copyFile(loop, join(out, `${it.id}-loop.mp4`));
    await copyFile(poster, join(out, `${it.id}.webp`));
    manifest[it.id] = { orientation: 'horizontal', duration: it.montage.reduce((a, s) => a + s[2], 0), width: 1280, height: 720, montage: true };
  } catch (e) { failed++; console.error(`media: FAILED montage ${it.id}: ${e.message}`); }
}
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest));

// ---------- Legacy stills and clips (pinned in content/legacy-assets.json) ----------
// Every /images/photografik-2027/... or /media/photografik-2027/... path referenced by the built pages must be
// committed under static/<same path> with the size and SHA-256 pinned in content/legacy-assets.json. Nothing is
// downloaded: a missing or altered file fails the build. Check with: npm run check:legacy
const { createHash } = await import('node:crypto');
const pinned = JSON.parse(await readFile(join(root, 'content/legacy-assets.json'), 'utf8'));
const isProduction = process.env.SITE_MODE === 'production';
const sha = async (p) => createHash('sha256').update(await readFile(p)).digest('hex');
const { readdir } = await import('node:fs/promises');
async function walk(dir) {
  const acc = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) acc.push(...(await walk(p)));
    else if (e.name.endsWith('.html') || e.name.endsWith('.xml')) acc.push(p);
  }
  return acc;
}
const refs = new Set();
for (const f of await walk(join(root, distDir))) {
  const txt = decodeURIComponent((await readFile(f, 'utf8')).replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
  for (const m of txt.matchAll(/\/(?:images|media)\/photografik-2027\/[\w\-./]+?\.(?:webp|jpe?g|png|mp4)/g)) refs.add(m[0]);
}
let legacyCommitted = 0; let legacyFailed = 0;
for (const ref of [...refs].sort()) {
  const dest = join(root, distDir, ref);
  const committed = join(root, 'static', ref);
  const pin = pinned.files[ref];
  try {
    if (!pin) throw new Error('not pinned in content/legacy-assets.json');
    await mkdir(dirname(dest), { recursive: true });
    if (await has(committed)) {
      if ((await sha(committed)) !== pin.sha256) throw new Error('committed file does not match its pinned SHA-256');
      await copyFile(committed, dest); legacyCommitted++; continue;
    }
    throw new Error('not committed under static/ (run npm run fetch:legacy, then commit static/)');
  } catch (e) { legacyFailed++; failed++; console.error(`media: FAILED legacy ${ref}: ${e.message}`); }
}
console.log(`media: legacy assets ${legacyCommitted} committed and verified, ${legacyFailed} failed`);
if (legacyFailed) process.exit(1);
console.log(`media: done in ${Math.round((Date.now() - t0) / 1000)}s, ${Object.keys(manifest).length} ok, ${failed} failed`);
