// Legacy asset pinning: every legacy still/clip the site references is pinned by size and SHA-256, the build never
// names Replit, and check:legacy rejects a committed file whose bytes differ from its pin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pins = JSON.parse(await readFile(join(root, 'content/legacy-assets.json'), 'utf8'));

test('pin manifest is well formed and Replit-free', async () => {
  const files = Object.entries(pins.files);
  assert.equal(files.length, pins.count);
  assert.equal(files.reduce((a, [, p]) => a + p.bytes, 0), pins.totalBytes);
  for (const [ref, p] of files) {
    assert.match(ref, /^\/(images|media)\/photografik-2027\/[\w\-./]+\.(webp|mp4)$/);
    assert.match(p.sha256, /^[0-9a-f]{64}$/);
    assert.ok(p.bytes > 1000);
  }
  assert.doesNotMatch(pins.recordedFrom, /replit/i);
  const sources = await readFile(join(root, 'content/media-sources.json'), 'utf8');
  assert.doesNotMatch(sources, /legacyOrigin|replit\.app/i);
  const media = await readFile(join(root, 'scripts/media.mjs'), 'utf8');
  assert.doesNotMatch(media, /replit\.app|legacyOrigin/i);
});

test('every legacy path the site references is pinned, and a wrong file is rejected', async () => {
  execFileSync('node', ['src/build.mjs'], { cwd: root, env: { ...process.env, SKIP_MEDIA: '1' }, stdio: 'pipe' });
  const out = spawnSync('node', ['scripts/legacy-check.mjs'], { cwd: root, encoding: 'utf8' });
  assert.doesNotMatch(out.stdout, /unpinned/);
  const ref = Object.keys(pins.files)[0];
  const tmp = await mkdtemp(join(tmpdir(), 'legacy-'));
  try {
    await mkdir(dirname(join(tmp, ref)), { recursive: true });
    await writeFile(join(tmp, ref), 'not the pinned bytes');
    const bad = spawnSync('node', ['scripts/legacy-check.mjs', '--static', tmp], { cwd: root, encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, new RegExp(`mismatch\\s+static${ref.replace(/[.]/g, '\\.')}`));
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('web-ready media list covers the published catalog, and check:media rejects a wrong file', async () => {
  const { publishedOutputs } = await import('../scripts/media-outputs.mjs');
  const need = await publishedOutputs(root);
  assert.ok(need.includes('/v/manifest.json'));
  assert.ok(need.length > 100);
  const media = await readFile(join(root, 'scripts/media.mjs'), 'utf8');
  assert.doesNotMatch(media, /bridge|recordedFrom/, 'no download fallback for legacy files');
  const tmp = await mkdtemp(join(tmpdir(), 'media-'));
  try {
    await mkdir(join(tmp, 'v'), { recursive: true });
    await writeFile(join(tmp, need[0]), 'not the pinned bytes');
    const bad = spawnSync('node', ['scripts/media-check.mjs', '--static', tmp], { cwd: root, encoding: 'utf8' });
    assert.equal(bad.status, 1);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});

test('deployable builds fail fast when committed media are incomplete (no Drive download, no ffmpeg)', () => {
  const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  assert.match(vercel.buildCommand, /^node scripts\/media-check\.mjs && /, 'Vercel preflight runs check:media first');
  const env = { ...process.env }; delete env.MEDIA_ALLOW_ENCODE; delete env.SKIP_MEDIA;
  const pins = existsSync(join(root, 'content/media-assets.json')) ? JSON.parse(readFileSync(join(root, 'content/media-assets.json'), 'utf8')) : {};
  if (Object.keys(pins.files || {}).length && spawnSync('node', ['scripts/media-check.mjs'], { cwd: root }).status === 0) return; // complete set committed: nothing to refuse
  const t0 = Date.now();
  const r = spawnSync('node', ['scripts/media.mjs'], { cwd: root, env, encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refusing to download from Drive or encode/);
  assert.doesNotMatch(r.stdout, /fetching static ffmpeg/);
  assert.ok(Date.now() - t0 < 15000, 'fails in seconds');
  const pre = spawnSync('node', ['scripts/media-check.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(pre.status, 1, 'Vercel preflight (buildCommand starts with media-check) also fails');
});
