import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSquareFeet, resolvePrice, validatePricing, formatUSD, findTier } from '../src/lib/pricing-core.js';

const pricing = JSON.parse(await readFile(new URL('../content/pricing.json', import.meta.url)));
const rec = (id) => [...pricing.packages, ...pricing.services].find((r) => r.id === id);
const at = (id, sq) => resolvePrice(rec(id), sq);

test('price table is structurally valid', () => {
  assert.deepEqual(validatePricing(pricing), []);
});

test('package prices match HD Photo Hub at every boundary (read 2026-09-23)', () => {
  const cases = {
    'luxury-media': [[1, 1970], [2500, 1970], [2501, 2140], [2800, 2140], [3500, 2140], [3501, 2315], [4500, 2315], [4501, 2485], [5500, 2485], [5501, 2655], [20500, 5075], [20501, 5670], [25500, 5670], [25501, 6345], [30000, 6345]],
    'signature': [[2500, 2985], [2501, 3155], [3501, 3325], [4501, 3495], [12501, 5035], [30000, 7560]],
    'social-media': [[2500, 1120], [2501, 1220], [5501, 1515], [30000, 3600]],
    'listing-starter': [[2500, 720], [2501, 795], [3501, 870], [4501, 940], [30000, 2175]],
  };
  for (const [id, pairs] of Object.entries(cases)) for (const [sq, amt] of pairs) assert.equal(at(id, sq).amount, amt, `${id} @ ${sq}`);
});

test('service tiers match HD Photo Hub, including their own top bands', () => {
  assert.equal(at('photography', 25000).amount, 1400);
  assert.equal(at('photography', 25001).amount, 1600);
  assert.equal(at('video-one', 2800).amount, 750);
  assert.equal(at('video-both', 2800).amount, 1430);
  assert.equal(at('floor-plan', 30000).amount, 950);
  assert.equal(at('exterior-drone', 4000).amount, 400);
  assert.equal(at('exterior-drone', 4001).amount, 450);
  assert.equal(at('twilight', 5000).amount, 500);
  assert.equal(at('twilight', 5001).amount, 575);
});

test('each item switches to custom quote above its own maximum, never extrapolating', () => {
  assert.equal(at('luxury-media', 30001).kind, 'custom');
  assert.equal(at('photo-floor-plan', 12500).amount, 1175);
  assert.equal(at('photo-floor-plan', 12501).kind, 'custom');
  assert.equal(at('exterior-drone', 20001).kind, 'custom');
  assert.equal(at('twilight', 20001).kind, 'custom');
});

test('no size entered shows the starting price; tier labels are readable', () => {
  assert.deepEqual(at('luxury-media', null), { kind: 'starting', amount: 1970 });
  assert.equal(at('luxury-media', 2800).band.label, '2,501–3,500 sq ft');
  assert.equal(at('luxury-media', 900).band.label, 'up to 2,500 sq ft');
  assert.equal(findTier(rec('signature'), 30000).max, 30000);
});

test('input parsing rejects blank, zero, negative and non-numeric values politely', () => {
  assert.equal(parseSquareFeet('').reason, 'empty');
  assert.equal(parseSquareFeet('   ').reason, 'empty');
  assert.equal(parseSquareFeet('0').reason, 'not-positive');
  assert.equal(parseSquareFeet('-100').reason, 'not-positive');
  assert.equal(parseSquareFeet('abc').reason, 'not-a-number');
  assert.equal(parseSquareFeet('12a').reason, 'not-a-number');
  assert.equal(parseSquareFeet('2500.5').reason, 'not-whole');
  assert.deepEqual(parseSquareFeet('3,200'), { ok: true, value: 3200 });
  assert.deepEqual(parseSquareFeet('3200 sq ft'), { ok: true, value: 3200 });
  assert.deepEqual(parseSquareFeet(' 2501 '), { ok: true, value: 2501 });
});

test('currency formatting', () => {
  assert.equal(formatUSD(2985), '$2,985');
});
