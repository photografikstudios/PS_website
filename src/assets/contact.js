// Custom inquiry form: validation, server submit, and an email fallback so no inquiry is lost.
import { track } from './site.js';

const form = document.getElementById('inquiry');
const errBox = document.getElementById('form-error');
const EMAIL = 'info@photografikstudios.com';
const typeSel = form.querySelector('#i-type');

const qType = new URLSearchParams(location.search).get('type');
if (qType && [...typeSel.options].some((o) => o.value === qType)) typeSel.value = qType;

const rules = {
  name: (v) => (v.trim() ? '' : 'Please enter your name.'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Please enter a valid email address, like name@company.com.'),
  type: (v) => (v ? '' : 'Please choose a project type.'),
};

function fieldError(el, msg) {
  const id = `${el.id}-err`;
  let p = document.getElementById(id);
  if (msg) {
    if (!p) { p = document.createElement('p'); p.id = id; p.className = 'field__error'; el.insertAdjacentElement('afterend', p); }
    p.textContent = msg;
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-describedby', id);
  } else {
    p?.remove();
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  }
}

function validate() {
  let first = null;
  for (const [name, rule] of Object.entries(rules)) {
    const el = form.elements[name];
    const msg = rule(el.value);
    fieldError(el, msg);
    if (msg && !first) first = el;
  }
  return first;
}

for (const name of Object.keys(rules)) {
  form.elements[name].addEventListener('blur', (e) => { if (e.target.value) fieldError(e.target, rules[name](e.target.value)); });
}

function summary(data) {
  const label = typeSel.selectedOptions[0]?.textContent || data.type;
  const lines = [
    `Name: ${data.name}`, `Email: ${data.email}`, data.phone && `Phone: ${data.phone}`, data.company && `Company: ${data.company}`,
    `Project type: ${label}`, data.location && `Location: ${data.location}`, data.timing && `Timing: ${data.timing}`,
    data.budget && `Budget: ${data.budget}`, data.deliverables && `Needs and usage: ${data.deliverables}`,
    data.agency && `Agency or white-label: ${data.agency}`, data.decision && `Approvals: ${data.decision}`, data.source && `Found us via: ${data.source}`,
  ].filter(Boolean);
  return lines.join('\n');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errBox.hidden = true;
  const invalid = validate();
  if (invalid) {
    errBox.textContent = 'Please fix the highlighted fields.';
    errBox.hidden = false;
    invalid.focus();
    track('form_error', { form: 'inquiry', field: invalid.name });
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  if (data.website) return; // honeypot
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Sending…';
  let delivered = false;
  try {
    const res = await fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    delivered = res.ok;
  } catch { delivered = false; }
  btn.disabled = false; btn.textContent = 'Send inquiry';
  if (delivered) {
    form.hidden = true;
    const done = document.getElementById('form-done');
    done.hidden = false; done.focus();
    track('inquiry_submit', { type: data.type, delivery: 'server' });
    return;
  }
  // Fallback: prepared email to the studio inbox.
  const text = summary(data);
  const href = `mailto:${EMAIL}?subject=${encodeURIComponent(`Project inquiry: ${typeSel.selectedOptions[0]?.textContent || ''}`)}&body=${encodeURIComponent(text)}`;
  document.getElementById('fallback-mailto').href = href;
  document.getElementById('fallback-text').textContent = text;
  form.hidden = true;
  const fb = document.getElementById('form-fallback');
  fb.hidden = false; fb.focus();
  track('inquiry_submit', { type: data.type, delivery: 'mailto_fallback' });
  location.href = href;
});
