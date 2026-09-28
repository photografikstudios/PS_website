import { esc, join } from './lib/html.js';
import { formatUSD, resolvePrice, inclusion, includeLabels, tierLabel, findTier } from './lib/pricing-core.js';
import { facts, editorialOrder, TYPE_FILTERS, optionCounts, segmentsOf } from './lib/gallery-core.js';

const arrow = '<span aria-hidden="true">→</span>';

export function buildPages(ctx) {
  const { site, pricing, work, offers, faqs, testimonials, img, videoPlayer, needsApproval, visible, ambient, reviewMode } = ctx;
  const booking = site.destinations.booking.href;
  const bookBtn = (loc, label = 'Book a Shoot', cls = 'btn btn--solid') =>
    `<a class="${cls}" href="${booking}" data-track="book_click" data-track-location="${loc}">${label}</a>`;
  const projectBySlug = Object.fromEntries(work.projects.map((p) => [p.slug, p]));
  // Portfolio media. The About testimonial (category 'about') is used only on About, never in galleries.
  const media = work.media.filter((m) => visible(m) && m.category !== 'about');
  const catLabel = Object.fromEntries(work.taxonomy.category.map((c) => [c.id, c.label]));
  const svcLabel = Object.fromEntries(work.taxonomy.service.map((c) => [c.id, c.label]));
  const pkg = Object.fromEntries(pricing.packages.map((p) => [p.id, p]));
  const starting = (rec) => formatUSD(resolvePrice(rec, null).amount);
  // James, Sep 28 2026: the Social Media plan carries the "Most Popular" label and the featured treatment.
  const pkgFeatured = (p) => p.badge === 'Most Popular';
  const pkgTag = (p) => p.badge || (p.role === 'Premium' ? 'Premium anchor' : p.role);

  // ---------- shared pieces ----------
  const allMediaById = Object.fromEntries(work.media.map((m) => [m.id, m]));
  // No standalone Work page (James, Sep 25): each category's full collection lives on its service page, at #portfolio.
  const serviceRoute = { 'real-estate': '/real-estate', 'agent-content': '/agent-content', 'architecture-design': '/architecture-design', commercial: '/commercial', 'creator-studios': '/creator-studios' };
  const isApproved = (r) => (r.approval ?? 'approved') === 'approved';
  // Offer prices that James has not approved never reach HTML (the review alias is public): show the offer, not the figure.
  const approvedPrice = (rec, html, pending = 'Price confirmed when we scope it') => (isApproved(rec) ? html : `<span class="price-pending">${pending}</span>`);
  const projectPath = (p) => p.path || `${serviceRoute[p.category]}/${p.slug}`;
  const mmss = (d) => `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`;
  // Hero video: the page's relevant 16:9 footage autoplays silently in its frame (muted, playsinline, poster first).
  // No separate film stage or play prompt; the visitor can pause it, and reduced motion or blocked autoplay keeps the poster.
  const motionToggle = '<button type="button" class="motion-toggle" data-motion-toggle aria-pressed="false"><span class="motion-toggle__icon" aria-hidden="true"></span><span class="motion-toggle__label">Pause video</span></button>';
  const pageHero = ({ eyebrow, title, lede, cta = '', image, imageAlt = '', tone = 'dark', video }) => {
    const kind = video ? 'page-hero--image page-hero--video' : image ? 'page-hero--image' : 'page-hero--plain';
    return `
<section class="page-hero ${kind} ${tone === 'dark' || video ? 'on-dark' : 'page-hero--ivory'}"${video ? ` data-hero-source="${esc(video.loop)}"` : ''}>
  ${video ? `<div class="page-hero__media">${ambient(video.loop, { eager: true, cls: 'hero__video' })}</div>`
    : image ? `<div class="page-hero__media">${img(image, { alt: imageAlt, eager: true, sizes: '100vw', widths: [768, 1080, 1600, 2200] })}</div>` : ''}
  <div class="wrap page-hero__inner">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1 class="display">${title}</h1>
    ${lede ? `<p class="lede">${lede}</p>` : ''}
    ${cta ? `<div class="actions">${cta}</div>` : ''}
    ${video && allMediaById[video.credit || video.film || video.loop] ? `<p class="hero-credit">On screen: ${esc(allMediaById[video.credit || video.film || video.loop].title)}</p>` : video?.creditText ? `<p class="hero-credit">${esc(video.creditText)} ${video.pending ? needsApproval({ approval: 'pending' }, video.pending) : ''}</p>` : ''}
  </div>
  ${video ? motionToggle : ''}
</section>`;
  };

  // James, Sep 28 2026: galleries show the media only, with no captions beneath (names stay in alt text and labels).
  const mediaCard = (m, { showMeta = false, sizes } = {}) => {
    const project = m.project ? projectBySlug[m.project] : null;
    const href = project && visible(project) ? projectPath(project) : null;
    const frame = m.type === 'video'
      ? videoPlayer(m, { sizes })
      : `<div class="still still--${m.orientation}">${href ? `<a href="${href}" class="still__link" aria-label="${esc(project.title)}: view project">` : ''}${img(m.src, { alt: m.alt || '', thumb: m.thumb, sizes: sizes || '(min-width: 1100px) 33vw, (min-width: 700px) 50vw, 100vw' })}${href ? '</a>' : ''}</div>`;
    const meta = showMeta ? `<div class="card__meta">
        <p class="card__title">${href ? `<a href="${href}">${esc(m.title)}</a>` : esc(m.title)}</p>
        <p class="card__sub">${esc(catLabel[m.category] || '')}${(m.location || project?.location) ? ` · ${esc(m.location || project.location)}` : ''}${m.type === 'video' ? ' · Film' : ''}${m.type === 'video' && m.dialogue !== false && !m.captions ? ` ${needsApproval({ approval: 'pending' }, m.dialogue ? 'Captions and transcript needed before launch' : 'Check whether this film has speech; captions needed if it does')}` : ''}${m.type === 'video' && m.captions && m.captions !== 'burned-in' && m.captionsStatus !== 'approved' ? ` ${needsApproval({ approval: 'pending' }, 'Captions are a machine-transcribed draft; James to proofread names and wording before launch')}` : ''}</p>
      </div>` : '';
    return `<article class="card card--${m.orientation} card--${m.type} reveal" style="--ar:${m.orientation === 'vertical' ? '0.5625' : m.type === 'video' ? '1.7778' : '1.5'}"
      data-service="${esc(m.service.join(' '))}" data-category="${esc(m.category)}" data-kind="${m.type}">
      ${frame}${meta}
    </article>`;
  };

  // ---------- shared gallery pieces (one media collection, several views) ----------
  const galThumb = (m) => (m.type === 'video' ? (ctx.isLocal(m.poster) ? m.poster : ctx.optimized(m.poster, 1080)) : (m.thumb || ctx.optimized(m.src, 1080)));
  const galFull = (m) => (m.type === 'video' ? ctx.mediaUrl(m.src) : ctx.isLocal(m.src) ? m.src : ctx.optimized(m.src, 2200));
  const galleryItem = (m) => ({
    id: m.id, title: m.title, sub: [m.client, m.location].filter(Boolean).join(' · '), src: galFull(m),
    poster: m.type === 'video' ? galThumb(m) : null, alt: m.alt || m.title, category: m.category, orientation: m.orientation, ...facts(m, segmentsOf(m, projectBySlug)),
    captions: m.type === 'video' && m.captions && m.captions !== 'burned-in' ? m.captions : undefined,
    openCaptions: m.openCaptions || undefined,
  });
  const itemsJson = (list) => `<script type="application/json" data-gallery-items>${JSON.stringify(list.map(galleryItem)).replace(/</g, '\\u003c')}</script>`;
  const playIcon = '<span class="sw-card__play" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg></span>';
  const lightboxDialog = () => `
  <dialog class="lightbox" id="lightbox" aria-labelledby="lb-title">
    <div class="lightbox__bar"><p class="lightbox__title" id="lb-title" data-lb-title></p><button type="button" class="lightbox__close" data-lb-close aria-label="Close">×</button></div>
    <button type="button" class="lightbox__nav lightbox__nav--prev" data-lb-prev aria-label="Previous">‹</button>
    <div class="lightbox__stage" id="lb-stage" data-lb-stage></div>
    <button type="button" class="lightbox__nav lightbox__nav--next" data-lb-next aria-label="Next">›</button>
    <p class="lightbox__caption" id="lb-caption" data-lb-caption aria-live="polite"></p>
  </dialog>`;

  const threeSteps = (dark = false) => `
<section class="section ${dark ? 'section--ink on-dark' : ''}">
  <div class="wrap">
    <div class="split">
      <div class="split__label"><p class="eyebrow">The plan</p></div>
      <div><h2 class="h2 reveal">Three steps from first call to finished media.</h2></div>
    </div>
    <ol class="steps">
      <li class="reveal"><span class="steps__n">01 / Choose</span><h3>Choose the right starting point.</h3><p>Book a standard listing package online, or tell us about the larger project so we can scope it properly.</p></li>
      <li class="reveal"><span class="steps__n">02 / Create</span><h3>Plan and create.</h3><p>We align the scope, prepare the shoot and produce the right mix of media, on location or in our studio.</p></li>
      <li class="reveal"><span class="steps__n">03 / Use</span><h3>Put the content to work.</h3><p>You receive polished assets made for this launch and for the conversations that follow it.</p></li>
    </ol>
  </div>
</section>`;

  const faqBlock = (list) => {
    const items = list.filter(visible);
    if (!items.length) return '';
    return `<div class="faq">${join(items, (f) => `<details class="faq__item"><summary>${esc(f.q)} ${needsApproval(f)}</summary><p>${esc(f.a)}</p></details>`)}</div>`;
  };

  const splitCta = (title = 'Ready when you are.', image = '/images/photografik-2027/curated/home-estate-exterior.webp') => `
<section class="closing on-dark">
  <div class="closing__media">${img(image, { alt: '', sizes: '100vw' })}</div>
  <div class="wrap closing__inner">
    <p class="eyebrow">Next step</p>
    <h2 class="h2 reveal">${title}</h2>
    <div class="split-cta__grid">
      <div class="reveal"><p class="eyebrow">Listing media</p><p>Choose a package and a date in our booking portal. Most listings book in a few minutes.</p>${bookBtn('final_cta', 'Book a Shoot', 'btn btn--rust')}</div>
      <div class="reveal"><p class="eyebrow">Architecture, commercial, agency, custom</p><p>Tell us about the project. We will come back with a plan and an estimate.</p><a class="btn btn--ghost" href="/contact" data-track="project_click" data-track-location="final_cta">Start a Project</a></div>
    </div>
  </div>
</section>`;

  // James, Sep 28 2026: an image above each step or service block, and full-bleed image footers with a legible overlay.
  const blockFig = (src, alt, { thumb, cls = '', sizes = '(min-width: 900px) 30vw, 100vw', pos } = {}) => (src ? `<figure class="block-fig ${cls}"${pos ? ` style="--pos:${pos}"` : ''}>${img(src, { alt, thumb, sizes })}</figure>` : '');
  const mediaFig = (id, opts = {}) => { const m = allMediaById[id]; if (!m) return ''; return blockFig(m.type === 'video' ? m.poster : m.src, opts.alt || (m.type === 'video' ? `Frame from ${m.title}` : (m.alt || m.title)), { thumb: m.thumb, ...opts }); };
  const bleedCta = ({ title, text, cta, image, alt = '', eyebrow = '' }) => `
<section class="closing closing--bleed on-dark">
  <div class="closing__media">${img(image, { alt, sizes: '100vw' })}</div>
  <div class="wrap closing__inner cta-band">
    ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}
    <h2 class="h2 reveal">${title}</h2>
    <p>${text}</p>
    ${cta}
  </div>
</section>`;
  const pages = {};

  // ---------- HOME ----------
  // Home showcase: videos with a poster and all stills, filtered client-side (Videos/Photos × category).
  const showcase = editorialOrder(media.filter((m) => (m.type === 'video' ? !!m.poster : true)));
  const homeLimit = site.galleries?.home?.limit || 9;
  const insight = media.find((x) => x.id === 'agent-market-insight');
  pages['/'] = {
    overlay: true,
    scripts: ['showcase.js'],
    body: `
<section class="hero hero--video" data-hero-source="re-hamptons-beachfront">
  <div class="hero__media">${ambient('re-hamptons-beachfront', { eager: true, cls: 'hero__video' })}</div>
  <div class="wrap hero__inner">
    <p class="eyebrow">Photography · Film · Drone · Content</p>
    <h1 class="display display--xl">Media that markets the property, <em>and the professional behind it.</em></h1>
    <div class="hero__foot">
      <div>
        <p class="lede">Listing campaigns, architecture and brand production for agents, builders and businesses across the Hamptons, the North Fork and Long Island.</p>
        <div class="actions">${bookBtn('home_hero', 'Book a Shoot', 'btn btn--rust')}<a class="link-arrow" href="/contact" data-track="project_click" data-track-location="home_hero">Start a Project →</a></div>
      </div>
      <p class="hero__meta">East End · Hamptons · North Fork<br>Suffolk · Nassau · NYC</p>
    </div>
  </div>
  <p class="hero-credit hero-credit--home wrap">On screen: ${esc(allMediaById['re-hamptons-beachfront']?.title || '')}</p>
  ${motionToggle}
</section>

<section class="quick on-dark" aria-label="Book or start a project">
  <div class="wrap quick__grid">
    <article class="quick__tile reveal">
      <div class="quick__media quick__media--listings"><img src="/v/home-listings-twilight.webp" srcset="/v/home-listings-twilight-sm.webp 900w, /v/home-listings-twilight.webp 2000w" sizes="(min-width: 700px) 50vw, 100vw" alt="White Westhampton residence at dusk with its windows lit" loading="lazy" decoding="async"></div>
      <div class="quick__body">
        <p class="eyebrow eyebrow--rust">For your listings</p>
        <h2 class="quick__title">Listing Media</h2>
        <p>Photo, film, drone and floor plans for the property in front of you, booked online in a few minutes.</p>
        <div class="actions">${bookBtn('home_quick', 'Book a Shoot', 'btn btn--rust')}<a class="btn btn--glass" href="/real-estate/pricing" data-track="pricing_nav" data-track-location="home_quick">See pricing</a></div>
      </div>
    </article>
    <article class="quick__tile reveal">
      <div class="quick__media quick__media--brand"><img src="/v/home-brand-conversation.webp" srcset="/v/home-brand-conversation-sm.webp 900w, /v/home-brand-conversation.webp 2000w" sizes="(min-width: 700px) 50vw, 100vw" alt="Two professionals in conversation at a kitchen island while two cameras record" loading="lazy" decoding="async"></div>
      <div class="quick__body">
        <p class="eyebrow eyebrow--rust">For your brand</p>
        <h2 class="quick__title">Brand &amp; Business Media</h2>
        <p>Brand films, project stories and monthly content for builders, designers and local businesses.</p>
        <div class="actions"><a class="btn btn--rust" href="/contact" data-track="project_click" data-track-location="home_quick">Start a Project</a><a class="btn btn--glass" href="/commercial">Learn more</a></div>
      </div>
    </article>
  </div>
</section>

<section class="section section--tint" aria-labelledby="paths-h">
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Who we work with</p><h2 class="h2 reveal" id="paths-h">Find your starting point.</h2></div></div>
    <div class="paths paths--4">
      ${join([
        { href: '/real-estate', vid: 're-hamptons-calm', n: '01 / Real estate', t: 'Listing campaigns and agent media', x: 'Photo, horizontal and vertical film, drone, twilight and floor plans.', go: 'Real estate' },
        { href: '/architecture-design', vid: 'arch-yankee-barn-film', n: '02 / Architecture & builders', t: 'Projects told properly', x: 'Photography and film for architects, designers and builders, planned around your portfolio.', go: 'Architecture & design' },
        { href: '/commercial', vid: 'biz-rachel-lynch-pools', n: '03 / Business & brand', t: 'Brand films and content', x: 'Brand films, process stories and monthly content, for you or through your agency.', go: 'Commercial' },
        { href: '/creator-studios', vid: 'cs-jm2-architecture', n: '04 / LI Creator Studios', t: 'Podcast and studio production', x: 'Multi-camera podcast and content sessions in our Bohemia studio.', go: 'LI Creator Studios' },
      ], (c) => `
      <a class="path reveal" href="${c.href}">
        <span class="path__img">${ambient(c.vid)}</span>
        <span class="path__body"><span class="path__num">${c.n}</span><span class="path__title">${c.t}</span><span class="path__text">${c.x}</span><span class="path__go">${c.go} →</span></span>
      </a>`)}
    </div>
  </div>
</section>

<section class="section section--ink on-dark showcase" id="selected-work" aria-labelledby="work-h" data-showcase data-limit="${homeLimit}" data-routes="${esc(JSON.stringify(serviceRoute))}">
  <div class="wrap">
    <div class="showcase__head">
      <div><p class="eyebrow">Selected work</p><h2 class="h2 reveal" id="work-h">Different briefs. <em>One standard.</em></h2></div>
      <div class="showcase__filters" role="group" aria-label="Filter selected work">
        <label class="sr-only" for="sw-kind">Media type</label>
        <select id="sw-kind" class="pill-select"><option value="video">Videos</option><option value="image">Photos</option></select>
        <label class="sr-only" for="sw-cat">Category</label>
        <select id="sw-cat" class="pill-select">${join(work.taxonomy.category.filter((c) => showcase.some((m) => m.category === c.id)), (c) => `<option value="${c.id}">${esc(c.label)}</option>`)}</select>
      </div>
    </div>
    <div class="showcase__grid" id="sw-grid">
      ${join(showcase, (m, i) => `<button type="button" class="sw-card" data-i="${i}" data-kind="${m.type === 'video' ? 'video' : 'image'}" data-category="${esc(m.category)}" aria-label="${m.type === 'video' ? 'Play' : 'View'} ${esc(m.title)}"${i >= homeLimit ? ' hidden' : ''}>
        <img src="${esc(galThumb(m))}" alt="" loading="lazy" decoding="async">
        ${m.type === 'video' ? playIcon : ''}
      </button>`)}
    </div>
    <p class="showcase__empty" id="sw-empty" hidden>Nothing in this category yet. Try another, or <a href="/contact">start a project</a>.</p>
    <div class="showcase__more"><a class="btn btn--light" id="sw-more" href="/real-estate?type=video#portfolio" data-track="gallery_view_more">View more</a></div>
  </div>
  ${lightboxDialog()}
  ${itemsJson(showcase)}
</section>

<section class="section" aria-labelledby="pkg-h">
  <div class="wrap">
    <div class="split">
      <div class="split__label"><p class="eyebrow">Listing packages</p></div>
      <div><h2 class="h2 reveal" id="pkg-h">A complete listing campaign, <em>captured in one visit.</em></h2><p class="lede reveal">Choose the level the property and the launch call for. Every package is shot and edited to the same standard.</p></div>
    </div>
    <div class="ladder">
      ${join(['listing-starter', 'luxury-media', 'signature'].map((id) => pkg[id]).filter(visible), (p) => `
      <div class="ladder__item reveal ${pkgFeatured(p) ? 'ladder__item--featured' : ''}">
        <p class="tag">${esc(pkgTag(p) || 'Package')}</p>
        <h3 class="h3">${esc(p.name)}</h3>
        <p>${esc(p.for)}</p>
        <p class="price-line">Starting at <strong>${starting(p)}</strong> ${needsApproval(p)}</p>
      </div>`)}
    </div>
    <div class="actions"><a class="btn btn--ink" href="/real-estate/pricing" data-track="pricing_nav" data-track-location="home_packages">Price your listing</a>${bookBtn('home_packages', 'Book a Shoot', 'link-arrow')}</div>
  </div>
</section>

${threeSteps(true)}

<section class="section">
  <div class="wrap two-col">
    <div>
      <p class="eyebrow">Beyond the listing</p>
      <h2 class="h2 reveal">One listing day can market <em>more than the house.</em></h2>
      <p class="lede reveal">The same shoot can produce horizontal film, vertical reels, aerials, a floor plan and on-camera pieces about you. Listing Engine, Agent Engine and monthly content plans help future sellers know you before the first meeting.</p>
      <a class="link-arrow" href="/agent-content">Agent content →</a>
    </div>
    <div class="two-col__media">${insight ? mediaCard(insight, { sizes: '(min-width: 900px) 30vw, 80vw' }) : ''}</div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap two-col">
    <div class="two-col__media"><div class="frame frame--tall reveal-img">${img('/images/photografik-2027/curated/revivaluxe-hero.webp', { alt: 'RevivaLuxe founder in the practice reception area', sizes: '(min-width: 900px) 45vw, 100vw' })}</div></div>
    <div>
      <p class="eyebrow">Commercial & agency production</p>
      <h2 class="h2 reveal">A production partner, <em>on location or in studio.</em></h2>
      <p class="lede reveal">Crew, locations, filming, editing and delivery, managed as one project. Client-facing or behind your agency, with roles and approvals agreed before we start.</p>
      <div class="actions"><a class="link-arrow" href="/commercial">Commercial →</a><a class="link-arrow" href="/agency-partnerships">Agencies →</a></div>
    </div>
  </div>
</section>

${splitCta('Ready when you are.')}`,
  };

  // ---------- FIELD NOTES ----------
  // One structured collection (content/field-notes.json). Review builds render draft/review pieces with a
  // Draft tag; production renders only published, approved pieces. 'source-needed' entries never render.
  const fn = ctx.fieldNotes;
  const fnTopic = Object.fromEntries(fn.topics.map((t) => [t.id, t.label]));
  const fnVisible = fn.articles.filter((a) => (a.status === 'published' && a.approvedBy) || (reviewMode && ['draft', 'review'].includes(a.status)));
  const mediaById = Object.fromEntries(work.media.map((m) => [m.id, m]));
  const fnDate = (d) => (d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');
  const draftTag = (a) => (a.status === 'published' ? '' : `<span class="needs-approval" title="Awaiting editorial review before publishing">Draft for review</span>`);
  const fnHeroImg = (a, opts = {}) => {
    const m = a.hero?.media ? mediaById[a.hero.media] : null;
    if (!m) return '';
    const src = m.type === 'video' ? m.poster : (m.src);
    return img(src, { alt: m.type === 'video' ? '' : (m.alt || m.title), sizes: opts.sizes || '(min-width: 900px) 33vw, 100vw', eager: !!opts.eager });
  };
  const fnMedia = (id) => {
    const m = mediaById[id];
    if (!m) return '';
    return m.type === 'video'
      ? `<figure class="fn-figure fn-figure--${esc(m.orientation)}">${videoPlayer(m, { sizes: '(min-width: 900px) 720px, 100vw' })}<figcaption>${esc(m.title)}${m.location ? `, ${esc(m.location)}` : ''}</figcaption></figure>`
      : `<figure class="fn-figure">${img(m.src, { alt: m.alt || m.title, sizes: '(min-width: 900px) 720px, 100vw' })}<figcaption>${esc(m.title)}</figcaption></figure>`;
  };
  const sectionId = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fnCard = (a) => `<article class="fn-card">
      <a class="fn-card__media" href="/field-notes/${esc(a.slug)}" tabindex="-1" aria-hidden="true">${fnHeroImg(a)}</a>
      <div class="fn-card__body">
        <p class="fn-card__meta">${esc(fnTopic[a.topic] || '')}${a.datePublished ? ` · ${esc(fnDate(a.datePublished))}` : ''} ${draftTag(a)}</p>
        <h3 class="fn-card__title"><a href="/field-notes/${esc(a.slug)}">${esc(a.title)}</a></h3>
        <p class="fn-card__summary">${esc(a.summary)}</p>
      </div>
    </article>`;

  if (fnVisible.length) {
    const topicsUsed = fn.topics.filter((t) => fnVisible.some((a) => a.topic === t.id));
    pages['/field-notes'] = {
      seo: { title: 'Field Notes | Answers for agents, builders and brands | Photografik', description: 'Practical answers about listing photography, video, drone and brand production from the Photografik Studios team.' },
      overlay: true,
      body: `${(() => {
        // James, Sep 25 2026: Field Notes may open with a rights-approved house photograph (exception to the video-opener rule).
        const heroPhoto = allMediaById[fn.heroMedia || 'ph-oceanfront-twilight-pool'];
        return pageHero({
          eyebrow: 'Field Notes',
          title: 'Straight answers <em>from the shoot.</em>',
          lede: 'Questions agents, builders and brands ask us before they book, answered from how we actually plan and produce the work.',
          image: heroPhoto && heroPhoto.rights === 'approved' ? heroPhoto.src : undefined,
          imageAlt: heroPhoto?.alt || '',
        });
      })()}
${join(topicsUsed, (t) => `
<section class="section fn-topic" aria-labelledby="fn-t-${t.id}">
  <div class="wrap">
    <h2 class="h3 fn-topic__h" id="fn-t-${t.id}">${esc(t.label)}</h2>
    <div class="fn-grid">${join(fnVisible.filter((a) => a.topic === t.id), fnCard)}</div>
  </div>
</section>`)}
<section class="section section--tint">
  <div class="wrap cta-band cta-band--light">
    <h2 class="h2">Have a question we have not answered?</h2>
    <p>Ask us directly, or go straight to pricing for your property.</p>
    <div class="actions"><a class="btn btn--solid" href="/contact">Ask a Question</a><a class="link-arrow" href="/real-estate/pricing">Real estate pricing ${arrow}</a></div>
  </div>
</section>`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'Blog', name: 'Field Notes', url: `${site.canonicalOrigin}/field-notes`,
        publisher: { '@type': 'Organization', name: site.name },
      },
    };

    for (const a of fnVisible) {
      const url = `${site.canonicalOrigin}/field-notes/${a.slug}`;
      const heroM = a.hero?.media ? mediaById[a.hero.media] : null;
      const heroSrc = heroM ? (heroM.type === 'video' ? heroM.poster : heroM.src) : site.media.hero;
      const absImg = (p) => { const u = ctx.mediaUrl(p); return u.startsWith('/') ? site.canonicalOrigin + u : u; };
      const toc = a.sections.length >= 4;
      const related = fnVisible.filter((x) => x.slug !== a.slug && x.topic === a.topic).slice(0, 2);
      pages[`/field-notes/${a.slug}`] = {
        seo: { title: a.seo?.title || `${a.title} | Photografik`, description: a.seo?.description || a.summary, image: heroSrc },
        ogType: 'article',
        jsonLd: [
          Object.fromEntries(Object.entries({
            '@context': 'https://schema.org', '@type': 'BlogPosting', headline: a.title, description: a.summary,
            image: [absImg(heroSrc)], author: { '@type': a.author?.name === site.name ? 'Organization' : 'Person', name: a.author?.name || site.name },
            publisher: { '@type': 'Organization', name: site.name, logo: { '@type': 'ImageObject', url: absImg(site.media.logo) } },
            datePublished: a.datePublished || undefined, dateModified: a.dateModified || a.datePublished || undefined,
            mainEntityOfPage: url,
          }).filter(([, v]) => v !== undefined)),
          {
            '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Field Notes', item: `${site.canonicalOrigin}/field-notes` },
              { '@type': 'ListItem', position: 2, name: a.title, item: url },
            ],
          },
        ],
        body: `
<article class="fn-article">
  <header class="section fn-article__head">
    <div class="wrap fn-narrow">
      <nav class="fn-crumbs" aria-label="Breadcrumb"><a href="/field-notes">Field Notes</a> <span aria-hidden="true">/</span> <span>${esc(fnTopic[a.topic] || '')}</span></nav>
      <h1 class="display fn-article__title">${esc(a.title)}</h1>
      <p class="fn-byline">By ${esc(a.author?.name || site.name)}${a.datePublished ? ` · <time datetime="${esc(a.datePublished)}">${esc(fnDate(a.datePublished))}</time>` : ''}${a.dateModified && a.dateModified !== a.datePublished ? ` · Updated <time datetime="${esc(a.dateModified)}">${esc(fnDate(a.dateModified))}</time>` : ''} ${draftTag(a)}</p>
      <p class="fn-answer">${esc(a.answer)}</p>
    </div>
  </header>
  <div class="wrap fn-narrow fn-body">
    ${toc ? `<nav class="fn-toc" aria-label="In this article"><p class="fn-toc__h">In this article</p><ol>${join(a.sections, (s) => `<li><a href="#${sectionId(s.h)}">${esc(s.h)}</a></li>`)}</ol></nav>` : ''}
    ${join(a.sections, (s) => `
    <section class="fn-section" aria-labelledby="${sectionId(s.h)}">
      <h2 class="h3" id="${sectionId(s.h)}">${esc(s.h)}</h2>
      ${join(s.p || [], (t) => `<p>${esc(t)}</p>`)}
      ${s.list ? `<ul class="fn-list">${join(s.list, (t) => `<li>${esc(t)}</li>`)}</ul>` : ''}
      ${s.note ? `<p class="fn-note">${esc(s.note)}</p>` : ''}
      ${s.media ? fnMedia(s.media) : ''}
    </section>`)}
    <aside class="fn-next">
      <p class="eyebrow">Next step</p>
      <p class="fn-next__t">${esc(a.cta?.lead || 'Ready to plan the media for your next listing?')}</p>
      <div class="actions"><a class="btn btn--solid" href="${esc(a.cta?.href || '/contact')}" data-track="field_notes_cta" data-track-location="${esc(a.slug)}">${esc(a.cta?.label || 'Start a Project')}</a>${bookBtn('field_notes', 'Book a Shoot', 'link-arrow')}</div>
    </aside>
    ${related.length ? `<section class="fn-related" aria-labelledby="fn-rel"><h2 class="h3" id="fn-rel">More Field Notes</h2><div class="fn-grid fn-grid--2">${join(related, fnCard)}</div></section>` : ''}
  </div>
</article>`,
      };
    }
  }
  const fnTeaser = (topic) => {
    const list = fnVisible.filter((a) => a.topic === topic).slice(0, 3);
    if (!list.length) return '';
    return `
<section class="section fn-teaser" aria-labelledby="fn-teaser-h">
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Field Notes</p><h2 class="h2 reveal" id="fn-teaser-h">Questions agents ask us.</h2></div><a class="link-arrow" href="/field-notes">All Field Notes ${arrow}</a></div>
    <div class="fn-grid">${join(list, fnCard)}</div>
  </div>
</section>`;
  };

  // ---------- REAL ESTATE ----------
  // Compare what's included: rendered from the same pricing records and tiers as the calculator.
  const recById = Object.fromEntries([...pricing.packages, ...pricing.services].map((r) => [r.id, r]));
  const fixedById = Object.fromEntries(pricing.fixed.map((r) => [r.id, r]));
  const cmpViews = pricing.compare.views.map((v) => ({ ...v, recs: v.records.map((id) => recById[id]).filter(visible) })).filter((v) => v.recs.length);
  const cmpCell = (r, row) => {
    const inc = inclusion(r, row.keys);
    if (inc.state === 'yes') return '<span class="cmp__yes"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>Included</span>';
    if (inc.state === 'note') return `<span class="cmp__yes cmp__note">${esc(inc.note)}</span>`;
    return '<span class="cmp__no">Not included</span>';
  };
  const cmpView = (v, vi) => {
    const defaults = v.defaults || v.records;
    // Keep the table to real differences: rows every option includes become one summary line.
    const common = v.rows.filter((row) => v.recs.every((r) => inclusion(r, row.keys).state === 'yes'));
    const rows = v.rows.filter((row) => row.alwaysShow || !common.includes(row));
    const sameMax = v.recs.every((r) => r.max === v.recs[0].max);
    const noun = v.id === 'packages' ? 'Every package' : 'Every option here';
    return `<div class="cmp__panel" role="tabpanel" id="cmp-panel-${v.id}" aria-labelledby="cmp-tab-${v.id}" ${vi ? 'hidden' : ''} data-view="${v.id}">
      <fieldset class="cmp__pick"><legend>Compare <span class="cmp__limit-note"></span></legend>
        ${join(v.recs, (r) => `<button type="button" class="cmp__chip" data-col="${esc(r.id)}" aria-pressed="${defaults.includes(r.id)}">${esc(r.name)}</button>`)}
      </fieldset>
      ${common.length || sameMax ? `<p class="cmp__common">${noun} ${common.length ? `includes ${esc(common.map((r) => r.label.toLowerCase()).join(' and '))}` : ''}${common.length && sameMax ? ', and is ' : sameMax ? 'is ' : ''}${sameMax ? `priced for homes up to ${v.recs[0].max.toLocaleString('en-US')} sq ft` : ''}.</p>` : ''}
      <table class="cmp__table">
        <caption class="sr-only">${esc(v.label)}: what each option includes</caption>
        <thead><tr><td class="cmp__corner"></td>${join(v.recs, (r) => `<th scope="col" data-col="${esc(r.id)}"><span class="cmp__name">${esc(r.name)}</span>${r.role ? `<span class="cmp__role">${esc(r.role === 'Premium' ? 'Premium anchor' : r.role)}</span>` : ''}</th>`)}</tr></thead>
        <tbody>
          <tr class="cmp__row--suits"><th scope="row">Best for</th>${join(v.recs, (r) => `<td data-col="${esc(r.id)}">${esc(r.suits)}</td>`)}</tr>
          <tr class="cmp__row--price"><th scope="row">Price</th>${join(v.recs, (r) => `<td data-col="${esc(r.id)}"><span class="cmp__price" data-cmp-price="${esc(r.id)}"><span class="cmp__plabel">Starting at</span> <strong>${starting(r)}</strong></span> ${needsApproval(r)}</td>`)}</tr>
          ${join(rows, (row) => `<tr><th scope="row">${esc(row.label)}</th>${join(v.recs, (r) => `<td data-col="${esc(r.id)}">${cmpCell(r, row)}</td>`)}</tr>`)}
          ${sameMax ? '' : `<tr class="cmp__row--size"><th scope="row">Published sizes</th>${join(v.recs, (r) => `<td data-col="${esc(r.id)}">Up to ${r.max.toLocaleString('en-US')} sq ft</td>`)}</tr>`}
        </tbody>
      </table>
      ${(v.addons || []).length ? `<div class="cmp__addons"><p class="cmp__addons-h">Add-ons, priced separately</p><ul>${join(v.addons.map((id) => fixedById[id]).filter(visible), (f) => `<li><span>${esc(f.name)}</span> <strong>${formatUSD(f.amount)}</strong></li>`)}</ul></div>` : ''}
    </div>`;
  };
  const compareSection = () => `
<section class="section cmp" id="compare" aria-labelledby="cmp-h" data-compare>
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Compare what's included</p><h2 class="h2 reveal" id="cmp-h">See the differences side by side.</h2></div>
      <div class="cmp__size">
        <label for="cmp-sqft">Property size <span>(optional)</span></label>
        <div class="cmp__size-row"><input id="cmp-sqft" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 3,200" aria-describedby="cmp-band"><span aria-hidden="true">sq ft</span></div>
        <p class="cmp__band" id="cmp-band" aria-live="polite">Showing starting prices.</p>
      </div>
    </div>
    <div class="cmp__tabs" role="tablist" aria-label="Compare by type">
      ${join(cmpViews, (v, i) => `<button type="button" role="tab" class="tabs__tab" id="cmp-tab-${v.id}" aria-controls="cmp-panel-${v.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(v.label)}</button>`)}
    </div>
    ${join(cmpViews, cmpView)}
    <p class="sr-only" id="cmp-live" aria-live="polite"></p>
    <div class="cmp__cta">
      ${bookBtn('re_compare', 'Book Now', 'btn btn--solid')}
      <a class="link-arrow" id="cmp-pricing" href="/real-estate/pricing">Full price list by size ${arrow}</a>
      <p class="small">You will choose the package and confirm the property size in our booking portal. Travel fees and sales tax are added at checkout where they apply.</p>
    </div>
  </div>
  <script type="application/json" id="cmp-data">${JSON.stringify({ maxSqft: pricing.maxSqft, records: cmpViews.flatMap((v) => v.recs).map((r) => ({ id: r.id, max: r.max, tiers: r.tiers })) }).replace(/</g, '\\u003c')}</script>
