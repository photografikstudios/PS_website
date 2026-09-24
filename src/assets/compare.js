// "Compare what's included" on /real-estate. Prices use the same tier table and function as the pricing page.
import { parseSquareFeet, errorMessages, resolvePrice, formatUSD } from './pricing-core.js';
// Shared analytics helper from site.js (not re-imported: a second module instance would double-bind the menu and players).
const track = (name, props) => window.pgkTrack?.(name, props);

const root = document.querySelector('[data-compare]');
if (root) {
  const data = JSON.parse(root.querySelector('#cmp-data').textContent);
  const byId = Object.fromEntries(data.records.map((r) => [r.id, r]));
  const live = root.querySelector('#cmp-live');
  const phone = matchMedia('(max-width: 699px)');
  const limit = () => (phone.matches ? 2 : 4);

  // ---- Columns: choose which options to compare (up to 4 on desktop, 2 on a phone) ----
  const panels = [...root.querySelectorAll('.cmp__panel')];
  const order = new Map(); // panel -> ids in the order they were chosen
  const nameOf = (panel, id) => panel.querySelector(`.cmp__chip[data-col="${id}"]`).textContent;

  function applyCols(panel, announce = false) {
    const ids = order.get(panel);
    for (const chip of panel.querySelectorAll('.cmp__chip')) chip.setAttribute('aria-pressed', String(ids.includes(chip.dataset.col)));
    for (const cell of panel.querySelectorAll('th[data-col], td[data-col]')) cell.hidden = !ids.includes(cell.dataset.col);
    panel.querySelector('table').style.setProperty('--cols', ids.length);
    const all = panel.querySelectorAll('.cmp__chip').length;
    panel.querySelector('.cmp__limit-note').textContent = all > limit() ? `(choose up to ${limit()})` : '';
    if (announce) live.textContent = `Comparing ${ids.map((id) => nameOf(panel, id)).join(', ')}.`;
  }
  function trim(panel) {
    const ids = order.get(panel);
    while (ids.length > limit()) ids.pop();
  }
  for (const panel of panels) {
    const chosen = [...panel.querySelectorAll('.cmp__chip[aria-pressed="true"]')].map((c) => c.dataset.col);
    order.set(panel, chosen.length ? chosen : [panel.querySelector('.cmp__chip').dataset.col]);
    trim(panel);
    applyCols(panel);
    panel.querySelector('.cmp__pick').addEventListener('click', (e) => {
      const chip = e.target.closest('.cmp__chip');
      if (!chip) return;
      const ids = order.get(panel);
      const id = chip.dataset.col;
      if (ids.includes(id)) {
        if (ids.length === 1) { live.textContent = 'Keep at least one option to compare.'; return; }
        ids.splice(ids.indexOf(id), 1);
      } else {
        ids.push(id);
        if (ids.length > limit()) ids.shift(); // drop the earliest choice
      }
      applyCols(panel, true);
      track('compare_select', { view: panel.dataset.view, options: ids.join(',') });
    });
  }
  phone.addEventListener('change', () => panels.forEach((p) => { trim(p); applyCols(p); }));

  // ---- Tabs (WAI-ARIA pattern) ----
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  function select(tab, focus) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      root.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    }
    if (focus) tab.focus();
    track('compare_tab', { view: tab.id.replace('cmp-tab-', '') });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t, false));
    t.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      select(tabs[n], true);
    });
  });

  // ---- Optional size: same tiers as the pricing page ----
  const input = root.querySelector('#cmp-sqft');
  const band = root.querySelector('#cmp-band');
  const toPricing = root.querySelector('#cmp-pricing');
  function renderPrices(sqft) {
    for (const el of root.querySelectorAll('[data-cmp-price]')) {
      const s = resolvePrice(byId[el.dataset.cmpPrice], sqft);
      if (s.kind === 'starting') el.innerHTML = `<span class="cmp__plabel">Starting at</span> <strong>${formatUSD(s.amount)}</strong>`;
      else if (s.kind === 'band') el.innerHTML = `<span class="cmp__plabel">${s.band.label}</span> <strong>${formatUSD(s.amount)}</strong>`;
      else el.innerHTML = `<span class="cmp__plabel">Over ${s.max.toLocaleString('en-US')} sq ft</span> <a href="/contact?type=real-estate-large">Custom quote</a>`;
    }
  }
  function update(commit) {
    const parsed = parseSquareFeet(input.value);
    if (!parsed.ok) {
      renderPrices(null);
      toPricing.href = '/real-estate/pricing';
      band.textContent = parsed.reason === 'empty' || !commit ? 'Showing starting prices.' : errorMessages[parsed.reason];
      input.setAttribute('aria-invalid', String(commit && parsed.reason !== 'empty'));
      return;
    }
    input.setAttribute('aria-invalid', 'false');
    renderPrices(parsed.value);
    toPricing.href = `/real-estate/pricing?sqft=${parsed.value}`;
    band.textContent = parsed.value > data.maxSqft
      ? `${parsed.value.toLocaleString('en-US')} sq ft is above our published sizes. Size-based options need a custom quote.`
      : `Showing prices for a ${parsed.value.toLocaleString('en-US')} sq ft home.`;
  }
  input.addEventListener('input', () => update(false));
  input.addEventListener('blur', () => update(true));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); update(true); } });
  const q = new URLSearchParams(location.search).get('sqft');
  if (q) { input.value = q; update(true); }
}
