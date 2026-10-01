// A small, safe Markdown renderer for Field Notes (zero dependencies).
// Supports what the CMS editor produces: ## / ### headings, paragraphs, - / * / + and 1. lists,
// > notes, **bold**, *italic* / _italic_, [links](url), standalone ![images](src "caption"),
// hard breaks, backslash escapes, and the ::media[id] block for Photografik library media.
// Raw HTML is never passed through: everything is escaped first.
import { esc } from './html.js';

const SAFE_URL = /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;

// Backslash escapes are swapped for placeholders so they survive the inline rules.
const ESCAPABLE = '\\`*_{}[]()#+-.!>|~';
function protectEscapes(s) {
  const kept = [];
  const out = s.replace(/\\(.)/g, (m, ch) => (ESCAPABLE.includes(ch) ? `\u0000${kept.push(ch) - 1}\u0000` : m));
  return { out, kept };
}
const restore = (s, kept) => s.replace(/\u0000(\d+)\u0000/g, (_, i) => esc(kept[+i]));

export function inline(text) {
  const { out, kept } = protectEscapes(String(text ?? ''));
  let s = esc(out);
  // links first (their text may contain emphasis)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (m, label, url) => {
    const u = url.replace(/&amp;/g, '&');
    if (!SAFE_URL.test(u)) return label;
    const ext = /^https?:\/\//i.test(u);
    return `<a href="${esc(u)}"${ext ? ' rel="noopener"' : ''}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>').replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  return restore(s, kept);
}

const IMG_LINE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;
const MEDIA_LINE = /^::media\[([a-z0-9-]+)\]$/;
const LIST_ITEM = /^\s{0,3}(?:[-*+]|\d+[.)])\s+(.*)$/;

/** Parse Markdown into blocks: { type: 'h2'|'h3'|'p'|'ul'|'ol'|'note'|'image'|'media', ... } */
export function parseBlocks(md) {
  const lines = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ').replace(/\s+/g, ' ').replace(/\u0001\s*/g, '\n').trim() }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { flush(); continue; }
    let m;
    if ((m = line.match(/^(#{2,3})\s+(.+?)\s*#*$/))) { flush(); blocks.push({ type: m[1].length === 2 ? 'h2' : 'h3', text: m[2] }); continue; }
    if ((m = line.match(/^#\s+(.+)$/))) { flush(); blocks.push({ type: 'h2', text: m[1] }); continue; } // an H1 in the body is demoted
    if ((m = line.match(MEDIA_LINE))) { flush(); blocks.push({ type: 'media', id: m[1] }); continue; }
    if ((m = line.match(IMG_LINE))) { flush(); blocks.push({ type: 'image', alt: m[1], src: m[2], caption: m[3] || '' }); continue; }
    if (line.startsWith('>')) {
      flush();
      const q = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) { q.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
      i--;
      blocks.push({ type: 'note', text: q.join(' ').trim() });
      continue;
    }
    if (LIST_ITEM.test(raw) && !para.length) {
      const ordered = /^\s{0,3}\d+[.)]\s/.test(raw);
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const li = l.match(LIST_ITEM);
        if (li) { items.push(li[1].trim()); i++; continue; }
        if (l.trim() && /^\s{2,}/.test(l) && items.length) { items[items.length - 1] += ' ' + l.trim(); i++; continue; } // wrapped item
        if (!l.trim() && i + 1 < lines.length && LIST_ITEM.test(lines[i + 1])) { i++; continue; } // loose list
        break;
      }
      i--;
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }
    const hard = /(\\| {2,})$/.test(raw);
    para.push(hard ? line.replace(/\\$/, '') + '\u0001' : line);
  }
  flush();
  return blocks;
}

export const slugifyHeading = (h) => String(h).toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Render Markdown to Field Notes article HTML, one <section> per ## heading.
 * opts.media(id) and opts.image({alt, src, caption}) return figure HTML; opts.plainHeading strips inline markup for ids.
 */
export function renderArticle(md, opts = {}) {
  const blocks = parseBlocks(md);
  const sections = [];
  let cur = { h: null, blocks: [] };
  for (const b of blocks) {
    if (b.type === 'h2') { if (cur.h || cur.blocks.length) sections.push(cur); cur = { h: b.text, blocks: [] }; } else cur.blocks.push(b);
  }
  if (cur.h || cur.blocks.length) sections.push(cur);
  const used = new Set();
  const idFor = (h) => { let id = slugifyHeading(h) || 'section'; let n = 2; while (used.has(id)) id = `${slugifyHeading(h)}-${n++}`; used.add(id); return id; };
  const blockHtml = (b) => {
    switch (b.type) {
      case 'p': return `<p>${inline(b.text).replace(/\n/g, '<br>')}</p>`;
      case 'h3': return `<h3 class="h4">${inline(b.text)}</h3>`;
      case 'ul': return `<ul class="fn-list">${b.items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol class="fn-list">${b.items.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`;
      case 'note': return `<p class="fn-note">${inline(b.text)}</p>`;
      case 'media': return opts.media ? opts.media(b.id) : '';
      case 'image': return opts.image ? opts.image(b) : '';
      default: return '';
    }
  };
  const toc = [];
  const html = sections.map((s) => {
    const inner = s.blocks.map(blockHtml).join('\n      ');
    if (!s.h) return `<div class="fn-section fn-section--intro">\n      ${inner}\n    </div>`;
    const id = idFor(s.h);
    toc.push({ id, text: s.h });
    return `<section class="fn-section" aria-labelledby="${id}">
      <h2 class="h3" id="${id}">${inline(s.h)}</h2>
      ${inner}
    </section>`;
  }).join('\n    ');
  return { html, toc, blocks };
}

/** Every image and library-media reference in a body, for validation and hero de-duplication. */
export function bodyRefs(md) {
  const blocks = parseBlocks(md);
  return { images: blocks.filter((b) => b.type === 'image').map((b) => b.src), media: blocks.filter((b) => b.type === 'media').map((b) => b.id) };
}

/** Plain text of a body (for word counts and descriptions). */
export function plainText(md) {
  return parseBlocks(md).map((b) => (b.items ? b.items.join(' ') : b.text || '')).join(' ').replace(/\\(.)/g, '$1').replace(/[*_`]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
}
