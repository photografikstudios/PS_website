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

/** Find the inclusive band for a size, or null when above the top band. */
export function findBand(bands, sqft) {
  return bands.find((b) => sqft >= b.min && sqft <= b.max) ?? null;
}

/** Lowest (first-band) price for a size-based record. */
export function startingPrice(record, bands) {
  return record.prices[bands[0].id];
}

/**
 * Resolve the price state for a size-based record.
 * - no size entered: { kind: 'starting', amount }
 * - within bands:    { kind: 'band', amount, band }
 * - above bands:     { kind: 'custom' }
 */
export function resolvePrice(record, bands, sqft) {
  if (sqft == null) return { kind: 'starting', amount: startingPrice(record, bands) };
  const band = findBand(bands, sqft);
  if (!band) return { kind: 'custom' };
  const amount = record.prices[band.id];
  if (typeof amount !== 'number') return { kind: 'custom' };
  return { kind: 'band', amount, band };
}

export function formatUSD(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Validate the table shape so a bad edit fails the build instead of the page. */
export function validatePricing(p) {
  const errors = [];
  const ids = p.bands.map((b) => b.id);
  p.bands.forEach((b, i) => {
    if (!(Number.isInteger(b.min) && Number.isInteger(b.max) && b.min <= b.max)) errors.push(`band ${b.id} has invalid range`);
    if (i > 0 && b.min !== p.bands[i - 1].max + 1) errors.push(`band ${b.id} does not start right after ${p.bands[i - 1].id}`);
  });
  for (const r of [...p.packages, ...p.services]) {
    for (const id of ids) {
      if (typeof r.prices?.[id] !== 'number' || r.prices[id] <= 0) errors.push(`${r.id} is missing a price for ${id}`);
    }
  }
  for (const r of [...p.fixed, ...(p.startingOnly || [])]) {
    if (typeof r.amount !== 'number' || r.amount <= 0) errors.push(`${r.id} has no amount`);
  }
  return errors;
}
