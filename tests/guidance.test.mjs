import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { INTENTS, resolveIntent, sourceOf, cleanVisit, canSuggest, bundleComparison } from '../src/lib/guidance-core.js';
import { findTier } from '../src/lib/pricing-core.js';
const pricing = JSON.parse(fs.readFileSync(new URL('../content/pricing.json', import.meta.url)));

test('Luxury savings use the approved equivalent components and same property-size bands', () => {
  assert.deepEqual(bundleComparison(pricing), { price: 1970, photos: 450, drone: 275, video: 1325, total: 2050, saving: 80, min: 1, max: 2500 });
  for (const sqft of [1, 2500, 2501, 3500, 3501, 4500, 4501, 5500, 5501, 6500, 6501, 7500, 7501, 8500, 8501, 9500, 9501, 10500, 10501, 11500, 11501, 12500]) {
    const c = bundleComparison(pricing, sqft);
    const price = findTier(pricing.packages.find(r => r.id === 'luxury-media'), sqft).price;
    const a = findTier(pricing.services.find(r => r.id === 'photo-floor-plan'), sqft).price;
    const b = findTier(pricing.services.find(r => r.id === 'video-both'), sqft).price;
    assert.equal(c.saving, a + b + 275 - price);
    assert.ok(sqft >= c.min && sqft <= c.max);
  }
  for (const sqft of [null, 0, -1, 3.5, 12501, 25000, 30000, 30001, NaN]) assert.equal(bundleComparison(pricing, sqft), null);
  for (const mutation of ['unapproved', 'inclusions', 'cheaper']) {
    const p = structuredClone(pricing);
    if (mutation === 'unapproved') p.services.find(r => r.id === 'video-both').approval = 'pending';
    if (mutation === 'inclusions') p.packages.find(r => r.id === 'luxury-media').features.twilight = true;
    if (mutation === 'cheaper') p.packages.find(r => r.id === 'luxury-media').tiers[0][1] = 2200;
    assert.equal(bundleComparison(p), null);
  }
});
test('intent follows the page or explicit choice, never an inferred occupation from a social source', () => {
  assert.equal(resolveIntent({ path: '/', source: 'instagram' }), '');
  assert.equal(resolveIntent({ path: '/', source: 'creator-studios' }), 'studio');
  assert.equal(resolveIntent({ path: '/', campaign: 'listing', choice: 'commercial' }), 'commercial');
  assert.equal(resolveIntent({ path: '/architecture-design/house', choice: 'listing' }), 'architecture');
  assert.equal(resolveIntent({ path: '/', campaign: 'https://evil.example' }), '');
  assert.equal(resolveIntent({ path: '/', previousCampaign: 'agent' }), 'agent');
  assert.equal(resolveIntent({ path: '/contact', choice: 'listing', previousPage: 'commercial', previousCampaign: 'agent' }), 'commercial');
  assert.equal(resolveIntent({ path: '/contact', campaign: 'architecture', previousPage: 'commercial' }), 'architecture');
  for (const data of Object.values(INTENTS)) assert.match(data.href, /^\/(?!\/)/);
});
test('source context is coarse and cannot leak full referral URLs or unrestricted campaign text', () => {
  assert.equal(sourceOf('?utm_source=ig', '', 'https://pgk.test'), 'instagram');
  assert.equal(sourceOf('', 'https://www.licreatorstudios.com/book?email=pat@example.com', 'https://pgk.test'), 'creator-studios');
  assert.equal(sourceOf('', 'https://licreatorstudios.com.evil.test', 'https://pgk.test'), 'referral');
  assert.equal(sourceOf('', 'https://pgk.test/real-estate', 'https://pgk.test'), '');
  assert.equal(sourceOf('?utm_source=pat@example.com', '', 'https://pgk.test'), 'campaign');
  assert.deepEqual(cleanVisit({ visitIntent: 'bad', visitSource: 'pat@example.com', visitCampaign: '6315550100', visitEntry: '/?email=pat' }), { visitIntent: '', visitSource: '', visitCampaign: '', visitEntry: '', visitContext: '' });
  assert.equal(cleanVisit({ visitCampaign: 'fall-listing', visitEntry: '/commercial/bpe-ironworks' }).visitCampaign, 'fall-listing');
  assert.deepEqual(cleanVisit({ visitIntent: ['listing'], visitSource: {}, visitCampaign: 123, visitEntry: ['/'], visitContext: ['/commercial'] }), { visitIntent: '', visitSource: '', visitCampaign: '', visitEntry: '', visitContext: '' });
});
test('suggestions require engagement and are blocked by dismissal, video, form or prior exposure', () => {
  const ready = { elapsed: 31000, passedHero: true, scroll: 200, desktop: true, trigger: 'exit' };
  assert.equal(canSuggest(ready), true);
  for (const patch of [{ used: true }, { dismissed: true }, { busy: true }, { desktop: false }, { elapsed: 29000 }, { scroll: 0 }]) assert.equal(canSuggest({ ...ready, ...patch }), false);
  assert.equal(canSuggest({ ...ready, trigger: 'scroll', elapsed: 12001 }), true);
  assert.equal(canSuggest({ ...ready, trigger: 'scroll', elapsed: 11000 }), false);
  assert.equal(canSuggest({ ...ready, trigger: 'scroll', passedHero: false }), false);
});
