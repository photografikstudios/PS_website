// Site-wide behavior: menu, analytics events, inline video playback.

// ---------- Analytics ----------
// Vendor-neutral: events go to window.dataLayer (GA4/GTM-ready) and a DOM event.
// No personal data is sent. A click is never recorded as a completed booking.
export function track(name, props = {}) {
  const payload = { event: name, ...props, page: location.pathname };
  (window.dataLayer = window.dataLayer || []).push(payload);
  window.dispatchEvent(new CustomEvent('pgk:track', { detail: payload }));
}
window.pgkTrack = track;

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-track]');
  if (!el) return;
  track(el.dataset.track, { location: el.dataset.trackLocation, package: el.dataset.trackPackage, href: el.getAttribute('href') });
});

// ---------- Mobile menu ----------
const toggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('site-nav');
if (toggle && nav) {
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); } });
  matchMedia('(min-width: 1081px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });
}

// ---------- Header over hero images ----------
const header = document.querySelector('.site-header');
if (header && document.body.classList.contains('has-overlay')) {
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
}

// ---------- Reveal on scroll (skipped for reduced motion) ----------
const reveals = document.querySelectorAll('.reveal, .reveal-img');
if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
  reveals.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  reveals.forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; io.observe(el); });
  // Safety net: never leave content hidden (e.g. print, very tall pages, observer quirks).
  setTimeout(() => reveals.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < innerHeight) el.classList.add('is-in'); }), 1200);
}

// ---------- Inline video ----------
// Videos play inside their own frame. No lightbox, modal, route change or new tab.
// One video plays at a time; videos pause when scrolled out of view.
const players = new Set();

function loadSource(player) {
  const v = player.querySelector('video');
  if (!v.getAttribute('src') && v.dataset.src) {
    v.src = v.dataset.src;
    v.preload = 'metadata';
    v.addEventListener('loadeddata', () => player.classList.add('has-frame'), { once: true });
  }
  return v;
}

function pauseOthers(current) {
  for (const p of players) {
    if (p === current) continue;
    const v = p.querySelector('video');
    if (!v.paused) v.pause();
  }
}

async function start(player) {
  const v = loadSource(player);
  pauseOthers(player);
  player.classList.add('is-started');
  v.controls = true;
  v.muted = false;
  try {
    await v.play();
  } catch {
    // Browser blocked audio: start muted, controls stay visible so the viewer can unmute.
    v.muted = true;
    try { await v.play(); } catch { /* leave paused with controls */ }
  }
  v.focus({ preventScroll: true });
  track('video_play', { video: player.dataset.id });
}

export function initVideos(root = document) {
  root.querySelectorAll('[data-video]').forEach((player) => {
    if (players.has(player)) return;
    players.add(player);
    const v = player.querySelector('video');
    v.setAttribute('tabindex', '-1');
    player.querySelector('.vplayer__start').addEventListener('click', () => start(player));
    v.addEventListener('play', () => { pauseOthers(player); player.classList.add('is-started'); v.removeAttribute('tabindex'); });
    v.addEventListener('ended', () => track('video_complete', { video: player.dataset.id }));
  });

  if (!('IntersectionObserver' in window)) return;
  // Lazy-load a frame when a no-poster video approaches the viewport.
  const near = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const v = e.target.querySelector('video');
      if (!v.poster) loadSource(e.target);
      near.unobserve(e.target);
    }
  }, { rootMargin: '300px 0px' });
  // Pause when mostly out of view.
  const vis = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target.querySelector('video');
      if (e.intersectionRatio < 0.25 && !v.paused) v.pause();
    }
  }, { threshold: [0, 0.25] });
  players.forEach((p) => { near.observe(p); vis.observe(p); });
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOthers(null); });
initVideos();
