// Session 53: phone-throttled LCP probe (412x823, 150 ms RTT, 1.6 Mbps, CPU x4). Prints the LCP element, its request
// timing and what loaded before it.   BASE=http://localhost:4173 [PAGES=/,/real-estate] [RUNS=3] node tests/_lcp-probe.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4173';
const pages = (process.env.PAGES || '/,/real-estate,/architecture-design,/about').split(',');
const runs = Number(process.env.RUNS || 3);
const b = await chromium.launch();
const out = [];
for (const path of pages) for (let r = 0; r < runs; r++) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36' });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1638.4 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.addInitScript(() => { window.__lcp = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push({ t: e.startTime, rt: e.renderTime, lt: e.loadTime, size: e.size, url: e.url, tag: e.element?.tagName, cls: e.element?.className?.toString?.().slice(0, 60), id: e.element?.id }); }).observe({ type: 'largest-contentful-paint', buffered: true }); });
  await p.goto(BASE + path, { waitUntil: 'load', timeout: 120000 }); await p.waitForTimeout(1500);
  const d = await p.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0]; const last = window.__lcp[window.__lcp.length - 1]; const res = last?.url ? performance.getEntriesByName(last.url)[0] : null;
    const all = performance.getEntriesByType('resource').filter((x) => x.startTime < (last?.t || 0)).map((x) => ({ n: x.name.replace(location.origin, '').slice(0, 70), s: Math.round(x.startTime), e: Math.round(x.responseEnd), kb: Math.round(x.transferSize / 1024) }));
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
    return { ttfb: Math.round(nav.responseStart), fcp: Math.round(fcp), lcp: Math.round(last?.t), el: last, resStart: res && Math.round(res.startTime), resEnd: res && Math.round(res.responseEnd), resKB: res && Math.round(res.transferSize / 1024), before: all }; });
  if (process.env.DEBUG) console.log(JSON.stringify(await p.evaluate(() => window.__lcp)));
  out.push({ path, ...d }); console.log(path, 'ttfb', d.ttfb, 'fcp', d.fcp, 'lcp', d.lcp, d.el?.tag, d.el?.cls, (d.el?.url || '').replace(BASE, ''), 'res', d.resStart, '-', d.resEnd, d.resKB + 'KB');
  if (r === 0) console.log('  before LCP:', d.before.map((x) => `${x.n} ${x.s}-${x.e} ${x.kb}KB`).join(' | '));
  await ctx.close();
}
await b.close();
