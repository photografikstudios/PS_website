// Structured data describes the same services and answers visitors can read on the page.
// No inferred prices, reviews, opening hours, street address, or business results.
const services = {
  '/real-estate': 'Real estate photography and video',
  '/real-estate/pricing': 'Real estate media packages',
  '/agent-content': 'Real estate agent content production',
  '/architecture-design': 'Architecture and interior design photography and film',
  '/commercial': 'Commercial photography and video production',
  '/agency-partnerships': 'Media production for agencies',
  '/creator-studios': 'Podcast and studio content production',
};
const labels = {
  '/real-estate': 'Real Estate', '/real-estate/pricing': 'Pricing',
  '/agent-content': 'Agent Content', '/architecture-design': 'Architecture & Design',
  '/commercial': 'Commercial', '/agency-partnerships': 'Agency Partnerships',
  '/creator-studios': 'LI Creator Studios', '/field-notes': 'Field Notes',
  '/contact': 'Contact', '/about': 'About', '/terms': 'Terms', '/licensing': 'Licensing',
};
export function structuredData(site, route, seo, page = {}) {
  if (route === '/404') return null;
  const origin = site.canonicalOrigin.replace(/\/$/, '');
  const url = origin + (route === '/' ? '/' : route);
  const organization = {
    '@type': 'ProfessionalService', '@id': `${origin}/#organization`,
    name: site.name, url: origin + '/', email: site.email, telephone: site.phoneHref.replace(/^tel:/, ''),
    logo: origin + site.media.logo,
    areaServed: ['Long Island', 'The Hamptons', 'North Fork', 'Suffolk County', 'Nassau County', 'New York City'],
    sameAs: site.social.map(s => s.href),
  };
  const graph = [organization, {
    '@type': 'WebSite', '@id': `${origin}/#website`, url: origin + '/', name: site.name,
    publisher: { '@id': organization['@id'] }, inLanguage: 'en-US',
  }, {
    '@type': route === '/contact' ? 'ContactPage' : 'WebPage', '@id': `${url}#webpage`,
    url, name: seo.title, description: seo.description, inLanguage: 'en-US',
    isPartOf: { '@id': `${origin}/#website` },
  }];
  if (services[route]) graph.push({
    '@type': 'Service', '@id': `${url}#service`, name: services[route], serviceType: services[route],
    description: seo.description, url, provider: { '@id': organization['@id'] },
    areaServed: organization.areaServed,
    mainEntityOfPage: { '@id': `${url}#webpage` },
  });
  const supplied = (Array.isArray(page.jsonLd) ? page.jsonLd : page.jsonLd ? [page.jsonLd] : [])
    .flatMap(v => v['@graph'] || [v]).map(({ '@context': context, ...v }) => v);
  graph.push(...supplied);
  if (route !== '/' && !graph.some(v => v['@type'] === 'BreadcrumbList')) {
    const crumbs = [{ name: 'Home', item: origin + '/' }];
    const parent = route.substring(0, route.lastIndexOf('/'));
    if (parent && labels[parent]) crumbs.push({ name: labels[parent], item: origin + parent });
    crumbs.push({ name: labels[route] || seo.title.split(' | ')[0], item: url });
    graph.push({ '@type': 'BreadcrumbList', itemListElement: crumbs.map((v, i) => ({ '@type': 'ListItem', position: i + 1, ...v })) });
  }
  if (page.faqs?.length) graph.push({
    '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: page.faqs.map(({ q, a }) => ({
      '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });
  return { '@context': 'https://schema.org', '@graph': graph };
}
