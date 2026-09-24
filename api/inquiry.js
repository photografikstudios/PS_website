// Vercel Function: POST /api/inquiry
// Sends the custom inquiry to info@photografikstudios.com through Resend when RESEND_API_KEY is set.
// Without a key it returns 503 and the browser falls back to a prepared email, so nothing is lost.
// Secrets stay server-side. No inquiry content is logged.

const TO = process.env.INQUIRY_TO || 'info@photografikstudios.com';
const FROM = process.env.INQUIRY_FROM || 'Photografik Website <website@photografikstudios.com>';
const MAX = 4000;

const clean = (v, n = 300) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  if (body.website) return res.status(200).json({ ok: true }); // honeypot: pretend success

  const data = {
    name: clean(body.name, 120), email: clean(body.email, 200), phone: clean(body.phone, 40), company: clean(body.company, 160),
    type: clean(body.type, 60), location: clean(body.location), timing: clean(body.timing), budget: clean(body.budget, 80),
    deliverables: clean(body.deliverables, MAX), agency: clean(body.agency, 10), decision: clean(body.decision), source: clean(body.source),
  };
  const errors = [];
  if (!data.name) errors.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('email');
  if (!data.type) errors.push('type');
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ ok: false, fallback: 'mailto' });

  const rows = Object.entries(data).filter(([, v]) => v);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = `<table>${rows.map(([k, v]) => `<tr><th align="left" valign="top" style="padding:4px 12px 4px 0">${escapeHtml(k)}</th><td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`).join('')}</table>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: data.email, subject: `Website inquiry: ${data.type} from ${data.name}`, text, html }),
    });
    if (!r.ok) { console.error('inquiry: email provider returned', r.status); return res.status(502).json({ ok: false, fallback: 'mailto' }); }
    return res.status(200).json({ ok: true });
  } catch {
    console.error('inquiry: email provider unreachable');
    return res.status(502).json({ ok: false, fallback: 'mailto' });
  }
}
