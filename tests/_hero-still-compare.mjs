// Session 53: hero still before/after. Same pixels on screen? Which still files does each viewport request?
import { chromium, webkit } from 'playwright';
import { writeFile } from 'node:fs/promises';
const OLD = process.env.OLD || 'http://localhost:4173', NEW = process.env.NEW || 'http://localhost:4174';
const out = process.env.OUT || '/tmp/claude-0/hero-cmp'; await import('node:fs').then((f) => f.mkdirSync(out, { recursive: true }));
const R = [];
for (const [bname, bt] of (process.env.WEBKIT ? [['chrome', chromium], ['webkit', webkit]] : [['chrome', chromium]])) {
  const b = await bt.launch();
  for (const [w, h, mobile] of [[390, 844, true], [412, 915, true], [360, 640, true], [768, 1024, true], [1280, 900, false]]) for (const path of ['/', '/real-estate', '/architecture-design', '/commercial', '/creator-studios', '/agent-content']) {
    const shots = {};
    for (const [tag, base] of [['old', OLD], ['new', NEW]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: bname === 'chrome' ? mobile : undefined, hasTouch: mobile, deviceScaleFactor: 2, reducedMotion: 'reduce' });
      const p = await ctx.newPage(); const req = [];
      p.on('request', (r) => { const u = r.url(); if (/\/v\/[\w-]+\.webp|\/images\/hero\//.test(u)) req.push(u.replace(base, '')); });
      await p.goto(base + path, { waitUntil: 'load' }); await p.waitForTimeout(3200);
      await p.addStyleTag({ content: '.hero__inner,.page-hero__inner,.site-header,.review-bar,.hero__media::after,.page-hero__media::after,.motion-toggle{visibility:hidden!important} .hero__media::after,.page-hero__media::after{display:none!important}' });
      const sel = (await p.locator('.hero__media').count()) ? '.hero__media' : '.page-hero__media';
      shots[tag] = await p.locator(sel).first().screenshot({ path: `${out}/${bname}-${w}-${path.replace(/\W/g, '') || 'home'}-${tag}.png` });
      shots[tag + 'Req'] = [...new Set(req)].filter((u) => !/-sm\.webp/.test(u));
      await ctx.close();
    }
    R.push({ b: bname, w, h, path, oldReq: shots.oldReq, newReq: shots.newReq, sameSize: shots.old.length > 0 });
  }
  await b.close();
}
await writeFile(out + '/requests.json', JSON.stringify(R, null, 1));
for (const r of R) console.log(r.b, r.w + 'x' + r.h, r.path, 'old', r.oldReq.join(' '), '| new', r.newReq.join(' '));
