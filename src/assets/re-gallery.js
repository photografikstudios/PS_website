// Filterable service galleries (Real Estate; Architecture & Design): package / segment × media type filters,
// Load More, and a configurable player. One media collection (content/work.json) feeds every gallery.
// Player mode comes from data-player: 'inline' plays in the card, 'lightbox' opens the shared viewer.
// Review builds also accept ?player=inline|lightbox for comparison.
import { matches } from './gallery-core.js';
import { createLightbox } from './lightbox.js';
// Shared analytics helper from site.js (not re-imported: a second module instance would double-bind the menu and players).
const track = (name, props) => window.pgkTrack?.(name, props);
// Form field name → filter key (the URL keeps the readable name).
const KEYS = { package: 'pkg', segment: 'seg', type: 'type' };

for (const root of document.querySelectorAll('[data-regallery]')) {
  const where = root.dataset.where || 'real_estate';
  const items = JSON.parse(root.querySelector('[data-gallery-items]').textContent);
  const grid = root.querySelector('.regallery__grid');
  const cards = [...grid.querySelectorAll('.gcard')];
  const form = root.querySelector('[data-rg-filters]');
  const sels = () => [...form.querySelectorAll('select')].filter((s) => KEYS[s.name]);
  const resetBtn = form.querySelector('.filters__clear');
  const count = root.querySelector('.filters__count');
  const empty = root.querySelector('.empty');
  const emptyTitle = empty.querySelector('.h3');
  const more = root.querySelector('.regallery__more button');
  // Phones get a shorter first batch so the page stays scannable.
  const BATCH = matchMedia('(max-width: 620px)').matches ? Number(root.dataset.batchPhone) || 6 : Number(root.dataset.batch) || 9;

  const params = new URLSearchParams(location.search);
  let mode = root.dataset.player === 'lightbox' ? 'lightbox' : 'inline';
  if (root.hasAttribute('data-allow-player-override') && ['inline', 'lightbox'].includes(params.get('player'))) mode = params.get('player');
  root.dataset.mode = mode;
  const lb = mode === 'lightbox' ? createLightbox(root.querySelector('dialog'), items, { where }) : null;

  let shown = BATCH;
  let current = [];

  // ---------- inline playback ----------
  const inlineVideos = new Set();
  const pauseAll = (except) => inlineVideos.forEach((v) => { if (v !== except && !v.paused) v.pause(); });
  const vis = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const e of entries) if (e.intersectionRatio < 0.25 && !e.target.paused) e.target.pause();
  }, { threshold: [0, 0.25] }) : null;

  function playInline(card) {
    const d = items[+card.dataset.i];
    const btn = card.querySelector('.gcard__open');
    const v = document.createElement('video');
    Object.assign(v, { src: d.src, controls: true, playsInline: true, preload: 'auto' });
    if (d.poster) v.poster = d.poster;
    v.setAttribute('aria-label', d.title);
    if (d.captions) { const t = document.createElement('track'); Object.assign(t, { kind: 'captions', srclang: 'en', label: 'English', src: d.captions, default: !d.openCaptions }); v.append(t); }
    v.className = 'gcard__video';
    v.addEventListener('play', () => pauseAll(v));
    btn.replaceWith(v);
    inlineVideos.add(v);
    vis?.observe(v);
    pauseAll(v);
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    v.focus({ preventScroll: true });
    // Phones: the portrait frame is taller than the tile it replaces; bring all of it on screen.
    if (card.classList.contains('gcard--vertical') && matchMedia('(max-width: 620px)').matches) requestAnimationFrame(() => v.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
    track('video_play', { video: d.id, where: `${where}_inline` });
  }

  if (mode === 'inline') {
    // Photos are shown in place; they are not buttons in inline mode.
    for (const card of cards) {
      if (card.dataset.kind !== 'image') continue;
      const btn = card.querySelector('.gcard__open');
      const div = document.createElement('div');
      div.className = 'gcard__open gcard__open--still';
      div.append(...btn.childNodes);
      btn.replaceWith(div);
    }
  }

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('button.gcard__open');
    if (!btn) return;
    const card = btn.closest('.gcard');
    if (mode === 'lightbox') lb.open(+card.dataset.i, current.slice(0, shown), btn);
    else if (card.dataset.kind === 'video') playInline(card);
  });

  // ---------- filters ----------
  const labelMap = new Map();
  const labelsOf = (sel) => { if (!labelMap.has(sel)) labelMap.set(sel, Object.fromEntries([...sel.options].map((o) => [o.value, o.textContent.replace(/\s*\(\d+\)$/, '')]))); return labelMap.get(sel); };
  sels().forEach(labelsOf);
  const valid = (sel, v) => [...sel.options].some((o) => o.value === v);
  const byKey = (k) => sels().find((s) => KEYS[s.name] === k);
  for (const sel of sels()) if (valid(sel, params.get(sel.name))) sel.value = params.get(sel.name);
  // Old /work?service=… links redirect here with their query; keep that intent when no type is given.
  const typeSel = byKey('type');
  if (typeSel && !params.get('type')) { const svc = { video: 'video', photography: 'photo', drone: 'drone' }[params.get('service')]; if (svc && valid(typeSel, svc)) typeSel.value = svc; }
  const filtersNow = () => Object.fromEntries(sels().map((s) => [KEYS[s.name], s.value]));

  function render({ push = true, source } = {}) {
    const f = filtersNow();
    current = items.map((it, i) => (matches(it, f) ? i : -1)).filter((i) => i >= 0);
    const on = new Set(current.slice(0, shown));
    for (const card of cards) {
      const show = on.has(+card.dataset.i);
      if (!show && !card.hidden) card.querySelector('video')?.pause();
      card.hidden = !show;
    }
    const n = current.length;
    grid.dataset.shown = String(on.size);
    count.textContent = n === 1 ? '1 result' : `${n} results`; // screen-reader only (visually hidden)
    empty.hidden = n > 0;
    if (!n) {
      const lab = (k) => { const s = byKey(k); return s ? labelsOf(s)[f[k]] : ''; };
      const typeWord = f.type ? ` in ${lab('type').toLowerCase()}` : '';
      emptyTitle.textContent = f.pkg ? `No confirmed ${lab('pkg')} examples${typeWord} yet.`
        : f.seg ? `Nothing for ${lab('seg')}${typeWord} yet.` : 'Nothing matches this filter yet.';
    }
    const left = n - Math.min(shown, n);
    more.hidden = left <= 0;
    more.textContent = 'Load more';
    resetBtn.hidden = !Object.values(f).some(Boolean);
    for (const sel of sels()) {
      const labels = labelsOf(sel);
      for (const o of sel.options) o.textContent = labels[o.value] ?? o.textContent;
    }
    if (push) {
      const url = new URL(location.href);
      for (const sel of sels()) sel.value ? url.searchParams.set(sel.name, sel.value) : url.searchParams.delete(sel.name);
      history.replaceState(null, '', url);
    }
    if (source) track('gallery_filter', { where, filter: source, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || 'all'])), results: n });
  }

  form.addEventListener('change', (e) => {
    const sel = e.target.closest('select');
    if (!sel || !KEYS[sel.name]) return;
    shown = BATCH; render({ source: sel.name });
  });
  const first = () => sels()[0];
  form.addEventListener('reset', (e) => { e.preventDefault(); for (const s of sels()) s.value = ''; shown = BATCH; render({ source: 'reset' }); first()?.focus(); });
  root.querySelector('[data-rg-show-all]').addEventListener('click', () => {
    // Clear the audience/package filter and keep the media type (the empty state is about the narrower filter).
    for (const s of sels()) if (KEYS[s.name] !== 'type') s.value = '';
    if (!sels().some((s) => KEYS[s.name] !== 'type') && typeSel) typeSel.value = '';
    shown = BATCH; render({ source: 'show_all' }); first()?.focus();
  });
  more.addEventListener('click', () => {
    const firstNew = current[shown];
    shown += BATCH;
    render({ push: false });
    // Keyboard users continue from the first newly revealed item.
    root.querySelector(`.gcard[data-i="${firstNew}"] .gcard__open, .gcard[data-i="${firstNew}"] video`)?.focus?.();
    track('gallery_load_more', { where, shown: Math.min(shown, current.length) });
  });

  render({ push: false });
}
