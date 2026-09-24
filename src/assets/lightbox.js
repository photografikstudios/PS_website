// Shared lightbox viewer for gallery cards (Home Selected Work; Real Estate gallery in lightbox mode).
// Uses the native <dialog>: focus is trapped by the browser, Escape closes, focus returns to the opener.
// Items: { kind: 'video' | 'image', title, sub, src, poster, orientation }.
const track = (name, props) => window.pgkTrack?.(name, props);

export function createLightbox(dlg, items, { where = 'gallery' } = {}) {
  const stage = dlg.querySelector('[data-lb-stage]');
  const titleEl = dlg.querySelector('[data-lb-title]');
  const capEl = dlg.querySelector('[data-lb-caption]');
  const prev = dlg.querySelector('[data-lb-prev]');
  const next = dlg.querySelector('[data-lb-next]');
  let order = [];
  let current = -1;
  let opener = null;

  const stop = () => { stage.querySelector('video')?.pause(); stage.textContent = ''; };

  function show(i) {
    const d = items[i];
    current = i;
    stop();
    stage.className = `lightbox__stage lightbox__stage--${d.kind} lightbox__stage--${d.orientation}`;
    if (d.kind === 'video') {
      const v = document.createElement('video');
      Object.assign(v, { src: d.src, controls: true, playsInline: true, preload: 'auto' });
      if (d.poster) v.poster = d.poster;
      v.setAttribute('aria-label', d.title);
      stage.append(v);
      v.play().catch(() => {});
      track('video_play', { video: d.id || d.title, where: `${where}_lightbox` });
    } else {
      const im = document.createElement('img');
      im.src = d.src; im.alt = d.alt || d.title; im.decoding = 'async';
      stage.append(im);
    }
    titleEl.textContent = '';
    const t = document.createElement('strong'); t.textContent = d.title; titleEl.append(t);
    if (d.sub) { const s = document.createElement('span'); s.textContent = d.sub; titleEl.append(s); }
    const pos = order.indexOf(i);
    capEl.textContent = order.length > 1 ? `${d.title}. ${pos + 1} of ${order.length}` : d.title;
    prev.hidden = next.hidden = order.length < 2;
  }

  function step(dir) {
    if (order.length < 2) return;
    const pos = order.indexOf(current);
    show(order[(pos + dir + order.length) % order.length]);
  }

  dlg.querySelector('[data-lb-close]').addEventListener('click', () => dlg.close());
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  dlg.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'VIDEO') return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { stop(); opener?.focus(); });

  return {
    /** Open item i; `visibleOrder` is the list of item indexes arrows cycle through (the current filter). */
    open(i, visibleOrder, from) {
      order = visibleOrder.includes(i) ? visibleOrder : [i];
      opener = from || null;
      show(i);
      dlg.showModal();
      dlg.querySelector('[data-lb-close]').focus();
      track('lightbox_open', { item: items[i].id || items[i].title, where });
    },
  };
}
