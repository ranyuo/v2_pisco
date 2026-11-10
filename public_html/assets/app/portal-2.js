'use strict';
/* ==== core.js ==== */
/* =========================================================
   NÚCLEO: utilidades, almacenamiento, seguridad, recursos
   ========================================================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowISO = () => new Date().toISOString();
const pad = (n, l = 2) => String(n).padStart(l, '0');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fdate(d, withTime) {
  if (!d) return '—';
  const x = new Date(d); if (isNaN(x)) return esc(d);
  let s = `${x.getDate()} de ${MESES[x.getMonth()]} de ${x.getFullYear()}`;
  if (withTime) s += `, ${pad(x.getHours())}:${pad(x.getMinutes())}`;
  return s;
}
function fshort(d, withTime) {
  if (!d) return '—';
  const x = new Date(d); if (isNaN(x)) return esc(d);
  return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}` + (withTime ? ` ${pad(x.getHours())}:${pad(x.getMinutes())}` : '');
}
const money = n => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = n => Number(n || 0).toLocaleString('es-PE');
const slugify = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
const normTitle = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const maskDni = d => d ? '****' + String(d).slice(-4) : '';
// Documento inerte: un elemento del documento real cargaría imágenes y ejecutaría atributos como onerror.
// Fecha local AAAA-MM-DD (toISOString usa UTC: en Perú cambiaría de día a las 19:00).
const localYmd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const stripTags = h => new DOMParser().parseFromString(String(h || ''), 'text/html').body.textContent || '';
const clamp = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const yearNow = () => new Date().getFullYear();

/* ---------- Toasts ---------- */
function toast(msg, type = '') {
  let box = $('.toast-box'); if (!box) { box = document.createElement('div'); box.className = 'toast-box'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/* ---------- Modal ---------- */
function modal({ title, body, foot = '', size = '', onClose }) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="mdl-t"><div class="modal-h"><h2 id="mdl-t">${title}</h2><button class="modal-x" aria-label="Cerrar ventana">✕</button></div><div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
  const prev = document.activeElement;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); prev && prev.focus && prev.focus(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  $('.modal-x', bg).onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bg);
  setTimeout(() => { const f = $('input,select,textarea,button:not(.modal-x)', $('.modal-b', bg)) || $('.modal-x', bg); f && f.focus(); }, 30);
  return { el: bg, close };
}
function confirmBox(msg, { ok = 'Confirmar', danger = true, title = 'Confirmar acción' } = {}) {
  return new Promise(res => {
    let done = false;
    const m = modal({ title, size: 'sm', body: `<p>${msg}</p>`, foot: `<button class="btn ghost" data-r="0">Cancelar</button><button class="btn ${danger ? 'danger' : ''}" data-r="1">${ok}</button>`, onClose: () => { if (!done) res(false); } });
    $$('[data-r]', m.el).forEach(b => b.onclick = () => { done = true; res(b.dataset.r === '1'); m.close(); });
  });
}
function promptBox(msg, { title = 'Ingrese un dato', ok = 'Aceptar', value = '', textarea = false } = {}) {
  return new Promise(res => {
    let done = false;
    const inp = textarea ? `<textarea class="inp" id="pb-v" rows="4">${esc(value)}</textarea>` : `<input class="inp" id="pb-v" value="${esc(value)}">`;
    const m = modal({ title, size: 'sm', body: `<label class="lbl" for="pb-v">${msg}</label>${inp}`, foot: `<button class="btn ghost" data-r="0">Cancelar</button><button class="btn" data-r="1">${ok}</button>`, onClose: () => { if (!done) res(null); } });
    $$('[data-r]', m.el).forEach(b => b.onclick = () => { done = true; const v = $('#pb-v', m.el).value; m.close(); res(b.dataset.r === '1' ? v : null); });
  });
}

/* ---------- Iconos (trazos tipo "feather") ---------- */
const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.2 4.4 1.9 5 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  map: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 20V9"/><path d="M7 13l5-5 5 5"/><path d="M4 4h16"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><rect x="9.5" y="9.5" width="5" height="5"/>',
  heart: '<path d="M12 20s-8-4.6-8-10.2A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.8C20 15.4 12 20 12 20z"/><path d="M8 12h2l1-2 2 4 1-2h2"/>',
  leaf: '<path d="M4 20c0-9 6-15 16-16-1 10-7 16-16 16z"/><path d="M4 20l8-8"/>',
  food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 3c-2 2-3 5-3 8h3v10"/>',
  calc: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8v4H8zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  crane: '<path d="M4 21h10M7 21V5l12 3M7 5l5 0M19 8v5M17 13h4v3h-4z"/><path d="M7 9l4-4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  inbox: '<path d="M3 13l3-9h12l3 9v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  ext: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2"/><path d="M9 11h6M9 15h6"/>',
  grad: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/><path d="M22 9v6"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>',
  flask: '<path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V3"/><path d="M7 15h10"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  quote: '<path d="M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="14.5" cy="7" r="1.2"/><circle cx="17" cy="11" r="1.2"/>',
  arrowup: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  alignl: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  alignc: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  alignr: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  alignj: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
  ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  ol: '<path d="M10 6h10M10 12h10M10 18h10M4 4.5h1.5V9M4 9h3M4 14.5c0-1 2.8-1 2.8.4 0 1-2.8 2.1-2.8 3.6h3"/>',
  unlink: '<path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 4 8M8 12h4M3 3l18 18"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  hr: '<path d="M3 12h18M7 7h10M7 17h10" opacity=".9"/>',
  eraser: '<path d="m7 21-4-4 10-10 8 8-6 6zM10 21h11M8 12l7 7"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  marker: '<path d="m9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  textcolor: '<path d="M6 16 12 4l6 12M8.5 11h7"/><path d="M4 20h16" stroke-width="3"/>',
  indent: '<path d="M3 6h18M11 10h10M11 14h10M3 18h18M3 9l4 3-4 3"/>',
  outdent: '<path d="M3 6h18M11 10h10M11 14h10M3 18h18M7 9l-4 3 4 3"/>',
};
const ic = (n, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ICONS.file}</svg>`;
const BRAND = {
  facebook: '<path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9H17l.5-4h-4V8.8c0-.5.3-.8.5-.8z"/>',
  youtube: '<path d="M23 7.5a3 3 0 0 0-2.1-2.1C19 5 12 5 12 5s-7 0-8.9.4A3 3 0 0 0 1 7.5 31 31 0 0 0 .6 12 31 31 0 0 0 1 16.5a3 3 0 0 0 2.1 2.1C5 19 12 19 12 19s7 0 8.9-.4a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-4.5 31 31 0 0 0-.4-4.5zM9.8 15.1V8.9L15.2 12z"/>',
  instagram: '<path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM12 3.6c2.7 0 3 0 4.1.1 2.7.1 4 1.4 4.1 4.1.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c-.1 2.7-1.4 4-4.1 4.1-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-2.7-.1-4-1.4-4.1-4.1C3.6 15 3.6 14.7 3.6 12s0-3 .1-4.1C3.8 5.2 5.1 3.9 7.9 3.8 9 3.6 9.3 3.6 12 3.6z"/>',
  tiktok: '<path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6z"/>',
  whatsapp: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.2z"/>',
};
const bic = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${BRAND[n]}</svg>`;

/* ---------- Temas visuales (definidos y editados por el Administrador) ---------- */
const THEME_FONTS = { Montserrat: '"Montserrat","Inter",system-ui,Arial,sans-serif', Poppins: '"Poppins","Inter",system-ui,Arial,sans-serif', Merriweather: '"Merriweather",Georgia,"Times New Roman",serif', Inter: '"Inter",system-ui,Arial,sans-serif' };
const BODY_FONTS = { Inter: '"Inter",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif', Poppins: '"Poppins","Inter",system-ui,Arial,sans-serif', Sistema: 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif' };
const THEME_DEFAULTS = {
  pisco: { label: 'Pisco institucional', desc: 'Azul marino, celeste y oro del escudo del IESTP PISCO', modo: 'claro', navy: '#0b1d3f', navy2: '#123a7a', blue: '#0a7fc2', gold: '#f5c400', fh: 'Montserrat', ff: 'Inter', r: 12, base: true },
  institucional: { label: 'Institucional', desc: 'Azul marino y dorado', modo: 'claro', navy: '#0a2a5e', navy2: '#0d3a80', blue: '#1556b8', gold: '#f2b705', fh: 'Montserrat', ff: 'Inter', r: 12, base: true },
  esmeralda: { label: 'Esmeralda', desc: 'Verde y ámbar', modo: 'claro', navy: '#0b3d2e', navy2: '#0f5a42', blue: '#12805a', gold: '#f4b400', fh: 'Poppins', ff: 'Inter', r: 16, base: true },
  vino: { label: 'Académico', desc: 'Vino y oro, títulos con serifa', modo: 'claro', navy: '#4a0f1f', navy2: '#6d1a2e', blue: '#9e2238', gold: '#d9a520', fh: 'Merriweather', ff: 'Inter', r: 6, base: true },
  noche: { label: 'Noche', desc: 'Modo oscuro', modo: 'oscuro', navy: '#0a1428', navy2: '#13244a', blue: '#2f6fe0', gold: '#fbbf24', fh: 'Montserrat', ff: 'Inter', r: 12, base: true },
};
let TC = { navy: '#0b1d3f', navy2: '#123a7a', blue: '#0a7fc2', gold: '#f5c400' };
const hexRgb = h => { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgbToHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return rgbToHex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = h => { const c = hexRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const validHex = h => /^#[0-9a-fA-F]{6}$/.test(h || '');
function ensureThemes() {
  if (!DB.config.temas) DB.config.temas = JSON.parse(JSON.stringify(THEME_DEFAULTS));
  if (!DB.config.temas.pisco) DB.config.temas.pisco = JSON.parse(JSON.stringify(THEME_DEFAULTS.pisco));
  if (!DB.config.temas[DB.config.tema]) DB.config.tema = 'pisco';
  if (!DB.config.temas[DB.config.tema]) DB.config.tema = Object.keys(DB.config.temas)[0];
}
function themeVars(t) {
  const dark = t.modo === 'oscuro'; const v = { '--navy': t.navy, '--navy2': t.navy2, '--blue': t.blue, '--blue2': mix(t.blue, '#ffffff', .15), '--gold': t.gold, '--gold2': mix(t.gold, '#ffffff', .2), '--ov': hexRgb(mix(t.navy, '#000000', .3)).join(','), '--r': (+t.r || 0) + 'px', '--fh': THEME_FONTS[t.fh] || THEME_FONTS.Montserrat, '--ff': BODY_FONTS[t.ff] || BODY_FONTS.Inter };
  if (dark) { const card = '#121c32'; const link = mix(t.blue, '#ffffff', .45); Object.assign(v, { '--sky': mix(card, t.blue, .22), '--hc': '#eef3ff', '--link': link, '--blue-rgb': hexRgb(link).join(','), '--info': link }); }
  else { const sky = mix(t.blue, '#ffffff', .9); let link = t.blue; for (let k = 0; k < 10 && contrast(link, sky) < 4.6; k++) link = mix(link, '#000000', .1); Object.assign(v, { '--sky': sky, '--hc': t.navy, '--link': link, '--blue-rgb': hexRgb(t.blue).join(','), '--card2': mix(t.blue, '#ffffff', .975), '--bg': mix(t.blue, '#ffffff', .955), '--bg2': mix(t.blue, '#ffffff', .935), '--line': mix(t.navy, '#ffffff', .875), '--line2': mix(t.navy, '#ffffff', .77), '--info': t.blue, '--infobg': mix(t.blue, '#ffffff', .9), '--infoink': mix(t.navy, '#000000', .1) }); }
  return v;
}
/* Todas las estructuras toman sus colores de los 3 colores del portal (Institucional, Botones y enlaces, Destacado).
   Lo guardado en «Opciones avanzadas» (DB.config.disenoColores) solo reemplaza el color indicado. */
/* «Impacto» («impacto-flv» se migra a «impacto» en el servidor) */
const IMP_KEYS = ['impacto', 'impacto-flv'];
const IMP_CAMPOS = [['acento', 'Color de acento', 'Bloque del logotipo, recuadros, títulos destacados y detalles'], ['oscuro', 'Color oscuro', 'Franja de cifras, pie de página y banner de las páginas interiores'], ['boton', 'Botón «Postula»', 'Botón principal de la cabecera'], ['titulos', 'Títulos', 'Color de los títulos sobre fondo blanco']];
const impDefaults = t => ({ acento: t.gold, oscuro: t.navy, boton: t.blue, titulos: t.navy });
/* «Horizonte»: color principal, acento y fondo claro */
const HOR_CAMPOS = [['primario', 'Color principal', 'Bloque del logotipo, franjas, títulos y pie de página'], ['acento', 'Color de acento', 'Botón «Postula», flechas, palabras destacadas y enlaces'], ['fondo', 'Fondo claro', 'Fondo de las secciones claras']];
/* «Campus»: color principal, oscuro (botones y tarjetas) y pie */
const CAM_CAMPOS = [['primario', 'Color principal', 'Barra superior, títulos, botones principales y franja del pie'], ['oscuro', 'Color oscuro', 'Pestaña activa, botones secundarios y tarjetas de «¿Por qué estudiar?»'], ['pie', 'Fondo de enlaces del pie', 'Bloque de enlaces sobre la franja de color']];
/* Clásico, Moderno y Universitario */
const BASE_CAMPOS = [['principal', 'Color principal', 'Cabecera, títulos, franjas y pie de página'], ['secundario', 'Color secundario', 'Botones, enlaces y elementos interactivos'], ['acento', 'Color de acento', 'Detalles, líneas, etiquetas y cifras destacadas']];
const baseDef = t => ({ principal: t.navy, secundario: t.blue, acento: t.gold });
/* diseños con colores configurables */
const DCFG = {
  'clasico': { campos: BASE_CAMPOS, def: baseDef },
  'moderno': { campos: BASE_CAMPOS, def: baseDef },
  'universitario': { campos: BASE_CAMPOS, def: baseDef },
  'impacto': { campos: IMP_CAMPOS, def: impDefaults },
  'campus': { campos: CAM_CAMPOS, def: t => ({ primario: t.navy, oscuro: mix(t.navy, '#000000', .55), pie: mix(t.navy, '#000000', .3) }) },
  'horizonte': { campos: HOR_CAMPOS, def: t => ({ primario: t.navy, acento: t.gold, fondo: mix(t.blue, '#ffffff', .92) }) },
};
const dOn = bg => contrast('#ffffff', bg) >= contrast('#111111', bg) ? '#ffffff' : '#111111';
const hexOk = (v, f) => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : f;
/* Colores del tema con valores de respaldo válidos */
const themeSafe = t => Object.assign({}, t, { navy: hexOk(t && t.navy, '#0c2a5b'), navy2: hexOk(t && t.navy2, '#16449a'), blue: hexOk(t && t.blue, '#1e5fc8'), gold: hexOk(t && t.gold, '#f2b705') });
/* Combinaciones para «Opciones avanzadas»: las mismas del paso 2, traducidas a los campos de cada estructura */
const dPresets = cf => Object.values(DB.config.temas || {}).map(t => [t.label, cf.def(themeSafe(t))]);
function impColors(key, t) { const cf = DCFG[key]; t = Object.assign({}, t, { navy: hexOk(t && t.navy, '#0c2a5b'), navy2: hexOk(t && t.navy2, '#16449a'), blue: hexOk(t && t.blue, '#1e5fc8'), gold: hexOk(t && t.gold, '#f2b705') }); const d = cf.def(t), c = ((DB.config.disenoColores || {})[key]) || {}; const o = {}; for (const [k] of cf.campos) o[k] = /^#[0-9a-f]{6}$/i.test(c[k] || '') ? c[k] : d[k]; return o; }
function impApplyColors(t) {
  let st = document.getElementById('imp-vars'); const key = DB.config.diseno;
  if (!DCFG[key]) { if (st) st.textContent = ''; return; }
  if (!st) { st = document.createElement('style'); st.id = 'imp-vars'; document.head.appendChild(st); }
  const c = impColors(key, t); const on = dOn;
  if (BASE_CAMPOS === DCFG[key].campos) {
    const d = baseDef(t); if (c.principal === d.principal && c.secundario === d.secundario && c.acento === d.acento) { st.textContent = ''; return; }
    const v = themeVars(Object.assign({}, t, { navy: c.principal, navy2: mix(c.principal, c.secundario, .35), blue: c.secundario, gold: c.acento }));
    // Universitario calcula sus tonos a partir del tema: se recalculan con los colores elegidos.
    if (key === 'universitario') Object.assign(v, { '--dk': 'color-mix(in srgb,var(--navy) 22%,#050608)', '--dk2': 'color-mix(in srgb,var(--navy) 62%,#050608)', '--ac': 'var(--gold)', '--ac2': 'var(--blue)' });
    const sel = key === 'clasico' ? ':root:not([data-layout])' : `:root[data-layout="${key}"]`;
    st.textContent = `${sel} body:not(.is-admin){${Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')}}`; return;
  }
  if (key === 'campus') { const txt = (() => { let x = c.primario; for (let k = 0; k < 14 && contrast(x, '#ffffff') < 4.5; k++) x = mix(x, '#000000', .08); return x; })();
    st.textContent = `:root[data-layout="campus"] body:not(.is-admin){--kp:${c.primario};--kpo:${on(c.primario)};--kpd:${mix(c.primario, '#000000', .2)};--kpt:${txt};--kpl:${mix(c.primario, '#ffffff', .92)};--kk:${c.oscuro};--kko:${on(c.oscuro)};--kf:${c.pie};--kfo:${on(c.pie)}}`; return; }
  if (key === 'horizonte') { st.textContent = `:root[data-layout="horizonte"] body:not(.is-admin){--hp:${c.primario};--hpo:${on(c.primario)};--hpd:${mix(c.primario, '#000000', .28)};--hpl:${mix(c.primario, '#ffffff', .55)};--ha:${c.acento};--hao:${on(c.acento)};--hat:${(() => { if (contrast(c.acento, '#ffffff') >= 4.5) return c.acento; if (contrast(c.acento, '#ffffff') >= 3.2) { let x = c.acento; for (let k = 0; k < 8 && contrast(x, '#ffffff') < 4.5; k++) x = mix(x, '#000000', .06); return x; } let x = mix(c.primario, '#2f7cf6', .55); for (let k = 0; k < 12 && contrast(x, '#ffffff') < 4.5; k++) x = mix(x, '#000000', .08); return x; })()};--hf:${c.fondo}}`; return; }
  // Títulos en el color destacado sobre fondo claro: se oscurece lo justo para leerse (3:1, texto grande).
  const iyt = (() => { let x = c.acento; for (let k = 0; k < 16 && contrast(x, '#ffffff') < 3; k++) x = mix(x, '#000000', .08); return x; })();
  st.textContent = `:root[data-layout="impacto"] body:not(.is-admin){--iyt:${iyt};--iy:${c.acento};--ion:${on(c.acento)};--id:${c.oscuro};--icta:${c.boton};--icton:${on(c.boton)};--ik:${c.titulos}}`;
}
const DISENOS = [
  ['clasico', 'Clásico institucional', 'Diseño original del portal: cabecera institucional, carrusel y bloques en tarjetas.'],
  ['moderno', 'Moderno', 'Portada a pantalla completa, menú flotante con efecto vidrio, tarjetas amplias con esquinas redondeadas y sombras suaves.'],
  ['editorial', 'Editorial', 'Estilo de revista digital: tipografía grande, líneas finas, fondo claro y la noticia principal destacada en grande.'],
  ['impacto', 'Impacto', 'Alto contraste: logotipo en bloque del color destacado, portada a pantalla completa, títulos condensados en mayúsculas, mosaico de programas, recuadros de color y franja oscura de logros. El menú principal no cambia.'],
  ['campus', 'Campus', 'Portal de universidad con barra superior de color, menú en mayúsculas sobre la portada, títulos centrados subrayados, tarjetas de programas en capas de color, botones flotantes «Postula», eventos y noticias en tarjetas y pie en dos bloques.'],
  ['horizonte', 'Horizonte', 'Portal de universidad moderna: cabecera con logotipo en bloque de color, tarjeta translúcida sobre la portada, panel de oferta formativa, franjas de color con esquinas redondeadas y títulos en dos colores.'],
  ['universitario', 'Universitario', 'Portal de estilo universitario: cabecera oscura con logotipo en bloque blanco, programas con íconos circulares, franjas oscuras y carruseles en paneles. El menú principal no cambia.'],
];
function applyTheme() {
  if (!DB || !DB.config) return; ensureThemes(); const t = DB.config.temas[DB.config.tema];
  const css = ':root:root{' + Object.entries(themeVars(t)).map(([k, x]) => `${k}:${x}`).join(';') + '}';
  let st = document.getElementById('theme-vars'); if (!st) { st = document.createElement('style'); st.id = 'theme-vars'; document.head.appendChild(st); }
  const key = JSON.stringify(t); if (st.dataset.k !== key) { st.textContent = css; st.dataset.k = key; Object.keys(IMG_CACHE || {}).forEach(k => delete IMG_CACHE[k]); }
  if (t.modo === 'oscuro') document.documentElement.dataset.mode = 'dark'; else delete document.documentElement.dataset.mode;
  const lay = DB.config.diseno; if (DISENOS.some(d => d[0] === lay) && lay !== 'clasico') document.documentElement.dataset.layout = IMP_KEYS.includes(lay) ? 'impacto' : lay; else delete document.documentElement.dataset.layout;
  impApplyColors(t);
  // Impacto, Campus, Horizonte y Editorial no tienen versión oscura: con una combinación oscura, el sitio público usa sus tonos claros (el panel sigue oscuro).
  let nd = document.getElementById('nodark-vars'); if (!nd) { nd = document.createElement('style'); nd.id = 'nodark-vars'; document.head.appendChild(nd); }
  nd.textContent = t.modo === 'oscuro' ? NO_DARK.map(k => `:root[data-layout="${k}"] body:not(.is-admin)`).join(',') + '{' + Object.entries(Object.assign({}, LIGHT_NEUTRALS_ALL, themeVars(Object.assign({}, t, { modo: 'claro' })))).map(([k, x]) => `${k}:${x}`).join(';') + ';color-scheme:light;color:var(--ink);background:var(--page)}' : '';
  if (IMP_KEYS.includes(lay) && !document.getElementById('font-impacto')) { const l = document.createElement('link'); l.id = 'font-impacto'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap'; document.head.appendChild(l); }
  TC = { navy: t.navy, navy2: t.navy2, blue: t.blue, gold: t.gold };
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t.navy;
}

/* ---------- Imágenes generadas (marcadores de posición SVG) ---------- */
const svgURI = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }
const PALS = [['#0d3a80', '#1f6fd6'], ['#0b5d5b', '#1fa39f'], ['#6b2fa3', '#a05ce0'], ['#9a3b12', '#e0782e'], ['#14532d', '#2f9e5b'], ['#7a1f3d', '#d04772'], ['#334155', '#64748b'], ['#0f4c75', '#3282b8']];
function logoSVG(sigla = 'PISCO') {
  let teeth = '';
  for (let i = 0; i < 16; i++) { const a = i * 22.5; teeth += `<rect x="46" y="2" width="8" height="12" rx="1.5" fill="${TC.gold}" transform="rotate(${a} 50 50)"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${teeth}<circle cx="50" cy="50" r="40" fill="${TC.gold}"/><circle cx="50" cy="50" r="34" fill="${TC.navy}"/><circle cx="50" cy="50" r="34" fill="none" stroke="#fff" stroke-width="1"/><path d="M30 56h40v4H30z" fill="${TC.gold}"/><path d="M33 56c0-9 7.5-16 17-16s17 7 17 16" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M50 26v14M44 32l6-6 6 6" stroke="${TC.gold}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M36 48l14-5 14 5" stroke="#fff" stroke-width="2" fill="none"/><text x="50" y="72" text-anchor="middle" font-family="Arial,Helvetica" font-weight="900" font-size="8.5" fill="#fff" letter-spacing=".5">${esc(sigla)}</text><text x="50" y="80" text-anchor="middle" font-family="Arial" font-size="5" fill="${TC.gold}">I.E.S.P.</text></svg>`;
}
function campusSVG(seed = 1, w = 1600, h = 600, label = 'IESTP PISCO') {
  const r = hashStr('c' + seed); const sky = r % 2 ? ['#5aa4e8', '#cfe6fb'] : ['#3d8fdf', '#e3f1fd'];
  let palms = '';
  for (let i = 0; i < 4; i++) { const x = 120 + i * 430 + (r >> i) % 60; palms += `<g transform="translate(${x} ${h - 70})"><path d="M0 0 C 6 -90 0 -160 10 -230" stroke="#6b4f2a" stroke-width="12" fill="none"/>${[0, 1, 2, 3, 4, 5].map(k => `<path d="M10 -230 q ${-90 + k * 36} ${-30 + Math.abs(k - 2.5) * 22} ${-110 + k * 44} ${40 + Math.abs(k - 2.5) * 18}" stroke="#2f7d3a" stroke-width="14" fill="none" stroke-linecap="round"/>`).join('')}</g>`; }
  let win = '';
  for (let row = 0; row < 3; row++) for (let c = 0; c < 14; c++) win += `<rect x="${560 + c * 62}" y="${h - 330 + row * 78}" width="40" height="46" rx="3" fill="#9cc4ea" stroke="#fff" stroke-width="3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#s)"/><ellipse cx="${300 + r % 600}" cy="110" rx="140" ry="34" fill="#fff" opacity=".7"/><ellipse cx="${1200 - r % 300}" cy="80" rx="110" ry="26" fill="#fff" opacity=".6"/><rect x="520" y="${h - 400}" width="940" height="330" fill="#f5f7fb"/><rect x="520" y="${h - 400}" width="940" height="26" fill="${TC.blue}"/><rect x="520" y="${h - 96}" width="940" height="26" fill="#d9dee7"/>${win}<rect x="610" y="${h - 470}" width="560" height="74" rx="4" fill="#fff" stroke="${TC.blue}" stroke-width="4"/><text x="890" y="${h - 420}" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="46" fill="${TC.navy2}">${esc(label)}</text><rect x="0" y="${h - 70}" width="${w}" height="70" fill="#7cb342"/><rect x="0" y="${h - 74}" width="${w}" height="8" fill="#9ccc65"/>${palms}</svg>`;
}
function portraitSVG(name = '', fem = false) {
  const r = hashStr(name); const bg = ['#dfe9f7', '#e7eef8', '#e9f0fb', '#e2ecf5'][r % 4];
  const suit = ['#1f2d45', '#26324a', '#2e3b55', '#1b2a40'][r % 4]; const skin = ['#e0b48f', '#c99673', '#d6a582', '#b98563'][(r >> 3) % 4];
  const hair = ['#1d1612', '#2b1d14', '#3a2a1e'][(r >> 5) % 3];
  const ini = name.replace(/^(Dra?\.|Ing\.|Lic\.|Mg\.|CPC\.|Arq\.|Tec\.|Mtro\.|Dr\.)\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const hairShape = fem ? `<path d="M120 150c0-60 30-92 80-92s80 32 80 92v95c-12 8-24 10-34 4v-90H154v90c-10 6-22 4-34-4z" fill="${hair}"/>` : `<path d="M140 128c0-40 25-62 60-62s60 22 60 62c-8-14-30-24-60-24s-52 10-60 24z" fill="${hair}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${bg}"/><rect x="0" y="0" width="70" height="400" fill="${TC.gold}" opacity=".18"/><path d="M60 400c8-80 60-120 140-120s132 40 140 120z" fill="${suit}"/><path d="M170 282l30 50 30-50z" fill="#fff"/><path d="M196 300h8l4 50h-16z" fill="${TC.blue}"/><rect x="178" y="225" width="44" height="60" rx="18" fill="${skin}"/>${hairShape}<ellipse cx="200" cy="160" rx="58" ry="72" fill="${skin}"/>${fem ? '' : `<path d="M142 140c0-42 26-70 58-70s58 28 58 70c-6-20-30-34-58-34s-52 14-58 34z" fill="${hair}"/>`}<circle cx="178" cy="160" r="5" fill="#2a2a2a"/><circle cx="222" cy="160" r="5" fill="#2a2a2a"/><path d="M184 196q16 12 32 0" stroke="#8a4b3a" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="300" y="352" width="86" height="36" rx="8" fill="${TC.navy2}" opacity=".85"/><text x="343" y="377" text-anchor="middle" font-family="Arial" font-weight="700" font-size="20" fill="#fff">${esc(ini)}</text></svg>`;
}
const PROG_ICON = { apsti: 'cpu', cc: 'crane', cont: 'calc', ei: 'zap', eai: 'pulse', enf: 'heart', ia: 'food', pa: 'leaf', emp: 'briefcase' };
function topicSVG(seed = '', iconName = 'grad', w = 800, h = 500, label = '') {
  const r = hashStr(seed); const [a, b] = PALS[r % PALS.length];
  let dots = ''; for (let i = 0; i < 18; i++) { const x = (r * (i + 3)) % w, y = (r * (i + 7)) % h, s = 8 + (r >> i) % 40; dots += `<circle cx="${x}" cy="${y}" r="${s}" fill="#fff" opacity=".07"/>`; }
  const icon = ICONS[iconName] || ICONS.grad;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${dots}<g transform="translate(${w / 2 - 110} ${h / 2 - 130}) scale(9.2)" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${icon}</g>${label ? `<text x="${w / 2}" y="${h - 40}" text-anchor="middle" font-family="Arial" font-weight="700" font-size="30" fill="#fff" opacity=".95">${esc(label)}</text>` : ''}<rect x="0" y="${h - 10}" width="${w}" height="10" fill="${TC.gold}"/></svg>`;
}
const IMG_CACHE = {};
/* Resuelve una referencia de imagen: "ph:tipo:semilla" (generada), data URI (subida) o vacía (imagen institucional predeterminada) */
function img(src, fallback = 'ph:campus:1') {
  if (!src) src = fallback;
  if (typeof src !== 'string') return '';
  if (!src.startsWith('ph:')) return src;
  if (IMG_CACHE[src]) return IMG_CACHE[src];
  const [, t, ...rest] = src.split(':'); const s = rest.join(':');
  let out;
  if (t === 'campus') out = svgURI(campusSVG(s, 1600, 600, (DB && DB.config ? DB.config.inst.nombreCorto : 'INSTITUTO')));
  else if (t === 'campus43') out = svgURI(campusSVG(s, 1200, 900, (DB && DB.config ? DB.config.inst.nombreCorto : 'INSTITUTO')));
  else if (t === 'person') out = svgURI(portraitSVG(s.replace(/^[fm]\|/, ''), s.startsWith('f|')));
  else if (t === 'topic') { const [i, seed, label] = s.split('|'); out = svgURI(topicSVG(seed || i, i, 800, 500, label || '')); }
  else if (t === 'logo') out = svgURI(logoSVG(s || 'PISCO'));
  else out = svgURI(topicSVG(s, 'image'));
  return IMG_CACHE[src] = out;
}

/* ---------- Sanitizador de HTML enriquecido (lista blanca) ---------- */
const SAFE_TAGS = new Set(['P', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SUB', 'SUP', 'MARK', 'UL', 'OL', 'LI', 'A', 'IMG', 'BR', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'FIGURE', 'FIGCAPTION', 'SPAN', 'DIV', 'HR']);
const SAFE_ATTR = { A: ['href', 'title', 'target', 'rel'], IMG: ['src', 'alt', 'width', 'height'], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan', 'scope'] };
/* Formato permitido en el editor: se guarda como clases, nunca como estilos libres */
const RTE_COLORS = { blue: ['#1556b8', 'Azul institucional'], red: ['#c62828', 'Rojo'], green: ['#1e8e4f', 'Verde'], gold: ['#b26b00', 'Dorado'], gray: ['#6b7686', 'Gris'] };
const RTE_CLASS = /^(al-(left|center|right|justify)|fs-(sm|lg|xl)|tc-(blue|red|green|gold|gray)|img-(left|right|center|full)|pz-[a-z0-9-]+)$/;
const rgbHex = v => { const m = String(v).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m ? '#' + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('') : String(v).trim().toLowerCase(); };
const colorClass = v => { const h = rgbHex(v); const k = Object.keys(RTE_COLORS).find(c => RTE_COLORS[c][0] === h); return k ? 'tc-' + k : ''; };
function normalizeRich(root) {
  root.querySelectorAll('font').forEach(f => { const sp = root.ownerDocument.createElement('span'); const sz = { 1: 'fs-sm', 2: 'fs-sm', 4: 'fs-lg', 5: 'fs-lg', 6: 'fs-xl', 7: 'fs-xl' }[f.getAttribute('size')]; if (sz) sp.classList.add(sz); const cc = f.getAttribute('color') && colorClass(f.getAttribute('color')); if (cc) sp.classList.add(cc); sp.append(...f.childNodes); f.replaceWith(sp); });
  root.querySelectorAll('strike,del').forEach(x => { const s2 = root.ownerDocument.createElement('s'); s2.append(...x.childNodes); x.replaceWith(s2); });
  root.querySelectorAll('[align]').forEach(x => { const a = x.getAttribute('align').toLowerCase(); if (/^(left|center|right|justify)$/.test(a)) x.classList.add('al-' + a); x.removeAttribute('align'); });
  root.querySelectorAll('[style]').forEach(x => {
    const st = x.style; const ta = st.textAlign; if (/^(left|center|right|justify)$/.test(ta) && x.tagName !== 'SPAN') x.classList.add('al-' + ta);
    if (st.color) { const cc = colorClass(st.color); if (cc) x.classList.add(cc); }
    const fs = st.fontSize; if (fs) { const m = { 'x-small': 'fs-sm', small: 'fs-sm', large: 'fs-lg', 'x-large': 'fs-lg', 'xx-large': 'fs-xl', 'xxx-large': 'fs-xl' }[fs]; if (m) x.classList.add(m); }
    const bg = st.backgroundColor; x.removeAttribute('style');
    if (bg && !/transparent|rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)/.test(bg) && x.tagName === 'SPAN') { const mk = root.ownerDocument.createElement('mark'); mk.className = x.className; mk.append(...x.childNodes); x.replaceWith(mk); }
  });
}
function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  normalizeRich(doc.body.firstChild);
  const walk = node => {
    [...node.childNodes].forEach(ch => {
      if (ch.nodeType === 8) { ch.remove(); return; }
      if (ch.nodeType !== 1) return;
      if (!SAFE_TAGS.has(ch.tagName)) {
        if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'META', 'LINK', 'SVG', 'MATH'].includes(ch.tagName)) { ch.remove(); return; }
        walk(ch); ch.replaceWith(...ch.childNodes); return;
      }
      const cls = [...ch.classList].filter(c => RTE_CLASS.test(c));
      [...ch.attributes].forEach(a => {
        const ok = (SAFE_ATTR[ch.tagName] || []).includes(a.name.toLowerCase());
        if (!ok) { ch.removeAttribute(a.name); return; }
        if (['href', 'src'].includes(a.name)) {
          const v = a.value.trim().toLowerCase();
          const okUrl = v.startsWith('http://') || v.startsWith('https://') || v.startsWith('mailto:') || v.startsWith('tel:') || v.startsWith('#') || (a.name === 'src' && /^data:image\/(png|jpe?g|webp|gif);/.test(v));
          if (!okUrl) ch.removeAttribute(a.name);
        }
      });
      if (cls.length) ch.className = cls.join(' ');
      if (ch.tagName === 'A' && /^https?:/.test(ch.getAttribute('href') || '')) { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); }
      walk(ch);
      if (ch.tagName === 'SPAN' && !ch.attributes.length) ch.replaceWith(...ch.childNodes);
    });
  };
  walk(doc.body.firstChild);
  return doc.body.firstChild.innerHTML;
}

/* ---------- Generador mínimo de PDF (documentos de demostración) ---------- */
function pdfText(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/([()\\])/g, '\\$1'); }
function makePdf(title, lines = [], inst = '', sample = false) {
  if(window.jspdf){const doc=new jspdf.jsPDF({unit:'mm',format:'a4'});let y=25;const header=()=>{doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(String(inst),15,12,{maxWidth:180});doc.setFontSize(15);doc.text(String(title),15,22,{maxWidth:180});y=32;};header();doc.setFont('helvetica','normal');doc.setFontSize(10);
    for(const line of lines)for(const part of doc.splitTextToSize(String(line),180)){if(y>275){doc.addPage();header();doc.setFont('helvetica','normal');doc.setFontSize(10);}doc.text(part,15,y);y+=5;}
    const total=doc.getNumberOfPages();for(let n=1;n<=total;n++){doc.setPage(n);doc.setFontSize(8);doc.text(sample?'Documento de ejemplo: reemplazar por el archivo institucional.':'Generado por el portal institucional.',15,288);doc.text(n+' / '+total,190,288,{align:'right'});}return new Blob([doc.output('arraybuffer')],{type:'application/pdf'});
  }
  // Respaldo de generación sin red: conserva todas las líneas en varias páginas.
  const pages=[];let page=[],y=730;const start=()=>{page=['BT /F2 11 Tf 50 800 Td ('+pdfText(inst)+') Tj ET','BT /F2 16 Tf 50 760 Td ('+pdfText(title)+') Tj ET'];y=730;};start();
  for(const line of lines){const words=String(line).split(/\s+/);let segment='';const emit=()=>{if(y<65){pages.push(page);start();}page.push('BT /F1 11 Tf 50 '+y+' Td ('+pdfText(segment)+') Tj ET');y-=17;segment='';};for(const word of words){if((segment+' '+word).length>90&&segment)emit();segment+=(segment?' ':'')+word;}emit();}pages.push(page);
  const regular=3+pages.length*2,bold=regular+1;const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids ['+pages.map((_,i)=>(3+i*2)+' 0 R').join(' ')+'] /Count '+pages.length+' >>'];
  pages.forEach((items,i)=>{items.push('BT /F1 8 Tf 50 40 Td ('+pdfText(sample?'Documento de ejemplo.':'Generado por el portal institucional.')+' '+(i+1)+'/'+pages.length+') Tj ET');const stream=items.join('\n');objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+regular+' 0 R /F2 '+bold+' 0 R >> >> /Contents '+(4+i*2)+' 0 R >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream');});
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');let pdf='%PDF-1.4\n';const offsets=[];objs.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});const xref=pdf.length;pdf+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return new Blob([pdf],{type:'application/pdf'});
}

function dataURItoBlob(uri) { const [h, b] = uri.split(','); const mime = h.match(/:(.*?);/)[1]; const bin = atob(b); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); }
/* doc: {nombre, data?(dataURI), titulo?, lineas?} */
function docBlob(doc) {
  if (!doc) return null;
  if (doc.data) return dataURItoBlob(doc.data);
  return makePdf(doc.titulo || doc.nombre, doc.lineas || [], (DB.config.inst.nombre || '').toUpperCase(),true);
}
function openDoc(doc) {
  const b = docBlob(doc); if (!b) return toast('Documento no disponible', 'err');
  const url = URL.createObjectURL(b); const w = window.open(url, '_blank', 'noopener'); if (!w) downloadBlob(b, doc.nombre);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function downloadDoc(doc) { const b = docBlob(doc); if (b) downloadBlob(b, doc.nombre); }
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function downloadText(text, name, type = 'text/plain') { downloadBlob(new Blob([text], { type }), name); }
const fsize = b => !b ? '' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const genDoc = (nombre, titulo, lineas = [], size = 0) => ({ nombre, titulo, lineas, size: size || (180000 + hashStr(nombre) % 2000000), fecha: nowISO() });

/* ---------- Validación de archivos subidos (extensión + MIME + tamaño) ---------- */
/* Convierte enlaces habituales de video (el que se copia del navegador) a su URL de inserción. */
function videoEmbedURL(v) {
  const u = String(v || '').trim(); let m;
  if ((m = u.match(/^https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)([\w-]{11})/)) || (m = u.match(/^https?:\/\/youtu\.be\/([\w-]{11})/))) return 'https://www.youtube.com/embed/' + m[1];
  if ((m = u.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/))) return 'https://player.vimeo.com/video/' + m[1];
  return u.replace(/^http:\/\//, 'https://');
}
const FILE_RULES = {
  image: { ext: ['jpg', 'jpeg', 'png', 'webp'], mime: ['image/jpeg', 'image/png', 'image/webp'], max: 15 * 1048576, label: 'JPG, PNG o WEBP · máx. 15 MB' },
  pdf: { ext: ['pdf'], mime: ['application/pdf'], max: 20 * 1048576, label: 'PDF · máx. 20 MB' },
  attach: { ext: ['pdf', 'jpg', 'jpeg', 'png'], mime: ['application/pdf', 'image/jpeg', 'image/png'], max: 10 * 1048576, label: 'PDF, JPG o PNG · máx. 10 MB' },
  csv: { ext: ['csv', 'txt'], mime: ['text/csv', 'text/plain', 'application/vnd.ms-excel', ''], max: 2 * 1048576, label: 'CSV (plantilla) · máx. 2 MB' },
  json: { ext: ['json'], mime: ['application/json', ''], max: 15 * 1048576, label: 'JSON' },
};
function checkFile(file, kind) {
  const r = FILE_RULES[kind]; const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!r.ext.includes(ext)) return `Extensión .${ext} no permitida. Formatos: ${r.label}.`;
  if (file.type && !r.mime.includes(file.type)) return `Tipo de archivo (${file.type}) no permitido. Formatos: ${r.label}.`;
  if (file.size > r.max) return `El archivo pesa ${fsize(file.size)}; el máximo es ${fsize(r.max)}.`;
  return '';
}
const readAsDataURL = f => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(f); });
const readAsText = f => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsText(f); });
/* Comprime y redimensiona imágenes antes de guardarlas (biblioteca de medios) */
async function compressImage(file, maxW = 1400, opts = {}) {
  const q = opts.q || .8; const src = await readAsDataURL(file);
  const im = new Image(); im.src = src; await im.decode();
  compressImage.last = { w: im.naturalWidth, h: im.naturalHeight };
  const sc = Math.min(1, maxW / im.width, maxW / im.height);
  const W = Math.round(im.width * sc), H = Math.round(im.height * sc);
  // Imagen grande ya liviana y del tamaño adecuado: se conserva tal cual (sin pérdida adicional).
  if (opts.keep && sc === 1 && /^image\/(jpeg|webp)$/.test(file.type) && file.size <= opts.keep) return src;
  // Reducción en pasos de 50 % con suavizado de alta calidad: evita el aspecto borroso o dentado.
  let cur = im, cw = im.width, ch = im.height;
  while (cw / 2 >= W * 1.05) { const t = document.createElement('canvas'); t.width = Math.round(cw / 2); t.height = Math.round(ch / 2); const x = t.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, t.width, t.height); cur = t; cw = t.width; ch = t.height; }
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(cur, 0, 0, W, H);
  if (opts.sharpen && sc < 1) sharpenCanvas(c, opts.sharpen);
  let out = c.toDataURL('image/webp', q); if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', Math.min(.95, q + .02));
  return out;
}
/* Enfoque suave (máscara de enfoque 3×3) para recuperar los bordes tras reducir la imagen */
function sharpenCanvas(c, amt = .35) {
  const ctx = c.getContext('2d'); const { width: w, height: h } = c; const src = ctx.getImageData(0, 0, w, h); const d = src.data; const o = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = (y * w + x) * 4;
    for (let k = 0; k < 3; k++) { const v = d[i + k], blur = (d[i - 4 + k] + d[i + 4 + k] + d[i - w * 4 + k] + d[i + w * 4 + k]) / 4; o[i + k] = v + (v - blur) * amt; } }
  ctx.putImageData(new ImageData(o, w, h), 0, 0);
}
/* Nombre interno seguro para archivos subidos */
const safeName = (orig, prefix = 'doc') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}.${(orig.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')}`;

/* ---------- Hash de contraseñas (SHA-256) ---------- */
function sha256(ascii) {
  const rr = (v, a) => (v >>> a) | (v << (32 - a)); const mp = Math.pow, mw = mp(2, 32); let res = '', words = [], al = ascii.length * 8;
  let hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || []; let pl = k.length; const ic2 = {};
  for (let c = 2; pl < 64; c++) { if (!ic2[c]) { for (let i = 0; i < 313; i += c) ic2[i] = c; hash[pl] = (mp(c, .5) * mw) | 0; k[pl++] = (mp(c, 1 / 3) * mw) | 0; } }
  ascii += '\x80'; while (ascii.length % 64 - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) { const j = ascii.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
  words[words.length] = ((al / mw) | 0); words[words.length] = al;
  hash = hash.slice(0, 8);
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16), oh = hash; hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
      const t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(t1 + t2) | 0].concat(hash); hash[4] = (hash[4] + t1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oh[i]) | 0;
  }
  for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) { const b = (hash[i] >> (j * 8)) & 255; res += ((b < 16) ? 0 : '') + b.toString(16); }
  return res;
}
const hashPass = (user, pass) => sha256(unescape(encodeURIComponent('iestp|' + user + '|' + pass)));

/* ---------- Almacenamiento ---------- */
const STORE_KEY = 'portal_iestp_v1';
let DB = null; let MEM_ONLY = false;
function loadDB(){DB=structuredClone(window.PORTAL_BOOTSTRAP.data);MEM_ONLY=false;}
function saveDB(){toast('No se cargó el servicio de guardado del servidor. Recarga la página.','err');return false;}
function resetDB(){location.href='/respaldos.php';}
const coll = n => (DB[n] = DB[n] || []);
const byId = (n, id) => coll(n).find(x => x.id === id);
const alive = n => coll(n).filter(x => !x.deleted);

/* ---------- Sesión, roles y auditoría ---------- */
const MODULES = {
  dashboard: 'Inicio', aprobaciones: 'Aprobaciones', paginas: 'Páginas institucionales', jerarquica: 'Plana jerárquica', docentes: 'Plana docente',
  programas: 'Programas de estudio', egresados: 'Egresados destacados', admision: 'Admisión', matricula: 'Matrícula', becas: 'Becas',
  documentos: 'Documentos de gestión', tupa: 'TUPA', estadisticas: 'Estadísticas', licenciamiento: 'Licenciamiento', inversiones: 'Inversiones',
  convocatorias: 'Convocatorias', noticias: 'Noticias', eventos: 'Eventos', portada: 'Portada', mensajes: 'Mensajes de contacto',
  reclamos: 'Libro de reclamaciones', expedientes: 'Mesa de partes', certificados: 'Verificación de documentos', enlaces: 'Enlaces y servicios',
  locales: 'Campus y locales', servicios: 'Servicios complementarios', config: 'Configuración',
  'ix-alumnos': 'Maestro de alumnos', 'ix-horarios': 'Programación de horarios', 'ix-certificados': 'Certificación modular', 'ix-titulos': 'Grados y títulos', 'ix-bolsa': 'Bolsa laboral', 'ix-config': 'Configuración académica', temas: 'Temas y apariencia', usuarios: 'Usuarios y roles', auditoria: 'Auditoría', respaldo: 'Copias de seguridad'
};
const ROLES = {
  admin: { label: 'Administrador', mods: Object.keys(MODULES), publish: true, approve: true, hardDelete: true, viewDni: true, closePeriod: true },
  imagen: { label: 'Imagen institucional', mods: ['dashboard', 'noticias', 'eventos', 'portada', 'paginas', 'enlaces', 'locales', 'temas'], publish: true },
  secretaria: { label: 'Secretaría académica', mods: ['dashboard', 'admision', 'matricula', 'becas', 'estadisticas', 'docentes', 'jerarquica', 'certificados', 'egresados', 'ix-alumnos', 'ix-horarios', 'ix-certificados', 'ix-titulos'], publish: true, viewDni: true },
  coordinador: { label: 'Coordinador de programa', mods: ['dashboard', 'programas', 'egresados', 'ix-alumnos', 'ix-horarios'], publish: true, ownProgram: true },
  transparencia: { label: 'Transparencia / administración', mods: ['dashboard', 'documentos', 'tupa', 'inversiones', 'licenciamiento', 'convocatorias', 'servicios'], publish: true },
  atencion: { label: 'Atención al ciudadano', mods: ['dashboard', 'mensajes', 'reclamos', 'expedientes', 'ix-bolsa'], publish: false, viewDni: true },
  directivo: { label: 'Directivo', mods: ['dashboard', 'estadisticas', 'reclamos', 'expedientes', 'ix-alumnos', 'ix-horarios', 'ix-certificados', 'ix-titulos', 'ix-bolsa'], publish: false, viewDni: true },
  docente: { label: 'Docente', mods: ['dashboard', 'ix-horarios'], community: true },
  estudiante: { label: 'Estudiante', mods: ['dashboard', 'ix-horarios', 'ix-certificados', 'ix-bolsa'], community: true },
  egresado: { label: 'Egresado', mods: ['dashboard', 'ix-certificados', 'ix-titulos', 'ix-bolsa'], community: true },
  empresa: { label: 'Empresa', mods: ['dashboard', 'ix-bolsa'], community: true },
};
/* Módulos cuyo contenido requiere aprobación del Administrador antes de publicarse (sección 6.3) */
const APPROVAL_MODS = ['documentos', 'admision', 'convocatorias'];
let SESSION = null;
function currentUser(){return window.PORTAL_BOOTSTRAP.user;}
function setSession(u){if(!u)location.href='/#/admin';}
const SESSION_IDLE_MIN=30;let portalActivityAt=Date.now();
function touchSession(){portalActivityAt=Date.now();}
function sessionExpired(){return Date.now()-portalActivityAt>SESSION_IDLE_MIN*60000;}
const role = () => ROLES[(currentUser() || {}).rol] || {};
const can = mod => { const r = role(); return !!(r.mods && r.mods.includes(mod)); };
const canFlag = f => !!role()[f];
function audit(accion, entidad, registro = '', detalle = '') {
  const u = currentUser();
  coll('auditoria').unshift({ id: uid(), fecha: nowISO(), usuario: u ? u.usuario : 'portal-público', rol: u ? ROLES[u.rol]?.label : 'Visitante', accion, entidad, registro: String(registro).slice(0, 140), detalle: String(detalle).slice(0, 300) });
  if (DB.auditoria.length > 1500) DB.auditoria.length = 1500;
}
function stamp(rec, isNew) {
  const u = currentUser(); const n = nowISO();
  if (isNew) { rec.creadoPor = u ? u.usuario : 'portal'; rec.creadoEn = n; }
  rec.modPor = u ? u.usuario : 'portal'; rec.modEn = n;
  return rec;
}

/* ---------- Captcha simple + anti-spam (prototipo) ---------- */
function captchaHTML(id) {
  const purpose=id==='cap-c'?'mensajes':id==='cap-nl'?'suscriptores':id.includes('cq')?'certificados':id.includes('lr')?'reclamos':'expedientes';
  return `<div class="field"><span class="lbl">Verificación anti-spam *</span><div class="captcha" id="${id}" data-purpose="${purpose}"><span>¿Cuánto es</span><b aria-live="polite">…</b><span>?</span><input class="inp" name="captcha" inputmode="numeric" aria-label="Resultado de la suma" required autocomplete="off"></div></div><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">`;
}
/* El desafío se pide al servidor en segundo plano cuando el formulario se acerca a la pantalla o se usa:
   antes se pedía de forma síncrona al dibujar cada página (también el boletín del pie) y congelaba la carga. */
function loadCaptcha(box) {
  if (!box || box.dataset.challenge || box.dataset.loading) return; box.dataset.loading = '1'; const q = $('b', box);
  fetch(portalURL('/api/desafio'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': portalBootstrap.csrf }, body: JSON.stringify({ purpose: box.dataset.purpose }) })
    .then(r => r.json().catch(() => ({})).then(c => { if (!r.ok || !c.id) throw new Error(c.message || 'No se pudo cargar la verificación.'); return c; }))
    .then(c => { box.dataset.challenge = c.id; q.textContent = c.question; })
    .catch(error => { delete box.dataset.loading; q.textContent = '—'; toast(error.message + ' Recarga la página para habilitar el formulario.', 'warn'); });
}
const CAPTCHA_IO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { CAPTCHA_IO.unobserve(e.target); loadCaptcha(e.target); } }), { rootMargin: '400px 0px' }) : null;
function watchCaptchas() { $$('.captcha[data-purpose]:not([data-watch])').forEach(b => { b.dataset.watch = '1'; if (CAPTCHA_IO) CAPTCHA_IO.observe(b); else loadCaptcha(b); }); }
new MutationObserver(() => watchCaptchas()).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('focusin', e => { const f = e.target.closest && e.target.closest('form'); if (f) loadCaptcha($('.captcha[data-purpose]', f)); }, true);
// Tras un envío correcto la verificación queda usada: se pide una nueva para el siguiente envío sin recargar.
function renewCaptcha(form) { const box = form && $('.captcha[data-purpose]', form); if (!box) return; delete box.dataset.challenge; delete box.dataset.loading; const inp = $('input:not([type=hidden])', box); if (inp) inp.value = ''; loadCaptcha(box); }
function checkCaptcha(form, id) {
  if (form.website && form.website.value) return 'Envío bloqueado por el filtro anti-spam.';
  const box = $('#' + id, form);if(!box)return 'Recarga la página para verificar el formulario.';if(!box.dataset.challenge){loadCaptcha(box);return 'La verificación anti-spam aún se está cargando. Espera un momento e inténtalo de nuevo.';}
  const answer=String(form.querySelector('[name="captcha"]')?.value||'').trim();if(!/^\d{1,3}$/.test(answer))return 'Escribe el resultado de la suma.';
  portalProofs[box.dataset.purpose]={challenge_id:box.dataset.challenge,answer,website:form.website?.value||'',accept:form.querySelector('[name="acepto"]')?.checked===true,declare:form.querySelector('[name="declaro"]')?.checked===true};
  return '';
}
const RATE = {};
function rateLimited(key, secs = 20) { return !!(RATE[key] && Date.now() - RATE[key] < secs * 1000); }

/* ---------- Validación de formularios ---------- */
function showErrors(form, errs) {
  $$('[aria-invalid="true"]', form).forEach(el => el.removeAttribute('aria-invalid'));
  $$('.field.invalid', form).forEach(f => { f.classList.remove('invalid'); $$('.errmsg',f).forEach(el=>el.remove()); });
  $$('.form-error',form).forEach(el=>el.remove());
  const entries=Object.entries(errs).filter(([,msg])=>!!msg);let first=null;
  entries.forEach(([name,msg])=>{
    const escaped=CSS.escape(name);const inp=form.querySelector(`[name="${escaped}"]`)||form.querySelector(`[data-name="${escaped}"]`);
    const field=inp?.closest('.field')||form.querySelector(`[data-f="${escaped}"]`);
    if(field){field.classList.add('invalid');const message=document.createElement('div');message.className='errmsg';message.textContent=msg;field.appendChild(message);const target=inp||field.querySelector('input:not([hidden]),textarea,select,button')||field;target.setAttribute('aria-invalid','true');if(!target.matches('input,textarea,select,button'))target.tabIndex=-1;first ||= target;}
    else{const message=document.createElement('div');message.className='notice err form-error';message.setAttribute('role','alert');message.textContent=msg;form.prepend(message);}
  });
  if(entries.length){first?.focus();toast('Revise los campos marcados en rojo.','err');}
  return entries.length===0;
}
const reEmail = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
function validDoc(tipo, n) {
  n = String(n || '').trim();
  if (tipo === 'DNI') return /^\d{8}$/.test(n) ? '' : 'El DNI debe tener 8 dígitos.';
  if (tipo === 'CE') return /^[A-Za-z0-9]{9,12}$/.test(n) ? '' : 'El carné de extranjería debe tener entre 9 y 12 caracteres alfanuméricos.';
  if (tipo === 'Pasaporte') return /^[A-Za-z0-9]{6,12}$/.test(n) ? '' : 'El pasaporte debe tener entre 6 y 12 caracteres alfanuméricos.';
  if (tipo === 'RUC') return /^(10|20)\d{9}$/.test(n) ? '' : 'El RUC debe tener 11 dígitos y empezar con 10 o 20.';
  return '';
}

/* ---------- Paginación genérica ---------- */
function pager(total, page, size, sizes = [5, 10, 25, 50]) {
  const pages = Math.max(1, Math.ceil(total / size)); page = Math.min(page, pages);
  let btns = '';
  const from = Math.max(1, page - 2), to = Math.min(pages, from + 4);
  btns += `<button data-pg="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>`;
  for (let i = from; i <= to; i++) btns += `<button data-pg="${i}" ${i === page ? 'aria-current="page"' : ''}>${i}</button>`;
  btns += `<button data-pg="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Página siguiente">›</button>`;
  return `<div class="pager"><div>Mostrando <select data-size aria-label="Registros por página">${sizes.map(s => `<option ${s === size ? 'selected' : ''}>${s}</option>`).join('')}</select> por página · ${num(total)} registro(s)</div><nav class="pages" aria-label="Paginación">${btns}</nav></div>`;
}
function bindPager(root, state, rerender) {
  $$('[data-pg]', root).forEach(b => b.onclick = () => { state.page = +b.dataset.pg; rerender(); });
  const s = $('[data-size]', root); if (s) s.onchange = () => { state.size = +s.value; state.page = 1; rerender(); };
}

/* ---------- Gráfico de barras SVG (una serie, con tooltip) ---------- */
function barChart(data, { h = 220, unit = '', label = '' } = {}) {
  if (!data.length) return '<div class="empty">Sin datos para graficar.</div>';
  const w = 520, padL = 40, padB = 32, padT = 18; const max = Math.max(...data.map(d => d.v), 1);
  const nice = Math.pow(10, Math.floor(Math.log10(max))); const top = Math.ceil(max / nice) * nice;
  const bw = (w - padL - 10) / data.length; let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><g class="grid">`;
  for (let i = 0; i <= 4; i++) { const y = padT + (h - padT - padB) * (1 - i / 4); s += `<line x1="${padL}" x2="${w - 6}" y1="${y}" y2="${y}"/><text x="${padL - 6}" y="${y + 4}" text-anchor="end">${num(Math.round(top * i / 4))}</text>`; }
  s += '</g>';
  data.forEach((d, i) => {
    const bh = (h - padT - padB) * d.v / top, x = padL + i * bw + bw * .2, y = h - padB - bh, ww = bw * .6;
    s += `<path class="bar" data-tip="${esc(d.k)}: ${num(d.v)}${unit}" d="M${x},${h - padB} V${y + 4} q0,-4 4,-4 h${ww - 8} q4,0 4,4 V${h - padB} Z"/>`;
    if (data.length <= 8) s += `<text class="val" x="${x + ww / 2}" y="${y - 5}" text-anchor="middle">${num(d.v)}</text>`;
    s += `<text x="${x + ww / 2}" y="${h - padB + 16}" text-anchor="middle">${esc(clamp(d.k, 12))}</text>`;
  });
  return s + `<line x1="${padL}" x2="${w - 6}" y1="${h - padB}" y2="${h - padB}" stroke="#9aa6b6"/></svg>`;
}
function bindChartTips(root) {
  let tip = $('.chart-tip'); if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; document.body.appendChild(tip); }
  $$('[data-tip]', root).forEach(b => {
    b.addEventListener('mousemove', e => { tip.textContent = b.dataset.tip; tip.style.display = 'block'; tip.style.left = e.clientX + 12 + 'px'; tip.style.top = e.clientY - 30 + 'px'; });
    b.addEventListener('mouseleave', () => tip.style.display = 'none');
  });
}

/* ---------- CSV ---------- */
function toCSV(rows) { return '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/^[=+@\t\r-]/,m=>"'"+m).replace(/"/g, '""')}"`).join(';')).join('\r\n'); }
function parseCSV(text) {
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === sep) { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  if (cur || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim())).map(r => r.map(c => c.replace(/^﻿/, '').trim()));
}

/* ==== data.js ==== */
/* =========================================================
   DATOS DE DEMOSTRACIÓN
   Todo lo que aparece aquí es editable desde el panel.
   Nombres de docentes, estudiantes, montos y cifras son ficticios.
   ========================================================= */
const SEED_VERSION = 13; // v13: Portal Web 2026 del IESTP PISCO (plana docente con CV, libro de reclamaciones, bolsa laboral y mesa de partes)
function seedDB() { throw new Error('Los datos se inicializan en PHP y MySQL.'); }
const DEMO_USERS = [];

/* ==== public.js ==== */
/* =========================================================
   PORTAL PÚBLICO
   ========================================================= */
let PREVIEW = null; // {coll, rec} cuando el panel pide "Vista previa"
function P(name) {
  const arr = coll(name).filter(x => !x.deleted);
  if (!PREVIEW || PREVIEW.coll !== name) return arr;
  const r = Object.assign({}, PREVIEW.rec, { _preview: true });
  const i = arr.findIndex(x => x.id === r.id);
  return i >= 0 ? arr.map((x, j) => j === i ? r : x) : arr.concat([r]);
}
const isPub = x => x && (x._preview || ['Publicado', 'Publicada', 'Activo', 'Vigente'].includes(x.estado));
const sortO = a => a.slice().sort((x, y) => (x.orden || 0) - (y.orden || 0));
const page = clave => P('paginas').find(p => p.clave === clave);
const PAGE_ROUTE = { presentacion: '#/nosotros/presentacion', resena: '#/nosotros/resena-historica', mision: '#/nosotros/mision-vision', organizacion: '#/nosotros/organizacion', reconocimientos: '#/nosotros/reconocimientos', jerarquica: '#/nosotros/plana-jerarquica', docentes: '#/nosotros/plana-docente', campus: '#/nosotros/campus-e-informes', privacidad: '#/politica-de-privacidad', terminos: '#/terminos-de-uso', faq: '#/preguntas-frecuentes' };
const pageURL = p => PAGE_ROUTE[p.clave] || (p.slug ? '#/paginas/' + encodeURIComponent(p.slug) : '');
const extraPages = () => P('paginas').filter(p => isPub(p) && !PAGE_ROUTE[p.clave] && p.slug);
const persona = id => P('personas').find(p => p.id === id);
const fullName = p => p ? `${p.titulo ? p.titulo + ' ' : ''}${p.nombres || ''} ${p.apellidos || ''}`.replace(/\s+/g, ' ').trim() : '';
const publicTeacherVisible = p => !p?.cv?.autoriza?.revocado && (p?.cv?.autoriza?.ok === true || /^https:\/\/(www\.)?iestppisco\.edu\.pe\/vista\/(docente|plana-jerarquica)(?:[/?#]|$)/.test(p?.fuente || ''));
const progs = () => sortO(P('programas').filter(isPub));
const progById = id => P('programas').find(p => p.id === id);
const safePortalLink = (value, internal = true) => { if (typeof value !== 'string' || !value) return false; if (internal && value.startsWith('#/')) return true; try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); } catch { return false; } };
const dreLabel = () => ((coll('enlaces').find(x => x.id === 'dre') || {}).nombre || 'DRE');
const ext = id => { const e = coll('enlaces').find(x => x.id === id); return e && !e.deleted && e.estado === 'Activo' && safePortalLink(e.url, false) ? e.url : ''; };
const linkAttrs = href => /^https?:/.test(href) ? `href="${esc(href)}" target="_blank" rel="noopener noreferrer"` : `href="${esc(href)}"`;
const resolveLink = l => typeof l === 'string' && l.startsWith('ext:') ? ext(l.slice(4)) : safePortalLink(l) ? l : '';
const newsVisible = n => isPub(n) && (n._preview || new Date(n.fecha) <= new Date());
const catName = id => (coll('categoriasNoticia').find(c => c.id === id) || {}).nombre || 'General';
const admVigente = () => P('admisiones').filter(a => (a.estado === 'Publicado' || a._preview) && a.vigente).sort((a, b) => b.anio - a.anio)[0];
const matVigente = () => P('matriculas').filter(a => (a.estado === 'Publicado' || a._preview) && a.vigente)[0];
const becaVigente = () => P('becasPeriodos').find(b => b.vigente && b.estado !== 'Borrador');
const inst = () => DB.config.inst;
/* Texto junto al logotipo: el configurado o, si está vacío, el nombre corto oficial completo (sin abreviar), en tamaño reducido (clase b-long) para que no desborde la cabecera. */
const brandLong = () => !String(inst().logoSigla || '').trim();
const brandSigla = () => brandLong() ? inst().nombreCorto : String(inst().logoSigla).trim();
const logoSrc = () => inst().logo || img('ph:logo:' + inst().logoSigla);
const pubNews = () => P('noticias').filter(newsVisible).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

/* ---------- Navegación ---------- */
function navModel() {
  const adm = admVigente(), mat = matVigente();
  const e = (id, label) => ext(id) ? { label, href: ext(id), ext: /^https?:/.test(ext(id)) } : null;
  return [
    { label: 'Nosotros', base: 'nosotros', items: [['Presentación', '#/nosotros/presentacion'], ['Reseña Histórica', '#/nosotros/resena-historica'], ['Misión, Visión y Valores', '#/nosotros/mision-vision'], ['Organización Institucional', '#/nosotros/organizacion'], ['Reconocimientos', '#/nosotros/reconocimientos'], ['Plana Jerárquica', '#/nosotros/plana-jerarquica'], ['Plana Docente', '#/nosotros/plana-docente'], ['Campus e Informes', '#/nosotros/campus-e-informes']].map(([label, href]) => ({ label, href })) },
    { label: 'Programas de Estudio', base: 'programas', items: progs().map(p => ({ label: p.nombre, href: '#/programas/' + p.slug })).concat([{ label: 'Ver todos los programas', href: '#/programas' }]) },
    { label: 'Admisión y Matrículas', base: 'admision|matricula|becas', items: [{ label: 'Admisión ' + (adm ? adm.anio : ''), href: '#/admision' }, { label: 'Matrícula ' + (mat ? mat.periodo : ''), href: '#/matricula' }, { label: 'Becas', href: '#/becas' }] },
    { label: 'Transparencia', base: 'transparencia', items: [['Documentos de Gestión', 'documentos-gestion'], ['Inversiones y Recursos Económicos', 'inversiones'], ['Licenciamiento', 'licenciamiento'], ['TUPA', 'tupa'], ['Estadísticas', 'estadisticas'], ['Convocatorias', 'convocatorias']].map(([label, s]) => ({ label, href: '#/transparencia/' + s })) },
    { label: 'Servicios', base: 'servicios', items: [{ label: 'Servicios en línea', href: '#/servicios' }, { label: 'Mesa de Partes Virtual', href: '#/servicios/mesa-de-partes' }, { label: 'Libro de Reclamaciones', href: '#/servicios/libro-de-reclamaciones' }, { label: 'Consulta de certificados', href: '#/servicios/consulta-certificados' }, { label: 'Bolsa Laboral', href: '#/servicios/bolsa-laboral' }, { label: 'Servicios Complementarios', href: '#/servicios/complementarios' }, e('biblioteca', 'Biblioteca Virtual'), e('correo', 'Correo Institucional'), e('aula', 'Aula Virtual')].filter(Boolean) },
    { label: 'Otras Páginas', base: 'otras|eventos', items: ['avanza', 'conecta', 'registra', 'titula', 'dre'].map(id => { const x = coll('enlaces').find(l => l.id === id); return x && ext(id) ? { label: x.nombre, href: x.url, ext: true } : null; }).filter(Boolean).concat([{ label: 'Eventos', href: '#/eventos' }, { label: 'Preguntas Frecuentes', href: '#/preguntas-frecuentes' }], P('paginas').filter(p => isPub(p) && p.clave?.startsWith('custom-')).map(p => ({label:p.titulo,href:'#/paginas/'+p.slug}))) },
    { label: 'Noticias', base: 'noticias', href: '#/noticias' },
    { label: 'Contáctanos', base: 'contacto', href: '#/contacto' },
  ];
}
function headerHTML(path) {
  const c = DB.config, i = inst(), r = c.redes;
  const soc = ['facebook', 'youtube', 'instagram', 'tiktok'].filter(k => r[k]).map(k => `<a href="${esc(r[k])}" target="_blank" rel="noopener noreferrer" aria-label="${k} (se abre en una pestaña nueva)">${bic(k)}</a>`).join('');
  const cur = path[0] || '';
  const nav = navModel().map((m, idx) => {
    const active = new RegExp('^(' + m.base + ')$').test(cur) || (m.base === 'otras|eventos' && cur === 'eventos') ? 'active' : '';
    if (m.href) return `<li><a class="top ${active}" href="${m.href}" ${active ? 'aria-current="page"' : ''}>${esc(m.label)}</a></li>`;
    return `<li><button class="top ${active}" aria-expanded="false" aria-controls="sub${idx}">${esc(m.label)} <span aria-hidden="true">▾</span></button><ul class="sub" id="sub${idx}">${m.items.map(it => `<li><a ${linkAttrs(it.href)} class="${it.ext ? 'ext' : ''}">${esc(it.label)}${it.ext ? '<span class="sr-only"> (enlace externo)</span>' : ''}</a></li>`).join('')}</ul></li>`;
  }).join('');
  if (isUni()) return uniHeader(path, nav, cur);
  if (isImp()) return impHeader(path, nav, cur);
  if (isHor()) return horHeader(path, nav, cur);
  if (isCam()) return camHeader(path, nav, cur);
  return `<a class="skip" href="#contenido" onclick="event.preventDefault();document.getElementById('contenido').focus()">Saltar al contenido principal</a>
  <div class="topbar"><div class="wrap"><span>${esc(i.slogan)}</span><div class="tb-links">
    <a href="mailto:${esc(i.correo)}" class="hide-sm">${ic('mail')} ${esc(i.correo)}</a><a href="tel:${esc(i.telefono.replace(/\D/g, ''))}">${ic('phone')} ${esc(i.telefono)}</a>
    ${ext('correo') ? `<a href="${esc(ext('correo'))}" target="_blank" rel="noopener noreferrer" class="hide-sm">Correo institucional</a>` : ''}${ext('biblioteca') ? `<a href="${esc(ext('biblioteca'))}" target="_blank" rel="noopener noreferrer" class="hide-sm">Biblioteca virtual</a>` : ''}
    <a href="#/admin" class="tb-intranet">${ic('lock')} Intranet</a><div class="social">${soc}</div></div></div></div>
  <header class="site-header"><div class="wrap">
    <a class="brand" href="#/" aria-label="${esc(i.nombreCorto)} - ir a inicio"><img src="${logoSrc()}" alt="Logotipo del ${esc(i.nombre)}"><span><strong>${esc(i.nombreCorto)}</strong><small>${esc(i.nombre)}</small><em>${esc(i.slogan)}</em></span></a>
    <form class="h-search" role="search" data-search><label class="sr-only" for="q1">Buscar en el sitio</label><input id="q1" name="q" placeholder="Buscar en el sitio..."><button aria-label="Buscar">${ic('search')}</button></form>
    <div class="h-slogan">${esc(i.lema)}</div>
    <button class="menu-btn" aria-expanded="false" aria-controls="mainnav" data-menu>☰ <span class="sr-only">Abrir menú</span></button>
  </div></header>
  <nav class="mainnav" id="mainnav" aria-label="Navegación principal"><div class="wrap"><ul><li><a class="top home ${cur === '' ? 'active' : ''}" href="#/" aria-label="Inicio">${ic('home')}<span class="hide-lg">Inicio</span></a></li>${nav}</ul>
  <form class="mobile-search" role="search" data-search><label class="sr-only" for="q2">Buscar</label><input class="inp" id="q2" name="q" placeholder="Buscar en el sitio..."><button class="btn gold sm">Buscar</button></form></div></nav>`;
}
function footerHTML() {
  if (isUni()) return uniFooter();
  if (isImp()) return impFooter();
  if (isHor()) return horFooter();
  if (isCam()) return camFooter();
  const i = inst(), r = DB.config.redes;
  const soc = ['facebook', 'youtube', 'instagram', 'tiktok'].filter(k => r[k]).map(k => `<a href="${esc(r[k])}" target="_blank" rel="noopener noreferrer" aria-label="${k} (se abre en una pestaña nueva)">${bic(k)}</a>`).join('');
  const ci = (icon, label, val) => `<li><span class="f-ic">${ic(icon)}</span><span><small>${label}</small>${val}</span></li>`;
  const links = [['#/nosotros/presentacion', 'Nosotros'], ['#/programas', 'Programas'], ['#/admision', 'Admisión'], ['#/matricula', 'Matrícula'], ['#/becas', 'Becas'], ['#/noticias', 'Noticias'], ['#/transparencia/documentos-gestion', 'Transparencia'], ['#/servicios/mesa-de-partes', 'Mesa de partes'], ['#/preguntas-frecuentes', 'Preguntas frecuentes'], ['#/eventos', 'Eventos']];
  return `<footer class="site-footer">
  <div class="wrap f-cta"><div><strong>¿Listo para construir tu futuro profesional?</strong><span>Conoce nuestros programas y la información de admisión.</span></div><div class="f-cta-b"><a class="btn gold" href="#/admision">Admisión ${new Date().getFullYear()}</a><a class="btn f-ghost" href="#/contacto">Contáctanos</a></div></div>
  <div class="wrap f-main">
    <section class="f-col f-about"><a class="f-brand" href="#/"><img src="${logoSrc()}" alt=""><span><strong>${esc(i.nombreCorto)}</strong><small>${esc(i.nombre)}</small></span></a><p>${esc(i.descripcion)}</p>${soc ? `<div class="social f-social" aria-label="Redes sociales">${soc}</div>` : ''}</section>
    <nav class="f-col" aria-label="Enlaces del pie de página"><h2>Enlaces rápidos</h2><ul class="f-links">${links.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul></nav>
    <section class="f-col"><h2>Contacto</h2><ul class="f-contact">${ci('map', 'Dirección', `<span>${esc(i.direccion)}</span>`)}${ci('phone', 'Teléfono' + (i.telefonoNota ? ' · ' + esc(i.telefonoNota) : ''), `<a href="tel:${esc(i.telefono.replace(/\D/g, ''))}">${esc(i.telefono)}</a>`)}${ci('mail', 'Correo', `<a href="mailto:${esc(i.correo)}">${esc(i.correo)}</a>`)}${ci('clock', 'Horario de atención', `<span>${esc(i.horario)}</span>`)}</ul></section>
    <section class="f-col">
      <h2>Enlaces institucionales</h2><div class="f-logos"><a ${linkAttrs(ext('minedu') || 'https://www.gob.pe/minedu')}>MINEDU</a>${ext('dre') ? `<a ${linkAttrs(ext('dre'))}>${esc(dreLabel())}</a>` : ''}<a href="#/servicios/libro-de-reclamaciones" class="f-lr">${ic('book')} Libro de Reclamaciones</a></div></section>
  </div>
  <div class="f-bottom"><div class="wrap"><span>© ${yearNow()} ${esc(i.nombre)}. Todos los derechos reservados.</span><nav aria-label="Enlaces legales"><a href="#/terminos-de-uso">Términos de uso</a><a href="#/politica-de-privacidad">Política de privacidad</a><a href="#/mapa-del-sitio">Mapa del sitio</a><a href="#/admin">Intranet</a></nav></div></div></footer>
  ${DB.config.whatsapp.activo && DB.config.whatsapp.numero ? `<a class="wa" href="https://wa.me/${esc(DB.config.whatsapp.numero)}?text=${encodeURIComponent(DB.config.whatsapp.mensaje)}" target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp">${bic('whatsapp')}</a>` : ''}`;
}
/* ===== Diseño «Universitario» (cabecera, portada y pie propios; el menú es el mismo navModel) ===== */
const isUni = () => !!(DB && DB.config && DB.config.diseno === 'universitario') && !document.body.classList.contains('is-admin');
const U_IC = { coffee: 'food', settings: 'gear', smile: 'tool', cog: 'gear', dental: 'tool' };
const uIc = n => ic(ICONS[n] ? n : (U_IC[n] || 'grad'));
const uSoc = () => { const r = DB.config.redes || {}; return ['facebook', 'youtube', 'instagram', 'tiktok'].filter(k => r[k]).map(k => `<a href="${esc(r[k])}" target="_blank" rel="noopener noreferrer" aria-label="${k} (se abre en una pestaña nueva)">${bic(k)}</a>`).join(''); };
const uHead = (title, text, btn, tag = 'h2') => `<div class="u-h"><div><${tag}>${title}</${tag}>${text ? `<p>${text}</p>` : ''}</div>${btn || ''}</div>`;
const uBtn = (href, label) => href ? `<a class="u-out" ${linkAttrs(href)}>${esc(label)}</a>` : '';
const uCar = (items, label, auto = false) => `<div class="pcar u-car" data-pcar${auto ? '' : ' data-pcar-static'}><button type="button" class="pcar-b prev" data-pcar-b="-1" aria-label="Anterior">‹</button><div class="pcar-t" tabindex="0" role="region" aria-label="${esc(label)} (desplázate para ver más)">${items.map(x => `<div class="pcar-i">${x}</div>`).join('')}</div><button type="button" class="pcar-b next" data-pcar-b="1" aria-label="Siguiente">›</button></div>`;
const uArrow = () => `<span class="u-sq" aria-hidden="true">${ic('arrow')}</span>`;
function uniHeader(path, nav, cur) {
  const i = inst();
  const acc = [[ext('aula'), 'Plataforma Virtual', 'monitor'], [ext('correo'), 'Correo institucional', 'mail'], [ext('biblioteca'), 'Biblioteca virtual', 'book'], ['#/servicios', 'Servicios en línea', 'inbox'], ['#/admin', 'Intranet', 'lock']].filter(x => x[0]);
  return `<a class="skip" href="#contenido" onclick="event.preventDefault();document.getElementById('contenido').focus()">Saltar al contenido principal</a>
  <header class="site-header u-head u-fit-2"><div class="u-bar">
    <a class="u-brand" href="#/" aria-label="${esc(i.nombreCorto)} - ir a inicio"><img src="${logoSrc()}" alt="Logotipo del ${esc(i.nombre)}"><span><strong>${esc(i.nombreCorto)}</strong><small>${esc(i.slogan)}</small></span></a>
    <nav class="mainnav" id="mainnav" aria-label="Navegación principal"><div class="wrap"><ul><li><a class="top home ${cur === '' ? 'active' : ''}" href="#/" aria-label="Inicio">${ic('home')}<span class="hide-lg">Inicio</span></a></li>${nav}</ul>
    <form class="mobile-search" role="search" data-search><label class="sr-only" for="q2">Buscar</label><input class="inp" id="q2" name="q" placeholder="Buscar en el sitio..."><button class="btn gold sm">Buscar</button></form></div></nav>
    <div class="u-tools"><div class="u-acc"><button type="button" class="u-acc-b" aria-expanded="false" aria-controls="u-acc"><span>Accesos<br>institucionales</span><i class="u-chv" aria-hidden="true"></i></button><ul class="u-acc-m" id="u-acc">${acc.map(([h, l, c]) => `<li><a ${linkAttrs(h)}>${ic(c)} ${esc(l)}${/^https?:/.test(h) ? '<span class="sr-only"> (enlace externo)</span>' : ''}</a></li>`).join('')}<li class="u-acc-c"><a href="mailto:${esc(i.correo)}">${ic('mail')} ${esc(i.correo)}</a></li><li class="u-acc-c"><a href="tel:${esc(String(i.telefono || '').replace(/\D/g, ''))}">${ic('phone')} ${esc(i.telefono)}</a></li></ul></div>
    <button type="button" class="u-sb" aria-expanded="false" aria-controls="u-srch" aria-label="Abrir el buscador">${ic('search')}</button>
    <button class="menu-btn" aria-expanded="false" aria-controls="mainnav" data-menu>☰ <span class="sr-only">Abrir menú</span></button></div>
  </div>
  <form class="u-srch" id="u-srch" role="search" data-search hidden><div class="wrap"><label class="sr-only" for="q1">Buscar en el sitio</label><input id="q1" name="q" placeholder="¿Qué estás buscando?"><button class="btn">${ic('search')} Buscar</button></div></form></header>`;
}
function uniFooter() {
  const i = inst(); const soc = uSoc(); const y = new Date().getFullYear(); const tel = String(i.telefono || '').replace(/\D/g, '');
  const legal = [['#/politica-de-privacidad', 'Política de privacidad'], ['#/transparencia/documentos-gestion', 'Portal de transparencia'], ['#/terminos-de-uso', 'Términos de uso'], ['#/mapa-del-sitio', 'Mapa del sitio'], ['#/admin', 'Intranet']];
  return `<footer class="site-footer u-foot"><div class="wrap u-f">
    <section><h2>Nuestros programas</h2><div class="u-tags">${progs().map(p => `<a href="#/programas/${esc(p.slug)}">${esc(p.nombre)}</a>`).join('')}</div>
      <a class="u-fbtn" href="#/admision">Admisión ${y}</a><a class="u-fbtn" href="#/servicios/bolsa-laboral">Bolsa Laboral</a><a class="u-fbtn" href="#/contacto">Contáctanos</a></section>
    <section><h2>Atención al público</h2><ul class="u-fc"><li>${ic('phone')}<span>Teléfono${i.telefonoNota ? ' (' + esc(i.telefonoNota) + ')' : ''}: <a href="tel:${esc(tel)}">${esc(i.telefono)}</a></span></li><li>${ic('mail')}<span>Correo: <a href="mailto:${esc(i.correo)}">${esc(i.correo)}</a></span></li><li>${ic('map')}<span>${esc(i.direccion)}</span></li><li>${ic('clock')}<span>${esc(i.horario)}</span></li></ul>
      </section>
    <section>${soc ? `<div class="social u-soc" aria-label="Redes sociales">${soc}</div>` : ''}<nav aria-label="Enlaces legales"><ul class="u-legal">${legal.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul></nav>
      <div class="u-flogos"><a ${linkAttrs(ext('minedu') || 'https://www.gob.pe/minedu')}>MINEDU</a>${ext('dre') ? `<a ${linkAttrs(ext('dre'))}>${esc(dreLabel())}</a>` : ''}</div>
      <a href="#/servicios/libro-de-reclamaciones" class="u-lr">${ic('book')}<span>Libro de<br>Reclamaciones</span></a></section>
  </div><div class="u-fb">© ${yearNow()} ${esc(i.nombre)}${i.ruc ? ' · RUC ' + esc(i.ruc) : ''} · Todos los derechos reservados.</div></footer>
  ${DB.config.whatsapp.activo && DB.config.whatsapp.numero ? `<a class="wa" href="https://wa.me/${esc(DB.config.whatsapp.numero)}?text=${encodeURIComponent(DB.config.whatsapp.mensaje)}" target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp">${bic('whatsapp')}</a>` : ''}`;
}
/* bloques de portada del diseño «Universitario»: mismos bloques y mismo orden/visibilidad que configura Portada */
function uniBlocks(base, h, i) {
  const ps = progs(); const sl = sortO(P('slides').filter(isPub));
  const pics = [...ps.map(p => p.imagen), ...sl.map(s => s.imagen)].filter(Boolean);
  const dirJ = P('jerarquica').find(j => j.esDirector) || {}; const dir = persona(dirJ.personaId);
  return Object.assign({}, base, {
    slider: () => base.slider() + (ps.length ? `<section class="u-prog" aria-label="Programas de estudio"><div class="wrap"><p class="u-prog-k">Conoce nuestros programas de estudio</p><div class="u-prog-g">${ps.map(p => `<a href="#/programas/${esc(p.slug)}"><span class="u-ci">${uIc(p.icono)}</span><b>${esc(p.nombre)}</b></a>`).join('')}</div></div></section>` : ''),
    accesos: () => { const qs = h.accesos.map(a => { const u = resolveLink(a.enlace); return u ? `<li><a ${linkAttrs(u)}><span class="u-ri">${ic(a.icono)}</span><span><strong>${esc(a.titulo)}</strong><small>${esc(a.texto)}</small></span>${ic('arrow')}</a></li>` : ''; }).filter(Boolean);
      return `<section class="u-band u-intro"><div class="wrap u-2"><div class="u-intro-t"><span class="u-k">${esc(i.nombre)}</span><h2>${esc(i.lema || i.slogan)}: formamos profesionales técnicos para la región</h2><p>${esc(i.descripcion)}</p><div class="u-collage">${pics.slice(0, 3).map(src => `<img src="${img(src)}" alt="" loading="lazy">`).join('')}<i></i><i></i><i></i></div></div>
        ${qs.length ? `<div class="u-card u-serv"><h3>Servicios en línea</h3><p>Realiza tus trámites y consultas sin acudir al instituto.</p><ul>${qs.join('')}</ul></div>` : ''}</div></section>`; },
    bienvenida: () => { const pr = page('presentacion'); if (!pr || !isPub(pr)) return ''; const ps2 = (pr.contenido.match(/<p>[\s\S]*?<\/p>/g) || []).slice(0, 2).join('');
      return `<section class="u-band u-quote"><div class="wrap u-2"><div><div class="u-h u-h-d"><div><span class="u-k">Bienvenida</span><h2>Mensaje de la Dirección General</h2></div></div><div class="prose">${sanitize(ps2)}</div><a class="u-out u-out-w" href="#/nosotros/presentacion">Leer presentación completa</a></div>
        <figure class="u-ph"><img src="${img(dir && dir.foto)}" alt="Fotografía de ${esc(fullName(dir))}" loading="lazy"><figcaption><b>${esc(fullName(dir))}</b><em>${esc(dirJ.cargo || 'Dirección General')}</em></figcaption></figure></div></section>`; },
    cifras: () => `<section class="u-light u-num" aria-label="Cifras institucionales"><div class="wrap"><div class="u-wm" aria-hidden="true">${esc(i.logoSigla || '')}</div>${(() => { const a = +cifra('auto:anios'); return a > 0 ? `<div class="u-numh"><span class="u-big">${cifNum(String(a))}</span><h2>años formando profesionales técnicos</h2></div>` : `<div class="u-numh"><span class="u-big">${cifNum(cifra('auto:programas'))}</span><h2>programas de estudio para tu futuro profesional</h2></div>`; })()}<div class="u-nums">${h.cifras.map(x => `<div class="stat cif${cifLink(x) ? ' cif-a' : ''}"><b>${cifNum(cifra(x.valor))}</b><span>${esc(x.label)}</span><small>Corte: ${esc(x.corte)}</small>${cifA(x)}</div>`).join('')}</div></div></section>`,
    programas: () => { const card = p => `<article class="u-pc"><img src="${img(p.imagen)}" alt="" loading="lazy"><div><h3><a href="#/programas/${esc(p.slug)}">${esc(p.nombre)}</a></h3><p>${esc(clamp(p.resumen || '', 90))}</p><span class="u-link">Ver programa</span></div></article>`;
      return `<section class="u-pan-s"><div class="u-pan">${uHead('Programas de estudio', 'Formación profesional técnica de 3 años con título a nombre de la Nación.', uBtn('#/programas', 'Ver todos los programas'))}${progView() === 'carrusel' && ps.length > 1 ? uCar(ps.map(card), 'Programas de estudio', true) : `<div class="u-grid">${ps.map(card).join('')}</div>`}</div></section>`; },
    noticias: () => { const ns = pubNews().slice(0, newsView('carrusel') === 'carrusel' ? 8 : 6); const card = n => `<article class="u-nc"><div class="u-nimg"><img src="${img(n.imagen, 'ph:campus:4')}" data-fit="${newsImageFit(n)}" alt="" loading="lazy">${uArrow()}</div><div class="u-nb"><time datetime="${esc(n.fecha)}">${fdate(n.fecha)}</time><h3><a href="#/noticias/${esc(n.slug)}">${esc(n.titulo)}</a></h3></div></article>`;
      return `<section class="u-pan-s"><div class="u-pan">${uHead('Últimas novedades', 'Noticias y actividades de nuestra comunidad educativa.', uBtn('#/noticias', 'Ver más noticias'))}${ns.length ? (newsView('carrusel') === 'carrusel' ? uCar(ns.map(card), 'Últimas novedades') : `<div class="u-ngrid">${ns.map(card).join('')}</div>`) : emptyMsg('noticias')}</div></section>`; },
    beneficios: () => `<section class="u-light u-mod"><div class="wrap u-2"><div>${uHead(`¿Por qué estudiar en el ${esc(i.nombreCorto)}?`, esc(i.descripcion))}<div class="u-collage u-collage2">${pics.slice(3, 5).map(src => `<img src="${img(src)}" alt="" loading="lazy">`).join('')}<i></i><i></i></div></div>
      <div class="u-acc-l">${h.beneficios.slice(0, 8).map((b, k) => `<details class="u-ac"${k ? '' : ' open'}><summary><span class="u-ai">${ic(b.i)}</span><b>${esc(b.t)}</b><span class="u-chev" aria-hidden="true">${ic('down')}</span></summary><p>${esc(b.d)}</p></details>`).join('')}</div></div></section>`,
    jerarquica: () => { const js = sortO(P('jerarquica').filter(isPub)).map(j => ({ j, p: persona(j.personaId) })).filter(x => x.p); if (!js.length) return '';
      return `<section class="u-light u-team"><div class="wrap">${uHead('Plana jerárquica', 'Conoce al equipo directivo que conduce nuestra institución.', uBtn('#/nosotros/plana-jerarquica', 'Conocer al equipo'))}${uCar(js.map(({ j, p }) => `<article class="u-tc"><img src="${img(p.foto)}" alt="Fotografía de ${esc(fullName(p))}" loading="lazy"><div><b><a href="#/nosotros/plana-jerarquica">${esc(fullName(p))}</a></b><small>${esc(j.cargo)}</small></div>${uArrow()}</article>`), 'Plana jerárquica')}</div></section>`; },
    testimonios: () => { const es = P('egresados').filter(isPub).slice(0, 6); if (!es.length) return '';
      return `<section class="u-band u-quote"><div class="wrap">${uHead('Lo que dicen nuestros egresados', '', '')}${uCar(es.map(e => `<figure class="u-ph u-ph-s"><img src="${img(e.foto)}" alt="" loading="lazy"><figcaption><b>${esc(e.nombres)}</b><em>${esc((progById(e.programaId) || {}).nombre || '')} · Promoción ${esc(e.anio)}</em><q>${esc(clamp(e.testimonio || '', 160))}</q></figcaption></figure>`), 'Testimonios de egresados')}</div></section>`; },
    eventos: () => { const ev = P('eventos').filter(e => isPub(e) && new Date(e.fecha) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 3); if (!ev.length) return '';
      return `<section class="u-pan-s"><div class="u-pan">${uHead('Próximos eventos', '', uBtn('#/eventos', 'Ver agenda completa'))}<div class="grid g3">${ev.map(eventCard).join('')}</div></div></section>`; },
    enlaces: () => { const all = coll('enlaces').filter(l => !l.deleted && ext(l.id)); let ls = all.filter(l => l.grupo === 'minedu'); if (!ls.length) ls = all.filter(l => l.grupo === 'Institucional' && l.id !== 'web'); if (!ls.length) return '';
      return `<section class="u-pan-s"><div class="u-pan">${uHead('Plataformas del Estado', 'Enlaces institucionales del sector Educación.', '')}<div class="u-logos">${ls.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span class="u-lg">${esc((l.id.length <= 10 ? l.id : l.nombre.split(/\s+/)[0]).toUpperCase())}</span><small>${esc(l.nombre)}</small><span class="sr-only"> (se abre en una pestaña nueva)</span></a>`).join('')}</div></div></section>`; },
  });
}
/* ===== Diseño «Impacto» (amarillo y negro, títulos condensados). Cabecera, portada y pie propios; el menú es el mismo navModel ===== */
const isImp = () => !!(DB && DB.config && IMP_KEYS.includes(DB.config.diseno)) && !document.body.classList.contains('is-admin');
const I_MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SET', 'OCT', 'NOV', 'DIC'];
const iFecha = (f, anio = true) => { const d = new Date(String(f || '').slice(0, 10) + 'T12:00:00'); return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')} ${I_MES[d.getMonth()]}${anio ? ', ' + d.getFullYear() : ''}`; };
const iHead = (title, more) => `<div class="i-h"><h2>${title}</h2>${more ? `<a class="i-more" href="${more}">Ver más</a>` : ''}</div>`;
function impHeader(path, nav, cur) {
  const i = inst(); const y = new Date().getFullYear(); const adm = admVigente();
  const top = [['#/admin', 'Intranet'], [ext('aula'), 'Plataforma Virtual'], [ext('correo'), 'Correo institucional'], [ext('biblioteca'), 'Biblioteca virtual'], ['#/servicios', 'Servicios en línea']].filter(x => x[0]);
  return `<a class="skip" href="#contenido" onclick="event.preventDefault();document.getElementById('contenido').focus()">Saltar al contenido principal</a>
  <div class="i-top"><div class="wrap">${top.map(([h, l]) => `<a ${linkAttrs(h)}>${esc(l)}${/^https?:/.test(h) ? '<span class="sr-only"> (enlace externo)</span>' : ''}</a>`).join('')}<button type="button" class="u-sb i-sb" aria-expanded="false" aria-controls="u-srch" aria-label="Abrir el buscador">${ic('search')}</button></div></div>
  <header class="site-header i-head"><div class="i-bar">
    <a class="i-brand${brandLong() ? ' b-long' : ''}" href="#/" aria-label="${esc(i.nombreCorto)} - ir a inicio"><img src="${logoSrc()}" alt="Logotipo del ${esc(i.nombre)}"><span><strong>${esc(brandSigla())}</strong>${brandLong() ? '' : `<small>${esc(i.nombreCorto)}</small>`}</span></a>
    <nav class="mainnav" id="mainnav" aria-label="Navegación principal"><div class="wrap"><ul><li><a class="top home ${cur === '' ? 'active' : ''}" href="#/" aria-label="Inicio">${ic('home')}<span class="hide-lg">Inicio</span></a></li>${nav}</ul>
    <form class="mobile-search" role="search" data-search><label class="sr-only" for="q2">Buscar</label><input class="inp" id="q2" name="q" placeholder="Buscar en el sitio..."><button class="btn gold sm">Buscar</button></form></div></nav>
    <a class="i-cta" href="#/admision">Postula · Admisión ${esc(adm ? adm.anio : y)}</a>
    <button class="menu-btn" aria-expanded="false" aria-controls="mainnav" data-menu>☰ <span class="sr-only">Abrir menú</span></button>
  </div>
  <form class="u-srch" id="u-srch" role="search" data-search hidden><div class="wrap"><label class="sr-only" for="q1">Buscar en el sitio</label><input id="q1" name="q" placeholder="¿Qué estás buscando?"><button class="btn">${ic('search')} Buscar</button></div></form></header>`;
}
function impFooter() {
  const i = inst(); const soc = uSoc();
  const col = (title, links) => `<nav aria-label="${esc(title)}"><h2>${esc(title)}</h2><ul>${links.map(([h, l]) => `<li><a ${linkAttrs(h)}>${esc(l)}</a></li>`).join('')}</ul></nav>`;
  return `<footer class="site-footer i-foot"><div class="wrap i-f">
    <section><h2>Nuestros programas</h2><ul class="i-inline">${progs().map(p => `<li><a href="#/programas/${esc(p.slug)}">${esc(p.nombre)}</a></li>`).join('')}</ul>
      <h2>Atención al público</h2><ul class="i-inline i-at"><li><a href="tel:${esc(String(i.telefono || '').replace(/\D/g, ''))}">${esc(i.telefono)}</a></li><li><a href="mailto:${esc(i.correo)}">${esc(i.correo)}</a></li><li>${esc(i.direccion)}</li></ul></section>
    ${col('Institucional', [['#/nosotros/presentacion', 'Nosotros'], ['#/transparencia/documentos-gestion', 'Portal de transparencia'], ['#/politica-de-privacidad', 'Política de privacidad'], ['#/terminos-de-uso', 'Términos de uso']])}
    ${col('Comunidad', [['#/eventos', 'Eventos'], ['#/noticias', 'Noticias'], ['#/contacto', 'Contáctanos'], ['#/admin', 'Intranet']])}
    <section><h2>Enlaces institucionales</h2><div class="i-flogos"><a ${linkAttrs(ext('minedu') || 'https://www.gob.pe/minedu')}>MINEDU</a>${ext('dre') ? `<a ${linkAttrs(ext('dre'))}>${esc(dreLabel())}</a>` : ''}</div></section>
  </div>
  <div class="wrap i-f2"><a href="#/servicios/libro-de-reclamaciones" class="i-lr">${ic('book')}<span>Libro de<br>Reclamaciones</span></a>${soc ? `<div class="social i-soc" aria-label="Redes sociales">${soc}</div>` : ''}</div>
  <div class="i-fb">${esc(i.nombre)}${i.ruc ? ' – RUC N.° ' + esc(i.ruc) : ''} · © ${yearNow()}</div></footer>
  ${DB.config.whatsapp.activo && DB.config.whatsapp.numero ? `<a class="wa" href="https://wa.me/${esc(DB.config.whatsapp.numero)}?text=${encodeURIComponent(DB.config.whatsapp.mensaje)}" target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp">${bic('whatsapp')}</a>` : ''}`;
}
/* bloques de portada del diseño «Impacto»: mismos bloques y mismo orden/visibilidad que configura Portada */
function impBlocks(base, h, i) {
  const ps = progs(); const sl = sortO(P('slides').filter(isPub));
  const pics = [...sl.map(s => s.imagen), ...ps.map(p => p.imagen)].filter(Boolean);
  const loc = P('locales').filter(isPub).find(l => l.foto);
  const dirJ = P('jerarquica').find(j => j.esDirector) || {}; const dir = persona(dirJ.personaId);
  return Object.assign({}, base, {
    slider: () => { const html = base.slider(); return html ? html.replace(/<\/section>\s*$/, `<a class="i-down" href="#i-start" onclick="event.preventDefault();var t=document.getElementById('i-start');if(t)t.scrollIntoView({behavior:'smooth'})" aria-label="Ir al contenido de la portada"><span aria-hidden="true"></span></a></section><span id="i-start"></span>`) : ''; },
    programas: () => ps.length ? `<section class="i-sec i-prog"><div class="wrap"><h2 class="i-ttl i-gold">Programas de estudio</h2><div class="i-tiles">${ps.map(p => `<a class="i-tile" href="#/programas/${esc(p.slug)}"><img src="${img(p.imagen)}" alt="" loading="lazy"><b>${esc(p.nombre)}</b></a>`).join('')}</div><p class="i-c"><a class="i-btn" href="#/programas">${ic('search')} Ver programas de estudio</a></p></div></section>` : '',
    bienvenida: () => { const pr = page('presentacion'); if (!pr || !isPub(pr)) return '';
      return `<section class="i-sec"><div class="wrap i-duo"><a class="i-pa" href="#/nosotros/presentacion"><img src="${img(dir && dir.foto || pics[0])}" alt="" loading="lazy"><span><i aria-hidden="true">+</i>Mensaje de la<br>Dirección General</span></a><a class="i-pb" href="#/nosotros/campus-e-informes"><img src="${img(loc && loc.foto || pics[1] || pics[0])}" alt="" loading="lazy"><span><b>Nuestro campus</b><small>${esc(i.direccion)}</small></span></a></div></section>`; },
    accesos: () => { const qs = h.accesos.map(a => { const u = resolveLink(a.enlace); return u ? `<a class="i-box" ${linkAttrs(u)}><i aria-hidden="true">+</i><span><b>${esc(a.titulo)}</b><small>${esc(a.texto)}</small></span></a>` : ''; }).filter(Boolean);
      return qs.length ? `<section class="i-sec"><div class="wrap"><h2 class="i-ttl">Conoce nuestros servicios en línea:</h2><div class="i-boxes">${qs.join('')}</div></div></section>` : ''; },
    beneficios: () => `<section class="i-sec"><div class="wrap"><h2 class="i-ttl">¿Por qué estudiar en el ${esc(i.nombreCorto)}?</h2><div class="i-boxes">${h.beneficios.slice(0, 8).map(b => `<details class="i-box i-acc"><summary><i aria-hidden="true">+</i><b>${esc(b.t)}</b></summary><p>${esc(b.d)}</p></details>`).join('')}</div></div></section>`,
    cifras: () => { const cs = h.cifras.filter(x => String(cifra(x.valor)).trim()); if (!cs.length) return '';
      return `<section class="i-black" aria-label="Cifras institucionales" data-iach><div class="wrap i-ach">${cs.map((x, k) => `<div class="i-ach-i cif${k ? '' : ' on'}"${k ? ' hidden' : ''}><div><span class="i-num">${String(k + 1).padStart(2, '0')}</span><h2>${cifNum(cifra(x.valor))} ${esc(x.label)}</h2><p>${esc(i.descripcion)}</p><small>Corte: ${esc(x.corte)}</small>${cifLink(x) ? `<a class="i-cifl" ${linkAttrs(cifLink(x))}>Ver más <span aria-hidden="true">→</span></a>` : ''}</div><figure>${pics[k % Math.max(pics.length, 1)] ? `<img src="${img(pics[k % pics.length])}" alt="" loading="lazy">` : ''}</figure></div>`).join('')}
        ${cs.length > 1 ? `<div class="i-ach-n"><button type="button" data-iach="-1" aria-label="Anterior">‹</button><button type="button" data-iach="1">Siguiente <span aria-hidden="true">›</span></button></div>` : ''}</div></section>`; },
    noticias: () => { const ns = pubNews().slice(0, newsCount()); return `<section class="i-sec"><div class="wrap">${iHead('Noticias', '#/noticias')}${ns.length ? newsWrap(ns.map(n => `<article class="i-card"><img src="${img(n.imagen, 'ph:campus:4')}" data-fit="${newsImageFit(n)}" alt="" loading="lazy"><div><time datetime="${esc(n.fecha)}">${iFecha(n.fecha)}</time><h3><a href="#/noticias/${esc(n.slug)}">${esc(n.titulo)}</a></h3><a class="i-lk" href="#/noticias/${esc(n.slug)}" aria-hidden="true" tabindex="-1">Leer</a></div></article>`), h => `<div class="i-cards">${h}</div>`, 'tarjetas', 'i-ncar') : emptyMsg('noticias')}</div></section>`; },
    eventos: () => { const ev = P('eventos').filter(e => isPub(e) && new Date(e.fecha) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 3); if (!ev.length) return '';
      return `<section class="i-sec"><div class="wrap">${iHead('Eventos', '#/eventos')}<div class="i-cards">${ev.map(e => `<article class="i-card"><img src="${img(e.imagen, 'ph:campus:2')}" alt="" loading="lazy"><div><time datetime="${esc(e.fecha)}">${iFecha(e.fecha, false)}</time><h3><a href="#/eventos">${esc(e.titulo)}</a></h3><a class="i-lk" href="#/eventos" aria-hidden="true" tabindex="-1">Ver detalle</a></div></article>`).join('')}</div></div></section>`; },
    jerarquica: () => { const js = sortO(P('jerarquica').filter(isPub)).map(j => ({ j, p: persona(j.personaId) })).filter(x => x.p); if (!js.length) return '';
      return `<section class="i-sec i-team"><div class="wrap"><h2 class="i-ttl i-cen">Conoce a nuestro equipo directivo</h2></div>${uCar(js.map(({ j, p }) => `<a class="i-tile i-tile-w" href="#/nosotros/plana-jerarquica"><img src="${img(p.foto)}" alt="" loading="lazy"><b>${esc(fullName(p))}<small>${esc(j.cargo)}</small></b></a>`), 'Plana jerárquica')}</section>`; },
    testimonios: () => { const es = P('egresados').filter(isPub).slice(0, 3); if (!es.length) return '';
      return `<section class="i-sec"><div class="wrap">${iHead('Nuestros egresados', '')}<div class="i-cards">${es.map(e => `<figure class="i-card i-q"><img src="${img(e.foto)}" alt="" loading="lazy"><figcaption><q>${esc(clamp(e.testimonio || '', 170))}</q><b>${esc(e.nombres)}</b><small>${esc((progById(e.programaId) || {}).nombre || '')} · Promoción ${esc(e.anio)}</small></figcaption></figure>`).join('')}</div></div></section>`; },
    enlaces: () => { const all = coll('enlaces').filter(l => !l.deleted && ext(l.id)); let ls = all.filter(l => l.grupo === 'minedu'); if (!ls.length) ls = all.filter(l => l.grupo === 'Institucional' && l.id !== 'web'); if (!ls.length) return '';
      return `<section class="i-sec"><div class="wrap"><h2 class="i-ttl i-cen">Plataformas del Estado</h2><div class="i-logos">${ls.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><b>${esc((l.id.length <= 10 ? l.id : l.nombre.split(/\s+/)[0]).toUpperCase())}</b><small>${esc(l.nombre)}</small><span class="sr-only"> (se abre en una pestaña nueva)</span></a>`).join('')}</div></div></section>`; },
  });
}
/* ===== Diseño «Horizonte»: franjas de color con esquinas redondeadas, acento y títulos en dos colores ===== */
const isHor = () => !!(DB && DB.config && DB.config.diseno === 'horizonte') && !document.body.classList.contains('is-admin');
const hTtl = (a, b, cls = '', tag = 'h2') => `<${tag} class="h-ttl ${cls}">${a}${b ? ` <em>${b}</em>` : ''}</${tag}>`;
const hMore = (href, label = 'Conoce más') => `<a class="h-more" ${linkAttrs(href)}>${esc(label)} <span aria-hidden="true">→</span></a>`;
function horHeader(path, nav, cur) {
  const i = inst(); const adm = admVigente(); const y = new Date().getFullYear();
  const top = [['#/servicios', 'Servicios en línea'], [ext('aula'), 'Plataforma Virtual'], [ext('correo'), 'Correo institucional'], [ext('biblioteca'), 'Biblioteca virtual'], ['#/admin', 'Intranet']].filter(x => x[0]);
  return `<a class="skip" href="#contenido" onclick="event.preventDefault();document.getElementById('contenido').focus()">Saltar al contenido principal</a>
  <header class="site-header h-head"><a class="h-brand${brandLong() ? ' b-long' : ''}" href="#/" aria-label="${esc(i.nombreCorto)} - ir a inicio"><img src="${logoSrc()}" alt="Logotipo del ${esc(i.nombre)}"><span>${brandLong() ? '' : '<small>Instituto de Educación Superior</small>'}<strong>${esc(brandSigla())}</strong><em>${esc(i.slogan)}</em></span></a>
    <div class="h-rows"><div class="h-top">${top.map(([h, l]) => `<a ${linkAttrs(h)}>${esc(l)}${/^https?:/.test(h) ? '<span class="sr-only"> (enlace externo)</span>' : ''}</a>`).join('')}<button type="button" class="u-sb h-sb" aria-expanded="false" aria-controls="u-srch" aria-label="Abrir el buscador">${ic('search')}</button></div>
      <div class="h-main"><nav class="mainnav" id="mainnav" aria-label="Navegación principal"><div class="wrap"><ul><li><a class="top home ${cur === '' ? 'active' : ''}" href="#/" aria-label="Inicio">${ic('home')}<span class="hide-lg">Inicio</span></a></li>${nav}</ul>
        <form class="mobile-search" role="search" data-search><label class="sr-only" for="q2">Buscar</label><input class="inp" id="q2" name="q" placeholder="Buscar en el sitio..."><button class="btn gold sm">Buscar</button></form></div></nav>
        <a class="h-cta" href="#/admision"><span>Postula</span><small>Admisión ${esc(adm ? adm.anio : y)}</small></a>
        <button class="menu-btn" aria-expanded="false" aria-controls="mainnav" data-menu>☰ <span class="sr-only">Abrir menú</span></button></div></div>
    <form class="u-srch" id="u-srch" role="search" data-search hidden><div class="wrap"><label class="sr-only" for="q1">Buscar en el sitio</label><input id="q1" name="q" placeholder="¿Qué estás buscando?"><button class="btn">${ic('search')} Buscar</button></div></form></header>`;
}
function horFooter() {
  const i = inst(); const r = DB.config.redes || {}; const tel = String(i.telefono || '').replace(/\D/g, '');
  const soc = ['facebook', 'youtube', 'instagram', 'tiktok'].filter(k => r[k]).map(k => `<a href="${esc(r[k])}" target="_blank" rel="noopener noreferrer" aria-label="${k} (se abre en una pestaña nueva)">${bic(k)}</a>`).join('');
  const grp = (t, ls) => `<div class="h-fg"><h3>${esc(t)}</h3><ul>${ls.map(([h, l]) => `<li><a ${linkAttrs(h)}>${esc(l)}</a></li>`).join('')}</ul></div>`;
  return `${soc ? `<section class="h-social"><div class="wrap">${hTtl('Síguenos y entérate', 'de lo nuevo')}<div class="h-soc">${soc}</div></div></section>` : ''}
  <footer class="site-footer h-foot"><div class="wrap h-f">
    <div>${grp('Admisión', [['#/admision', 'Proceso de admisión'], ['#/matricula', 'Matrícula'], ['#/becas', 'Becas']])}${grp('Servicios', [['#/servicios/mesa-de-partes', 'Mesa de partes'], ['#/servicios/consulta-certificados', 'Consulta de certificados'], ['#/servicios/bolsa-laboral', 'Bolsa laboral'], ['#/transparencia/documentos-gestion', 'Portal de transparencia'], ['#/mapa-del-sitio', 'Mapa del sitio']])}
      <a href="#/servicios/libro-de-reclamaciones" class="h-lr">${ic('book')}<span>Libro de<br>Reclamaciones</span></a></div>
    <div>${grp('Programas de estudio', progs().map(p => ['#/programas/' + p.slug, p.nombre]))}${grp('Institucional', [['#/nosotros/presentacion', 'Nosotros'], ['#/noticias', 'Noticias'], ['#/eventos', 'Eventos'], ['#/contacto', 'Contáctanos'], ['#/admin', 'Intranet']])}</div>
    <div class="h-fc"><h3>Sede institucional</h3><p>${ic('map')}<span>${esc(i.direccion)}</span></p><p>${ic('phone')}<a href="tel:${esc(tel)}">${esc(i.telefono)}</a></p><p>${ic('mail')}<a href="mailto:${esc(i.correo)}">${esc(i.correo)}</a></p><p>${ic('clock')}<span>${esc(i.horario)}</span></p>
      <h3>Enlaces institucionales</h3><p class="h-fl"><a ${linkAttrs(ext('minedu') || 'https://www.gob.pe/minedu')}>MINEDU</a>${ext('dre') ? `<a ${linkAttrs(ext('dre'))}>${esc(dreLabel())}</a>` : ''}</p></div>
  </div><div class="wrap h-fb"><a class="h-fbrand${brandLong() ? ' b-long' : ''}" href="#/">${brandLong() ? '' : '<small>Instituto de Educación Superior</small>'}<strong>${esc(brandSigla())}</strong></a><nav aria-label="Enlaces legales"><a href="#/politica-de-privacidad">Política de privacidad</a><a href="#/terminos-de-uso">Términos de uso</a><a href="#/transparencia/documentos-gestion">Transparencia</a></nav><div class="h-soc h-soc-s">${soc}</div></div>
  <div class="h-copy">© ${yearNow()} ${esc(i.nombre)}${i.ruc ? ' · RUC ' + esc(i.ruc) : ''}</div></footer>
  ${DB.config.whatsapp.activo && DB.config.whatsapp.numero ? `<a class="wa" href="https://wa.me/${esc(DB.config.whatsapp.numero)}?text=${encodeURIComponent(DB.config.whatsapp.mensaje)}" target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp">${bic('whatsapp')}</a>` : ''}`;
}
/* bloques de portada del diseño «Horizonte»: mismos bloques y mismo orden/visibilidad que configura Portada */
function horBlocks(base, h, i) {
  const ps = progs(); const sl = sortO(P('slides').filter(isPub));
  const pics = [...sl.map(s => s.imagen), ...ps.map(p => p.imagen)].filter(Boolean);
  const loc = P('locales').filter(isPub).find(l => l.foto);
  const dirJ = P('jerarquica').find(j => j.esDirector) || {}; const dir = persona(dirJ.personaId);
  const tabs = (id, items, label) => `<div class="h-tabs" data-htabs role="tablist" aria-label="${esc(label)}">${items.map((x, k) => `<button type="button" role="tab" id="${id}-t${k}" aria-controls="${id}-p${k}" aria-selected="${k ? 'false' : 'true'}" data-htab="${k}">${esc(x)}</button>`).join('')}</div>`;
  return Object.assign({}, base, {
    programas: () => ps.length ? `<section class="h-oferta"><div class="wrap"><div class="h-panel">${hTtl('Conoce nuestra', 'oferta formativa', 'h-c')}<div class="h-ofg">${ps.map(p => `<article class="h-of"><h3><a href="#/programas/${esc(p.slug)}">${esc(p.nombre)}</a></h3><small>${esc(p.duracion || 'Programa de estudios · 3 años')}</small><i class="h-line" aria-hidden="true"></i><img src="${img(p.imagen)}" alt="" loading="lazy"><p>${esc(clamp(p.resumen || '', 120))}</p>${hMore('#/programas/' + p.slug)}</article>`).join('')}</div></div></div></section>` : '',
    cifras: () => { const cs = h.cifras.filter(x => String(cifra(x.valor)).trim()); if (!cs.length) return '';
      return `<section class="h-cal"><div class="wrap"><div class="h-band">${hTtl('Calidad', 'institucional')}<p>${esc(i.descripcion)}</p></div><div class="h-nums">${cs.map(x => `<div class="cif${cifLink(x) ? ' cif-a' : ''}"><b>${cifNum(cifra(x.valor))}</b><span>${esc(x.label)}</span><small>Corte ${esc(x.corte)}</small>${cifA(x)}</div>`).join('')}</div></div></section>`; },
    beneficios: () => { const bs = h.beneficios.slice(0, 6); if (!bs.length) return '';
      return `<section class="h-ben"><div class="wrap">${hTtl('Beneficios de estudiar en el', esc(i.nombreCorto), 'h-c')}<div class="h-bpan" data-htabgroup><img src="${img(pics[1] || pics[0])}" alt="" loading="lazy">${tabs('hb', bs.map(b => b.t), 'Beneficios')}<div class="h-bbody">${bs.map((b, k) => `<div role="tabpanel" id="hb-p${k}" aria-labelledby="hb-t${k}" data-hpane="${k}"${k ? ' hidden' : ''}><h3>${esc(b.t)}</h3><p>${esc(b.d)}</p>${hMore('#/nosotros/presentacion')}</div>`).join('')}</div></div></div></section>`; },
    testimonios: () => { const es = P('egresados').filter(isPub).slice(0, 3); if (!es.length) return '';
      return `<section class="h-testi"><div class="wrap"><div class="h-th">${hTtl('Lo que dicen', 'nuestros egresados')}<p>Nuestros egresados llevaron su <b>formación técnica</b> a la <b>vida profesional</b>. Estos son sus testimonios.</p></div><div class="h-tc">${es.map(e => `<figure class="h-pc"><img src="${img(e.foto)}" alt="" loading="lazy"><figcaption><q>${esc(clamp(e.testimonio || '', 120))}</q><b>${esc(e.nombres)}</b><small>${esc((progById(e.programaId) || {}).nombre || '')} · Promoción ${esc(e.anio)}</small></figcaption></figure>`).join('')}</div></div></section>`; },
    jerarquica: () => { const js = sortO(P('jerarquica').filter(isPub)).map(j => ({ j, p: persona(j.personaId) })).filter(x => x.p).slice(0, 4); if (!js.length) return '';
      return `<section class="h-team"><div class="wrap"><div class="h-th h-th-l">${hTtl('Conoce a nuestro', 'equipo directivo')}${hMore('#/nosotros/plana-jerarquica', 'Ver plana jerárquica')}</div><div class="h-tc h-tc4">${js.map(({ j, p }) => `<a class="h-pc" href="#/nosotros/plana-jerarquica"><img src="${img(p.foto)}" alt="" loading="lazy"><span class="h-pcx"><b>${esc(fullName(p))}</b><small>${esc(j.cargo)}</small></span></a>`).join('')}</div></div></section>`; },
    bienvenida: () => { const pr = page('presentacion'); if (!pr || !isPub(pr)) return ''; const tx = (pr.contenido.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
      return `<section class="h-msg"><div class="wrap h-2"><article class="h-mcard"><img src="${img(loc && loc.foto || pics[0])}" alt="" loading="lazy"><div class="h-mp"><img src="${img(dir && dir.foto)}" alt=""><div><b>${esc(fullName(dir))}</b><small>${esc(dirJ.cargo || 'Dirección General')}</small></div></div><p>${esc(clamp(tx, 260))}</p></article>
        <div>${hTtl('Mensaje de la', 'Dirección General')}<h3>${esc(i.lema || i.slogan || '')}</h3><p>${esc(i.descripcion)}</p><a class="h-pill" href="#/nosotros/presentacion">Conoce más <span aria-hidden="true">›</span></a></div></div></section>`; },
    accesos: () => { const qs = h.accesos.map(a => ({ a, u: resolveLink(a.enlace) })).filter(x => x.u); if (!qs.length) return '';
      return `<section class="h-camp"><div class="wrap">${hTtl('Servicios', 'en línea', 'h-c h-w')}<p class="h-sub">Realiza tus trámites y consultas desde cualquier lugar, sin acudir al instituto.</p><div data-htabgroup>${tabs('ha', qs.map(x => x.a.titulo), 'Servicios en línea')}
        <div class="h-ccard"><button type="button" class="h-arr" data-hstep="-1" aria-label="Servicio anterior">‹</button>${qs.map(({ a, u }, k) => `<div class="h-cin" role="tabpanel" id="ha-p${k}" aria-labelledby="ha-t${k}" data-hpane="${k}"${k ? ' hidden' : ''}><span class="h-cic">${ic(a.icono)}</span><div>${hTtl('', esc(a.titulo), '', 'h3')}<p>${esc(a.texto)}</p><p class="h-cl">${ic('map')} ${esc(i.direccion)}</p><p class="h-cl">${ic('mail')} ${esc(i.correo)}</p><a class="h-more" ${linkAttrs(u)}>Ingresar al servicio <span aria-hidden="true">→</span></a></div></div>`).join('')}<button type="button" class="h-arr" data-hstep="1" aria-label="Servicio siguiente">›</button></div></div></div></section>`; },
    enlaces: () => { const all = coll('enlaces').filter(l => !l.deleted && ext(l.id)); let ls = all.filter(l => l.grupo === 'minedu'); if (!ls.length) ls = all.filter(l => l.grupo === 'Institucional' && l.id !== 'web'); if (!ls.length) return '';
      return `<section class="h-rank"><div class="wrap"><div class="h-rg">${ls.slice(0, 6).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><b>${esc((l.id.length <= 10 ? l.id : l.nombre.split(/\s+/)[0]).toUpperCase())}</b><small>${esc(l.nombre)}</small><span class="sr-only"> (se abre en una pestaña nueva)</span></a>`).join('')}</div></div></section>`; },
    noticias: () => { const ns = pubNews().slice(0, newsCount()); return `<section class="h-news"><div class="h-nband"><div class="wrap h-th h-th-l">${hTtl('Noticias', 'del instituto', 'h-w')}${hMore('#/noticias', 'Ver todas las noticias')}</div></div><div class="wrap">${ns.length ? newsWrap(ns.map(n => `<article class="h-nc"><img src="${img(n.imagen, 'ph:campus:4')}" data-fit="${newsImageFit(n)}" alt="" loading="lazy"><div><time datetime="${esc(n.fecha)}">${fdate(n.fecha)}</time><h3><a href="#/noticias/${esc(n.slug)}">${esc(n.titulo)}</a></h3>${hMore('#/noticias/' + n.slug, 'Leer más')}</div></article>`), h => `<div class="h-ncards">${h}</div>`, 'tarjetas', 'h-ncar') : emptyMsg('noticias')}</div></section>`; },
    eventos: () => { const ev = P('eventos').filter(e => isPub(e) && new Date(e.fecha) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 3); if (!ev.length) return '';
      return `<section class="h-ev"><div class="wrap"><div class="h-th h-th-l">${hTtl('Próximos', 'eventos')}${hMore('#/eventos', 'Ver agenda')}</div><div class="grid g3">${ev.map(eventCard).join('')}</div></div></section>`; },
  });
}
/* ===== Diseño «Campus»: barra de color, menú en mayúsculas sobre la portada y tarjetas en capas ===== */
const isCam = () => !!(DB && DB.config && DB.config.diseno === 'campus') && !document.body.classList.contains('is-admin');
const kTtl = (t, tag = 'h2', cls = '') => `<${tag} class="k-ttl ${cls}">${t}</${tag}>`;
const K_TONOS = ['var(--kp)', 'var(--blue)', 'var(--kk)', 'var(--navy2)']; // capas de color de Campus: todas salen de los colores del portal
function camHeader(path, nav, cur) {
  const i = inst(); const r = DB.config.redes || {};
  const soc = ['facebook', 'youtube', 'instagram', 'tiktok'].filter(k => r[k]).map(k => `<a href="${esc(r[k])}" target="_blank" rel="noopener noreferrer" aria-label="${k} (se abre en una pestaña nueva)">${bic(k)}</a>`).join('');
  const top = [['#/servicios', 'Servicios en línea'], ['#/servicios/bolsa-laboral', 'Bolsa laboral'], [ext('biblioteca'), 'Biblioteca'], ['#/eventos', 'Eventos'], ['#/transparencia/documentos-gestion', 'Transparencia']].filter(x => x[0]);
  return `<a class="skip" href="#contenido" onclick="event.preventDefault();document.getElementById('contenido').focus()">Saltar al contenido principal</a>
  <div class="k-top"><div class="k-tw">${soc ? `<div class="k-soc">${soc}</div>` : ''}<nav class="k-tl" aria-label="Accesos">${top.map(([h, l]) => `<a ${linkAttrs(h)}>${esc(l)}${/^https?:/.test(h) ? '<span class="sr-only"> (enlace externo)</span>' : ''}</a>`).join('')}</nav><a class="k-portal" href="#/admin">Intranet</a>${ext('aula') ? `<a class="k-portal" ${linkAttrs(ext('aula'))}>Plataforma virtual<span class="sr-only"> (enlace externo)</span></a>` : ''}</div></div>
  <header class="site-header k-head"><div class="k-bar">
    <a class="k-brand${brandLong() ? ' b-long' : ''}" href="#/" aria-label="${esc(i.nombreCorto)} - ir a inicio"><img src="${logoSrc()}" alt="Logotipo del ${esc(i.nombre)}"><span><strong>${esc(brandSigla())}</strong>${brandLong() ? '' : `<small>${esc(i.nombreCorto)}</small>`}</span></a>
    <nav class="mainnav" id="mainnav" aria-label="Navegación principal"><div class="wrap"><ul><li><a class="top home ${cur === '' ? 'active' : ''}" href="#/" aria-label="Inicio">${ic('home')}<span class="hide-lg">Inicio</span></a></li>${nav}</ul>
      <form class="mobile-search" role="search" data-search><label class="sr-only" for="q2">Buscar</label><input class="inp" id="q2" name="q" placeholder="Buscar en el sitio..."><button class="btn gold sm">Buscar</button></form></div></nav>
    <button type="button" class="u-sb k-sb" aria-expanded="false" aria-controls="u-srch" aria-label="Abrir el buscador">${ic('search')}</button>
    <button class="menu-btn" aria-expanded="false" aria-controls="mainnav" data-menu>☰ <span class="sr-only">Abrir menú</span></button></div>
    <form class="u-srch" id="u-srch" role="search" data-search hidden><div class="wrap"><label class="sr-only" for="q1">Buscar en el sitio</label><input id="q1" name="q" placeholder="¿Qué estás buscando?"><button class="btn">${ic('search')} Buscar</button></div></form></header>
  ${['servicios', 'admin', 'contacto'].includes(cur) || /^(mesa-de-partes|certificados|libro-de-reclamaciones|bolsa-laboral)$/.test(cur) ? '' : `<div class="k-float${cur ? ' k-mini' : ''}" aria-label="Accesos destacados"><a class="k-f1" href="#/admision">${ic('send')}<span>Quiero postular</span></a><a class="k-f2" href="#/servicios/mesa-de-partes">${ic('inbox')}<span>Mesa de partes</span></a><a class="k-f3" href="#/servicios/consulta-certificados">${ic('award')}<span>Certificados</span></a></div>`}`;
}
function camFooter() {
  const i = inst(); const r = DB.config.redes || {}; const tel = String(i.telefono || '').replace(/\D/g, '');
  const soc = ['facebook', 'youtube', 'instagram', 'tiktok'].filter(k => r[k]).map(k => `<a href="${esc(r[k])}" target="_blank" rel="noopener noreferrer" aria-label="${k} (se abre en una pestaña nueva)">${bic(k)}</a>`).join('');
  const cols = [[['#/', 'Inicio'], ['#/programas', 'Programas de estudio'], ['#/admision', 'Admisión'], ['#/matricula', 'Matrícula'], ['#/becas', 'Becas']],
    [['#/nosotros/presentacion', 'Nosotros'], ['#/noticias', 'Noticias'], ['#/eventos', 'Eventos'], ['#/nosotros/plana-docente', 'Plana docente'], ['#/contacto', 'Contáctanos']],
    [['#/servicios/mesa-de-partes', 'Mesa de partes'], ['#/servicios/consulta-certificados', 'Consulta de certificados'], ['#/servicios/bolsa-laboral', 'Bolsa laboral'], ['#/transparencia/documentos-gestion', 'Portal de transparencia'], ['#/politica-de-privacidad', 'Política de privacidad']]];
  return `<footer class="site-footer k-foot"><div class="k-fl"><div class="wrap k-fg">${cols.map(c => `<ul>${c.map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join('')}</ul>`).join('')}</div></div>
    <div class="k-fb"><div class="wrap k-fg"><div>${soc ? `<div class="k-soc k-soc-b">${soc}</div>` : ''}<a href="#/servicios/libro-de-reclamaciones" class="k-lr">${ic('book')}<span>Libro de<br>Reclamaciones</span></a></div>
      <div><h2>Ubícanos</h2><p>${esc(i.direccion)}<br>Correo: <a href="mailto:${esc(i.correo)}">${esc(i.correo)}</a><br>Teléfono: <a href="tel:${esc(tel)}">${esc(i.telefono)}</a></p></div>
      <div><h2>Horario de atención</h2><p>${esc(i.horario)}</p><p class="k-fx"><a ${linkAttrs(ext('minedu') || 'https://www.gob.pe/minedu')}>MINEDU</a>${ext('dre') ? `<a ${linkAttrs(ext('dre'))}>${esc(dreLabel())}</a>` : ''}</p></div></div></div>
    <div class="k-copy"><div class="wrap"><span>© ${yearNow()} ${esc(i.nombre)} | Todos los derechos reservados.</span>${i.ruc ? `<span>RUC: ${esc(i.ruc)}</span>` : ''}</div></div></footer>
  ${DB.config.whatsapp.activo && DB.config.whatsapp.numero ? `<a class="wa" href="https://wa.me/${esc(DB.config.whatsapp.numero)}?text=${encodeURIComponent(DB.config.whatsapp.mensaje)}" target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp">${bic('whatsapp')}</a>` : ''}`;
}
/* bloques de portada del diseño «Campus»: mismos bloques y mismo orden/visibilidad que configura Portada */
function camBlocks(base, h, i) {
  const ps = progs(); const sl = sortO(P('slides').filter(isPub));
  const pics = [...sl.map(s => s.imagen), ...ps.map(p => p.imagen)].filter(Boolean);
  const loc = P('locales').filter(isPub).find(l => l.foto);
  const dirJ = P('jerarquica').find(j => j.esDirector) || {}; const dir = persona(dirJ.personaId);
  const lay = (href, imgSrc, icon, title, k, more = 'Conoce más aquí') => `<a class="k-lay" href="${esc(href)}" style="--kt:${K_TONOS[k % 4]}"><span class="k-lay-p"><img src="${img(imgSrc)}" alt="" loading="lazy"></span><span class="k-lay-l"><span class="k-lay-n">${ic(icon)}<b>${esc(title)}</b></span><em>${esc(more)} ›</em></span></a>`;
  const car = (items, label) => uCar(items, label);
  return Object.assign({}, base, {
    programas: () => ps.length ? `<section class="k-sec"><div class="wrap">${kTtl('Nuestros programas pensados en ti')}<div class="k-tabs" role="list"><span role="listitem" class="on">Programas de estudio</span><a role="listitem" href="#/admision">Admisión ${esc(String((admVigente() || {}).anio || new Date().getFullYear()))}</a><a role="listitem" href="#/becas">Becas</a></div>
      <div class="k-car">${car(ps.map((p, k) => lay('#/programas/' + p.slug, p.imagen, U_IC[p.icono] && ICONS[U_IC[p.icono]] ? U_IC[p.icono] : (ICONS[p.icono] ? p.icono : 'grad'), p.nombre, k)), 'Programas de estudio')}</div></div></section>` : '',
    beneficios: () => { const bs = h.beneficios.slice(0, 5); if (!bs.length) return '';
      return `<section class="k-sec k-gray">${kTtl(`¿Por qué estudiar en el ${esc(i.nombreCorto)}?`)}<div class="wrap k-why">${bs.map((b, k) => `<details class="k-wc"><summary><img src="${img(pics[k % Math.max(pics.length, 1)] || '')}" alt="" loading="lazy"><span><b>${esc(b.t)}</b><em>Conoce más aquí</em></span></summary><p>${esc(b.d)}</p></details>`).join('')}</div></section>`; },
    accesos: () => { const qs = h.accesos.map(a => ({ a, u: resolveLink(a.enlace) })).filter(x => x.u); if (!qs.length) return '';
      return `<section class="k-sec">${kTtl('Servicios en línea para ti')}<div class="wrap"><div class="k-car">${car(qs.map(({ a, u }, k) => `<a class="k-lay k-lay-s" ${linkAttrs(u)} style="--kt:${K_TONOS[k % 4]}"><span class="k-lay-p k-lay-i">${ic(a.icono)}</span><span class="k-lay-l"><span class="k-lay-n"><b>${esc(a.titulo)}</b></span><em>${esc(a.texto || 'Ingresar')} ›</em></span></a>`), 'Servicios en línea')}</div></div></section>`; },
    eventos: () => { const ev = P('eventos').filter(e => isPub(e) && new Date(e.fecha) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 3); if (!ev.length) return '';
      return `<section class="k-sec k-gray"><div class="wrap"><h2 class="k-ttl k-left"><small>Nuestros</small>Próximos eventos</h2><div class="k-ev">${ev.map(e => { const d = new Date(e.fecha); return `<article><img src="${img(e.imagen, 'ph:campus:2')}" alt="" loading="lazy"><h3>${esc(e.titulo)}</h3><p>${ic('calendar')}${fdate(e.fecha)}</p><p>${ic('clock')}${pad(d.getHours())}:${pad(d.getMinutes())} h</p>${e.lugar ? `<p>${ic('map')}${esc(e.lugar)}</p>` : ''}<a class="k-pill k-pill-d" href="#/eventos">Más información ❯</a></article>`; }).join('')}</div>
        <a class="k-wide" href="#/eventos">Ver todos los eventos aquí ❯</a></div></section>`; },
    noticias: () => { const ns = pubNews().slice(0, newsCount()); return `<section class="k-sec">${kTtl('Noticias para tu éxito')}<div class="wrap">${ns.length ? newsWrap(ns.map(n => `<article class="k-nc"><img src="${img(n.imagen, 'ph:campus:4')}" data-fit="${newsImageFit(n)}" alt="" loading="lazy"><div><time datetime="${esc(n.fecha)}">${fdate(n.fecha)}</time><h3><a href="#/noticias/${esc(n.slug)}">${esc(n.titulo)}</a></h3><span class="k-cat">${esc((P('categoriasNoticia').find(c => c.id === n.categoriaId) || {}).nombre || 'Noticias')}</span></div></article>`), h2 => `<div class="k-news">${h2}</div>`, 'tarjetas', 'k-ncar') : emptyMsg('noticias')}<a class="k-wide" href="#/noticias">Más noticias ❯</a></div></section>`; },
    bienvenida: () => { const pr = page('presentacion'); if (!pr || !isPub(pr)) return ''; const tx = pr.contenido.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return `<section class="k-promo"><div class="wrap k-2"><div><h2 class="k-ttl k-left k-big">Mensaje de la Dirección General</h2><p class="k-lead">${esc(fullName(dir))}</p><p class="k-acc">${esc(dirJ.cargo || 'Dirección General')}</p><p>${esc(clamp(tx, 260))}</p><a class="k-pill" href="#/nosotros/presentacion">Más información ❯</a></div>
        <div class="k-circles" aria-hidden="true"><i class="k-ring r1"></i><i class="k-ring r2"></i><i class="k-dot"></i><span class="k-c1"><img src="${img(dir && dir.foto)}" alt=""></span><span class="k-c2"><img src="${img(loc && loc.foto || pics[0])}" alt=""></span><span class="k-tag">${esc(i.lema || i.slogan || i.nombreCorto)}</span></div></div></section>`; },
    cifras: () => { const cs = h.cifras.filter(x => String(cifra(x.valor)).trim()); if (!cs.length) return '';
      return `<section class="k-nums" aria-label="Cifras institucionales"><div class="wrap k-ng">${cs.map(x => `<div class="cif${cifLink(x) ? ' cif-a' : ''}"><b>${cifNum(cifra(x.valor))}</b><span>${esc(x.label)}</span><small>Corte ${esc(x.corte)}</small>${cifA(x)}</div>`).join('')}</div></section>`; },
    jerarquica: () => { const js = sortO(P('jerarquica').filter(isPub)).map(j => ({ j, p: persona(j.personaId) })).filter(x => x.p); if (!js.length) return '';
      return `<section class="k-sec">${kTtl('Nuestro equipo directivo')}<div class="wrap"><div class="k-car">${car(js.map(({ j, p }, k) => lay('#/nosotros/plana-jerarquica', p.foto, 'user', fullName(p), k, j.cargo)), 'Plana jerárquica')}</div></div></section>`; },
    testimonios: () => { const es = P('egresados').filter(isPub).slice(0, 3); if (!es.length) return '';
      return `<section class="k-sec k-gray">${kTtl('Lo que dicen nuestros egresados')}<div class="wrap k-news">${es.map(e => `<figure class="k-nc k-q"><img src="${img(e.foto)}" alt="" loading="lazy"><figcaption><q>${esc(clamp(e.testimonio || '', 160))}</q><b>${esc(e.nombres)}</b><span class="k-cat">${esc((progById(e.programaId) || {}).nombre || '')}</span></figcaption></figure>`).join('')}</div></section>`; },
    enlaces: () => { const all = coll('enlaces').filter(l => !l.deleted && ext(l.id)); let ls = all.filter(l => l.grupo === 'minedu'); if (!ls.length) ls = all.filter(l => l.grupo === 'Institucional' && l.id !== 'web'); if (!ls.length) return '';
      return `<section class="k-sec k-gray">${kTtl('Plataformas del Estado')}<div class="wrap k-logos">${ls.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><b>${esc((l.id.length <= 10 ? l.id : l.nombre.split(/\s+/)[0]).toUpperCase())}</b><small>${esc(l.nombre)}</small><span class="sr-only"> (se abre en una pestaña nueva)</span></a>`).join('')}</div></section>`; },
  });
}
function bannerHTML(b, slim = false) {
  /* En los servicios en línea (formularios) el banner es bajo para que el formulario quede a la vista. */
  /* Sin fotografía propia (solo el logo) el banner es liso, con el sello institucional a la derecha. */
  const photo = b.img || (DB.locales || []).find(l => isPub(l))?.foto;
  const hasPhoto = photo && photo !== inst().logo;
  return `<section class="page-banner${slim ? ' slim' : ''}${hasPhoto ? '' : ' banner-plain'}" aria-label="Banner de la sección">${hasPhoto ? `<img class="bg" src="${img(photo)}" alt="" decoding="async">` : ''}<div class="wrap">${b.kicker ? `<div class="kicker">${esc(b.kicker)}</div>` : ''}<p class="ttl" aria-hidden="true">${esc(b.title)}</p>${b.text ? `<p>${esc(b.text)}</p>` : ''}${!hasPhoto ? `<img class="section-seal" src="${logoSrc()}" alt="" aria-hidden="true">` : ''}</div></section>`;
}
function crumbsHTML(cr) {
  return `<nav class="crumbs" aria-label="Ruta de navegación"><div class="wrap"><ol><li><a href="#/">${ic('home').replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px;stroke:currentColor;fill:none;stroke-width:2"')} Inicio</a></li>${cr.map((c, i) => i === cr.length - 1 ? `<li aria-current="page">${esc(c[0])}</li>` : `<li><a href="${c[1]}">${esc(c[0])}</a></li>`).join('')}</ol></div></nav>`;
}
function nosotrosSide(active) {
  const items = [['presentacion', 'Presentación'], ['resena-historica', 'Reseña Histórica'], ['mision-vision', 'Misión, Visión y Valores'], ['organizacion', 'Organización Institucional'], ['reconocimientos', 'Reconocimientos'], ['plana-jerarquica', 'Plana Jerárquica'], ['plana-docente', 'Plana Docente'], ['campus-e-informes', 'Campus e Informes']];
  return `<nav class="side-box" aria-label="Sección Nosotros"><h2>${ic('users').replace('<svg', '<svg style="width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2"')} Nosotros</h2><ul>${items.map(([s, l]) => `<li><a href="#/nosotros/${s}" ${s === active ? 'aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul></nav>`;
}
function sideLinks() {
  const ls = [['Biblioteca Virtual', ext('biblioteca')], ['Correo Institucional', ext('correo')], ['Avanza MINEDU', ext('avanza')], ['Conecta MINEDU', ext('conecta')], ['Registra MINEDU', ext('registra')], ['Titula MINEDU', ext('titula')]].filter(x => x[1]);
  return `<section class="side-box"><h2>Enlaces de interés</h2><ul>${ls.map(([l, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${l}<span class="sr-only"> (enlace externo)</span></a></li>`).join('')}</ul></section>`;
}
function sideContact() {
  const i = inst();
  return `<section class="side-box"><h2>Contacto</h2><address class="pad" style="font-style:normal;display:grid;gap:6px"><span>${ic('mail').replace('<svg', '<svg style="width:15px;height:15px;stroke:var(--link);fill:none;stroke-width:2;vertical-align:-2px"')} <a href="mailto:${esc(i.correo)}">${esc(i.correo)}</a></span><span>📞 ${esc(i.telefono)} (${esc(i.telefonoNota)})</span><span>📍 ${esc(i.direccion)}</span></address></section>`;
}
function sidePromo(t, q) { return `<div class="promo">${t ? `<strong>${esc(t)}</strong>` : ''}${q ? `<blockquote>“${esc(q)}”</blockquote>` : ''}</div>`; }

/* ---------- SEO dinámico ---------- */
function setSEO({ title, desc, crumbs = [], jsonld = [] }) {
  const s = DB.config.seo;
  document.title = title ? `${title} | ${inst().nombreCorto}` : s.titulo;
  const setMeta = (sel, attr, val) => { let m = document.head.querySelector(sel); if (!m) { m = document.createElement('meta'); const [k, v] = sel.replace(/[\[\]"]/g, '').replace('meta', '').split('='); m.setAttribute(k, v); document.head.appendChild(m); } m.setAttribute(attr, val); };
  setMeta('meta[name="description"]', 'content', desc || s.descripcion);
  setMeta('meta[property="og:title"]', 'content', document.title);
  setMeta('meta[property="og:description"]', 'content', desc || s.descripcion);
  const org = { '@context': 'https://schema.org', '@type': 'EducationalOrganization', name: inst().nombre, alternateName: inst().nombreCorto, foundingDate: inst().fechaCreacion, email: inst().correo, telephone: inst().telefono, address: { '@type': 'PostalAddress', streetAddress: inst().direccion, addressLocality: [inst().distrito, inst().region].filter(Boolean).join(', ') || undefined, addressRegion: inst().region || undefined, addressCountry: 'PE' }, sameAs: Object.values(DB.config.redes).filter(Boolean) };
  const bc = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: location.origin + location.pathname + '#/' }].concat(crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 2, name: c[0], item: c[1] ? location.origin + location.pathname + c[1] : undefined }))) };
  let el = document.getElementById('jsonld'); if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'jsonld'; document.head.appendChild(el); }
  el.textContent = JSON.stringify([org, bc].concat(jsonld));
}

/* ---------- Marco de página ---------- */
function shell(path, { title, desc, crumbs = [], banner, side = null, body, layout = 'right', jsonld }) {
  setSEO({ title, desc, crumbs, jsonld });
  const main = `<div class="content">${body}</div>`;
  const cls = side === null ? 'full' : layout === 'left' ? 'left' : '';
  return `${headerHTML(path)}${banner ? bannerHTML(banner, /^servicios\//.test(Array.isArray(path) ? path.join('/') : String(path || ''))) : ''}${crumbs.length ? crumbsHTML(crumbs) : ''}<main id="contenido" tabindex="-1"><div class="wrap layout ${cls}" style="padding-left:16px;padding-right:16px">${layout === 'left' && side !== null ? `<aside>${side}</aside>${main}` : main + (side !== null ? `<aside aria-label="Información complementaria">${side}</aside>` : '')}</div></main>${footerHTML()}`;
}
const emptyMsg = (what = 'registros') => `<div class="empty" role="status">Sin ${what} publicados al ${fshort(new Date())}.</div>`;

/* =================== PÁGINAS =================== */
const ROUTES = {};
function R(pattern, fn) { ROUTES[pattern] = fn; }

/* ---------- INICIO ---------- */
R('', path => {
  const c = DB.config, h = c.home; const i = inst();
  setSEO({ title: '', desc: c.seo.descripcion });
  const blocks = {
    slider: () => { const sl = sortO(P('slides').filter(isPub)); if (!sl.length) return ''; return `<section class="hero" aria-roledescription="carrusel" aria-label="Destacados">${sl.map((s, k) => {
      // «Solo imagen»: afiche con su propio texto (sin título, texto ni oscurecido). Ajuste '' = automático según la forma de la imagen.
      const solo = s.modo === 'imagen', aj = solo ? 'contain' : (s.ajuste || 'auto'), fit = aj === 'contain'; const pos = { left: '0% 50%', right: '100% 50%', top: '50% 0%', bottom: '50% 100%' }[s.enfoque] || '50% 50%'; const st = `style="object-position:${pos}"`;
      const src = () => k ? `data-src="${img(s.imagen)}"` : `src="${img(s.imagen)}"`;
      const alt = solo ? esc(s.titulo) : '';
      const im = cls => k ? `<img class="${cls}" data-src="${img(s.imagen)}" alt="${alt}" decoding="async" ${st}>` : `<img class="${cls}" src="${img(s.imagen)}" alt="${alt}" fetchpriority="high" ${st}>`;
      const link = resolveLink(s.enlace);
      const cap = solo ? (link ? `<a class="sl-link" ${linkAttrs(link)} aria-label="${esc(s.titulo)}"></a>` : '') : `<div class="cap"><div class="wrap"><span class="hero-kicker">${ic('grad')} ${esc(inst().nombreCorto)}</span><h2>${esc(s.titulo)}</h2><p>${esc(s.texto)}</p>${s.boton && link ? `<a class="btn gold" ${linkAttrs(link)}>${esc(s.boton)} ${ic('arrow').replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"')}</a>` : ''}</div></div>`;
      return `<div class="slide ${k ? '' : 'on'}${fit ? ' sl-contain' : ''}${aj === 'auto' ? ' sl-auto' : ''}${solo ? ' sl-solo' : ''}${s.capa ? ' capa-' + esc(s.capa) : ''}${s.realce === 'no' ? '' : ' sl-realce'}" role="group" aria-roledescription="diapositiva" aria-label="${k + 1} de ${sl.length}">${fit || aj === 'auto' ? `<img class="sl-blur" ${src()} alt="" aria-hidden="true">` : ''}${im('sl-img')}${cap}</div>`; }).join('')}${sl.length > 1 ? `<button class="hero-arrow l" data-sl="-1" aria-label="Diapositiva anterior">‹</button><button class="hero-arrow r" data-sl="1" aria-label="Diapositiva siguiente">›</button><div class="hero-dots">${sl.map((_, k) => `<button data-dot="${k}" aria-label="Ir a diapositiva ${k + 1}" aria-current="${k === 0}"></button>`).join('')}</div>` : ''}</section>`; },
    accesos: () => { const qs = h.accesos.map(a => { const u = resolveLink(a.enlace); return u ? `<a ${linkAttrs(u)}><span class="ic">${ic(a.icono)}</span><span><strong>${esc(a.titulo)}</strong><small>${esc(a.texto)}</small></span></a>` : ''; }).filter(Boolean); return `<section class="wrap quick" aria-label="Accesos rápidos"><div class="grid ${qs.length > 4 ? 'g3 q-many' : 'g4'}">${qs.join('')}</div></section>`; },
    bienvenida: () => { const pr = page('presentacion'); const dir = persona((P('jerarquica').find(j => j.esDirector) || {}).personaId); if (!pr || !isPub(pr)) return ''; const ps = (pr.contenido.match(/<p>[\s\S]*?<\/p>/g) || []).slice(0, 2).join(''); return `<section class="sec"><div class="wrap welcome"><img src="${img(dir && dir.foto)}" alt="Fotografía de ${esc(fullName(dir))}" loading="lazy"><div><div class="sec-h" style="text-align:left;margin:0 0 10px"><span class="kicker">Bienvenida</span><h2>Mensaje de la Dirección General</h2></div><div class="prose">${sanitize(ps)}</div><p><strong>${esc(fullName(dir))}</strong><br><span style="color:var(--muted)">${esc((P('jerarquica').find(j => j.esDirector) || {}).cargo || '')}</span></p><a class="btn" href="#/nosotros/presentacion">Leer presentación completa</a></div></div></section>`; },
    cifras: () => `<section class="sec stats" aria-label="Cifras institucionales"><div class="wrap grid g4 stats-n${Math.min(h.cifras.length, 4)}">${h.cifras.map((x, k) => `<div class="stat cif${cifLink(x) ? ' cif-a' : ''}"><span class="st-ic">${ic(['calendar', 'grad', 'users', 'award', 'star', 'building'][k % 6])}</span><b>${cifNum(cifra(x.valor))}</b><span>${esc(x.label)}</span><small>Corte: ${esc(x.corte)}</small>${cifA(x)}</div>`).join('')}</div></section>`,
    programas: () => `<section class="sec alt"><div class="wrap"><div class="sec-h"><span class="kicker">Oferta formativa</span><h2>Programas de estudio</h2><p>Formación profesional técnica de 3 años con título a nombre de la Nación.</p></div>${progList(progs())}</div></section>`,
    noticias: () => { const ns = pubNews().slice(0, newsCount('tarjetas', 6)); return `<section class="sec"><div class="wrap"><div class="sec-h"><span class="kicker">Actualidad</span><h2>Noticias recientes</h2></div>${ns.length ? `${newsWrap(ns.map(newsCard), h => `<div class="grid g3">${h}</div>`)}<p style="text-align:center;margin-top:22px"><a class="btn sec" href="#/noticias">Ver todas las noticias</a></p>` : emptyMsg('noticias')}</div></section>`; },
    beneficios: () => `<section class="sec alt"><div class="wrap"><div class="sec-h"><span class="kicker">Ventajas</span><h2>¿Por qué estudiar en el ${esc(i.nombreCorto)}?</h2></div><div class="grid g4">${h.beneficios.slice(0, 8).map(b => `<div class="card benefit"><span class="ic">${ic(b.i)}</span><div><h3>${esc(b.t)}</h3><p>${esc(b.d)}</p></div></div>`).join('')}</div></div></section>`,
    jerarquica: () => { const js = sortO(P('jerarquica').filter(isPub)).map(j => ({ j, p: persona(j.personaId) })).filter(x => x.p); return js.length ? `<section class="sec"><div class="wrap"><div class="sec-h"><span class="kicker">Equipo directivo</span><h2>Plana jerárquica</h2></div><div class="people-strip">${js.slice(0, 6).map(({ j, p }) => `<div class="person"><img src="${img(p.foto)}" alt="Fotografía de ${esc(fullName(p))}" loading="lazy"><strong>${esc(fullName(p))}</strong><small>${esc(j.cargo)}</small></div>`).join('')}</div><p style="text-align:center;margin-top:18px"><a class="btn sec" href="#/nosotros/plana-jerarquica">Conocer al equipo</a></p></div></section>` : ''; },
    testimonios: () => { const es = P('egresados').filter(isPub).slice(0, 3); return es.length ? `<section class="sec alt"><div class="wrap"><div class="sec-h"><span class="kicker">Egresados</span><h2>Lo que dicen nuestros egresados</h2></div><div class="grid g3">${es.map(e => `<figure class="card testi"><blockquote>“${esc(e.testimonio)}”</blockquote><figcaption class="who"><img src="${img(e.foto)}" alt="" loading="lazy"><div><strong>${esc(e.nombres)}</strong><br><small>${esc((progById(e.programaId) || {}).nombre || '')} · Promoción ${esc(e.anio)}</small></div></figcaption></figure>`).join('')}</div></div></section>` : ''; },
    eventos: () => { const ev = P('eventos').filter(e => isPub(e) && new Date(e.fecha) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(0, 3); return ev.length ? `<section class="sec"><div class="wrap"><div class="sec-h"><span class="kicker">Agenda</span><h2>Próximos eventos</h2></div><div class="grid g3">${ev.map(eventCard).join('')}</div><p style="text-align:center;margin-top:18px"><a class="btn sec" href="#/eventos">Ver agenda completa</a></p></div></section>` : ''; },
    enlaces: () => `<section class="sec alt"><div class="wrap"><div class="sec-h"><span class="kicker">Plataformas del Estado</span><h2>Enlaces institucionales</h2></div>${mineduLinks()}</div></section>`,
  };
  const B = isUni() ? uniBlocks(blocks, h, i) : isImp() ? impBlocks(blocks, h, i) : isHor() ? horBlocks(blocks, h, i) : isCam() ? camBlocks(blocks, h, i) : blocks;
  // «Horizonte»: el panel de oferta formativa va sobre la portada, como en el diseño de referencia; el resto conserva el orden configurado.
  let order = h.bloques; if (isHor()) { const pr = order.find(b => b.k === 'programas' && b.on); if (pr && order.some(b => b.k === 'slider' && b.on)) { order = order.filter(b => b !== pr); order.splice(order.findIndex(b => b.k === 'slider') + 1, 0, pr); } }
  const body = order.filter(b => b.on && B[b.k]).map(b => B[b.k]()).join('');
  const admission = admVigente();
  const announcement = admission ? `<p class="home-announcement">Admisión ${esc(admission.anio)} · ${esc(admission.subtitulo || 'Consulta nuestros programas de estudio')}</p>` : '';
  return `${announcement}${headerHTML(path)}<main id="contenido" tabindex="-1"><h1 class="sr-only">${esc(inst().nombre)} – Portal institucional</h1>${body}</main>${footerHTML()}`;
});
/* Cifras interactivas: número que cuenta al aparecer, enlace a su página y texto completo para lectores de pantalla */
function cifLink(x) {
  const e = String(x.enlace || '').trim(); if (e) return resolveLink(e) || '';
  const v = String(x.valor || ''), l = String(x.label || '').toLowerCase();
  if (v === 'auto:anios' || /a[ñn]os|creaci|fundaci|historia/.test(l)) return '#/nosotros/resena-historica';
  if (v === 'auto:programas' || /programa|carrera/.test(l)) return '#/programas';
  if (/estudiante|alumno|postulante|ingresante|vacante|admisi/.test(l)) return '#/admision';
  if (/matricul/.test(l)) return '#/matricula';
  if (v === 'auto:egresados' || v === 'auto:titulados' || /egresad|titulad|docente|estad/.test(l)) return '#/transparencia/estadisticas';
  return '';
}
function cifNum(v) {
  const t = String(v); const m = t.match(/^(\D*?)(\d[\d.,\s]*\d|\d)(\D*)$/);
  if (!m) return esc(t);
  const raw = m[2]; if (!/^\d{1,3}(?:([.,\s])\d{3}(?:\1\d{3})*)?$/.test(raw) && !/^\d+$/.test(raw)) return esc(t);
  const sep = (raw.match(/[.,\s](?=\d{3}(?:\D|$))/) || [''])[0]; const n = +raw.replace(/[.,\s]/g, '');
  if (!isFinite(n)) return esc(t);
  const from = /^(19|20)\d{2}$/.test(raw) ? n - 40 : 0;
  return `<span class="sr-only">${esc(t)}</span><span class="cif-n" aria-hidden="true" data-count="${n}" data-from="${from}" data-pre="${esc(m[1])}" data-suf="${esc(m[3])}" data-sep="${esc(sep)}" style="min-width:${t.length}ch">${esc(t)}</span>`;
}
const cifA = (x, extra = '') => { const u = cifLink(x); return u ? `<a class="cif-link" ${linkAttrs(u)} aria-label="${esc(cifra(x.valor) + ' ' + x.label)}: ver más${extra}"></a>` : ''; };
function cifInit(root = document) {
  const els = $$('.cif-n:not([data-cif])', root); if (!els.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || PREVIEW;
  const fmt = (el, n) => { let s = String(Math.round(n)); if (el.dataset.sep) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, el.dataset.sep); return el.dataset.pre + s + el.dataset.suf; };
  const run = (el, delay) => { const to = +el.dataset.count, from = +el.dataset.from, box = el.closest('.cif'); if (reduce) { el.textContent = fmt(el, to); box && box.classList.add('cif-done'); return; }
    el.textContent = fmt(el, from); setTimeout(() => { const t0 = performance.now(), d = 1500; const step = now => { const k = Math.min(1, (now - t0) / d); el.textContent = fmt(el, from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); else { el.textContent = fmt(el, to); box && box.classList.add('cif-done'); } }; requestAnimationFrame(step); }, delay); };
  els.forEach(el => { el.dataset.cif = '1'; if (!reduce) el.textContent = fmt(el, +el.dataset.from); });
  if (!('IntersectionObserver' in window)) { els.forEach((el, k) => run(el, k * 150)); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); const grp = $$('.cif-n', e.target.closest('section') || document); run(e.target, Math.max(0, grp.indexOf(e.target)) * 150); }), { threshold: .4 });
  els.forEach(el => io.observe(el));
}
function cifra(v) {
  if (!String(v).startsWith('auto:')) return v;
  const k = v.slice(5); const st = coll('estadisticas'); const y = Math.max(...st.map(s => s.anio));
  if (k === 'anios') return String(yearNow() - new Date(inst().fechaCreacion).getFullYear());
  if (k === 'programas') return String(progs().length);
  if (k === 'matriculados') return num(st.filter(s => s.anio === y).reduce((a, s) => a + (+s.matriculados || 0), 0));
  if (k === 'egresados') return '+' + num(st.reduce((a, s) => a + (+s.egresados || 0), 0));
  if (k === 'titulados') return num(st.reduce((a, s) => a + (+s.titulados || 0), 0));
  return v;
}
const progCard = p => `<article class="card pcard"><img src="${img(p.imagen)}" alt="" loading="lazy"><div class="cb"><h3><a href="#/programas/${esc(p.slug)}" style="color:inherit;text-decoration:none">${esc(p.nombre)}</a></h3><p>${esc(p.resumen)}</p><a class="more" href="#/programas/${esc(p.slug)}" aria-label="Ver programa ${esc(p.nombre)}">Ver programa →</a></div></article>`;
const progView = () => DB.config.home.programasVista === 'grid' ? 'grid' : 'carrusel';
const progList = ps => progView() === 'carrusel' && ps.length > 1
  ? `<div class="pcar" data-pcar><button type="button" class="pcar-b prev" data-pcar-b="-1" aria-label="Programas anteriores">‹</button><div class="pcar-t" tabindex="0" role="region" aria-label="Programas de estudio (desplázate para ver más)">${ps.map(p => `<div class="pcar-i">${progCard(p)}</div>`).join('')}</div><button type="button" class="pcar-b next" data-pcar-b="1" aria-label="Programas siguientes">›</button></div>`
  : `<div class="grid g4">${ps.map(progCard).join('')}</div>`;
/* Noticias de la portada: «tarjetas» (cuadrícula) o «carrusel»; vacío = lo propio de cada diseño */
const newsView = (def = 'tarjetas') => ['tarjetas', 'carrusel'].includes(DB.config.home.noticiasVista) ? DB.config.home.noticiasVista : def;
const newsCount = (def = 'tarjetas', grid = 3) => newsView(def) === 'carrusel' ? 9 : grid;
const newsWrap = (cards, gridHTML, def = 'tarjetas', cls = '') => newsView(def) === 'carrusel' && cards.length > 1
  ? `<div class="pcar pcar-news ${cls}" data-pcar><button type="button" class="pcar-b prev" data-pcar-b="-1" aria-label="Noticias anteriores">‹</button><div class="pcar-t" tabindex="0" role="region" aria-label="Noticias (desplázate para ver más)">${cards.map(c => `<div class="pcar-i">${c}</div>`).join('')}</div><button type="button" class="pcar-b next" data-pcar-b="1" aria-label="Noticias siguientes">›</button></div>`
  : gridHTML(cards.join(''));
const NEWS_FOTOS = ['imagen', 'foto2', 'foto3', 'foto4', 'foto5'];
const newsFotos = n => NEWS_FOTOS.map(k => n[k]).filter(Boolean);
const newsImageFit = n => ['cover','contain'].includes(n.imagenAjuste) ? n.imagenAjuste : /(?:logo|cuadro|resultado|comunicado)/i.test(n.imagen || '') ? 'contain' : 'cover';
const newsCard = n => `<article class="card ncard"><div class="img"><img src="${img(n.imagen, 'ph:campus:4')}" data-fit="${newsImageFit(n)}" alt="${esc(n.titulo)}" loading="lazy" decoding="async" width="640" height="400">${n.destacada ? '<span class="badge">Destacado</span>' : ''}${newsFotos(n).length > 1 ? `<span class="badge nfotos">${ic('image')} ${newsFotos(n).length} fotos</span>` : ''}</div><div class="cb"><div class="meta"><time datetime="${esc(n.fecha)}">${fdate(n.fecha)}</time><span class="badge">${esc(catName(n.categoriaId))}</span></div><h3><a href="#/noticias/${esc(n.slug)}">${esc(n.titulo)}</a></h3><p>${esc(clamp(n.resumen, 140))}</p><a class="more" href="#/noticias/${esc(n.slug)}" aria-label="Ver más: ${esc(n.titulo)}">Ver más →</a></div></article>`;
const eventCard = e => { const d = new Date(e.fecha); return `<article class="card event"><div class="d"><b>${d.getDate()}</b><small>${MES3[d.getMonth()]} ${d.getFullYear()}</small></div><div><h3>${esc(e.titulo)}</h3><p><time datetime="${esc(e.fecha)}">${pad(d.getHours())}:${pad(d.getMinutes())} h</time> · ${esc(e.lugar)}</p><p>${esc(e.descripcion)}</p></div></article>`; };
function mineduLinks() {
  return `<div class="minedu-links">${coll('enlaces').filter(l => l.grupo === 'minedu' && ext(l.id)).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span class="lg" style="background:${esc(l.color || '#1556b8')}">${esc(l.nombre.split(' ')[0].slice(0, 3).toUpperCase())}</span><span>${esc(l.nombre)}<span class="sr-only"> (se abre en una pestaña nueva)</span></span></a>`).join('')}</div>`;
}

let printExpandedDetails = [];
window.addEventListener('beforeprint', () => {
  if (printExpandedDetails.length) return;
  printExpandedDetails = [...document.querySelectorAll('main .content-expander, main details.mod')].filter(node => !node.open);
  printExpandedDetails.forEach(node => { node.open = true; });
});
window.addEventListener('afterprint', () => { printExpandedDetails.forEach(node => { node.open = false; }); printExpandedDetails = []; });
function expansionSummary(closed, opened) { return `<span><span class="when-closed">${esc(closed)}</span><span class="when-open">${esc(opened)}</span></span>`; }
function readableCopy(content, kind = '') {
  const node = document.createElement('div'); node.innerHTML = sanitize(content);
  if (kind === 'resena') node.querySelectorAll('ul').forEach(list => list.classList.add('institution-timeline'));
  if (kind === 'presentacion' && node.children.length > 4 && node.textContent.length > 900) {
    const blocks = [...node.children];
    return `<div class="prose readable-copy">${blocks.slice(0, 3).map(n => n.outerHTML).join('')}<details class="content-expander" data-reading-expander><summary>${expansionSummary('Leer el mensaje completo de la Dirección', 'Cerrar el mensaje completo')}</summary><div class="expander-body">${blocks.slice(3).map(n => n.outerHTML).join('')}</div></details></div>`;
  }
  return `<div class="prose readable-copy">${node.innerHTML}</div>`;
}
function programTeacher(d) { return `<article class="card tcard"><img src="${img(d.foto)}" alt="Fotografía de ${esc(fullName(d))}" loading="lazy"><div class="cb"><strong>${esc(fullName(d))}</strong><small>${esc(d.especialidad)}</small><button class="btn xs sec" data-prof="${d.id}">Ver perfil</button></div></article>`; }
function programTeachers(teachers) {
  const cards = rows => `<div class="grid g4">${rows.map(programTeacher).join('')}</div>`;
  if (teachers.length <= 4) return cards(teachers);
  return `<div class="teacher-preview">${cards(teachers.slice(0,4))}<details class="content-expander" data-teacher-expander><summary>${expansionSummary(`Ver el equipo docente completo (${teachers.length})`, 'Mostrar solo los primeros docentes')}</summary><div class="expander-body">${cards(teachers.slice(4))}</div></details></div>`;
}

/* ---------- NOSOTROS ---------- */
function richPage(path, clave, slug, crumb, extraBody = '', bannerText = 'Conoce nuestra identidad, historia y el compromiso con la formación técnica.', formatContent = null) {
  const p = page(clave);
  if (!p || !isPub(p)) return notFound(path);
  const body = `<article class="${['mision','organizacion'].includes(clave) ? 'institution-page' : ''}"><h1>${esc(p.titulo)}</h1>${p.imagen ? `<figure class="figure float-img"><img src="${img(p.imagen)}" alt="Imagen institucional: ${esc(p.titulo)}"><figcaption>${esc(inst().nombreCorto)}</figcaption></figure>` : ''}<div class="prose">${formatContent ? formatContent(p.contenido) : sanitize(p.contenido)}</div><div class="clear"></div>${p.mensaje ? `<blockquote class="quote">“${esc(p.mensaje)}”<br><small>— ${esc(inst().nombreCorto)}</small></blockquote>` : ''}${extraBody}<p style="font-size:12.5px;color:var(--muted);margin-top:18px">Última actualización: <time datetime="${esc(p.modEn)}">${fdate(p.modEn)}</time></p></article>`;
  return shell(path, { title: p.titulo, desc: clamp(stripTags(p.contenido), 155), crumbs: [['Nosotros', '#/nosotros/presentacion'], [p.titulo]], banner: { title: 'Nosotros', text: bannerText }, side: nosotrosSide(slug) + sidePromo('Formación técnica para un mejor futuro') + sideLinks(), body });
}
R('paginas/:slug', (path, q, prm) => {
  const p = P('paginas').find(row => row.slug === prm.slug && isPub(row));
  if (!p) return notFound(path);
  return shell(path, {title:p.titulo, desc:clamp(stripTags(p.contenido),155), crumbs:[[p.titulo]], side:null,
    body:`<article class="prose"><h1>${esc(p.titulo)}</h1>${p.imagen ? `<figure class="figure"><img src="${img(p.imagen)}" alt="${esc(p.titulo)}" loading="lazy"></figure>` : ''}${sanitize(p.contenido)}${p.mensaje ? `<p class="notice">${esc(p.mensaje)}</p>` : ''}</article>`});
});
R('nosotros', p => richPage(p, 'presentacion', 'presentacion'));
R('nosotros/presentacion', p => richPage(p, 'presentacion', 'presentacion'));
R('nosotros/resena-historica', p => richPage(p, 'resena', 'resena-historica'));
function missionContent(content) {
  const safe = sanitize(content);
  if (/class="[^"]*pz-mv/.test(safe)) return safe;
  const doc = new DOMParser().parseFromString(safe, 'text/html');
  const nodes = [...doc.body.children];
  const key = n => (n.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[:.]+$/,'').trim();
  const mi = nodes.findIndex(n => key(n)==='mision'), vi = nodes.findIndex(n => key(n)==='vision'), va = nodes.findIndex(n => key(n)==='valores institucionales'||key(n)==='valores');
  if (mi<0 || vi<=mi || va<=vi) return safe;
  const html = rows => rows.map(n=>n.outerHTML).join('');
  const labels = /^(responsabilidad|integridad|honestidad|emprendimiento|respeto|confianza|puntualidad|solidaridad|tolerancia|justicia|mejora continua|empatia)$/;
  const values=[], intro=[], notes=[]; let current=null;
  for (const n of nodes.slice(va+1)) {
    if (/^la vision se transcribe|^fuente:/.test(key(n))) {notes.push(n);continue;}
    if (labels.test(key(n))) {current={title:n.textContent.replace(/[:.]+$/,'').trim(),body:[]};values.push(current);}
    else if(current) current.body.push(n); else intro.push(n);
  }
  return `<div class="pz-mv"><section class="pz-mvc"><h2>Misión</h2>${html(nodes.slice(mi+1,vi))}</section><section class="pz-mvc pz-vis"><h2>Visión</h2>${html(nodes.slice(vi+1,va))}</section></div><h2 class="pz-vh">Valores institucionales</h2>${html(intro)}${values.length?`<div class="pz-vals">${values.map((v,i)=>`<section class="pz-val"><span class="pz-vn" aria-hidden="true">${pad(i+1)}</span><h3>${esc(v.title)}</h3>${html(v.body).replace(/(<p[^>]*>)\s*:\s*/g,'$1')}</section>`).join('')}</div>`:''}${html(notes)}`;
}
R('nosotros/mision-vision', p => richPage(p, 'mision', 'mision-vision', null, '', undefined, missionContent));
R('nosotros/organizacion', p => {
  const entries = sortO(P('jerarquica').filter(isPub));
  const directors = entries.filter(j=>j.esDirector), units = entries.filter(j=>!j.esDirector);
  const holder = j => {const pe=persona(j.personaId);return pe?esc(fullName(pe)):'Responsable por confirmar';};
  const org = `<section class="org-section" aria-labelledby="org-heading"><h2 id="org-heading">Estructura institucional</h2>${directors.map(j=>`<section class="org-lead"><h3>${esc(j.cargo||'Dirección General')}</h3><p>${holder(j)}</p></section>`).join('')}<div class="org-units">${units.map(j=>`<section class="org-unit"><h3>${esc(j.unidad||j.cargo)}</h3><p>${holder(j)}</p>${j.unidad&&j.unidad!==j.cargo?`<small>${esc(j.cargo)}</small>`:''}</section>`).join('')}</div><p class="pz-src">Responsables según la plana jerárquica publicada. <a href="#/nosotros/plana-jerarquica">Consultar el directorio institucional</a>.</p></section><section class="org-section"><h2>Programas de estudio</h2><div class="org-programs">${progs().map(pp=>`<a href="#/programas/${esc(pp.slug)}">${esc(pp.nombre)}</a>`).join('')}</div></section>`;
  const format = content => {
    const safe=sanitize(content);
    if (page('organizacion')?.modPor !== 'importacion-pisco' || !/^<p>Plana Jerárquica<\/p>/i.test(safe.trim())) return safe;
    const doc=new DOMParser().parseFromString(safe,'text/html');
    const notes=[...doc.body.children].filter(n=>/^La web no identifica|^Consulta el directorio/.test(n.textContent.trim()));
    return `<p>Conoce las unidades y los responsables que conforman la organización del ${esc(inst().nombreCorto)}.</p>${notes.map(n=>n.outerHTML).join('')}`;
  };
  return richPage(p, 'organizacion', 'organizacion', null, org, undefined, format);
});
R('nosotros/reconocimientos', p => {
  const rs = sortO(P('reconocimientos').filter(isPub)).sort((a, b) => b.anio - a.anio);
  const tl = rs.length ? `<h2>Hitos y logros</h2><div class="timeline">${rs.map(r => `<article class="it"><span class="y">${esc(r.anio)}</span><h3 style="margin:2px 0 4px">${esc(r.titulo)}</h3><p style="margin:0 0 4px">${esc(r.descripcion)}</p>${r.resolucion ? `<small style="color:var(--muted)">${esc(r.resolucion)}</small>` : ''}</article>`).join('')}</div>` : emptyMsg('reconocimientos');
  return richPage(p, 'reconocimientos', 'reconocimientos', null, tl);
});
R('nosotros/plana-jerarquica', path => {
  const pg0 = page('jerarquica'); if (!pg0 || !isPub(pg0)) return notFound(path);
  const js = sortO(P('jerarquica').filter(isPub)).map(j => ({ j, p: persona(j.personaId) })).filter(x => x.p && isPub(x.p) || x.p && x.p.tipo === 'Administrativo');
  const d = js.find(x => x.j.esDirector); const others = js.filter(x => !x.j.esDirector);
  const coords = progs().filter(pp => pp.coordinadorId).map(pp => ({ pp, p: persona(pp.coordinadorId) })).filter(x => x.p);
  const body = `<h1>${esc(pg0.titulo)}</h1><p class="lead">${esc(stripTags(pg0.contenido))}</p>
   ${d ? `<section class="director" aria-label="Dirección General"><img src="${img(d.p.foto)}" alt="Fotografía de ${esc(fullName(d.p))}"><div class="msg"><h2 style="color:#fff;font-size:18px">Mensaje de la Dirección General</h2><blockquote>“${esc(pg0.mensaje)}”</blockquote><strong>${esc(fullName(d.p))}</strong><span>${esc(d.j.cargo)}</span><p style="margin-top:8px"><a href="mailto:${esc(d.p.correo)}" style="color:#cfe0ff">${esc(d.p.correo)}</a></p></div></section>` : ''}
   ${others.length ? `<div class="collage">${others.map(({ j, p }) => `<figure><img src="${img(p.foto)}" alt="Fotografía de ${esc(fullName(p))}" loading="lazy"><figcaption><strong>${esc(fullName(p))}</strong><small>${esc(j.cargo)}</small><small><a href="mailto:${esc(p.correo)}">${esc(p.correo)}</a></small></figcaption></figure>`).join('')}</div>` : emptyMsg('integrantes')}
   ${coords.length ? `<h2>Coordinadores de programas de estudio</h2><div class="collage">${coords.map(({ pp, p }) => `<figure><img src="${img(p.foto)}" alt="Fotografía de ${esc(fullName(p))}" loading="lazy"><figcaption><strong>${esc(fullName(p))}</strong><small>Coordinador(a) de ${esc(pp.nombre)}</small></figcaption></figure>`).join('')}</div>` : ''}`;
  return shell(path, { title: 'Plana Jerárquica', desc: stripTags(pg0.contenido), crumbs: [['Nosotros', '#/nosotros/presentacion'], ['Plana Jerárquica']], banner: { title: 'Nosotros', text: 'Conoce nuestra identidad, historia y el compromiso con la formación técnica.' }, side: nosotrosSide('plana-jerarquica') + sidePromo('Trabajo en equipo para una mejor educación técnica'), body });
});
const CATS = () => progs().map(p => ({ id: p.id, label: p.nombre, icon: p.icono })).concat([{ id: 'emp', label: 'Empleabilidad', icon: 'briefcase' }]);
const docentesDe = cat => sortO(P('personas').filter(p => p.tipo === 'Docente' && isPub(p) && (cat === 'emp' ? p.empleabilidad : (p.programas || []).includes(cat))));
R('nosotros/plana-docente', (path, q) => {
  const pg0 = page('docentes'); if (!pg0 || !isPub(pg0)) return notFound(path);
  const cats = CATS(); const sel = cats.find(c => c.id === q.get('p')) || cats[0];
  const ds = docentesDe(sel.id);
  const body = `<h1>${esc(pg0.titulo)}</h1><p class="lead">${esc(stripTags(pg0.contenido))}</p>
   <div class="cat-tabs" role="group" aria-label="Categorías de docentes">${cats.map(c => `<button data-cat="${c.id}" aria-pressed="${c.id === sel.id}">${ic(c.icon)}<span>${esc(c.label)}</span></button>`).join('')}</div>
   <h2 style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">${esc(sel.label)} <span class="badge">${ds.length} docente(s)</span></h2>
   ${ds.length ? `<div class="grid g4">${ds.map(d => `<article class="card tcard"><img src="${img(d.foto)}" alt="Fotografía de ${esc(fullName(d))}" loading="lazy"><div class="cb"><strong>${esc(fullName(d))}</strong><small>${esc(d.especialidad)}</small><span class="badge ${d.condicion === 'Nombrado' ? 'ok' : 'gray'}" style="align-self:center">Docente ${esc(d.condicion.toLowerCase())}</span><button class="btn sm sec" data-prof="${d.id}">Ver perfil</button></div></article>`).join('')}</div>` : emptyMsg('docentes en esta categoría')}`;
  const html = shell(path, { title: 'Plana Docente' + (sel ? ' - ' + sel.label : ''), desc: stripTags(pg0.contenido), crumbs: [['Nosotros', '#/nosotros/presentacion'], ['Plana Docente']], banner: { title: 'Nosotros', text: 'Conoce nuestra identidad, historia y el compromiso con la formación técnica.' }, side: nosotrosSide('plana-docente') + sidePromo('Docentes que inspiran el talento del futuro', 'La educación no cambia el mundo, cambia a las personas que van a cambiar el mundo. — Paulo Freire'), body });
  return { html, after: () => { $$('[data-cat]').forEach(b => b.onclick = () => go('#/nosotros/plana-docente?p=' + b.dataset.cat)); $$('[data-prof]').forEach(b => b.onclick = () => teacherModal(b.dataset.prof, sel.id)); } };
});
function teacherModal(id, progId) {
  const d = persona(id); if (!d) return;
  const udsAll = (d.uds || []).map(u => { const p = progById(u.programaId); const ud = p && p.modulos.flatMap(m => m.uds).find(x => x.id === u.udId); return ud ? { p, ud } : null; }).filter(Boolean);
  const uds = progId && progId !== 'emp' ? udsAll.filter(x => x.p.id === progId) : udsAll;
  modal({ title: 'Perfil docente', size: 'lg', body: `<div class="profile"><img src="${img(d.foto)}" alt="Fotografía de ${esc(fullName(d))}"><div><h3 style="font-size:20px;margin-bottom:2px">${esc(fullName(d))}</h3><p style="color:var(--ink2);margin-bottom:10px">${esc(d.especialidad)} · Docente ${esc(d.condicion.toLowerCase())}</p><dl class="kv"><dt>Correo institucional</dt><dd><a href="mailto:${esc(d.correo)}">${esc(d.correo)}</a></dd><dt>Programas</dt><dd>${(d.programas || []).map(x => esc((progById(x) || {}).nombre || '')).join('<br>') || '—'}${d.empleabilidad ? '<br>Empleabilidad' : ''}</dd></dl>
    <h4 style="margin-top:16px">Información académica</h4>${(d.academica || []).length ? `<div class="tbl-wrap"><table class="tbl light subtbl"><thead><tr><th>Nivel</th><th>Título / grado</th><th>Institución</th><th>Año</th></tr></thead><tbody>${d.academica.map(a => `<tr><td>${esc(a.nivel)}</td><td>${esc(a.titulo)}</td><td>${esc(a.institucion)}</td><td>${esc(a.anio)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Sin registros.</p>'}
    <h4 style="margin-top:16px">Unidades didácticas que imparte${progId && progId !== 'emp' ? ' en ' + esc((progById(progId) || {}).nombre || '') : ''}</h4>${uds.length ? `<ul>${uds.map(x => `<li>${esc(x.ud.nombre)} <small style="color:var(--muted)">(Semestre ${x.ud.semestre}${progId && progId !== 'emp' ? '' : ' · ' + esc(x.p.nombre)})</small></li>`).join('')}</ul>` : '<p>Sin unidades didácticas asignadas.</p>'}
    ${(d.experiencia || []).length ? `<h4 style="margin-top:16px">Experiencia profesional</h4><ul>${d.experiencia.map(e => `<li>${esc(e.cargo)} — ${esc(e.institucion)} (${e.inicio || e.fin ? esc(e.inicio || 'Fecha no publicada') + ' – ' + esc(e.fin || 'Fecha no publicada') : 'Fechas no publicadas'})</li>`).join('')}</ul>` : ''}
    <p style="font-size:12px;color:var(--muted);margin-top:12px">Por protección de datos personales (Ley N.º 29733) solo se publica el correo institucional.</p></div></div>` });
}
R('nosotros/campus-e-informes', (path, q) => {
  const pg0 = page('campus'); if (!pg0 || !isPub(pg0)) return notFound(path);
  const i = inst(); const locs = sortO(P('locales').filter(isPub)); const L = locs[0] || { lat: i.lat, lng: i.lng, nombre: 'Sede principal', direccion: i.direccion };
  const locationQuery = encodeURIComponent(L.direccion + ', Perú');
  const body = `<h1>${esc(pg0.titulo)}</h1><p class="lead">${esc(stripTags(pg0.contenido))}</p>
   <div class="info-cards"><div>${ic('map')}<span><b>Dirección</b><address style="font-style:normal">${esc(i.direccion)}</address></span></div><div>${ic('phone')}<span><b>Teléfono</b><a href="tel:${esc(i.telefono.replace(/\D/g, ''))}">${esc(i.telefono)}</a> (${esc(i.telefonoNota)})</span></div><div>${ic('mail')}<span><b>Correo institucional</b><a href="mailto:${esc(i.correo)}">${esc(i.correo)}</a></span></div></div>
   <section><h2 style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">Nuestra ubicación <span style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn sm sec" href="https://www.google.com/maps/search/?api=1&query=${locationQuery}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps ${ic('ext').replace('<svg', '<svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"')}</a><a class="btn sm" href="https://www.google.com/maps/dir/?api=1&destination=${locationQuery}" target="_blank" rel="noopener noreferrer">Cómo llegar</a></span></h2>
   <iframe class="map" title="Mapa de ubicación de ${esc(i.nombreCorto)}" loading="lazy" src="https://maps.google.com/maps?q=${locationQuery}&output=embed"></iframe></section>
   ${locs.length > 1 ? `<h2>Locales</h2><div class="grid g2">${locs.map(l => `<article class="card"><img src="${img(l.foto)}" alt="" style="aspect-ratio:16/9;object-fit:cover;border-radius:10px 10px 0 0"><div class="cb"><h3>${esc(l.nombre)}</h3><p>${esc(l.direccion)}<br>${esc(l.telefono)} · ${esc(l.correo)}<br>${esc(l.horario)}</p></div></article>`).join('')}</div>` : ''}
   <section style="margin-top:22px"><h2>${ic('mail').replace('<svg', '<svg style="width:22px;height:22px;stroke:var(--link);fill:none;stroke-width:2;vertical-align:-4px"')} Contáctanos</h2><p>Completa el formulario y te responderemos a la brevedad.</p>${contactForm(q.get('programa'))}</section>`;
  const html = shell(path, { title: 'Campus e Informes', desc: stripTags(pg0.contenido), crumbs: [['Nosotros', '#/nosotros/presentacion'], ['Campus e Informes']], banner: { title: 'Nosotros', text: 'Conoce nuestra identidad, historia y el compromiso con la formación técnica.' }, side: nosotrosSide('campus-e-informes') + `<figure class="side-box" style="margin:0 0 18px"><img src="${img(pg0.imagen || L.foto)}" alt="Campus institucional" style="aspect-ratio:4/3;object-fit:cover"><figcaption class="pad"><strong>Un campus para grandes oportunidades</strong></figcaption></figure><section class="side-box"><h2>Horarios de atención</h2><div class="pad"><p style="margin:0 0 6px"><b>${esc(i.horario)}</b></p><p style="margin:0">${esc(i.horarioSab || '')}</p></div></section>`, body });
  return { html, after: bindContactForm };
});
function contactForm(pre = '') {
  return `<form class="card cb" data-contact novalidate style="padding:18px"><div class="form-grid">
    <div class="field"><label for="cf-n">Nombres y apellidos <span class="req">*</span></label><input id="cf-n" name="nombres" required maxlength="120" autocomplete="name"></div>
    <div class="field"><label for="cf-d">Documento de identidad</label><input id="cf-d" name="documento" maxlength="12" inputmode="numeric" placeholder="DNI (opcional)"></div>
    <div class="field"><label for="cf-e">Correo electrónico <span class="req">*</span></label><input id="cf-e" name="correo" type="email" required maxlength="120" autocomplete="email"></div>
    <div class="field"><label for="cf-t">Teléfono (opcional)</label><input id="cf-t" name="telefono" maxlength="15" inputmode="tel" autocomplete="tel"></div>
    <div class="field"><label for="cf-a">Asunto <span class="req">*</span></label><select id="cf-a" name="asunto" required><option value="">Selecciona un asunto</option>${['Consulta sobre proceso de admisión', 'Información de programas de estudio', 'Matrícula y becas', 'Certificados y trámites', 'Sugerencias', 'Otros'].map(a => `<option>${a}</option>`).join('')}</select></div>
    <div class="field"><label for="cf-p">Programa de interés</label><select id="cf-p" name="programa"><option value="">— Ninguno —</option>${progs().map(p => `<option value="${p.id}" ${pre === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>
    <div class="field full"><label for="cf-m">Mensaje <span class="req">*</span></label><textarea id="cf-m" name="mensaje" required maxlength="1500"></textarea></div>
    <div class="full">${captchaHTML('cap-c')}</div>
    <div class="field full"><label class="check"><input type="checkbox" name="acepto" required> <span>Acepto el tratamiento de mis datos personales conforme a la <a href="#/politica-de-privacidad" target="_blank">Política de Privacidad</a> (Ley N.º 29733). <span class="req">*</span></span></label></div>
    <div class="full" style="display:flex;justify-content:flex-end"><button class="btn">${ic('send').replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"')} Enviar mensaje</button></div>
  </div><p style="font-size:12.5px;color:var(--muted);margin:10px 0 0">Los campos con <span class="req">*</span> son obligatorios.</p></form>`;
}
function bindContactForm() {
  const f = $('[data-contact]'); if (!f) return;
  f.onsubmit = e => {
    e.preventDefault(); const v = Object.fromEntries(new FormData(f)); const er = {};
    if (!v.nombres.trim() || v.nombres.trim().length < 5) er.nombres = 'Ingrese sus nombres y apellidos completos.';
    if (!reEmail.test(v.correo)) er.correo = 'Ingrese un correo electrónico válido.';
    if (v.documento && !/^\d{8}$/.test(v.documento)) er.documento = 'El DNI debe tener 8 dígitos.';
    if (v.telefono && !/^[\d\s+()-]{6,15}$/.test(v.telefono)) er.telefono = 'Teléfono no válido.';
    if (!v.asunto) er.asunto = 'Seleccione un asunto.';
    if (!v.mensaje.trim() || v.mensaje.trim().length < 10) er.mensaje = 'Escriba un mensaje de al menos 10 caracteres.';
    const cap = checkCaptcha(f, 'cap-c'); if (cap) er.captcha = cap;
    if (!f.acepto.checked) er.acepto = 'Debe aceptar la política de privacidad.';
    if (!showErrors(f, er)) return;
    if (rateLimited('contact', 30)) return toast('Ya enviaste un mensaje hace unos segundos. Espera un momento antes de enviar otro.', 'err');
    const m = { id: uid(), fecha: nowISO(), nombres: v.nombres.trim(), documento: v.documento, correo: v.correo.trim(), telefono: v.telefono, asunto: v.asunto, programa: v.programa, mensaje: v.mensaje.trim(), estado: 'Nuevo', historial: [] };
    coll('mensajes').unshift(m); audit('Registro', 'Mensajes de contacto', m.asunto, 'Mensaje recibido desde el portal'); mailOut(DB.config.correoContacto, 'Nuevo mensaje de contacto: ' + m.asunto, m.mensaje);
    if (!saveDB()) return;
    f.reset(); renewCaptcha(f); modal({ title: 'Mensaje enviado', size: 'sm', body: `<div class="notice ok">Tu mensaje fue registrado correctamente. El envío por correo está pendiente de habilitación.</div>` });
  };
}
function mailOut(para, asunto, cuerpo) {
  const fail = DB.config.simularFalloCorreo;
  coll('correos').unshift({ id: uid(), fecha: nowISO(), para, asunto, cuerpo: clamp(cuerpo, 500), estado: fail ? 'Error' : 'Enviado' });
  if (DB.correos.length > 300) DB.correos.length = 300;
  return fail ? 'Error' : 'Enviado';
}

/* ---------- PROGRAMAS ---------- */
R('programas', path => shell(path, { title: 'Programas de Estudio', desc: 'Programas de estudio de educación superior tecnológica.', crumbs: [['Programas de Estudio']], banner: { kicker: 'Oferta formativa', title: 'Programas de Estudio', text: 'Elige tu carrera técnica y construye tu futuro profesional.' }, side: null, body: `<h1>Programas de Estudio</h1><p class="lead">Ofrecemos ${progs().length} programas de estudio de 3 años de duración, con título de Profesional Técnico a nombre de la Nación.</p>${progList(progs())}` }));
R('programas/:slug', (path, q, prm) => {
  const p = progs().find(x => x.slug === prm.slug) || (PREVIEW && PREVIEW.coll === 'programas' && P('programas').find(x => x.slug === prm.slug && x._preview));
  if (!p) return notFound(path);
  const coord = persona(p.coordinadorId); const ds = docentesDe(p.id); const eg = P('egresados').filter(e => isPub(e) && e.programaId === p.id);
  const totalC = p.modulos.reduce((a, m) => a + m.uds.reduce((b, u) => b + (+u.creditos || 0), 0), 0);
  const hblock = (icon, t) => `<h2>${ic(icon)} ${t}</h2>`;
  const dl = (doc, label, desc, color = '#d93025', ft = doc?.type?.startsWith('image/') ? 'IMG' : 'PDF') => doc ? `<div class="card dl-card"><span class="ft" style="background:${color}">${ft}</span><div><h3>${label}</h3><p>${desc}<br><small>${esc(doc.nombre)} · ${fsize(doc.size)}</small></p><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn xs sec" data-open='${esc(JSON.stringify({ k: label }))}' data-doc="${label === 'Brochure del programa' ? 'brochure' : 'malla'}">${ic('eye').replace('<svg', '<svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"')} Ver ${ft === 'IMG' ? 'imagen' : 'PDF'}</button><button class="btn xs" data-dl="${label === 'Brochure del programa' ? 'brochure' : 'malla'}">${ic('download').replace('<svg', '<svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"')} Descargar</button></div></div></div>` : '';
  const body = `
   <section class="block">${hblock('target', 'Perfil de egreso')}<div class="prose">${sanitize(p.perfil)}</div></section>
   <details class="block program-fold" data-program-section="campo-laboral"><summary>${hblock('briefcase', 'Campo laboral')}</summary><div class="program-fold-body"><ul class="fields-list">${(p.campoItems || []).filter(Boolean).map(c => `<li>${esc(c)}</li>`).join('')}</ul></div></details>
   <details class="block program-fold" data-program-section="malla-curricular"><summary>${hblock('layers', 'Malla curricular')}</summary><div class="program-fold-body"><p>Certificación modular publicada: ${p.modulos.length} módulos profesionales.${totalC ? ` Total transcrito: ${totalC} créditos.` : ' Consulta las unidades didácticas, horas y créditos en el itinerario oficial descargable.'}</p>${p.modulos.map((m, i) => `<details class="mod"><summary>${esc(m.codigo)} · ${esc(m.nombre)}</summary><div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl light"><thead><tr><th>Semestre</th><th>Unidad didáctica</th><th class="num">Créditos</th><th class="num">Horas</th></tr></thead><tbody>${m.uds.length ? '' : '<tr><td colspan="4">Unidades didácticas, créditos y horas en el PDF oficial del itinerario formativo.</td></tr>'}${m.uds.map(u => `<tr><td>${esc(u.semestre)}</td><td>${esc(u.nombre)}</td><td class="num">${esc(u.creditos)}</td><td class="num">${esc(u.horas)}</td></tr>`).join('')}<tr><td colspan="4"><b>Experiencias formativas en situaciones reales de trabajo:</b> ${esc(m.efsrt || '—')}</td></tr></tbody></table></div></details>`).join('')}</div></details>
   <section class="block grid g2">${dl(p.brochure, 'Brochure del programa', 'Conoce más sobre el programa, perfil, competencias y oportunidades.')}${dl(p.malla, 'Itinerario formativo publicado (2024)', 'PDF oficial de 2024; consultar actualizaciones con el programa.', '#1e7e34', 'PDF')}</section>
   ${coord ? `<section class="block">${hblock('user', 'Coordinación del programa')}<div class="card" style="display:flex;gap:16px;padding:16px;align-items:center;flex-wrap:wrap"><img src="${img(coord.foto)}" alt="Fotografía de ${esc(fullName(coord))}" style="width:96px;height:96px;border-radius:50%;object-fit:cover"><div style="flex:1;min-width:220px"><strong style="color:var(--hc)">${esc(fullName(coord))}</strong><br><small style="color:var(--muted)">Coordinador(a) del programa · <a href="mailto:${esc(coord.correo)}">${esc(coord.correo)}</a></small>${p.coordinadorMsg ? `<p style="margin:6px 0 0;font-style:italic">“${esc(p.coordinadorMsg)}”</p>` : ''}</div></div></section>` : ''}
   <section class="block">${hblock('users', 'Plana docente del programa')}${ds.length ? programTeachers(ds) : emptyMsg('docentes')}</section>
   ${(p.convenios || []).length ? `<section class="block">${hblock('building', 'Convenios para EFSRT')}<ul>${p.convenios.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>` : ''}
   <section class="block">${hblock('grad', 'Nuestros egresados')}${eg.length ? `<div class="grid g2">${eg.map(e => `<figure class="card testi" style="margin:0"><blockquote>“${esc(e.testimonio)}”</blockquote><figcaption class="who"><img src="${img(e.foto)}" alt=""><div><strong>${esc(e.nombres)}</strong><br><small>Promoción ${esc(e.anio)}</small></div></figcaption></figure>`).join('')}</div>` : emptyMsg('testimonios de egresados')}</section>
   <section class="notice" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><span><b>¿Te interesa este programa?</b> Consulta el proceso de admisión o escríbenos.</span><span style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn gold" href="#/admision">Consultar admisión</a><a class="btn sec" href="#/contacto?programa=${p.id}">Contáctanos</a></span></section>`;
  setSEO({ title: p.nombre, desc: p.resumen, crumbs: [['Programas de Estudio', '#/programas'], [p.nombre]], jsonld: [{ '@context': 'https://schema.org', '@type': 'EducationalOccupationalProgram', name: p.nombre, description: p.resumen, timeToComplete: 'P3Y', educationalProgramMode: p.modalidad, provider: { '@type': 'EducationalOrganization', name: inst().nombre } }] });
  const fact = (icon, l, v) => `<div>${ic(icon)}<span><small>${l}</small><b>${esc(v).replace(/ \/ /g, '<br>')}</b></span></div>`;
  const side = `<nav class="side-box" aria-label="Programas de estudio"><h2>Programas de Estudio</h2><ul>${progs().map(x => `<li><a href="#/programas/${x.slug}" ${x.id === p.id ? 'aria-current="page"' : ''}>${esc(x.nombre)}</a></li>`).join('')}</ul></nav><div class="side-box"><div class="pad"><strong>¿Tienes alguna consulta?</strong><p style="margin:4px 0 10px">Estamos para ayudarte.</p><a class="btn sm" href="#/nosotros/campus-e-informes?programa=${p.id}">Ir a Campus e Informes</a></div></div>`;
  const html = `${headerHTML(path)}<section class="prog-hero programme-cover"><div class="wrap"><div class="programme-copy"><span class="badge" style="background:var(--gold);color:#111">Programa de estudio</span><h1 class="ttl">${esc(p.nombre)}</h1><p>${esc(p.resumen)}</p></div><figure class="programme-art"><img src="${img(p.imagen)}" alt="Imagen del programa ${esc(p.nombre)}" decoding="async" fetchpriority="high"></figure></div></section>${crumbsHTML([['Programas de Estudio', '#/programas'], [p.nombre]])}
  <div class="wrap" style="margin-top:34px"><div class="prog-facts">${fact('clock', 'Duración', p.duracion)}${fact('building', 'Modalidad', p.modalidad)}${fact('calendar', 'Turno', p.turno)}${fact('clock', 'Horario', p.horario)}<div class="cta"><a class="btn" href="#/admision">${ic('clipboard').replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"')} Proceso de Admisión</a></div></div><p style="font-size:13px;color:var(--muted);margin:10px 0 0">Título que otorga: <b>${esc(p.titulo)}</b> · Código: ${esc(p.codigo)}</p></div>
  <main id="contenido" tabindex="-1"><div class="wrap layout left" style="padding-left:16px;padding-right:16px"><aside>${side}</aside><div class="content">${body}</div></div></main>${footerHTML()}`;
  return { html, after: () => { $$('[data-prof]').forEach(b => b.onclick = () => teacherModal(b.dataset.prof, p.id)); $$('[data-doc]').forEach(b => b.onclick = () => openDoc(p[b.dataset.doc])); $$('[data-dl]').forEach(b => b.onclick = () => downloadDoc(p[b.dataset.dl])); } };
});

/* ---------- ADMISIÓN ---------- */
R('admision', (path, q) => {
  const all = P('admisiones').filter(a => a.estado !== 'Borrador' || a._preview).sort((a, b) => b.anio - a.anio);
  const a = all.find(x => String(x.anio) === q.get('anio')) || admVigente() || all.filter(x => x.estado === 'Publicado').sort((x,y) => y.anio-x.anio)[0];
  if (!a) return shell(path, { title: 'Admisión', crumbs: [['Admisión y Matrículas', '#/admision'], ['Admisión']], banner: { title: 'Admisión' }, side: null, body: `<h1>Admisión</h1>${emptyMsg('procesos de admisión')}` });
  const tupaAdm = P('tupa').filter(t => isPub(t) && (t.categoria === 'Admisión' || /EXAMEN DE ADMISI/i.test(t.categoria)) && t.anio == (DB.tupaDocs.anio || 2026));
  const uit = DB.config.uit[DB.tupaDocs.anio] || 0;
  const tbtn = (pid, t) => { const r = (a.resultados[pid] || {})[t]; return r ? `<button class="btn xs violet" data-res="${pid}|${t}">Ver Resultados</button>` : '<span aria-label="Sin resultados publicados" style="color:var(--muted)">—</span>'; };
  const body = `<p style="text-align:center;margin:0;color:var(--link);font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:13px">${a.inscripcionesAbiertas === true ? 'Inscripciones abiertas' : 'Información del proceso publicado'}</p><h1 style="text-align:center;padding-bottom:0" class="noline">${esc(a.titulo)}</h1>${a.descripcion ? `<p class="lead" style="text-align:center;max-width:760px;margin:0 auto 16px">${esc(a.descripcion)}</p>` : ''}
   ${!a.vigente ? `<div class="notice warn">Estás consultando el proceso ${esc(a.anio)}, que ya concluyó. <a href="#/admision">Ver el proceso vigente</a>.</div>` : ''}
   <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:14px 0 22px">${a.prospecto ? `<button class="btn" data-docx="prospecto">${ic('file').replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"')} ${esc(prospectusLabel(a.prospecto))}</button><button class="btn ghost sm" data-dlx="prospecto" aria-label="Descargar ${esc(prospectusLabel(a.prospecto))}">${ic('download').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')}</button>` : ''}${a.reglamento ? `<button class="btn" data-docx="reglamento">${ic('file').replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"')} REGLAMENTO DE ADMISIÓN</button><button class="btn ghost sm" data-dlx="reglamento" aria-label="Descargar reglamento">${ic('download').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')}</button>` : ''}</div>
   <section><h2>Resultados por programa de estudio</h2><div class="tbl-wrap"><table class="tbl"><caption class="sr-only">Resultados del proceso de admisión ${esc(a.anio)} por programa y turno</caption><thead><tr><th class="c">N.º</th><th>Programa de estudio</th><th class="c">Resultados oficiales</th></tr></thead><tbody>${progs().map((p, i) => `<tr><td class="c">${i + 1}</td><td>${esc(p.nombre)}</td><td class="c">${tbtn(p.id, Object.keys(a.resultados[p.id] || {})[0])}</td></tr>`).join('')}</tbody></table></div></section>
   <div class="grid g2" style="margin-top:22px">
     <section><h2>Cronograma</h2>${(a.cronograma || []).length ? `<div class="tbl-wrap"><table class="tbl light"><thead><tr><th>Actividad</th><th>Fecha</th></tr></thead><tbody>${a.cronograma.map(c => `<tr><td>${esc(c.actividad)}</td><td>${esc(c.fecha)}</td></tr>`).join('')}</tbody></table></div>` : emptyMsg('actividades')}</section>
     <section><h2>Vacantes publicadas por programa</h2><p>La fuente informa 30 vacantes por programa: 12 ordinarias, 10 CEPRE y ocho modalidades con una vacante cada una. No las desglosa por turno.</p><div class="tbl-wrap"><table class="tbl light"><thead><tr><th>Programa</th><th class="num">Total publicado</th></tr></thead><tbody>${progs().map(p => { const v = (a.vacantes || {})[p.id] || {}; return `<tr><td>${esc(p.nombre)}</td><td class="num">${v.total ?? ((+v.M || 0) + (+v.T || 0) + (+v.N || 0))}</td></tr>`; }).join('')}</tbody></table></div></section>
     <section><h2>Requisitos</h2>${(a.requisitos || []).length ? `<ul>${a.requisitos.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : emptyMsg('requisitos')}</section>
     <section><h2>Modalidades</h2>${(a.modalidades || []).map(m => `<p><b>${esc(m.nombre)}:</b> ${esc(m.detalle)}</p>`).join('') || emptyMsg('modalidades')}</section>
   </div>
   <section><h2>Costos (según TUPA ${esc(DB.tupaDocs.anio)})</h2>${tupaAdm.length ? `<div class="tbl-wrap"><table class="tbl light"><thead><tr><th>Código</th><th>Concepto</th><th class="num">Monto</th><th class="num">% UIT</th></tr></thead><tbody>${tupaAdm.map(t => `<tr><td>${esc(t.codigo)}</td><td>${esc(t.denominacion)}</td><td class="num">${money(t.monto)}</td><td class="num">${uit ? (t.monto / uit * 100).toFixed(2) + ' %' : '—'}</td></tr>`).join('')}</tbody></table></div><p style="font-size:13px"><a href="#/transparencia/tupa">Ver TUPA completo</a></p>` : emptyMsg('costos')}</section>
   ${all.filter(x => x.id !== a.id && x.estado !== 'Borrador').length ? `<p style="font-size:13.5px">Procesos anteriores: ${all.filter(x => x.id !== a.id).map(x => `<a href="#/admision?anio=${x.anio}">Admisión ${x.anio}</a>`).join(' · ')}</p>` : ''}`;
  const html = shell(path, { title: a.titulo, desc: `Proceso de admisión ${a.anio}: prospecto, reglamento, vacantes, cronograma y resultados.`, crumbs: [['Admisión y Matrículas', '#/admision'], ['Admisión']], banner: { kicker: 'Proceso de admisión', title: 'Proceso de Admisión ' + a.anio, text: a.subtitulo || '' }, side: null, body });
  return { html, after: () => { $$('[data-docx]').forEach(b => b.onclick = () => openDoc(a[b.dataset.docx])); $$('[data-dlx]').forEach(b => b.onclick = () => downloadDoc(a[b.dataset.dlx])); $$('[data-res]').forEach(b => b.onclick = () => { const [pid, t] = b.dataset.res.split('|'); openDoc(a.resultados[pid][t]); }); } };
});
/* ---------- MATRÍCULA ---------- */
R('matricula', path => {
  const m = matVigente() || P('matriculas').filter(m => m.estado === 'Cerrado').sort((a, b) => b.periodo.localeCompare(a.periodo))[0];
  if (!m) return shell(path, { title: 'Matrícula', crumbs: [['Admisión y Matrículas', '#/admision'], ['Matrícula']], banner: { title: 'Matrícula' }, side: null, body: `<h1>Matrícula</h1>${emptyMsg('periodos de matrícula')}` });
  const items = s => sortO((m.items || []).filter(x => x.seccion === s && x.estado === 'Publicado' && !x.deleted));
  const col = (icon, t, s, extra = '') => `<section class="card"><div class="cb"><h2 style="font-size:17px;margin-top:0;display:flex;gap:8px;align-items:center">${ic(icon).replace('<svg', '<svg style="width:22px;height:22px;stroke:var(--link);fill:none;stroke-width:2"')} ${t}</h2>${items(s).length ? `<ol style="padding-left:20px;margin:0">${items(s).map(x => `<li style="margin-bottom:6px">${esc(x.texto)}</li>`).join('')}</ol>` : '<p>Sin requisitos registrados.</p>'}${extra}</div></section>`;
  const tupaM = P('tupa').filter(t => isPub(t) && (t.categoria === 'Matrícula' || /MATR[IÍ]CULA/i.test(t.categoria)));
  const body = `<h1 style="text-align:center">${esc(m.titulo)}</h1>${!m.vigente ? '<p class="notice warn">Información histórica de matrícula. Confirma el próximo proceso con Secretaría Académica.</p>' : ''}<p style="text-align:center"><span class="badge" style="font-size:14px;padding:6px 14px">${ic('calendar').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:-3px"')} Inicio de clases: <time datetime="${esc(m.inicioClases)}">${fdate(m.inicioClases + 'T12:00:00')}</time></span></p>
   <div class="prose">${sanitize(m.descripcion)}</div>
   <div class="grid g3">${col('money', 'Costos de matrícula', 'costos', `${tupaM.length ? `<table class="tbl light subtbl" style="margin-top:10px"><tbody>${tupaM.map(t => `<tr><td>${esc(t.denominacion)}</td><td class="num">${money(t.monto)}</td></tr>`).join('')}</tbody></table>` : ''}${m.docTasas ? `<button class="btn sm sec" style="margin-top:10px;width:100%" data-tasas>Ver tasas y costos vigentes →</button>` : ''}`)}${col('user', 'Matrícula de ingresantes', 'ingresantes')}${col('restore', 'Ratificación de matrícula', 'ratificacion')}</div>
   ${(m.cronograma || []).length ? `<h2>Cronograma del periodo ${esc(m.periodo)}</h2><div class="tbl-wrap"><table class="tbl light"><thead><tr><th>Actividad</th><th>Fecha</th></tr></thead><tbody>${m.cronograma.map(c => `<tr><td>${esc(c.actividad)}</td><td>${esc(c.fecha)}</td></tr>`).join('')}</tbody></table></div>` : ''}
   <div class="grid g4" style="margin-top:20px"><a class="card cb" href="#/transparencia/tupa" style="text-decoration:none"><b>TUPA</b><br><small>Tasas educativas publicadas</small></a><a class="card cb" href="#/transparencia/documentos-gestion" style="text-decoration:none"><b>Reglamento Institucional</b><br><small>Normas académicas</small></a><a class="card cb" href="#/preguntas-frecuentes" style="text-decoration:none"><b>Preguntas frecuentes</b><br><small>Resuelve tus dudas</small></a><a class="card cb" href="#/contacto" style="text-decoration:none"><b>Mesa de ayuda</b><br><small>Escríbenos</small></a></div>`;
  const html = shell(path, { title: m.titulo, desc: `Matrícula ${m.periodo}: requisitos, costos y fecha de inicio de clases.`, crumbs: [['Admisión y Matrículas', '#/admision'], ['Matrícula']], banner: { kicker: 'Proceso académico', title: m.titulo, text: 'Organiza tu futuro, continúa tu formación' }, side: null, body });
  return { html, after: () => { const b = $('[data-tasas]'); if (b) b.onclick = () => openDoc(m.docTasas); } };
});
/* ---------- BECAS ---------- */
const BST = { page: 1, size: 10 };
R('becas', (path, q) => {
  const pers = P('becasPeriodos').filter(b => b.estado !== 'Borrador').sort((a, b) => b.anio - a.anio || b.periodo.localeCompare(a.periodo));
  const vig = becaVigente() || pers[0];
  const years = [...new Set(pers.map(b => b.anio))];
  const tipos = P('tiposBeca');
  const body = `<h1>Consulta de Beneficiarios de Becas</h1><p class="lead">Busca información de beneficiarios por año, periodo, programa de estudio o tipo de beca. Por defecto se muestra el periodo vigente.</p>
   <form class="filters" data-bf role="search" aria-label="Filtros de becas">
     <div class="field"><label for="bf-a">Año académico</label><select id="bf-a" name="anio">${years.map(y => `<option ${vig && y === vig.anio ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
     <div class="field"><label for="bf-p">Periodo</label><select id="bf-p" name="periodo"><option value="">Todos</option>${[...new Set(pers.map(b => b.periodo))].map(p => `<option ${vig && p === vig.periodo ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
     <div class="field"><label for="bf-g">Programa de estudio</label><select id="bf-g" name="prog"><option value="">Todos</option>${progs().map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></div>
     <div class="field"><label for="bf-t">Tipo de beca</label><select id="bf-t" name="tipo"><option value="">Todos</option>${tipos.map(t => `<option value="${t.id}">${esc(t.nombre)}</option>`).join('')}</select></div>
     <div class="field"><label for="bf-s">Buscar estudiante</label><input id="bf-s" name="s" placeholder="Apellidos, nombres o DNI"></div>
     <div class="actions"><button class="btn">${ic('search').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')} Buscar</button><button type="button" class="btn ghost" data-clear>Limpiar filtros</button></div>
   </form><div id="bres"></div>
   <section style="margin-top:22px"><h2>Tipos de beca y requisitos</h2><div class="grid g3">${tipos.filter(t => t.estado === 'Activo').map(t => `<div class="card cb"><b style="color:var(--hc)">${esc(t.nombre)}</b><p style="margin:4px 0 0;font-size:14px">${esc(t.descripcion)}</p></div>`).join('')}</div>${ext('pronabec') ? `<p style="margin-top:12px">Becas del Estado: <a href="${esc(ext('pronabec'))}" target="_blank" rel="noopener noreferrer">PRONABEC – Programa Nacional de Becas y Crédito Educativo</a></p>` : ''}</section>`;
  const html = shell(path, { title: 'Becas', desc: 'Consulta de beneficiarios de becas por periodo, programa y tipo de beca.', crumbs: [['Admisión y Matrículas', '#/admision'], ['Becas']], banner: { kicker: 'Oportunidades que transforman vidas', title: 'Becas', text: 'Reconocemos tu esfuerzo, apoyamos tu formación' }, side: null, body });
  return {
    html, after: () => {
      const f = $('[data-bf]'); BST.page = 1;
      const run = () => {
        const v = Object.fromEntries(new FormData(f)); const s = normTitle(v.s);
        if (/^\d{8}$/.test(s)) portalLookup('becarios',s,'','dni');
        const perIds = pers.filter(b => String(b.anio) === v.anio && (!v.periodo || b.periodo === v.periodo)).map(b => b.id);
        let rows = P('becarios').filter(b => b.estado === 'Publicado' && perIds.includes(b.periodoId) && (!v.prog || b.programaId === v.prog) && (!v.tipo || b.tipoId === v.tipo));
        if (s) rows = rows.filter(b => /^\d+$/.test(s) ? b.dni === s : normTitle(b.apellidos + ' ' + b.nombres).includes(s) || normTitle(b.nombres + ' ' + b.apellidos).includes(s));
        rows.sort((a, b) => a.apellidos.localeCompare(b.apellidos));
        const tot = rows.length; const pg = rows.slice((BST.page - 1) * BST.size, BST.page * BST.size);
        if (!v.anio) { $('#bres').innerHTML = '<p class="notice" role="status">Aún no hay periodos de becas publicados. Cuando la institución registre un periodo, aquí podrá consultar a los beneficiarios.</p>'; return; }
        const perLabel = `${v.anio}${v.periodo ? ' - ' + v.periodo : ''}`;
        $('#bres').innerHTML = tot ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"><p style="margin:0" role="status">Mostrando resultados de <b>${esc(perLabel)}</b> <span class="badge">${tot} beneficiario(s) encontrado(s)</span></p><button class="btn sm sec" data-pdf>${ic('download').replace('<svg', '<svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"')} Exportar PDF</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="c">N.º</th><th>Apellidos y nombres</th><th>Programa de estudio</th><th>Periodo</th><th>Tipo de beca</th></tr></thead><tbody>${pg.map((b, i) => { const per = coll('becasPeriodos').find(x => x.id === b.periodoId); const t = coll('tiposBeca').find(x => x.id === b.tipoId); return `<tr><td class="c">${(BST.page - 1) * BST.size + i + 1}</td><td>${esc(b.apellidos + ', ' + b.nombres)}</td><td>${esc((progById(b.programaId) || {}).nombre || '')}</td><td>${per ? per.anio + ' - ' + per.periodo : ''}</td><td>${esc(t ? t.nombre : '')}${b.motivo ? `<br><small style="color:var(--muted)">${esc(b.motivo)}</small>` : ''}</td></tr>`; }).join('')}</tbody></table></div>${pager(tot, BST.page, BST.size)}` : `<div class="empty" role="status">No se encontraron beneficiarios para <b>${esc(perLabel)}</b> con los filtros seleccionados.</div>`;
        bindPager($('#bres'), BST, run);
        const pdf = $('[data-pdf]'); if (pdf) pdf.onclick = () => downloadBlob(makePdf('Beneficiarios de becas ' + perLabel, rows.map((b, i) => `${i + 1}. ${b.apellidos}, ${b.nombres} - ${(progById(b.programaId) || {}).nombre || ''} - ${(coll('tiposBeca').find(x => x.id === b.tipoId) || {}).nombre || ''}`), inst().nombre.toUpperCase()), `Becas_${perLabel.replace(/\s/g, '')}.pdf`);
      };
      f.onsubmit = e => { e.preventDefault(); BST.page = 1; run(); };
      $('[data-clear]').onclick = () => { f.reset(); f.anio.value = vig ? vig.anio : years[0]; f.periodo.value = vig ? vig.periodo : ''; BST.page = 1; run(); };
      run();
    }
  };
});

/* ---------- TRANSPARENCIA ---------- */
const transpSide = active => `<nav class="side-box" aria-label="Transparencia"><h2>Transparencia</h2><ul>${[['Documentos de Gestión', 'documentos-gestion'], ['Inversiones y Recursos Económicos', 'inversiones'], ['Licenciamiento', 'licenciamiento'], ['TUPA', 'tupa'], ['Estadísticas', 'estadisticas'], ['Convocatorias', 'convocatorias']].map(([l, s]) => `<li><a href="#/transparencia/${s}" ${s === active ? 'aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul></nav>`;
const tipoDoc = id => (coll('tiposDocumento').find(t => t.id === id) || {}).nombre || '';
function docFile(d) { if(d.estado==='Histórico'&&d.archivoRef)return d.archivoRef;if (d.refModulo === 'admision') { const a = admVigente(); return (a && a.reglamento)||d.archivoRef; } return d.archivo; }
const DST = { page: 1, size: 5 };
R('transparencia', p => ROUTES['transparencia/documentos-gestion'](p, new URLSearchParams()));
R('transparencia/documentos-gestion', path => {
  const docs = P('documentos').filter(d => ['Publicado', 'Histórico'].includes(d.estado) || d._preview);
  const years = validityOptions(docs);
  const body = `<h1>Documentos de Gestión</h1><p class="lead">Normas, planes y documentos que orientan nuestra institución. Se muestran por defecto los documentos vigentes; puede consultar versiones anteriores con el filtro de estado.</p>
   <form class="filters" data-df role="search"><div class="field"><label for="df-t">Tipo de documento</label><select id="df-t" name="tipo"><option value="">Todos</option>${coll('tiposDocumento').map(t => `<option value="${t.id}">${esc(t.nombre)}</option>`).join('')}</select></div>
   <div class="field"><label for="df-y">Año de vigencia</label><select id="df-y" name="anio"><option value="">Todos</option>${years.map(([y,label]) => `<option value="${y}">${label}</option>`).join('')}</select></div>
   <div class="field"><label for="df-e">Estado</label><select id="df-e" name="estado"><option value="Publicado">Vigentes</option><option value="Histórico">Históricos</option><option value="">Todos</option></select></div>
   <div class="field"><label for="df-s">Buscar documento</label><input id="df-s" name="s" placeholder="Nombre del documento"></div>
   <div class="actions"><button class="btn">Buscar</button><button type="button" class="btn ghost" data-clear>Limpiar filtros</button></div></form><div id="dres"></div>`;
  const html = shell(path, { title: 'Documentos de Gestión', desc: 'PEI, PAT, RI, MPP, MPA y demás documentos de gestión vigentes e históricos.', crumbs: [['Transparencia', '#/transparencia/documentos-gestion'], ['Documentos de Gestión']], banner: { kicker: 'Transparencia institucional', title: 'Documentos de Gestión', text: 'Normas, planes y documentos que orientan nuestra institución' }, side: transpSide('documentos-gestion') + sideContact(), body });
  return {
    html, after: () => {
      const f = $('[data-df]'); DST.page = 1;
      const run = () => {
        const v = Object.fromEntries(new FormData(f)); const s = normTitle(v.s);
        const rows = sortO(docs.filter(d => (!v.tipo || d.tipoId === v.tipo) && validityMatches(d.vigencia, v.anio) && (!v.estado || d.estado === v.estado || (d._preview && v.estado === 'Publicado')) && (!s || normTitle(d.nombre).includes(s))));
        const pg = rows.slice((DST.page - 1) * DST.size, DST.page * DST.size);
        $('#dres').innerHTML = rows.length ? `<p role="status">Total: <b>${rows.length}</b> documento(s)</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="c">N.º</th><th>Documento</th><th>Tipo</th><th>Vigencia</th><th>Versión</th><th>Estado</th><th class="c">Acciones</th></tr></thead><tbody>${pg.map((d, i) => { const fl = docFile(d); return `<tr><td class="c">${(DST.page - 1) * DST.size + i + 1}</td><td><span class="file-chip" style="background:none;border:0;padding:0"><span class="ft">PDF</span> ${esc(d.nombre)}</span>${d.refModulo ? `<br><small style="color:var(--muted)">Documento administrado desde el módulo Admisión</small>` : ''}</td><td>${esc(tipoDoc(d.tipoId))}</td><td>${esc(d.vigencia)}</td><td>${esc(d.version)}</td><td>${d.estado === 'Histórico' ? '<span class="badge gray">Histórico</span>' : '<span class="badge ok">Publicado</span>'}</td><td class="c" style="white-space:nowrap">${fl ? `<button class="btn xs sec" data-v="${d.id}">Ver documento</button> <button class="btn xs" data-d="${d.id}">Descargar</button>` : '<span style="color:var(--muted)">No disponible</span>'}</td></tr>`; }).join('')}</tbody></table></div>${pager(rows.length, DST.page, DST.size, [5, 10, 25])}` : `<div class="empty" role="status">No se encontraron documentos con los criterios seleccionados.</div>`;
        bindPager($('#dres'), DST, run);
        $$('[data-v]').forEach(b => b.onclick = () => openDoc(docFile(docs.find(d => d.id === b.dataset.v))));
        $$('[data-d]').forEach(b => b.onclick = () => downloadDoc(docFile(docs.find(d => d.id === b.dataset.d))));
      };
      f.onsubmit = e => { e.preventDefault(); DST.page = 1; run(); }; $('[data-clear]').onclick = () => { f.reset(); DST.page = 1; run(); }; run();
    }
  };
});
R('transparencia/inversiones', (path, q) => {
  const items = P('inversiones').filter(isPub).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const tipos = [...new Set(items.map(i => i.tipo))]; const t = q.get('tipo') || '';
  const rows = items.filter(i => !t || i.tipo === t);
  const total = rows.reduce((a, i) => a + (+i.monto || 0), 0);
  const body = `<h1>Inversiones y Recursos Económicos</h1><p class="lead">Información sobre inversiones, reinversiones, obras de infraestructura (incluidas obras por impuestos), donaciones y recursos de diversa fuente, incluida la contabilidad de Recursos Directamente Recaudados (RDR).</p>
   <div class="chips" role="group" aria-label="Filtrar por tipo"><button class="chip" aria-pressed="${!t}" data-t="">Todos</button>${tipos.map(x => `<button class="chip" aria-pressed="${t === x}" data-t="${esc(x)}">${esc(x)}</button>`).join('')}</div>
   ${rows.length ? `<p role="status">${rows.length} registro(s) · Monto total: <b>${money(total)}</b></p><div class="grid g2">${rows.map(i => `<article class="card ncard"><div class="img"><img src="${img(i.imagen)}" alt="" loading="lazy"><span class="badge">${esc(i.tipo)}</span></div><div class="cb"><div class="meta"><time datetime="${esc(i.fecha)}">${fdate(i.fecha + 'T12:00:00')}</time><span>${esc(i.fuente)}</span></div><h3>${esc(i.titulo)}</h3><p>${esc(i.descripcion)}</p><dl class="kv" style="grid-template-columns:110px 1fr;margin-bottom:10px"><dt>Monto</dt><dd><b>${money(i.monto)}</b></dd><dt>Estado</dt><dd>${esc(i.estadoAvance)}</dd></dl>${i.documento ? `<button class="btn xs sec" data-doc="${i.id}">Ver documento sustentatorio</button>` : '<small style="color:var(--muted)">Sin documento adjunto</small>'}</div></article>`).join('')}</div>` : (page('inversiones') ? sanitize(page('inversiones').contenido) : emptyMsg('inversiones o recursos'))}`;
  const html = shell(path, { title: 'Inversiones y Recursos Económicos', crumbs: [['Transparencia', '#/transparencia/documentos-gestion'], ['Inversiones y Recursos Económicos']], banner: { kicker: 'Transparencia institucional', title: 'Inversiones y Recursos', text: 'Rendición de cuentas a la comunidad' }, side: transpSide('inversiones'), body });
  return { html, after: () => { $$('[data-t]').forEach(b => b.onclick = () => go('#/transparencia/inversiones' + (b.dataset.t ? '?tipo=' + encodeURIComponent(b.dataset.t) : ''))); $$('[data-doc]').forEach(b => b.onclick = () => openDoc(items.find(i => i.id === b.dataset.doc).documento)); } };
});
R('libro-de-reclamaciones', p => ROUTES['transparencia/libro-de-reclamaciones'](p, new URLSearchParams()));
R('transparencia/libro-de-reclamaciones', path => {
  const L = DB.config.limites; const i = inst();
  const body = `<h1>Formulario del Libro de Reclamaciones</h1><p class="lead">Registra aquí tu reclamo o queja. Todos los campos marcados con <span class="req">*</span> son obligatorios. Conforme a la Ley N.º 29571 y el D.S. N.º 007-2020-PCM.</p>
   <form class="card cb" data-lr novalidate style="padding:20px">
    <h2 style="font-size:17px;margin-top:0">1. Datos del reclamante</h2><div class="form-grid">
     <div class="field full"><label for="lr-n">Nombres y apellidos <span class="req">*</span></label><input id="lr-n" name="nombres" required maxlength="120" autocomplete="name"></div>
     <div class="field"><label for="lr-td">Tipo de documento <span class="req">*</span></label><select id="lr-td" name="tipoDoc"><option>DNI</option><option value="CE">Carné de extranjería</option><option>Pasaporte</option><option>RUC</option></select></div>
     <div class="field"><label for="lr-nd">N.º de documento <span class="req">*</span></label><input id="lr-nd" name="numDoc" required maxlength="12"></div>
     <div class="field"><label for="lr-e">Correo electrónico <span class="req">*</span></label><input id="lr-e" name="correo" type="email" required autocomplete="email"></div>
     <div class="field"><label for="lr-t">Teléfono de contacto <span class="req">*</span></label><input id="lr-t" name="telefono" required maxlength="15" inputmode="tel" autocomplete="tel"></div></div>
    <h2 style="font-size:17px">2. Datos de la reclamación</h2><div class="form-grid">
     <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl">Tipo de registro <span class="req">*</span></legend><label class="check"><input type="radio" name="tipo" value="Reclamo" checked> Reclamo</label><label class="check"><input type="radio" name="tipo" value="Queja"> Queja</label></fieldset>
     <div class="field"><label for="lr-a">Asunto <span class="req">*</span></label><input id="lr-a" name="asunto" required maxlength="120" placeholder="Ingrese un breve resumen del motivo"></div>
     <div class="field full"><label for="lr-d">Descripción detallada del hecho <span class="req">*</span></label><textarea id="lr-d" name="descripcion" maxlength="${L.descripcion}" required data-count></textarea><div class="hint"><span data-c>0</span>/${L.descripcion} caracteres</div></div>
     <div class="field full"><label for="lr-p">Pedido o solución solicitada <span class="req">*</span></label><textarea id="lr-p" name="pedido" maxlength="${L.pedido}" required data-count></textarea><div class="hint"><span data-c>0</span>/${L.pedido} caracteres</div></div></div>
    <h2 style="font-size:17px">3. Documentos adicionales (opcional)</h2><div class="field"><label for="lr-f">Adjuntar documentación sustentatoria</label><input id="lr-f" type="file" name="adjunto" accept=".pdf,.jpg,.jpeg,.png"><div class="hint">${FILE_RULES.attach.label}</div></div>
    <h2 style="font-size:17px">4. Verificación y envío</h2>${captchaHTML('cap-lr')}
    <div class="field"><label class="check"><input type="checkbox" name="acepto"> <span>Acepto la <a href="#/politica-de-privacidad" target="_blank">Política de Privacidad</a> y el tratamiento de mis datos personales. <span class="req">*</span></span></label></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="reset" class="btn ghost">Limpiar formulario</button><button class="btn">${ic('send').replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"')} Enviar reclamación</button></div>
   </form>
   <section class="card cb" style="margin-top:18px"><h2 style="font-size:17px;margin-top:0">Consultar el estado de mi reclamación</h2><form data-lrq class="form-grid" novalidate><div class="field"><label for="lq-c">Código de seguimiento</label><input id="lq-c" name="codigo" placeholder="LR-${yearNow()}-000001"></div><div class="field"><label for="lq-d">N.º de documento del reclamante</label><input id="lq-d" name="doc"></div><div class="full"><button class="btn sec">Consultar</button></div></form><div id="lq-r"></div></section>`;
  const side = transpSide('libro-de-reclamaciones') + `<section class="side-box"><h2>Información importante</h2><div class="pad"><ul style="padding-left:18px;margin:0;font-size:13.5px"><li>Tu reclamo será revisado y atendido en un plazo no mayor de 30 días hábiles.</li><li>Recibirás una constancia con tu código de seguimiento en tu correo.</li><li>La institución dará respuesta por el medio que registres.</li><li>Tus datos están protegidos por la Ley N.º 29733.</li></ul></div></section><section class="side-box"><h2>¿Qué es un reclamo y una queja?</h2><div class="pad" style="font-size:13.5px"><p><b>Reclamo:</b> disconformidad relacionada con el servicio educativo o los trámites brindados por la institución.</p><p style="margin:0"><b>Queja:</b> disconformidad no relacionada con el servicio en sí, sino con la atención recibida (trato, demora, etc.).</p></div></section><section class="side-box"><h2>¿Necesitas ayuda?</h2><div class="pad" style="font-size:13.5px">📞 ${esc(i.telefono)}<br>✉️ ${esc(DB.config.correoReclamos)}<br>🕗 ${esc(i.horario)}</div></section>`;
  const html = shell(path, { title: 'Libro de Reclamaciones', desc: 'Libro de reclamaciones virtual del instituto.', crumbs: [['Transparencia', '#/transparencia/documentos-gestion'], ['Libro de Reclamaciones']], banner: { kicker: 'Tu opinión nos ayuda a mejorar', title: 'Libro de Reclamaciones', text: 'Porque un mejor servicio también se construye escuchándote' }, side, body });
  return { html, after: bindReclamo };
});
function bindReclamo() {
  const f = $('[data-lr]'); const L = DB.config.limites;
  $$('[data-count]', f).forEach(t => t.addEventListener('input', () => { t.parentNode.querySelector('[data-c]').textContent = t.value.length; }));
  f.onsubmit = async e => {
    e.preventDefault(); const v = Object.fromEntries(new FormData(f)); const er = {};
    if (v.nombres.trim().length < 5) er.nombres = 'Ingrese nombres y apellidos completos.';
    const de = validDoc(v.tipoDoc, v.numDoc); if (!v.numDoc) er.numDoc = 'Ingrese el número de documento.'; else if (de) er.numDoc = de;
    if (!reEmail.test(v.correo)) er.correo = 'Ingrese un correo electrónico válido.';
    if (!/^[\d\s+()-]{6,15}$/.test(v.telefono)) er.telefono = 'Ingrese un teléfono válido (6 a 15 dígitos).';
    if (v.asunto.trim().length < 5) er.asunto = 'Ingrese el asunto.';
    if (v.descripcion.trim().length < 20) er.descripcion = 'Describa el hecho (mínimo 20 caracteres).'; else if (v.descripcion.length > L.descripcion) er.descripcion = `Máximo ${L.descripcion} caracteres.`;
    if (v.pedido.trim().length < 5) er.pedido = 'Indique su pedido.'; else if (v.pedido.length > L.pedido) er.pedido = `Máximo ${L.pedido} caracteres.`;
    const file = f.adjunto.files[0]; if (file) { const fe = checkFile(file, 'attach'); if (fe) er.adjunto = fe; }
    const cap = checkCaptcha(f, 'cap-lr'); if (cap) er.captcha = cap;
    if (!f.acepto.checked) er.acepto = 'Debe aceptar la política de privacidad.';
    if (!showErrors(f, er)) return;
    if (rateLimited('lr', 30)) return toast('Espere unos segundos antes de registrar otra reclamación.', 'err');
    let adj = null; if (file) adj = { nombre: safeName(file.name, 'lr'), original: file.name, size: file.size, data: await readAsDataURL(file) };
    const y = String(yearNow()); const C = DB.config.contadores.LR; C[y] = (C[y] || 0) + 1;
    const codigo = `LR-${y}-${pad(C[y], 6)}`; const fecha = nowISO();
    const r = { id: uid(), codigo, fecha, tipo: v.tipo, nombres: v.nombres.trim(), tipoDoc: v.tipoDoc, numDoc: v.numDoc.trim(), correo: v.correo.trim(), telefono: v.telefono.trim(), asunto: v.asunto.trim(), descripcion: v.descripcion.trim(), pedido: v.pedido.trim(), adjunto: adj, estado: 'Recibido', historial: [{ fecha, usuario: 'portal', estado: 'Recibido', nota: 'Registro desde el portal web' }], notas: [], respuesta: '', notifInst: 'Pendiente', notifUser: 'Pendiente', anulado: false };
    coll('reclamos').unshift(r);
    if (!saveDB()) return;
      codigo = r.codigo; // se guarda antes de confirmar
    r.notifInst = mailOut(DB.config.correoReclamos, `[${codigo}] Nuevo ${v.tipo.toLowerCase()} registrado`, `${r.nombres} - ${r.asunto}: ${r.descripcion}`);
    r.notifUser = mailOut(r.correo, `Constancia de registro ${codigo}`, `Su ${v.tipo.toLowerCase()} fue registrado el ${fshort(fecha, true)} con el código ${codigo}.`);
    audit('Registro', 'Libro de reclamaciones', codigo, `${v.tipo} ${v.tipo === 'Queja' ? 'registrada' : 'registrado'} desde el portal. Notificación institucional: ${r.notifInst}`); saveDB();
    f.reset(); renewCaptcha(f); $$('[data-c]', f).forEach(c => c.textContent = '0');
    const m = modal({ title: 'Reclamación registrada', body: `<div class="notice ok">Tu ${esc(v.tipo.toLowerCase())} fue registrado correctamente el ${fdate(fecha, true)}.</div><p>Tu código de seguimiento es:</p><div class="code-box">${codigo}</div><p style="margin-top:12px">Puedes descargar tu constancia de recepción. El envío por correo está pendiente de habilitación. Guarda este código para consultar el estado de tu reclamación.</p>`, foot: `<button class="btn sec" data-print>${ic('print').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')} Descargar constancia</button><button class="btn" data-ok>Aceptar</button>` });
    $('[data-ok]', m.el).onclick = m.close;
    $('[data-print]', m.el).onclick = () => downloadBlob(makePdf('Constancia de registro - Libro de Reclamaciones', [`Codigo de seguimiento: ${codigo}`, `Fecha de registro: ${fshort(fecha, true)}`, `Tipo: ${r.tipo}`, `Reclamante: ${r.nombres}`, `Documento: ${r.tipoDoc} ${maskDni(r.numDoc)}`, `Asunto: ${r.asunto}`, '', 'Detalle:', r.descripcion, '', 'Pedido:', r.pedido], inst().nombre.toUpperCase()), `Constancia_${codigo}.pdf`);
  };
  const q = $('[data-lrq]'); q.onsubmit = e => {
    e.preventDefault(); const c = q.codigo.value.trim().toUpperCase(); const d = q.doc.value.trim();
    const r = coll('reclamos').find(x => x.codigo === c && x.numDoc === d);
    $('#lq-r').innerHTML = r ? `<div class="notice ${r.estado === 'Atendido' ? 'ok' : ''}" role="status"><b>${esc(r.codigo)}</b> · ${esc(r.tipo)} registrado el ${fdate(r.fecha, true)}<br>Estado actual: <b>${esc(r.anulado ? 'Anulado' : r.estado)}</b>${r.respuesta ? `<br>Respuesta institucional: ${esc(r.respuesta)}` : ''}</div>` : `<div class="notice warn" role="status">No se encontró una reclamación con ese código y documento.</div>`;
  };
}
R('transparencia/licenciamiento', path => {
  const L = DB.licenciamiento;
  const body = `<h1>Licenciamiento</h1><div class="card cb" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:16px"><span class="kpi" style="box-shadow:none;border:0;padding:0"><span class="ic" style="background:${L.estado === 'Licenciado' ? 'var(--ok)' : 'var(--warn)'}">${ic(L.estado === 'Licenciado' ? 'shield' : 'clock')}</span></span><div><small style="color:var(--muted)">Estado del licenciamiento</small><div style="font-family:var(--fh);font-size:22px;color:var(--hc);font-weight:800">${esc(L.estado)}</div><div>${esc(L.etapa)}</div></div></div>
   <p>${esc(L.descripcion)}</p>
   ${L.resolucion ? `<dl class="kv"><dt>Resolución</dt><dd>${esc(L.resolucion)}</dd><dt>Fecha</dt><dd>${esc(L.fechaResolucion)}</dd><dt>Vigencia hasta</dt><dd>${esc(L.vigenciaHasta)}</dd></dl>` : ''}
   <h2>Avance del proceso</h2><div class="timeline">${(L.hitos || []).map(h => `<div class="it"><span class="y">${fshort(h.fecha + 'T12:00:00')}</span><p style="margin:0">${esc(h.texto)}</p></div>`).join('')}</div>
   ${(L.documentos || []).length ? `<h2>Documentos</h2><ul>${L.documentos.map((d, i) => `<li><a href="#" data-ld="${i}">${esc(d.nombre)}</a></li>`).join('')}</ul>` : ''}
   <p style="font-size:12.5px;color:var(--muted)">Información actualizada al ${fdate(L.modEn)}.</p>`;
  const html = shell(path, { title: 'Licenciamiento', crumbs: [['Transparencia', '#/transparencia/documentos-gestion'], ['Licenciamiento']], banner: { kicker: 'Transparencia institucional', title: 'Licenciamiento', text: 'Condiciones Básicas de Calidad' }, side: transpSide('licenciamiento'), body });
  return { html, after: () => $$('[data-ld]').forEach(a => a.onclick = e => { e.preventDefault(); openDoc(L.documentos[+a.dataset.ld]); }) };
});
R('transparencia/tupa', (path, q) => {
  const y = DB.tupaDocs.anio; const uit = DB.config.uit[y] || 0; const rows = P('tupa').filter(t => isPub(t) && t.anio == y).sort(tupaOrder);
  const cats = [...new Set(rows.map(r => r.categoria))];
  const body = `<h1>Texto Único de Procedimientos Administrativos (TUPA) ${esc(y)}</h1><p class="lead">Tasas publicadas para ${esc(y)}. Confirma su aplicación actual antes de pagar. ${esc(DB.tupaDocs.referencia || '')} Base de cálculo: UIT ${esc(y)} = <b>${money(uit)}</b>.</p>
   <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${DB.tupaDocs.resolucion ? '<button class="btn sec" data-td="resolucion">Resolución de aprobación (PDF)</button>' : ''}${DB.tupaDocs.tupa ? '<button class="btn" data-td="tupa">TUPA vigente (PDF)</button>' : ''}</div>
   <form class="filters" data-tf role="search"><div class="field"><label for="tf-s">Buscar concepto</label><input id="tf-s" name="s" placeholder="Ej.: certificado, matrícula, titulación"></div><div class="field"><label for="tf-c">Categoría</label><select id="tf-c" name="c"><option value="">Todas</option>${cats.map(c => `<option>${esc(c)}</option>`).join('')}</select></div><div class="actions"><button type="button" class="btn ghost" data-clear>Limpiar filtros</button></div></form><div id="tres"></div>`;
  const html = shell(path, { title: 'TUPA ' + y, desc: 'Tasas y procedimientos publicados por la institución.', crumbs: [['Transparencia', '#/transparencia/documentos-gestion'], ['TUPA']], banner: { kicker: 'Transparencia institucional', title: 'TUPA', text: 'Derechos, tasas y procedimientos' }, side: transpSide('tupa'), body });
  return {
    html, after: () => {
      const f = $('[data-tf]');
      const run = () => { const s = normTitle(f.s.value), c = f.c.value; const words = s.split(/\s+/).filter(w => w.length > 2 || /\d/.test(w)); const rs = rows.filter(r => { const t = normTitle(r.denominacion + ' ' + r.codigo); return (!c || r.categoria === c) && (!s || t.includes(s) || (words.length && words.every(w => t.includes(w)))); });
        $('#tres').innerHTML = rs.length ? `<p role="status">${rs.length} concepto(s)</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Código</th><th>Categoría</th><th>Denominación</th><th class="num">Monto</th><th class="num">% UIT</th><th>Lugar de pago</th></tr></thead><tbody>${rs.map(r => `<tr><td>${esc(r.codigo)}</td><td>${esc(r.categoria)}</td><td>${esc(r.denominacion)}</td><td class="num"><b>${money(r.monto)}</b></td><td class="num">${uit ? (r.monto / uit * 100).toFixed(2) + ' %' : '—'}</td><td><small>${esc(r.cuenta)}</small></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty" role="status">No hay conceptos que coincidan con la búsqueda.</div>`; };
      f.oninput = run; f.onsubmit = e => e.preventDefault(); $('[data-clear]').onclick = () => { f.reset(); run(); }; run();
      $$('[data-td]').forEach(b => b.onclick = () => openDoc(DB.tupaDocs[b.dataset.td]));
    }
  };
});
R('transparencia/estadisticas', (path, q) => {
  const st = P('estadisticas'); const years = [...new Set(st.map(s => s.anio))].sort(); const last5 = years.slice(-5);
  const sel = +(q.get('anio') || last5[last5.length - 1]);
  const tot = (y, k) => { const rows = st.filter(s => s.anio === y && s[k] != null); return rows.length ? rows.reduce((a,s) => a + (+s[k] || 0), 0) : null; };
  const chart = (k, t) => `<figure class="card cb chart-card" style="margin:0"><h3>${t}</h3><figcaption style="font-size:12.5px;color:var(--muted);margin-bottom:6px">Total institucional por año (${last5[0]}–${last5[last5.length - 1]})</figcaption>${barChart(last5.filter(y => tot(y,k) != null).map(y => ({ k: String(y), v: tot(y, k) })), { label: t + ' por año' })}</figure>`;
  const rows = progs().map(p => ({ p, s: st.find(x => x.anio === sel && x.programaId === p.id) || {} }));
  const body = `<h1>Estadísticas institucionales</h1><p class="lead">Estadísticas por programa publicadas en el portal oficial. Los totales se calculan sumando las filas; pueden diferir del total escrito en la fuente. Una raya indica que el dato no está publicado, no que sea cero.</p>
   ${st.length ? `<div class="grid g3">${chart('ingresantes', 'Ingresantes')}${chart('matriculados', 'Matriculados')}${chart('egresados', 'Egresados')}</div>
   <h2>Detalle por programa de estudio</h2><div class="chips" role="group" aria-label="Año">${years.map(y => `<button class="chip" data-y="${y}" aria-pressed="${y === sel}">${y}</button>`).join('')}</div>
   <div class="tbl-wrap"><table class="tbl"><caption class="sr-only">Estadísticas ${sel} por programa</caption><thead><tr><th>Programa de estudio</th><th class="num">Postulantes</th><th class="num">Ingresantes</th><th class="num">Matriculados</th><th class="num">Egresados</th><th class="num">Titulados</th><th class="num">Becas</th><th class="num">Créditos educ.</th></tr></thead><tbody>${rows.map(({ p, s }) => `<tr><td>${esc(p.nombre)}</td>${['postulantes', 'ingresantes', 'matriculados', 'egresados', 'titulados', 'becas', 'creditos'].map(k => `<td class="num">${s[k] != null ? num(s[k]) : '—'}</td>`).join('')}</tr>`).join('')}<tr style="font-weight:700;background:var(--sky)"><td>Total ${sel}</td>${['postulantes', 'ingresantes', 'matriculados', 'egresados', 'titulados', 'becas', 'creditos'].map(k => `<td class="num">${tot(sel,k) == null ? '—' : num(tot(sel, k))}</td>`).join('')}</tr></tbody></table></div>
   <p style="margin-top:10px"><button class="btn sm sec" data-csv>${ic('download').replace('<svg', '<svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"')} Descargar datos (CSV)</button></p>` : emptyMsg('estadísticas')}`;
  const html = shell(path, { title: 'Estadísticas', crumbs: [['Transparencia', '#/transparencia/documentos-gestion'], ['Estadísticas']], banner: { kicker: 'Transparencia institucional', title: 'Estadísticas', text: 'Indicadores de los últimos 5 años' }, side: transpSide('estadisticas'), body });
  return { html, after: () => { bindChartTips(document); $$('[data-y]').forEach(b => b.onclick = () => go('#/transparencia/estadisticas?anio=' + b.dataset.y)); const c = $('[data-csv]'); if (c) c.onclick = () => downloadText(toCSV([['Año', 'Programa', 'Postulantes', 'Ingresantes', 'Matriculados', 'Egresados', 'Titulados', 'Becas', 'Créditos']].concat(st.map(s => [s.anio, (progById(s.programaId) || {}).nombre, s.postulantes, s.ingresantes, s.matriculados, s.egresados, s.titulados, s.becas, s.creditos]))), 'estadisticas.csv', 'text/csv'); } };
});
R('transparencia/convocatorias', path => {
  const cs = P('convocatorias').filter(isPub).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const body = `<h1>Convocatorias</h1><p class="lead">Procesos de contratación docente y administrativa, y encargaturas: bases, cronograma y resultados por etapa.</p>${cs.length ? cs.map(c => `<article class="card cb" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><span class="badge">${esc(c.tipo)}</span> <span class="badge ${c.situacion === 'En curso' ? 'warn' : 'gray'}">${esc(c.situacion)}</span><h2 style="font-size:18px;margin:8px 0 4px">${esc(c.titulo)}</h2><p style="margin:0;color:var(--ink2)">${esc(c.descripcion)}</p></div><div><small>Publicado: <time datetime="${esc(c.fecha)}">${fdate(c.fecha + 'T12:00:00')}</time></small><br>${c.bases ? `<button class="btn xs" data-cb="${c.id}" style="margin-top:6px">Ver bases</button>` : ''}</div></div>${(c.etapas || []).length ? `<div class="tbl-wrap" style="margin-top:12px"><table class="tbl light subtbl"><thead><tr><th>Etapa</th><th>Fecha</th><th>Documento</th></tr></thead><tbody>${c.etapas.map(e => `<tr><td>${esc(e.nombre)}</td><td>${fshort(e.fecha + 'T12:00:00')}</td><td>${e.doc ? `<button class="btn xs sec" data-ce="${c.id}|${e.id}">Ver resultado</button>` : '<span style="color:var(--muted)">—</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}</article>`).join('') : emptyMsg('convocatorias')}`;
  const html = shell(path, { title: 'Convocatorias', crumbs: [['Transparencia', '#/transparencia/documentos-gestion'], ['Convocatorias']], banner: { kicker: 'Transparencia institucional', title: 'Convocatorias', text: 'Procesos de selección y encargaturas' }, side: transpSide('convocatorias'), body });
  return { html, after: () => { $$('[data-cb]').forEach(b => b.onclick = () => openDoc(cs.find(c => c.id === b.dataset.cb).bases)); $$('[data-ce]').forEach(b => b.onclick = () => { const [c, e] = b.dataset.ce.split('|'); openDoc(cs.find(x => x.id === c).etapas.find(x => x.id === e).doc); }); } };
});

/* ---------- SERVICIOS ---------- */
const servSide = a => `<nav class="side-box" aria-label="Servicios"><h2>Servicios</h2><ul>${[['Servicios en línea', ''], ['Mesa de Partes Virtual', 'mesa-de-partes'], ['Libro de Reclamaciones', 'libro-de-reclamaciones'], ['Consulta de certificados', 'consulta-certificados'], ['Bolsa Laboral', 'bolsa-laboral'], ['Servicios Complementarios', 'complementarios']].map(([l, s]) => `<li><a href="#/servicios${s ? '/' + s : ''}" ${s === a ? 'aria-current="page"' : ''}>${l}</a></li>`).join('')}${[['biblioteca', 'Biblioteca Virtual'], ['correo', 'Correo Institucional'], ['aula', 'Aula Virtual']].filter(x => ext(x[0])).map(([id, l]) => `<li><a href="${esc(ext(id))}" target="_blank" rel="noopener noreferrer">${l} ↗</a></li>`).join('')}</ul></nav>`;
R('servicios', p => ROUTES['servicios/complementarios'](p, new URLSearchParams()));
R('servicios/complementarios', path => {
  const sv = sortO(P('servicios').filter(isPub));
  const body = `<h1>Servicios Complementarios</h1><p class="lead">Servicios educacionales complementarios para estudiantes, docentes y comunidad: ubicación, horario, responsable y costo.</p>${sv.length ? `<div class="grid g2">${sv.map(s => `<article class="card cb"><h2 style="font-size:17px;margin-top:0;display:flex;gap:8px;align-items:center">${ic(s.icono).replace('<svg', '<svg style="width:22px;height:22px;stroke:var(--link);fill:none;stroke-width:2"')} ${esc(s.nombre)}</h2><p>${esc(s.descripcion)}</p><dl class="kv" style="grid-template-columns:100px 1fr"><dt>Ubicación</dt><dd>${esc(s.ubicacion)}</dd><dt>Horario</dt><dd>${esc(s.horario)}</dd><dt>Responsable</dt><dd>${esc(s.responsable)}</dd><dt>Costo</dt><dd>${esc(s.costo)}</dd></dl></article>`).join('')}</div>` : emptyMsg('servicios')}
   <h2>Plataformas en línea</h2><div class="minedu-links">${[['biblioteca', 'Biblioteca Virtual', 'book'], ['correo', 'Correo Institucional', 'mail'], ['aula', 'Aula Virtual', 'monitor']].filter(x => ext(x[0])).map(([id, l, i]) => `<a href="${esc(ext(id))}" target="_blank" rel="noopener noreferrer"><span class="lg" style="background:var(--blue)">${ic(i).replace('<svg', '<svg style="width:22px;height:22px;stroke:#fff;fill:none;stroke-width:2"')}</span>${l}</a>`).join('')}</div>`;
  return shell(path, { title: 'Servicios Complementarios', crumbs: [['Servicios', '#/servicios'], ['Servicios Complementarios']], banner: { kicker: 'Servicios', title: 'Servicios al estudiante', text: 'Acompañamos tu formación' }, side: servSide('complementarios'), body: (typeof svNav === 'function' ? svNav('complementarios') : '') + body });
});
R('servicios/mesa-de-partes', (path, q0) => {
  const body = `<h1>Mesa de Partes Virtual</h1><p class="lead">Presenta tus solicitudes y documentos en línea. Recibirás un número de expediente para hacer seguimiento.</p>
   <div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-tab="n">Nuevo trámite</button><button role="tab" aria-selected="false" data-tab="c">Consultar expediente</button></div>
   <form class="card cb" data-mp novalidate style="padding:20px"><div class="form-grid">
     <div class="field"><label for="mp-td">Tipo de documento <span class="req">*</span></label><select id="mp-td" name="tipoDoc"><option>DNI</option><option value="CE">Carné de extranjería</option><option>RUC</option></select></div>
     <div class="field"><label for="mp-nd">N.º de documento <span class="req">*</span></label><input id="mp-nd" name="numDoc" maxlength="12"></div>
     <div class="field full"><label for="mp-n">Nombres y apellidos / razón social <span class="req">*</span></label><input id="mp-n" name="nombres" maxlength="150"></div>
     <div class="field"><label for="mp-e">Correo electrónico <span class="req">*</span></label><input id="mp-e" name="correo" type="email"></div>
     <div class="field"><label for="mp-t">Teléfono <span class="req">*</span></label><input id="mp-t" name="telefono" maxlength="15"></div>
     <div class="field"><label for="mp-tt">Tipo de trámite <span class="req">*</span></label><select id="mp-tt" name="tipoTramite"><option value="">Seleccione</option>${['Solicitud general', 'Certificado de estudios', 'Constancia de estudios / egresado', 'Convalidación', 'Traslado', 'Reserva de matrícula', 'Titulación', 'Otros'].map(x => `<option>${x}</option>`).join('')}</select></div>
     <div class="field"><label for="mp-f">N.º de folios <span class="req">*</span></label><input id="mp-f" name="folios" type="number" min="1" max="500" value="1"></div>
     <div class="field full"><label for="mp-a">Asunto <span class="req">*</span></label><textarea id="mp-a" name="asunto" maxlength="800" style="min-height:80px"></textarea></div>
     <div class="field full"><label for="mp-x">Documento (PDF) <span class="req">*</span></label><input id="mp-x" type="file" name="archivo" accept=".pdf"><div class="hint">${FILE_RULES.pdf.label} (se recomienda menos de 2 MB)</div></div>
     <div class="full">${captchaHTML('cap-mp')}</div>
     <div class="field full"><label class="check"><input type="checkbox" name="acepto"> <span>Acepto la <a href="#/politica-de-privacidad" target="_blank">Política de Privacidad</a> y declaro que la información es veraz. <span class="req">*</span></span></label></div>
     <div class="full" style="text-align:right"><button class="btn">Registrar trámite</button></div></div></form>
   <form class="card cb" data-mpq hidden novalidate style="padding:20px"><div class="form-grid"><div class="field"><label for="mq-n">Número de expediente</label><input id="mq-n" name="numero" placeholder="EXP-${yearNow()}-000001"></div><div class="field"><label for="mq-d">N.º de documento o código de verificación</label><input id="mq-d" name="doc" placeholder="DNI/RUC o código del cargo"></div><div class="full"><button class="btn sec">Consultar estado</button></div></div><div id="mq-r"></div></form>`;
  const html = shell(path, { title: 'Mesa de Partes Virtual', crumbs: [['Servicios', '#/servicios/complementarios'], ['Mesa de Partes Virtual']], banner: { kicker: 'Servicios', title: 'Mesa de Partes Virtual', text: 'Tus trámites, sin colas' }, side: servSide('mesa-de-partes') + `<section class="side-box"><h2>Horario de recepción</h2><div class="pad" style="font-size:13.5px">Los documentos ingresados después de las 5:00 p.m. o en días no hábiles se consideran recibidos el siguiente día hábil.</div></section>`, body });
  return {
    html, after: () => {
      $$('[data-tab]').forEach(b => b.onclick = () => { $$('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === b)); $('[data-mp]').hidden = b.dataset.tab !== 'n'; $('[data-mpq]').hidden = b.dataset.tab !== 'c'; });
      const f = $('[data-mp]');
      f.onsubmit = async e => {
        e.preventDefault(); const v = Object.fromEntries(new FormData(f)); const er = {};
        const de = validDoc(v.tipoDoc, v.numDoc); if (!v.numDoc || de) er.numDoc = de || 'Requerido.';
        if (v.nombres.trim().length < 5) er.nombres = 'Requerido.'; if (!reEmail.test(v.correo)) er.correo = 'Correo no válido.'; if (!/^[\d\s+()-]{6,15}$/.test(v.telefono)) er.telefono = 'Teléfono no válido.';
        if (!v.tipoTramite) er.tipoTramite = 'Seleccione el tipo de trámite.'; if (!(+v.folios >= 1)) er.folios = 'Indique los folios.'; if (v.asunto.trim().length < 10) er.asunto = 'Describa el asunto (mín. 10 caracteres).';
        const file = f.archivo.files[0]; if (!file) er.archivo = 'Adjunte el documento en PDF.'; else { const fe = checkFile(file, 'pdf'); if (fe) er.archivo = fe; else if (file.size > 2.5 * 1048576) er.archivo = 'El archivo debe pesar menos de 2.5 MB (límite del almacenamiento del navegador).'; }
        const cap = checkCaptcha(f, 'cap-mp'); if (cap) er.captcha = cap; if (!f.acepto.checked) er.acepto = 'Debe aceptar.';
        if (!showErrors(f, er)) return; if (rateLimited('mp', 30)) return toast('Espere unos segundos antes de registrar otro trámite.', 'err');
        const y = String(yearNow()); const C = DB.config.contadores.EXP; C[y] = (C[y] || 0) + 1; const numero = `EXP-${y}-${pad(C[y], 6)}`; const fecha = nowISO();
        const x = { id: uid(), numero, fecha, nombres: v.nombres.trim(), tipoDoc: v.tipoDoc, numDoc: v.numDoc.trim(), correo: v.correo.trim(), telefono: v.telefono, tipoTramite: v.tipoTramite, asunto: v.asunto.trim(), folios: +v.folios, archivo: { nombre: safeName(file.name, 'exp'), original: file.name, size: file.size, data: await readAsDataURL(file) }, area: 'MP', estado: 'Recibido', historial: [{ fecha, usuario: 'portal', estado: 'Recibido', nota: 'Registro virtual' }] };
        x.archivo.sha256 = await sha256Of(x.archivo.data); coll('expedientes').unshift(x); expCargoCod(x); if (!saveDB()) return;
        mailOut(x.correo, 'Cargo de recepción ' + numero, 'Su trámite fue registrado.'); audit('Registro', 'Mesa de partes', numero, x.tipoTramite); saveDB(); f.reset();
        const mReg = modal({ title: 'Trámite registrado', body: `<div class="notice ok">Tu trámite fue recibido el ${fdate(fecha, true)}.</div><p>Número de expediente:</p><div class="code-box">${numero}</div><p style="margin-top:10px">Código de verificación: <b class="mono">${esc(x.cargoCod || '—')}</b> · Plazo de atención: ${EXP_PLAZOS[x.tipoTramite] || 10} días hábiles.</p>${expEfectiva(fecha) ? '<div class="notice warn">Registrado fuera del horario de recepción: se considera recibido el ' + fdate(expEfectiva(fecha), true) + '.</div>' : ''}<p>Descarga y conserva tu cargo de recepción. Correo de contacto: <b>${esc(x.correo)}</b>.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${cargoBtn(x)}<a class="btn ghost" href="${esc('#/servicios/mesa-de-partes?exp=' + numero + '&c=' + (x.cargoCod || ''))}" data-close-modal>Ver seguimiento</a></div>` }); $('[data-close-modal]', mReg.el).onclick = () => mReg.close();
      };
      const q = $('[data-mpq]');
      const showExp = x => { $('#mq-r').innerHTML = x ? `<div class="notice" role="status" style="margin-top:14px"><b>${esc(x.numero)}</b> · ${esc(x.tipoTramite)}<br>Estado: <b>${esc(x.estado)}</b> · Área: ${esc(x.area ? areaName(x.area) : 'Mesa de partes')} · Plazo: ${expSem(x)}<ul style="margin:6px 0 0">${x.historial.map(h => `<li>${fshort(h.fecha, true)} — ${esc(h.estado)}${h.nota ? ': ' + esc(h.nota) : ''}</li>`).join('')}</ul><div style="margin-top:10px">${cargoBtn(x, 'btn sm')}</div></div>` : '<div class="notice warn" role="status" style="margin-top:14px">No se encontró el expediente con esos datos.</div>'; };
      const findExp = (n, d) => portalLookup('expedientes', String(n || '').trim().toUpperCase(), String(d || '').trim());
      q.onsubmit = e => { e.preventDefault(); showExp(findExp(q.numero.value, q.doc.value)); };
      if (q0 && q0.get && q0.get('exp')) { $$('[data-tab]').find(b => b.dataset.tab === 'c').click(); q.numero.value = q0.get('exp'); if (q0.get('c')) { q.doc.value = q0.get('c'); showExp(findExp(q0.get('exp'), q0.get('c'))); } }
    }
  };
});
R('servicios/consulta-certificados', (path, q) => {
  const pre = (q.get('codigo') || '').trim().toUpperCase();
  const body = `<h1>Consulta y verificación de documentos</h1><p class="lead">Verifica la autenticidad de un título, certificado, constancia de certificación modular u otro documento emitido por el instituto, con su código de verificación (también se abre al escanear el código QR) o con el DNI del titular.</p><form class="card cb" data-cq style="padding:20px" novalidate><div class="form-grid"><div class="field"><label for="cq-t">Buscar por</label><select id="cq-t" name="t"><option value="codigo">Código de verificación</option><option value="dni">DNI del titular</option></select></div><div class="field"><label for="cq-v">Valor</label><input id="cq-v" name="v" placeholder="CERT-2025-000123 o ABCD-1234" value="${esc(pre)}"></div><div class="full">${captchaHTML('cap-cq')}</div><div class="full"><button class="btn">Verificar</button></div></div></form><div id="cq-r" style="margin-top:14px"></div>`;
  const html = shell(path, { title: 'Consulta y verificación de documentos', crumbs: [['Servicios', '#/servicios/complementarios'], ['Consulta y verificación de documentos']], banner: { kicker: 'Servicios', title: 'Consulta de Documentos', text: 'Validación en línea' }, side: servSide('consulta-certificados'), body });
  const show = (t, v) => {
    const rs = coll('certificados').filter(c => t === 'codigo' ? c.codigo === v : c.dni === v);
    const extra = t === 'codigo' && !rs.length && IX ? IX.findDoc(v) : null;
    $('#cq-r').innerHTML = rs.length ? rs.map(c => `<div class="notice ${c.estado === 'Válido' ? 'ok' : 'err'}" role="status"><b>Documento ${esc(c.estado.toLowerCase())}</b><br>${esc(c.tipo)} · ${esc(c.codigo)}<br>Titular: ${esc(c.nombres)} (DNI ${maskDni(c.dni)})<br>${c.programaId ? `Programa: ${esc((progById(c.programaId) || {}).nombre || '')} · ` : ''}Emitido el ${fdate(c.fecha + 'T12:00:00')}</div>`).join('')
      : extra ? `<div class="notice ${extra.valido ? 'ok' : 'err'}" role="status"><b>Documento ${extra.valido ? 'válido' : 'anulado'}</b><br>${esc(extra.tipo)} · ${esc(extra.cod)}<br>${extra.persona ? 'A nombre de: ' + esc(extra.persona) + '<br>' : ''}Emitido el ${esc(extra.fecha)}</div>`
      : '<div class="notice err" role="status">No se encontró ningún documento con los datos ingresados.</div>';
  };
  return { html, after: () => { const f = $('[data-cq]'); if (pre) { portalLookup('certificados', pre, ''); show('codigo', pre); } f.onsubmit = e => { e.preventDefault(); const cap = checkCaptcha(f, 'cap-cq'); if (cap) return showErrors(f, { captcha: cap }); show(f.t.value, f.v.value.trim().toUpperCase()); }; } };
});
R('servicios/bolsa-laboral', path => {
  const body = `<h1>Bolsa laboral</h1><p class="lead">Ofertas de empleo y prácticas validadas por el instituto para estudiantes y egresados. Las empresas e instituciones pueden registrarse para publicar sus ofertas.</p>${ixWrap(IX.view('pub:bolsa'))}`;
  return shell(path, { title: 'Bolsa laboral', crumbs: [['Servicios', '#/servicios/complementarios'], ['Bolsa laboral']], banner: { kicker: 'Servicios', title: 'Bolsa Laboral', text: 'Conectamos talento con empresas' }, side: servSide('bolsa-laboral'), body });
});

/* ---------- NOTICIAS Y EVENTOS ---------- */
const NST = { page: 1, size: 6 };
R('noticias', (path, q) => {
  const all = pubNews(); const cat = q.get('cat') || ''; const s = q.get('q') || ''; const mes = q.get('mes') || '';
  let rows = all.filter(n => (!cat || n.categoriaId === cat) && (!s || normTitle(n.titulo + ' ' + n.resumen + ' ' + stripTags(n.contenido)).includes(normTitle(s))) && (!mes || n.fecha.slice(0, 7) === mes));
  const pg = +(q.get('page') || 1); const size = NST.size; const tot = rows.length; const view = rows.slice((pg - 1) * size, pg * size);
  const months = [...new Set(all.map(n => n.fecha.slice(0, 7)))];
  const qs = (o) => { const p = new URLSearchParams({ cat, q: s, mes, ...o }); [...p.keys()].forEach(k => !p.get(k) && p.delete(k)); return '#/noticias' + (p.toString() ? '?' + p : ''); };
  const pages = Math.max(1, Math.ceil(tot / size));
  const body = `<h1>Noticias</h1><div class="chips" role="group" aria-label="Categorías"><a class="chip" href="${qs({ cat: '', page: '' })}" aria-current="${!cat}">Todas</a>${coll('categoriasNoticia').filter(c => c.estado === 'Activo').map(c => `<a class="chip" href="${qs({ cat: c.id, page: '' })}" aria-current="${cat === c.id}">${esc(c.nombre)}</a>`).join('')}</div>
   ${s ? `<p role="status">Resultados para “<b>${esc(s)}</b>”: ${tot}</p>` : ''}
   ${view.length ? `<div class="grid g3">${view.map(newsCard).join('')}</div>` : `<div class="empty" role="status">No se encontraron noticias con los criterios seleccionados.</div>`}
   ${pages > 1 ? `<nav class="pager" aria-label="Paginación de noticias"><span>Página ${pg} de ${pages}</span><div class="pages">${pg > 1 ? `<a class="btn xs ghost" href="${qs({ page: pg - 1 })}">‹ Anterior</a>` : ''}${Array.from({ length: pages }, (_, i) => `<a class="btn xs ${i + 1 === pg ? '' : 'ghost'}" href="${qs({ page: i + 1 })}" ${i + 1 === pg ? 'aria-current="page"' : ''}>${i + 1}</a>`).join('')}${pg < pages ? `<a class="btn xs ghost" href="${qs({ page: pg + 1 })}">Siguiente ›</a>` : ''}</div></nav>` : ''}`;
  const side = `<section class="side-box"><h2>Buscar noticias</h2><form class="pad" data-ns role="search" style="display:flex;gap:6px"><label class="sr-only" for="ns-q">Palabra clave</label><input class="inp" id="ns-q" name="q" value="${esc(s)}" placeholder="Palabra clave"><button class="btn sm" aria-label="Buscar">${ic('search').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')}</button></form></section>
   <section class="side-box"><h2>Categorías</h2><ul>${coll('categoriasNoticia').filter(c => c.estado === 'Activo').map(c => `<li><a href="${qs({ cat: c.id, page: '' })}">${esc(c.nombre)} (${all.filter(n => n.categoriaId === c.id).length})</a></li>`).join('')}</ul></section>
   <section class="side-box"><h2>Noticias destacadas</h2><ul>${all.filter(n => n.destacada).slice(0, 4).map(n => `<li><a href="#/noticias/${esc(n.slug)}">${esc(n.titulo)}</a></li>`).join('') || '<li class="pad">Sin destacadas.</li>'}</ul></section>
   <section class="side-box"><h2>Archivo de noticias</h2><div class="pad"><label class="sr-only" for="ns-m">Mes</label><select class="inp" id="ns-m" data-mes><option value="">Seleccione un mes</option>${months.map(m => `<option value="${m}" ${m === mes ? 'selected' : ''}>${MESES[+m.slice(5) - 1]} ${m.slice(0, 4)}</option>`).join('')}</select></div></section>`;
  const html = shell(path, { title: 'Noticias', desc: 'Información institucional, actividades académicas y eventos de nuestra comunidad.', crumbs: [['Noticias']], banner: { title: 'Noticias', text: 'Información institucional, actividades académicas y eventos de nuestra comunidad.' }, side, body });
  return { html, after: () => { $('[data-ns]').onsubmit = e => { e.preventDefault(); go(qs({ q: $('#ns-q').value.trim(), page: '' })); }; $('[data-mes]').onchange = e => go(qs({ mes: e.target.value, page: '' })); } };
});
R('noticias/:slug', (path, q, prm) => {
  const n = P('noticias').find(x => x.slug === prm.slug && newsVisible(x));
  if (!n) return notFound(path);
  const rel = pubNews().filter(x => x.id !== n.id && x.categoriaId === n.categoriaId).slice(0, 3);
  const fotos = newsFotos(n);
  const url = location.href;
  const body = `<article><header><div class="meta" style="display:flex;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:13.5px"><time datetime="${esc(n.fecha)}">${fdate(n.fecha, true)}</time><span class="badge">${esc(catName(n.categoriaId))}</span></div><h1>${esc(n.titulo)}</h1><p class="lead">${esc(n.resumen)}</p></header>
   ${n.video ? `<div style="aspect-ratio:16/9;margin-bottom:16px"><iframe src="${esc(/^https:\/\//i.test(n.video) ? n.video : 'about:blank')}" title="Video: ${esc(n.titulo)}" style="width:100%;height:100%;border:0;border-radius:10px" allowfullscreen loading="lazy"></iframe></div>` : `<figure class="figure"><button type="button" class="ngal-main" aria-label="Ampliar la foto"><img src="${img(n.imagen, 'ph:campus:4')}" alt="Imagen de la noticia: ${esc(n.titulo)}" data-fit="${newsImageFit(n)}" decoding="async"></button><figcaption>${esc(n.titulo)}${fotos.length > 1 ? ` · Foto <span data-gal-n>1</span> de ${fotos.length}` : ''}</figcaption></figure>`}
   ${fotos.length > 1 ? `<div class="ngal" aria-label="Galería de fotos de la noticia">${fotos.map((f, i) => `<button type="button" class="ngal-t${!n.video && !i ? ' on' : ''}" data-gal-t="${i}" aria-label="Ver foto ${i + 1} de ${fotos.length}"><img src="${img(f)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>` : ''}
   <div class="prose">${sanitize(n.contenido)}</div>
   ${(n.adjuntos || []).length ? `<h2>Archivos relacionados</h2><ul>${n.adjuntos.filter(a => a.doc || a.data || a.titulo || a.url).map((a, i) => { const d = a.doc || a; return `<li><a href="#" data-adj="${i}">${esc(a.titulo || d.original || d.nombre)}</a> <small>(${fsize(d.size)})</small></li>`; }).join('')}</ul>` : ''}
   <p style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:18px"><b>Compartir:</b><a class="btn xs ghost" target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">Facebook</a><a class="btn xs ghost" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent(n.titulo + ' ' + url)}">WhatsApp</a><a class="btn xs ghost" href="#/noticias">← Volver a noticias</a></p></article>
   ${rel.length ? `<section><h2>Noticias relacionadas</h2><div class="grid g3">${rel.map(newsCard).join('')}</div></section>` : ''}`;
  const html = shell(path, { title: n.titulo, desc: n.resumen, crumbs: [['Noticias', '#/noticias'], [clamp(n.titulo, 50)]], banner: { title: 'Noticias', text: catName(n.categoriaId) }, side: `<section class="side-box"><h2>Últimas noticias</h2><ul>${pubNews().slice(0, 5).map(x => `<li><a href="#/noticias/${esc(x.slug)}">${esc(x.titulo)}</a></li>`).join('')}</ul></section>` + sideLinks(), body, jsonld: [{ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: n.titulo, datePublished: n.fecha, dateModified: n.modEn || n.fecha, description: n.resumen, author: { '@type': 'Organization', name: inst().nombre }, publisher: { '@type': 'Organization', name: inst().nombre } }] });
  return { html, after: () => {
    $$('[data-adj]').forEach(a => a.onclick = e => { e.preventDefault(); const x = n.adjuntos.filter(a => a.doc || a.data || a.titulo || a.url)[+a.dataset.adj]; openDoc(x.doc || x); });
    const main = $('.ngal-main'); let cur = 0;
    if (main && fotos.length) main.onclick = () => openGallery(fotos, cur, n.titulo);
    $$('[data-gal-t]').forEach(b => b.onclick = () => {
      const i = +b.dataset.galT; if (!main) return openGallery(fotos, i, n.titulo);
      cur = i; const im = $('img', main); im.src = img(fotos[i]); im.dataset.fit = i ? 'cover' : newsImageFit(n);
      $$('[data-gal-t]').forEach(t => t.classList.toggle('on', t === b)); const c = $('[data-gal-n]'); if (c) c.textContent = i + 1;
    });
  } };
});
R('eventos', path => {
  const today = new Date(new Date().toDateString());
  const ev = P('eventos').filter(isPub).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const up = ev.filter(e => new Date(e.fecha) >= today), past = ev.filter(e => new Date(e.fecha) < today).reverse();
  const body = `<h1>Agenda de eventos</h1><h2>Próximos eventos</h2>${up.length ? `<div class="grid g2">${up.map(eventCard).join('')}</div>` : emptyMsg('eventos próximos')}${past.length ? `<h2>Eventos realizados</h2><div class="grid g2">${past.map(eventCard).join('')}</div>` : ''}`;
  return shell(path, { title: 'Eventos', crumbs: [['Otras Páginas', '#/eventos'], ['Eventos']], banner: { title: 'Eventos', text: 'Actividades académicas, culturales y deportivas' }, side: null, body, jsonld: up.map(e => ({ '@context': 'https://schema.org', '@type': 'Event', name: e.titulo, startDate: e.fecha, location: { '@type': 'Place', name: e.lugar, address: inst().direccion }, description: e.descripcion })) });
});
R('contacto', (path, q) => {
  const i = inst();
  const body = `<h1>Contáctanos</h1><p class="lead">Escríbenos tus consultas, sugerencias o requerimientos. Te responderemos a la brevedad.</p><div class="info-cards"><div>${ic('map')}<span><b>Dirección</b>${esc(i.direccion)}</span></div><div>${ic('phone')}<span><b>Teléfono</b>${esc(i.telefono)} (${esc(i.telefonoNota)})</span></div><div>${ic('clock')}<span><b>Horario</b>${esc(i.horario)}</span></div></div>${contactForm(q.get('programa'))}`;
  const html = shell(path, { title: 'Contáctanos', crumbs: [['Contáctanos']], banner: { title: 'Contáctanos', text: 'Estamos para ayudarte' }, side: sideContact() + `<div class="promo"><strong>¿Prefieres visitarnos?</strong><p style="margin:6px 0 10px">Revisa nuestra ubicación y cómo llegar.</p><a class="btn gold sm" href="#/nosotros/campus-e-informes">Ver mapa</a></div>`, body });
  return { html, after: bindContactForm };
});
['privacidad|politica-de-privacidad', 'terminos|terminos-de-uso', 'faq|preguntas-frecuentes'].forEach(x => { const [k, s] = x.split('|'); R(s, path => { const p = page(k); if (!p || !isPub(p)) return notFound(path); return shell(path, { title: p.titulo, crumbs: [[p.titulo]], banner: { title: p.titulo }, side: sideContact(), body: `<h1>${esc(p.titulo)}</h1><div class="prose">${sanitize(p.contenido)}</div>` }); }); });
R('mapa-del-sitio', path => {
  const nm = navModel();
  const body = `<h1>Mapa del sitio</h1><div class="grid g3"><section><h2>Inicio</h2><ul><li><a href="#/">Página principal</a></li><li><a href="#/buscar">Buscador</a></li></ul></section>${nm.map(m => `<section><h2>${esc(m.label)}</h2><ul>${(m.items || [{ label: m.label, href: m.href }]).map(i => `<li><a ${linkAttrs(i.href)}>${esc(i.label)}</a>${i.ext ? ' <small>(externo)</small>' : ''}</li>`).join('')}</ul></section>`).join('')}<section><h2>Legal</h2><ul><li><a href="#/politica-de-privacidad">Política de privacidad</a></li><li><a href="#/terminos-de-uso">Términos de uso</a></li></ul></section></div><p><button class="btn sm sec" data-sm>Descargar sitemap.xml</button></p>`;
  return { html: shell(path, { title: 'Mapa del sitio', crumbs: [['Mapa del sitio']], banner: { title: 'Mapa del sitio' }, side: null, body }), after: () => $('[data-sm]').onclick = downloadSitemap };
});
function downloadSitemap() {
  const base = location.origin;
  const urls = ['/', '/programas', '/admision', '/matricula', '/becas', '/noticias', '/eventos', '/contacto', '/preguntas-frecuentes', '/mapa-del-sitio', '/servicios/mesa-de-partes', '/servicios/bolsa-laboral', '/servicios/consulta-certificados', '/servicios/complementarios'].concat(['presentacion', 'resena-historica', 'mision-vision', 'organizacion', 'reconocimientos', 'plana-jerarquica', 'plana-docente', 'campus-e-informes'].map(s => '/nosotros/' + s)).concat(['documentos-gestion', 'inversiones', 'libro-de-reclamaciones', 'licenciamiento', 'tupa', 'estadisticas', 'convocatorias'].map(s => '/transparencia/' + s)).concat(progs().map(p => '/programas/' + p.slug)).concat(pubNews().map(n => '/noticias/' + n.slug));
  urls.push(...extraPages().map(p => pageURL(p).slice(1)));
  downloadText(`\x3c?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${base}${u}</loc></url>`).join('\n')}\n</urlset>`, 'sitemap.xml', 'application/xml');
}
function searchPublicSite(query) {
  const normalized = normTitle(query).replace(/[^a-z0-9]+/g, ' ').trim();
  if (normalized.length < 2) return [];
  const words = [...new Set(normalized.split(/\s+/))];
  const results = [];
  const add = (title, url, kind, description, extra = '') => {
    if (!url || !safePortalLink(url)) return;
    const titleText = normTitle(title).replace(/[^a-z0-9]+/g, ' ');
    const text = normTitle([title, description, extra].join(' ')).replace(/[^a-z0-9]+/g, ' ');
    if (!words.every(word => text.includes(word))) return;
    const score = (titleText.trim() === normalized ? 100 : titleText.includes(normalized) ? 40 : 0) + words.filter(word => titleText.includes(word)).length;
    results.push({ t: title, u: url, k: kind, d: clamp(description, 160), score });
  };
  const pageRoutes = { presentacion: '#/nosotros/presentacion', resena: '#/nosotros/resena-historica', mision: '#/nosotros/mision-vision', organizacion: '#/nosotros/organizacion', reconocimientos: '#/nosotros/reconocimientos', jerarquica: '#/nosotros/plana-jerarquica', docentes: '#/nosotros/plana-docente', campus: '#/nosotros/campus-e-informes', privacidad: '#/politica-de-privacidad', terminos: '#/terminos-de-uso', faq: '#/preguntas-frecuentes' };
  P('paginas').filter(isPub).forEach(p => add(p.titulo, pageRoutes[p.clave] || '#/paginas/' + p.slug, 'Página', stripTags(p.contenido)));
  progs().forEach(p => add(p.nombre, '#/programas/' + p.slug, 'Programa de estudio', p.resumen || '', [p.codigo, stripTags(p.perfil), p.campo, ...(p.modulos || []).flatMap(m => [m.nombre, ...(m.uds || []).map(u => u.nombre)])].join(' ')));
  pubNews().forEach(n => add(n.titulo, '#/noticias/' + n.slug, 'Noticia', n.resumen || '', stripTags(n.contenido)));
  P('documentos').filter(d => d.estado === 'Publicado').forEach(d => add(d.nombre, '#/transparencia/documentos-gestion', 'Documento de gestión', d.descripcion || '', d.vigencia));
  P('personas').filter(p => isPub(p) && publicTeacherVisible(p)).forEach(p => {
    const role = P('jerarquica').find(j => isPub(j) && j.personaId === p.id);
    const url = role ? '#/nosotros/plana-jerarquica' : '#/nosotros/plana-docente?p=' + encodeURIComponent((p.programas || [])[0] || 'emp') + '&q=' + encodeURIComponent([p.nombres, p.apellidos].join(' ').trim());
    add(fullName(p), url, role ? 'Plana jerárquica' : 'Docente', [p.especialidad, role?.cargo].filter(Boolean).join(' · '));
  });
  [
    ['Admisión', '#/admision', 'Requisitos, modalidades, prospecto y resultados de admisión.'],
    ['Matrícula', '#/matricula', 'Requisitos, ratificación y orientación de matrícula.'],
    ['Becas', '#/becas', 'Consulta de beneficiarios y exoneraciones por mérito académico.'],
    ['Contacto y ubicación', '#/contacto', ['Dirección: ' + inst().direccion, 'Teléfono: ' + inst().telefono, 'Correo: ' + inst().correo].join(' · ')],
    ['Licenciamiento', '#/transparencia/licenciamiento', 'Información institucional sobre el proceso de licenciamiento.'],
    ['Estadísticas', '#/transparencia/estadisticas', 'Indicadores institucionales publicados.'],
    ['Inversiones y recursos económicos', '#/transparencia/inversiones', 'Información sobre inversiones institucionales publicadas.'],
    ['Convocatorias', '#/transparencia/convocatorias', 'Convocatorias institucionales publicadas.'],
    ['TUPA', '#/transparencia/tupa', 'Texto Único de Procedimientos Administrativos, tasas y costos.'],
    ['Mesa de Partes Virtual', '#/servicios/mesa-de-partes', 'Trámites, expedientes, solicitudes y documentos.'],
    ['Bolsa laboral', '#/servicios/bolsa-laboral', 'Trabajo, empleo, ofertas, prácticas y empresas.'],
    ['Consulta y verificación de documentos', '#/servicios/consulta-certificados', 'Certificados, títulos, constancias y códigos QR.'],
    ['Libro de Reclamaciones', '#/servicios/libro-de-reclamaciones', 'Registro y seguimiento de reclamos y quejas.'],
    ['Intranet institucional', '#/admin', 'Acceso a los servicios de docentes, estudiantes, egresados y empresas.']
  ].forEach(([title, url, description]) => add(title, url, 'Sección o servicio', description));
  P('tupa').filter(isPub).forEach(x => add(x.denominacion, '#/transparencia/tupa', 'TUPA', money(x.monto), [x.codigo, x.categoria].join(' ')));
  return results.sort((a, b) => b.score - a.score || a.t.localeCompare(b.t, 'es'));
}
R('buscar', (path, q) => {
  const s = (q.get('q') || '').trim(); const res = searchPublicSite(s);
  const tooShort = normTitle(s).replace(/[^a-z0-9]+/g, ' ').trim().length < 2;
  const body = `<h1>Buscar en el sitio</h1><form data-bs role="search" style="display:flex;gap:8px;max-width:600px;margin-bottom:18px"><label class="sr-only" for="bs-q">Términos de búsqueda</label><input class="inp" id="bs-q" name="q" value="${esc(s)}" placeholder="¿Qué estás buscando?"><button class="btn">Buscar</button></form>${s ? `<p role="status">${res.length} resultado(s) para “<b>${esc(s)}</b>”</p>` : ''}${res.map(r => `<article class="card cb" style="margin-bottom:10px"><span class="badge">${esc(r.k)}</span><h2 style="font-size:17px;margin:6px 0 4px"><a href="${esc(r.u)}">${esc(r.t)}</a></h2><p style="margin:0;font-size:14px;color:var(--ink2)">${esc(r.d)}</p></article>`).join('') || (s ? tooShort ? '<p class="notice" role="status">Escribe al menos dos letras o números para buscar.</p>' : '<div class="empty">No se encontraron resultados. Intente con otras palabras.</div>' : '')}`;
  return { html: shell(path, { title: 'Buscar', crumbs: [['Buscar']], banner: { title: 'Buscador' }, side: null, body }), after: () => $('[data-bs]').onsubmit = e => { e.preventDefault(); go('#/buscar?q=' + encodeURIComponent($('#bs-q').value.trim())); } };
});
function notFound(path) { return shell(path, { title: 'Página no encontrada', crumbs: [['Página no encontrada']], side: null, body: `<div class="empty" style="padding:50px"><h1 style="font-size:28px">Página no encontrada</h1><p>La página que buscas no existe o no está publicada.</p><a class="btn" href="#/">Ir al inicio</a> <a class="btn sec" href="#/mapa-del-sitio">Ver mapa del sitio</a></div>` }); }

/* ---------- Visor de fotos de noticias ---------- */
function openGallery(fotos, start, title) {
  let k = start; const dlg = document.createElement('dialog'); dlg.className = 'lbx'; dlg.setAttribute('aria-label', 'Fotos: ' + title);
  dlg.innerHTML = `<img alt=""><p class="lbx-c"></p><button type="button" class="lbx-x" aria-label="Cerrar">✕</button>${fotos.length > 1 ? '<button type="button" class="lbx-p" aria-label="Foto anterior">‹</button><button type="button" class="lbx-n" aria-label="Foto siguiente">›</button>' : ''}`;
  const show = i => { k = (i + fotos.length) % fotos.length; const im = $('img', dlg); im.src = img(fotos[k]); im.alt = `Foto ${k + 1} de ${fotos.length}: ${title}`; $('.lbx-c', dlg).textContent = `${title} · ${k + 1} / ${fotos.length}`; };
  $('.lbx-x', dlg).onclick = () => dlg.close();
  if (fotos.length > 1) { $('.lbx-p', dlg).onclick = () => show(k - 1); $('.lbx-n', dlg).onclick = () => show(k + 1); }
  dlg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(k - 1); if (e.key === 'ArrowRight') show(k + 1); });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => dlg.parentNode && dlg.parentNode.removeChild(dlg));
  document.body.appendChild(dlg); show(k); dlg.showModal();
}

/* ---------- Comportamiento común del portal ---------- */
function bindPublicChrome() {
  let tt = $('.to-top'); if (!tt) { tt = document.createElement('button'); tt.className = 'to-top'; tt.setAttribute('aria-label', 'Volver arriba'); tt.innerHTML = ic('arrowup'); tt.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' }); document.body.appendChild(tt); window.addEventListener('scroll', () => tt.classList.toggle('show', scrollY > 600 && !document.body.classList.contains('is-admin')), { passive: true }); }
  revealOnScroll();
  const hd = $('.mainnav'); if (hd && !window.__navSh) { window.__navSh = true; window.addEventListener('scroll', () => { const n = $('.mainnav'); n && n.classList.toggle('scrolled', scrollY > 140); }, { passive: true }); }
  const nav = $('#mainnav'); const mb = $('[data-menu]');
  if (mb) mb.onclick = () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); };
  $$('.mainnav button.top').forEach(b => {
    b.onclick = () => { const li = b.parentNode; const o = !li.classList.contains('open'); $$('.mainnav li.open').forEach(x => { x.classList.remove('open'); $('button', x).setAttribute('aria-expanded', 'false'); }); if (o) { li.classList.add('open'); b.setAttribute('aria-expanded', 'true'); } };
    b.parentNode.addEventListener('keydown', e => { if (e.key === 'Escape') { b.parentNode.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); b.focus(); } });
  });
  if(!window.__publicNavOutside){window.__publicNavOutside=true;document.addEventListener('click', e => { if(!e.target.closest('.mainnav li'))$$('.mainnav li.open').forEach(x => {x.classList.remove('open');$('button.top',x)?.setAttribute('aria-expanded','false');}); });}
  const uh = $('.u-head'); if (uh) {
    // Elige la cabecera más amplia que quepa sin superponerse: una fila con nombre, una fila solo con logotipo o el menú en una segunda fila.
    const fit = () => { const h = $('.u-head'); if (!h) return; h.classList.remove('u-fit-1', 'u-fit-2'); if (matchMedia('(max-width:900px)').matches) return;
      const ul = $('.mainnav>.wrap>ul', h), tools = $('.u-tools', h), nav = $('.mainnav', h);
      const over = () => { const last = ul.lastElementChild; return ul.scrollWidth > nav.clientWidth + 1 || (last && last.getBoundingClientRect().right > tools.getBoundingClientRect().left - 6) || document.documentElement.scrollWidth > innerWidth + 1; };
      if (!over()) return; h.classList.add('u-fit-1'); if (!over()) return; h.classList.remove('u-fit-1'); h.classList.add('u-fit-2'); };
    fit(); window.__uFit = fit;
    const sc = () => { const h = $('.u-head'); if (h) h.classList.toggle('u-sc', scrollY > 140); }; sc();
    if (!window.__uScBound) { window.__uScBound = true; addEventListener('scroll', sc, { passive: true }); }
    if (!window.__uFitBound) { window.__uFitBound = true; let tm; addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(() => window.__uFit && window.__uFit(), 80); }, { passive: true }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => window.__uFit && window.__uFit()); }
  }
  const ua = $('.u-acc-b'); if (ua) { const m = $('#u-acc'); ua.onclick = e => { e.stopPropagation(); const o = !m.classList.contains('open'); m.classList.toggle('open', o); ua.setAttribute('aria-expanded', o); }; if (!window.__uAccOut) { window.__uAccOut = true; document.addEventListener('click', e => { const mm = $('#u-acc'); if (mm && !e.target.closest('.u-acc')) { mm.classList.remove('open'); const b = $('.u-acc-b'); b && b.setAttribute('aria-expanded', 'false'); } }); } }
  if (ua) { const box = $('.u-acc'), m = $('#u-acc'); const close = focus => { m.classList.remove('open'); ua.setAttribute('aria-expanded', 'false'); if (focus) ua.focus(); };
    box.addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('open')) { e.stopPropagation(); close(true); } });
    box.addEventListener('focusout', e => { if (e.relatedTarget && !box.contains(e.relatedTarget)) close(false); }); }
  $$('[data-iach]').forEach(sec => { if (!sec.matches('section')) return; const its = $$('.i-ach-i', sec); let k = 0;
    $$('button[data-iach]', sec).forEach(b => b.onclick = () => { its[k].hidden = true; its[k].classList.remove('on'); k = (k + (+b.dataset.iach) + its.length) % its.length; its[k].hidden = false; its[k].classList.add('on'); cifInit(its[k]); }); });
  if ($('.k-head')) { const ksc = () => { const h = $('.k-head'); if (h) h.classList.toggle('k-sc', scrollY > 60); }; ksc(); if (!window.__kScBound) { window.__kScBound = true; addEventListener('scroll', ksc, { passive: true }); } }
  $$('[data-htabgroup]').forEach(g => { const bs = $$('[data-htab]', g), ps = $$('[data-hpane]', g); let k = 0;
    const show = n => { k = (n + bs.length) % bs.length; bs.forEach((b, x) => { b.setAttribute('aria-selected', x === k ? 'true' : 'false'); b.tabIndex = x === k ? 0 : -1; }); ps.forEach((p, x) => { p.hidden = x !== k; }); };
    bs.forEach((b, x) => { b.onclick = () => show(x); b.onkeydown = e => { if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); show(k + 1); bs[k].focus(); } if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); show(k - 1); bs[k].focus(); } }; });
    $$('[data-hstep]', g).forEach(b => b.onclick = () => show(k + (+b.dataset.hstep))); show(0); });
  const us = $('.u-sb'); if (us) { const f = $('#u-srch'); us.onclick = () => { f.hidden = !f.hidden; us.setAttribute('aria-expanded', !f.hidden); if (!f.hidden) $('input', f).focus(); };
    f.addEventListener('keydown', e => { if (e.key === 'Escape') { f.hidden = true; us.setAttribute('aria-expanded', 'false'); us.focus(); } }); }
  $$('.u-car').forEach(c => { const t = $('.pcar-t', c); let d = c.nextElementSibling; if (!d || !d.classList.contains('u-dots')) { d = document.createElement('div'); d.className = 'u-dots'; c.after(d); }
    const pages = () => Math.max(1, Math.ceil(t.scrollWidth / Math.max(1, t.clientWidth) - 0.05));
    const curPage = n => { const max = t.scrollWidth - t.clientWidth; return max > 0 ? Math.round(t.scrollLeft / max * (n - 1)) : 0; };
    const draw = () => { const n = pages(); if (n < 2) { d.innerHTML = ''; d.dataset.n = '1'; return; }
      if (d.dataset.n !== String(n)) { d.dataset.n = String(n); d.innerHTML = Array.from({ length: n }, (_, k) => `<button type="button" aria-label="Ir al grupo ${k + 1} de ${n}"></button>`).join(''); $$('button', d).forEach((b, k) => b.onclick = () => t.scrollTo({ left: (t.scrollWidth - t.clientWidth) * k / (n - 1), behavior: 'smooth' })); }
      const k = curPage(n); $$('button', d).forEach((b, i) => b.toggleAttribute('aria-current', i === k)); };
    draw(); t.addEventListener('scroll', () => { clearTimeout(t.__ud); t.__ud = setTimeout(draw, 90); }, { passive: true }); c.__uDraw = draw; });
  if (!window.__uDotsResize) { window.__uDotsResize = true; window.addEventListener('resize', () => $$('.u-car').forEach(c => c.__uDraw && c.__uDraw()), { passive: true }); }
  $$('[data-search]').forEach(f => f.onsubmit = e => { e.preventDefault(); go('#/buscar?q=' + encodeURIComponent(f.elements.namedItem('q').value.trim())); });
  // carrusel de programas
  cifInit();
  $$('[data-pcar]').forEach(c => {
    const t = $('.pcar-t', c); let paused = false;
    const step = d => { const it = $('.pcar-i', t); const w = (it ? it.getBoundingClientRect().width : 280) + (parseFloat(getComputedStyle(t).columnGap) || 0); const max = t.scrollWidth - t.clientWidth - 4;
      if (d > 0 && t.scrollLeft >= max) t.scrollTo({ left: 0, behavior: 'smooth' }); else if (d < 0 && t.scrollLeft <= 4) t.scrollTo({ left: t.scrollWidth, behavior: 'smooth' }); else t.scrollBy({ left: d * w, behavior: 'smooth' }); };
    $$('[data-pcar-b]', c).forEach(b => b.onclick = () => step(+b.dataset.pcarB));
    c.onmouseenter = () => paused = true; c.onmouseleave = () => paused = false; c.addEventListener('focusin', () => paused = true); c.addEventListener('focusout', () => paused = false); t.addEventListener('touchstart', () => paused = true, { passive: true });
    if (PREVIEW || c.hasAttribute('data-pcar-static') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => { if (!document.body.contains(c)) return clearInterval(id); if (!paused && !document.hidden) step(1); }, 5000);
  });
  // carrusel
  const slides = $$('.slide');
  heroAutoFit();
  if (slides.length > 1) {
    let k = 0, paused = false; const show = n => { k = (n + slides.length) % slides.length;
      // Solo se descargan la diapositiva visible y la siguiente (antes bajaban todas, ~9 MB en la portada).
      [k, (k + 1) % slides.length].forEach(j => { slides[j].querySelectorAll('img[data-src]').forEach(im => { im.src = im.dataset.src; im.removeAttribute('data-src'); }); }); slides.forEach((s, i) => { s.classList.toggle('on', i === k); s.inert = i !== k; if (i === k) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true'); }); $$('[data-dot]').forEach((d, i) => d.setAttribute('aria-current', i === k)); };
    show(0);
    $$('[data-sl]').forEach(b => b.onclick = () => show(k + +b.dataset.sl)); $$('[data-dot]').forEach(b => b.onclick = () => show(+b.dataset.dot));
    const hero = $('.hero'); hero.onmouseenter = () => paused = true; hero.onmouseleave = () => paused = false; hero.addEventListener('focusin', () => paused = true); hero.addEventListener('focusout', () => paused = false);
    if (!PREVIEW && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.__sl = setInterval(() => { if (!paused && !document.hidden && document.body.contains(hero)) show(k + 1); }, 6000);
    }
  }
}
/* Ajuste automático: una imagen mucho más alta que el carrusel (afiche) se muestra completa, con los bordes difuminados. */
function heroAutoFit() {
  const hero = $('.hero'); if (!hero) return;
  // Lo que tapan los bloques que suben sobre el carrusel (accesos rápidos): las imágenes completas terminan por encima.
  let nx = hero.nextElementSibling; while (nx && !nx.offsetHeight) nx = nx.nextElementSibling;
  hero.style.setProperty('--sl-pad', (nx ? Math.max(0, Math.round(hero.getBoundingClientRect().bottom - nx.getBoundingClientRect().top)) : 0) + 'px');
  const fit = () => $$('.slide.sl-auto', hero).forEach(s => { const im = s.querySelector('.sl-img'); if (!im || !im.naturalWidth || !hero.offsetHeight) return;
    s.classList.toggle('sl-contain', im.naturalWidth / im.naturalHeight < (hero.offsetWidth / hero.offsetHeight) * .8); });
  $$('.slide.sl-auto .sl-img', hero).forEach(im => { if (im.complete && im.naturalWidth) fit(); else im.addEventListener('load', fit, { once: true }); });
  if (!window.__heroFitBound) { window.__heroFitBound = true; let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (document.querySelector('.hero')) heroAutoFit(); }, 200); }); }
}
function revealOnScroll() {
  if (PREVIEW || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const els = $$('#app .sec-h, #app .card, #app .stat, #app .welcome > *, #app .person, #app .collage figure').filter(e => !e.closest('.modal'));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -40px 0px' });
  window.__publicReveal = io;
  els.forEach((e, i) => { const r = e.getBoundingClientRect(); if (r.top < innerHeight) return; e.classList.add('rv'); e.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(e); });
}
function maybePopup() {
  const p = DB.config.popup; if (!p.activo || PREVIEW) return;
  const today = localYmd(); if ((p.inicio && today < p.inicio) || (p.fin && today > p.fin)) return;
  try { if (sessionStorage.getItem('popup_seen')) return; sessionStorage.setItem('popup_seen', '1'); } catch (e) { }
  if (p.modelo === 'promocional') return promoPopup(p);
  const m = modal({ title: esc(p.titulo), size: 'sm', body: `${p.imagen ? `<img src="${img(p.imagen)}" alt="" style="border-radius:10px;margin-bottom:12px;aspect-ratio:16/10;object-fit:cover;width:100%">` : ''}<p>${esc(p.texto)}</p>`, foot: resolveLink(p.enlace) ? `<a class="btn gold" ${linkAttrs(resolveLink(p.enlace))} data-go>${esc(p.boton || 'Ver más')}</a>` : '' });
  const g = $('[data-go]', m.el); if (g) g.addEventListener('click', () => m.close());
}

/* Ventana emergente «Promocional»: imagen a todo el fondo, título destacado y tarjetas encadenadas con flechas */
const POP_TARJETAS = [1, 2, 3, 4];
function promoCards(p) { return POP_TARJETAS.map(k => ({ t: String(p['t' + k] || '').trim(), d: String(p['d' + k] || '').trim() })).filter(c => c.t || c.d); }
function promoHTML(p) {
  const cs = promoCards(p); const i = inst();
  return `<div class="pp" role="dialog" aria-modal="true" aria-labelledby="pp-t" ${p.texto ? 'aria-describedby="pp-d"' : ''}>
    ${p.imagen ? `<img class="pp-bg" src="${img(p.imagen)}" alt="">` : ''}<i class="pp-shade" aria-hidden="true"></i>
    <button type="button" class="pp-x" aria-label="Cerrar ventana">✕</button>
    <div class="pp-top"><span class="pp-logo${brandLong() ? ' b-long' : ''}"><img src="${logoSrc()}" alt=""><b>${esc(brandSigla())}</b></span>${p.etiqueta ? `<span class="pp-tag">${esc(p.etiqueta)}</span>` : ''}</div>
    <div class="pp-main">${p.antetitulo ? `<p class="pp-pre">${esc(p.antetitulo)}</p>` : ''}<h2 id="pp-t">${esc(p.titulo)}</h2>${p.texto ? `<p class="pp-txt" id="pp-d">${esc(p.texto)}</p>` : ''}</div>
    ${cs.length ? `<ol class="pp-cards pp-n${cs.length}">${cs.map((c, k) => `<li class="${k === cs.length - 1 && cs.length > 1 ? 'pp-last' : ''}">${c.t ? `<b>${esc(c.t)}</b>` : ''}${c.d ? `<span>${esc(c.d)}</span>` : ''}${k < cs.length - 1 ? '<i class="pp-arr" aria-hidden="true"></i>' : ''}</li>`).join('')}</ol>` : ''}
    ${resolveLink(p.enlace) ? `<p class="pp-cta"><a class="pp-btn" ${linkAttrs(resolveLink(p.enlace))} data-go>${esc(p.boton || 'Ver más')} <span aria-hidden="true">→</span></a></p>` : ''}
  </div>`;
}
function promoPopup(p) {
  const bg = document.createElement('div'); bg.className = 'pp-wrap'; bg.innerHTML = promoHTML(p);
  const prev = document.activeElement;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); document.documentElement.classList.remove('pp-open'); prev && prev.focus && prev.focus(); };
  const onKey = e => { if (e.key === 'Escape') close(); if (e.key === 'Tab') { const f = $$('a[href],button', bg); const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } };
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  $('.pp-x', bg).onclick = close; const g = $('[data-go]', bg); if (g) g.addEventListener('click', close);
  document.addEventListener('keydown', onKey); document.body.appendChild(bg); document.documentElement.classList.add('pp-open');
  setTimeout(() => $('.pp-x', bg).focus(), 30);
  return { el: bg, close };
}

/* vista previa desde Portada › Ventana emergente */
if (!window.__popPrev) { window.__popPrev = true; document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-popprev]'); if (!b) return; const f = b.closest('form') || document; const w = Object.assign({}, DB.config.popup); $$('[name]', f).forEach(x => { if (x.type === 'checkbox') w[x.name] = x.checked; else if (x.type !== 'file') w[x.name] = x.value; }); if (ADM.work && ADM.workKey && /Ventana emergente/.test(ADM.workKey)) Object.assign(w, { imagen: ADM.work.imagen }); if (!w.titulo) w.titulo = 'Título de la ventana'; if (w.modelo === 'promocional') { const pv = promoPopup(w); $$('a', pv.el).forEach(a => { a.removeAttribute('href'); a.removeAttribute('target'); a.setAttribute('aria-disabled', 'true'); a.style.cursor = 'default'; a.onclick = ev => ev.preventDefault(); }); } else { const m = modal({ title: esc(w.titulo), size: 'sm', body: `${w.imagen ? `<img src="${img(w.imagen)}" alt="" style="border-radius:10px;margin-bottom:12px;aspect-ratio:16/10;object-fit:cover;width:100%">` : ''}<p>${esc(w.texto || '')}</p>`, foot: w.enlace ? `<span class="btn gold">${esc(w.boton || 'Ver más')}</span>` : '' }); } }); }

/* ==== admin1.js ==== */
/* =========================================================
   PANEL ADMINISTRATIVO – marco general y CRUD genérico
   ========================================================= */
const ADM = { state: {} };
const NAV_GROUPS = [
  ['General', [['dashboard', 'home'], ['aprobaciones', 'check']]],
  ['Contenidos', [['paginas', 'file'], ['portada', 'image'], ['noticias', 'list'], ['eventos', 'calendar']]],
  ['Nosotros', [['jerarquica', 'users'], ['docentes', 'user'], ['locales', 'map']]],
  ['Gestión académica', [['programas', 'grad'], ['ix-alumnos', 'users'], ['ix-horarios', 'calendar'], ['ix-certificados', 'award'], ['ix-titulos', 'grad'], ['egresados', 'award'], ['admision', 'clipboard'], ['matricula', 'book'], ['becas', 'star'], ['certificados', 'shield']]],
  ['Transparencia', [['documentos', 'file'], ['tupa', 'money'], ['estadisticas', 'chart'], ['licenciamiento', 'shield'], ['inversiones', 'building'], ['convocatorias', 'briefcase']]],
  ['Atención al ciudadano', [['mensajes', 'mail'], ['reclamos', 'book'], ['expedientes', 'inbox']]],
  ['Servicios', [['ix-bolsa', 'briefcase'], ['enlaces', 'link'], ['servicios', 'heart']]],
  ['Configuración y seguridad', [['config', 'gear'], ['ix-config', 'calendar'], ['temas', 'palette'], ['usuarios', 'key'], ['auditoria', 'history'], ['respaldo', 'database']]],
];
const pendingCount = () => ['documentos', 'convocatorias', 'admisiones'].reduce((a, c) => a + coll(c).filter(x => x.estado === 'En revisión' && !x.deleted).length, 0);
function admShell(active, content) {
  const u = currentUser(); const r = role();
  const cnt = { mensajes: coll('mensajes').filter(m => m.estado === 'Nuevo' && !m.deleted).length, reclamos: coll('reclamos').filter(m => m.estado === 'Recibido' && !m.anulado).length, expedientes: coll('expedientes').filter(m => m.estado === 'Recibido').length, aprobaciones: pendingCount() };
  const side = NAV_GROUPS.map(([g, items]) => { const its = items.filter(([m]) => can(m)); return its.length ? `<h3>${g}</h3>${its.map(([m, i]) => `<a href="#/admin/${m}" ${m === active ? 'aria-current="page"' : ''}>${ic(i)}<span>${MODULES[m]}</span>${cnt[m] ? `<span class="cnt">${cnt[m]}</span>` : ''}</a>`).join('')}` : ''; }).join('');
  const notif = cnt.mensajes * can('mensajes') + cnt.reclamos * can('reclamos') + cnt.aprobaciones * can('aprobaciones');
  return `<div class="adm"><aside class="adm-side" id="admside" aria-label="Menú del panel"><a class="brand" href="#/admin"><img src="${logoSrc()}" alt=""><span><strong>${esc(inst().nombreCorto)}</strong><small>${r.community ? 'Intranet institucional' : 'Intranet · Panel administrativo'}</small></span></a><nav>${side}</nav><div style="margin-top:auto;padding:14px 16px;font-size:12px;color:rgba(255,255,255,.6)">${esc(inst().nombre)}</div></aside>
  <div style="min-width:0"><header class="adm-top"><button class="tbtn adm-menu" data-admmenu aria-label="Abrir menú">${ic('menu').replace('<svg', '<svg style="width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2"')}</button><span style="font-family:var(--fh);font-style:italic;font-size:14px" class="hide-sm">“${esc(inst().lema)}”</span><span class="sp"></span>${can('temas') ? `<a class="tbtn" href="#/admin/temas" title="Temas y apariencia">${ic('palette').replace('<svg', '<svg style="width:16px;height:16px;stroke:#fff;fill:none;stroke-width:2"')} Apariencia</a>` : ''}
  <a class="tbtn" href="#/admin/${notif ? (cnt.aprobaciones && can('aprobaciones') ? 'aprobaciones' : cnt.reclamos && can('reclamos') ? 'reclamos' : 'mensajes') : 'dashboard'}" aria-label="${notif} pendientes">${ic('bell').replace('<svg', '<svg style="width:17px;height:17px;stroke:#fff;fill:none;stroke-width:2"')}${notif ? `<span class="cnt" style="background:var(--err);border-radius:999px;padding:0 6px;font-size:11px">${notif}</span>` : ''}</a>
  <a class="tbtn" href="#/" target="_blank" rel="noopener">${ic('ext').replace('<svg', '<svg style="width:15px;height:15px;stroke:#fff;fill:none;stroke-width:2"')} Ver sitio web</a>
  <div class="user"><img src="${img('ph:person:m|' + u.nombre)}" alt=""><div>${esc(u.nombre)}<small>${esc(r.label)}</small></div></div><button class="tbtn" data-logout>${ic('logout').replace('<svg', '<svg style="width:15px;height:15px;stroke:#fff;fill:none;stroke-width:2"')} Salir</button></header>
  <main class="adm-main" id="contenido" tabindex="-1">${content}</main><footer style="padding:10px 22px;font-size:12px;color:var(--muted);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><span>© ${yearNow()} ${esc(inst().nombreCorto)}. Todos los derechos reservados.</span><span>Intranet institucional · Portal Web 2026</span></footer></div></div>`;
}
function admHead(title, sub = '', acts = '', icon = 'file', crumbs = []) {
  return `<div class="adm-crumb"><a href="#/admin">Inicio</a>${crumbs.map(c => ` › ${c[1] ? `<a href="${c[1]}">${esc(c[0])}</a>` : esc(c[0])}`).join('')}</div><div class="adm-head"><div><h1>${ic(icon).replace('<svg', '<svg style="width:26px;height:26px;stroke:var(--link);fill:none;stroke-width:2"')} ${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="acts">${acts}</div></div>`;
}
function bindAdmChrome() {
  const lo = $('[data-logout]'); if (lo) lo.onclick = () => { audit('Cierre de sesión', 'Sesión', currentUser().usuario); saveDB(); setSession(null); go('#/admin'); };
  const mm = $('[data-admmenu]'); if (mm) mm.onclick = () => $('#admside').classList.toggle('open');
}
const stBadge = s => { const m = { Publicado: 'ok', Publicada: 'ok', Activo: 'ok', Vigente: 'ok', Válido: 'ok', Atendido: 'ok', Enviado: 'ok', Borrador: 'gray', Inactivo: 'gray', Despublicado: 'gray', Despublicada: 'gray', Archivada: 'gray', Histórico: 'gray', Cerrado: 'gray', Leído: 'gray', 'En revisión': 'violet', Recibido: 'warn', Nuevo: 'warn', 'En atención': 'warn', Pendiente: 'warn', 'En proceso': 'warn', Error: 'err', Anulado: 'err', Eliminado: 'err', Observado: 'err' }; return `<span class="badge ${m[s] || ''}">${esc(s)}</span>`; };
const ib = (act, icon, label, cls = '') => `<button class="icon-btn ${cls}" data-act="${act}" title="${label}" aria-label="${label}">${ic(icon)}</button>`;

/* ---------- Login ---------- */
function loginView() {
  return `<div class="login"><div class="card"><a class="brand" href="#/"><img src="${logoSrc()}" alt=""><span><strong>${esc(inst().nombreCorto)}</strong><small>Intranet institucional</small></span></a>
  <h1 style="font-size:20px;text-align:center">Iniciar sesión</h1><p style="text-align:center;color:var(--muted);font-size:13.5px;margin:-4px 0 12px">Un solo acceso para personal, docentes, estudiantes, egresados y empresas.</p><form data-login novalidate><div class="field"><label for="lg-u">Usuario</label><input id="lg-u" name="u" autocomplete="username" required></div><div class="field" style="margin-top:10px"><label for="lg-p">Contraseña</label><input id="lg-p" name="p" type="password" autocomplete="current-password" required></div><div id="lg-e" role="alert" style="color:var(--err);font-size:13.5px;margin-top:8px"></div><button class="btn" style="width:100%;margin-top:12px">${ic('lock').replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"')} Ingresar</button></form>
  <p style="font-size:12.5px;color:var(--muted);margin:14px 0 4px">Las cuentas son administradas por la institución. Tras 5 intentos fallidos la cuenta se bloquea 5 minutos.</p><div class="demo-users">${DEMO_USERS.map(([u, p, l]) => `<button type="button" data-du="${u}|${p}"><b>${u}</b> · ${l}</button>`).join('')}</div>
  <p style="text-align:center;margin:14px 0 0"><a href="#/">← Volver al portal</a></p></div></div>`;
}
function bindLogin(){const f=$('[data-login]');if(f)f.onsubmit=e=>{e.preventDefault();$('#lg-e').textContent='Recarga la página para conectar con el servicio de autenticación.';};}

/* ---------- Editor de texto enriquecido ---------- */
function rteHTML(name, value, label) {
  const B = (cmd, icon, t, txt) => `<button type="button" data-cmd="${cmd}" title="${t}" aria-label="${t}">${txt || ic(icon)}</button>`;
  const sep = '<span class="rte-sep" aria-hidden="true"></span>';
  return `<div class="rte" data-rte="${name}"><div class="rte-bar" role="toolbar" aria-label="Formato de ${esc(label)}">
  <select data-cmd="formatBlock" aria-label="Estilo de párrafo" title="Estilo de párrafo"><option value="p">Párrafo</option><option value="h2">Título 1</option><option value="h3">Título 2</option><option value="h4">Subtítulo</option><option value="blockquote">Cita destacada</option></select>
  <select data-cmd="fontSize" aria-label="Tamaño del texto" title="Tamaño del texto"><option value="">Tamaño</option><option value="2">Pequeño</option><option value="3">Normal</option><option value="5">Grande</option><option value="6">Muy grande</option></select>${sep}
  ${B('bold', '', 'Negrita (Ctrl+B)', '<b>B</b>')}${B('italic', '', 'Cursiva (Ctrl+I)', '<i style="font-family:Georgia,serif">I</i>')}${B('underline', '', 'Subrayado (Ctrl+U)', '<u>U</u>')}${B('strikeThrough', '', 'Tachado', '<s>S</s>')}${B('superscript', '', 'Superíndice', 'x<sup>2</sup>')}${B('subscript', '', 'Subíndice', 'x<sub>2</sub>')}
  <span class="rte-pop"><button type="button" data-pop="color" title="Color del texto" aria-label="Color del texto" aria-haspopup="true">${ic('textcolor')}</button><span class="rte-menu" data-menu-of="color">${Object.entries(RTE_COLORS).map(([k, [h, l]]) => `<button type="button" data-color="${h}" title="${l}" aria-label="${l}" style="background:${h}"></button>`).join('')}<button type="button" data-color="" title="Color automático" aria-label="Color automático" class="auto">A</button></span></span>
  ${B('mark', 'marker', 'Resaltar texto')}${sep}
  ${B('justifyLeft', 'alignl', 'Alinear a la izquierda')}${B('justifyCenter', 'alignc', 'Centrar')}${B('justifyRight', 'alignr', 'Alinear a la derecha')}${B('justifyFull', 'alignj', 'Justificar')}${sep}
  ${B('insertUnorderedList', 'ul', 'Lista con viñetas')}${B('insertOrderedList', 'ol', 'Lista numerada')}${B('table', 'table', 'Insertar tabla')}${B('insertHorizontalRule', 'hr', 'Línea separadora')}${sep}
  ${B('link', 'link', 'Insertar enlace')}${B('unlink', 'unlink', 'Quitar enlace')}${B('image', 'image', 'Insertar imagen')}${sep}
  ${B('removeFormat', 'eraser', 'Quitar formato')}${B('undo', 'undo', 'Deshacer (Ctrl+Z)')}${B('redo', 'redo', 'Rehacer (Ctrl+Y)')}${B('full', 'expand', 'Pantalla completa')}
  </div><div class="rte-area prose" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${esc(label)}" data-name="${name}">${sanitize(value || '')}</div><div class="rte-foot"><span data-path></span><span>Palabras: <span data-wc>0</span></span></div></div>`;
}
const RTE_STATE = ['bold', 'italic', 'underline', 'strikeThrough', 'superscript', 'subscript', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'insertUnorderedList', 'insertOrderedList'];
function bindRTE(root, onChange) {
  $$('[data-rte]', root).forEach(box => {
    const area = $('.rte-area', box); const save = () => onChange && onChange(box.dataset.rte, area.innerHTML);
    const wc = () => $('[data-wc]', box).textContent = (area.textContent.trim().match(/\S+/g) || []).length; wc();
    try { document.execCommand('styleWithCSS', false, false); document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { }
    let saved = null; const keep = () => { const sl = getSelection(); if (sl.rangeCount && area.contains(sl.anchorNode)) saved = sl.getRangeAt(0).cloneRange(); };
    const restore = () => { area.focus(); if (saved) { const sl = getSelection(); sl.removeAllRanges(); sl.addRange(saved); } };
    const sync = () => {
      if (!area.isConnected) return document.removeEventListener('selectionchange', sync);
      if (!area.contains(getSelection().anchorNode)) return; keep();
      RTE_STATE.forEach(c => { const b = $(`[data-cmd="${c}"]`, box); if (b) { let on = false; try { on = document.queryCommandState(c); } catch (e) { } b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); } });
      let blk = ''; try { blk = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch (e) { }
      const fb = $('[data-cmd="formatBlock"]', box); if (['p', 'h2', 'h3', 'h4', 'blockquote'].includes(blk)) fb.value = blk;
      const names = { p: 'Párrafo', h2: 'Título 1', h3: 'Título 2', h4: 'Subtítulo', blockquote: 'Cita', li: 'Lista', td: 'Tabla', th: 'Tabla' };
      let n = getSelection().anchorNode; let path = ''; while (n && n !== area) { if (n.nodeType === 1 && names[n.tagName.toLowerCase()]) { path = names[n.tagName.toLowerCase()]; break; } n = n.parentNode; }
      $('[data-path]', box).textContent = path ? 'Bloque: ' + path : '';
    };
    document.addEventListener('selectionchange', sync);
    area.addEventListener('input', () => { wc(); save(); });
    area.addEventListener('keyup', sync); area.addEventListener('mouseup', sync);
    area.addEventListener('paste', e => { e.preventDefault(); const html = e.clipboardData.getData('text/html'); const txt = e.clipboardData.getData('text/plain'); document.execCommand('insertHTML', false, html ? sanitize(html) : esc(txt).replace(/\n/g, '<br>')); });
    $$('.rte-bar button, .rte-bar select', box).forEach(b => b.addEventListener('mousedown', e => { if (b.tagName === 'BUTTON') e.preventDefault(); keep(); }));
    const pop = $('[data-pop="color"]', box); const menu = $('[data-menu-of="color"]', box);
    pop.onclick = e => { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', e => { if (!e.target.closest('.rte-pop')) menu.classList.remove('open'); });
    $$('[data-color]', menu).forEach(c => c.onclick = () => { restore(); if (c.dataset.color) document.execCommand('foreColor', false, c.dataset.color); else { document.execCommand('foreColor', false, '#000001'); area.querySelectorAll('font[color="#000001"]').forEach(f => f.replaceWith(...f.childNodes)); } menu.classList.remove('open'); save(); });
    $$('[data-cmd]', box).forEach(b => {
      const run = async () => {
        const c = b.dataset.cmd; restore();
        if (c === 'formatBlock') document.execCommand('formatBlock', false, b.value);
        else if (c === 'fontSize') { if (b.value) document.execCommand('fontSize', false, b.value); b.value = ''; }
        else if (c === 'mark') { const inMark = (() => { let n = getSelection().anchorNode; while (n && n !== area) { if (n.nodeName === 'MARK') return n; n = n.parentNode; } })(); if (inMark) inMark.replaceWith(...inMark.childNodes); else { const sl = getSelection(); if (sl.isCollapsed) return toast('Seleccione el texto que desea resaltar.'); const r = sl.getRangeAt(0); const mk = document.createElement('mark'); try { r.surroundContents(mk); } catch (e) { mk.appendChild(r.extractContents()); r.insertNode(mk); } } }
        else if (c === 'table') { const v = await promptBox('Filas y columnas (ejemplo: 3x3):', { title: 'Insertar tabla', value: '3x3' }); restore(); const m = /^(\d{1,2})\s*[x×]\s*(\d{1,2})$/i.exec((v || '').trim()); if (!v) return; if (!m) return toast('Use el formato filas x columnas, por ejemplo 3x3.', 'err'); const R = Math.min(+m[1], 30), C = Math.min(+m[2], 8); document.execCommand('insertHTML', false, `<table><thead><tr>${'<th>Encabezado</th>'.repeat(C)}</tr></thead><tbody>${('<tr>' + '<td>&nbsp;</td>'.repeat(C) + '</tr>').repeat(Math.max(R - 1, 1))}</tbody></table><p><br></p>`); }
        else if (c === 'link') { const u = await promptBox('URL del enlace (https://…, #/ruta interna o mailto:):', { title: 'Insertar enlace', value: 'https://' }); restore(); if (u && /^(https?:\/\/|#\/|mailto:|tel:)/.test(u)) document.execCommand('createLink', false, u); else if (u) toast('URL no válida', 'err'); }
        else if (c === 'image') { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const er = checkFile(f, 'image'); if (er) return toast(er, 'err'); const d = await compressImage(f, 1000); restore(); document.execCommand('insertImage', false, d); save(); }; inp.click(); }
        else if (c === 'removeFormat') { document.execCommand('removeFormat'); const sl = getSelection(); if (sl.rangeCount) { const r = sl.getRangeAt(0); area.querySelectorAll('mark,span').forEach(m => { if (r.intersectsNode(m)) m.replaceWith(...m.childNodes); }); } }
        else if (c === 'full') { box.classList.toggle('rte-full'); b.classList.toggle('on'); document.body.style.overflow = box.classList.contains('rte-full') ? 'hidden' : ''; area.focus(); }
        else document.execCommand(c, false, null);
        save(); sync();
      };
      if (b.tagName === 'SELECT') b.onchange = run; else b.onclick = run;
    });
    box.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('rte-full')) { box.classList.remove('rte-full'); document.body.style.overflow = ''; } });
  });
}

/* ---------- Campos de formulario genéricos ---------- */
const validityYears = value => {
  const years = [...String(value ?? '').matchAll(/\b(?:19|20|21)\d{2}\b/g)].map(m => +m[0]);
  const range = String(value ?? '').match(/\b((?:19|20|21)\d{2})\s*(?:[-–—/]|al?|hasta)\s*((?:19|20|21)\d{2})\b/i);
  if (range && +range[2] >= +range[1]) for (let y = +range[1]; y <= +range[2]; y++) years.push(y);
  return [...new Set(years)].sort((a,b) => a-b).map(String);
};
const validityOptions = docs => {
  const values = [...new Set(docs.flatMap(d => validityYears(d.vigencia)))].sort().reverse().map(y => [y,y]);
  if (docs.some(d => !validityYears(d.vigencia).length)) values.push(['sin-anio','Sin año especificado']);
  return values;
};
const validityMatches = (value, year) => !year || (year === 'sin-anio' ? !validityYears(value).length : validityYears(value).includes(String(year)));
const tupaOrder = (a,b) => String(a.codigo).localeCompare(String(b.codigo), 'es', {numeric:true});
// Only this verified file is a historical syllabus, regardless of the admission process year.
const prospectusLabel = file => /(?:^|\/)PROSPECTO_DE_ADMISION-2f122f70\.pdf(?:[?#]|$)/.test(file?.url || '') ? 'Temario de admisión 2025 (histórico)' : 'Prospecto de admisión';
function optList(f, rec) { const o = typeof f.opts === 'function' ? f.opts(rec) : f.opts; return (o || []).map(x => Array.isArray(x) ? x : [x, x]); }
function fieldHTML(f, rec) {
  const v = rec[f.n]; const id = 'f_' + f.n; const req = f.req ? ' <span class="req">*</span>' : (f.pubReq ? ' <span class="req" title="Obligatorio para publicar">*</span>' : '');
  const hint = (f.hint || f.pubReq) ? `<div class="hint">${f.pubReq ? 'Obligatorio al publicar. Puede guardarse vacío como borrador. ' : ''}${f.hint || ''}</div>` : '';
  const lab = `<label for="${id}">${esc(f.l)}${req}</label>`;
  const dis = f.ro && f.ro(rec) ? 'disabled' : '';
  let c = '';
  switch (f.t) {
    case 'datetime-local': { const d = new Date(v); const value = v && !isNaN(d) ? new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16) : ''; c = `<input id="${id}" name="${f.n}" type="datetime-local" value="${value}" ${dis}>`; break; }
    case 'textarea': c = `<textarea id="${id}" name="${f.n}" ${f.max ? `maxlength="${f.max}"` : ''} ${dis}>${esc(v)}</textarea>`; break;
    case 'lines': c = `<textarea id="${id}" name="${f.n}" ${dis} placeholder="Un elemento por línea">${esc((v || []).join('\n'))}</textarea>`; break;
    case 'select': c = `<select id="${id}" name="${f.n}" ${dis}>${f.empty !== false ? `<option value="">${esc(f.empty || '— Seleccione —')}</option>` : ''}${optList(f, rec).map(([a, b]) => `<option value="${esc(a)}" ${String(v) === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`; break;
    case 'checkbox': return `<div class="field ${f.full ? 'full' : ''}" data-f="${f.n}"><label class="check"><input type="checkbox" id="${id}" name="${f.n}" ${v ? 'checked' : ''} ${dis}> <span>${esc(f.l)}</span></label>${hint}</div>`;
    case 'checks': c = `<div id="${id}" data-name="${f.n}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;border:1px solid var(--line);border-radius:8px;padding:10px">${optList(f, rec).map(([a, b]) => `<label class="check"><input type="checkbox" name="${f.n}" value="${esc(a)}" ${(v || []).includes(a) ? 'checked' : ''}> ${esc(b)}</label>`).join('')}</div>`; break;
    case 'rich': c = rteHTML(f.n, v, f.l); return `<div class="field full" data-f="${f.n}"><span class="lbl">${esc(f.l)}${req}</span>${c}${hint}</div>`;
    case 'image': c = `<div class="img-field" data-img="${f.n}"><img src="${v ? img(v) : img('ph:topic:image|vacio|Sin imagen')}" alt="Vista previa"><div style="display:flex;flex-direction:column;gap:6px"><label class="btn sm sec" style="cursor:pointer">${ic('upload').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')} ${v ? 'Cambiar imagen' : 'Seleccionar imagen'}<input type="file" accept=".jpg,.jpeg,.png,.webp" data-imgf="${f.n}" hidden></label>${v ? `<button type="button" class="btn xs ghost" data-imgx="${f.n}">Quitar imagen</button>` : ''}<small style="color:var(--muted)">${FILE_RULES.image.label}. Se comprime automáticamente.</small></div></div>`; return `<div class="field ${f.full ? 'full' : ''}" data-f="${f.n}"><span class="lbl">${esc(f.l)}${req}</span>${c}${hint}</div>`;
    case 'file': c = `<div data-file="${f.n}" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${v ? `<span class="file-chip"><span class="ft">PDF</span>${esc(v.original || v.nombre)} <small>${fsize(v.size)}</small></span><button type="button" class="btn xs ghost" data-fv="${f.n}">Ver</button><button type="button" class="btn xs ghost" data-fd="${f.n}">Descargar</button>` : '<span style="color:var(--muted);font-size:13px">Sin archivo</span>'}<label class="btn xs sec" style="cursor:pointer">${v ? 'Reemplazar' : 'Cargar archivo'}<input type="file" accept=".pdf" data-ff="${f.n}" hidden></label>${v && !f.noRemove ? `<button type="button" class="btn xs ghost" data-fx="${f.n}">Retirar</button>` : ''}</div>`; return `<div class="field ${f.full ? 'full' : ''}" data-f="${f.n}"><span class="lbl">${esc(f.l)}${req}</span>${c}<div class="hint">${FILE_RULES.pdf.label}${f.hint ? ' · ' + f.hint : ''}</div></div>`;
    case 'rows': c = rowsHTML(f, v || []); return `<div class="field full" data-f="${f.n}"><span class="lbl">${esc(f.l)}${req}</span>${c}${hint}</div>`;
    case 'custom': return `<div class="field ${f.full !== false ? 'full' : ''}" data-f="${f.n}"><span class="lbl">${esc(f.l)}${req}</span><div data-custom="${f.n}">${f.render(rec)}</div>${hint}</div>`;
    case 'info': return `<div class="field full"><div class="notice">${f.html(rec)}</div></div>`;
    default: c = `<input id="${id}" name="${f.n}" type="${f.t || 'text'}" value="${esc(v ?? '')}" ${f.max ? `maxlength="${f.max}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${dis} ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}>`;
  }
  return `<div class="field ${f.full ? 'full' : ''}" data-f="${f.n}">${lab}${c}${hint}</div>`;
}
function rowsHTML(f, rows) {
  return `<div class="tbl-wrap" data-rows="${f.n}"><table class="tbl light subtbl"><thead><tr>${f.cols.map(c => `<th>${esc(c.l)}</th>`).join('')}<th style="width:110px"></th></tr></thead><tbody>${rows.map((r, i) => `<tr>${f.cols.map(c => `<td>${c.t === 'select' ? `<select class="inp" data-ri="${i}" data-rc="${c.n}" aria-label="${esc(c.l)}">${(typeof c.opts === 'function' ? c.opts() : c.opts).map(o => Array.isArray(o) ? o : [o, o]).map(([a, b]) => `<option value="${esc(a)}" ${String(r[c.n]) === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>` : c.t === 'file' ? `<span style="display:flex;gap:4px;align-items:center">${r[c.n] ? `<span class="file-chip" style="max-width:180px;overflow:hidden"><span class="ft">PDF</span>${esc(clamp(r[c.n].original || r[c.n].nombre, 22))}</span><button type="button" class="icon-btn" data-rfx="${i}|${c.n}" title="Retirar archivo">${ic('x')}</button>` : ''}<label class="btn xs ghost" style="cursor:pointer">${r[c.n] ? 'Cambiar' : 'Adjuntar'}<input type="file" accept=".pdf" hidden data-rf="${i}|${c.n}"></label></span>` : `<input class="inp" type="${c.t || 'text'}" value="${esc(r[c.n] ?? '')}" data-ri="${i}" data-rc="${c.n}" aria-label="${esc(c.l)}" ${c.w ? `style="width:${c.w}"` : ''}>`}</td>`).join('')}<td class="row-acts"><button type="button" class="icon-btn" data-rup="${i}" title="Subir">${ic('up')}</button><button type="button" class="icon-btn" data-rdn="${i}" title="Bajar">${ic('down')}</button><button type="button" class="icon-btn del" data-rdel="${i}" title="Quitar fila">${ic('trash')}</button></td></tr>`).join('') || `<tr><td colspan="${f.cols.length + 1}" style="color:var(--muted)">Sin registros. Use “Agregar”.</td></tr>`}</tbody></table><div style="padding:8px"><button type="button" class="btn xs sec" data-radd="${f.n}">${ic('plus').replace('<svg', '<svg style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"')} Agregar</button></div></div>`;
}
const EDITOR_UPLOADS = new Set();
async function editorFileTask(input, task) {
  const token = {}; const disabled = input.disabled;
  EDITOR_UPLOADS.add(token); input._portalUploading = true; input.disabled = true;
  try { await task(); }
  catch (error) { input.value = ''; toast(error.message || 'No se pudo cargar el archivo. Inténtalo nuevamente.', 'err'); }
  finally { EDITOR_UPLOADS.delete(token); input._portalUploading = false; input.disabled = disabled; }
}
function bindFields(fields, work, root, rerender) {
  const sync = () => { readSimple(fields, root, work); if (root.estado) work.estado = root.estado.value; };
  root.addEventListener('input', sync); root.addEventListener('change', sync);
  bindRTE(root, (n, html) => work[n] = html);
  $$('[data-imgf]', root).forEach(inp => inp.onchange = () => editorFileTask(inp, async () => {
    const f = inp.files[0]; if (!f) return; const n = inp.dataset.imgf; const er = checkFile(f, 'image'); if (er) { inp.value = ''; return toast(er, 'err'); }
    if (work[n] && !await confirmBox('¿Reemplazar la imagen actual por la nueva?', { ok: 'Reemplazar', danger: false })) { inp.value = ''; return; }
    const fd = (fields || []).find(x => x.n === n) || {};
    const image = fd.hq ? await compressImage(f, 2560, { q: .9, sharpen: .35, keep: 900 * 1024 }) : await compressImage(f); if (ADM.work !== work) return;
    work[n] = image; rerender();
    const dim = compressImage.last || {};
    if (fd.hq && dim.w && dim.w < 1600) toast(`Imagen cargada, pero mide ${dim.w} × ${dim.h} px: se verá borrosa en pantallas grandes. Use una de al menos 1920 × 800 px.`, 'warn');
    else if (fd.hq && dim.w && dim.h && dim.w / dim.h < 1.8) toast(`Imagen cargada (${dim.w} × ${dim.h} px). Es más alta que el carrusel (1920 × 800): con «Ajuste automático» se mostrará completa, con los bordes difuminados. Si es un afiche con su propio texto, elija «Solo imagen» en «Presentación».`, 'ok');
    else toast('Imagen cargada y optimizada (' + fsize(work[n].length * .75) + (dim.w ? `, original ${dim.w} × ${dim.h} px` : '') + ').', 'ok');
  }));
  $$('[data-imgx]', root).forEach(b => b.onclick = async () => { if (await confirmBox('¿Retirar la imagen? Se usará la imagen institucional predeterminada.', { ok: 'Retirar' })) { work[b.dataset.imgx] = ''; rerender(); } });
  $$('[data-ff]', root).forEach(inp => inp.onchange = () => editorFileTask(inp, async () => {
    const f = inp.files[0]; if (!f) return; const n = inp.dataset.ff; const er = checkFile(f, 'pdf'); if (er) { inp.value = ''; return toast(er, 'err'); }

    const history = SPECS[ADM.workKey]?.versioned?.includes(n);
    if (work[n] && !await confirmBox(`Ya existe un documento vigente (${esc(work[n].original || work[n].nombre)}). ¿Reemplazarlo?${history ? ' La versión anterior quedará en el historial.' : ''}`, { ok: 'Reemplazar', danger: false })) { inp.value = ''; return; }
    const file = await portalUpload(f); if (ADM.work !== work) return;
    work[n] = {...file,fecha:nowISO(),por:currentUser().usuario}; rerender();
  }));
  $$('[data-fv]', root).forEach(b => b.onclick = () => openDoc(work[b.dataset.fv]));
  $$('[data-fd]', root).forEach(b => b.onclick = () => downloadDoc(work[b.dataset.fd]));
  $$('[data-fx]', root).forEach(b => b.onclick = async () => { if (await confirmBox('¿Retirar el documento? Dejará de mostrarse en el portal.', { ok: 'Retirar' })) { work[b.dataset.fx] = null; rerender(); } });
  // filas repetibles
  fields.filter(f => f.t === 'rows').forEach(f => {
    const box = $(`[data-rows="${f.n}"]`, root); if (!box) return; work[f.n] = work[f.n] || [];
    $$('[data-ri]', box).forEach(inp => inp.addEventListener('input', () => { const r = work[f.n][+inp.dataset.ri]; const c = f.cols.find(x => x.n === inp.dataset.rc); r[inp.dataset.rc] = c.t === 'number' ? (inp.value === '' ? '' : +inp.value) : inp.value; }));
    $$('[data-ri]', box).forEach(inp => inp.addEventListener('change', () => inp.dispatchEvent(new Event('input'))));
    const add = $('[data-radd]', box); add.onclick = () => { const o = { id: uid() }; f.cols.forEach(c => o[c.n] = c.def ?? ''); work[f.n].push(o); rerender(); };
    $$('[data-rdel]', box).forEach(b => b.onclick = async () => { if (await confirmBox('¿Quitar esta fila?', { ok: 'Quitar' })) { work[f.n].splice(+b.dataset.rdel, 1); rerender(); } });
    $$('[data-rup]', box).forEach(b => b.onclick = () => { const i = +b.dataset.rup; if (i > 0) { const a = work[f.n]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; rerender(); } });
    $$('[data-rdn]', box).forEach(b => b.onclick = () => { const i = +b.dataset.rdn; const a = work[f.n]; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; rerender(); } });
    $$('[data-rf]', box).forEach(inp => inp.onchange = () => editorFileTask(inp, async () => { const fl = inp.files[0]; if (!fl) return; const er = checkFile(fl, 'pdf'); if (er) return toast(er, 'err'); const [i, c] = inp.dataset.rf.split('|'); const row = work[f.n][+i]; const file = await portalUpload(fl); if (ADM.work !== work || !work[f.n].includes(row)) return; row[c] = {...file,fecha:nowISO()}; rerender(); }));
    $$('[data-rfx]', box).forEach(b => b.onclick = () => { const [i, c] = b.dataset.rfx.split('|'); work[f.n][+i][c] = null; rerender(); });
  });
  fields.filter(f => f.t === 'custom' && f.bind).forEach(f => f.bind(work, $(`[data-custom="${f.n}"]`, root), rerender));
}
/* Lee los campos simples del formulario hacia "work" (los complejos ya se actualizan en vivo) */
function readSimple(fields, form, work) {
  fields.forEach(f => {
    if (f.ro && f.ro(work)) return;
    const el = form.querySelector(`[name="${f.n}"]`);
    if (f.t === 'checkbox') work[f.n] = !!(el && el.checked);
    else if (f.t === 'checks') work[f.n] = $$(`input[name="${f.n}"]:checked`, form).map(x => x.value);
    else if (f.t === 'lines') work[f.n] = el ? el.value.split('\n').map(s => s.trim()).filter(Boolean) : work[f.n];
    else if(f.t==='datetime-local')work[f.n]=el&&el.value&&!isNaN(new Date(el.value))?new Date(el.value).toISOString():'';
    else if (f.t === 'number') work[f.n] = el && el.value !== '' ? +el.value : '';
    else if (f.t === 'rich') { if (work[f.n]) work[f.n] = sanitize(work[f.n]); }
    else if (['image', 'file', 'rows', 'custom', 'info'].includes(f.t)) { /* en vivo */ }
    else if (el) work[f.n] = el.value.trim();
  });
}

/* ---------- CRUD genérico ---------- */
const SPECS = {};
function isPubState(spec, s) { return s === (spec.pubState || 'Publicado') || (spec.coll==='documentos'&&s==='Histórico'); }
function crudList(spec) {
  const st = ADM.state[spec.key] = ADM.state[spec.key] || { q: '', f: {}, page: 1, size: 10, trash: false };
  let rows = coll(spec.coll).filter(r => st.trash ? r.deleted : !r.deleted);
  if (spec.scope) rows = rows.filter(spec.scope);
  if (st.q) { const t = normTitle(st.q); rows = rows.filter(r => normTitle([spec.label(r), ...(spec.search || ['titulo', 'nombre']).map(k => typeof k === 'function' ? k(r) : r[k])].join(' ')).includes(t)); }
  (spec.filters || []).forEach(fl => { const v = st.f[fl.n]; if (v) rows = rows.filter(r => fl.test ? fl.test(r, v) : String(r[fl.n]) === v); });
  rows.sort(spec.sort || ((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(b.modEn || '').localeCompare(String(a.modEn || ''))));
  const tot = rows.length; st.page = Math.max(1, Math.min(st.page, Math.ceil(tot / st.size) || 1)); const pg = rows.slice((st.page - 1) * st.size, st.page * st.size);
  const canCreate = spec.create !== false && (!spec.canCreate || spec.canCreate());
  const html = admHead(spec.title, spec.sub || '', `${spec.extraActs ? spec.extraActs() : ''}${spec.exportCSV ? `<button class="btn sec" data-csv>${ic('download').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')} Exportar CSV</button>` : ''}${canCreate ? `<a class="btn" href="#/admin/${spec.key}/nuevo">${ic('plus').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')} ${/^(noticia|categoría|convocatoria|diapositiva|página)$/.test(spec.singular) ? 'Nueva' : 'Nuevo'} ${esc(spec.singular)}</a>` : ''}`, spec.icon, [[spec.title]])
    + (spec.tabs ? spec.tabs('list') : '')
    + `<form class="filters" data-lf><div class="field"><label for="lf-q">Buscar</label><input id="lf-q" name="q" value="${esc(st.q)}" placeholder="${esc(spec.searchPh || 'Buscar...')}"></div>${(spec.filters || []).map(fl => `<div class="field"><label for="lf-${fl.n}">${esc(fl.l)}</label><select id="lf-${fl.n}" name="${fl.n}"><option value="">Todos</option>${(typeof fl.opts === 'function' ? fl.opts() : fl.opts).map(o => Array.isArray(o) ? o : [o, o]).map(([a, b]) => `<option value="${esc(a)}" ${st.f[fl.n] === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`).join('')}<div class="actions"><button class="btn">Filtrar</button><button type="button" class="btn ghost" data-clr>Limpiar</button></div></form>
    <div class="panel"><h2><span>${st.trash ? 'Papelera' : 'Listado'} <span class="badge">${tot} registro(s)</span></span>${spec.softDelete !== false ? `<button class="btn xs ghost" data-trash>${st.trash ? '← Volver al listado' : ic('trash').replace('<svg', '<svg style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"') + ' Ver papelera (' + coll(spec.coll).filter(r => r.deleted && (!spec.scope || spec.scope(r))).length + ')'}</button>` : ''}</h2>
    <div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl light"><thead><tr>${spec.cols.map(c => `<th class="${c.cls || ''}">${esc(c.l)}</th>`).join('')}<th class="c">Acciones</th></tr></thead><tbody>${pg.map(r => `<tr data-id="${r.id}" class="${spec.rowCls ? spec.rowCls(r) : ''}">${spec.cols.map(c => `<td class="${c.cls || ''}">${c.f(r)}</td>`).join('')}<td><div class="row-acts" style="justify-content:center">${st.trash ? `${ib('restore', 'restore', 'Restaurar')}${canFlag('hardDelete') ? ib('hard', 'trash', 'Eliminar definitivamente', 'del') : ''}` : `${spec.preview ? ib('preview', 'eye', 'Vista previa') : ''}${(spec.canEdit ? spec.canEdit(r) : true) ? ib('edit', 'edit', 'Editar') : ''}${spec.rowActs ? spec.rowActs(r) : ''}${spec.softDelete !== false && (!spec.canDelete || spec.canDelete(r)) ? ib('del', 'trash', 'Eliminar', 'del') : ''}`}</div></td></tr>`).join('') || `<tr><td colspan="${spec.cols.length + 1}"><div class="empty" style="margin:8px 0">${st.trash ? 'La papelera está vacía.' : 'No hay registros con los criterios seleccionados.'}</div></td></tr>`}</tbody></table></div><div class="pb" style="padding-top:0">${pager(tot, st.page, st.size)}</div></div>`;
  return {
    html, after: () => {
      const f = $('[data-lf]'); const rer = () => route();
      f.onsubmit = e => { e.preventDefault(); st.q = f.q.value.trim(); (spec.filters || []).forEach(fl => st.f[fl.n] = f[fl.n].value); st.page = 1; rer(); };
      $('[data-clr]').onclick = () => { st.q = ''; st.f = {}; st.page = 1; rer(); };
      const tb = $('[data-trash]'); if (tb) tb.onclick = () => { st.trash = !st.trash; st.page = 1; rer(); };
      bindPager($('.panel'), st, rer);
      const csv = $('[data-csv]'); if (csv) csv.onclick = () => { downloadText(toCSV([spec.exportCSV.head].concat(rows.map(spec.exportCSV.row))), spec.key + '.csv', 'text/csv'); audit('Exportación', spec.title, tot + ' registros'); saveDB(); };
      $$('[data-act]').forEach(b => b.onclick = async () => {
        const id = b.closest('tr').dataset.id; const r = byId(spec.coll, id); const act = b.dataset.act; const lbl = spec.label(r);
        if (act === 'edit') return go(`#/admin/${spec.key}/${id}`);
        if (act === 'preview') return previewPublic(spec.coll, r, spec.preview(r));
        if (act === 'del') {
          if (spec.canDelete && !spec.canDelete(r)) return toast('No se puede eliminar este registro: el periodo está cerrado.', 'err');
          if (spec.beforeDelete) { const m = spec.beforeDelete(r); if (m) return toast(m, 'err'); }
          if (!await confirmBox(`Se enviará a la papelera: <b>${esc(lbl)}</b>. Dejará de mostrarse en el portal. Podrá restaurarlo luego.`, { ok: 'Eliminar' })) return;
          r.deleted = true; r.delPor = currentUser().usuario; r.delEn = nowISO(); stamp(r); audit('Eliminación lógica', spec.title, lbl); if(!saveDB())return; toast('Enviado a la papelera.', 'ok'); return rer();
        }
        if (act === 'restore') { r.deleted = false; stamp(r); audit('Restauración', spec.title, lbl); if(!saveDB())return; toast('Registro restaurado.', 'ok'); return rer(); }
        if (act === 'hard') {
          if (spec.inUse) { const m = spec.inUse(r); if (m) return toast(m, 'err'); }
          if (!await confirmBox(`Eliminación DEFINITIVA de <b>${esc(lbl)}</b>. Esta acción no se puede deshacer.`, { ok: 'Continuar' })) return;
          if (!await confirmBox('Confirme nuevamente la eliminación definitiva.', { ok: 'Eliminar definitivamente', title: 'Confirmación adicional' })) return;
          DB[spec.coll] = coll(spec.coll).filter(x => x.id !== id); audit('Eliminación definitiva', spec.title, lbl); if(!saveDB())return; toast('Eliminado definitivamente.', 'ok'); return rer();
        }
        if (spec.onAct) spec.onAct(act, r, rer);
      });
      spec.afterList && spec.afterList();
    }
  };
}
function crudForm(spec, id) {
  const isNew = id === 'nuevo';
  const base = isNew ? (ADM.work && ADM.workKey === spec.key && ADM.workNew ? ADM.work : Object.assign({ id: uid(), estado: spec.states ? spec.states[0] : 'Borrador' }, spec.defaults ? spec.defaults() : {})) : byId(spec.coll, id);
  if (!base) return { html: admHead('Registro no encontrado', '', '', spec.icon) + `<a class="btn" href="#/admin/${spec.key}">Volver</a>` };
  if (!isNew && spec.scope && !spec.scope(base)) { audit('Acceso denegado', spec.title, spec.label(base), 'Registro fuera de su ámbito'); saveDB(); return { html: admHead('Sin permiso', 'Este registro no pertenece a su ámbito de trabajo. El intento quedó registrado en la auditoría.', `<a class="btn" href="#/admin/${spec.key}">Volver al listado</a>`, 'lock') }; }
  if (!isNew && spec.canEdit && !spec.canEdit(base)) return { html: admHead('Sin permiso', 'No tiene permiso para editar este registro.', '', 'lock') };
  const work = ADM.work && ADM.work.id === base.id && ADM.workKey === spec.key ? ADM.work : JSON.parse(JSON.stringify(base));
  ADM.work = work; ADM.workKey = spec.key; ADM.workNew = isNew;
  const fields = typeof spec.fields === 'function' ? spec.fields(work) : spec.fields;
  const main = fields.filter(f => !f.side), side = fields.filter(f => f.side);
  const html = admHead((isNew ? 'Nuevo ' : 'Editar ') + spec.singular, isNew ? 'Complete la información. Los campos con * son obligatorios.' : esc(spec.label(base)), `<a class="btn ghost" href="#/admin/${spec.key}">${ic('back').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')} Volver al listado</a>`, spec.icon, [[spec.title, '#/admin/' + spec.key], [isNew ? 'Nuevo' : 'Editar']])
    + `<form data-cf novalidate class="edit-grid"><div><div class="panel"><div class="pb"><div class="form-grid">${main.map(f => fieldHTML(f, work)).join('')}</div></div></div></div>
    <div><div class="panel"><h2>Estado y publicación</h2><div class="pb" style="display:grid;gap:12px">${spec.states ? `<div class="field"><label for="f_estado">Estado</label><select id="f_estado" name="estado">${spec.states.map(s => `<option ${work.estado === s ? 'selected' : ''}>${s}</option>`).join('')}${work.estado === 'En revisión' && !spec.states.includes('En revisión') ? '<option selected>En revisión</option>' : ''}</select>${APPROVAL_MODS.includes(spec.mod) && !canFlag('approve') ? '<div class="hint">Al elegir “' + (spec.pubState || 'Publicado') + '” se enviará a aprobación del Administrador.</div>' : ''}${work.observacion ? `<div class="notice err" style="margin:6px 0 0">Observación: ${esc(work.observacion)}</div>` : ''}</div>` : ''}${side.map(f => fieldHTML(f, work)).join('')}
    ${spec.preview ? `<button type="button" class="btn sec" data-prev>${ic('eye').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')} Vista previa</button>` : ''}
    <button class="btn">${ic('check').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')} Guardar cambios</button><a class="btn ghost" href="#/admin/${spec.key}" data-cancel>Cancelar</a></div></div>
    <div class="panel"><h2>Historial</h2><div class="pb meta-list">${isNew ? 'Registro nuevo' : `<span>Creado por: <b>${esc(base.creadoPor || '—')}</b></span><span>Fecha: ${fshort(base.creadoEn, true)}</span><span>Última modificación: <b>${esc(base.modPor || '—')}</b></span><span>Fecha: ${fshort(base.modEn, true)}</span>`}${spec.sideExtra ? spec.sideExtra(work) : ''}</div></div></div></form>`;
  return {
    html, after: () => {
      const form = $('[data-cf]');
      const rer = () => { if (form.isConnected) { readSimple(fields, form, work); if (form.estado) work.estado = form.estado.value; } route(); };
      bindFields(fields, work, form, rer);
      $('[data-cancel]').onclick = () => { ADM.work = null; };
      spec.afterForm && spec.afterForm(work, isNew, rer, form);
      const pv = $('[data-prev]'); if (pv) pv.onclick = () => { readSimple(fields, form, work); spec.beforeSave && spec.beforeSave(work, isNew); previewPublic(spec.coll, work, spec.preview(work)); };
      form.onsubmit = e => {
        e.preventDefault(); readSimple(fields, form, work); if (form.estado) work.estado = form.estado.value;
        if (spec.beforeSave) spec.beforeSave(work, isNew);
        const er = {}; const pubNow = isPubState(spec, work.estado) || work.estado === 'En revisión';
        fields.forEach(f => {
          const v = work[f.n]; const empty = v == null || v === '' || (Array.isArray(v) && !v.length) || (f.t === 'rich' && !stripTags(v).trim() && !/<img/.test(v || ''));
          if (f.req && empty) er[f.n] = 'Este campo es obligatorio.';
          else if (f.pubReq && pubNow && empty) er[f.n] = 'Obligatorio para publicar (puede guardarlo como borrador).';
          if (!empty && f.t === 'email' && !reEmail.test(v)) er[f.n] = 'Correo no válido.';
          if (!empty && f.t === 'url' && !/^https?:\/\//.test(v)) er[f.n] = 'Debe iniciar con http:// o https://';
          if (!empty && f.unique) { const nv = f.unique === 'norm' ? normTitle(v) : String(v); const dup = coll(spec.coll).find(r => r.id !== work.id && !r.deleted && (f.unique === 'norm' ? normTitle(r[f.n]) : String(r[f.n])) === nv && (!spec.uniqueScope || spec.uniqueScope(r, work))); if (dup) er[f.n] = `Ya existe un registro con este valor (“${clamp(spec.label(dup), 50)}”).`; }
        });
        if (spec.order && work.orden !== '' && work.orden != null) { const dup = coll(spec.coll).find(r => r.id !== work.id && !r.deleted && r.orden == work.orden && (!spec.orderScope || spec.orderScope(r, work)) && !['Inactivo', 'Despublicado'].includes(r.estado)); if (dup) er.orden = `El orden ${work.orden} ya está asignado a “${clamp(spec.label(dup), 40)}”.`; }
        if (spec.validate) Object.assign(er, spec.validate(work, isNew) || {});
        if (Object.keys(er).length) { showErrors(form, er); const k = Object.keys(er).find(k => !form.querySelector(`[name="${k}"]`) && !form.querySelector(`[data-name="${k}"]`)); if (k) toast(er[k], 'err'); return; }
        // flujo de aprobación
        let msg = 'Cambios guardados.';
        if (APPROVAL_MODS.includes(spec.mod) && isPubState(spec, work.estado) && !canFlag('approve')) { const prev = isNew ? null : byId(spec.coll, work.id); if (!prev || prev.estado !== work.estado || JSON.stringify(prev)!==JSON.stringify(work)) { work.estado = 'En revisión'; msg = 'Guardado y enviado a aprobación del Administrador.'; } }
        if (!canFlag('publish') && isPubState(spec, work.estado)) { work.estado = 'Borrador'; msg = 'Su rol no puede publicar: se guardó como borrador.'; }
        delete work._preview;
        const prev = isNew ? null : byId(spec.coll, work.id);
        if (prev && spec.versioned) spec.versioned.forEach(k => { if (prev[k] && JSON.stringify(prev[k]) !== JSON.stringify(work[k])) { work.docVersiones = work.docVersiones || []; work.docVersiones.unshift({ campo: k, doc: prev[k], reemplazadoEn: nowISO(), por: currentUser().usuario }); } });
        if (work.estado !== 'En revisión') delete work.observacion;
        stamp(work, isNew);
        if (isNew) coll(spec.coll).push(work); else DB[spec.coll] = coll(spec.coll).map(r => r.id === work.id ? work : r);
        if (spec.afterSave) spec.afterSave(work, isNew, prev);
        const action = isNew ? 'Creación' : (prev && prev.estado !== work.estado ? `Cambio de estado: ${prev.estado} → ${work.estado}` : 'Modificación');
        audit(action, spec.title, spec.label(work), spec.auditDetail ? spec.auditDetail(work, prev) : '');
        if (!saveDB()) return;
        ADM.work = null; toast(msg, 'ok'); go(`#/admin/${spec.key}`);
      };
    }
  };
}

/* ---------- Vista previa del portal con datos no publicados ---------- */
function previewPublic(collName, rec, hash) {
  PREVIEW = { coll: collName, rec: JSON.parse(JSON.stringify(rec)) };
  const [p, qs] = hash.replace(/^#\//, '').split('?');
  const out = renderPublicPath(p.split('/').filter(Boolean), new URLSearchParams(qs || ''));
  const ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;z-index:250;background:var(--card);overflow:auto';
  ov.innerHTML = `<div class="preview-bar"><span>${ic('eye').replace('<svg', '<svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:-3px"')} <b>Vista previa</b> · así se verá en el portal (los cambios aún no están publicados)</span><span style="display:flex;gap:6px"><button class="btn xs ghost" data-w="390">Móvil</button><button class="btn xs ghost" data-w="">Escritorio</button><button class="btn xs" data-close>Cerrar vista previa</button></span></div><div data-pvw style="margin:0 auto;transition:.2s">${typeof out === 'string' ? out : out.html}</div>`;
  document.body.appendChild(ov);
  if (out.after) try { out.after(); } catch (e) { }
  ov.addEventListener('click', e => { const a = e.target.closest('a'); if (a && a.getAttribute('href') && a.getAttribute('href').startsWith('#')) { e.preventDefault(); toast('Navegación desactivada en la vista previa.'); } }, true);
  $$('[data-w]', ov).forEach(b => b.onclick = () => { $('[data-pvw]', ov).style.maxWidth = b.dataset.w ? b.dataset.w + 'px' : ''; $('[data-pvw]', ov).style.boxShadow = b.dataset.w ? '0 0 0 1px #ccd' : ''; });
  $('[data-close]', ov).onclick = () => { ov.remove(); PREVIEW = null; };
}

/* ==== admin2.js ==== */
/* =========================================================
   PANEL ADMINISTRATIVO – definición de módulos CRUD
   ========================================================= */
const progOpts = () => sortO(alive('programas')).map(p => [p.id, p.nombre]);
const scopeProg = r => !role().ownProgram || r.programaId === currentUser().programaId || r.id === currentUser().programaId;
const thumb = src => `<img class="thumb" src="${img(src, 'ph:campus:4')}" alt="">`;
const tabsBar = (items, active) => `<div class="tabs" role="tablist">${items.map(([k, l, h]) => `<a role="tab" aria-selected="${k === active}" href="${h}" style="padding:10px 14px;font-weight:600;text-decoration:none;color:${k === active ? 'var(--link)' : 'var(--ink2)'};border-bottom:3px solid ${k === active ? 'var(--blue)' : 'transparent'};margin-bottom:-2px">${l}</a>`).join('')}</div>`;
const dniCell = d => canFlag('viewDni') ? esc(d) : maskDni(d);
const ESTADOS = ['Borrador', 'Publicado', 'Despublicado'];

/* ---------- Noticias ---------- */
SPECS.noticias = {
  key: 'noticias', mod: 'noticias', coll: 'noticias', title: 'Noticias', singular: 'noticia', icon: 'list', sub: 'Gestiona las noticias institucionales, académicas y eventos.',
  extraActs: () => can('portada') ? `<label class="pview">Vista en la portada <select class="inp" data-nview>${[['', 'Según el diseño'], ['tarjetas', 'Tarjetas'], ['carrusel', 'Carrusel']].map(([v, l]) => `<option value="${v}"${(DB.config.home.noticiasVista || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : '',
  afterList: () => { const sel = $('[data-nview]'); if (sel) sel.onchange = () => { DB.config.home.noticiasVista = sel.value; audit('Vista de noticias', 'Noticias', sel.value || 'Según el diseño'); if (!saveDB()) return; toast('Las noticias de la portada se mostrarán ' + (sel.value === 'carrusel' ? 'en carrusel' : sel.value === 'tarjetas' ? 'en tarjetas' : 'según el diseño del portal') + '.', 'ok'); }; },
  states: ['Borrador', 'Publicada', 'Despublicada', 'Archivada'], pubState: 'Publicada', label: r => r.titulo,
  tabs: a => tabsBar([['list', 'Noticias', '#/admin/noticias'], ['cat', 'Categorías', '#/admin/catnoticias']], 'list'),
  search: ['titulo', 'resumen', r => stripTags(r.contenido)], searchPh: 'Título o contenido',
  filters: [{ n: 'categoriaId', l: 'Categoría', opts: () => coll('categoriasNoticia').map(c => [c.id, c.nombre]) }, { n: 'estado', l: 'Estado', opts: ['Borrador', 'Publicada', 'Despublicada', 'Archivada'] }, { n: 'mes', l: 'Mes de publicación', opts: () => [...new Set(coll('noticias').map(n => String(n.fecha).slice(0, 7)))].sort().reverse(), test: (r, v) => String(r.fecha).startsWith(v) }],
  sort: (a, b) => new Date(b.fecha) - new Date(a.fecha),
  cols: [{ l: 'Imagen', f: r => thumb(r.imagen) }, { l: 'Título', f: r => `<b>${esc(r.titulo)}</b><br><small style="color:var(--muted)">${esc(clamp(r.resumen, 80))}</small>` }, { l: 'Categoría', f: r => `<span class="badge">${esc(catName(r.categoriaId))}</span>` }, { l: 'Publicación', f: r => `${fshort(r.fecha, true)}${new Date(r.fecha) > new Date() && r.estado === 'Publicada' ? '<br><span class="badge warn">Programada</span>' : ''}` }, { l: 'Estado', f: r => stBadge(r.estado) }, { l: 'Destacada', cls: 'c', f: r => r.destacada ? '<span title="Destacada" style="color:var(--gold);font-size:18px">★</span>' : '<span style="color:#ccc">☆</span>' }, { l: 'Autor', f: r => esc(r.autor || r.creadoPor) }],
  rowActs: r => ib('star', 'star', r.destacada ? 'Quitar destacado' : 'Marcar como destacada') + ib('dup', 'copy', 'Duplicar como borrador'),
  onAct: (act, r, rer) => {
    if (act === 'star') { r.destacada = !r.destacada; stamp(r); audit(r.destacada ? 'Marcar destacada' : 'Quitar destacada', 'Noticias', r.titulo); saveDB(); rer(); }
    if (act === 'dup') { const c = JSON.parse(JSON.stringify(r)); c.id = uid(); c.titulo = r.titulo + ' (copia ' + new Date().toLocaleTimeString('es-PE') + ')'; c.slug = slugify(c.titulo); c.estado = 'Borrador'; c.destacada = false; stamp(c, true); coll('noticias').push(c); audit('Creación (duplicado)', 'Noticias', c.titulo); if(!saveDB())return; toast('Borrador duplicado creado.', 'ok'); rer(); }
  },
  preview: r => '#/noticias/' + (r.slug || slugify(r.titulo)),
  defaults: () => ({ fecha: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), destacada: false, autor: currentUser().usuario, adjuntos: [], estado: 'Borrador' }),
  fields: work => { work.adjuntos = (work.adjuntos || []).map(a => a.doc || !(a.url || a.fileId || a.data) ? a : {titulo:a.titulo || a.original || a.nombre || 'Documento adjunto',doc:a}); return [
    { n: 'titulo', l: 'Título', req: true, max: 160, full: true, unique: 'norm' },
    { n: 'resumen', l: 'Resumen', t: 'textarea', pubReq: true, max: 300, full: true, hint: 'Máximo 300 caracteres. Se muestra en las tarjetas.' },
    { n: 'contenido', l: 'Contenido', t: 'rich', pubReq: true },
    { n: 'imagen', l: 'Imagen principal', t: 'image', full: true, hint: 'Si no se carga, se usa la imagen institucional predeterminada. Puede agregar hasta 4 fotos adicionales (5 en total).' },
    ...[2, 3, 4, 5].map(k => ({ n: 'foto' + k, l: 'Foto adicional ' + (k - 1), t: 'image' })),
    { n: 'imagenAjuste', l: 'Presentación de la imagen', t: 'select', opts: [['','Automática'],['contain','Completa: logotipo, afiche o documento'],['cover','Cubrir: fotografía']], hint: 'Usa imagen completa para conservar textos y logotipos.' },
    { n: 'video', l: 'Video principal (opcional)', t: 'url', full: true, ph: 'https://www.youtube.com/embed/…', hint: 'URL de inserción (embed). Reemplaza a la imagen en el detalle.' },
    { n: 'adjuntos', l: 'Archivos relacionados', t: 'rows', cols: [{ n: 'titulo', l: 'Título del archivo' }, { n: 'doc', l: 'Archivo PDF', t: 'file' }] },
    { n: 'categoriaId', l: 'Categoría', t: 'select', side: true, pubReq: true, opts: () => coll('categoriasNoticia').filter(c => c.estado === 'Activo').map(c => [c.id, c.nombre]) },
    { n: 'fecha', l: 'Fecha y hora de publicación', t: 'datetime-local', side: true, req: true, hint: 'Si es futura, la noticia se publicará automáticamente en esa fecha.' },
    { n: 'destacada', l: 'Noticia destacada', t: 'checkbox', side: true },
    { n: 'slug', l: 'URL amigable (slug)', side: true, unique: true, hint: 'Se genera a partir del título.' },
  ]; },
  beforeSave: w => { w.slug = slugify(w.slug || w.titulo); },
  validate: w => { if (w.video) w.video = videoEmbedURL(w.video); return w.video && !/^https:\/\/(www\.)?(youtube\.com\/embed|player\.vimeo\.com|www\.facebook\.com\/plugins)/.test(w.video) ? { video: 'Pegue el enlace del video de YouTube, Vimeo o Facebook (https).' } : {}; },
};
SPECS.catnoticias = {
  key: 'catnoticias', mod: 'noticias', coll: 'categoriasNoticia', title: 'Categorías de noticias', singular: 'categoría', icon: 'list', label: r => r.nombre, states: ['Activo', 'Inactivo'], pubState: 'Activo', softDelete: true,
  tabs: () => tabsBar([['list', 'Noticias', '#/admin/noticias'], ['cat', 'Categorías', '#/admin/catnoticias']], 'cat'),
  cols: [{ l: 'Nombre', f: r => esc(r.nombre) }, { l: 'Noticias asociadas', cls: 'num', f: r => alive('noticias').filter(n => n.categoriaId === r.id).length }, { l: 'Estado', f: r => stBadge(r.estado) }],
  fields: [{ n: 'nombre', l: 'Nombre', req: true, unique: 'norm', full: true }],
  beforeDelete: r => alive('noticias').some(n => n.categoriaId === r.id) ? 'No se puede eliminar: hay noticias asociadas. Reasígnelas primero.' : '',
  inUse: r => coll('noticias').some(n => n.categoriaId === r.id) ? 'La categoría tiene noticias (incluida la papelera).' : '',
};
SPECS.eventos = {
  key: 'eventos', mod: 'eventos', coll: 'eventos', title: 'Eventos', singular: 'evento', icon: 'calendar', states: ['Borrador', 'Publicado'], label: r => r.titulo,
  sort: (a, b) => new Date(b.fecha) - new Date(a.fecha), preview: () => '#/eventos',
  cols: [{ l: 'Fecha', f: r => fshort(r.fecha, true) }, { l: 'Evento', f: r => `<b>${esc(r.titulo)}</b>` }, { l: 'Lugar', f: r => esc(r.lugar) }, { l: 'Estado', f: r => stBadge(r.estado) }],
  fields: [{ n: 'titulo', l: 'Título', req: true, full: true }, { n: 'fecha', l: 'Fecha y hora', t: 'datetime-local', req: true }, { n: 'lugar', l: 'Lugar', req: true }, { n: 'descripcion', l: 'Descripción', t: 'textarea', full: true, pubReq: true }],
};
/* ---------- Transparencia ---------- */
SPECS.inversiones = {
  key: 'inversiones', mod: 'inversiones', coll: 'inversiones', title: 'Inversiones y recursos económicos', singular: 'registro', icon: 'building', states: ['Borrador', 'Publicado'], label: r => r.titulo,
  filters: [{ n: 'tipo', l: 'Tipo', opts: ['Inversión', 'Reinversión', 'Obra de infraestructura', 'Obra por impuestos (OxI)', 'Donación', 'Otros recursos'] }], sort: (a, b) => String(b.fecha).localeCompare(a.fecha), preview: () => '#/transparencia/inversiones',
  cols: [{ l: 'Imagen', f: r => thumb(r.imagen) }, { l: 'Título', f: r => `<b>${esc(r.titulo)}</b><br><small>${esc(r.fuente)}</small>` }, { l: 'Tipo', f: r => esc(r.tipo) }, { l: 'Monto', cls: 'num', f: r => money(r.monto) }, { l: 'Avance', f: r => esc(r.estadoAvance) }, { l: 'Estado', f: r => stBadge(r.estado) }],
  exportCSV: { head: ['Título', 'Tipo', 'Fuente', 'Monto', 'Fecha', 'Avance'], row: r => [r.titulo, r.tipo, r.fuente, r.monto, r.fecha, r.estadoAvance] },
  fields: [{ n: 'titulo', l: 'Título', req: true, full: true }, { n: 'tipo', l: 'Tipo', t: 'select', req: true, opts: ['Inversión', 'Reinversión', 'Obra de infraestructura', 'Obra por impuestos (OxI)', 'Donación', 'Otros recursos'] }, { n: 'fuente', l: 'Fuente de financiamiento', req: true }, { n: 'monto', l: 'Monto (S/)', t: 'number', min: 0, step: '0.01', req: true }, { n: 'fecha', l: 'Fecha', t: 'date', req: true }, { n: 'estadoAvance', l: 'Estado o avance', pubReq: true, ph: 'Ej.: En ejecución (60 %)' }, { n: 'descripcion', l: 'Descripción', t: 'textarea', full: true, pubReq: true }, { n: 'imagen', l: 'Imagen', t: 'image', full: true }, { n: 'documento', l: 'Documento sustentatorio', t: 'file', full: true }],
};
SPECS.convocatorias = {
  key: 'convocatorias', mod: 'convocatorias', coll: 'convocatorias', title: 'Convocatorias', singular: 'convocatoria', icon: 'briefcase', states: ['Borrador', 'Publicado'], label: r => r.titulo,
  sort: (a, b) => String(b.fecha).localeCompare(a.fecha), preview: () => '#/transparencia/convocatorias', filters: [{ n: 'situacion', l: 'Situación', opts: ['Estado no confirmado', 'En curso', 'Concluida', 'Desierta', 'Cancelada'] }],
  cols: [{ l: 'Convocatoria', f: r => `<b>${esc(r.titulo)}</b><br><small>${esc(r.tipo)}</small>` }, { l: 'Fecha', f: r => fshort(r.fecha + 'T12:00') }, { l: 'Situación', f: r => esc(r.situacion) }, { l: 'Etapas', cls: 'num', f: r => (r.etapas || []).length }, { l: 'Estado', f: r => stBadge(r.estado) }],
  fields: [{ n: 'titulo', l: 'Título', req: true, full: true }, { n: 'tipo', l: 'Tipo', t: 'select', req: true, opts: ['Contratación docente', 'Contratación administrativa (CAS)', 'Encargatura', 'Otros'] }, { n: 'fecha', l: 'Fecha de publicación', t: 'date', req: true }, { n: 'situacion', l: 'Situación', t: 'select', req: true, opts: ['Estado no confirmado', 'En curso', 'Concluida', 'Desierta', 'Cancelada'] }, { n: 'descripcion', l: 'Descripción', t: 'textarea', full: true }, { n: 'bases', l: 'Bases', t: 'file', full: true, pubReq: true }, { n: 'etapas', l: 'Cronograma y resultados por etapa', t: 'rows', cols: [{ n: 'nombre', l: 'Etapa' }, { n: 'fecha', l: 'Fecha', t: 'date' }, { n: 'doc', l: 'Documento / resultado', t: 'file' }] }],
};
SPECS.documentos = {
  key: 'documentos', mod: 'documentos', coll: 'documentos', title: 'Documentos de gestión', singular: 'documento', icon: 'file', states: ['Borrador', 'Publicado', 'Histórico'], label: r => `${r.nombre} v${r.version}`,
  sub: 'Administra los documentos institucionales, sus versiones y su publicación.',
  tabs: () => tabsBar([['list', 'Listado de documentos', '#/admin/documentos'], ['cat', 'Categorías', '#/admin/tiposdoc']], 'list'),
  search: ['nombre', 'descripcion'], filters: [{ n: 'tipoId', l: 'Tipo de documento', opts: () => coll('tiposDocumento').map(t => [t.id, t.nombre]) }, { n: 'estado', l: 'Estado', opts: ['Borrador', 'En revisión', 'Publicado', 'Histórico'] }, { n: 'anio', l: 'Año de vigencia', opts: () => validityOptions(coll('documentos')), test: (r, v) => validityMatches(r.vigencia, v) }],
  preview: () => '#/transparencia/documentos-gestion',
  cols: [{ l: 'Documento', f: r => `<span class="file-chip" style="background:none;border:0;padding:0"><span class="ft">PDF</span><b>${esc(r.nombre)}</b></span>${r.refModulo ? '<br><small class="badge violet">Referencia: módulo Admisión</small>' : ''}` }, { l: 'Tipo', f: r => esc(tipoDoc(r.tipoId)) }, { l: 'Vigencia', f: r => esc(r.vigencia) }, { l: 'Versión', cls: 'c', f: r => esc(r.version) }, { l: 'Estado', f: r => stBadge(r.estado) }, { l: 'Publicación', f: r => fshort(r.fechaPub) }],
  rowActs: r => ib('ver', 'eye', 'Ver archivo') + ib('ver2', 'history', 'Historial de versiones') + ib('nv', 'copy', 'Nueva versión'),
  onAct: (act, r, rer) => {
    if (act === 'ver') { const f = docFile(r); return f ? openDoc(f) : toast('Sin archivo', 'err'); }
    if (act === 'ver2') { const vs = coll('documentos').filter(d => d.grupo === r.grupo).sort((a, b) => String(b.version).localeCompare(String(a.version), undefined, { numeric: true })); return modal({ title: 'Historial de versiones: ' + esc(r.nombre), size: 'lg', body: `<div class="tbl-wrap"><table class="tbl light"><thead><tr><th>Versión</th><th>Vigencia</th><th>Fecha de publicación</th><th>Estado</th><th>Responsable</th></tr></thead><tbody>${vs.map(v => `<tr><td>${esc(v.version)}</td><td>${esc(v.vigencia)}</td><td>${fshort(v.fechaPub)}</td><td>${stBadge(v.deleted ? 'Eliminado' : v.estado)}</td><td>${esc(v.publicadoPor || v.modPor)}</td></tr>`).join('')}</tbody></table></div>` }); }
    if (act === 'nv') { const c = JSON.parse(JSON.stringify(r)); c.id = uid(); const major=Math.max(0,...coll('documentos').filter(v=>v.id===r.id||(r.grupo&&v.grupo===r.grupo)).map(v=>Number(String(v.version).match(/\d+/)?.[0]||0))); c.version=(major+1)+'.0'; c.estado = 'Borrador'; c.archivo = r.refModulo ? null : null; c.fechaPub = ''; stamp(c, true); coll('documentos').push(c); audit('Nueva versión (borrador)', 'Documentos de gestión', c.nombre + ' v' + c.version); if(!saveDB())return; toast('Se creó la versión ' + c.version + ' como borrador. Cargue el archivo y publíquela.', 'ok'); go('#/admin/documentos/' + c.id); }
  },
  defaults: () => ({ version: '1.0', vigencia: String(yearNow()), orden: alive('documentos').length + 1, refModulo: '' }),
  fields: w => [
    { n: 'nombre', l: 'Nombre del documento', req: true, full: true },
    { n: 'tipoId', l: 'Tipo de documento', t: 'select', req: true, opts: () => coll('tiposDocumento').filter(t => t.estado === 'Activo').map(t => [t.id, t.nombre]) },
    { n: 'vigencia', l: 'Año o periodo de vigencia', req: true, ph: '2026 o 2024 - 2028' },
    { n: 'version', l: 'Versión', req: true },
    { n: 'orden', l: 'Orden de presentación', t: 'number', min: 1 },
    { n: 'descripcion', l: 'Descripción', t: 'textarea', full: true },
    { n: 'refModulo', l: 'Origen del archivo', t: 'select', empty: 'Archivo propio (cargar PDF)', opts: [['admision', 'Referencia: Reglamento de Admisión vigente (módulo Admisión)']], full: true },
    w.refModulo ? { n: 'info', t: 'info', html: () => 'El archivo se toma automáticamente del módulo <b>Admisión</b> (reglamento del proceso vigente). Al actualizarlo allí, se actualiza aquí sin duplicar archivos.' } : { n: 'archivo', l: 'Archivo', t: 'file', full: true, pubReq: true },
  ],
  beforeSave: w => { w.grupo = w.grupo || slugify(w.nombre); if (w.refModulo) w.archivo = null; },
  afterForm: (w, isNew, rerender, form) => { form.refModulo.onchange = rerender; },
  validate: w => { const dup = alive('documentos').find(d => d.id !== w.id && normTitle(d.nombre) === normTitle(w.nombre) && d.tipoId === w.tipoId && String(d.vigencia) === String(w.vigencia) && String(d.version) === String(w.version)); if (dup) return { version: 'Ya existe esta misma versión del documento (mismo nombre, tipo, vigencia y versión).' }; if (!w.refModulo && /reglamento de admision/.test(normTitle(w.nombre))) return { refModulo: 'El Reglamento de Admisión ya se administra en el módulo Admisión. Use la opción de referencia para no duplicar el archivo.' }; return {}; },
  afterSave: w => { if (w.estado === 'Publicado') { w.fechaPub = w.fechaPub || localYmd(); w.publicadoPor = currentUser().usuario; coll('documentos').forEach(d => { if (d.id !== w.id && d.grupo === w.grupo && d.estado === 'Publicado' && !d.deleted) { d.estado = 'Histórico'; stamp(d); audit('Paso a histórico', 'Documentos de gestión', d.nombre + ' v' + d.version, 'Por publicación de v' + w.version); } }); } },
  inUse: r => r.refModulo ? 'Este registro referencia un documento de otro módulo; no puede eliminarse definitivamente mientras exista la relación.' : '',
};
SPECS.tiposdoc = {
  key: 'tiposdoc', mod: 'documentos', coll: 'tiposDocumento', title: 'Categorías de documentos', singular: 'categoría', icon: 'file', states: ['Activo', 'Inactivo'], pubState: 'Activo', label: r => r.nombre,
  tabs: () => tabsBar([['list', 'Listado de documentos', '#/admin/documentos'], ['cat', 'Categorías', '#/admin/tiposdoc']], 'cat'),
  cols: [{ l: 'Nombre', f: r => esc(r.nombre) }, { l: 'Documentos', cls: 'num', f: r => alive('documentos').filter(d => d.tipoId === r.id).length }, { l: 'Estado', f: r => stBadge(r.estado) }],
  fields: [{ n: 'nombre', l: 'Nombre', req: true, unique: 'norm', full: true, hint: 'Desactivar una categoría no afecta los documentos históricos asociados.' }],
  beforeDelete: r => alive('documentos').some(d => d.tipoId === r.id) ? 'Hay documentos asociados. Desactive la categoría en lugar de eliminarla.' : '',
};
SPECS.tupa = {
  key: 'tupa', mod: 'tupa', coll: 'tupa', title: 'TUPA – conceptos', singular: 'concepto', icon: 'money', states: ['Borrador', 'Publicado'], label: r => `${r.codigo} ${r.denominacion}`,
  tabs: () => tabsBar([['list', 'Conceptos', '#/admin/tupa'], ['cfg', 'UIT y documentos', '#/admin/tupacfg']], 'list'),
  search: ['codigo', 'denominacion'], filters: [{ n: 'categoria', l: 'Categoría', opts: () => [...new Set(coll('tupa').map(t => t.categoria))] }, { n: 'anio', l: 'Año', opts: () => [...new Set(coll('tupa').map(t => String(t.anio)))] }],
  sort: tupaOrder, preview: () => '#/transparencia/tupa',
  cols: [{ l: 'Año', f: r => r.anio }, { l: 'Código', f: r => esc(r.codigo) }, { l: 'Categoría', f: r => esc(r.categoria) }, { l: 'Denominación', f: r => esc(r.denominacion) }, { l: 'Monto', cls: 'num', f: r => money(r.monto) }, { l: '% UIT', cls: 'num', f: r => DB.config.uit[r.anio] ? (r.monto / DB.config.uit[r.anio] * 100).toFixed(2) + ' %' : '—' }, { l: 'Estado', f: r => stBadge(r.estado) }],
  exportCSV: { head: ['Año', 'Código', 'Categoría', 'Denominación', 'Monto', 'Cuenta'], row: r => [r.anio, r.codigo, r.categoria, r.denominacion, r.monto, r.cuenta] },
  defaults: () => ({ anio: DB.tupaDocs.anio, cuenta: 'Banco de la Nación – Cta. Cte. (ver en ventanilla)' }),
  fields: [{ n: 'anio', l: 'Año', t: 'number', req: true }, { n: 'codigo', l: 'Código', req: true }, { n: 'categoria', l: 'Categoría', t: 'select', req: true, opts: rec => [...new Set([...coll('tupa').map(t => t.categoria), rec.categoria, 'Admisión', 'Matrícula', 'Certificación', 'Titulación', 'Trámites', 'Pensiones y otros pagos'].filter(Boolean))] }, { n: 'monto', l: 'Monto (S/)', t: 'number', step: '0.01', min: 0, req: true }, { n: 'denominacion', l: 'Denominación del procedimiento', req: true, full: true }, { n: 'cuenta', l: 'Cuenta / lugar de pago', full: true }, { n: 'requisitos', l: 'Requisitos', t: 'textarea', full: true }],
  validate: w => { const d = alive('tupa').find(t => t.id !== w.id && t.anio == w.anio && normTitle(t.codigo) === normTitle(w.codigo)); return d ? { codigo: 'El código ya existe para el año ' + w.anio + '.' } : {}; },
};
/* ---------- Nosotros ---------- */
SPECS.jerarquica = {
  key: 'jerarquica', mod: 'jerarquica', coll: 'jerarquica', title: 'Plana jerárquica', singular: 'integrante', icon: 'users', states: ['Publicado', 'Despublicado'], label: r => `${fullName(persona(r.personaId))} – ${r.cargo}`, order: true,
  tabs: () => tabsBar([['list', 'Integrantes', '#/admin/jerarquica'], ['pg', 'Página y mensaje de la Dirección', '#/admin/paginas/pg-jerarquica']], 'list'),
  sub: 'La foto, nombre y correo provienen de la ficha única de la persona (módulo Plana docente / personal).',
  search: [r => fullName(persona(r.personaId)), 'cargo'], preview: () => '#/nosotros/plana-jerarquica',
  cols: [{ l: 'Orden', cls: 'c', f: r => r.orden }, { l: 'Foto', f: r => `<img class="avatar" src="${img((persona(r.personaId) || {}).foto)}" alt="">` }, { l: 'Nombres y apellidos', f: r => esc(fullName(persona(r.personaId))) + (r.esDirector ? ' <span class="badge violet">Director(a)</span>' : '') }, { l: 'Cargo', f: r => esc(r.cargo) }, { l: 'Estado', f: r => stBadge(r.estado) }],
  defaults: () => ({ orden: alive('jerarquica').length + 1, estado: 'Publicado' }),
  fields: [{ n: 'personaId', l: 'Persona (ficha única)', t: 'select', req: true, opts: () => alive('personas').sort((a, b) => a.apellidos.localeCompare(b.apellidos)).map(p => [p.id, `${p.apellidos}, ${p.nombres} (${p.tipo})`]), hint: '¿No aparece? Regístrela primero en Plana docente / personal.' }, { n: 'cargo', l: 'Cargo', req: true }, { n: 'unidad', l: 'Unidad orgánica' }, { n: 'orden', l: 'Orden de presentación', t: 'number', min: 1, req: true }, { n: 'esDirector', l: 'Es Director(a) General (tratamiento destacado)', t: 'checkbox', full: true }],
  validate: w => { const e = {}; if (alive('jerarquica').some(j => j.id !== w.id && j.personaId === w.personaId && normTitle(j.cargo) === normTitle(w.cargo))) e.cargo = 'Esta persona ya está registrada con el mismo cargo.'; if (w.esDirector && alive('jerarquica').some(j => j.id !== w.id && j.esDirector && j.estado === 'Publicado')) e.esDirector = 'Ya existe un integrante marcado como Director(a) General.'; return e; },
};
SPECS.docentes = {
  key: 'docentes', mod: 'docentes', coll: 'personas', title: 'Plana docente y personal', singular: 'docente / persona', icon: 'user', states: ['Borrador', 'Publicado', 'Despublicado'], label: r => `${r.apellidos}, ${r.nombres}`,
  sub: 'Ficha única por persona: se reutiliza en Plana docente, Plana jerárquica y en cada programa de estudio.',
  search: ['nombres', 'apellidos', 'dni', 'especialidad', 'correo'], searchPh: 'Nombre, DNI o especialidad',
  filters: [{ n: 'prog', l: 'Programa / categoría', opts: () => progOpts().concat([['emp', 'Empleabilidad']]), test: (r, v) => v === 'emp' ? r.empleabilidad : (r.programas || []).includes(v) }, { n: 'tipo', l: 'Tipo', opts: ['Docente', 'Administrativo'] }, { n: 'estado', l: 'Estado', opts: ESTADOS }],
  sort: (a, b) => (a.orden || 0) - (b.orden || 0) || a.apellidos.localeCompare(b.apellidos), preview: r => '#/nosotros/plana-docente?p=' + ((r.programas || [])[0] || 'emp'),
  cols: [{ l: 'Foto', f: r => `<img class="avatar" src="${img(r.foto)}" alt="">` }, { l: 'Apellidos y nombres', f: r => `<b>${esc(r.apellidos)}, ${esc(r.nombres)}</b><br><small>${esc(r.correo)}</small>` }, { l: 'DNI', f: r => dniCell(r.dni) }, { l: 'Especialidad', f: r => esc(r.especialidad) }, { l: 'Categorías', f: r => (r.programas || []).map(p => `<span class="badge" title="${esc((byId('programas', p) || {}).nombre)}">${esc(p.toUpperCase())}</span>`).join(' ') + (r.empleabilidad ? ' <span class="badge violet">EMP</span>' : '') || `<small>${esc(r.tipo)}</small>` }, { l: 'Condición', f: r => esc(r.condicion) }, { l: 'UD', cls: 'num', f: r => (r.uds || []).length }, { l: 'Estado', f: r => stBadge(r.estado) }],
  exportCSV: { head: ['Apellidos', 'Nombres', 'Correo', 'Especialidad', 'Condición', 'Programas', 'Estado'], row: r => [r.apellidos, r.nombres, r.correo, r.especialidad, r.condicion, (r.programas || []).join(' '), r.estado] },
  defaults: () => ({ tipo: 'Docente', condicion: 'Contratado', programas: [], uds: [], academica: [], experiencia: [], otros: [], empleabilidad: false, orden: alive('personas').length + 1 }),
  fields: [
    { n: 'foto', l: 'Fotografía', t: 'image', full: true, hint: 'Formato vertical u horizontal; se recorta de forma uniforme en el portal.' },
    { n: 'titulo', l: 'Abreviatura (Ing., Lic., Mg., Dr.)', max: 8 }, { n: 'tipo', l: 'Tipo de personal', t: 'select', req: true, empty: false, opts: ['Docente', 'Administrativo'] },
    { n: 'nombres', l: 'Nombres', req: true }, { n: 'apellidos', l: 'Apellidos', hint: 'Si la fuente no los desglosa, conserva el nombre completo en Nombres.' },
    { n: 'dni', l: 'Documento de identidad (DNI)', unique: true, max: 8, hint: 'Opcional y privado. Completar solo con un dato verificado.' }, { n: 'correo', l: 'Correo institucional', t: 'email' },
    { n: 'telefono', l: 'Teléfono (opcional, no se publica)' }, { n: 'web', l: 'Página web / ORCID (opcional)', t: 'url' },
    { n: 'especialidad', l: 'Especialidad o profesión', req: true }, { n: 'condicion', l: 'Condición', t: 'select', opts: ['Nombrado', 'Contratado'] },
    { n: 'progud', l: 'Programas de estudio y unidades didácticas', t: 'custom', render: w => progUdHTML(w), bind: (w, box, rer) => bindProgUd(w, box, rer) },
    { n: 'academica', l: 'Información académica', t: 'rows', cols: [{ n: 'nivel', l: 'Nivel / tipo', t: 'select', opts: ['Título técnico', 'Bachiller', 'Título profesional', 'Segunda especialidad', 'Especialización', 'Maestría', 'Doctorado', 'Diplomado'] }, { n: 'titulo', l: 'Título o denominación' }, { n: 'institucion', l: 'Institución' }, { n: 'anio', l: 'Año', t: 'number', w: '80px' }] },
    { n: 'experiencia', l: 'Experiencia profesional (opcional)', t: 'rows', cols: [{ n: 'institucion', l: 'Institución' }, { n: 'cargo', l: 'Cargo' }, { n: 'inicio', l: 'Inicio', w: '80px' }, { n: 'fin', l: 'Término', w: '80px' }] },
    { n: 'otros', l: 'Otros datos (opcional)', t: 'rows', cols: [{ n: 'tipo', l: 'Tipo', t: 'select', opts: ['Reconocimiento', 'Publicación', 'Certificación', 'Otro'] }, { n: 'descripcion', l: 'Descripción' }] },
    { n: 'orden', l: 'Orden de presentación', t: 'number', min: 1, side: true },
  ],
  validate: w => { const e = {}; if (w.dni && !/^\d{8}$/.test(w.dni)) e.dni = 'El DNI debe tener 8 dígitos.'; if (w.tipo === 'Docente' && w.estado === 'Publicado' && !(w.programas || []).length && !w.empleabilidad) e.progud = 'Asocie al docente al menos a un programa o a Empleabilidad para publicarlo.'; (w.academica || []).forEach(a => { if (!a.titulo) e.academica = 'Complete el título de cada antecedente académico o quite la fila.'; }); return e; },
  auditDetail: (w, p) => p ? ['programas', 'uds', 'estado'].filter(k => JSON.stringify(w[k]) !== JSON.stringify(p[k])).map(k => k === 'uds' ? 'Asignación de UD' : k === 'programas' ? 'Asignación de programas' : 'Estado').join(', ') : '',
  beforeDelete: r => alive('jerarquica').some(j => j.personaId === r.id && j.estado === 'Publicado') ? 'La persona integra la plana jerárquica. Retírela de allí primero.' : '',
  inUse: r => coll('programas').some(p => p.coordinadorId === r.id) ? 'La persona es coordinadora de un programa. Reasigne la coordinación primero.' : '',
};
function progUdHTML(w) {
  const ps = sortO(alive('programas'));
  return `<div style="border:1px solid var(--line);border-radius:8px;padding:12px"><div style="display:flex;flex-wrap:wrap;gap:8px 18px;margin-bottom:10px">${ps.map(p => `<label class="check"><input type="checkbox" data-pp="${p.id}" ${(w.programas || []).includes(p.id) ? 'checked' : ''}> ${esc(p.nombre)}</label>`).join('')}<label class="check"><input type="checkbox" data-emp ${w.empleabilidad ? 'checked' : ''}> <b>Empleabilidad</b></label></div>
   ${(w.programas || []).map(pid => { const p = byId('programas', pid); if (!p) return ''; const sel = (w.uds || []).filter(u => u.programaId === pid).map(u => u.udId); return `<details class="mod" open><summary>${esc(p.nombre)} <small style="font-weight:400">${sel.length} UD seleccionada(s)</small></summary><div style="padding:10px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:4px">${p.modulos.map(m => `<div style="grid-column:1/-1;font-weight:700;font-size:12.5px;color:var(--link);margin-top:4px">${esc(m.codigo)} · ${esc(m.nombre)}</div>${m.uds.map(u => `<label class="check" style="font-size:13px"><input type="checkbox" data-ud="${pid}|${u.id}" ${sel.includes(u.id) ? 'checked' : ''}> ${esc(u.nombre)} <small style="color:var(--muted)">(S${u.semestre})</small></label>`).join('')}`).join('')}</div></details>`; }).join('') || '<p style="color:var(--muted);margin:0;font-size:13px">Seleccione programas para asignar unidades didácticas de su catálogo.</p>'}</div>`;
}
function bindProgUd(w, box, rer) {
  $$('[data-pp]', box).forEach(c => c.onchange = () => { const id = c.dataset.pp; w.programas = (w.programas || []).filter(x => x !== id); if (c.checked) w.programas.push(id); else w.uds = (w.uds || []).filter(u => u.programaId !== id); rer(); });
  const e = $('[data-emp]', box); e.onchange = () => { w.empleabilidad = e.checked; };
  $$('[data-ud]', box).forEach(c => c.onchange = () => { const [p, u] = c.dataset.ud.split('|'); w.uds = (w.uds || []).filter(x => !(x.programaId === p && x.udId === u)); if (c.checked) w.uds.push({ programaId: p, udId: u }); });
}
SPECS.locales = {
  key: 'locales', mod: 'locales', coll: 'locales', title: 'Campus y locales', singular: 'local', icon: 'map', states: ESTADOS, label: r => r.nombre, order: true, preview: () => '#/nosotros/campus-e-informes',
  extraActs: () => `${can('paginas') ? '<a class="btn sec" href="#/admin/paginas/pg-campus">Editar página Campus e Informes</a>' : ''}${can('mensajes') ? '<a class="btn sec" href="#/admin/mensajes">Mensajes de contacto</a>' : ''}`,
  cols: [{ l: 'Foto', f: r => thumb(r.foto) }, { l: 'Local', f: r => `<b>${esc(r.nombre)}</b><br><small>${esc(r.direccion)}</small>` }, { l: 'Coordenadas', f: r => r.lat == null || r.lng == null || r.lat === '' || r.lng === '' ? 'Sin coordenadas verificadas' : `${esc(r.lat)}, ${esc(r.lng)}` }, { l: 'Estado', f: r => stBadge(r.estado) }],
  fields: [{ n: 'nombre', l: 'Nombre del local', req: true }, { n: 'telefono', l: 'Teléfono', req: true }, { n: 'direccion', l: 'Dirección (según partida registral)', req: true, full: true }, { n: 'correo', l: 'Correo', t: 'email' }, { n: 'horario', l: 'Horario de atención' }, { n: 'lat', l: 'Latitud', t: 'number', step: 'any', hint: 'Opcional: completa solo con coordenadas verificadas.' }, { n: 'lng', l: 'Longitud', t: 'number', step: 'any' }, { n: 'mapa', l: 'Vista previa de la ubicación', t: 'custom', render: w => `<iframe class="map" style="height:220px" title="Vista previa del mapa" src="https://maps.google.com/maps?q=${encodeURIComponent(w.direccion || inst().direccion)}&output=embed"></iframe><button type="button" class="btn xs sec" data-mapr style="margin-top:6px">Actualizar vista previa con las coordenadas ingresadas</button>`, bind: (w, box, rer) => { $('[data-mapr]', box).onclick = () => rer(); } }, { n: 'foto', l: 'Foto del acceso principal', t: 'image', full: true }, { n: 'orden', l: 'Orden', t: 'number', side: true, min: 1 }],
  validate: w => { const missing = v => v == null || v === ''; if (missing(w.lat) && missing(w.lng)) return {}; if (missing(w.lat) || missing(w.lng)) return {lat:'Completa ambas coordenadas o deja ambas vacías.'}; return !Number.isFinite(+w.lat) || !Number.isFinite(+w.lng) || w.lat < -18.5 || w.lat > 0 || w.lng < -82 || w.lng > -68 ? {lat:'Coordenadas fuera del territorio peruano.'} : {}; },
};
SPECS.reconocimientos = {
  key: 'reconocimientos', mod: 'paginas', coll: 'reconocimientos', title: 'Reconocimientos (hitos)', singular: 'reconocimiento', icon: 'award', states: ESTADOS, label: r => r.titulo, sort: (a, b) => b.anio - a.anio, preview: () => '#/nosotros/reconocimientos',
  tabs: () => tabsBar([['pg', 'Páginas institucionales', '#/admin/paginas'], ['rc', 'Reconocimientos', '#/admin/reconocimientos']], 'rc'),
  cols: [{ l: 'Año', f: r => r.anio }, { l: 'Logro', f: r => `<b>${esc(r.titulo)}</b>` }, { l: 'Resolución', f: r => esc(r.resolucion || '—') }, { l: 'Estado', f: r => stBadge(r.estado) }],
  fields: [{ n: 'anio', l: 'Año', t: 'number', req: true }, { n: 'resolucion', l: 'Resolución (opcional)' }, { n: 'titulo', l: 'Título', req: true, full: true }, { n: 'descripcion', l: 'Descripción', t: 'textarea', full: true, pubReq: true }, { n: 'foto', l: 'Foto', t: 'image', full: true }],
};
/* ---------- Gestión académica ---------- */
SPECS.programas = {
  key: 'programas', mod: 'programas', coll: 'programas', title: 'Programas de estudio', singular: 'programa', icon: 'grad', states: ['Borrador', 'Publicado'], label: r => r.nombre, order: true, softDelete: false,
  sub: 'Plantilla única para los programas de estudio. La plana docente se obtiene automáticamente del módulo Plana docente.',
  canCreate: () => currentUser().rol === 'admin', scope: scopeProg, preview: r => '#/programas/' + (r.slug || slugify(r.nombre)),
  extraActs: () => can('portada') ? `<label class="pview">Vista en la web <select class="inp" data-pview>${[['carrusel', 'Carrusel'], ['grid', 'Cuadrícula']].map(([v, l]) => `<option value="${v}"${progView() === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : '',
  afterList: () => { const sel = $('[data-pview]'); if (sel) sel.onchange = () => { DB.config.home.programasVista = sel.value; audit('Vista de programas', 'Programas de estudio', sel.value === 'carrusel' ? 'Carrusel' : 'Cuadrícula'); if (!saveDB()) return; toast('Los programas se mostrarán en ' + (sel.value === 'carrusel' ? 'carrusel' : 'cuadrícula') + ' en la portada y en la página de programas.', 'ok'); }; },
  cols: [{ l: 'Orden', cls: 'c', f: r => r.orden }, { l: 'Imagen', f: r => thumb(r.imagen) }, { l: 'Programa', f: r => `<b>${esc(r.nombre)}</b><br><small>${esc(r.turno)} · ${esc(r.duracion)}</small>` }, { l: 'Docentes', cls: 'num', f: r => alive('personas').filter(p => (p.programas || []).includes(r.id) && p.estado === 'Publicado').length }, { l: 'UD', cls: 'num', f: r => r.modulos.reduce((a, m) => a + m.uds.length, 0) }, { l: 'Egresados', cls: 'num', f: r => alive('egresados').filter(e => e.programaId === r.id).length }, { l: 'Estado', f: r => stBadge(r.estado) }],
  defaults: () => ({ modulos: [], campoItems: [], convenios: [], duracion: '3 años (6 semestres)', modalidad: 'Presencial', orden: alive('programas').length + 1, docVersiones: [] }),
  versioned: ['brochure', 'malla'],
  fields: [
    { n: 'nombre', l: 'Nombre del programa', req: true, unique: 'norm', full: true }, { n: 'codigo', l: 'Código' }, { n: 'slug', l: 'URL amigable (slug)', unique: true },
    { n: 'resumen', l: 'Descripción breve', t: 'textarea', req: true, max: 300, full: true }, { n: 'imagen', l: 'Imagen principal / banner', t: 'image', full: true },
    { n: 'duracion', l: 'Duración', pubReq: true }, { n: 'modalidad', l: 'Modalidad', t: 'select', pubReq: true, opts: ['Presencial', 'Semipresencial', 'A distancia'] }, { n: 'turno', l: 'Turno', pubReq: true, ph: 'Mañana / Tarde / Mañana y tarde' }, { n: 'horario', l: 'Horario', pubReq: true }, { n: 'titulo', l: 'Título que otorga', full: true },
    { n: 'perfil', l: 'Perfil de egreso', t: 'rich', pubReq: true }, { n: 'campoItems', l: 'Campo laboral (un ámbito por línea)', t: 'lines', full: true, pubReq: true },
    { n: 'modulos', l: 'Malla curricular: módulos profesionales y catálogo de unidades didácticas', t: 'custom', render: w => mallaHTML(w), bind: (w, box, rer) => bindMalla(w, box, rer) },
    { n: 'malla', l: 'Itinerario formativo publicado (2024) (PDF)', t: 'file', full: true, noRemove: false }, { n: 'brochure', l: 'Brochure vigente (PDF)', t: 'file', full: true },
    { n: 'coordinadorId', l: 'Coordinador(a) del programa', t: 'select', opts: w => alive('personas').filter(p => (p.programas || []).includes(w.id)).map(p => [p.id, `${p.apellidos}, ${p.nombres}`]), hint: 'Solo docentes asociados a este programa.' }, { n: 'coordinadorMsg', l: 'Mensaje del coordinador', t: 'textarea' },
    { n: 'convenios', l: 'Convenios para EFSRT (uno por línea)', t: 'lines', full: true },
    { n: 'egr', l: 'Egresados', t: 'info', html: w => `Los egresados y testimonios se administran en <a href="#/admin/egresados">Egresados</a> (${alive('egresados').filter(e => e.programaId === w.id).length} registrados). La plana docente se toma de <a href="#/admin/docentes">Plana docente</a>.` },
    { n: 'orden', l: 'Orden de presentación', t: 'number', min: 1, side: true, req: true },
  ],
  sideExtra: w => (w.docVersiones || []).length ? `<hr style="border:0;border-top:1px solid var(--line);width:100%"><b>Documentos reemplazados</b>${w.docVersiones.slice(0, 6).map(v => `<span>${v.campo === 'malla' ? 'Malla' : 'Brochure'}: ${esc(v.doc.original || v.doc.nombre)} · ${fshort(v.reemplazadoEn)}</span>`).join('')}` : '',
  beforeSave: w => { w.slug = slugify(w.slug || w.nombre); },
  validate: (w, isNew) => {
    const e = {}; const names = {}; (w.modulos || []).forEach(m => { if (!m.nombre) e.modulos = 'Cada módulo debe tener nombre.'; m.uds.forEach(u => { const name = normTitle(u.nombre), k = String(u.semestre) + '|' + name; if (!name) e.modulos = 'Cada unidad didáctica debe tener nombre.'; if (names[k]) e.modulos = `Unidad didáctica duplicada en el semestre ${u.semestre}: “${u.nombre}”.`; names[k] = 1; }); });
    if (!isNew) { const ids = new Set((w.modulos || []).flatMap(m => m.uds.map(u => u.id))); const used = alive('personas').flatMap(p => (p.uds || []).filter(u => u.programaId === w.id && !ids.has(u.udId)).map(u => fullName(p))); if (used.length) e.modulos = 'No puede retirar unidades didácticas asignadas a docentes: ' + [...new Set(used)].join(', ') + '. Primero quite la asignación en Plana docente.'; }
    return e;
  },
};
function mallaHTML(w) {
  return `<div data-malla>${(w.modulos || []).map((m, i) => `<div class="mod" style="padding:10px"><div style="display:grid;grid-template-columns:90px 1fr 170px auto;gap:6px;align-items:center;margin-bottom:6px"><input class="inp" value="${esc(m.codigo)}" data-mm="${i}|codigo" aria-label="Código del módulo"><input class="inp" value="${esc(m.nombre)}" data-mm="${i}|nombre" aria-label="Nombre del módulo" placeholder="Nombre del módulo"><input class="inp" value="${esc(m.efsrt || '')}" data-mm="${i}|efsrt" aria-label="EFSRT" placeholder="EFSRT"><button type="button" class="icon-btn del" data-mdel="${i}" title="Quitar módulo">${ic('trash')}</button></div><table class="tbl light subtbl"><thead><tr><th style="width:70px">Sem.</th><th>Unidad didáctica</th><th style="width:80px">Créditos</th><th style="width:80px">Horas</th><th style="width:40px"></th></tr></thead><tbody>${m.uds.map((u, j) => `<tr><td><input class="inp" type="number" min="1" max="10" value="${esc(u.semestre)}" data-mu="${i}|${j}|semestre" aria-label="Semestre"></td><td><input class="inp" value="${esc(u.nombre)}" data-mu="${i}|${j}|nombre" aria-label="Unidad didáctica"></td><td><input class="inp" type="number" min="0" value="${esc(u.creditos)}" data-mu="${i}|${j}|creditos" aria-label="Créditos"></td><td><input class="inp" type="number" min="0" value="${esc(u.horas)}" data-mu="${i}|${j}|horas" aria-label="Horas"></td><td><button type="button" class="icon-btn del" data-udel="${i}|${j}" title="Quitar UD">${ic('x')}</button></td></tr>`).join('')}</tbody></table><button type="button" class="btn xs ghost" data-uadd="${i}" style="margin-top:6px">+ Agregar unidad didáctica</button></div>`).join('')}<button type="button" class="btn xs sec" data-madd>+ Agregar módulo profesional</button></div>`;
}
function bindMalla(w, box, rer) {
  w.modulos = w.modulos || [];
  $$('[data-mm]', box).forEach(i => i.oninput = () => { const [a, k] = i.dataset.mm.split('|'); w.modulos[+a][k] = i.value; });
  $$('[data-mu]', box).forEach(i => i.oninput = () => { const [a, b, k] = i.dataset.mu.split('|'); w.modulos[+a].uds[+b][k] = ['semestre', 'creditos', 'horas'].includes(k) ? +i.value : i.value; });
  $('[data-madd]', box).onclick = () => { w.modulos.push({ id: w.id + '-m' + uid(), codigo: 'MP0' + (w.modulos.length + 1), nombre: '', efsrt: '', uds: [] }); rer(); };
  $$('[data-mdel]', box).forEach(b => b.onclick = async () => { if (await confirmBox('¿Quitar el módulo y sus unidades didácticas del catálogo?', { ok: 'Quitar' })) { w.modulos.splice(+b.dataset.mdel, 1); rer(); } });
  $$('[data-uadd]', box).forEach(b => b.onclick = () => { const m = w.modulos[+b.dataset.uadd]; m.uds.push({ id: w.id + '-u' + uid(), semestre: 1, nombre: '', creditos: 3, horas: 64 }); rer(); });
  $$('[data-udel]', box).forEach(b => b.onclick = () => { const [a, c] = b.dataset.udel.split('|'); w.modulos[+a].uds.splice(+c, 1); rer(); });
}
SPECS.egresados = {
  key: 'egresados', mod: 'egresados', coll: 'egresados', title: 'Egresados', singular: 'egresado', icon: 'award', states: ESTADOS, label: r => r.nombres, scope: scopeProg,
  filters: [{ n: 'programaId', l: 'Programa', opts: progOpts }], sort: (a, b) => b.anio - a.anio, preview: r => '#/programas/' + ((byId('programas', r.programaId) || {}).slug || ''),
  cols: [{ l: 'Foto', f: r => `<img class="avatar" src="${img(r.foto)}" alt="">` }, { l: 'Nombres', f: r => `<b>${esc(r.nombres)}</b>` }, { l: 'Programa', f: r => esc((byId('programas', r.programaId) || {}).nombre || '') }, { l: 'Año', f: r => r.anio }, { l: 'Estado', f: r => stBadge(r.estado) }],
  defaults: () => ({ programaId: role().ownProgram ? currentUser().programaId : '', anio: yearNow() - 1 }),
  fields: [{ n: 'programaId', l: 'Programa de estudio', t: 'select', req: true, opts: () => progOpts().filter(([id]) => !role().ownProgram || id === currentUser().programaId) }, { n: 'anio', l: 'Año de egreso', t: 'number', req: true }, { n: 'nombres', l: 'Nombres y apellidos', req: true, full: true, unique: 'norm' }, { n: 'testimonio', l: 'Información o testimonio', t: 'textarea', full: true, pubReq: true, max: 400 }, { n: 'foto', l: 'Fotografía', t: 'image', full: true }],
  uniqueScope: (r, w) => r.programaId === w.programaId,
};
SPECS.certificados = {
  key: 'certificados', mod: 'certificados', coll: 'certificados', title: 'Verificación de documentos', singular: 'documento', icon: 'shield', states: ['Válido', 'Anulado'], pubState: 'Válido', label: r => r.codigo,
  sub: 'Registro único que alimenta la consulta pública de autenticidad (por código o DNI). Las constancias y títulos emitidos en Certificación modular y Grados y títulos se agregan automáticamente.', search: ['codigo', 'dni', 'nombres'], preview: () => '#/servicios/consulta-certificados',
  cols: [{ l: 'Código', f: r => `<b>${esc(r.codigo)}</b>` }, { l: 'Titular', f: r => esc(r.nombres) }, { l: 'DNI', f: r => dniCell(r.dni) }, { l: 'Tipo', f: r => esc(r.tipo) }, { l: 'Emisión', f: r => fshort(r.fecha + 'T12:00') }, { l: 'Estado', f: r => stBadge(r.estado) }],
  fields: [{ n: 'codigo', l: 'Código de verificación', req: true, unique: true, ph: 'CERT-2026-000001' }, { n: 'dni', l: 'DNI del titular', req: true }, { n: 'nombres', l: 'Nombres y apellidos', req: true, full: true }, { n: 'programaId', l: 'Programa', t: 'select', req: true, opts: progOpts }, { n: 'tipo', l: 'Tipo de documento', t: 'select', req: true, opts: ['Constancia de certificación modular', 'Reporte de validación de título', 'Título de Profesional Técnico', 'Certificado de estudios', 'Certificado modular – MP01', 'Certificado modular – MP02', 'Certificado modular – MP03', 'Constancia de egresado'] }, { n: 'fecha', l: 'Fecha de emisión', t: 'date', req: true }],
  beforeSave: w => { w.codigo = String(w.codigo || '').toUpperCase(); }, validate: w => /^\d{8}$/.test(w.dni) ? {} : { dni: 'El DNI debe tener 8 dígitos.' },
};
/* ---------- Becas ---------- */
const becasTabs = a => tabsBar([['b', 'Beneficiarios', '#/admin/becas'], ['p', 'Periodos de becas', '#/admin/becasper'], ['t', 'Tipos de beca', '#/admin/becastipos'], ['i', 'Importar desde Excel/CSV', '#/admin/becasimport'], ['r', 'Reportes', '#/admin/becasrep']], a);
const perLabel = id => { const p = byId('becasPeriodos', id); return p ? `${p.anio} - ${p.periodo}` : '—'; };
const perClosed = id => (byId('becasPeriodos', id) || {}).estado === 'Cerrado';
SPECS.becas = {
  key: 'becas', mod: 'becas', coll: 'becarios', title: 'Gestión de becas', singular: 'beneficiario', icon: 'star', states: ['Borrador', 'Publicado', 'Despublicado'], label: r => `${r.apellidos}, ${r.nombres} (${perLabel(r.periodoId)})`,
  sub: 'Administra los periodos, tipos de beca y beneficiarios.', tabs: () => becasTabs('b'),
  search: ['dni', 'apellidos', 'nombres'], searchPh: 'Apellidos, nombres o DNI',
  filters: [{ n: 'periodoId', l: 'Periodo', opts: () => coll('becasPeriodos').map(p => [p.id, `${p.anio} - ${p.periodo}${p.vigente ? ' (vigente)' : ''}`]) }, { n: 'programaId', l: 'Programa', opts: progOpts }, { n: 'tipoId', l: 'Tipo de beca', opts: () => coll('tiposBeca').map(t => [t.id, t.nombre]) }, { n: 'estado', l: 'Estado', opts: ['Borrador', 'Publicado', 'Despublicado'] }],
  sort: (a, b) => a.apellidos.localeCompare(b.apellidos), preview: () => '#/becas',
  cols: [{ l: 'Apellidos y nombres', f: r => `<b>${esc(r.apellidos)}, ${esc(r.nombres)}</b>` }, { l: 'DNI', f: r => dniCell(r.dni) }, { l: 'Programa', f: r => `<small>${esc((byId('programas', r.programaId) || {}).nombre || '')}</small>` }, { l: 'Periodo', f: r => perLabel(r.periodoId) + (perClosed(r.periodoId) ? ' <span class="badge gray">Cerrado</span>' : '') }, { l: 'Tipo de beca', f: r => esc((byId('tiposBeca', r.tipoId) || {}).nombre || '') }, { l: 'Estado', f: r => stBadge(r.estado) }],
  canEdit: r => !perClosed(r.periodoId) || canFlag('closePeriod'), canDelete: r => !perClosed(r.periodoId) || canFlag('closePeriod'),
  exportCSV: { head: ['Periodo', 'Apellidos', 'Nombres', 'DNI', 'Programa', 'Tipo de beca', 'Motivo', 'Estado'], row: r => [perLabel(r.periodoId), r.apellidos, r.nombres, canFlag('viewDni') ? r.dni : maskDni(r.dni), (byId('programas', r.programaId) || {}).nombre, (byId('tiposBeca', r.tipoId) || {}).nombre, r.motivo, r.estado] },
  defaults: () => ({ periodoId: (coll('becasPeriodos').find(p => p.vigente) || {}).id || '', estado: 'Publicado' }),
  fields: [{ n: 'periodoId', l: 'Periodo de becas', t: 'select', req: true, opts: () => coll('becasPeriodos').filter(p => p.estado !== 'Cerrado' || canFlag('closePeriod')).map(p => [p.id, `${p.anio} - ${p.periodo}`]) }, { n: 'dni', l: 'DNI (opcional, privado)', max: 8 }, { n: 'apellidos', l: 'Apellidos', req: true }, { n: 'nombres', l: 'Nombres', req: true }, { n: 'programaId', l: 'Programa de estudio', t: 'select', req: true, opts: progOpts }, { n: 'tipoId', l: 'Tipo de beca', t: 'select', req: true, opts: () => coll('tiposBeca').filter(t => t.estado === 'Activo').map(t => [t.id, t.nombre]) }, { n: 'motivo', l: 'Motivo o descripción', full: true }],
  validate: w => { const e = {}; if (w.dni && !/^\d{8}$/.test(w.dni)) e.dni = 'El DNI debe tener 8 dígitos numéricos.'; const samePerson = b => w.dni ? b.dni === w.dni : normTitle((b.apellidos || '') + ' ' + (b.nombres || '')) === normTitle((w.apellidos || '') + ' ' + (w.nombres || '')); const d = alive('becarios').find(b => b.id !== w.id && samePerson(b) && b.periodoId === w.periodoId && b.programaId === w.programaId && b.tipoId === w.tipoId); if (d) e.dni = 'Este beneficiario ya está registrado con el mismo periodo, programa y tipo de beca.'; else if (w.dni) { const near = alive('becarios').find(b => b.id !== w.id && b.dni === w.dni && b.periodoId === w.periodoId); if (near) toast(`Advertencia: el DNI ya tiene otra beca en el mismo periodo (${(byId('tiposBeca', near.tipoId) || {}).nombre}).`); } if (perClosed(w.periodoId) && !canFlag('closePeriod')) e.periodoId = 'El periodo está cerrado.'; return e; },
};
SPECS.becasper = {
  key: 'becasper', mod: 'becas', coll: 'becasPeriodos', title: 'Periodos de becas', singular: 'periodo', icon: 'calendar', states: ['Borrador', 'Publicado', 'Cerrado'], label: r => `${r.anio} - ${r.periodo}`, tabs: () => becasTabs('p'), softDelete: false,
  sort: (a, b) => b.anio - a.anio || b.periodo.localeCompare(a.periodo),
  cols: [{ l: 'Año', f: r => r.anio }, { l: 'Periodo', f: r => r.periodo }, { l: 'Beneficiarios', cls: 'num', f: r => alive('becarios').filter(b => b.periodoId === r.id).length }, { l: 'Vigente', f: r => r.vigente ? '<span class="badge ok">Vigente</span>' : '' }, { l: 'Estado', f: r => stBadge(r.estado) }],
  defaults: () => ({ anio: yearNow(), periodo: 'I', vigente: false }),
  fields: [{ n: 'anio', l: 'Año académico', t: 'number', req: true }, { n: 'periodo', l: 'Periodo', t: 'select', req: true, empty: false, opts: ['I', 'II'] }, { n: 'vigente', l: 'Marcar como periodo vigente (se muestra por defecto en el portal)', t: 'checkbox', full: true }, { n: 'info', t: 'info', html: () => 'Un periodo <b>Cerrado</b> se conserva como histórico y bloquea la edición de sus beneficiarios, salvo para el Administrador.' }],
  validate: w => alive('becasPeriodos').some(p => p.id !== w.id && p.anio == w.anio && p.periodo === w.periodo) ? { periodo: 'Ya existe ese año y periodo.' } : {},
  afterSave: w => { if (w.vigente && w.estado === 'Publicado') coll('becasPeriodos').forEach(p => { if (p.id !== w.id) p.vigente = false; }); },
};
SPECS.becastipos = {
  key: 'becastipos', mod: 'becas', coll: 'tiposBeca', title: 'Tipos de beca', singular: 'tipo de beca', icon: 'star', states: ['Activo', 'Inactivo'], pubState: 'Activo', label: r => r.nombre, tabs: () => becasTabs('t'), softDelete: false,
  cols: [{ l: 'Nombre', f: r => `<b>${esc(r.nombre)}</b>` }, { l: 'Descripción', f: r => esc(r.descripcion) }, { l: 'Beneficiarios', cls: 'num', f: r => alive('becarios').filter(b => b.tipoId === r.id).length }, { l: 'Estado', f: r => stBadge(r.estado) }],
  fields: [{ n: 'nombre', l: 'Nombre', req: true, unique: 'norm', full: true }, { n: 'descripcion', l: 'Descripción y requisitos', t: 'textarea', req: true, full: true, hint: 'Desactivar un tipo no modifica los registros históricos.' }],
};
/* ---------- Servicios, enlaces, portada ---------- */
const linkGroupOptions = () => { const base = [['servicio','Servicios'],['minedu','MINEDU y entidades'],['interes','De interés']]; return base.concat([...new Set(coll('enlaces').map(r=>r.grupo).filter(Boolean))].filter(g=>!base.some(([id])=>id===g)).map(g=>[g,g])); };
SPECS.enlaces = {
  key: 'enlaces', mod: 'enlaces', coll: 'enlaces', title: 'Enlaces y servicios externos', singular: 'enlace', icon: 'link', states: ['Activo', 'Inactivo'], pubState: 'Activo', label: r => r.nombre, softDelete: false,
  sub: 'URL configurable de cada servicio externo. Un enlace inactivo o sin URL no se muestra en el portal (evita enlaces rotos).', filters: [{ n: 'grupo', l: 'Grupo', opts: linkGroupOptions }],
  cols: [{ l: 'Nombre', f: r => `<b>${esc(r.nombre)}</b>` }, { l: 'URL', f: r => r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(clamp(r.url, 45))}</a>` : '<span class="badge warn">Sin configurar</span>' }, { l: 'Grupo', f: r => esc(r.grupo) }, { l: 'Última verificación', f: r => r.verificado ? fshort(r.verificado + 'T12:00') + (Date.now() - new Date(r.verificado) > 31 * 864e5 ? ' <span class="badge warn">Revisar</span>' : '') : '—' }, { l: 'Estado', f: r => stBadge(r.estado) }],
  rowActs: r => r.url ? ib('chk', 'check', 'Marcar como verificado hoy') : '',
  onAct: (a, r, rer) => { if (a === 'chk') { window.open(r.url, '_blank', 'noopener'); r.verificado = localYmd(); audit('Verificación de enlace', 'Enlaces', r.nombre); saveDB(); rer(); } },
  fields: [{ n: 'nombre', l: 'Nombre', req: true }, { n: 'grupo', l: 'Grupo', t: 'select', req: true, opts: linkGroupOptions }, { n: 'url', l: 'URL', t: 'url', full: true, pubReq: true }, { n: 'color', l: 'Color del logotipo', t: 'color' }, { n: 'verificado', l: 'Fecha de última verificación', t: 'date' }],
};
SPECS.servicios = {
  key: 'servicios', mod: 'servicios', coll: 'servicios', title: 'Servicios complementarios', singular: 'servicio', icon: 'heart', states: ESTADOS, label: r => r.nombre, order: true, preview: () => '#/servicios/complementarios',
  cols: [{ l: 'Orden', cls: 'c', f: r => r.orden }, { l: 'Servicio', f: r => `<b>${esc(r.nombre)}</b>` }, { l: 'Horario', f: r => esc(r.horario) }, { l: 'Costo', f: r => esc(r.costo) }, { l: 'Estado', f: r => stBadge(r.estado) }],
  fields: [{ n: 'nombre', l: 'Nombre', req: true }, { n: 'icono', l: 'Ícono', t: 'select', opts: ['heart', 'users', 'briefcase', 'book', 'monitor', 'tool', 'coffee', 'building'] }, { n: 'descripcion', l: 'Descripción', t: 'textarea', full: true, req: true }, { n: 'ubicacion', l: 'Ubicación' }, { n: 'horario', l: 'Horario (días y horas)', req: true }, { n: 'responsable', l: 'Personal a cargo' }, { n: 'costo', l: 'Costo', req: true }, { n: 'orden', l: 'Orden', t: 'number', side: true, min: 1 }],
};
SPECS.slides = {
  key: 'slides', mod: 'portada', coll: 'slides', title: 'Portada – carrusel', singular: 'diapositiva', icon: 'image', states: ESTADOS, label: r => r.titulo, order: true, preview: () => '#/',
  tabs: () => portadaTabs('s'),
  cols: [{ l: 'Orden', cls: 'c', f: r => r.orden }, { l: 'Imagen', f: r => thumb(r.imagen) }, { l: 'Título', f: r => `<b>${esc(r.titulo)}</b><br><small>${esc(r.texto)}</small>` }, { l: 'Botón', f: r => esc(r.boton) }, { l: 'Estado', f: r => stBadge(r.estado) }],
  fields: [{ n: 'titulo', l: 'Título', req: true, full: true, max: 70 }, { n: 'texto', l: 'Texto', t: 'textarea', full: true, max: 180 }, { n: 'boton', l: 'Texto del botón', max: 30 }, { n: 'enlace', l: 'Enlace del botón', ph: '#/admision o https://…' }, { n: 'imagen', l: 'Imagen de la portada', t: 'image', full: true, req: true, hq: true, hint: 'Medida recomendada: 1920 × 800 px o mayor (ideal 2560 × 1066 px), JPG o WEBP. Se guarda en alta calidad (hasta 2560 px). Deje lo importante lejos de los bordes.' },
    { n: 'modo', l: 'Presentación', t: 'select', empty: false, opts: [['', 'Imagen con título y texto'], ['imagen', 'Solo imagen (afiche que ya trae su texto)']], hint: '«Solo imagen» muestra el afiche completo, sin título, texto ni oscurecido. Si tiene enlace, toda la imagen es clicable; el título se usa como descripción para lectores de pantalla.' },
    { n: 'ajuste', l: 'Ajuste de la imagen', t: 'select', empty: false, opts: [['', 'Automático (recomendado)'], ['cover', 'Llenar el espacio (fotos)'], ['contain', 'Mostrar completa (afiches con texto)']], hint: '«Automático» llena el espacio con las fotos y muestra completas las imágenes más altas que el carrusel, con los bordes difuminados. «Solo imagen» siempre la muestra completa.' },
    { n: 'enfoque', l: 'Punto de enfoque', t: 'select', empty: false, opts: [['center', 'Centro'], ['left', 'Izquierda'], ['right', 'Derecha'], ['top', 'Arriba'], ['bottom', 'Abajo']], hint: 'Parte de la foto que no debe recortarse.' },
    { n: 'capa', l: 'Oscurecido para el texto', t: 'select', empty: false, opts: [['', 'Según el diseño (recomendado)'], ['suave', 'Suave'], ['fuerte', 'Fuerte'], ['ninguna', 'Sin oscurecer']] },
    { n: 'realce', l: 'Realce de imagen (contraste y color)', t: 'select', empty: false, opts: [['', 'Sí (recomendado)'], ['no', 'No']] },
    { n: 'orden', l: 'Orden', t: 'number', side: true, req: true, min: 1 }],
  validate: w => w.enlace && !/^(#\/|https?:\/\/|ext:)/.test(w.enlace) ? { enlace: 'Use una ruta interna (#/…) o una URL completa (https://…). No use “#” vacío.' } : (w.boton && !w.enlace ? { enlace: 'Indique el enlace del botón.' } : {}),
};
const portadaTabs = a => tabsBar([['s', 'Carrusel', '#/admin/slides'], ['b', 'Bloques, accesos y cifras', '#/admin/portada'], ['p', 'Ventana emergente', '#/admin/popup']], a);
SPECS.usuarios = {
  key: 'usuarios', mod: 'usuarios', coll: 'usuarios', title: 'Usuarios y roles', singular: 'usuario', icon: 'key', states: ['Activo', 'Inactivo'], pubState: 'Activo', label: r => r.usuario, softDelete: false,
  cols: [{ l: 'Usuario', f: r => `<b>${esc(r.usuario)}</b>` }, { l: 'Nombre', f: r => esc(r.nombre) }, { l: 'Rol', f: r => esc(ROLES[r.rol]?.label) + (r.programaId ? ` <small>(${esc((DB.programas.find(p => p.id === r.programaId) || {}).codigo || r.programaId.toUpperCase())})</small>` : '') }, { l: 'Último acceso', f: r => r.ultimoAcceso ? fshort(r.ultimoAcceso, true) : '—' }, { l: 'Seguridad', f: r => r.bloqueadoHasta > Date.now() ? '<span class="badge err">Bloqueado</span>' : '<span class="badge ok">OK</span>' }, { l: 'Estado', f: r => stBadge(r.estado) }],
  rowActs: r => r.bloqueadoHasta > Date.now() ? ib('unlock', 'lock', 'Desbloquear') : '',
  onAct: (a, r, rer) => { if (a === 'unlock') { r.bloqueadoHasta = 0; r.intentos = 0; audit('Desbloqueo de cuenta', 'Usuarios', r.usuario); saveDB(); rer(); } },
  afterList: () => { $('.adm-main').insertAdjacentHTML('beforeend', `<div class="panel"><h2 id="perm-h">Matriz de permisos por rol</h2><div class="tbl-wrap" style="border:0" tabindex="0" role="region" aria-labelledby="perm-h"><table class="tbl light perm-grid"><thead><tr><th>Módulo</th>${Object.values(ROLES).map(r => `<th>${esc(r.label)}</th>`).join('')}</tr></thead><tbody>${Object.entries(MODULES).map(([k, l]) => `<tr><td>${esc(l)}</td>${Object.values(ROLES).map(r => `<td>${r.mods.includes(k) ? '✔' : '<span style="color:#ccc">—</span>'}</td>`).join('')}</tr>`).join('')}<tr><td><b>Publicar</b></td>${Object.values(ROLES).map(r => `<td>${r.publish ? '✔' : '—'}</td>`).join('')}</tr><tr><td><b>Aprobar (Transparencia, Admisión, Convocatorias)</b></td>${Object.values(ROLES).map(r => `<td>${r.approve ? '✔' : '—'}</td>`).join('')}</tr><tr><td><b>Eliminación definitiva</b></td>${Object.values(ROLES).map(r => `<td>${r.hardDelete ? '✔' : '—'}</td>`).join('')}</tr><tr><td><b>Ver DNI completo</b></td>${Object.values(ROLES).map(r => `<td>${r.viewDni ? '✔' : '—'}</td>`).join('')}</tr></tbody></table></div></div>`); },
  fields: w => [{ n: 'usuario', l: 'Usuario', req: true, unique: true, ro: () => !!w.has_password }, { n: 'nombre', l: 'Nombre completo', req: true }, { n: 'rol', l: 'Rol', t: 'select', req: true, opts: Object.entries(ROLES).map(([k, r]) => [k, r.label]) }, { n: 'programaId', l: 'Programa (solo para Coordinador)', t: 'select', opts: progOpts }, { n: 'vin', l: 'Vinculado a (docente, estudiante o empresa)', t: 'select', opts: () => IX ? IX.vinOpts() : [], hint: 'Para cuentas de la comunidad educativa: muestra su horario, certificaciones o bolsa laboral.' }, { n: 'dni', l: 'DNI / RUC (opcional)', max: 11 }, { n: 'pass1', l: w.has_password ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña', t: 'password', hint: 'Mínimo 8 caracteres, con mayúscula, número y símbolo. Se almacena cifrada (SHA-256).' }, { n: 'pass2', l: 'Repetir contraseña', t: 'password' }],
  validate: w => { const e = {}; if (w.pass1 || !w.has_password) { if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(w.pass1 || '')) e.pass1 = 'La contraseña no cumple la política de seguridad.'; else if (w.pass1 !== w.pass2) e.pass2 = 'Las contraseñas no coinciden.'; } if (w.rol === 'coordinador' && !w.programaId) e.programaId = 'Seleccione el programa del coordinador.'; if (['estudiante', 'egresado'].includes(w.rol) && !String(w.vin || '').startsWith('est:')) e.vin = 'Elija al alumno en «Vinculado a», o regístrelo primero en Gestión académica › Maestro de alumnos (también puede crear su acceso desde ahí).'; if (w.id === currentUser().id && (w.estado !== 'Activo' || w.rol !== 'admin')) e.rol = 'No puede quitarse a sí mismo el rol de Administrador ni desactivarse.'; return e; },
  beforeSave: w => { w.usuario = String(w.usuario || '').toLowerCase().replace(/\s/g, ''); if (w.rol !== 'coordinador') w.programaId = ''; if (['estudiante', 'egresado'].includes(w.rol) && IX) { if (!String(w.vin || '').startsWith('est:')) { const e = IX.findEst(w.dni) || IX.findEst(w.usuario); if (e) w.vin = 'est:' + e.id; } const e2 = String(w.vin || '').startsWith('est:') ? IX.estById(String(w.vin).slice(4)) : null; if (e2) { w.dni = e2.dni; if (!w.nombre) w.nombre = e2.nom; } } },
  afterSave: w => { if (w.pass1) { w.has_password = hashPass(w.usuario, w.pass1); w.intentos = 0; } delete w.pass1; delete w.pass2; if (!w.ixId) w.ixId = Math.max(100, ...coll('usuarios').map(u => +u.ixId || 0)) + 1; },
};

/* ==== admin3.js ==== */
/* =========================================================
   PANEL ADMINISTRATIVO – módulos especiales y enrutador
   ========================================================= */
SPECS.paginas = {
  key: 'paginas', mod: 'paginas', coll: 'paginas', title: 'Páginas institucionales', singular: 'página', icon: 'file', states: ['Borrador', 'Publicada'], pubState: 'Publicada', label: r => r.titulo, softDelete: false, canCreate: () => currentUser()?.rol === 'admin', defaults: () => ({clave:'',versiones:[],estado:'Borrador'}),
  sub: 'Edita las páginas institucionales o crea páginas adicionales con su propia dirección pública.',
  tabs: () => tabsBar([['pg', 'Páginas institucionales', '#/admin/paginas'], ['rc', 'Reconocimientos', '#/admin/reconocimientos']], 'pg'),
  cols: [{ l: 'Página', f: r => `<b>${esc(r.titulo)}</b>` }, { l: 'URL', f: r => `<code>${esc(PAGE_ROUTE[r.clave] || '#/paginas/' + r.slug)}</code>` }, { l: 'Versiones', cls: 'num', f: r => (r.versiones || []).length }, { l: 'Última modificación', f: r => `${fshort(r.modEn, true)}<br><small>${esc(r.modPor)}</small>` }, { l: 'Estado', f: r => stBadge(r.estado) }],
  sort: (a, b) => Object.keys(PAGE_ROUTE).indexOf(a.clave) - Object.keys(PAGE_ROUTE).indexOf(b.clave),
  preview: r => PAGE_ROUTE[r.clave] || '#/paginas/' + r.slug,
  fields: w => [
    { n: 'titulo', l: 'Título de la página', req: true, full: true },
    ['jerarquica', 'docentes', 'campus'].includes(w.clave) ? { n: 'contenido', l: 'Descripción introductoria', t: 'textarea', req: true, full: true, max: 400 } : { n: 'contenido', l: 'Contenido', t: 'rich', pubReq: true },
    { n: 'imagen', l: 'Imagen principal', t: 'image', full: true },
    { n: 'mensaje', l: w.clave === 'jerarquica' ? 'Mensaje de la Dirección General' : 'Mensaje institucional destacado (opcional)', t: 'textarea', full: true, max: 600 },
    { n: 'slug', l: 'URL amigable (slug)', req: true, unique: true, side: true },
  ],
  beforeSave: w => { w.slug = slugify(w.slug); if (!w.clave) w.clave = 'custom-' + w.id; if (/^<|>$/.test(w.contenido || '') === false && ['jerarquica', 'docentes', 'campus'].includes(w.clave)) w.contenido = String(w.contenido || '').replace(/<[^>]+>/g, ''); },
  afterSave: (w, isNew, prev) => { if (prev) { const snap = { titulo: prev.titulo, contenido: prev.contenido, imagen: prev.imagen, mensaje: prev.mensaje, estado: prev.estado, fecha: prev.modEn, por: prev.modPor }; w.versiones = [snap].concat(prev.versiones || []).slice(0, 10); } },
  sideExtra: w => (w.versiones || []).length ? `<hr style="border:0;border-top:1px solid var(--line);width:100%"><b>Versiones anteriores</b>${w.versiones.map((v, i) => `<span style="display:flex;justify-content:space-between;gap:6px;align-items:center">${fshort(v.fecha, true)} · ${esc(v.por)} <button type="button" class="btn xs ghost" data-restv="${i}">Restaurar</button></span>`).join('')}` : '',
  afterForm: (w, isNew, rer) => { $$('[data-restv]').forEach(b => b.onclick = async () => { const v = w.versiones[+b.dataset.restv]; if (!await confirmBox(`¿Cargar la versión del ${fshort(v.fecha, true)} en el editor? Deberá guardar para aplicarla.`, { ok: 'Cargar versión', danger: false })) return; Object.assign(w, { titulo: v.titulo, contenido: v.contenido, imagen: v.imagen, mensaje: v.mensaje }); route(); toast('Versión cargada en el editor. Revise y guarde.'); }); },
};
/* ---------- Admisión ---------- */
SPECS.admision = {
  key: 'admision', mod: 'admision', coll: 'admisiones', title: 'Gestión del proceso de admisión', singular: 'proceso de admisión', icon: 'clipboard', states: ['Borrador', 'Publicado', 'Cerrado'], label: r => 'Admisión ' + r.anio, softDelete: false,
  sub: 'Administra la información, documentos y resultados por programa y turno. Los procesos anteriores se conservan como histórico.',
  sort: (a, b) => b.anio - a.anio, preview: r => '#/admision' + (r.vigente ? '' : '?anio=' + r.anio),
  cols: [{ l: 'Año', f: r => `<b>${r.anio}</b>` }, { l: 'Título', f: r => esc(r.titulo) }, { l: 'Documentos', f: r => `${r.prospecto ? `<span class="badge">${esc(prospectusLabel(r.prospecto))}</span>` : ''} ${r.reglamento ? '<span class="badge">Reglamento</span>' : ''}` }, { l: 'Resultados publicados', cls: 'num', f: r => Object.values(r.resultados || {}).reduce((a, x) => a + (x.M ? 1 : 0) + (x.T ? 1 : 0), 0) }, { l: 'Vigente', f: r => r.vigente ? '<span class="badge ok">Proceso vigente</span>' : '' }, { l: 'Estado', f: r => stBadge(r.estado) }],
  defaults: () => ({ anio: yearNow() + 1, titulo: 'Inscripciones del Concurso de Admisión ' + (yearNow() + 1), resultados: {}, historial: [], vacantes: {}, cronograma: [], requisitos: [], modalidades: [], vigente: false }),
  fields: w => [
    { n: 'anio', l: 'Año del proceso', t: 'number', req: true, unique: true, ro: () => !!byId('admisiones', w.id) },
    { n: 'titulo', l: 'Título principal', req: true },
    { n: 'subtitulo', l: 'Subtítulo', full: true }, { n: 'descripcion', l: 'Descripción o mensaje introductorio', t: 'textarea', full: true },
    { n: 'prospecto', l: 'Prospecto de admisión', t: 'file', hint: 'El archivo heredado es un temario de 2025. Sustitúyalo por el prospecto aprobado del proceso correspondiente.' }, { n: 'reglamento', l: 'Reglamento de admisión', t: 'file', hint: 'Se muestra también en Documentos de Gestión (referencia).' },
    { n: 'resultados', l: 'Resultados por programa de estudio y turno', t: 'custom', render: resHTML, bind: bindRes },
    { n: 'vacantes', l: 'Vacantes por programa y turno', t: 'custom', render: x => `<div class="tbl-wrap"><table class="tbl light subtbl"><thead><tr><th>Programa</th><th style="width:110px">Mañana</th><th style="width:110px">Tarde</th><th style="width:110px">Noche</th><th style="width:110px">Total publicado</th></tr></thead><tbody>${sortO(alive('programas')).map(p => `<tr><td>${esc(p.nombre)}</td>${['M', 'T', 'N', 'total'].map(t => `<td><input class="inp" type="number" min="0" value="${((x.vacantes || {})[p.id] || {})[t] || ''}" data-vac="${p.id}|${t}" aria-label="Vacantes ${({M:'mañana',T:'tarde',N:'noche',total:'total publicado'})[t]} ${esc(p.nombre)}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`, bind: (x, box) => $$('[data-vac]', box).forEach(i => i.oninput = () => { const [p, t] = i.dataset.vac.split('|'); x.vacantes = x.vacantes || {}; x.vacantes[p] = x.vacantes[p] || {}; x.vacantes[p][t] = i.value === '' ? 0 : +i.value; }) },
    { n: 'cronograma', l: 'Cronograma', t: 'rows', cols: [{ n: 'actividad', l: 'Actividad' }, { n: 'fecha', l: 'Fecha(s)' }] },
    { n: 'requisitos', l: 'Requisitos (uno por línea)', t: 'lines', full: true },
    { n: 'modalidades', l: 'Modalidades de admisión', t: 'rows', cols: [{ n: 'nombre', l: 'Modalidad' }, { n: 'detalle', l: 'Detalle' }] },
    { n: 'vigente', l: 'Proceso vigente (se muestra por defecto en el portal)', t: 'checkbox', side: true },
  ],
  validate: w => { const e = {}; if (!(w.anio >= 2000 && w.anio <= 2100)) e.anio = 'Año no válido.'; if (w.estado === 'Borrador' && w.vigente) e.vigente = 'Un proceso en borrador no puede marcarse como vigente.'; return e; },
  afterSave: w => { if (w.vigente && w.estado === 'Publicado') coll('admisiones').forEach(a => { if (a.id !== w.id && a.vigente) { a.vigente = false; stamp(a); } }); if (w.estado === 'Cerrado') w.vigente = false; },
};
function resHTML(w) {
  return `<div class="notice" style="margin-top:0">Cargue un archivo solo para los turnos que correspondan. El botón “Ver Resultados” aparece en el portal únicamente cuando existe el archivo.</div><div class="tbl-wrap"><table class="tbl light subtbl"><thead><tr><th>N.º</th><th>Programa de estudio</th><th>Resultado turno mañana</th><th>Resultado turno noche</th></tr></thead><tbody>${sortO(alive('programas')).map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.nombre)}</td>${['M', 'T'].map(t => { const r = ((w.resultados || {})[p.id] || {})[t]; return `<td style="min-width:200px">${r ? `<span class="file-chip"><span class="ft">PDF</span>${esc(clamp(r.original || r.nombre, 26))}</span><div style="display:flex;gap:4px;margin-top:4px"><button type="button" class="btn xs ghost" data-rv="${p.id}|${t}">Ver</button><label class="btn xs sec" style="cursor:pointer">Reemplazar<input type="file" accept=".pdf" hidden data-rr="${p.id}|${t}"></label><button type="button" class="btn xs ghost" data-rx="${p.id}|${t}">Retirar</button></div>` : `<label class="btn xs ghost" style="cursor:pointer">${ic('upload').replace('<svg', '<svg style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2"')} Cargar PDF<input type="file" accept=".pdf" hidden data-rr="${p.id}|${t}"></label>`}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>${(w.historial || []).length ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px">Historial de resultados reemplazados o retirados (${w.historial.length})</summary><ul style="font-size:12.5px">${w.historial.map(h => `<li>${fshort(h.fecha, true)} · ${esc(h.accion)} · ${esc(h.programa)} turno ${h.turno === 'M' ? 'mañana' : 'tarde'} · ${esc(h.archivo)} · ${esc(h.por)}</li>`).join('')}</ul></details>` : ''}`;
}
function bindRes(w, box, rer) {
  w.resultados = w.resultados || {}; w.historial = w.historial || [];
  const pn = id => (byId('programas', id) || {}).nombre;
  $$('[data-rv]', box).forEach(b => b.onclick = () => { const [p, t] = b.dataset.rv.split('|'); openDoc(w.resultados[p][t]); });
  $$('[data-rr]', box).forEach(inp => inp.onchange = () => editorFileTask(inp, async () => {
    const f = inp.files[0]; if (!f) return; const [p, t] = inp.dataset.rr.split('|'); const er = checkFile(f, 'pdf'); if (er) return toast(er, 'err');
    const cur = (w.resultados[p] || {})[t];
    if (cur && !await confirmBox(`Ya existe un resultado para ${esc(pn(p))} – turno ${({M:'mañana',T:'tarde',N:'noche',total:'total publicado'})[t]}. ¿Reemplazarlo? El anterior quedará en el historial.`, { ok: 'Reemplazar', danger: false })) { inp.value = ''; return; }
    const file = await portalUpload(f); if (ADM.work !== w) return;
    if (cur) w.historial.unshift({ fecha: nowISO(), accion: 'Reemplazo', programa: pn(p), turno: t, archivo: cur.original || cur.nombre, por: currentUser().usuario });
    w.resultados[p] = w.resultados[p] || {}; w.resultados[p][t] = {...file,fecha:nowISO(),por:currentUser().usuario}; rer();
  }));
  $$('[data-rx]', box).forEach(b => b.onclick = async () => { const [p, t] = b.dataset.rx.split('|'); if (!await confirmBox(`¿Retirar el resultado de ${esc(pn(p))} – turno ${({M:'mañana',T:'tarde',N:'noche',total:'total publicado'})[t]}? El botón dejará de mostrarse en el portal.`, { ok: 'Retirar' })) return; const cur = w.resultados[p][t]; w.historial.unshift({ fecha: nowISO(), accion: 'Retiro', programa: pn(p), turno: t, archivo: cur.original || cur.nombre, por: currentUser().usuario }); delete w.resultados[p][t]; rer(); });
}
/* ---------- Matrícula ---------- */
const SECC = [['costos', 'Costos de matrícula', 'money'], ['ingresantes', 'Matrícula de ingresantes', 'user'], ['ratificacion', 'Ratificación de matrícula', 'restore']];
SPECS.matricula = {
  key: 'matricula', mod: 'matricula', coll: 'matriculas', title: 'Gestión de matrícula', singular: 'periodo de matrícula', icon: 'book', states: ['Borrador', 'Publicado', 'Cerrado'], label: r => 'Matrícula ' + r.periodo, softDelete: false,
  sub: 'Cada periodo es un registro independiente; los periodos anteriores se conservan como histórico.',
  sort: (a, b) => String(b.periodo).localeCompare(a.periodo), preview: () => '#/matricula',
  cols: [{ l: 'Periodo', f: r => `<b>${esc(r.periodo)}</b>` }, { l: 'Título', f: r => esc(r.titulo) }, { l: 'Inicio de clases', f: r => fshort(r.inicioClases + 'T12:00') }, { l: 'Ítems', cls: 'num', f: r => (r.items || []).filter(i => !i.deleted).length }, { l: 'Vigente', f: r => r.vigente ? '<span class="badge ok">Vigente</span>' : '' }, { l: 'Estado', f: r => stBadge(r.estado) }],
  rowActs: () => ib('copy', 'copy', 'Crear nuevo periodo copiando esta estructura'),
  onAct: async (a, r) => { if (a !== 'copy') return; const p = await promptBox('Identificación del nuevo periodo académico (ej.: 2027-I):', { title: 'Nuevo periodo a partir de ' + r.periodo, ok: 'Crear periodo' }); if (!p) return; if (coll('matriculas').some(m => normTitle(m.periodo) === normTitle(p))) return toast('Ya existe un periodo con esa identificación.', 'err'); const c = JSON.parse(JSON.stringify(r)); Object.assign(c, { id: uid(), periodo: p.trim(), titulo: 'Matrícula Regular ' + p.trim(), estado: 'Borrador', vigente: false, docTasas: null, docVersiones: [], cronograma: [] }); c.items = c.items.filter(i => !i.deleted).map(i => Object.assign(i, { id: uid() })); stamp(c, true); coll('matriculas').push(c); audit('Creación (copia de estructura)', 'Matrícula', 'Matrícula ' + c.periodo, 'Copiado de ' + r.periodo); if(!saveDB())return; toast('Periodo creado como borrador. El periodo original no se modificó.', 'ok'); go('#/admin/matricula/' + c.id); },
  defaults: () => ({ items: [], cronograma: [], vigente: false }), versioned: ['docTasas'],
  fields: w => [
    { n: 'periodo', l: 'Periodo académico', req: true, unique: 'norm', ro: () => !!byId('matriculas', w.id), ph: '2027-I' }, { n: 'titulo', l: 'Título principal', pubReq: true }, { n: 'inicioClases', l: 'Fecha de inicio de clases', t: 'date', pubReq: true },
    { n: 'descripcion', l: 'Descripción del proceso', t: 'rich' },
    { n: 'items', l: 'Requisitos e indicaciones por sección', t: 'custom', render: itemsHTML, bind: bindItems },
    { n: 'docTasas', l: 'Documento oficial de tasas y costos', t: 'file', full: true },
    { n: 'cronograma', l: 'Cronograma del periodo', t: 'rows', cols: [{ n: 'actividad', l: 'Actividad' }, { n: 'fecha', l: 'Fecha(s)' }] },
    { n: 'vigente', l: 'Periodo vigente (se muestra en el portal)', t: 'checkbox', side: true },
  ],
  validate: w => { const e = {}; SECC.forEach(([s]) => { const seen = {}; (w.items || []).filter(i => i.seccion === s && !i.deleted).forEach(i => { const k = normTitle(i.texto); if (!k) e.items = 'Hay ítems vacíos.'; if (seen[k]) e.items = `Requisito duplicado en la misma sección: “${clamp(i.texto, 50)}”.`; seen[k] = 1; }); }); if (w.vigente && w.estado === 'Borrador') e.vigente = 'Un periodo en borrador no puede ser vigente.'; return e; },
  afterSave: w => { if (w.vigente && w.estado === 'Publicado') coll('matriculas').forEach(m => { if (m.id !== w.id) m.vigente = false; }); if (w.estado === 'Cerrado') w.vigente = false; },
};
function itemsHTML(w) {
  return `<div class="grid g3">${SECC.map(([s, l, icn]) => { const its = (w.items || []).map((x, i) => ({ x, i })).filter(o => o.x.seccion === s).sort((a, b) => a.x.orden - b.x.orden); return `<div class="panel" style="margin:0"><h2 style="font-size:14px">${ic(icn).replace('<svg', '<svg style="width:17px;height:17px;stroke:var(--link);fill:none;stroke-width:2"')} ${l}</h2><div class="pb" style="display:grid;gap:6px">${its.map(({ x, i }) => `<div style="display:flex;gap:4px;align-items:flex-start;${x.deleted ? 'opacity:.5' : ''}"><textarea class="inp" style="min-height:54px;font-size:13px" data-it="${i}" aria-label="Ítem" ${x.deleted ? 'disabled' : ''}>${esc(x.texto)}</textarea><div style="display:grid;gap:2px">${x.deleted ? `<button type="button" class="icon-btn" data-ires="${i}" title="Restaurar">${ic('restore')}</button>` : `<button type="button" class="icon-btn" data-iup="${i}" title="Subir">${ic('up')}</button><button type="button" class="icon-btn" data-ipub="${i}" title="${x.estado === 'Publicado' ? 'Despublicar' : 'Publicar'}" style="${x.estado === 'Publicado' ? '' : 'color:var(--warn)'}">${ic(x.estado === 'Publicado' ? 'eye' : 'lock')}</button><button type="button" class="icon-btn del" data-idel="${i}" title="Eliminar">${ic('trash')}</button>`}</div></div>`).join('') || '<small style="color:var(--muted)">Sin ítems.</small>'}<button type="button" class="btn xs sec" data-iadd="${s}">+ Agregar ítem</button></div></div>`; }).join('')}</div>`;
}
function bindItems(w, box, rer) {
  w.items = w.items || [];
  $$('[data-it]', box).forEach(t => t.oninput = () => w.items[+t.dataset.it].texto = t.value);
  $$('[data-iadd]', box).forEach(b => b.onclick = () => { const s = b.dataset.iadd; w.items.push({ id: uid(), seccion: s, texto: '', orden: Math.max(0, ...w.items.filter(i => i.seccion === s).map(i => i.orden)) + 1, estado: 'Publicado' }); rer(); });
  $$('[data-iup]', box).forEach(b => b.onclick = () => { const it = w.items[+b.dataset.iup]; const sib = w.items.filter(i => i.seccion === it.seccion).sort((a, c) => a.orden - c.orden); const k = sib.indexOf(it); if (k > 0) { const o = sib[k - 1].orden; sib[k - 1].orden = it.orden; it.orden = o; if (sib[k - 1].orden === it.orden) it.orden--; rer(); } });
  $$('[data-ipub]', box).forEach(b => b.onclick = () => { const it = w.items[+b.dataset.ipub]; it.estado = it.estado === 'Publicado' ? 'Despublicado' : 'Publicado'; rer(); });
  $$('[data-idel]', box).forEach(b => b.onclick = async () => { if (await confirmBox('¿Eliminar este ítem? Podrá restaurarlo antes de guardar o desde este mismo editor.', { ok: 'Eliminar' })) { w.items[+b.dataset.idel].deleted = true; rer(); } });
  $$('[data-ires]', box).forEach(b => b.onclick = () => { w.items[+b.dataset.ires].deleted = false; rer(); });
}

/* ---------- Formulario de registro único (configuraciones) ---------- */
function singletonForm({ title, sub, icon, crumbs, tabs = '', fields, get, onSave, extra = '' }) {
  const work = ADM.work && ADM.workKey === title ? ADM.work : JSON.parse(JSON.stringify(get())); ADM.work = work; ADM.workKey = title;
  const html = admHead(title, sub, '', icon, crumbs || [[title]]) + tabs + `<form data-sf novalidate><div class="panel"><div class="pb"><div class="form-grid">${fields.map(f => fieldHTML(f, work)).join('')}</div></div></div>${extra}<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn">${ic('check').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')} Guardar cambios</button></div></form>`;
  return {
    html, after: () => {
      const form = $('[data-sf]'); const rer = () => { if (form.isConnected) readSimple(fields, form, work); route(); };
      bindFields(fields, work, form, rer);
      form.onsubmit = e => { e.preventDefault(); readSimple(fields, form, work); const er = {}; fields.forEach(f => { const v = work[f.n]; if (f.req && (v == null || v === '')) er[f.n] = 'Obligatorio.'; if (v && f.t === 'email' && !reEmail.test(v)) er[f.n] = 'Correo no válido.'; if (v && f.t === 'url' && !/^https?:\/\//.test(v)) er[f.n] = 'Debe iniciar con https://'; }); const v2 = onSave(structuredClone(work), er); if (v2 === false) return; if (!showErrors(form, er)) return; audit('Modificación', title, title); if (saveDB()) { ADM.work = null; toast('Cambios guardados.', 'ok'); route(); } };
    }
  };
}
const CUSTOM = {};
CUSTOM.tupacfg = () => singletonForm({
  title: 'TUPA – UIT y documentos', icon: 'money', tabs: tabsBar([['list', 'Conceptos', '#/admin/tupa'], ['cfg', 'UIT y documentos', '#/admin/tupacfg']], 'cfg'), crumbs: [['TUPA', '#/admin/tupa'], ['UIT y documentos']],
  get: () => ({ anio: DB.tupaDocs.anio, uit: DB.config.uit[DB.tupaDocs.anio] || '', resolucion: DB.tupaDocs.resolucion, tupa: DB.tupaDocs.tupa, uitTabla: Object.entries(DB.config.uit).map(([a, v]) => ({ anio: +a, valor: v })) }),
  fields: [{ n: 'anio', l: 'Año del TUPA vigente', t: 'number', req: true }, { n: 'resolucion', l: 'Resolución de aprobación (PDF)', t: 'file' }, { n: 'tupa', l: 'TUPA vigente (PDF)', t: 'file' }, { n: 'uitTabla', l: 'Valor de la UIT por año (base de cálculo)', t: 'rows', cols: [{ n: 'anio', l: 'Año', t: 'number' }, { n: 'valor', l: 'UIT (S/)', t: 'number' }] }],
  onSave: (w, er) => { if (!(w.uitTabla || []).some(u => +u.anio === +w.anio && +u.valor > 0)) er.uitTabla = 'Registre el valor de la UIT para el año ' + w.anio + '.'; if (Object.keys(er).length) return; DB.tupaDocs.anio = +w.anio; DB.tupaDocs.resolucion = w.resolucion; DB.tupaDocs.tupa = w.tupa; DB.config.uit = {}; w.uitTabla.forEach(u => { if (u.anio) DB.config.uit[u.anio] = +u.valor; }); },
});
CUSTOM.licenciamiento = () => singletonForm({
  title: 'Licenciamiento', icon: 'shield', sub: 'Estado del licenciamiento, resolución y vigencia, o etapa del proceso.', get: () => DB.licenciamiento,
  fields: [{ n: 'estado', l: 'Estado', t: 'select', req: true, empty: false, opts: ['No iniciado', 'En proceso', 'Licenciado', 'Denegado'] }, { n: 'etapa', l: 'Etapa actual', req: true }, { n: 'descripcion', l: 'Descripción', t: 'textarea', full: true }, { n: 'resolucion', l: 'Resolución de licenciamiento' }, { n: 'fechaResolucion', l: 'Fecha de resolución', t: 'date' }, { n: 'vigenciaHasta', l: 'Vigencia hasta', t: 'date' }, { n: 'hitos', l: 'Avance del proceso', t: 'rows', cols: [{ n: 'fecha', l: 'Fecha', t: 'date' }, { n: 'texto', l: 'Hito' }] }, { n: 'documentos', l: 'Documentos', t: 'rows', cols: [{ n: 'nombre', l: 'Nombre' }, { n: 'doc', l: 'PDF', t: 'file' }] }],
  onSave: (w, er) => { if (w.estado === 'Licenciado' && !w.resolucion) er.resolucion = 'Indique la resolución de licenciamiento.'; if (Object.keys(er).length) return; w.documentos = (w.documentos || []).map(d => Object.assign({}, d.doc || {}, { nombre: d.nombre || (d.doc || {}).original, doc: d.doc })); DB.licenciamiento = Object.assign(w, { modEn: nowISO(), modPor: currentUser().usuario }); },
});
CUSTOM.popup = () => singletonForm({
  title: 'Ventana emergente (comunicado)', icon: 'bell', tabs: portadaTabs('p'), crumbs: [['Portada', '#/admin/slides'], ['Ventana emergente']], get: () => DB.config.popup,
  sub: 'Elige el modelo «Comunicado» (ventana sencilla) o «Promocional» (imagen a todo el fondo, título grande y tarjetas encadenadas, ideal para admisión o campañas).',
  fields: [{ n: 'activo', l: 'Mostrar ventana emergente en la portada', t: 'checkbox', full: true },
    { n: 'modelo', l: 'Modelo de ventana', t: 'select', empty: false, opts: [['clasico', 'Comunicado (sencillo)'], ['promocional', 'Promocional (imagen de fondo y tarjetas)']], hint: 'El modelo promocional usa la imagen como fondo completo; conviene una foto horizontal o cuadrada.' },
    { n: 'etiqueta', l: 'Etiqueta superior (promocional)', max: 40, ph: 'Admisión 2026' },
    { n: 'antetitulo', l: 'Antetítulo (promocional)', max: 60, ph: 'Inscripciones abiertas', full: true },
    { n: 'titulo', l: 'Título', req: true, full: true, max: 90 }, { n: 'texto', l: 'Texto', t: 'textarea', full: true, max: 300 },
    ...POP_TARJETAS.flatMap(k => [{ n: 't' + k, l: `Tarjeta ${k}: título${k === 4 ? ' (destacada)' : ''}`, max: 40, ph: ['Título a nombre de la Nación', 'Horarios', 'Duración', 'Y ahora'][k - 1] }, { n: 'd' + k, l: `Tarjeta ${k}: texto`, max: 80, ph: ['Profesional Técnico', 'Mañana y tarde', '3 años (6 semestres)', 'Examen de admisión el 5 de abril'][k - 1] }]),
    { n: 'boton', l: 'Texto del botón' }, { n: 'enlace', l: 'Enlace', ph: '#/admision' }, { n: 'inicio', l: 'Mostrar desde', t: 'date' }, { n: 'fin', l: 'Mostrar hasta', t: 'date' }, { n: 'imagen', l: 'Imagen', t: 'image', full: true, hq: true, hint: 'Para el modelo promocional: imagen cuadrada u horizontal de al menos 1200 px; se guarda en alta calidad.' }],
  extra: `<div class="panel"><div class="pb" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span>Revisa cómo se verá antes de activarla:</span><button type="button" class="btn sec" data-popprev>Vista previa de la ventana</button></div></div>`,
  onSave: (w, er) => { if (w.inicio && w.fin && w.fin < w.inicio) er.fin = 'La fecha final debe ser posterior a la inicial.'; if (Object.keys(er).length) return; DB.config.popup = w; try { sessionStorage.removeItem('popup_seen'); } catch (e) { } },
});
function quickAccessSummary(accesses) {
  const hidden = accesses.filter(a => !resolveLink(a.enlace));
  return `<p><strong>${accesses.length - hidden.length} de ${accesses.length} accesos se mostrarán en Inicio.</strong> Los accesos con enlace vacío o servicio externo inactivo se ocultan.</p>${hidden.length ? `<ul>${hidden.map(a => `<li>${esc(a.titulo || 'Sin título')}: ${String(a.enlace || '').startsWith('ext:') ? `el servicio «${esc(a.enlace.slice(4))}» no tiene una URL activa. <a href="#/admin/enlaces/${encodeURIComponent(a.enlace.slice(4))}">Configurar enlace</a>` : 'completa el enlace de destino.'}</li>`).join('')}</ul>` : ''}`;
}
CUSTOM.portada = () => singletonForm({
  title: 'Portada – bloques, accesos y cifras', icon: 'image', tabs: portadaTabs('b'), crumbs: [['Portada', '#/admin/slides'], ['Bloques']], get: () => DB.config.home,
  fields: [
    { n: 'bloques', l: 'Bloques de la portada (orden y visibilidad)', t: 'custom', render: w => `<div style="display:grid;gap:6px;max-width:520px">${w.bloques.map((b, i) => `<div style="display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:6px 10px;background:var(--card)"><span style="flex:1">${i + 1}. ${esc(b.label)}</span><label class="check"><input type="checkbox" data-bon="${i}" ${b.on ? 'checked' : ''}> Visible</label><button type="button" class="icon-btn" data-bup="${i}" title="Subir">${ic('up')}</button><button type="button" class="icon-btn" data-bdn="${i}" title="Bajar">${ic('down')}</button></div>`).join('')}</div>`, bind: (w, box, rer) => { $$('[data-bon]', box).forEach(c => c.onchange = () => w.bloques[+c.dataset.bon].on = c.checked); $$('[data-bup]', box).forEach(b => b.onclick = () => { const i = +b.dataset.bup; if (i) { [w.bloques[i - 1], w.bloques[i]] = [w.bloques[i], w.bloques[i - 1]]; rer(); } }); $$('[data-bdn]', box).forEach(b => b.onclick = () => { const i = +b.dataset.bdn; if (i < w.bloques.length - 1) { [w.bloques[i + 1], w.bloques[i]] = [w.bloques[i], w.bloques[i + 1]]; rer(); } }); } },
    { n: 'programasVista', l: 'Presentación de los programas de estudio (portada y página de programas)', t: 'select', empty: false, opts: [['carrusel', 'Carrusel con desplazamiento automático'], ['grid', 'Cuadrícula']] },
    { n: 'noticiasVista', l: 'Presentación de las noticias en la portada', t: 'select', empty: false, opts: [['', 'Según el diseño del portal'], ['tarjetas', 'Tarjetas (cuadrícula)'], ['carrusel', 'Carrusel con desplazamiento automático']], hint: 'En carrusel se muestran hasta 9 noticias; en tarjetas, las más recientes que caben en una fila o dos.' },
    { n: 'accesos', l: 'Accesos rápidos (4 o 6 recomendados)', t: 'rows', cols: [{ n: 'titulo', l: 'Título' }, { n: 'texto', l: 'Texto' }, { n: 'icono', l: 'Ícono', t: 'select', def: 'clipboard', opts: ['clipboard', 'book', 'mail', 'monitor', 'briefcase', 'grad', 'database', 'globe'] }, { n: 'enlace', l: 'Enlace (#/ruta, https:// o ext:id)' }] },
    { n: 'estadoAccesos', l: 'Visibilidad de los accesos', t: 'custom', render: w => quickAccessSummary(w.accesos), bind: (w, box) => { const form = box.closest('form'); const update = () => { box.innerHTML = quickAccessSummary(w.accesos); }; form.addEventListener('input', update); form.addEventListener('change', update); } },
    { n: 'cifras', l: 'Cifras institucionales (use auto:anios, auto:programas, auto:matriculados o auto:egresados para calcularlas desde los datos)', t: 'rows', cols: [{ n: 'label', l: 'Etiqueta' }, { n: 'valor', l: 'Valor' }, { n: 'corte', l: 'Año de corte' }, { n: 'enlace', l: 'Enlace (opcional; vacío = automático)' }] },
    { n: 'beneficios', l: '¿Por qué estudiar aquí? (hasta 8)', t: 'rows', cols: [{ n: 't', l: 'Título' }, { n: 'd', l: 'Descripción' }, { n: 'i', l: 'Ícono', t: 'select', opts: ['grad', 'users', 'flask', 'briefcase', 'award', 'building', 'target', 'globe', 'monitor', 'star'] }] },
  ],
  onSave: (w, er) => { (w.accesos || []).forEach(a => { if (!String(a.titulo || '').trim() || !String(a.enlace || '').trim()) er.accesos = 'Completa el título y el enlace de cada acceso, o quita la fila vacía.'; else if (!/^(#\/|https?:\/\/|ext:)/.test(a.enlace)) er.accesos = 'Enlace no válido: “' + a.enlace + '”. No use “#” vacío ni javascript:.'; }); (w.cifras || []).forEach(c => { if (!c.corte) er.cifras = 'Cada cifra debe indicar su año de corte.'; }); if ((w.beneficios || []).length > 8 && JSON.stringify(w.beneficios)!==JSON.stringify(DB.config.home.beneficios)) er.beneficios = 'Máximo 8 beneficios. Reduzca la lista antes de modificarla.'; if (Object.keys(er).length) return; DB.config.home = w; },
});
CUSTOM.config = () => singletonForm({
  title: 'Configuración general', icon: 'gear', sub: 'Datos institucionales, contacto, redes, SEO, correos y parámetros protegidos.',
  get: () => Object.assign({}, DB.config.inst, { fb: DB.config.redes.facebook, yt: DB.config.redes.youtube, ig: DB.config.redes.instagram, tt: DB.config.redes.tiktok, seoTitulo: DB.config.seo.titulo, seoDesc: DB.config.seo.descripcion, correoReclamos: DB.config.correoReclamos, correoContacto: DB.config.correoContacto, waNum: DB.config.whatsapp.numero, waMsg: DB.config.whatsapp.mensaje, waOn: DB.config.whatsapp.activo, limDesc: DB.config.limites.descripcion, limPed: DB.config.limites.pedido, simFail: DB.config.simularFalloCorreo }),
  fields: [
    { n: 'nombre', l: 'Denominación oficial', req: true, full: true }, { n: 'nombreCorto', l: 'Nombre corto / siglas', req: true }, { n: 'logoSigla', l: 'Texto del logotipo generado', max: 10, hint: 'Texto opcional junto al logotipo en los diseños Impacto, Horizonte y Campus. Si se deja vacío, se muestra el nombre corto oficial completo.' },
    { n: 'slogan', l: 'Eslogan', full: true }, { n: 'lema', l: 'Lema de cabecera' }, { n: 'descripcion', l: 'Descripción institucional (pie de página)', t: 'textarea', full: true },
    { n: 'logo', l: 'Logotipo oficial (opcional, reemplaza al generado)', t: 'image', full: true },
    { n: 'direccion', l: 'Dirección', req: true, full: true }, { n: 'distrito', l: 'Distrito', max: 80 }, { n: 'region', l: 'Región (departamento)', max: 80, hint: 'Se usa en el pie de la intranet, en los títulos emitidos y en los datos para buscadores.' }, { n: 'telefono', l: 'Teléfono', req: true }, { n: 'telefonoNota', l: 'Detalle del teléfono' }, { n: 'correo', l: 'Correo institucional', t: 'email' }, { n: 'horario', l: 'Horario de atención', req: true }, { n: 'horarioSab', l: 'Horario de sábados' },
    { n: 'ruc', l: 'RUC' }, { n: 'codigoModular', l: 'Código modular' }, { n: 'fechaCreacion', l: 'Fecha de creación', t: 'date', req: true }, { n: 'normaCreacion', l: 'Norma de creación' },
    { n: 'lat', l: 'Latitud de la sede', t: 'number', step: 'any' }, { n: 'lng', l: 'Longitud de la sede', t: 'number', step: 'any' },
    { n: 'fb', l: 'Facebook', t: 'url' }, { n: 'yt', l: 'YouTube', t: 'url' }, { n: 'ig', l: 'Instagram', t: 'url' }, { n: 'tt', l: 'TikTok', t: 'url' },
    { n: 'waOn', l: 'Mostrar botón flotante de WhatsApp', t: 'checkbox' }, { n: 'waNum', l: 'Número de WhatsApp (con código de país, sin +)', hint: 'Número de ejemplo: reemplácelo por el oficial.' }, { n: 'waMsg', l: 'Mensaje predefinido de WhatsApp', full: true },
    { n: 'seoTitulo', l: 'Título SEO del sitio', req: true, full: true, max: 70 }, { n: 'seoDesc', l: 'Descripción SEO', t: 'textarea', full: true, max: 170 },
    { n: 'correoReclamos', l: 'Correo receptor del Libro de Reclamaciones (parámetro protegido)', t: 'email', req: true, ro: () => currentUser().rol !== 'admin' }, { n: 'correoContacto', l: 'Correo receptor de Contáctanos', t: 'email', req: true },
    { n: 'limDesc', l: 'Límite de caracteres: descripción del reclamo', t: 'number', min: 200 }, { n: 'limPed', l: 'Límite de caracteres: pedido del reclamo', t: 'number', min: 100 },
  ],
  onSave: (w, er) => {
    if (w.waOn && !/^\d{9,13}$/.test(w.waNum || '')) er.waNum = 'Número no válido (9 a 13 dígitos).'; if (Object.keys(er).length) return;
    const C = DB.config; const oldName = C.inst.nombre, oldLogo = C.inst.logo; if (C.correoReclamos !== w.correoReclamos) audit('Cambio de parámetro protegido', 'Configuración', 'Correo del Libro de Reclamaciones', `${C.correoReclamos} → ${w.correoReclamos}`);
    ['nombre', 'nombreCorto', 'logoSigla', 'slogan', 'lema', 'descripcion', 'logo', 'direccion', 'telefono', 'telefonoNota', 'correo', 'horario', 'horarioSab', 'ruc', 'codigoModular', 'fechaCreacion', 'normaCreacion', 'lat', 'lng', 'distrito', 'region'].forEach(k => C.inst[k] = w[k]);
    if (oldLogo !== w.logo && DB.academico.cfg.docs?.logoIzq?.src === oldLogo) { const preview = document.querySelector('[data-img=logo] img'); DB.academico.cfg.docs.logoIzq = w.logo ? { src: w.logo, w: preview?.naturalWidth || 240, h: preview?.naturalHeight || 310 } : null; }
    C.redes = { ...C.redes, facebook: w.fb, youtube: w.yt, instagram: w.ig, tiktok: w.tt }; C.seo.titulo = w.seoTitulo === C.seo.titulo ? w.seoTitulo.replace(oldName, w.nombre) : w.seoTitulo; C.seo.descripcion = w.seoDesc; C.correoReclamos = w.correoReclamos; C.correoContacto = w.correoContacto;
    C.whatsapp = { numero: w.waNum, mensaje: w.waMsg, activo: w.waOn }; C.limites = { descripcion: +w.limDesc || 1500, pedido: +w.limPed || 1000 }; C.simularFalloCorreo = w.simFail; Object.keys(IMG_CACHE).forEach(k => delete IMG_CACHE[k]);
  },
});
/* ---------- Estadísticas ---------- */
CUSTOM.estadisticas = (parts, q) => {
  const st = coll('estadisticas'); const years = [...new Set(st.map(s => s.anio))].sort((a, b) => b - a); const y = +(q.get('anio') || years[0] || yearNow());
  const K = [['postulantes', 'Postulantes'], ['ingresantes', 'Ingresantes'], ['matriculados', 'Matriculados'], ['egresados', 'Egresados'], ['titulados', 'Titulados'], ['becas', 'Becas'], ['creditos', 'Créditos educativos']];
  const html = admHead('Estadísticas', 'Ingresantes, matriculados y egresados por año y programa. Se publican en Transparencia con tablas y gráficos.', `<button class="btn sec" data-ny>+ Agregar año</button><a class="btn ghost" href="#/transparencia/estadisticas" target="_blank">Ver en el portal</a>`, 'chart', [['Estadísticas']])
    + `<div class="chips">${years.map(a => `<a class="chip" href="#/admin/estadisticas?anio=${a}" aria-current="${a === y}">${a}</a>`).join('')}</div><form data-stf class="panel"><h2>Año ${y}</h2><div class="tbl-wrap" style="border:0"><table class="tbl light subtbl"><thead><tr><th>Programa</th>${K.map(k => `<th>${k[1]}</th>`).join('')}</tr></thead><tbody>${sortO(alive('programas')).map(p => { const s = st.find(x => x.anio === y && x.programaId === p.id) || {}; return `<tr><td>${esc(p.nombre)}</td>${K.map(([k, l]) => `<td><input class="inp" type="number" min="0" style="width:90px" value="${s[k] ?? ''}" data-st="${p.id}|${k}" aria-label="${l} ${esc(p.nombre)}"></td>`).join('')}</tr>`; }).join('')}</tbody></table></div><div class="pb" style="text-align:right"><button class="btn">Guardar año ${y}</button></div></form>`;
  return {
    html, after: () => {
      $('[data-ny]').onclick = async () => { const a = +(await promptBox('Año a registrar:', { value: String(yearNow() + 1) })); if (!a || a < 2000 || a > 2100) return; if (years.includes(a)) return toast('El año ya existe.', 'err'); sortO(alive('programas')).forEach(p => st.push({ id: uid(), anio: a, programaId: p.id })); audit('Creación', 'Estadísticas', 'Año ' + a); if(!saveDB())return; go('#/admin/estadisticas?anio=' + a); };
      $('[data-stf]').onsubmit = e => { e.preventDefault(); let bad = false; $$('[data-st]').forEach(i => { if (i.value !== '' && (+i.value < 0 || !Number.isInteger(+i.value))) { bad = true; i.style.borderColor = 'var(--err)'; } }); if (bad) return toast('Ingrese números enteros positivos.', 'err'); $$('[data-st]').forEach(i => { const [p, k] = i.dataset.st.split('|'); let r = st.find(x => x.anio === y && x.programaId === p); if (!r) { r = { id: uid(), anio: y, programaId: p }; st.push(r); } r[k] = i.value === '' ? null : +i.value; }); audit('Modificación', 'Estadísticas', 'Año ' + y); if (saveDB()) toast('Estadísticas del año ' + y + ' guardadas.', 'ok'); };
    }
  };
};
/* ---------- Becas: importación y reportes ---------- */
CUSTOM.becasimport = () => {
  const html = admHead('Importar beneficiarios', 'Carga masiva desde una plantilla CSV (exportable desde Excel: “Guardar como CSV”).', '', 'upload', [['Becas', '#/admin/becas'], ['Importar']]) + becasTabs('i') + `<div class="panel"><div class="pb"><ol style="margin-top:0"><li>Descargue la plantilla y complétela en Excel.</li><li>Guárdela como CSV (delimitado por punto y coma o coma).</li><li>Seleccione el periodo y cargue el archivo. El sistema validará cada fila antes de importar.</li></ol><div class="form-grid"><div class="field"><label for="im-p">Periodo de destino</label><select id="im-p">${coll('becasPeriodos').filter(p => p.estado !== 'Cerrado').map(p => `<option value="${p.id}">${p.anio} - ${p.periodo}</option>`).join('')}</select></div><div class="field"><label for="im-f">Archivo CSV</label><input id="im-f" type="file" accept=".csv,.txt"></div></div><p style="margin-top:12px"><button class="btn sec" data-tpl>${ic('download').replace('<svg', '<svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2"')} Descargar plantilla</button></p><div id="im-r"></div></div></div>`;
  return {
    html, after: () => {
      $('[data-tpl]').onclick = () => downloadText(toCSV([['dni', 'apellidos', 'nombres', 'codigo_programa', 'tipo_beca', 'motivo'], ['71234567', 'Pérez Quispe', 'Ana María', 'APSTI', 'Exoneración 100 %', 'Primer puesto']]), 'plantilla_becas.csv', 'text/csv');
      $('#im-f').onchange = async () => {
        const f = $('#im-f').files[0]; if (!f) return; const er = checkFile(f, 'csv'); if (er) return toast(er, 'err');
        const rows = parseCSV(await readAsText(f)); const head = (rows.shift() || []).map(h => normTitle(h).replace(/\s/g, '_'));
        const need = ['dni', 'apellidos', 'nombres', 'codigo_programa', 'tipo_beca']; const miss = need.filter(n => !head.includes(n));
        if (miss.length) { $('#im-r').innerHTML = `<div class="notice err">Estructura incorrecta. Faltan las columnas: ${miss.join(', ')}.</div>`; return; }
        const per = $('#im-p').value; const seen = new Set();
        const res = rows.map((r, i) => { const o = {}; head.forEach((h, k) => o[h] = (r[k] || '').trim()); const p = alive('programas').find(x => normTitle(x.codigo) === normTitle(o.codigo_programa) || normTitle(x.nombre) === normTitle(o.codigo_programa)); const t = coll('tiposBeca').find(x => normTitle(x.nombre) === normTitle(o.tipo_beca)); let st = 'Válido', msg = ''; if (!/^\d{8}$/.test(o.dni)) { st = 'Error'; msg = 'DNI inválido'; } else if (!o.apellidos || !o.nombres) { st = 'Error'; msg = 'Faltan apellidos o nombres'; } else if (!p) { st = 'Error'; msg = 'Programa no encontrado'; } else if (!t) { st = 'Error'; msg = 'Tipo de beca no encontrado'; } else { const key = [o.dni, per, p.id, t.id].join('|'); if (seen.has(key) || alive('becarios').some(b => b.dni === o.dni && b.periodoId === per && b.programaId === p.id && b.tipoId === t.id)) { st = 'Duplicado'; msg = 'Ya registrado'; } seen.add(key); } return { n: i + 2, o, p, t, st, msg }; });
        const nE = res.filter(r => r.st === 'Error').length, nD = res.filter(r => r.st === 'Duplicado').length, nV = res.filter(r => r.st === 'Válido').length;
        $('#im-r').innerHTML = `<div class="kpis" style="margin-top:14px"><div class="kpi"><span class="ic" style="background:var(--ok)">${ic('check')}</span><div><b>${nV}</b><span>Válidos</span></div></div><div class="kpi"><span class="ic" style="background:var(--warn)">${ic('copy')}</span><div><b>${nD}</b><span>Duplicados (se omitirán)</span></div></div><div class="kpi"><span class="ic" style="background:var(--err)">${ic('alert')}</span><div><b>${nE}</b><span>Con errores</span></div></div></div><div class="tbl-wrap"><table class="tbl light subtbl"><thead><tr><th>Fila</th><th>DNI</th><th>Apellidos y nombres</th><th>Programa</th><th>Tipo</th><th>Resultado</th></tr></thead><tbody>${res.map(r => `<tr><td>${r.n}</td><td>${esc(r.o.dni)}</td><td>${esc(r.o.apellidos)}, ${esc(r.o.nombres)}</td><td>${esc(r.p ? r.p.codigo : r.o.codigo_programa)}</td><td>${esc(r.o.tipo_beca)}</td><td>${stBadge(r.st === 'Válido' ? 'Válido' : r.st === 'Duplicado' ? 'Pendiente' : 'Error')} ${esc(r.msg)}</td></tr>`).join('')}</tbody></table></div><p style="margin-top:12px">${nE ? '<span class="notice err" style="display:block">Corrija las filas con errores y vuelva a cargar el archivo. La importación no se ejecuta mientras existan errores.</span>' : `<button class="btn ok" data-doimp ${nV ? '' : 'disabled'}>Importar ${nV} beneficiario(s)</button>`}</p>`;
        const b = $('[data-doimp]'); if (b) b.onclick = () => { res.filter(r => r.st === 'Válido').forEach(r => coll('becarios').push(stamp({ id: uid(), periodoId: per, dni: r.o.dni, apellidos: r.o.apellidos, nombres: r.o.nombres, programaId: r.p.id, tipoId: r.t.id, motivo: r.o.motivo || '', estado: 'Publicado' }, true))); audit('Importación masiva', 'Becas', `${nV} incorporados, ${nD} duplicados, ${nE} rechazados`, f.name); if (saveDB()) { modal({ title: 'Importación finalizada', size: 'sm', body: `<p>Incorporados: <b>${nV}</b><br>Duplicados omitidos: <b>${nD}</b><br>Rechazados: <b>${nE}</b></p>` }); $('#im-r').innerHTML = ''; } };
      };
    }
  };
};
CUSTOM.becasrep = (parts, q) => {
  const pers = coll('becasPeriodos'); const per = q.get('p') || (pers.find(p => p.vigente) || pers[0] || {}).id;
  const rows = alive('becarios').filter(b => b.periodoId === per);
  const byProg = sortO(alive('programas')).map(p => ({ k: p.codigo, n: p.nombre, v: rows.filter(b => b.programaId === p.id).length }));
  const byTipo = coll('tiposBeca').map(t => ({ k: t.nombre, v: rows.filter(b => b.tipoId === t.id).length }));
  const html = admHead('Reportes de becas', 'Calculados directamente de los registros del módulo (sin archivos paralelos).', `<button class="btn sec" data-rcsv>Exportar CSV</button>`, 'chart', [['Becas', '#/admin/becas'], ['Reportes']]) + becasTabs('r') + `<div class="chips">${pers.map(p => `<a class="chip" href="#/admin/becasrep?p=${p.id}" aria-current="${p.id === per}">${p.anio} - ${p.periodo}</a>`).join('')}</div><div class="kpis"><div class="kpi"><span class="ic" style="background:var(--blue)">${ic('users')}</span><div><b>${rows.length}</b><span>Beneficiarios en ${perLabel(per)}</span></div></div></div><div class="grid g2"><div class="panel"><h2>Por programa de estudio</h2><div class="pb">${barChart(byProg.map(x => ({ k: x.k, v: x.v })), { label: 'Beneficiarios por programa' })}</div></div><div class="panel"><h2>Por tipo de beca</h2><div class="pb"><table class="tbl light"><tbody>${byTipo.map(t => `<tr><td>${esc(t.k)}</td><td class="num"><b>${t.v}</b></td></tr>`).join('')}</tbody></table></div></div></div>`;
  return { html, after: () => { bindChartTips(document); $('[data-rcsv]').onclick = () => downloadText(toCSV([['Periodo', 'Programa', 'Beneficiarios']].concat(byProg.map(x => [perLabel(per), x.n, x.v])).concat([[], ['Periodo', 'Tipo de beca', 'Beneficiarios']]).concat(byTipo.map(x => [perLabel(per), x.k, x.v]))), 'reporte_becas.csv', 'text/csv'); } };
};

/* ==== admin4.js ==== */
/* =========================================================
   PANEL ADMINISTRATIVO – inicio, aprobaciones, bandejas, auditoría, respaldo y enrutador
   ========================================================= */
const sic = (n, s = 15) => ic(n).replace('<svg', `<svg style="width:${s}px;height:${s}px;stroke:currentColor;fill:none;stroke-width:2"`);
const kpi = (icon, color, v, l, href) => `<${href ? `a href="${href}"` : 'div'} class="kpi" style="text-decoration:none;color:inherit"><span class="ic" style="background:${color}">${ic(icon)}</span><div><b>${v}</b><span>${l}</span></div></${href ? 'a' : 'div'}>`;
const daysAgo = d => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

/* ---------- Inicio (dashboard) ---------- */
const dkey = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const pct = (a, b) => b ? Math.round((a - b) / b * 100) : (a ? 100 : 0);
function sparkline(vals) {
  const w = 120, h = 34, mx = Math.max(...vals, 1), mn = Math.min(...vals, 0); const sx = i => i * (w / Math.max(vals.length - 1, 1)), sy = v => h - 3 - (v - mn) / ((mx - mn) || 1) * (h - 6);
  const pts = vals.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  return `<svg class="db-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,${h} ${pts} ${w},${h}" class="a"/><polyline points="${pts}" class="l"/></svg>`;
}
function deltaHTML(d, invert, txt = 'vs. período anterior') {
  if (d == null) return ''; const good = invert ? d <= 0 : d >= 0; const cls = d === 0 ? 'eq' : good ? 'up' : 'down';
  return `<span class="db-delta ${cls}">${d > 0 ? '▲' : d < 0 ? '▼' : '■'} ${Math.abs(d)} %</span><span class="db-dtxt">${txt}</span>`;
}
function lineChart(cur, prev, labels) {
  const w = 760, h = 290, pl = 44, pr = 14, pt = 16, pb = 30; const n = cur.length; const mx = Math.max(...cur, ...prev, 1);
  const step = Math.pow(10, Math.floor(Math.log10(mx))); const top = Math.ceil(mx / step) * step || 1;
  const x = i => pl + i * ((w - pl - pr) / Math.max(n - 1, 1)), y = v => pt + (h - pt - pb) * (1 - v / top);
  const path = arr => { const P2 = arr.map((v, i) => [x(i), y(v)]); if (P2.length < 3) return P2.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(''); let d = `M${P2[0][0].toFixed(1)},${P2[0][1].toFixed(1)}`; for (let i = 0; i < P2.length - 1; i++) { const p0 = P2[i - 1] || P2[i], p1 = P2[i], p2 = P2[i + 1], p3 = P2[i + 2] || p2; const t = .18; const c1 = [p1[0] + (p2[0] - p0[0]) * t, Math.min(y(0), p1[1] + (p2[1] - p0[1]) * t)], c2 = [p2[0] - (p3[0] - p1[0]) * t, Math.min(y(0), p2[1] - (p3[1] - p1[1]) * t)]; d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`; } return d; };
  let g = ''; for (let k = 0; k <= 4; k++) { const yy = y(top * k / 4); g += `<line x1="${pl}" x2="${w - pr}" y1="${yy}" y2="${yy}"/><text x="${pl - 8}" y="${yy + 4}" text-anchor="end">${num(Math.round(top * k / 4))}</text>`; }
  const every = Math.ceil(n / 8); let xl = ''; labels.forEach((l, i) => { if ((i % every === 0 && n - 1 - i >= every / 2) || i === n - 1) xl += `<text x="${x(i)}" y="${h - 8}" text-anchor="middle">${l}</text>`; });
  return `<div class="db-line" data-line='${JSON.stringify({ cur, prev, labels })}'><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Visitas diarias del período actual comparadas con el período anterior"><defs><linearGradient id="dbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="s1"/><stop offset="1" class="s2"/></linearGradient></defs><g class="grid">${g}</g>${xl ? `<g class="xl">${xl}</g>` : ''}<path class="prev" d="${path(prev)}"/><path class="area" d="${path(cur)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z"/><path class="cur" d="${path(cur)}"/><line class="cross" x1="0" x2="0" y1="${pt}" y2="${h - pb}" style="display:none"/><circle class="dot" r="5" style="display:none"/><rect class="hit" x="${pl}" y="${pt}" width="${w - pl - pr}" height="${h - pt - pb}"/></svg></div>`;
}
function bindLineChart(root) {
  $$('.db-line', root).forEach(box => {
    const d = JSON.parse(box.dataset.line); const svg = $('svg', box), hit = $('.hit', svg), cr = $('.cross', svg), dot = $('.dot', svg);
    let tip = $('.chart-tip'); if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; document.body.appendChild(tip); }
    const vb = svg.viewBox.baseVal; const pl = 44, pr = 14, n = d.cur.length; const top = +($$('.grid text', svg).pop().textContent.replace(/\D/g, '')) || 1; const pt = 16, pb = 30;
    const move = e => {
      const r = svg.getBoundingClientRect(); const sx = (e.clientX - r.left) * vb.width / r.width; const i = Math.max(0, Math.min(n - 1, Math.round((sx - pl) / ((vb.width - pl - pr) / Math.max(n - 1, 1)))));
      const xx = pl + i * ((vb.width - pl - pr) / Math.max(n - 1, 1)); const yy = pt + (vb.height - pt - pb) * (1 - d.cur[i] / top);
      cr.setAttribute('x1', xx); cr.setAttribute('x2', xx); cr.style.display = ''; dot.setAttribute('cx', xx); dot.setAttribute('cy', yy); dot.style.display = '';
      tip.innerHTML = `<b>${d.labels[i]}</b><br>Visitas: ${num(d.cur[i])}<br><span style="opacity:.75">Período anterior: ${num(d.prev[i])}</span>`; tip.style.display = 'block'; tip.style.left = Math.min(e.clientX + 14, innerWidth - 190) + 'px'; tip.style.top = e.clientY - 64 + 'px';
    };
    hit.addEventListener('mousemove', move); hit.addEventListener('mouseleave', () => { cr.style.display = dot.style.display = 'none'; tip.style.display = 'none'; });
  });
}
function hbars(rows) {
  const mx = Math.max(...rows.map(r => r.v), 1);
  return `<div class="db-hbars">${rows.map(r => `<a class="db-hb" href="${r.h}" title="${esc(r.k)}: ${num(r.v)}"><span class="k">${esc(r.k)}</span><span class="t"><i style="width:${Math.max(r.v / mx * 100, r.v ? 3 : 0)}%"></i></span><b>${num(r.v)}</b></a>`).join('')}</div>`;
}
function ring(p) {
  const r = 34, c = 2 * Math.PI * r; return `<svg class="db-ring" viewBox="0 0 84 84" role="img" aria-label="Índice de completitud ${p} %"><circle cx="42" cy="42" r="${r}" class="bg"/><circle cx="42" cy="42" r="${r}" class="fg ${p >= 85 ? 'ok' : p >= 60 ? 'warn' : 'err'}" stroke-dasharray="${(c * p / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 42 42)"/><text x="42" y="47" text-anchor="middle">${p}%</text></svg>`;
}
const parseDMY = s => { const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
CUSTOM.dashboard = (parts, q) => {
  const u = currentUser(); const P = [7, 30, 90].includes(+q.get('p')) ? +q.get('p') : 30; const today = new Date().toISOString().slice(0, 10); const now = nowISO();
  const vis = DB.visitas || {}; const cur = [], prev = [], labels = [];
  for (let k = P; k >= 1; k--) { const d = dkey(k); cur.push(vis[d] || 0); prev.push(vis[dkey(k + P)] || 0); labels.push(d.slice(8, 10) + '/' + d.slice(5, 7)); }
  const sum = a => a.reduce((x, y) => x + y, 0); const inP = (f, off = 0) => { const t = new Date(f).getTime(); return t > Date.now() - (P + off) * 864e5 && t <= Date.now() - off * 864e5; };
  const msgs = alive('mensajes'), lrs = coll('reclamos').filter(r => !r.anulado), exps = coll('expedientes');
  const msgCur = msgs.filter(m => inP(m.fecha)).length, msgPrev = msgs.filter(m => inP(m.fecha, P)).length;
  const lrOpen = lrs.filter(r => r.estado !== 'Atendido'), lrLate = lrOpen.filter(r => daysAgo(r.fecha) > 10).length;
  const newsPub = alive('noticias').filter(n => n.estado === 'Publicada' && n.fecha <= now); const newsCur = newsPub.filter(n => inP(n.fecha)).length, newsPrev = newsPub.filter(n => inP(n.fecha, P)).length;
  const weekVals = k => { const a = []; for (let i = 11; i >= 0; i--) a.push(k(i)); return a; };
  const cnt = (arr, i) => arr.filter(x => { const d = daysAgo(x.fecha); return d >= i * 7 && d < (i + 1) * 7; }).length;
  const tiles = [
    { show: true, icon: 'eye', l: 'Visitas al portal', v: num(sum(cur)), d: pct(sum(cur), sum(prev)), sp: cur.slice(-Math.min(P, 30)), h: '' },
    { show: can('mensajes'), icon: 'mail', l: 'Mensajes recibidos', v: num(msgCur), d: pct(msgCur, msgPrev), sp: weekVals(i => cnt(msgs, i)), h: '#/admin/mensajes', sub: `${msgs.filter(m => m.estado === 'Nuevo').length} sin leer` },
    { show: can('reclamos'), icon: 'book', l: 'Reclamos abiertos', v: num(lrOpen.length), sub: lrLate ? `${lrLate} con más de 10 días` : 'Todos dentro del plazo', subCls: lrLate ? 'err' : 'ok', sp: weekVals(i => cnt(lrs, i)), h: '#/admin/reclamos' },
    { show: can('noticias'), icon: 'list', l: 'Noticias publicadas', v: num(newsCur), d: pct(newsCur, newsPrev), sp: weekVals(i => cnt(newsPub, i)), h: '#/admin/noticias', sub: `${num(newsPub.length)} en total` },
    { show: can('expedientes'), icon: 'inbox', l: 'Expedientes en trámite', v: num(exps.filter(x => !['Atendido', 'Archivado'].includes(x.estado)).length), sp: weekVals(i => cnt(exps, i)), h: '#/admin/expedientes', sub: `${exps.filter(x => x.estado === 'Observado').length} observados` },
    { show: can('documentos'), icon: 'file', l: 'Documentos vigentes', v: num(alive('documentos').filter(d => d.estado === 'Publicado').length), sp: weekVals(i => cnt(alive('documentos').map(d => ({ fecha: d.modEn || d.creadoEn || now })), i)), h: '#/admin/documentos', sub: `${alive('documentos').filter(d => d.estado === 'En revisión').length} en revisión` },
    { show: can('eventos'), icon: 'calendar', l: 'Eventos próximos', v: num(alive('eventos').filter(e => e.estado === 'Publicado' && e.fecha.slice(0, 10) >= today).length), sp: [], h: '#/admin/eventos', sub: 'publicados en la agenda' },
    { show: can('egresados'), icon: 'award', l: 'Egresados destacados', v: num(alive('egresados').filter(e => e.estado === 'Publicado' && (!role().ownProgram || e.programaId === u.programaId)).length), sp: [], h: '#/admin/egresados', sub: 'testimonios publicados' },
    { show: can('programas'), icon: 'grad', l: 'Programas publicados', v: num(alive('programas').filter(p => p.estado === 'Publicado').length), sp: [], h: '#/admin/programas', sub: 'Oferta formativa vigente' },
  ].filter(t => t.show).slice(0, 4);
  const tileHTML = t => `<${t.h ? `a href="${t.h}"` : 'div'} class="db-kpi"><div class="db-kh"><span class="db-ki">${ic(t.icon)}</span><span class="db-kl">${t.l}</span></div><div class="db-kv"><b>${t.v}</b>${t.sp.length > 1 ? sparkline(t.sp) : ''}</div><div class="db-kf">${t.d != null ? deltaHTML(t.d, false, 'vs. ' + P + ' días previos') : `<span class="db-dtxt ${t.subCls || ''}">${t.sub || ''}</span>`}${t.d != null && t.sub ? `<span class="db-dtxt sep">${t.sub}</span>` : ''}</div></${t.h ? 'a' : 'div'}>`;
  // reclamos por estado
  const LS = [['Recibido', 'warn'], ['En atención', 'info'], ['Atendido', 'ok']].map(([s, c]) => ({ s, c, n: lrs.filter(r => r.estado === s).length })); const lrT = sum(LS.map(x => x.n));
  const attEn = r => r.atendidoEn || ((r.historial || []).find(h => h.estado === 'Atendido') || {}).fecha; const att = lrs.filter(attEn).map(r => (new Date(attEn(r)) - new Date(r.fecha)) / 864e5); const avgAtt = att.length ? (sum(att) / att.length).toFixed(1) : '—';
  const lrCard = can('reclamos') ? `<div class="panel db-card"><h2><span>Libro de reclamaciones</span><a class="btn xs ghost" href="#/admin/reclamos">Gestionar</a></h2><div class="pb"><div class="db-seg" role="img" aria-label="${LS.map(x => x.s + ' ' + x.n).join(', ')}">${LS.filter(x => x.n).map(x => `<i class="${x.c}" style="flex:${x.n}" title="${x.s}: ${x.n}"></i>`).join('') || '<i class="none" style="flex:1"></i>'}</div><ul class="db-legend">${LS.map(x => `<li><span class="sw ${x.c}"></span>${x.s}<b>${x.n}</b><small>${lrT ? Math.round(x.n / lrT * 100) : 0} %</small></li>`).join('')}</ul><div class="db-mini"><div><small>Tiempo promedio de atención</small><b>${avgAtt}${avgAtt !== '—' ? ' días' : ''}</b></div><div><small>Abiertos con más de 10 días</small><b class="${lrLate ? 'tx-err' : ''}">${lrLate}</b></div><div><small>Notificaciones con error</small><b class="${lrs.some(r => r.notifInst === 'Error') ? 'tx-err' : ''}">${lrs.filter(r => r.notifInst === 'Error').length}</b></div></div><h3 class="db-sub">Últimos registros</h3><ul class="db-lrl">${[...lrs].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 3).map(r => `<li><a href="#/admin/reclamos/${r.id}"><b>${esc(r.codigo)}</b><span>${esc(clamp(r.asunto, 38))}</span></a>${stBadge(r.estado)}</li>`).join('')}</ul></div></div>` : '';
  // pendientes
  const T = [
    [can('aprobaciones'), 'check', 'Publicaciones por aprobar', pendingCount(), '#/admin/aprobaciones', 'violet'],
    [can('mensajes'), 'mail', 'Mensajes sin leer', msgs.filter(m => m.estado === 'Nuevo').length, '#/admin/mensajes', 'warn'],
    [can('reclamos'), 'book', 'Reclamos recibidos sin atender', lrs.filter(r => r.estado === 'Recibido').length, '#/admin/reclamos', 'err'],
    [can('expedientes'), 'inbox', 'Expedientes recibidos', exps.filter(x => x.estado === 'Recibido').length, '#/admin/expedientes', 'info'],
    [can('noticias'), 'edit', 'Noticias en borrador', alive('noticias').filter(n => n.estado === 'Borrador').length, '#/admin/noticias', 'gray'],
    [can('programas'), 'grad', 'Programas con brochure o malla pendiente', alive('programas').filter(p => (!role().ownProgram || p.id === u.programaId) && (!p.brochure || !p.malla)).length, '#/admin/programas', 'warn'],
    [can('egresados'), 'award', 'Egresados en borrador', alive('egresados').filter(e => e.estado !== 'Publicado' && (!role().ownProgram || e.programaId === u.programaId)).length, '#/admin/egresados', 'gray'],
    [can('eventos'), 'calendar', 'Eventos próximos publicados', alive('eventos').filter(e => e.estado === 'Publicado' && e.fecha.slice(0, 10) >= today).length, '#/admin/eventos', 'info'],
    [can('convocatorias'), 'briefcase', 'Convocatorias en curso', alive('convocatorias').filter(c => c.situacion === 'En curso' && c.estado === 'Publicado').length, '#/admin/convocatorias', 'info'],
  ].filter(t => t[0]);
  const pend = `<div class="panel db-card"><h2><span>Pendientes por atender</span><span class="badge ${sum(T.map(t => t[3])) ? 'warn' : 'ok'}">${sum(T.map(t => t[3]))}</span></h2><ul class="db-tasks">${T.length ? '' : '<li class="db-empty">No tiene tareas pendientes.</li>'}${T.map(([, i, l, n, h, c]) => `<li><span class="db-ti ${c}">${ic(i)}</span><span class="l">${l}</span><b class="${n ? '' : 'z'}">${n}</b><a class="btn xs ${n && !['info', 'gray'].includes(c) ? '' : 'ghost'}" href="${h}">${n && !['info', 'gray'].includes(c) ? 'Atender' : 'Ver'}</a></li>`).join('')}</ul></div>`;
  // contenido por módulo
  const CM = [['noticias', 'Noticias', alive('noticias').filter(n => n.estado === 'Publicada').length, '#/admin/noticias'], ['documentos', 'Documentos de gestión', alive('documentos').filter(d => d.estado === 'Publicado').length, '#/admin/documentos'], ['docentes', 'Docentes', alive('personas').filter(p => p.tipo === 'Docente' && p.estado === 'Publicado').length, '#/admin/docentes'], ['becas', 'Becarios', alive('becarios').length, '#/admin/becas'], ['tupa', 'Conceptos TUPA', alive('tupa').length, '#/admin/tupa'], ['eventos', 'Eventos', alive('eventos').filter(e => e.estado === 'Publicado').length, '#/admin/eventos'], ['convocatorias', 'Convocatorias', alive('convocatorias').length, '#/admin/convocatorias'], ['egresados', 'Egresados destacados', alive('egresados').length, '#/admin/egresados'], ['programas', 'Programas de estudio', alive('programas').filter(p => p.estado === 'Publicado').length, '#/admin/programas'], ['slides', 'Diapositivas del carrusel', alive('slides').filter(x => x.estado === 'Publicado').length, '#/admin/slides'], ['paginas', 'Páginas institucionales', alive('paginas').filter(x => x.estado === 'Publicada').length, '#/admin/paginas']].filter(x => can(x[0] === 'slides' ? 'portada' : x[0])).map(([, k, v, h]) => ({ k, v, h })).sort((a, b) => b.v - a.v);
  const cmCard = CM.length ? `<div class="panel db-card"><h2><span>Contenido publicado</span><small class="db-h2s">registros por módulo</small></h2><div class="pb">${hbars(CM)}</div></div>` : '';
  // agenda
  const ag = alive('eventos').filter(e => e.estado === 'Publicado' && e.fecha.slice(0, 10) >= today).map(e => ({ f: e.fecha.slice(0, 10), t: e.titulo, k: 'Evento', h: can('eventos') ? '#/admin/eventos/' + e.id : '#/eventos' }));
  const adv = coll('admisiones').find(a => a.vigente); if (adv) (adv.cronograma || []).forEach(c => { const f = parseDMY(c.fecha); if (f >= today && !ag.some(a => a.f === f && a.k === 'Evento')) ag.push({ f, t: c.actividad, k: 'Admisión', h: can('admision') ? '#/admin/admision/' + adv.id : '#/admision' }); });
  const mv = coll('matriculas').find(m => m.vigente); if (mv) (mv.cronograma || []).forEach(c => { const f = parseDMY(c.fecha); if (f >= today) ag.push({ f, t: c.actividad, k: 'Matrícula', h: '#/admin/matricula/' + mv.id }); });
  ag.sort((a, b) => a.f.localeCompare(b.f));
  const agCard = `<div class="panel db-card"><h2><span>Próximas fechas</span><small class="db-h2s">eventos y cronogramas</small></h2><ul class="db-agenda">${ag.slice(0, 6).map(a => { const d = new Date(a.f + 'T12:00:00'); const dd = Math.round((d - new Date(today + 'T12:00:00')) / 864e5); return `<li><span class="db-date"><b>${d.getDate()}</b><small>${MES3[d.getMonth()]}</small></span><a href="${a.h}">${esc(a.t)}</a><span class="db-tag">${a.k}</span><small class="db-in">${dd === 0 ? 'Hoy' : dd === 1 ? 'Mañana' : 'En ' + dd + ' días'}</small></li>`; }).join('') || '<li class="db-empty">No hay fechas próximas registradas.</li>'}</ul></div>`;
  // salud del contenido
  const H = [
    ['Proceso de admisión vigente publicado', coll('admisiones').some(a => a.vigente && a.estado === 'Publicado'), '#/admin/admision'],
    ['Programas con brochure y malla en PDF', alive('programas').filter(p => p.estado === 'Publicado').every(p => p.brochure && p.malla), '#/admin/programas'],
    ['Enlaces de servicios con URL', alive('enlaces').filter(e => e.estado === 'Activo').every(e => e.url), '#/admin/enlaces'],
    ['UIT registrada para el año del TUPA', !!(DB.config.uit || {})[DB.tupaDocs.anio], '#/admin/tupacfg'],
    ['Reclamos sin notificaciones fallidas', !lrs.some(r => r.notifInst === 'Error'), '#/admin/reclamos'],
    ['Noticias publicadas en los últimos 30 días', newsPub.some(n => daysAgo(n.fecha) <= 30), '#/admin/noticias'],
    ['Docentes con fotografía', alive('personas').filter(p => p.tipo === 'Docente' && p.estado === 'Publicado').every(p => p.foto), '#/admin/docentes'],
    ['Sin publicaciones esperando aprobación', !pendingCount(), '#/admin/aprobaciones'],
  ];
  const score = Math.round(H.filter(h => h[1]).length / H.length * 100);
  const hCard = canFlag('approve') || u.rol === 'imagen' ? `<div class="panel db-card"><h2><span>Salud del portal</span><small class="db-h2s">${H.filter(h => h[1]).length} de ${H.length} controles</small></h2><div class="pb db-health">${ring(score)}<ul>${H.map(([l, ok, h]) => `<li class="${ok ? 'ok' : 'no'}"><span>${ic(ok ? 'check' : 'alert')}</span>${ok ? esc(l) : `<a href="${h}">${esc(l)}</a>`}</li>`).join('')}</ul></div></div>` : '';
  // actividad
  const act = coll('auditoria').filter(a => canFlag('approve') || a.usuario === u.usuario).slice(0, 7);
  const acCard = `<div class="panel db-card"><h2><span>Actividad reciente</span>${can('auditoria') ? '<a class="btn xs ghost" href="#/admin/auditoria">Ver auditoría</a>' : ''}</h2><ul class="db-act">${act.map(a => `<li><span class="db-av">${esc((a.usuario || '?').slice(0, 2).toUpperCase())}</span><div><b>${esc(a.accion)}</b> · ${esc(a.entidad)}${a.registro ? `<br><span class="r">${esc(clamp(a.registro, 64))}</span>` : ''}</div><small>${esc(a.usuario)}<br>${fshort(a.fecha, true)}</small></li>`).join('') || '<li class="db-empty">Sin actividad.</li>'}</ul></div>`;
  const hr = new Date().getHours(); const saludo = hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches';
  const html = `<div class="db-hero"><div><span class="db-eyebrow">${fdate(now)} · ${esc(role().label)}</span><h1>${saludo}, ${esc(u.nombre)}</h1><p>Resumen de la actividad del portal en los últimos <b>${P} días</b>.</p></div><div class="db-hacts"><div class="db-period" role="group" aria-label="Período">${[7, 30, 90].map(p => `<a href="#/admin/dashboard?p=${p}" aria-current="${p === P}">${p} días</a>`).join('')}</div><button class="btn sec" data-dbcsv>${sic('download')} Exportar resumen</button><a class="btn" href="#/" target="_blank" rel="noopener">${sic('ext')} Ver portal</a></div></div>
  <div class="db-kpis n${tiles.length}">${tiles.map(tileHTML).join('')}</div>
  <div class="db-row r21"><div class="panel db-card"><h2><span>Tráfico del portal</span><span class="db-lg"><span><i class="c"></i>Últimos ${P} días</span><span><i class="p"></i>${P} días previos</span></span></h2><div class="pb"><div class="db-big"><div><small>Total del período</small><b>${num(sum(cur))}</b>${deltaHTML(pct(sum(cur), sum(prev)), false)}</div><div><small>Promedio diario</small><b>${num(Math.round(sum(cur) / P))}</b></div><div><small>Día con más visitas</small><b>${labels[cur.indexOf(Math.max(...cur))]}</b></div></div>${lineChart(cur, prev, labels)}<p class="db-note">Páginas consultadas por visitantes, registradas por el servidor. Las recargas inmediatas de una misma página no se suman.</p></div></div>${lrCard || pend}</div>
  <div class="db-row r3">${lrCard ? pend : ''}${cmCard}${agCard}</div>
  <div class="db-row ${hCard ? 'r12' : 'r1'}">${hCard}${acCard}</div>`;
  return {
    html, after: () => {
      bindLineChart(document); bindChartTips(document);
      $('[data-dbcsv]').onclick = () => { downloadText(toCSV([['Indicador', 'Valor', 'Período']].concat(tiles.map(t => [t.l, t.v, P + ' días'])).concat([['Visitas totales', sum(cur), P + ' días'], ['Visitas período anterior', sum(prev), P + ' días']]).concat(T.map(t => [t[2], t[3], 'actual'])).concat([['Índice de salud del portal', score + ' %', 'actual']])), `resumen_panel_${today}.csv`, 'text/csv'); audit('Exportación', 'Panel de inicio', 'Resumen ' + P + ' días'); saveDB(); };
    }
  };
};

/* ---------- Aprobaciones (flujo editorial, sección 6.3) ---------- */
const APPROVAL_SRC = [['documentos', 'documentos'], ['convocatorias', 'convocatorias'], ['admisiones', 'admision']];
CUSTOM.aprobaciones = () => {
  const items = APPROVAL_SRC.flatMap(([c, k]) => coll(c).filter(x => x.estado === 'En revisión' && !x.deleted).map(r => ({ c, k, r, s: SPECS[k] })));
  const html = admHead('Aprobaciones pendientes', 'Contenidos enviados por los responsables de área que requieren aprobación del Administrador antes de publicarse.', '', 'check', [['Aprobaciones']])
    + `<div class="panel"><h2>Pendientes <span class="badge violet">${items.length}</span></h2><div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>Módulo</th><th>Contenido</th><th>Enviado por</th><th>Fecha</th><th class="c">Acciones</th></tr></thead><tbody>${items.map((x, i) => `<tr data-i="${i}"><td><span class="badge">${esc(x.s.title)}</span></td><td><b>${esc(x.s.label(x.r))}</b></td><td>${esc(x.r.modPor || '—')}</td><td>${fshort(x.r.modEn, true)}</td><td><div class="row-acts" style="justify-content:center">${x.s.preview ? ib('preview', 'eye', 'Vista previa') : ''}${ib('open', 'edit', 'Abrir')}<button class="btn xs ok" data-act="ok">Aprobar y publicar</button><button class="btn xs danger" data-act="back">Devolver</button></div></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty" style="margin:8px 0">No hay contenidos pendientes de aprobación.</div></td></tr>'}</tbody></table></div></div>`;
  return {
    html, after: () => $$('[data-act]').forEach(b => b.onclick = async () => {
      const x = items[+b.closest('tr').dataset.i]; const lbl = x.s.label(x.r);
      if (b.dataset.act === 'preview') return previewPublic(x.c, x.r, x.s.preview(x.r));
      if (b.dataset.act === 'open') return go(`#/admin/${x.k}/${x.r.id}`);
      if (b.dataset.act === 'ok') {
        if (!await confirmBox(`Se publicará en el portal: <b>${esc(lbl)}</b>.`, { ok: 'Aprobar y publicar', danger: false })) return;
        const prev = JSON.parse(JSON.stringify(x.r)); x.r.estado = x.s.pubState || 'Publicado'; x.r.aprobadoPor = currentUser().usuario; x.r.aprobadoEn = nowISO(); delete x.r.observacion; stamp(x.r);
        if (x.s.afterSave) x.s.afterSave(x.r, false, prev);
        audit('Aprobación y publicación', x.s.title, lbl, 'Enviado por ' + (prev.modPor || '—')); mailOut((coll('usuarios').find(u => u.usuario === prev.modPor) || {}).correo || inst().correo,'Contenido aprobado: ' + lbl, 'Su contenido fue aprobado y publicado.');
        if (saveDB()) { toast('Contenido aprobado y publicado.', 'ok'); route(); }
      }
      if (b.dataset.act === 'back') {
        const obs = await promptBox('Indique la observación para el responsable:', { title: 'Devolver con observaciones', ok: 'Devolver', textarea: true }); if (obs == null) return;
        if (!obs.trim()) return toast('Debe indicar la observación.', 'err');
        x.r.estado = 'Borrador'; x.r.observacion = obs.trim(); stamp(x.r); audit('Devuelto con observaciones', x.s.title, lbl, obs.trim());
        if (saveDB()) { toast('Devuelto al responsable como borrador.', 'ok'); route(); }
      }
    })
  };
};

/* ---------- Bandeja genérica (mensajes, reclamos, expedientes) ---------- */
function inbox({ key, collName, title, sub, icon, states, filterExtra = [], search, cols, rowCls, trash, extraActs = '', top = '', tabs = '' }) {
  const st = ADM.state[key] = ADM.state[key] || { q: '', f: {}, page: 1, size: 10, trash: false };
  let rows = coll(collName).filter(r => trash ? (st.trash ? r.deleted : !r.deleted) : true);
  if (st.q) { const t = normTitle(st.q); rows = rows.filter(r => normTitle(search(r)).includes(t)); }
  if (st.f.estado) rows = rows.filter(r => (r.anulado ? 'Anulado' : r.estado) === st.f.estado);
  filterExtra.forEach(fl => { if (st.f[fl.n]) rows = rows.filter(r => String(r[fl.n]) === st.f[fl.n]); });
  if (st.f.desde) rows = rows.filter(r => r.fecha.slice(0, 10) >= st.f.desde); if (st.f.hasta) rows = rows.filter(r => r.fecha.slice(0, 10) <= st.f.hasta);
  rows.sort((a, b) => b.fecha.localeCompare(a.fecha)); const tot = rows.length; st.page = Math.max(1, Math.min(st.page, Math.ceil(tot / st.size) || 1)); const pg = rows.slice((st.page - 1) * st.size, st.page * st.size);
  const html = admHead(title, sub, extraActs, icon, [[title]]) + tabs + top
    + `<form class="filters" data-lf><div class="field"><label for="lf-q">Buscar</label><input id="lf-q" name="q" value="${esc(st.q)}" placeholder="Nombre, código, asunto..."></div><div class="field"><label for="lf-e">Estado</label><select id="lf-e" name="estado"><option value="">Todos</option>${states.map(s => `<option ${st.f.estado === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>${filterExtra.map(fl => `<div class="field"><label for="lf-${fl.n}">${fl.l}</label><select id="lf-${fl.n}" name="${fl.n}"><option value="">Todos</option>${fl.opts.map(o => `<option ${st.f[fl.n] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`).join('')}<div class="field"><label for="lf-d">Desde</label><input id="lf-d" type="date" name="desde" value="${st.f.desde || ''}"></div><div class="field"><label for="lf-h">Hasta</label><input id="lf-h" type="date" name="hasta" value="${st.f.hasta || ''}"></div><div class="actions"><button class="btn">Filtrar</button><button type="button" class="btn ghost" data-clr>Limpiar</button></div></form>
    <div class="panel"><h2><span>${st.trash ? 'Papelera' : 'Bandeja'} <span class="badge">${tot} registro(s)</span></span>${trash ? `<button class="btn xs ghost" data-trash>${st.trash ? '← Volver a la bandeja' : sic('trash', 13) + ' Papelera (' + coll(collName).filter(r => r.deleted).length + ')'}</button>` : ''}</h2><div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr>${cols.map(c => `<th class="${c.cls || ''}">${c.l}</th>`).join('')}<th class="c">Acciones</th></tr></thead><tbody>${pg.map(r => `<tr data-id="${r.id}" class="${rowCls ? rowCls(r) : ''}">${cols.map(c => `<td class="${c.cls || ''}">${c.f(r)}</td>`).join('')}<td><div class="row-acts" style="justify-content:center">${st.trash ? ib('restore', 'restore', 'Restaurar') : ib('open', 'eye', 'Ver detalle') + (trash ? ib('del', 'trash', 'Eliminar', 'del') : '')}</div></td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}"><div class="empty" style="margin:8px 0">No hay registros con los criterios seleccionados.</div></td></tr>`}</tbody></table></div><div class="pb" style="padding-top:0">${pager(tot, st.page, st.size)}</div></div>`;
  const bind = () => {
    const f = $('[data-lf]'); const rer = () => route();
    f.onsubmit = e => { e.preventDefault(); st.q = f.q.value.trim(); st.f = { estado: f.estado.value, desde: f.desde.value, hasta: f.hasta.value }; filterExtra.forEach(fl => st.f[fl.n] = f[fl.n].value); st.page = 1; rer(); };
    $('[data-clr]').onclick = () => { st.q = ''; st.f = {}; st.page = 1; rer(); };
    const tb = $('[data-trash]'); if (tb) tb.onclick = () => { st.trash = !st.trash; st.page = 1; rer(); };
    bindPager($('.panel:last-of-type'), st, rer);
    $$('tr[data-id] [data-act]').forEach(b => b.onclick = async () => {
      const r = byId(collName, b.closest('tr').dataset.id);
      if (b.dataset.act === 'open') return go(`#/admin/${key}/${r.id}`);
      if (b.dataset.act === 'del') { if (!await confirmBox('El registro se enviará a la papelera.', { ok: 'Eliminar' })) return; r.deleted = true; stamp(r); audit('Eliminación lógica', title, r.asunto || r.codigo); if(!saveDB())return; toast('Enviado a la papelera.', 'ok'); return rer(); }
      if (b.dataset.act === 'restore') { r.deleted = false; stamp(r); audit('Restauración', title, r.asunto || r.codigo); if(!saveDB())return; toast('Restaurado.', 'ok'); return rer(); }
    });
  };
  return { html, after: bind, rows };
}
const histHTML = h => `<div class="timeline">${(h || []).map(x => `<div class="it"><span class="y" style="font-size:12px">${fshort(x.fecha, true)}</span><p style="margin:0">${stBadge(x.estado)} <small style="color:var(--muted)">por ${esc(x.usuario)}</small>${x.nota ? `<br>${esc(x.nota)}` : ''}</p></div>`).join('') || '<p>Sin movimientos.</p>'}</div>`;

/* ---------- Mensajes de contacto ---------- */
CUSTOM.mensajes = (parts) => {
  if (parts[2]) return mensajeDetalle(parts[2]);
  return inbox({
    key: 'mensajes', collName: 'mensajes', title: 'Mensajes de contacto', sub: 'Consultas recibidas desde el formulario “Contáctanos”.', icon: 'mail', states: ['Nuevo', 'Leído', 'Atendido'], trash: true,
    search: r => [r.nombres, r.correo, r.asunto, r.mensaje].join(' '), rowCls: r => r.estado === 'Nuevo' ? 'unread' : '',
    cols: [{ l: 'Fecha', f: r => fshort(r.fecha, true) }, { l: 'Remitente', f: r => `<b>${esc(r.nombres)}</b><br><small>${esc(r.correo)}</small>` }, { l: 'Asunto', f: r => `${r.estado === 'Nuevo' ? '<b>' : ''}${esc(r.asunto)}${r.estado === 'Nuevo' ? '</b>' : ''}<br><small style="color:var(--muted)">${esc(clamp(r.mensaje, 70))}</small>` }, { l: 'Programa', f: r => esc((progById(r.programa) || {}).codigo || '—') }, { l: 'Estado', cls: 'c', f: r => stBadge(r.estado) }],
  });
};
function mensajeDetalle(id) {
  const m = byId('mensajes', id); if (!m) return { html: admHead('Mensaje no encontrado', '', '<a class="btn" href="#/admin/mensajes">Volver</a>', 'mail') };
  if (m.estado === 'Nuevo') { m.estado = 'Leído'; m.historial = m.historial || []; m.historial.push({ fecha: nowISO(), usuario: currentUser().usuario, estado: 'Leído' }); audit('Lectura', 'Mensajes de contacto', m.asunto); saveDB(); }
  const html = admHead(m.asunto, `Recibido el ${fdate(m.fecha, true)}`, `<a class="btn ghost" href="#/admin/mensajes">${sic('back')} Volver a la bandeja</a>`, 'mail', [['Mensajes de contacto', '#/admin/mensajes'], ['Detalle']])
    + `<div class="edit-grid"><div class="panel"><h2>Mensaje</h2><div class="pb"><dl class="kv"><dt>Nombres</dt><dd>${esc(m.nombres)}</dd><dt>Correo</dt><dd><a href="mailto:${esc(m.correo)}">${esc(m.correo)}</a></dd><dt>Teléfono</dt><dd>${esc(m.telefono || '—')}</dd>${m.documento ? `<dt>Documento</dt><dd>${esc(canFlag('viewDni') ? m.documento : maskDni(m.documento))}</dd>` : ''}<dt>Programa de interés</dt><dd>${esc((progById(m.programa) || {}).nombre || '—')}</dd></dl><div class="card cb" style="margin-top:12px;white-space:pre-wrap">${esc(m.mensaje)}</div>
    <h3 style="margin-top:16px">Responder</h3><textarea class="inp" id="mr" rows="4" placeholder="Respuesta institucional; el aviso se registra en la cola de correo.">${esc(m.respuesta || '')}</textarea><p style="margin-top:8px"><button class="btn" data-reply>${sic('send')} Guardar respuesta y marcar atendido</button></p></div></div>
    <div><div class="panel"><h2>Estado</h2><div class="pb" style="display:grid;gap:8px">${stBadge(m.estado)}<div class="field"><label for="mst">Cambiar estado</label><select id="mst">${['Nuevo', 'Leído', 'Atendido'].map(s => `<option ${s === m.estado ? 'selected' : ''}>${s}</option>`).join('')}</select></div><button class="btn sec" data-st>Actualizar estado</button></div></div><div class="panel"><h2>Historial</h2><div class="pb">${histHTML(m.historial)}</div></div></div></div>`;
  return {
    html, after: () => {
      const upd = (est, nota) => { m.estado = est; m.historial = m.historial || []; m.historial.push({ fecha: nowISO(), usuario: currentUser().usuario, estado: est, nota }); stamp(m); audit('Cambio de estado: ' + est, 'Mensajes de contacto', m.asunto, nota || ''); if (saveDB()) { toast('Estado actualizado.', 'ok'); route(); } };
      $('[data-st]').onclick = () => upd($('#mst').value);
      $('[data-reply]').onclick = () => { const t = $('#mr').value.trim(); if (t.length < 5) return toast('Escriba la respuesta.', 'err'); m.respuesta=t; upd('Atendido', `Respuesta registrada: ${clamp(t,120)}. Correo desactivado.`); };
      // Mientras el correo del portal esté desactivado, la respuesta se envía desde el correo de quien atiende.
      $('[data-reply]').insertAdjacentHTML('afterend', ` <button class="btn sec" type="button" data-mailto>${sic('mail')} Responder desde mi correo</button>`);
      $('[data-mailto]').onclick = () => { const t = $('#mr').value.trim(); if (t.length < 5) return toast('Escriba la respuesta.', 'err');
        const body = `Estimado(a) ${m.nombres}:\n\n${t}\n\n—\n${(DB.config.inst || {}).nombre || ''}`; location.href = `mailto:${encodeURIComponent(m.correo)}?subject=${encodeURIComponent('Re: ' + m.asunto)}&body=${encodeURIComponent(body)}`;
        m.respuesta = t; upd('Atendido', `Respuesta enviada desde el correo de ${currentUser().usuario}: ${clamp(t, 120)}`); };
    }
  };
}

/* ---------- Libro de reclamaciones ---------- */
const LR_STATES = ['Recibido', 'En atención', 'Atendido'];
const lrTabs = a => tabsBar([['l', 'Reclamaciones', '#/admin/reclamos'], ['n', 'Notificaciones por correo', '#/admin/reclamos/notificaciones']], a);
CUSTOM.reclamos = (parts) => {
  if (parts[2] === 'notificaciones') return lrNotif();
  if (parts[2]) return reclamoDetalle(parts[2]);
  const all = coll('reclamos'); const y = String(yearNow());
  const top = `<div class="kpis">${kpi('book', 'var(--blue)', all.filter(r => r.fecha.startsWith(y)).length, 'Registrados en ' + y)}${kpi('inbox', 'var(--warn)', all.filter(r => r.estado === 'Recibido' && !r.anulado).length, 'Recibidos sin atender')}${kpi('clock', '#6d4bc4', all.filter(r => r.estado === 'En atención' && !r.anulado).length, 'En atención')}${kpi('check', 'var(--ok)', all.filter(r => r.estado === 'Atendido' && !r.anulado).length, 'Atendidos')}${kpi('alert', 'var(--err)', 'Ver panel', 'Notificaciones SMTP')}</div>`;
  const ib2 = inbox({
    key: 'reclamos', collName: 'reclamos', title: 'Libro de reclamaciones', sub: 'Los registros no pueden eliminarse ni modificarse en su contenido original. Solo se gestiona su atención.', icon: 'book', states: LR_STATES.concat('Anulado'), trash: false, top, tabs: lrTabs('l'),
    filterExtra: [{ n: 'tipo', l: 'Tipo', opts: ['Reclamo', 'Queja'] }], search: r => [r.codigo, r.nombres, r.asunto, r.numDoc].join(' '),
    extraActs: `<button class="btn sec" data-rcsv>${sic('download')} Reporte CSV</button><a class="btn ghost" href="#/servicios/libro-de-reclamaciones" target="_blank">Ver formulario público</a>`,
    cols: [{ l: 'Código', f: r => `<b>${esc(r.codigo)}</b>` }, { l: 'Fecha', f: r => fshort(r.fecha, true) }, { l: 'Tipo', f: r => esc(r.tipo) }, { l: 'Reclamante', f: r => `${esc(r.nombres)}<br><small>${esc(r.tipoDoc)} ${dniCell(r.numDoc)}</small>` }, { l: 'Asunto', f: r => esc(clamp(r.asunto, 50)) }, { l: 'Correo', cls: 'c', f: r => 'Ver panel SMTP' }, { l: 'Estado', cls: 'c', f: r => stBadge(r.anulado ? 'Anulado' : r.estado) }, { l: 'Días', cls: 'num', f: r => r.estado === 'Atendido' || r.anulado ? '—' : `<span style="color:${daysAgo(r.fecha) > 10 ? 'var(--err)' : 'inherit'}">${daysAgo(r.fecha)}</span>` }],
  });
  return { html: ib2.html, after: () => { ib2.after(); $('[data-rcsv]').onclick = () => { downloadText(toCSV([['Código', 'Fecha', 'Tipo', 'Reclamante', 'Documento', 'Correo', 'Asunto', 'Estado', 'Notificación institucional', 'Fecha de atención', 'Respuesta']].concat(ib2.rows.map(r => [r.codigo, fshort(r.fecha, true), r.tipo, r.nombres, r.tipoDoc + ' ' + (canFlag('viewDni') ? r.numDoc : maskDni(r.numDoc)), r.correo, r.asunto, r.anulado ? 'Anulado' : r.estado, r.notifInst, r.atendidoEn ? fshort(r.atendidoEn, true) : '', r.respuesta]))), 'reporte_libro_reclamaciones.csv', 'text/csv'); audit('Exportación', 'Libro de reclamaciones', ib2.rows.length + ' registros'); saveDB(); }; } };
};
function reclamoDetalle(id) {
  const r = byId('reclamos', id); if (!r) return { html: admHead('Reclamo no encontrado', '', '<a class="btn" href="#/admin/reclamos">Volver</a>', 'book') };
  const isAdm = currentUser().rol === 'admin';
  const html = admHead(`${r.tipo} ${r.codigo}`, `Registrado el ${fdate(r.fecha, true)} · ${r.anulado ? '<span class="badge err">Anulado</span>' : stBadge(r.estado)}`, `<button class="btn sec" data-pdf>${sic('print')} Hoja de reclamación (PDF)</button><a class="btn ghost" href="#/admin/reclamos">${sic('back')} Volver</a>`, 'book', [['Libro de reclamaciones', '#/admin/reclamos'], [r.codigo]])
    + `<div class="edit-grid"><div style="display:grid;gap:16px"><div class="panel"><h2>Registro original <span class="badge gray">${sic('lock', 12)} Solo lectura</span></h2><div class="pb"><dl class="kv"><dt>Código</dt><dd><b>${esc(r.codigo)}</b></dd><dt>Fecha y hora</dt><dd>${fdate(r.fecha, true)}</dd><dt>Tipo</dt><dd>${esc(r.tipo)}</dd><dt>Reclamante</dt><dd>${esc(r.nombres)}</dd><dt>Documento</dt><dd>${esc(r.tipoDoc)} ${dniCell(r.numDoc)}</dd><dt>Correo</dt><dd>${esc(r.correo)}</dd><dt>Teléfono</dt><dd>${esc(r.telefono || '—')}</dd><dt>Asunto</dt><dd>${esc(r.asunto)}</dd></dl><h3>Descripción del hecho</h3><div class="card cb" style="white-space:pre-wrap">${esc(r.descripcion)}</div><h3>Pedido</h3><div class="card cb" style="white-space:pre-wrap">${esc(r.pedido)}</div>${r.adjunto ? `<p><button class="btn sm sec" data-adj>${sic('download')} Adjunto: ${esc(r.adjunto.original || r.adjunto.nombre)} (${fsize(r.adjunto.size)})</button></p>` : '<p style="color:var(--muted)">Sin archivo adjunto.</p>'}</div></div>
    <div class="panel"><h2>Respuesta institucional</h2><div class="pb">${r.respuesta ? `<div class="notice ok" style="white-space:pre-wrap">${esc(r.respuesta)}<br><small>Respondido por ${esc(r.atendidoPor || '—')} el ${fshort(r.atendidoEn, true)} · Notificación al usuario: Ver panel de correo</small></div>` : ''}${r.anulado ? '' : `<textarea class="inp" id="lr-resp" aria-label="Respuesta al reclamante" rows="5" placeholder="Respuesta institucional; el aviso se registra en la cola de correo.">${esc(r.respuesta || '')}</textarea><p style="margin-top:8px"><button class="btn ok" data-resp>${sic('send')} Guardar respuesta y marcar atendido</button></p>`}</div></div>
    <div class="panel"><h2>Notas internas <small style="font-weight:400;color:var(--muted)">(no visibles para el ciudadano)</small></h2><div class="pb">${(r.notas || []).map(n => `<div class="card cb" style="margin-bottom:8px"><small style="color:var(--muted)">${esc(n.usuario)} · ${fshort(n.fecha, true)}</small><br>${esc(n.texto)}</div>`).join('') || '<p style="color:var(--muted)">Sin notas.</p>'}<div style="display:flex;gap:8px"><input class="inp" id="lr-nota" aria-label="Nueva nota interna" placeholder="Agregar nota interna"><button class="btn sec" data-nota>Agregar</button></div></div></div></div>
    <div style="display:grid;gap:16px;align-content:start"><div class="panel"><h2>Gestión</h2><div class="pb" style="display:grid;gap:10px">${r.anulado ? `<div class="notice err">Registro anulado por ${esc(r.anuladoPor)}: ${esc(r.motivoAnulacion)}</div>` : `<div class="field"><label for="lr-st">Estado</label><select id="lr-st">${LR_STATES.map(s => `<option ${s === r.estado ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div class="field"><label for="lr-sn">Comentario del cambio</label><input id="lr-sn" class="inp"></div><button class="btn" data-st>Actualizar estado</button>${isAdm ? `<button class="btn danger" data-anular>Anular registro</button><small style="color:var(--muted)">La anulación no elimina el registro; queda en el historial y la auditoría.</small>` : ''}`}</div></div>
    <div class="panel"><h2>Notificaciones</h2><div class="pb"><p>La constancia, las derivaciones y las respuestas se notifican desde el correo central. El administrador puede consultar entregas, errores y reintentos en Configuración de la intranet → Notificaciones por correo.</p></div></div>
    <div class="panel"><h2>Historial de estados</h2><div class="pb">${histHTML(r.historial)}</div></div></div></div>`;
  return {
    html, after: () => {
      const me = currentUser().usuario; const save = msg => { stamp(r); if (saveDB()) { toast(msg, 'ok'); route(); } };
      $('[data-pdf]').onclick = () => downloadBlob(makePdf(`Hoja de ${r.tipo.toLowerCase()} ${r.codigo}`, [`Fecha: ${fshort(r.fecha, true)}`, `Reclamante: ${r.nombres}`, `Documento: ${r.tipoDoc} ${canFlag('viewDni') ? r.numDoc : maskDni(r.numDoc)}`, `Correo: ${r.correo}`, `Asunto: ${r.asunto}`, '', 'Descripcion:', r.descripcion, '', 'Pedido:', r.pedido, '', `Estado: ${r.anulado ? 'Anulado' : r.estado}`, r.respuesta ? 'Respuesta: ' + r.respuesta : ''], inst().nombre.toUpperCase()), `Reclamo_${r.codigo}.pdf`);
      const adj = $('[data-adj]'); if (adj) adj.onclick = () => { downloadDoc(r.adjunto); audit('Descarga de adjunto', 'Libro de reclamaciones', r.codigo); saveDB(); };
      $('[data-nota]').onclick = () => { const t = $('#lr-nota').value.trim(); if (!t) return; r.notas = r.notas || []; r.notas.push({ fecha: nowISO(), usuario: me, texto: t }); audit('Nota interna', 'Libro de reclamaciones', r.codigo); save('Nota agregada.'); };
      const st = $('[data-st]'); if (st) st.onclick = () => { const v = $('#lr-st').value; if (v === r.estado) return toast('Seleccione un estado diferente.', 'err'); if (v === 'Atendido' && !r.respuesta) return toast('Registre primero la respuesta institucional.', 'err'); r.historial.push({ fecha: nowISO(), usuario: me, estado: v, nota: $('#lr-sn').value.trim() }); audit(`Cambio de estado: ${r.estado} → ${v}`, 'Libro de reclamaciones', r.codigo); r.estado = v; save('Estado actualizado.'); };
      const rs = $('[data-resp]'); if (rs) rs.onclick = () => { const t = $('#lr-resp').value.trim(); if (t.length < 10) return toast('La respuesta debe tener al menos 10 caracteres.', 'err'); r.respuesta = t; r.atendidoPor = me; r.atendidoEn = nowISO();  if (r.estado !== 'Atendido') r.historial.push({ fecha: nowISO(), usuario: me, estado: 'Atendido', nota: 'Respuesta registrada en el portal' }); r.estado = 'Atendido'; audit('Respuesta institucional', 'Libro de reclamaciones', r.codigo, 'Notificación al usuario: ' + r.notifUser); save('Respuesta registrada. El aviso se procesará desde la cola de correo.'); };
      const an = $('[data-anular]'); if (an) an.onclick = async () => { const m = await promptBox('Motivo de la anulación (quedará registrado):', { title: 'Anular registro', ok: 'Anular', textarea: true }); if (m == null) return; if (m.trim().length < 5) return toast('Indique el motivo.', 'err'); r.anulado = true; r.estado = 'Anulado'; r.anuladoPor = me; r.motivoAnulacion = m.trim(); r.historial.push({ fecha: nowISO(), usuario: me, estado: 'Anulado', nota: m.trim() }); audit('Anulación', 'Libro de reclamaciones', r.codigo, m.trim()); save('Registro anulado.'); };
    }
  };
}
function lrNotif() {
 return {html:admHead('Notificaciones del Libro de Reclamaciones','Los avisos se generan en el servidor y se entregan con el correo central.','','book')+lrTabs('n')+'<div class="panel"><div class="pb"><p>Consulta los estados reales y los reintentos en Configuración de la intranet → Notificaciones por correo. Esta bitácora está reservada al administrador.</p></div></div>'};
}

/* ---------- Mesa de partes virtual ---------- */
const EXP_STATES = ['Recibido', 'En proceso', 'Observado', 'Atendido', 'Archivado'];
CUSTOM.expedientes = (parts) => {
  if (parts[2]) return expDetalle(parts[2]);
  return inbox({
    key: 'expedientes', collName: 'expedientes', title: 'Mesa de partes virtual', sub: 'Expedientes y trámites registrados desde el portal.', icon: 'inbox', states: EXP_STATES, trash: false,
    search: r => [r.numero, r.nombres, r.asunto, r.tipoTramite, r.numDoc].join(' '),
    cols: [{ l: 'N.º expediente', f: r => `<b>${esc(r.numero)}</b>` }, { l: 'Fecha', f: r => fshort(r.fecha, true) }, { l: 'Solicitante', f: r => `${esc(r.nombres)}<br><small>${esc(r.tipoDoc)} ${dniCell(r.numDoc)}</small>` }, { l: 'Trámite', f: r => esc(r.tipoTramite) }, { l: 'Asunto', f: r => esc(clamp(r.asunto, 50)) }, { l: 'Folios', cls: 'num', f: r => r.folios || '—' }, { l: 'Área', f: r => esc(r.area ? areaName(r.area) : 'Mesa de partes') }, { l: 'Plazo', cls: 'c', f: r => expSem(r) }, { l: 'Estado', cls: 'c', f: r => stBadge(r.estado) }],
  });
};
function expDetalle(id) {
  const x = byId('expedientes', id); if (!x) return { html: admHead('Expediente no encontrado', '', '<a class="btn" href="#/admin/expedientes">Volver</a>', 'inbox') };
  const html = admHead('Expediente ' + x.numero, `${esc(x.tipoTramite)} · ${stBadge(x.estado)}`, `<button class="btn sec" data-cargo>${sic('print')} Cargo de recepción (PDF)</button><a class="btn ghost" href="#/admin/expedientes">${sic('back')} Volver</a>`, 'inbox', [['Mesa de partes', '#/admin/expedientes'], [x.numero]])
    + `<div class="edit-grid"><div class="panel"><h2>Datos del expediente</h2><div class="pb"><dl class="kv"><dt>N.º</dt><dd><b>${esc(x.numero)}</b></dd><dt>Fecha</dt><dd>${fdate(x.fecha, true)}</dd><dt>Solicitante</dt><dd>${esc(x.nombres)}</dd><dt>Documento</dt><dd>${esc(x.tipoDoc)} ${dniCell(x.numDoc)}</dd><dt>Correo</dt><dd>${esc(x.correo)}</dd><dt>Teléfono</dt><dd>${esc(x.telefono || '—')}</dd><dt>Trámite</dt><dd>${esc(x.tipoTramite)}</dd><dt>Folios</dt><dd>${x.folios || '—'}</dd><dt>Área actual</dt><dd>${esc(x.area ? areaName(x.area) : 'Mesa de partes')}</dd><dt>Plazo</dt><dd>${expSem(x)} <small>(${EXP_PLAZOS[x.tipoTramite] || 10} días hábiles, vence ${fshort(expPlazo(x).due)})</small></dd></dl><h3>Asunto</h3><div class="card cb" style="white-space:pre-wrap">${esc(x.asunto)}</div>${x.archivo ? `<p><button class="btn sm sec" data-arch>${sic('download')} ${esc(x.archivo.original || x.archivo.nombre)} (${fsize(x.archivo.size)})</button></p>` : '<p style="color:var(--muted)">Sin archivo adjunto.</p>'}</div></div>
    <div style="display:grid;gap:16px;align-content:start"><div class="panel"><h2>Derivar a un área</h2><div class="pb" style="display:grid;gap:10px"><div class="field"><label for="xa">Área responsable</label><select id="xa">${(IX ? IX.areas() : []).map(([c, n]) => `<option value="${esc(c)}" ${c === x.area ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div><button class="btn sec" data-xa>Derivar expediente</button></div></div><div class="panel"><h2>Actualizar estado</h2><div class="pb" style="display:grid;gap:10px"><div class="field"><label for="xs">Nuevo estado</label><select id="xs">${EXP_STATES.map(s => `<option ${s === x.estado ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div class="field"><label for="xn">Nota (visible en la consulta pública)</label><textarea id="xn" class="inp" rows="3" placeholder="Ej.: Derivado a Secretaría Académica"></textarea></div><label class="check"><input type="checkbox" id="xm" checked> Notificar al solicitante por correo</label><button class="btn" data-xs>Guardar</button></div></div><div class="panel"><h2>Seguimiento</h2><div class="pb">${histHTML(x.historial)}</div></div></div></div>`;
  return {
    html, after: () => {
      const a = $('[data-arch]'); if (a) a.onclick = () => downloadDoc(x.archivo);
      $('[data-xa]').onclick = () => { const v = $('#xa').value; if (!v || v === x.area) return toast('Seleccione un área diferente.', 'err'); const n = 'Derivado a ' + areaName(v); x.area = v; if (x.estado === 'Recibido') x.estado = 'En proceso'; x.historial.push({ fecha: nowISO(), usuario: currentUser().usuario, estado: x.estado, nota: n }); audit('Derivación', 'Mesa de partes', x.numero, n); stamp(x); if (saveDB()) { toast('Expediente derivado.', 'ok'); route(); } };
      $('[data-cargo]').onclick = () => cargoExp(x.id);
      $('[data-xs]').onclick = () => { const v = $('#xs').value, n = $('#xn').value.trim(); if (v === x.estado && !n) return toast('Seleccione otro estado o escriba una nota.', 'err'); if (v === 'Observado' && !n) return toast('Indique la observación en la nota.', 'err'); x.historial.push({ fecha: nowISO(), usuario: currentUser().usuario, estado: v, nota: n }); audit(`Cambio de estado: ${x.estado} → ${v}`, 'Mesa de partes', x.numero, n); x.estado = v; if ($('#xm').checked) delete x.sinAviso; else x.sinAviso = true; stamp(x); if ($('#xm').checked) mailOut(x.correo, `Expediente ${x.numero}: ${v}`, n || 'Su expediente cambió de estado.'); if (saveDB()) { toast('Expediente actualizado.', 'ok'); route(); } };
    }
  };
}

/* ---------- Auditoría ---------- */
CUSTOM.auditoria = () => {
  const st = ADM.state.auditoria = ADM.state.auditoria || { q: '', f: {}, page: 1, size: 25 };
  let rows = coll('auditoria');
  if (st.q) { const t = normTitle(st.q); rows = rows.filter(a => normTitle([a.accion, a.entidad, a.registro, a.detalle].join(' ')).includes(t)); }
  if (st.f.usuario) rows = rows.filter(a => a.usuario === st.f.usuario); if (st.f.entidad) rows = rows.filter(a => a.entidad === st.f.entidad);
  if (st.f.desde) rows = rows.filter(a => a.fecha.slice(0, 10) >= st.f.desde); if (st.f.hasta) rows = rows.filter(a => a.fecha.slice(0, 10) <= st.f.hasta);
  const users = [...new Set(coll('auditoria').map(a => a.usuario))].sort(), ents = [...new Set(coll('auditoria').map(a => a.entidad))].sort();
  const tot = rows.length; st.page = Math.max(1, Math.min(st.page, Math.ceil(tot / st.size) || 1)); const pg = rows.slice((st.page - 1) * st.size, st.page * st.size);
  const sel = (n, l, o) => `<div class="field"><label for="af-${n}">${l}</label><select id="af-${n}" name="${n}"><option value="">Todos</option>${o.map(x => `<option ${st.f[n] === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`;
  const html = admHead('Auditoría', 'Registro inalterable de accesos, cambios, publicaciones, eliminaciones y exportaciones.', `<button class="btn sec" data-acsv>${sic('download')} Exportar CSV</button>`, 'history', [['Auditoría']])
    + `<form class="filters" data-af><div class="field"><label for="af-q">Buscar</label><input id="af-q" name="q" value="${esc(st.q)}"></div>${sel('usuario', 'Usuario', users)}${sel('entidad', 'Módulo', ents)}<div class="field"><label for="af-d">Desde</label><input id="af-d" type="date" name="desde" value="${st.f.desde || ''}"></div><div class="field"><label for="af-h">Hasta</label><input id="af-h" type="date" name="hasta" value="${st.f.hasta || ''}"></div><div class="actions"><button class="btn">Filtrar</button><button type="button" class="btn ghost" data-clr>Limpiar</button></div></form>
    <div class="panel"><h2>Eventos <span class="badge">${num(tot)}</span></h2><div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Módulo</th><th>Registro</th><th>Detalle</th></tr></thead><tbody>${pg.map(a => `<tr><td style="white-space:nowrap">${fshort(a.fecha, true)}</td><td><b>${esc(a.usuario)}</b></td><td><small>${esc(a.rol || '')}</small></td><td>${esc(a.accion)}</td><td>${esc(a.entidad)}</td><td>${esc(a.registro)}</td><td><small>${esc(a.detalle)}</small></td></tr>`).join('') || '<tr><td colspan="7"><div class="empty">Sin eventos.</div></td></tr>'}</tbody></table></div><div class="pb" style="padding-top:0">${pager(tot, st.page, st.size, [25, 50, 100])}</div></div>`;
  return {
    html, after: () => {
      const f = $('[data-af]'); const rer = () => route();
      f.onsubmit = e => { e.preventDefault(); st.q = f.q.value.trim(); st.f = { usuario: f.usuario.value, entidad: f.entidad.value, desde: f.desde.value, hasta: f.hasta.value }; st.page = 1; rer(); };
      $('[data-clr]').onclick = () => { st.q = ''; st.f = {}; st.page = 1; rer(); };
      bindPager($('.panel'), st, rer);
      $('[data-acsv]').onclick = () => { downloadText(toCSV([['Fecha', 'Usuario', 'Rol', 'Acción', 'Módulo', 'Registro', 'Detalle']].concat(rows.map(a => [fshort(a.fecha, true), a.usuario, a.rol, a.accion, a.entidad, a.registro, a.detalle]))), 'auditoria.csv', 'text/csv'); audit('Exportación', 'Auditoría', tot + ' eventos'); saveDB(); };
    }
  };
};

/* ---------- Copias de seguridad ---------- */
CUSTOM.respaldo = () => ({html:admHead('Respaldos y restauración','Copias completas en el servidor.','','database')+`<a class="btn" href="/respaldos.php">Administrar respaldos y restauración</a>`});

/* ---------- Enrutador del panel ---------- */
const MOD_OF = { tupacfg: 'tupa', becasimport: 'becas', becasrep: 'becas', popup: 'portada', portada: 'portada' };
/* ---------- Temas y apariencia (solo el panel elige y edita el tema) ---------- */
/* Estructuras sin versión oscura y los neutros claros que usan con una combinación oscura (mismos valores que :root en portal.css) */
const NO_DARK = ['impacto', 'campus', 'horizonte', 'editorial'];
const LIGHT_NEUTRALS_ALL = { '--page': '#fff', '--card': '#fff', '--card2': '#f6f9fd', '--bg': '#f4f7fb', '--bg2': '#eff3f9', '--white': '#fff', '--ink': '#1b2433', '--ink2': '#4a5568', '--muted': '#5f6b7c', '--line': '#dfe5ee', '--line2': '#c9d5e6', '--ok': '#18794a', '--okbg': '#e3f5ea', '--okink': '#0f5a31', '--warn': '#955800', '--warnbg': '#fff3dc', '--warnink': '#6b4200', '--err': '#c62828', '--errbg': '#fde8e8', '--errink': '#7a1414', '--info': '#1556b8', '--infobg': '#e8f0fc', '--infoink': '#0b3a7e', '--violet': '#5b3cc4', '--violetbg': '#efeafd', '--graybg': '#eef0f3', '--grayink': '#55606e', '--sh': '0 1px 2px rgba(var(--ov),.06),0 4px 14px rgba(var(--ov),.07)', '--sh2': '0 10px 34px rgba(var(--ov),.18)' };
const DARK_NEUTRALS = { '--page': '#0b1220', '--card': '#121c32', '--card2': '#16223b', '--bg': '#0e1729', '--line': '#24324e', '--ink': '#e4e9f2', '--ink2': '#b4bfd3', '--muted': '#8e9ab0' };
const LIGHT_NEUTRALS = { '--page': '#ffffff', '--card': '#ffffff', '--ink': '#1b2433', '--ink2': '#4a5568', '--muted': '#5f6b7c' };
function themeScope(t) {
  const v = Object.assign({}, t.modo === 'oscuro' ? DARK_NEUTRALS : LIGHT_NEUTRALS, themeVars(t));
  return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';');
}
function themeMock(t, big = false) {
  return `<div class="tm-mock${big ? ' big' : ''}" style="${esc(themeScope(t))}" aria-hidden="true">
    <div class="tm-top"></div>
    <div class="tm-head"><i class="tm-logo"></i><b>${esc(inst().nombre)}</b><span class="tm-nav"><u></u><u></u><u></u>${big ? '<u></u>' : ''}</span></div>
    <div class="tm-hero"><b>Admisión ${new Date().getFullYear() + 1}</b>${big ? '<small>Formación técnica de calidad</small>' : ''}<em>Postula aquí</em></div>
    <div class="tm-cards">${[1, 2, big ? 3 : 0].filter(Boolean).map(i => `<div class="tm-card"><b>${['Noticias', 'Programas', 'Eventos'][i - 1]}</b>${big ? '<p>Texto de ejemplo del portal.</p><a>Ver más</a>' : '<p></p>'}</div>`).join('')}</div>
    ${big ? '<div class="tm-btns"><span class="tm-b1">Botón principal</span><span class="tm-b2">Dorado</span><span class="tm-badge">Etiqueta</span></div>' : ''}
    <div class="tm-foot"></div></div>`;
}
function themeChecks(t) {
  const v = themeVars(t), card = t.modo === 'oscuro' ? DARK_NEUTRALS['--card'] : '#ffffff';
  const rows = [
    ['Texto blanco sobre el color principal (cabecera, pie)', contrast('#ffffff', t.navy)],
    ['Texto blanco sobre el color de acento (botones)', contrast('#ffffff', t.blue)],
    ['Texto oscuro sobre el dorado (botones dorados)', contrast('#1b1b1b', t.gold)],
    ['Enlaces sobre las tarjetas (se ajusta solo)', contrast(v['--link'], card)],
  ];
  return rows.map(([l, c]) => { const s = c >= 4.5 ? ['ok', 'Cumple AA'] : c >= 3 ? ['warn', 'Solo texto grande'] : ['err', 'Insuficiente']; return { l, c, s }; });
}
const checksHTML = t => `<ul class="tm-checks">${themeChecks(t).map(r => `<li><span>${esc(r.l)}</span><b>${r.c.toFixed(1)}:1</b><span class="badge ${r.s[0]}">${r.s[1]}</span></li>`).join('')}</ul>`;

function disenoPanel() {
  const cur = DISENOS.some(d => d[0] === DB.config.diseno) ? DB.config.diseno : 'clasico';
  const mock = k => `<div class="ds-mock ds-${k}" aria-hidden="true"><i class="m-top"></i><i class="m-hero"><b></b><b></b></i><i class="m-cards"><b></b><b></b><b></b></i></div>`;
  const t = themeSafe(DB.config.temas[DB.config.tema]);
  const mk = `--mk-n:${t.navy};--mk-n2:${t.navy2};--mk-b:${t.blue};--mk-g:${t.gold};--mk-d:${mix(t.navy, '#000000', .55)};--mk-l:${mix(t.blue, '#ffffff', .88)}`;
  return `<section class="panel ds-panel ap-step"><div class="pb"><h2 class="ap-h"><span class="ap-n">1</span> Estructura de la página</h2><p class="ap-p">Cómo se organiza el sitio público: cabecera, portada y bloques. No cambia los colores ni el contenido.</p>
    <div class="ds-grid" style="${mk}">${DISENOS.map(([k, l, d]) => `<article class="ds-item${k === cur ? ' on' : ''}">${mock(k)}<div class="tm-body"><h3>${esc(l)} ${k === cur ? '<span class="badge ok">En uso</span>' : ''}</h3><p>${esc(d)}</p><div class="tm-acts">${k === cur ? '' : `<button class="btn sm" data-dis="${k}">${sic('check', 14)} Usar esta estructura</button>`}</div></div></article>`).join('')}</div></div></section>`;
}
function impColorPanel(key) {
  const t = DB.config.temas[DB.config.tema]; const cf = DCFG[key]; const c = impColors(key, t), d = cf.def(t); const label = (DISENOS.find(x => x[0] === key) || [])[1];
  return `<form class="ds-colors" data-impcol="${key}"><p>Normalmente no hace falta: la estructura «${esc(label)}» ya usa los colores del paso 2. Úselo solo si quiere colores distintos únicamente en esta estructura. «Restablecer» vuelve a los colores del paso 2.</p>
    <div class="ds-cgrid">${cf.campos.map(([k, l, h]) => `<label class="ds-c"><span><b>${esc(l)}</b><small>${esc(h)}</small></span><input type="color" name="${k}" value="${esc(c[k])}" data-def="${esc(d[k])}"><code>${esc(c[k])}</code></label>`).join('')}</div>
    <div class="ds-pre"><span>Partir de una combinación:</span>${dPresets(cf).map(([n, v], k) => `<button type="button" class="ds-pb" data-imppre="${k}" title="${esc(n)}">${Object.values(v).slice(0, 3).map(x => `<i style="background:${x}"></i>`).join('')}${esc(n)}</button>`).join('')}</div>
    <div class="ds-cprev ds-cprev-g" aria-hidden="true">${cf.campos.map(([k, l]) => `<i data-pk="${k}">${esc(l)}</i>`).join('')}</div>
    <div class="tm-acts"><button class="btn sm" type="submit">${sic('check', 14)} Guardar colores</button><button class="btn sm sec" type="button" data-impreset>Restablecer</button></div></form>`;
}
CUSTOM.temas = (parts) => {
  ensureThemes();
  const T = DB.config.temas, act = DB.config.tema;
  if (parts[2]) return temaEditor(parts[2]);
  const keys = Object.keys(T);
  const cur = DISENOS.some(d => d[0] === DB.config.diseno) ? DB.config.diseno : 'clasico', curLabel = (DISENOS.find(x => x[0] === cur) || [])[1];
  const custom = !!(DCFG[cur] && DB.config.disenoColores && Object.keys(DB.config.disenoColores[cur] || {}).length);
  const html = admHead('Apariencia del portal', 'Elija la estructura y los colores del sitio público. Los cambios se aplican a todo el portal y al panel; los visitantes no pueden cambiarlos.', '', 'palette', [['Apariencia del portal']])
    + disenoPanel()
    + `<section class="panel ap-step"><div class="pb"><h2 class="ap-h"><span class="ap-n">2</span> Colores y letras</h2><p class="ap-p">Los colores institucionales, las letras y el redondeo de las esquinas. Se aplican a cualquier estructura.</p>
    <div class="tm-active"><div>${themeMock(T[act], true)}</div><div class="tm-active-info"><span class="badge ok">${sic('check', 13)} En uso</span><h3>${esc(T[act].label)}</h3><p>${esc(T[act].desc || '')}</p><p class="tm-meta">${esc(T[act].modo === 'oscuro' ? 'Modo oscuro' : 'Modo claro')} · Títulos ${esc(T[act].fh)} · Texto ${esc(T[act].ff)} · Esquinas ${+T[act].r}px</p><div class="tm-chips">${[['navy', 'Institucional'], ['blue', 'Botones y enlaces'], ['gold', 'Destacado']].map(([c, l]) => `<span title="${esc(l)}"><i style="background:${T[act][c]}"></i>${esc(l)}</span>`).join('')}</div><p><a class="btn sec" href="#/admin/temas/${act}">${sic('edit')} Cambiar colores y letras</a></p></div></div>
    <h3 class="ap-sub">Otras combinaciones disponibles</h3>
    <div class="tm-grid">${keys.filter(k => k !== act).map(k => { const t = T[k]; return `<article class="tm-item">${themeMock(t)}<div class="tm-body"><h3>${esc(t.label)}${t.base ? '' : ' <span class="badge gray">Personalizado</span>'}</h3><p>${esc(t.desc || '')}</p><div class="tm-acts"><button class="btn sm" data-act="${k}">${sic('check', 14)} Usar</button><a class="btn sm sec" href="#/admin/temas/${k}">${sic('edit', 14)} Editar</a><button class="btn sm ghost" data-dup="${k}" title="Duplicar">${sic('copy', 14)}<span class="sr-only">Duplicar ${esc(t.label)}</span></button>${!t.base ? `<button class="btn sm ghost" data-del="${k}" title="Eliminar">${sic('trash', 14)}<span class="sr-only">Eliminar ${esc(t.label)}</span></button>` : ''}</div></div></article>`; }).join('')}</div>
    <p style="margin:12px 0 0"><a class="btn sm ghost" href="#/admin/temas/nuevo">${sic('plus', 14)} Crear una combinación nueva</a></p></div></section>`
    + (DCFG[cur] ? `<section class="panel ap-step"><details class="pb ap-adv"${custom ? ' open' : ''}><summary><span class="ap-n">3</span> Opciones avanzadas: colores solo para «${esc(curLabel)}»${custom ? ' <span class="badge warn">Personalizado</span>' : ''}</summary>${impColorPanel(cur)}</details></section>` : '');
  return {
    html, after: () => {
      const fc = $('[data-impcol]'); if (fc) {
        const CF = DCFG[fc.dataset.impcol];
        const prev = () => { CF.campos.forEach(([k]) => { const v = fc.elements[k].value; const chip = $(`[data-pk="${k}"]`, fc); if (chip) { chip.style.background = v; chip.style.color = dOn(v); } }); $$('.ds-c', fc).forEach(l => { $('code', l).textContent = $('input', l).value; }); };
        fc.addEventListener('input', prev); prev();
        $$('[data-imppre]', fc).forEach(b => b.onclick = () => { const v = dPresets(CF)[+b.dataset.imppre][1]; CF.campos.forEach(([k]) => { fc.elements[k].value = v[k]; }); prev(); });
        $('[data-impreset]', fc).onclick = () => { CF.campos.forEach(([k]) => { fc.elements[k].value = fc.elements[k].dataset.def; }); prev(); };
        fc.onsubmit = e => { e.preventDefault(); const key = fc.dataset.impcol; const out = {}; CF.campos.forEach(([k]) => { const v = fc.elements[k].value.toLowerCase(); if (v !== fc.elements[k].dataset.def.toLowerCase()) out[k] = v; });
          DB.config.disenoColores = Object.assign({}, DB.config.disenoColores || {}, { [key]: out }); audit('Cambio de colores del diseño', 'Temas y apariencia', key); if (!saveDB()) return; applyTheme(); toast('Colores de la estructura guardados.', 'ok'); route(); };
      }
      $$('[data-dis]').forEach(b => b.onclick = () => { const d = DISENOS.find(x => x[0] === b.dataset.dis); DB.config.diseno = d[0]; audit('Cambio de diseño del portal', 'Temas y apariencia', d[1]); if (!saveDB()) return; applyTheme(); toast('Estructura «' + d[1] + '» en uso en todo el portal.', 'ok'); route(); });
      $$('[data-act]').forEach(b => b.onclick = () => { const k = b.dataset.act; DB.config.tema = k; audit('Activación de tema', 'Temas y apariencia', T[k].label); if(!saveDB())return; applyTheme(); toast('Combinación «' + T[k].label + '» en uso en todo el portal.', 'ok'); route(); });
      $$('[data-dup]').forEach(b => b.onclick = () => { const src = T[b.dataset.dup]; let label = src.label + ' (copia)', n = 2; while (Object.values(T).some(t => t.label === label)) label = src.label + ' (copia ' + n++ + ')'; let k = slugify(label) || 'tema', i = 2; while (T[k] || k === 'nuevo') k = slugify(label) + '-' + i++; T[k] = Object.assign({}, src, { label, base: false }); audit('Creación', 'Temas y apariencia', label, 'Duplicado de ' + src.label); if(!saveDB())return; toast('Combinación duplicada. Ya puede editarla.', 'ok'); go('#/admin/temas/' + k); });
      $$('[data-del]').forEach(b => b.onclick = async () => { const k = b.dataset.del; if (!await confirmBox(`¿Eliminar la combinación <b>${esc(T[k].label)}</b>? Esta acción no se puede deshacer.`, { ok: 'Eliminar' })) return; const l = T[k].label; delete T[k]; audit('Eliminación', 'Temas y apariencia', l); if(!saveDB())return; toast('Combinación eliminada.', 'ok'); route(); });
    }
  };
};
function temaEditor(key) {
  const T = DB.config.temas, isNew = key === 'nuevo';
  if (!isNew && !T[key]) return { html: admHead('Combinación no encontrada', 'La combinación de colores solicitada no existe.', '<a class="btn" href="#/admin/temas">Volver a Apariencia</a>', 'palette', [['Apariencia del portal', '#/admin/temas'], ['No encontrado']]) };
  if (!ADM.work || ADM.work._tema !== key) ADM.work = Object.assign({ _tema: key }, isNew ? Object.assign({}, T[DB.config.tema], { label: '', desc: '', base: false }) : T[key]);
  const w = ADM.work, isAct = key === DB.config.tema, orig = THEME_DEFAULTS[key];
  const color = (c, l, h) => `<div class="field tm-color"><label for="tc-${c}">${l}</label><div class="tm-cin"><input type="color" id="tc-${c}" data-c="${c}" value="${esc(w[c])}" aria-label="${l}: selector"><input class="tm-hex" data-hex="${c}" value="${esc(w[c])}" maxlength="7" aria-label="${l}: código hexadecimal" spellcheck="false"></div><div class="hint">${h}</div></div>`;
  const opts = (o, v) => Object.keys(o).map(k => `<option ${k === v ? 'selected' : ''}>${k}</option>`).join('');
  const title = isNew ? 'Nueva combinación de colores' : 'Colores y letras: ' + T[key].label;
  const html = admHead(title, isAct ? 'Esta es la combinación <b>en uso</b>: al guardar, el cambio se verá de inmediato en todo el portal.' : 'Los cambios se ven en la vista previa. El portal no cambia hasta que guarde y use esta combinación.', '<a class="btn ghost" href="#/admin/temas">Cancelar</a>', 'palette', [['Apariencia del portal', '#/admin/temas'], [isNew ? 'Nuevo' : T[key].label]])
    + `<form data-tf novalidate class="edit-grid tm-edit"><div>
      <div class="panel"><h2>Identificación</h2><div class="pb"><div class="form-grid">
        <div class="field"><label for="tf-l">Nombre de la combinación *</label><input id="tf-l" name="label" value="${esc(w.label)}" maxlength="40" required></div>
        <div class="field"><label for="tf-d">Descripción</label><input id="tf-d" name="desc" value="${esc(w.desc || '')}" maxlength="80"></div>
        <fieldset class="field full tm-modo"><legend class="lbl">Modo</legend><label><input type="radio" name="modo" value="claro" ${w.modo !== 'oscuro' ? 'checked' : ''}> Claro</label><label><input type="radio" name="modo" value="oscuro" ${w.modo === 'oscuro' ? 'checked' : ''}> Oscuro</label></fieldset>
      </div></div></div>
      <div class="panel"><h2>Colores</h2><div class="pb"><div class="form-grid">
        ${color('navy', 'Color institucional', 'Cabecera, pie de página, títulos y menú lateral del panel.')}
        ${color('navy2', 'Segundo tono del color institucional', 'Degradados de la franja superior y de los banners.')}
        ${color('blue', 'Color de botones y enlaces', 'Botones, enlaces, íconos y gráficos.')}
        ${color('gold', 'Color destacado', 'Botones dorados, subrayados y detalles del logotipo.')}
      </div></div></div>
      <div class="panel"><h2>Letras y esquinas</h2><div class="pb"><div class="form-grid">
        <div class="field"><label for="tf-fh">Letra de los títulos</label><select id="tf-fh" name="fh">${opts(THEME_FONTS, w.fh)}</select></div>
        <div class="field"><label for="tf-ff">Letra del texto</label><select id="tf-ff" name="ff">${opts(BODY_FONTS, w.ff)}</select></div>
        <div class="field full"><label for="tf-r">Redondeo de esquinas: <b data-rv>${+w.r}px</b></label><input id="tf-r" type="range" name="r" min="0" max="20" step="1" value="${+w.r}"></div>
      </div></div></div>
    </div><aside class="tm-side">
      <div class="panel"><h2>Vista previa</h2><div class="pb" data-prev>${themeMock(w, true)}</div></div>
      <div class="panel"><h2>Legibilidad</h2><div class="pb" data-chk>${checksHTML(w)}<p class="hint" style="font-size:12px;color:var(--muted);margin:8px 0 0">Referencia WCAG 2.1: 4.5:1 para texto normal.</p></div></div>
      <div class="panel"><div class="pb tm-save">
        <button class="btn" data-save="0">${sic('check')} Guardar</button>
        ${isAct ? '' : `<button class="btn gold" data-save="1">${sic('palette')} Guardar y usar en el portal</button>`}
        ${orig ? `<button type="button" class="btn ghost" data-reset>${sic('restore')} Restaurar valores originales</button>` : ''}
      </div></div>
    </aside></form>`;
  return {
    html, after: () => {
      const f = $('[data-tf]');
      const refresh = () => { $('[data-prev]').innerHTML = themeMock(w, true); $('[data-chk]').firstElementChild.outerHTML = checksHTML(w); $('[data-rv]').textContent = (+w.r) + 'px'; };
      f.oninput = e => {
        const el = e.target;
        if (el.dataset.c) { w[el.dataset.c] = el.value; $(`[data-hex="${el.dataset.c}"]`).value = el.value; }
        else if (el.dataset.hex) { let v = el.value.trim(); if (v && v[0] !== '#') v = '#' + v; const ok = validHex(v); el.closest('.field').classList.toggle('invalid', !ok); if (!ok) return; w[el.dataset.hex] = v.toLowerCase(); $(`[data-c="${el.dataset.hex}"]`).value = v.toLowerCase(); }
        else if (el.name) w[el.name] = el.name === 'r' ? +el.value : el.value;
        refresh();
      };
      f.onchange = f.oninput;
      const r = $('[data-reset]'); if (r) r.onclick = async () => { if (!await confirmBox('¿Restaurar los colores, letras y bordes originales de este tema?', { ok: 'Restaurar', danger: false })) return; Object.assign(w, JSON.parse(JSON.stringify(orig)), { _tema: key }); route(); };
      f.onsubmit = e => e.preventDefault();
      $$('[data-save]').forEach(b => b.onclick = async () => {
        $$('.field.invalid', f).forEach(x => x.classList.remove('invalid')); $$('.errmsg', f).forEach(x => x.remove());
        const label = (w.label || '').trim(); let err = '';
        if (!label) err = 'Ingrese el nombre de la combinación.';
        else if (Object.entries(T).some(([k, t]) => k !== key && t.label.toLowerCase() === label.toLowerCase())) err = 'Ya existe una combinación con ese nombre.';
        if (err) { const fl = $('#tf-l').closest('.field'); fl.classList.add('invalid'); fl.insertAdjacentHTML('beforeend', `<div class="errmsg">${err}</div>`); $('#tf-l').focus(); return; }
        if (['navy', 'navy2', 'blue', 'gold'].some(c => !validHex(w[c]))) { toast('Revise los códigos de color: deben tener el formato #RRGGBB.', 'err'); return; }
        if (themeChecks(w).some(x => x.c < 3) && !await confirmBox('Algunas combinaciones de color tienen contraste insuficiente y pueden ser difíciles de leer. ¿Guardar de todos modos?', { ok: 'Guardar igual', danger: false })) return;
        let k = key; if (isNew) { k = slugify(label) || 'tema'; let i = 2; while (T[k] || k === 'nuevo') k = slugify(label) + '-' + i++; }
        const prev = T[k] ? T[k].label : null; const data = Object.assign({}, w); delete data._tema; data.label = label; data.desc = (w.desc || '').trim(); data.base = !!(T[k] && T[k].base);
        T[k] = data; audit(isNew ? 'Creación' : 'Modificación', 'Temas y apariencia', label, prev && prev !== label ? 'Antes: ' + prev : '');
        const activate = b.dataset.save === '1';
        if (activate) { DB.config.tema = k; audit('Activación de tema', 'Temas y apariencia', label); }
        if(!saveDB())return;
        if (k === DB.config.tema) applyTheme();
        ADM.work = null; toast(activate ? 'Combinación guardada y en uso en todo el portal.' : k === DB.config.tema ? 'Combinación guardada. El portal ya muestra los cambios.' : 'Combinación guardada.', 'ok'); go('#/admin/temas');
      });
    }
  };
}

function renderAdmin(parts, q) {
  if (currentUser() && sessionExpired()) { audit('Cierre de sesión por inactividad', 'Sesión', currentUser().usuario); saveDB(); setSession(null); setTimeout(() => toast(`Su sesión se cerró tras ${SESSION_IDLE_MIN} minutos de inactividad. Ingrese nuevamente.`, 'warn'), 50); }
  const u = currentUser(); if (u) touchSession();
  if (!u || u.estado !== 'Activo') { setSession(null); return { html: loginView(), after: bindLogin, title: 'Iniciar sesión' }; }
  const key = parts[1] || 'dashboard'; const spec = SPECS[key]; const custom = CUSTOM[key];
  if (!spec && !custom) return { html: admShell('', admHead('Página no encontrada', 'El módulo solicitado no existe.', '<a class="btn" href="#/admin">Ir al inicio</a>', 'alert')), after: bindAdmChrome };
  const mod = spec ? spec.mod : (MOD_OF[key] || key);
  if (!can(mod)) { audit('Acceso denegado', MODULES[mod] || key, '#/admin/' + parts.slice(1).join('/')); saveDB(); return { html: admShell('', admHead('Acceso denegado', `Su rol (<b>${esc(role().label)}</b>) no tiene permiso para este módulo. El intento quedó registrado en la auditoría.`, '<a class="btn" href="#/admin">Volver al inicio</a>', 'lock')), after: bindAdmChrome }; }
  let out;
  try { out = spec ? (parts[2] ? crudForm(spec, parts[2]) : crudList(spec)) : custom(parts, q); }
  catch (e) { console.error(e); out = { html: admHead('Ocurrió un error', esc(e.message), '<a class="btn" href="#/admin">Volver al inicio</a>', 'alert') }; }
  return { html: admShell(mod, out.html), after: () => { bindAdmChrome(); out.after && out.after(); }, title: (spec ? spec.title : MODULES[mod] || 'Panel') + ' · Panel' };
}

/* ==== academico-host.js ==== */
/* =========================================================
   MÓDULOS ACADÉMICOS DENTRO DEL PORTAL
   Un solo login (usuarios del portal), una sola base de datos
   (DB.academico), una sola auditoría y un solo panel.
   ========================================================= */
let IX = null;
const IX_ROLE = { admin: 'admin', directivo: 'dir', secretaria: 'acad', coordinador: 'acad', atencion: 'adm', docente: 'doc', estudiante: 'est', egresado: 'egr', empresa: 'emp' };
const IX_MODS = ['alumnos', 'horarios', 'certificados', 'titulos', 'bolsa', 'config'];
const isCommunity = () => !!role().community;
function ixStyle() { const h = v => /^#[0-9a-f]{6}$/i.test(v || ''); const b = h(TC.blue) ? TC.blue : '#1556b8', g = h(TC.gold) ? TC.gold : '#f2b705', n = h(TC.navy) ? TC.navy : '#0a2a5e'; const lum = parseInt(b.slice(1, 3), 16) * .299 + parseInt(b.slice(3, 5), 16) * .587 + parseInt(b.slice(5, 7), 16) * .114; return `--c-brand:${b};--c-brand-ink:${lum > 150 ? '#111' : '#fff'};--c-acc:${g};--c-side:${n}`; }
function ixWrap(inner) { const l = document.getElementById('ix-layer'); if (l) l.setAttribute('style', ixStyle()); return `<div class="ix ix-page" id="ix-root" data-palette="web" style="${ixStyle()}">${inner}</div>`; }
const businessDaysLeft = (fromISO, days) => { const d = new Date(String(fromISO).slice(0, 10) + 'T12:00:00'); let k = 0; while (k < days) { d.setDate(d.getDate() + 1); if (![0, 6].includes(d.getDay())) k++; } const t = new Date(); t.setHours(12, 0, 0, 0); let n = 0; const s = t <= d ? 1 : -1; const c = new Date(t); while (c.toDateString() !== d.toDateString()) { c.setDate(c.getDate() + s); if (![0, 6].includes(c.getDay())) n += s; } return { due: d, left: n }; };
const IXHOST = {
  loadAcad: () => DB.academico || null,
  inst: () => (DB.config && DB.config.inst) || {},
  saveAcad: a => { DB.academico = a; return saveDB(); },
  openBackups: () => {location.href='/respaldos.php';},
  toast: m => toast(m),
  audit: (a, m, d) => audit(a, m, d),
  head: (title, desc, actions, code) => { const t = String(title).replace(/<[^>]+>/g, ''), c = code || ''; const grp = /administrativa/.test(c) ? 'Servicios' : /Configuraci/.test(c) ? 'Configuración y seguridad' : 'Gestión académica'; const icon = { 'Programación de horarios': 'calendar', 'Maestro de alumnos': 'users', 'Constancias y certificados': 'award', 'Grados y títulos': 'grad', 'Bolsa laboral': 'briefcase', 'Configuración académica': 'gear', 'Configuración académica general':'gear', 'Certificación modular':'award' }[t] || 'grad'; return admHead(t, desc || '', actions || '', icon, [[grp], [t]]); },
  user: () => { const u = currentUser(); const r = u && IX_ROLE[u.rol]; return r ? { id: u.ixId || u.id, u: u.usuario, nom: u.nombre, rol: r, estado: u.estado, dni: u.dni || '', area: u.area || '', vin: u.vin || '', ult: u.ultimoAcceso || '' } : null; },
  users: () => coll('usuarios').filter(u => IX_ROLE[u.rol]).map(u => ({ id: u.ixId || u.id, u: u.usuario, nom: u.nombre, rol: IX_ROLE[u.rol], estado: u.estado, dni: u.dni || '', area: u.area || '', vin: u.vin || '', ult: u.ultimoAcceso || '' })),
  createStudentAccount: e => {
    const usuario = String(e.dni || '').trim().toLowerCase(); if (!usuario) return { error: 'El alumno no tiene DNI.' };
    const ex = coll('usuarios').find(x => x.usuario === usuario || x.vin === 'est:' + e.id); if (ex) return { error: 'El alumno ya tiene la cuenta «' + ex.usuario + '».' };
    const rol = ['Egresado', 'Titulado'].includes(e.estado) ? 'egresado' : 'estudiante';
    const pass = 'Demo' + String(Math.floor(1000 + Math.random() * 9000)) + ['*', '#', '$'][Math.floor(Math.random() * 3)] + 'a';
    coll('usuarios').push(stamp({ id: uid(), usuario, nombre: e.nom, rol, passHash: hashPass(usuario, pass), estado: 'Activo', intentos: 0, bloqueadoHasta: 0, ultimoAcceso: '', ixId: Math.max(100, ...coll('usuarios').map(u => +u.ixId || 0)) + 1, vin: 'est:' + e.id, dni: e.dni, correo: e.correo || '' }));
    audit('Creación de cuenta', 'Usuarios', usuario, 'Desde el Maestro de alumnos'); saveDB();
    return { usuario, pass, rolLabel: ROLES[rol].label };
  },
  addUser: u => { const usuario = String(u.u).toLowerCase(); if (coll('usuarios').some(x => x.usuario === usuario)) return; coll('usuarios').push({ id: uid(), usuario, nombre: u.nom, rol: 'empresa', passHash: hashPass(usuario, u.pass), estado: 'Activo', intentos: 0, bloqueadoHasta: 0, ultimoAcceso: '', ixId: u.id, vin: u.vin, dni: u.dni || '' }); audit('Registro de cuenta', 'Usuarios', usuario, 'Empresa registrada desde la bolsa laboral'); saveDB(); },
  exps: () => coll('expedientes').map(x => ({ id: x.id, num: x.numero, dni: x.numDoc, estado: x.estado, fecha: String(x.fecha || '').slice(0, 10), tramN: x.tipoTramite, area: x.area || '' })),
  go: v => go(['mesa','reclamos','mensajes'].includes(v)?({'mesa':'#/admin/expedientes','reclamos':'#/admin/reclamos','mensajes':'#/admin/mensajes'}[v]):v === 'login' ? '#/admin' : !currentUser() ? '#/admin' : v === 'inicio' ? '#/admin' : '#/admin/ix-' + v),
  logout: () => { audit('Cierre de sesión', 'Sesión', (currentUser() || {}).usuario || ''); saveDB(); setSession(null); go('#/admin'); },
  verifyUrl: cod => location.href.split('#')[0] + '#/servicios/consulta-certificados?codigo=' + encodeURIComponent(cod),
  registerDoc: d => { if (coll('certificados').some(c => c.codigo === d.cod)) return; coll('certificados').unshift(stamp({ id: uid(), codigo: d.cod, dni: d.dni, nombres: d.nombres, programaId: d.prog || '', tipo: d.tipo, fecha: String(d.fecha).slice(0, 10), estado: 'Válido', origen: 'Módulos académicos' }, true)); },
  inst: () => { const i = inst(); const dj = alive('jerarquica').find(j => j.esDirector && j.estado === 'Publicado'); const dp = dj && byId('personas', dj.personaId); /* Misma regla que PortalRules: director publicado; si no hay, se conserva el actual. */ return { nombre: i.nombre, siglas: i.nombreCorto, direccion: i.direccion, web: location.host, director: dp && !dp.deleted ? fullName(dp) : (DB.academico?.cfg?.director || '') }; },
  programas: () => sortO(alive('programas')).map(p => ({ pid: p.id, nombre: p.nombre, activo: p.estado === 'Publicado' })),
  docentes: () => alive('personas').filter(p => p.tipo === 'Docente').map(p => ({ id: p.id, nom: `${p.nombres} ${p.apellidos}`, dni: p.dni, correo: p.correo, esp: p.especialidad, cond: p.condicion })).sort((a, b) => a.nom.localeCompare(b.nom)),
};
function ixAdminPage(view) {
  return () => ({ html: ixWrap(IX.view(view)), after: () => { } });
}
IX_MODS.forEach(m => { CUSTOM['ix-' + m] = ixAdminPage(m); });
/* Inicio: el personal ve el tablero del portal con el resumen académico; la comunidad educativa, su panel */
const baseDashboard = CUSTOM.dashboard;
CUSTOM.dashboard = (parts, q) => {
  if (isCommunity()) return { html: ixWrap(IX.view('inicio')), after: () => { } };
  const out = baseDashboard(parts, q);
  const mine = IX_MODS.filter(m => can('ix-' + m) && m !== 'config');
  if (!mine.length) return out;
  const s = IX.stats();
  const items = [];
  if (can('ix-horarios')) items.push(kpi('calendar', 'var(--blue)', s.ses, 'Sesiones programadas ' + esc(s.periodo), '#/admin/ix-horarios'), kpi('alert', s.err ? 'var(--err)' : 'var(--ok)', s.err, 'Cruces de horario por resolver', '#/admin/ix-horarios'));
  if (can('ix-certificados')) items.push(kpi('users', '#6d4bc4', s.est, 'Estudiantes regulares', '#/admin/ix-certificados'), kpi('award', 'var(--ok)', s.certs, 'Certificaciones modulares', '#/admin/ix-certificados'));
  if (can('ix-titulos')) items.push(kpi('grad', 'var(--navy)', s.tit, 'Titulados registrados', '#/admin/ix-titulos'));
  if (can('ix-bolsa')) items.push(kpi('briefcase', 'var(--warn)', s.ofertas, 'Ofertas laborales vigentes', '#/admin/ix-bolsa'), kpi('check', s.porValidar ? 'var(--err)' : 'var(--ok)', s.porValidar, 'Empresas u ofertas por validar', '#/admin/ix-bolsa'));
  return Object.assign({}, out, { html: out.html + `<div class="panel" style="margin-top:18px"><h2>Gestión académica · periodo ${esc(s.periodo)}</h2><div class="pb"><div class="kpis">${items.join('')}</div></div></div>` });
};
/* Mesa de partes: plazos con semáforo, derivación por áreas y cargo de recepción (lo mejor del módulo académico) */
const EXP_PLAZOS = { 'Solicitud general': 10, 'Certificado de estudios': 7, 'Constancia de estudios / egresado': 3, 'Convalidación': 15, 'Traslado': 10, 'Reserva de matrícula': 5, 'Titulación': 20, 'Otros': 10 };
const expPlazo = x => window.pzPlazo ? window.pzPlazo(x) : businessDaysLeft(x.fecha, EXP_PLAZOS[x.tipoTramite] || 10);
const expSem = x => { if (['Atendido', 'Archivado'].includes(x.estado)) return '<span class="badge gray">Cerrado</span>'; const p = expPlazo(x); return p.left < 0 ? `<span class="badge err">Vencido (${-p.left} d)</span>` : p.left <= 2 ? `<span class="badge warn">${p.left} d hábiles</span>` : `<span class="badge ok">${p.left} d hábiles</span>`; };
const areaName = cod => ((IX ? IX.areas() : []).find(a => a[0] === cod) || [cod, cod || '—'])[1];


/* Cargo de recepción en PDF: el del módulo académico, mejorado (sello, QR de seguimiento, plazo, huella del archivo e historial) */
const sha256Of = async dataUrl => { try { if (!dataUrl || !(window.crypto && crypto.subtle)) return ''; const buf = await dataURItoBlob(dataUrl).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; } };
const expEfectiva = iso => { if (window.pzEfectiva) return window.pzEfectiva(iso); const d = new Date(iso); const late = d.getHours() >= 17, wk = [0, 6].includes(d.getDay()); if (!late && !wk) return null; const n = new Date(d); n.setHours(8, 0, 0, 0); do { n.setDate(n.getDate() + 1); } while ([0, 6].includes(n.getDay())); return n; };
const expSeguimientoUrl = x => location.href.split('#')[0] + '#/servicios/mesa-de-partes?exp=' + encodeURIComponent(x.numero) + (x.cargoCod ? '&c=' + encodeURIComponent(x.cargoCod) : '');
function expCargoCod(x) { if (!x.cargoCod && IX) { x.cargoCod = IX.cargoCode(x.id, x.nombres); } return x.cargoCod || ''; }
async function cargoExp(id) {
  const x = coll('expedientes').find(r => r.id === id); if (!x) return toast('Expediente no encontrado.', 'err');
  expCargoCod(x); if (x.archivo && x.archivo.data && !x.archivo.sha256) x.archivo.sha256 = await sha256Of(x.archivo.data);
  const p = expPlazo(x), ef = expEfectiva(x.fecha), staff = !!currentUser() && !isCommunity();
  const o = {
    num: x.numero, cod: x.cargoCod || '—', fechaTxt: fdate(x.fecha, true), fechaCorta: fshort(x.fecha, true), sol: x.nombres,
    docTxt: x.tipoDoc + ' ' + (staff && !canFlag('viewDni') ? maskDni(x.numDoc) : x.numDoc), correo: x.correo, tel: x.telefono || '—',
    tramite: x.tipoTramite, folios: String(x.folios || '—'), area: x.area ? areaName(x.area) : 'Mesa de partes', estado: x.estado,
    plazoDias: EXP_PLAZOS[x.tipoTramite] || 10, vence: fdate(p.due), efectivaTxt: ef ? fdate(ef, true) + ' (fuera de horario)' : fdate(x.fecha, true),
    asunto: x.asunto, archivo: x.archivo ? { n: x.archivo.original || x.archivo.nombre, s: fsize(x.archivo.size), sha: x.archivo.sha256 || '' } : { n: 'Sin archivo adjunto', s: '—', sha: '' },
    hist: (x.historial || []).map(h => [fshort(h.fecha, true), h.estado, h.nota || '']), url: expSeguimientoUrl(x), inst: inst()
  };
  let blob = IX && IX.cargoPdf(o);
  if (!blob) blob = makePdf('Cargo de recepcion ' + o.num, ['Expediente: ' + o.num, 'Codigo de verificacion: ' + o.cod, 'Fecha y hora de registro: ' + o.fechaTxt, 'Recepcion efectiva: ' + o.efectivaTxt, 'Remitente: ' + o.sol, 'Documento: ' + o.docTxt, 'Correo: ' + o.correo, 'Telefono: ' + o.tel, 'Tramite: ' + o.tramite, 'Folios: ' + o.folios, 'Area responsable: ' + o.area, 'Estado: ' + o.estado, 'Plazo de atencion: ' + o.plazoDias + ' dias habiles (vence ' + o.vence + ')', 'Asunto: ' + o.asunto, 'Archivo: ' + o.archivo.n + ' (' + o.archivo.s + ')', '', 'Consulte el estado en: ' + o.url], o.inst.nombre);
  downloadBlob(blob, 'cargo_' + x.numero + '.pdf'); audit('Descarga de cargo', 'Mesa de partes', x.numero); saveDB();
  toast('Cargo de recepción descargado.', 'ok');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-cargo-exp]'); if (b) { e.preventDefault(); cargoExp(b.dataset.cargoExp); } });
const cargoBtn = (x, cls = 'btn') => `<button type="button" class="${cls}" data-cargo-exp="${esc(x.id)}">${sic('download')} Descargar cargo (PDF)</button>`;

/* ==== app.js ==== */
/* =========================================================
   APLICACIÓN – enrutador por hash e inicio
   ========================================================= */
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function matchRoute(parts) {
  const key = parts.join('/');
  if (ROUTES[key]) return [ROUTES[key], {}];
  for (const pat in ROUTES) {
    const pp = pat.split('/'); if (pp.length !== parts.length) continue;
    const prm = {}; if (pp.every((s, i) => s.startsWith(':') ? (prm[s.slice(1)] = decodeURIComponent(parts[i]), true) : s === parts[i])) return [ROUTES[pat], prm];
  }
  return [null, {}];
}
function renderPublicPath(parts, q) {
  const [fn, prm] = matchRoute(parts);
  return fn ? fn(parts, q, prm) : notFound(parts);
}
function countVisit() {
  if (PREVIEW) return; DB.visitas = DB.visitas || {}; const d = new Date().toISOString().slice(0, 10);
  DB.visitas[d] = (DB.visitas[d] || 0) + 1;
}
let LAST_PATH = null, LAST_PAGE = null;
function route() {
  clearInterval(window.__sl);
  if (window.__publicReveal) { window.__publicReveal.disconnect(); window.__publicReveal = null; }
  const raw = location.hash.replace(/^#\/?/, ''); const [p, qs] = raw.split('?');
  const parts = (p || '').split('/').filter(Boolean); const q = new URLSearchParams(qs || '');
  const app = document.getElementById('app'); const samePath = LAST_PATH === p; LAST_PATH = p; const pageChanged = samePath && LAST_PAGE !== q.get('page'); LAST_PAGE = q.get('page');
  if (!samePath) { ADM.work = null; $$('.modal-bg').forEach(m => m.remove()); if (IX) IX.close(); }
  $$('.chart-tip').forEach(t => t.style.display = 'none');
  let out;
  if (parts[0] === 'admin') { out = renderAdmin(parts, q); document.body.classList.add('is-admin'); if (out.title) document.title = out.title + ' | ' + inst().nombreCorto; }
  else {
    document.body.classList.remove('is-admin');
    try { out = renderPublicPath(parts, q); } catch (e) { console.error(e); out = notFound(parts); }
    if (!samePath) { countVisit(); saveDB(); }
  }
  if (typeof out === 'string') out = { html: out };
  app.innerHTML = out.html;
  if (parts[0] !== 'admin') bindPublicChrome();
  if (out.after) try { out.after(); } catch (e) { console.error(e); }
  if (!samePath) { window.scrollTo(0, 0); const h = $('h1', app); if (h && document.activeElement === document.body) h.setAttribute('tabindex', '-1'); }
  else if (pageChanged) { const top = $('h1', app) || app; top.scrollIntoView({ block: 'start' }); }
  if (!parts.length) maybePopup();
}
function seedVisits() {
  DB.visitas = DB.visitas || {};
  for (let i = 180; i >= 1; i--) { const dt = new Date(Date.now() - i * 86400000); const d = dt.toISOString().slice(0, 10); if (DB.visitas[d] != null) continue; const wk = [0, 6].includes(dt.getDay()); DB.visitas[d] = Math.max(40, Math.round((wk ? 150 : 330) * (1 + (180 - i) / 600) + 80 * Math.sin(i * 1.7) + (i * 37 % 70))); }
}
function init() {
  loadDB(); seedVisits(); saveDB(); applyTheme();
  IX = IX_FACTORY(IXHOST); IX.init();
  window.addEventListener('hashchange', route);
  let lastTouch = 0; ['click', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (SESSION && Date.now() - lastTouch > 15000) { lastTouch = Date.now(); if (sessionExpired()) route(); else touchSession(); } }, true));
  if (!location.hash) history.replaceState(null, '', '#/');
  if (typeof window.pzEnsure === 'function') try { pzEnsure(); } catch (e) { console.error(e); }
  route();
}
document.addEventListener('DOMContentLoaded', init);