</section>`;

  // Real Estate gallery: the same media records as Home and Work, filtered by verified package tag and media type.
  const reItems = editorialOrder(media.filter((m) => m.category === 'real-estate' && (m.type !== 'video' || m.poster)));
  const reCfg = site.galleries?.realEstate || {};
  const reBatch = reCfg.batch || 9;
  const reFacts = reItems.map((m) => facts(m));
  const pkgOptions = pricing.packages.filter(visible);
  const pkgCounts = optionCounts(reFacts, { type: '' }, 'pkg', ['', ...pkgOptions.map((p) => p.id)]);
  // Only offer a package filter for packages with at least one verified example (James, Sep 25: labels stay blank until checked).
  const pkgTagged = pkgOptions.filter((p) => pkgCounts[p.id] > 0);
  const typeCounts = optionCounts(reFacts, { pkg: '' }, 'type', TYPE_FILTERS.map((t) => t.id));
  const reCard = (m, i) => `<article class="gcard gcard--${m.orientation}" data-i="${i}" data-kind="${m.type === 'video' ? 'video' : 'image'}"${i >= reBatch ? ' hidden' : ''}>
      <button type="button" class="gcard__open" aria-label="${m.type === 'video' ? 'Play' : 'View'} ${esc(m.title)}">
        <img src="${esc(galThumb(m))}" alt="${m.type === 'video' ? '' : esc(m.alt || m.title)}" loading="lazy" decoding="async">
        ${m.type === 'video' ? playIcon : ''}
      </button>
    </article>`;
  const reGallery = () => `
