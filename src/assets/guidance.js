import { INTENTS, validIntent, pageIntent, resolveIntent, sourceOf, campaignSlug, cleanVisit, canSuggest, bundleComparison } from './guidance-core.js';
import { parseSquareFeet, formatUSD, tierLabel } from './pricing-core.js';

const root = document.getElementById('service-guidance');
if (root) init();
function init() {
  const config = JSON.parse(document.getElementById('guidance-config').textContent);
  const key = 'pgk_service_visit_v1';
  const now = Date.now();
  let state = {};
  let storageAvailable = true;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || '{}');
    if (now - saved.updated < 30 * 60 * 1000) state = saved;
  } catch { storageAvailable = false; }
  state.choice = validIntent(state.choice);
  state.campaignIntent = validIntent(state.campaignIntent);
  const storedVisit = cleanVisit({ visitSource: state.source, visitCampaign: state.campaign, visitEntry: state.entry });
  state.source = storedVisit.visitSource;
  state.campaign = storedVisit.visitCampaign;
  state.entry = storedVisit.visitEntry;
  const persist = () => {
    state.updated = Date.now();
    try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { storageAvailable = false; }
  };
  const query = new URLSearchParams(location.search);
  const campaign = validIntent(query.get('intent'));
  const source = sourceOf(location.search, document.referrer, location.origin);
  if (!state.entry) {
    state.entry = config.route;
    state.source = source || 'direct';
    state.campaign = campaignSlug(query.get('utm_campaign'));
  }
  // A newly tagged campaign has fresh context, but never resets dismissal or overrides a visitor's choice.
  if (query.has('utm_source')) {
    state.source = source;
    state.campaign = campaignSlug(query.get('utm_campaign'));
    state.entry = config.route;
  }
  if (campaign) state.campaignIntent = campaign;
  let intent = resolveIntent({ path: config.route, campaign, choice: state.choice, previousCampaign: state.campaignIntent, previousPage: state.lastIntent, source: state.source });
  if (pageIntent(config.route)) { state.lastIntent = pageIntent(config.route); state.context = config.route; }
  if (config.route === '/contact' && query.has('type')) intent = query.get('type') === 'real-estate-large' ? 'listing' : Object.entries(INTENTS).find(([id, d]) => id !== 'listing' && d.type === query.get('type'))?.[0] || intent;
  persist();

  const track = (event, props = {}) => window.pgkTrack?.(event, { intent: intent || 'unsure', ...props });
  const card = root.querySelector('.guidance-card');
  const launch = root.querySelector('.guidance-launch');
  const dialog = root.querySelector('dialog');
  const primary = root.querySelector('.guidance-primary');
  const details = root.querySelector('.guidance-math');
  const hero = document.querySelector('.hero, .page-hero') || document.querySelector('main h1');
  const footer = document.querySelector('.site-footer');
  const marketingPage = root.dataset.auto === 'true';
  // If dismissal cannot be remembered, keep the manual chooser and skip automatic suggestions.
  const auto = marketingPage && storageAvailable;
  let displayed = false;
  let opener;
  let raf = 0;
  let started = Date.now();
  const desktop = () => matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches;
  const busy = () => document.hidden || state.handoff || document.body.classList.contains('menu-open') ||
    !!document.querySelector('dialog[open]') || !!document.activeElement?.closest('form') ||
    [...document.querySelectorAll('video')].some(v => !v.paused && !v.ended && (!v.hasAttribute('data-ambient') || !v.muted)) ||
    (footer && footer.getBoundingClientRect().top < innerHeight);
  const size = () => {
    const raw = document.querySelector('#sqft, #cmp-sqft')?.value ?? query.get('sqft') ?? '';
    const parsed = parseSquareFeet(raw);
    return parsed.ok ? parsed.value : raw.trim() ? null : 1;
  };
  const withIntent = (href, id) => {
    const u = new URL(href, location.origin);
    u.searchParams.set('intent', id);
    return u.pathname + u.search + u.hash;
  };
  function renderCard() {
    const data = INTENTS[intent || 'unsure'];
    let title = data.title, copy = data.value;
    let href = data.href;
    root.querySelector('.guidance-kicker').textContent = intent === 'listing' ? 'Our most popular listing package' : 'A useful next step';
    details.hidden = true;
    if (intent === 'listing') {
      const sqft = size();
      const comparison = bundleComparison(config.pricing, sqft);
      if (comparison) {
        title = `Save ${formatUSD(comparison.saving)} by bundling.`;
        copy = `Luxury Media · ${formatUSD(comparison.price)} · ${tierLabel(comparison)}.`;
        details.querySelector('p').textContent = `Photography + floor plan ${formatUSD(comparison.photos)}, drone add-on ${formatUSD(comparison.drone)}, and cinematic video + reel ${formatUSD(comparison.video)} total ${formatUSD(comparison.total)} when booked separately for this size. Luxury Media includes all three for ${formatUSD(comparison.price)}. No discount code needed. Base prices; tax and any applicable travel fees are additional.`;
        details.hidden = false;
      }
      if (sqft && sqft > 1) href += `?sqft=${sqft}`;
      href += '#pk-luxury-media';
      if (sqft > 30000) { title = 'A larger property needs a tailored scope.'; copy = 'Tell us about the property and the media you need.'; href = '/contact?type=real-estate-large'; }
    }
    root.querySelector('#guidance-title').textContent = title;
    root.querySelector('.guidance-copy').textContent = copy;
    primary.textContent = intent === 'listing' ? (size() > 30000 ? 'Discuss your listing' : 'See Luxury Media') : data.action;
    primary.href = intent === 'listing' && config.route === '/real-estate/pricing' && !(size() > 30000) ? '#pk-luxury-media' : withIntent(href, intent || 'unsure');
    primary.hidden = !intent;
  }
  function refresh() {
    raf = 0;
    const blocked = busy();
    const passedHero = !!hero && hero.getBoundingClientRect().bottom < 80;
    if (auto && canSuggest({ used: state.autoUsed, dismissed: state.dismissed, busy: blocked, elapsed: Date.now() - started, passedHero, trigger: 'scroll' })) reveal('scroll');
    card.hidden = !displayed || blocked;
    launch.hidden = !marketingPage || displayed || blocked;
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(refresh); };
  function reveal(trigger) {
    displayed = true;
    state.autoUsed = true;
    persist();
    renderCard();
    track('guidance_view', { trigger });
  }
  root.querySelector('.guidance-card .guidance-close').addEventListener('click', () => {
    displayed = false;
    state.dismissed = true;
    persist();
    track('guidance_dismiss');
    refresh();
    launch.focus({ preventScroll: true });
  });
  primary.addEventListener('click', () => { track('guidance_action', { href: primary.getAttribute('href') }); });
  function closeChooser() { dialog.close(); }
  root.querySelectorAll('[data-service-chooser]').forEach(button => button.addEventListener('click', () => {
    opener = button;
    state.autoUsed = true;
    persist();
    dialog.showModal();
    track('service_chooser_open');
    refresh();
  }));
  dialog.querySelector('.guidance-close').addEventListener('click', closeChooser);
  dialog.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button, a[href]')].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('close', () => { refresh(); if (opener && !opener.hidden) opener.focus({ preventScroll: true }); });
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeChooser(); } });
  dialog.querySelectorAll('[data-intent]').forEach(button => button.addEventListener('click', () => {
    intent = button.dataset.intent;
    state.choice = intent;
    persist();
    const data = INTENTS[intent];
    dialog.querySelectorAll('[data-intent]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    const result = dialog.querySelector('.service-result');
    result.hidden = false;
    result.querySelector('h3').textContent = data.title;
    result.querySelector('p').textContent = data.value;
    const action = result.querySelector('[data-choice-action]');
    action.textContent = data.action;
    action.href = withIntent(data.href, intent);
    const examples = result.querySelector('[data-choice-examples]');
    examples.href = withIntent(data.route, intent);
    examples.hidden = intent === 'unsure';
    track('service_intent_selected');
    renderCard();
    action.focus({ preventScroll: true });
    result.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }));
  dialog.querySelectorAll('a').forEach(a => a.addEventListener('click', () => track('service_route_click', { href: a.getAttribute('href') })));

  // Keep intent and coarse acquisition context with the inquiry, without replacing the visitor's own answers.
  const form = document.getElementById('inquiry');
  const visit = () => cleanVisit({ visitIntent: intent, visitSource: state.source, visitCampaign: state.campaign, visitEntry: state.entry, visitContext: state.context });
  if (form) {
    const type = form.querySelector('[name="type"]');
    if (!query.has('type') && type && !type.value && intent) type.value = INTENTS[intent].type;
    const populate = () => {
      for (const [name, value] of Object.entries(visit())) {
        let input = form.elements[name];
        if (!input) { input = document.createElement('input'); input.type = 'hidden'; input.name = name; form.append(input); }
        input.value = value;
      }
    };
    populate();
    type?.addEventListener('change', () => {
      intent = type.value === 'real-estate-large' ? 'listing' : Object.entries(INTENTS).find(([id, d]) => id !== 'listing' && d.type === type.value)?.[0] || '';
      populate();
    });
    form.addEventListener('submit', populate, true);
  }
  // The shared analytics stream stores enums only. Never send attribution slugs, form answers or referrer URLs.
  window.addEventListener('pgk:track', e => {
    if (e.detail.event === 'inquiry_submit') {
      state.handoff = true; persist();
      track('guidance_conversion', { source: state.source, delivery: e.detail.delivery });
    }
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const u = new URL(a.href, location.origin);
    if (['photografikstudios.hd.pics', 'book.squareup.com'].includes(u.hostname)) {
      state.handoff = true; persist();
      track('guidance_booking_handoff', { href: u.origin + u.pathname, source: state.source });
      refresh();
    }
  });
  document.addEventListener('pointerout', e => {
    if (!auto || e.pointerType !== 'mouse' || e.relatedTarget || e.clientY > 0) return;
    if (canSuggest({ used: state.autoUsed, dismissed: state.dismissed, busy: busy(), elapsed: Date.now() - started, scroll: scrollY, trigger: 'exit', desktop: desktop() })) { reveal('exit'); refresh(); }
  });
  document.addEventListener('input', e => { if (e.target.matches('#sqft, #cmp-sqft')) renderCard(); });
  for (const event of ['scroll', 'resize', 'pageshow']) window.addEventListener(event, schedule, { passive: true });
  for (const event of ['focusin', 'focusout', 'play', 'pause', 'ended', 'visibilitychange']) document.addEventListener(event, schedule, true);
  new MutationObserver(schedule).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open', 'class'] });
  renderCard();
  refresh();
  setTimeout(schedule, 12100);
}
