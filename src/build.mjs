// Static site build. Usage: node src/build.mjs
// Reads /content/*.json, renders pages to /dist, copies assets.
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { createContext } from './lib/html.js';
import { validatePricing } from './lib/pricing-core.js';
import { validateMedia } from './lib/gallery-core.js';
import { checkFieldNotes, legacyLaunchBlockers } from './lib/field-notes-core.js';
import { loadFieldNotes, makeFileExists } from './lib/field-notes-load.js';
import { layout } from './layout.js';
import { buildPages } from './pages.js';
import { cmsConfig } from './lib/cms-config.js';
import { validateLegal } from './lib/legal-core.js';
import { loadWork, staticFile } from './lib/work-load.js';
import { checkContent, holdDashboardProjects, applyReviewOnly } from './lib/content-check.js';
import { imageSize } from './lib/image-size.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Rights-pending candidates are a local, owner-only review. They can never be built on Vercel or CI, and they go to a
// separate dist-candidates/ folder, so the deployable dist/ cannot contain them even by mistake.
const candidateBuild = process.env.INCLUDE_RIGHTS_PENDING === '1';
if (candidateBuild && (process.env.VERCEL || process.env.CI || process.env.VERCEL_ENV)) {
  console.error('Refusing to build: INCLUDE_RIGHTS_PENDING=1 is set in a Vercel/CI environment. Rights-pending media never enter a deployable build.');
  process.exit(1);
}
// Local check of what production would publish (tests only): production visibility rules, launch blockers reported
// but not enforced, written to dist-prodcheck/. Refused on Vercel/CI so it can never produce a deployable build.
const prodCheck = process.env.PRODUCTION_VISIBILITY_CHECK === '1';
if (prodCheck && (process.env.VERCEL || process.env.CI || process.env.VERCEL_ENV)) { console.error('Refusing PRODUCTION_VISIBILITY_CHECK on Vercel/CI.'); process.exit(1); }
const out = join(root, candidateBuild ? 'dist-candidates' : prodCheck ? 'dist-prodcheck' : 'dist');
const readJSON = async (f) => JSON.parse(await readFile(join(root, 'content', f), 'utf8'));

// Review mode shows items awaiting approval with a visible marker and sets noindex.
// Production (VERCEL_ENV=production or SITE_MODE=production) hides them and fails the build
// if a required record is not approved, so unapproved prices can never go live by accident.
const vercelEnv = process.env.VERCEL_ENV || '';
const siteMode = prodCheck ? 'production' : process.env.SITE_MODE || (vercelEnv === 'production' ? 'production' : 'review');
const reviewMode = siteMode !== 'production';
const onVercel = !!process.env.VERCEL && process.env.LOCAL_IMAGES !== '1';

