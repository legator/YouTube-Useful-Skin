export const qs = (sel, root = document) => root.querySelector(sel);

/**
 * Creates a DOM element. 
 * WARNING: `html` parameter uses innerHTML - only pass trusted/sanitized content!
 * For user-generated content, use textContent instead.
 */
export const ce = (tag, cls, html) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html) el.innerHTML = html; /* ONLY for trusted SVG/icon strings */
  if (tag === 'button') el.type = 'button'; /* Prevent default form submission */
  return el;
};

/** Escapes text for safe HTML insertion (converts special chars to entities) */
export const escapeHtml = (text) => {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const fmtTime = (s) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  return m + ':' + String(sec).padStart(2, '0');
};
