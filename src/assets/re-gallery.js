// Real Estate gallery: package × media type filters, Load More, and a configurable player.
// Player mode comes from content/site.json (galleries.realEstate.player): 'inline' plays in the card,
// 'lightbox' opens the shared viewer. Review builds also accept ?player=inline|lightbox for comparison.
import { matches, optionCounts } from './gallery-core.js';
import { createLightbox } from './lightbox.js';
// Shared analytics helper from site.js (not re-imported: a second module instance would double-bind the menu and players).
const track = (name, props) => window.pgkTrack?.(name, props);

const root = document.querySelector('[data-regallery]');
if (root) {
  const items = JSON.parse(root.querySelector('[data-gallery-items]').textContent);
  const cards = [...root.querySelectorAll('.gcard')];
  // The package filter is only rendered once at least one package has a verified example; otherwise use an inert stand-in.
  const pkgLive = root.querySelector('#rg-package');
  const pkgSel = pkgLive || Object.assign(document.createElement('select'), { innerHTML: '<option value="">All packages</option>' });
  const typeSel = root.querySelector('#rg-type');
  const resetBtn = root.querySelector('.filters__clear');
  const count = root.querySelector('#rg-count');
  const empty = root.querySelector('#rg-empty');
  const emptyTitle = root.querySelector('#rg-empty-title');
  const more = root.querySelector('#rg-more');
  // Phones get a shorter first batch so the page stays scannable.
  const BATCH = matchMedia('(max-width: 620px)').matches ? 6 : Number(root.dataset.batch) || 9;

  const params = new URLSearchParams(location.search);
  let mode = root.dataset.player === 'lightbox' ? 'lightbox' : 'inline';
  if (root.hasAttribute('data-allow-player-override') && ['inline', 'lightbox'].includes(params.get('player'))) mode = params.get('player');
  root.dataset.mode = mode;
  const lb = mode === 'lightbox' ? createLightbox(root.querySelector('dialog'), items, { where: 'real_estate' }) : null;

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
    if (d.captions) { const t = document.createElement('track'); Object.assign(t, { kind: 'captions', srclang: 'en', label: 'English', src: d.captions, default: true }); v.append(t); }
    v.className = 'gcard__video';
    v.addEventListener('play', () => pauseAll(v));
    btn.replaceWith(v);
    inlineVideos.add(v);
    vis?.observe(v);
    pauseAll(v);
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    v.focus({ preventScroll: true });
    track('video_play', { video: d.id, where: 'real_estate_inline' });
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

  root.querySelector('#rg-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('button.gcard__open');
    if (!btn) return;
    const card = btn.closest('.gcard');
    if (mode === 'lightbox') lb.open(+card.dataset.i, current.slice(0, shown), btn);
    else if (card.dataset.kind === 'video') playInline(card);
  });

  // ---------- filters ----------
  const labels = (sel) => Object.fromEntries([...sel.options].map((o) => [o.value, o.textContent.replace(/\s*\(\d+\)$/, '')]));
  const pkgLabels = labels(pkgSel);
  const typeLabels = labels(typeSel);
  const valid = (sel, v) => [...sel.options].some((o) => o.value === v);
  if (valid(pkgSel, params.get('package'))) pkgSel.value = params.get('package');
  if (valid(typeSel, params.get('type'))) typeSel.value = params.get('type');
  // Old /work?service=… links redirect here with their query; keep that intent when no type is given.
  else { const svc = { video: 'video', photography: 'photo', drone: 'drone' }[params.get('service')]; if (svc && valid(typeSel, svc)) typeSel.value = svc; }

  function render({ push = true, source } = {}) {
    const f = { pkg: pkgSel.value, type: typeSel.value };
    current = items.map((it, i) => (matches(it, f) ? i : -1)).filter((i) => i >= 0);
    const on = new Set(current.slice(0, shown));
    for (const card of cards) {
      const show = on.has(+card.dataset.i);
      if (!show && !card.hidden) card.querySelector('video')?.pause();
      card.hidden = !show;
    }
    const n = current.length;
    count.textContent = n === 1 ? '1 piece' : `${n} pieces`;
    empty.hidden = n > 0;
    if (!n) emptyTitle.textContent = f.pkg ? `No confirmed ${pkgLabels[f.pkg]} examples${f.type ? ` in ${typeLabels[f.type].toLowerCase()}` : ''} yet.` : 'Nothing matches this filter yet.';
    const left = n - Math.min(shown, n);
    more.hidden = left <= 0;
    more.textContent = `Load more (${left})`;
    resetBtn.hidden = !f.pkg && !f.type;
    const pc = optionCounts(items, f, 'pkg', [...pkgSel.options].map((o) => o.value));
    for (const o of pkgSel.options) o.textContent = o.value ? `${pkgLabels[o.value]} (${pc[o.value]})` : pkgLabels[''];
    const tc = optionCounts(items, f, 'type', [...typeSel.options].map((o) => o.value));
    for (const o of typeSel.options) o.textContent = o.value ? `${typeLabels[o.value]} (${tc[o.value]})` : typeLabels[''];
    if (push) {
      const url = new URL(location.href);
      f.pkg ? url.searchParams.set('package', f.pkg) : url.searchParams.delete('package');
      f.type ? url.searchParams.set('type', f.type) : url.searchParams.delete('type');
      history.replaceState(null, '', url);
    }
    if (source) track('gallery_filter', { where: 'real_estate', filter: source, package: f.pkg || 'all', type: f.type || 'all', results: n });
  }

  pkgLive?.addEventListener('change', () => { shown = BATCH; render({ source: 'package' }); });
  typeSel.addEventListener('change', () => { shown = BATCH; render({ source: 'type' }); });
  const reset = (focusEl) => { pkgSel.value = ''; typeSel.value = ''; shown = BATCH; render({ source: 'reset' }); focusEl.focus(); };
  root.querySelector('[data-rg-filters]').addEventListener('reset', (e) => { e.preventDefault(); reset(pkgLive || typeSel); });
  root.querySelector('[data-rg-show-all]').addEventListener('click', () => { pkgSel.value = ''; shown = BATCH; render({ source: 'show_all' }); (pkgLive || typeSel).focus(); });
  more.addEventListener('click', () => {
    const first = current[shown];
    shown += BATCH;
    render({ push: false });
    // Keyboard users continue from the first newly revealed item.
    root.querySelector(`.gcard[data-i="${first}"] .gcard__open, .gcard[data-i="${first}"] video`)?.focus?.();
    track('gallery_load_more', { where: 'real_estate', shown: Math.min(shown, current.length) });
  });

  render({ push: false });
}
