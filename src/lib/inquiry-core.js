// The same limits govern the form and its email endpoint. Reject excess text instead of silently shortening a brief.
export const INQUIRY_LIMITS = Object.freeze({ name: 120, email: 200, phone: 40, company: 160, type: 60,
  location: 300, timing: 300, budget: 80, deliverables: 4000, agency: 10, decision: 300, source: 300 });
const labels = { name: 'your name', email: 'your email address', phone: 'your phone number', company: 'the company name',
  type: 'the project type', location: 'the location', timing: 'the timing', budget: 'the budget', deliverables: 'your project details',
  agency: 'the agency choice', decision: 'the approval details', source: 'how you found us' };
export const inquiryLengthError = (name, value) => String(value ?? '').length > INQUIRY_LIMITS[name]
  ? `Please shorten ${labels[name] || name} to ${INQUIRY_LIMITS[name].toLocaleString('en-US')} characters or fewer. Your text is still here to edit.` : '';
export const inquiryLengthErrors = data => Object.keys(INQUIRY_LIMITS).filter(name => inquiryLengthError(name, data[name]));
