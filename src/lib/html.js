// Small HTML helpers used by the page templates.

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const attrs = (o) => Object.entries(o)
  .filter(([, v]) => v !== false && v != null)
  .map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(' ');

export const join = (arr, fn) => arr.map(fn).join('');

export function createContext({ site, reviewMode, onVercel }) {
  const mediaUrl = (p) => (!p ? '' : /^https?:/.test(p) ? p : site.media.base + p);

  // Vercel Image Optimization for remote sources. Locally we fall back to the original URL.
  const WIDTHS = [480, 768, 1080, 1600, 2200];
  const optimized = (p, w, q = 75) => {
    const u = mediaUrl(p);
    if (!onVercel) return u;
    return `/_vercel/image?url=${encodeURIComponent(u)}&w=${w}&q=${q}`;
  };
  const srcset = (p, widths = WIDTHS) => (onVercel ? widths.map((w) => `${optimized(p, w)} ${w}w`).join(', ') : null);

  function img(p, { alt = '', sizes = '100vw', cls = '', eager = false, widths, width, height } = {}) {
    return `<img ${attrs({
      src: optimized(p, 1080), srcset: srcset(p, widths), sizes: onVercel ? sizes : null, alt,
      class: cls || null, loading: eager ? 'eager' : 'lazy', decoding: 'async',
      fetchpriority: eager ? 'high' : null, width, height,
    })}>`;
  }

  const needsApproval = (rec, note) => {
    if (!reviewMode) return '';
    if (rec && rec.approval === 'approved') return '';
    const title = note || rec?.note || '';
    return `<span class="needs-approval" ${title ? `title="${esc(title)}"` : ''}>Needs approval</span>`;
  };

  /** Inline video player: poster + start button, then native controls inside the frame. No dialog. */
  function videoPlayer(m, { sizes = '(min-width: 900px) 30vw, 90vw', eagerPoster = false } = {}) {
    const posterSrc = m.poster ? optimized(m.poster, 1080) : null;
    const label = `Play ${m.title}${m.duration ? `, ${m.duration} seconds` : ''}`;
    const src = mediaUrl(m.src) + (m.poster ? '' : `#t=${m.posterTime ?? 0.5}`);
    return `<div class="vplayer vplayer--${esc(m.orientation)}" data-video data-id="${esc(m.id)}" data-title="${esc(m.title)}">
  <video ${attrs({ 'data-src': src, poster: posterSrc, playsinline: true, preload: 'none', 'aria-label': m.title, 'webkit-playsinline': true })}>
    ${m.captions && m.captions !== 'burned-in' ? `<track kind="captions" srclang="en" label="English" src="${esc(mediaUrl(m.captions))}" default>` : ''}
  </video>
  ${!m.poster ? `<div class="vplayer__frame" aria-hidden="true"></div>` : ''}
  <button type="button" class="vplayer__start" aria-label="${esc(label)}">
    <span class="vplayer__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span>
    ${m.duration ? `<span class="vplayer__dur">${Math.floor(m.duration / 60)}:${String(m.duration % 60).padStart(2, '0')}</span>` : ''}
  </button>
</div>`;
  }

  return { mediaUrl, optimized, img, needsApproval, videoPlayer };
}
