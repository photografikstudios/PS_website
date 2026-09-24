// Static site build. Usage: node src/build.mjs
// Reads /content/*.json, renders pages to /dist, copies assets.
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext } from './lib/html.js';
import { validatePricing } from './lib/pricing-core.js';
import { layout } from './layout.js';
import { buildPages } from './pages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const readJSON = async (f) => JSON.parse(await readFile(join(root, 'content', f), 'utf8'));

// Review mode shows items awaiting approval with a visible marker and sets noindex.
// Production (VERCEL_ENV=production or SITE_MODE=production) hides them and fails the build
// if a required record is not approved, so unapproved prices can never go live by accident.
const vercelEnv = process.env.VERCEL_ENV || '';
const siteMode = process.env.SITE_MODE || (vercelEnv === 'production' ? 'production' : 'review');
const reviewMode = siteMode !== 'production';
const onVercel = !!process.env.VERCEL && process.env.LOCAL_IMAGES !== '1';

const [site, pricing, work, offers, faqs, seo] = await Promise.all(
  ['site.json', 'pricing.json', 'work.json', 'offers.json', 'faqs.json', 'seo.json'].map(readJSON),
);

const errors = validatePricing(pricing);
if (errors.length) { console.error('Pricing table errors:\n - ' + errors.join('\n - ')); process.exit(1); }

const isApproved = (r) => (r.approval ?? r.rights ?? 'approved') === 'approved';
const visible = (r) => reviewMode || isApproved(r);

if (!reviewMode) {
  const pending = pricing.packages.filter((r) => !isApproved(r)).map((r) => r.name);
  if (pending.length) {
    console.error(`Production build blocked: these residential packages are not approved yet: ${pending.join(', ')}.\nSet "approval": "approved" in content/pricing.json after sign-off. Other pending items are hidden automatically.`);
    process.exit(1);
  }
}

const version = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 8);
const ctx = { site, pricing, work, offers, faqs, reviewMode, visible, version, ...createContext({ site, reviewMode, onVercel }) };
const pages = buildPages(ctx);

await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'assets'), { recursive: true });

const orgLd = {
  '@context': 'https://schema.org', '@type': 'ProfessionalService', name: site.name, url: site.canonicalOrigin,
  email: site.email, telephone: '+1-631-998-9661', areaServed: ['Long Island', 'The Hamptons', 'North Fork', 'Suffolk County', 'Nassau County', 'New York City'],
  sameAs: site.social.map((s) => s.href),
};

const routes = [];
for (const [route, page] of Object.entries(pages)) {
  const pageSeo = page.seo || seo[route] || seo['/'];
  const html = layout(ctx, { route, body: page.body, seo: pageSeo, scripts: page.scripts, dark: page.dark, overlay: page.overlay, jsonLd: route === '/' ? orgLd : null });
  const file = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
  await mkdir(dirname(join(out, file)), { recursive: true });
  await writeFile(join(out, file), html);
  if (route !== '/404') routes.push(route);
}

// Assets
await cp(join(root, 'src/assets'), join(out, 'assets'), { recursive: true });
await cp(join(root, 'src/lib/pricing-core.js'), join(out, 'assets/pricing-core.js'));

// robots + sitemap (canonical production URLs only; review builds disallow crawling)
await writeFile(join(out, 'robots.txt'), reviewMode
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\n\nSitemap: ${site.canonicalOrigin}/sitemap.xml\n`);
const sitemapRoutes = routes.filter((r) => !r.startsWith('/work/') || work.projects.find((p) => `/work/${p.slug}` === r && isApproved(p)));
await writeFile(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapRoutes.map((r) => `  <url><loc>${site.canonicalOrigin}${r === '/' ? '/' : r}</loc></url>`).join('\n')}\n</urlset>\n`);

console.log(`Built ${routes.length + 1} pages in ${reviewMode ? 'REVIEW' : 'PRODUCTION'} mode${onVercel ? ' (Vercel image optimization on)' : ''}.`);
