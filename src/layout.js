import { esc, attrs, join } from './lib/html.js';

export function layout(ctx, { route, body, seo, jsonLd, scripts = [], dark = false, overlay = false, ogType = 'website' }) {
  const { site, reviewMode, img, mediaUrl } = ctx;
  const canonical = site.canonicalOrigin + (route === '/' ? '/' : route);
  const booking = site.destinations.booking.href;
  const isActive = (href) => (href === '/' ? route === '/' : route === href || route.startsWith(href + '/'));

  const navItems = join(site.nav, (n) => `<li class="nav__item">
      <a class="nav__link" href="${n.href}" ${isActive(n.href) ? 'aria-current="page"' : ''}>${esc(n.label)}</a>
      ${n.children ? `<ul class="nav__sub">${join(n.children.filter((c) => c.href !== n.href), (c) => `<li><a href="${c.href}" ${route === c.href ? 'aria-current="page"' : ''}>${esc(c.label)}</a></li>`)}</ul>` : ''}
    </li>`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<script>document.documentElement.classList.add('js')</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(seo.title)}</title>
<meta name="description" content="${esc(seo.description)}">
<link rel="canonical" href="${esc(canonical)}">
${reviewMode ? '<meta name="robots" content="noindex, nofollow">' : ''}
<meta property="og:type" content="${esc(ogType)}">
<meta property="og:site_name" content="Photografik Studios">
<meta property="og:title" content="${esc(seo.title)}">
<meta property="og:description" content="${esc(seo.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc((() => { const u = mediaUrl(seo.image || site.media.hero); return u.startsWith('/') ? site.canonicalOrigin + u : u; })())}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#212623">
<link rel="icon" href="${esc(ctx.optimized(site.media.logo, 480))}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;1,9..40,400&family=Space+Mono&display=swap">
<link rel="stylesheet" href="/assets/styles.css?v=${ctx.version}">
${join([].concat(jsonLd || []), (j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`)}
</head>
<body class="${[dark ? 'page--dark' : '', overlay ? 'has-overlay' : '', reviewMode ? 'has-review-bar' : ''].join(' ').trim()}">
<a class="skip" href="#main">Skip to content</a>
${reviewMode ? `<div class="review-bar" role="note"><strong>Review version</strong> · Pricing pending sign-off<span class="review-bar__long">. Not the approved public site: policies and items tagged <span class="needs-approval">Needs approval</span> are also awaiting sign-off</span>.</div>` : ''}
<header class="site-header">
  <div class="wrap site-header__inner">
    <a class="brand" href="/" aria-label="Photografik Studios, home">
      ${img(site.media.logo, { alt: '', widths: [480], sizes: '40px', cls: 'brand__logo', eager: true, width: 40, height: 40 })}
      <span class="brand__name">Photografik <span>Studios</span></span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="menu-toggle__bars" aria-hidden="true"></span><span class="menu-toggle__label">Menu</span></button>
    <nav id="site-nav" class="nav" aria-label="Main">
      <ul class="nav__list">${navItems}</ul>
      <a class="btn btn--small nav__cta" href="${booking}" data-track="book_click" data-track-location="header">Book a Shoot</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap site-footer__grid">
    <div>
      <p class="site-footer__brand">Photografik<br><em>Studios</em></p>
      <p class="muted">${esc(site.serviceArea)}</p>
      <p><a href="mailto:${site.email}">${site.email}</a><br><a href="${site.phoneHref}">${site.phone}</a></p>
    </div>
    <nav aria-label="Footer">
      <ul class="site-footer__links">${join(site.footerNav, (l) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`)}</ul>
    </nav>
    <div>
      <p class="eyebrow">Ready to book?</p>
      <p><a class="btn btn--rust" href="${booking}" data-track="book_click" data-track-location="footer">Book a Shoot</a></p>
      <p><a class="link-arrow" href="/contact">Start a Project</a></p>
      <ul class="site-footer__social">${join(site.social, (s) => `<li><a href="${s.href}" rel="noopener">${esc(s.label)}</a></li>`)}</ul>
    </div>
  </div>
  <div class="wrap site-footer__base"><p>© ${new Date().getFullYear()} Photografik Studios Inc.</p></div>
</footer>
<script type="module" src="/assets/site.js?v=${ctx.version}"></script>
${join(scripts, (s) => `<script type="module" src="/assets/${s}?v=${ctx.version}"></script>`)}
</body>
</html>`;
}
