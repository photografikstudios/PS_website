import { esc } from './html.js';
import { INTENTS, pageIntent } from './guidance-core.js';

export function guidanceView(ctx, route) {
  if (/^\/(admin|terms|licensing|404|review)(\/|$)/.test(route)) return '';
  const safe = value => JSON.stringify(value).replace(/</g, '\\u003c');
  const records = ['luxury-media', 'photo-floor-plan', 'aerial-addon', 'video-both'];
  const pricing = Object.fromEntries(['packages', 'services', 'fixed'].map(k => [k, ctx.pricing[k].filter(r => records.includes(r.id))]));
  const note = ctx.fieldNotes?.articles.find(a => `/field-notes/${a.slug}` === route);
  // Reuse the editor's related service and CTA; never guess a service from article prose.
  const related = note && /^\/(?!\/)/.test(note.relatedService || '') ? pageIntent(note.relatedService.split(/[?#]/)[0]) : '';
  const article = related ? { intent: related, cta: /^\/(?!\/)/.test(note.cta?.href || '') && note.cta?.label ? note.cta : null } : null;
  return `<div id="service-guidance" data-auto="${route !== '/contact'}">
    <button class="guidance-launch" type="button" data-service-chooser hidden>Find the right service</button>
    <aside class="guidance-card" aria-labelledby="guidance-title" hidden>
      <button class="guidance-close" type="button" aria-label="Dismiss service suggestion">×</button>
      <p class="guidance-kicker">A useful next step</p>
      <h2 id="guidance-title"></h2>
      <p class="guidance-copy"></p>
      <details class="guidance-math" hidden><summary>How the savings compare</summary><p></p></details>
      <div class="guidance-actions"><a class="btn btn--solid btn--small guidance-primary" href="/contact">Discuss your project</a><button type="button" class="guidance-change" data-service-chooser>Find the right service</button></div>
    </aside>
    <dialog class="service-dialog" aria-labelledby="service-dialog-title">
      <button class="guidance-close" type="button" aria-label="Close service chooser">×</button>
      <p class="eyebrow">Start with what you need</p><h2 class="h2" id="service-dialog-title">What are you creating?</h2>
      <p>Choose a direction. You can explore the work or take the next step.</p>
      <div class="service-choices">${Object.entries(INTENTS).map(([id, v]) => `<button type="button" data-intent="${id}" aria-pressed="false">${esc(v.label)}<span aria-hidden="true">→</span></button>`).join('')}</div>
      <section class="service-result" aria-live="polite" hidden><h3 class="h3"></h3><p></p>
        <div class="service-size" hidden><label for="guidance-sqft">Property size <span>(square feet, optional)</span></label><input id="guidance-sqft" type="text" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="e.g. 2,800" aria-describedby="guidance-size-help guidance-size-error"><p id="guidance-size-help">Compare packages for this home size, or leave blank to see starting prices.</p><p id="guidance-size-error" hidden></p></div>
        <div class="guidance-actions"><a class="btn btn--solid btn--small" data-choice-action href="/contact">Continue</a><a class="link-arrow" data-choice-examples href="/">See examples →</a></div></section>
    </dialog>
    <script id="guidance-config" type="application/json">${safe({ route, pricing, article })}</script>
  </div>`;
}
