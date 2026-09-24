// Browser tests (Playwright, Chromium). Run: node tests/e2e.mjs
// Remote media is intercepted and replaced with a local fixture so tests are deterministic.
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { start } from './serve.mjs';

const fixture = await readFile(new URL('./fixtures/vertical.webm', import.meta.url));
const server = await start(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();
const results = [];
const shots = new URL('../docs/screenshots/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });

async function newPage(viewport = { width: 1280, height: 900 }, opts = {}) {
  const ctx = await browser.newContext({ viewport, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.route(/replit\.app\/media\//, (r) => r.fulfill({ status: 200, contentType: 'video/webm', body: fixture }));
  await page.route(/\/v\/[^/]+\.mp4/, (r) => r.fulfill({ status: 200, contentType: 'video/webm', body: fixture }));
  await page.route(/\/v\/[^/]+\.webp/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#55615c"/></svg>' }));
  await page.route(/replit\.app\/images\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000"><rect width="100%" height="100%" fill="#6b7a78"/></svg>' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  return page;
}

async function check(name, fn) {
  try { await fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, err: e.message.split('\n')[0] }); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

// ---------- Pricing ----------
await check('pricing: starting prices shown before entry', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate/pricing');
  const lux = await p.textContent('[data-price-for="luxury-media"]');
  assert(lux.includes('Starting at') && lux.includes('$1,970'), lux);
  await p.context().close();
});

const boundaryCases = [
  [2500, { 'luxury-media': '$1,970', 'signature': '$2,985', 'photography': '$250' }],
  [2501, { 'luxury-media': '$2,140', 'signature': '$3,155', 'photography': '$305' }],
  [3500, { 'luxury-media': '$2,140', 'listing-starter': '$795' }],
  [3501, { 'luxury-media': '$2,315', 'listing-starter': '$870' }],
  [4500, { 'social-media': '$1,320', 'video-both': '$1,535' }],
  [4501, { 'social-media': '$1,420', 'video-both': '$1,640' }],
  [5500, { 'social-media': '$1,420', 'twilight': '$575' }],
  [5501, { 'social-media': '$1,515', 'floor-plan': '$350' }],
  [30000, { 'signature': '$7,560', 'floor-plan': '$950' }],
];
await check('pricing: every boundary updates all cards from one table', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate/pricing');
  for (const [sq, exp] of boundaryCases) {
    await p.fill('#sqft', String(sq));
    for (const [id, amt] of Object.entries(exp)) {
      const t = await p.textContent(`[data-price-for="${id}"]`);
      assert(t.includes(amt) && t.includes('Price for'), `${sq} ${id}: ${t}`);
    }
  }
  await p.context().close();
});

await check('pricing: 30,001 shows custom quote, fixed add-ons unchanged', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate/pricing');
  await p.fill('#sqft', '30001');
  const t = await p.textContent('[data-price-for="signature"]');
  assert(t.includes('Request a custom quote'), t);
  const fixed = await p.textContent('[data-fixed="listing-engine"]');
  assert(fixed.includes('$1,000'), fixed);
  await p.context().close();
});

await check('pricing: invalid input rejected politely on blur', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate/pricing');
  for (const [v, msg] of [['abc', 'as a number'], ['0', 'greater than zero'], ['-50', 'greater than zero'], ['2500.5', 'whole number']]) {
    await p.fill('#sqft', v);
    await p.locator('#sqft').blur();
    const err = await p.textContent('#sqft-error');
    assert(err.includes(msg), `${v}: ${err}`);
    assert((await p.getAttribute('#sqft', 'aria-invalid')) === 'true', 'aria-invalid');
    const lux = await p.textContent('[data-price-for="luxury-media"]');
    assert(lux.includes('Starting at'), 'reverts to starting');
  }
  await p.fill('#sqft', '');
  await p.locator('#sqft').blur();
  assert(await p.isHidden('#sqft-error'), 'blank shows no error');
  await p.context().close();
});

await check('pricing: live region announces band once (debounced)', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate/pricing');
  await p.type('#sqft', '3200', { delay: 30 });
  await p.waitForTimeout(900);
  const live = await p.textContent('#price-live');
  assert(live === 'Prices updated for 3,200 sq ft.', live);
  await p.context().close();
});

await check('pricing: tabs work by keyboard', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate/pricing');
  await p.focus('#tab-packages');
  await p.keyboard.press('ArrowRight');
  assert((await p.getAttribute('#tab-photo', 'aria-selected')) === 'true', 'photo selected');
  assert(await p.isVisible('#panel-photo'), 'photo panel visible');
  await p.keyboard.press('End');
  assert((await p.getAttribute('#tab-addons', 'aria-selected')) === 'true', 'addons selected');
  await p.context().close();
});

await check('pricing: ?sqft= deep link', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate/pricing?sqft=4501');
  const t = await p.textContent('[data-price-for="luxury-media"]');
  assert(t.includes('$2,485'), t);
  await p.context().close();
});

