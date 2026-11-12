// Lossless article-layout operations. Stored content remains Markdown, with no migration or rewritten prose.
const IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;
const LIBRARY = /^::media\[([a-z0-9-]+)\]$/;
const HEADING = /^#{1,6}\s+/;
const LIST = /^\s{0,3}(?:[-*+]|\d+[.)])\s+/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

function blockKind(line) {
  const text = line.trim();
  if (IMAGE.test(text)) return 'image';
  if (LIBRARY.test(text)) return 'media';
  if (HEADING.test(text)) return 'heading';
  if (FENCE.test(line)) return 'code';
  if (/^\s*>/.test(line)) return 'quote';
  if (LIST.test(line)) return 'list';
  return 'paragraph';
}
function identity(source) {
  let n = 2166136261;
  for (let i = 0; i < source.length; i++) n = Math.imul(n ^ source.charCodeAt(i), 16777619);
  return (n >>> 0).toString(36);
}
export function articleLayout(value) {
  const source = String(value ?? '');
  const lines = []; const re = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  let match;
  while ((match = re.exec(source)) && match[0]) {
    const text = match[0].replace(/(?:\r\n|\r|\n)$/, '');
    lines.push({ text, start: match.index, end: match.index + text.length });
  }
  const blocks = []; const seen = {};
  let i = 0;
  while (i < lines.length && !lines[i].text.trim()) i++;
  const prefix = source.slice(0, i < lines.length ? lines[i].start : source.length);
  while (i < lines.length) {
    const start = i, kind = blockKind(lines[i].text);
    if (kind === 'code') {
      const mark = lines[i].text.match(FENCE)[1]; i++;
      while (i < lines.length) {
        const close = lines[i++].text.trim();
        if (close[0] === mark[0] && new RegExp('^' + mark[0] + '{' + mark.length + ',}\\s*$').test(close)) break;
      }
    } else if (['image', 'media', 'heading'].includes(kind)) i++;
    else {
      i++;
      while (i < lines.length) {
        const text = lines[i].text;
        if (!text.trim()) {
          // Keep a loose list whole, including blank lines between its items.
          if (kind === 'list' && i + 1 < lines.length && LIST.test(lines[i + 1].text)) { i += 2; continue; }
          break;
        }
        const next = blockKind(text);
        if (['image', 'media', 'heading', 'code'].includes(next)) break;
        if (kind === 'quote' && next !== 'quote') break;
        if (kind === 'list' && next !== 'list' && !/^\s{2,}\S/.test(text)) break;
        if (kind === 'paragraph' && next === 'quote') break;
        i++;
      }
    }
    const end = lines[i - 1].end;
    const raw = source.slice(lines[start].start, end);
    while (i < lines.length && !lines[i].text.trim()) i++;
    const after = source.slice(end, i < lines.length ? lines[i].start : source.length);
    const image = kind === 'image' ? raw.trim().match(IMAGE) : null;
    const media = kind === 'media' ? raw.trim().match(LIBRARY) : null;
    const key = identity(raw); seen[key] = (seen[key] || 0) + 1;
    blocks.push({ id: key + '-' + seen[key], kind, raw, after,
      ...(image ? { alt: image[1], src: image[2], caption: image[3] || '' } : {}),
      ...(media ? { media: media[1] } : {}),
      label: raw.replace(/^#{1,6}\s+/, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim() });
  }
  return { prefix, blocks, newline: source.includes('\r\n') ? '\r\n' : '\n' };
}
export function serializeArticleLayout(layout) {
  return layout.prefix + layout.blocks.map(b => b.raw + b.after).join('');
}
export function isArticleMedia(block) { return !!block && (block.kind === 'image' || block.kind === 'media'); }
function arranged(layout) {
  return layout.prefix + layout.blocks.map((b, i, all) => {
    let gap = b.after;
    if (i < all.length - 1 && (isArticleMedia(b) || isArticleMedia(all[i + 1])) && !/(?:\r\n|\r|\n)[ \t]*(?:\r\n|\r|\n)/.test(gap)) {
      gap = layout.newline + layout.newline;
    }
    return b.raw + gap;
  }).join('');
}
/** Destination is a gap in the original block list: 0 = beginning, length = end. */
export function moveArticleMedia(value, from, before) {
  const source = String(value ?? ''), layout = articleLayout(source);
  if (!Number.isInteger(from) || !Number.isInteger(before) || !isArticleMedia(layout.blocks[from]) || before < 0 || before > layout.blocks.length || before === from || before === from + 1) return source;
  const [block] = layout.blocks.splice(from, 1);
  layout.blocks.splice(before > from ? before - 1 : before, 0, block);
  return arranged(layout);
}
export function removeArticleMedia(value, index) {
  const source = String(value ?? ''), layout = articleLayout(source);
  if (!Number.isInteger(index) || !isArticleMedia(layout.blocks[index])) return source;
  layout.blocks.splice(index, 1);
  return arranged(layout);
}
