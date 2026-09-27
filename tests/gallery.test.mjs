import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { facts, matches, editorialOrder, optionCounts, validateMedia } from '../src/lib/gallery-core.js';

const work = JSON.parse(await readFile(new URL('../content/work.json', import.meta.url)));
const pricing = JSON.parse(await readFile(new URL('../content/pricing.json', import.meta.url)));
const pk = pricing.packages.map((p) => p.id);

test('shared media collection metadata is valid and has no duplicate records', () => {
  assert.deepEqual(validateMedia(work, pk), []);
});

test('no package tag or capture year is asserted without verification', () => {
  // Update this test deliberately when James confirms tags (see docs in README "Media ingest").
  const tagged = work.media.filter((m) => m.packageIds.length).map((m) => m.id);
  const dated = work.media.filter((m) => m.capturedYear != null).map((m) => m.id);
  assert.deepEqual(tagged, []);
  assert.deepEqual(dated, []);
});

test('filters intersect package and media type', () => {
  const items = [
    { type: 'video', service: ['video', 'drone'], packageIds: ['luxury-media'] },
    { type: 'image', service: ['photography'], packageIds: ['luxury-media', 'signature'] },
    { type: 'image', service: ['photography', 'drone'], packageIds: [] },
  ].map((m) => facts(m));
  const n = (f) => items.filter((it) => matches(it, f)).length;
  assert.equal(n({}), 3);
  assert.equal(n({ pkg: 'luxury-media' }), 2);
  assert.equal(n({ pkg: 'signature' }), 1);
  assert.equal(n({ pkg: 'luxury-media', type: 'photo' }), 1);
  assert.equal(n({ pkg: 'signature', type: 'video' }), 0);
  assert.equal(n({ type: 'drone' }), 2);
  assert.deepEqual(optionCounts(items, { type: 'photo' }, 'pkg', ['', 'luxury-media', 'social-media']), { '': 2, 'luxury-media': 1, 'social-media': 0 });
});

test('validation rejects unknown packages, future years, duplicates and non-real-estate tags', () => {
  const bad = { media: [
    { id: 'a', category: 'real-estate', packageIds: ['platinum'], capturedYear: null, published: true },
    { id: 'a', category: 'real-estate', packageIds: [], capturedYear: 2099, published: true },
    { id: 'b', category: 'commercial', packageIds: ['signature'], capturedYear: 2025, published: 'yes' },
  ] };
  const e = validateMedia(bad, pk, { thisYear: 2026 }).join('\n');
  for (const s of ['unknown package "platinum"', 'appears twice', 'capturedYear', 'only apply to real estate', 'published must be']) assert.match(e, new RegExp(s));
});

test('editorial order: sortPriority first, then collection order', () => {
  const o = editorialOrder([{ id: 'a' }, { id: 'b', sortPriority: 5 }, { id: 'c' }, { id: 'd', sortPriority: 5 }]).map((m) => m.id);
  assert.deepEqual(o, ['b', 'd', 'a', 'c']);
});

test('architecture segments: inherited from the project with evidence, filterable, never on media records', async () => {
  const { matches, facts, segmentsOf, validateMedia } = await import('../src/lib/gallery-core.js');
  const projects = { y: { slug: 'y', segments: ['builder'] }, p: { slug: 'p', segments: [] } };
  const a = facts({ type: 'image', project: 'y' }, segmentsOf({ project: 'y' }, projects));
  const b = facts({ type: 'video' }, segmentsOf({}, projects));
  assert.ok(matches(a, { seg: 'builder' }) && !matches(b, { seg: 'builder' }) && matches(b, { seg: '' }));
  assert.ok(!matches(a, { seg: 'builder', type: 'video' }));
  const base = { taxonomy: { segment: [{ id: 'builder' }] }, media: [], projects: [] };
  assert.deepEqual(validateMedia({ ...base, projects: [{ slug: 'x', category: 'architecture-design', segments: ['builder'], segmentSource: 'owner' }] }, []), []);
  assert.ok(validateMedia({ ...base, projects: [{ slug: 'x', category: 'architecture-design', segments: ['builder'] }] }, [])[0].includes('segmentSource'));
  assert.ok(validateMedia({ ...base, projects: [{ slug: 'x', category: 'architecture-design', segments: ['architect-guess'], segmentSource: 's' }] }, [])[0].includes('unknown segment'));
  assert.ok(validateMedia({ ...base, media: [{ id: 'm', packageIds: [], published: true, segments: ['builder'] }] }, [])[0].includes('belong on the project'));
});

test('a project with a film and photos appears once per media view (film lead + photo-only still card)', async () => {
  const { facts, matches, optionCounts } = await import('../src/lib/gallery-core.js');
  const lead = facts({ type: 'video' }, ['builder'], ['', 'video']);
  const still = facts({ type: 'image' }, ['builder'], ['photo']);
  const single = facts({ type: 'image' });
  const items = [lead, still, single];
  const shownFor = (type) => items.filter((f) => matches(f, { type }));
  assert.deepEqual(shownFor(''), [lead, single]);
  assert.deepEqual(shownFor('video'), [lead]);
  assert.deepEqual(shownFor('photo'), [still, single]);
  assert.deepEqual(optionCounts(items, { seg: '' }, 'type', ['', 'video', 'photo']), { '': 2, video: 1, photo: 2 });
  assert.deepEqual(optionCounts(items, { type: 'photo' }, 'seg', ['', 'builder']), { '': 2, builder: 1 });
  // facts() must not treat Array.prototype.map's index/array as segments/views.
  assert.equal([{ type: 'image' }].map((m) => facts(m))[0].views, undefined);
});
