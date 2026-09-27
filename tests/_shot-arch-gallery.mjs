// Evidence shots: Architecture & design gallery states at 1280 and 375 (All, Builders, Video, empty).
import { chromium } from 'playwright';
import { start } from './serve.mjs';
const server = await start(0); const base = `http://localhost:${server.address().port}`;
const b = await chromium.launch();
const out = new URL('../docs/screenshots/', import.meta.url).pathname;
for (const vp of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
  for (const [name, q] of [['all', ''], ['builders', '?segment=builder'], ['video', '?type=video'], ['empty', '?segment=builder&type=video']]) {
    const p = await (await b.newContext({ viewport: vp })).newPage();
    await p.goto(base + '/architecture-design' + q + '#portfolio', { waitUntil: 'networkidle' });
    await p.evaluate(async () => { document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-in')); document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; }); await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); const h = document.querySelector('.site-header, header'); if (h) h.style.position = 'absolute'; });
    if (name === 'video') { await p.locator('#ag-grid .gcard[data-kind="video"] button.gcard__open').first().click(); await p.waitForTimeout(1500); await p.evaluate(() => document.querySelector('#ag-grid video')?.pause()); }
    await p.waitForTimeout(600);
    await p.locator('#portfolio').screenshot({ path: `${out}arch-gallery-${name}-${vp.width}.png` });
    await p.context().close();
  }
}
await b.close(); server.close();
