// Home "Selected work": Videos/Photos × category filter, 9 cards, lightbox viewer, View more → /work.
// Items come from the shared work.media collection (same records as Work and the Real Estate gallery).
import { createLightbox } from './lightbox.js';
// Shared analytics helper from site.js (not re-imported: a second module instance would double-bind the menu and players).
const track = (name, props) => window.pgkTrack?.(name, props);

const root = document.querySelector('[data-showcase]');
if (root) {
  const data = JSON.parse(root.querySelector('[data-gallery-items]').textContent);
  const kindSel = root.querySelector('#sw-kind');
  const catSel = root.querySelector('#sw-cat');
  const cards = [...root.querySelectorAll('.sw-card')];
  const empty = root.querySelector('#sw-empty');
  const more = root.querySelector('#sw-more');
  const LIMIT = Number(root.dataset.limit) || 9;
  const lb = createLightbox(root.querySelector('dialog'), data, { where: 'home' });
  let visible = [];

  const catsFor = (kind) => new Set(data.filter((d) => d.kind === kind).map((d) => d.category));

  function syncCategories() {
    const have = catsFor(kindSel.value);
    for (const o of catSel.options) o.hidden = o.disabled = !have.has(o.value);
    if (!have.has(catSel.value)) catSel.value = [...catSel.options].find((o) => !o.disabled)?.value || '';
  }

  function render() {
    const kind = kindSel.value; const cat = catSel.value;
    const matches = cards.filter((c) => c.dataset.kind === kind && c.dataset.category === cat);
    visible = matches.slice(0, LIMIT).map((c) => +c.dataset.i);
    cards.forEach((c) => { c.hidden = !visible.includes(+c.dataset.i); });
    empty.hidden = matches.length > 0;
    more.href = `/work?service=${kind === 'video' ? 'video' : 'photography'}&category=${encodeURIComponent(cat)}`;
    more.textContent = matches.length > LIMIT ? `View more (${matches.length})` : 'View more';
  }

  const changed = () => track('gallery_filter', { where: 'home', kind: kindSel.value, category: catSel.value });
  kindSel.addEventListener('change', () => { syncCategories(); render(); changed(); });
  catSel.addEventListener('change', () => { render(); changed(); });

  root.querySelector('#sw-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.sw-card');
    if (card) lb.open(+card.dataset.i, visible, card);
  });

  syncCategories();
  render();
}
