// Evidence: top of overlay and non-overlay pages in review mode (review strip in flow, header below it).
import { chromium } from 'playwright';
import { start } from './serve.mjs';
const server = await start(0); const base = `http://localhost:${server.address().port}`;
const b = await chromium.launch();
const out = new URL('../docs/screenshots/', import.meta.url).pathname;
for (const vp of [{ width: 1280, height: 720 }, { width: 375, height: 812 }]) for (const [n, path] of [['home', '/'], ['arch', '/architecture-design'], ['about', '/about#reviews'], ['pricing', '/real-estate/pricing']]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  await p.goto(base + path, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-in')));
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}top-${n}-${vp.width}.png` });
  await p.context().close();
}
await b.close(); server.close();
