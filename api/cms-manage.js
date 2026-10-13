// Vercel Function: POST /api/cms-manage — where-used checks, deletion and undo for the site dashboard (/admin).
// James, Oct 13 2026: delete old projects, photos, films and Field Notes for real, with anything still in use protected.
//
// Safety rules (Codex CMS audit, Oct 13 2026):
//  - The repository and branch come only from this deployment (VERCEL_GIT_REPO_OWNER/SLUG, VERCEL_GIT_COMMIT_REF);
//    the caller names an item, never a repository, branch or file path.
//  - Every request reads the branch's current files from GitHub; nothing relies on the last build's maps.
//  - A deletion must name the commit the owner reviewed (`head`). If anything was saved since, it is refused and the
//    dashboard checks again. The branch moves only by fast-forward (force: false), so a concurrent save is never lost.
//  - One commit removes the record and only the picture files the owner ticked that nothing else uses.
//  - Undo restores exactly the files one dashboard deletion removed, from that commit's parent, if they are still absent.
//  - It acts with the signed-in editor's own GitHub token (sent by the dashboard); GitHub enforces write access.
//    The token is never logged or stored.
import { branchHead, readRepo, pathsExist, gh } from '../src/lib/github-repo.js';
import { whereUsed, planDeletion, displayName, COLLECTIONS, KEY } from '../src/lib/usage-core.js';

const send = (res, status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
const ALLOWED_DELETE = /^(content\/(media|projects)\/[a-z0-9][a-z0-9-]*\.json|content\/field-notes\/[a-z0-9][a-z0-9-]*\.md|static\/images\/(library|projects|field-notes)\/[^/]+)$/;
const MESSAGE = 'Dashboard: delete';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { ok: false }); }
  const owner = process.env.VERCEL_GIT_REPO_OWNER; const name = process.env.VERCEL_GIT_REPO_SLUG; const branch = process.env.VERCEL_GIT_COMMIT_REF;
  if (!owner || !name || !branch) return send(res, 503, { ok: false, message: 'Deleting works on the deployed dashboard only.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!/^[\w-]{20,255}$/.test(token)) return send(res, 401, { ok: false, message: 'Sign in to the dashboard first.' });
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } } body = body || {};
  const { action, collection, key } = body;

  try {
    if (action === 'restore') return await restore(res, token, owner, name, branch, String(body.commit || ''));
    // Saved vs on the site: the dashboard compares this with the commit the review site was built from (/admin/status.json).
    // A save alone does not mean a build started or worked: the build state is what Vercel reported on that commit.
    if (action === 'head') { const head = await branchHead(token, owner, name, branch); return send(res, 200, { ok: true, head, branch, build: await buildState(token, owner, name, head) }); }
    if (!COLLECTIONS[collection] || !KEY.test(String(key || ''))) return send(res, 400, { ok: false, message: 'This kind of item cannot be checked here.' });
    const head = await branchHead(token, owner, name, branch);
    const repo = await readRepo(token, owner, name, head);

    if (action === 'check') {
      const usage = whereUsed({ collection, key }, repo);
      const rec = collection === 'field-notes' ? repo.notes.find((n) => n.file === `${key}.md`) : collection === 'projects' ? repo.projects.find((p) => p.slug === key) : repo.media.find((m) => m.id === key);
      return send(res, 200, { ok: true, head, branch, name: displayName(collection, rec), ...usage });
    }
    if (action !== 'delete') return send(res, 400, { ok: false, message: 'Unknown request.' });
    if (body.head !== head) return send(res, 409, { ok: false, changed: true, message: 'Something was saved since you checked. Check again before deleting.' });
    const plan = planDeletion({ collection, key, confirm: body.confirm, files: Array.isArray(body.files) ? body.files.map(String) : [] }, repo);
    if (plan.errors.length) return send(res, 409, { ok: false, message: plan.errors.join(' '), ...(plan.usage || {}) });
    if (!plan.paths.every((p) => ALLOWED_DELETE.test(p))) return send(res, 400, { ok: false, message: 'That file cannot be deleted here.' });
    const exist = await pathsExist(token, owner, name, head, plan.paths);
    const missing = plan.paths.filter((p) => !exist[p]);
    if (missing.length) return send(res, 409, { ok: false, message: `Already gone: ${missing.join(', ')}. Reload the dashboard.` });

    const commit = (await gh(token, `/repos/${owner}/${name}/git/commits/${head}`)).json;
    const tree = await gh(token, `/repos/${owner}/${name}/git/trees`, { method: 'POST', body: { base_tree: commit.tree.sha, tree: plan.paths.map((p) => ({ path: p, mode: '100644', type: 'blob', sha: null })) } });
    if (!tree.ok) return send(res, 502, { ok: false, message: 'GitHub refused the change. Nothing was deleted.' });
    const label = `${COLLECTIONS[collection].label} “${plan.name}”`;
    const made = await gh(token, `/repos/${owner}/${name}/git/commits`, { method: 'POST', body: { message: `${MESSAGE} ${label}\n\nRemoved: ${plan.paths.join(', ')}\nUndo from the dashboard, or restore these files from this commit's parent.`, tree: tree.json.sha, parents: [head] } });
    if (!made.ok) return send(res, 502, { ok: false, message: 'GitHub refused the change. Nothing was deleted.' });
    const moved = await gh(token, `/repos/${owner}/${name}/git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`, { method: 'PATCH', body: { sha: made.json.sha, force: false } });
    if (!moved.ok) return send(res, moved.status === 422 ? 409 : 502, { ok: false, changed: moved.status === 422, message: moved.status === 422 ? 'Something was saved at the same moment. Nothing was deleted; check again.' : 'GitHub refused the change. Nothing was deleted.' });
    return send(res, 200, { ok: true, commit: made.json.sha, removed: plan.paths, message: `Deleted ${label}.` });
  } catch (e) {
    return send(res, e.status === 401 ? 401 : 502, { ok: false, message: e.status === 401 ? e.message : 'GitHub could not be reached. Nothing was changed; try again in a minute.' });
  }
}

