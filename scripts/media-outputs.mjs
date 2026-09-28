// Shared list of the web-ready files scripts/media.mjs produces for the published (rights-approved) catalog.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const outputsFor = (it) => (it.image ? [`${it.id}.webp`, `${it.id}-sm.webp`]
  : it.montage || it.loopOnly ? [`${it.id}-loop.mp4`, `${it.id}.webp`]
    : [`${it.id}.mp4`, `${it.id}.webp`, ...(it.loop ? [`${it.id}-loop.mp4`] : [])]);

export async function publishedOutputs(root) {
  const { items } = JSON.parse(await readFile(join(root, 'content/media-sources.json'), 'utf8'));
  const work = JSON.parse(await readFile(join(root, 'content/work.json'), 'utf8')).media;
  const pending = new Set(work.filter((m) => m.rights !== 'approved').map((m) => m.id));
  const names = items.filter((it) => !pending.has(it.id)).flatMap(outputsFor);
  return [...new Set([...names, 'manifest.json'])].map((n) => `/v/${n}`);
}

export const aggregateOf = (files) => Object.keys(files).sort().map((p) => `${p} ${files[p].bytes} ${files[p].sha256}`).join('\n');
