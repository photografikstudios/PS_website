import { chromium } from 'playwright';
import { start } from './serve.mjs';
const server = await start(0); const base = `http://localhost:${server.address().port}`;
const b = await chromium.launch();
for (const vp of [{ width: 1280, height: 720 }, { width: 375, height: 812 }]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  await p.goto(base + '/architecture-design', { waitUntil: 'networkidle' });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } document.querySelectorAll('.reveal,.reveal-img').forEach(e => e.classList.add('is-in')); document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; }); await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); scrollTo(0, 0); });
  await p.waitForTimeout(1500);
  const secs = await p.evaluate(() => [...document.querySelectorAll('main > section, main > div > section, body > main section.section, section.page-hero, section.hero')].filter((s, i, a) => !a.some(o => o !== s && o.contains(s))).map(s => { const r = s.getBoundingClientRect(); return `${(s.id || s.className).slice(0, 34).padEnd(34)} top ${Math.round(r.top + scrollY)} h ${Math.round(r.height)}`; }));
  const imgs = await p.evaluate(() => { const i = [...document.images]; return `${i.filter(x => x.complete && x.naturalWidth > 0).length}/${i.length}`; });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(`\n${vp.width}px  images loaded ${imgs}  overflow ${ov}  page ${await p.evaluate(() => document.body.scrollHeight)}`); secs.forEach(s => console.log('  ' + s));
  await p.evaluate(() => { const h = document.querySelector('.site-header, header'); if (h) h.style.position = 'absolute'; });
  await p.screenshot({ path: `/home/claude/PS_website/docs/screenshots/arch-story-${vp.width}.png`, fullPage: true });
}
await b.close(); server.close();
