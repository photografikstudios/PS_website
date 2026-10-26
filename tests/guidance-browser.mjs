// Actual UI flows; deterministic remote-media fixtures. No live inquiry or booking is sent.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { start } from './serve.mjs';
const server = await start(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();
const results = [];
const fixture = await fs.readFile(new URL('./fixtures/vertical.webm', import.meta.url));
async function page(mobile = false, storageBlocked = false) {
  const p = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  if (storageBlocked) await p.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked'); } }));
  await p.route(/\.(mp4|webm)(\?.*)?$/, r => r.fulfill({ contentType: 'video/webm', body: fixture }));
  await p.route('https://**/*', r => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="#69746b"/></svg>' }));
  await p.clock.install();
  return p;
}
const visible = (p, selector) => p.locator(selector).isVisible();
async function pastHero(p) {
  await p.evaluate(() => { const h = document.querySelector('.hero,.page-hero,.fn-article__head'); scrollTo(0, scrollY + h.getBoundingClientRect().bottom + 50); });
  await p.clock.fastForward(13000);
  await p.waitForTimeout(150);
}
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); console.log('PASS', name); }
  catch(e) { results.push({ name, pass: false, error: e.stack }); console.log('FAIL', name, e.message); }
}
try {
  await check('tagged campaign entry points keep source and intent through navigation without redirecting', async () => {
    for (const [route, intent, source] of [['/', 'listing', 'google'], ['/architecture-design', 'architecture', 'instagram'], ['/commercial', 'commercial', 'referral'], ['/agent-content', 'agent', 'instagram'], ['/creator-studios', 'studio', 'creator-studios'], ['/agency-partnerships', 'agency', 'linkedin'], ['/', 'unsure', 'qr'], ['/real-estate', 'listing', 'email'], ['/commercial/bpe-ironworks', 'commercial', 'partner']]) {
      const p = await page(); await p.goto(`${base}${route}?intent=${intent}&utm_source=${source}&utm_medium=social&utm_campaign=source-test`);
      assert.equal(new URL(p.url()).pathname, route);
      await p.goto(base + '/contact');
      assert.equal(await p.locator('[name="visitSource"]').inputValue(), source);
      assert.equal(await p.locator('[name="visitIntent"]').inputValue(), intent);
      assert.equal(await p.locator('[name="visitCampaign"]').inputValue(), 'source-test');
      assert.deepEqual(p.errors, []); await p.close();
    }
  });
  await check('Field Notes direct entry uses its configured service and CTA, preserves article context and honors visitor choice', async () => {
    const p = await page();
    const route = '/field-notes/how-to-prepare-a-home-for-listing-photos';
    await p.goto(base + route); await pastHero(p);
    assert.equal(await visible(p, '.guidance-card'), true);
    assert.match(await p.locator('#guidance-title').innerText(), /Save \$80/);
    assert.equal(await p.locator('.guidance-primary').textContent(), 'See prices for your property');
    assert.equal(await p.locator('.guidance-primary').getAttribute('href'), '/real-estate/pricing?intent=listing');
    await p.goto(base + '/contact');
    assert.equal(await p.locator('[name="visitIntent"]').inputValue(), 'listing');
    assert.equal(await p.locator('[name="visitContext"]').inputValue(), route);
    await p.goto(base + route); await p.locator('.guidance-launch').click();
    await p.locator('[data-intent="architecture"]').click(); await p.keyboard.press('Escape');
    await p.goto(base + '/contact');
    assert.equal(await p.locator('#i-type').inputValue(), 'architecture-design');
    await p.goto(base + route);
    assert.equal(await p.locator('.guidance-primary').getAttribute('href'), '/contact?type=architecture-design&intent=architecture');
    assert.deepEqual(p.errors, []); await p.close();
  });
  await check('listing follow-up validates size, carries it to pricing and preserves custom size in the brief', async () => {
    const p = await page(true); await p.goto(base + '/?intent=listing&utm_source=instagram&utm_campaign=listing-media');
    await p.locator('.guidance-launch').click(); await p.locator('[data-intent="listing"]').click();
    assert.equal(await p.locator('#guidance-sqft').evaluate(e => e === document.activeElement), true);
    for (const input of ['-1', 'abc', '2.5']) {
      await p.locator('#guidance-sqft').fill(input);
      assert.equal(await p.locator('#guidance-sqft').getAttribute('aria-invalid'), 'true');
      assert.equal(await p.locator('[data-choice-action]').getAttribute('href'), null);
    }
    await p.locator('#guidance-sqft').fill('');
    assert.equal(await p.locator('[data-choice-action]').getAttribute('href'), '/real-estate/pricing?intent=listing');
    await p.locator('#guidance-sqft').fill('2,800');
    for (const width of [390, 320]) {
      await p.setViewportSize({ width, height: 844 });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await p.addScriptTag({ path: new URL('../node_modules/axe-core/axe.min.js', import.meta.url).pathname });
    assert.deepEqual(await p.evaluate(async () => (await axe.run(document.querySelector('.service-dialog'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map(v => v.id)), []);
    await p.locator('[data-choice-action]').click(); await p.waitForLoadState('load');
    assert.equal(await p.locator('#sqft').inputValue(), '2800');
    assert.match(await p.locator('[data-price-for="luxury-media"]').innerText(), /2,140/);
    await p.goto(base + '/'); await p.locator('.guidance-launch').click(); await p.locator('[data-intent="listing"]').click();
    await p.locator('#guidance-sqft').fill('31000');
    await p.locator('[data-choice-action]').click(); await p.waitForLoadState('load');
    assert.equal(await p.locator('#i-type').inputValue(), 'real-estate-large');
    assert.match(await p.locator('#i-deliverables').inputValue(), /31,000 sq ft/);
    assert.equal(await p.locator('[name="visitSource"]').inputValue(), 'instagram');
    assert.deepEqual(p.errors, []); await p.close();
  });
  await check('listing banner: real savings, sizes, detail, dismiss and no repeat across pages', async () => {
    const p = await page(); await p.goto(base + '/real-estate/pricing');
    assert.equal(await visible(p, '.guidance-card'), false);
    await pastHero(p);
    assert.equal(await visible(p, '.guidance-card'), true);
    assert.match(await p.locator('#guidance-title').innerText(), /Save \$80/);
    await p.locator('.guidance-math summary').click();
    assert.match(await p.locator('.guidance-math').innerText(), /\$2,050/);
    await p.locator('#sqft').fill('2501');
    assert.match(await p.locator('#guidance-title').innerText(), /Save \$85/);
    assert.match(await p.locator('.guidance-copy').innerText(), /2,501–3,500/);
    assert.equal(await p.locator('.guidance-primary').getAttribute('href'), '#pk-luxury-media');
    await p.locator('#sqft').fill('12501'); assert.equal(await visible(p, '.guidance-math'), false);
    await p.locator('#sqft').fill('30001'); assert.match(await p.locator('.guidance-primary').getAttribute('href'), /real-estate-large/);
    await p.locator('#sqft').fill(''); await pastHero(p);
    await p.locator('.guidance-card .guidance-close').click();
    await p.goto(base + '/commercial'); await pastHero(p);
    assert.equal(await visible(p, '.guidance-card'), false);
    assert.deepEqual(p.errors, []); await p.close();
  });
  await check('chooser: explicit choice, keyboard focus and inquiry source survive navigation', async () => {
    const p = await page(); await p.goto(base + '/?intent=listing&utm_source=ig&utm_campaign=fall-media');
    await p.locator('.guidance-launch').click();
    assert.equal(await p.locator('dialog.service-dialog').getAttribute('open'), '');
    await p.locator('[data-intent="architecture"]').click();
    assert.equal(await p.locator('[data-choice-action]').evaluate(e => e === document.activeElement), true);
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    assert.equal(await p.evaluate(() => !!document.activeElement.closest('.service-dialog')), true);
    await p.keyboard.press('Escape'); assert.equal(await visible(p, '.service-dialog'), false);
    await p.waitForFunction(() => document.activeElement?.classList.contains('guidance-launch')); assert.equal(await p.locator('.guidance-launch').evaluate(e => e === document.activeElement), true);
    await p.locator('.guidance-launch').click(); await p.locator('[data-choice-action]').click(); await p.waitForLoadState('load');
    assert.match(p.url(), /\/contact\?type=architecture-design&intent=architecture/);
    assert.equal(await p.locator('#i-type').inputValue(), 'architecture-design');
    assert.equal(await p.locator('[name="visitIntent"]').inputValue(), 'architecture');
    assert.equal(await p.locator('[name="visitSource"]').inputValue(), 'instagram');
    assert.equal(await p.locator('[name="visitCampaign"]').inputValue(), 'fall-media');
    assert.equal(await p.locator('#i-source').inputValue(), '');
    assert.equal(await visible(p, '.guidance-launch'), false);
    let received;
    await p.route('**/api/inquiry', r => { received = r.request().postDataJSON(); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
    await p.locator('[name="name"]').fill('QA Test'); await p.locator('[name="email"]').fill('qa@example.com');
    await p.locator('#inquiry [type="submit"]').click(); await p.locator('#form-done').waitFor({ state: 'visible' });
    assert.equal(received.visitSource, 'instagram'); assert.equal(received.visitIntent, 'architecture');
    const events = await p.evaluate(() => window.dataLayer.filter(e => e.event === 'guidance_conversion'));
    assert.equal(events.length, 1); assert.equal(events[0].source, 'instagram'); assert.ok(!JSON.stringify(events).includes('qa@example.com'));
    assert.deepEqual(p.errors, []); await p.close();
  });
  await check('desktop exit prompt waits for engagement, is nonblocking and appears only once', async () => {
    const p = await page(); await p.goto(base + '/commercial');
    const exit = () => p.evaluate(() => document.dispatchEvent(new PointerEvent('pointerout', { pointerType: 'mouse', clientY: -1, relatedTarget: null })));
    await exit(); assert.equal(await visible(p, '.guidance-card'), false);
    await p.evaluate(() => scrollTo(0, 180)); await p.clock.fastForward(31000); await exit();
    assert.equal(await visible(p, '.guidance-card'), true);
    assert.equal(await p.locator('dialog[open]').count(), 0);
    assert.match(await p.locator('#guidance-title').innerText(), /business actually does/);
    await exit(); assert.equal(await p.evaluate(() => dataLayer.filter(e => e.event === 'guidance_view').length), 1);
    assert.deepEqual(p.errors, []); await p.close();
  });
  await check('mobile uses a compact banner, no exit popup; no horizontal overflow at 390 or 320', async () => {
    const p = await page(true); await p.goto(base + '/real-estate');
    await p.evaluate(() => scrollTo(0, 180)); await p.clock.fastForward(31000);
    await p.evaluate(() => document.dispatchEvent(new PointerEvent('pointerout', { pointerType: 'mouse', clientY: -1 })));
    assert.equal(await visible(p, '.guidance-card'), false);
    await pastHero(p); assert.equal(await visible(p, '.guidance-card'), true);
    for (const width of [390, 320]) {
      await p.setViewportSize({ width, height: 844 });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const r = await p.locator('.guidance-card').boundingBox(); assert.ok(r.height < 360 && r.x >= 0 && r.x + r.width <= width);
    }
    await p.locator('.guidance-change').click();
    assert.equal(await visible(p, '.service-dialog'), true);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.locator('[data-intent="studio"]').click();
    assert.match(await p.locator('[data-choice-action]').getAttribute('href'), /creator-studios.*#sessions/);
    await p.addScriptTag({ path: new URL('../node_modules/axe-core/axe.min.js', import.meta.url).pathname });
    const accessibility = await p.evaluate(async () => (await axe.run(document.querySelector('.service-dialog'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map(v => v.id));
    assert.deepEqual(accessibility, []);
    assert.deepEqual(p.errors, []); await p.close();
  });
  await check('no interruption during video, menu, other dialog or form interaction', async () => {
    const p = await page(true); await p.goto(base + '/commercial'); await pastHero(p);
    assert.equal(await visible(p, '.guidance-card'), true);
    await p.locator('.menu-toggle').click(); await p.locator('.guidance-card').waitFor({ state: 'hidden' }); assert.equal(await visible(p, '.guidance-card'), false);
    await p.locator('.menu-toggle').click(); await p.waitForTimeout(100);
    await p.evaluate(() => { const d = document.createElement('dialog'); d.id = 'test-dialog'; d.innerHTML = '<button>Close</button>'; document.body.append(d); d.showModal(); });
    await p.waitForTimeout(100); assert.equal(await visible(p, '.guidance-card'), false);
    await p.evaluate(() => document.getElementById('test-dialog').close());
    await p.evaluate(() => { const v = document.createElement('video'); v.id = 'test-playback'; v.src = '/v/qa.mp4'; v.muted = true; v.loop = true; document.body.append(v); return v.play(); });
    await p.waitForTimeout(150); assert.equal(await visible(p, '.guidance-card'), false);
    await p.evaluate(() => document.getElementById('test-playback').pause()); await p.waitForTimeout(150);
    assert.equal(await visible(p, '.guidance-card'), true);
    await p.goto(base + '/contact?intent=commercial'); await p.locator('[name="name"]').fill('Testing'); await p.clock.fastForward(35000);
    assert.equal(await visible(p, '.guidance-card'), false); assert.equal(await p.locator('#i-type').inputValue(), 'commercial');
    assert.deepEqual(p.errors, []); await p.close();
  });
  await check('booking handoff is tracked as a click, never a completed booking; no repeat after return', async () => {
    const p = await page(); await p.goto(base + '/real-estate');
    await p.route('https://photografikstudios.hd.pics/order', r => r.fulfill({ contentType: 'text/html', body: '<h1>Booking test destination</h1>' }));
    await p.locator('.nav__cta').click(); await p.waitForLoadState('load');
    assert.match(p.url(), /photografikstudios.hd.pics/);
    await p.goBack(); await p.waitForLoadState('load'); await pastHero(p);
    assert.equal(await visible(p, '.guidance-card'), false);
    const saved = await p.evaluate(() => JSON.parse(sessionStorage.getItem('pgk_service_visit_v1')));
    assert.equal(saved.handoff, true);
    assert.deepEqual(p.errors, []); await p.close();
  });
  await check('failed inquiry retains context in the unsent draft and emits no conversion', async () => {
    const p = await page(); await p.goto(base + '/commercial?utm_source=linkedin&utm_campaign=brand-work');
    await p.goto(base + '/contact');
    assert.equal(await p.locator('#i-type').inputValue(), 'commercial');
    await p.route('**/api/inquiry', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' }));
    await p.locator('[name="name"]').fill('QA Test'); await p.locator('[name="email"]').fill('qa@example.com');
    await p.locator('#inquiry [type="submit"]').click(); await p.locator('#form-fallback').waitFor({ state: 'visible' });
    assert.match(await p.locator('#fallback-text').innerText(), /Visit source: linkedin/);
    assert.match(await p.locator('#fallback-text').innerText(), /Project or service viewed: \/commercial/);
    assert.equal(await visible(p, '#form-done'), false);
    assert.equal(await p.evaluate(() => dataLayer.filter(e => e.event === 'guidance_conversion').length), 0);
    assert.deepEqual(p.errors, []); await p.close();
  });
  await check('storage blocked: chooser and inquiry still work; excluded pages have no marketing overlay', async () => {
    const p = await page(false, true); await p.goto(base + '/?intent=architecture');
    await p.locator('.guidance-launch').click(); await p.locator('[data-intent="commercial"]').click(); await p.locator('[data-choice-action]').click(); await p.waitForLoadState('load');
    assert.equal(await p.locator('#i-type').inputValue(), 'commercial');
    for (const route of ['/terms', '/licensing', '/404']) { await p.goto(base + route); assert.equal(await p.locator('#service-guidance').count(), 0); }
    assert.deepEqual(p.errors, []); await p.close();
  });
} finally {
  await browser.close(); server.close();
  await fs.writeFile('/tmp/pgk-guidance-browser-results.json', JSON.stringify(results, null, 2));
}
console.log(`${results.filter(r => r.pass).length}/${results.length} passed`);
if (results.some(r => !r.pass)) process.exitCode = 1;
