import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { structuredData } from '../src/lib/seo-core.js';
const site = JSON.parse(await readFile(new URL('../content/site.json', import.meta.url)));
const seo = JSON.parse(await readFile(new URL('../content/seo.json', import.meta.url)));

test('service data uses current visible descriptions and a single canonical business identity', () => {
  for (const route of ['/real-estate', '/real-estate/pricing', '/architecture-design', '/agent-content', '/commercial', '/agency-partnerships', '/creator-studios']) {
    const graph = structuredData(site, route, seo[route])['@graph'];
    const service = graph.find(v => v['@type'] === 'Service');
    assert.equal(service.description, seo[route].description);
    assert.equal(service.url, site.canonicalOrigin + route);
    assert.equal(service.provider['@id'], graph.find(v => v['@type'] === 'ProfessionalService')['@id']);
    assert.equal(service.offers, undefined, 'do not manufacture prices');
    assert.equal(service.aggregateRating, undefined, 'do not manufacture ratings');
  }
});
test('FAQ wording is passed through exactly and article schemas are preserved without duplicate breadcrumbs', () => {
  const faq = { q: 'How is this priced?', a: 'Please ask us for an estimate.' };
  const existing = [{ '@type': 'BlogPosting', headline: 'Original article' }, { '@type': 'BreadcrumbList', itemListElement: [] }];
  const graph = structuredData(site, '/field-notes/example', seo['/'], { faqs: [faq], jsonLd: existing })['@graph'];
  assert.equal(graph.filter(v => v['@type'] === 'BreadcrumbList').length, 1);
  assert.ok(graph.some(v => v['@type'] === 'BlogPosting' && v.headline === 'Original article'));
  const q = graph.find(v => v['@type'] === 'FAQPage').mainEntity[0];
  assert.equal(q.name, faq.q); assert.equal(q.acceptedAnswer.text, faq.a);
  assert.equal(structuredData(site, '/404', seo['/']), null);
});
test('legacy pages use content-appropriate destinations, including misleading old slugs', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
  const redirects = new Map(config.redirects.map(r => [r.source, r]));
  assert.equal(redirects.get('/architecture-photography-1-1').destination, '/commercial');
  assert.equal(redirects.get('/monthly-content-packages').destination, '/creator-studios#sessions');
  assert.equal(redirects.get('/policies').destination, '/field-notes/how-to-prepare-a-home-for-listing-photos');
  for (const path of ['/policies', '/terms-conditions', '/portfolio-gallery', '/contact-1']) assert.equal(redirects.get(path).permanent, true);
  assert.equal(redirects.get('/book').permanent, false, 'booking remains a changeable external destination');
});
