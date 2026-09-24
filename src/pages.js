import { esc, join } from './lib/html.js';
import { formatUSD, resolvePrice, inclusion, includeLabels, tierLabel, findTier } from './lib/pricing-core.js';
import { facts, editorialOrder, TYPE_FILTERS, optionCounts } from './lib/gallery-core.js';

const arrow = '<span aria-hidden="true">→</span>';

export function buildPages(ctx) {
  const { site, pricing, work, offers, faqs, img, videoPlayer, needsApproval, visible, ambient, reviewMode } = ctx;
  const booking = site.destinations.booking.href;
  const bookBtn = (loc, label = 'Book a Shoot', cls = 'btn btn--solid') =>
    `<a class="${cls}" href="${booking}" data-track="book_click" data-track-location="${loc}">${label}</a>`;
  const projectBySlug = Object.fromEntries(work.projects.map((p) => [p.slug, p]));
  const media = work.media.filter(visible);
  const catLabel = Object.fromEntries(work.taxonomy.category.map((c) => [c.id, c.label]));
  const svcLabel = Object.fromEntries(work.taxonomy.service.map((c) => [c.id, c.label]));
  const pkg = Object.fromEntries(pricing.packages.map((p) => [p.id, p]));
  const starting = (rec) => formatUSD(resolvePrice(rec, null).amount);

  // ---------- shared pieces ----------
  const pageHero = ({ eyebrow, title, lede, cta = '', image, imageAlt = '', tone = 'dark' }) => `
<section class="page-hero ${image ? 'page-hero--image' : 'page-hero--plain'} ${tone === 'dark' ? 'on-dark' : 'page-hero--ivory'}">
  ${image ? `<div class="page-hero__media">${img(image, { alt: imageAlt, eager: true, sizes: '100vw', widths: [768, 1080, 1600, 2200] })}</div>` : ''}
  <div class="wrap page-hero__inner">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1 class="display">${title}</h1>
    ${lede ? `<p class="lede">${lede}</p>` : ''}
    ${cta ? `<div class="actions">${cta}</div>` : ''}
  </div>
</section>`;

  const mediaCard = (m, { showMeta = true, sizes } = {}) => {
    const project = m.project ? projectBySlug[m.project] : null;
    const href = project ? `/work/${project.slug}` : null;
    const frame = m.type === 'video'
      ? videoPlayer(m, { sizes })
      : `<div class="still still--${m.orientation}">${href ? `<a href="${href}" class="still__link" aria-label="${esc(project.title)}: view project">` : ''}${img(m.src, { alt: m.alt || '', sizes: sizes || '(min-width: 1100px) 33vw, (min-width: 700px) 50vw, 100vw' })}${href ? '</a>' : ''}</div>`;
    const meta = showMeta ? `<div class="card__meta">
        <p class="card__title">${href ? `<a href="${href}">${esc(m.title)}</a>` : esc(m.title)}</p>
        <p class="card__sub">${esc(catLabel[m.category] || '')}${(m.location || project?.location) ? ` · ${esc(m.location || project.location)}` : ''}${m.type === 'video' ? ' · Film' : ''}</p>
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
    poster: m.type === 'video' ? galThumb(m) : null, alt: m.alt || m.title, category: m.category, orientation: m.orientation, ...facts(m),
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
<section class="hero hero--video">
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
  <button type="button" class="motion-toggle" data-motion-toggle aria-pressed="false"><span class="motion-toggle__icon" aria-hidden="true"></span><span class="motion-toggle__label">Pause background video</span></button>
</section>

<section class="quick on-dark" aria-label="Book or start a project">
  <div class="wrap quick__grid">
    <article class="quick__tile reveal">
      <div class="quick__media">${img('/v/re-hamptons-standout.webp', { alt: '' })}</div>
      <div class="quick__body">
        <p class="eyebrow eyebrow--rust">For your listings</p>
        <h2 class="quick__title">Listing Media</h2>
        <p>Photo, film, drone and floor plans for the property in front of you, booked online in a few minutes.</p>
        <div class="actions">${bookBtn('home_quick', 'Book a Shoot', 'btn btn--rust')}<a class="btn btn--glass" href="/real-estate/pricing" data-track="pricing_nav" data-track-location="home_quick">See pricing</a></div>
      </div>
    </article>
    <article class="quick__tile reveal">
      <div class="quick__media">${img('/v/biz-revivaluxe-tour.webp', { alt: '' })}</div>
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
        { href: '/architecture-design', vid: 'arch-99-hedges-amagansett', n: '02 / Architecture & builders', t: 'Projects told properly', x: 'Photography and film for architects, designers and builders, planned around your portfolio.', go: 'Architecture & design' },
        { href: '/commercial', vid: 'biz-revivaluxe-tour', n: '03 / Business & brand', t: 'Brand films and content', x: 'Brand films, process stories and monthly content, for you or through your agency.', go: 'Commercial' },
        { href: '/creator-studios', vid: 'cs-jm2-architecture', n: '04 / Creator Studios', t: 'Podcast and studio production', x: 'Multi-camera podcast and content sessions in our Bohemia studio.', go: 'Creator Studios' },
      ], (c) => `
      <a class="path reveal" href="${c.href}">
        <span class="path__img">${ambient(c.vid)}</span>
        <span class="path__body"><span class="path__num">${c.n}</span><span class="path__title">${c.t}</span><span class="path__text">${c.x}</span><span class="path__go">${c.go} →</span></span>
      </a>`)}
    </div>
  </div>
</section>

<section class="section section--ink on-dark showcase" aria-labelledby="work-h" data-showcase data-limit="${homeLimit}">
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
        <span class="sw-card__title">${esc(m.title)}${m.location ? ` <span class="sw-card__loc">${esc(m.location)}</span>` : ''}</span>
      </button>`)}
    </div>
    <p class="showcase__empty" id="sw-empty" hidden>Nothing in this category yet. Try another, or <a href="/contact">start a project</a>.</p>
    <div class="showcase__more"><a class="btn btn--light" id="sw-more" href="/work?service=video&amp;category=real-estate" data-track="gallery_view_more">View more</a></div>
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
      <div class="ladder__item reveal ${p.role === 'Recommended' ? 'ladder__item--featured' : ''}">
        <p class="tag">${esc(p.role === 'Premium' ? 'Premium anchor' : p.role || 'Package')}</p>
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
  const draftTag = (a) => (a.status === 'published' ? '' : `<span class="needs-approval" title="${esc(a.author?.confirm || 'Awaiting James\'s review')}">Draft for review</span>`);
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
      body: `
<section class="section fn-head">
  <div class="wrap">
    <p class="eyebrow">Field Notes</p>
    <h1 class="display">Straight answers from the shoot.</h1>
    <p class="lede">Questions agents, builders and brands ask us before they book, answered from how we actually plan and produce the work.</p>
  </div>
</section>
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
    const rows = v.rows.filter((row) => !common.includes(row));
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
      ${bookBtn('re_compare', 'Book on HD Photo Hub', 'btn btn--solid')}
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
  const reFacts = reItems.map(facts);
  const pkgOptions = pricing.packages.filter(visible);
  const pkgCounts = optionCounts(reFacts, { type: '' }, 'pkg', ['', ...pkgOptions.map((p) => p.id)]);
  const typeCounts = optionCounts(reFacts, { pkg: '' }, 'type', TYPE_FILTERS.map((t) => t.id));
  const reCard = (m, i) => `<article class="gcard gcard--${m.orientation}" data-i="${i}" data-kind="${m.type === 'video' ? 'video' : 'image'}"${i >= reBatch ? ' hidden' : ''}>
      <button type="button" class="gcard__open" aria-label="${m.type === 'video' ? 'Play' : 'View'} ${esc(m.title)}">
        <img src="${esc(galThumb(m))}" alt="${m.type === 'video' ? '' : esc(m.alt || m.title)}" loading="lazy" decoding="async">
        ${m.type === 'video' ? playIcon : ''}
      </button>
      <div class="gcard__meta"><p class="gcard__title">${esc(m.title)}</p><p class="gcard__sub">${esc([m.location, m.type === 'video' ? (m.orientation === 'vertical' ? 'Vertical reel' : 'Film') : 'Photo', m.capturedYear].filter(Boolean).join(' · '))}${m.packageIds.length ? ` · <span class="gcard__pkg">${esc(m.packageIds.map((id) => pkg[id]?.name).filter(Boolean).join(', '))}</span>` : ''} ${needsApproval(m.published === false ? { note: 'Unpublished: awaiting title, rights and tag checks' } : { approval: 'approved' })}</p></div>
    </article>`;
  const reGallery = () => `
