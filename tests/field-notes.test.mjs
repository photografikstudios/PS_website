import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateFieldNotes, legacyLaunchBlockers } from '../src/lib/field-notes-core.js';

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url)));
const fn = await read('../content/field-notes.json');
const legacy = await read('../content/legacy-articles.json');
const work = await read('../content/work.json');
const vercel = await read('../vercel.json');

test('Field Notes collection is valid', () => {
  assert.deepEqual(validateFieldNotes(fn, legacy, work), []);
});

test('no article is published without James approving it', () => {
  for (const a of fn.articles) if (a.status === 'published') assert.ok(a.approvedBy && a.datePublished, a.slug);
  assert.equal(fn.articles.filter((a) => a.status === 'published').length, 0, 'update this test when James approves the first article');
});

test('every legacy article URL has exactly one redirect, matching the inventory', () => {
  const redirects = vercel.redirects.filter((r) => r.source.startsWith('/articles') || ['/blog-1', '/insights'].includes(r.source));
  assert.equal(redirects.length, legacy.items.length);
  for (const row of legacy.items) {
    const r = redirects.filter((x) => x.source === row.from);
    assert.equal(r.length, 1, row.from);
    if (row.status === 'index' || row.status === 'mapped') assert.equal(r[0].destination, row.target, row.from);
    // Never send a specific article to Home.
    if (row.status !== 'index') assert.notEqual(r[0].destination, '/', row.from);
  }
});

test('mapped legacy articles land on their own refreshed article, not a loosely related page', () => {
  for (const row of legacy.items.filter((r) => r.status === 'mapped')) {
    const slug = row.target.replace('/field-notes/', '');
    assert.ok(fn.articles.find((a) => a.slug === slug).legacyUrls.includes(row.from));
  }
});

test('production launch stays blocked until every legacy URL has an approved destination', () => {
  const blockers = legacyLaunchBlockers(fn, legacy);
  assert.equal(blockers.length, legacy.items.length);
  const approved = {
    articles: fn.articles.map((a) => ({ ...a, status: a.status === 'source-needed' ? a.status : 'published', approvedBy: 'James', datePublished: '2026-10-01' })),
  };
  const decided = { items: legacy.items.map((r) => (r.status === 'decision' ? { ...r, approvedBy: 'James' } : r)) };
  const left = legacyLaunchBlockers(approved, decided);
  assert.ok(left.every((l) => l.includes('planned') || l.includes('title-only')), left.join('\n'));
});

test('a mapped redirect matched only by title keeps production blocked until its content is compared', () => {
  const titleOnly = legacy.items.filter((r) => r.status === 'mapped' && r.audit !== 'content-verified');
  assert.ok(titleOnly.length > 0, 'update this test once every mapped row is content-verified');
  const approved = { articles: fn.articles.map((a) => ({ ...a, status: 'published', approvedBy: 'James', datePublished: '2026-10-01' })) };
  const left = legacyLaunchBlockers(approved, legacy);
  for (const r of titleOnly) assert.ok(left.some((l) => l.startsWith(r.from)), r.from);
  const verified = legacy.items.filter((r) => r.status === 'mapped' && r.audit === 'content-verified');
  for (const r of verified) assert.ok(!left.some((l) => l.startsWith(r.from)), r.from);
});
