// Field Notes index: category filter buttons (rendered only when two or more categories have articles).
const grid = document.querySelector('[data-fn-grid]');
const buttons = [...document.querySelectorAll('[data-fn-filter]')];
if (grid && buttons.length) {
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const cat = b.dataset.fnFilter;
      for (const x of buttons) x.setAttribute('aria-pressed', String(x === b));
      for (const card of grid.querySelectorAll('.fn-card')) card.hidden = !!cat && card.dataset.category !== cat;
    });
  }
}
