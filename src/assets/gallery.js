// Two independent, combinable filters for the Work gallery (service × industry).
// Shared analytics helper from site.js (not re-imported: a second module instance would double-bind the menu and players).
const track = (name, props) => window.pgkTrack?.(name, props);

const form = document.querySelector('[data-filters]');
const grid = document.getElementById('work-grid');
if (form && grid) {
  const svcSel = form.querySelector('#f-service');
  const catSel = form.querySelector('#f-category');
  const clearBtn = form.querySelector('.filters__clear');
  const count = document.getElementById('work-count');
  const empty = document.getElementById('work-empty');
  const cards = [...grid.querySelectorAll('.card')];
  const labelsOf = (sel) => Object.fromEntries([...sel.options].map((o) => [o.value, o.textContent]));
  const svcLabels = labelsOf(svcSel);
  const catLabels = labelsOf(catSel);

  const matches = (card, svc, cat) =>
    (!svc || card.dataset.service.split(' ').includes(svc)) && (!cat || card.dataset.category === cat);

  // Show how many results each option would give, combined with the other filter.
  function updateOptionCounts(svc, cat) {
    for (const o of svcSel.options) {
      const n = cards.filter((c) => matches(c, o.value, cat)).length;
      o.textContent = `${svcLabels[o.value]}${o.value ? ` (${n})` : ''}`;
    }
    for (const o of catSel.options) {
      const n = cards.filter((c) => matches(c, svc, o.value)).length;
      o.textContent = `${catLabels[o.value]}${o.value ? ` (${n})` : ''}`;
    }
  }

  function apply({ push = true, source } = {}) {
    const svc = svcSel.value;
    const cat = catSel.value;
    let shown = 0;
    for (const card of cards) {
      const ok = matches(card, svc, cat);
      card.hidden = !ok;
      if (!ok) { const v = card.querySelector('video'); if (v && !v.paused) v.pause(); }
      if (ok) shown++;
    }
    empty.hidden = shown !== 0;
    clearBtn.hidden = !svc && !cat;
    count.textContent = shown === 1 ? '1 piece' : `${shown} pieces`;
    updateOptionCounts(svc, cat);
    if (push) {
      const url = new URL(location.href);
      svc ? url.searchParams.set('service', svc) : url.searchParams.delete('service');
      cat ? url.searchParams.set('category', cat) : url.searchParams.delete('category');
      history.replaceState(null, '', url);
    }
    if (source) track('gallery_filter', { filter: source, service: svc || 'all', category: cat || 'all', results: shown });
  }

  // Initial state from the URL (e.g. /work?category=architecture-design)
  const params = new URLSearchParams(location.search);
  const setIfValid = (sel, v) => { if (v && [...sel.options].some((o) => o.value === v)) sel.value = v; };
  setIfValid(svcSel, params.get('service'));
  setIfValid(catSel, params.get('category'));

  svcSel.addEventListener('change', () => apply({ source: 'service' }));
  catSel.addEventListener('change', () => apply({ source: 'category' }));
  const clear = () => { svcSel.value = ''; catSel.value = ''; apply({ source: 'clear' }); svcSel.focus(); };
  form.addEventListener('reset', (e) => { e.preventDefault(); clear(); });
  document.querySelector('[data-clear-filters]')?.addEventListener('click', clear);
  apply({ push: false });
}
