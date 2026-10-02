// Vercel Function: legacy /work?category=<service> links from the old site -> that service's portfolio.
// A vercel.json redirect would carry ?category= into the new URL, so this answers the 307 itself and keeps only
// the one old parameter the new pages still use (service=video|photography|drone presets the Real Estate and Architecture galleries).
const SERVICES = new Set(['real-estate', 'agent-content', 'architecture-design', 'commercial', 'creator-studios']);
const KINDS = new Set(['video', 'photography', 'drone']);
const one = (v) => String(Array.isArray(v) ? v[0] : v ?? '').toLowerCase();

export function legacyWorkLocation(query = {}) {
  const cat = one(query.category); const service = one(query.service);
  if (!SERVICES.has(cat)) return '/#selected-work';
  // LI Creator Studios has no portfolio grid (James removed Recent Sessions, Sep 2026): land on the page itself.
  if (cat === 'creator-studios') return '/creator-studios';
  return `/${cat}${(cat === 'real-estate' || cat === 'architecture-design') && KINDS.has(service) ? `?service=${service}` : ''}#portfolio`;
}

export default function handler(req, res) {
  res.statusCode = 307;
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Location', legacyWorkLocation(req.query || {}));
  res.end();
}