<section class="section section--ink on-dark regallery" id="portfolio" aria-labelledby="rg-h" data-regallery data-player="${esc(reCfg.player || 'inline')}" data-batch="${reBatch}"${reviewMode ? ' data-allow-player-override' : ''}>
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Real estate portfolio</p><h2 class="h2 reveal" id="rg-h">Listings, filmed and photographed.</h2></div></div>
    <form class="filters filters--inline" data-rg-filters aria-label="Filter real estate work" onsubmit="return false">
      ${pkgTagged.length ? `<div class="filters__field"><label for="rg-package">Package</label>
        <select id="rg-package" name="package"><option value="">All packages</option>${join(pkgTagged, (p) => `<option value="${p.id}">${esc(p.name)}</option>`)}</select></div>` : ''}
      <div class="filters__field"><label for="rg-type">Media</label>
        <select id="rg-type" name="type">${join(TYPE_FILTERS.filter((t) => !t.id || typeCounts[t.id] > 0), (t) => `<option value="${t.id}">${esc(t.label)}</option>`)}</select></div>
      <button type="reset" class="filters__clear" hidden>Reset filters</button>
    </form>
    <p class="filters__count sr-only" id="rg-count" aria-live="polite">${reItems.length} results</p>
    <div class="regallery__grid" id="rg-grid">${join(reItems, reCard)}</div>
    <div class="empty" id="rg-empty" hidden>
      <p class="h3" id="rg-empty-title">No confirmed examples for this package yet.</p>
      <p>We only show a package example once we have checked what was delivered. See all real estate work in the meantime, or ask us for examples when you book.</p>
      <p><button type="button" class="btn btn--gold" data-rg-show-all>Show all real estate work</button></p>
    </div>
    <div class="regallery__more"><button type="button" class="btn btn--light" id="rg-more" hidden>Load more</button></div>
  </div>
  ${lightboxDialog()}
  ${itemsJson(reItems)}
</section>`;

  // James, Sep 28 2026: a more image-led Real Estate page. Each service block leads with an authentic frame from our
  // own work (a film's poster for film; the agent-on-camera clip's frame for "You, on camera"); floor plans get a
  // schematic drawing because no plan image is committed yet.
  const reFeatureFig = (id, key) => {
    if (key === 'floor-plan') return `<figure class="feature__img feature__img--plan" aria-hidden="true"><svg viewBox="0 0 300 200" role="presentation"><g fill="none" stroke="currentColor" stroke-width="3"><rect x="20" y="20" width="260" height="160"/><path d="M130 20v70h-40M20 110h70v70M130 130v50M190 20v90h90M190 150v30M130 90h20"/></g><g font-family="Space Mono, monospace" font-size="9" fill="currentColor" letter-spacing="1"><text x="36" y="58">LIVING</text><text x="36" y="148">KITCHEN</text><text x="206" y="62">PRIMARY</text><text x="150" y="160">DINING</text></g></svg></figure>`;
    const m = allMediaById[id];
    const src = m ? (m.type === 'video' ? m.poster : m.src) : (id === 'agent-expertise-hero' ? '/v/agent-expertise-hero.webp' : '');
    if (!src) return '';
    const alt = m ? (m.type === 'video' ? `Frame from the ${m.title.toLowerCase()}` : (m.alt || m.title)) : 'Agent speaking to camera, a frame from an Agent Engine clip';
    return `<figure class="feature__img">${img(src, { alt, thumb: m?.thumb, sizes: '(min-width: 900px) 30vw, (min-width: 600px) 45vw, 100vw' })}</figure>`;
  };
  pages['/real-estate'] = {
    overlay: true,
    scripts: ['compare.js', 're-gallery.js'],
    body: `${pageHero({
      eyebrow: 'Real estate media',
      title: 'Listing media that shows sellers <em>how you work.</em>',
      lede: 'Photography, cinematic video, vertical reels, drone and floor plans for Long Island, the Hamptons and the North Fork. The property sets the production plan. Your standard stays the same at every price point.',
      cta: `${bookBtn('re_hero')}<a class="link-arrow" href="/real-estate/pricing">See pricing ${arrow}</a>`,
      video: { loop: 're-hamptons-calm', film: 're-hamptons-calm' },
    })}
<section class="section re-coverage">
  <div class="wrap">
    <div class="re-coverage__head">
      <div>
        <p class="eyebrow">What goes into a listing campaign</p>
        <h2 class="h2 reveal">Enough coverage to tell the whole story. No padding.</h2>
        <p class="re-coverage__lede">Stills, film, aerials and plans, planned together so every format shows the same home at its best.</p>
      </div>
      <div class="re-coverage__film">${ambient('re-hamptons-beachfront', { label: 'Beachfront estate film, muted excerpt' })}</div>
    </div>
    <div class="features features--media">
      ${join([
        ['photography', 'ph-hamptons-kitchen', 'Photography', 'A complete stills set, from room flow and material detail to the exterior setting. Vertical social-ready frames are included where they suit the property.'],
        ['video', 're-hamptons-standout', 'Horizontal and vertical film', 'Horizontal film plays on the listing page, YouTube and in your presentations. Vertical reels are made for Instagram, TikTok and Reels. We plan and shoot each format on purpose rather than cropping one into the other.'],
        ['drone', 'ph-hampton-aerial-pool-beach', 'Drone', 'Aerials show what a ground photo cannot: the water, the land, the neighborhood and how the home sits in it.'],
        ['floor-plan', '', 'Floor plans', 'A schematic floor plan lets buyers understand the layout before they visit, so the people who book showings arrive better prepared.'],
        ['twilight', 'ph-oceanfront-twilight-pool', 'Twilight and day-to-night', 'For launches that deserve it, twilight stills and day-to-night film carry the presentation into the evening.'],
        ['agent', 'agent-expertise-hero', 'You, on camera', 'Optional. Listing Engine puts you on camera presenting the listing through its sale; Agent Engine turns the same shoot day into content about you. We coach you if the camera is not your favorite place.'],
      ], ([id, mid, h, t]) => `<div class="feature reveal" id="${id}">${reFeatureFig(mid, id)}<h3 class="h3">${h}</h3><p>${t}</p></div>`)}
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Packages</p><h2 class="h2 reveal">Start with the right package.</h2></div><div class="section-head__links"><a class="link-arrow" href="#compare">Compare what's included ${arrow}</a><a class="link-arrow" href="/real-estate/pricing">Pricing by property size ${arrow}</a></div></div>
    <div class="ladder ladder--4">
      ${join(pricing.packages.filter(visible), (p) => `
      <div class="ladder__item ${pkgFeatured(p) ? 'ladder__item--featured' : ''}">
        ${pkgTag(p) ? `<p class="tag">${esc(pkgTag(p))}</p>` : ''}
        <h3 class="h3">${esc(p.name)}</h3>
        <p class="small">${esc(p.for)}</p>
        <p class="price-line">Starting at <strong>${starting(p)}</strong> ${needsApproval(p)}</p>
      </div>`)}
    </div>
  </div>