const [site, pricing, offers, faqs, seo, legacyArticles, testimonials, mediaAssets, legal, pageText, faqsPolicy] = await Promise.all(
  ['site.json', 'pricing.json', 'offers.json', 'faqs.json', 'seo.json', 'legacy-articles.json', 'testimonials.json', 'media-assets.json', 'legal.json', 'pages.json', 'faqs-policy.json'].map(readJSON),
);
// Portfolio: one file per project and per photo/film (content/projects, content/media), edited through /admin.
const work = await loadWork(root);
if (work.loadErrors.length) { console.error('Portfolio file errors:\n - ' + work.loadErrors.join('\n - ')); process.exit(1); }
delete work.loadErrors;
const legalErrors = validateLegal(legal);
if (legalErrors.length) { console.error('Legal page errors:\n - ' + legalErrors.join('\n - ')); process.exit(1); }
// Field Notes: one Markdown file per article (content/field-notes/*.md), edited through /admin.
const { fieldNotes, parseErrors } = await loadFieldNotes(root);
const fnCheck = checkFieldNotes(fieldNotes, legacyArticles, work, { fileExists: makeFileExists(root, new Set(Object.keys(mediaAssets.files || {}))) });
for (const w of fnCheck.warnings) console.warn(`Field Notes draft note: ${w}`);
const fnErrors = [...parseErrors, ...fnCheck.errors];
if (fnErrors.length) { console.error('Field Notes errors:\n - ' + fnErrors.join('\n - ')); process.exit(1); }
// Dashboard content (projects, photos and films, page text, testimonials, FAQs): published records are strict.
const fileExists = makeFileExists(root, new Set(Object.keys(mediaAssets.files || {})));
const imageInfo = (p) => { const f = staticFile(root, p); return f && existsSync(f) ? imageSize(readFileSync(f)) : null; };
const reviewOnly = applyReviewOnly(work, reviewMode);
let contentCheck = checkContent({ work, fileExists, imageInfo, pageText, testimonials, faqs });
// A project James publishes from the dashboard with something missing is held back as a draft instead of stopping
// the whole site from updating (Oct 3 2026: his first save never deployed and the dashboard could not tell him why).
// The reasons go on its review page and into /admin/status.json, which the dashboard shows on the project itself.
// The original projects and everything else stay strict.
const held = holdDashboardProjects(work, contentCheck.errors);
if (held.length) {
  console.warn('Held back as drafts until fixed in /admin:\n - ' + held.map((h) => `${h.title}: ${h.reasons.join('; ')}`).join('\n - '));
  contentCheck = checkContent({ work, fileExists, imageInfo, pageText, testimonials, faqs });
}
for (const w of contentCheck.warnings) console.warn(`Content note: ${w}`);
if (contentCheck.errors.length) { console.error('Content errors (fix them in /admin; the live site keeps the previous version until then):\n - ' + contentCheck.errors.join('\n - ')); process.exit(1); }
// FAQs: the editable answers (content/faqs.json, /admin) first, then the policy answers kept on the review path.
for (const [page, list] of Object.entries(faqsPolicy)) if (Array.isArray(list)) faqs[page] = [...(faqs[page] || []), ...list];

const errors = validatePricing(pricing);
if (errors.length) { console.error('Pricing table errors:\n - ' + errors.join('\n - ')); process.exit(1); }

const mediaErrors = validateMedia(work, pricing.packages.map((p) => p.id));
// Rights gate: media whose rights/consent James has not confirmed never enters a deployed build, in any mode.
// REVIEW mode (and the public review alias) is not private, so noindex/published:false do not protect people's images.
// Local-only candidate review: INCLUDE_RIGHTS_PENDING=1 node src/build.mjs writes dist-candidates/ and refuses to run on Vercel/CI.
const rightsPending = work.media.filter((m) => m.rights !== 'approved');
if (!candidateBuild) work.media = work.media.filter((m) => m.rights === 'approved');
if (rightsPending.length) console.log(`Rights gate: ${rightsPending.length} media record(s) awaiting James's rights/consent ${candidateBuild ? 'INCLUDED in dist-candidates/ (local owner review only)' : 'excluded'}.`);
if (mediaErrors.length) { console.error('Media metadata errors:\n - ' + mediaErrors.join('\n - ')); process.exit(1); }

const isApproved = (r) => (r.approval ?? r.rights ?? 'approved') === 'approved';
// Media also needs published !== false: new Drive additions stay out of production until checked.
const visible = (r) => reviewMode || (isApproved(r) && r.published !== false);

if (!reviewMode && !prodCheck) {
  const pending = pricing.packages.filter((r) => !isApproved(r)).map((r) => r.name);
  if (pricing.releaseApproved !== true) {
    console.error('Production build blocked: content/pricing.json "releaseApproved" is not true. James approved the prices, tiers and inclusions on Sep 30; Vye’s square-footage verification against HD Photo Hub must be recorded first.');
    process.exit(1);
  }
  if (legal.ready !== true) {
    console.error('Production build blocked: content/legal.json is not ready. /terms and /licensing need the complete text of Photografik_Studios_Website_Terms_and_Licensing.docx (effective September 30, 2026).');
    process.exit(1);
  }
  const blockers = legacyLaunchBlockers(fieldNotes, legacyArticles);
  if (blockers.length) {
    console.error('Production build blocked: legacy article URLs without an approved destination:\n - ' + blockers.join('\n - ') + '\nPublish the target Field Note or record James\'s decision (approvedBy) in content/legacy-articles.json.');
    process.exit(1);
  }
  // WCAG 1.2.2: published clips with speech need captions (a VTT track or burned-in) before launch.
  const uncaptioned = work.media.filter((m) => m.type === 'video' && m.published !== false && m.dialogue !== false && (!m.captions || (m.captions !== 'burned-in' && m.captionsStatus !== 'approved'))).map((m) => m.id);
  if (uncaptioned.length) {
    console.error(`Production build blocked: video with speech (or unconfirmed speech) lacking approved captions: ${uncaptioned.join(', ')}.\nAdd a captions .vtt and set "captionsStatus": "approved" once proofread (or "burned-in"), or set "dialogue": false after checking the audio.`);
    process.exit(1);
  }
  if (pending.length) {
    console.error(`Production build blocked: these residential packages are not approved yet: ${pending.join(', ')}.\nSet "approval": "approved" in content/pricing.json after sign-off. Other pending items are hidden automatically.`);
    process.exit(1);
  }
}

