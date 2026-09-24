// Square-footage pricing: one structured table drives every card and row.
import { parseSquareFeet, errorMessages, resolvePrice, formatUSD, findBand } from './pricing-core.js';
import { track } from './site.js';

const data = JSON.parse(document.getElementById('pricing-data').textContent);
const byId = Object.fromEntries(data.records.map((r) => [r.id, r]));
const input = document.getElementById('sqft');
const row = input.closest('.sizer__row');
const errorEl = document.getElementById('sqft-error');
const bandEl = document.getElementById('sqft-band');
const live = document.getElementById('price-live');
const clearBtn = document.querySelector('.sizer__clear');
const topMax = data.bands.at(-1).max;
let lastBand = 'none';
let announceTimer;

function render(sqft) {
  for (const el of document.querySelectorAll('[data-price-for]')) {
    const rec = byId[el.dataset.priceFor];
    if (!rec) continue;
    const s = resolvePrice(rec, data.bands, sqft);
    const hint = document.querySelector(`[data-hint-for="${rec.id}"]`);
    const card = el.closest('[data-record]');
    card?.classList.toggle('is-custom', s.kind === 'custom');
    if (s.kind === 'starting') {
      el.innerHTML = `<span class="pcard__label">Starting at</span> <span class="pcard__amount">${formatUSD(s.amount)}</span>`;
      hint.textContent = 'Enter square footage for your price.';
    } else if (s.kind === 'band') {
      el.innerHTML = `<span class="pcard__label">Published base price for ${s.band.label}</span> <span class="pcard__amount">${formatUSD(s.amount)}</span>`;
      hint.textContent = 'Subject to scope, location and booking rules.';
    } else {
      el.innerHTML = `<span class="pcard__label">Over ${topMax.toLocaleString('en-US')} sq ft</span> <span class="pcard__amount"><a href="/contact?type=real-estate-large" data-track="custom_quote_click">Request a custom quote</a></span>`;
      hint.textContent = 'We scope larger homes individually.';
    }
  }
}

function announce(text) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { live.textContent = text; }, 700);
}

function setError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = !msg;
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  row.classList.toggle('is-invalid', !!msg);
}

function update({ commit = false } = {}) {
  const raw = input.value;
  clearBtn.hidden = raw.trim() === '';
  const parsed = parseSquareFeet(raw);
  if (!parsed.ok) {
    render(null);
    bandEl.innerHTML = 'Showing starting prices. Enter a size to see yours.';
    // Only show an error once the visitor has finished typing (blur/Enter), and never for an empty box.
    if (commit && parsed.reason !== 'empty') setError(errorMessages[parsed.reason]);
    else if (parsed.reason === 'empty') setError('');
    if (lastBand !== 'none') { lastBand = 'none'; announce('Showing starting prices.'); }
    return;
  }
  setError('');
  const sqft = parsed.value;
  render(sqft);
  const band = findBand(data.bands, sqft);
  const key = band ? band.id : 'over';
  bandEl.innerHTML = band
    ? `Showing published base prices for <strong>${band.label}</strong> (${sqft.toLocaleString('en-US')} sq ft entered).`
    : `<strong>${sqft.toLocaleString('en-US')} sq ft</strong> is above our published sizes. Size-based items need a custom quote; fixed add-ons are unchanged.`;
  if (key !== lastBand) {
    lastBand = key;
    announce(band ? `Prices updated for ${band.label}.` : 'Above published sizes. Size-based items show request a custom quote.');
    track('pricing_size_band', { band: key });
  }
}

input.addEventListener('input', () => update());
input.addEventListener('blur', () => update({ commit: true }));
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); update({ commit: true }); } });
clearBtn.addEventListener('click', () => { input.value = ''; update(); input.focus(); });

// Tabs (WAI-ARIA tabs pattern with arrow keys)
const tabs = [...document.querySelectorAll('[role="tab"]')];
function select(tab, focus = true) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    if (!on) document.getElementById(t.getAttribute('aria-controls')).querySelectorAll('video').forEach((v) => v.pause());
  }
  if (focus) tab.focus();
  track('pricing_tab', { tab: tab.id.replace('tab-', '') });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => select(t, false));
  t.addEventListener('keydown', (e) => {
    const k = e.key;
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(k)) return;
    e.preventDefault();
    const n = k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : (i + (k === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    select(tabs[n]);
  });
});

// Support /real-estate/pricing?sqft=3200 for shareable links.
const q = new URLSearchParams(location.search).get('sqft');
if (q) { input.value = q; update({ commit: true }); }
