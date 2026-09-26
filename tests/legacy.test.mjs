// Legacy asset pinning: every legacy still/clip the site references is pinned by size and SHA-256, the build never
// names Replit, and check:legacy rejects a committed file whose bytes differ from its pin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
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
  const dest = join(root, 'static', ref);
  let existing = null;
  try { existing = await readFile(dest); } catch { /* not committed in this checkout */ }
  if (!existing) {
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, 'not the pinned bytes');
    try {
      const bad = spawnSync('node', ['scripts/legacy-check.mjs'], { cwd: root, encoding: 'utf8' });
      assert.equal(bad.status, 1);
      assert.match(bad.stdout, new RegExp(`mismatch\\s+static${ref.replace(/[.]/g, '\\.')}`));
    } finally { await rm(dest); }
  }
});
