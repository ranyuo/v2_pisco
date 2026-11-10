/* ==== pisco.js ==== Portal Web IESTP PISCO 2026 */
var PISCO_LOGO = "/assets/pisco/bcca0278a38e622e7fed.png";
(function () {
'use strict';
/* =========================================================
   0. NÚCLEO ICA: configuración, feriados, horario, archivos grandes, PDF
   ========================================================= */
const MPV_TIPOS = ['Solicitud', 'Oficio', 'Carta', 'Informe', 'Memorando', 'Recurso administrativo', 'Reclamo', 'Queja', 'Denuncia', 'Declaración jurada', 'FUT (Formulario Único de Trámite)', 'Expediente administrativo', 'Otros'];
const MPV_PLAZOS = { 'Solicitud': 10, 'Oficio': 7, 'Carta': 7, 'Informe': 7, 'Memorando': 5, 'Recurso administrativo': 30, 'Reclamo': 15, 'Queja': 3, 'Denuncia': 30, 'Declaración jurada': 5, 'FUT (Formulario Único de Trámite)': 10, 'Expediente administrativo': 30, 'Otros': 10 };
const MPV_FORMATOS = [['pdf', 'PDF'], ['doc', 'DOC'], ['docx', 'DOCX'], ['xls', 'XLS'], ['xlsx', 'XLSX'], ['jpg', 'JPG'], ['jpeg', 'JPEG'], ['png', 'PNG']];
const MIME_OK = { pdf: ['application/pdf'], doc: ['application/msword'], docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], xls: ['application/vnd.ms-excel'], xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'] };
/* Feriados nacionales del Perú (fijos + Jueves y Viernes Santo) para cualquier año; los de la institución o región se agregan en la configuración. */
const feriadosPeru = y => { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  const p = n => String(n).padStart(2, '0'), easter = new Date(Date.UTC(y, mo - 1, da)), off = n => { const x = new Date(easter); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  return ['01-01', '05-01', '06-07', '06-29', '07-23', '07-28', '07-29', '08-06', '08-30', '10-08', '11-01', '12-08', '12-09', '12-25'].map(x => y + '-' + x).concat([off(-3), off(-2)]).sort(); };
const LR_DEF = { responsable: 'Responsable de Administración', cargo: 'Jefa de Área de Administración', correo: '', plazoReclamo: 15, plazoQueja: 15, alerta: 3, areaInicial: 'ADM',
  flujo: 'El reclamo o queja se registra en el Libro de Reclamaciones Virtual y se notifica al responsable institucional. El responsable lo deriva al área competente, que lo atiende y propone la respuesta. El responsable remite la respuesta al usuario por correo electrónico dentro del plazo. Todo el recorrido queda en el historial.' };
const BOLSA_DEF = { responsable: 'Unidad de Bienestar y Empleabilidad', jefe: 'Jefe(a) de la Unidad de Bienestar y Empleabilidad', correo: '',
  criterios: ['RUC de 11 dígitos válido (dígito verificador), en estado ACTIVO y condición HABIDO en SUNAT.', 'Razón social, sector económico y dirección fiscal coincidentes con la ficha RUC.', 'Persona de contacto con cargo y correo corporativo o institucional verificable.', 'Actividad económica lícita y vinculada a los programas de estudio del instituto.', 'Las convocatorias deben indicar puesto, requisitos, modalidad y fecha límite; no se aceptan cobros a postulantes.', 'Plazo de evaluación: hasta 3 días hábiles desde el registro.'] };

function pzEnsure() {
  if (!DB || !DB.config) return;
  const c = DB.config; c.contadores = c.contadores || {};
  ['LR', 'EXP', 'MPV', 'DOC', 'RCL'].forEach(k => { c.contadores[k] = c.contadores[k] || {}; });
  c.mpv = Object.assign({ horaIni: '08:00', horaFin: '15:40', dias: 'Lunes a viernes', maxMB: 40, maxArchivos: 5, tipos: MPV_TIPOS.slice(), formatos: MPV_FORMATOS.map(f => f[0]), feriados: [], plazos: Object.assign({}, MPV_PLAZOS), correo: 'iestp@iestppisco.edu.pe', telefono: '056 632122', prefijo: 'MPV-IESTP-PISCO' }, c.mpv || {});
  c.lr = Object.assign({}, LR_DEF, c.lr || {});
  c.bolsa = Object.assign({}, BOLSA_DEF, c.bolsa || {});
  Object.assign(EXP_PLAZOS, c.mpv.plazos);
  if (!EXP_STATES.includes('Derivado')) EXP_STATES.splice(1, 0, 'Derivado');
  if (!LR_STATES.includes('Derivado')) LR_STATES.splice(1, 0, 'Derivado');
  /* Compatibilidad de enlaces de instalaciones anteriores; el contenido institucional se importa por separado. */
  if (!c.enlacesV2 && Array.isArray(DB.enlaces)) { const E = id => DB.enlaces.find(x => x.id === id);
    const set = (id, url) => { const e = E(id); if (e && e.url && /ica\.bibliotecalatina|www\.dreica\.gob\.pe\/?$/.test(e.url)) Object.assign(e, { url, estado: 'Activo', verificado: '2026-10-23' }); };
    set('biblioteca', ''); set('aula', ''); set('dre', 'https://dreica.gob.pe/ica'); c.enlacesV2 = true; }
}
window.pzEnsure = pzEnsure;
const mpvCfg = () => { pzEnsure(); return DB.config.mpv; };
/* Una sola lista de trámites: los del catálogo "Tipos de trámite" (con su plazo) y luego los tipos de documento configurados, sin repetir. */
const mpvCatalogo = () => (IX && IX.tramitesFull ? IX.tramitesFull() : []).filter(t => t && t.nombre);
const mpvTipos = () => { const cat = mpvCatalogo().map(t => t.nombre); return [...cat, ...mpvCfg().tipos.filter(t => !cat.includes(t))]; };
const mpvPlazo = t => (mpvCfg().plazos || {})[t] || +(mpvCatalogo().find(x => x.nombre === t) || {}).dias || EXP_PLAZOS[t] || 10;
const lrCfg = () => { pzEnsure(); return DB.config.lr; };
window.pzBolsaCfg = () => { pzEnsure(); return DB.config.bolsa; };
window.pzMail = (para, asunto, cuerpo) => { if (para) mailOut(para, asunto, cuerpo); saveDB(); };

/* ---------- Fechas hábiles, horario de atención y plazos ---------- */
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const fmt12 = s => { const [h, m] = String(s).split(':').map(Number); const ap = h >= 12 ? 'p.m.' : 'a.m.'; const hh = h % 12 || 12; return `${pad(hh)}:${pad(m || 0)} ${ap}`; };
const isHabil = d => ![0, 6].includes(d.getDay()) && !(mpvCfg().feriados || []).includes(ymd(d)) && !feriadosPeru(d.getFullYear()).includes(ymd(d));
const horarioTxt = () => { const c = mpvCfg(); return `${c.dias} de ${fmt12(c.horaIni)} a ${fmt12(c.horaFin)}`; };
/* Regla institucional: dentro del horario se recibe en el acto; antes de la hora de inicio, ese mismo día a la hora de inicio;
   después del cierre, en sábado, domingo o feriado, el siguiente día hábil a la hora de inicio. */
function recepcionDe(iso) {
  const c = mpvCfg(); const d = new Date(iso); const m = d.getHours() * 60 + d.getMinutes(); const ini = hm(c.horaIni), fin = hm(c.horaFin);
  const at = x => { const n = new Date(x); n.setHours(Math.floor(ini / 60), ini % 60, 0, 0); return n; };
  if (isHabil(d) && m >= ini && m <= fin) return { fecha: d, enHorario: true };
  if (isHabil(d) && m < ini) return { fecha: at(d), enHorario: false };
  const n = new Date(d); do { n.setDate(n.getDate() + 1); } while (!isHabil(n));
  return { fecha: at(n), enHorario: false };
}
function diasHabiles(fromISO, days) {
  const d = new Date(fromISO); d.setHours(12, 0, 0, 0); let k = 0;
  while (k < days) { d.setDate(d.getDate() + 1); if (isHabil(d)) k++; }
  const t = new Date(); t.setHours(12, 0, 0, 0); let n = 0; const s = t <= d ? 1 : -1; const c = new Date(t);
  while (ymd(c) !== ymd(d)) { c.setDate(c.getDate() + s); if (isHabil(c)) n += s; }
  return { due: d, left: n };
}
window.pzEfectiva = iso => { const r = recepcionDe(iso); return r.enHorario ? null : r.fecha; };
window.pzPlazo = x => diasHabiles(x.fechaRecepcion || x.fecha, mpvPlazo(x.tipoTramite));
const lrPlazoDias = r => r.plazoDias || (r.tipo === 'Queja' ? lrCfg().plazoQueja : lrCfg().plazoReclamo);
const lrPlazo = r => diasHabiles(r.fecha, lrPlazoDias(r));
const lrSem = r => { if (r.anulado || r.estado === 'Atendido') return '<span class="badge gray">Cerrado</span>'; const p = lrPlazo(r); return p.left < 0 ? `<span class="badge err">Vencido (${-p.left} d)</span>` : p.left <= lrCfg().alerta ? `<span class="badge warn">${p.left} d hábiles</span>` : `<span class="badge ok">${p.left} d hábiles</span>`; };

/* ---------- Áreas receptoras (catálogo único del módulo académico) ---------- */
const areasAll = () => (IX && IX.areasFull ? IX.areasFull() : []);
const areaOf = cod => areasAll().find(a => a.cod === cod) || null;
const NIVELES = ['Mesa de Partes', 'Dirección', 'Órganos y comités', 'Áreas', 'Unidades', 'Coordinaciones de programas de estudio'];
/* Niveles en uso: los conocidos primero y luego cualquier otro registrado (p. ej. "Oficina"), para que ningún área quede fuera de las listas. */
const nivelesDe = as => [...NIVELES, ...[...new Set(as.map(a => a.nivel || 'Áreas'))].filter(n => !NIVELES.includes(n))];
function areaOptions(sel, { skipMP = false, placeholder = 'Seleccione el área de destino' } = {}) {
  const as = areasAll().filter(a => a.activo && !(skipMP && a.cod === 'MP'));
  return `<option value="">${esc(placeholder)}</option>` + nivelesDe(as).map(n => { const g = as.filter(a => (a.nivel || 'Áreas') === n); return g.length ? `<optgroup label="${esc(n)}">${g.map(a => `<option value="${esc(a.cod)}" ${a.cod === sel ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}</optgroup>` : ''; }).join('');
}

/* ---------- Archivos compartidos en el servidor ---------- */
async function sha256File(file) { try { if (!(window.crypto && crypto.subtle)) return ''; const buf = await file.arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; } }
async function storeFile(file, prefix) { return portalUpload(file); }
async function fileBlob(meta) {
  if (!meta) return null;
  if (meta.fileId) { const response=await fetch(meta.url); if(!response.ok)throw new Error('No tienes acceso a ese archivo.');return response.blob(); }
  if (meta.data) return dataURItoBlob(meta.data);
  if (meta.lineas || meta.titulo) return docBlob(meta);
  return null;
}
async function downloadMeta(meta) { try { const b = await fileBlob(meta); if (!b) return toast('El archivo adjunto no está disponible. Solicita que vuelva a adjuntarse al registro.', 'err'); downloadBlob(b, meta.original || meta.nombre); } catch(error) { toast(error.message || 'No se pudo descargar el archivo. Revisa tu sesión y tus permisos.', 'err'); } }
function checkUpload(file, exts, maxMB) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!exts.includes(ext)) return `“${file.name}”: formato .${ext} no permitido. Formatos: ${exts.map(e => e.toUpperCase()).join(', ')}.`;
  if (file.type && MIME_OK[ext] && !MIME_OK[ext].includes(file.type) && file.type !== 'application/octet-stream') return `“${file.name}”: el tipo de archivo (${file.type}) no coincide con su extensión.`;
  if (file.size > maxMB * 1048576) return `“${file.name}” pesa ${fsize(file.size)}; el máximo por archivo es ${maxMB} MB.`;
  if (!file.size) return `“${file.name}” está vacío.`;
  return '';
}

/* ---------- Imágenes para PDF (logo y fotografías rasterizadas) ---------- */
const RASTER = {};
function raster(src, w, h, { bg = '#ffffff', type = 'image/jpeg', fit = 'cover' } = {}) {
  const k = src + '|' + w + 'x' + h + type + fit; if (RASTER[k]) return Promise.resolve(RASTER[k]);
  return new Promise(ok => {
    const im = new Image(); im.onload = () => { try { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h); const iw = im.naturalWidth || w, ih = im.naturalHeight || h; const s = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih); const dw = iw * s, dh = ih * s; g.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh); RASTER[k] = c.toDataURL(type, .9); ok(RASTER[k]); } catch (e) { ok(null); } };
    im.onerror = () => ok(null); if (/^https?:/.test(src)) im.crossOrigin = 'anonymous'; im.src = src;
  });
}
const logoPng = () => raster(logoSrc(), 240, 310, { type: 'image/png', fit: 'contain' });
const hasPdf = () => !!(window.jspdf && window.jspdf.jsPDF);
const NAVY = [11, 29, 63], BLUE = [10, 127, 194], GOLD = [245, 196, 0], ORANGE = [234, 112, 64], LIGHT = [234, 244, 251];
function pdfQRp(doc, text, x, y, size) {
  if (!window.qrcode) { doc.setDrawColor(150); doc.rect(x, y, size, size); doc.setFontSize(7); doc.text('QR', x + size / 2, y + size / 2, { align: 'center' }); return; }
  const q = qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(), c = size / n; doc.setFillColor(0, 0, 0);
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) doc.rect(x + k * c, y + r * c, c + .02, c + .02, 'F');
}
/* Membrete oficial (como en los oficios del instituto) */
function pdfFitLine(doc, value, width, size) {
  const text = String(value || ''); doc.setFontSize(size);
  doc.setFontSize(Math.min(size, size * width / Math.max(doc.getTextWidth(text), 1)));
  return text;
}
async function pdfMembrete(doc, sub) {
  const W = doc.internal.pageSize.getWidth(); const lg = await logoPng();
  doc.setFillColor(...NAVY); doc.triangle(0, 0, 46, 0, 0, 16, 'F'); doc.setFillColor(...BLUE); doc.triangle(0, 16, 46, 0, 30, 0, 'F');
  if (lg) try { doc.addImage(lg, 'PNG', W - 30, 6, 17, 22); } catch (e) { }
  doc.setTextColor(25); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text('MINISTERIO DE EDUCACIÓN', W / 2, 11, { align: 'center' });
  doc.setFontSize(9.5); doc.text('DIRECCIÓN REGIONAL DE EDUCACIÓN ICA', W / 2, 15.5, { align: 'center' });
  doc.text(pdfFitLine(doc, inst().nombre.toUpperCase(), W - 68, 9.5), W / 2, 20, { align: 'center' });
  doc.setFontSize(8.5); doc.text(inst().normaCreacion || 'Resolución de ejemplo — sin validez oficial', W / 2, 24.3, { align: 'center' });
  doc.setDrawColor(...GOLD); doc.setLineWidth(.6); doc.setLineDashPattern([1, .8], 0); doc.line(14, 27.5, W - 34, 27.5); doc.setLineDashPattern([], 0); doc.setLineWidth(.2);
  doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(7.8); doc.setTextColor(60); doc.text(`"${inst().denominacionAnio || 'Año de la Esperanza y el Fortalecimiento de la Democracia'}"`.toUpperCase(), W / 2, 31.5, { align: 'center' });
  if (sub) { doc.setFillColor(...NAVY); doc.rect(14, 35, W - 28, 9, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(sub, W / 2, 41, { align: 'center' }); }
  doc.setTextColor(25); doc.setFont('helvetica', 'normal');
  return sub ? 50 : 38;
}
function pdfPie(doc, txt) {
  const n = doc.internal.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(); const i = inst();
  for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setDrawColor(...GOLD); doc.setLineWidth(.5); doc.line(14, H - 15, W - 14, H - 15); doc.setLineWidth(.2); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90);
    doc.text(txt || `Correo Mesa de Partes: ${mpvCfg().correo} · Secretaría de Dirección: ${mpvCfg().telefono || i.telefono} · ${i.direccion}`, 14, H - 10.5); doc.text(`Página ${p} de ${n}`, W - 14, H - 10.5, { align: 'right' }); doc.text(`Generado el ${fshort(nowISO(), true)} · ${i.nombreCorto}`, 14, H - 7); }
}
const pdfName = s => String(s || '').replace(/[^\w.-]+/g, '_');
function openBlob(blob, name) { const url = URL.createObjectURL(blob); const w = window.open(url, '_blank'); if (!w) downloadBlob(blob, name); setTimeout(() => URL.revokeObjectURL(url), 120000); }
const S16 = n => sic(n, 16);


/* =========================================================
   1.4 MESA DE PARTES VIRTUAL
   ========================================================= */
const MPV_ESTADOS_PUB = { Recibido: 'Recibido por Mesa de Partes', Derivado: 'Derivado al área de destino', 'En proceso': 'En atención en el área', Observado: 'Observado (revise el seguimiento)', Atendido: 'Atendido', Archivado: 'Archivado' };
function horarioBox(compact) {
  const c = mpvCfg(); const now = new Date(); const r = recepcionDe(now.toISOString());
  const st = r.enHorario ? `<span class="pz-live ok">● En horario de atención: tu documento se recibe en este momento.</span>` : `<span class="pz-live off">● Fuera del horario de atención: puedes registrar tu documento; se considerará recibido el <b>${fdate(r.fecha, true)}</b>.</span>`;
  if (compact) return `<section class="pz-horario compact" aria-label="Horario de atención de la Mesa de Partes Virtual"><div class="pz-h-ic">${ic('clock')}</div><div><span class="pz-k">Horario de atención · ${esc(c.dias)}</span><b class="pz-hh">${fmt12(c.horaIni)} – ${fmt12(c.horaFin)}</b>${st}</div></section>`;
  return `<section class="pz-horario" aria-label="Horario de atención de la Mesa de Partes Virtual"><div class="pz-h-ic">${ic('clock')}</div><div><span class="pz-k">Horario de atención</span><b>${esc(c.dias)}</b><b class="pz-hh">${fmt12(c.horaIni)} – ${fmt12(c.horaFin)}</b>${st}</div></section>`;
}
function mpvForm() {
  const c = mpvCfg(); const exts = c.formatos;
  return `<form class="card cb pz-form" data-mpv novalidate>
   <div class="pz-sec-h"><span>1</span><h2>Datos del remitente</h2></div><div class="form-grid">
    <div class="field"><label for="mv-tp">Tipo de persona <span class="req">*</span></label><select id="mv-tp" name="tipoPersona"><option>Persona natural</option><option>Persona jurídica / entidad</option></select></div>
    <div class="field"><label for="mv-td">Tipo de documento <span class="req">*</span></label><select id="mv-td" name="tipoDoc"><option>DNI</option><option value="CE">Carné de extranjería</option><option>Pasaporte</option><option>RUC</option></select></div>
    <div class="field"><label for="mv-nd">N.º de documento <span class="req">*</span></label><input id="mv-nd" name="numDoc" maxlength="12" inputmode="numeric" autocomplete="off"></div>
    <div class="field" data-nat><label for="mv-no">Nombres <span class="req">*</span></label><input id="mv-no" name="nombresP" maxlength="80" autocomplete="given-name"></div>
    <div class="field" data-nat><label for="mv-ap">Apellidos <span class="req">*</span></label><input id="mv-ap" name="apellidos" maxlength="80" autocomplete="family-name"></div>
    <div class="field full" data-jur hidden><label for="mv-rs">Razón social / nombre de la entidad <span class="req">*</span></label><input id="mv-rs" name="razon" maxlength="150"></div>
    <div class="field"><label for="mv-e">Correo electrónico (notificaciones) <span class="req">*</span></label><input id="mv-e" name="correo" type="email" maxlength="120" autocomplete="email"></div>
    <div class="field"><label for="mv-t">Teléfono / celular <span class="req">*</span></label><input id="mv-t" name="telefono" maxlength="15" inputmode="tel" autocomplete="tel"></div>
    <div class="field full w2"><label for="mv-dir">Dirección (opcional)</label><input id="mv-dir" name="direccion" maxlength="160" autocomplete="street-address"></div>
   </div>
   <div class="pz-sec-h"><span>2</span><h2>Datos del documento</h2></div><div class="form-grid">
    <div class="field"><label for="mv-tt">Tipo de documento a presentar <span class="req">*</span></label><select id="mv-tt" name="tipoTramite"><option value="">Seleccione</option>${mpvTipos().map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
    <div class="field"><label for="mv-ref">N.º o referencia de su documento</label><input id="mv-ref" name="docRef" maxlength="80" placeholder="Ej.: Oficio N.º 012-2026-MPP"></div>
    <div class="field"><label for="mv-fo">N.º de folios <span class="req">*</span></label><input id="mv-fo" name="folios" type="number" min="1" max="2000" value="1"></div>
    <div class="field full"><label for="mv-ar">Área de destino <span class="req">*</span></label><select id="mv-ar" name="areaDestino">${areaOptions('', { skipMP: true })}</select><div class="hint" data-arhint>La Mesa de Partes Virtual recibe el documento y lo deriva al área seleccionada.</div></div>
    <div class="field full"><label for="mv-as">Asunto <span class="req">*</span></label><textarea id="mv-as" name="asunto" maxlength="600" style="min-height:76px" data-count></textarea><div class="hint"><span data-c>0</span>/600 caracteres</div></div>
    <div class="field full"><label for="mv-ob">Observaciones (opcional)</label><input id="mv-ob" name="observaciones" maxlength="250"></div>
   </div>
   <div class="pz-sec-h"><span>3</span><h2>Archivos adjuntos</h2></div>
    <div class="field"><label for="mv-x">Documento principal y anexos <span class="req">*</span></label><input id="mv-x" type="file" name="archivos" multiple accept="${exts.map(e => '.' + e).join(',')}"><div class="hint">Formatos permitidos: ${exts.map(e => e.toUpperCase()).join(', ')} · tamaño máximo ${c.maxMB} MB por archivo · hasta ${c.maxArchivos} archivos.</div><ul class="pz-files" data-files></ul></div>
   <div class="pz-sec-h"><span>4</span><h2>Declaración y envío</h2></div>
    <div class="field"><label class="check"><input type="checkbox" name="declaro"> <span>Declaro que la información y los documentos presentados son veraces (principio de presunción de veracidad, Ley N.º 27444) y acepto ser notificado al correo electrónico registrado. <span class="req">*</span></span></label></div>
    <div class="field"><label class="check"><input type="checkbox" name="acepto"> <span>Acepto la <a href="#/politica-de-privacidad" target="_blank">Política de Privacidad</a> y el tratamiento de mis datos personales (Ley N.º 29733). <span class="req">*</span></span></label></div>
    ${captchaHTML('cap-mpv')}
    <div class="mpv-progress" data-mpv-progress role="status" aria-live="polite" aria-atomic="true" hidden><span class="mpv-spinner" aria-hidden="true"></span><div><strong>Registrando trámite, espera un momento…</strong><p data-mpv-step></p><small>No cierres esta página ni vuelvas a enviar el formulario.</small></div></div>
    <div class="pz-actions"><button type="reset" class="btn ghost">Limpiar</button><button class="btn" data-send>${S16('send')} Registrar y obtener cargo</button></div>
  </form>`;
}
function mpvConsulta() {
  return `<form class="card cb pz-qf" data-mpvq novalidate><div class="pz-qf-h">${sic('search', 20)}<div><h2>Consultar el estado de mi expediente</h2><small>Ingresa el N.º de expediente de tu cargo y tu DNI/RUC o el código de verificación.</small></div></div><div class="form-grid"><div class="field"><label for="mq-n">N.º de expediente</label><input id="mq-n" name="numero" placeholder="${esc(mpvCfg().prefijo)}-${yearNow()}-${pad(1,mpvCfg().digitos||6)}" autocomplete="off"></div><div class="field"><label for="mq-d">N.º de documento de identidad o código de verificación</label><input id="mq-d" name="doc" placeholder="DNI/RUC o código del cargo" autocomplete="off"></div><div class="full"><button class="btn sec">${S16('search')} Consultar estado</button></div></div><div id="mq-r"></div></form>`;
}
function mpvInfo() {
  const c = mpvCfg(); const as = areasAll().filter(a => a.activo);
  return `<section class="card cb" style="padding:20px"><h2 style="font-size:18px;margin-top:0">¿Cómo funciona?</h2><ol class="pz-steps"><li><b>Registra</b> tus datos, el tipo de documento, el área de destino y adjunta tus archivos.</li><li><b>Recibe</b> al instante tu N.º de expediente (${esc(c.prefijo)}-AAAA-NNNNNN), tu N.º de documento (DOC-AAAA-NNNNNN) y el cargo de recepción en PDF.</li><li><b>Mesa de Partes</b> deriva tu documento al área competente. Consulta las novedades en el seguimiento. La confirmación de registro se envía por correo cuando el servicio está habilitado.</li><li><b>Consulta</b> el estado en cualquier momento con tu N.º de expediente y tu DNI/RUC o el código de verificación.</li></ol>
   <h3>Tipos de documento admitidos y plazos referenciales</h3><div class="tbl-wrap"><table class="tbl light no-rt"><thead><tr><th>Tipo de documento</th><th class="num">Plazo (días hábiles)</th></tr></thead><tbody>${mpvTipos().map(t => `<tr><td>${esc(t)}</td><td class="num">${mpvPlazo(t)}</td></tr>`).join('')}</tbody></table></div>
   <h3>Recepción fuera del horario</h3><p>Puedes registrar documentos las 24 horas. Los presentados después de las ${fmt12(c.horaFin)}, en sábado, domingo o feriado se consideran recibidos el <b>siguiente día hábil a las ${fmt12(c.horaIni)}</b>; los presentados antes de las ${fmt12(c.horaIni)} de un día hábil, ese mismo día a las ${fmt12(c.horaIni)}. El cargo indica la fecha y hora exacta de presentación y la de recepción administrativa.</p>
   <h3>Contacto</h3><p>✉️ <a href="mailto:${esc(c.correo)}">${esc(c.correo)}</a> · 📞 ${esc(c.telefono)} (Secretaría de Dirección) · 📍 ${esc(inst().direccion)}</p>
   <h3>Áreas receptoras</h3><div class="tbl-wrap"><table class="tbl light"><thead><tr><th>Nivel</th><th>Área / cargo / órgano</th><th>Correo institucional</th></tr></thead><tbody>${as.map(a => `<tr><td>${esc(a.nivel || '')}</td><td>${esc(a.nombre)}</td><td><a href="mailto:${esc(a.correo)}">${esc(a.correo)}</a></td></tr>`).join('')}</tbody></table></div></section>`;
}
R('servicios/mesa-de-partes', (path, q0) => {
  const c = mpvCfg(); const t0 = q0 && q0.get && q0.get('tab'); const cur = t0 === 'consulta' || (q0 && q0.get && q0.get('exp')) ? 'c' : t0 === 'info' ? 'i' : 'n';
  const body = `${svNav('mesa-de-partes')}<div class="pz-mpv-top">${svHead('mpv', null, true)}${horarioBox(true)}</div>
   ${svTabs([['n', 'send', 'Nuevo trámite'], ['c', 'search', 'Consultar expediente'], ['i', 'book', 'Información']], cur)}
   <div data-pane="n" ${cur === 'n' ? '' : 'hidden'}>${mpvForm()}</div><div data-pane="c" ${cur === 'c' ? '' : 'hidden'}>${mpvConsulta()}</div><div data-pane="i" ${cur === 'i' ? '' : 'hidden'}>${mpvInfo()}</div>`;
  const side = null;
  const html = shell(path, { title: 'Mesa de Partes Virtual', desc: `Mesa de Partes Virtual del ${inst().nombre}: registro de documentos, cargo de recepción y seguimiento de expedientes.`, crumbs: [['Servicios', '#/servicios'], ['Mesa de Partes Virtual']], banner: { kicker: 'Servicios en línea', title: 'Mesa de Partes Virtual', text: 'Tus trámites en línea, con cargo de recepción inmediato' }, side, body });
  return { html, after: () => bindMpv(q0) };
});
function bindMpv(q0) {
  const c = mpvCfg();
  const showTab = k => { $$('.pz-mt [data-tab]').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === k)); $$('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== k); };
  $$('.pz-mt [data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  const f = $('[data-mpv]'); let busy=false,pending=null;
  const syncTipo = () => { const jur = f.tipoPersona.value !== 'Persona natural'; $$('[data-nat]', f).forEach(x => x.hidden = jur); $$('[data-jur]', f).forEach(x => x.hidden = !jur); if (jur && f.tipoDoc.value === 'DNI') f.tipoDoc.value = 'RUC'; if (!jur && f.tipoDoc.value === 'RUC') f.tipoDoc.value = 'DNI'; };
  f.tipoPersona.onchange = syncTipo;
  f.areaDestino.onchange = () => { const a = areaOf(f.areaDestino.value); $('[data-arhint]', f).innerHTML = a ? `Responsable: <b>${esc(a.resp)}</b> · <a href="mailto:${esc(a.correo)}">${esc(a.correo)}</a>` : 'La Mesa de Partes Virtual recibe el documento y lo deriva al área seleccionada.'; };
  $$('[data-count]', f).forEach(t => t.addEventListener('input', () => { t.parentNode.querySelector('[data-c]').textContent = t.value.length; }));
  const listFiles = () => { const fs = [...f.archivos.files]; $('[data-files]', f).innerHTML = fs.map(x => { const e = checkUpload(x, c.formatos, c.maxMB); return `<li class="${e ? 'bad' : ''}">${S16(e ? 'alert' : 'file')} <span>${esc(x.name)}</span> <small>${fsize(x.size)}</small>${e ? `<em>${esc(e)}</em>` : ''}</li>`; }).join(''); };
  f.archivos.onchange = listFiles;
  f.addEventListener('reset', () => setTimeout(() => { $('[data-files]', f).innerHTML = ''; $$('[data-c]', f).forEach(x => x.textContent = '0'); syncTipo(); }, 0));
  f.onsubmit = async e => {
    e.preventDefault(); if(busy)return; const v = Object.fromEntries(new FormData(f)); const er = {}; const jur = v.tipoPersona !== 'Persona natural';
    const de = validDoc(v.tipoDoc, v.numDoc); if (!v.numDoc) er.numDoc = 'Ingrese el número de documento.'; else if (de) er.numDoc = de;
    if (jur) { if (String(v.razon).trim().length < 3) er.razon = 'Ingrese la razón social o el nombre de la entidad.'; }
    else { if (String(v.nombresP).trim().length < 2) er.nombresP = 'Ingrese sus nombres.'; if (String(v.apellidos).trim().length < 2) er.apellidos = 'Ingrese sus apellidos.'; }
    if (!reEmail.test(v.correo)) er.correo = 'Ingrese un correo electrónico válido.';
    if (!/^[\d\s+()-]{6,15}$/.test(v.telefono)) er.telefono = 'Ingrese un teléfono válido (6 a 15 dígitos).';
    if (!v.tipoTramite) er.tipoTramite = 'Seleccione el tipo de documento.';
    if (!v.areaDestino) er.areaDestino = 'Seleccione el área de destino.';
    if (String(v.asunto).trim().length < 10) er.asunto = 'Describa el asunto (mínimo 10 caracteres).';
    if (!(+v.folios >= 1 && +v.folios <= 2000)) er.folios = 'Indique el número de folios (1 a 2000).';
    const files = [...f.archivos.files];
    if (!files.length) er.archivos = 'Adjunte al menos un archivo (el documento principal).';
    else if (files.length > c.maxArchivos) er.archivos = `Puede adjuntar hasta ${c.maxArchivos} archivos.`;
    else { const fe = files.map(x => checkUpload(x, c.formatos, c.maxMB)).find(Boolean); if (fe) er.archivos = fe; }
    if (!f.declaro.checked) er.declaro = 'Debe aceptar la declaración de veracidad.';
    if (!f.acepto.checked) er.acepto = 'Debe aceptar la política de privacidad.';
    const cap = checkCaptcha(f, 'cap-mpv'); if (cap) er.captcha = cap;
    if (!showErrors(f, er)) return;
    if (rateLimited('mpv', 20)) return toast('Espere unos segundos antes de registrar otro documento.', 'err');
    const btn = $('[data-send]', f),progress=$('[data-mpv-progress]',f),step=$('[data-mpv-step]',f);
    const signature=JSON.stringify([v,files.map(file=>[file.name,file.size,file.lastModified])]);
    if(!pending||pending.signature!==signature)pending={signature,key:crypto.randomUUID(),record:null};
    busy=true;const controls=[...f.elements,...$$('.pz-mt [data-tab]')].map(el=>[el,el.disabled]);
    controls.forEach(([el])=>el.disabled=true);f.setAttribute('aria-busy','true');progress.hidden=false;progress.scrollIntoView({block:'nearest'});
    btn.textContent='Registrando, espera un momento…';portalSubmissionStatus('Registrando trámite. Espera un momento y no cierres la página.');
    const preventLeave=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',preventLeave);
    try {
      // Cede el control para dibujar el aviso antes de iniciar la carga.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      let x=pending.record;
      if(!x){
        const archivos = []; for (const file of files){step.textContent=`Subiendo archivos: ${archivos.length+1} de ${files.length}.`;portalSubmissionStatus(step.textContent);archivos.push(await storeFile(file,'mpv'));}
        const fecha = nowISO(); const rec = recepcionDe(fecha);
        const numero='',numDocumento='';
        const u = currentUser(); const nombres = jur ? v.razon.trim() : `${v.nombresP.trim()} ${v.apellidos.trim()}`;
        x = { id: uid(), numero, numDocumento, fecha, fechaRecepcion: rec.fecha.toISOString(), enHorario: rec.enHorario, usuarioRegistro: u ? `${u.usuario} (${u.nombre})` : `Ciudadano – portal web (${v.tipoDoc} ${v.numDoc.trim()})`, canal: 'Mesa de Partes Virtual',
          tipoPersona: v.tipoPersona, nombres, nombresP: jur ? '' : v.nombresP.trim(), apellidos: jur ? '' : v.apellidos.trim(), tipoDoc: v.tipoDoc, numDoc: v.numDoc.trim(), correo: v.correo.trim(), telefono: v.telefono.trim(), direccion: (v.direccion || '').trim(),
          tipoTramite: v.tipoTramite, docRef: (v.docRef || '').trim(), asunto: v.asunto.trim(), folios: +v.folios, observaciones: (v.observaciones || '').trim(), archivos, archivo: archivos[0], areaDestino: v.areaDestino, area: 'MP', estado: 'Recibido',
          historial: [{ fecha, usuario: 'portal', estado: 'Recibido', nota: `Presentado por la Mesa de Partes Virtual. Recepción administrativa: ${fshort(rec.fecha, true)}${rec.enHorario ? '' : ' (fuera del horario de atención)'}. Área de destino: ${areaName(v.areaDestino)}.` }] };
        pending.record=x;
      }
      step.textContent='Guardando el trámite y preparando tu cargo. Este paso puede tardar unos segundos mientras se procesan las notificaciones.';
      portalSubmissionStatus('Guardando el trámite y preparando tu cargo.');await portalSubmitExpediente(x,pending.key);portalSubmissionStatus('Trámite registrado. Ya puedes descargar tu cargo.');
      const numero=x.numero,numDocumento=x.numDocumento;
      pending=null;
      f.reset(); renewCaptcha(f);
      const m = modal({ title: 'Documento registrado', size: 'lg', body: `<div class="notice ok">Tu documento fue <b>recibido por la Mesa de Partes Virtual</b>.</div>
        <div class="pz-codes"><div><span>N.º de expediente</span><b class="mono">${esc(numero)}</b></div><div><span>N.º de documento</span><b class="mono">${esc(numDocumento)}</b></div><div><span>Código de verificación</span><b class="mono">${esc(x.cargoCod || '—')}</b></div></div>
        <dl class="kv"><dt>Fecha y hora de presentación</dt><dd>${fdate(x.fecha, true)}</dd><dt>Fecha y hora de recepción</dt><dd>${fdate(x.fechaRecepcion, true)}${x.enHorario ? '' : ' <span class="badge warn">Fuera de horario: siguiente día hábil</span>'}</dd><dt>Área de destino</dt><dd>${esc(areaName(x.areaDestino))}</dd><dt>Plazo referencial</dt><dd>${c.plazos[x.tipoTramite] || 10} días hábiles</dd></dl>
        <p>Descarga y conserva tu cargo. Correo de contacto: <b>${esc(x.correo)}</b>.</p>`, foot: `<a class="btn ghost" href="${esc('#/servicios/mesa-de-partes?exp=' + numero + '&c=' + (x.cargoCod || ''))}" data-seg>Ver seguimiento</a>${cargoBtn(x)}` });
      $('[data-seg]', m.el).onclick = () => m.close();
    } catch (err) {const message=err.message||'No se pudo confirmar el registro. Conserva los datos y vuelve a intentar el mismo envío.';toast(message,'err');portalSubmissionStatus(message);}
    finally {busy=false;controls.forEach(([el,disabled])=>el.disabled=disabled);f.removeAttribute('aria-busy');progress.hidden=true;window.removeEventListener('beforeunload',preventLeave);btn.innerHTML=`${S16('send')} Registrar y obtener cargo`;}
  };
  const q = $('[data-mpvq]');
  const findExp = (n, d) => portalLookup('expedientes', String(n || '').trim().toUpperCase(), String(d || '').trim());
  const showExp = x => {
    $('#mq-r').innerHTML = x ? `<div class="pz-track" role="status"><div class="pz-track-h"><div><b class="mono">${esc(x.numero)}</b>${x.numDocumento ? ` · <span class="mono">${esc(x.numDocumento)}</span>` : ''}<br><small>${esc(x.tipoTramite)} · ${esc(clamp(x.asunto, 90))}</small></div>${stBadge(x.estado)}</div>
      ${svTrack(['Recibido', 'Derivado', 'En atención', 'Atendido'], x.estado, { Recibido: 0, Derivado: 1, 'En proceso': 2, Observado: 2, Atendido: 3, Archivado: 3 })}<dl class="kv"><dt>Presentado</dt><dd>${fdate(x.fecha, true)}</dd><dt>Recibido</dt><dd>${fdate(x.fechaRecepcion || x.fecha, true)}</dd><dt>Situación</dt><dd>${esc(MPV_ESTADOS_PUB[x.estado] || x.estado)}</dd><dt>Área actual</dt><dd>${esc(areaName(x.area || 'MP'))}</dd>${x.areaDestino ? `<dt>Área de destino</dt><dd>${esc(areaName(x.areaDestino))}</dd>` : ''}<dt>Plazo</dt><dd>${expSem(x)}</dd></dl>
      <ol class="pz-tl">${x.historial.map(h => `<li><span>${fshort(h.fecha, true)}</span><b>${esc(h.estado)}</b>${h.nota ? `<p>${esc(h.nota)}</p>` : ''}</li>`).join('')}</ol><div style="margin-top:10px">${cargoBtn(x, 'btn sm')}</div></div>`
      : '<div class="notice warn" role="status" style="margin-top:14px">No se encontró el expediente con esos datos. Verifique el número y su documento o código de verificación.</div>';
  };
  q.onsubmit = e => { e.preventDefault(); showExp(findExp(q.numero.value, q.doc.value)); };
  if (q0 && q0.get && q0.get('exp')) { showTab('c'); q.numero.value = q0.get('exp'); if (q0.get('c')) { q.doc.value = q0.get('c'); showExp(findExp(q0.get('exp'), q0.get('c'))); } }
  if (q0 && q0.get && q0.get('tab') === 'info') showTab('i');
}

/* ---------- Cargo de recepción en PDF ---------- */
cargoExp = async function (id) {
  const x = coll('expedientes').find(r => r.id === id); if (!x) return toast('Expediente no encontrado.', 'err');
  expCargoCod(x); const c = mpvCfg(); const recF = x.fechaRecepcion || x.fecha; const fuera = x.enHorario === false || !!expEfectiva(x.fecha) && !x.fechaRecepcion;
  const archivos = x.archivos || (x.archivo ? [x.archivo] : []);
  const staff = !!currentUser() && !isCommunity(); const docTxt = x.tipoDoc + ' ' + (staff && !canFlag('viewDni') ? maskDni(x.numDoc) : x.numDoc);
  if (!hasPdf()) { downloadBlob(makePdf('Cargo de recepcion ' + x.numero, [`Expediente: ${x.numero}`, `Documento: ${x.numDocumento || '-'}`, `Presentacion: ${fshort(x.fecha, true)}`, `Recepcion: ${fshort(recF, true)}`, `Remitente: ${x.nombres} (${docTxt})`, `Asunto: ${x.asunto}`, `Area de destino: ${areaName(x.areaDestino || x.area)}`, `Folios: ${x.folios}`, `Codigo de verificacion: ${x.cargoCod}`, 'Documento recibido por la Mesa de Partes Virtual.'], inst().nombre.toUpperCase()), 'cargo_' + x.numero + '.pdf'); return; }
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4' }); const W = 210, M = 14;
  let y = await pdfMembrete(doc, 'CARGO DE RECEPCIÓN – MESA DE PARTES VIRTUAL');
  // bloque de numeración + sello
  doc.setFillColor(...LIGHT); doc.setDrawColor(...BLUE); doc.roundedRect(M, y, W - 2 * M, 30, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90); doc.text('N.° DE EXPEDIENTE', M + 5, y + 6.5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16.5); doc.setTextColor(...NAVY); doc.text(x.numero, M + 5, y + 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(90); doc.text('N.° DE DOCUMENTO', M + 5, y + 20); doc.text('CÓDIGO DE VERIFICACIÓN', M + 52, y + 20);
  doc.setFont('courier', 'bold'); doc.setFontSize(10.5); doc.setTextColor(25); doc.text(x.numDocumento || '—', M + 5, y + 25.5);
  // Conserva completo el código de cargos anteriores y reserva el espacio del sello.
  const verificationCode = x.cargoCod || '—', verificationWidth = W - M - 66 - 4 - (M + 52);
  const verificationSize = Math.min(10.5, 10.5 * verificationWidth / Math.max(doc.getTextWidth(verificationCode), 1));
  doc.setFontSize(verificationSize); doc.text(verificationCode, M + 52, y + 25.5);
  const sx = W - M - 66, sy = y + 2.5; doc.setDrawColor(...NAVY); doc.setLineWidth(.9); doc.rect(sx, sy, 62, 25); doc.setLineWidth(.25); doc.rect(sx + 1.2, sy + 1.2, 59.6, 22.6);
  doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.text(pdfFitLine(doc, inst().nombreCorto.toUpperCase(), 58, 6.5), sx + 31, sy + 5, { align: 'center' });
  doc.setFontSize(10.5); doc.text('MESA DE PARTES VIRTUAL', sx + 31, sy + 10, { align: 'center' });
  doc.setFontSize(7); doc.text(`EXP. N.°: ${String(x.numero).slice(-6)}     N.° FOLIOS: ${pad(x.folios || 0)}`, sx + 31, sy + 14.5, { align: 'center' });
  doc.text(`FECHA ${fshort(recF)}   HORA ${new Date(recF).toTimeString().slice(0, 5)}`, sx + 31, sy + 18.5, { align: 'center' });
  doc.setFontSize(5.8); doc.text(doc.splitTextToSize('DESTINO: ' + areaName(x.areaDestino || x.area).toUpperCase(), 58)[0], sx + 31, sy + 22.3, { align: 'center' });
  doc.setLineWidth(.2); y += 36;
  const row = (k, v) => [{ content: k, styles: { fontStyle: 'bold', textColor: [60, 72, 88], fillColor: [244, 248, 252], cellWidth: 58 } }, v];
  doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { fontSize: 8.6, cellPadding: 1.8, lineColor: [214, 224, 234], textColor: 25, overflow: 'linebreak' },
    head: [[{ content: 'DATOS DE LA RECEPCIÓN', colSpan: 2, styles: { fillColor: NAVY, textColor: 255, fontSize: 9 } }]],
    body: [row('Fecha y hora de presentación', fdate(x.fecha, true)), row('Fecha y hora de recepción', fdate(recF, true) + (fuera ? '  (presentado fuera del horario: se considera recibido el siguiente día hábil)' : '')), row('Horario de atención', horarioTxt()), row('Registrado por', x.usuarioRegistro || 'Ciudadano – portal web'), row('Estado del trámite', x.estado)] });
  y = doc.lastAutoTable.finalY + 3;
  doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { fontSize: 8.6, cellPadding: 1.8, lineColor: [214, 224, 234], textColor: 25 },
    head: [[{ content: 'DATOS DEL REMITENTE Y DEL DOCUMENTO', colSpan: 2, styles: { fillColor: NAVY, textColor: 255, fontSize: 9 } }]],
    body: [row('Remitente', x.nombres + (x.tipoPersona ? ` (${x.tipoPersona.toLowerCase()})` : '')), row('Documento de identidad', docTxt), row('Correo electrónico', x.correo), row('Teléfono', x.telefono || '—'), row('Tipo de documento', x.tipoTramite + (x.docRef ? ` · ${x.docRef}` : '')), row('Asunto', x.asunto), row('Área de destino', areaName(x.areaDestino || x.area)), row('Número de folios', String(x.folios || '—'))] });
  y = doc.lastAutoTable.finalY + 3;
  doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { fontSize: 8, cellPadding: 1.6, lineColor: [214, 224, 234], textColor: 25 }, headStyles: { fillColor: BLUE, textColor: 255 },
    head: [['N.°', 'Archivo adjunto', 'Tamaño', 'Huella SHA-256 (integridad)']], body: archivos.length ? archivos.map((a, i) => [i + 1, a.original || a.nombre, fsize(a.size), a.sha256 ? a.sha256.slice(0, 32) + '…' : '—']) : [['—', 'Sin archivos adjuntos', '', '']], columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 20 }, 3: { cellWidth: 62, font: 'courier', fontSize: 7 } } });
  y = doc.lastAutoTable.finalY + 6; if (y > 230) { doc.addPage(); y = 20; }
  doc.setDrawColor(...BLUE); doc.setLineWidth(.4); doc.roundedRect(M, y, W - 2 * M, 40, 2, 2); doc.setLineWidth(.2);
  pdfQRp(doc, expSeguimientoUrl(x), M + 4, y + 4, 32);
  const tx = M + 41, tw = W - M - 4 - tx; let ty = y + 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...NAVY); doc.text(doc.splitTextToSize(`El presente documento fue RECIBIDO por la Mesa de Partes Virtual del ${inst().nombre}.`, tw), tx, ty); ty += 9;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(50);
  [`La recepción no implica la conformidad con el contenido del documento. El trámite será atendido por el área de destino dentro del plazo de ${mpvPlazo(x.tipoTramite)} días hábiles, contados desde la fecha de recepción.`,
   `Consulte el estado escaneando el código QR o en Mesa de Partes Virtual › Consultar expediente, con el N.° ${x.numero} y su documento de identidad o el código ${x.cargoCod}.`,
   'La confirmación por correo depende de la disponibilidad del servicio; conserve este cargo y consulte el seguimiento del expediente.'].forEach(s => { const t = doc.splitTextToSize('• ' + s, tw); doc.text(t, tx, ty); ty += 3.6 * t.length + .6; });
  pdfPie(doc);
  downloadBlob(doc.output('blob'), 'cargo_' + x.numero + '.pdf'); audit('Descarga de cargo', 'Mesa de partes', x.numero); saveDB();
  toast('Cargo de recepción descargado.', 'ok');
};

/* ---------- Panel: Mesa de partes ---------- */
const mpTabs = a => tabsBar([['b', 'Bandeja de expedientes', '#/admin/expedientes'], ['a', 'Áreas receptoras', '#/admin/expedientes/areas'], ['c', 'Configuración', '#/admin/expedientes/config']], a);
CUSTOM.expedientes = (parts) => {
  if (parts[2] === 'areas') return parts[3] === 'editar' ? mpvAreasEdit() : mpvAreasAdm();
  if (parts[2] === 'config') return mpvConfigAdm();
  if (parts[2]) return expDetalle(parts[2]);
  const all = coll('expedientes'); const y = String(yearNow()); const abiertos = all.filter(r => !['Atendido', 'Archivado'].includes(r.estado));
  const venc = abiertos.filter(r => expPlazo(r).left < 0).length;
  const top = `<div class="kpis">${kpi('inbox', 'var(--blue)', all.filter(r => String(r.fecha).startsWith(y)).length, 'Expedientes ' + y)}${kpi('clock', 'var(--warn)', all.filter(r => r.estado === 'Recibido').length, 'Por derivar (recibidos)')}${kpi('send', 'var(--navy2)', all.filter(r => ['Derivado', 'En proceso'].includes(r.estado)).length, 'Derivados / en proceso')}${kpi('check', 'var(--ok)', all.filter(r => r.estado === 'Atendido').length, 'Atendidos')}${kpi('alert', venc ? 'var(--err)' : 'var(--ok)', venc, 'Con plazo vencido')}</div>${horarioBox(true)}`;
  const ib = inbox({
    key: 'expedientes', collName: 'expedientes', title: 'Mesa de partes virtual', sub: 'Documentos recibidos por la Mesa de Partes Virtual. Numeración ' + esc(mpvCfg().prefijo) + '-AAAA-NNNNNN y DOC-AAAA-NNNNNN, única y correlativa por año.', icon: 'inbox', states: EXP_STATES, trash: false, top, tabs: mpTabs('b'),
    filterExtra: [{ n: 'tipoTramite', l: 'Tipo de documento', opts: mpvTipos() }, { n: 'areaDestino', l: 'Área de destino', opts: areasAll().map(a => a.cod) }],
    search: r => [r.numero, r.numDocumento, r.nombres, r.asunto, r.tipoTramite, r.numDoc, r.cargoCod].join(' '),
    extraActs: `<button class="btn sec" data-xcsv>${sic('download')} Reporte Excel (CSV)</button><a class="btn ghost" href="#/servicios/mesa-de-partes" target="_blank">Ver formulario público</a>`,
    cols: [{ l: 'N.º expediente', f: r => `<b class="mono" style="font-size:12.5px">${esc(r.numero)}</b>${r.numDocumento ? `<br><small class="mono">${esc(r.numDocumento)}</small>` : ''}` }, { l: 'Presentación / recepción', f: r => `${fshort(r.fecha, true)}${r.fechaRecepcion && r.fechaRecepcion.slice(0, 16) !== String(r.fecha).slice(0, 16) ? `<br><small style="color:var(--warn)">Rec. ${fshort(r.fechaRecepcion, true)}</small>` : ''}` }, { l: 'Remitente', f: r => `${esc(r.nombres)}<br><small>${esc(r.tipoDoc)} ${dniCell(r.numDoc)}</small>` }, { l: 'Tipo de documento', f: r => esc(r.tipoTramite) }, { l: 'Asunto', f: r => esc(clamp(r.asunto, 46)) }, { l: 'Destino / área actual', f: r => `${esc(areaName(r.areaDestino || r.area))}${r.area && r.area !== r.areaDestino ? `<br><small>Ahora: ${esc(areaName(r.area))}</small>` : ''}` }, { l: 'Folios', cls: 'num', f: r => r.folios || '—' }, { l: 'Plazo', cls: 'c', f: r => expSem(r) }, { l: 'Estado', cls: 'c', f: r => stBadge(r.estado) }],
  });
  return { html: ib.html, after: () => { ib.after(); $('[data-xcsv]').onclick = () => { downloadText(toCSV([['N.º expediente', 'N.º documento', 'Presentación', 'Recepción', 'Registrado por', 'Remitente', 'Documento', 'Correo', 'Tipo de documento', 'Asunto', 'Área de destino', 'Área actual', 'Folios', 'Archivos', 'Estado', 'Código de verificación']].concat(ib.rows.map(r => [r.numero, r.numDocumento || '', fshort(r.fecha, true), fshort(r.fechaRecepcion || r.fecha, true), r.usuarioRegistro || '', r.nombres, r.tipoDoc + ' ' + (canFlag('viewDni') ? r.numDoc : maskDni(r.numDoc)), r.correo, r.tipoTramite, r.asunto, areaName(r.areaDestino || r.area), areaName(r.area), r.folios, (r.archivos || []).length, r.estado, r.cargoCod || '']))), 'reporte_mesa_de_partes.csv', 'text/csv'); audit('Exportación', 'Mesa de partes', 'Reporte CSV'); saveDB(); }; } };
};
expDetalle = function (id) {
  const x = byId('expedientes', id); if (!x) return { html: admHead('Expediente no encontrado', '', '<a class="btn" href="#/admin/expedientes">Volver</a>', 'inbox') };
  const archivos = x.archivos || (x.archivo ? [x.archivo] : []); const dest = areaOf(x.areaDestino || x.area);
  const html = admHead('Expediente ' + x.numero, `${esc(x.tipoTramite)} · ${stBadge(x.estado)} · ${expSem(x)}`, `<button class="btn sec" data-cargo>${sic('print')} Cargo de recepción (PDF)</button><a class="btn ghost" href="#/admin/expedientes">${sic('back')} Volver</a>`, 'inbox', [['Mesa de partes', '#/admin/expedientes'], [x.numero]])
    + `<div class="edit-grid"><div style="display:grid;gap:16px;align-content:start"><div class="panel"><h2>Datos del expediente</h2><div class="pb"><dl class="kv"><dt>N.º de expediente</dt><dd><b class="mono">${esc(x.numero)}</b></dd><dt>N.º de documento</dt><dd class="mono">${esc(x.numDocumento || '—')}</dd><dt>Código de verificación</dt><dd class="mono">${esc(x.cargoCod || '—')}</dd><dt>Presentación</dt><dd>${fdate(x.fecha, true)}</dd><dt>Recepción</dt><dd>${fdate(x.fechaRecepcion || x.fecha, true)}${x.enHorario === false ? ' <span class="badge warn">Fuera de horario</span>' : ''}</dd><dt>Registrado por</dt><dd>${esc(x.usuarioRegistro || '—')}</dd>
      <dt>Remitente</dt><dd>${esc(x.nombres)} <small>(${esc(x.tipoPersona || 'Persona natural')})</small></dd><dt>Documento</dt><dd>${esc(x.tipoDoc)} ${dniCell(x.numDoc)}</dd><dt>Correo</dt><dd><a href="mailto:${esc(x.correo)}">${esc(x.correo)}</a></dd><dt>Teléfono</dt><dd>${esc(x.telefono || '—')}</dd>${x.direccion ? `<dt>Dirección</dt><dd>${esc(x.direccion)}</dd>` : ''}
      <dt>Tipo de documento</dt><dd>${esc(x.tipoTramite)}${x.docRef ? ' · ' + esc(x.docRef) : ''}</dd><dt>Folios</dt><dd>${x.folios || '—'}</dd><dt>Área de destino</dt><dd>${esc(areaName(x.areaDestino || x.area))}${dest ? `<br><small>${esc(dest.resp)} · ${esc(dest.correo)}</small>` : ''}</dd><dt>Área actual</dt><dd>${esc(areaName(x.area || 'MP'))}</dd></dl>
      <h3 style="margin-top:14px">Asunto</h3><div class="card cb" style="white-space:pre-wrap">${esc(x.asunto)}</div>${x.observaciones ? `<p><b>Observaciones:</b> ${esc(x.observaciones)}</p>` : ''}
      <h3 style="margin-top:14px">Archivos adjuntos (${archivos.length})</h3>${archivos.length ? `<ul class="pz-files">${archivos.map((a, i) => `<li>${S16('file')} <span>${esc(a.original || a.nombre)}</span> <small>${fsize(a.size)}</small><button class="btn xs sec" data-dl="${i}">${sic('download', 13)} Descargar</button>${a.sha256 ? `<code title="SHA-256">${esc(a.sha256.slice(0, 16))}…</code>` : ''}</li>`).join('')}</ul>` : '<p>Sin archivos.</p>'}</div></div>
      <div class="panel"><h2>Historial y seguimiento</h2><div class="pb">${histHTML(x.historial)}</div></div></div>
    <div style="display:grid;gap:16px;align-content:start"><div class="panel"><h2>Derivar a un área</h2><div class="pb" style="display:grid;gap:10px"><div class="field"><label for="xa">Área receptora</label><select id="xa">${areaOptions(x.area === 'MP' ? (x.areaDestino || '') : x.area, { placeholder: 'Seleccione el área' })}</select></div><div class="field"><label for="xan">Proveído / indicación</label><input id="xan" class="inp" placeholder="Ej.: Para su atención y trámite correspondiente"></div><label class="check"><input type="checkbox" id="xam" checked> Enviar aviso por correo al solicitante y al área receptora</label><button class="btn" data-xa>${sic('send')} Derivar expediente</button></div></div>
      <div class="panel"><h2>Actualizar estado</h2><div class="pb" style="display:grid;gap:10px"><div class="field"><label for="xs">Nuevo estado</label><select id="xs">${EXP_STATES.map(s => `<option ${s === x.estado ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div class="field"><label for="xn">Nota / respuesta</label><textarea id="xn" class="inp" rows="3"></textarea></div><label class="check"><input type="checkbox" id="xm" checked> Enviar aviso por correo al solicitante</label><button class="btn sec" data-xs>Guardar estado</button></div></div>
      <div class="panel"><h2>Plazo</h2><div class="pb meta-list"><span>Tipo: ${esc(x.tipoTramite)} · ${mpvPlazo(x.tipoTramite)} días hábiles</span><span>Vence: <b>${fdate(expPlazo(x).due)}</b></span><span>${expSem(x)}</span></div></div></div></div>`;
  return {
    html, after: () => {
      const me = currentUser().usuario;
      $$('[data-dl]').forEach(b => b.onclick = () => { downloadMeta(archivos[+b.dataset.dl]); audit('Descarga de adjunto', 'Mesa de partes', x.numero); saveDB(); });
      $('[data-cargo]').onclick = () => cargoExp(x.id);
      $('[data-xa]').onclick = () => {
        const v = $('#xa').value; if (!v) return toast('Seleccione el área.', 'err'); if (v === x.area) return toast('El expediente ya se encuentra en esa área.', 'err');
        const a = areaOf(v); const prov = $('#xan').value.trim(); const n = `Derivado a ${areaName(v)}${prov ? ': ' + prov : ''}`;
        x.area = v; if (['Recibido', 'Observado'].includes(x.estado)) x.estado = 'Derivado'; if ($('#xam').checked) delete x.sinAviso; else x.sinAviso = true;
        x.historial.push({ fecha: nowISO(), usuario: me, estado: x.estado, nota: n });
        if ($('#xam').checked) { if (a) mailOut(a.correo, `[${x.numero}] Expediente derivado: ${x.tipoTramite}`, `${x.nombres} · ${x.asunto}${prov ? ' · Proveído: ' + prov : ''}`); mailOut(x.correo, `Expediente ${x.numero}: derivado`, `Su documento fue derivado a ${areaName(v)}.`); }
        audit('Derivación', 'Mesa de partes', x.numero, n); stamp(x); if (saveDB()) { toast($('#xam').checked ? 'Expediente derivado. Avisos registrados para el solicitante y el área receptora.' : 'Expediente derivado sin aviso por correo.', 'ok'); route(); }
      };
      $('[data-xs]').onclick = () => {
        const v = $('#xs').value, n = $('#xn').value.trim(); if (v === x.estado && !n) return toast('Seleccione otro estado o escriba una nota.', 'err'); if (['Observado', 'Atendido'].includes(v) && !n) return toast(v === 'Observado' ? 'Indique la observación.' : 'Registre la respuesta o el detalle de la atención.', 'err');
        x.historial.push({ fecha: nowISO(), usuario: me, estado: v, nota: n }); audit(`Cambio de estado: ${x.estado} → ${v}`, 'Mesa de partes', x.numero, n); x.estado = v; if (!$('#xm') || $('#xm').checked) delete x.sinAviso; else x.sinAviso = true; stamp(x);
        if ($('#xm').checked) mailOut(x.correo, `Expediente ${x.numero}: ${v}`, n || 'Su expediente cambió de estado.'); if (saveDB()) { toast('Estado actualizado.', 'ok'); route(); }
      };
      // Dirección consulta sin modificar; el personal de un área atiende sus expedientes pero no los deriva a otra.
      const u = currentUser() || {}; const ro = u.rol === 'directivo', areaUser = !!u.area && !['admin', 'atencion', 'directivo'].includes(u.rol);
      if (ro || areaUser) $('[data-xa]')?.closest('.panel')?.remove();
      if (ro) { $('[data-xs]')?.closest('.panel')?.remove(); $('.edit-grid')?.insertAdjacentHTML('beforebegin', '<p class="notice" role="status">Consulta de solo lectura: la atención la realiza Mesa de partes o el área de destino.</p>'); }
    }
  };
};
/* Editor de áreas receptoras y tipos de trámite (catálogos académicos que usan Mesa de partes y Libro de reclamaciones). */
function mpvAreasEdit() {
  if (!can('ix-config')) return mpvAreasAdm();
  return { html: admHead('Editar áreas y tipos de trámite', 'Áreas receptoras con su responsable y correo institucional, y tipos de trámite con su plazo. Se usan en los formularios públicos y en las derivaciones.', `<a class="btn sec" href="#/admin/expedientes/areas">Volver a áreas</a>`, 'inbox', [['Mesa de partes', '#/admin/expedientes'], ['Áreas receptoras', '#/admin/expedientes/areas'], ['Editar']]) + mpTabs('a') + `<div class="pz-ixwrap">${ixWrap(IX.view('mesaCfg'))}</div>`, after: () => { } };
}
function mpvAreasAdm() {
  const as = areasAll();
  const html = admHead('Mesa de partes virtual', 'Relación de áreas receptoras, responsables y correos institucionales (@iestppisco.edu.pe). Las derivaciones se notifican a estos correos.', can('ix-config') ? `<a class="btn" href="#/admin/expedientes/areas/editar">${sic('edit')} Editar áreas</a>` : '', 'inbox', [['Mesa de partes', '#/admin/expedientes'], ['Áreas receptoras']]) + mpTabs('a')
    + `<div class="panel"><div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>Nivel / clasificación</th><th>Código</th><th>Área / cargo / órgano</th><th>Responsable</th><th>Correo corporativo</th><th class="c">Expedientes abiertos</th><th class="c">Estado</th></tr></thead><tbody>${nivelesDe(as).map(n => as.filter(a => (a.nivel || 'Áreas') === n).map((a, i, g) => `<tr>${i === 0 ? `<td rowspan="${g.length}" style="font-weight:700;vertical-align:middle">${esc(n)}</td>` : ''}<td class="mono">${esc(a.cod)}</td><td>${esc(a.nombre)}</td><td>${esc(a.resp)}</td><td><a href="mailto:${esc(a.correo)}">${esc(a.correo)}</a></td><td class="c">${coll('expedientes').filter(x => x.area === a.cod && !['Atendido', 'Archivado'].includes(x.estado)).length}</td><td class="c">${stBadge(a.activo ? 'Activo' : 'Inactivo')}</td></tr>`).join('')).join('')}</tbody></table></div><p class="note" style="padding:0 16px 14px">Las áreas se administran en Configuración académica › Áreas receptoras; los cambios se reflejan en el formulario público y en las derivaciones.</p></div>`;
  return { html };
}
function mpvConfigAdm() {
  const c = mpvCfg(); const canEdit = currentUser().rol === 'admin' || can('config'); const year=String(portalBootstrap.numberingYear||yearNow()); const next=(DB.config.contadores.MPV[year]||0)+1;
  const html = admHead('Mesa de partes virtual', 'Horario de atención, tipos de documento admitidos, formatos y tamaño de archivos, feriados y plazos de atención.', '', 'inbox', [['Mesa de partes', '#/admin/expedientes'], ['Configuración']]) + mpTabs('c')
    + `<form class="panel" data-mpvcfg><div class="pb"><div class="form-grid">
      <div class="field full"><h3>Código y correlativo del expediente</h3><p class="note">Formato: CÓDIGO-AÑO-CORRELATIVO. Se aplica a nuevos expedientes; los anteriores conservan su número. La secuencia es anual.</p></div>
      <div class="field"><label for="mc-prefix">Código / prefijo del expediente</label><input id="mc-prefix" name="prefijo" required maxlength="40" pattern="[A-Z0-9][A-Z0-9-]{0,39}" value="${esc(c.prefijo)}"></div>
      <div class="field"><label for="mc-digits">Dígitos del correlativo</label><input id="mc-digits" name="digitos" type="number" required min="1" max="9" value="${c.digitos||6}"><small>Se completa con ceros a la izquierda, sin truncar el número.</small></div>
      <div class="field"><label for="mc-next">Siguiente correlativo (${year})</label><input id="mc-next" name="siguiente" type="number" required min="${next}" max="999999999" value="${next}"><small>Puedes avanzar la secuencia, pero no retroceder a números ya utilizados.</small></div>
      <div class="field full"><span>Vista previa: <b class="mono" data-number-preview></b></span></div>
      <div class="field"><label for="mc-d">Días de atención</label><input id="mc-d" name="dias" value="${esc(c.dias)}"></div>
      <div class="field"><label for="mc-i">Hora de inicio</label><input id="mc-i" name="horaIni" type="time" value="${esc(c.horaIni)}"></div>
      <div class="field"><label for="mc-f">Hora de cierre</label><input id="mc-f" name="horaFin" type="time" value="${esc(c.horaFin)}"></div>
      <div class="field"><label for="mc-m">Tamaño máximo por archivo (MB)</label><input id="mc-m" name="maxMB" type="number" min="1" max="100" value="${c.maxMB}"></div>
      <div class="field"><label for="mc-n">Máximo de archivos por trámite</label><input id="mc-n" name="maxArchivos" type="number" min="1" max="10" value="${c.maxArchivos}"></div>
      <div class="field"><label for="mc-c">Correo de Mesa de Partes</label><input id="mc-c" name="correo" type="email" required maxlength="254" value="${esc(c.correo)}"></div>
      <div class="field full"><span class="lbl">Formatos permitidos</span><div style="display:flex;gap:14px;flex-wrap:wrap">${MPV_FORMATOS.map(([k, l]) => `<label class="check"><input type="checkbox" name="fmt" value="${k}" ${c.formatos.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
      <div class="field"><label for="mc-t">Tipos de documento (uno por línea)</label><textarea id="mc-t" name="tipos" rows="13">${esc(c.tipos.join('\n'))}</textarea></div>
      <div class="field"><label for="mc-p">Plazo de atención por tipo (días hábiles, “Tipo = días”)</label><textarea id="mc-p" name="plazos" rows="13">${esc(c.tipos.map(t => `${t} = ${c.plazos[t] || 10}`).join('\n'))}</textarea></div>
      <div class="field full"><label for="mc-h">Feriados regionales y días no laborables de la institución (AAAA-MM-DD, uno por línea). Los feriados nacionales se aplican solos cada año.</label><textarea id="mc-h" name="feriados" rows="5">${esc(c.feriados.join('\n'))}</textarea><div class="hint">Los documentos presentados en estas fechas se consideran recibidos el siguiente día hábil.</div></div>
      <div class="full" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span class="note">Numeración: <b class="mono">${esc(c.prefijo)}-${year}-${pad(next, c.digitos||6)}</b> (siguiente) · <b class="mono">DOC-${yearNow()}-${pad((DB.config.contadores.DOC[String(yearNow())] || 0) + 1, 6)}</b></span>${canEdit ? '<button class="btn">Guardar configuración</button>' : '<span class="note">Solo el administrador puede modificar esta configuración.</span>'}</div>
    </div></div></form>`;
  return { html, after: () => { const f = $('[data-mpvcfg]'); const preview=()=>{f.querySelector('[data-number-preview]').textContent=f.prefijo.value+'-'+year+'-'+String(f.siguiente.value).padStart(Math.max(1,Math.min(9,+f.digitos.value||6)),'0');};for(const name of ['prefijo','digitos','siguiente'])f.elements[name].addEventListener('input',preview);preview(); f.onsubmit = e => { e.preventDefault(); if (!canEdit) return;
    const tipos = f.tipos.value.split('\n').map(s => s.trim()).filter(Boolean); if (!tipos.length) return toast('Registre al menos un tipo de documento.', 'err');
    const fmts = $$('[name="fmt"]:checked', f).map(i => i.value); if (!fmts.length) return toast('Seleccione al menos un formato.', 'err');
    if (hm(f.horaFin.value) <= hm(f.horaIni.value)) return toast('La hora de cierre debe ser posterior a la de inicio.', 'err');
    const fer = f.feriados.value.split('\n').map(s => s.trim()).filter(Boolean); const bad = fer.find(s => !/^\d{4}-\d{2}-\d{2}$/.test(s)); if (bad) return toast('Fecha de feriado no válida: ' + bad, 'err');
    const plazos = {}; f.plazos.value.split('\n').forEach(l => { const m = l.split('='); if (m.length === 2 && +m[1] > 0) plazos[m[0].trim()] = Math.round(+m[1]); }); tipos.forEach(t => { if (!plazos[t]) plazos[t] = 10; });
    DB.config.contadores.MPV[year]=Number(f.siguiente.value)-1;
    Object.assign(c, { prefijo:f.prefijo.value.trim(),digitos:Number(f.digitos.value),dias: f.dias.value.trim() || 'Lunes a viernes', horaIni: f.horaIni.value, horaFin: f.horaFin.value, maxMB: Math.max(1, +f.maxMB.value || 40), maxArchivos: Math.max(1, +f.maxArchivos.value || 5), correo: f.correo.value.trim(), formatos: fmts, tipos, plazos, feriados: fer });
    Object.assign(EXP_PLAZOS, plazos); audit('Configuración', 'Mesa de partes', 'Horario, tipos, formatos y plazos'); if (saveDB()) { toast('Configuración de la Mesa de Partes guardada.', 'ok'); route(); } }; } };
}


/* =========================================================
   1.2 LIBRO DE RECLAMACIONES VIRTUAL
   ========================================================= */
const LR_COND = ['Estudiante', 'Egresado', 'Postulante', 'Padre, madre o apoderado', 'Docente', 'Personal administrativo', 'Público en general'];
function lrForm() {
  const L = DB.config.limites; const lim = Math.max(2000, L.descripcion || 0);
  return `<form class="pz-lr card" data-lr2 novalidate>
   <div class="pz-lr-h">${ic('book')}<div><h2>Registro de reclamo o queja</h2><small>Los campos marcados con * son obligatorios.</small></div></div>
   <div class="cb" style="padding:20px">
    <h3 class="pz-sub">${S16('user')} Datos del usuario</h3><div class="form-grid g4">
     <div class="field"><label for="l2-td">Tipo de documento <span class="req">*</span></label><select id="l2-td" name="tipoDoc"><option value="">Seleccione</option><option>DNI</option><option value="CE">Carné de extranjería</option><option>Pasaporte</option><option>RUC</option></select></div>
     <div class="field"><label for="l2-nd">Número de documento <span class="req">*</span></label><input id="l2-nd" name="numDoc" maxlength="12" placeholder="Ingrese su documento" autocomplete="off"></div>
     <div class="field"><label for="l2-no">Nombres <span class="req">*</span></label><input id="l2-no" name="nombresP" maxlength="80" placeholder="Ingrese sus nombres" autocomplete="given-name"></div>
     <div class="field"><label for="l2-ap">Apellidos <span class="req">*</span></label><input id="l2-ap" name="apellidos" maxlength="80" placeholder="Ingrese sus apellidos" autocomplete="family-name"></div>
     <div class="field"><label for="l2-e">Correo electrónico <span class="req">*</span></label><input id="l2-e" name="correo" type="email" maxlength="120" placeholder="iestp@iestppisco.edu.pe" autocomplete="email"></div>
     <div class="field"><label for="l2-t">Teléfono</label><input id="l2-t" name="telefono" maxlength="15" inputmode="tel" placeholder="999 999 999" autocomplete="tel"></div>
     <div class="field"><label for="l2-c">Condición del usuario <span class="req">*</span></label><select id="l2-c" name="condicion"><option value="">Seleccione</option>${LR_COND.map(x => `<option>${x}</option>`).join('')}</select></div>
     <div class="field"><label for="l2-p">Programa de estudios</label><select id="l2-p" name="programaId"><option value="">Seleccione</option>${progs().map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}<option value="ninguno">No corresponde</option></select></div>
    </div>
    <h3 class="pz-sub">${S16('alert')} Datos del reclamo</h3>
    <div class="field"><span class="lbl">Tipo de registro <span class="req">*</span></span><div class="pz-tipo" role="radiogroup" aria-label="Tipo de registro" data-name="tipo">
      <label class="rec"><input type="radio" name="tipo" value="Reclamo">${ic('file')}<b>Reclamo</b><small>Disconformidad con el servicio educativo o un trámite.</small></label>
      <label class="que"><input type="radio" name="tipo" value="Queja">${ic('alert')}<b>Queja</b><small>Malestar por la atención recibida (trato, demora, etc.).</small></label></div></div>
    <div class="form-grid">
     <div class="field"><label for="l2-f">Fecha del hecho <span class="req">*</span></label><input id="l2-f" name="fechaHecho" type="date" max="${ymd(new Date())}"></div>
     <div class="field"><label for="l2-ar">Área o servicio involucrado</label><select id="l2-ar" name="areaHecho">${areaOptions('', { skipMP: false, placeholder: 'No sé / no aplica' })}</select></div>
     <div class="field full"><label for="l2-d">Descripción de los hechos <span class="req">*</span></label><textarea id="l2-d" name="descripcion" maxlength="${lim}" placeholder="Describa detalladamente lo sucedido..." data-count></textarea><div class="hint"><span data-c>0</span>/${lim} caracteres · máximo ${lim} caracteres</div></div>
     <div class="field full"><label for="l2-pe">Pedido concreto <span class="req">*</span></label><textarea id="l2-pe" name="pedido" maxlength="${L.pedido || 1000}" placeholder="Indique qué solución o atención solicita..." style="min-height:80px" data-count></textarea><div class="hint"><span data-c>0</span>/${L.pedido || 1000} caracteres</div></div>
     <div class="field full"><label for="l2-x">Documento o evidencia <small style="font-weight:400;color:var(--muted)">(opcional)</small></label><input id="l2-x" type="file" name="adjunto" accept=".pdf,.jpg,.jpeg,.png"><div class="hint">Formatos permitidos: PDF, JPG y PNG · máx. 10 MB.</div></div>
    </div>
    <div class="field pz-decl"><label class="check"><input type="checkbox" name="declaro"> <span>Declaro que la información proporcionada es verdadera y corresponde a los hechos que deseo comunicar. <span class="req">*</span></span></label></div>
    <div class="field"><label class="check"><input type="checkbox" name="acepto"> <span>Acepto la <a href="#/politica-de-privacidad" target="_blank">Política de Privacidad</a> y el tratamiento de mis datos personales (Ley N.º 29733). <span class="req">*</span></span></label></div>
    ${captchaHTML('cap-lr2')}
    <div class="mpv-progress" data-lr-progress role="status" aria-live="polite" hidden><span class="mpv-spinner" aria-hidden="true"></span><div><strong>Registrando reclamo, espera un momento…</strong><p>Estamos guardando tu solicitud y preparando tu constancia. No cierres la página ni repitas el envío.</p></div></div>
    <div class="pz-actions"><button type="reset" class="btn ghost">${S16('back')} Cancelar</button><button class="btn" data-send>${S16('send')} Enviar reclamo</button></div>
   </div></form>`;
}
function lrPage(path, q0) {
  const c = lrCfg(); const i = inst(); const t0 = q0 && q0.get && q0.get('tab'); const cur = t0 === 'consulta' || (q0 && q0.get && q0.get('rcl')) ? 'c' : t0 === 'info' ? 'i' : 'r';
  const body = `${svNav('libro-de-reclamaciones')}<div class="pz-mpv-top">${svHead('lr', null, true)}${svKeyBox('clock', 'Plazos de respuesta', `Reclamos: ${c.plazoReclamo} días · Quejas: ${c.plazoQueja} días`, 'Días hábiles · constancia en PDF con código QR')}</div>
   ${svTabs([['r', 'edit', 'Registrar reclamo o queja'], ['c', 'search', 'Consultar estado'], ['i', 'book', 'Información']], cur)}
   <div data-pane="r" ${cur === 'r' ? '' : 'hidden'}>${lrForm()}</div>
   <div data-pane="c" ${cur === 'c' ? '' : 'hidden'}><section class="card cb pz-qf"><div class="pz-qf-h">${sic('search', 20)}<div><h2>Consultar el estado de mi reclamo o queja</h2><small>Ingresa el seguimiento RCL y el documento completo del reclamante, o el código de verificación de tu constancia.</small></div></div><form data-lrq2 class="form-grid" novalidate><div class="field"><label for="lq2-c">Código de seguimiento</label><input id="lq2-c" name="codigo" placeholder="RCL-${yearNow()}-00001" autocomplete="off"></div><div class="field"><label for="lq2-d">Documento del reclamante o código de verificación</label><input id="lq2-d" name="doc" maxlength="20" placeholder="DNI de 8 dígitos o verificación de 16 caracteres" autocomplete="off"></div><div class="full"><button class="btn">${S16('search')} Consultar</button></div></form><div id="lq2-r" aria-live="polite"></div></section></div>
   <div data-pane="i" ${cur === 'i' ? '' : 'hidden'}><section class="card cb pz-lr-inf">
     <div class="pz-lr-2"><div class="rec">${sic('file', 22)}<b>Reclamo</b><p>Disconformidad relacionada con el servicio educativo o con los trámites brindados por el instituto.</p><small>Plazo de respuesta: ${c.plazoReclamo} días hábiles</small></div><div class="que">${sic('alert', 22)}<b>Queja</b><p>Malestar o descontento respecto a la atención recibida: trato, demora, falta de información, etc.</p><small>Plazo de respuesta: ${c.plazoQueja} días hábiles</small></div></div>
     <h3>Flujo de atención</h3><ol class="pz-flow"><li><b>Recibido</b><span>Registro y constancia PDF descargable.</span></li><li><b>Derivado</b><span>El responsable lo deriva al área competente.</span></li><li><b>En atención</b><span>El área evalúa y propone la respuesta.</span></li><li><b>Atendido</b><span>La respuesta queda disponible en el seguimiento del portal.</span></li></ol>
     <h3>Responsable de la atención</h3><p><b>${esc(c.responsable || 'Responsable pendiente de asignación')}</b> · ${esc(c.cargo)}<br><a href="mailto:${esc(c.correo)}">${esc(c.correo)}</a></p>
     <h3>¿Necesitas ayuda?</h3><p>📞 ${esc(i.telefono)} · 🕗 ${esc(i.horario)}</p>
     <h3>A tener en cuenta</h3><ul><li>El plazo se cuenta desde el día hábil siguiente al registro.</li><li>La formulación del reclamo no impide acudir a otras vías de solución de controversias.</li><li>Base normativa: Decreto Supremo N.º 042-2011-PCM, que obliga a las entidades públicas a contar con un Libro de Reclamaciones.</li></ul><div class="pz-info3"><div>${ic('shield')}<b>Registro seguro</b><span>Tu información se registra de manera segura y protegida (Ley N.º 29733).</span></div><div>${ic('search')}<b>Seguimiento</b><span>Con tu código consultas el estado en cualquier momento.</span></div><div>${ic('mail')}<b>Notificación</b><span>Consulta el estado y la respuesta con tu código de seguimiento.</span></div></div></section></div>`;
  const side = null;
  const html = shell(path, { title: 'Libro de Reclamaciones', desc: `Libro de Reclamaciones Virtual del ${inst().nombre}: registra tu reclamo o queja y consulta su estado.`, crumbs: [['Servicios', '#/servicios'], ['Libro de Reclamaciones']], banner: { kicker: 'Servicios en línea', title: 'Libro de Reclamaciones', text: 'Porque un mejor servicio también se construye escuchándote' }, side, body });
  return { html, after: () => bindLr2(q0) };
}
R('servicios/libro-de-reclamaciones', (path, q0) => lrPage(path, q0));
R('transparencia/libro-de-reclamaciones', (path, q0) => lrPage('servicios/libro-de-reclamaciones', q0));
R('libro-de-reclamaciones', (path, q0) => lrPage('servicios/libro-de-reclamaciones', q0 || new URLSearchParams()));
function bindLr2(q0) {
  const c = lrCfg(); const f = $('[data-lr2]');let busy=false,pending=null; const L = DB.config.limites; const lim = Math.max(2000, L.descripcion || 0);
  const showTab = k => { $$('.pz-mt [data-tab]').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === k)); $$('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== k); };
  $$('.pz-mt [data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  $$('[data-count]', f).forEach(t => t.addEventListener('input', () => { t.parentNode.querySelector('[data-c]').textContent = t.value.length; }));
  f.addEventListener('reset', () => setTimeout(() => $$('[data-c]', f).forEach(x => x.textContent = '0'), 0));
  f.onsubmit = async e => {
    e.preventDefault();if(busy)return; const v = Object.fromEntries(new FormData(f)); const er = {};
    if (!v.tipoDoc) er.tipoDoc = 'Seleccione el tipo de documento.';
    else { const de = validDoc(v.tipoDoc, v.numDoc); if (!v.numDoc) er.numDoc = 'Ingrese el número de documento.'; else if (de) er.numDoc = de; }
    if (String(v.nombresP).trim().length < 2) er.nombresP = 'Ingrese sus nombres.';
    if (String(v.apellidos).trim().length < 2) er.apellidos = 'Ingrese sus apellidos.';
    if (!reEmail.test(v.correo)) er.correo = 'Ingrese un correo electrónico válido.';
    if (v.telefono && !/^[\d\s+()-]{6,15}$/.test(v.telefono)) er.telefono = 'Teléfono no válido (6 a 15 dígitos).';
    if (!v.condicion) er.condicion = 'Seleccione su condición.';
    if (['Estudiante', 'Egresado'].includes(v.condicion) && (!v.programaId || v.programaId === 'ninguno')) er.programaId = 'Seleccione su programa de estudios.';
    if (!v.tipo) er.tipo = 'Seleccione si es un reclamo o una queja.';
    if (!v.fechaHecho) er.fechaHecho = 'Indique la fecha del hecho.'; else if (v.fechaHecho > ymd(new Date())) er.fechaHecho = 'La fecha no puede ser futura.';
    if (String(v.descripcion).trim().length < 20) er.descripcion = 'Describa los hechos (mínimo 20 caracteres).'; else if (v.descripcion.length > lim) er.descripcion = `Máximo ${lim} caracteres.`;
    if (String(v.pedido).trim().length < 5) er.pedido = 'Indique su pedido concreto.';
    const file = f.adjunto.files[0]; if (file) { const fe = checkUpload(file, ['pdf', 'jpg', 'jpeg', 'png'], 10); if (fe) er.adjunto = fe; }
    if (!f.declaro.checked) er.declaro = 'Debe declarar que la información es verdadera.';
    if (!f.acepto.checked) er.acepto = 'Debe aceptar la política de privacidad.';
    const cap = checkCaptcha(f, 'cap-lr2'); if (cap) er.captcha = cap;
    if (!showErrors(f, er)) return;
    if (rateLimited('lr2', 20)) return toast('Espere unos segundos antes de registrar otro reclamo.', 'err');
    const btn=$('[data-send]',f),progress=$('[data-lr-progress]',f);const signature=JSON.stringify([v,file?[file.name,file.size,file.lastModified]:null]);if(!pending||pending.signature!==signature)pending={signature,key:crypto.randomUUID(),record:null};busy=true;const controls=[...f.elements,...$$('.pz-mt [data-tab]')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);progress.hidden=false;progress.scrollIntoView({block:'nearest'});btn.textContent='Registrando, espera un momento…';f.setAttribute('aria-busy','true');portalSubmissionStatus('Registrando reclamo. Espera un momento y no cierres la página.');const preventLeave=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',preventLeave);
    try {
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));let r=pending.record;if(!r){
      const adj = file ? await storeFile(file, 'rcl') : null;
      const fecha = nowISO();
      let codigo = ''; const plazoDias = v.tipo === 'Queja' ? c.plazoQueja : c.plazoReclamo; const nombres = `${v.nombresP.trim()} ${v.apellidos.trim()}`;
      r = { id: uid(), codigo, fecha, tipo: v.tipo, nombres, nombresP: v.nombresP.trim(), apellidos: v.apellidos.trim(), tipoDoc: v.tipoDoc, numDoc: v.numDoc.trim(), correo: v.correo.trim(), telefono: (v.telefono || '').trim(), condicion: v.condicion, programaId: v.programaId === 'ninguno' ? '' : v.programaId, fechaHecho: v.fechaHecho, areaHecho: v.areaHecho || '',
        asunto: clamp(v.descripcion.trim().replace(/\s+/g, ' '), 80), descripcion: v.descripcion.trim(), pedido: v.pedido.trim(), adjunto: adj, estado: 'Recibido', plazoDias, vence: diasHabiles(fecha, plazoDias).due.toISOString(), responsable: { nombre: c.responsable, cargo: c.cargo, correo: c.correo }, area: '',
        historial: [{ fecha, usuario: 'portal', estado: 'Recibido', nota: `Registro desde el Libro de Reclamaciones Virtual. Responsable: ${c.responsable} (${c.cargo}).` }], notas: [], respuesta: '', notifInst: 'Pendiente', notifUser: 'Pendiente', anulado: false };
      pending.record=r;}await portalSubmitService('reclamos',r,pending.key);portalSubmissionStatus('Reclamo registrado. Ya puedes descargar tu constancia.');pending=null;const codigo=r.codigo,fecha=r.fecha,plazoDias=r.plazoDias;
      f.reset(); renewCaptcha(f);
      const m = modal({ title: `${v.tipo} ${v.tipo === 'Queja' ? 'registrada' : 'registrado'}`, body: `<div class="notice ok">Tu ${esc(v.tipo.toLowerCase())} fue registrado correctamente el ${fdate(fecha, true)}.</div><p>Tu código de seguimiento es:</p><div class="code-box">${codigo}</div><p>Código de verificación: <b class="mono">${esc(r.cargoCod || 'Pendiente de actualización')}</b></p><dl class="kv" style="margin-top:12px"><dt>Responsable</dt><dd>${esc(c.responsable)} · ${esc(c.cargo)}</dd><dt>Plazo de respuesta</dt><dd>${plazoDias} días hábiles (hasta el ${fdate(r.vence)})</dd></dl><p>Puedes descargar tu constancia. Correo de contacto: <b>${esc(r.correo)}</b>. Guarda tu código para consultar el estado.</p>`, foot: `<button class="btn sec" data-print>${S16('print')} Descargar constancia (PDF)</button><button class="btn" data-ok>Aceptar</button>` });
      $('[data-ok]', m.el).onclick = m.close; $('[data-print]', m.el).onclick = () => lrPdf(r, 'constancia');
    } catch (err) {const message=err.message||'No se pudo confirmar el registro. Conserva los datos y reintenta el mismo envío.';toast(message,'err');portalSubmissionStatus(message);}
    finally {window.removeEventListener('beforeunload',preventLeave);busy=false;controls.forEach(([el,disabled])=>el.disabled=disabled);progress.hidden=true;f.removeAttribute('aria-busy');btn.innerHTML=`${S16('send')} Enviar reclamo`;}
  };
  const q = $('[data-lrq2]');
  const show = r => { $('#lq2-r').innerHTML = r ? `<div class="pz-track" role="status"><div class="pz-track-h"><div><b class="mono">${esc(r.codigo)}</b> · ${esc(r.tipo)}<br><small>Registrado el ${fdate(r.fecha, true)}</small></div>${stBadge(r.anulado ? 'Anulado' : r.estado)}</div>${svTrack(['Recibido', 'Derivado', 'En atención', 'Atendido'], r.anulado ? 'Anulado' : r.estado, { Recibido: 0, Derivado: 1, 'En atención': 2, Atendido: 3, Cerrado: 3, Anulado: 0 })}<dl class="kv"><dt>Plazo</dt><dd>${lrSem(r)} · vence ${fdate(lrPlazo(r).due)}</dd>${r.area ? `<dt>Área que atiende</dt><dd>${esc(areaName(r.area))}</dd>` : ''}${r.respuesta ? `<dt>Respuesta</dt><dd style="white-space:pre-wrap">${esc(r.respuesta)}</dd>` : ''}</dl><ol class="pz-tl">${(r.historial || []).map(h => `<li><span>${fshort(h.fecha, true)}</span><b>${esc(h.estado)}</b></li>`).join('')}</ol><div style="margin-top:12px"><button type="button" class="btn sm sec" data-lrpdf>${S16('download')} Descargar constancia (PDF)</button></div></div>` : `<div class="notice warn" role="status">No se encontró un registro con ese código y documento. Verifique los datos de su constancia.</div>`; const b = $('[data-lrpdf]'); if (b && r) b.onclick = () => lrPdf(r, 'constancia'); };
  const consult = () => { const cod=q.codigo.value.trim().toUpperCase(), d=q.doc.value.trim().toUpperCase(); const er={};
    if(!/^(?:RCL|LR)-\d{4}-\d+$/i.test(cod))er.codigo='Ingresa el código de seguimiento completo, por ejemplo RCL-2026-00001.';
    if(!/^[A-Z0-9-]{6,20}$/.test(d))er.doc='Ingresa el documento completo del reclamante (DNI de 8 dígitos, no folios como 01) o su código de verificación.';
    if(!showErrors(q,er)){$('#lq2-r').innerHTML='';return;}
    show(portalLookup('reclamos',cod,d)); };
  q.onsubmit=e=>{e.preventDefault();consult();};
  if(q0&&q0.get&&q0.get('rcl')){showTab('c');q.codigo.value=q0.get('rcl');if(q0.get('v')){q.doc.value=q0.get('v');consult();}}

}
const lrSeguimientoUrl = r => location.href.split('#')[0]+'#/servicios/libro-de-reclamaciones?tab=consulta&rcl='+encodeURIComponent(r.codigo)+(r.cargoCod?'&v='+encodeURIComponent(r.cargoCod):'');
/* Constancia (ciudadano) y hoja de reclamación (panel) en PDF con membrete */
async function lrPdf(r, kind) {
  const titulo = kind === 'constancia' ? `CONSTANCIA DE REGISTRO – ${r.tipo.toUpperCase()}` : `HOJA DE ${r.tipo.toUpperCase()} N.° ${r.codigo}`;
  const staff = kind !== 'constancia'; const docTxt = `${r.tipoDoc} ${staff && !canFlag('viewDni') ? maskDni(r.numDoc) : (staff ? r.numDoc : maskDni(r.numDoc))}`;
  if (!hasPdf()) return downloadBlob(makePdf(titulo, [`Codigo: ${r.codigo}`, `Fecha: ${fshort(r.fecha, true)}`, `Reclamante: ${r.nombres}`, `Documento: ${docTxt}`, '', r.descripcion, '', 'Pedido: ' + r.pedido, 'Verificacion: '+(r.cargoCod||'Actualiza el portal para habilitarla'), 'Consulta: '+lrSeguimientoUrl(r)], inst().nombre.toUpperCase()), `${kind}_${r.codigo}.pdf`);
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4' }); const M = 14; const W = 210;
  let y = await pdfMembrete(doc, 'LIBRO DE RECLAMACIONES VIRTUAL');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...NAVY); doc.text(titulo, W / 2, y + 3, { align: 'center' }); y += 9;
  doc.setFillColor(...LIGHT); doc.roundedRect(M, y, W - 2 * M, 14, 2, 2, 'F'); doc.setFontSize(8); doc.setTextColor(80); doc.setFont('helvetica', 'normal'); doc.text('CÓDIGO DE SEGUIMIENTO', M + 4, y + 5); doc.text('FECHA Y HORA DE REGISTRO', M + 62, y + 5); doc.text('PLAZO DE RESPUESTA', M + 118, y + 5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(25); doc.text(r.codigo, M + 4, y + 11); doc.text(fshort(r.fecha, true), M + 62, y + 11); doc.text(`${lrPlazoDias(r)} días hábiles (${fshort(lrPlazo(r).due)})`, M + 118, y + 11); y += 18;
  const row = (k, v) => [{ content: k, styles: { fontStyle: 'bold', textColor: [60, 72, 88], fillColor: [244, 248, 252], cellWidth: 52 } }, v || '—'];
  const sec = (t, body) => { doc.autoTable({ startY: y, margin: { left: M, right: M }, theme: 'grid', styles: { fontSize: 8.6, cellPadding: 1.8, lineColor: [214, 224, 234], textColor: 25 }, head: [[{ content: t, colSpan: 2, styles: { fillColor: NAVY, textColor: 255 } }]], body }); y = doc.lastAutoTable.finalY + 3; };
  sec('1. DATOS DEL USUARIO', [row('Nombres y apellidos', r.nombres), row('Documento', docTxt), row('Correo electrónico', r.correo), row('Teléfono', r.telefono), row('Condición', r.condicion), row('Programa de estudios', (progById(r.programaId) || {}).nombre)]);
  sec('2. DETALLE', [row('Tipo de registro', r.tipo), row('Fecha del hecho', r.fechaHecho ? fshort(r.fechaHecho + 'T12:00:00') : ''), row('Área o servicio', r.areaHecho ? areaName(r.areaHecho) : ''), row('Descripción de los hechos', r.descripcion), row('Pedido concreto', r.pedido), row('Evidencia adjunta', r.adjunto ? `${r.adjunto.original || r.adjunto.nombre} (${fsize(r.adjunto.size)})` : 'No adjunta')]);
  sec('3. ATENCIÓN', [row('Responsable institucional', `${(r.responsable || {}).nombre || lrCfg().responsable} – ${(r.responsable || {}).cargo || lrCfg().cargo}`), row('Correo del responsable', (r.responsable || {}).correo || lrCfg().correo), row('Estado', r.anulado ? 'Anulado' : r.estado)].concat(staff ? [row('Área derivada', r.area ? areaName(r.area) : 'Sin derivar'), row('Respuesta', r.respuesta)] : []));
  if (y > 232) { doc.addPage(); y = 20; }
  const verificationUrl=lrSeguimientoUrl(r);doc.setDrawColor(...BLUE);doc.setLineWidth(.3);doc.roundedRect(M,y,W-2*M,42,2,2);
  pdfQRp(doc,verificationUrl,M+3,y+3,34);
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...NAVY);doc.text('CÓDIGO DE VERIFICACIÓN',M+42,y+8);
  doc.setFont('courier','bold');doc.setFontSize(11);doc.text(r.cargoCod||'Pendiente de actualización',M+42,y+15);
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(50);doc.text(doc.splitTextToSize('Escanea el QR para consultar el estado de este reclamo o queja. También puedes ingresar su seguimiento y tu documento completo o este código de verificación en el Libro de Reclamaciones.',W-2*M-46),M+42,y+22);
  y+=46;
  if(y>267){doc.addPage();y=20;}
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(70);
  doc.text(doc.splitTextToSize(`La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante las autoridades competentes. El instituto dará respuesta en un plazo no mayor de ${lrPlazoDias(r)} días hábiles mediante el seguimiento del portal. Los avisos por correo dependen de la configuración institucional. Consulte el seguimiento y su documento o código de verificación.`, W - 2 * M), M, y + 4);
  pdfPie(doc, `Libro de Reclamaciones Virtual · ${lrCfg().correo} · ${inst().direccion}`);
  downloadBlob(doc.output('blob'), `${kind === 'constancia' ? 'Constancia' : 'Hoja'}_${r.codigo}.pdf`);
}

/* ---------- Panel del Libro de reclamaciones ---------- */
const lrTabs2 = a => tabsBar([['d', 'Resumen', '#/admin/reclamos'], ['l', 'Bandeja de reclamos', '#/admin/reclamos/bandeja'], ['n', 'Notificaciones por correo', '#/admin/reclamos/notificaciones'], ['c', 'Responsable y plazos', '#/admin/reclamos/config']], a);
const baseReclamos = CUSTOM.reclamos, baseReclamoDet = reclamoDetalle;
CUSTOM.reclamos = (parts) => {
  if (parts[2] === 'notificaciones') { const o = lrNotif(); o.html = o.html.replace(lrTabs('n'), lrTabs2('n')); return o; }
  if (parts[2] === 'config') return lrConfigAdm();
  if (parts[2] === 'bandeja') { const o = baseReclamos(['admin', 'reclamos']); o.html = o.html.replace(lrTabs('l'), lrTabs2('l')); return o; }
  if (parts[2]) return reclamoDetalle(parts[2]);
  return lrDashboard();
};
function lrDashboard() {
  const all = coll('reclamos').filter(r => !r.anulado); const c = lrCfg();
  const pend = all.filter(r => ['Recibido', 'Derivado'].includes(r.estado)), proc = all.filter(r => r.estado === 'En atención'), aten = all.filter(r => r.estado === 'Atendido');
  const abiertos = all.filter(r => r.estado !== 'Atendido'); const venc = abiertos.filter(r => lrPlazo(r).left < 0), xv = abiertos.filter(r => { const l = lrPlazo(r).left; return l >= 0 && l <= c.alerta; });
  const rec = all.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8);
  const html = admHead('Libro de reclamaciones', 'Control y seguimiento de reclamos y quejas', `<a class="btn" href="#/servicios/libro-de-reclamaciones" target="_blank">${sic('plus')} Nuevo reclamo</a>`, 'book', [['Libro de reclamaciones']]) + lrTabs2('d')
    + `<h2 class="pz-h2">Resumen general</h2><div class="kpis">${kpi('book', 'var(--blue)', all.length, 'Total registrados', '#/admin/reclamos/bandeja')}${kpi('clock', 'var(--warn)', pend.length, 'Pendientes')}${kpi('restore', 'var(--navy2)', proc.length, 'En proceso')}${kpi('check', 'var(--ok)', aten.length, 'Atendidos')}${kpi('alert', venc.length ? 'var(--err)' : 'var(--ok)', venc.length, 'Plazo vencido')}${kpi('bell', xv.length ? 'var(--warn)' : 'var(--ok)', xv.length, `Por vencer (≤ ${c.alerta} días)`)}</div>
    <div class="pz-dash"><div class="panel"><h2><span>${sic('list')} Reclamos recientes</span><a class="btn xs" href="#/admin/reclamos/bandeja">Ver todos</a></h2><div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>Código</th><th>Usuario</th><th>Tipo</th><th>Fecha</th><th>Plazo</th><th class="c">Estado</th><th class="c">Acción</th></tr></thead><tbody>${rec.map(r => `<tr><td><b class="mono">${esc(r.codigo)}</b></td><td>${esc(r.nombres)}</td><td>${esc(r.tipo)}</td><td>${fshort(r.fecha)}</td><td>${lrSem(r)}</td><td class="c">${stBadge(r.estado)}</td><td class="c"><a class="icon-btn" href="#/admin/reclamos/${r.id}" title="Ver" aria-label="Ver ${esc(r.codigo)}">${ic('eye')}</a></td></tr>`).join('') || '<tr><td colspan="7"><div class="empty">Sin registros.</div></td></tr>'}</tbody></table></div></div>
     <div style="display:grid;gap:16px;align-content:start"><div class="panel"><h2><span>${sic('zap')} Acciones rápidas</span></h2><div class="pb pz-quick"><button class="btn" data-qk="Reclamo">${sic('file')} Gestionar reclamos</button><button class="btn pz-orange" data-qk="Queja">${sic('alert')} Gestionar quejas</button><button class="btn ghost" data-rep>${sic('chart')} Ver reportes</button><a class="btn ghost" href="#/servicios/libro-de-reclamaciones" target="_blank">${sic('globe')} Ver libro público</a></div></div>
      <div class="panel"><h2><span>${sic('user')} Responsable institucional</span></h2><div class="pb"><b>${esc(c.responsable || 'Responsable pendiente de asignación')}</b><br>${esc(c.cargo)}<br><a href="mailto:${esc(c.correo)}">${esc(c.correo)}</a><p class="note" style="margin-top:8px">Plazos: reclamos ${c.plazoReclamo} y quejas ${c.plazoQueja} días hábiles.</p></div></div>
      <div class="panel"><h2><span>${sic('alert')} Información</span></h2><div class="pb note">${esc(c.flujo)}</div></div></div></div>`;
  return { html, after: () => {
    $$('[data-qk]').forEach(b => b.onclick = () => { const st = ADM.state.reclamos = ADM.state.reclamos || { q: '', f: {}, page: 1, size: 10, trash: false }; st.f = Object.assign({}, st.f, { tipo: b.dataset.qk }); st.page = 1; go('#/admin/reclamos/bandeja'); });
    $('[data-rep]').onclick = () => { const rows = coll('reclamos'); downloadText(toCSV([['Código', 'Fecha', 'Tipo', 'Usuario', 'Condición', 'Programa', 'Área derivada', 'Estado', 'Plazo (días hábiles)', 'Vence', 'Días restantes', 'Fecha de atención', 'Respuesta']].concat(rows.map(r => [r.codigo, fshort(r.fecha, true), r.tipo, r.nombres, r.condicion || '', (progById(r.programaId) || {}).nombre || '', r.area ? areaName(r.area) : '', r.anulado ? 'Anulado' : r.estado, lrPlazoDias(r), fshort(lrPlazo(r).due), r.estado === 'Atendido' ? '' : lrPlazo(r).left, r.atendidoEn ? fshort(r.atendidoEn, true) : '', r.respuesta || '']))), 'reporte_libro_reclamaciones.csv', 'text/csv'); audit('Exportación', 'Libro de reclamaciones', 'Reporte de plazos'); saveDB(); };
  } };
}
reclamoDetalle = function (id) {
  const out = baseReclamoDet(id); const r = byId('reclamos', id); if (!r) return out; const c = lrCfg(); const p = lrPlazo(r);
  const extra = `<div class="panel"><h2>Plazo y derivación</h2><div class="pb" style="display:grid;gap:10px"><div class="meta-list"><span>Responsable: <b>${esc((r.responsable || {}).nombre || c.responsable)}</b> (${esc((r.responsable || {}).cargo || c.cargo)})</span><span>Plazo: ${lrPlazoDias(r)} días hábiles · vence <b>${fdate(p.due)}</b></span><span>${lrSem(r)}</span>${r.area ? `<span>Área que atiende: <b>${esc(areaName(r.area))}</b></span>` : ''}</div>
    ${r.condicion ? `<dl class="kv"><dt>Condición</dt><dd>${esc(r.condicion)}</dd><dt>Programa</dt><dd>${esc((progById(r.programaId) || {}).nombre || '—')}</dd><dt>Fecha del hecho</dt><dd>${r.fechaHecho ? fshort(r.fechaHecho + 'T12:00:00') : '—'}</dd><dt>Área involucrada</dt><dd>${r.areaHecho ? esc(areaName(r.areaHecho)) : '—'}</dd></dl>` : ''}
    ${r.anulado || r.estado === 'Atendido' ? '' : `<div class="field"><label for="lr-ar">Derivar al área competente</label><select id="lr-ar">${areaOptions(r.area || r.areaHecho || '', { placeholder: 'Seleccione el área' })}</select></div><div class="field"><label for="lr-arn">Indicación para el área</label><input id="lr-arn" class="inp" placeholder="Ej.: Atender y remitir informe en 5 días hábiles"></div><button class="btn sec" data-der>${sic('send')} Derivar y notificar</button>`}
    ${r.adjunto && r.adjunto.key ? `<button class="btn ghost sm" data-adj2>${sic('download')} Descargar evidencia</button>` : ''}</div></div>`;
  out.html = out.html.replace('<div style="display:grid;gap:16px;align-content:start"><div class="panel"><h2>Gestión</h2>', '<div style="display:grid;gap:16px;align-content:start">' + extra + '<div class="panel"><h2>Gestión</h2>');
  const a0 = out.after;
  out.after = () => { a0 && a0();
    $('[data-pdf]').onclick = () => lrPdf(r, 'hoja');
    // Dirección supervisa los reclamos sin responderlos (la atención corresponde a Atención al ciudadano).
    if (currentUser()?.rol === 'directivo') { $$('.edit-grid textarea, .edit-grid select, .edit-grid input, .edit-grid button:not([data-pdf]):not([data-adj2])').forEach(el => { el.disabled = true; }); $('.edit-grid')?.insertAdjacentHTML('beforebegin', '<p class="notice" role="status">Consulta de solo lectura: la respuesta la registra Atención al ciudadano.</p>'); }
    const a2 = $('[data-adj2]'); if (a2) a2.onclick = () => downloadMeta(r.adjunto);
    const old = $('[data-adj]'); if (old && r.adjunto && r.adjunto.key) old.onclick = () => downloadMeta(r.adjunto);
    const d = $('[data-der]'); if (d) d.onclick = () => { const v = $('#lr-ar').value; if (!v) return toast('Seleccione el área.', 'err'); const a = areaOf(v); const ind = $('#lr-arn').value.trim(); const me = currentUser().usuario;
      r.area = v; if (r.estado === 'Recibido') r.estado = 'Derivado'; r.historial.push({ fecha: nowISO(), usuario: me, estado: r.estado, nota: `Derivado a ${areaName(v)}${ind ? ': ' + ind : ''}` });
      if (a) mailOut(a.correo, `[${r.codigo}] ${r.tipo} derivado para su atención`, `${r.nombres}: ${r.descripcion}${ind ? ' · Indicación: ' + ind : ''} · Vence: ${fshort(lrPlazo(r).due)}`);
      audit('Derivación', 'Libro de reclamaciones', r.codigo, areaName(v)); stamp(r); if (saveDB()) { toast('Derivación registrada. Avisos en cola para el solicitante y el área receptora.', 'ok'); route(); } };
  };
  return out;
};
function lrConfigAdm() {
  const c = lrCfg(); const canEdit = currentUser().rol === 'admin' || can('config');
  const html = admHead('Libro de reclamaciones', 'Responsable institucional de la atención, plazos de respuesta y flujo de derivación interna.', '', 'book', [['Libro de reclamaciones', '#/admin/reclamos'], ['Responsable y plazos']]) + lrTabs2('c')
    + `<form class="panel" data-lrcfg><div class="pb"><div class="form-grid">
      <div class="field"><label for="lc-r">Responsable institucional</label><input id="lc-r" name="responsable" value="${esc(c.responsable)}"></div>
      <div class="field"><label for="lc-c">Cargo</label><input id="lc-c" name="cargo" value="${esc(c.cargo)}"></div>
      <div class="field"><label for="lc-e">Correo institucional</label><input id="lc-e" name="correo" type="email" value="${esc(c.correo)}"></div>
      <div class="field"><label for="lc-a">Área que recibe inicialmente</label><select id="lc-a" name="areaInicial">${areaOptions(c.areaInicial, { placeholder: '—' })}</select></div>
      <div class="field"><label for="lc-pr">Plazo de respuesta a reclamos (días hábiles)</label><input id="lc-pr" name="plazoReclamo" type="number" min="1" max="30" value="${c.plazoReclamo}"></div>
      <div class="field"><label for="lc-pq">Plazo de respuesta a quejas (días hábiles)</label><input id="lc-pq" name="plazoQueja" type="number" min="1" max="30" value="${c.plazoQueja}"></div>
      <div class="field"><label for="lc-al">Alertar cuando falten (días hábiles)</label><input id="lc-al" name="alerta" type="number" min="1" max="10" value="${c.alerta}"></div>
      <div class="field full"><label for="lc-f">Flujo de derivación interna (texto informativo)</label><textarea id="lc-f" name="flujo" rows="4">${esc(c.flujo)}</textarea></div>
      <div class="full"><ol class="pz-flow h"><li><b>Recibido</b><span>Registro, código RCL y constancia.</span></li><li><b>Derivado</b><span>El responsable lo deriva al área competente.</span></li><li><b>En atención</b><span>El área evalúa y propone la respuesta.</span></li><li><b>Atendido</b><span>Respuesta notificada al usuario.</span></li></ol></div>
      <div class="full" style="text-align:right">${canEdit ? '<button class="btn">Guardar</button>' : '<span class="note">Solo el administrador puede modificar esta configuración.</span>'}</div></div></div></form>`;
  return { html, after: () => { const f = $('[data-lrcfg]'); f.onsubmit = e => { e.preventDefault(); if (!canEdit) return; if (!reEmail.test(f.correo.value)) return toast('Correo no válido.', 'err'); if (f.responsable.value.trim().length < 5) return toast('Indique el responsable.', 'err');
    Object.assign(c, { responsable: f.responsable.value.trim(), cargo: f.cargo.value.trim(), correo: f.correo.value.trim(), areaInicial: f.areaInicial.value, plazoReclamo: Math.max(1, +f.plazoReclamo.value || 15), plazoQueja: Math.max(1, +f.plazoQueja.value || 15), alerta: Math.max(1, +f.alerta.value || 3), flujo: f.flujo.value.trim() });
    DB.config.correoReclamos = c.correo; audit('Configuración', 'Libro de reclamaciones', 'Responsable y plazos'); if (saveDB()) { toast('Configuración guardada.', 'ok'); route(); } }; } };
}


/* =========================================================
   1.3 BOLSA LABORAL: panel, padrón Excel, egresados y validación de empresas
   ========================================================= */
const XD = () => IX.db();
const xprog = id => (XD().programas.find(p => p.id === id) || { cod: '—', nombre: '—' });
const xemp = id => (XD().empresas.find(e => e.id === id) || { nom: '—' });
const xest = id => (XD().estudiantes.find(e => e.id === id) || { nom: '—', estado: '' });
const empEstado = e => e.validada ? 'Aprobada' : (e.estadoVal === 'Rechazada' ? 'Rechazada' : 'Pendiente');
const empBadge = e => { const s = empEstado(e); return `<span class="badge ${s === 'Aprobada' ? 'ok' : s === 'Rechazada' ? 'err' : 'warn'}">${s}</span>`; };
const rucOk = r => { r = String(r || ''); if (!/^(10|15|17|20)\d{9}$/.test(r)) return false; const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]; const s = w.reduce((a, x, i) => a + x * +r[i], 0); let d = 11 - s % 11; if (d === 10) d = 0; if (d === 11) d = 1; return d === +r[10]; };
const fdx = d => d ? fshort(String(d).length === 10 ? d + 'T12:00:00' : d) : '—';
function canWriteAcademic(module) { const u=currentUser(); if(!u)return false; if(u.rol==='admin')return true; const key={alumnos:'ix-alumnos',bolsa:'ix-bolsa'}[module]; return !!key&&can(key)&&Number(XD().perms?.[IX_ROLE[u.rol]]?.[module]||0)>=2; }
const bTabs = a => tabsBar([['p', 'Panel', '#/admin/ix-bolsa'], ['g', 'Convocatorias y postulaciones', '#/admin/ix-bolsa/gestion'], ['e', 'Validación de empresas', '#/admin/ix-bolsa/empresas'], ['r', 'Padrón de estudiantes y egresados', '#/admin/ix-bolsa/padron'], ['s', 'Seguimiento de egresados', '#/admin/ix-bolsa/egresados']], a);
const bHead = (sub, crumb) => admHead('Bolsa laboral', sub, `<a class="btn ghost" href="#/servicios/bolsa-laboral" target="_blank">${sic('globe')} Ver bolsa pública</a>`, 'briefcase', [['Servicios'], ['Bolsa laboral', '#/admin/ix-bolsa']].concat(crumb ? [[crumb]] : []));
const baseBolsa = CUSTOM['ix-bolsa'];
CUSTOM['ix-bolsa'] = (parts, q) => {
  if (isCommunity() || !IX || !IX.db) return baseBolsa(parts, q);
  const t = parts[2] || '';
  if (t === 'gestion') return { html: bHead('Convocatorias, empresas y postulaciones', 'Gestión') + bTabs('g') + `<div class="pz-ixwrap">${ixWrap(IX.view('bolsa'))}</div>` };
  if (t === 'empresas') return bolsaEmpresas();
  if (t === 'padron') return bolsaPadron();
  if (t === 'egresados') return bolsaEgresados(q);
  return bolsaPanel();
};
function bolsaPanel() {
  const D = XD(); const hoy = ymd(new Date());
  const est = D.estudiantes.filter(e => e.estado === 'Regular').length, egr = D.estudiantes.filter(e => ['Egresado', 'Titulado'].includes(e.estado)).length;
  const empA = D.empresas.filter(e => e.validada).length, empP = D.empresas.filter(e => empEstado(e) === 'Pendiente').length;
  const conv = D.ofertas.filter(o => o.estado === 'Publicada' && o.limite >= hoy).length;
  const post = D.postulaciones.length, rev = D.postulaciones.filter(p => ['Recibida', 'En revisión'].includes(p.estado)).length, sel = D.postulaciones.filter(p => p.estado === 'Seleccionado').length;
  const K = (ic0, col, v, l, href, sub) => `<a class="pz-kpi" href="${href}"><div><span>${l}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div><i style="background:${col}">${ic(ic0)}</i></a>`;
  const ofs = D.ofertas.slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))).slice(0, 5);
  const emps = D.empresas.slice().sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 4);
  const posts = D.postulaciones.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 5);
  const html = bHead(`Gestión de la Bolsa Laboral del ${inst().nombre}`) + bTabs('p')
    + `<div class="pz-welcome"><div><h2>Bienvenido al panel de la Bolsa Laboral</h2><p>Conecta a estudiantes y egresados con empresas validadas por ${esc(window.pzBolsaCfg().responsable || 'el instituto')}.</p></div><a class="btn gold" href="#/admin/ix-bolsa/gestion">${sic('plus')} Nueva convocatoria</a></div>
    <div class="pz-kpis">${K('users', 'var(--sky);color:var(--link)', est, 'Estudiantes', can('ix-alumnos') ? '#/admin/ix-alumnos' : '#/admin/ix-bolsa/padron', 'Regulares en el maestro')}${K('grad', 'var(--sky);color:var(--link)', egr, 'Egresados', '#/admin/ix-bolsa/egresados', 'Egresados y titulados')}${K('building', 'var(--sky);color:var(--link)', empA, 'Empresas', '#/admin/ix-bolsa/empresas', 'Aprobadas')}${K('briefcase', 'var(--sky);color:var(--link)', conv, 'Convocatorias', '#/admin/ix-bolsa/gestion', 'Vigentes')}
      ${K('file', 'var(--sky);color:var(--link)', post, 'Postulaciones', '#/admin/ix-bolsa/gestion')}${K('clock', 'var(--sky);color:var(--link)', rev, 'En revisión', '#/admin/ix-bolsa/gestion')}${K('check', 'var(--sky);color:var(--link)', sel, 'Seleccionados', '#/admin/ix-bolsa/gestion')}${K('alert', 'var(--sky);color:var(--link)', empP, 'Empresas pendientes', '#/admin/ix-bolsa/empresas', 'Por validar')}</div>
    <div class="pz-dash"><div class="panel"><h2><span>Convocatorias recientes</span><a class="btn xs ghost" href="#/admin/ix-bolsa/gestion">Ver todas</a></h2><div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>Convocatoria</th><th>Empresa</th><th>Modalidad</th><th class="c">Estado</th><th class="num">Postulaciones</th></tr></thead><tbody>${ofs.map(o => `<tr><td><b>${esc(o.puesto)}</b><br><small style="color:var(--muted)">Publicado ${fdx(o.fecha)}</small></td><td>${esc(xemp(o.emp).nom)}</td><td>${esc(o.modal)}</td><td class="c">${stBadge(o.estado === 'Publicada' && o.limite < hoy ? 'Cerrada' : o.estado)}</td><td class="num">${D.postulaciones.filter(p => p.of === o.id).length}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">Sin convocatorias.</div></td></tr>'}</tbody></table></div></div>
      <div class="panel"><h2><span>Empresas recientes</span><a class="btn xs ghost" href="#/admin/ix-bolsa/empresas">Ver</a></h2><div class="pb pz-emps">${emps.map(e => `<div>${ic('building')}<span><b>${esc(e.nom)}</b><small>RUC ${esc(e.ruc)}</small>${empBadge(e)}</span></div>`).join('') || '<p class="note">Sin empresas.</p>'}<a class="btn ghost sm" href="#/servicios/bolsa-laboral?registro=1" target="_blank" style="justify-self:stretch;text-align:center">${sic('plus')} Registrar empresa</a></div></div></div>
    <div class="panel" style="margin-top:16px"><h2><span>Últimas postulaciones</span><a class="btn xs ghost" href="#/admin/ix-bolsa/gestion">Ver todas</a></h2><div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>Postulante</th><th>Convocatoria</th><th>Fecha</th><th class="c">Estado</th></tr></thead><tbody>${posts.map(p => { const s = xest(p.est), o = D.ofertas.find(x => x.id === p.of) || {}; return `<tr><td><span class="pz-av">${esc(String(s.nom).split(' ').slice(0, 2).map(w => w[0]).join(''))}</span> <b>${esc(s.nom)}</b><br><small style="color:var(--muted);margin-left:36px">${s.estado === 'Regular' ? 'Estudiante' : esc(s.estado)}</small></td><td>${esc(o.puesto || '—')}</td><td>${fdx(p.fecha)}</td><td class="c">${stBadge(p.estado === 'Recibida' ? 'Recibido' : p.estado)}</td></tr>`; }).join('') || '<tr><td colspan="4"><div class="empty">Sin postulaciones.</div></td></tr>'}</tbody></table></div></div>
    <h2 class="pz-h2">Acciones rápidas</h2><div class="pz-qa">${can('ix-alumnos') ? '<a href="#/admin/ix-alumnos">' + ic('users') + '<span>Registrar estudiante</span></a>' : ''}<a href="#/admin/ix-bolsa/padron">${ic('grad')}<span>Registrar egresados (padrón Excel)</span></a><a href="#/servicios/bolsa-laboral?registro=1" target="_blank">${ic('building')}<span>Registrar empresa</span></a><a href="#/admin/ix-bolsa/gestion">${ic('briefcase')}<span>Publicar convocatoria</span></a></div>`;
  return { html };
}
/* ---------- Validación de empresas ---------- */
function bolsaEmpresas() {
  const D = XD(); const c = window.pzBolsaCfg(); const st = ADM.state.pzEmp = ADM.state.pzEmp || { f: 'Pendiente' };
  const rows = D.empresas.filter(e => !st.f || empEstado(e) === st.f).sort((a, b) => (b.id || 0) - (a.id || 0));
  const n = s => D.empresas.filter(e => empEstado(e) === s).length;
  const html = bHead('Registro libre de empresas: criterios de validación y aprobación de cuentas', 'Validación de empresas') + bTabs('e')
    + `<div class="pz-dash"><div class="panel"><h2><span>Solicitudes de empresas</span><span style="display:flex;gap:6px;flex-wrap:wrap">${['Pendiente', 'Aprobada', 'Rechazada', ''].map(s => `<button class="btn xs ${st.f === s ? '' : 'ghost'}" data-ef="${s}">${s || 'Todas'} (${s ? n(s) : D.empresas.length})</button>`).join('')}</span></h2>
      <div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>Empresa</th><th>RUC</th><th>Contacto</th><th>Registro</th><th class="c">Estado</th><th class="c">Acciones</th></tr></thead><tbody>${rows.map(e => `<tr data-eid="${e.id}"><td><b>${esc(e.nom)}</b><br><small>${esc(e.sector)} · ${esc(e.ubic)}</small>${e.dir ? `<br><small>${esc(e.dir)}</small>` : ''}</td><td class="mono">${esc(e.ruc)}<br>${rucOk(e.ruc) ? '<span class="badge ok">Dígito verificador válido</span>' : '<span class="badge err">RUC no válido</span>'}</td><td>${esc(e.contacto)}${e.cargoC ? `<br><small>${esc(e.cargoC)}</small>` : ''}<br><small><a href="mailto:${esc(e.correo)}">${esc(e.correo)}</a>${e.tel ? ' · ' + esc(e.tel) : ''}</small></td><td>${fdx(e.fechaReg)}</td><td class="c">${empBadge(e)}${e.motivoRech ? `<br><small>${esc(clamp(e.motivoRech, 60))}</small>` : ''}${e.valPor ? `<br><small>por ${esc(e.valPor)}</small>` : ''}</td><td class="c" style="white-space:nowrap">${empEstado(e) !== 'Aprobada' ? `<button class="btn xs ok" data-eap>${sic('check', 13)} Aprobar</button>` : ''} ${empEstado(e) !== 'Rechazada' ? `<button class="btn xs danger" data-erj>${sic('x', 13)} ${empEstado(e) === 'Aprobada' ? 'Suspender' : 'Rechazar'}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">No hay empresas en esta categoría.</div></td></tr>'}</tbody></table></div></div>
      <form class="panel" data-bcfg><h2>Criterios y responsable</h2><div class="pb" style="display:grid;gap:10px"><div class="field"><label for="bc-r">Responsable de la aprobación</label><input id="bc-r" name="responsable" value="${esc(c.responsable)}"></div><div class="field"><label for="bc-j">Cargo</label><input id="bc-j" name="jefe" value="${esc(c.jefe)}"></div><div class="field"><label for="bc-c">Correo</label><input id="bc-c" name="correo" type="email" value="${esc(c.correo)}"></div><div class="field"><label for="bc-k">Criterios de validación (uno por línea)</label><textarea id="bc-k" name="criterios" rows="8">${esc(c.criterios.join('\n'))}</textarea></div><button class="btn sec">Guardar criterios</button><p class="note">Los criterios se muestran en el formulario público de registro de empresas.</p></div></form></div>`;
  const act = async (e, ok) => {
    if(!canWriteAcademic('bolsa'))return toast('Tu perfil dispone de consulta de empresas.', 'warn');
    const me = currentUser(); const u = coll('usuarios').find(x => x.vin === 'emp:' + e.id);
    let motivo = '';
    if (!ok) { motivo = await promptBox(`Motivo ${empEstado(e) === 'Aprobada' ? 'de la suspensión' : 'del rechazo'} de ${esc(e.nom)} (se enviará a la empresa):`, { title: 'Rechazar empresa', ok: 'Confirmar', textarea: true }); if (motivo == null) return; if (motivo.trim().length < 5) return toast('Indique el motivo.', 'err'); }
    e.validada = ok; e.estadoVal = ok ? 'Aprobada' : 'Rechazada'; e.motivoRech = ok ? '' : motivo.trim(); e.valPor = me.usuario; e.fechaVal = ymd(new Date());
    if (u && u.ixId) IX.notifyTo('u:' + u.ixId, ok ? 'Tu empresa fue aprobada: ya puedes publicar convocatorias' : 'Tu solicitud de empresa no fue aprobada: ' + e.motivoRech, 'bolsa');
    mailOut(e.correo, ok ? `Cuenta de empresa aprobada - Bolsa laboral ${inst().nombre}` : `Cuenta de empresa no aprobada - Bolsa laboral ${inst().nombre}`, ok ? `La empresa ${e.nom} fue validada por la ${c.responsable}. Ingrese con su RUC y contraseña.` : `Motivo: ${e.motivoRech}`);
    IX.logAct(ok ? 'Aprobar empresa' : 'Rechazar empresa', 'Bolsa laboral', `${e.nom} (RUC ${e.ruc})${ok ? '' : ' · ' + e.motivoRech}`); if(!IX.persist())return false; toast(ok ? `${e.nom} aprobada. Aviso registrado en la cola de correo.` : `${e.nom} rechazada. Aviso registrado en la cola de correo.`, 'ok'); route();
  };
  return { html, after: () => {
    $$('[data-ef]').forEach(b => b.onclick = () => { st.f = b.dataset.ef; route(); });
    $$('[data-eid]').forEach(tr => { const e = D.empresas.find(x => String(x.id) === tr.dataset.eid); const a = $('[data-eap]', tr), r = $('[data-erj]', tr); if (a) a.onclick = () => { if (!rucOk(e.ruc)) toast('Atención: el RUC no supera la validación del dígito verificador.', 'err'); act(e, true); }; if (r) r.onclick = () => act(e, false); });
    if(!canWriteAcademic('bolsa'))$$('[data-eap],[data-erj]').forEach(b=>b.disabled=true);
    const f = $('[data-bcfg]'); const cfgEdit=['admin','atencion'].includes(currentUser()?.rol); if(!cfgEdit)$$('input,textarea,button',f).forEach(el=>el.disabled=true); f.onsubmit = ev => { ev.preventDefault(); if(!cfgEdit)return; if (!reEmail.test(f.correo.value)) return toast('Correo no válido.', 'err'); Object.assign(c, { responsable: f.responsable.value.trim(), jefe: f.jefe.value.trim(), correo: f.correo.value.trim(), criterios: f.criterios.value.split('\n').map(s => s.trim()).filter(Boolean) }); audit('Configuración', 'Bolsa laboral', 'Criterios de validación de empresas'); if (saveDB()) { toast('Criterios guardados.', 'ok'); route(); } };
  } };
}
/* ---------- Padrón Excel de estudiantes y egresados ---------- */
const PADRON_COLS = ['DNI', 'Apellidos y Nombres', 'Condición', 'Fecha de Nacimiento', 'Correo', 'Domicilio', 'Celular', 'Programa de Estudio', 'Año de Egreso', 'Dónde labora', 'Área'];
const nrm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function headKey(h) { const t = nrm(h); if (/^dni|documento/.test(t)) return 'dni'; if (/apellido|nombre/.test(t)) return 'nom'; if (/condicion|situacion|estado/.test(t)) return 'cond'; if (/nacimiento/.test(t)) return 'fnac'; if (/correo|email|e mail/.test(t)) return 'correo'; if (/domicilio|direccion/.test(t)) return 'dom'; if (/celular|telefono|movil/.test(t)) return 'tel'; if (/programa|carrera|especialidad/.test(t)) return 'prog'; if (/egreso|promocion/.test(t)) return 'anio'; if (/labora|trabaja|empresa|centro/.test(t)) return 'labora'; if (/^area|cargo|puesto/.test(t)) return 'areaLab'; return null; }
function progFromText(t) {
  const text=nrm(t); if(!text)return '';
  const catalog=coll('programas');
  const direct=catalog.find(p=>[p.id,p.codigo,p.nombre].some(v=>nrm(v)===text));
  if(direct)return direct.id;
  const aliases=[[/comput|informat|apsti|plataforma|tecnologias de (la )?informacion|sistemas/,['apsti']],[/contab/,['cont']],[/enferm/,['enf']],[/agropecu|agrari|agronom/,['pa']],[/turism|guia oficial/,['got','ashr']],[/electricidad/,['ei']],[/electronica/,['eli']],[/mecatronica|automotriz/,['ma']],[/hostel|restaur|ashr|gastron|hotel/,['ashr']]];
  for(const[pattern,ids]of aliases)if(pattern.test(text)){const match=catalog.find(p=>ids.includes(nrm(p.id))||ids.includes(nrm(p.codigo)));return match?.id||'';}
  return '';
}
function condFromText(t) { t = nrm(t); if (/titulad/.test(t)) return 'Titulado'; if (/egresad/.test(t)) return 'Egresado'; if (/por concluir|estudiante|regular|cursando|matriculad/.test(t)) return 'Regular'; return ''; }
function excelDate(v) { if (v instanceof Date && !isNaN(v)) return ymd(v); if (typeof v === 'number' && v > 59 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); } const s = String(v || '').trim(); let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`; m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0]; return ''; }
function parsePadron(rows) {
  const D = XD(); if (!rows.length) return { items: [], error: 'El archivo no tiene filas.' };
  const keys = Object.keys(rows[0]).map(h => [h, headKey(h)]); const has = k => keys.some(x => x[1] === k);
  if (!has('dni') || !has('nom')) return { items: [], error: 'No se encontraron las columnas obligatorias “DNI” y “Apellidos y Nombres”. Use la plantilla.' };
  const seen = new Set();
  const items = rows.map((r, i) => {
    const o = {}; keys.forEach(([h, k]) => { if (k && o[k] == null) o[k] = r[h]; });
    let dni = String(o.dni == null ? '' : o.dni).replace(/\D/g, ''); if (dni.length === 7) dni = '0' + dni;
    const it = { fila: i + 2, dni, nom: String(o.nom || '').trim().replace(/\s+/g, ' ').toUpperCase(), condTxt: String(o.cond || '').trim(), estado: condFromText(o.cond), fnac: excelDate(o.fnac), correo: String(o.correo || '').trim().toLowerCase(), dom: String(o.dom || '').trim(), tel: String(o.tel || '').replace(/\D/g, '').slice(-9), progTxt: String(o.prog || '').trim(), pid: progFromText(o.prog), anio: String(o.anio || '').replace(/\D/g, '').slice(0, 4), labora: String(o.labora || '').trim(), areaLab: String(o.areaLab || '').trim(), errs: [], warns: [] };
    if (!/^\d{8}$/.test(it.dni)) it.errs.push('DNI no válido'); else if (seen.has(it.dni)) it.errs.push('DNI repetido en el archivo'); seen.add(it.dni);
    if (it.nom.length < 5) it.errs.push('Falta apellidos y nombres');
    if (!it.pid) it.errs.push('Programa no reconocido'); else if (!(D.progMap || {})[it.pid]) it.errs.push('Programa no registrado en el sistema');
    if (!it.estado) { it.estado = it.anio ? 'Egresado' : 'Regular'; it.warns.push(`Condición “${it.condTxt || 'vacía'}” asumida como ${it.estado === 'Regular' ? 'estudiante' : 'egresado'}`); }
    if (it.correo && !reEmail.test(it.correo)) { it.warns.push('Correo no válido (se omitirá)'); it.correo = ''; }
    if (it.tel && it.tel.length !== 9) { it.warns.push('Celular no válido (se omitirá)'); it.tel = ''; }
    it.existe = !!D.estudiantes.find(e => e.dni === it.dni);
    return it;
  });
  return { items };
}
async function readSheet(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (window.XLSX) { const isCSV = ext === 'csv'; const content = isCSV ? (await file.text()).replace(/^\uFEFF/, '') : await file.arrayBuffer(); const wb = XLSX.read(content, { type: isCSV ? 'string' : 'array', cellDates: true, ...(isCSV ? { raw: true } : {}) }); const ws = wb.Sheets[wb.SheetNames[0]]; return XLSX.utils.sheet_to_json(ws, { defval: '', raw: true }); }
  if (ext !== 'csv') throw new Error('Para leer archivos Excel se requiere conexión a internet (librería XLSX). Puede usar la plantilla en CSV.');
  const txt = (await readAsText(file)).replace(/^﻿/, ''); const lines = txt.split(/\r?\n/).filter(l => l.trim()); const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const cells = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); };
  const h = cells(lines[0]); return lines.slice(1).map(l => { const c = cells(l); const o = {}; h.forEach((k, i) => o[k] = c[i] || ''); return o; });
}
function padronTemplate() {
  const rows = [PADRON_COLS, ['70000001', 'APELLIDO APELLIDO, NOMBRES (EJEMPLO)', 'Egresado', '15/03/2000', 'iestp@iestppisco.edu.pe', 'Av. Ejemplo 123, Ica', '900000001', 'Arquitectura de Plataformas y Servicios de Tecnologías de Información', '2024', 'Empresa de ejemplo S.A.C.', 'Soporte técnico'], ['70000002', 'APELLIDO APELLIDO, NOMBRES (EJEMPLO)', 'Por Concluir', '02/08/2004', '', '', '900000002', 'Contabilidad', '', '', '']];
  if (window.XLSX) { const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = PADRON_COLS.map((c, i) => ({ wch: [10, 38, 14, 14, 26, 30, 12, 50, 12, 28, 18][i] })); XLSX.utils.book_append_sheet(wb, ws, 'Padron'); const ins = XLSX.utils.aoa_to_sheet([['Instrucciones de llenado'], ['DNI: 8 dígitos (obligatorio).'], ['Apellidos y Nombres: obligatorio.'], ['Condición: Egresado, Titulado o Por Concluir (estudiante).'], ['Programa de Estudio: ASHR, APSTI (o Computación e Informática), Contabilidad, Enfermería Técnica, Producción Agropecuaria.'], ['Fecha de nacimiento: DD/MM/AAAA. Celular: 9 dígitos.'], ['Si el DNI ya existe se actualizan sus datos; si no, se registra.']]); XLSX.utils.book_append_sheet(wb, ins, 'Instrucciones'); downloadBlob(new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'plantilla_padron_estudiantes_egresados.xlsx'); }
  else downloadText(toCSV(rows), 'plantilla_padron_estudiantes_egresados.csv', 'text/csv');
}
let PADRON_PREV = null;
function bolsaPadron() {
  const D = XD(); const egr = D.estudiantes.filter(e => ['Egresado', 'Titulado'].includes(e.estado)).length; const imp = D.estudiantes.filter(e => e.origen === 'Padrón Excel').length;
  const P = PADRON_PREV; const ok = P ? P.items.filter(i => !i.errs.length) : [];
  const html = bHead('Carga inicial y actualización del padrón de estudiantes y egresados (Excel)', 'Padrón') + bTabs('r')
    + `<div class="kpis">${kpi('users', 'var(--blue)', D.estudiantes.length, 'Registros en el maestro de alumnos')}${kpi('grad', 'var(--ok)', egr, 'Egresados y titulados')}${kpi('upload', 'var(--navy2)', imp, 'Cargados desde Excel')}</div>
    <div class="panel"><h2>1. Descargue la plantilla y complete el padrón</h2><div class="pb"><p>Columnas: ${PADRON_COLS.map(c => `<code>${c}</code>`).join(' ')}. Se aceptan archivos <b>.xlsx, .xls o .csv</b> (por ejemplo, la “Relación de egresados” exportada desde Google Sheets). El sistema reconoce los nombres de columna aunque varíen ligeramente y asocia “Computación e Informática” al programa APSTI.</p><button class="btn sec" data-tpl>${sic('download')} Descargar plantilla Excel</button></div></div>
    <div class="panel"><h2>2. Suba el archivo y revise la validación</h2><div class="pb"><div class="field"><label for="pd-f">Archivo del padrón</label><input id="pd-f" type="file" accept=".xlsx,.xls,.csv"><div class="hint">Máx. 10 MB. La responsabilidad de la carga y actualización es del responsable del Portal Web.</div></div><div id="pd-msg"></div>
    ${P ? `<div class="notice ${P.error ? 'err' : ''}" style="margin-top:12px">${P.error ? esc(P.error) : `<b>${esc(P.nombre)}</b>: ${P.items.length} fila(s) · <b>${ok.length}</b> válidas (${ok.filter(i => i.existe).length} actualizaciones, ${ok.filter(i => !i.existe).length} nuevos) · <b>${P.items.length - ok.length}</b> con errores.`}</div>
    ${P.items.length ? `<div class="tbl-wrap" style="max-height:420px;overflow:auto;margin-top:10px"><table class="tbl light"><thead><tr><th>Fila</th><th>DNI</th><th>Apellidos y nombres</th><th>Condición</th><th>Programa</th><th>Año egreso</th><th>Dónde labora</th><th>Resultado</th></tr></thead><tbody>${P.items.map(i => `<tr class="${i.errs.length ? 'pz-bad' : ''}"><td>${i.fila}</td><td class="mono">${esc(canFlag('viewDni') ? i.dni : maskDni(i.dni))}</td><td>${esc(i.nom)}</td><td>${esc(i.estado === 'Regular' ? 'Por concluir' : i.estado)}</td><td>${esc(i.pid ? i.pid.toUpperCase() : i.progTxt)}</td><td>${esc(i.anio)}</td><td>${esc(i.labora)}${i.areaLab ? `<br><small>${esc(i.areaLab)}</small>` : ''}</td><td>${i.errs.length ? `<span class="badge err">${esc(i.errs.join(' · '))}</span>` : `<span class="badge ok">${i.existe ? 'Actualizar' : 'Nuevo'}</span>`}${i.warns.length ? `<br><small style="color:var(--warn)">${esc(i.warns.join(' · '))}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-pdx>Descartar</button><button class="btn" data-pdi ${ok.length ? '' : 'disabled'}>${sic('upload')} Importar ${ok.length} registro(s) válidos</button></div>` : ''}` : ''}</div></div>`;
  return { html, after: () => {
    $('[data-tpl]').onclick = padronTemplate;
    $('#pd-f').disabled=!canWriteAcademic('alumnos'); if(!canWriteAcademic('alumnos'))$('#pd-msg').textContent='Tu perfil dispone de consulta. La importación requiere permiso de edición del maestro de alumnos.';
    $('#pd-f').onchange = async ev => { if(!canWriteAcademic('alumnos'))return; const file = ev.target.files[0]; if (!file) return; const e0 = checkUpload(file, ['xlsx', 'xls', 'csv'], 10); if (e0) { $('#pd-msg').innerHTML = `<div class="notice err">${esc(e0)}</div>`; return; }
      try { const rows = await readSheet(file); const r = parsePadron(rows); PADRON_PREV = Object.assign({ nombre: file.name }, r); } catch (err) { PADRON_PREV = { nombre: file.name, items: [], error: 'No se pudo leer el archivo: ' + (err.message || err) }; } route(); };
    const x = $('[data-pdx]'); if (x) x.onclick = () => { PADRON_PREV = null; route(); };
    const im = $('[data-pdi]'); if(im&&!canWriteAcademic('alumnos'))im.disabled=true; if (im) im.onclick = async () => {
      if(!canWriteAcademic('alumnos'))return;
      if (!await confirmBox(`Se importarán ${ok.length} registro(s): ${ok.filter(i => !i.existe).length} nuevos y ${ok.filter(i => i.existe).length} actualizaciones. ¿Continuar?`, { ok: 'Importar', danger: false, title: 'Importar padrón' })) return;
      let nN = 0, nU = 0; const per = D.cfg.periodo;
      ok.forEach(i => { const progId = D.progMap[i.pid]; const data = { nom: i.nom, prog: progId, estado: i.estado, fnac: i.fnac, dom: i.dom, anioEgreso: i.anio, labora: i.labora, areaLab: i.areaLab, origen: 'Padrón Excel', actualizado: new Date().toISOString().slice(0, 10) }; if (i.correo) data.correo = i.correo; if (i.tel) data.tel = i.tel;
        const ex = D.estudiantes.find(e => e.dni === i.dni);
        if (ex) { Object.assign(ex, data); nU++; } else { D.estudiantes.push(Object.assign({ id: IX.nextIdOf('estudiantes'), dni: i.dni, periodo: i.anio && +i.anio > 1980 ? `${+i.anio - 3}-I` : per, ciclo: i.estado === 'Regular' ? 'VI' : 'VI', sec: 'A', turno: 'Mañana', correo: '', tel: '' }, data)); nN++; } });
      IX.logAct('Importar padrón Excel', 'Bolsa laboral', `${PADRON_PREV.nombre}: ${nN} nuevos, ${nU} actualizados`); if(!IX.persist())return false; PADRON_PREV = null;
      toast(`Padrón importado: ${nN} nuevo(s) y ${nU} actualizado(s).`, 'ok'); go('#/admin/ix-bolsa/egresados');
    };
  } };
}
/* ---------- Seguimiento de egresados ---------- */
function bolsaEgresados(q) {
  const D = XD(); const st = ADM.state.pzEgr = ADM.state.pzEgr || { q: '', p: '', c: '' };
  let rows = D.estudiantes.filter(e => ['Egresado', 'Titulado'].includes(e.estado) || e.origen === 'Padrón Excel');
  if (st.p) rows = rows.filter(e => String(e.prog) === st.p); if (st.c) rows = rows.filter(e => e.estado === st.c);
  if (st.q) { const t = nrm(st.q); rows = rows.filter(e => nrm([e.dni, e.nom, e.labora, e.areaLab].join(' ')).includes(t)); }
  rows.sort((a, b) => a.nom.localeCompare(b.nom));
  const lab = rows.filter(e => e.labora).length;
  const html = bHead('Relación de estudiantes por concluir, egresados y titulados, con su situación laboral', 'Seguimiento de egresados') + bTabs('s')
    + `<div class="kpis">${kpi('grad', 'var(--ok)', rows.length, 'Registros en la vista')}${kpi('briefcase', 'var(--blue)', lab, 'Con empleo registrado')}${kpi('chart', 'var(--navy2)', rows.length ? Math.round(lab * 100 / rows.length) + ' %' : '—', 'Inserción laboral declarada')}</div>
    <form class="filters" data-ef2><div class="field"><label for="eg-q">Buscar</label><input id="eg-q" name="q" value="${esc(st.q)}" placeholder="DNI, nombre o empresa"></div><div class="field"><label for="eg-p">Programa</label><select id="eg-p" name="p"><option value="">Todos</option>${D.programas.map(p => `<option value="${p.id}" ${String(p.id) === st.p ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div><div class="field"><label for="eg-c">Condición</label><select id="eg-c" name="c"><option value="">Todas</option>${[['Regular', 'Por concluir'], ['Egresado', 'Egresado'], ['Titulado', 'Titulado']].map(([v, l]) => `<option value="${v}" ${st.c === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="field" style="align-self:end;display:flex;gap:8px"><button class="btn">Filtrar</button><button type="button" class="btn ghost" data-xx>${sic('download')} Excel</button></div></form>
    <div class="panel"><div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>DNI</th><th>Apellidos y nombres</th><th>Condición</th><th>Programa</th><th>Año egreso</th><th>Dónde labora</th><th>Área</th><th>Contacto</th></tr></thead><tbody>${rows.slice(0, 300).map(e => `<tr><td class="mono">${esc(canFlag('viewDni') ? e.dni : maskDni(e.dni))}</td><td><b>${esc(e.nom)}</b></td><td>${stBadge(e.estado === 'Regular' ? 'Por concluir' : e.estado)}</td><td>${esc(xprog(e.prog).cod || xprog(e.prog).nombre)}</td><td>${esc(e.anioEgreso || '—')}</td><td>${esc(e.labora || '—')}</td><td>${esc(e.areaLab || '—')}</td><td><small>${esc(e.tel || '')}${e.correo ? '<br>' + esc(e.correo) : ''}</small></td></tr>`).join('') || '<tr><td colspan="8"><div class="empty">No hay registros. Cargue el padrón desde la pestaña “Padrón”.</div></td></tr>'}</tbody></table></div>${rows.length > 300 ? `<p class="note" style="padding:8px 16px">Se muestran 300 de ${rows.length}; exporte a Excel para ver todos.</p>` : ''}</div>`;
  return { html, after: () => { const f = $('[data-ef2]'); f.onsubmit = e => { e.preventDefault(); Object.assign(st, { q: f.q.value.trim(), p: f.p.value, c: f.c.value }); route(); };
    $('[data-xx]').onclick = () => { const head = ['DNI', 'Apellidos y Nombres', 'Condición', 'Fecha de Nacimiento', 'Correo', 'Domicilio', 'Celular', 'Programa de Estudio', 'Año de Egreso', 'Dónde labora', 'Área']; const data = rows.map(e => [canFlag('viewDni') ? e.dni : maskDni(e.dni), e.nom, e.estado === 'Regular' ? 'Por Concluir' : e.estado, e.fnac || '', e.correo || '', e.dom || '', e.tel || '', xprog(e.prog).nombre, e.anioEgreso || '', e.labora || '', e.areaLab || '']);
      if (window.XLSX) { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head].concat(data)), 'Egresados'); downloadBlob(new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]), 'seguimiento_egresados.xlsx'); } else downloadText(toCSV([head].concat(data)), 'seguimiento_egresados.csv', 'text/csv'); audit('Exportación', 'Bolsa laboral', 'Seguimiento de egresados'); saveDB(); }; } };
}

/* ---------- Bolsa laboral pública: acceso por tipo de usuario + registro de empresas ---------- */
R('servicios/bolsa-laboral', (path, q) => {
  const D = IX && IX.db ? XD() : null; const hoy = ymd(new Date());
  const nOf = D ? D.ofertas.filter(o => o.estado === 'Publicada' && o.limite >= hoy).length : 0, nEmp = D ? D.empresas.filter(e => e.validada).length : 0;
  const body = `<div class="pz-bl"><div class="pz-bl-l"><span class="pz-bl-ic">${ic('briefcase')}</span><h1>Bolsa <span>Laboral</span></h1><b>${esc(inst().nombre)}</b><p>Plataforma institucional para conectar estudiantes y egresados con empresas y oportunidades laborales.</p><div class="pz-bl-3"><span>${ic('grad')}Estudiantes</span><span>${ic('award')}Egresados</span><span>${ic('building')}Empresas</span></div><div class="pz-bl-n"><span><b>${nOf}</b> convocatorias vigentes</span><span><b>${nEmp}</b> empresas aliadas</span></div></div>
    <form class="pz-bl-r" data-blog novalidate><span class="pz-bl-ic sm">${ic('user')}</span><h2>Iniciar sesión</h2><small>Bolsa Laboral · ${esc(inst().nombreCorto)}</small>
      <div class="field"><label for="bl-t">Tipo de usuario</label><select id="bl-t" name="tipo"><option value="">Seleccione su rol</option><option value="estudiante">Estudiante</option><option value="egresado">Egresado</option><option value="empresa">Empresa</option></select></div>
      <div class="field"><label for="bl-u">Usuario (DNI o RUC)</label><input id="bl-u" name="u" autocomplete="username" placeholder="DNI o RUC"></div>
      <div class="field"><label for="bl-p">Contraseña</label><input id="bl-p" name="p" type="password" autocomplete="current-password"></div>
      <div class="pz-bl-row"><label class="check"><input type="checkbox" name="rec"> Recordarme</label><a href="#" data-olv>¿Olvidaste tu contraseña?</a></div>
      <div id="bl-e" role="alert" class="pz-err"></div><button class="btn" style="width:100%">${S16('key')} Iniciar sesión</button>
      <div class="pz-bl-emp"><b>${S16('building')} ¿Representas a una empresa?</b><small>Registra tu empresa y publica ofertas laborales. El registro es libre y gratuito.</small><button type="button" class="btn pz-orange" data-reg style="width:100%">${S16('plus')} Registrar empresa</button></div></form></div>
    <h2 class="pz-h2" id="bl-ofertas">Ofertas y registro de empresas</h2>${ixWrap(IX.view('pub:bolsa'))}`;
  const html = shell(path, { title: 'Bolsa laboral', desc: `Bolsa Laboral del ${inst().nombre}: convocatorias para estudiantes y egresados y registro libre de empresas.`, crumbs: [['Servicios', '#/servicios/complementarios'], ['Bolsa laboral']], banner: { kicker: 'Servicios', title: 'Bolsa Laboral', text: 'Conectamos talento con empresas' }, side: servSide('bolsa-laboral') + `<section class="side-box"><h2>Validación de empresas</h2><div class="pad" style="font-size:13px">Responsable: <b>${esc(window.pzBolsaCfg().responsable)}</b><br><a href="mailto:${esc(window.pzBolsaCfg().correo)}">${esc(window.pzBolsaCfg().correo)}</a></div></section>`, body });
  return { html, after: () => {
    const f = $('[data-blog]'); try { const r = localStorage.getItem('pz_bl_user'); if (r) { const [t, u] = JSON.parse(r); f.tipo.value = t; f.u.value = u; f.rec.checked = true; } } catch (e) { }
    $('[data-olv]').onclick = e => { e.preventDefault(); modal({ title: 'Recuperar contraseña', body: `<p>Por seguridad, la contraseña se restablece en la institución.</p><ul><li><b>Estudiantes y egresados:</b> Secretaría Académica (${esc(inst().correo)}).</li><li><b>Empresas:</b> ${esc(window.pzBolsaCfg().responsable)} (${esc(window.pzBolsaCfg().correo)}).</li></ul>` }); };
    const openReg = () => { const b = $('[data-tab="pubbolsa:empresa"]'); if (b) b.click(); setTimeout(() => { const t = $('#bl-ofertas'); t && t.scrollIntoView({ behavior: 'smooth' }); }, 60); };
    $('[data-reg]').onclick = openReg; if (q && q.get && q.get('registro')) setTimeout(openReg, 50);
    f.onsubmit=e=>{e.preventDefault();$('#bl-e').textContent='Recarga la página para conectar con el servicio de autenticación.';};
  } };
});


/* =========================================================
   1.1 PLANA DOCENTE + SISTEMA DE CV DOCENTE
   ========================================================= */
const CV_COMP = ['Trabajo en equipo', 'Comunicación efectiva', 'Resolución de problemas', 'Gestión de proyectos', 'Liderazgo', 'Planificación', 'Pensamiento crítico', 'Adaptabilidad al cambio', 'Orientación al logro', 'Ética profesional'];
const CV_ENF = ['Enfoque ambiental', 'Enfoque intercultural', 'Enfoque de igualdad de género', 'Enfoque orientado al bien común', 'Enfoque de derechos', 'Enfoque inclusivo o de atención a la diversidad', 'Enfoque de búsqueda de la excelencia'];
const F_EXP = [['institucion', 'Institución / empresa'], ['cargo', 'Cargo'], ['descripcion', 'Descripción de funciones', '', 'textarea'], ['periodo', 'Periodo', '2019 - Actualidad'], ['tiempo', 'Tiempo', '5 años']];
const F_EST = [['anio', 'Año / periodo', '2005 - 2010'], ['nivel', 'Nivel / grado obtenido', 'Título profesional'], ['especialidad', 'Especialidad', 'Ingeniería de Sistemas'], ['institucion', 'Institución'], ['lugar', 'Lugar', 'Ica']];
const CVL = {
  pregrado: { t: 'Estudios de pregrado', f: F_EST }, posgrado: { t: 'Estudios de posgrado', f: F_EST },
  continua: { t: 'Formación continua', f: [['curso', 'Curso / programa'], ['institucion', 'Institución'], ['tema', 'Tema'], ['periodo', 'Periodo', '10/03/2024 - 30/04/2024'], ['horas', 'Horas', '120', 'number']] },
  expProf: { t: 'Experiencia profesional (sector productivo)', f: F_EXP }, expDocP: { t: 'Educación superior – presencial', f: F_EXP }, expDocS: { t: 'Educación superior – semipresencial / a distancia', f: F_EXP },
  innovacion: { t: 'Innovación tecnológica', f: [['evento', 'Evento / proyecto'], ['participacion', 'Participación', 'Participante'], ['fecha', 'Fecha / año', '2024']] },
};
const CVS = [
  { k: 'datos', t: 'Datos personales', icon: 'user', d: 'Registre nombres, DNI, fecha de nacimiento, teléfono, correo electrónico, dirección y su perfil profesional.' },
  { k: 'formacion', t: 'Formación académica', icon: 'grad', d: 'Registre estudios de pregrado y posgrado, especialidad, institución y fechas.', lists: ['pregrado', 'posgrado'] },
  { k: 'continua', t: 'Formación continua', icon: 'book', d: 'Cursos, programas, ofimática, idiomas y otras actividades de formación.', lists: ['continua'] },
  { k: 'experiencia', t: 'Experiencia profesional', icon: 'briefcase', d: 'Registre experiencia laboral en el sector productivo y cargos desempeñados.', lists: ['expProf'] },
  { k: 'docente', t: 'Experiencia docente', icon: 'monitor', d: 'Registre experiencia docente en educación superior presencial, semipresencial o a distancia.', lists: ['expDocP', 'expDocS'] },
  { k: 'competencias', t: 'Competencias', icon: 'award', d: 'Registre competencias para la empleabilidad, enfoques transversales y especializaciones.' },
  { k: 'innovacion', t: 'Innovación tecnológica', icon: 'zap', d: 'Eventos y proyectos de innovación, y su huella digital para la hoja de vida.', lists: ['innovacion'] },
  { k: 'documentos', t: 'Documentos y autorización', icon: 'shield', d: 'Adjunte su CV firmado y sustentos; autorice la publicación de sus datos (Ley N.º 29733).' },
];
function cvOf(p) {
  p.cv = Object.assign({ perfil: '', cargo: 'Docente de Educación Superior', fnac: '', sexo: p.fem ? 'Femenino' : 'Masculino', direccion: '', correoPersonal: '', pregrado: [], posgrado: [], continua: [], ofimatica: [], idiomas: [], expProf: [], expDocP: [], expDocS: [], competencias: [], enfoques: [], innovacion: [], huella: '', docs: [], cvPdf: null, autoriza: { ok: false, fecha: '', por: '' }, actualizado: '' }, p.cv || {});
  return p.cv;
}
function cvScore(p) {
  const c = cvOf(p); const pct = (a, b) => Math.round(Math.min(1, a / b) * 100);
  const dp = [c.perfil, p.dni, c.fnac, c.sexo, p.telefono, c.direccion, p.correo, p.foto && !String(p.foto).startsWith('ph:')].filter(Boolean).length;
  const s = {
    datos: pct(dp, 8), formacion: (c.pregrado.length ? 70 : 0) + (c.posgrado.length ? 30 : 0), continua: (c.continua.length ? 70 : 0) + (c.ofimatica.length || c.idiomas.length ? 30 : 0),
    experiencia: (c.expProf.length ? 50 : 0) + (c.expDocP.length || c.expDocS.length ? 50 : 0), docente: c.expDocP.length || c.expDocS.length ? 100 : 0,
    competencias: (c.competencias.length >= 3 ? 60 : c.competencias.length * 20) + (c.enfoques.length ? 40 : 0), innovacion: c.innovacion.length ? 100 : 0, documentos: (c.autoriza.ok ? 60 : 0) + (c.cvPdf || c.docs.length ? 40 : 0),
  };
  const keys = ['datos', 'formacion', 'continua', 'experiencia', 'competencias', 'innovacion', 'documentos'];
  s.total = Math.round(keys.reduce((a, k) => a + s[k], 0) / keys.length); return s;
}
const cvCanAll = () => { const u = currentUser(); return !!u && ['admin', 'secretaria'].includes(u.rol); };
const cvCanEdit = p => { const u = currentUser(); return !!u && (cvCanAll() || u.personaId === p.id); };
const docentesCV = () => alive('personas').filter(p => p.tipo === 'Docente' || (p.cv && p.cv.pregrado)).sort((a, b) => (a.apellidos || '').localeCompare(b.apellidos || ''));
const bar = (v, col = 'var(--blue)') => `<span class="pz-bar"><i style="width:${v}%;background:${col}"></i></span>`;

MODULES.cvdocente = 'CV Docente';
['admin', 'secretaria', 'docente'].forEach(r => { if (ROLES[r] && !ROLES[r].mods.includes('cvdocente')) ROLES[r].mods.push('cvdocente'); });
(NAV_GROUPS.find(g => g[0] === 'Nosotros') || NAV_GROUPS[0])[1].splice(2, 0, ['cvdocente', 'award']);

CUSTOM.cvdocente = (parts) => {
  const u = currentUser();
  let pid = parts[2]; if (!cvCanAll()) pid = u.personaId;
  if (!pid) return cvCanAll() ? cvLista() : { html: admHead('CV Docente', '', '', 'award') + '<div class="notice warn">Su usuario no está vinculado a una ficha docente. Solicite la vinculación al administrador.</div>' };
  const p = byId('personas', pid); if (!p) return { html: admHead('Docente no encontrado', '', '<a class="btn" href="#/admin/cvdocente">Volver</a>', 'award') };
  cvOf(p);
  const sec = parts[3]; if (sec) return cvSeccion(p, sec);
  return cvDashboard(p);
};
function cvLista() {
  const ds = docentesCV(); const sc = ds.map(p => [p, cvScore(p)]);
  const html = admHead('CV Docente', 'Sistema de gestión de CV para docentes: el responsable del Portal Web carga y actualiza la información; cada docente puede completar su propio CV desde su cuenta.', `<a class="btn ghost" href="#/nosotros/plana-docente" target="_blank">${sic('globe')} Ver plana docente</a>`, 'award', [['Nosotros'], ['CV Docente']])
    + `<div class="kpis">${kpi('users', 'var(--blue)', ds.length, 'Docentes y directivos con CV')}${kpi('check', 'var(--ok)', sc.filter(x => x[1].total >= 80).length, 'CV con 80 % o más')}${kpi('shield', 'var(--navy2)', ds.filter(p => p.cv && p.cv.autoriza && p.cv.autoriza.ok).length, 'Autorizaron publicación (Ley 29733)')}${kpi('alert', 'var(--warn)', ds.filter(p => !(p.cv && p.cv.autoriza && p.cv.autoriza.ok)).length, 'Sin autorización (no se publican)')}</div>
    <div class="panel"><div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>Docente</th><th>Programa(s)</th><th style="min-width:160px">CV completado</th><th class="c">Autorización</th><th class="c">Publicado</th><th class="c">Acciones</th></tr></thead><tbody>${sc.map(([p, s]) => `<tr><td><span style="display:flex;gap:10px;align-items:center"><img src="${img(p.foto)}" alt="" style="width:38px;height:38px;border-radius:50%;object-fit:cover"><span><b>${esc(fullName(p))}</b><br><small>${esc(p.especialidad || '')}</small></span></span></td><td><small>${(p.programas || []).map(x => esc((progById(x) || {}).codigo || x)).join(', ') || esc(p.tipo)}</small></td><td>${bar(s.total, s.total >= 80 ? 'var(--ok)' : s.total >= 50 ? 'var(--blue)' : 'var(--warn)')} <small>${s.total} %</small></td><td class="c">${p.cv && p.cv.autoriza.ok ? `<span class="badge ok">Autorizado</span><br><small>${fshort(p.cv.autoriza.fecha)}</small>` : '<span class="badge warn">Pendiente</span>'}</td><td class="c">${stBadge(p.estado)}</td><td class="c" style="white-space:nowrap"><a class="btn xs" href="#/admin/cvdocente/${p.id}">${sic('edit', 13)} Gestionar</a> <button class="btn xs ghost" data-cvpdf="${p.id}">${sic('download', 13)} CV</button></td></tr>`).join('')}</tbody></table></div></div>`;
  return { html, after: () => $$('[data-cvpdf]').forEach(b => b.onclick = () => cvDownload(byId('personas', b.dataset.cvpdf), 'download')) };
}
function cvDashboard(p) {
  const c = p.cv, s = cvScore(p); const own = currentUser().personaId === p.id; const nGr = c.pregrado.length + c.posgrado.length, nCap = c.continua.length, nExp = c.expProf.length + c.expDocP.length + c.expDocS.length;
  const base = `#/admin/cvdocente/${cvCanAll() ? p.id + '/' : p.id + '/'}`;
  const html = admHead('CV Docente', own ? 'Sistema de Gestión de CV para Docentes' : `CV de ${esc(fullName(p))}`, cvCanAll() ? `<a class="btn ghost" href="#/admin/cvdocente">${sic('back')} Todos los docentes</a>` : '', 'award', [['Nosotros'], ['CV Docente', '#/admin/cvdocente'], [fullName(p)]])
    + `<div class="pz-cvban"><div><h2>${own ? '¡Bienvenido al Sistema de CV Docente!' : esc(fullName(p))}</h2><p>${own ? 'Complete la información de su currículum vitae para generar su expediente docente.' : 'Gestione la hoja de vida que se publica en la Plana Docente del portal.'}</p><a class="btn" href="${base}datos">${sic('edit')} Completar ${own ? 'mi ' : ''}CV</a></div><img src="${img(p.foto)}" alt="Fotografía de ${esc(fullName(p))}"></div>
    <div class="pz-kpis"><div class="pz-kpi"><div><b>${s.total} %</b><span>CV completado</span>${bar(s.total)}</div><i style="background:var(--sky);color:var(--blue)">${ic('clipboard')}</i></div><div class="pz-kpi"><div><b>${nGr}</b><span>Grados académicos</span></div><i style="background:var(--sky);color:var(--blue)">${ic('grad')}</i></div><div class="pz-kpi"><div><b>${nCap}</b><span>Capacitaciones</span></div><i style="background:var(--sky);color:var(--blue)">${ic('book')}</i></div><div class="pz-kpi"><div><b>${nExp}</b><span>Experiencias registradas</span></div><i style="background:var(--sky);color:var(--blue)">${ic('briefcase')}</i></div></div>
    ${c.autoriza.ok ? '' : `<div class="notice warn">${sic('shield')} Falta la <b>autorización de publicación de datos personales (Ley N.º 29733)</b>. Sin ella, ${own ? 'su' : 'el'} CV no se muestra en la Plana Docente del portal. <a href="${base}documentos">Autorizar ahora</a></div>`}
    <div class="pz-h2row"><h2 class="pz-h2">Información del CV</h2><a class="btn sm" href="${base}formacion">${sic('plus')} Agregar información</a></div>
    <div class="pz-cvcards">${CVS.map(x => `<article><span class="pz-cvic">${ic(x.icon)}</span><h3>${x.t}</h3><p>${x.d}</p><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><a class="btn xs" href="${base}${x.k}">${x.k === 'datos' && s.datos < 100 ? 'Completar' : 'Gestionar'} →</a><small>${s[x.k]} %</small></div></article>`).join('')}</div>
    <div class="pz-dash"><div class="panel"><h2><span style="display:flex;gap:10px;align-items:center"><span class="pz-cvic sm">${ic('user')}</span><span>Perfil del docente<br><small style="font-weight:400;color:var(--muted)">Complete su información personal</small></span></span></h2><div class="pb pz-prog">${[['Datos personales', s.datos], ['Formación académica', s.formacion], ['Formación continua', s.continua], ['Experiencia', s.experiencia], ['Competencias', s.competencias], ['Innovación', s.innovacion], ['Documentos y autorización', s.documentos]].map(([l, v]) => `<div><span>${l}</span><b>${v}%</b>${bar(v)}</div>`).join('')}</div></div>
      <div class="panel"><h2>Acciones rápidas</h2><div class="pb pz-quick2"><button class="btn" data-gen>${sic('file')} Generar CV</button><a class="btn pz-orange" href="${base}documentos">${sic('upload')} Adjuntar documentos</a><button class="btn ghost" data-prev>${sic('eye')} Vista previa</button><button class="btn ghost" data-dlcv>${sic('download')} Descargar CV</button></div><p class="note" style="padding:0 16px 14px">Última actualización: ${c.actualizado ? fdate(c.actualizado, true) : '—'}${c.cvPdf ? ` · CV firmado adjunto: ${esc(c.cvPdf.original)}` : ''}</p></div></div>`;
  return { html, after: () => { $('[data-gen]').onclick = () => cvDownload(p, 'generate'); $('[data-prev]').onclick = () => cvDownload(p, 'preview'); $('[data-dlcv]').onclick = () => cvDownload(p, 'download'); } };
}
const cvTouch = (p, what) => { p.cv.actualizado = nowISO(); stamp(p); audit('Actualización de CV docente', 'CV Docente', fullName(p), what); };
function listTable(p, key) {
  const L = CVL[key], rows = p.cv[key];
  return `<div class="panel"><h2><span>${esc(L.t)} <span class="badge">${rows.length}</span></span><button class="btn xs" data-add="${key}">${sic('plus', 13)} Agregar</button></h2><div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr>${L.f.map(f => `<th>${esc(f[1])}</th>`).join('')}<th class="c">Acciones</th></tr></thead><tbody>${rows.map((r, i) => `<tr>${L.f.map(f => `<td>${esc(r[f[0]] || '—')}</td>`).join('')}<td class="c" style="white-space:nowrap">${ib('edit', 'edit', 'Editar').replace('data-act="edit"', `data-ed="${key}:${i}"`)}${ib('del', 'trash', 'Eliminar', 'danger').replace('data-act="del"', `data-dl="${key}:${i}"`)}</td></tr>`).join('') || `<tr><td colspan="${L.f.length + 1}"><div class="empty">Sin registros. Use “Agregar”.</div></td></tr>`}</tbody></table></div></div>`;
}
function tagsBox(name, label, opts, sel, hint) {
  const extra = sel.filter(x => !opts.includes(x));
  return `<div class="field full"><span class="lbl">${label}</span><div class="pz-checks">${opts.map(o => `<label class="check"><input type="checkbox" name="${name}" value="${esc(o)}" ${sel.includes(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div><label for="${name}-o" style="margin-top:6px">Otras (una por línea)</label><textarea id="${name}-o" name="${name}_otros" rows="2">${esc(extra.join('\n'))}</textarea>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
}
function cvSeccion(p, k) {
  const S = CVS.find(x => x.k === k); if (!S) return cvDashboard(p);
  const c = p.cv; const canE = cvCanEdit(p); const back = `#/admin/cvdocente/${p.id}`;
  const nav = `<div class="pz-cvnav">${CVS.map(x => `<a href="#/admin/cvdocente/${p.id}/${x.k}" ${x.k === k ? 'aria-current="page"' : ''}>${ic(x.icon)}<span>${x.t}</span></a>`).join('')}</div>`;
  let body = '';
  if (k === 'datos') body = `<form class="panel" data-cvf><h2>Datos personales</h2><div class="pb"><div class="pz-cvdatos"><div class="pz-photo"><img src="${img(p.foto)}" alt="Fotografía"><label class="btn xs sec">${sic('upload', 13)} Cambiar foto<input type="file" name="foto" accept=".jpg,.jpeg,.png,.webp" hidden></label><small>JPG o PNG · fondo claro · máx. 5 MB</small></div><div class="form-grid">
      <div class="field"><label>Nombres</label><input name="nombres" value="${esc(p.nombres)}" ${cvCanAll() ? '' : 'readonly'}></div><div class="field"><label>Apellidos</label><input name="apellidos" value="${esc(p.apellidos)}" ${cvCanAll() ? '' : 'readonly'}></div>
      <div class="field"><label>Grado / abreviatura</label><input name="titulo" value="${esc(p.titulo || '')}" placeholder="Mg., Ing., Lic."></div><div class="field"><label>Cargo / denominación en el CV</label><input name="cargo" value="${esc(c.cargo)}"></div>
      <div class="field"><label>DNI</label><input name="dni" value="${esc(p.dni || '')}" maxlength="8" inputmode="numeric"></div><div class="field"><label>Fecha de nacimiento</label><input name="fnac" type="date" value="${esc(c.fnac)}"></div>
      <div class="field"><label>Sexo</label><select name="sexo">${['Femenino', 'Masculino'].map(x => `<option ${c.sexo === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="field"><label>Teléfono / celular</label><input name="telefono" value="${esc(p.telefono || '')}" maxlength="15"></div>
      <div class="field"><label>Correo institucional</label><input name="correo" type="email" value="${esc(p.correo || '')}" ${cvCanAll() ? '' : 'readonly'}></div><div class="field"><label>Correo personal (no se publica)</label><input name="correoPersonal" type="email" value="${esc(c.correoPersonal)}"></div>
      <div class="field full"><label>Dirección</label><input name="direccion" value="${esc(c.direccion)}" placeholder="Av. Principal N.º 123, Ica"></div>
      <div class="field full"><label>Perfil profesional</label><textarea name="perfil" rows="4" maxlength="700">${esc(c.perfil)}</textarea></div></div></div>
      ${canE ? '<div style="text-align:right;margin-top:10px"><button class="btn">Guardar datos personales</button></div>' : ''}</div></form>`;
  else if (k === 'competencias') body = `<form class="panel" data-cvf><h2>Competencias y enfoques</h2><div class="pb"><div class="form-grid">${tagsBox('competencias', 'VI. Competencias para la empleabilidad', CV_COMP, c.competencias, 'Se recomienda seleccionar al menos tres.')}${tagsBox('enfoques', 'VII. Enfoques transversales', CV_ENF, c.enfoques)}</div>${canE ? '<div style="text-align:right;margin-top:10px"><button class="btn">Guardar</button></div>' : ''}</div></form>`;
  else if (k === 'documentos') body = `<div class="pz-dash"><div class="panel"><h2>Documentos</h2><div class="pb" style="display:grid;gap:12px"><div><b>Hoja de vida firmada (PDF)</b><p class="note">Si adjunta su CV firmado, este se publicará en lugar del CV generado por el sistema.</p>${c.cvPdf ? `<div class="pz-files"><li>${S16('file')} <span>${esc(c.cvPdf.original)}</span> <small>${fsize(c.cvPdf.size)}</small><button class="btn xs sec" data-dlx="cv">Descargar</button>${canE ? '<button class="btn xs danger" data-rmcv>Quitar</button>' : ''}</li></div>` : ''}${canE ? `<input type="file" accept=".pdf" data-upcv>` : ''}</div>
      <div><b>Documentos sustentatorios</b> <small class="note">(títulos, grados, constancias · PDF/JPG/PNG · máx. 10 MB)</small><ul class="pz-files">${c.docs.map((d, i) => `<li>${S16('file')} <span>${esc(d.titulo || d.original)}</span> <small>${fsize(d.size)}</small><button class="btn xs sec" data-dlx="${i}">Descargar</button>${canE ? `<button class="btn xs danger" data-rmd="${i}">Quitar</button>` : ''}</li>`).join('') || '<li class="note">Sin documentos.</li>'}</ul>${canE ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><input class="inp" id="dc-t" placeholder="Descripción (ej.: Título profesional)" style="flex:1;min-width:180px"><input type="file" accept=".pdf,.jpg,.jpeg,.png" id="dc-f"><button class="btn sm" data-updoc>Adjuntar</button></div>` : ''}</div></div></div>
      <div class="panel"><h2><span>${sic('shield')} Autorización Ley N.º 29733</span></h2><div class="pb"><p style="font-size:13.5px">Autorizo a ${esc(inst().nombre)} a publicar en su Portal Web Institucional, en la sección Plana Docente, mis <b>apellidos y nombres, fotografía, correo institucional, unidades didácticas a mi cargo y hoja de vida</b>, conforme a la Ley N.º 29733, Ley de Protección de Datos Personales, y su reglamento. Puedo revocar esta autorización en cualquier momento.</p>
        ${c.autoriza.ok ? `<div class="notice ok">Autorizado el ${fdate(c.autoriza.fecha, true)} por ${esc(c.autoriza.por)}.</div>${canE ? '<button class="btn danger sm" data-rev>Revocar autorización</button>' : ''}` : canE ? `<label class="check"><input type="checkbox" id="au-ok"> Acepto y autorizo la publicación de mis datos.</label><p style="margin-top:10px"><button class="btn ok" data-aut>${sic('check')} Registrar autorización</button></p>` : '<div class="notice warn">Pendiente.</div>'}
        <p class="note" style="margin-top:10px">El DNI, la fecha de nacimiento, la dirección y el teléfono solo aparecen en el CV descargable si el docente los registra; el directorio público muestra únicamente el correo institucional.</p></div></div></div>`;
  else {
    body = (S.lists || []).map(key => listTable(p, key)).join('');
    if (k === 'continua') body += `<form class="panel" data-cvf><h2>Ofimática e idioma extranjero</h2><div class="pb"><div class="form-grid"><div class="field"><label>Ofimática (una por línea)</label><textarea name="ofimatica" rows="4" placeholder="Microsoft Word&#10;Microsoft Excel - Nivel avanzado">${esc(c.ofimatica.join('\n'))}</textarea></div><div class="field"><label>Idioma extranjero (uno por línea)</label><textarea name="idiomas" rows="4" placeholder="Inglés - Intermedio">${esc(c.idiomas.join('\n'))}</textarea></div></div>${canE ? '<div style="text-align:right"><button class="btn sm">Guardar</button></div>' : ''}</div></form>`;
    if (k === 'innovacion') body += `<div class="panel"><h2>Huella digital</h2><div class="pb" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div class="pz-huella">${c.huella ? `<img src="${c.huella}" alt="Huella digital">` : ic('shield')}</div><div><p class="note">Imagen de su huella dactilar (opcional) para la sección “Huella digital” del CV.</p>${canE ? `<input type="file" accept=".jpg,.jpeg,.png" data-uphu>${c.huella ? ' <button class="btn xs danger" data-rmhu>Quitar</button>' : ''}` : ''}</div></div></div>`;
  }
  const html = admHead(S.t, `CV de ${esc(fullName(p))}`, `<a class="btn ghost" href="${back}">${sic('back')} Volver al panel del CV</a>`, S.icon, [['CV Docente', '#/admin/cvdocente'], [fullName(p), back], [S.t]]) + nav + body;
  return { html, after: () => {
    if (!canE) { $$('#contenido input, #contenido textarea, #contenido select, #contenido button[data-add]').forEach(x => x.disabled = true); }
    const save = (msg, what) => { cvTouch(p, what || S.t); if (saveDB()) { toast(msg || 'Guardado.', 'ok'); route(); } };
    const f = $('[data-cvf]');
    if (f) f.onsubmit = async e => { e.preventDefault(); if (!canE) return;
      if (k === 'datos') { const v = Object.fromEntries(new FormData(f)); if (v.dni && !/^\d{8}$/.test(v.dni)) return toast('El DNI debe tener 8 dígitos.', 'err'); if (v.correo && !reEmail.test(v.correo)) return toast('Correo institucional no válido.', 'err'); if (v.correoPersonal && !reEmail.test(v.correoPersonal)) return toast('Correo personal no válido.', 'err');
        if (cvCanAll()) { p.nombres = v.nombres.trim() || p.nombres; p.apellidos = v.apellidos.trim() || p.apellidos; p.correo = v.correo.trim(); }
        Object.assign(p, { titulo: v.titulo.trim(), dni: v.dni.trim(), telefono: v.telefono.trim() }); Object.assign(c, { cargo: v.cargo.trim(), fnac: v.fnac, sexo: v.sexo, correoPersonal: v.correoPersonal.trim(), direccion: v.direccion.trim(), perfil: v.perfil.trim() });
        const fo = f.foto.files[0]; if (fo) { const fe = checkFile(fo, 'image'); if (fe) return toast(fe, 'err'); p.foto = await compressImage(fo, 600); }
        return save('Datos personales guardados.'); }
      if (k === 'competencias') { const pick = n => $$(`[name="${n}"]:checked`, f).map(i => i.value).concat(f[n + '_otros'].value.split('\n').map(s => s.trim()).filter(Boolean)); c.competencias = pick('competencias'); c.enfoques = pick('enfoques'); return save('Competencias guardadas.'); }
      if (k === 'continua') { c.ofimatica = f.ofimatica.value.split('\n').map(s => s.trim()).filter(Boolean); c.idiomas = f.idiomas.value.split('\n').map(s => s.trim()).filter(Boolean); return save('Ofimática e idiomas guardados.'); }
    };
    const fp = f && f.foto; if (fp) fp.onchange = () => { const fo = fp.files[0]; if (fo) { const u = URL.createObjectURL(fo); $('.pz-photo img').src = u; } };
    const edit = (key, i) => { const L = CVL[key]; const r = i == null ? {} : c[key][i];
      const m = modal({ title: (i == null ? 'Agregar: ' : 'Editar: ') + L.t, body: `<form class="form-grid" data-li novalidate>${L.f.map(([n, l, ph, t]) => `<div class="field ${t === 'textarea' ? 'full' : ''}"><label for="li-${n}">${esc(l)}${n === L.f[0][0] || n === L.f[1][0] ? ' <span class="req">*</span>' : ''}</label>${t === 'textarea' ? `<textarea id="li-${n}" name="${n}" rows="3" maxlength="400">${esc(r[n] || '')}</textarea>` : `<input id="li-${n}" name="${n}" type="${t || 'text'}" value="${esc(r[n] || '')}" placeholder="${esc(ph || '')}" maxlength="160">`}</div>`).join('')}</form>`, foot: `<button class="btn ghost" data-x>Cancelar</button><button class="btn" data-s>Guardar</button>` });
      $('[data-x]', m.el).onclick = m.close;
      $('[data-s]', m.el).onclick = () => { const fm = $('[data-li]', m.el); const v = Object.fromEntries(new FormData(fm)); const er = {}; [L.f[0][0], L.f[1][0]].forEach(n => { if (!String(v[n] || '').trim()) er[n] = 'Requerido.'; }); if (!showErrors(fm, er)) return;
        Object.keys(v).forEach(x => v[x] = String(v[x]).trim()); if (i == null) c[key].push(Object.assign({ id: uid() }, v)); else Object.assign(c[key][i], v); m.close(); save('Registro guardado.', L.t); }; };
    $$('[data-add]').forEach(b => b.onclick = () => edit(b.dataset.add));
    $$('[data-ed]').forEach(b => b.onclick = () => { const [key, i] = b.dataset.ed.split(':'); edit(key, +i); });
    $$('[data-dl]').forEach(b => b.onclick = async () => { const [key, i] = b.dataset.dl.split(':'); if (!await confirmBox('¿Eliminar este registro del CV?', { ok: 'Eliminar' })) return; c[key].splice(+i, 1); save('Registro eliminado.', CVL[key].t); });
    const up = $('[data-upcv]'); if (up) up.onchange = async () => { const fo = up.files[0]; if (!fo) return; const fe = checkUpload(fo, ['pdf'], 10); if (fe) return toast(fe, 'err'); c.cvPdf = await storeFile(fo, 'cv'); save('CV firmado adjuntado.'); };
    const rmcv = $('[data-rmcv]'); if (rmcv) rmcv.onclick = () => { c.cvPdf = null; save('CV adjunto retirado.'); };
    $$('[data-dlx]').forEach(b => b.onclick = () => downloadMeta(b.dataset.dlx === 'cv' ? c.cvPdf : c.docs[+b.dataset.dlx]));
    $$('[data-rmd]').forEach(b => b.onclick = () => { c.docs.splice(+b.dataset.rmd, 1); save('Documento retirado.'); });
    const ud = $('[data-updoc]'); if (ud) ud.onclick = async () => { const fo = $('#dc-f').files[0]; if (!fo) return toast('Seleccione el archivo.', 'err'); const fe = checkUpload(fo, ['pdf', 'jpg', 'jpeg', 'png'], 10); if (fe) return toast(fe, 'err'); const meta = await storeFile(fo, 'cvdoc'); meta.titulo = $('#dc-t').value.trim() || fo.name; c.docs.push(meta); save('Documento adjuntado.'); };
    const au = $('[data-aut]'); if (au) au.onclick = () => { if (!$('#au-ok').checked) return toast('Marque la casilla de autorización.', 'err'); c.autoriza = { ok: true, fecha: nowISO(), por: currentUser().usuario }; save('Autorización registrada: el CV se publicará en la Plana Docente.', 'Autorización Ley 29733'); };
    const rv = $('[data-rev]'); if (rv) rv.onclick = async () => { if (!await confirmBox('Al revocar la autorización, el docente dejará de mostrarse en la Plana Docente del portal.', { ok: 'Revocar' })) return; c.autoriza = { ok: false, fecha: nowISO(), por: currentUser().usuario, revocado: true }; save('Autorización revocada.', 'Revocación Ley 29733'); };
    const uh = $('[data-uphu]'); if (uh) uh.onchange = async () => { const fo = uh.files[0]; if (!fo) return; const fe = checkFile(fo, 'image'); if (fe) return toast(fe, 'err'); c.huella = await compressImage(fo, 300); save('Huella digital guardada.'); };
    const rh = $('[data-rmhu]'); if (rh) rh.onclick = () => { c.huella = ''; save('Huella retirada.'); };
  } };
}

/* ---------- Generación del CV en PDF (modelo institucional) ---------- */
async function cvDownload(p, mode) {
  if (!p) return; cvOf(p);
  if (mode !== 'generate' && p.cv.cvPdf && mode !== 'preview') { const b = await fileBlob(p.cv.cvPdf); if (b) { downloadBlob(b, p.cv.cvPdf.original || 'CV.pdf'); return; } }
  const blob = await cvPdf(p); if (!blob) return;
  const name = `CV_${pdfName(p.apellidos + '_' + p.nombres)}.pdf`;
  if (mode === 'preview' || mode === 'public') openBlob(blob, name); else downloadBlob(blob, name);
  if (currentUser()) { audit(mode === 'preview' ? 'Vista previa de CV' : 'Generación de CV', 'CV Docente', fullName(p)); saveDB(); }
}
async function cvPdf(p) {
  const c = cvOf(p);
  if (!hasPdf()) { return makePdf('Hoja de vida - ' + fullName(p), [c.perfil, '', 'Formacion: ' + c.pregrado.concat(c.posgrado).map(x => `${x.nivel} ${x.especialidad} (${x.institucion})`).join('; '), 'Correo: ' + p.correo], inst().nombre.toUpperCase()); }
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4' }); const W = 210, H = 297;
  const foto = (await raster(img(p.foto), 340, 400)) || (await raster(img('ph:topic:user|' + p.id + '|'), 340, 400)); const logo = await logoPng();
  const font = (st, sz, col) => { doc.setFont('helvetica', st); doc.setFontSize(sz); if (col !== undefined) Array.isArray(col) ? doc.setTextColor(...col) : doc.setTextColor(col); };
  // cabecera: foto, nombre, cargo y datos de contacto en cuadrícula 2 × 2
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 56, 'F');
  doc.setFillColor(...BLUE); doc.triangle(170, 0, 190, 0, 156, 30, 'F'); doc.triangle(190, 0, 156, 30, 168, 30, 'F');
  doc.setFillColor(...ORANGE); doc.triangle(196, 0, 210, 0, 210, 14, 'F'); doc.triangle(196, 0, 210, 14, 186, 22, 'F');
  doc.setFillColor(255, 255, 255); doc.roundedRect(10, 7, 36, 42, 1.5, 1.5, 'F');
  if (foto) try { doc.addImage(foto, 'JPEG', 11.2, 8.2, 33.6, 39.6); } catch (e) { }
  font('bold', 18, 255); const nm = doc.splitTextToSize(String(p.nombres).toUpperCase(), 100), ap = doc.splitTextToSize(String(p.apellidos).toUpperCase(), 100);
  let hy = 15; nm.concat(ap).slice(0, 3).forEach(t => { doc.text(t, 53, hy); hy += 7.2; });
  font('bold', 9, [120, 196, 240]); doc.text(doc.splitTextToSize(String(c.cargo || 'Docente de Educación Superior').toUpperCase(), 125)[0], 53, hy - 1.5);
  doc.setDrawColor(70, 110, 170); doc.setLineWidth(.2); doc.line(53, hy + 1.5, 178, hy + 1.5);
  const ci = [['DNI', p.dni], ['Teléfono', p.telefono], ['Correo', p.correo], ['Dirección', c.direccion]].filter(x => x[1]);
  ci.forEach(([k, v], i) => { const x = 53 + (i % 2) * 63, y = hy + 7 + Math.floor(i / 2) * 7.5; doc.setFillColor(...BLUE); doc.circle(x + 1.8, y - 1.2, 1.8, 'F'); font('bold', 7.2, 255); doc.text(k + ':', x + 5, y); const lw = doc.getTextWidth(k + ': '), av = 60 - lw - 6; let fz = 7.2; font('normal', fz, 255); while (fz > 5.4 && doc.getTextWidth(String(v)) > av) { fz -= .2; doc.setFontSize(fz); } doc.text(doc.splitTextToSize(String(v), av)[0], x + 5 + lw + 1, y); });
  if (logo) { doc.setFillColor(255, 255, 255); doc.roundedRect(183, 33, 18, 20, 2, 2, 'F'); try { doc.addImage(logo, 'PNG', 185, 34.5, 14, 17); } catch (e) { } }
  // utilidades de maquetación
  const LX = 10, LW = 118, RX = 136, RW = 64; const TOP = 16, BOT = 22, GAP = 9;
  // numeración correlativa solo de las secciones que se imprimen
  const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'], NUM = {}; let nk = 0;
  [['I', 1], ['II', c.pregrado.length || c.posgrado.length], ['III', c.continua.length], ['IV', c.expProf.length], ['V', c.expDocP.length || c.expDocS.length], ['VI', c.competencias.length], ['VII', c.enfoques.length], ['VIII', c.innovacion.length]].forEach(([r, on]) => { if (on) NUM[r] = ROM[nk++]; });
  const secH = (x, y, w, n, t) => { n = NUM[n] || n; doc.setFillColor(...NAVY); doc.circle(x + 4.2, y - 1.4, 4.2, 'F'); font('bold', n.length > 2 ? 5.4 : 7, 255); doc.text(n, x + 4.2, y + .1, { align: 'center' }); font('bold', 10, NAVY); doc.text(t, x + 11, y); doc.setDrawColor(...BLUE); doc.setLineWidth(.5); doc.line(x + 11, y + 2, x + w, y + 2); doc.setLineWidth(.2); return y + 7; };
  const sub = (x, y, t) => { font('bold', 7.6, ORANGE); doc.text(t, x, y); return y + 2; };
  const tick = (x, y) => { doc.setFillColor(...BLUE); doc.circle(x, y - 1, 1.5, 'F'); doc.setDrawColor(255); doc.setLineWidth(.35); doc.line(x - .7, y - 1, x - .2, y - .4); doc.line(x - .2, y - .4, x + .8, y - 1.6); doc.setLineWidth(.2); };
  const tbl = (x, w, y, head, body, colW) => { doc.autoTable({ startY: y, margin: { left: x, right: W - x - w, top: TOP, bottom: BOT }, tableWidth: w, theme: 'grid', head: [head], body, styles: { fontSize: 6.8, cellPadding: 1.4, lineColor: [215, 228, 240], textColor: 35, overflow: 'linebreak', valign: 'middle' }, headStyles: { fillColor: [226, 239, 250], textColor: NAVY, fontStyle: 'bold' }, columnStyles: colW || {} }); return doc.lastAutoTable.finalY + GAP; };
  const room = (y, need) => { if (y + need > H - BOT) { doc.addPage(); return TOP + 6; } return y; };
  // lista con viñetas en columnas: cada elemento se ajusta en varias líneas (sin cortar el texto)
  const list = (x, y, w, arr, cols) => { const cw = w / cols, LH = 2.9; font('normal', 6.8, 35); const ls = arr.map(t => doc.splitTextToSize(String(t), cw - 7)); const rh = []; for (let r = 0; r * cols < arr.length; r++) rh.push(Math.max(...ls.slice(r * cols, r * cols + cols).map(l => l.length)) * LH + 2.6); const bh = rh.reduce((a, b) => a + b, 0) + 3; doc.setFillColor(240, 247, 253); doc.roundedRect(x, y - 1, w, bh, 1.5, 1.5, 'F'); font('normal', 6.8, 35); let yy = y + 3.6; rh.forEach((h, r) => { ls.slice(r * cols, r * cols + cols).forEach((l, k) => { const xx = x + 3.5 + k * cw; tick(xx, yy); doc.text(l, xx + 3, yy); }); yy += h; }); return y + bh + GAP - 2; };
  // columna derecha (página 1): solo secciones con información
  let ry = 66; ry = secH(RX, ry, RW, 'I', 'DATOS PERSONALES');
  const dp = [['Nombres', String(p.nombres).toUpperCase()], ['Apellidos', String(p.apellidos).toUpperCase()], ['Fecha de nacimiento', c.fnac ? fshort(c.fnac + 'T12:00:00') : ''], ['Sexo', c.sexo], ['Dirección', c.direccion]].filter(r => r[1]);
  doc.autoTable({ startY: ry, margin: { left: RX, right: W - RX - RW }, tableWidth: RW, theme: 'plain', body: dp, styles: { fontSize: 7, cellPadding: 1.5, textColor: 35, fillColor: [240, 247, 253] }, alternateRowStyles: { fillColor: [228, 240, 251] }, columnStyles: { 0: { cellWidth: 24, textColor: 70 } } });
  ry = doc.lastAutoTable.finalY + GAP + 2;
  if (c.competencias.length) { ry = secH(RX, ry, RW, 'VI', 'COMPETENCIAS'); ry = list(RX, ry, RW, c.competencias, 2); }
  if (c.enfoques.length) { ry = secH(RX, ry, RW, 'VII', 'ENFOQUES TRANSVERSALES'); ry = list(RX, ry, RW, c.enfoques, 1); }
  if (c.innovacion.length) { ry = secH(RX, ry, RW, 'VIII', 'INNOVACIÓN TECNOLÓGICA'); ry = tbl(RX, RW, ry, ['Evento / proyecto', 'Participación', 'Fecha'], c.innovacion.map(r => [r.evento, r.participacion, r.fecha]), { 2: { cellWidth: 12 } }); }
  if (ry < 236) { ry = secH(RX, ry, RW, 'HD', 'HUELLA DIGITAL'); doc.setDrawColor(190); doc.rect(RX + 2, ry, 24, 28);
    if (c.huella) { try { const hu = await raster(c.huella, 180, 210); if (hu) doc.addImage(hu, 'JPEG', RX + 3, ry + 1, 22, 26); } catch (e) { } } else { font('italic', 6, 150); doc.text(['Sin huella', 'registrada'], RX + 14, ry + 13, { align: 'center' }); }
    const sx = RX + 30, sw = RW - 30; doc.setDrawColor(60); doc.line(sx, ry + 20, sx + sw, ry + 20); font('bold', 6.6, NAVY); doc.text(doc.splitTextToSize(fullName(p).replace(/^\S+\.\s/, '').toUpperCase(), sw), sx + sw / 2, ry + 23.5, { align: 'center' }); if (p.dni) { font('normal', 6.6, NAVY); doc.text('DNI: ' + p.dni, sx + sw / 2, ry + 30.5, { align: 'center' }); } }
  // columna izquierda
  doc.setPage(1); let y = 62;
  font('normal', 7.8, 35); const per = doc.splitTextToSize(c.perfil || `Docente del ${inst().nombre} comprometido con la formación integral de los estudiantes y la innovación educativa.`, LW - 22); const ph = Math.max(22, per.length * 3.6 + 15);
  doc.setFillColor(232, 243, 252); doc.roundedRect(LX, y, LW, ph, 2, 2, 'F'); doc.setFillColor(...NAVY); doc.circle(LX + 8, y + 9, 5, 'F'); font('bold', 8, 255); doc.text('P', LX + 8, y + 10.2, { align: 'center' });
  font('bold', 10, NAVY); doc.text('PERFIL PROFESIONAL', LX + 17, y + 7); doc.setDrawColor(...BLUE); doc.setLineWidth(.4); doc.line(LX + 17, y + 9, LX + LW - 4, y + 9); doc.setLineWidth(.2); font('normal', 7.8, 35); doc.text(per, LX + 17, y + 14.5); y += ph + GAP + 2;
  const est = r => [r.anio, [r.nivel, r.especialidad].filter(Boolean).join(' – '), r.institucion, r.lugar]; const ew = { 0: { cellWidth: 20 }, 3: { cellWidth: 16 } }; const eh = ['Año', 'Nivel / Especialidad', 'Institución', 'Lugar'];
  if (c.pregrado.length || c.posgrado.length) { y = room(y, 26); y = secH(LX, y, LW, 'II', 'FORMACIÓN ACADÉMICA');
    if (c.pregrado.length) { y = sub(LX, y, 'ESTUDIOS DE PREGRADO'); y = tbl(LX, LW, y, eh, c.pregrado.map(est), ew); }
    if (c.posgrado.length) { y = room(y, 18); y = sub(LX, y, 'ESTUDIOS DE POSGRADO'); y = tbl(LX, LW, y, eh, c.posgrado.map(est), ew); } }
  if (c.continua.length) { y = room(y, 26); y = secH(LX, y, LW, 'III', 'FORMACIÓN CONTINUA'); y = tbl(LX, LW, y, ['Curso / Programa', 'Institución', 'Tema', 'Periodo', 'Horas'], c.continua.map(r => [r.curso, r.institucion, r.tema, r.periodo, r.horas]), { 3: { cellWidth: 22 }, 4: { cellWidth: 11, halign: 'center' } }); }
  const of = c.ofimatica, idi = c.idiomas; const boxes = [['OFIMÁTICA', of], ['IDIOMA EXTRANJERO', idi]].filter(x => x[1].length);
  if (boxes.length) { const bh = Math.max(...boxes.map(x => x[1].length)) * 5 + 12; y = room(y, bh + 4); const bw = boxes.length === 2 ? LW / 2 - 2 : LW;
    boxes.forEach(([t, arr], k) => { const x = LX + k * (LW / 2 + 2); doc.setFillColor(232, 243, 252); doc.roundedRect(x, y, bw, bh, 1.5, 1.5, 'F'); font('bold', 8, NAVY); doc.text(t, x + 4, y + 6); font('normal', 6.8, 35); arr.forEach((s, i) => { tick(x + 5, y + 11.5 + i * 5); doc.text(doc.splitTextToSize(s, bw - 12)[0], x + 8.5, y + 11.5 + i * 5); }); }); y += bh + GAP + 1; }
  const ex = r => [r.institucion, r.cargo, r.descripcion, r.periodo, r.tiempo]; const xw = { 2: { cellWidth: 40 }, 3: { cellWidth: 18 }, 4: { cellWidth: 12 } }; const xh = ['Institución', 'Cargo', 'Descripción', 'Periodo', 'Tiempo'];
  if (c.expProf.length) { y = room(y, 26); y = secH(LX, y, LW, 'IV', 'EXPERIENCIA PROFESIONAL'); y = tbl(LX, LW, y, xh, c.expProf.map(ex), xw); }
  if (c.expDocP.length || c.expDocS.length) { y = room(y, 28); y = secH(LX, y, LW, 'V', 'EXPERIENCIA DOCENTE');
    if (c.expDocP.length) { y = sub(LX, y, 'EDUCACIÓN SUPERIOR – PRESENCIAL'); y = tbl(LX, LW, y, xh, c.expDocP.map(ex), xw); }
    if (c.expDocS.length) { y = room(y, 18); y = sub(LX, y - 2, 'EDUCACIÓN SUPERIOR – SEMIPRESENCIAL / DISTANCIA'); y = tbl(LX, LW, y, xh, c.expDocS.map(ex), xw); } }
  // pie en todas las páginas
  const n = doc.internal.getNumberOfPages();
  for (let k = 1; k <= n; k++) { doc.setPage(k); doc.setFillColor(...NAVY); doc.rect(6, H - 15, W - 12, 11, 'F'); font('bold', 7.4, 255); doc.text(`SISTEMA DE GESTIÓN DE CV PARA DOCENTES – ${inst().nombre}`, 12, H - 10.2); font('normal', 6.6, 255); doc.text(`Documento generado desde el sistema.${c.autoriza.ok ? ' Publicación autorizada (Ley N.° 29733).' : ''}`, 12, H - 6.6); doc.text(`Fecha de generación: ${fshort(nowISO())}`, W - 12, H - 10.2, { align: 'right' }); doc.text(`Página ${k} de ${n}`, W - 12, H - 6.6, { align: 'right' }); }
  return doc.output('blob');
}

/* ---------- Portal: Plana Docente (directorio del año en curso) y Equipo directivo ---------- */
const autorizado = p => !!(p && p.cv && p.cv.autoriza && p.cv.autoriza.ok);
const directorioVisible = publicTeacherVisible;
function openPublicTeacher(id) { const p = byId('personas', id); if (!p) return; if (autorizado(p)) return cvDownload(p, 'public'); if (directorioVisible(p)) teacherModal(id, (p.programas || [])[0]); }
const pzPlanaTabs = a => `<nav class="pz-ptabs" aria-label="Plana institucional"><a href="#/nosotros/plana-jerarquica" ${a === 'j' ? 'aria-current="page"' : ''}>Personal directivo jerárquico</a><a href="#/nosotros/plana-docente" ${a === 'd' ? 'aria-current="page"' : ''}>Docentes</a></nav>`;
const tcard = (p, cargo, btn2) => `<article class="pz-tcard"><div class="ph"><img src="${img(p.foto)}" alt="Fotografía de ${esc(fullName(p))}" loading="lazy"></div><div class="tb"><h3>${esc(fullName(p))}</h3><small>${esc(cargo)}</small>${p.correo ? `<a class="ml" href="mailto:${esc(p.correo)}">${S16('mail')} <span>${esc(p.correo).replace('@', '<wbr>@')}</span></a>` : ''}<div class="bt"><button class="b1" data-hv="${p.id}">${autorizado(p) ? 'Hoja de vida' : 'Ficha pública'}</button>${btn2}</div></div></article>`;
R('nosotros/plana-docente', (path, q) => {
  const pg0 = page('docentes'); if (!pg0 || !isPub(pg0)) return notFound(path);
  const cats = CATS(); const sel = cats.find(c => c.id === q.get('p')) || cats[0]; const s = (q.get('q') || '').trim();
  let ds = docentesDe(sel.id).filter(directorioVisible); if (s) { const t = normTitle(s); ds = ds.filter(d => normTitle([fullName(d), d.especialidad].join(' ')).includes(t)); }
  const total = P('personas').filter(p => p.tipo === 'Docente' && isPub(p) && directorioVisible(p)).length;
  const body = `${pzPlanaTabs('d')}<span class="pz-kick">CONOCE A NUESTRA</span><h1 class="pz-big">PLANA DOCENTE ${yearNow()}</h1><p class="lead">${esc(stripTags(pg0.contenido))}</p>
   <div class="cat-tabs" role="group" aria-label="Programas de estudio">${cats.map(c => `<button data-cat="${c.id}" aria-pressed="${c.id === sel.id}">${ic(c.icon)}<span>${esc(c.label)}</span></button>`).join('')}</div>
   <form class="pz-search" data-ps><input name="q" value="${esc(s)}" placeholder="Buscar docente por nombre o especialidad" aria-label="Buscar docente"><button class="btn sm">${S16('search')} Buscar</button></form>
   <h2 style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">${esc(sel.label)} <span class="badge">${ds.length} docente(s) · ${total} en total</span></h2>
   ${ds.length ? `<div class="pz-tgrid">${ds.map(d => tcard(d, d.especialidad + (d.condicion ? ' · ' + d.condicion : ''), `<button class="b2" data-ud="${d.id}">Unidades didácticas</button>`)).join('')}</div>` : emptyMsg('docentes en esta categoría')}
   <p class="pz-legal">${S16('shield')} Las fichas procedentes del portal institucional de origen muestran únicamente información profesional ya publicada. Los CV completos requieren autorización de difusión, conforme a la Ley N.º 29733. Información actualizada al ${fdate(nowISO())} por el responsable del Portal Web.</p>`;
  const html = shell(path, { title: 'Plana Docente ' + yearNow() + (sel ? ' - ' + sel.label : ''), desc: stripTags(pg0.contenido), crumbs: [['Nosotros', '#/nosotros/presentacion'], ['Plana Docente']], banner: { title: 'Nosotros', text: 'Conoce nuestra identidad, historia y el compromiso con la formación técnica.' }, side: nosotrosSide('plana-docente') + sidePromo('Docentes que inspiran el talento del futuro', 'La educación no cambia el mundo, cambia a las personas que van a cambiar el mundo. — Paulo Freire'), body });
  return { html, after: () => {
    $$('[data-cat]').forEach(b => b.onclick = () => go('#/nosotros/plana-docente?p=' + b.dataset.cat));
    $('[data-ps]').onsubmit = e => { e.preventDefault(); go('#/nosotros/plana-docente?p=' + sel.id + '&q=' + encodeURIComponent(e.target.q.value.trim())); };
    $$('[data-ud]').forEach(b => b.onclick = () => teacherModal(b.dataset.ud, sel.id));
    $$('[data-hv]').forEach(b => b.onclick = () => openPublicTeacher(b.dataset.hv));
  } };
});
R('nosotros/plana-jerarquica', path => {
  const pg0 = page('jerarquica'); if (!pg0 || !isPub(pg0)) return notFound(path);
  const js = sortO(P('jerarquica').filter(isPub)).map(j => ({ j, p: persona(j.personaId) })).filter(x => x.p);
  const d = js.find(x => x.j.esDirector); const ord = (d ? [d] : []).concat(js.filter(x => !x.j.esDirector));
  const coords = progs().filter(pp => pp.coordinadorId).map(pp => ({ pp, p: persona(pp.coordinadorId) })).filter(x => x.p);
  const body = `${pzPlanaTabs('j')}<span class="pz-kick">CONOCE A NUESTRO</span><h1 class="pz-big">EQUIPO DIRECTIVO</h1><p class="lead">${esc(stripTags(pg0.contenido))}</p>
   <div class="pz-tgrid three">${ord.map(({ j, p }) => tcard(p, j.cargo, `<button class="b2" data-cg="${j.id}">Cargo académico</button>`)).join('')}</div>
   ${d ? `<section class="director" aria-label="Mensaje de la Dirección General" style="margin-top:26px"><img src="${img(d.p.foto)}" alt="Fotografía de ${esc(fullName(d.p))}"><div class="msg"><h2 style="color:#fff;font-size:18px">Mensaje de la Dirección General</h2><blockquote>“${esc(pg0.mensaje)}”</blockquote><strong>${esc(fullName(d.p))}</strong><span>${esc(d.j.cargo)}</span></div></section>` : ''}
   ${coords.length ? `<h2>Coordinadores de programas de estudio</h2><div class="pz-tgrid">${coords.map(({ pp, p }) => tcard(p, 'Coordinador(a) de ' + pp.nombre, `<button class="b2" data-ud="${p.id}" data-prog="${pp.id}">Unidades didácticas</button>`)).join('')}</div>` : ''}`;
  const html = shell(path, { title: 'Plana Jerárquica', desc: stripTags(pg0.contenido), crumbs: [['Nosotros', '#/nosotros/presentacion'], ['Plana Jerárquica']], banner: { title: 'Nosotros', text: 'Conoce nuestra identidad, historia y el compromiso con la formación técnica.' }, side: nosotrosSide('plana-jerarquica') + sidePromo('Trabajo en equipo para una mejor educación técnica'), body });
  return { html, after: () => {
    $$('[data-hv]').forEach(b => b.onclick = () => openPublicTeacher(b.dataset.hv));
    $$('[data-ud]').forEach(b => b.onclick = () => teacherModal(b.dataset.ud, b.dataset.prog));
    $$('[data-cg]').forEach(b => b.onclick = () => { const j = byId('jerarquica', b.dataset.cg); const p = persona(j.personaId); const a = areasAll().find(x => x.nombre === j.unidad || x.resp === fullName(p));
      modal({ title: 'Cargo académico', body: `<div class="profile"><img src="${img(p.foto)}" alt="Fotografía de ${esc(fullName(p))}"><div><h3 style="font-size:20px;margin-bottom:2px">${esc(fullName(p))}</h3><p style="color:var(--ink2)">${esc(j.cargo)}</p><dl class="kv"><dt>Órgano / unidad</dt><dd>${esc(j.unidad || '—')}</dd><dt>Correo institucional</dt><dd><a href="mailto:${esc((a && a.correo) || p.correo)}">${esc((a && a.correo) || p.correo)}</a></dd><dt>Formación</dt><dd>${esc(p.especialidad || '—')}</dd></dl><p style="font-size:12px;color:var(--muted);margin-top:12px">Por protección de datos personales (Ley N.º 29733) solo se publica información institucional.</p></div></div>` }); });
  } };
});


/* =========================================================
   LOGIN DE LA INTRANET (pantalla dividida): panel institucional + formulario
   y usuarios de demostración agrupados por perfil
   ========================================================= */
const DEMO_GRUPOS = [
  ['Gestión del portal', [['editor-demo', 'Responsable del portal', 'shield'], ['admin', 'Administrador (todo)', 'gear'], ['comunicaciones', 'Imagen institucional', 'image'], ['transparencia', 'Transparencia', 'file']]],
  ['Gestión académica', [['direccion', 'Dirección General', 'award'], ['secretaria', 'Secretaría académica', 'clipboard'], ['coord.apsti', 'Coordinador de APSTI', 'monitor'], ['docente', 'Docente (CV docente)', 'user']]],
  ['Atención y servicios', [['atencion', 'Atención al ciudadano', 'inbox'], ['bienestar', 'Bienestar y empleabilidad', 'heart']]],
  ['Estudiantes, egresados y empresas', [['74125896', 'Estudiante', 'grad'], ['75236987', 'Egresado', 'star'], ['20601234561', 'Empresa', 'briefcase']]],
];
const LOGIN_FUNCS = [['layers', 'Gestión de contenidos del portal web'], ['inbox', 'Mesa de Partes Virtual y Libro de Reclamaciones'], ['briefcase', 'Bolsa laboral y seguimiento de egresados'], ['users', 'Plana docente y CV docente'], ['chart', 'Admisión, matrículas, becas y estadísticas']];
const demoPass = u => (DEMO_USERS.find(x => x[0] === u) || [])[1];
loginView = function () {
  const i = inst(); const grupos = DEMO_GRUPOS.map(([g, us]) => [g, us.filter(([u]) => demoPass(u))]).filter(([, us]) => us.length);
  return `<div class="pz-lg">
  <section class="pz-lg-l"><a class="pz-lg-brand" href="#/"><span class="pz-lg-logo"><img src="${logoSrc()}" alt=""></span><span><strong>${esc(i.nombreCorto)}</strong><small>${esc(i.nombre.replace(/^Instituto/, 'Instituto'))}</small></span></a>
   <div class="pz-lg-hero"><span class="pz-lg-badge">Intranet institucional</span><h1>Bienvenido(a) a la plataforma de gestión del portal</h1><p>Un solo acceso para el personal, los docentes, los estudiantes, los egresados y las empresas aliadas.</p>
   <ul class="pz-lg-funcs">${LOGIN_FUNCS.map(([icn, t]) => `<li><span>${ic(icn)}</span>${esc(t)}</li>`).join('')}</ul></div>
   <div class="pz-lg-foot"><span>${ic('phone')} ${esc(i.telefono)}</span><span>${ic('mail')} ${esc(i.correo)}</span><span>${ic('clock')} ${esc(i.horario)}</span></div></section>
  <section class="pz-lg-r"><div class="pz-lg-box">
   <a class="pz-lg-back" href="#/">${ic('back')} Volver al portal</a>
   <h2 class="pz-lg-t">Iniciar sesión</h2><p class="pz-lg-s">Ingrese con su usuario y contraseña institucional.</p>
   <div class="pz-lg-card"><form data-login novalidate>
    <div class="field"><label for="lg-u">Usuario</label><div class="pz-in">${ic('user')}<input id="lg-u" name="u" autocomplete="username" placeholder="Usuario, DNI o RUC" required></div></div>
    <div class="field"><label for="lg-p">Contraseña</label><div class="pz-in">${ic('lock')}<input id="lg-p" name="p" type="password" autocomplete="current-password" placeholder="••••••••" required><button type="button" data-eye aria-label="Mostrar contraseña" aria-pressed="false">${ic('eye')}</button></div></div>
    <div id="lg-e" role="alert"></div>
    <button class="pz-lg-btn" type="submit">${ic('key')} Ingresar</button>
    <p class="pz-lg-warn">${ic('alert')}<span>Por seguridad, tras 5 intentos fallidos la cuenta se bloquea 5 minutos. ¿Olvidó su contraseña? Solicítela al administrador del sistema.</span></p>
   </form></div>
   <details class="pz-lg-demo"${window.innerWidth > 760 ? ' open' : ''}><summary><span class="pz-lg-di">${ic('users')}</span><span><b>Usuarios de demostración</b><small>Elija un perfil y presione «Ingresar». Se completan el usuario y la contraseña.</small></span><i aria-hidden="true">▾</i></summary>
    ${grupos.map(([g, us]) => `<div class="pz-lg-g"><h3>${esc(g)}</h3><div class="pz-lg-grid">${us.map(([u, l, icn]) => `<button type="button" class="pz-du" data-du="${esc(u)}|${esc(demoPass(u))}"><i>${ic(icn)}</i><span><b>${esc(l)}</b><small>${esc(u)}</small></span></button>`).join('')}</div></div>`).join('')}
   </details>
  </div></section></div>`;
};
const _bindLogin = bindLogin;
bindLogin = function () {
  _bindLogin();
  $$('.pz-du').forEach(b => b.addEventListener('click', () => { $$('.pz-du').forEach(x => x.classList.toggle('on', x === b)); const s = $('.pz-lg-btn'); if (s) s.focus(); }));
  const eye = $('[data-eye]'); if (eye) eye.onclick = () => { const i = $('#lg-p'); const v = i.type === 'password'; i.type = v ? 'text' : 'password'; eye.setAttribute('aria-pressed', String(v)); eye.setAttribute('aria-label', v ? 'Ocultar contraseña' : 'Mostrar contraseña'); };
};


/* =========================================================
   SERVICIOS EN LÍNEA: módulos integrados de Mesa de Partes Virtual,
   Libro de Reclamaciones, Consulta de certificados y Bolsa Laboral
   ========================================================= */
const SV_MODS = {
  mpv: { slug: 'mesa-de-partes', icon: 'inbox', tone: 'blue', title: 'Mesa de Partes Virtual', short: 'Mesa de Partes', text: 'Presenta solicitudes, oficios y otros documentos sin acudir al instituto. Recibes tu N.º de expediente y tu cargo de recepción al instante.' },
  lr: { slug: 'libro-de-reclamaciones', icon: 'book', tone: 'orange', title: 'Libro de Reclamaciones', short: 'Reclamaciones', text: 'Registra un reclamo o una queja sobre nuestros servicios. Te damos un código para seguir su atención hasta la respuesta.' },
  cert: { slug: 'consulta-certificados', icon: 'shield', tone: 'green', title: 'Consulta de certificados', short: 'Certificados', text: 'Verifica en línea la autenticidad de títulos, certificados y constancias emitidos por el instituto.' },
  bolsa: { slug: 'bolsa-laboral', icon: 'briefcase', tone: 'violet', title: 'Bolsa Laboral', short: 'Bolsa Laboral', text: 'Ofertas de empleo y prácticas para nuestros estudiantes y egresados. Las empresas se registran libremente.' },
};
const SV_ORDER = ['mpv', 'lr', 'cert', 'bolsa'];
/* barra de módulos (siempre visible arriba del contenido) */
function svNav(active) {
  const it = SV_ORDER.map(k => [SV_MODS[k].slug, SV_MODS[k].short, SV_MODS[k].icon]).concat([['complementarios', 'Complementarios', 'layers']]);
  return `<nav class="pz-svnav" aria-label="Servicios en línea"><a href="#/servicios" class="pz-svnav-h ${active === '' ? 'on' : ''}" title="Servicios en línea" aria-label="Servicios en línea">${sic('home', 16)}</a>${it.map(([s, l, i]) => `<a href="#/servicios/${s}" class="${s === active ? 'on' : ''}" ${s === active ? 'aria-current="page"' : ''}>${sic(i, 16)}<span>${l}</span></a>`).join('')}</nav>`;
}
/* cabecera del módulo */
function svHead(k, chips, compact) {
  const m = SV_MODS[k];
  return `<header class="pz-mh t-${m.tone}${compact ? ' compact' : ''}"><span class="pz-mh-ic">${sic(m.icon, 30)}</span><div class="pz-mh-tx"><span class="pz-mh-k">Servicios en línea · ${esc(inst().nombreCorto)}</span><h1>${esc(m.title)}</h1><p>${esc(m.text)}</p>${chips && chips.length ? `<ul class="pz-mh-ch">${chips.map(([i, t]) => `<li>${sic(i, 15)}<span>${t}</span></li>`).join('')}</ul>` : ''}</div></header>`;
}
/* recuadro compacto de dato clave junto a la cabecera */
const svKeyBox = (icon, kicker, big, note, label) => `<section class="pz-horario compact" aria-label="${esc(label || kicker)}"><div class="pz-h-ic">${ic(icon)}</div><div><span class="pz-k">${kicker}</span><b class="pz-hh">${big}</b>${note ? `<span class="pz-live off">${note}</span>` : ''}</div></section>`;
/* pasos del servicio */
const svSteps = steps => `<ol class="pz-mst">${steps.map(([t, d], i) => `<li><span>${i + 1}</span><div><b>${t}</b><small>${d}</small></div></li>`).join('')}</ol>`;
/* pestañas del módulo (compatibles con los enlazadores existentes: data-tab / data-pane) */
const svTabs = (list, cur) => `<div class="tabs pz-mt" role="tablist">${list.map(([k, i, t]) => `<button type="button" role="tab" aria-selected="${k === cur}" data-tab="${k}">${sic(i, 17)}<span>${t}</span></button>`).join('')}</div>`;
/* seguimiento visual del estado */
function svTrack(steps, estado, map) {
  const cur = map[estado] != null ? map[estado] : 0; const bad = /Observado|Anulado/.test(estado || '');
  return `<ol class="pz-stp${bad ? ' bad' : ''}" aria-label="Avance: ${esc(estado || '')}">${steps.map((s, i) => `<li class="${i < cur ? 'done' : i === cur ? 'cur' : ''}"><span>${i < cur ? sic('check', 14) : i + 1}</span><b>${esc(i === cur && bad ? estado : s)}</b></li>`).join('')}</ol>`;
}
const svInitials = n => String(n || '').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'E';

/* ---------- Página general de servicios en línea ---------- */
R('servicios', path => {
  const c = mpvCfg(), l = lrCfg(); const nOf = svOfertas().length;
  const r = recepcionDe(new Date().toISOString());
  const cards = [
    ['mpv', [['clock', `${esc(c.dias)}, ${fmt12(c.horaIni)} – ${fmt12(c.horaFin)}`], [r.enHorario ? 'check' : 'alert', r.enHorario ? 'En horario de atención ahora' : 'Fuera de horario: se recibe el siguiente día hábil']], [['Presentar documento', '#/servicios/mesa-de-partes'], ['Consultar expediente', '#/servicios/mesa-de-partes?tab=consulta']]],
    ['lr', [['clock', `Reclamos: ${l.plazoReclamo} días hábiles · Quejas: ${l.plazoQueja}`], ['user', esc(l.responsable || 'Responsable pendiente de asignación')]], [['Registrar reclamo o queja', '#/servicios/libro-de-reclamaciones'], ['Consultar reclamo', '#/servicios/libro-de-reclamaciones?tab=consulta']]],
    ['cert', [['zap', 'Resultado inmediato, también con el código QR'], ['file', 'Títulos, certificados y constancias']], [['Verificar documento', '#/servicios/consulta-certificados']]],
    ['bolsa', [['briefcase', `${nOf} oferta(s) vigente(s)`], ['building', 'Registro de empresas libre y gratuito']], [['Ver ofertas', '#/servicios/bolsa-laboral'], ['Registrar empresa', '#/servicios/bolsa-laboral?tab=empresas']]],
  ];
  const body = `${svNav('')}<div class="pz-svh"><h1>Servicios en línea</h1><p>Realiza tus trámites, presenta reclamos, verifica documentos y encuentra oportunidades laborales desde cualquier lugar, las 24 horas.</p></div>
   <div class="pz-svg">${cards.map(([k, info, acts]) => { const m = SV_MODS[k]; return `<article class="pz-svc t-${m.tone}"><span class="pz-mh-ic">${sic(m.icon, 28)}</span><h2><a href="#/servicios/${m.slug}">${esc(m.title)}</a></h2><p>${esc(m.text)}</p><ul>${info.map(([i, t]) => `<li>${sic(i, 15)}<span>${t}</span></li>`).join('')}</ul><div class="pz-svc-a">${acts.map(([t, h], i) => `<a class="btn ${i ? 'ghost' : ''}" href="${h}">${t}</a>`).join('')}</div></article>`; }).join('')}</div>
   <section class="pz-svx"><div>${sic('layers', 22)}<div><b>Servicios complementarios</b><span>Tópico de salud, bienestar, biblioteca y seguimiento de egresados: ubicación, horario y responsable.</span></div></div><a class="btn ghost" href="#/servicios/complementarios">Ver servicios</a></section>`;
  return shell(path, { title: 'Servicios en línea', desc: `Servicios en línea del ${inst().nombre}: Mesa de Partes Virtual, Libro de Reclamaciones, consulta de certificados y Bolsa Laboral.`, crumbs: [['Servicios']], banner: { kicker: 'Servicios', title: 'Servicios en línea', text: 'Tus trámites, sin colas y desde cualquier lugar' }, body });
});

/* ---------- Consulta y verificación de certificados ---------- */
/* ---------- Registro único de documentos verificables ----------
   Fuente oficial: módulo académico (Certificación modular y Grados y títulos). Cada certificación
   y cada título se copian al registro «Verificación de documentos» del portal, que es el que
   consulta la página pública y donde el personal puede anular un documento. */
const PZ_SRC = { cert: 'Certificación modular', tit: 'Grados y títulos' };
// The PHP transaction maintains the registry and preserves issued snapshots.
// Browser-side catalog synchronization must not rewrite historical documents.
function pzSyncCerts() { return false; }
window.pzSyncCerts = pzSyncCerts;
if (typeof IXHOST === 'object' && IXHOST.saveAcad) { const _sv = IXHOST.saveAcad; IXHOST.saveAcad = a => { try { pzSyncCerts(a); } catch (e) { console.error(e); } return _sv(a); }; }
if (typeof SPECS === 'object' && SPECS.certificados) { const S0 = SPECS.certificados;
  S0.sub = 'Registro único que alimenta la consulta pública de autenticidad (por código o DNI). Las certificaciones modulares, los títulos y las constancias emitidas en el módulo académico se agregan y actualizan automáticamente; desde aquí se pueden anular.';
  const tf = S0.fields.find(f => f.n === 'tipo'); if (tf && Array.isArray(tf.opts)) { const base = tf.opts.slice(); tf.opts = () => [...new Set([...base, 'Certificado modular', ...coll('certificados').map(c => c.tipo).filter(Boolean)])]; }
  if (!S0.fields.some(f => f.n === 'detalle')) S0.fields.push({ n: 'detalle', l: 'Detalle (módulo, resolución u otro)', full: true });
  if (!S0.fields.some(f => f.n === 'motivo')) S0.fields.push({ n: 'motivo', l: 'Motivo de anulación (se muestra en la consulta pública si el documento está anulado)', full: true });
  const isIx = w => /^ix:/.test(w && w.ref || '');
  S0.fields.forEach(f => { if (['codigo', 'dni', 'nombres', 'programaId', 'tipo', 'fecha', 'detalle'].includes(f.n)) { const r0 = f.ro; f.ro = w => isIx(w) || (r0 ? r0(w) : false); } });
  const sx = S0.sideExtra; S0.sideExtra = w => (sx ? sx(w) : '') + (isIx(w) ? `<span style="color:var(--muted);font-size:12.5px;line-height:1.45">Sincronizado desde <b>${esc(w.origen || 'el módulo académico')}</b>. Los datos se corrigen allí; aquí solo se cambia el estado (Válido / Anulado).</span>` : '');
  const tc = S0.cols.find(c => c.l === 'Tipo'); if (tc) tc.f = r => `${esc(r.tipo)}${r.detalle ? `<br><small style="color:var(--muted)">${esc(r.detalle)}</small>` : ''}${r.origen ? `<br><small style="color:var(--muted)">Origen: ${esc(r.origen)}</small>` : ''}`; }

R('servicios/consulta-certificados', (path, q) => {
  const pre = (q && q.get ? q.get('codigo') || '' : '').trim().toUpperCase(); const i = inst();
  const nCert = coll('certificados').length;
  const body = `${svNav('consulta-certificados')}<div class="pz-mpv-top">${svHead('cert', null, true)}${svKeyBox('zap', 'Verificación en línea', 'Resultado inmediato', 'Código QR en cada documento · datos personales protegidos')}</div>
   <div class="pz-cq-wrap"><form class="card cb pz-cq" data-cq novalidate><h2>${sic('search', 20)} Verificar un documento</h2>
     <div class="pz-seg" role="radiogroup" aria-label="Buscar por"><label><input type="radio" name="t" value="codigo" checked><span>${sic('key', 15)} Código de verificación</span></label><label><input type="radio" name="t" value="dni"><span>${sic('user', 15)} DNI del titular</span></label></div>
     <div class="field"><label for="cq-v" data-cql>Código de verificación</label><input id="cq-v" name="v" autocomplete="off" placeholder="Ej.: CERT-2025-000123" value="${esc(pre)}"><div class="hint" data-cqh>Figura en la parte inferior del documento, junto al código QR.</div></div>
     ${captchaHTML('cap-cq')}
     <button class="btn pz-cq-b">${sic('shield', 17)} Verificar autenticidad</button></form>
    <section class="pz-cq-i"><div><h3>¿Qué puedo verificar?</h3><ul><li>${sic('award', 16)} Títulos de Profesional Técnico</li><li>${sic('file', 16)} Certificados de estudios y modulares</li><li>${sic('clipboard', 16)} Constancias emitidas por el instituto</li></ul></div><div><h3>¿Tienes el documento impreso?</h3><p>Escanea su código QR con la cámara del celular: se abrirá esta página con el resultado.</p><p class="pz-cq-n">Por seguridad, el DNI del titular se muestra parcialmente oculto (Ley N.º 29733).</p></div><div><h3>Emisión de documentos</h3><p>Para solicitar un certificado o una constancia, presenta tu solicitud por la <a href="#/servicios/mesa-de-partes">Mesa de Partes Virtual</a>. Costos según el <a href="#/transparencia/tupa">TUPA vigente</a>.</p><h3>Secretaría Académica</h3><p>📞 ${esc(i.telefono)} · ✉️ <a href="mailto:${esc(i.correo)}">${esc(i.correo)}</a><br>🕗 ${esc(i.horario)}</p></div></section></div>
   <div id="cq-r" aria-live="polite"></div>`;
  const side = null;
  const html = shell(path, { title: 'Consulta de certificados', desc: `Verificación en línea de títulos, certificados y constancias del ${inst().nombre}.`, crumbs: [['Servicios', '#/servicios'], ['Consulta de certificados']], banner: { kicker: 'Servicios en línea', title: 'Consulta de certificados', text: 'Verificación de autenticidad en línea' }, side, body });
  const card = d => `<article class="pz-cert ${d.ok ? 'ok' : 'bad'}" role="status"><div class="pz-cert-s">${sic(d.ok ? 'check' : 'x', 30)}<b>${d.ok ? 'DOCUMENTO VÁLIDO' : 'DOCUMENTO ANULADO'}</b><small>${d.ok ? 'Emitido por el ' + esc(i.nombreCorto) : 'Este documento no tiene validez'}</small></div>
     <dl><dt>Tipo de documento</dt><dd>${esc(d.tipo)}</dd>${d.det ? `<dt>${/T[ií]tulo/.test(d.tipo) ? 'Resolución' : 'Detalle'}</dt><dd>${esc(d.det)}</dd>` : ''}<dt>Código</dt><dd class="mono">${esc(d.cod)}</dd>${d.titular ? `<dt>Titular</dt><dd><b>${esc(d.titular)}</b></dd>` : ''}${d.dni ? `<dt>DNI</dt><dd class="mono">${esc(maskDni(d.dni))}</dd>` : ''}${d.prog ? `<dt>Programa de estudios</dt><dd>${esc(d.prog)}</dd>` : ''}<dt>Fecha de emisión</dt><dd>${esc(d.fecha)}</dd>${d.motivo ? `<dt>Motivo de anulación</dt><dd>${esc(d.motivo)}</dd>` : ''}${d.origen ? `<dt>Registro</dt><dd>${esc(d.origen)}</dd>` : ''}<dt>Verificado el</dt><dd>${fdate(new Date().toISOString(), true)}</dd></dl></article>`;
  const DOCT = { cert: 'Constancia de certificación modular', titulo: 'Reporte de validación de título', cargo: 'Cargo de recepción de documento', reclamo: 'Hoja de reclamación', horario: 'Horario académico' };
  const fx = x => x ? fdate(String(x).slice(0, 10) + 'T12:00:00') : '—';
  const show = (t, v, records = []) => {
    try { if (pzSyncCerts()) saveDB(); } catch (e) { }
    const pn = id => id ? (progById(id) || {}).nombre || '' : '';
    let rs = records.filter(c => t === 'codigo' ? String(c.codigo).toUpperCase() === v : c.dni === v)
      .map(c => ({ ok: c.estado === 'Válido', tipo: c.tipo, det: c.detalle || '', cod: c.codigo, titular: c.nombres, dni: c.dni, prog: pn(c.programaId), f: c.fecha, fecha: fx(c.fecha), motivo: c.estado !== 'Válido' ? c.motivo || '' : '', origen: c.origen || '' }));
    if (!rs.length && records.length && t === 'codigo' && IX && IX.db) { const d = (XD().docs || []).find(x => String(x.cod).toUpperCase() === v); if (d) rs.push({ ok: d.valido !== false, tipo: DOCT[d.tipo] || d.tipo, det: '', cod: d.cod, titular: d.persona, dni: '', prog: '', f: d.fecha, fecha: fx(d.fecha), origen: 'Módulo académico' }); }
    const ord = x => /T[ií]tulo/.test(x.tipo) ? 0 : /^Certificado/.test(x.tipo) ? 1 : 2;
    rs.sort((a, b) => ord(a) - ord(b) || String(b.f).localeCompare(String(a.f)));
    /* solicitudes de certificados o constancias en trámite por la Mesa de Partes Virtual (solo para DNI) */
    const pend = t === 'dni' ? coll('expedientes').filter(x => x.numDoc === v && !['Atendido', 'Archivado'].includes(x.estado) && /certific|constanc|t[íi]tulo|record|fut/i.test(`${x.tipoTramite} ${x.asunto}`)) : [];
    const pendBox = pend.length ? `<div class="pz-cq-pend" role="status">${sic('inbox', 22)}<div><b>${pend.length === 1 ? 'Tiene 1 solicitud en trámite' : `Tiene ${pend.length} solicitudes en trámite`} en la Mesa de Partes Virtual</b><span>${pend.map(x => `${esc(x.tipoTramite)} · presentada el ${fx(x.fecha)} · <em>${esc(x.estado)}</em>`).join('<br>')}</span><a href="#/servicios/mesa-de-partes?tab=consulta">Ver el seguimiento con su N.º de expediente</a></div></div>` : '';
    const n = rs.length, nv = rs.filter(x => x.ok).length;
    const list = () => { const h = rs[0]; const ps = [...new Set(rs.map(x => x.prog).filter(Boolean))];
      return `<h2 class="pz-h2">Documentos emitidos a nombre del titular</h2><section class="pz-cq-tit"><span class="pz-cq-av">${esc(svInitials(h.titular || ''))}</span><div><b>${esc(h.titular || '')}</b><small>DNI ${esc(maskDni(h.dni || v))}${ps.length ? ' · ' + ps.map(esc).join(' · ') : ''}</small></div><ul><li><b>${n}</b> documentos</li><li class="ok"><b>${nv}</b> válido${nv === 1 ? '' : 's'}</li>${n - nv ? `<li class="bad"><b>${n - nv}</b> anulado${n - nv === 1 ? '' : 's'}</li>` : ''}</ul></section>${pendBox}
       <div class="pz-cq-list">${rs.map(d => `<article class="${d.ok ? 'ok' : 'bad'}"><span class="pz-cq-st">${sic(d.ok ? 'check' : 'x', 15)}${d.ok ? 'Válido' : 'Anulado'}</span><div class="pz-cq-d"><b>${esc(d.tipo)}</b>${d.det ? `<small>${esc(d.det)}</small>` : ''}${d.motivo ? `<small class="m">Motivo: ${esc(d.motivo)}</small>` : ''}</div><div class="pz-cq-c"><span class="mono">${esc(d.cod)}</span><small>Emitido el ${esc(d.fecha)}</small></div><a class="btn xs sec" href="#/servicios/consulta-certificados?codigo=${encodeURIComponent(d.cod)}" aria-label="Ver la verificación de ${esc(d.cod)}">Ver detalle</a></article>`).join('')}</div>
       <p class="pz-cq-note">${sic('clock', 14)} Verificado el ${fdate(new Date().toISOString(), true)}. Cada documento impreso tiene su propio código y QR para verificarlo por separado.</p>`; };
    $('#cq-r').innerHTML = n && t === 'dni' ? list() : n ? `<h2 class="pz-h2">${n > 1 ? `${n} documentos encontrados${t === 'dni' ? ` · ${nv} válido${nv === 1 ? '' : 's'}` : ''}` : 'Resultado de la verificación'}</h2>${pendBox}<div class="pz-cert-g">${rs.map(card).join('')}</div>`
      : `${pendBox}<div class="pz-cert none" role="status"><div class="pz-cert-s">${sic('alert', 30)}<b>NO SE ENCONTRÓ EL DOCUMENTO</b><small>Revise el ${t === 'codigo' ? 'código (incluya guiones)' : 'DNI'} e intente nuevamente. Si el problema continúa, comuníquese con Secretaría Académica.</small></div><div class="pz-cert-x"><p>${t === 'dni' ? 'No hay títulos, certificados ni constancias registrados a nombre de este DNI.' : 'El código no corresponde a ningún documento emitido por el instituto.'}</p><a class="btn sec" href="#/servicios/mesa-de-partes">${sic('inbox', 15)} Solicitar un certificado o constancia</a></div></div>`;
    const r = $('#cq-r'); if (r.scrollIntoView && window.innerWidth < 900) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return { html, after: () => {
    const f = $('[data-cq]');
    const sync = () => { const dni = f.t.value === 'dni'; $('[data-cql]', f).textContent = dni ? 'DNI del titular' : 'Código de verificación'; f.v.placeholder = dni ? 'Ej.: 72345678' : 'Ej.: CERT-2025-000123'; f.v.inputMode = dni ? 'numeric' : 'text'; $('[data-cqh]', f).textContent = dni ? 'Se listan todos los documentos emitidos a nombre del titular.' : 'Figura en la parte inferior del documento, junto al código QR.'; };
    $$('[name=t]', f).forEach(x => x.onchange = sync);
    const lookup = (t, v) => { const result = portalLookup('certificados', v, '', t); if (t !== 'codigo') { const box = $('#cap-cq', f); if (box) { delete box.dataset.challenge; delete box.dataset.loading; f.captcha.value = ''; loadCaptcha(box); } } show(t, v, result ? (Array.isArray(result) ? result : [result]) : []); };
    if (pre) lookup('codigo', pre);
    f.onsubmit = e => { e.preventDefault(); const v = f.v.value.trim().toUpperCase(); const er = {}; if (!v) er.v = f.t.value === 'dni' ? 'Ingrese el DNI del titular.' : 'Ingrese el código de verificación.'; else if (f.t.value === 'dni' && !/^\d{8}$/.test(v)) er.v = 'El DNI debe tener 8 dígitos.'; const cap = checkCaptcha(f, 'cap-cq'); if (cap) er.captcha = cap; if (!showErrors(f, er)) return; lookup(f.t.value, v); };
  } };
});

/* ---------- Bolsa laboral: módulo público integrado (sin login propio) ---------- */
function svOfertas() {
  if (!IX || !IX.db) return []; const D = XD(); const hoy = ymd(new Date());
  return D.ofertas.filter(o => o.estado === 'Publicada' && o.limite >= hoy && (D.empresas.find(e => e.id === o.emp) || {}).validada).sort((a, b) => String(a.limite).localeCompare(String(b.limite)));
}
function svOferta(o) {
  const e = xemp(o.emp), pr = o.prog ? xprog(o.prog) : null; const dias = Math.max(0, Math.round((new Date(o.limite + 'T12:00:00') - new Date()) / 86400000));
  return `<article class="pz-of" data-of="${o.id}" data-prog="${o.prog || ''}" data-mod="${esc(o.modal)}" data-txt="${esc(nrm([o.puesto, e.nom, o.desc, o.req, e.ubic, pr ? pr.nombre : ''].join(' ')))}">
   <header><span class="pz-of-av">${esc(svInitials(e.nom))}</span><div><h3>${esc(o.puesto)}</h3><small>${esc(e.nom)}</small></div></header>
   <ul class="pz-of-ch"><li>${sic('map', 14)}${esc(e.ubic || 'Ica')}</li><li>${sic('building', 14)}${esc(o.modal)}</li><li>${sic('users', 14)}${o.vac} vacante${o.vac > 1 ? 's' : ''}</li></ul>
   <p>${esc(o.desc)}</p><p class="pz-of-rq"><b>Requisitos:</b> ${esc(o.req)}</p>
   <footer><div><span class="pz-of-pg">${esc(pr ? pr.cod : 'Todos los programas')}</span><small class="${dias <= 7 ? 'soon' : ''}">${sic('calendar', 13)} Cierra el ${fdx(o.limite)}${dias <= 7 ? ` · ${dias === 0 ? 'hoy' : dias + ' día' + (dias > 1 ? 's' : '')}` : ''}</small></div><button type="button" class="btn" data-post="${o.id}">${sic('send', 15)} Postular</button></footer></article>`;
}
function svPostular(id) {
  const o = XD().ofertas.find(x => x.id === +id); if (!o) return; const u = currentUser();
  if (u && ['estudiante', 'egresado'].includes(u.rol)) { try { sessionStorage.setItem('pz_post', String(o.id)); } catch (e) { } go('#/admin/ix-bolsa'); return; }
  if (u) { toast('La postulación es para estudiantes y egresados. Su cuenta actual es de otro perfil.', 'err'); return; }
  try { sessionStorage.setItem('pz_post', String(o.id)); sessionStorage.setItem('pz_next', '#/admin/ix-bolsa'); } catch (e) { }
  go('#/admin');
}
R('servicios/bolsa-laboral', (path, q) => {
  const ofs = svOfertas(); const D = IX && IX.db ? XD() : { empresas: [], programas: [] }; const cfg = window.pzBolsaCfg();
  const emps = D.empresas.filter(e => e.validada); const vac = ofs.reduce((a, o) => a + (+o.vac || 0), 0);
  const tab0 = q && q.get && (q.get('tab') === 'empresas' || q.get('registro') === '1') ? 'e' : q && q.get && q.get('tab') === 'como' ? 'i' : 'o';
  const progs = [...new Set(ofs.map(o => o.prog).filter(Boolean))].map(id => xprog(id));
  const body = `${svNav('bolsa-laboral')}<div class="pz-mpv-top">${svHead('bolsa', null, true)}${svKeyBox('briefcase', 'Bolsa Laboral en cifras', `${ofs.length} ofertas · ${vac} vacantes`, `${emps.length} empresa(s) aliada(s) · responsable: ${esc(cfg.responsable || 'pendiente de asignación')}`)}</div>
   ${svTabs([['o', 'briefcase', 'Ofertas laborales'], ['e', 'building', 'Para empresas'], ['i', 'book', '¿Cómo postular?']], tab0)}
   <div data-pane="o" ${tab0 === 'o' ? '' : 'hidden'}>
    <div class="pz-of-f" role="search"><div class="pz-in2">${sic('search', 17)}<input type="search" data-ofq placeholder="Buscar por puesto, empresa o palabra clave" aria-label="Buscar ofertas"></div>
     <select data-ofp aria-label="Programa de estudios"><option value="">Todos los programas</option>${progs.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select>
     <select data-ofm aria-label="Modalidad"><option value="">Toda modalidad</option>${[...new Set(ofs.map(o => o.modal))].map(m => `<option>${esc(m)}</option>`).join('')}</select></div>
    <p class="pz-of-n" data-ofn>${ofs.length} oferta(s) vigente(s)</p>
    ${ofs.length ? `<div class="pz-of-g">${ofs.map(svOferta).join('')}</div><div class="empty" data-of0 hidden>No hay ofertas con esos filtros.</div>` : '<div class="empty">No hay ofertas vigentes por el momento. Vuelve pronto.</div>'}
    <div class="pz-of-cta">${sic('lock', 20)}<div><b>Para postular no necesitas otra cuenta.</b><span>Presiona «Postular» e ingresa a la intranet con tu DNI y la contraseña que te entregó Secretaría Académica. Tu perfil y tu CV se gestionan allí.</span></div></div>
   </div>
   <div data-pane="e" ${tab0 === 'e' ? '' : 'hidden'}>
    <div class="pz-bl-e2"><section class="pz-bl-reg"><div class="pz-bl-e2h">${sic('plus', 20)}<div><b>Registra tu empresa</b><span>Libre y gratuito. ${esc(cfg.responsable || 'Responsable pendiente de asignación')} valida los datos antes de que publiques ofertas.</span></div></div><div class="pz-bl-ix">${ixWrap(IX.view('pub:bolsa'))}</div></section>
     <aside class="pz-bl-side"><section><h3>${sic('key', 17)} ¿Tu empresa ya está registrada?</h3><p>Ingresa a la intranet con tu RUC y contraseña para publicar convocatorias y revisar postulantes.</p><a class="btn" href="#/admin">Ingresar a la intranet</a></section>
      <section><h3>${sic('building', 17)} Empresas aliadas</h3>${emps.length ? `<ul class="pz-bl-al">${emps.map(e => `<li><span class="pz-of-av sm">${esc(svInitials(e.nom))}</span><span><b>${esc(e.nom)}</b><small>${esc(e.sector || '')}</small></span></li>`).join('')}</ul>` : '<p>Aún no hay empresas aliadas.</p>'}</section>
      <section><h3>${sic('mail', 17)} Validación de empresas</h3><p><b>${esc(cfg.responsable || 'Responsable pendiente de asignación')}</b><br><a href="mailto:${esc(cfg.correo)}">${esc(cfg.correo)}</a></p></section></aside></div>
   </div>
   <div data-pane="i" ${tab0 === 'i' ? '' : 'hidden'}>
    ${svSteps([['Busca la oferta', 'Filtra por programa de estudios o modalidad.'], ['Presiona «Postular»', 'El sistema te lleva al inicio de sesión de la intranet.'], ['Inicia sesión', 'Con tu DNI y contraseña de estudiante o egresado.'], ['Confirma', 'Tu postulación se envía con tu perfil y tu CV.']])}
    <section class="card cb pz-bl-faq"><h2>Preguntas frecuentes</h2><h3>¿Quién puede postular?</h3><p>Estudiantes y egresados de ${esc(inst().nombre)} con cuenta en la intranet. Si aún no tienes cuenta, solicítala en Secretaría Académica.</p><h3>¿Dónde subo mi CV?</h3><p>En la intranet, en Bolsa laboral › Mi perfil. Es obligatorio para postular.</p><h3>¿Cómo sé si me seleccionaron?</h3><p>En la intranet verás el estado de cada postulación (Recibida, En revisión, Seleccionado) y recibirás un aviso.</p><h3>Soy empresa, ¿cuánto cuesta?</h3><p>Nada. El registro y la publicación de ofertas son gratuitos.</p></section>
   </div>`;
  const side = null;
  const html = shell(path, { title: 'Bolsa Laboral', desc: `Bolsa Laboral del ${inst().nombre}: ofertas de empleo y prácticas para estudiantes y egresados, y registro libre de empresas.`, crumbs: [['Servicios', '#/servicios'], ['Bolsa Laboral']], banner: { kicker: 'Servicios en línea', title: 'Bolsa Laboral', text: 'Conectamos talento con empresas' }, side, body });
  return { html, after: () => {
    const showTab = k => { $$('.pz-mt [data-tab]').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === k)); $$('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== k); if (k === 'e') { const b = $('[data-tab="pubbolsa:empresa"]'); if (b && b.getAttribute('aria-selected') !== 'true') b.click(); } };
    $$('.pz-mt [data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab)); if (tab0 === 'e') showTab('e');
    $$('[data-post]').forEach(b => b.onclick = () => svPostular(b.dataset.post));
    const fq = $('[data-ofq]'), fp = $('[data-ofp]'), fm = $('[data-ofm]');
    const filt = () => { const t = nrm(fq.value), p = fp.value, m = fm.value; let n = 0; $$('.pz-of').forEach(c => { const v = (!t || c.dataset.txt.includes(t)) && (!p || c.dataset.prog === p) && (!m || c.dataset.mod === m); c.hidden = !v; if (v) n++; }); $('[data-ofn]').textContent = `${n} oferta(s) ${t || p || m ? 'encontrada(s)' : 'vigente(s)'}`; const z = $('[data-of0]'); if (z) z.hidden = n > 0; };
    if (fq) { fq.oninput = filt; fp.onchange = filt; fm.onchange = filt; }
  } };
});
/* aviso en el inicio de sesión cuando se viene a postular */
const _loginViewSv = loginView;
loginView = function () {
  let h = _loginViewSv(); let id = null; try { id = sessionStorage.getItem('pz_post'); } catch (e) { }
  const o = id && IX && IX.db ? XD().ofertas.find(x => x.id === +id) : null;
  if (o) h = h.replace('<div class="pz-lg-card">', `<div class="pz-lg-note" role="status">${sic('briefcase', 18)}<span>Para postular a <b>${esc(o.puesto)}</b> (${esc(xemp(o.emp).nom)}), inicie sesión con su <b>DNI</b> y su contraseña de estudiante o egresado. <a href="#/servicios/bolsa-laboral" data-nopost>Volver a las ofertas</a></span></div><div class="pz-lg-card">`);
  return h;
};
const _bindLoginSv = bindLogin;
bindLogin = function () { _bindLoginSv(); const a = $('[data-nopost]'); if (a) a.onclick = () => { try { sessionStorage.removeItem('pz_post'); sessionStorage.removeItem('pz_next'); } catch (e) { } }; };
/* tras iniciar sesión: continuar con la postulación */
const _dashSv = CUSTOM.dashboard;
CUSTOM.dashboard = (parts, q) => {
  let nx = null; try { nx = sessionStorage.getItem('pz_next'); sessionStorage.removeItem('pz_next'); } catch (e) { }
  const u = currentUser();
  if (nx && u && ['estudiante', 'egresado'].includes(u.rol)) setTimeout(() => go(nx), 0);
  else if (nx) { try { sessionStorage.removeItem('pz_post'); } catch (e) { } if (u) setTimeout(() => toast('La postulación es para estudiantes y egresados.', 'err'), 300); }
  return _dashSv(parts, q);
};
const _ixBolsaSv = CUSTOM['ix-bolsa'];
CUSTOM['ix-bolsa'] = (parts, q) => {
  const r = _ixBolsaSv(parts, q); if (!isCommunity()) return r; const a = r && r.after;
  return Object.assign({}, r, { after: () => { if (a) a(); let id = null; try { id = sessionStorage.getItem('pz_post'); sessionStorage.removeItem('pz_post'); } catch (e) { } if (!id) return;
    const tryPost = (n) => { const b = document.querySelector(`.ix [data-act="postular"][data-id="${id}"]`); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return; }
      /* la oferta puede ser de otro programa: se quita el filtro «Solo de …» y se vuelve a buscar */
      const cb = document.querySelector('.ix [data-chg="bSolo"]'); if (n && cb && cb.checked) { cb.click(); setTimeout(() => tryPost(0), 200); return; } const o = XD().ofertas.find(x => x.id === +id); toast(o && XD().postulaciones.some(p => p.of === o.id && p.est === (XD().estudiantes.find(e => e.dni === (currentUser() || {}).usuario) || {}).id) ? 'Ya postulaste a esta oferta.' : 'Revisa la oferta en tu Bolsa laboral para completar la postulación.'); };
    setTimeout(() => tryPost(1), 150); } });
};
window.svNav = svNav;
/* en celular, la barra de módulos se desplaza hasta el servicio activo */
window.addEventListener('hashchange', () => setTimeout(() => { const a = document.querySelector('.pz-svnav a.on'); if (a && a.parentNode.scrollWidth > a.parentNode.clientWidth) a.parentNode.scrollLeft = Math.max(0, a.offsetLeft - 40); }, 80));

/* ---------- Intranet: Certificación modular, Grados y títulos y Verificación de documentos en un solo grupo ---------- */
(function () {
  const G = NAV_GROUPS.find(g => g[0] === 'Gestión académica'); if (!G) return;
  const keys = ['ix-certificados', 'ix-titulos', 'certificados'];
  G[1] = G[1].filter(([m]) => !keys.includes(m));
  NAV_GROUPS.splice(NAV_GROUPS.indexOf(G) + 1, 0, ['Certificados y títulos', [['ix-certificados', 'award'], ['ix-titulos', 'grad'], ['certificados', 'shield']]]);
})();
function pzDocNav(cur) {
  const X = IX && IX.db ? XD() : { certs: [], titulos: [] }; const reg = alive('certificados');
  const it = [['ix-certificados', 'award', 'Certificación modular', `${X.certs.length} certificaciones`, '1. Registra la certificación de cada módulo'],
    ['ix-titulos', 'grad', 'Grados y títulos', `${X.titulos.length} títulos`, '2. Registra los títulos otorgados'],
    ['certificados', 'shield', 'Constancias / Certificados', `${reg.filter(r => r.estado === 'Válido').length} válidos · ${reg.filter(r => r.estado !== 'Válido').length} anulados`, '3. Registra constancias y certificados de cursos']];
  const ok = m => typeof can !== 'function' || can(m);
  return `<nav class="pz-dnav" aria-label="Certificados y títulos">${it.filter(x => ok(x[0])).map(([m, i, l, n, d]) => `<a href="#/admin/${m}" class="${m === cur ? 'on' : ''}" ${m === cur ? 'aria-current="page"' : ''}>${sic(i, 18)}<span><b>${l}</b><small>${d}</small><em>${n}</em></span></a>`).join('')}<a class="pub" href="#/servicios/consulta-certificados" target="_blank" rel="noopener">${sic('external', 16)}<span><b>Consulta pública</b><small>Así lo ve el ciudadano</small></span></a></nav>`;
}
if (typeof IXHOST === 'object' && IXHOST.head) { const _hd = IXHOST.head;
  IXHOST.head = (title, desc, actions, code) => { const t = String(title).replace(/<[^>]+>/g, '');
    const k = ['Constancias y certificados','Certificación modular'].includes(t) ? 'ix-certificados' : t === 'Grados y títulos' ? 'ix-titulos' : null;
    if (!k || !currentUser() || isCommunity()) return _hd(title, desc, actions, code);
    const tt = k === 'ix-certificados' ? 'Certificación modular' : t;
    return admHead(tt, desc || '', actions || '', k === 'ix-certificados' ? 'award' : 'grad', [['Certificados y títulos'], [tt]]) + pzDocNav(k); }; }
if (typeof SPECS === 'object' && SPECS.certificados) { const tb = SPECS.certificados.tabs; SPECS.certificados.tabs = v => (tb ? tb(v) : '') + pzDocNav('certificados'); }

/* ---------- Tema: en modo oscuro, fondos, tarjetas y bordes derivan del color principal del tema ---------- */
(function () {
  if (typeof themeVars !== 'function') return;
  const hsl = hex => { const [r, g, b] = hexRgb(hex).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } const l = (mx + mn) / 2; return [h, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l]; };
  const hex = (h, s, l) => { const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return rgbToHex([r + m, g + m, b + m].map(v => v * 255)); };
  const _tv = themeVars;
  themeVars = function (t) {
    const v = _tv(t); if (!t || t.modo !== 'oscuro') return v;
    const [h, s0] = hsl(t.navy || '#0a1428'); const s = Math.min(s0, .45);
    const card = hex(h, s, .13);
    Object.assign(v, { '--page': hex(h, s, .065), '--bg': hex(h, s, .1), '--bg2': hex(h, s, .08), '--card': card, '--white': card, '--card2': hex(h, s, .155),
      '--line': hex(h, s * .8, .22), '--line2': hex(h, s * .8, .3), '--ink': hex(h, .25, .92), '--ink2': hex(h, .2, .78), '--muted': hex(h, .14, .62), '--sky': mix(card, t.blue, .22) });
    return v;
  };
  /* imágenes de relleno (sin foto) con los colores del tema */
  if (typeof applyTheme === 'function' && typeof PALS !== 'undefined') { const _ap = applyTheme;
    applyTheme = function () { _ap.apply(this, arguments); try { const t = DB.config.temas[DB.config.tema]; const k = [t.navy, t.navy2, t.blue].join();
      if (PALS._k !== k) { PALS.splice(0, PALS.length, [t.navy, t.blue], [t.navy2, mix(t.blue, '#ffffff', .2)], [mix(t.navy, '#000000', .25), t.navy2], [t.blue, mix(t.blue, '#ffffff', .35)]); PALS._k = k; Object.keys(IMG_CACHE || {}).forEach(x => delete IMG_CACHE[x]); } } catch (e) { } }; }
  try { applyTheme(); } catch (e) { }
})();


/* La identidad y el contenido institucional proceden de PHP/MySQL. */
window.piscoOficial = function (D) {};


/* =========================================================
   DATOS DE DEMOSTRACIÓN 2026 (se cargan al crear la base) e integración final
   ========================================================= */
window.piscoSeed = function (D) {};
/* Integración al terminar de cargar la aplicación */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    pzEnsure();
    if (IX && IX.db) { const X = IX.db(); let ch = false;

      X.cfg.docs = X.cfg.docs || {};
      if (!X.cfg.docsLogoInit) { const lg = await logoPng(); if (lg) { X.cfg.docs.logoIzq = { src: lg, w: 240, h: 310 }; X.cfg.docsLogoInit = true; ch = true; } }
      if (ch) if(!IX.persist())return false;
      try { if (window.pzSyncCerts && pzSyncCerts(X)) { saveDB(); ch = true; } } catch (e) { console.error(e); }
      // init() ya dibujó la página con pzEnsure aplicado: solo se vuelve a dibujar si algo cambió aquí.
      if (ch) route(); }
  } catch (e) { console.error(e); }
});
})();