// ---------- Gallery ----------
await check('gallery: filters intersect, clear works, empty state is honest', async () => {
  const p = await newPage();
  await p.goto(base + '/work');
  const total = await p.locator('#work-grid .card').count();
  await p.selectOption('#f-service', 'video');
  const vids = await p.locator('#work-grid .card:not([hidden])').count();
  assert(vids > 0 && vids < total, `video ${vids}/${total}`);
  await p.selectOption('#f-category', 'agent-content');
  const both = await p.locator('#work-grid .card:not([hidden])').evaluateAll((els) => els.map((e) => [e.dataset.service, e.dataset.category]));
  assert(both.length > 0 && both.every(([s, c]) => s.includes('video') && c === 'agent-content'), JSON.stringify(both));
  assert(p.url().includes('service=video') && p.url().includes('category=agent-content'), 'url sync');
  await p.selectOption('#f-service', 'studio');
  await p.selectOption('#f-category', 'real-estate');
  assert(await p.isVisible('#work-empty'), 'empty state visible');
  await p.click('[data-clear-filters]');
  assert((await p.locator('#work-grid .card:not([hidden])').count()) === total, 'cleared');
  await p.context().close();
});

await check('gallery: filter state restored from URL', async () => {
  const p = await newPage();
  await p.goto(base + '/work?category=architecture-design');
  const cats = await p.locator('#work-grid .card:not([hidden])').evaluateAll((els) => els.map((e) => e.dataset.category));
  assert(cats.length && cats.every((c) => c === 'architecture-design'), cats.join());
  await p.context().close();
});

// ---------- Video ----------
await check('video: plays inline in its frame, no dialog/route change, one at a time', async () => {
  const p = await newPage();
  await p.goto(base + '/work');
  const url = p.url();
  const players = p.locator('[data-video]');
  assert((await players.count()) >= 2, 'need two players');
  await players.nth(0).locator('.vplayer__start').click();
  await p.waitForFunction(() => { const v = document.querySelectorAll('[data-video] video')[0]; return v && !v.paused && v.currentTime > 0; }, null, { timeout: 8000 });
  assert((await p.locator('dialog, [role="dialog"]').count()) === 0, 'no dialog');
  assert(p.url() === url, 'no route change');
  assert((await p.context().pages()).length === 1, 'no new tab');
  const inFrame = await players.nth(0).evaluate((el) => { const v = el.querySelector('video'); const a = el.getBoundingClientRect(), b = v.getBoundingClientRect(); return b.width <= a.width + 1 && b.height <= a.height + 1 && v.controls; });
  assert(inFrame, 'video stays inside frame with controls');
  await players.nth(1).scrollIntoViewIfNeeded();
  await players.nth(1).locator('.vplayer__start').click();
  await p.waitForFunction(() => { const v = document.querySelectorAll('[data-video] video'); return !v[1].paused && v[0].paused; }, null, { timeout: 8000 });
  await p.context().close();
});

await check('video: start button is keyboard operable and labelled', async () => {
  const p = await newPage();
  await p.goto(base + '/work');
  const btn = p.locator('[data-video] .vplayer__start').first();
  const label = await btn.getAttribute('aria-label');
  assert(label && label.startsWith('Play '), label);
  await btn.focus();
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => !document.querySelector('[data-video] video').paused, null, { timeout: 8000 });
  await p.context().close();
});

await check('video: pauses when scrolled offscreen', async () => {
  const p = await newPage({ width: 390, height: 780 });
  await p.goto(base + '/work');
  await p.locator('[data-video] .vplayer__start').first().click();
  await p.waitForFunction(() => !document.querySelector('[data-video] video').paused, null, { timeout: 8000 });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForFunction(() => document.querySelector('[data-video] video').paused, null, { timeout: 5000 });
  await p.context().close();
});

await check('video: every player has a real source (no "Unable to play media")', async () => {
  const p = await newPage();
  for (const path of ['/', '/work', '/agent-content', '/real-estate/pricing', '/commercial']) {
    await p.goto(base + path);
    const missing = await p.locator('video').evaluateAll((vs) => vs.filter((v) => !v.getAttribute('src') && !v.querySelector('source[src]')).length);
    assert(missing === 0, `${path}: ${missing} videos without src`);
  }
  await p.context().close();
});