</section>

${compareSection()}

${reGallery()}

${threeSteps()}

<section class="section section--tint">
  <div class="wrap narrow">
    <p class="eyebrow" id="faq">Good to know</p>
    <h2 class="h2 reveal">Booking, preparation and usage.</h2>
    ${faqBlock(faqs['real-estate'])}
  </div>
</section>
${fnTeaser('real-estate-media')}

<section class="section section--brand on-dark">
  <div class="wrap cta-band">
    <h2 class="h2 reveal">Have a listing coming up?</h2>
    <p>Choose your package, pick a time and confirm details in our booking portal.</p>
    ${bookBtn('re_final', 'Book a Shoot', 'btn btn--rust')}
  </div>
</section>`,
  };

  // ---------- PRICING ----------
  const priceCell = (rec) => {
    const s = resolvePrice(rec, null);
    return `<p class="pcard__price" data-price-for="${esc(rec.id)}"><span class="pcard__label">Starting at</span> <span class="pcard__amount">${formatUSD(s.amount)}</span></p>
      <p class="pcard__hint" data-hint-for="${esc(rec.id)}">Enter square footage for your price.</p>`;
  };
  // James, Sep 28 2026: each package card plays its own muted 25 s loop in place (like the Home tiles), chosen to match
  // what the package includes. Listing Starter has no film, so its card cycles through the kinds of stills it delivers.
  const pkgLoops = {
    'luxury-media': { id: 're-hampton-luxury-home', label: 'Luxury Media example: aerial, exterior and interiors from a Hamptons listing film' },
    'signature': { id: 're-hamptons-upbeat', label: 'Signature example: day and twilight exteriors and a dusk aerial from a Hamptons listing film' },
    'social-media': { id: 're-east-end-listing-reel', label: 'Social Media example: an East End vertical listing reel' },
  };
  const starterStills = ['ph-hampton-exterior', 'ph-hamptons-kitchen', 'ph-hampton-aerial-pool-beach', 'ph-hamptons-bedroom-beach'].map((id) => allMediaById[id]).filter(Boolean);
  const pkgMediaHtml = (p) => {
    const l = pkgLoops[p.id];
    if (l) return `<div class="pcard__loop">${ambient(l.id, { label: `${l.label} (muted)` })}</div>`;
    if (p.id === 'listing-starter' && starterStills.length) return `<div class="pcard__seq" role="group" aria-label="Listing Starter examples: interior, exterior and aerial photographs">${join(starterStills, (m, i) => `<div class="pcard__seq-item" style="--i:${i};--n:${starterStills.length}">${img(m.src, { alt: m.alt || m.title, thumb: m.thumb, sizes: '(min-width: 1180px) 22vw, (min-width: 680px) 45vw, 100vw' })}</div>`)}</div>`;
    return '';
  };
  const packageCard = (p) => `<article class="pcard ${pkgFeatured(p) ? 'pcard--featured' : ''}" data-record="${esc(p.id)}" aria-labelledby="pk-${esc(p.id)}">
      <div class="pcard__media">${pkgMediaHtml(p)}${pkgTag(p) ? `<span class="pcard__badge${pkgFeatured(p) ? ' pcard__badge--popular' : ''}">${esc(pkgTag(p))}</span>` : ''}</div>
      <div class="pcard__body">
        <h3 class="h3" id="pk-${esc(p.id)}">${esc(p.name)} ${needsApproval(p)}</h3>
        <p class="pcard__for">${esc(p.for)}</p>
        ${priceCell(p)}
        <ul class="checks">${join(includeLabels(p, pricing.features), (i) => `<li>${esc(i)}</li>`)}</ul>
        <a class="btn ${pkgFeatured(p) ? 'btn--solid' : 'btn--outline'} pcard__cta" href="${booking}" data-track="book_click" data-track-location="pricing_card" data-track-package="${esc(p.id)}">Book ${esc(p.name)}</a>
      </div>
    </article>`;
  const serviceRow = (s) => `<li class="prow" data-record="${esc(s.id)}">
      <div class="prow__text"><h3 class="prow__name">${esc(s.name)} ${needsApproval(s)}</h3>${s.detail ? `<p class="prow__detail">${esc(s.detail)}</p>` : ''}</div>
      <div class="prow__price">${priceCell(s)}</div>
    </li>`;
  const fixedRow = (f, label = 'Fixed price') => `<li class="prow prow--fixed" data-fixed="${esc(f.id)}">
      <div class="prow__text"><h3 class="prow__name">${esc(f.name)} ${needsApproval(f)}</h3>${f.detail ? `<p class="prow__detail">${esc(f.detail)}</p>` : ''}</div>
      <div class="prow__price"><p class="pcard__price"><span class="pcard__label">${f.standalone ? 'Added to a shoot' : label}</span> <span class="pcard__amount">${formatUSD(f.amount)}</span></p><p class="pcard__hint">${f.standalone ? `${formatUSD(f.standalone)} on its own.` : 'Not affected by square footage.'}</p></div>
    </li>`;
  const svc = (g) => pricing.services.filter((s) => s.group === g).filter(visible);
  const fixedG = (g) => pricing.fixed.filter((s) => s.group === g).filter(visible);
  const pricingData = {
    maxSqft: pricing.maxSqft,
    records: [...pricing.packages, ...pricing.services].filter(visible).map((r) => ({ id: r.id, name: r.name, max: r.max, tiers: r.tiers })),
  };
  const tabs = [
    { id: 'packages', label: 'Packages', html: `<div class="pcards">${join(pricing.packages.filter(visible), packageCard)}</div>
        <p class="pcards__motion">${motionToggle.replace('class="motion-toggle"', 'class="motion-toggle motion-toggle--inline"')}</p>` },
    { id: 'photo', label: 'Photo', html: `<ul class="prows">${join(svc('photography'), serviceRow)}</ul>` },
    { id: 'video', label: 'Video', html: `<ul class="prows">${join(svc('video'), serviceRow)}${join(fixedG('video'), (f) => fixedRow(f))}</ul>
        <div class="explain"><h3 class="h3">Horizontal or vertical?</h3><p>Horizontal film is for the listing page, YouTube, email and presentations. Vertical reels are for Instagram, TikTok and Reels. Choose one, or both from the same shoot.</p></div>` },
    { id: 'addons', label: 'Add-ons', html: `<ul class="prows">${join(fixedG('addons'), (f) => fixedRow(f))}</ul>
        <h3 class="h3 prows-head">Content add-ons</h3>
        <ul class="prows">${join(fixedG('engines'), (f) => fixedRow(f))}</ul>
        <div class="explain"><p>Listing Engine and Agent Engine are captured on the same shoot day. <a href="/agent-content">How the engines work ${arrow}</a></p></div>` },
  ];
  pages['/real-estate/pricing'] = {
    overlay: true,
    scripts: ['pricing.js'],
    body: `
<section class="page-hero page-hero--compact on-dark">
  <div class="wrap page-hero__inner">
    <p class="eyebrow">Real estate media pricing</p>
    <h1 class="display">Pricing for your property.</h1>
    <p class="lede">Enter the home's size, up to ${pricing.maxSqft.toLocaleString('en-US')} sq ft, and every package and service below updates using the size tiers in our booking portal. Your final price is confirmed there at checkout.</p>
  </div>
</section>
<section class="section section--pricing">
  <div class="wrap">
    <div class="sizer" id="sizer">
      <label class="sizer__label" for="sqft">Property size <span>(square feet)</span></label>
      <p class="sizer__help" id="sqft-help">Interior living area, as listed. For example 3,200.</p>
      <div class="sizer__row">
        <input id="sqft" name="sqft" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 3,200" aria-describedby="sqft-help sqft-error sqft-band">
        <span class="sizer__unit" aria-hidden="true">sq ft</span>
        <button type="button" class="sizer__clear" hidden>Clear</button>
      </div>
      <p class="sizer__error" id="sqft-error" role="alert" hidden></p>
      <p class="sizer__band" id="sqft-band">Showing starting prices. Enter a size to see yours.</p>
      <p class="sizer__compare"><a class="link-arrow" id="to-compare" href="/real-estate#compare" data-track="compare_nav" data-track-location="pricing_sizer">Compare what's included ${arrow}</a></p>
    </div>
    <p class="sr-only" id="price-live" aria-live="polite" aria-atomic="true"></p>

    <h2 class="sr-only">Packages, services and add-ons</h2>
    <div class="tabs" data-tabs>
      <div class="tabs__list" role="tablist" aria-label="Price categories">
        ${join(tabs, (t, i) => `<button type="button" role="tab" class="tabs__tab" id="tab-${t.id}" aria-controls="panel-${t.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t.label}</button>`)}
      </div>
      ${join(tabs, (t, i) => `<div class="tabs__panel" role="tabpanel" id="panel-${t.id}" aria-labelledby="tab-${t.id}" tabindex="0" ${i === 0 ? '' : 'hidden'}>${t.html}</div>`)}
    </div>

    <div class="pricing-notes">
      <p><strong>About these prices.</strong> These are calculated from the size tiers in our booking portal, HD Photo Hub, and are confirmed there at checkout. ${needsApproval({ approval: pricing.releaseApproved ? 'approved' : 'pending' }, 'Size bands mirror HD Photo Hub as confirmed by James on Sep 25; a full price and inclusion comparison is still required before launch')} They are base prices, not an all-in total: travel fees and sales tax are added at checkout where they apply. Rental use, commercial property and non-standard licensing are quoted separately.</p>
      <p>Homes over ${pricing.maxSqft.toLocaleString('en-US')} square feet: <a href="/contact?type=real-estate-large">request a custom quote</a>.</p>
      <p>You will confirm property size, package and date in our booking portal, HD Photo Hub. ${bookBtn('pricing_notes', 'Go to booking', 'link-arrow')}</p>
    </div>
  </div>
</section>
<script type="application/json" id="pricing-data">${JSON.stringify(pricingData).replace(/</g, '\\u003c')}</script>`,
  };

  // ---------- AGENT CONTENT ----------
  const agentMonthly = offers.agentMonthly.filter(visible);
  const engines = pricing.fixed.filter((f) => f.group === 'engines').filter(visible);
  const agentVids = media.filter((m) => m.category === 'agent-content' && m.type === 'video');
  pages['/agent-content'] = {
    overlay: true,
    body: `${pageHero({
      eyebrow: 'Agent content',
      title: 'People hire agents they <em>already feel they know.</em>',
      lede: 'On-camera video that helps future sellers understand who you are and how you work before the first conversation. We handle the ideas, direction and editing. You bring what you know.',
      cta: `<a class="btn btn--solid" href="/contact?type=agent-content" data-track="retainer_click" data-track-location="agent_hero">Plan My Content</a>`,
      // James, Sep 28 2026: open with a relevant horizontal film. The on-camera expertise clip, muted and framed 16:9.
      video: { loop: 'agent-expertise-hero', credit: 'agent-expertise' },
    })}
<section class="section ac-split" id="portfolio" aria-labelledby="ac-q-h">
  <div class="wrap ac-split__grid">
    <div class="ac-split__examples" aria-label="Agent content examples">
      <p class="eyebrow">Examples</p>
      <div class="ac-examples">${join(agentVids, (m) => `<div class="ac-example">${videoPlayer(m, { sizes: '(min-width: 900px) 18vw, 45vw' })}</div>`)}</div>
    </div>
    <div class="ac-split__qa">
      <p class="eyebrow">Fair questions</p>
      <h2 class="h2 reveal" id="ac-q-h">What agents usually ask us.</h2>
      <div class="qa qa--stack">
        <div><h3 class="h3">“I hate being on camera.”</h3><p>Most people do at first. We coach delivery, help you find a natural opening line and keep takes short. A lot of the confidence comes from knowing exactly what you want to say.</p></div>
        <div><h3 class="h3">“I don't know what to say.”</h3><p>That part is on us. We bring structured ideas built around your market, your town and your process, and we write with you so it still sounds like you.</p></div>
        <div><h3 class="h3">“I can film this on my phone.”</h3><p>You can, and sometimes you should. What we add is the plan, the coaching, the quality and the consistency that make people remember you.</p></div>
      </div>
    </div>
  </div>
</section>
<section class="section section--tint">
  <div class="wrap">
    <p class="eyebrow">Listing Engine & Agent Engine</p>
    <h2 class="h2 reveal">Turn one shoot day into weeks of content.</h2>
    <div class="compare">
      <div class="compare__col"><h3 class="h3">Listing Engine</h3><p>Videos about the listing itself and where it is in the sale, such as Just Listed, Under Contract and Just Sold. A cinematic agent-on-camera social video in which you present the property, plus three to four short videos on the home, its location and the lifestyle around it. Captured alongside the listing media.</p>${(() => { const e = engines.find((x) => x.id === 'listing-engine'); return e ? `<p class="price-line"><strong>${formatUSD(e.amount)}</strong> with a listing shoot, ${formatUSD(e.standalone)} on its own ${needsApproval(e)}</p>` : ''; })()}</div>
      <div class="compare__col"><h3 class="h3">Agent Engine</h3><p>Three to four videos about you, with the listing as a premium backdrop: the market, your town, your background, your process and what you do differently.</p>${(() => { const e = engines.find((x) => x.id === 'agent-engine'); return e ? `<p class="price-line"><strong>${formatUSD(e.amount)}</strong> with a listing shoot, ${formatUSD(e.standalone)} on its own ${needsApproval(e)}</p>` : ''; })()}</div>
    </div>
    ${(() => { const e = engines.find((x) => x.id === 'full-engine'); return e ? `<p class="aside-line">Both together as the Full Engine: <strong>${formatUSD(e.amount)}</strong> with a listing shoot, ${formatUSD(e.standalone)} on its own ${needsApproval(e)}</p>` : ''; })()}
  </div>
</section>
${agentMonthly.length ? `<section class="section section--tint">
  <div class="wrap">
    <p class="eyebrow">Monthly content plans</p>
    <h2 class="h2 reveal">Stay visible between listings.</h2>
    <p class="section-lede">Sellers choose agents they recognize and trust. Regular video lets them see your point of view and how you work before they ever call. A monthly plan gives you a steady supply of social content built around your goals, so you are not starting from a blank page each week.</p>
    <div class="plans">${join(agentMonthly, (o) => `<div class="plan reveal"><h3 class="h3">${esc(o.name)} ${needsApproval(o)}</h3><p class="plan__tag">${esc(o.tagline)}</p>
      <p class="plan__price">${approvedPrice(o, `<strong>${formatUSD(o.monthly)}</strong>/month`)}</p>${isApproved(o) ? `<p class="plan__alt">${formatUSD(o.contract)}/month on a 12-month contract, billed monthly</p>` : ''}
      <ul class="checks">${join(o.scope, (s) => `<li>${esc(s)}</li>`)}</ul></div>`)}</div>
    ${visible(offers.socialManagementFrom) ? `<p class="aside-line">Social media management is available${isApproved(offers.socialManagementFrom) ? ` from ${formatUSD(offers.socialManagementFrom.amount)}/month` : ' as a monthly add-on'}. ${needsApproval(offers.socialManagementFrom)}</p>` : ''}
  </div>
</section>` : ''}
<section class="section section--brand on-dark">
  <div class="wrap cta-band">
    <h2 class="h2 reveal">Let's plan what you will say.</h2>
    <p>Tell us about your market and goals. We will suggest a starting point.</p>
    <a class="btn btn--gold" href="/contact?type=agent-content" data-track="retainer_click" data-track-location="agent_final">Plan My Content</a>
  </div>
