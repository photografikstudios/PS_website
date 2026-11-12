import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { articleLayout, serializeArticleLayout, isArticleMedia, moveArticleMedia, removeArticleMedia } from '../src/lib/article-layout-core.js';
import { parseArticleFile } from '../src/lib/field-notes-core.js';
import { parseBlocks, bodyRefs } from '../src/lib/markdown.js';

const photo = '![A portrait](/images/photo.webp "The original caption")';
const source = '## First\n\nA **bold** paragraph with [a link](/contact).\n\n' + photo + '\n\n## Second\n\n- First item\n- Second item\n\n> A quoted note\n\n::media[studio-film]';
const prose = value => articleLayout(value).blocks.filter(b => !isArticleMedia(b)).map(b => b.raw);
const media = value => articleLayout(value).blocks.filter(isArticleMedia).map(b => b.raw).sort();

test('article layout is byte-identical until an image operation, including CRLF, Unicode and last lines', () => {
  for (const value of ['', ' \r\n\r\n', source, '\r\n' + source.replace(/\n/g, '\r\n'), 'Last paragraph\n' + photo, 'Emoji 🎬 and café.\n\n' + photo + '\n']) {
    assert.equal(serializeArticleLayout(articleLayout(value)), value);
  }
});
test('image moves to the beginning, between headings/paragraphs and the end, preserving captions, links and all prose', () => {
  const original = articleLayout(source), from = original.blocks.findIndex(b => b.kind === 'image');
  for (let destination = 0; destination <= original.blocks.length; destination++) {
    const moved = moveArticleMedia(source, from, destination);
    assert.deepEqual(prose(moved), prose(source));
    assert.deepEqual(media(moved), media(source));
    assert.equal(bodyRefs(moved).images.length, 1);
    assert.ok(moved.includes(photo), 'alt text, source and caption travel together verbatim');
  }
  assert.equal(parseBlocks(moveArticleMedia(source, from, 0))[0].type, 'image');
  assert.equal(parseBlocks(moveArticleMedia(source, from, original.blocks.length)).at(-1).type, 'image');
});
test('a final image with no trailing newline can be moved without swallowing the following paragraph', () => {
  const body = 'First paragraph\n\nSecond paragraph\n\n' + photo;
  const moved = moveArticleMedia(body, 2, 1);
  assert.deepEqual(parseBlocks(moved).map(b => b.type), ['p', 'image', 'p']);
  assert.deepEqual(prose(moved), ['First paragraph', 'Second paragraph']);
});
test('library film/photo blocks move intact; invalid moves and adjacent gaps do nothing', () => {
  const blocks = articleLayout(source).blocks;
  const index = blocks.findIndex(b => b.kind === 'media');
  assert.ok(moveArticleMedia(source, index, 0).startsWith('::media[studio-film]'));
  assert.deepEqual(bodyRefs(moveArticleMedia(source, index, 0)), bodyRefs(source));
  for (const [from, to] of [[-1, 0], [0, 2], [index, -1], [index, blocks.length + 1], [index, index], [index, index + 1], [1.5, 0]]) assert.equal(moveArticleMedia(source, from, to), source);
});
test('fenced examples, loose lists, wrapped lines and blockquotes stay together and never become movable images', () => {
  const body = '```md\n' + photo + '\n```\n\n- Item one\n\n- Item two\n  wrapped detail\n\n> One line\n> Another line\n\n' + photo;
  const parsed = articleLayout(body);
  assert.deepEqual(parsed.blocks.map(b => b.kind), ['code', 'list', 'quote', 'image']);
  assert.equal(serializeArticleLayout(parsed), body);
  const moved = moveArticleMedia(body, 3, 0);
  assert.deepEqual(prose(moved), prose(body));
  assert.equal(articleLayout(moved).blocks.filter(isArticleMedia).length, 1);
});
test('remove affects the selected occurrence only; text blocks cannot be removed by a media operation', () => {
  const body = 'Opening\n\n' + photo + '\n\nMiddle\n\n' + photo;
  const removed = removeArticleMedia(body, 1);
  assert.deepEqual(prose(removed), ['Opening', 'Middle']);
  assert.equal(bodyRefs(removed).images.length, 1);
  assert.equal(removeArticleMedia(body, 0), body);
});
test('all current articles round-trip exactly and every media move conserves all supplied prose/media', async () => {
  const folder = new URL('../content/field-notes/', import.meta.url);
  for (const name of (await readdir(folder)).filter(n => n.endsWith('.md'))) {
    const article = parseArticleFile(await readFile(new URL(name, folder), 'utf8'), name);
    const body = article.body;
    const parsed = articleLayout(body);
    assert.equal(parsed.blocks.filter(isArticleMedia).length, bodyRefs(body).images.length + bodyRefs(body).media.length, name + ' all rendered media available');
    assert.equal(serializeArticleLayout(parsed), body, name);
    for (let i = 0; i < parsed.blocks.length; i++) if (isArticleMedia(parsed.blocks[i])) {
      for (const to of [0, parsed.blocks.length]) {
        const moved = moveArticleMedia(body, i, to);
        assert.deepEqual(prose(moved), prose(body), name + ' prose preserved');
        assert.deepEqual(media(moved), media(body), name + ' media/captions preserved');
      }
    }
  }
});