await check('video: vertical frames are 9:16', async () => {
  const p = await newPage();
  await p.goto(base + '/work');
  const ratios = await p.locator('.vplayer--vertical').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return +(r.width / r.height).toFixed(3); }));
  assert(ratios.length && ratios.every((r) => Math.abs(r - 0.5625) < 0.01), ratios.join());
  await p.context().close();
});

// ---------- Forms, links, redirects ----------
await check('contact: required-field errors, then mailto fallback without email key', async () => {
  const p = await newPage();
  await p.goto(base + '/contact?type=agency');
  assert((await p.inputValue('#i-type')) === 'agency', 'type preselected from URL');
  await p.click('#inquiry button[type=submit]');
  assert(await p.isVisible('#i-name-err'), 'name error');
  assert((await p.getAttribute('#i-email', 'aria-invalid')) === 'true', 'email invalid');
  assert(await p.evaluate(() => document.activeElement.id === 'i-name'), 'focus moved to first error');
  await p.fill('#i-name', 'Test Person');
  await p.fill('#i-email', 'test@example.com');
  let mailto = null;
  p.on('request', (r) => { if (r.url().startsWith('mailto:')) mailto = r.url(); });
  await p.click('#inquiry button[type=submit]');
  await p.waitForSelector('#form-fallback:not([hidden])');
  const href = await p.getAttribute('#fallback-mailto', 'href');
  assert(href.startsWith('mailto:info@photografikstudios.com') && href.includes('Test%20Person'), href);
  assert(mailto === null, 'email app must not open automatically');
  const events = await p.evaluate(() => (window.dataLayer || []).map((e) => e.event));
  assert(!events.includes('inquiry_submit') && events.includes('inquiry_draft_prepared'), events.join());
  assert((await p.textContent('#form-fallback h2')).includes('not been sent'), 'labelled unsent');
  await p.click('#fallback-back');
  assert((await p.inputValue('#i-name')) === 'Test Person', 'details retained after going back');
  await p.context().close();
});

await check('contact: first view is short; extra questions are optional and collapsed', async () => {
  const p = await newPage();
  await p.goto(base + '/contact');
  const visibleFields = await p.locator('#inquiry input:visible:not([name=website]), #inquiry select:visible, #inquiry textarea:visible').count();
  assert(visibleFields <= 4, `visible fields ${visibleFields}`);
  await p.click('#more-details summary');
  assert(await p.isVisible('#i-timing'), 'optional details open');
  await p.context().close();
});

await check('booking CTAs point to HD Photo Hub', async () => {
  const p = await newPage();
  for (const path of ['/', '/real-estate', '/real-estate/pricing']) {
    await p.goto(base + path);
    const hrefs = await p.locator('[data-track="book_click"]').evaluateAll((els) => els.map((e) => e.href));
    assert(hrefs.length && hrefs.every((h) => h === 'https://photografikstudios.hd.pics/order'), path + ' ' + hrefs.join());
  }
  await p.context().close();
});

await check('redirects from old Squarespace and Replit routes', async () => {
  const cases = { '/articles/how-to-prep-a-home-for-photos': '/real-estate#faq', '/articles/2023/11/17/elevate-your-long-island-real-estate-social-media-strategy-in-2024-a-comprehensive-guide': '/agent-content', '/pricing': '/real-estate/pricing', '/hamptons-real-estate-photography': '/real-estate', '/real-estate-media': '/real-estate', '/portfolio': '/work', '/about-photografik-studios': '/about', '/podcast': '/creator-studios' };
  for (const [from, to] of Object.entries(cases)) {
    const r = await fetch(base + from, { redirect: 'manual' });
    assert([307, 308].includes(r.status) && r.headers.get('location') === to, `${from} -> ${r.status} ${r.headers.get('location')}`);
  }
});

