// Home "Selected work": Photos/Videos × category, two responsive rows, lightbox, View more → service portfolio.
// Items come from the shared work.media collection (the same records as the service-page galleries).
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
  const grid = root.querySelector('#sw-grid');
  // Match the CSS column count after resizing too; never leave a third row behind at a breakpoint.
  const limit = () => Math.min(Number(root.dataset.limit) || 10, (parseInt(getComputedStyle(grid).getPropertyValue('--showcase-columns'), 10) || 2) * 2);
  let routes = {}; try { routes = JSON.parse(root.dataset.routes || '{}'); } catch { /* keep default */ }
  const lb = createLightbox(root.querySelector('dialog'), data, { where: 'home' });
  let visible = [];

  const catsFor = (kind) => new Set(data.filter((d) => d.kind === kind).map((d) => d.category));

  function syncCategories() {
    const have = catsFor(kindSel.value);
    for (const o of catSel.options) o.hidden = o.disabled = o.value !== '' && !have.has(o.value);
    if (catSel.value && !have.has(catSel.value)) catSel.value = '';
  }

  function render() {
    const kind = kindSel.value; const cat = catSel.value;
    const matches = cards.filter((c) => c.dataset.kind === kind && (!cat || c.dataset.category === cat));
    visible = matches.slice(0, limit()).map((c) => +c.dataset.i);
    cards.forEach((c) => { c.hidden = !visible.includes(+c.dataset.i); });
    empty.hidden = matches.length > 0;
    const route = routes[cat] || '/real-estate';
    more.href = `${route}${route === '/real-estate' ? `?type=${kind === 'video' ? 'video' : 'photo'}` : ''}#portfolio`;
    more.textContent = cat ? 'View more' : 'View more Real Estate'; // Name the destination of the mixed-service view.
  }

  const changed = () => track('gallery_filter', { where: 'home', kind: kindSel.value, category: catSel.value });
  kindSel.addEventListener('change', () => { syncCategories(); render(); changed(); });
  catSel.addEventListener('change', () => { render(); changed(); });
  for (const query of ['(max-width: 700px)', '(min-width: 1280px)']) matchMedia(query).addEventListener('change', render);

  root.querySelector('#sw-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.sw-card');
    if (card) lb.open(+card.dataset.i, visible, card);
  });

  syncCategories();
  render();
}
