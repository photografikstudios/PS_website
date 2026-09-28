// Self-hosted fonts: byte-pinned, referenced by the stylesheet, preloaded, and no third-party font requests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const PINS = {
  'instrument-serif-400-latin-60c06664.woff2': '60c06664b5a95c7de6cc3e00d1f9034d78bd1e40b564016b241674449a067d4d',
  'instrument-serif-400-italic-latin-6ee678c3.woff2': '6ee678c33f388dd7ba59700ebea635deb98821baafd817b09891f7927177f702',
  'dm-sans-latin-aa530716.woff2': 'aa530716b0d351866af7dbfa3eee4120fb36f2d071baff8c234185141865c7ff',
  'dm-sans-italic-latin-a3ea623f.woff2': 'a3ea623fec2a53e17b55994dfdf92de634c3e50e08958ebf00f4cdf2e719eccd',
  'space-mono-400-latin-e0c8e616.woff2': 'e0c8e616bda27642f4c3cebaecff6525d901e73afc8a227cbbb0f2af4810f300',
};
const dir = new URL('../src/assets/fonts/', import.meta.url);

test('font files match their pins and carry the WOFF2 signature', async () => {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.woff2')).sort();
  assert.deepEqual(files, Object.keys(PINS).sort());
  for (const [f, sha] of Object.entries(PINS)) {
    const b = await readFile(new URL(f, dir));
    assert.equal(b.subarray(0, 4).toString('latin1'), 'wOF2', f);
    assert.equal(createHash('sha256').update(b).digest('hex'), sha, f);
    assert.ok(f.includes(sha.slice(0, 8)), `${f} name carries its hash prefix`);
  }
});

test('stylesheet declares every face plus metric-matched fallbacks, used in the font stacks', async () => {
  const css = await readFile(new URL('../src/assets/styles.css', import.meta.url), 'utf8');
  for (const f of Object.keys(PINS)) assert.ok(css.includes(`/assets/fonts/${f}`), f);
  for (const fam of ['Instrument Serif', 'DM Sans', 'Space Mono']) {
    assert.match(css, new RegExp(`font-family: "${fam} Fallback";[^}]*size-adjust: [\\d.]+%;[^}]*ascent-override`));
    assert.match(css, new RegExp(`"${fam}", "${fam} Fallback"`));
  }
  assert.doesNotMatch(css, /fonts\.(googleapis|gstatic)\.com/);
});

test('layout preloads the two above-the-fold faces and makes no Google Fonts requests', async () => {
  const layout = await readFile(new URL('../src/layout.js', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /fonts\.(googleapis|gstatic)\.com/);
  for (const f of ['instrument-serif-400-latin-60c06664.woff2', 'dm-sans-latin-aa530716.woff2']) {
    assert.ok(layout.includes(`<link rel="preload" href="/assets/fonts/${f}" as="font" type="font/woff2" crossorigin>`), f);
  }
});
