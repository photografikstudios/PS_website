// Node-only loader for the portfolio: content/work.json keeps the readme and the gallery taxonomy, and every project
// and media record lives in its own file (content/projects/<slug>.json, content/media/<id>.json) so the /admin
// dashboard can edit one record at a time. The build, scripts and tests all read the collection through here, so
// the assembled { projects, media } arrays are exactly what work.json used to hold.
// Order: `order` (ascending) is the list position the old single file had; records without it go last, by file name.
// `sortPriority` still decides what shows first in galleries; `order` only breaks ties, as file order did before.
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const byOrder = (a, b) => (a.rec.order ?? Infinity) - (b.rec.order ?? Infinity) || a.file.localeCompare(b.file);

async function readDir(dir, key) {
  if (!existsSync(dir)) return { records: [], errors: [] };
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const rows = []; const errors = [];
  for (const file of files) {
    try {
      const rec = JSON.parse(await readFile(join(dir, file), 'utf8'));
      if (rec[key] !== file.replace(/\.json$/, '')) errors.push(`${file}: "${key}" must match the file name (found "${rec[key]}")`);
      rows.push({ file, rec });
    } catch (e) { errors.push(`${file}: ${e.message}`); }
  }
  return { records: rows.sort(byOrder).map((r) => r.rec), errors };
}

/** { _readme, taxonomy, projects, media, loadErrors } */
export async function loadWork(root) {
  const base = JSON.parse(await readFile(join(root, 'content', 'work.json'), 'utf8'));
  const projects = await readDir(join(root, 'content', 'projects'), 'slug');
  const media = await readDir(join(root, 'content', 'media'), 'id');
  return { ...base, projects: projects.records, media: media.records, loadErrors: [...projects.errors, ...media.errors] };
}

/** The fields the build adds for bookkeeping only; strip them when comparing with the pre-split work.json. */
export const bookkeeping = ['order'];
