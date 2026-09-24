import { chromium } from 'playwright';
import { start } from '/home/claude/PS_website/tests/serve.mjs';
const s = await start(0); const base = `http://localhost:${s.address().port}`;
const b = await chromium.launch();
const jobs = JSON.parse(process.argv[2]);
for (const [name, path, w, h, full] of jobs) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.route(/replit\.app\/images\//, (r) => r.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a7a66"/><stop offset=".55" stop-color="#4d5550"/><stop offset="1" stop-color="#2a2f2b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>` }));
  await p.route(/fonts\.g/, (r) => r.abort());
  await p.route(/\/v\/.*\.webp/, (r) => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#6d6255"/></svg>' }));
  await p.goto(base + path); await p.waitForTimeout(300);
  await p.screenshot({ path: `/tmp/${name}.png`, fullPage: !!full });
  await ctx.close();
}
await b.close(); s.close();
