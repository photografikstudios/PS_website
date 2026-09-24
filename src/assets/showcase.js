// Home "Selected work": Videos/Photos × category filter, 9 cards, lightbox viewer, View more → /work.
// Shared analytics helper from site.js (not re-imported: a second module instance would double-bind the menu and players).
const track = (name, props) => window.pgkTrack?.(name, props);

const root = document.querySelector('[data-showcase]');
if (root) {
  const data = JSON.parse(document.getElementById('sw-data').textContent);
  const kindSel = root.querySelector('#sw-kind');
  const catSel = root.querySelector('#sw-cat');
  const cards = [...root.querySelectorAll('.sw-card')];
  const empty = root.querySelector('#sw-empty');
  const more = root.querySelector('#sw-more');
  const dlg = root.querySelector('#lightbox');
  const stage = dlg.querySelector('#lb-stage');
  const titleEl = dlg.querySelector('#lb-title');
  const capEl = dlg.querySelector('#lb-caption');
  const LIMIT = 9;
  let visible = [];
  let current = -1;
  let opener = null;

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

  kindSel.addEventListener('change', () => { syncCategories(); render(); track('gallery_filter', { where: 'home', kind: kindSel.value, category: catSel.value }); });
  catSel.addEventListener('change', () => { render(); track('gallery_filter', { where: 'home', kind: kindSel.value, category: catSel.value }); });

  function show(i) {
    const d = data[i];
    current = i;
    stage.querySelector('video')?.pause();
    stage.textContent = '';
    stage.className = `lightbox__stage lightbox__stage--${d.kind} lightbox__stage--${d.orientation}`;
    if (d.kind === 'video') {
      const v = document.createElement('video');
      Object.assign(v, { src: d.src, controls: true, playsInline: true, preload: 'auto' });
      if (d.poster) v.poster = d.poster;
      v.setAttribute('aria-label', d.title);
      stage.append(v);
      v.play().catch(() => {});
      track('video_play', { video: d.title, where: 'lightbox' });
    } else {
      const im = document.createElement('img');
      im.src = d.src; im.alt = d.title; im.decoding = 'async';
      stage.append(im);
    }
    titleEl.innerHTML = '';
    const t = document.createElement('strong'); t.textContent = d.title; titleEl.append(t);
    if (d.sub) { const s = document.createElement('span'); s.textContent = d.sub; titleEl.append(s); }
    capEl.textContent = d.title;
    const pos = visible.indexOf(i);
    dlg.querySelector('[data-lb-prev]').hidden = visible.length < 2;
    dlg.querySelector('[data-lb-next]').hidden = visible.length < 2;
    dlg.dataset.pos = `${pos + 1}/${visible.length}`;
  }

  function step(dir) {
    if (visible.length < 2) return;
    const pos = visible.indexOf(current);
    show(visible[(pos + dir + visible.length) % visible.length]);
  }

  function close() {
    stage.querySelector('video')?.pause();
    stage.textContent = '';
    if (dlg.open) dlg.close();
  }

  root.querySelector('#sw-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.sw-card');
    if (!card) return;
    opener = card;
    show(+card.dataset.i);
    dlg.showModal();
    dlg.querySelector('[data-lb-close]').focus();
    track('lightbox_open', { item: data[+card.dataset.i].title });
  });
  dlg.querySelector('[data-lb-close]').addEventListener('click', close);
  dlg.querySelector('[data-lb-prev]').addEventListener('click', () => step(-1));
  dlg.querySelector('[data-lb-next]').addEventListener('click', () => step(1));
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && e.target.tagName !== 'VIDEO') step(1);
    if (e.key === 'ArrowLeft' && e.target.tagName !== 'VIDEO') step(-1);
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', () => { stage.querySelector('video')?.pause(); stage.textContent = ''; opener?.focus(); });

  syncCategories();
  render();
}
