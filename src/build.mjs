// Static site build. Usage: node src/build.mjs
// Reads /content/*.json, renders pages to /dist, copies assets.
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createContext } from './lib/html.js';
import { validatePricing } from './lib/pricing-core.js';
import { validateMedia } from './lib/gallery-core.js';
import { validateFieldNotes, legacyLaunchBlockers } from './lib/field-notes-core.js';
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

const [site, pricing, work, offers, faqs, seo, fieldNotes, legacyArticles] = await Promise.all(
  ['site.json', 'pricing.json', 'work.json', 'offers.json', 'faqs.json', 'seo.json', 'field-notes.json', 'legacy-articles.json'].map(readJSON),
);
const fnErrors = validateFieldNotes(fieldNotes, legacyArticles, work);
if (fnErrors.length) { console.error('Field Notes errors:\n - ' + fnErrors.join('\n - ')); process.exit(1); }

const errors = validatePricing(pricing);
if (errors.length) { console.error('Pricing table errors:\n - ' + errors.join('\n - ')); process.exit(1); }

const mediaErrors = validateMedia(work, pricing.packages.map((p) => p.id));
// Rights gate: media whose rights/consent James has not confirmed never enters a deployed build, in any mode.
// REVIEW mode (and the public review alias) is not private, so noindex/published:false do not protect people's images.
// Local-only candidate review: INCLUDE_RIGHTS_PENDING=1 node src/build.mjs (never set this on Vercel).
const rightsPending = work.media.filter((m) => m.rights !== 'approved');
if (process.env.INCLUDE_RIGHTS_PENDING !== '1') work.media = work.media.filter((m) => m.rights === 'approved');
if (rightsPending.length) console.log(`Rights gate: ${rightsPending.length} media record(s) awaiting James's rights/consent ${process.env.INCLUDE_RIGHTS_PENDING === '1' ? 'INCLUDED (local candidate review only)' : 'excluded'}.`);
if (mediaErrors.length) { console.error('Media metadata errors:\n - ' + mediaErrors.join('\n - ')); process.exit(1); }

const isApproved = (r) => (r.approval ?? r.rights ?? 'approved') === 'approved';
// Media also needs published !== false: new Drive additions stay out of production until checked.
const visible = (r) => reviewMode || (isApproved(r) && r.published !== false);

if (!reviewMode) {
  const pending = pricing.packages.filter((r) => !isApproved(r)).map((r) => r.name);
  if (pricing.releaseApproved !== true) {
    console.error('Production build blocked: content/pricing.json "releaseApproved" is not true. The HD Photo Hub reconciliation needs sign-off first.');
    process.exit(1);
  }
  const blockers = legacyLaunchBlockers(fieldNotes, legacyArticles);
  if (blockers.length) {
    console.error('Production build blocked: legacy article URLs without an approved destination:\n - ' + blockers.join('\n - ') + '\nPublish the target Field Note or record James\'s decision (approvedBy) in content/legacy-articles.json.');
    process.exit(1);
  }
  if (pending.length) {
    console.error(`Production build blocked: these residential packages are not approved yet: ${pending.join(', ')}.\nSet "approval": "approved" in content/pricing.json after sign-off. Other pending items are hidden automatically.`);
    process.exit(1);
  }
}

const version = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 8);
const ctx = { site, pricing, work, offers, faqs, fieldNotes, reviewMode, visible, version, ...createContext({ site, reviewMode, onVercel }) };
const pages = buildPages(ctx);
// Field Notes appears in navigation only when it has at least one visible article.
if (!pages['/field-notes']) {
  site.nav = site.nav.filter((n) => n.href !== '/field-notes');
  site.footerNav = site.footerNav.filter((n) => n.href !== '/field-notes');
}

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
  const html = layout(ctx, { route, body: page.body, seo: pageSeo, scripts: page.scripts, dark: page.dark, overlay: page.overlay, ogType: page.ogType, jsonLd: route === '/' ? orgLd : page.jsonLd || null });
  const file = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
  await mkdir(dirname(join(out, file)), { recursive: true });
  await writeFile(join(out, file), html);
  if (route !== '/404') routes.push(route);
}

// Committed media (owner-supplied stills, and legacy assets once committed) are served at the same path.
if (existsSync(join(root, 'static'))) await cp(join(root, 'static'), out, { recursive: true });

// Assets
await cp(join(root, 'src/assets'), join(out, 'assets'), { recursive: true });
await cp(join(root, 'src/lib/pricing-core.js'), join(out, 'assets/pricing-core.js'));
await cp(join(root, 'src/lib/gallery-core.js'), join(out, 'assets/gallery-core.js'));
// Assets are cached as immutable: version relative module imports the same way the page tags are.
for (const f of await readdir(join(out, 'assets'))) {
  if (!f.endsWith('.js')) continue;
  const fp = join(out, 'assets', f);
  const js = await readFile(fp, 'utf8');
  const next = js.replace(/(from\s+['"]\.\/[\w-]+\.js)(['"])/g, `$1?v=${version}$2`);
  if (next !== js) await writeFile(fp, next);
}

// robots + sitemap (canonical production URLs only; review builds disallow crawling)
await writeFile(join(out, 'robots.txt'), reviewMode
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\n\nSitemap: ${site.canonicalOrigin}/sitemap.xml\n`);
const publishedNote = (r) => fieldNotes.articles.some((a) => `/field-notes/${a.slug}` === r && a.status === 'published' && a.approvedBy);
const sitemapRoutes = routes.filter((r) => (!r.startsWith('/work/') || work.projects.find((p) => `/work/${p.slug}` === r && isApproved(p)))
  && (!r.startsWith('/field-notes/') || publishedNote(r))
  && (r !== '/field-notes' || fieldNotes.articles.some((a) => a.status === 'published' && a.approvedBy)));
await writeFile(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapRoutes.map((r) => `  <url><loc>${site.canonicalOrigin}${r === '/' ? '/' : r}</loc></url>`).join('\n')}\n</urlset>\n`);

console.log(`Built ${routes.length + 1} pages in ${reviewMode ? 'REVIEW' : 'PRODUCTION'} mode${onVercel ? ' (Vercel image optimization on)' : ''}.`);