</section>`,
  };

  // ---------- ARCHITECTURE & DESIGN ----------
  // Shared by the Architecture & design and Commercial landing grids.
  const deliveredOf = (items) => {
    const n = (t) => items.filter(t).length;
    const films = n((m) => m.type === 'video'); const photos = n((m) => m.type === 'image' && !m.service.includes('drone')); const drone = n((m) => m.service.includes('drone'));
    // James, Sep 28 2026: say what was delivered, without item counts.
    return [films ? 'Film' : '', photos ? 'Photography' : '', drone ? 'Drone photography' : ''].filter(Boolean);
  };
  // James, Sep 28 2026: a project can list exactly what was delivered (owner's words); otherwise it is derived from the media.
  const filmDelivered = (p, list) => (p.delivered?.length ? p.delivered : p.silentLoop && !list.includes('Film') ? ['Film', ...list] : list);
  const repOf = (items) => [...items].sort((x, y) => ((y.type === 'video' && y.orientation === 'horizontal') - (x.type === 'video' && x.orientation === 'horizontal')) || ((y.sortPriority || 0) - (x.sortPriority || 0)))[0];
  // James, Sep 28 2026: a project's approved silent film (audio stream physically removed) plays as a muted,
  // labelled loop beside its still, with an inline pause control. Only the silent export is ever referenced.
  const silentLoopLabel = { 'revivaluxe-silent': 'RevivaLuxe brand film, no sound: a provider with a client, a skin treatment and the clinic interior' };
  const silentLoop = (id) => `<div class="silent-loop">${ambient(id, { cls: 'silent-loop__video', label: silentLoopLabel[id] || 'Silent film excerpt' })}${motionToggle}</div>`;
  const withLoop = (p, still) => (p.silentLoop ? `<div class="media-pair">${still}${silentLoop(p.silentLoop)}</div>` : still);
  const repFrame = (m, sizes) => (m.type === 'video' ? videoPlayer(m, { sizes }) : `<div class="still still--${m.orientation}">${img(m.src, { alt: m.alt || m.title, thumb: m.thumb, sizes })}</div>`);
  const archMedia = media.filter((m) => m.category === 'architecture-design');
  const archById = Object.fromEntries(archMedia.map((m) => [m.id, m]));
  // James, Sep 27 2026: explanation and evidence sit together. Each supporting image is used once on this page;
  // captions name the client project (James, Sep 27 2026: no street addresses anywhere), never an address.
  const archPairIds = { intro: 'ph-peterson-dining', photo: 'ph-yankee-barn-great-room', detail: 'peterson-detail' };
  const archUsed = new Set(Object.values(archPairIds));
  const archFig = (id, { sizes = '(min-width: 900px) 40vw, 100vw', cls = '' } = {}) => {
    const m = archById[id]; if (!m) return '';
    const pr = m.project ? projectBySlug[m.project] : null;
    const cap = pr && visible(pr)
      ? `${esc(m.alt || m.title)}. <a href="${projectPath(pr)}" data-track="project_click" data-track-location="arch_pair">${esc(pr.client || pr.title)}${pr.location ? `, ${esc(pr.location)}` : ''}</a>`
      : `${esc(m.title)}${m.location && !m.title.includes(m.location) ? `, ${esc(m.location)}` : ''}`;
    return `<figure class="pair-fig ${cls}" data-media="${esc(m.id)}"><div class="still still--${m.orientation}">${img(m.src, { alt: m.alt || m.title, thumb: m.thumb, sizes })}</div><figcaption>${cap}</figcaption></figure>`;
  };
  // Gallery (Home Selected Work style, same work.json collection): ONE item per project (its lead asset; the rest stay
  // on the project page) plus approved work without a verified project. Segments come from the project, never a house name.
  const archProjects = work.projects.filter((p) => p.category === 'architecture-design' && visible(p))
    .map((p) => ({ p, rep: repOf(archMedia.filter((m) => m.project === p.slug)) })).filter((x) => x.rep);
  // A project with both a film and photos gets a film-led card (All + Video) and a still-led card (Photo only), so each
  // filtered view shows the project once, with the same project-page destination (Codex review of 8184566).
  const archEntries = [];
  for (const x of archProjects) {
    const pm = archMedia.filter((m) => m.project === x.p.slug && !archUsed.has(m.id) && (m.type !== 'video' || m.poster));
    const lead = pm.includes(x.rep) ? x.rep : repOf(pm);
    if (!lead) continue;
    const still = lead.type === 'video' ? [...pm.filter((m) => m.type === 'image')].sort((u, v) => (v.orientation === 'horizontal') - (u.orientation === 'horizontal') || (v.sortPriority || 0) - (u.sortPriority || 0))[0] : null;
    archEntries.push({ m: lead, views: still ? ['', 'video'] : null });
    if (still) archEntries.push({ m: still, views: ['photo'] });
  }
  for (const m of editorialOrder(archMedia.filter((m) => !m.project || !projectBySlug[m.project] || !visible(projectBySlug[m.project]))).sort((x, y) => (y.type === 'video') - (x.type === 'video'))) {
    if (!archUsed.has(m.id) && (m.type !== 'video' || m.poster)) archEntries.push({ m, views: null });
  }
  const archGallery = archEntries.map((e) => e.m);
  const archFacts = archEntries.map((e) => facts(e.m, segmentsOf(e.m, projectBySlug), e.views || undefined));
  const segOptions = (work.taxonomy.segment || []);
  const segCounts = optionCounts(archFacts, { type: '' }, 'seg', ['', ...segOptions.map((x) => x.id)]);
  const segLive = segOptions.filter((x) => segCounts[x.id] > 0);
  const archTypes = TYPE_FILTERS.filter((t) => t.id !== 'drone');
  const archTypeCounts = optionCounts(archFacts, { seg: '' }, 'type', archTypes.map((t) => t.id));
  const archVideo = archGallery.find((m) => m.type === 'video');
  const archCard = (m, i, views) => {
    const pr = m.project && projectBySlug[m.project] && visible(projectBySlug[m.project]) ? projectBySlug[m.project] : null;
    const kind = m.type === 'video' ? 'video' : 'image';
    // Photo-only variants start hidden so no project appears twice before the script runs.
    return `<article class="gcard gcard--${m.orientation}" data-i="${i}" data-kind="${kind}" data-media="${esc(m.id)}"${pr ? ` data-project="${esc(pr.slug)}"` : ''}${views ? ` data-views="${esc(views.join(' '))}"` : ''}${views && !views.includes('') ? ' hidden' : ''}>
      <button type="button" class="gcard__open" aria-label="${kind === 'video' ? 'Play' : 'View'} ${esc(pr ? (pr.client || pr.title) : m.title)}">
        <img src="${esc(galThumb(m))}" alt="${kind === 'video' ? '' : esc(m.alt || m.title)}" loading="lazy" decoding="async">
        ${kind === 'video' ? playIcon : ''}
      </button>
    </article>`;
  };
  pages['/architecture-design'] = {
    overlay: true,
    scripts: ['re-gallery.js'],
    body: `${pageHero({
      eyebrow: 'Architecture & design',
      title: 'Your work, presented with <em>the care it was built with.</em>',
      lede: 'Project photography and film for builders, architects, interior designers and specialty trades. We plan coverage around how the work will be used, then define deliverables and licensing before the shoot.',
      cta: `<a class="btn btn--solid" href="/contact?type=architecture-design" data-track="project_click" data-track-location="arch_hero">Start a Project</a>`,
      video: { loop: 'arch-yankee-barn-film', film: 'arch-yankee-barn-film' },
    })}
<section class="section arch-intro" id="approach" aria-labelledby="arch-intro-h">
  <div class="wrap pair">
    <div class="pair__text">
      <p class="eyebrow">Who this is for</p>
      <h2 class="h2 reveal" id="arch-intro-h">Your next client is judging more than <em>the finished room.</em></h2>
      <p class="lede">Before they call, the people you want to work with are trying to understand your point of view, your craft and what it will be like to work with you. We start with who you want to win next and where the media will be used, then recommend the coverage that helps them see it.</p>
    </div>
    ${archFig(archPairIds.intro, { cls: 'pair__media' })}
  </div>
  <div class="wrap">
    <ul class="audiences" role="list">
      <li class="reveal"><h3 class="h4">Architects</h3><p>Your clients are choosing a way of thinking. Show the idea, the proportion and how the building meets its site and its light.</p></li>
      <li class="reveal"><h3 class="h4">Custom builders</h3><p>Your clients are choosing who they trust with the build. Show the craftsmanship, the details that took care and a site that is run well.</p></li>
      <li class="reveal"><h3 class="h4">Interior designers</h3><p>Your clients are choosing a sensibility. Show materials, texture and how each room is meant to be lived in.</p></li>
      <li class="reveal"><h3 class="h4">Specialty trades</h3><p>Your clients, and the architects and builders who refer you, want proof of skill. Show the work up close and the finish it adds to the whole project.</p></li>
    </ul>
  </div>
</section>

<section class="section section--tint" id="which-story" aria-labelledby="arch-story-h">
  <div class="wrap">
    <p class="eyebrow">Which story should we tell?</p>
    <h2 class="h2 reveal" id="arch-story-h">Pick the story that wins <em>the next project.</em></h2>
    <div class="story-guide">
      <div class="story-guide__item reveal">${archFig(archPairIds.photo, { sizes: '(min-width: 1000px) 30vw, 100vw', cls: 'story-guide__fig' })}<p class="story-guide__n">Project photography</p><h3 class="h4">When the finished work has to speak for itself.</h3><p>Your portfolio, website, proposals and award or press submissions. Complete coverage of the spaces plus the details that show quality. For most finished projects, this is the place to start.</p></div>
      <div class="story-guide__item reveal">${archVideo ? `<a class="story-guide__film" href="?type=video#portfolio" data-track="gallery_filter" data-track-location="arch_story_film"><span class="still still--horizontal"><img src="${esc(galThumb(archVideo))}" alt="" loading="lazy" decoding="async">${playIcon}</span><span class="story-guide__filmcap">Watch the ${esc(archVideo.project && projectBySlug[archVideo.project] ? projectBySlug[archVideo.project].title : archVideo.title.split(':')[0])} film below</span></a>` : ''}<p class="story-guide__n">Project film</p><h3 class="h4">When how it feels matters as much as how it looks.</h3><p>Movement through the spaces, the light as it changes, and the craft or process behind them. A strong fit for signature projects and for social channels where people watch rather than scroll past.</p></div>
      <div class="story-guide__item reveal">${(() => { const m = allMediaById['cs-jm2-architecture']; return m?.poster ? `<figure class="story-guide__fig story-guide__fig--person"><span class="still still--horizontal">${img(m.poster, { alt: 'A JM2 Architecture founder speaking on camera, from a podcast clip', sizes: '(min-width: 1000px) 30vw, 100vw' })}</span></figure>` : ''; })()}<p class="story-guide__n">Brand story and interviews</p><h3 class="h4">When clients hire you as much as the work.</h3><p>Your philosophy, how you work with clients and why you do it, told by you on camera. Worth it when the relationship is what wins the job. It is not automatic for every project.</p></div>
    </div>
    <p class="story-guide__note">Not sure? Start with project proof. If a brand story makes sense later, we can build on the same coverage. When they are part of the agreed scope, one planned shoot can serve your website, proposals, social channels and submissions.</p>
  </div>
</section>

<section class="section section--ink on-dark regallery regallery--arch" id="portfolio" aria-labelledby="ag-h" data-regallery data-where="architecture" data-player="inline" data-batch="8" data-batch-phone="6">
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Selected work</p><h2 class="h2 reveal" id="ag-h">Recent projects, <em>by discipline.</em></h2></div></div>
    <form class="filters filters--inline" data-rg-filters aria-label="Filter architecture and design work" onsubmit="return false">
      ${segLive.length ? `<div class="filters__field"><label for="ag-segment">Work for</label>
        <select id="ag-segment" name="segment"><option value="">All work</option>${join(segLive, (x) => `<option value="${x.id}">${esc(x.label)}</option>`)}</select></div>` : ''}
      <div class="filters__field"><label for="ag-type">Media</label>
        <select id="ag-type" name="type">${join(archTypes.filter((t) => !t.id || archTypeCounts[t.id] > 0), (t) => `<option value="${t.id}">${esc(t.label)}</option>`)}</select></div>
      <button type="reset" class="filters__clear" hidden>Reset filters</button>
    </form>
    <p class="filters__count sr-only" id="ag-count" aria-live="polite">${archFacts.filter((f) => !f.views || f.views.includes('')).length} results</p>
    <p class="regallery__note">Explore project photography and film. Choose a discipline or media type.</p>
    <div class="regallery__grid" id="ag-grid">${join(archEntries, (e, i) => archCard(e.m, i, e.views))}</div>
    <div class="empty" id="ag-empty" hidden>
      <p class="h3" id="ag-empty-title">Nothing matches this filter yet.</p>
      <p>Try another discipline or media type, or ask us for examples like your project.</p>
      <p><button type="button" class="btn btn--gold" data-rg-show-all>Show all work</button></p>
    </div>
    <div class="regallery__more"><button type="button" class="btn btn--light" id="ag-more" hidden>Load more</button></div>
    <nav class="gallery-projects" aria-label="Architecture and design projects"><span class="gallery-projects__label">Projects</span>${join(archProjects.map((x) => x.p), (p) => `<a href="${projectPath(p)}" data-track="project_click" data-track-location="arch_gallery">${esc(p.client || p.title)}</a>`)}</nav>
  </div>
  ${lightboxDialog()}
  <script type="application/json" data-gallery-items>${JSON.stringify(archEntries.map((e, i) => ({ ...galleryItem(e.m), ...archFacts[i] }))).replace(/</g, '\\u003c')}</script>
</section>

