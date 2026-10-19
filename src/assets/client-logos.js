// Progressive enhancement: without JS (or with reduced motion), the full client list scrolls manually.
for (const board of document.querySelectorAll('[data-client-logos]')) {
  const toggle = board.querySelector('[data-client-logos-toggle]');
  const viewport = board.querySelector('.client-logos__viewport');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  let inView = false;
  const update = () => {
    board.classList.toggle('is-enhanced', !reducedMotion.matches);
    board.dataset.running = String(inView && !paused && !reducedMotion.matches);
    toggle.hidden = reducedMotion.matches;
    toggle.textContent = paused ? 'Resume scrolling' : 'Pause scrolling';
    toggle.setAttribute('aria-pressed', String(paused));
  };
  toggle.addEventListener('click', () => { paused = !paused; update(); });
  // Keyboard/touch browsing uses the single, stationary list; Home/End reach either end immediately.
  viewport.addEventListener('pointerdown', () => viewport.focus({ preventScroll: true }));
  viewport.addEventListener('keydown', (event) => {
    if (event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    viewport.scrollLeft = event.key === 'Home' ? 0 : viewport.scrollWidth;
  });
  viewport.addEventListener('blur', () => { if (!reducedMotion.matches) viewport.scrollLeft = 0; });
  reducedMotion.addEventListener('change', update);
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); }).observe(board);
  update();
}
