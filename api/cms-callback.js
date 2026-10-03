// Vercel Function: GET /api/cms-callback — finishes GitHub sign-in for the site dashboard (/admin).
// Checks the state cookie, exchanges the code for a token server-side, and hands the token only to the
// /admin window on this same site (Decap CMS's "authorization:github:success" message). Nothing is logged.
const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const page = (status, payload, origin) => `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in…</title></head><body>
<p>${status === 'success' ? 'Signed in. You can close this window.' : 'Sign-in did not complete. Close this window and try again.'}</p>
<script>
(function () {
  var origin = ${js(origin)};
  var msg = 'authorization:github:${status}:' + ${js(JSON.stringify(payload))};
  function receive(e) {
    if (e.origin !== origin) return;
    window.removeEventListener('message', receive);
    window.opener.postMessage(msg, origin);
  }
  if (!window.opener) return;
  window.addEventListener('message', receive);
  window.opener.postMessage('authorizing:github', origin);
})();
</script></body></html>`;

const cookie = (req, name) => (String(req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '=')) || '').slice(name.length + 1);

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `https://${host}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Set-Cookie', 'cms_oauth_state=; Path=/api/cms-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  const { code, state } = req.query || {};
  const expected = cookie(req, 'cms_oauth_state');
  if (!code || !state || !expected || state !== expected) { res.statusCode = 400; return res.end(page('error', { message: 'invalid state' }, origin)); }
  try {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: (process.env.CMS_GITHUB_CLIENT_ID || '').trim(), client_secret: (process.env.CMS_GITHUB_CLIENT_SECRET || '').trim(), code, redirect_uri: `${origin}/api/cms-callback` }),
    });
    const data = await r.json();
    if (!data.access_token) { res.statusCode = 401; return res.end(page('error', { message: 'sign-in refused' }, origin)); }
    res.statusCode = 200;
    return res.end(page('success', { token: data.access_token, provider: 'github' }, origin));
  } catch {
    res.statusCode = 502;
    return res.end(page('error', { message: 'GitHub could not be reached' }, origin));
  }
}
