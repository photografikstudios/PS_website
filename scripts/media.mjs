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
const out = join(root, 'dist', 'v');
const cache = join(root, 'node_modules', '.cache', 'pgk-media');
const tmp = '/tmp/pgk-media-src';
const VERSION = 'v3'; // bump to force re-encoding

if (process.env.SKIP_MEDIA === '1') { console.log('media: skipped (SKIP_MEDIA=1)'); process.exit(0); }

const { items } = JSON.parse(await readFile(join(root, 'content/media-sources.json'), 'utf8'));
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
  if (!r.ok || !/video|octet-stream/.test(type)) throw new Error(`drive ${r.status} ${type}`);
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

const ff = await ensureFfmpeg();
const manifest = {};
let failed = 0;
const t0 = Date.now();

for (const it of items) {
  const key = `${it.id}-${VERSION}`;
  const full = join(cache, `${key}.mp4`);
  const poster = join(cache, `${key}.webp`);
  const loop = join(cache, `${key}-loop.mp4`);
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
          '-preset', 'veryfast', '-crf', '28', '-maxrate', it.loopHeight > 540 ? '3500k' : '1500k', '-bufsize', '6000k', '-movflags', '+faststart', loop]);
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
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest));
console.log(`media: done in ${Math.round((Date.now() - t0) / 1000)}s, ${Object.keys(manifest).length} ok, ${failed} failed`);
