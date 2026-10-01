// Node-only loader for the Field Notes collection: content/field-notes.json (settings and categories)
// plus one Markdown file per article in content/field-notes/. Shared by the build and the tests.
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArticleFile, sortNewest } from './field-notes-core.js';

export async function loadFieldNotes(root) {
  const settings = JSON.parse(await readFile(join(root, 'content', 'field-notes.json'), 'utf8'));
  const dir = join(root, 'content', 'field-notes');
  const files = existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith('.md')).sort() : [];
  const articles = [];
  const parseErrors = [];
  for (const f of files) {
    try { articles.push(parseArticleFile(await readFile(join(dir, f), 'utf8'), `content/field-notes/${f}`)); } catch (e) { parseErrors.push(e.message); }
  }
  return { fieldNotes: { ...settings, articles: sortNewest(articles) }, parseErrors };
}

/** True when a site path (/v/..., /images/...) is committed under static/ or produced by the media build. */
export function makeFileExists(root, pinnedPaths = new Set()) {
  return (p) => {
    if (!p.startsWith('/')) return false;
    const clean = decodeURIComponent(p.split(/[?#]/)[0]);
    if (clean.includes('..')) return false;
    return pinnedPaths.has(clean) || existsSync(join(root, 'static', clean));
  };
}
