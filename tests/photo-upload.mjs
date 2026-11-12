// Real browser image decoding/encoding, not a mocked canvas or a file-size-only assertion.
import { chromium, firefox, webkit } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const engines = { chromium, firefox, webkit };
const engine = process.env.PHOTO_BROWSER || 'chromium';
const browser = await engines[engine].launch({ channel: engine === 'chromium' ? process.env.PLAYWRIGHT_CHANNEL || undefined : undefined, executablePath: process.env.PHOTO_EXECUTABLE || undefined });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('about:blank');
await page.addScriptTag({ content: await readFile(new URL('../src/admin/photo-upload.js', import.meta.url), 'utf8') });
const results = await page.evaluate(async () => {
  const api = window.PHOTOGRAFIK_PHOTO_UPLOAD;
  const results = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  async function source(w, h, type = 'image/jpeg', noise = false, alpha = false) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (noise) {
      const data = ctx.createImageData(w, h); let seed = 42;
      for (let i = 0; i < data.data.length; i += 4) {
        for (let k = 0; k < 3; k++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data.data[i + k] = seed >>> 24; }
        data.data[i + 3] = alpha && i < w * 16 ? 0 : 255;
      }
      ctx.putImageData(data, 0, 0);
    } else {
      if (!alpha) { ctx.fillStyle = '#3487b2'; ctx.fillRect(0, 0, w, h); }
      ctx.fillStyle = '#e94326'; ctx.fillRect(w / 4, h / 4, w / 2, h / 2);
    }
    const blob = await new Promise(r => c.toBlob(r, type, 0.95));
    c.width = c.height = 0;
    return new File([blob], 'original.' + (type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'), { type, lastModified: 12345 });
  }
  async function inspect(result) {
    const b = await createImageBitmap(result.file);
    check(b.width === result.width && b.height === result.height, 'Output bytes must agree with reported dimensions');
    check(Math.max(b.width, b.height) <= 2400, 'Long edge exceeded 2400');
    check(result.file.size < 5000000, 'Output must be strictly below decimal 5 MB');
    const out = { width: b.width, height: b.height, bytes: result.file.size, type: result.file.type, changed: result.changed };
    b.close(); return out;
  }
  for (const [name, w, h, type] of [
    ['landscape', 4600, 3100, 'image/jpeg'], ['portrait', 3200, 4800, 'image/jpeg'],
    ['square WebP', 3000, 3000, 'image/webp'], ['transparent PNG', 4000, 3000, 'image/png'],
  ]) {
    const orig = await source(w, h, type, false, type === 'image/png');
    const r = await api.prepare(orig); const out = await inspect(r);
    check(Math.abs(out.width / out.height - w / h) < 0.002, 'Aspect ratio changed');
    check(Math.max(out.width, out.height) === 2400, 'Normal large photo should have 2400 long edge');
    if (type === 'image/png') {
      const c = document.createElement('canvas'); c.width = c.height = 1;
      const b = await createImageBitmap(r.file); c.getContext('2d').drawImage(b, 0, 0);
      check(c.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 0, 'PNG alpha was flattened'); b.close();
    }
    results.push({ name, ...out });
  }
  const small = await source(800, 1200);
  const unchanged = await api.prepare(small);
  check(unchanged.file === small && !unchanged.changed, 'Small compliant photo must stay byte-identical');
  results.push({ name: 'small unchanged', ...await inspect(unchanged) });
  for (const size of [5000000, 6100000]) {
    const padded = new File([small, new Uint8Array(size - small.size)], 'large-file.jpg', { type: 'image/jpeg' });
    const r = await api.prepare(padded);
    check(r.width === 800 && r.height === 1200 && r.changed, 'Compress an oversized file without upscaling');
    results.push({ name: 'oversized bytes ' + size, ...await inspect(r) });
  }
  const noisy = await source(2400, 2400, 'image/png', true, true);
  check(noisy.size > 5000000, 'Fixture must genuinely exceed 5 MB');
  const compressed = await api.prepare(noisy);
  const decoded = await createImageBitmap(compressed.file);
  const alphaCanvas = document.createElement('canvas'); alphaCanvas.width = alphaCanvas.height = 1;
  alphaCanvas.getContext('2d').drawImage(decoded, 0, 0);
  check(alphaCanvas.getContext('2d').getImageData(0, 0, 1, 1).data[3] === 0, 'Compression must keep transparency'); decoded.close();
  results.push({ name: 'large noisy PNG compression', inputBytes: noisy.size, ...await inspect(compressed) });
  const opaque = await source(2400, 2400, 'image/png', true, false);
  const opaqueResult = await api.prepare(opaque);
  check(opaqueResult.width === 2400 && opaqueResult.height === 2400, 'Opaque photo should stay 2400px even without a WebP encoder: ' + JSON.stringify({ width: opaqueResult.width, height: opaqueResult.height, size: opaqueResult.file.size, type: opaqueResult.file.type }));
  results.push({ name: 'large opaque PNG compression', inputBytes: opaque.size, ...await inspect(opaqueResult) });

  // A real EXIF orientation=6 JPEG: landscape encoded pixels must become an upright portrait after preparation.
  const c = document.createElement('canvas'); c.width = 3200; c.height = 2000;
  const ctx = c.getContext('2d');
  for (const [colour, x, y] of [['red', 0, 0], ['lime', 1600, 0], ['blue', 0, 1000], ['yellow', 1600, 1000]]) { ctx.fillStyle = colour; ctx.fillRect(x, y, 1600, 1000); }
  const jpg = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95))).arrayBuffer());
  const exif = new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  const rotated = new File([jpg.slice(0, 2), exif, jpg.slice(2)], 'phone-portrait.jpg', { type: 'image/jpeg' });
  const upright = await api.prepare(rotated);
  check(upright.width === 1500 && upright.height === 2400, 'EXIF rotation must remain upright and portrait');
  const b = await createImageBitmap(upright.file);
  c.width = 1500; c.height = 2400; ctx.drawImage(b, 0, 0); b.close();
  const px = ctx.getImageData(375, 600, 1, 1).data;
  check(px[2] > 200 && px[0] < 40, 'Rotated top-left should be blue, without double rotation');
  c.width = c.height = 0;
  results.push({ name: 'EXIF upright portrait', ...await inspect(upright) });
  for (const [name, file, expected] of [
    ['invalid file', new File(['not an image'], 'broken.jpg', { type: 'image/jpeg' }), /could not be opened/],
    ['HEIC guidance', new File(['heic'], 'phone.heic', { type: 'image/heic' }), /HEIC/],
  ]) {
    let error; try { await api.prepare(file); } catch (e) { error = e.message; }
    check(error && expected.test(error), name + ' should fail with useful guidance'); results.push({ name, rejected: true });
  }
  return results;
});
assert.equal(errors.length, 0, errors.join('\n'));
for (const r of results) console.log('PASS', r.name, JSON.stringify(r));
if (process.env.PHOTO_RESULTS) { await mkdir(new URL('.', 'file://' + process.env.PHOTO_RESULTS).pathname, { recursive: true }); await writeFile(process.env.PHOTO_RESULTS, JSON.stringify({ engine, results, errors }, null, 2)); }
await browser.close();