const version = (process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 8);
const ctx = { site, pricing, work, offers, faqs, fieldNotes, testimonials, legal, pageText, reviewMode, visible, version, ...createContext({ site, reviewMode, onVercel }) };
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
  const html = layout(ctx, { route, body: page.body, seo: pageSeo, scripts: page.scripts, dark: page.dark, overlay: page.overlay, ogType: page.ogType, articleDates: page.articleDates, jsonLd: route === '/' ? orgLd : page.jsonLd || null });
  const file = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
  await mkdir(dirname(join(out, file)), { recursive: true });
  await writeFile(join(out, file), html);
  if (route !== '/404') routes.push(route);
}

// Committed media (owner-supplied stills, and legacy assets once committed) are served at the same path.
if (existsSync(join(root, 'static'))) await cp(join(root, 'static'), out, { recursive: true });

// Every hero's phone still (src/lib/html.js heroPhoneStill) must be committed, or phones would show no still.
{ const missing = new Set();
  for (const f of (await readdir(out, { recursive: true })).filter((f) => f.endsWith('.html'))) {
    for (const m of (await readFile(join(out, f), 'utf8')).matchAll(/srcset="(\/images\/hero\/[\w-]+-phone\.webp)"/g)) if (!existsSync(join(out, m[1]))) missing.add(m[1]);
  }
  if (missing.size) { console.error(`Missing hero phone stills (commit them under static/): ${[...missing].join(', ')}`); process.exit(1); } }

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

