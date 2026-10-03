// Vercel Function: GET /api/cms-auth — starts GitHub sign-in for the site dashboard (/admin, Decap CMS).
// Needs a GitHub OAuth App owned by Photografik (not created by this code) with its callback set to
// https://<site>/api/cms-callback, and two server-side environment variables:
//   CMS_GITHUB_CLIENT_ID, CMS_GITHUB_CLIENT_SECRET
// Without them the editor shows a plain "not configured" message and nothing else happens.
// Only people with write access to the repository can save: GitHub enforces that, not this function.
import { randomBytes } from 'node:crypto';

// PS_website is a public repository, so the narrower public_repo scope is enough to save (Codex security review,
// Oct 2 2026). If the repository is ever made private, saving needs scope=repo (or a single-repository GitHub App).
const SCOPE = 'public_repo';

export default function handler(req, res) {
  // Trimmed: a key pasted into Vercel with a stray space broke sign-in once (Oct 2 2026).
  const clientId = (process.env.CMS_GITHUB_CLIENT_ID || '').trim();
  if (!clientId || !(process.env.CMS_GITHUB_CLIENT_SECRET || '').trim()) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('The site dashboard sign-in is not set up yet (CMS_GITHUB_CLIENT_ID / CMS_GITHUB_CLIENT_SECRET).');
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const state = randomBytes(24).toString('hex');
  const redirect = `https://${host}/api/cms-callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&scope=${SCOPE}&state=${state}`;
  res.statusCode = 302;
  res.setHeader('Set-Cookie', `cms_oauth_state=${state}; Path=/api/cms-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', url);
  res.end();
}
