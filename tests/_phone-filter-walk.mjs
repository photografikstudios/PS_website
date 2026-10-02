// Benchmark buyer task 5 at phone width: filter the Real Estate gallery to films, then play a vertical and a
// horizontal film inline (by tap), recording the selected state, controls and outcome at each step.
//   BASE=http://localhost:4173 [WEBKIT=1] [SHOTS=dir] node tests/_phone-filter-walk.mjs
import { chromium, webkit, devices } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
const BASE = process.env.BASE || 'http://localhost:4173';
const SHOTS = process.env.SHOTS || '/tmp/claude-0/walk5'; await mkdir(SHOTS, { recursive: true });
const runs = [['chrome-390', chromium, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]];
if (process.env.WEBKIT) runs.push(['webkit-iphone13', webkit, { ...devices['iPhone 13'] }]);
const results = [];
for (const [name, bt, opts] of runs) {
  const b = await bt.launch(); const ctx = await b.newContext(opts); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const R = { name, steps: [], ok: true }; const step = (label, data, ok) => { R.steps.push({ label, ok, ...data }); if (!ok) R.ok = false; };
  await p.goto(BASE + '/real-estate', { waitUntil: 'load' });
  // 1. Reach the gallery and filter it to films.
  await p.locator('#portfolio').scrollIntoViewIfNeeded();
  const before = await p.textContent('#rg-count');
  const type = p.locator('#rg-type');
  const options = await type.evaluate((s) => [...s.options].map((o) => `${o.value || '(all)'}=${o.textContent.trim()}`));
  await type.tap(); await type.selectOption('video'); await p.waitForTimeout(400);
  const f = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('#rg-grid .gcard:not([hidden])')];
    const s = document.querySelector('#rg-type');
    return { selected: s.value, selectedLabel: s.selectedOptions[0].textContent.trim(), count: document.querySelector('#rg-count').textContent.trim(), url: location.pathname + location.search,
      shown: cards.length, kinds: [...new Set(cards.map((c) => c.dataset.kind))], vertical: cards.filter((c) => c.classList.contains('gcard--vertical')).length, horizontal: cards.filter((c) => c.classList.contains('gcard--horizontal')).length,
      reset: !!document.querySelector('.filters__clear') && getComputedStyle(document.querySelector('.filters__clear')).display !== 'none', overflow: document.documentElement.scrollWidth - innerWidth, live: document.querySelector('#rg-count').closest('[aria-live]') ? 'aria-live' : (document.querySelector('#rg-count').getAttribute('aria-live') || 'none') };
  });
  step('filter to films', { before, options, ...f }, f.selected === 'video' && f.kinds.length === 1 && f.kinds[0] === 'video' && f.vertical > 0 && f.horizontal > 0 && f.overflow <= 0);
  await p.screenshot({ path: `${SHOTS}/${name}-1-filtered.png`, timeout: 60000 }).catch((e) => errs.push('shot ' + e.message.slice(0, 60)));
  // 2 + 3. Tap a vertical film, then a horizontal one; each must play inside its own card.
  const play = async (orient) => {
    const card = p.locator(`#rg-grid .gcard--${orient}:not([hidden])`).first();
    const btn = card.locator('button.gcard__open');
    const label = await btn.getAttribute('aria-label');
    await btn.scrollIntoViewIfNeeded(); await btn.tap();
    const v = card.locator('video');
    await v.waitFor({ timeout: 10000 });
    await p.waitForFunction((el) => el && !el.paused && el.currentTime > 0.6, await v.elementHandle(), { timeout: 20000 }).catch(() => {});
    const d = await card.evaluate((c) => {
      const v = c.querySelector('video'); const r = v.getBoundingClientRect(); const cr = c.getBoundingClientRect();
      const all = [...document.querySelectorAll('#rg-grid video')];
      return { playing: !v.paused, t: +v.currentTime.toFixed(2), controls: v.controls, playsinline: v.playsInline || v.hasAttribute('playsinline'), muted: v.muted,
        src: (v.currentSrc || '').replace(location.origin, ''), videoWH: [v.videoWidth, v.videoHeight], box: [Math.round(r.width), Math.round(r.height)], ratio: +(r.width / r.height).toFixed(3),
        insideCard: r.left >= cr.left - 1 && r.right <= cr.right + 1 && r.top >= cr.top - 1 && r.bottom <= cr.bottom + 1, dialog: !!document.querySelector('dialog[open]'), url: location.pathname + location.search,
        othersPlaying: all.filter((x) => x !== v && !x.paused).length, fullscreen: !!document.fullscreenElement || !!document.webkitFullscreenElement, overflow: document.documentElement.scrollWidth - innerWidth };
    });
    await p.screenshot({ path: `${SHOTS}/${name}-${orient}.png`, timeout: 60000 }).catch((e) => errs.push('shot ' + e.message.slice(0, 60)));
    return { film: label, ...d };
  };
  const vert = await play('vertical');
  step('play vertical film inline', vert, vert.playing && vert.controls && vert.playsinline && vert.insideCard && !vert.dialog && !vert.fullscreen && vert.ratio < 0.7 && vert.othersPlaying === 0 && vert.overflow <= 0);
  const hor = await play('horizontal');
  step('play horizontal film inline', hor, hor.playing && hor.controls && hor.playsinline && hor.insideCard && !hor.dialog && !hor.fullscreen && hor.ratio > 1.4 && hor.othersPlaying === 0 && hor.overflow <= 0);
  const after = await p.evaluate(() => ({ selected: document.querySelector('#rg-type').value, url: location.pathname + location.search }));
  step('filter kept after playback', after, after.selected === 'video');
  R.errors = errs; results.push(R);
  console.log(name, R.ok ? 'PASS' : 'FAIL', JSON.stringify(R.steps));
  await b.close();
}
await writeFile(`${SHOTS}/walk5.json`, JSON.stringify(results, null, 1));
