import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSquareFeet, findBand, resolvePrice, validatePricing, formatUSD } from '../src/lib/pricing-core.js';

const pricing = JSON.parse(await readFile(new URL('../content/pricing.json', import.meta.url)));
const { bands } = pricing;
const rec = (id) => [...pricing.packages, ...pricing.services].find((r) => r.id === id);

test('price table is structurally valid', () => {
  assert.deepEqual(validatePricing(pricing), []);
});

test('band boundaries are inclusive on both sides', () => {
  const cases = [[1, 'b1'], [2500, 'b1'], [2501, 'b2'], [3500, 'b2'], [3501, 'b3'], [4500, 'b3'], [4501, 'b4'], [5500, 'b4'], [5501, null]];
  for (const [sqft, id] of cases) assert.equal(findBand(bands, sqft)?.id ?? null, id, `sqft ${sqft}`);
});

test('every package and service resolves to the Sept 14 matrix at each boundary', () => {
  const expected = {
    'signature': [2795, 3130, 3365, 3530], 'luxury-media': [1845, 2010, 2180, 2345], 'social-media': [1125, 1225, 1325, 1425],
    'social-media-floor-plan': [1350, 1470, 1595, 1715], 'listing-starter': [720, 795, 870, 940],
    'photography': [250, 305, 360, 415], 'video-one': [695, 750, 805, 860], 'video-both': [1320, 1425, 1530, 1635],
    'floor-plan': [250, 275, 300, 325], 'photo-floor-plan': [450, 520, 595, 665], 'exterior-drone': [400, 450, 500, 550],
    'd2n-one': [1110, 1165, 1220, 1275], 'd2n-both': [1625, 1725, 1825, 1925],
  };
  const probes = [[2500, 2501], [3500, 3501], [4500, 4501], [5500, 5501]];
  for (const [id, amounts] of Object.entries(expected)) {
    const r = rec(id);
    assert.ok(r, id);
    assert.equal(resolvePrice(r, bands, 1).amount, amounts[0]);
    probes.forEach(([lo, hi], i) => {
      assert.equal(resolvePrice(r, bands, lo).amount, amounts[i], `${id} @ ${lo}`);
      if (i < 3) assert.equal(resolvePrice(r, bands, hi).amount, amounts[i + 1], `${id} @ ${hi}`);
      else assert.equal(resolvePrice(r, bands, hi).kind, 'custom', `${id} @ ${hi} must be custom quote`);
    });
  }
});

test('no size entered shows the approved starting price', () => {
  const s = resolvePrice(rec('luxury-media'), bands, null);
  assert.deepEqual(s, { kind: 'starting', amount: 1845 });
});

test('above the top band never extrapolates', () => {
  for (const sq of [5501, 6000, 12000]) assert.equal(resolvePrice(rec('signature'), bands, sq).kind, 'custom');
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
  assert.equal(formatUSD(2795), '$2,795');
});
