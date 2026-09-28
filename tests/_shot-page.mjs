// Full-page screenshots of the local build with real media (posters/stills). Usage: node tests/_shot-page.mjs /path out-prefix
import { chromium } from 'playwright'; import { start } from './serve.mjs';
const [path, out] = process.argv.slice(2);
const server = await start(0); const base = `http://localhost:${server.address().port}`;
const b = await chromium.launch();
for (const w of [1280, 375]) {
  const p = await (await b.newContext({ viewport: { width: w, height: w === 375 ? 812 : 900 } })).newPage();
  await p.goto(base + path, { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important} .reveal,.reveal-img{opacity:1!important;transform:none!important}' });
  await p.evaluate(async () => { document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; }); document.querySelectorAll('video[data-poster]').forEach((v) => { v.poster = v.dataset.poster; }); for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}-${w}.png`, fullPage: true });
  await p.context().close();
}
await b.close(); server.close();