<section class="section" id="why" aria-labelledby="arch-why-h">
  <div class="wrap pair pair--flip">
    <div class="pair__text">
      <p class="eyebrow">How we help</p>
      <h2 class="h2 reveal" id="arch-why-h">Future clients see your thinking, your craft <em>and what it is like to work with you.</em></h2>
      <ul class="why-list" role="list">
        <li><h3 class="h4">Marketing judgment before production</h3><p>We plan around the clients you want and where the media will be used, so the coverage does a job.</p></li>
        <li><h3 class="h4">Timed for light</h3><p>Where the scope includes them, exteriors, interiors and twilight are scheduled for the light that suits each space.</p></li>
        <li><h3 class="h4">Materials and details</h3><p>The joinery, finishes and hardware your clients paid for get the attention they deserve.</p></li>
        <li><h3 class="h4">Coordinated with the project team</h3><p>We plan timing and access with homeowners, design teams and builders, and adjust for weather.</p></li>
        <li><h3 class="h4">Deliverables and licensing in writing</h3><p>What you receive, and who can use it where and for how long, is agreed before production.</p></li>
      </ul>
      <p class="small muted">Every architecture and design project is quoted to its scope. Coverage, deliverables, usage and licensing are set out in a written estimate.</p>
    </div>
    ${archFig(archPairIds.detail, { cls: 'pair__media pair__media--sticky' })}
  </div>
</section>

<section class="section section--ink on-dark" id="how-it-works" aria-labelledby="arch-path-h">
  <div class="wrap">
    <div class="split">
      <div class="split__label"><p class="eyebrow">How it works</p></div>
      <div><h2 class="h2 reveal" id="arch-path-h">Three steps from finished project <em>to the work you want next.</em></h2></div>
    </div>
    <ol class="steps">
      <li class="reveal">${mediaFig('ph-yankee-barn-exterior')}<span class="steps__n">01 / Tell us</span><h3>Share the project.</h3><p>The project, the location, your timing and the clients you want to reach.</p></li>
      <li class="reveal">${mediaFig('ph-peterson-game-room')}<span class="steps__n">02 / Plan</span><h3>Get a recommendation.</h3><p>We suggest the story and coverage, then send a plan and a written estimate with deliverables and licensing.</p></li>
      <li class="reveal">${mediaFig('ph-kerry-delrose-pool')}<span class="steps__n">03 / Produce</span><h3>We shoot and deliver.</h3><p>Photography and film on site, one agreed review round, then files in the formats each use needs.</p></li>
    </ol>
    <p class="arch-path__cta"><a class="btn btn--gold" href="/contact?type=architecture-design" data-track="project_click" data-track-location="arch_path">Start a Project</a></p>
  </div>
</section>
${bleedCta({ title: 'Finished something worth showing?', text: 'Share the project, location and timing. We will come back with a plan and an estimate.', cta: '<a class="btn btn--gold" href="/contact?type=architecture-design" data-track="project_click" data-track-location="arch_final">Start a Project</a>', image: allMediaById['ph-barba-waterfront']?.src || '/v/ph-barba-waterfront.webp', alt: '' })}`,
  };

  // ---------- COMMERCIAL ----------
  // James, Sep 26 2026: value proposition after the hero, one short case study, then a compact grid with ONE
  // representative image or inline video per project; each card opens that project's own page. One client per project.
  const comMedia = media.filter((m) => m.category === 'commercial');
  const comOrder = ['revivaluxe', 'rachel-lynch-pools', 'torella-pools'];
  const comProjects = work.projects.filter((p) => p.category === 'commercial' && visible(p))
    .map((p) => { const items = comMedia.filter((m) => m.project === p.slug); return { p, items, rep: repOf(items), delivered: filmDelivered(p, deliveredOf(items)) }; })
    .filter((x) => x.items.length)
    .sort((x, y) => ((comOrder.indexOf(x.p.slug) + 1 || 99) - (comOrder.indexOf(y.p.slug) + 1 || 99)));
  // Client blurbs are written with James before launch: review builds show a marked placeholder, production omits it.
  const blurb = (text, what) => (text ? `${esc(text)}${reviewMode ? ` ${needsApproval({ approval: 'pending' }, 'Draft: final client wording to be approved with James')}` : ''}` : (reviewMode ? `<span class="review-placeholder">${esc(what)} to be written with James before launch.</span> ${needsApproval({ approval: 'pending' }, 'Placeholder, not a claim')}` : ''));
  // Owner-approved client wording (blurbApproved) renders as plain text; anything else keeps the review tag or placeholder.
  const blurbOf = (p, key, what) => (p.blurbApproved && p[key] ? esc(p[key]) : blurb(p[key], what));
  const caseStudy = comProjects.find((x) => x.p.slug === 'revivaluxe') || comProjects[0];
  const cp = offers.commercialProperty.filter(visible);
  const b2b = offers.businessMonthly.filter(visible);
  const cpAdd = (offers.commercialAddOns || []).filter(visible);
  const cpPort = offers.commercialPortfolio && visible(offers.commercialPortfolio) ? offers.commercialPortfolio : null;
  pages['/commercial'] = {
    overlay: true,
    body: `${pageHero({
      eyebrow: 'Commercial production',
      title: 'Consistent content, <em>without building an in-house team.</em>',
      lede: 'Brand photography, film, testimonials, podcasts and short-form content for healthcare, legal, hospitality, automotive and corporate teams. One partner for planning, production, editing and delivery.',
      cta: `<a class="btn btn--solid" href="/contact?type=commercial" data-track="project_click" data-track-location="com_hero">Start a Project</a>`,
      video: { loop: 'biz-rachel-lynch-pools', film: 'biz-rachel-lynch-pools' },
    })}
<section class="section" aria-labelledby="com-value-h">
  <div class="wrap">
    <div class="split">
      <div class="split__label"><p class="eyebrow">What we do</p></div>
      <div>
        <h2 class="h2 reveal" id="com-value-h">Photography and film that show <em>what your business actually does.</em></h2>
        <p class="lede reveal">We plan, shoot, edit and deliver brand media for businesses and their agencies: your people, your spaces and your work, made to be used across your website, social channels and sales. One team from the first call to the final files, so you get consistent content without building an in-house department.</p>
      </div>
    </div>
    <div class="features features--4">
      <div class="feature reveal">${mediaFig('ph-revivaluxe-portrait')}<h3 class="h3">Brand and team photography</h3><p>People, spaces and services, photographed to match how you want to be seen.</p></div>
      <div class="feature reveal">${mediaFig('biz-bpe-ironworks', { alt: 'Frame from the BPE Ironworks film' })}<h3 class="h3">Film and short-form</h3><p>Brand films, project showcases and short cuts for every channel you use.</p></div>
      <div class="feature reveal">${mediaFig('cs-ph-island-federal')}<h3 class="h3">Podcasts and studio days</h3><p>Recorded at <a href="/creator-studios">LI Creator Studios</a> or on location.</p></div>
      <div class="feature reveal">${mediaFig('ph-clos-lighting')}<h3 class="h3">Recurring production</h3><p>A monthly cadence so content keeps coming without hiring several separate roles.</p></div>
    </div>
  </div>
</section>
${caseStudy ? `<section class="section section--ink on-dark" id="case-study" aria-labelledby="com-case-h">
  <div class="wrap">
    <p class="eyebrow">Case study</p>
    <h2 class="h2 reveal" id="com-case-h">${esc(caseStudy.p.client || caseStudy.p.title)}</h2>
    <div class="case">
      <div class="case__media">${withLoop(caseStudy.p, repFrame(caseStudy.rep, caseStudy.p.silentLoop ? '(min-width: 1000px) 36vw, 62vw' : '(min-width: 1000px) 58vw, 100vw'))}</div>
      <dl class="case__facts">
        <div><dt>Goal</dt><dd>${blurbOf(caseStudy.p, 'goal', 'The client goal')}</dd></div>
        <div><dt>Our approach</dt><dd>${blurbOf(caseStudy.p, 'story', 'Our approach')}</dd></div>
        <div><dt>Delivered</dt><dd>${esc(caseStudy.delivered.join(' · '))}</dd></div>
      </dl>
    </div>
    <p class="case__more"><a class="link-arrow" href="${projectPath(caseStudy.p)}" data-track="project_click" data-track-location="com_case">See the ${esc(caseStudy.p.client || caseStudy.p.title)} project ${arrow}</a></p>
  </div>
</section>` : ''}
<section class="section" id="portfolio" aria-labelledby="com-work-h">
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Client work</p><h2 class="h2 reveal" id="com-work-h">Recent work for <em>businesses like yours.</em></h2><p class="section-lede">Open any client to see the film, the photographs and what we delivered.</p></div></div>
    <ul class="pgrid" role="list">${join(comProjects, (x) => `<li class="pgrid__item" data-project="${esc(x.p.slug)}">
      <div class="pgrid__media">${x.rep.type === 'video' ? repFrame(x.rep, '(min-width: 1200px) 24vw, (min-width: 700px) 45vw, 100vw') : `<a href="${projectPath(x.p)}" tabindex="-1" aria-hidden="true">${repFrame(x.rep, '(min-width: 1200px) 24vw, (min-width: 700px) 45vw, 100vw')}</a>`}</div>
      <h3 class="pgrid__title"><a href="${projectPath(x.p)}" data-track="project_click" data-track-location="com_grid">${esc(x.p.client || x.p.title)}</a></h3>
      <a class="link-arrow pgrid__go" href="${projectPath(x.p)}" aria-label="View the ${esc(x.p.client || x.p.title)} project">View project ${arrow}</a>
    </li>`)}</ul>
  </div>
</section>
${cp.length || b2b.length ? `<section class="section">
  <div class="wrap">
    <p class="eyebrow">Starting points</p>
    <h2 class="h2 reveal">Where standard scopes begin.</h2>
    ${cp.length ? `<div class="cpm">
      <h3 class="h3">Commercial property media</h3>
      <p class="cpm__kicker">Photography · Aerial · Video · Portfolio coverage</p>
      ${cpPort?.lede ? `<p class="cpm__lede">${esc(cpPort.lede)}</p>` : ''}
      <ul class="cpm__tiers" role="list">${join(cp, (c) => `<li class="cpm__tier">
        <p class="cpm__name">${esc(c.name)} ${needsApproval(c)}</p>
        <p class="cpm__price">${approvedPrice(c, `${formatUSD(c.amount)}${c.plus ? '+' : ''}`)}</p>
        ${c.summary ? `<p class="cpm__summary">${esc(c.summary)}</p>` : ''}
        ${c.scope ? `<p class="cpm__scope"><span class="cpm__label">Typical scope</span> ${esc(c.scope)}</p>` : ''}
      </li>`)}</ul>
      <p class="small muted cpm__how">The level is set by the overall production scope: the number of buildings and spaces, interior and exterior coverage, complexity and time on site, not square footage alone. The square footage ranges above are general guidelines.</p>
      ${cpAdd.length ? `<h4 class="cpm__sub">Popular add-ons</h4><ul class="cpm__addons" role="list">${join(cpAdd, (a) => `<li><p class="cpm__name">${esc(a.name)} ${needsApproval(a)}</p><p class="cpm__addprice">${approvedPrice(a, esc(a.price))}</p><p class="small muted">${esc(a.detail)}</p></li>`)}</ul>` : ''}
      ${cpPort ? `<h4 class="cpm__sub">Portfolio pricing</h4><p class="small">${esc(cpPort.intro)}</p><ul class="prows prows--compact cpm__portfolio">${join(cpPort.tiers, ([n, r]) => `<li class="prow"><div class="prow__text"><p class="prow__name">${esc(n)}</p></div><div class="prow__price">${approvedPrice(cpPort, `<strong>${esc(r)}</strong>`)}</div></li>`)}</ul><p class="small muted">${esc(cpPort.fine)}</p>${cpPort.custom ? `<p class="cpm__custom"><strong>Need a custom scope?</strong> ${esc(cpPort.custom)}</p>` : ''}` : ''}
    </div>` : ''}
    ${b2b.length ? `<div class="two-col two-col--top cpm__monthly">
      <div><h3 class="h3">Monthly business content</h3><ul class="prows prows--compact">${join(b2b, (o) => `<li class="prow"><div class="prow__text"><p class="prow__name">${esc(o.name)} ${needsApproval(o)}</p><p class="prow__detail">${esc(o.scope.join(' · '))}</p></div><div class="prow__price">${approvedPrice(o, `<strong>${formatUSD(o.monthly)}</strong>/mo<br><span class="small muted">${formatUSD(o.contract)}/mo on 12 months</span>`)}</div></li>`)}</ul><p class="small muted">12-month rates are billed monthly. Larger annual programs are planned with you.</p></div>
    </div>` : ''}
  </div>
</section>` : ''}
<section class="section" id="agencies" aria-labelledby="agency-h">
  <div class="wrap two-col two-col--top">
    <div>
      <p class="eyebrow">For agencies</p>
      <h2 class="h2 reveal" id="agency-h">Production capacity for <em>advertising and marketing agencies.</em></h2>
      ${mediaFig('cs-ph-hedgestone-switch', { cls: 'agency-fig' })}
    </div>
    <div>
      <p>Crew, studio or on-location production, filming, editing and project management for your clients. Client-facing, behind the scenes, collaborative or white-label, with roles and approvals agreed before we start.</p>
      <div class="actions"><a class="btn btn--ink" href="/agency-partnerships" data-track="partnership_click" data-track-location="com_agency">Agency partnerships</a><a class="link-arrow" href="/contact?type=agency" data-track="partnership_click" data-track-location="com_agency">Discuss a Partnership ${arrow}</a></div>
    </div>
  </div>
</section>
${bleedCta({ title: 'Tell us what you need to make.', text: 'A short call is the fastest way to scope a campaign or a recurring program.', cta: '<a class="btn btn--gold" href="/contact?type=commercial" data-track="project_click" data-track-location="com_final">Start a Project</a>', image: allMediaById['ph-rachel-lynch-infinity']?.src || '/v/ph-rachel-lynch-infinity.webp' })}`,
  };

  // ---------- AGENCY ----------
  pages['/agency-partnerships'] = {
    overlay: true,
    body: `${pageHero({
      eyebrow: 'Agency partnerships',
      title: 'Production capacity <em>you can stand behind.</em>',
      lede: 'Crew, studio or on-location production, filming, editing, post-production and project management for advertising and marketing agencies. Client-facing or white-label, with roles agreed up front.',
      cta: `<a class="btn btn--solid" href="/contact?type=agency" data-track="partnership_click" data-track-location="agency_hero">Discuss a Partnership</a>`,
      image: '/images/photografik-2027/curated/home-path-on-location.webp', imageAlt: 'Camera operator filming outdoors on location',
    })}
<section class="section">
  <div class="wrap">
    <p class="eyebrow">Ways to work together</p>
    <h2 class="h2 reveal">Pick the model that fits the client.</h2>
    <div class="features features--4">
      <div class="feature reveal"><h3 class="h3">Client-facing</h3><p>We work directly with your client on set, under your creative lead.</p></div>
      <div class="feature reveal"><h3 class="h3">Behind the scenes</h3><p>You own the relationship. We handle production and hand over the files.</p></div>
      <div class="feature reveal"><h3 class="h3">Collaborative</h3><p>We contribute concepts, scripting and direction alongside your team.</p></div>
      <div class="feature reveal"><h3 class="h3">White-label</h3><p>Delivered under your brand, with confidentiality agreed in writing.</p></div>
    </div>
  </div>
