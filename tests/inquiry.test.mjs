// /api/inquiry with a mocked email provider (no network, nothing sent): success, provider error and network failure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/inquiry.js';

const res = () => { const r = { code: 0, body: null, headers: {} }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; };
const brief = { name: 'Pat Test', email: 'pat@example.com', type: 'architecture-design', deliverables: 'TEST brief' };

test('inquiry: no key -> 503 mailto fallback; provider error -> 502; network error -> 502; accepted -> 200 with reply_to', async () => {
  const realFetch = globalThis.fetch; const realKey = process.env.RESEND_API_KEY; const errs = []; const realErr = console.error; console.error = (...a) => errs.push(a.join(' '));
  try {
    delete process.env.RESEND_API_KEY;
    let r = res(); await handler({ method: 'POST', body: brief }, r);
    assert.deepEqual([r.code, r.body], [503, { ok: false, fallback: 'mailto' }]);
    process.env.RESEND_API_KEY = 'test-key-not-real';
    globalThis.fetch = async () => ({ ok: false, status: 422 });
    r = res(); await handler({ method: 'POST', body: brief }, r);
    assert.deepEqual([r.code, r.body], [502, { ok: false, fallback: 'mailto' }]);
    globalThis.fetch = async () => { throw new Error('ECONNRESET'); };
    r = res(); await handler({ method: 'POST', body: brief }, r);
    assert.deepEqual([r.code, r.body], [502, { ok: false, fallback: 'mailto' }]);
    let sent; globalThis.fetch = async (url, init) => { sent = { url, init }; return { ok: true, status: 200 }; };
    r = res(); await handler({ method: 'POST', body: brief }, r);
    assert.deepEqual([r.code, r.body], [200, { ok: true }]);
    assert.ok(sent.init.signal instanceof AbortSignal, 'provider call has a timeout signal');
    const payload = JSON.parse(sent.init.body);
    assert.equal(sent.url, 'https://api.resend.com/emails');
    assert.equal(payload.reply_to, 'pat@example.com'); assert.deepEqual(payload.to, ['info@photografikstudios.com']);
    assert.match(payload.subject, /Website inquiry: architecture-design from Pat Test/);
    assert.ok(!errs.join(' ').includes('Pat') && !errs.join(' ').includes('pat@example.com'), 'no inquiry content in logs');
    r = res(); await handler({ method: 'POST', body: { ...brief, email: 'not-an-email' } }, r);
    assert.equal(r.code, 400);
  } finally { globalThis.fetch = realFetch; console.error = realErr; if (realKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = realKey; }
});
