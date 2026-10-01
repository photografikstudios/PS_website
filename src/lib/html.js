// Small HTML helpers used by the page templates.

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const attrs = (o) => Object.entries(o)
  .filter(([, v]) => v !== false && v != null)
  .map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(' ');

export const join = (arr, fn) => arr.map(fn).join('');

// Focal point chosen in /admin for a cropped photo: which part stays in frame when a card crops it.
const FOCAL = { top: '50% 15%', 'upper-third': '50% 30%', bottom: '50% 85%', left: '20% 50%', right: '80% 50%' };
export const focalPosition = (f) => FOCAL[f] || null;
export const focalAttr = (f) => (FOCAL[f] ? ` style="object-position: ${FOCAL[f]}"` : '');

export function createContext({ site, reviewMode, onVercel }) {
  const isLocal = (p) => typeof p === 'string' && p.startsWith('/v/');
  const mediaUrl = (p) => (!p ? '' : /^https?:/.test(p) || isLocal(p) ? p : site.media.base + p);

  // Vercel Image Optimization for remote sources. Locally we fall back to the original URL.
  const WIDTHS = [480, 768, 1080, 1600, 2200];
  const optimized = (p, w, q = 75) => {
    const u = mediaUrl(p);
    if (!onVercel || isLocal(p)) return u;
    return `/_vercel/image?url=${encodeURIComponent(u)}&w=${w}&q=${q}`;
  };
  const srcset = (p, widths = WIDTHS) => (onVercel && !isLocal(p) ? widths.map((w) => `${optimized(p, w)} ${w}w`).join(', ') : null);

  function img(p, { alt = '', sizes = '100vw', cls = '', eager = false, widths, width, height, thumb, focal } = {}) {
    // Build-encoded stills (/v/<id>.webp, 2000px) ship a 900px <id>-sm.webp; let phones pick the small one.
    const local = isLocal(p) && thumb;
    return `<img ${attrs({
      src: local ? thumb : optimized(p, 1080), srcset: local ? `${thumb} 900w, ${p} 2000w` : srcset(p, widths), sizes: local || (onVercel && !isLocal(p)) ? sizes : null, alt,
      class: cls || null, loading: eager ? 'eager' : 'lazy', decoding: 'async',
      fetchpriority: eager ? 'high' : null, width, height, style: focalPosition(focal) ? `object-position: ${focalPosition(focal)}` : null,
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
  <video ${attrs({ src, poster: posterSrc, playsinline: true, preload: 'none', 'aria-label': m.title, 'webkit-playsinline': true })}>
    ${m.captions && m.captions !== 'burned-in' ? `<track kind="captions" srclang="en" label="English" src="${esc(mediaUrl(m.captions))}"${m.openCaptions ? '' : ' default'}>` : ''}
  </video>
  ${!m.poster ? `<div class="vplayer__frame" aria-hidden="true"></div>` : ''}
  <button type="button" class="vplayer__start" aria-label="${esc(label)}">
    <span class="vplayer__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span>
    ${m.duration ? `<span class="vplayer__dur">${Math.floor(m.duration / 60)}:${String(m.duration % 60).padStart(2, '0')}</span>` : ''}
  </button>
</div>`;
  }

  /** Muted, looping video (hero, tiles, in-page examples). Poster shows when motion is reduced or before load.
   *  Every loop starts preload="none"; site.js starts it on screen (on phones only after the page has loaded).
   *  Only the hero (eager) carries its poster up front; other posters load as they near the viewport.
   *  Decorative by default (aria-hidden); pass a label when the loop is an example the visitor should know about. */
  function ambient(id, { cls = '', eager = false, label = '' } = {}) {
    const poster = `/v/${esc(id)}.webp`;
    return `<video class="ambient ${cls}" data-ambient muted loop playsinline preload="none" ${eager ? `poster="${poster}"` : `data-poster="${poster}"`} ${label ? `aria-label="${esc(label)}"` : 'aria-hidden="true"'} tabindex="-1" disableremoteplayback>
    <source src="/v/${esc(id)}-loop.mp4" type="video/mp4"></video>`;
  }

  return { mediaUrl, optimized, img, needsApproval, videoPlayer, ambient, isLocal };
}
