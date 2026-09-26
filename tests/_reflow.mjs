import { chromium } from 'playwright';
import { start } from './serve.mjs';
const server = await start(0); const base = `http://localhost:${server.address().port}`;
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' });
const p = await ctx.newPage(); await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const res = [];
for (const path of ['/', '/real-estate', '/real-estate/pricing', '/agent-content', '/architecture-design', '/commercial', '/creator-studios', '/field-notes', '/field-notes/how-to-prepare-a-home-for-listing-photos', '/about', '/contact']) {
  await p.goto(base + path); const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  // reduced motion: no ambient video playing
  const playing = await p.evaluate(() => [...document.querySelectorAll('video[data-ambient]')].filter((v) => !v.paused).length);
  res.push(`${path} scrollWidth=${sw} ambientPlaying=${playing}`);
}
console.log(res.join('\n')); await b.close(); server.close();