/** What Vercel reported on a commit: 'success', 'pending', 'failure' or 'unknown' (nothing reported yet), with its link. */
async function buildState(token, owner, name, sha) {
  const [st, cr] = await Promise.all([gh(token, `/repos/${owner}/${name}/commits/${sha}/statuses?per_page=100`), gh(token, `/repos/${owner}/${name}/commits/${sha}/check-runs?per_page=100`)]);
  return pickBuildState((st.ok && Array.isArray(st.json) ? st.json : []), (cr.ok && cr.json.check_runs) || []);
}
/**
 * The newest report per Vercel status context or check (a retried build that succeeded replaces the earlier failure),
 * then the most serious of those: any current failure, else still building, else success.
 */
export function pickBuildState(statuses, checkRuns) {
  const latest = new Map();
  const keep = (key, r) => { const prev = latest.get(key); if (!prev || String(r.at || '') > String(prev.at || '')) latest.set(key, r); };
  for (const x of statuses) if (/vercel/i.test(x.context || '')) keep(`s:${x.context}`, { state: x.state === 'success' ? 'success' : x.state === 'pending' ? 'pending' : 'failure', url: x.target_url, at: x.updated_at || x.created_at });
  for (const x of checkRuns) if (/vercel/i.test(`${x.name} ${x.app && x.app.slug}`)) keep(`c:${x.name}`, { state: x.status !== 'completed' ? 'pending' : ['success', 'neutral', 'skipped'].includes(x.conclusion) ? 'success' : 'failure', url: x.details_url || x.html_url, at: x.completed_at || x.started_at });
  if (!latest.size) return { state: 'unknown' };
  const rank = { failure: 3, pending: 2, success: 1 };
  return [...latest.values()].sort((a, b) => rank[b.state] - rank[a.state])[0];
}

/** Undo one dashboard deletion: put back the files it removed, if they are still absent, as a new commit. */
async function restore(res, token, owner, name, branch, sha) {
  if (!/^[0-9a-f]{40}$/.test(sha)) return send(res, 400, { ok: false, message: 'Unknown deletion.' });
  const c = await gh(token, `/repos/${owner}/${name}/commits/${sha}`);
  if (!c.ok) return send(res, 404, { ok: false, message: 'That deletion was not found.' });
  const files = c.json.files || [];
  if (!String(c.json.commit.message).startsWith(MESSAGE) || c.json.parents.length !== 1 || !files.length || files.some((f) => f.status !== 'removed' || !ALLOWED_DELETE.test(f.filename))) {
    return send(res, 400, { ok: false, message: 'Only a deletion made from the dashboard can be undone here.' });
  }
  const parent = c.json.parents[0].sha;
  const head = await branchHead(token, owner, name, branch);
  const paths = files.map((f) => f.filename);
  const now = await pathsExist(token, owner, name, head, paths);
  if (paths.some((p) => now[p])) return send(res, 409, { ok: false, message: 'Something with the same name exists again, so nothing was restored.' });
  const before = await pathsExist(token, owner, name, parent, paths);
  if (paths.some((p) => !before[p])) return send(res, 409, { ok: false, message: 'The earlier version could not be found.' });
  const base = (await gh(token, `/repos/${owner}/${name}/git/commits/${head}`)).json;
  const tree = await gh(token, `/repos/${owner}/${name}/git/trees`, { method: 'POST', body: { base_tree: base.tree.sha, tree: paths.map((p) => ({ path: p, mode: '100644', type: 'blob', sha: before[p] })) } });
  if (!tree.ok) return send(res, 502, { ok: false, message: 'GitHub refused the change. Nothing was restored.' });
  const made = await gh(token, `/repos/${owner}/${name}/git/commits`, { method: 'POST', body: { message: `Dashboard: undo delete (restores ${paths.join(', ')} from ${sha.slice(0, 7)})`, tree: tree.json.sha, parents: [head] } });
  const moved = made.ok && await gh(token, `/repos/${owner}/${name}/git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`, { method: 'PATCH', body: { sha: made.json.sha, force: false } });
  if (!moved || !moved.ok) return send(res, 409, { ok: false, message: 'Nothing was restored; try again.' });
  return send(res, 200, { ok: true, commit: made.json.sha, restored: paths, message: 'Restored.' });
}
