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
  await page.route(/\/media\/photografik-2027\//, (r) => r.fulfill({ status: 200, contentType: 'video/webm', body: fixture }));
  await page.route(/\/v\/[^/]+\.mp4/, (r) => r.fulfill({ status: 200, contentType: 'video/webm', body: fixture }));
  await page.route(/\/v\/[^/]+\.webp/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#55615c"/></svg>' }));
  await page.route(/\/images\/photografik-2027\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000"><rect width="100%" height="100%" fill="#6b7a78"/></svg>' }));
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

// ---------- Compare table: James's Sep 25 corrections ----------
await check('compare: Book Now CTA to the booking portal; common inclusions shown as rows; Day-to-night video label', async () => {
  for (const vp of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
    const p = await newPage(vp);
    await p.goto(base + '/real-estate#compare');
    const cta = p.locator('.cmp__cta a').first();
    assert((await cta.textContent()).trim().replace(/\s+/g, ' ').startsWith('Book Now'), `label ${await cta.textContent()}`);
    assert((await cta.getAttribute('href')) === 'https://photografikstudios.hd.pics/order', await cta.getAttribute('href'));
    assert((await p.textContent('.cmp__cta .small')).includes('Travel fees and sales tax are added at checkout'), 'checkout note kept');
    assert(await p.getByText('Book on HD Photo Hub').count() === 0, 'old label gone');
    const panel = p.locator('#cmp-panel-packages');
    const rows = await panel.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => ({ h: tr.querySelector('th').textContent.trim(), cells: [...tr.querySelectorAll('td')].filter((td) => getComputedStyle(td).display !== 'none').map((td) => td.textContent.trim()) })));
    for (const label of ['Standard interior and exterior photos', 'Drone photography']) {
      const r = rows.find((x) => x.h === label);
      assert(r && r.cells.length >= 2 && r.cells.every((c) => c === 'Included'), `${label}: ${JSON.stringify(r)}`);
      assert(await panel.locator('tr', { hasText: label }).isVisible(), `${label} visible`);
    }
    assert(rows.some((x) => x.h === 'Day-to-night video') && !rows.some((x) => x.h === 'Day-to-night'), 'day-to-night label');
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow at ${vp.width}`);
    await p.context().close();
  }
});

// ---------- Service portfolios (no Work page, James Sep 25) ----------
await check('portfolios: every approved item appears on its own service page, once, and nowhere links to /work', async () => {
  const work = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../content/work.json', import.meta.url), 'utf8'));
  const approved = work.media.filter((m) => m.rights === 'approved');
  const route = { 'real-estate': '/real-estate', 'agent-content': '/agent-content', 'architecture-design': '/architecture-design', commercial: '/commercial', 'creator-studios': '/creator-studios' };
  const p = await newPage();
  for (const [cat, path] of Object.entries(route)) {
    await p.goto(base + path);
    const html = await p.locator('#portfolio').evaluate((el) => el.outerHTML);
    const mine = approved.filter((m) => m.category === cat);
    let pageHtml = html;
    // Commercial (James, Sep 26): the index shows one card per project; every item lives on its project page.
    if (cat === 'commercial') for (const slug of new Set(mine.map((m) => m.project))) pageHtml += await (await fetch(`${base}/commercial/${slug}`)).text();
    // Architecture & design (owner correction, Sep 27): one card per project; the full set lives on each project page.
    if (cat === 'architecture-design') for (const slug of new Set(mine.map((m) => m.project).filter(Boolean))) pageHtml += await (await fetch(`${base}/architecture-design/${slug}`)).text();
    // Creator Studios (James, Sep 26): media sit beside their sections across the page; the full set is on All sessions.
    if (cat === 'creator-studios') pageHtml += (await p.locator('main').evaluate((el) => el.outerHTML)) + await (await fetch(`${base}/creator-studios/sessions`)).text();
    const missing = mine.filter((m) => !pageHtml.includes(m.id) && !(m.src && pageHtml.includes(m.src)) && !(m.poster && pageHtml.includes(m.poster)));
    assert(missing.length === 0, `${path} missing ${missing.map((m) => m.id)}`);
  }
  for (const path of ['/', '/real-estate', '/agent-content', '/architecture-design', '/commercial', '/creator-studios', '/about', '/field-notes', '/404', '/commercial/revivaluxe']) {
    const r = await fetch(base + path); const h = await r.text();
    assert(!/href="\/work/.test(h), `${path} links to /work`);
  }
  await p.context().close();
});

await check('portfolios: /work and old project URLs redirect to their service destination, keeping intent', async () => {
  const cases = {
    '/work': '/#selected-work',
    '/work?category=architecture-design': '/architecture-design?category=architecture-design#portfolio',
    '/work?service=video&category=real-estate': '/real-estate?service=video&category=real-estate#portfolio',
    '/work/revivaluxe': '/commercial/revivaluxe',
    '/work/lauryn-koke-daniel-gale-sothebys': '/real-estate/lauryn-koke-daniel-gale-sothebys',
    '/work/property-tour-agent-media': '/agent-content/property-tour-agent-media',
    '/work/yankee-home-builders': '/architecture-design/yankee-home-builders',
    '/work/peterson-ramlowtan': '/architecture-design/peterson-ramlowtan',
    '/work/creator-studios': '/creator-studios/sessions',
    '/portfolio': '/#selected-work',
  };
  for (const [from, to] of Object.entries(cases)) {
    const r = await fetch(base + from, { redirect: 'manual' });
    assert([307, 308].includes(r.status) && r.headers.get('location') === to, `${from} -> ${r.status} ${r.headers.get('location')}`);
    const final = await fetch(base + to.split('#')[0]);
    assert(final.status === 200, `${to} ${final.status}`);
  }
  const p = await newPage();
  await p.goto(base + '/work?service=video&category=real-estate');
  assert((await p.inputValue('#rg-type')) === 'video', 'old service=video intent kept in the Real Estate gallery');
  await p.context().close();
});

// ---------- Video ----------
await check('video: plays inline in its frame, no dialog/route change, one at a time', async () => {
  const p = await newPage();
  await p.goto(base + '/commercial');
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
  await p.goto(base + '/commercial');
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
  await p.goto(base + '/commercial');
  await p.locator('[data-video] .vplayer__start').first().click();
  await p.waitForFunction(() => !document.querySelector('[data-video] video').paused, null, { timeout: 8000 });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForFunction(() => document.querySelector('[data-video] video').paused, null, { timeout: 5000 });
  await p.context().close();
});

await check('video: every player has a real source (no "Unable to play media")', async () => {
  const p = await newPage();
  for (const path of ['/', '/agent-content', '/architecture-design', '/creator-studios', '/real-estate/pricing', '/commercial']) {
    await p.goto(base + path);
    const missing = await p.locator('video').evaluateAll((vs) => vs.filter((v) => !v.getAttribute('src') && !v.querySelector('source[src]')).length);
    assert(missing === 0, `${path}: ${missing} videos without src`);
  }
  await p.context().close();
});

await check('video: vertical frames are 9:16', async () => {
  const p = await newPage();
  await p.goto(base + '/agent-content');
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
  const cases = { '/articles/how-to-prep-a-home-for-photos': '/field-notes/how-to-prepare-a-home-for-listing-photos', '/blog-1': '/field-notes', '/articles': '/field-notes', '/articles/why-you-should-get-a-real-estate-video-done': '/real-estate#video', '/articles/2023/10/24/real-estate-marketing-the-importance-of-drone-video-photography': '/field-notes/twilight-drone-floor-plans', '/articles/2023/11/17/elevate-your-long-island-real-estate-social-media-strategy-in-2024-a-comprehensive-guide': '/agent-content', '/pricing': '/real-estate/pricing', '/hamptons-real-estate-photography': '/real-estate', '/real-estate-media': '/real-estate', '/portfolio': '/#selected-work', '/about-photografik-studios': '/about', '/podcast': '/creator-studios' };
  for (const [from, to] of Object.entries(cases)) {
    const r = await fetch(base + from, { redirect: 'manual' });
    assert([307, 308].includes(r.status) && r.headers.get('location') === to, `${from} -> ${r.status} ${r.headers.get('location')}`);
  }
});

await check('all internal links resolve (no 404s)', async () => {
  const p = await newPage();
  const pages = ['/', '/real-estate', '/real-estate/pricing', '/agent-content', '/architecture-design', '/commercial', '/agency-partnerships', '/creator-studios', '/about', '/contact', '/field-notes', '/field-notes/listing-video-horizontal-or-vertical', '/field-notes/twilight-drone-floor-plans'];
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
  const pages = ['/', '/real-estate', '/real-estate/pricing', '/agent-content', '/architecture-design', '/commercial', '/agency-partnerships', '/creator-studios', '/commercial/revivaluxe', '/about', '/contact'];
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
  for (const path of ['/', '/real-estate', '/real-estate/pricing', '/contact', '/agent-content', '/commercial', '/real-estate/lauryn-koke-daniel-gale-sothebys']) {
    await p.goto(base + path);
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    if (w > 361) over.push(`${path} ${w}px`);
  }
  assert(!over.length, over.join(', '));
  await p.context().close();
});

await check('mobile: menu opens and closes with Escape', async () => {
  const p = await newPage({ width: 390, height: 800 }, { isMobile: true, hasTouch: true });
  for (const path of ['/', '/real-estate/pricing', '/commercial', '/contact']) {
    await p.goto(base + path);
    await p.click('.menu-toggle');
    assert(await p.isVisible('#site-nav'), `open on ${path}`);
    await p.keyboard.press('Escape');
    assert(!(await p.isVisible('#site-nav')), `closed on ${path}`);
  }
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

await check('home showcase: Videos/Photos × category, lightbox, View more', async () => {
  const p = await newPage();
  await p.goto(base + '/');
  const shown = () => p.locator('#sw-grid .sw-card:not([hidden])').evaluateAll((els) => els.map((e) => [e.dataset.kind, e.dataset.category]));
  let v = await shown();
  assert(v.length > 0 && v.length <= 9 && v.every(([k, c]) => k === 'video' && c === 'real-estate'), JSON.stringify(v));
  assert((await p.getAttribute('#sw-more', 'href')) === '/real-estate?type=video#portfolio', 'view more href');
  await p.selectOption('#sw-kind', 'image');
  await p.selectOption('#sw-cat', 'architecture-design');
  v = await shown();
  assert(v.length > 0 && v.every(([k, c]) => k === 'image' && c === 'architecture-design'), JSON.stringify(v));
  assert((await p.getAttribute('#sw-more', 'href')) === '/architecture-design#portfolio', 'photo view more');
  await p.locator('#sw-grid .sw-card:not([hidden])').first().click();
  await p.locator('#lightbox[open] img').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  assert(await p.locator('#lightbox[open] img').isVisible(), 'photo lightbox');
  const t1 = await p.textContent('#lb-caption');
  await p.keyboard.press('ArrowRight');
  assert((await p.textContent('#lb-caption')) !== t1, 'next photo');
  await p.keyboard.press('Escape');
  assert(!(await p.locator('#lightbox[open]').count()), 'closed on Escape');
  assert(await p.evaluate(() => document.activeElement.classList.contains('sw-card')), 'focus returns to card');
  await p.selectOption('#sw-kind', 'video');
  await p.selectOption('#sw-cat', 'commercial');
  await p.locator('#sw-grid .sw-card:not([hidden])').first().click();
  assert(await p.locator('#lightbox[open] video[controls]').count() === 1, 'video lightbox');
  assert(p.url().endsWith('/'), 'no route change');
  await p.click('[data-lb-close]');
  assert(!(await p.locator('#lightbox video').count()), 'video removed on close');
  await p.context().close();
});

// ---------- Compare what's included (/real-estate#compare) ----------
const { resolvePrice: rp, formatUSD: usd } = await import('../src/lib/pricing-core.js');
const pricingJson = JSON.parse(await readFile(new URL('../content/pricing.json', import.meta.url)));
const allRecs = [...pricingJson.packages, ...pricingJson.services];
const cmpText = (p, id) => p.locator(`[data-cmp-price="${id}"]`).first().textContent();

await check('compare: 2,800 sq ft gives the same HDPH amounts on compare and pricing pages', async () => {
  const p = await newPage();
  const exp = { 'luxury-media': '$2,140', 'signature': '$3,155', 'social-media': '$1,220', 'listing-starter': '$795' };
  await p.goto(base + '/real-estate?sqft=2800');
  for (const [id, amt] of Object.entries(exp)) { const t = await cmpText(p, id); assert(t.includes(amt) && t.includes('2,501–3,500 sq ft'), `${id}: ${t}`); }
  assert((await p.getAttribute('#cmp-pricing', 'href')) === '/real-estate/pricing?sqft=2800', 'link carries size');
  await p.goto(base + '/real-estate/pricing?sqft=2800');
  for (const [id, amt] of Object.entries(exp)) assert((await p.textContent(`[data-price-for="${id}"]`)).includes(amt), id);
  assert((await p.getAttribute('#to-compare', 'href')) === '/real-estate?sqft=2800#compare', 'pricing → compare link carries size');
  await p.context().close();
});

await check('compare: every tier boundary of every compared item matches the pricing function', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate');
  const ids = pricingJson.compare.views.flatMap((v) => v.records);
  const sizes = [...new Set(ids.flatMap((id) => { const r = allRecs.find((x) => x.id === id); return [...r.tiers.flatMap(([m]) => [m - 1, m]), r.max, r.max + 1]; }))].filter((n) => n > 0).sort((a, b) => a - b);
  let checks = 0;
  for (const sq of sizes) {
    await p.fill('#cmp-sqft', String(sq));
    const got = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-cmp-price]')].map((e) => [e.dataset.cmpPrice, e.textContent])));
    for (const id of ids) {
      const s = rp(allRecs.find((x) => x.id === id), sq);
      const want = s.kind === 'custom' ? 'Custom quote' : usd(s.amount);
      assert(got[id].includes(want), `${id} @ ${sq}: ${got[id]} (want ${want})`);
      checks++;
    }
  }
  assert(checks > 300, `only ${checks} checks`);
  await p.context().close();
});

await check('compare: inclusions come from the same data as package cards', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate#compare');
  const cell = (row, id) => p.evaluate(([row, id]) => { const tr = [...document.querySelectorAll('#cmp-panel-packages tbody tr')].find((t) => t.querySelector('th').textContent === row); return tr.querySelector(`td[data-col="${id}"]`).textContent.trim(); }, [row, id]);
  assert((await cell('Floor plan', 'social-media')) === 'Not included', 'social floor plan');
  assert((await cell('Agent on camera', 'signature')).includes('Included'), 'signature agent');
  assert((await cell('Vertical reel', 'listing-starter')) === 'Not included', 'starter reel');
  assert((await cell('Horizontal film', 'luxury-media')).includes('Included'), 'luxury film');
  await p.click('#cmp-tab-video');
  assert(await p.isVisible('#cmp-panel-video'), 'video view');
  assert((await p.textContent('#cmp-panel-video')).includes('Film or reel, your choice'), 'video-one note');
  await p.goto(base + '/real-estate/pricing');
  const cardList = await p.locator('[data-record="social-media"] .checks li').allTextContents();
  assert(!cardList.some((t) => /floor plan/i.test(t)) && cardList.some((t) => /reel/i.test(t)), cardList.join('|'));
  await p.context().close();
});

await check('compare: keyboard tabs, column choice limit, phone shows two columns without overflow', async () => {
  const p = await newPage({ width: 390, height: 900 });
  await p.goto(base + '/real-estate');
  const cols = () => p.locator('#cmp-panel-packages thead th:not([hidden])').evaluateAll((e) => e.map((x) => x.dataset.col));
  assert((await cols()).length === 2, `phone cols ${await cols()}`);
  await p.click('#cmp-panel-packages .cmp__chip[data-col="signature"]');
  const c = await cols();
  assert(c.length === 2 && c.includes('signature'), `after choose: ${c}`);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  assert(sw <= 390, `overflow ${sw}`);
  await p.focus('#cmp-tab-packages');
  await p.keyboard.press('ArrowRight');
  assert((await p.getAttribute('#cmp-tab-video', 'aria-selected')) === 'true' && await p.evaluate(() => document.activeElement.id) === 'cmp-tab-video', 'arrow key tab');
  await p.context().close();
  const d = await newPage();
  await d.goto(base + '/real-estate');
  assert((await d.locator('#cmp-panel-packages thead th:not([hidden])').count()) === 4, 'desktop shows four');
  await d.context().close();
});

// ---------- Real Estate gallery ----------
// Fixture tags (test only, not real claims): two Luxury Media pieces (one film, one photo) and one Signature film.
const FIXTURE_TAGS = { 're-hamptons-beachfront': ['luxury-media'], 'ph-dune-twilight-pool': ['luxury-media'], 're-hamptons-calm': ['signature'] };
async function reWithTags(p, path = '/real-estate') {
  await p.route(/\/real-estate(\?.*)?$/, async (route) => {
    const res = await route.fetch();
    let html = await res.text();
    html = html.replace(/(<section[^>]*data-regallery[\s\S]*?<script type="application\/json" data-gallery-items>)([\s\S]*?)(<\/script>)/, (m, a, json, c) => {
      const items = JSON.parse(json).map((it) => ({ ...it, packages: FIXTURE_TAGS[it.id] || [] }));
      return a + JSON.stringify(items) + c;
    });
    // The server renders the package control only for packages with verified examples; mirror that for the fixture.
    html = html.replace(/(<form[^>]*data-rg-filters[^>]*>)/, '$1<div class="filters__field"><label for="rg-package">Package</label><select id="rg-package" name="package"><option value="">All packages</option><option value="luxury-media">Luxury Media (2)</option><option value="signature">Signature (1)</option></select></div>');
    await route.fulfill({ response: res, body: html, headers: { ...res.headers(), 'content-type': 'text/html' } });
  });
  await p.goto(base + path);
}
const rgShown = (p) => p.locator('#rg-grid .gcard:not([hidden])').count();

await check('RE gallery: package matches, package × type intersection, zero result, reset', async () => {
  const p = await newPage();
  await reWithTags(p);
  const total = await p.locator('#rg-grid .gcard').count();
  assert(total >= 12, `total ${total}`);
  await p.selectOption('#rg-package', 'luxury-media');
  assert(await rgShown(p) === 2 && (await p.textContent('#rg-count')) === '2 pieces', 'luxury 2');
  assert(p.url().includes('package=luxury-media'), 'url');
  await p.selectOption('#rg-package', 'signature');
  assert(await rgShown(p) === 1, 'signature 1');
  await p.selectOption('#rg-package', 'luxury-media');
  await p.selectOption('#rg-type', 'photo');
  assert(await rgShown(p) === 1, 'luxury + photo 1');
  await p.selectOption('#rg-package', 'signature');
  assert(await rgShown(p) === 0 && await p.isVisible('#rg-empty'), 'signature + photo empty');
  assert((await p.textContent('#rg-empty-title')).includes('Signature'), 'empty names package');
  assert((await p.textContent('#rg-package option[value="signature"]')).includes('(0)'), 'option count reflects type');
  await p.click('[data-rg-show-all]');
  assert(await p.inputValue('#rg-package') === '' && await rgShown(p) > 1, 'show all');
  await p.click('.filters__clear');
  assert(await p.inputValue('#rg-type') === '' && (await p.textContent('#rg-count')) === `${total} pieces`, 'reset');
  await p.context().close();
});

await check('RE gallery: untagged catalog hides the package control (no (0) options), honest note, type filter, reset, keyboard, 375 px', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate?package=signature');
  const total = await p.locator('#rg-grid .gcard').count();
  assert(await p.locator('#rg-package').count() === 0, 'no package control while nothing is tagged');
  assert(!(await p.locator('#portfolio').textContent()).match(/\(0\)/), 'no zero-result options');
  assert(!(await p.isVisible('#rg-empty')) && (await p.textContent('#rg-count')) === `${total} pieces`, 'stale ?package= link falls back to all work');
  const note = await p.textContent('.regallery__note');
  assert(/none are shown yet/.test(note) && !/some pieces/.test(note), 'note: ' + note);
  await p.focus('#rg-type');
  await p.keyboard.press('ArrowDown');
  await p.selectOption('#rg-type', 'video');
  const kinds = await p.locator('#rg-grid .gcard:not([hidden])').evaluateAll((e) => e.map((x) => x.dataset.kind));
  assert(kinds.length && kinds.every((k) => k === 'video'), kinds.join());
  assert(await p.isVisible('.filters__clear'), 'reset appears');
  await p.click('.filters__clear');
  assert(await p.inputValue('#rg-type') === '' && (await p.textContent('#rg-count')) === `${total} pieces`, 'reset to all');
  assert(await p.evaluate(() => document.activeElement.id) === 'rg-type', 'focus returns to the media filter');
  await p.context().close();
  const ph = await newPage({ width: 375, height: 812 });
  await ph.goto(base + '/real-estate?type=photo');
  assert(await ph.locator('#rg-package').count() === 0, 'phone: no package control');
  assert(await ph.evaluate(() => document.documentElement.scrollWidth) <= 375, 'phone overflow');
  await ph.context().close();
});

await check('RE gallery: Load More reveals the next batch, keeps filters, never plays hidden video', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate');
  const total = await p.locator('#rg-grid .gcard').count();
  assert(await rgShown(p) === 9, 'first batch 9');
  await p.click('#rg-more');
  assert(await rgShown(p) === Math.min(18, total), 'second batch');
  await p.selectOption('#rg-type', 'photo');
  const photos = await p.locator('#rg-grid .gcard[data-kind="image"]').count();
  assert(await rgShown(p) === Math.min(9, photos), 'filter resets to first batch');
  if (photos > 9) { await p.click('#rg-more'); assert(await rgShown(p) === Math.min(18, photos), 'more within filter'); assert(await p.inputValue('#rg-type') === 'photo', 'filter kept'); }
  assert(!(await p.locator('#rg-grid .gcard[hidden] video').count()), 'no hidden videos');
  await p.context().close();
});

await check('RE gallery: inline mode plays in the card (horizontal and vertical), one at a time', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate?type=video');
  assert((await p.getAttribute('[data-regallery]', 'data-mode')) === 'inline', 'default inline');
  await p.locator('#rg-grid .gcard--horizontal:not([hidden]) button.gcard__open').first().click();
  assert(await p.locator('#rg-grid .gcard video[controls]').count() === 1 && !(await p.locator('dialog[open]').count()), 'inline, no dialog');
  const vert = p.locator('#rg-grid .gcard--vertical button.gcard__open').first();
  if (await vert.count()) {
    await vert.scrollIntoViewIfNeeded(); await vert.click();
    const playing = await p.locator('#rg-grid video').evaluateAll((vs) => vs.filter((v) => !v.paused).length);
    assert(playing <= 1, `playing ${playing}`);
  }
  assert(!(await p.locator('#rg-grid .gcard[data-kind="image"] button').count()), 'photos not buttons inline');
  await p.context().close();
});

await check('RE gallery: lightbox mode (review override) with Escape and focus return', async () => {
  const p = await newPage();
  await p.goto(base + '/real-estate?player=lightbox');
  assert((await p.getAttribute('[data-regallery]', 'data-mode')) === 'lightbox', 'override');
  const btn = p.locator('#rg-grid .gcard[data-kind="video"]:not([hidden]) .gcard__open').first();
  await btn.focus(); await p.keyboard.press('Enter');
  assert(await p.locator('#lightbox[open] video[controls]').count() === 1, 'video lightbox');
  await p.keyboard.press('Escape');
  assert(!(await p.locator('#lightbox[open]').count()), 'closed');
  assert(await p.evaluate(() => document.activeElement.classList.contains('gcard__open')), 'focus returned');
  await p.selectOption('#rg-type', 'photo');
  await p.locator('#rg-grid .gcard:not([hidden]) .gcard__open').first().click();
  assert(await p.locator('#lightbox[open] img').count() === 1, 'photo lightbox');
  await p.context().close();
});

await check('one media collection: the same record drives Home, the Real Estate gallery and Commercial', async () => {
  const p = await newPage();
  const ids = async (path, sel) => { await p.goto(base + path); return p.evaluate((s) => JSON.parse(document.querySelector(s).textContent).map((x) => x.id), sel); };
  const home = await ids('/', '[data-showcase] [data-gallery-items]');
  const re = await ids('/real-estate', '[data-regallery] [data-gallery-items]');
  for (const id of ['re-hamptons-beachfront', 're-hamptons-calm']) assert(home.includes(id) && re.includes(id), id);
  await p.goto(base + '/commercial');
  const com = await p.locator('#portfolio [data-video]').evaluateAll((e) => e.map((x) => x.dataset.id));
  assert(com.includes('biz-rachel-lynch-pools') && home.includes('biz-rachel-lynch-pools'), 'commercial film shared with Home');
  assert(new Set(re).size === re.length && new Set(home).size === home.length && new Set(com).size === com.length, 'no duplicates');
  await p.context().close();
});

// ---------- Field Notes ----------
await check('Field Notes: nav, index, article answer-first with truthful schema', async () => {
  const p = await newPage();
  await p.goto(base + '/');
  assert(await p.locator('#site-nav a[href="/field-notes"]').count() === 1, 'primary nav');
  assert(await p.locator('.site-footer a[href="/field-notes"]').count() === 1, 'footer');
  await p.goto(base + '/field-notes');
  assert((await p.textContent('h1')).length > 5, 'index h1');
  const cards = await p.locator('.fn-card').count();
  assert(cards === 3, `cards ${cards}`);
  assert(await p.locator('.fn-card .needs-approval').count() === 3, 'drafts tagged in review');
  await p.click('.fn-card__title a >> nth=0');
  await p.waitForURL(/\/field-notes\/.+/);
  const h1 = (await p.textContent('h1')).trim();
  const answer = await p.textContent('.fn-answer');
  assert(answer.length > 120, 'direct answer first');
  const ld = await p.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((e) => JSON.parse(e.textContent)));
  const post = ld.find((x) => x['@type'] === 'BlogPosting');
  const crumbs = ld.find((x) => x['@type'] === 'BreadcrumbList');
  assert(post && post.headline === h1, 'BlogPosting headline matches h1');
  assert(!post.datePublished, 'no invented publish date on a draft');
  assert((await p.textContent('.fn-byline')).includes(post.author.name), 'author matches byline');
  assert(crumbs.itemListElement.length === 2, 'breadcrumb');
  assert((await p.getAttribute('link[rel=canonical]', 'href')).endsWith(new URL(p.url()).pathname), 'canonical');
  assert((await p.getAttribute('meta[property="og:type"]', 'content')) === 'article', 'og:type');
  assert(await p.locator('meta[name=robots][content*=noindex]').count() === 1, 'review noindex');
  await p.context().close();
});

await check('Field Notes: phone reading, keyboard TOC, inline video, sitemap excludes drafts', async () => {
  const p = await newPage({ width: 375, height: 812 });
  await p.goto(base + '/field-notes/listing-video-horizontal-or-vertical');
  assert(await p.evaluate(() => document.documentElement.scrollWidth) <= 375, 'no overflow');
  const toc = p.locator('.fn-toc a').first();
  await toc.focus(); await p.keyboard.press('Enter');
  assert(p.url().includes('#'), 'toc anchor');
  assert(await p.locator('.fn-section [data-video]').count() >= 2, 'real films inline');
  const fontSize = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.fn-body p')).fontSize));
  assert(fontSize >= 16, `body ${fontSize}px`);
  const sm = await (await fetch(base + '/sitemap.xml')).text();
  assert(!sm.includes('/field-notes/'), 'drafts not in sitemap');
  await p.goto(base + '/real-estate');
  assert(await p.locator('.fn-teaser .fn-card').count() >= 2, 'teaser on Real Estate');
  await p.context().close();
});

await check('no Replit requests; legacy media served from the site', async () => {
  const p = await newPage();
  const hits = [];
  p.on('request', (r) => { if (/replit/.test(r.url())) hits.push(r.url()); });
  for (const path of ['/', '/real-estate', '/agent-content', '/commercial', '/creator-studios', '/about', '/field-notes', '/real-estate/lauryn-koke-daniel-gale-sothebys']) {
    await p.goto(base + path);
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }
  const html = await (await fetch(base + '/')).text();
  assert(!/replit/.test(html) && hits.length === 0, `replit refs: ${hits.slice(0, 3).join(', ')}`);
  await p.context().close();
});

await check('call-to-action labels match their destinations', async () => {
  const p = await newPage();
  await p.goto(base + '/commercial');
  const labels = await p.locator('a[href^="/contact"]').allTextContents();
  assert(!labels.some((t) => /schedule/i.test(t)), labels.join('|'));
  for (const path of ['/', '/real-estate', '/agent-content', '/architecture-design', '/agency-partnerships', '/creator-studios', '/about']) {
    await p.goto(base + path);
    const bad = await p.locator('a[href^="/contact"]').evaluateAll((els) => els.map((e) => e.textContent.trim()).filter((t) => /schedule|book a call|book a studio/i.test(t)));
    assert(!bad.length, `${path}: ${bad}`);
  }
  await p.context().close();
});

// ---------- Owner direction, Sep 24: nav, hero films, Home stills, Commercial groups, Creator Studios ----------
await check('nav: Creator Studios replaces Agencies; agency partnerships stay reachable', async () => {
  const p = await newPage();
  await p.goto(base + '/');
  const labels = (await p.locator('#site-nav > ul > li > a, #site-nav .nav__item > a').allTextContents()).map((t) => t.trim());
  assert(!labels.some((l) => /^Agencies$/i.test(l)), 'Agencies still in nav: ' + labels.join('|'));
  assert(await p.locator('#site-nav a[href="/creator-studios"]').count() === 1, 'exactly one Creator Studios link in the primary nav');
  assert(await p.locator('#site-nav a[href="/agency-partnerships"]').count() === 0, 'agency page not in primary nav');
  assert(await p.locator('.site-footer a[href="/agency-partnerships"]').count() === 1, 'footer keeps agency partnerships');
  await p.goto(base + '/commercial');
  assert(await p.locator('main a[href="/agency-partnerships"]').count() >= 1, 'Commercial links to agency partnerships');
  const r = await fetch(base + '/agency-partnerships');
  assert(r.status === 200, 'agency page still served');
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(base + '/');
  await p.click('.nav-toggle, [aria-controls="site-nav"]');
  assert(await p.locator('#site-nav a[href="/creator-studios"]').isVisible(), 'mobile menu shows Creator Studios');
  await p.context().close();
});

const heroPages = { '/': 're-hamptons-beachfront', '/real-estate': 're-hamptons-calm', '/architecture-design': 'arch-99-hedges-amagansett', '/commercial': 'biz-rachel-lynch-pools', '/creator-studios': 'cs-demo-reel' };
await check('primary-nav pages open with a silent autoplaying 16:9 hero video, poster, pause/play control, no Watch the film prompt', async () => {
  for (const [path, id] of Object.entries(heroPages)) {
    const p = await newPage();
    await p.goto(base + path);
    const first = p.locator('main > section').first();
    assert(await first.getAttribute('data-hero-source') === id, `${path} hero source`);
    const v = first.locator('video[data-ambient]');
    assert(await v.count() === 1, `${path} ambient`);
    assert(await v.getAttribute('poster') === `/v/${id}.webp`, `${path} poster`);
    assert(await v.evaluate((el) => el.muted && el.hasAttribute('muted')), `${path} muted`);
    assert(await first.locator('[data-motion-toggle]').count() === 1, `${path} pause control`);
    assert(await p.getByText('Watch the film').count() === 0, `${path} has no Watch the film prompt`);
    assert(await first.locator('[data-hero-film], [data-hero-film-open]').count() === 0, `${path} has no separate film stage`);
    assert(await v.evaluate((el) => el.hasAttribute('playsinline') && el.hasAttribute('loop')), `${path} playsinline loop`);
    assert(await first.locator('.actions a, .actions button').count() >= 1, `${path} keeps its primary CTA`);
    await p.waitForFunction((sel) => { const el = document.querySelector(sel); return el && !el.paused; }, 'main > section:first-of-type video[data-ambient]', { timeout: 8000 });
    const toggle = first.locator('[data-motion-toggle]');
    assert((await toggle.textContent()).includes('Pause video'), `${path} control reads Pause video`);
    await toggle.click();
    assert(await v.evaluate((el) => el.paused), `${path} pauses`);
    assert((await toggle.textContent()).includes('Play video'), `${path} control reads Play video`);
    await toggle.click();
    await p.waitForFunction((sel) => !document.querySelector(sel).paused, 'main > section:first-of-type video[data-ambient]', { timeout: 8000 });
    assert((await first.locator('.hero-credit').textContent()).length > 10, `${path} says what is on screen`);
    await p.context().close();
  }
  const rm = await newPage({ width: 1280, height: 900 }, { reducedMotion: 'reduce' });
  await rm.goto(base + '/commercial');
  await rm.waitForTimeout(300);
  assert(await rm.locator('main > section').first().locator('video[data-ambient]').evaluate((el) => el.paused), 'reduced motion: poster only');
  await rm.context().close();
  const bl = await newPage();
  await bl.addInitScript(() => { HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('blocked', 'NotAllowedError')); }; });
  await bl.goto(base + '/real-estate');
  await bl.waitForTimeout(500);
  const blHero = bl.locator('main > section').first();
  assert(await blHero.locator('video[data-ambient]').evaluate((el) => el.paused && !!el.poster), 'autoplay blocked: poster still frame');
  assert((await blHero.locator('[data-motion-toggle]').textContent()).includes('Play video'), 'autoplay blocked: control offers Play');
  assert(await blHero.locator('h1').isVisible(), 'autoplay blocked: headline readable');
  await bl.context().close();
  const ab = await newPage();
  await ab.addInitScript(() => { HTMLMediaElement.prototype.play = function () { return new Promise((_, rej) => setTimeout(() => rej(new DOMException('interrupted by pause', 'AbortError')), 600)); }; });
  await ab.goto(base + '/commercial');
  const abToggle = ab.locator('main > section').first().locator('[data-motion-toggle]');
  await abToggle.click();
  await ab.waitForTimeout(900);
  assert((await abToggle.textContent()).includes('Play video'), 'pause while loading: stays paused (AbortError is not treated as blocked)');
  await abToggle.click();
  assert((await abToggle.textContent()).includes('Pause video'), 'pause while loading: Play resumes');
  await ab.context().close();
  const ph = await newPage({ width: 390, height: 844 });
  for (const path of Object.keys(heroPages)) {
    await ph.goto(base + path);
    const ow = await ph.evaluate(() => document.documentElement.scrollWidth);
    assert(ow <= 390, `${path} phone overflow ${ow}`);
    const box = await ph.locator('main h1').boundingBox();
    assert(box && box.y + box.height <= 844 * 1.2, `${path} headline near the fold on phone`);
  }
  await ph.context().close();
});

await check('home quick tiles use the two owner-selected stills (not video posters), responsive and cropped', async () => {
  const p = await newPage();
  await p.goto(base + '/');
  const srcs = await p.locator('.quick__media img').evaluateAll((els) => els.map((e) => e.getAttribute('src')));
  assert(srcs.length === 2 && srcs[0] === '/v/home-listings-twilight.webp' && srcs[1] === '/v/home-brand-conversation.webp', srcs.join());
  assert(await p.locator('.quick__media video').count() === 0, 'tiles are stills');
  assert(await p.locator('.paths video[data-ambient]').count() === 4, 'four video starting-point tiles remain');
  const tiles = await p.locator('.quick__tile').evaluateAll((els) => els.map((e) => [e.querySelector('.eyebrow').textContent.trim(), [...e.querySelectorAll('.actions a')].map((a) => a.getAttribute('href'))]));
  assert(tiles[0][0] === 'For your listings' && tiles[0][1][0].startsWith('https://photografikstudios.hd.pics'), JSON.stringify(tiles));
  assert(tiles[1][0] === 'For your brand' && tiles[1][1].includes('/contact'), JSON.stringify(tiles));
  const sets = await p.locator('.quick__media img').evaluateAll((els) => els.map((e) => e.getAttribute('srcset')));
  assert(sets.every((x) => /-sm\.webp 900w/.test(x) && /\.webp 2000w/.test(x)), 'responsive sources: ' + sets.join());
  await p.context().close();
});

await check('commercial (James Sep 26): value prop after hero, one case study, compact grid of one card per project, dedicated single-client project pages', async () => {
  const work = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../content/work.json', import.meta.url), 'utf8'));
  const com = work.media.filter((m) => m.category === 'commercial' && m.rights === 'approved');
  const clients = [...new Set(com.map((m) => m.clientId))];
  const p = await newPage();
  await p.goto(base + '/commercial');
  // Order: hero, value proposition, case study, then the project grid.
  const order = await p.evaluate(() => [...document.querySelectorAll('main > section')].map((s) => s.id || s.getAttribute('aria-labelledby') || s.className));
  assert(order[1] === 'com-value-h' && order[2] === 'case-study' && order[3] === 'portfolio', order.join());
  // Case study: goal, approach, delivered; unverified wording is a marked review placeholder, not a claim.
  const facts = await p.locator('#case-study .case__facts').textContent();
  for (const k of ['Goal', 'Our approach', 'Delivered']) assert(facts.includes(k), k);
  assert(await p.locator('#case-study .needs-approval').count() >= 1, 'case study wording marked for review');
  // Grid: exactly one representative card per client, 4 columns at 1440, each linking to its own project page.
  const cards = await p.locator('.pgrid__item').evaluateAll((els) => els.map((e) => ({ slug: e.dataset.project, media: e.querySelectorAll('.vplayer, .still').length, href: e.querySelector('.pgrid__title a').getAttribute('href') })));
  assert(cards.length === clients.length && new Set(cards.map((c) => c.slug)).size === clients.length, JSON.stringify(cards));
  assert(cards.every((c) => c.media === 1 && c.href === `/commercial/${c.slug}`), 'one media item + own page per card');
  const cols = await p.evaluate(() => getComputedStyle(document.querySelector('.pgrid')).gridTemplateColumns.split(' ').length);
  assert(cols === 4, 'desktop columns ' + cols);
  assert(!(await p.textContent('#portfolio')).includes('Project story'), 'no mixed blocks');
  // Contact path stays clear.
  assert(await p.locator('main a[href="/contact?type=commercial"]').count() >= 2, 'contact path');
  // Project pages: only that client's media, client, delivered, goal.
  for (const c of cards) {
    await p.goto(base + c.href);
    const ids = await p.locator('main [data-id], main img').evaluateAll((els) => els.map((e) => e.dataset?.id || e.getAttribute('src')));
    const mine = com.filter((m) => m.clientId === c.slug);
    const others = com.filter((m) => m.clientId !== c.slug);
    for (const m of mine) assert(ids.some((x) => x && (x === m.id || x.includes(m.id) || (m.src && x.includes(m.src)))), `${c.slug} missing ${m.id}`);
    for (const m of others) assert(!ids.some((x) => x && (x === m.id || (m.src && x.includes(m.src)))), `${c.slug} shows other client ${m.id}`);
    const f = await p.locator('.project__facts').textContent();
    for (const k of ['Client', 'Delivered', 'Goal']) assert(f.includes(k), `${c.slug} ${k}`);
    assert(await p.locator('.project a[href="/contact?type=commercial"]').count() >= 1, `${c.slug} contact`);
  }
  await p.context().close();
  const ph = await newPage({ width: 375, height: 812 });
  await ph.goto(base + '/commercial');
  assert(await ph.evaluate(() => getComputedStyle(document.querySelector('.pgrid')).gridTemplateColumns.split(' ').length) === 2, 'phone 2 columns');
  assert(await ph.evaluate(() => document.documentElement.scrollWidth) <= 375, 'phone overflow');
  await ph.goto(base + '/commercial/revivaluxe');
  assert(await ph.evaluate(() => document.documentElement.scrollWidth) <= 375, 'project phone overflow');
  await ph.context().close();
});

await check('creator studios: story, formats with scope, conversations, process, proof, labeled inquiry', async () => {
  const p = await newPage();
  await p.goto(base + '/creator-studios');
  const text = await p.textContent('main');
  for (const s of ['behind the business', 'Short-form clips', 'Long-form episodes', 'Multi-camera', 'reason to connect', 'cannot promise leads', 'Files within 24 hours', 'Before you book']) assert(text.includes(s), s);
  assert(await p.locator('.scope-tag--out').count() >= 2, 'separately scoped formats labelled');
  // Pricing follows licreatorstudios.com/pricing; James confirmed the $249 single session on Sep 27 2026 (it had been
  // held after Codex S15-16 because he earlier said $250). The page never claims Square checkout shows these figures.
  assert(await p.locator('.plan .needs-approval').count() === 0, 'session prices approved');
  const prices = (await p.locator('.plan__price').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
  assert(prices.length === 3 && prices[0].includes('$249') && /\$250 per hour.*2-hour minimum/i.test(prices[1]) && /\$999 per month/i.test(prices[2]), 'session prices shown: ' + prices.join('|'));
  // James, Sep 27: recorded live session within 24 hours; editing about 5 to 7 days. One promise in both places.
  assert(!/next day|immediately|72 hours/i.test(text) && (text.match(/within 24 hours/g) || []).length >= 2 && (text.match(/5 to 7 days/g) || []).length >= 2, 'single delivery promise');
  assert(await p.locator('#faq .needs-approval').count() === 0, 'delivery and cancellation confirmed by James');
  const plans = (await p.locator('.plan').allTextContents()).join(' ');
  for (const t of ['Up to 90 minutes', 'Engineer included', 'Camera operator', 'Two 90-minute sessions per month', 'Up to 10 social media clips', 'start-up package']) assert(plans.includes(t), 'plan detail: ' + t);
  assert(await p.locator('[data-session="recording-editing"] a[href^="/contact?type=creator-studios"]').count() === 1, 'Recording + Editing goes to an inquiry');
  const faqs = await p.locator('#faq details.faq__item').count();
  assert(faqs === 8 && /48 hours’ notice for a full refund/.test(text), 'FAQ with cancellation policy: ' + faqs);
  // Square is the booking destination; the page must not claim Square shows these prices or carries a selection over.
  const square = 'https://book.squareup.com/appointments/5wbvt8o7eansfd/location/LPK0R2B9CGFQE/services';
  const book = p.locator('main a:has-text("Book a Studio Session"), main a:has-text("Book this session")');
  assert(await book.count() >= 4, 'booking CTAs');
  for (const h of await book.evaluateAll((els) => els.map((e) => [e.getAttribute('href'), e.getAttribute('target'), e.getAttribute('rel')]))) assert(h[0] === square && h[1] === '_blank' && /noopener/.test(h[2]), 'square link ' + h.join());
  assert(text.includes('Long Island Creator Studios'), 'visible connection to the studio');
  assert(!/Square (shows|lists|displays)[^.]*\$|selection (carries|transfers)/i.test(text), 'no Square price or transfer claim');
  // The eight photos James approved on Sep 25 now render; all eight ids, nothing else from that folder.
  const ids = ['cs-ph-cc-onsite', 'cs-ph-cc-ep20', 'cs-ph-hedgestone-switch', 'cs-ph-island-federal', 'cs-ph-determined-society', 'cs-ph-solo-couch', 'cs-ph-solo-bts', 'cs-ph-dan-dan-conversation'];
  // James, Sep 26 (density): photos sit beside their sections; the rest live on the All sessions page.
  const html = (await p.content()) + await (await fetch(base + '/creator-studios/sessions')).text();
  for (const id of ids) assert(html.includes(`/v/${id}`), id + ' rendered');
  assert(await p.locator('#portfolio .card').count() <= 3, 'Recent sessions is a short preview');
  assert(await p.locator('#portfolio .section-head a[href="/creator-studios/sessions"]').count() === 1, 'All sessions link');
  for (const sec of ['#cs-story-h', '#cs-sessions-h', '#cs-space-h', '#cs-conv-h']) assert(await p.locator(`section:has(${sec}) img, section:has(${sec}) video`).count() >= 1, sec + ' has adjacent media');
  const order = await p.evaluate(() => [...document.querySelectorAll('main > section')].map((x) => x.id || x.getAttribute('aria-labelledby')));
  assert(order.indexOf('sessions') > 0 && order.indexOf('sessions') <= 2, 'sessions near the top: ' + order.join());
  assert(!html.includes('rights, consent and publication approval pending'), 'stale pending note');
  // Phone data: build-encoded stills ship a 900px card image first, with the 2000px original only in srcset.
  const card = await p.locator('img[src*="cs-ph-hedgestone-switch"]').first().evaluate((i) => [i.getAttribute('src'), i.getAttribute('srcset')]);
  assert(card[0].endsWith('-sm.webp') && /-sm\.webp 900w/.test(card[1]) && /cs-ph-hedgestone-switch\.webp 2000w/.test(card[1]), 'card srcset ' + card.join(' '));
  // Clips with speech and no captions are flagged in review (production build refuses them).
  assert(await p.locator('.card:has([data-id="cs-jm2-architecture"]) .needs-approval').count() === 1, 'uncaptioned dialogue clip flagged');
  const noah = await p.locator('.card--image:has(img[src*="ph-noah-knows"]) .card__sub').allTextContents();
  assert(!noah.some((t) => /Bohemia/.test(t)), 'Noah Knows kitchen shoot not labelled Bohemia');
  const cta = p.locator('main a:has-text("Ask us first")').first();
  await cta.focus();
  await p.keyboard.press('Enter');
  await p.waitForURL(/\/contact\?type=creator-studios/);
  assert(await p.locator('#i-type').inputValue() === 'creator-studios', 'preselected type');
  await p.context().close();
  const ph = await newPage({ width: 390, height: 844 });
  await ph.goto(base + '/creator-studios');
  assert(await ph.evaluate(() => document.documentElement.scrollWidth) <= 390, 'phone overflow');
  await ph.context().close();
});

await check('Field Notes opens with a rights-approved house photograph and the Photografik Studios byline', async () => {
  const p = await newPage();
  await p.goto(base + '/field-notes');
  const first = p.locator('main > section').first();
  assert(await first.locator('video').count() === 0, 'photo opener, not a reel');
  const src = await first.locator('.page-hero__media img').getAttribute('src');
  assert(/ph-dune-twilight-pool/.test(src), 'house photo: ' + src);
  assert((await first.locator('.page-hero__media img').getAttribute('alt')).length > 5, 'alt text');
  const href = await p.locator('.fn-card__title a').first().getAttribute('href');
  await p.goto(base + href);
  assert((await p.locator('.fn-byline').textContent()).includes('By Photografik Studios'), 'byline');
  await p.context().close();
  const ph = await newPage({ width: 375, height: 812 });
  await ph.goto(base + '/field-notes');
  assert(await ph.evaluate(() => document.documentElement.scrollWidth) <= 375, 'phone overflow');
  await ph.context().close();
});

await check('Listing Engine is listing sale-cycle content with the HDPH agent-on-camera video; demo reel is music-only', async () => {
  const p = await newPage();
  await p.goto(base + '/agent-content');
  const col = await p.locator('.compare__col:has(h3:text-is("Listing Engine"))').textContent();
  for (const s of ['Just Listed', 'Under Contract', 'Just Sold', 'agent-on-camera', 'three to four']) assert(col.includes(s), 'listing engine: ' + s);
  assert(!/Coming Soon/.test(col), 'no unverified Coming Soon');
  await p.goto(base + '/creator-studios');
  assert(await p.locator('.card:has([data-id="cs-demo-reel"]) .needs-approval').count() === 0, 'music-only reel not flagged for captions');
  await p.context().close();
});

await check('speech clips carry caption tracks that load and parse, no Creator transcripts, and a machine-draft review tag; unlicensed RevivaLuxe films withheld', async () => {
  const p = await newPage();
  for (const [path, id] of [['/creator-studios', 'cs-jm2-architecture'], ['/creator-studios/sessions', 'cs-noah-knows-short'], ['/creator-studios/sessions', 'cs-tick'], ['/agent-content', 'agent-on-camera']]) {
    await p.goto(base + path);
    const card = p.locator(`.card:has([data-id="${id}"])`).first();
    const src = await card.locator('video track[kind="captions"]').getAttribute('src');
    assert(src === `/captions/${id}.vtt`, `${id} track ${src}`);
    const isDefault = await card.locator('video track[kind="captions"]').evaluate((t) => t.hasAttribute('default'));
    assert(isDefault === ['agent-on-camera', 'revivaluxe-film'].includes(id), `${id} track default=${isDefault} (open-captioned clips keep CC off by default)`);
    const r = await p.request.get(base + src);
    const body = await r.text();
    assert(r.ok() && body.startsWith('WEBVTT') && (body.match(/-->/g) || []).length >= (id === 'revivaluxe-film' ? 1 : 2), `${id} vtt`);
    const cues = await card.locator('video').evaluate(async (v) => {
      const t = v.textTracks[0]; t.mode = 'hidden';
      for (let i = 0; i < 40 && !(t.cues && t.cues.length); i++) await new Promise((res) => setTimeout(res, 100));
      return t.cues ? t.cues.length : 0;
    });
    assert(cues >= (id === 'revivaluxe-film' ? 1 : 2), `${id} parsed cues ${cues}`);
    // James, Sep 26 2026: Creator videos need no separate transcripts (they carry burned-in captions plus a CC track).
    assert(await card.locator('a[href="/captions/' + id + '.txt"]').count() === (id.startsWith('cs-') ? 0 : 1), `${id} transcript link`);
    assert(/machine-transcribed draft/.test(await card.locator('.needs-approval').last().getAttribute('title') || ''), `${id} draft tag`);
  }
  // James, Sep 26 2026: the RevivaLuxe soundtrack is not licensed, so both RevivaLuxe films are withheld everywhere.
  for (const path of ['/', '/commercial', '/commercial/revivaluxe']) {
    const html = await (await fetch(base + path)).text();
    assert(!/revivaluxe-film|biz-revivaluxe-tour|commercial-revivaluxe/.test(html), 'RevivaLuxe film referenced on ' + path);
  }
  for (const f of ['/v/biz-revivaluxe-tour.mp4', '/media/photografik-2027/commercial-revivaluxe.mp4']) assert((await fetch(base + f)).status === 404, f + ' still served');
  await p.context().close();
});

// James, Sep 26 2026: About page shows client reviews. Codex S15-16: short curated selection, no empty video slot,
// James confirmed Sep 27 that the Google 'Hampton Innovation' review is Aubri Peele, Brown Harris Stevens (in reserve).
await check('About reviews: curated verbatim quotes, Google link, no empty video slot, no overflow at 375 px', async () => {
  const tm = JSON.parse(await readFile(new URL('../content/testimonials.json', import.meta.url), 'utf8'));
  const featured = tm.reviews.filter((r) => r.approval === 'approved' && Number.isInteger(r.featured)).sort((a, b) => a.featured - b.featured);
  assert(featured.length >= 3 && featured.length <= 4, 'curated count ' + featured.length);
  for (const vp of [{ width: 1440, height: 1000 }, { width: 375, height: 800 }]) {
    const p = await newPage(vp);
    await p.goto(base + '/about');
    const quotes = await p.locator('#reviews .review blockquote p').allTextContents();
    assert(JSON.stringify(quotes) === JSON.stringify(featured.map((r) => r.quote)), 'quotes differ from the curated JSON order/wording');
    const names = await p.locator('#reviews .review__name').allTextContents();
    assert(await p.locator('#reviews .reviews__video, #reviews .review-placeholder, #reviews .needs-approval').count() === 0, 'empty video slot or review tag in reviews');
    const rating = p.locator('#reviews .reviews__rating');
    assert(/5\.0/.test(await rating.textContent()) && /google\.com/.test(await rating.getAttribute('href')) && await rating.getAttribute('rel') === 'noopener', 'rating link');
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, 'horizontal overflow ' + overflow);
    await p.evaluate(() => { document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')); document.querySelector('.site-header, header')?.style.setProperty('position', 'static'); });
    await p.waitForTimeout(1300);
    await p.locator('#reviews').screenshot({ path: shots + `about-reviews-${vp.width}.png`, animations: 'disabled' });
    await p.context().close();
  }
  const html = await (await fetch(base + '/about')).text();
  assert(!/AggregateRating/.test(html), 'no self-serving review schema');
});

// Codex S15-16: RevivaLuxe copy must describe only what a visitor can see (stills; both films withheld).
await check('RevivaLuxe copy matches the licensed stills only', async () => {
  const p = await newPage();
  await p.goto(base + '/commercial/revivaluxe');
  const text = await p.textContent('main');
  assert(!/brand film/i.test(text), 'brand film promised on RevivaLuxe');
  assert(await p.locator('main video').count() === 0, 'RevivaLuxe film rendered');
  await p.context().close();
});

// Owner correction, Sep 27 2026: Architecture & design sells the story before the gallery.
await check('Architecture & design: audience, story guide, differentiators and service path before compact project cards', async () => {
  for (const vp of [{ width: 1280, height: 720 }, { width: 375, height: 812 }]) {
    const p = await newPage(vp);
    await p.goto(base + '/architecture-design');
    const top = (sel) => p.locator(sel).evaluate((el) => el.getBoundingClientRect().top + scrollY);
    const hero = await p.locator('.page-hero').evaluate((el) => el.getBoundingClientRect().bottom + scrollY);
    const order = [await top('#approach'), await top('#which-story'), await top('#why'), await top('#how-it-works'), await top('#portfolio')];
    assert(order.every((v, i) => i === 0 || v > order[i - 1]), 'section order ' + order.join(','));
    assert(Math.abs(order[0] - hero) < 2, 'audience section directly after the hero');
    const text = await p.textContent('main');
    for (const s of ['Architects', 'Custom builders', 'Interior designers', 'Specialty trades', 'Which story should we tell?', 'Project photography', 'Project film', 'Brand story and interviews', 'not automatic', 'Start with project proof', 'We are the guide', 'Timed for light', 'Deliverables and licensing in writing', 'quoted to its scope']) assert(text.includes(s), 'missing: ' + s);
    assert(!/guarantee|increase(d)? (sales|leads)|featured in|award-winning/i.test(text), 'unsupported outcome claim');
    const cta = p.locator('#how-it-works a.btn');
    assert(await cta.getAttribute('href') === '/contact?type=architecture-design', 'service path CTA');
    // Compact cards: one asset per project card; each card no taller than ~half a viewport on desktop.
    const cards = p.locator('#portfolio .pgrid:not(.pgrid--more) > .pgrid__item');
    const n = await cards.count();
    assert(n >= 2, 'project cards ' + n);
    for (let i = 0; i < n; i++) {
      const c = cards.nth(i);
      assert(await c.locator('.pgrid__media img, .pgrid__media video').count() === 1, 'one asset per card');
      assert(/^\/architecture-design\//.test(await c.locator('.pgrid__title a').getAttribute('href')), 'card links to its project page');
      if (vp.width > 1000) assert((await c.boundingBox()).height < 420, 'card too tall');
    }
    if (vp.width > 1000) {
      const xs = await cards.evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
      assert(xs === 1, 'desktop project cards share one row');
    }
    assert(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'overflow');
    await p.context().close();
  }
});

// Screenshots for the handoff
for (const [name, path, vp] of [['desktop-pricing', '/real-estate/pricing?sqft=3200', { width: 1440, height: 1100 }], ['mobile-pricing', '/real-estate/pricing?sqft=5501', { width: 390, height: 1400 }], ['desktop-work', '/real-estate#portfolio', { width: 1440, height: 1100 }], ['mobile-work', '/commercial#portfolio', { width: 390, height: 1400 }]]) {
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
