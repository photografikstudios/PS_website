// Reads the dashboard's content from GitHub at one exact commit, for where-used checks and deletions
// (api/cms-manage.js). One GraphQL request returns every file the checks need, so the answer is never a stale build map.
// Uses the signed-in editor's own GitHub token (the same one the dashboard saves with); nothing is stored.

const GH = 'https://api.github.com';
export const ghHeaders = (token) => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'photografik-dashboard' });

export async function gh(token, path, { method = 'GET', body } = {}) {
  const r = await fetch(GH + path, { method, headers: { ...ghHeaders(token), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { status: r.status, ok: r.ok, json };
}

export async function graphql(token, query, variables) {
  const r = await gh(token, '/graphql', { method: 'POST', body: { query, variables } });
  if (!r.ok || !r.json || r.json.errors) throw Object.assign(new Error('GitHub could not be read'), { status: r.status, detail: r.json && r.json.errors });
  return r.json.data;
}

/** The commit the branch points at now. */
export async function branchHead(token, owner, name, branch) {
  const r = await gh(token, `/repos/${owner}/${name}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`);
  if (r.status === 401) throw Object.assign(new Error('Your dashboard sign-in has expired. Sign out and sign in again.'), { status: 401 });
  if (!r.ok) throw Object.assign(new Error('GitHub could not be reached'), { status: r.status });
  return r.json.object.sha;
}

const DIRS = { projects: 'content/projects', media: 'content/media', notes: 'content/field-notes', pageMedia: 'content/page-media' };
const FILES = { work: 'content/work.json', pageText: 'content/pages.json', legacy: 'content/legacy-articles.json', vercel: 'vercel.json', assets: 'content/media-assets.json', posters: 'content/poster-assets.json' };

/** Parses a Field Note file the same way the build does (JSON front matter, then Markdown). */
export function parseNote(text, file) {
  const src = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const close = src.search(/\n\}[ \t]*(\n|$)/);
  const front = close > 0 ? JSON.parse(src.slice(0, close + 2)) : {};
  return { file, slug: (front.slug || file.replace(/\.md$/, '')).trim(), front, body: close > 0 ? src.slice(close + 2) : '' };
}

export const withName = (rec, key, file) => ({ ...rec, [key]: rec[key] === undefined || rec[key] === null || rec[key] === '' ? file.replace(/\.json$/, '') : rec[key] });

/** Everything whereUsed() needs, read at commit `oid`. */
export async function readRepo(token, owner, name, oid) {
  const tree = 'fragment T on Tree { entries { name type object { ... on Blob { text } } } }';
  const fields = [
    ...Object.entries(DIRS).map(([k, p]) => `${k}: object(expression: "${oid}:${p}") { ...T }`),
    ...Object.entries(FILES).map(([k, p]) => `${k}: object(expression: "${oid}:${p}") { ... on Blob { text } }`),
  ];
  const data = await graphql(token, `query($o: String!, $n: String!) { repository(owner: $o, name: $n) { ${fields.join('\n')} } } ${tree}`, { o: owner, n: name });
  const repo = data.repository;
  const json = (t, f) => { try { return JSON.parse(t); } catch { throw Object.assign(new Error(`${f} could not be read`), { status: 500 }); } };
  const list = (k, ext) => ((repo[k] && repo[k].entries) || []).filter((e) => e.type === 'blob' && e.name.endsWith(ext));
  return {
    // Same as loadWork: a record without its own slug/id (new in the dashboard) takes its file name.
    projects: list('projects', '.json').map((e) => withName(json(e.object.text, e.name), 'slug', e.name)),
    media: list('media', '.json').map((e) => withName(json(e.object.text, e.name), 'id', e.name)),
    notes: list('notes', '.md').map((e) => parseNote(e.object.text, e.name)),
    pageMedia: Object.fromEntries(list('pageMedia', '.json').map((e) => [e.name.replace(/\.json$/, ''), json(e.object.text, e.name)])),
    work: repo.work ? json(repo.work.text, 'work.json') : {},
    pageText: repo.pageText ? json(repo.pageText.text, 'pages.json') : {},
    legacy: repo.legacy ? json(repo.legacy.text, 'legacy-articles.json') : {},
    vercel: repo.vercel ? json(repo.vercel.text, 'vercel.json') : {},
    pins: new Set(Object.keys((repo.assets && json(repo.assets.text, 'media-assets.json').files) || {})),
    posterPins: new Set(Object.keys((repo.posters && json(repo.posters.text, 'poster-assets.json').files) || {})),
  };
}

/** Which of these repository paths exist at `oid`. */
export async function pathsExist(token, owner, name, oid, paths) {
  if (!paths.length) return {};
  const q = paths.map((p, i) => `f${i}: object(expression: ${JSON.stringify(`${oid}:${p}`)}) { oid }`).join('\n');
  const data = await graphql(token, `query($o: String!, $n: String!) { repository(owner: $o, name: $n) { ${q} } }`, { o: owner, n: name });
  return Object.fromEntries(paths.map((p, i) => [p, data.repository[`f${i}`] ? data.repository[`f${i}`].oid : null]));
}

/** Picture files in the dashboard's upload folders at `oid` (names only). */
export async function listUploads(token, owner, name, oid) {
  const dirs = ['library', 'projects', 'field-notes'];
  const q = dirs.map((d, i) => `d${i}: object(expression: ${JSON.stringify(`${oid}:static/images/${d}`)}) { ... on Tree { entries { name type object { ... on Blob { byteSize } } } } }`).join('\n');
  const data = await graphql(token, `query($o: String!, $n: String!) { repository(owner: $o, name: $n) { ${q} } }`, { o: owner, n: name });
  const out = [];
  dirs.forEach((d, i) => { for (const e of (data.repository[`d${i}`] && data.repository[`d${i}`].entries) || []) if (e.type === 'blob') out.push({ path: `/images/${d}/${e.name}`, bytes: e.object && e.object.byteSize }); });
  return out;
}
