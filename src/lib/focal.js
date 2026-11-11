// Shared crop coordinates. Old named focus choices remain valid; new choices use percentages.
const PRESETS = { center: [50, 50], top: [50, 15], 'upper-third': [50, 30], bottom: [50, 85], left: [20, 50], right: [80, 50] };
export const validFocal = (v) => typeof v === 'string' ? Object.hasOwn(PRESETS, v) : !!v && typeof v === 'object' && !Array.isArray(v) && ['x', 'y'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 100);
export const focalPoint = (v) => validFocal(v) ? typeof v === 'string' ? { x: PRESETS[v][0], y: PRESETS[v][1] } : { x: v.x, y: v.y } : null;
export const focalPosition = (v) => { const p = focalPoint(v); return p ? `${p.x}% ${p.y}%` : null; };