<section class="section section--ink on-dark regallery" id="portfolio" aria-labelledby="rg-h" data-regallery data-player="${esc(reCfg.player || 'inline')}" data-batch="${reBatch}"${reviewMode ? ' data-allow-player-override' : ''}>
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Real estate portfolio</p><h2 class="h2 reveal" id="rg-h">Listings, filmed and photographed.</h2></div><a class="link-arrow" href="/work?category=real-estate">All work ${arrow}</a></div>
    <form class="filters filters--inline" data-rg-filters aria-label="Filter real estate work" onsubmit="return false">
      <div class="filters__field"><label for="rg-package">Package</label>
        <select id="rg-package" name="package"><option value="">All packages</option>${join(pkgOptions, (p) => `<option value="${p.id}">${esc(p.name)} (${pkgCounts[p.id]})</option>`)}</select></div>
      <div class="filters__field"><label for="rg-type">Media</label>
        <select id="rg-type" name="type">${join(TYPE_FILTERS.filter((t) => !t.id || typeCounts[t.id] > 0), (t) => `<option value="${t.id}">${esc(t.label)}${t.id ? ` (${typeCounts[t.id]})` : ''}</option>`)}</select></div>
      <button type="reset" class="filters__clear" hidden>Reset filters</button>
    </form>
    <p class="filters__count" id="rg-count" aria-live="polite">${reItems.length} pieces</p>
    <p class="regallery__note">We tag work with a package only after confirming what was delivered, so some pieces appear under All packages only.</p>
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

  pages['/real-estate'] = {
    overlay: true,
    scripts: ['compare.js', 're-gallery.js'],
    body: `${pageHero({
      eyebrow: 'Real estate media',
      title: 'Listing media that shows sellers <em>how you work.</em>',
      lede: 'Photography, cinematic video, vertical reels, drone and floor plans for Long Island, the Hamptons and the North Fork. The property sets the production plan. Your standard stays the same at every price point.',
      cta: `${bookBtn('re_hero')}<a class="link-arrow" href="/real-estate/pricing">See pricing ${arrow}</a>`,
      image: '/images/photografik-2027/curated/home-estate-exterior.webp', imageAlt: 'Modern home at dusk with a lit interior',
    })}
<section class="section">
  <div class="wrap">
    <p class="eyebrow">What goes into a listing campaign</p>
    <h2 class="h2 reveal">Enough coverage to tell the whole story. No padding.</h2>
    <div class="features">
      <div class="feature reveal" id="photography"><h3 class="h3">Photography</h3><p>A complete stills set, from room flow and material detail to the exterior setting. Vertical social-ready frames are included where they suit the property.</p></div>
      <div class="feature reveal" id="video"><h3 class="h3">Horizontal and vertical film</h3><p>Horizontal film plays on the listing page, YouTube and in your presentations. Vertical reels are made for Instagram, TikTok and Reels. We plan and shoot each format on purpose rather than cropping one into the other.</p></div>
      <div class="feature reveal" id="drone"><h3 class="h3">Drone</h3><p>Aerials show what a ground photo cannot: the water, the land, the neighborhood and how the home sits in it.</p></div>
      <div class="feature reveal" id="floor-plan"><h3 class="h3">Floor plans</h3><p>A schematic floor plan lets buyers understand the layout before they visit, so the people who book showings arrive better prepared.</p></div>
      <div class="feature reveal" id="twilight"><h3 class="h3">Twilight and day-to-night</h3><p>For launches that deserve it, twilight stills and day-to-night film carry the presentation into the evening.</p></div>
      <div class="feature reveal" id="agent"><h3 class="h3">You, on camera</h3><p>Optional. Listing Engine and Agent Engine turn the same shoot day into content about you, with coaching if the camera is not your favorite place.</p></div>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Packages</p><h2 class="h2 reveal">Start with the right package.</h2></div><div class="section-head__links"><a class="link-arrow" href="#compare">Compare what's included ${arrow}</a><a class="link-arrow" href="/real-estate/pricing">Pricing by property size ${arrow}</a></div></div>
    <div class="ladder ladder--4">
      ${join(pricing.packages.filter(visible), (p) => `
      <div class="ladder__item ${p.role === 'Recommended' ? 'ladder__item--featured' : ''}">
        ${p.role ? `<p class="tag">${esc(p.role === 'Premium' ? 'Premium anchor' : p.role)}</p>` : ''}
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
  const pkgMedia = {
    'luxury-media': { type: 'image', src: '/images/photografik-2027/curated/lauryn-card.webp', alt: 'White colonial listing at dusk, photographed for a Luxury Media campaign' },
    'signature': { type: 'image', src: '/images/photografik-2027/curated/home-estate-twilight.webp', alt: 'Shingle-style estate at twilight' },
    'social-media': { type: 'video', id: 'agent-on-camera' },
    'listing-starter': { type: 'image', src: '/images/photografik-2027/curated/agent-card.webp', alt: 'Open-plan kitchen and living room' },
  };
  const packageCard = (p) => {
    const pm = pkgMedia[p.id];
    let mediaHtml = '';
    if (pm?.type === 'video') { const m = media.find((x) => x.id === pm.id); if (m) mediaHtml = videoPlayer({ ...m, title: `${p.name} package example: ${m.title}` }); }
    else if (pm) mediaHtml = `<div class="pcard__still">${img(pm.src, { alt: pm.alt, sizes: '(min-width: 1000px) 33vw, 100vw' })}</div>`;
    return `<article class="pcard ${p.role === 'Recommended' ? 'pcard--featured' : ''}" data-record="${esc(p.id)}" aria-labelledby="pk-${esc(p.id)}">
      <div class="pcard__media">${mediaHtml}${p.role ? `<span class="pcard__badge">${esc(p.role === 'Premium' ? 'Premium anchor' : p.role)}</span>` : ''}</div>
      <div class="pcard__body">
        <h3 class="h3" id="pk-${esc(p.id)}">${esc(p.name)} ${needsApproval(p)}</h3>
        <p class="pcard__for">${esc(p.for)}</p>
        ${priceCell(p)}
        <ul class="checks">${join(includeLabels(p, pricing.features), (i) => `<li>${esc(i)}</li>`)}</ul>
        <a class="btn ${p.role === 'Recommended' ? 'btn--solid' : 'btn--outline'} pcard__cta" href="${booking}" data-track="book_click" data-track-location="pricing_card" data-track-package="${esc(p.id)}">Book ${esc(p.name)}</a>
      </div>
    </article>`;
  };
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
    { id: 'packages', label: 'Packages', html: `<div class="pcards">${join(pricing.packages.filter(visible), packageCard)}</div>` },
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
    <p class="lede">Enter the home's size, up to ${pricing.maxSqft.toLocaleString('en-US')} sq ft, and every package and service below updates to the same price you will see in our booking portal.</p>
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

    <div class="tabs" data-tabs>
      <div class="tabs__list" role="tablist" aria-label="Price categories">
        ${join(tabs, (t, i) => `<button type="button" role="tab" class="tabs__tab" id="tab-${t.id}" aria-controls="panel-${t.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t.label}</button>`)}
      </div>
      ${join(tabs, (t, i) => `<div class="tabs__panel" role="tabpanel" id="panel-${t.id}" aria-labelledby="tab-${t.id}" tabindex="0" ${i === 0 ? '' : 'hidden'}>${t.html}</div>`)}
    </div>

    <div class="pricing-notes">
      <p><strong>About these prices.</strong> These match our booking portal, HD Photo Hub. They are base prices, not an all-in total: travel fees and sales tax are added at checkout where they apply. Rental use, commercial property and non-standard licensing are quoted separately.</p>
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
  const agentVids = media.filter((m) => m.category === 'agent-content' && m.type === 'video').slice(0, 3);
  pages['/agent-content'] = {
    overlay: true,
    body: `${pageHero({
      eyebrow: 'Agent content',
      title: 'People hire agents they <em>already feel they know.</em>',
      lede: 'On-camera video that helps future sellers understand who you are and how you work before the first conversation. We handle the ideas, direction and editing. You bring what you know.',
      cta: `<a class="btn btn--solid" href="/contact?type=agent-content" data-track="retainer_click" data-track-location="agent_hero">Plan My Content</a>`,
    })}
<section class="section">
  <div class="wrap">
    <div class="vrow">${join(agentVids, (m) => mediaCard(m, { sizes: '(min-width: 900px) 25vw, 70vw' }))}</div>
  </div>
</section>
<section class="section section--tint">
  <div class="wrap">
    <p class="eyebrow">Listing Engine & Agent Engine</p>
    <h2 class="h2 reveal">Turn one shoot day into weeks of content.</h2>
    <div class="compare">
      <div class="compare__col"><h3 class="h3">Listing Engine</h3><p>Three to four short videos about the property and its launch cycle, such as Coming Soon, Just Listed, Under Contract and Just Sold, or a nearby lifestyle feature. Captured alongside the listing media, using the property footage.</p>${(() => { const e = engines.find((x) => x.id === 'listing-engine'); return e ? `<p class="price-line"><strong>${formatUSD(e.amount)}</strong> with a listing shoot, ${formatUSD(e.standalone)} on its own ${needsApproval(e)}</p>` : ''; })()}</div>
      <div class="compare__col"><h3 class="h3">Agent Engine</h3><p>Three to four videos about you, with the listing as a premium backdrop: the market, your town, your background, your process and what you do differently.</p>${(() => { const e = engines.find((x) => x.id === 'agent-engine'); return e ? `<p class="price-line"><strong>${formatUSD(e.amount)}</strong> with a listing shoot, ${formatUSD(e.standalone)} on its own ${needsApproval(e)}</p>` : ''; })()}</div>
    </div>
    ${(() => { const e = engines.find((x) => x.id === 'full-engine'); return e ? `<p class="aside-line">Both together as the Full Engine: <strong>${formatUSD(e.amount)}</strong> with a listing shoot, ${formatUSD(e.standalone)} on its own ${needsApproval(e)}</p>` : ''; })()}
  </div>
</section>
<section class="section">
  <div class="wrap narrow">
    <p class="eyebrow">Fair questions</p>
    <h2 class="h2 reveal">What agents usually ask us.</h2>
    <div class="qa">
      <div><h3 class="h3">“I hate being on camera.”</h3><p>Most people do at first. We coach delivery, help you find a natural opening line and keep takes short. A lot of the confidence comes from knowing exactly what you want to say.</p></div>
      <div><h3 class="h3">“I don't know what to say.”</h3><p>That part is on us. We bring structured ideas built around your market, your town and your process, and we write with you so it still sounds like you.</p></div>
      <div><h3 class="h3">“I can film this on my phone.”</h3><p>You can, and sometimes you should. What we add is the plan, the coaching, the quality and the consistency that make people remember you.</p></div>
    </div>
  </div>
</section>
${agentMonthly.length ? `<section class="section section--tint">
  <div class="wrap">
    <p class="eyebrow">Monthly content plans</p>
    <h2 class="h2 reveal">Stay visible between listings.</h2>
    <div class="plans">${join(agentMonthly, (o) => `<div class="plan reveal"><h3 class="h3">${esc(o.name)} ${needsApproval(o)}</h3><p class="plan__tag">${esc(o.tagline)}</p>
      <p class="plan__price"><strong>${formatUSD(o.monthly)}</strong>/month</p><p class="plan__alt">${formatUSD(o.contract)}/month on a 12-month contract, billed monthly</p>
      <ul class="checks">${join(o.scope, (s) => `<li>${esc(s)}</li>`)}</ul></div>`)}</div>
    ${visible(offers.socialManagementFrom) ? `<p class="aside-line">Social media management is available from ${formatUSD(offers.socialManagementFrom.amount)}/month. ${needsApproval(offers.socialManagementFrom)}</p>` : ''}
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
  const archMedia = media.filter((m) => m.category === 'architecture-design');
  pages['/architecture-design'] = {
    overlay: true,
    body: `${pageHero({
      eyebrow: 'Architecture & design',
      title: 'Your work, presented with <em>the care it was built with.</em>',
      lede: 'Project photography and film for builders, architects, interior designers and specialty trades. We plan coverage around how the work will be used, then define deliverables and licensing before the shoot.',
      cta: `<a class="btn btn--solid" href="/contact?type=architecture-design" data-track="project_click" data-track-location="arch_hero">Start a Project</a>`,
      image: '/images/photografik-2027/curated/yankee-card.webp', imageAlt: 'Great room with tall windows in an Amagansett home by Yankee Home Builders',
    })}
<section class="section section--ink on-dark">
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Project work</p><h2 class="h2 reveal">Recent projects.</h2></div><a class="link-arrow" href="/work?category=architecture-design">All architecture & design work ${arrow}</a></div>
    <div class="justified">${join(archMedia, (m) => mediaCard(m))}<span class="justified__spacer" aria-hidden="true"></span></div>
  </div>
</section>
<section class="section">
  <div class="wrap">
    <p class="eyebrow">How a project runs</p>
    <h2 class="h2 reveal">Planned before the camera comes out.</h2>
    <ol class="process">
      <li><h3>Brief</h3><p>The project, the design intent, and who will use the media: your portfolio, awards, partners, press or the client.</p></li>
      <li><h3>Shot plan</h3><p>Timing for light, the spaces and details that matter, and any process or construction story worth telling.</p></li>
      <li><h3>Usage and licensing</h3><p>Who can use what, where and for how long, agreed in writing before production.</p></li>
      <li><h3>Production</h3><p>Photography and film on site, coordinated around the homeowner, the build team and the weather.</p></li>
      <li><h3>Review and delivery</h3><p>An agreed review round, then delivery in the formats each stakeholder needs.</p></li>
    </ol>
  </div>
</section>
<section class="section section--brand on-dark">
  <div class="wrap cta-band">
    <h2 class="h2 reveal">Finished something worth showing?</h2>
    <p>Share the project, location and timing. We will come back with a plan and an estimate.</p>
    <a class="btn btn--gold" href="/contact?type=architecture-design" data-track="project_click" data-track-location="arch_final">Start a Project</a>
  </div>
</section>`,
  };

  // ---------- COMMERCIAL ----------
  const comMedia = media.filter((m) => m.category === 'commercial');
  const cp = offers.commercialProperty.filter(visible);
  const b2b = offers.businessMonthly.filter(visible);
  pages['/commercial'] = {
    overlay: true,
    body: `${pageHero({
      eyebrow: 'Commercial production',
      title: 'Consistent content, <em>without building an in-house team.</em>',
      lede: 'Brand photography, film, testimonials, podcasts and short-form content for healthcare, legal, hospitality, automotive and corporate teams. One partner for planning, production, editing and delivery.',
      cta: `<a class="btn btn--solid" href="/contact?type=commercial" data-track="project_click" data-track-location="com_hero">Start a Project</a>`,
      image: '/images/photografik-2027/curated/home-path-studio.webp', imageAlt: 'Lighting and camera setup during a studio production',
    })}
<section class="section">
  <div class="wrap two-col">
    <div>
      <p class="eyebrow">Project story</p>
      <h2 class="h2 reveal">RevivaLuxe</h2>
      <p>Brand photography and a vertical brand film for a medical-aesthetics practice, made to introduce the space and the people clients will meet.</p>
      <p><a class="link-arrow" href="/work/revivaluxe">View the project ${arrow}</a></p>
    </div>
    <div class="vrow vrow--2">${join(comMedia, (m) => mediaCard(m, { showMeta: false, sizes: '(min-width: 900px) 22vw, 45vw' }))}</div>
  </div>
</section>
<section class="section section--tint">
  <div class="wrap">
    <p class="eyebrow">What we take on</p>
    <h2 class="h2 reveal">An outsourced content function.</h2>
    <div class="features">
      <div class="feature reveal"><h3 class="h3">Brand and team photography</h3><p>People, spaces and services, photographed to match how you want to be seen.</p></div>
      <div class="feature reveal"><h3 class="h3">Film and short-form</h3><p>Brand films, testimonials, educational and executive content, cut for every channel you use.</p></div>
      <div class="feature reveal"><h3 class="h3">Podcasts and studio days</h3><p>Recorded at <a href="/creator-studios">Creator Studios</a> or on location, with direction and editing.</p></div>
      <div class="feature reveal"><h3 class="h3">Recurring production</h3><p>A monthly cadence so content keeps coming without you hiring four or five separate roles.</p></div>
    </div>
  </div>
</section>
${cp.length || b2b.length ? `<section class="section">
  <div class="wrap">
    <p class="eyebrow">Starting points</p>
    <h2 class="h2 reveal">Where standard scopes begin.</h2>
    <div class="two-col two-col--top">
      ${cp.length ? `<div><h3 class="h3">Commercial property photography</h3><ul class="prows prows--compact">${join(cp, (c) => `<li class="prow"><div class="prow__text"><p class="prow__name">${esc(c.name)} ${needsApproval(c)}</p></div><div class="prow__price"><strong>${formatUSD(c.amount)}${c.plus ? '+' : ''}</strong></div></li>`)}</ul><p class="small muted">Level is set by production scope, buildings, complexity and time, not square footage alone. Portfolio pricing is available for five or more properties a year.</p></div>` : ''}
      ${b2b.length ? `<div><h3 class="h3">Monthly business content</h3><ul class="prows prows--compact">${join(b2b, (o) => `<li class="prow"><div class="prow__text"><p class="prow__name">${esc(o.name)} ${needsApproval(o)}</p><p class="prow__detail">${esc(o.scope.join(' · '))}</p></div><div class="prow__price"><strong>${formatUSD(o.monthly)}</strong>/mo<br><span class="small muted">${formatUSD(o.contract)}/mo on 12 months</span></div></li>`)}</ul><p class="small muted">12-month rates are billed monthly. Larger annual programs are planned with you.</p></div>` : ''}
    </div>
  </div>
</section>` : ''}
<section class="section section--brand on-dark">
  <div class="wrap cta-band">
    <h2 class="h2 reveal">Tell us what you need to make.</h2>
    <p>A short call is the fastest way to scope a campaign or a recurring program.</p>
    <a class="btn btn--gold" href="/contact?type=commercial" data-track="project_click" data-track-location="com_final">Start a Project</a>
  </div>
</section>`,
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
  pages['/creator-studios'] = {
    overlay: true,
    body: `${pageHero({
      eyebrow: 'Creator Studios · Bohemia, NY',
      title: 'A studio, and a team <em>that helps you sound like yourself.</em>',
      lede: 'Podcasts, interviews and studio content with hands-on production support: ideas, scripts, pacing, delivery and retakes. Not just a room with cameras.',
      cta: `<a class="btn btn--solid" href="${creatorHref}" data-track="creator_click" data-track-location="creator_hero">Request a Studio Session</a> ${needsApproval({ approval: site.destinations.creatorBooking.verified ? 'approved' : 'pending' }, 'Booking destination not confirmed')}`,
      image: '/images/photografik-2027/curated/creator-project-card.webp', imageAlt: 'Guest speaking into a microphone during a Creator Studios podcast recording',
    })}
<section class="section">
  <div class="wrap">
    <p class="eyebrow">Sessions</p>
    <h2 class="h2 reveal">Two ways to start.</h2>
    <div class="plans plans--2">${join(sessions, (s) => `<div class="plan reveal"><h3 class="h3">${esc(s.name)} ${needsApproval(s)}</h3><p class="plan__price">Starting at <strong>${formatUSD(s.amount)}</strong></p><p>${esc(s.detail)}</p></div>`)}</div>
    <p class="aside-line">Editing and clip packages are being updated. Ask us about them when you book.</p>
  </div>
</section>
<section class="section section--tint">
  <div class="wrap two-col">
    <div>
      <p class="eyebrow">Production support</p>
      <h2 class="h2 reveal">We do more than press record.</h2>
      <p>We help shape the idea and the script, coach pacing and delivery, suggest a retake when a moment could be stronger and use the sets to their best effect. You leave with content that has a better chance of landing.</p>
      <p><a class="link-arrow" href="/work/creator-studios">See a studio project ${arrow}</a></p>
    </div>
    <div class="two-col__media">${img('/images/photografik-2027/curated/creator-project-hero.webp', { alt: 'Podcast guest recording on set at Creator Studios', sizes: '(min-width: 900px) 40vw, 100vw' })}</div>
  </div>
</section>
<section class="section section--ink on-dark">
  <div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Recorded here</p><h2 class="h2 reveal">Clips from recent sessions.</h2></div><a class="link-arrow" href="/work?category=creator-studios">More studio work ${arrow}</a></div>
    <div class="justified">${join(media.filter((m) => m.category === 'creator-studios' && m.type === 'video'), (m) => mediaCard(m))}<span class="justified__spacer" aria-hidden="true"></span></div>
  </div>
</section>
<section class="section section--brand on-dark">
  <div class="wrap cta-band">
    <h2 class="h2 reveal">Ready to record?</h2>
    <a class="btn btn--gold" href="${creatorHref}" data-track="creator_click" data-track-location="creator_final">Request a Studio Session</a>
  </div>
</section>`,
  };

  // ---------- WORK ----------
  const usedSvc = work.taxonomy.service.filter((t) => media.some((m) => m.service.includes(t.id)));
  const usedCat = work.taxonomy.category.filter((t) => media.some((m) => m.category === t.id));
  pages['/work'] = {
    scripts: ['gallery.js'],
    dark: true,
    body: `
<section class="section work-head on-dark">
  <div class="wrap">
    <p class="eyebrow">Selected work</p>
    <h1 class="display">Find the work that fits.</h1>
    <form class="filters" data-filters aria-label="Filter work" onsubmit="return false">
      <div class="filters__field"><label for="f-service">Service type</label>
        <select id="f-service" name="service"><option value="">All</option>${join(usedSvc, (t) => `<option value="${t.id}">${esc(t.label)}</option>`)}</select></div>
      <div class="filters__field"><label for="f-category">Industry</label>
        <select id="f-category" name="category"><option value="">All</option>${join(usedCat, (t) => `<option value="${t.id}">${esc(t.label)}</option>`)}</select></div>
      <button type="reset" class="filters__clear" hidden>Clear filters</button>
    </form>
    <p class="filters__count" id="work-count" aria-live="polite">${media.length} pieces</p>
  </div>
</section>
<section class="section section--ink on-dark work-grid-section">
  <div class="wrap">
    <div class="justified" id="work-grid">${join(media, (m) => mediaCard(m))}<span class="justified__spacer" aria-hidden="true"></span></div>
    <div class="empty" id="work-empty" hidden>
      <p class="h3">Nothing matches both filters yet.</p>
      <p>We only show real projects. Try another combination, or tell us what you are planning.</p>
      <p><button type="button" class="btn btn--gold" data-clear-filters>Clear filters</button> <a class="link-arrow" href="/contact">Start a Project ${arrow}</a></p>
    </div>
  </div>
</section>
${splitCta('Have a project like these?')}`,
  };

  // ---------- WORK DETAIL ----------
  for (const p of work.projects.filter(visible)) {
    const pm = media.filter((m) => m.project === p.slug);
    const related = media.filter((m) => m.project !== p.slug && m.category === p.category).slice(0, 3);
    const isRE = p.category === 'real-estate';
    const cta = isRE ? bookBtn('project_detail') : `<a class="btn btn--solid" href="/contact?type=${esc(p.category)}" data-track="project_click" data-track-location="project_detail">Start a Project</a>`;
    pages[`/work/${p.slug}`] = {
      seo: { title: `${p.title} | ${catLabel[p.category]} | Photografik`, description: p.summary, image: p.hero },
      body: `
<article class="project">
  <header class="section project__head">
    <div class="wrap project__grid project__grid--${p.heroOrientation}">
      <div class="project__intro">
        <p class="eyebrow"><a href="/work?category=${esc(p.category)}">${esc(catLabel[p.category])}</a> · ${esc(p.location)}</p>
        <h1 class="display">${esc(p.title)}</h1>
        <p class="lede">${esc(p.story)}</p>
        <dl class="project__facts"><div><dt>Services</dt><dd>${esc(p.services.join(', '))}</dd></div><div><dt>Location</dt><dd>${esc(p.location)}</dd></div>${p.client ? `<div><dt>Client</dt><dd>${esc(p.client)}</dd></div>` : ''}</dl>
        <div class="actions">${cta}</div>
      </div>
      <div class="project__hero">${img(p.hero, { alt: p.heroAlt, eager: true, sizes: '(min-width: 900px) 55vw, 100vw' })}</div>
    </div>
  </header>
  ${pm.length ? `<section class="section section--ink on-dark"><div class="wrap"><h2 class="h2 reveal">From the project</h2><div class="justified">${join(pm, (m) => mediaCard(m))}<span class="justified__spacer" aria-hidden="true"></span></div></div></section>` : ''}
  ${related.length ? `<section class="section"><div class="wrap"><div class="section-head"><h2 class="h2 reveal">Related work</h2><a class="link-arrow" href="/work?category=${esc(p.category)}">More ${esc(catLabel[p.category])} ${arrow}</a></div><div class="justified">${join(related, (m) => mediaCard(m))}<span class="justified__spacer" aria-hidden="true"></span></div></div></section>` : ''}
</article>`,
    };
  }

  // ---------- ABOUT ----------
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
    body: `<section class="page-hero page-hero--compact on-dark"><div class="wrap page-hero__inner"><p class="eyebrow">404</p><h1 class="display">That page has moved.</h1><p class="lede">Try one of these instead.</p><div class="actions"><a class="btn btn--gold" href="/">Home</a><a class="link-arrow" href="/work">Work ${arrow}</a><a class="link-arrow" href="/real-estate/pricing">Pricing ${arrow}</a></div></div></section>`,
  };

  return pages;
}
