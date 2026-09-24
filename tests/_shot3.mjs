import { chromium } from 'playwright';
import { start } from './serve.mjs';
const s = await start(0); const base = `http://localhost:${s.address().port}`;
const b = await chromium.launch();
for (const [name, path, w, h] of JSON.parse(process.argv[2])) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.route(/\/images\/photografik-2027\//, (r) => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000"><rect width="100%" height="100%" fill="#6b7a78"/></svg>' }));
  await p.route(/fonts\.g/, (r) => r.abort());
  await p.route(/\/v\/.*\.webp/, (r) => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#6d6255"/></svg>' }));
  await p.goto(base + path); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelectorAll('.reveal,.reveal-img').forEach((e) => e.classList.add('is-in')));
  await p.screenshot({ path: `/tmp/${name}.png`, fullPage: true });
  await ctx.close();
}
await b.close(); s.close();
