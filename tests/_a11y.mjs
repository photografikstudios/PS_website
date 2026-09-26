// Focused WCAG 2.2 AA spot audit (axe-core is not installable here): contrast of text on solid backgrounds (1.4.3),
// target size ≥24px (2.5.8), accessible names for controls/links (4.1.2, 2.4.4), img alt (1.1.1), one h1 +
// no skipped heading levels (1.3.1), lang (3.1.1), main landmark, focusable elements visibly focusable (2.4.7).
import { chromium } from 'playwright';
import { start } from './serve.mjs';
const server = await start(0); const base = `http://localhost:${server.address().port}`;
const b = await chromium.launch();
const pages = ['/', '/real-estate', '/real-estate/pricing', '/agent-content', '/architecture-design', '/commercial', '/creator-studios', '/commercial/revivaluxe', '/field-notes', '/field-notes/how-to-prepare-a-home-for-listing-photos', '/about', '/contact', '/agency-partnerships', '/creator-studios/sessions', '/real-estate/lauryn-koke-daniel-gale-sothebys'];
const out = {};
for (const vp of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  for (const path of pages) {
    await p.goto(base + path);
    const r = await p.evaluate(() => {
      const issues = [];
      const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a }; };
      const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none' || ['VIDEO', 'IMG'].includes(e.tagName)) return null; const c = parse(s.backgroundColor); if (c && c.a > 0.95) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
      const overMedia = (el) => { for (let e = el; e; e = e.parentElement) if (e.querySelector && e !== document.body && e.matches('.hero, .page-hero--image, .quick__tile, .closing, .sw-card, .path, .vplayer')) return true; return false; };
      const seen = new Set();
      for (const el of document.querySelectorAll('main *, header *, footer *')) {
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || !el.getClientRects().length) continue;
        if (overMedia(el)) continue;
        // Transparent header drawn over a photo/video hero (overlay pages): its real backdrop is the hero media + scrim.
        if (el.closest('.site-header') && document.body.matches('.has-overlay, [data-overlay]') && !document.querySelector('.site-header.is-solid, .site-header.scrolled')) continue; // text over photo/video is checked visually (scrims)
        const fg = parse(s.color); const bg = bgOf(el); if (!fg || !bg) continue;
        const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const size = parseFloat(s.fontSize); const bold = parseInt(s.fontWeight) >= 700; const large = size >= 24 || (bold && size >= 18.66);
        if (ratio < (large ? 3 : 4.5)) { const k = el.className + s.color + s.backgroundColor; if (!seen.has(k)) { seen.add(k); issues.push(`contrast ${ratio.toFixed(2)} ${el.tagName}.${String(el.className).slice(0, 30)} "${el.textContent.trim().slice(0, 30)}"`); } }
      }
      for (const el of document.querySelectorAll('a[href], button, input, select, textarea, summary')) {
        const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || !el.getClientRects().length) continue;
        if ((el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) && el.getAttribute('tabindex') === '-1') continue; // duplicate, hidden from AT and keyboard
        const rect = el.getBoundingClientRect();
        const inline = s.display === 'inline' && el.closest('p, li, dd');
        if (!inline && (rect.width < 24 || rect.height < 24) && !el.closest('.sr-only')) issues.push(`target ${Math.round(rect.width)}x${Math.round(rect.height)} ${el.tagName} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`);
        const name = (el.getAttribute('aria-label') || el.textContent || el.title || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) || el.closest('label')?.textContent || '').trim();
        if (!name && el.type !== 'hidden') issues.push(`no name ${el.outerHTML.slice(0, 80)}`);
      }
      for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) issues.push(`img no alt ${img.src.slice(-40)}`);
      const hs = [...document.querySelectorAll('h1,h2,h3,h4')].filter((h) => h.getClientRects().length).map((h) => +h.tagName[1]);
      if (hs.filter((x) => x === 1).length !== 1) issues.push(`h1 count ${hs.filter((x) => x === 1).length}`);
      for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) { issues.push(`heading skip h${hs[i - 1]}→h${hs[i]}`); break; }
      if (!document.documentElement.lang) issues.push('no lang'); if (!document.querySelector('main')) issues.push('no main');
      return issues;
    });
    // keyboard: every focusable shows a visible focus indicator
    const noFocus = await p.evaluate(() => { const bad = []; for (const el of [...document.querySelectorAll('a[href], button, select, input, summary')].slice(0, 60)) { if (!el.getClientRects().length) continue; el.focus(); const s = getComputedStyle(el); const ring = (x) => { const t = getComputedStyle(x); return t.outlineStyle !== 'none' || t.boxShadow !== 'none'; }; if (document.activeElement === el && !ring(el) && !(el.parentElement && el.parentElement.matches(':focus-within') && ring(el.parentElement))) bad.push(el.tagName + ' ' + (el.textContent || '').trim().slice(0, 20)); } return bad.slice(0, 3); });
    if (noFocus.length) r.push('focus not visible: ' + noFocus.join(' | '));
    if (r.length) out[`${vp.width} ${path}`] = r;
  }
  await ctx.close();
}
console.log(Object.keys(out).length ? JSON.stringify(out, null, 1) : 'no issues');
await b.close(); server.close();
