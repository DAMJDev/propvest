// Shared helpers used across the app and feature screens.
const json = r => r.json().catch(() => ({ error: 'Unexpected response from the server.' }));

export const API = {
  get: (url) => fetch(url, { credentials: 'include' }).then(json),
  post: (url, data) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) }).then(json),
  put: (url, data) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) }).then(json),
  upload: (url, formData) => fetch(url, { method: 'POST', credentials: 'include', body: formData }).then(json),
};

// Inputs on light (white/paper) cards: the global .fi style is designed for dark modals.
export const lightFi = { color: '#111', background: '#fafafa', borderColor: 'rgba(0,0,0,0.15)' };

export const box = { background: '#fff', border: '1px solid rgba(0,0,0,0.07)', padding: 20, marginBottom: 16 };
export const h3 = { fontFamily: "'Cormorant Garamond',serif", fontSize: 18, marginBottom: 10 };
export const money = n => (n == null || Number.isNaN(n)) ? '—' : '$' + Math.round(n).toLocaleString('en-AU');
export const dt = d => d ? new Date(d).toLocaleDateString('en-AU') : '—';
export const muted = { fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 };

export const TONES = { good: '#27ae60', warn: '#E67E22', bad: '#C0392B', info: '#3498db', mute: '#999' };
export const STATUS_TONE = {
  verified: 'good', approved: 'good', confirmed: 'good', released: 'good', ready: 'good', locked: 'good', scored: 'good', live: 'good', active: 'good',
  pending: 'warn', pending_confirmation: 'warn', submitted: 'warn', draft: 'warn', requested: 'warn', pending_review: 'warn', assigned: 'info',
  rejected: 'bad', blocked: 'bad', expired: 'bad', lapsed: 'bad', withdrawn: 'mute', missing: 'mute', none: 'mute', unassigned: 'mute'
};
