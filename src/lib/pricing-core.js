// Pure pricing logic shared by the build (server render + tests) and the browser.
// No Node or DOM APIs here.

/**
 * Parse a square-footage entry. Accepts digits with optional thousands commas or spaces.
 * Returns { ok: true, value } or { ok: false, reason }.
 */
export function parseSquareFeet(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { ok: false, reason: 'empty' };
  const cleaned = text.replace(/[,\s]/g, '').replace(/(sq\.?\s*ft\.?|sqft|sf)$/i, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { ok: false, reason: 'not-a-number' };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false, reason: 'not-a-number' };
  if (n <= 0) return { ok: false, reason: 'not-positive' };
  if (!Number.isInteger(n)) return { ok: false, reason: 'not-whole' };
  if (n > 200000) return { ok: false, reason: 'too-large' };
  return { ok: true, value: n };
}

export const errorMessages = {
  'empty': 'Enter the property size to see prices for that size.',
  'not-a-number': 'Please enter the size as a number, for example 3,200.',
  'not-positive': 'Please enter a size greater than zero.',
  'not-whole': 'Please enter a whole number of square feet.',
  'too-large': 'That size is outside our published range. Request a custom quote and we will scope it with you.'
};

/**
 * Size tiers per record: tiers = [[minSqft, price], ...] ascending; a tier runs to one below the
 * next tier's minimum, and the last tier runs to record.max (inclusive). Mirrors HD Photo Hub.
 */
export function findTier(record, sqft) {
  if (sqft > record.max) return null;
  let hit = null;
  record.tiers.forEach(([min, price], i) => {
    if (sqft >= min) {
      const next = record.tiers[i + 1];
      hit = { min, max: next ? next[0] - 1 : record.max, price };
    }
  });
  return hit;
}

export const tierLabel = (t) => (t.min <= 1 ? `up to ${t.max.toLocaleString('en-US')} sq ft` : `${t.min.toLocaleString('en-US')}–${t.max.toLocaleString('en-US')} sq ft`);

/** Lowest (first-tier) price for a size-based record. */
export function startingPrice(record) {
  return record.tiers[0][1];
}

/**
 * Resolve the price state for a size-based record.
 * - no size entered: { kind: 'starting', amount }
 * - within tiers:    { kind: 'band', amount, band: { min, max, label } }
 * - above max:       { kind: 'custom', max }
 */
export function resolvePrice(record, sqft) {
  if (sqft == null) return { kind: 'starting', amount: startingPrice(record) };
  const t = findTier(record, sqft);
  if (!t) return { kind: 'custom', max: record.max };
  return { kind: 'band', amount: t.price, band: { min: t.min, max: t.max, label: tierLabel(t) } };
}

export function formatUSD(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Validate the table shape so a bad edit fails the build instead of the page. */
export function validatePricing(p) {
  const errors = [];
  for (const r of [...p.packages, ...p.services]) {
    if (!Number.isInteger(r.max) || r.max < 1) errors.push(`${r.id} has no max`);
    if (!Array.isArray(r.tiers) || !r.tiers.length) { errors.push(`${r.id} has no tiers`); continue; }
    if (r.tiers[0][0] !== 1) errors.push(`${r.id} must start at 1 sq ft`);
    r.tiers.forEach(([min, price], i) => {
      if (!(Number.isInteger(min) && price > 0)) errors.push(`${r.id} tier ${i} is invalid`);
      if (i && min <= r.tiers[i - 1][0]) errors.push(`${r.id} tiers are not ascending at ${i}`);
      if (min > r.max) errors.push(`${r.id} tier ${i} starts above max`);
    });
  }
  for (const r of p.fixed) if (typeof r.amount !== 'number' || r.amount <= 0) errors.push(`${r.id} has no amount`);
  return errors;
}