</section>
<section class="section section--tint">
  <div class="wrap narrow">
    <p class="eyebrow">What we ask first</p>
    <h2 class="h2 reveal">So we can quote accurately.</h2>
    <ul class="checks checks--cols">
      <li>Locations, dates and geography</li><li>Deliverables and channels</li><li>Crew and studio needs</li><li>Post-production scope</li><li>Approval chain and review rounds</li><li>Usage and licensing</li><li>Client-facing or white-label</li>
    </ul>
    <p class="aside-line">Every agency engagement is scoped individually. We do not publish a one-size retainer.</p>
  </div>
</section>
<section class="section section--brand on-dark">
  <div class="wrap cta-band">
    <h2 class="h2 reveal">Bring us your next brief.</h2>
    <a class="btn btn--gold" href="/contact?type=agency" data-track="partnership_click" data-track-location="agency_final">Discuss a Partnership</a>
  </div>
</section>`,
  };

  // ---------- CREATOR STUDIOS ----------
  const sessions = offers.creatorSessions.filter(visible);
  const creatorHref = site.destinations.creatorBooking.href;
  const creatorInquiry = site.destinations.creatorInquiry?.href || '/contact?type=creator-studios';
  const creatorExternal = /^https?:/.test(creatorHref) ? ' target="_blank" rel="noopener"' : '';
  const csFrom = sessions.filter(isApproved).reduce((lo, x) => (lo && lo < x.amount ? lo : x.amount), 0);
  const csStart = (loc, label = 'Book a Studio Session', cls = 'btn btn--solid') => `<a class="${cls}" href="${creatorHref}"${creatorExternal} data-track="creator_click" data-track-location="${loc}">${label}${creatorExternal ? '<span class="sr-only"> (opens LI Creator Studios booking in a new tab)</span>' : ''}</a>`;
  // James, Sep 28 2026: booking is through LI Creator Studios (the button still opens the verified booking flow).
  const csBookingNote = `<p class="small booking-note">Studio sessions are booked through LI Creator Studios. Choose your session and time there. Not sure which session fits? <a href="${creatorInquiry}" data-track="creator_click" data-track-location="creator_inquiry">Ask us first</a>.</p>`;
  const scope = (included) => `<span class="scope-tag scope-tag--${included ? 'in' : 'out'}">${included ? 'Part of a session' : 'With Recording + Editing, or by quote'}</span>`;
  // James, Sep 28 2026: no Recent Sessions section; approved photos and clips sit beside the copy they support,
  // with no captions beneath them (each keeps its alt text or accessible name).
  const csById = Object.fromEntries(media.filter((m) => m.category === 'creator-studios').map((m) => [m.id, m]));
  const csFig = (id, sizes = '(min-width: 900px) 40vw, 100vw') => { const m = csById[id]; return m ? `<figure class="cs-fig cs-fig--${m.orientation}">${img(m.src, { alt: m.alt || m.title, thumb: m.thumb, sizes })}</figure>` : ''; };
  // Opening section: three current vertical examples, quietly looping in place (muted excerpts, 25 s each).
  const csLoops = [
    ['cs-ifcu-clip', 'Island Federal podcast short, muted excerpt'],
    ['cs-noah-knows-short', 'Noah Knows podcast short, muted excerpt'],
    ['cs-jm2-architecture', 'JM2 Architecture on the podcast, muted excerpt'],
  ];
  // Formats (James, Sep 28 2026): a photo above each block, matched to what the block describes.
  const csFormatImg = { podcasts: 'cs-ph-cc-onsite', multicam: 'cs-ph-hedgestone-switch', longform: 'ph-noah-knows', solo: 'cs-ph-solo-bts', short: 'cs-tick', planned: 'creator-still' };
  const csFormatFig = (key) => {
    const m = csById[csFormatImg[key]]; if (!m) return '';
    const src = m.type === 'video' ? m.poster : m.src;
    const alt = m.type === 'video' ? 'Frame from a vertical podcast clip with word-by-word captions' : (m.alt || m.title);
    return `<figure class="cs-format__img">${img(src, { alt, thumb: m.thumb, sizes: '(min-width: 900px) 30vw, 100vw' })}</figure>`;
  };
  const csSessionPhoto = { 'podcast-session': 'cs-ph-island-federal', 'content-session': 'cs-ph-solo-couch', 'recording-editing': 'cs-ph-cc-ep20' };
  // James, Sep 26 2026: How it works and FAQ follow licreatorstudios.com/how-it-works.
  const csFaq = [
    ['Can I come solo, or with fewer than four guests?', 'Yes. We adjust the setup to suit any number of guests.'],
    ['How quickly do I receive my files?', 'Your recorded live session is sent within 24 hours. If we edit for you, including social media clips, allow about 5 to 7 days.'],
    ['Why would I need further editing?', 'The live cut satisfies most people. Additional editing is there when you want the episode as polished as possible.'],
    ['Will I receive every audio and video file separately?', 'Typically, no. We can record every camera and microphone separately for more in-depth editing; to receive the isolated files, bring a Samsung T5 or T7 SSD for us to record to. Contact us for details.'],
    ['Can I livestream from the studio?', 'Yes. We have fast internet and can stream to any platform.'],
    ['Can you help with uploading and promoting the podcast?', 'Yes. Editing, social media optimization and distribution help are available. Contact us for details.'],
    ['Can I book by the hour, or for less time?', 'No. Podcast sessions are booked in 90-minute blocks. Studio content is booked by the hour with a 2-hour minimum. For longer sessions, please contact us.'],
    ['What is the cancellation policy?', 'Cancel with at least 48 hours’ notice for a full refund, or with 24 hours’ notice for a 50% refund. Cancellations with less than 24 hours’ notice are not refunded.',],
  ];
  const csBy = Object.fromEntries(sessions.filter(isApproved).map((x) => [x.id, x]));
  // Only approved figures are quoted. James, Sep 27 2026: the single session is $249.
  // James, Sep 28 2026: "Starting at" before every displayed price; general studio content starts at $499 for a 2-hour minimum.
  const csCtaParts = [
    csBy['podcast-session'] && `Single studio sessions start at ${formatUSD(csBy['podcast-session'].amount)} for up to 90 minutes.`,
    csBy['content-session'] && `General studio content starts at ${formatUSD(csBy['content-session'].amount)} for a 2-hour minimum.`,
    csBy['recording-editing'] && `Recording + Editing starts at ${formatUSD(csBy['recording-editing'].amount)} a month.`,
  ].filter(Boolean);
  const csCtaLine = csCtaParts.length ? csCtaParts.join(' ') : 'Tell us who you want to reach and what you want to talk about.';
  pages['/creator-studios'] = {
    overlay: true,
    seo: { title: 'LI Creator Studios | Podcast and studio content on Long Island | Photografik', description: 'Podcasts, interviews and on-camera content that show the person and purpose behind a business. Multi-camera studio sessions with production support in Bohemia, NY.' },
    body: `${pageHero({
      eyebrow: 'LI Creator Studios · Bohemia, NY',
      title: 'Show people <em>who is behind the business.</em>',
      lede: 'Podcasts, interviews and on-camera content for business owners, agents, founders and experts, recorded with a team that helps you sound like yourself.',
      cta: `${csStart('creator_hero')}<a class="link-arrow" href="#sessions">${csFrom ? `Sessions starting at ${formatUSD(csFrom)}` : 'Studio sessions'} ${arrow}</a>`,
      video: { loop: 'cs-demo-reel', film: 'cs-demo-reel' },
    })}
<section class="section" aria-labelledby="cs-story-h">
  <div class="wrap cs-pair">
    <div class="cs-pair__text">
      <p class="eyebrow">The person behind the business</p>
      <h2 class="h2 reveal" id="cs-story-h">People choose who they work with <em>before they ever call.</em></h2>
      <p>Your website lists what you do. A recorded conversation lets customers hear why you do it, what you believe and how you think, in your own words.</p>
      <ul class="cs-points"><li><strong>The person.</strong> Where you came from and why you do this work.</li><li><strong>The purpose.</strong> The standard you hold your work to.</li><li><strong>The expertise.</strong> The questions you answer every week, explained properly.</li></ul>
      <p><a class="link-arrow" href="/creator-studios/sessions" data-track="project_click" data-track-location="creator_story">See all sessions ${arrow}</a></p>
    </div>
    <div class="cs-pair__media cs-loops" role="group" aria-label="Examples of podcast shorts made with clients">${join(csLoops, ([id, label]) => `<div class="cs-loop">${ambient(id, { label })}</div>`)}</div>
  </div>
</section>

<section class="section section--tint" id="sessions" aria-labelledby="cs-sessions-h">
  <div class="wrap">
    <p class="eyebrow">Sessions</p>
    <h2 class="h2 reveal" id="cs-sessions-h">Choose how you want to work.</h2>
    <div class="cs-sessions cs-sessions--${sessions.length}">${join(sessions, (s) => `<div class="plan plan--media reveal" data-session="${esc(s.id)}">
      ${csFig(csSessionPhoto[s.id] || 'cs-ph-solo-couch')}
      <h3 class="h3">${esc(s.name)} ${needsApproval(s, s.reviewNote)}</h3>
      <p class="plan__price">${approvedPrice(s, `<span class="plan__from">Starting at</span> <strong>${formatUSD(s.amount)}</strong>${s.unit ? ` <span class="plan__unit">${esc(s.unit)}</span>` : ''}${s.minimum ? `<span class="plan__min">${esc(s.minimum)}</span>` : ''}`, 'Price being confirmed')}</p>
      <p>${esc(s.detail)}</p>
      ${s.includes?.length ? `<ul class="plan__list">${join(s.includes, (x) => `<li>${esc(x)}</li>`)}</ul>` : ''}
      ${s.extra ? `<p class="small muted">${esc(s.extra)}</p>` : ''}
      <div class="plan__cta">${s.booking === 'inquiry' ? `<a class="link-arrow" href="${creatorInquiry}" data-track="creator_click" data-track-location="creator_plan_${esc(s.id)}">Ask about ${esc(s.name)} ${arrow}</a>` : csStart(`creator_plan_${s.id}`, 'Book this session', 'btn btn--solid')}</div></div>`)}</div>
    ${csBookingNote}
  </div>
</section>

<section class="section" aria-labelledby="cs-space-h">
  <div class="wrap cs-pair cs-pair--flip">
    <div class="cs-pair__text">
      <p class="eyebrow">The space</p>
      <h2 class="h2 reveal" id="cs-space-h">Multi-camera, <em>switched as you record.</em></h2>
      <p>Sets, lights, cameras and sound are ready when you arrive. We switch angles live, coach pacing and delivery, and suggest a retake when a moment could land better.</p>
    </div>
    <div class="cs-pair__media cs-space-reel">
      <video class="ambient cs-space-reel__video" data-ambient muted loop playsinline controls preload="none" data-poster="/v/cs-demo-reel-silent.webp" aria-label="LI Creator Studios demo reel: podcast and on-camera sessions recorded in the studio (no sound)" disableremoteplayback><source src="/v/cs-demo-reel-silent-loop.mp4" type="video/mp4"></video>
    </div>
  </div>
</section>

<section class="section section--tint" id="formats" aria-labelledby="cs-formats-h">
  <div class="wrap">
    <p class="eyebrow">Formats</p>
    <h2 class="h2 reveal" id="cs-formats-h">What you can make here.</h2>
    <ul class="cs-formats">
      <li>${csFormatFig('podcasts')}<h3>Podcasts and guest conversations</h3><p>A host and one or more guests.</p>${scope(true)}</li>
      <li>${csFormatFig('multicam')}<h3>Multi-camera interviews</h3><p>Several angles, switched live.</p>${scope(true)}</li>
      <li>${csFormatFig('longform')}<h3>Long-form episodes</h3><p>The full episode, ready for YouTube, your site or your feed.</p>${scope(true)}</li>
      <li>${csFormatFig('solo')}<h3>Solo on-camera pieces</h3><p>Explainers, updates and answers to common questions.</p>${scope(true)}</li>
      <li>${csFormatFig('short')}<h3>Short-form clips and reels</h3><p>Vertical clips for social, scoped with you.</p>${scope(false)}</li>
      <li>${csFormatFig('planned')}<h3>Planned for your channels</h3><p>Topics, a publishing plan and distribution.</p>${scope(false)}</li>
    </ul>
    <p class="aside-line">A single session includes the live-cut file. Editing is available by quote, or every month with Recording + Editing.</p>
  </div>
</section>

<section class="section" aria-labelledby="cs-conv-h">
  <div class="wrap cs-pair">
    <div class="cs-pair__text">
      <p class="eyebrow">Conversations and relationships</p>
      <h2 class="h2 reveal" id="cs-conv-h">A good conversation is <em>also a good reason to connect.</em></h2>
      <p>Invite a client, a referral partner or an expert your customers should hear from. The recording is shared work you both can use, and a relationship that continues after the cameras stop.</p>
      <p class="small muted">We cannot promise leads, revenue or a particular reach. We can help you have a clear, well-produced conversation.</p>
    </div>
    <div class="cs-pair__media cs-trio">${csFig('cs-ph-dan-dan-conversation')}${csFig('cs-ph-determined-society')}${csFig('ph-network-effect')}</div>
  </div>
</section>

<section class="section section--ink on-dark" aria-labelledby="cs-process-h">
  <div class="wrap">
    <div class="split">
      <div class="split__label"><p class="eyebrow">How it works</p></div>
      <div><h2 class="h2 reveal" id="cs-process-h">Book, record, and walk out with your files.</h2></div>
    </div>
    <ol class="steps steps--4">
      <li class="reveal"><span class="steps__n">01 / Book</span><h3>Choose your studio and a time.</h3><p>Pick your set, then a date and time that work for you. For longer sessions, contact us.</p></li>
      <li class="reveal"><span class="steps__n">02 / Record</span><h3>Sit back and record.</h3><p>We handle the equipment while you focus on the conversation.</p></li>
      <li class="reveal"><span class="steps__n">03 / Receive</span><h3>Files within 24 hours.</h3><p>Your recorded live session is sent within 24 hours. Edited episodes and clips take about 5 to 7 days.</p></li>
      <li class="reveal"><span class="steps__n">04 / Partner</span><h3>Keep going with us.</h3><p>Add services, improved rates and more end-to-end support when you record regularly.</p></li>
    </ol>
  </div>
</section>

<section class="section" id="faq" aria-labelledby="cs-faq-h">
  <div class="wrap cs-faq">
    <div><p class="eyebrow">Questions</p>
    <h2 class="h2 reveal" id="cs-faq-h">Before you book.</h2></div>
    <div class="faq">${join(csFaq, ([q, a, note]) => `<details class="faq__item"><summary>${esc(q)}</summary><p>${esc(a)}${note ? ` ${needsApproval({ approval: 'pending' }, note)}` : ''}</p></details>`)}</div>
  </div>