await check('all internal links resolve (no 404s)', async () => {
  const p = await newPage();
  const pages = ['/', '/real-estate', '/real-estate/pricing', '/agent-content', '/architecture-design', '/commercial', '/agency-partnerships', '/creator-studios', '/work', '/about', '/contact'];
  const hrefs = new Set();
  for (const path of pages) {
    await p.goto(base + path);
    (await p.locator('a[href^="/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))).forEach((h) => hrefs.add(h.split('#')[0].split('?')[0]));
  }
  const bad = [];
  for (const h of hrefs) { const r = await fetch(base + h, { redirect: 'manual' }); if (r.status >= 400) bad.push(`${h} ${r.status}`); }
  assert(!bad.length, bad.join(', '));
  await p.context().close();
});

await check('a11y basics: one h1, labelled controls, alt on images, no JS errors', async () => {
  const p = await newPage();
  const pages = ['/', '/real-estate', '/real-estate/pricing', '/agent-content', '/architecture-design', '/commercial', '/agency-partnerships', '/creator-studios', '/work', '/work/revivaluxe', '/about', '/contact'];
  const issues = [];
  for (const path of pages) {
    await p.goto(base + path);
    const r = await p.evaluate(() => ({
      h1: document.querySelectorAll('h1').length,
      noAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length,
      unlabeled: [...document.querySelectorAll('input:not([type=hidden]):not([tabindex="-1"]), select, textarea')].filter((el) => !(el.labels?.length || el.getAttribute('aria-label'))).length,
      emptyButtons: [...document.querySelectorAll('button')].filter((b) => !(b.textContent.trim() || b.getAttribute('aria-label'))).length,
      dupIds: (() => { const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); return ids.filter((x, i) => ids.indexOf(x) !== i); })(),
    }));
    if (r.h1 !== 1) issues.push(`${path}: ${r.h1} h1`);
    if (r.noAlt) issues.push(`${path}: ${r.noAlt} img without alt`);
    if (r.unlabeled) issues.push(`${path}: ${r.unlabeled} unlabeled controls`);
    if (r.emptyButtons) issues.push(`${path}: ${r.emptyButtons} empty buttons`);
    if (r.dupIds.length) issues.push(`${path}: duplicate ids ${r.dupIds.join(',')}`);
  }
  if (p.errors.length) issues.push('JS errors: ' + p.errors.join(' | '));
  assert(!issues.length, issues.join('; '));
  await p.context().close();
});

await check('mobile: no horizontal overflow at 360px', async () => {
  const p = await newPage({ width: 360, height: 780 }, { isMobile: true, hasTouch: true });
  const over = [];
  for (const path of ['/', '/real-estate', '/real-estate/pricing', '/work', '/contact', '/agent-content', '/commercial', '/work/lauryn-koke-daniel-gale-sothebys']) {
    await p.goto(base + path);
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    if (w > 361) over.push(`${path} ${w}px`);
  }
  assert(!over.length, over.join(', '));
  await p.context().close();
});

await check('mobile: menu opens and closes with Escape', async () => {
  const p = await newPage({ width: 390, height: 800 }, { isMobile: true, hasTouch: true });
  await p.goto(base + '/');
  await p.click('.menu-toggle');
  assert(await p.isVisible('#site-nav'), 'open');
  await p.keyboard.press('Escape');
  assert(!(await p.isVisible('#site-nav')), 'closed');
  await p.context().close();
});

// ---------- Home ----------
await check('home: video hero, two quick-book tiles, four video path tiles', async () => {
  const p = await newPage();
  await p.goto(base + '/');
  assert((await p.locator('.hero video[data-ambient]').count()) === 1, 'hero video');
  assert((await p.locator('.quick__tile').count()) === 2, 'quick tiles');
  const book = await p.locator('.quick__tile').first().locator('a[href*="hd.pics/order"]').count();
  assert(book === 1, 'listing tile books via HD Photo Hub');
  const project = await p.locator('.quick__tile').nth(1).locator('a[href="/contact"]').count();
  assert(project === 1, 'brand tile starts a project');
  const tiles = await p.locator('.paths--4 .path').evaluateAll((els) => els.map((e) => [e.getAttribute('href'), !!e.querySelector('video[data-ambient] source')]));
  assert(tiles.length === 4 && tiles.every(([, v]) => v) && tiles[3][0] === '/creator-studios', JSON.stringify(tiles));
  assert(!(await p.locator('text=Good-enough media').count()), 'old statement removed');
  await p.context().close();
});

await check('home: background video respects reduced motion and has a pause control', async () => {
  const p = await newPage({ width: 1280, height: 900 }, { reducedMotion: 'reduce' });
  await p.goto(base + '/');
  await p.waitForTimeout(400);
  const playing = await p.locator('video[data-ambient]').evaluateAll((vs) => vs.filter((v) => !v.paused).length);
  assert(playing === 0, `playing under reduced motion: ${playing}`);
  assert((await p.getAttribute('[data-motion-toggle]', 'aria-pressed')) === 'true', 'toggle reflects paused');
  await p.context().close();
});

// Screenshots for the handoff
for (const [name, path, vp] of [['desktop-pricing', '/real-estate/pricing?sqft=3200', { width: 1440, height: 1100 }], ['mobile-pricing', '/real-estate/pricing?sqft=5501', { width: 390, height: 1400 }], ['desktop-work', '/work?service=video', { width: 1440, height: 1100 }], ['mobile-work', '/work', { width: 390, height: 1400 }]]) {
  const p = await newPage(vp);
  await p.goto(base + path);
  await p.screenshot({ path: shots + name + '.png' });
  await p.context().close();
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n      ${r.err}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
