// Explicit visitor choices and first-party campaign context. No fingerprinting or automatic redirects.
export const INTENTS = {
  listing: { label: 'Market a property', route: '/real-estate', action: 'Explore listing packages', href: '/real-estate/pricing', type: 'other', title: 'One listing. Every format it needs.', value: 'Photography, drone, floor plan, film and reel in the Luxury Media package.' },
  architecture: { label: 'Showcase a building or finished project', route: '/architecture-design', action: 'Discuss your project', href: '/contact?type=architecture-design', type: 'architecture-design', title: 'Give the finished work a longer life.', value: 'Photography and film for your portfolio, proposals and project submissions.' },
  commercial: { label: 'Promote a business', route: '/commercial', action: 'Plan your production', href: '/contact?type=commercial', type: 'commercial', title: 'Show what your business actually does.', value: 'Build a library of photography and film for your website, social channels and sales.' },
  agent: { label: 'Create ongoing agent content', route: '/agent-content', action: 'Plan your content', href: '/contact?type=agent-content', type: 'agent-content', title: 'Give your expertise a place on camera.', value: 'Plan content around your local knowledge, listings and the questions clients ask.' },
  studio: { label: 'Record a podcast or studio session', route: '/creator-studios', action: 'Explore studio sessions', href: '/creator-studios#sessions', type: 'creator-studios', title: 'Turn a conversation into content.', value: 'Record podcasts, interviews and social content at LI Creator Studios.' },
  agency: { label: 'Find a production partner', route: '/agency-partnerships', action: 'Send an agency brief', href: '/contact?type=agency', type: 'agency', title: 'A production team behind your next brief.', value: 'Photography and film planned around your client’s scope and delivery needs.' },
  unsure: { label: 'I’m not sure yet', route: '/contact', action: 'Tell us what you have in mind', href: '/contact?type=other', type: 'other', title: 'What are you creating?', value: 'Find the right service for your property, project or business.' },
};
export const validIntent = (v) => typeof v === 'string' && Object.hasOwn(INTENTS, v) ? v : '';
export function pageIntent(path) {
  return Object.entries(INTENTS).find(([id, v]) => id !== 'unsure' && (path === v.route || path.startsWith(v.route + '/')))?.[0] || '';
}
export function resolveIntent({ path, campaign, choice, related, previousCampaign, previousPage, source }) {
  // A current service page is an intentional navigation. On general pages, the visitor's choice wins.
  return pageIntent(path) || (path === '/contact' ? validIntent(campaign) || validIntent(previousPage) : '') || validIntent(choice) || validIntent(campaign) || validIntent(related) || validIntent(previousPage) || validIntent(previousCampaign) || (source === 'creator-studios' ? 'studio' : '');
}
export const SOURCES = ['direct', 'instagram', 'facebook', 'google', 'bing', 'linkedin', 'youtube', 'creator-studios', 'referral', 'email', 'qr', 'partner', 'campaign'];
export function sourceOf(search, referrer, origin) {
  const q = new URLSearchParams(search);
  const utm = (q.get('utm_source') || '').toLowerCase();
  const aliases = { ig: 'instagram', fb: 'facebook', creator: 'creator-studios', licreatorstudios: 'creator-studios' };
  if (utm) return SOURCES.includes(aliases[utm] || utm) ? (aliases[utm] || utm) : 'campaign';
  try {
    const u = new URL(referrer);
    if (u.origin === origin) return '';
    const domains = { 'instagram.com': 'instagram', 'facebook.com': 'facebook', 'google.com': 'google', 'bing.com': 'bing', 'linkedin.com': 'linkedin', 'youtube.com': 'youtube', 'licreatorstudios.com': 'creator-studios' };
    return Object.entries(domains).find(([d]) => u.hostname === d || u.hostname.endsWith('.' + d))?.[1] || 'referral';
  } catch { return 'direct'; }
}
// Keep only campaign slugs, never full URLs, search terms, click IDs, email addresses or phone numbers.
export function campaignSlug(v) {
  return typeof v === 'string' && /^[a-z0-9][a-z0-9_-]{0,59}$/i.test(v) && !/\d{7}/.test(v) ? v : '';
}
export function cleanVisit(v = {}) {
  return {
    visitIntent: validIntent(v.visitIntent),
    visitSource: SOURCES.includes(v.visitSource) ? v.visitSource : '',
    visitCampaign: campaignSlug(v.visitCampaign),
    visitEntry: typeof v.visitEntry === 'string' && /^\/[a-z0-9/-]{0,179}$/.test(v.visitEntry) ? v.visitEntry : '',
    visitContext: typeof v.visitContext === 'string' && /^\/[a-z0-9/-]{0,179}$/.test(v.visitContext) ? v.visitContext : '',
  };
}
export function canSuggest({ used, dismissed, busy, elapsed, passedHero, scroll, trigger, desktop }) {
  if (used || dismissed || busy) return false;
  if (trigger === 'exit') return desktop && elapsed >= 30000 && scroll >= 150;
  return elapsed >= 12000 && passedHero;
}

// Compare approved, equivalent deliverables at the same size. Above a component's range: no savings claim.
export function bundleComparison(pricing, sqft = 1) {
  const records = [...pricing.packages, ...pricing.services, ...pricing.fixed];
  const ids = ['luxury-media', 'photo-floor-plan', 'aerial-addon', 'video-both'];
  const selected = ids.map(id => records.find(r => r.id === id));
  if (!Number.isInteger(sqft) || sqft < 1 || selected.some(r => !r || r.approval !== 'approved')) return null;
  const features = r => Object.keys(r.features || {}).filter(k => r.features[k] === true).sort();
  const combined = [...new Set([...features(selected[1]), 'drone', ...features(selected[3])])].sort();
  if (JSON.stringify(features(selected[0])) !== JSON.stringify(combined)) return null;
  const amounts = selected.map(r => {
    if (r.amount != null) return r.amount;
    if (sqft > r.max) return null;
    return r.tiers.filter(([min]) => min <= sqft).at(-1)?.[1] ?? null;
  });
  if (amounts.some(n => !Number.isFinite(n) || n <= 0)) return null;
  const [price, photos, drone, video] = amounts;
  const total = photos + drone + video;
  if (total <= price) return null;
  const tiers = selected.filter(r => r.tiers).map(r => {
    const i = r.tiers.findLastIndex(([min]) => min <= sqft);
    return { min: r.tiers[i][0], max: r.tiers[i + 1]?.[0] - 1 || r.max };
  });
  return { price, photos, drone, video, total, saving: total - price, min: Math.max(...tiers.map(t => t.min)), max: Math.min(...tiers.map(t => t.max)) };
}