</section>


<section class="section section--brand on-dark">
  <div class="wrap cta-band">
    <h2 class="h2 reveal">Plan your first session.</h2>
    <p>${csCtaLine}</p>
    <div class="actions">${csStart('creator_final', 'Book a Studio Session', 'btn btn--gold')}<a class="link-arrow" href="${creatorInquiry}" data-track="creator_click" data-track-location="creator_final_plan">Plan Your Content ${arrow}</a></div>
  </div>
</section>`,
  };

  // ---------- PROJECT DETAIL (under its service URL) ----------
  // Commercial projects (James, Sep 26 2026): only that project's media, the client, what was delivered and the goal.
  // Unapproved client wording shows as a marked placeholder in review builds and is omitted in production.
  for (const p of work.projects.filter(visible)) {
    const pm = media.filter((m) => m.project === p.slug);
    const isCom = p.category === 'commercial';
    const related = isCom ? [] : media.filter((m) => m.project !== p.slug && m.category === p.category).slice(0, 3);
    const isRE = p.category === 'real-estate';
    const cta = isRE ? bookBtn('project_detail') : `<a class="btn btn--solid" href="/contact?type=${esc(p.category)}" data-track="project_click" data-track-location="project_detail">Start a Project</a>`;
    const rep = p.hero ? null : repOf(pm);
    const heroHtml = p.hero ? img(p.hero, { alt: p.heroAlt, eager: true, sizes: '(min-width: 900px) 55vw, 100vw' }) : rep ? repFrame(rep, '(min-width: 900px) 55vw, 100vw') : '';
    const lede = isCom && !p.blurbApproved ? blurb(p.story, 'Client and project summary') : esc(p.story || '');
    const services = isCom ? filmDelivered(p, deliveredOf(pm)).join(' · ') : (p.services || []).join(', ');
    const goal = isCom ? (p.blurbApproved && p.goal ? esc(p.goal) : blurb(p.goal, 'Project goal')) : '';
    const desc = p.summary || `${p.client || p.title}: ${catLabel[p.category].toLowerCase()} by Photografik Studios.`;
    pages[projectPath(p)] = {
      seo: { title: `${p.title} | ${catLabel[p.category]} | Photografik`, description: desc, image: p.hero || rep?.poster || rep?.src },
      body: `
<article class="project${isCom ? ' project--commercial' : ''}">
  <header class="section project__head">
    <div class="wrap project__grid project__grid--${p.heroOrientation}">
      <div class="project__intro">
        <p class="eyebrow"><a href="${serviceRoute[p.category]}${isCom ? '#portfolio' : ''}">${esc(catLabel[p.category])}</a>${p.location ? ` · ${esc(p.location)}` : ''}</p>
        <h1 class="display">${esc(p.title)}</h1>
        ${lede ? `<p class="lede">${lede}</p>` : ''}
        <dl class="project__facts">${p.client ? `<div><dt>Client</dt><dd>${esc(p.client)}</dd></div>` : ''}<div><dt>${isCom ? 'Delivered' : 'Services'}</dt><dd>${esc(services)}</dd></div>${goal ? `<div><dt>Goal</dt><dd>${goal}</dd></div>` : ''}${p.location ? `<div><dt>Location</dt><dd>${esc(p.location)}</dd></div>` : ''}</dl>
        <div class="actions">${cta}</div>
      </div>
      <div class="project__hero">${withLoop(p, heroHtml)}</div>
    </div>
  </header>
  ${(rest => rest.length ? `<section class="section section--ink on-dark"><div class="wrap"><h2 class="h2 reveal">From the project</h2><div class="justified">${join(rest, (m) => mediaCard(m))}<span class="justified__spacer" aria-hidden="true"></span></div></div></section>` : '')(rep ? pm.filter((m) => m !== rep) : pm)}
  ${related.length ? `<section class="section"><div class="wrap"><div class="section-head"><h2 class="h2 reveal">Related work</h2><a class="link-arrow" href="${serviceRoute[p.category]}#portfolio">More ${esc(catLabel[p.category])} ${arrow}</a></div><div class="justified">${join(related, (m) => mediaCard(m))}<span class="justified__spacer" aria-hidden="true"></span></div></div></section>` : ''}
  ${isCom ? `<section class="section"><div class="wrap cta-band cta-band--light"><h2 class="h2">Planning something similar?</h2><p>Tell us about the business, the audience and where the media will be used.</p><div class="actions">${cta}<a class="link-arrow" href="/commercial#portfolio">More client projects ${arrow}</a></div></div></section>` : ''}
</article>`,
    };
  }

  // ---------- ABOUT ----------
  // Reviews: verbatim quotes from content/testimonials.json (Google Business Profile and the live site's testimonial block).
  const tm = testimonials || { reviews: [] };
  // A short, curated selection (featured order) keeps the page scannable; the rest of the reviews stay in reserve.
  const tmReviews = tm.reviews.filter((r) => r.approval === 'approved' && Number.isInteger(r.featured)).sort((x, y) => x.featured - y.featured);
  // The video testimonial appears only once its file is identified and rights-approved; no empty slot is shown.
  const tmVideo = tm.video?.id ? work.media.find((m) => m.id === tm.video.id && m.rights === 'approved') : null;
  const g = tm.google;
  const cite = (r) => `<figcaption><span class="review__name">${esc(r.name)}</span>${r.org ? `<span class="review__org">${esc(r.org)}</span>` : ''}</figcaption>`;
  const [lead, ...rest] = tmReviews;
  const aboutReviews = lead ? `
<section class="section reviews" id="reviews" aria-labelledby="reviews-h">
  <div class="wrap">
    <div class="reviews__top">
      <div class="reviews__intro">
        <p class="eyebrow">Client reviews</p>
        <h2 class="h2 reveal" id="reviews-h">In our clients’ words.</h2>
        ${g ? `<a class="reviews__rating" href="${esc(g.href)}" target="_blank" rel="noopener" data-track="reviews_click" data-track-location="about_reviews_rating"><span class="reviews__score">${esc(g.rating.toFixed(1))}</span><span class="reviews__stars" aria-hidden="true">★★★★★</span><span class="reviews__count">${esc(String(g.count))} Google reviews <span class="sr-only">(opens Google)</span></span></a>` : ''}
      </div>
      ${tmVideo ? `<figure class="reviews__video reveal">${videoPlayer(tmVideo, { sizes: '(min-width: 900px) 50vw, 90vw' })}${tm.video.name ? `<figcaption class="reviews__credit"><span class="review__name">${esc(tm.video.name)}</span></figcaption>` : ''}</figure>` : `<figure class="review review--lead reveal"><blockquote><p>${esc(lead.quote)}</p></blockquote>${cite(lead)}</figure>`}
    </div>
    <ul class="reviews__list" role="list">
      ${(tmVideo ? tmReviews : rest).map((r) => `<li class="review reveal"><figure><blockquote><p>${esc(r.quote)}</p></blockquote>${cite(r)}</figure></li>`).join('')}
    </ul>
    ${g ? `<p class="reviews__more"><a class="link-arrow" href="${esc(g.href)}" target="_blank" rel="noopener" data-track="reviews_click" data-track-location="about_reviews_more">Read all our Google reviews ${arrow}</a></p>` : ''}
  </div>
</section>` : '';

  pages['/about'] = {
    overlay: true,
    body: `${pageHero({
      eyebrow: 'About',
      title: 'Quality over volume. <em>On purpose.</em>',
      lede: 'Photografik Studios is a boutique visual media company on Long Island. We work with the agents, builders, designers, agencies and businesses who believe presentation affects results.',
      cta: `<a class="btn btn--solid" href="/contact" data-track="project_click" data-track-location="about_hero">Start a Project</a>`,
    })}
<section class="section">
  <div class="wrap">
    <h2 class="sr-only">How we work</h2>
    <div class="features">
      <div class="feature reveal"><h3 class="h3">Quality over quantity</h3><p>A complete, considered set instead of a padded gallery of near-duplicates. Every frame earns its place.</p></div>
      <div class="feature reveal"><h3 class="h3">Marketing judgment</h3><p>We think about where the media will be used and what it needs to do there, then plan the shoot around it.</p></div>
      <div class="feature reveal"><h3 class="h3">On site and in studio</h3><p>Listing and project coverage in the field, plus a production studio in Bohemia for podcasts, interviews and on-camera content.</p></div>
    </div>
  </div>
</section>
<section class="section section--tint">
  <div class="wrap two-col two-col--top">
    <div>
      <p class="eyebrow">The team</p>
      <h2 class="h2 reveal">Led by James Calandrino.</h2>
      <p>James directs the creative work, leads client relationships and shoots video. Our team covers photography, drone and floor plans, including weekend shoots, and a client experience lead keeps every booking moving.</p>
    </div>
    <div>
      <p class="eyebrow">Where we work</p>
      <p>${esc(site.serviceArea)}</p>
      <p class="eyebrow">Usage and licensing ${needsApproval({ approval: 'pending' }, 'Public licensing language requires legal review')}</p>
      <p>Photografik keeps the copyright in the media we create. Each client receives a license for the agreed use. If you want to share the work with someone else, ask us first and we will make it simple.</p>
    </div>
  </div>
</section>
${aboutReviews}
${splitCta('Let us help with the next one.')}`,
  };

  // ---------- CONTACT ----------
  pages['/contact'] = {
    overlay: true,
    scripts: ['contact.js'],
    body: `
<section class="page-hero page-hero--compact on-dark">
  <div class="wrap page-hero__inner">
    <p class="eyebrow">Start a project</p>
    <h1 class="display">Tell us what you are making.</h1>
    <p class="lede">For architecture, commercial, agency, content and custom work. A few details help us come back with a useful plan. Booking a standard listing? <a href="${booking}" data-track="book_click" data-track-location="contact_intro">Book a Shoot directly</a>.</p>
  </div>
</section>
<section class="section">
  <div class="wrap narrow">
    <form class="form" id="inquiry" novalidate action="/api/inquiry" method="post">
      <p class="form__req"><span aria-hidden="true">*</span> Required</p>
      <div class="form__grid">
        <div class="field"><label for="i-name">Your name <span aria-hidden="true">*</span></label><input id="i-name" name="name" autocomplete="name" required></div>
        <div class="field"><label for="i-email">Email <span aria-hidden="true">*</span></label><input id="i-email" name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="i-type">Project type <span aria-hidden="true">*</span></label>
          <select id="i-type" name="type" required>
            <option value="">Choose one</option>
            <option value="architecture-design">Architecture or interior design</option>
            <option value="commercial">Commercial or brand content</option>
            <option value="agency">Agency production partnership</option>
            <option value="agent-content">Agent content or monthly plan</option>
            <option value="real-estate-large">Real estate over 30,000 sq ft or custom listing</option>
            <option value="creator-studios">Creator Studios session</option>
            <option value="other">Something else</option>
          </select></div>
        <div class="field field--full"><label for="i-deliverables">What do you need, and where will it be used?</label><textarea id="i-deliverables" name="deliverables" rows="3" placeholder="Deliverables, channels and intended usage. For example: 20 photos and a 60-second film for our website and award submissions."></textarea></div>
        <details class="field field--full more" id="more-details">
          <summary>Add timing, budget and other details <span class="muted">(optional)</span></summary>
          <div class="form__grid">
        <div class="field"><label for="i-phone">Phone</label><input id="i-phone" name="phone" type="tel" autocomplete="tel"></div>
        <div class="field"><label for="i-company">Company or brokerage</label><input id="i-company" name="company" autocomplete="organization"></div>
        <div class="field"><label for="i-location">Location</label><input id="i-location" name="location" placeholder="Town, or several locations"></div>
        <div class="field"><label for="i-timing">Target timing</label><input id="i-timing" name="timing" placeholder="e.g. mid-October, or flexible"></div>
        <div class="field"><label for="i-budget">Approximate budget</label>
          <select id="i-budget" name="budget"><option value="">Prefer to discuss</option><option>Under $2,500</option><option>$2,500 to $5,000</option><option>$5,000 to $15,000</option><option>$15,000 to $50,000</option><option>$50,000 or more (annual program)</option></select></div>
        <fieldset class="field field--full field--inline"><legend>Is this for an agency client or white-label?</legend>
          <label><input type="radio" name="agency" value="yes"> Yes</label><label><input type="radio" name="agency" value="no"> No</label><label><input type="radio" name="agency" value="unsure"> Not sure</label></fieldset>
        <div class="field"><label for="i-decision">Who else approves the work?</label><input id="i-decision" name="decision" placeholder="Optional"></div>
        <div class="field"><label for="i-source">How did you find us?</label><input id="i-source" name="source" placeholder="Optional"></div>
          </div>
        </details>
        <div class="hp" aria-hidden="true"><label for="i-website">Leave this empty</label><input id="i-website" name="website" tabindex="-1" autocomplete="off"></div>
      </div>
      <p class="form__error" id="form-error" role="alert" hidden></p>
      <button class="btn btn--solid" type="submit">Send inquiry</button>
      <p class="small muted">We use these details only to respond to your inquiry. Prefer email? Write to <a href="mailto:${site.email}">${site.email}</a> or call <a href="${site.phoneHref}">${site.phone}</a>.</p>
    </form>
    <div class="form-done" id="form-done" hidden tabindex="-1">
      <h2 class="h2">Thank you. We have your details.</h2>
      <p>We will reply within one business day with next steps.</p>
    </div>
    <div class="form-done" id="form-fallback" hidden tabindex="-1">
      <h2 class="h2">Your inquiry has not been sent yet.</h2>
      <p>We could not deliver it from this page, so we prepared an email to ${site.email} with everything you entered. Open it in your email app and press send, or copy the details into any email.</p>
      <div class="actions"><a class="btn btn--solid" id="fallback-mailto" href="mailto:${site.email}">Open in my email app</a><button type="button" class="btn btn--outline" id="fallback-copy">Copy details</button></div>
      <p class="small muted" id="fallback-status" role="status" aria-live="polite"></p>
      <pre id="fallback-text" class="fallback-text"></pre>
      <p><button type="button" class="link-arrow link-button" id="fallback-back">Back to edit my details</button></p>
    </div>
  </div>
  </div>
</section>`,
  };

  // ---------- 404 ----------
  pages['/404'] = {
    overlay: true,
    body: `<section class="page-hero page-hero--compact on-dark"><div class="wrap page-hero__inner"><p class="eyebrow">404</p><h1 class="display">That page has moved.</h1><p class="lede">Try one of these instead.</p><div class="actions"><a class="btn btn--gold" href="/">Home</a><a class="link-arrow" href="/real-estate#portfolio">Real estate portfolio ${arrow}</a><a class="link-arrow" href="/real-estate/pricing">Pricing ${arrow}</a></div></div></section>`,
  };

  return pages;
}