// Site dashboard (/admin): Decap CMS, Git-backed. Commits go to the branch this deployment was built from.
{
  const decap = JSON.parse(await readFile(join(root, 'src/admin/decap.json'), 'utf8'));
  const branch = process.env.CMS_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'redesign/2027-preview';
  const repo = process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}` : 'photografikstudios/PS_website';
  const { config, library, categories } = cmsConfig({ site, fieldNotes, work, branch, repo, testimonials });
  const safe = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  await mkdir(join(out, 'admin'), { recursive: true });
  const adminHtml = (await readFile(join(root, 'src/admin/index.html'), 'utf8'))
    .replaceAll('__DECAP_VERSION__', decap.version).replaceAll('__DECAP_SRI__', decap.integrity).replaceAll('__VERSION__', version);
  await writeFile(join(out, 'admin/index.html'), adminHtml);
  // Thumbnails for the dashboard's collection lists and photo picker (James, Oct 2 2026: every photo on the site must
  // show a preview in the back end). Deployed site URLs, small -sm.webp versions where they exist.
  const assetSet = new Set(Object.keys(mediaAssets.files || {}));
  const small = (u) => { if (!u) return null; const sm = String(u).replace(/\.webp$/, '-sm.webp'); return sm !== u && assetSet.has(sm) ? sm : u; };
  const thumbs = { photos: {}, films: {}, projects: {}, pick: [] };
  // A film's still: its poster, else the .webp still the media step keeps beside a /v/ film.
  const still = (m) => m.poster || (m.src && /\.mp4$/.test(m.src) && assetSet.has(m.src.replace(/\.mp4$/, '.webp')) ? m.src.replace(/\.mp4$/, '.webp') : null);
  // Every record the dashboard lists, including ones the site holds back (withheld rights, drafts), gets its preview.
  const everything = await loadWork(root);
  // /v/ files of records still waiting on rights are not published by the media step, so they get no thumbnail URL.
  const served = (m, u) => u && (m.rights === 'approved' || !String(u).startsWith('/v/')) ? u : null;
  for (const m of everything.media) {
    if (m.fromProject) continue;
    if (m.type === 'image' && m.src) { const u = served(m, small(m.src)); if (u) thumbs.photos[m.id] = u; }
    else { const u = served(m, still(m) && small(still(m))); if (u) thumbs.films[m.id] = u; }
  }
  for (const p of everything.projects) {
    const img = everything.media.find((m) => m.project === p.slug && m.type === 'image' && m.src);
    const film = everything.media.find((m) => m.project === p.slug && m.type !== 'image' && still(m));
    const u = p.hero || (p.photos || []).find((x) => x && x.image)?.image || img?.src || (film && still(film));
    if (u) thumbs.projects[p.slug] = small(u);
  }
  const testOnly = new Set(work.projects.filter((p) => p.reviewOnly === true).map((p) => p.slug));
  // Picker: every image already on the site (library photos and dashboard project photos), with its description.
  const seen = new Set();
  for (const m of work.media) {
    if (m.type !== 'image' || !m.src || seen.has(m.src) || m.rights !== 'approved' || testOnly.has(m.project)) continue;
    seen.add(m.src);
    thumbs.pick.push({ src: m.src, thumb: small(m.src), alt: m.alt || '', label: m.title || m.id, cat: m.category || '' });
  }
  await writeFile(join(out, 'admin/config.js'), `window.PHOTOGRAFIK_THUMBS = ${safe(thumbs)};\nwindow.PHOTOGRAFIK_CMS_CONFIG = ${safe(config)};\nwindow.PHOTOGRAFIK_LIBRARY = ${safe(library)};\nwindow.PHOTOGRAFIK_CATEGORIES = ${safe(categories)};\nwindow.PHOTOGRAFIK_WORK_CATEGORIES = ${safe(work.taxonomy.category.map((c) => ({ label: c.label, value: c.id })))};\n`);
  await cp(join(root, 'src/admin/cms.js'), join(out, 'admin/cms.js'));
  await cp(join(root, 'src/admin/preview.css'), join(out, 'admin/preview.css'));
}

// robots + sitemap (canonical production URLs only; review builds disallow crawling)
await writeFile(join(out, 'robots.txt'), reviewMode
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${site.canonicalOrigin}/sitemap.xml\n`);
const publishedNote = (r) => fieldNotes.articles.some((a) => `/field-notes/${a.slug}` === r && a.published === true);
const serviceRoutes = { 'real-estate': '/real-estate', 'agent-content': '/agent-content', 'architecture-design': '/architecture-design', commercial: '/commercial', 'creator-studios': '/creator-studios' };
const projectRoutes = new Map(work.projects.map((p) => [p.path || `${serviceRoutes[p.category]}/${p.slug}`, p]));
// Draft projects (Published off in /admin) never enter the sitemap, even in review builds.
const sitemapRoutes = routes.filter((r) => (!projectRoutes.has(r) || (isApproved(projectRoutes.get(r)) && projectRoutes.get(r).published !== false && projectRoutes.get(r).reviewOnly !== true))
  && (!r.startsWith('/field-notes/') || publishedNote(r))
  && (r !== '/field-notes' || fieldNotes.articles.some((a) => a.published === true))
  && !r.startsWith('/admin'));
await writeFile(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapRoutes.map((r) => `  <url><loc>${site.canonicalOrigin}${r === '/' ? '/' : r}</loc></url>`).join('\n')}\n</urlset>\n`);

// What this build did with dashboard projects, read by /admin so a held project says why on its own form.
await writeFile(join(out, 'admin', 'status.json'), JSON.stringify({
  commit: process.env.VERCEL_GIT_COMMIT_SHA || null, branch: process.env.VERCEL_GIT_COMMIT_REF || null,
  builtAt: new Date().toISOString(), mode: reviewMode ? 'review' : 'production',
  held: held.map((h) => ({ collection: 'projects', ...h })), reviewOnly,
}, null, 1) + '\n');
console.log(`Built ${routes.length + 1} pages in ${reviewMode ? 'REVIEW' : 'PRODUCTION'} mode${onVercel ? ' (Vercel image optimization on)' : ''}.`);
