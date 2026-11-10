/* ==== academico.js ==== (módulos académicos integrados: horarios, certificación modular, títulos, bolsa laboral) */
function IX_FACTORY(HOST){
"use strict";
/* =====================================================================
   INTRANET INSTITUCIONAL IESTP PISCO — PORTAL WEB 2026
   Núcleo: almacenamiento, datos de demostración, utilidades, CRUD,
   documentos (PDF con QR de verificación) y exportaciones (Excel/PDF).
   ===================================================================== */
const SKEY = "iestp-pisco-sesion";
const LS = {
  get(k){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : null }catch(e){ return null } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)) }catch(e){} },
  del(k){ try{ localStorage.removeItem(k) }catch(e){} }
};

/* ---------- fechas ---------- */
const pad = n => String(n).padStart(2,"0");
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => isoOf(new Date());
const nowStamp = () => { const d = new Date(); return `${isoOf(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` };
const ago = (n, hm) => { const d = new Date(); d.setDate(d.getDate()-n); return isoOf(d) + (hm ? " " + hm : "") };
const fd = s => { if(!s) return "—"; const [y,m,d] = s.slice(0,10).split("-"); return `${d}/${m}/${y}` + (s.length > 10 ? " " + s.slice(11,16) : "") };
function addBiz(iso, n){ const d = new Date(iso.slice(0,10)+"T12:00:00"); let k = 0; while(k < n){ d.setDate(d.getDate()+1); const w = d.getDay(); if(w !== 0 && w !== 6) k++ } return isoOf(d) }
function bizLeft(due){ const a = new Date(today()+"T12:00:00"), b = new Date(due+"T12:00:00"); let n = 0; const s = a <= b ? 1 : -1; const d = new Date(a); while(isoOf(d) !== isoOf(b)){ d.setDate(d.getDate()+s); const w = d.getDay(); if(w !== 0 && w !== 6) n += s } return n }
const DIAS = ["Lun","Mar","Mié","Jue","Vie","Sáb"];
const DIAS_L = {Lun:"Lunes",Mar:"Martes","Mié":"Miércoles",Jue:"Jueves",Vie:"Viernes","Sáb":"Sábado"};
const dayKey = () => ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][new Date().getDay()];
const mins = t => { const [h,m] = t.split(":").map(Number); return h*60+m };
/* bloques horarios por turno: se calculan desde la configuración (DB.cfg.bloques) */
const BLOQ_DEF = { "Mañana":{ini:"08:00", dur:60, n:6, recs:[{after:3, min:15}]}, "Tarde":{ini:"14:30", dur:60, n:5, recs:[{after:3, min:15}]} };
const hhmm = m => `${pad(Math.floor(m/60))}:${pad(m%60)}`;
const normBloq = c => { c = Object.assign({}, c); if(!Array.isArray(c.recs)) c.recs = c.rec && c.recMin ? [{after:+c.rec, min:+c.recMin}] : []; delete c.rec; delete c.recMin; c.recs = c.recs.filter(r => r.after >= 1 && r.after < c.n && r.min > 0).sort((x,y) => x.after - y.after); return c };
function buildSlots(c){ c = normBloq(c); const out = []; let t = mins(c.ini); for(let i = 1; i <= c.n; i++){ out.push([hhmm(t), hhmm(t + c.dur)]); t += c.dur; const r = c.recs.find(x => x.after === i); if(r){ out.push(["REC", hhmm(t), hhmm(t + r.min)]); t += r.min } } return out }
const SLOTS = {};
const bloqCfg = t => { let b = null; try{ b = DB && DB.cfg && DB.cfg.bloques && DB.cfg.bloques[t] }catch(e){} return normBloq(Object.assign({}, BLOQ_DEF[t], b || {})) };
function rebuildSlots(){ Object.keys(BLOQ_DEF).forEach(t => { SLOTS[t] = buildSlots(bloqCfg(t)) }) }
rebuildSlots();
const slotStarts = t => SLOTS[t].filter(s => s[0] !== "REC").map(s => s[0]);
const slotEnds = t => SLOTS[t].filter(s => s[0] !== "REC").map(s => s[1]);

/* ---------- datos de demostración (ficticios) ---------- */
function seed(){ throw new Error('Los datos académicos se inicializan en PHP y MySQL.'); }
let DB = HOST.loadAcad();
if(!DB || DB.v !== 3){ DB = seed(); DB.progMap = {apsti:1, cont:2, pa:3, enf:4}; }
// PHP representa los mapas vacíos como []; convertir antes de usar claves de texto.
DB.publicados = Object.assign({}, DB.publicados || {});
rebuildSlots();
function save(){ return HOST.saveAcad(DB) }

/* ---------- estado de la interfaz ---------- */
const S = { user:null, view:"inicio", tab:{}, q:{}, last:{}, mode:"login", pubTab:"titulos", ui:{} };

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const strip = s => String(s ?? "").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
const byId = (arr,id) => arr.find(x => x.id == id) || null;
// Identidad independiente de las filas que el perfil puede ver. El servidor
// conserva la comprobación de unicidad y el ámbito de cada nuevo registro.
const nextId = arr => {
  const random = new Uint32Array(2); let id;
  do { crypto.getRandomValues(random); id = (random[0] & 0xfffff) * 4294967296 + random[1]; }
  while (!id || arr.some(row => row.id === id));
  return id;
};
const prog = id => byId(DB.programas,id) || {cod:"—",nombre:"—"};
const ud = id => byId(DB.uds,id) || {nombre:"—",cod:"—"};
const docente = id => byId(DB.docentes,id);
const amb = id => byId(DB.ambientes,id);
const est = id => byId(DB.estudiantes,id) || {nom:"—",dni:"—",prog:0};
const empresa = id => byId(DB.empresas,id) || {nom:"—"};
const areaN = cod => (DB.areas.find(a => a.cod === cod) || {nombre:cod||"—"}).nombre;
const tram = id => byId(DB.tramites,id) || {nombre:"—",dias:0};
const shortName = n => { if(!n) return "—"; const p = n.split(" "); return p.length >= 3 ? `${p[0]} ${p[p.length-2]}` : n };
const initials = n => n.split(" ").filter(Boolean).filter((_,i,a)=> i===0 || i===a.length-2).map(x=>x[0]).join("").slice(0,2).toUpperCase();
const kb = b => b > 1048576 ? (b/1048576).toFixed(1)+" MB" : Math.max(1,Math.round(b/1024))+" KB";
const pill = (t,c) => `<span class="pill ${c}">${esc(t)}</span>`;
const EST_CLS = {"Recibido":"p-info","Derivado":"p-info","En evaluación":"p-warn","Observado":"p-bad","En atención":"p-warn","Atendido":"p-ok","Respondido":"p-ok","Cerrado":"p-mut","Publicada":"p-ok","Por validar":"p-warn","Rechazada":"p-bad","Cerrada":"p-mut","En revisión":"p-warn","Recibida":"p-info","Seleccionado":"p-ok","No seleccionado":"p-mut","Regular":"p-info","Egresado":"p-ok","Titulado":"p-brand","Retirado":"p-mut","Activo":"p-ok","Inactivo":"p-mut","Nombrado":"p-brand","Contratado":"p-info"};
const estPill = e => pill(e, EST_CLS[e] || "p-mut");
function toast(msg){ HOST.toast(msg) }
function genCode(){ return [...crypto.getRandomValues(new Uint8Array(12))].map(v=>v.toString(16).padStart(2,"0")).join("").toUpperCase(); }

/* ---------- roles, permisos, sesión ---------- */
const ROLES = { admin:"Administrador general", dir:"Directivo", acad:"Responsable académico", adm:"Responsable administrativo", doc:"Docente", est:"Estudiante", egr:"Egresado", emp:"Empresa" };
const MODS = [
  ["inicio","Mi panel","",""],
  ["alumnos","Maestro de alumnos","1.0","Gestión académica"],
  ["horarios","Programación de horarios","1.1","Gestión académica"],
  ["certificados","Certificación modular","1.2","Gestión académica"],
  ["titulos","Grados y títulos","1.3","Gestión académica"],
  ["bolsa","Bolsa laboral","2.3","Servicios"],
  ["config","Configuración académica general","","Configuración"]];
/* ---------- iconos (SVG en línea) ---------- */
const _i = d => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICO = {
  inicio:_i('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'),
  horarios:_i('<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M8 14h3M8 17h6"/>'),
  certificados:_i('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="m9 15 2 2 4-4"/>'),
  titulos:_i('<path d="M2 9 12 4l10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/><path d="M22 9v6"/>'),
  reclamos:_i('<path d="M4 4h12a2 2 0 0 1 2 2v14l-4-3H4z"/><path d="M8 9h6M8 12h4"/><path d="M18 6h2v10"/>'),
  mesa:_i('<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>'),
  bolsa:_i('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>'),
  docentes:_i('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  usuarios:_i('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.7.8 2.9 2.6 3.5 5.2"/>'),
  bitacora:_i('<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2"/><path d="M21 3v5h-5"/>'),
  config:_i('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  arquitectura:_i('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5" opacity=".5"/>'),
  bell:_i('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  menu:_i('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  moon:_i('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  sun:_i('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  alerta:_i('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>'),
  reloj:_i('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  imagen:_i('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
  globe:_i('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>')
};
/* tema claro/oscuro: preferencia del usuario, por defecto la del sistema */
const TKEY = "iestp-pisco-tema";
const isDark = () => document.documentElement.dataset.mode === "dark";
const themeBtn = () => `<button class="iconbtn" data-act="theme" aria-label="${isDark() ? "Usar tema claro" : "Usar tema oscuro"}" title="${isDark() ? "Tema claro" : "Tema oscuro"}">${isDark() ? ICO.sun : ICO.moon}</button>`;

/* ---------- apariencia configurable (tema, tipografía, logo) ---------- */
const PALETAS = [
  ["ica","Verde institucional","Verde institucional y dorado.",{bg:"#f3f6f5",side:"#0b2b28",brand:"#0f5e57",acc:"#c08424"}],
  ["nazca","Granate Nazca","Granate y ocre, inspirado en la región Ica.",{bg:"#f7f4f3",side:"#2a0b10",brand:"#8a1c2b",acc:"#c8902e"}],
  ["pacifico","Azul Pacífico","Azul marino y turquesa, sobrio y formal.",{bg:"#f3f5f9",side:"#0b1a33",brand:"#1d4f9c",acc:"#0ea5b7"}],
  ["web","Web institucional","Colores del portal web institucional. Puede ajustarlos abajo.",null]];
const WEB_DEF = {brand:"#ff4f01", acc:"#ff8c01", side:"#131d3b"};
const HEX = /^#[0-9a-f]{6}$/i;
const inkFor = hex => { const n = parseInt(hex.slice(1),16), c = [n>>16&255, n>>8&255, n&255].map(v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4) }); return (.2126*c[0] + .7152*c[1] + .0722*c[2]) > .45 ? "#111111" : "#ffffff" };
const webC = () => Object.assign({}, WEB_DEF, ap().web || {});
const FUENTES = [
  ["moderna","Moderna","Plus Jakarta Sans + Public Sans",'"Plus Jakarta Sans","Segoe UI",system-ui,sans-serif','"Public Sans","Segoe UI",system-ui,sans-serif'],
  ["institucional","Institucional","Montserrat + Open Sans",'"Montserrat","Segoe UI",system-ui,sans-serif','"Open Sans","Segoe UI",system-ui,sans-serif'],
  ["academica","Académica","Merriweather + Source Sans 3",'"Merriweather",Georgia,serif','"Source Sans 3","Segoe UI",system-ui,sans-serif'],
  ["web","Web institucional","Roboto Condensed + Roboto",'"Roboto Condensed","Arial Narrow",system-ui,sans-serif','"Roboto","Segoe UI",system-ui,sans-serif'],
  ["amigable","Amigable","Poppins + Nunito Sans",'"Poppins","Segoe UI",system-ui,sans-serif','"Nunito Sans","Segoe UI",system-ui,sans-serif']];
const TAMANOS = [["s","Pequeño","14px"],["m","Normal","15px"],["l","Grande","16.5px"]];
const AP_DEF = {tema:"ica", fuente:"moderna", tam:"m", logo:"", titulo:""};
const ap = () => { let a = null; try{ a = DB && DB.cfg && DB.cfg.ap }catch(e){} return Object.assign({}, AP_DEF, a || {}) };
function setDocs(patch, msg){ if(lvl("config") < 2) return; DB.cfg.docs = Object.assign(docCfg(), patch); log("Configurar documentos","Configuración",Object.keys(patch).join(", ")); if(!save())return false; if(msg) toast(msg); render() }
function applyAp(){ /* la apariencia la define el portal (Temas y apariencia) */ }
const sealHtml = (cls) => { const a = ap(); return a.logo ? `<div class="seal logo ${cls||""}"><img src="${esc(a.logo)}" alt="Logo de ${esc(DB.cfg.siglas)}"></div>` : `<div class="seal ${cls||""}">${esc(DB.cfg.siglas)}</div>` };
function setAp(patch, msg){ DB.cfg.ap = Object.assign(ap(), patch); applyAp(); if(!save())return false; if(msg) toast(msg); render() }
const lvl = m => S.user ? ((DB.perms[S.user.rol]||{})[m] || 0) : 0;
const R = () => S.user ? S.user.rol : "pub";
const vin = () => { const v = (S.user && S.user.vin || "").split(":"); return {t:v[0], id:+v[1]||0} };
const myEst = () => { const v = vin(); if(v.t === "est" && byId(DB.estudiantes, v.id)) return est(v.id); if(!S.user || !["est","egr"].includes(S.user.rol)) return null; const k = String(S.user.dni || S.user.u || "").trim(); return k ? DB.estudiantes.find(e => e.dni === k) || null : null };
const myDoc = () => vin().t === "doc" ? docente(vin().id) : null;
const myEmp = () => vin().t === "emp" ? empresa(vin().id) : null;
function log(a,m,d){ HOST.audit(a,m,d) }
function notify(to,txt,go){ DB.notifs.unshift({id:nextId(DB.notifs),to,txt,fecha:nowStamp(),go,leido:[]}) }
function myNotifs(){ if(!S.user) return []; return DB.notifs.filter(n => n.to === "r:"+S.user.rol || n.to === "u:"+S.user.id || (n.to === "r:adm" && S.user.rol === "admin")) }

/* ---------- validación de horarios ---------- */
function validar(list){
  const ss = (list || DB.sesiones).filter(s => s.per === DB.cfg.periodo), out = [];
  const all = DB.sesiones.filter(s => s.per === DB.cfg.periodo);
  const g = s => `${prog(s.prog).cod} ${s.ciclo}-${s.sec}`;
  for(let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++){
    const a = all[i], b = all[j];
    if(a.dia !== b.dia || !(mins(a.ini) < mins(b.fin) && mins(b.ini) < mins(a.fin))) continue;
    if(!ss.includes(a) && !ss.includes(b)) continue;
    if(a.doc && a.doc === b.doc) out.push({t:"bad",tipo:"Cruce de docente",ids:[a.id,b.id],msg:`${docente(a.doc).nom} tiene dos clases el ${DIAS_L[a.dia].toLowerCase()}: ${g(a)} (${a.ini}–${a.fin}) y ${g(b)} (${b.ini}–${b.fin}).`});
    if(a.amb && a.amb === b.amb) out.push({t:"bad",tipo:"Cruce de ambiente",ids:[a.id,b.id],msg:`${amb(a.amb).cod} está asignado dos veces el ${DIAS_L[a.dia].toLowerCase()}: ${g(a)} (${a.ini}–${a.fin}) y ${g(b)} (${b.ini}–${b.fin}).`});
    if(a.prog === b.prog && a.ciclo === b.ciclo && a.sec === b.sec && a.turno === b.turno) out.push({t:"bad",tipo:"Superposición en la sección",ids:[a.id,b.id],msg:`${g(a)} tiene dos unidades a la misma hora el ${DIAS_L[a.dia].toLowerCase()} (${ud(a.ud).nombre} y ${ud(b.ud).nombre}).`});
  }
  ss.forEach(s => {
    const d = docente(s.doc), m = amb(s.amb), u = ud(s.ud);
    if(!d) out.push({t:"warn",tipo:"Sin docente",ids:[s.id],msg:`${g(s)}: ${u.nombre} (${s.dia} ${s.ini}) no tiene docente asignado.`});
    else {
      if(!d.dias.includes(s.dia) || mins(s.ini) < mins(d.desde) || mins(s.fin) > mins(d.hasta)) out.push({t:"bad",tipo:"Fuera de disponibilidad",ids:[s.id],msg:`${d.nom} no está disponible el ${DIAS_L[s.dia].toLowerCase()} de ${s.ini} a ${s.fin}. Disponibilidad: ${d.dias.join(", ")} ${d.desde}–${d.hasta}.`});
      if(!d.uds.includes(s.ud)) out.push({t:"warn",tipo:"Docente no habilitado",ids:[s.id],msg:`${d.nom} no tiene registrada la UD ${u.nombre} entre las que puede asumir.`});
    }
    const rc = (SLOTS[s.turno] || []).find(x => x[0] === "REC" && mins(s.ini) < mins(x[2]) && mins(x[1]) < mins(s.fin));
    if(rc) out.push({t:"warn",tipo:"Clase cruza el receso",ids:[s.id],msg:`${g(s)}: ${u.nombre} (${DIAS_L[s.dia]} ${s.ini}–${s.fin}) incluye el receso de ${rc[1]} a ${rc[2]}.`});
    if(!m) out.push({t:"warn",tipo:"Ambiente no asignado",ids:[s.id],msg:`${g(s)}: ${u.nombre} (${s.dia} ${s.ini}) no tiene ambiente.`});
    else if(m.prog && m.prog !== s.prog) out.push({t:"bad",tipo:"Ambiente restringido",ids:[s.id],msg:`${m.cod} es de uso exclusivo de ${prog(m.prog).cod}; no puede asignarse a ${g(s)}.`});
  });
  const grupos = [...new Set(ss.map(s => `${s.prog}|${s.ciclo}|${s.sec}|${s.turno}`))];
  grupos.forEach(k => { const [p,c,sec,t] = k.split("|");
    DB.uds.filter(u => u.prog == p && u.ciclo === c).forEach(u => {
      const hrs = ss.filter(s => s.ud === u.id && s.prog == p && s.sec === sec && s.turno === t).reduce((a,s) => a + (mins(s.fin)-mins(s.ini))/60, 0);
      if(hrs < u.horas) out.push({t:"warn",tipo:"Horario incompleto",ids:[],grp:k,msg:`${prog(+p).cod} ${c}-${sec}: ${u.nombre} tiene ${Math.round(hrs*10)/10} h de ${u.horas} h semanales.`});
    });
  });
  return out;
}
const gkey = (p,c,s,t) => `${p}|${c}|${s}|${t}|${DB.cfg.periodo}`;

/* ---------- formularios genéricos ---------- */
const optsProg = (all) => () => DB.programas.filter(p => all || p.activo).map(p => [p.id, `${p.cod} · ${p.nombre}`]);
const optsCiclo = () => ["I","II","III","IV","V","VI"].map(c => [c,c]);
function fieldHtml(f, val){
  const id = "f_" + f.k, rq = f.req ? ' <span class="req">*</span>' : "";
  const v = val === undefined || val === null ? (f.def !== undefined ? (typeof f.def === "function" ? f.def() : f.def) : "") : val;
  let inp = "";
  if(f.t === "select"){ const o = f.opts(); inp = `<select id="${id}" name="${f.k}">${f.req ? "" : `<option value="">— ${f.none || "Ninguno"} —</option>`}${o.map(([a,b]) => `<option value="${esc(a)}" ${String(a) === String(v) ? "selected" : ""}>${esc(b)}</option>`).join("")}</select>` }
  else if(f.t === "multi"){ const o = f.opts(); const arr = Array.isArray(v) ? v.map(String) : []; inp = `<div class="checks" id="${id}">${o.map(([a,b]) => `<label class="ck"><input type="checkbox" name="${f.k}" value="${esc(a)}" ${arr.includes(String(a)) ? "checked" : ""}> ${esc(b)}</label>`).join("") || '<span class="note">No hay opciones registradas.</span>'}</div>` }
  else if(f.t === "bool") inp = `<label class="switch"><input type="checkbox" id="${id}" name="${f.k}" ${v ? "checked" : ""}> ${esc(f.yes || "Sí")}</label>`;
  else if(f.t === "textarea") inp = `<textarea id="${id}" name="${f.k}" rows="${f.rows||3}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ""}>${esc(Array.isArray(v) ? v.join("\n") : v)}</textarea>`;
  else if(f.t === "file") inp = `<input id="${id}" name="${f.k}" type="file" ${f.accept ? `accept="${f.accept}"` : ""} ${f.multiple ? "multiple" : ""}>`;
  else inp = `<input id="${id}" name="${f.k}" type="${f.t||"text"}" value="${esc(v)}" ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.max !== undefined ? `max="${f.max}"` : ""} ${f.step ? `step="${f.step}"` : ""} ${f.ph ? `placeholder="${esc(f.ph)}"` : ""} ${f.ro ? "readonly" : ""} autocomplete="off">`;
  return `<div class="fld ${f.w ? "wide" : ""}" data-fld="${f.k}"><label for="${id}">${esc(f.l)}${rq}</label>${inp}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ""}<span class="err"></span></div>`;
}
function readFields(fields, root, col, selfId){
  const vals = {}, errs = {};
  fields.forEach(f => {
    let v;
    if(f.t === "multi"){ v = [...root.querySelectorAll(`input[name="${f.k}"]:checked`)].map(x => f.num ? +x.value : x.value) }
    else if(f.t === "bool") v = root.querySelector(`[name="${f.k}"]`).checked;
    else if(f.t === "file"){ const inp = root.querySelector(`[name="${f.k}"]`); v = inp._portalFiles || []; if(inp.files.length && !inp._portalFiles) errs[f.k] = "Espera a que se cargue el archivo en el servidor." }
    else {
      v = root.querySelector(`[name="${f.k}"]`).value.trim();
      if(f.t === "textarea" && f.lines) v = v.split("\n").map(x => x.trim()).filter(Boolean);
      else if(f.t === "number") v = v === "" ? "" : +v;
      else if(f.num) v = v === "" ? 0 : +v;
      if(f.upper && typeof v === "string") v = v.toUpperCase();
    }
    vals[f.k] = v;
    const empty = v === "" || v === 0 && f.num && f.req || (Array.isArray(v) && !v.length);
    if(f.req && empty) errs[f.k] = "Campo obligatorio.";
    else if(f.pat && v && !f.pat[0].test(v)) errs[f.k] = f.pat[1];
    else if(f.t === "number" && v !== "" && ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max))) errs[f.k] = `Ingrese un valor entre ${f.min} y ${f.max}.`;
    else if(f.uniq && v && col && col.some(r => String(r[f.k]).toLowerCase() === String(v).toLowerCase() && r.id !== selfId)) errs[f.k] = "Ya existe un registro con este valor.";
    else if(f.t === "file" && f.maxMB && v.some(x => x.s > f.maxMB*1048576)) errs[f.k] = `Cada archivo debe pesar como máximo ${f.maxMB} MB.`;
    else if(f.t === "file" && f.accept && v.some(x => !f.accept.split(",").some(e => x.n.toLowerCase().endsWith(e.trim())))) errs[f.k] = `Formato permitido: ${f.accept}.`;
  });
  return {vals, errs};
}
function showErrs(root, errs){
  root.querySelectorAll(".fld").forEach(el => { el.classList.remove("bad"); const e = el.querySelector(".err"); if(e) e.textContent = "" });
  Object.entries(errs).forEach(([k,m]) => { const el = root.querySelector(`[data-fld="${k}"]`); if(el){ el.classList.add("bad"); el.querySelector(".err").textContent = m } });
  const first = root.querySelector(".fld.bad input,.fld.bad select,.fld.bad textarea"); if(first) first.focus();
  return !Object.keys(errs).length;
}

/* ---------- modal ---------- */
let MODAL = null;
function openModal({title, body, wide, submit, onSubmit, foot, danger, onOpen}){
  MODAL = {onSubmit};
  $("#ixmodal").innerHTML = `<div class="mback" data-mclose="1"><form class="modal ${wide ? "wide" : ""}" id="mform" role="dialog" aria-modal="true" aria-labelledby="mtitle" novalidate>
    <header><h2 id="mtitle">${title}</h2><button type="button" class="x" data-mclose="1" aria-label="Cerrar">×</button></header>
    <div class="mb">${body}</div>
    <footer>${foot || ""}<button type="button" class="btn sec" data-mclose="1">${onSubmit ? "Cancelar" : "Cerrar"}</button>${onSubmit ? `<button type="submit" class="btn ${danger ? "danger" : ""}">${submit || "Guardar"}</button>` : ""}</footer></form></div>`;
  const f = $("#mform .mb input:not([readonly]):not([type=checkbox]):not([type=file]), #mform .mb select, #mform .mb textarea");
  const modal = $("#mform");
  setTimeout(() => { if(!modal || !modal.isConnected || modal !== $("#mform") || modal.contains(document.activeElement)) return; const el = f && f.isConnected ? f : modal.querySelector(".x"); if(el) el.focus() }, 30);
  if(onOpen) onOpen($("#mform"));
}
function closeModal(){ const m = $("#ixmodal"); if(m) m.innerHTML = ""; MODAL = null }
function confirmBox(title, msg, label, fn){ openModal({title, body:`<p>${msg}</p>`, submit:label || "Confirmar", danger:true, onSubmit:() => fn() !== false}) }

/* ---------- CRUD genérico ---------- */
const ENT = {};
function crudForm(ek, row, defaults){
  if(lvl(ENT[ek].permMod)<2){toast("No tiene permiso de gestión.");return;}
  const E = ENT[ek], fields = E.fields(row);if(ek==='programas'&&row?.pid)for(const f of fields)if(['cod','nombre'].includes(f.k)){f.ro=true;f.hint='Se administra desde el catálogo único de Programas de estudios.';}
  if(!row && !defaults && E.defaults) defaults = E.defaults();
  const base = row || defaults || {};
  openModal({ title:(row ? "Editar " : "Nuevo ") + E.one, wide:E.wide, body:`<div class="f">${fields.map(f => fieldHtml(f, base[f.k])).join("")}</div>${E.formNote ? `<p class="note">${E.formNote}</p>` : ""}${ek==="modulos"&&row?`<h3>Unidades didácticas asociadas</h3><p class="note">${DB.uds.filter(u=>u.mod===row.id).map(u=>esc(u.cod+" · "+u.nombre+" · Ciclo "+u.ciclo)).join("<br>")||"Sin unidades asociadas. Se vinculan desde Unidades didácticas."}</p>`:""}`,
    submit: row ? "Guardar cambios" : "Registrar",
    onSubmit: form => {
      const {vals, errs} = readFields(fields, form, DB[E.col], row && row.id);
      if(E.check){ const extra = E.check(vals, row); Object.assign(errs, extra || {}) }
      if(!showErrs(form, errs)) return false;
      if(row){ Object.assign(row, vals); E.after && E.after(row, false); log("Editar", E.mod, E.label(row)); }
      else { const r = Object.assign({id:nextId(DB[E.col])}, defaults || {}, vals); DB[E.col].push(r); E.after && E.after(r, true); log("Registrar", E.mod, E.label(r)); }
      if(!save())return false; toast("Cambios guardados en el servidor.");return true;
    }});
  if(row&&["certs","titulos"].includes(ek)){
    const form=document.querySelector('#mform');
    for(const input of form.querySelectorAll('.mb input,.mb select,.mb textarea'))if(input.name!=='estadoDoc'){if(input.tagName==='SELECT')input.disabled=true;else input.readOnly=true;}
    form.querySelector('.mb').insertAdjacentHTML('beforeend','<p class="note">Los datos de emisión son históricos. Puede anular este documento y registrar uno nuevo con otro código.</p>');
  }
  if(["uds","certs"].includes(ek)){
    const form=document.querySelector('.ix [name="mod"]')?.closest('form') || document.querySelector('[name="mod"]')?.closest('form');
    if(form){const source=form.querySelector(ek==='uds'?'[name="prog"]':'[name="est"]'),target=form.querySelector('[name="mod"]');
      const fill=()=>{const selected=+target.value,programId=ek==='uds'?+source.value:est(+source.value).prog;
        target.innerHTML=`<option value="">${ek==='uds'?'Pendiente de asociación':'Seleccione un módulo'}</option>`+DB.modulos.filter(m=>m.prog===programId).map(m=>`<option value="${m.id}" ${m.id===selected?'selected':''}>${esc(m.cod+' · '+m.nombre)}</option>`).join('');};
      if(source&&target){source.addEventListener('change',fill);fill();}}
  }
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function crud(ek, o = {}){
  const E = ENT[ek]; let rows = o.rows || DB[E.col];
  const q = (S.q[ek] || "").toLowerCase();
  const cols = E.cols.filter(c => !c.hide || !c.hide());
  if(q) rows = rows.filter(r => cols.some(c => strip(c.v(r)).toLowerCase().includes(q)));
  if(E.sort) rows = [...rows].sort(E.sort);
  S.last[ek] = rows;
  const can = o.edit !== undefined ? o.edit : lvl(E.mod2 || E.permMod) >= 2;
  const canAdd = o.add !== undefined ? o.add : can;
  return `<section class="panel"><div class="panel-h"><div><h2>${o.title || E.title}</h2>${o.sub ? `<span class="note">${o.sub}</span>` : ""}</div>
    <div class="tools"><input class="search" type="search" id="q_${ek}" data-q="${ek}" placeholder="Buscar…" value="${esc(S.q[ek]||"")}" aria-label="Buscar en ${esc(o.title || E.title)}">
    <button class="btn sec sm" data-xls="${ek}">Excel</button><button class="btn sec sm" data-pdf="${ek}">PDF</button>
    ${canAdd ? `<button class="btn sm" data-new="${ek}">+ ${o.addLabel || "Nuevo"}</button>` : ""}</div></div>
    <div class="tw"><table><thead><tr>${cols.map(c => `<th>${c.h}</th>`).join("")}${can || o.extra ? "<th></th>" : ""}</tr></thead><tbody>
    ${rows.length ? rows.map(r => `<tr>${cols.map(c => `<td>${c.v(r)}</td>`).join("")}${can || o.extra ? `<td class="act"><div class="btnrow" style="justify-content:flex-end">${o.extra ? o.extra(r) : ""}${can ? `<button class="btn sec sm" data-edit="${ek}:${r.id}">Editar</button><button class="btn ghost sm" data-del="${ek}:${r.id}" aria-label="Eliminar">Eliminar</button>` : ""}</div></td>` : ""}</tr>`).join("")
      : `<tr><td colspan="${cols.length + 1}"><div class="empty">${q ? `Ningún registro coincide con “${esc(S.q[ek])}”.` : (o.empty || "Aún no hay registros.")}</div></td></tr>`}
    </tbody></table></div><span class="count">${rows.length} registro(s)</span>${o.note ? `<p class="note">${o.note}</p>` : ""}</section>`;
}
function crudDelete(ek, id){
  if(lvl(ENT[ek].permMod)<2)return;
  const E = ENT[ek], row = byId(DB[E.col], id);
  const block = E.refs && E.refs(row);
  if(block){ openModal({title:"No se puede eliminar", body:`<div class="alert warn">${block}</div><p class="note">Para mantener la integridad de la información, primero reasigne o elimine los registros relacionados.</p>`}); return }
  confirmBox(`Eliminar ${E.one}`, `Se eliminará <b>${esc(E.label(row))}</b>. Esta acción no se puede deshacer.`, "Eliminar", () => {
    DB[E.col] = DB[E.col].filter(r => r.id !== row.id); E.afterDel && E.afterDel(row); log("Eliminar", E.mod, E.label(row)); if(!save())return false; toast(`Registro eliminado: ${E.label(row)}.`); render();
  });
}

/* ---------- descargas (capacidad del visor) ---------- */
let _dl;
function dlCap(){ if(_dl === undefined || _dl === null) _dl = (window.claude && window.claude.use) ? Promise.resolve(window.claude.use("downloads")).catch(() => null).then(d => { if(!d) _dl = null; return d }) : Promise.resolve(null); return _dl || Promise.resolve(null) }
function dlHelp(name, data){ const prev = "";
  openModal({title:"No se pudo descargar en esta vista", wide:!!prev, body:`<p>El archivo <b class="mono">${esc(name)}</b> se generó correctamente, pero esta ventana no permite descargas.</p>${prev}
  <div class="alert info"><div><b>Cómo descargar:</b><ol style="margin:6px 0 0;padding-left:18px"><li>Abra la intranet del instituto en su navegador e inicie sesión.</li><li>Vuelva a pulsar el botón PDF o Excel.</li><li>Acepte el aviso de descarga que aparece. Si lo rechazó antes, recargue la página.</li></ol></div></div>`}) }
function browserSave(name, data){
  try{ const blob = data instanceof Blob ? data : new Blob([data], {type: /\.json$/.test(name) ? "application/json" : "application/octet-stream"});
    const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; a.style.display = "none";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 1500); toast("Archivo listo: " + name) }
  catch(e){ dlHelp(name, data) } }
async function saveFile(name, data){
  const dl = await dlCap();
  if(!dl){ browserSave(name, data); return }
  try{ await dl.save({filename:name, data}); toast("Archivo listo: " + name) }
  catch(e){ const c = e && e.code; if(c === "declined") toast("Descarga cancelada. Pulse el botón otra vez si desea el archivo."); else if(c === "rate_limited") toast("Ya hay una descarga esperando su confirmación. Acéptela o cancélela primero."); else if(c === "too_large") toast("El archivo es demasiado grande para esta vista."); else dlHelp(name, data) }
}
function libsOk(kind){ const ok = kind === "xlsx" ? !!window.XLSX : !!(window.jspdf && window.jspdf.jsPDF); if(!ok) toast("El generador de archivos aún no cargó. Revisa tu conexión e inténtalo de nuevo."); return ok }
const fileStamp = () => today().replace(/-/g,"");
const slug = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"").toLowerCase();
function exportXLSX(name, head, rows, sheet){
  if(!libsOk("xlsx")) return;
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
  ws["!cols"] = head.map((h,i) => ({wch: Math.min(60, Math.max(h.length, ...rows.map(r => String(r[i] ?? "").length)) + 2)}));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, (sheet || "Datos").slice(0,31));
  const buf = XLSX.write(wb, {bookType:"xlsx", type:"array"});
  log("Exportar", "Reportes", name); if(!save())return false;
  saveFile(name, new Blob([buf]));
}
/* ---------- personalización de documentos y reportes (DB.cfg.docs) ---------- */
const DOCS_DEF = {estilo:"banda", color:"#0b1d3f", sub:"", lema:"", logoIzq:null, logoDer:null, firma:true, firmaNom:"", firmaCargo:"Director(a) General", firmaImg:null, pie:""};
const docCfg = () => { let c = null; try{ c = DB && DB.cfg && DB.cfg.docs }catch(e){} return Object.assign({}, DOCS_DEF, c || {}) };
const hexRgb = h => { const n = parseInt(String(h).slice(1),16); return [n>>16&255, n>>8&255, n&255] };
const docColor = () => { const c = ((DB && DB.cfg && DB.cfg.docs) || {}).color; return HEX.test(c || "") ? c : (typeof TC !== "undefined" && HEX.test(TC.navy || "") ? TC.navy : DOCS_DEF.color); };
const docSub = () => docCfg().sub || `${DB.cfg.direccion} · ${DB.cfg.web}`;
const docFirmaNom = () => docCfg().firmaNom || DB.cfg.director;
/* convierte cualquier imagen subida a PNG (jsPDF no acepta SVG) y guarda su proporción */
function imgToPng(file, maxW){ return new Promise((ok, bad) => { const rd = new FileReader(); rd.onerror = () => bad(); rd.onload = () => { const im = new Image(); im.onerror = () => bad(); im.onload = () => { const w0 = im.naturalWidth || 300, h0 = im.naturalHeight || 300, k = Math.min(1, (maxW || 500) / Math.max(w0, h0)), cv = document.createElement("canvas"); cv.width = Math.round(w0*k); cv.height = Math.round(h0*k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); ok({src:cv.toDataURL("image/png"), w:cv.width, h:cv.height}) }; im.src = rd.result }; rd.readAsDataURL(file) }) }
const BRAND = [15,94,87];
function pdfNew(orient){ const {jsPDF} = window.jspdf; return new jsPDF({unit:"mm", format:"a4", orientation:orient || "portrait"}) }
function pdfLogo(doc, img, x, y, box, align){
  if(!img || !img.src) return 0; const r = img.w / img.h, w = r >= 1 ? box : box * r, h = r >= 1 ? box / r : box;
  try{ doc.addImage(img.src, "PNG", align === "right" ? x - w : x, y + (box - h)/2, w, h) }catch(e){ return 0 } return w;
}
function pdfSeal(doc, x, y, d, col){ doc.setDrawColor(...col); doc.setLineWidth(.6); doc.circle(x + d/2, y + d/2, d/2); doc.setFont("helvetica","bold"); doc.setFontSize(5.5); doc.setTextColor(...col); doc.text(doc.splitTextToSize(DB.cfg.siglas, d - 2).slice(0, 2), x + d/2, y + d/2 - .6, {align:"center"}); doc.setLineWidth(.2) }
function pdfHeader(doc, title, sub){
  const W = doc.internal.pageSize.getWidth(), C = docCfg(), col = hexRgb(docColor()), band = C.estilo !== "blanco";
  if(band){ doc.setFillColor(...col); doc.rect(0,0,W,24,"F") }
  let xl = 14;
  if(C.logoIzq){ if(band){ doc.setFillColor(255,255,255); doc.roundedRect(12,3,18,18,2,2,"F") } const w = pdfLogo(doc, C.logoIzq, band ? 13 : 14, band ? 4 : 3, band ? 16 : 18); xl = (band ? 13 : 14) + w + 4 }
  let xr = W - 14;
  if(C.logoDer){ if(band){ doc.setFillColor(255,255,255); doc.roundedRect(W-30,3,18,18,2,2,"F") } const w = pdfLogo(doc, C.logoDer, band ? W-13 : W-14, band ? 4 : 3, band ? 16 : 18, "right"); xr = (band ? W-13 : W-14) - w - 4 }
  else if(!band){ pdfSeal(doc, W-14-16, 4, 16, col); xr = W - 14 - 20 }
  doc.setTextColor(...(band ? [255,255,255] : col)); doc.setFont("helvetica","bold"); doc.setFontSize(10.5);
  doc.text(doc.splitTextToSize(DB.cfg.nombre, xr - xl)[0], xl, 10.5);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...(band ? [235,240,240] : [95,107,104])); doc.text(doc.splitTextToSize(docSub(), xr - xl)[0], xl, 16.5);
  if(!band){ doc.setDrawColor(...col); doc.setLineWidth(.8); doc.line(14, 24, W-14, 24); doc.setLineWidth(.2) }
  let y = 34;
  if(C.lema){ doc.setFont("helvetica","italic"); doc.setFontSize(8.5); doc.setTextColor(95); doc.text(`“${C.lema}”`, W/2, 30, {align:"center"}); y = 38 }
  doc.setTextColor(25); doc.setFont("helvetica","bold"); doc.setFontSize(14); doc.text(title, 14, y);
  if(sub){ doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(95); doc.text(doc.splitTextToSize(sub, W-28), 14, y + 6) }
  return sub ? y + 13 : y + 7;
}
function pdfFooter(doc){
  const n = doc.internal.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), pie = docCfg().pie;
  for(let i=1;i<=n;i++){ doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(120); doc.setFont("helvetica","normal");
    if(pie){ doc.setDrawColor(220); doc.line(14, H-15, W-14, H-15); doc.text(doc.splitTextToSize(pie, W-28)[0], W/2, H-12, {align:"center"}) }
    doc.text(`Generado el ${fd(nowStamp())} por ${S.user ? S.user.nom : "Portal público"}`, 14, H-6.5); doc.text(`Página ${i} de ${n}`, W-14, H-6.5, {align:"right"}) }
}
function pdfTable(doc, y, head, rows, opts){
  doc.autoTable(Object.assign({ startY:y, head:[head], body:rows, theme:"grid", styles:{fontSize:8, cellPadding:1.8, textColor:30, lineColor:[210,218,215]}, headStyles:{fillColor:hexRgb(docColor()), textColor:255, fontStyle:"bold"}, alternateRowStyles:{fillColor:[244,247,246]}, margin:{left:14,right:14} }, opts||{}));
  return doc.lastAutoTable.finalY;
}
function pdfQR(doc, text, x, y, size){
  if(!window.qrcode) return;
  const q = qrcode(0,"M"); q.addData(text); q.make(); const n = q.getModuleCount(), c = size/n;
  doc.setFillColor(255,255,255); doc.rect(x-1,y-1,size+2,size+2,"F"); doc.setFillColor(0,0,0);
  for(let r=0;r<n;r++) for(let k=0;k<n;k++) if(q.isDark(r,k)) doc.rect(x+k*c, y+r*c, c+0.02, c+0.02, "F");
}
function qrSvg(text){ if(!window.qrcode) return `<div style="width:92px;height:92px;border:1px dashed #999;display:grid;place-items:center;font-size:.7rem">QR</div>`; const q = qrcode(0,"M"); q.addData(text); q.make(); return q.createSvgTag({cellSize:3, margin:0, scalable:true}) }
function exportTablePDF(ek){
  if(!libsOk("pdf")) return;
  const E = ENT[ek], cols = E.cols.filter(c => !c.hide || !c.hide()), rows = S.last[ek] || DB[E.col];
  const doc = pdfNew(cols.length > 6 ? "landscape" : "portrait");
  const y = pdfHeader(doc, E.title, `${rows.length} registro(s)${S.q[ek] ? ` · filtro: "${S.q[ek]}"` : ""}`);
  pdfTable(doc, y, cols.map(c => strip(c.h)), rows.map(r => cols.map(c => strip(c.x ? c.x(r) : c.v(r)))));
  pdfFooter(doc); log("Exportar", E.mod, `${E.title} (PDF)`); if(!save())return false;
  saveFile(`${ek}_${fileStamp()}.pdf`, doc.output("blob"));
}
function exportTableXLS(ek){
  const E = ENT[ek], cols = E.cols.filter(c => !c.hide || !c.hide()), rows = S.last[ek] || DB[E.col];
  exportXLSX(`${ek}_${fileStamp()}.xlsx`, cols.map(c => strip(c.h)), rows.map(r => cols.map(c => strip(c.x ? c.x(r) : c.v(r)))), E.title);
}

/* ---------- documentos con código de verificación ---------- */
const DOC_T = { cert:"Constancia de certificación modular", titulo:"Reporte de validación de título", cargo:"Cargo de recepción de documento", reclamo:"Hoja de reclamación", horario:"Horario académico" };
function emitDoc(tipo, ref, persona){
  const ex = DB.docs.find(d => d.tipo === tipo && d.ref === ref && d.fecha.slice(0,10) === today());
  if(ex){ if(ex.valido===false){toast("El documento fue anulado. Consulta con Secretaría Académica.");return false;}return ex; }
  const d = {cod:genCode(), tipo, ref, persona, fecha:nowStamp(), por:S.user ? S.user.nom : "Portal público", valido:true};
  DB.docs.unshift(d); log("Emitir documento", "Documentos", `${DOC_T[tipo]} ${d.cod}`);
  try{ if(tipo === "cert" || tipo === "titulo"){ const e = tipo === "cert" ? est(ref) : est((byId(DB.titulos, ref) || {}).est); HOST.registerDoc({cod:d.cod, tipo:DOC_T[tipo], dni:e.dni, nombres:e.nom, prog:prog(e.prog).pid || "", fecha:d.fecha}) } }catch(err){}
  if(!save())return false; return d;
}
const b64u = o => { const b = new TextEncoder().encode(JSON.stringify(o)); let bin = ""; b.forEach(x => bin += String.fromCharCode(x)); return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"") };
const unb64u = t => { const bin = atob(t.replace(/-/g,"+").replace(/_/g,"/")); return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))) };
/* el QR abre la verificación pública con el código y los datos del documento */
const verifyText = d => HOST.verifyUrl(d.cod);
function paperHead(){ const C = docCfg(), col = docColor(), band = C.estilo !== "blanco", im = (x, cls) => `<img class="plogo ${cls}" src="${esc(x.src)}" alt="">`;
  return `<div class="ph ${band ? "band" : ""}" style="--doc:${col}">${C.logoIzq ? im(C.logoIzq,"l") : ""}<div class="pht"><b>${esc(DB.cfg.nombre)}</b><small>${esc(docSub())}</small></div>${C.logoDer ? im(C.logoDer,"r") : band ? "" : `<div class="seal" style="box-shadow:inset 0 0 0 2px ${col};color:${col};background:none">IESTP<br>${esc((HOST.inst && HOST.inst().logoSigla) || DB.cfg.siglas || "")}</div>`}</div>${C.lema ? `<p class="lema">“${esc(C.lema)}”</p>` : ""}` }
function paperSign(){ const C = docCfg(); return C.firma ? `<div class="pfirma">${C.firmaImg ? `<img src="${esc(C.firmaImg.src)}" alt="Firma">` : ""}<span></span><b>${esc(docFirmaNom())}</b><small>${esc(C.firmaCargo || "")}</small></div>` : "" }
function paperFoot(d){ const pie = docCfg().pie; return paperSign() + `<div class="pf"><div><b style="color:var(--paper-ink)">Código de verificación: <span class="mono">${d.cod}</span></b><br>Emitido el ${fd(d.fecha)} · Verifique su autenticidad en el portal institucional, opción “Verificar documento”.</div><div class="qr" aria-label="Código QR de verificación">${qrSvg(verifyText(d))}</div></div>${pie ? `<p class="ppie">${esc(pie)}</p>` : ""}` }
function pdfVerify(doc, d, y){
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), C = docCfg();
  const need = (C.firma ? 34 : 0) + 34;
  if(y + need > H - 18){ doc.addPage(); y = 20 }
  if(C.firma){ const cx = W/2; if(C.firmaImg) pdfLogo(doc, C.firmaImg, cx - 20, y, 40); doc.setDrawColor(60); doc.line(cx - 32, y + 22, cx + 32, y + 22);
    doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(25); doc.text(docFirmaNom(), cx, y + 27, {align:"center"});
    doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(95); doc.text(C.firmaCargo || "", cx, y + 31.5, {align:"center"}); y += 36 }
  doc.setDrawColor(207,216,213); doc.line(14, y, W-14, y);
  pdfQR(doc, verifyText(d), W-14-30, y+5, 30);
  doc.setFontSize(9); doc.setTextColor(25); doc.setFont("helvetica","bold"); doc.text(`Código de verificación: ${d.cod}`, 14, y+10);
  doc.setFont("helvetica","normal"); doc.setTextColor(95); doc.setFontSize(8);
  doc.text(doc.splitTextToSize(`Emitido el ${fd(d.fecha)} por ${d.por}. Verifique la autenticidad de este documento en ${DB.cfg.web}, opción "Verificar documento", o escaneando el código QR.`, W-28-40), 14, y+16);
}
function pdfKV(doc, y, pairs){
  doc.setFontSize(10);
  pairs.forEach(([k,v]) => { doc.setFont("helvetica","normal"); doc.setTextColor(95); doc.text(k, 14, y); doc.setFont("helvetica","bold"); doc.setTextColor(25); const t = doc.splitTextToSize(String(v), 120); doc.text(t, 70, y); y += 6.5 * t.length });
  return y;
}
/* =====================================================================
   ENTIDADES (definición de formularios, columnas e integridad)
   ===================================================================== */
const mono = v => `<span class="mono">${esc(v)}</span>`;
const PAT_DNI = [/^\d{8}$/, "El DNI debe tener 8 dígitos."];
const PAT_RUC = [/^(10|20)\d{9}$/, "El RUC debe tener 11 dígitos y empezar en 10 o 20."];
const PAT_TEL = [/^\d{9}$/, "Ingrese un celular de 9 dígitos."];
const PAT_MAIL = [/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, "Ingrese un correo válido."];
const PAT_PER = [/^\d{4}-(I|II)$/, "Use el formato 2026-I o 2026-II."];
const cnt = (arr, fn) => arr.filter(fn).length;

ENT.programas = { col:"programas", one:"programa de estudios", title:"Programas de estudios", mod:"Horarios", permMod:"config",
  fields:() => [
    {k:"cod",l:"Código",req:true,uniq:true,upper:true,pat:[/^[A-Z0-9-]{2,10}$/,"De 2 a 10 caracteres, sin espacios."]},
    {k:"nombre",l:"Nombre del programa",req:true,w:1},
    {k:"dur",l:"Duración",t:"select",req:true,opts:() => [["2 años","2 años"],["3 años","3 años"]],def:"3 años"},
    {k:"sem",l:"Semestres académicos",t:"number",req:true,min:1,max:10,def:6},
    {k:"activo",l:"Estado",t:"bool",yes:"Programa activo",def:true}],
  cols:[{h:"Código",v:r => mono(r.cod)},{h:"Programa",v:r => esc(r.nombre)},{h:"Duración",v:r => r.dur},{h:"Semestres",v:r => r.sem},
    {h:"UD",v:r => cnt(DB.uds, u => u.prog === r.id)},{h:"Estudiantes",v:r => cnt(DB.estudiantes, e => e.prog === r.id)},{h:"Estado",v:r => r.activo ? estPill("Activo") : estPill("Inactivo")}],
  label:r => r.cod,
  refs:r => { const n = cnt(DB.uds,u => u.prog === r.id) + cnt(DB.estudiantes,e => e.prog === r.id) + cnt(DB.modulos,m => m.prog === r.id); return n ? `El programa ${r.cod} tiene ${n} registro(s) asociados (unidades didácticas, módulos o estudiantes). Puede desactivarlo en lugar de eliminarlo.` : "" } };

ENT.uds = { col:"uds", one:"unidad didáctica", title:"Unidades didácticas", mod:"Horarios", permMod:"config",
  fields:() => [
    {k:"cod",l:"Código",req:true,uniq:true,upper:true},
    {k:"nombre",l:"Nombre de la unidad didáctica",req:true,w:1},
    {k:"prog",l:"Programa de estudios",t:"select",req:true,num:true,opts:optsProg(true)},
    {k:"mod",l:"Módulo formativo",t:"select",num:true,none:"Pendiente de asociación",opts:() => DB.modulos.map(m=>[m.id,`${prog(m.prog).cod} · ${m.cod} · ${m.nombre}`]),hint:"Seleccione un módulo del mismo programa; los registros existentes pueden quedar pendientes."},
    {k:"ciclo",l:"Ciclo académico",t:"select",req:true,opts:optsCiclo},
    {k:"horas",l:"Horas semanales",t:"number",req:true,min:1,max:12,def:3},
    {k:"cred",l:"Créditos",t:"number",req:true,min:1,max:8,def:2}],
  cols:[{h:"Código",v:r => mono(r.cod)},{h:"Unidad didáctica",v:r => esc(r.nombre)},{h:"Programa",v:r => prog(r.prog).cod},{h:"Módulo",v:r => {const m=byId(DB.modulos,r.mod);return m?esc(m.cod):pill("Pendiente","p-warn")}},{h:"Ciclo",v:r => r.ciclo},{h:"Horas/sem",v:r => r.horas},{h:"Créditos",v:r => r.cred},{h:"Periodo",v:() => DB.cfg.periodo}],
  check:v => v.mod && byId(DB.modulos,v.mod)?.prog!==v.prog ? {mod:"El módulo debe pertenecer al programa seleccionado."}:null,
  sort:(a,b) => a.prog - b.prog || a.ciclo.localeCompare(b.ciclo) || a.cod.localeCompare(b.cod),
  label:r => `${r.cod} ${r.nombre}`,
  refs:r => { const n = cnt(DB.sesiones,s => s.ud === r.id); return n ? `La unidad ${r.nombre} está programada en ${n} sesión(es) de horario.` : "" },
  afterDel:r => DB.docentes.forEach(d => d.uds = d.uds.filter(x => x !== r.id)) };

ENT.docentes = { col:"docentes", one:"docente", title:"Carga docente", mod:"Horarios", permMod:"config", wide:true,
  fields:() => [
    {k:"per",l:"Docente (de la Plana docente)",t:"select",req:true,w:1,opts:() => HOST.docentes().map(p => [p.id, `${p.nom} · ${p.esp}`]),hint:"Los datos personales y la hoja de vida se mantienen en Plana docente."},
    {k:"uds",l:"Unidades didácticas que puede asumir",t:"multi",num:true,w:1,opts:() => DB.uds.map(u => [u.id, `${prog(u.prog).cod} · ${u.nombre}`])},
    {k:"dias",l:"Días disponibles",t:"multi",req:true,w:1,opts:() => DIAS.map(d => [d,DIAS_L[d]])},
    {k:"desde",l:"Disponible desde",t:"time",req:true,def:"08:00"},
    {k:"hasta",l:"Disponible hasta",t:"time",req:true,def:"14:15"}],
  check:(v,row) => { const er = {}; if(v.desde && v.hasta && mins(v.hasta) <= mins(v.desde)) er.hasta = "Debe ser posterior a la hora de inicio."; if(DB.docentes.some(d => d.per === v.per && (!row || d.id !== row.id))) er.per = "Ese docente ya tiene su carga registrada."; return er },
  cols:[{h:"Docente",v:r => esc(r.nom)},{h:"Especialidad",v:r => esc(r.esp || "—")},{h:"Condición",v:r => estPill(r.cond || "—")},
    {h:"UD que puede asumir",v:r => r.uds.map(u => esc(ud(u).nombre)).join(", ") || "—"},{h:"Disponibilidad",v:r => `${r.dias.join(" · ")}<br><span class="note mono">${r.desde}–${r.hasta}</span>`,x:r => `${r.dias.join(", ")} ${r.desde}-${r.hasta}`}],
  label:r => r.nom,
  after:r => { syncDocentes() },
  refs:r => { const n = cnt(DB.sesiones,s => s.doc === r.id); return n ? `${r.nom} tiene ${n} sesión(es) asignadas en el horario. Reasígnelas antes de eliminar.` : "" } };

ENT.ambientes = { col:"ambientes", one:"ambiente", title:"Ambientes académicos", mod:"Horarios", permMod:"config",
  fields:() => [
    {k:"cod",l:"Código",req:true,uniq:true,upper:true},
    {k:"tipo",l:"Tipo",t:"select",req:true,opts:() => [["Aula","Aula"],["Laboratorio","Laboratorio"],["Taller","Taller"]]},
    {k:"cap",l:"Capacidad (personas)",t:"number",req:true,min:1,max:200,def:30},
    {k:"ubic",l:"Ubicación",req:true},
    {k:"caract",l:"Características",w:1},
    {k:"prog",l:"Restricción de uso",t:"select",num:true,none:"Uso libre para todos los programas",opts:optsProg(true),hint:"Si elige un programa, el ambiente solo podrá asignarse a ese programa."}],
  cols:[{h:"Código",v:r => mono(r.cod)},{h:"Tipo",v:r => r.tipo},{h:"Capacidad",v:r => r.cap},{h:"Ubicación",v:r => esc(r.ubic)},{h:"Características",v:r => esc(r.caract||"—")},{h:"Restricción",v:r => r.prog ? pill("Solo " + prog(r.prog).cod,"p-warn") : pill("Uso libre","p-mut")},
    {h:"Ocupación semanal",v:r => { const h = DB.sesiones.filter(s => s.amb === r.id && s.per === DB.cfg.periodo).reduce((a,s) => a + (mins(s.fin)-mins(s.ini))/60,0); return `${Math.round(h*10)/10} h` }}],
  label:r => r.cod,
  refs:r => { const n = cnt(DB.sesiones,s => s.amb === r.id); return n ? `El ambiente ${r.cod} está asignado en ${n} sesión(es).` : "" } };

ENT.modulos = { col:"modulos", one:"módulo formativo", title:"Módulos formativos", mod:"Certificados", permMod:"config",
  fields:() => [
    {k:"prog",l:"Programa de estudios",t:"select",req:true,num:true,opts:optsProg(true)},
    {k:"cod",l:"Código",req:true,upper:true,ph:"MF1"},
    {k:"nombre",l:"Nombre del módulo",req:true,w:1},
    {k:"ciclos",l:"Ciclos asociados",req:true,ph:"I – II"},
    {k:"horasTotal",l:"Horas totales de formación",t:"number",min:1,max:10000},
    {k:"tipoHoras",l:"Tipo de horas",t:"select",opts:()=>[["Académicas","Académicas"],["Lectivas","Lectivas"]],def:"Académicas"}],
  check:(v,row) => DB.modulos.some(m => m.prog === v.prog && m.cod === v.cod && (!row || m.id !== row.id)) ? {cod:"Ese código ya existe en el programa."} : null,
  cols:[{h:"Programa",v:r => prog(r.prog).cod},{h:"Código",v:r => mono(r.cod)},{h:"Módulo formativo",v:r => esc(r.nombre)},{h:"Ciclos",v:r => r.ciclos},{h:"Certificados emitidos",v:r => cnt(DB.certs,c => c.mod === r.id)}],
  sort:(a,b) => a.prog - b.prog || a.cod.localeCompare(b.cod),
  label:r => `${prog(r.prog).cod}-${r.cod}`,
  refs:r => { const n = cnt(DB.certs,c => c.mod === r.id)+cnt(DB.uds,u=>u.mod===r.id); return n ? `Hay ${n} certificación(es) registradas para este módulo.` : "" } };

const optsEst = (filter) => () => DB.estudiantes.filter(filter || (() => true)).sort((a,b) => a.nom.localeCompare(b.nom)).map(e => [e.id, `${e.dni} · ${e.nom} (${prog(e.prog).cod})`]);
ENT.estudiantes = { col:"estudiantes", one:"alumno", title:"Maestro de alumnos", mod:"Maestro de alumnos", permMod:"alumnos", wide:true,
  fields:row => [
    {k:"dni",l:"DNI",req:true,uniq:true,pat:PAT_DNI},
    {k:"nom",l:"Apellidos y nombres",req:true,w:1},
    {k:"prog",l:"Programa de estudios",t:"select",req:true,num:true,opts:() => DB.programas.filter(p=>p.activo || p.id===row?.prog).map(p=>[p.id,`${p.cod} · ${p.nombre}`])},
    {k:"periodo",l:"Periodo de ingreso",req:true,pat:PAT_PER,def:() => DB.cfg.periodo},
    {k:"ciclo",l:"Ciclo actual",t:"select",req:true,opts:optsCiclo,def:"I"},
    {k:"sec",l:"Sección",t:"select",req:true,opts:() => [["A","A"],["B","B"]]},
    {k:"turno",l:"Turno",t:"select",req:true,opts:() => [["Mañana","Mañana"],["Tarde","Tarde"]]},
    {k:"estado",l:"Estado académico",t:"select",req:true,opts:() => ["Regular","Retirado","Egresado","Titulado"].map(x => [x,x])},
    {k:"correo",l:"Correo electrónico",t:"email",pat:PAT_MAIL},
    {k:"tel",l:"Celular",pat:PAT_TEL}],
  cols:[{h:"DNI",v:r => mono(r.dni)},{h:"Apellidos y nombres",v:r => esc(r.nom)},{h:"Programa",v:r => prog(r.prog).cod},{h:"Ciclo-Secc.",v:r => `${r.ciclo}-${r.sec}`},{h:"Ingreso",v:r => r.periodo},{h:"Estado",v:r => estPill(r.estado)},{h:"Módulos cert.",v:r => cnt(DB.certs,c => c.est === r.id)},{h:"Acceso a la intranet",v:r => { const u = estUser(r); return u ? `${mono(u.u)}<br><span class="note">${ROLES[u.rol] || ""}</span>` : lvl("alumnos") >= 2 && r.estado !== "Retirado" ? `<button class="btn sm" data-act="mkAcc" data-id="${r.id}">Crear acceso</button>` : `<span class="note">Sin cuenta</span>` }}],
  sort:(a,b) => a.nom.localeCompare(b.nom),
  label:r => `${r.dni} ${r.nom}`,
  refs:r => { const n = cnt(DB.certs,c => c.est === r.id) + cnt(DB.titulos,t => t.est === r.id) + cnt(DB.postulaciones,p => p.est === r.id); return n ? `${r.nom} tiene ${n} registro(s) relacionados (certificaciones, títulos o postulaciones). Cambie su estado a “Retirado” en lugar de eliminarlo.` : "" } };

ENT.certs = { col:"certs", one:"certificación modular", title:"Certificaciones modulares", mod:"Certificados", permMod:"certificados",
  fields:() => [
    {k:"est",l:"Estudiante",t:"select",req:true,num:true,w:1,opts:optsEst()},
    {k:"mod",l:"Módulo certificado",t:"select",req:true,num:true,w:1,opts:() => DB.modulos.map(m => [m.id, `${prog(m.prog).cod}-${m.cod} · ${m.nombre}`])},
    {k:"fecha",l:"Fecha de certificación",t:"date",req:true,def:today},
    {k:"institucion",l:"Institución emisora",def:()=>DB.cfg.nombre,w:1},
    {k:"estadoDoc",l:"Estado del documento",t:"select",opts:()=>[["Válido","Válido"],["Anulado","Anulado"]],def:"Válido"},
    {k:"horasDoc",l:"Horas consignadas en el documento",t:"number",min:1,max:10000},
    {k:"tipoHoras",l:"Tipo de horas",t:"select",opts:()=>[["Académicas","Académicas"],["Lectivas","Lectivas"]],def:"Académicas"},
    {k:"num",l:"N.º de certificado",req:true,uniq:true,upper:true,def:() => `CM-${pad(DB.seq.cert+1).padStart(4,"0")}-${today().slice(0,4)}`}],
  check:(v,row) => { const e = est(v.est), m = byId(DB.modulos,v.mod); const er = {};
    if(m && e && m.prog !== e.prog) er.mod = `El módulo pertenece a ${prog(m.prog).cod} y el estudiante es de ${prog(e.prog).cod}.`;
    if(v.estadoDoc!=="Anulado"&&DB.certs.some(c => c.estadoDoc!=="Anulado"&&c.est === v.est && c.mod === v.mod && (!row || c.id !== row.id))) er.mod = "El estudiante ya tiene registrado este módulo.";
    if(v.fecha > today()) er.fecha = "La fecha no puede ser futura."; return er },
  after:(r,isNew) => { if(isNew){ DB.seq.cert++; const u = HOST.users().find(x => x.vin === "est:"+r.est); if(u) notify("u:"+u.id, `Se registró tu certificación del módulo ${byId(DB.modulos,r.mod).cod}`, "certificados") } },
  cols:[{h:"N.º certificado",v:r => mono(r.num)},{h:"Estudiante",v:r => esc(est(r.est).nom)},{h:"DNI",v:r => mono(est(r.est).dni)},{h:"Programa",v:r => prog(est(r.est).prog).cod},{h:"Módulo",v:r => { const m = byId(DB.modulos,r.mod) || {}; return `${esc(m.cod||"")} · ${esc(m.nombre||"")}` }},{h:"Fecha",v:r => fd(r.fecha)},{h:"Estado",v:r=>estPill(r.estadoDoc||"Válido")}],
  sort:(a,b) => b.fecha.localeCompare(a.fecha),
  label:r => r.num };

ENT.notas = { col:"notas", one:"registro de historial", title:"Historial académico (notas)", mod:"Certificados", permMod:"certificados",
  fields:() => [
    {k:"est",l:"Estudiante",t:"select",req:true,num:true,w:1,opts:optsEst()},
    {k:"ud",l:"Unidad didáctica o curso",req:true,w:1},
    {k:"periodo",l:"Periodo académico",req:true,pat:PAT_PER,def:() => DB.cfg.periodo},
    {k:"nota",l:"Nota final (0–20)",t:"number",req:true,min:0,max:20}],
  cols:[{h:"Estudiante",v:r => esc(est(r.est).nom)},{h:"Unidad didáctica",v:r => esc(r.ud)},{h:"Periodo",v:r => r.periodo},{h:"Nota",v:r => `<b style="color:${r.nota >= 13 ? "var(--ok)" : "var(--bad)"}">${r.nota}</b>`,x:r => r.nota}],
  sort:(a,b) => est(a.est).nom.localeCompare(est(b.est).nom) || a.periodo.localeCompare(b.periodo),
  label:r => `${est(r.est).dni} ${r.ud}` };

ENT.titulos = { col:"titulos", one:"título", title:"Registro institucional de titulados", mod:"Títulos", permMod:"titulos",
  fields:() => [
    {k:"est",l:"Egresado",t:"select",req:true,num:true,w:1,opts:optsEst(e => ["Egresado","Titulado"].includes(e.estado)),hint:"Solo aparecen estudiantes con estado Egresado o Titulado."},
    {k:"culm",l:"Fecha de culminación",t:"date",req:true},
    {k:"tit",l:"Fecha de titulación",t:"date",req:true,def:today},
    {k:"cod",l:"Código institucional del título",req:true,uniq:true,upper:true},
    {k:"institucion",l:"Institución emisora",def:()=>DB.cfg.nombre,w:1},
    {k:"estadoDoc",l:"Estado del documento",t:"select",opts:()=>[["Válido","Válido"],["Anulado","Anulado"]],def:"Válido"},
    {k:"denominacion",l:"Denominación del grado o título",w:1,hint:"Si se deja vacío se utiliza el título del programa."},
    {k:"nivel",l:"Nivel educativo",def:"Superior tecnológico"},
    {k:"pais",l:"País",def:"Perú"},
    {k:"region",l:"Región",def:()=>HOST.inst?(HOST.inst().region||""):""},
    {k:"resol",l:"Resolución directoral",req:true,w:1,ph:"R.D. N.º 000-2026-INSTITUTO"}],
  check:(v,row) => { const er = {}; if(v.culm && v.tit && v.tit < v.culm) er.tit = "Debe ser posterior a la fecha de culminación."; if(v.estadoDoc!=="Anulado"&&DB.titulos.some(t => t.estadoDoc!=="Anulado"&&t.est === v.est && (!row || t.id !== row.id))) er.est = "Este egresado ya tiene un título registrado."; return er },
  after:r => { const e = est(r.est); if(e.id) e.estado = "Titulado"; const u = HOST.users().find(x => x.vin === "est:"+r.est); if(u) notify("u:"+u.id,"Tu título fue registrado en la intranet institucional","titulos") },
  cols:[{h:"Estado",v:r=>estPill(r.estadoDoc||"Válido")},{h:"Código",v:r => mono(r.cod)},{h:"Titulado",v:r => esc(est(r.est).nom)},{h:"DNI",v:r => mono(est(r.est).dni)},{h:"Programa",v:r => prog(est(r.est).prog).cod},{h:"Culminación",v:r => fd(r.culm)},{h:"Titulación",v:r => fd(r.tit)},{h:"Resolución",v:r => esc(r.resol)}],
  sort:(a,b) => b.tit.localeCompare(a.tit),
  label:r => r.cod };

ENT.areas = { col:"areas", one:"área", title:"Áreas o unidades receptoras", mod:"Mesa de partes", permMod:"mesa",mod2:"config",
  fields:() => [
    {k:"cod",l:"Código",req:true,uniq:true,upper:true},
    {k:"nivel",l:"Nivel / clasificación",t:"select",req:true,opts:() => ["Mesa de Partes","Dirección","Órganos y comités","Áreas","Unidades","Coordinaciones de programas de estudio"].map(x => [x,x])},
    {k:"nombre",l:"Nombre del área",req:true,w:1},
    {k:"resp",l:"Responsable asignado (cargo y/o nombre)",req:true},
    {k:"correo",l:"Correo institucional",t:"email",req:true,pat:PAT_MAIL},
    {k:"activo",l:"Estado",t:"bool",yes:"Área activa",def:true}],
  cols:[{h:"Código",v:r => mono(r.cod)},{h:"Nivel",v:r => esc(r.nivel || "—")},{h:"Área",v:r => esc(r.nombre)},{h:"Responsable",v:r => esc(r.resp)},{h:"Correo",v:r => mono(r.correo)},{h:"Estado",v:r => r.activo ? estPill("Activo") : estPill("Inactivo")}],
  label:r => r.cod,
  refs:r => { const n = cnt(DB.tramites,t => t.area === r.cod) + cnt(HOST.exps(),e => e.area === r.cod); return n ? `El área ${r.nombre} tiene ${n} trámite(s) o expediente(s) asociados. Puede desactivarla.` : "" } };

ENT.tramites = { col:"tramites", one:"tipo de trámite", title:"Tipos de trámite", mod:"Mesa de partes", permMod:"mesa",mod2:"config",
  fields:() => [
    {k:"nombre",l:"Nombre del trámite",req:true,uniq:true,w:1},
    {k:"area",l:"Área responsable",t:"select",req:true,opts:() => DB.areas.filter(a => a.activo).map(a => [a.cod, a.nombre])},
    {k:"dias",l:"Plazo de atención (días hábiles)",t:"number",req:true,min:1,max:60,def:5},
    {k:"req",l:"Requisitos",t:"textarea",w:1}],
  cols:[{h:"Trámite",v:r => esc(r.nombre)},{h:"Área responsable",v:r => esc(areaN(r.area))},{h:"Plazo",v:r => `${r.dias} días hábiles`},{h:"Requisitos",v:r => esc(r.req||"—")},{h:"Flujo",v:r => `Mesa de partes → ${esc(areaN(r.area))} → Atención → Cierre`}],
  label:r => r.nombre,
  refs:r => { const n = cnt(HOST.exps(),e => e.tramite === r.id); return n ? `Hay ${n} expediente(s) de este tipo.` : "" } };

ENT.empresas = { col:"empresas", one:"empresa", title:"Empresas e instituciones", mod:"Bolsa laboral", permMod:"bolsa",
  fields:() => [
    {k:"ruc",l:"RUC",req:true,uniq:true,pat:PAT_RUC},
    {k:"nom",l:"Razón social",req:true,w:1},
    {k:"sector",l:"Sector económico",req:true},
    {k:"ubic",l:"Ubicación",req:true},
    {k:"contacto",l:"Persona de contacto",req:true},
    {k:"correo",l:"Correo de contacto",t:"email",req:true,pat:PAT_MAIL},
    {k:"validada",l:"Validación institucional",t:"bool",yes:"Empresa validada"}],
  cols:[{h:"RUC",v:r => mono(r.ruc)},{h:"Razón social",v:r => esc(r.nom)},{h:"Sector",v:r => esc(r.sector)},{h:"Ubicación",v:r => esc(r.ubic)},{h:"Contacto",v:r => `${esc(r.contacto)}<br><span class="note">${esc(r.correo)}</span>`,x:r => `${r.contacto} ${r.correo}`},{h:"Ofertas",v:r => cnt(DB.ofertas,o => o.emp === r.id)},{h:"Estado",v:r => r.validada ? pill("Validada","p-ok") : pill("Por validar","p-warn")}],
  label:r => r.nom,
  // El estado de validación acompaña a la casilla "Empresa validada" (lo usan las notificaciones del servidor).
  after:r => { if(r.validada) r.estadoVal = "Aprobada"; else if(r.estadoVal === "Aprobada") r.estadoVal = "Pendiente"; },
  refs:r => { const n = cnt(DB.ofertas,o => o.emp === r.id); return n ? `${r.nom} tiene ${n} oferta(s) publicadas.` : "" } };

ENT.ofertas = { col:"ofertas", one:"oferta laboral", title:"Ofertas laborales", mod:"Bolsa laboral", permMod:"bolsa", wide:true,
  fields:() => { const isEmp = R() === "emp"; return [
    ...(isEmp ? [] : [{k:"emp",l:"Empresa",t:"select",req:true,num:true,opts:() => DB.empresas.map(e => [e.id,e.nom])}]),
    {k:"puesto",l:"Nombre del puesto",req:true,w:1},
    {k:"desc",l:"Descripción del puesto",t:"textarea",req:true,w:1},
    {k:"req",l:"Requisitos",t:"textarea",req:true,w:1},
    {k:"modal",l:"Modalidad",t:"select",req:true,opts:() => ["Presencial","Híbrido","Remoto"].map(x => [x,x])},
    {k:"prog",l:"Programa afín",t:"select",num:true,none:"Cualquier programa",opts:optsProg(false)},
    {k:"vac",l:"Vacantes",t:"number",req:true,min:1,max:50,def:1},
    {k:"limite",l:"Fecha límite de postulación",t:"date",req:true},
    ...(isEmp ? [] : [{k:"estado",l:"Estado",t:"select",req:true,opts:() => ["Por validar","Publicada","Rechazada","Cerrada"].map(x => [x,x]),def:"Publicada"}])] },
  check:(v,row) => (!row && v.limite && v.limite < today()) ? {limite:"La fecha límite no puede estar en el pasado."} : null,
  after:(r,isNew) => { if(!r.fecha) r.fecha = today(); if(R() === "emp"){ r.estado = "Por validar"; notify("r:adm",`Nueva oferta por validar: ${r.puesto}`,"bolsa"); notify("r:admin",`Nueva oferta por validar: ${r.puesto}`,"bolsa") } },
  cols:[{h:"Puesto",v:r => `<b>${esc(r.puesto)}</b>`},{h:"Empresa",v:r => esc(empresa(r.emp).nom),hide:() => R() === "emp"},{h:"Modalidad",v:r => r.modal},{h:"Programa",v:r => r.prog ? prog(r.prog).cod : "Todos"},{h:"Vacantes",v:r => r.vac},{h:"Cierra",v:r => fd(r.limite)},{h:"Postulantes",v:r => cnt(DB.postulaciones,p => p.of === r.id)},{h:"Estado",v:r => estPill(r.estado)}],
  sort:(a,b) => (b.fecha||"").localeCompare(a.fecha||""),
  defaults:() => R() === "emp" ? {emp:myEmp().id, estado:"Por validar", fecha:today()} : {fecha:today()},
  label:r => r.puesto,
  refs:r => { const n = cnt(DB.postulaciones,p => p.of === r.id); return n ? `La oferta tiene ${n} postulación(es). Puede cambiar su estado a “Cerrada”.` : "" } };

const estUser = e => HOST.users().find(u => u.vin === "est:" + e.id || (["est","egr"].includes(u.rol) && (u.dni === e.dni || u.u === e.dni)));
const vinOpts = () => [...DB.docentes.map(d => ["doc:"+d.id, "Docente · " + d.nom]), ...DB.estudiantes.map(e => ["est:"+e.id, "Estudiante · " + e.nom]), ...DB.empresas.map(e => ["emp:"+e.id, "Empresa · " + e.nom])];
ENT.usuarios = { col:"usuarios", one:"usuario", title:"Cuentas de usuario", mod:"Usuarios", permMod:"usuarios", wide:true,
  fields:row => [
    {k:"u",l:"Usuario",req:true,uniq:true,pat:[/^[a-z0-9._]{3,20}$/i,"De 3 a 20 caracteres: letras, números, punto o guion bajo."]},
    {k:"nom",l:"Nombre completo o razón social",req:true,w:1},
    {k:"rol",l:"Rol",t:"select",req:true,opts:() => Object.entries(ROLES)},
    {k:"estado",l:"Estado",t:"select",req:true,opts:() => [["Activo","Activo"],["Inactivo","Inactivo"]]},
    ...(row ? [] : [{k:"pass",l:"Contraseña inicial",req:true,pat:[/^.{8,}$/,"Mínimo 8 caracteres."],def:""}]),
    {k:"area",l:"Área (personal administrativo)",t:"select",none:"Sin área",opts:() => DB.areas.map(a => [a.cod,a.nombre])},
    {k:"vin",l:"Vinculado a",t:"select",none:"Sin vínculo",w:1,opts:vinOpts,hint:"Relaciona la cuenta con un docente, estudiante o empresa para que vea su propia información."},
    {k:"dni",l:"DNI / RUC",pat:[/^(\d{8}|\d{11})$/,"8 dígitos (DNI) u 11 (RUC)."]}],
  check:(v,row) => row && row.id === S.user.id && (v.estado !== "Activo" || v.rol !== "admin") ? {estado:"No puede desactivar ni quitar el rol de administrador a su propia cuenta."} : null,
  cols:[{h:"Usuario",v:r => mono(r.u)},{h:"Nombre",v:r => esc(r.nom)},{h:"Rol",v:r => pill(ROLES[r.rol],"p-brand")},{h:"Vinculado a",v:r => { const o = vinOpts().find(x => x[0] === r.vin); return o ? esc(o[1]) : "—" }},{h:"Último acceso",v:r => r.ult ? fd(r.ult) : "—"},{h:"Estado",v:r => estPill(r.estado)}],
  label:r => r.u,
  refs:r => r.id === S.user.id ? "No puede eliminar la cuenta con la que inició sesión." : "" };

ENT.bitacora = { col:"bitacora", one:"registro", title:"Bitácora de auditoría", mod:"Bitácora", permMod:"bitacora",
  cols:[{h:"Fecha y hora",v:r => mono(fd(r.f))},{h:"Usuario",v:r => mono(r.u)},{h:"Acción",v:r => esc(r.a)},{h:"Módulo",v:r => esc(r.m)},{h:"Detalle",v:r => esc(r.d)}] };
/* =====================================================================
   VISTAS — shell, acceso, portal público, panel e horarios
   ===================================================================== */
const V = {};
function tabs(view, list){
  const keys = list.map(x => x[0]); let cur = S.tab[view]; if(!keys.includes(cur)) cur = keys[0]; S.tab[view] = cur;
  return {cur, html:`<div class="tabs" role="tablist">${list.map(([k,t,n]) => `<button class="tab ${k === cur ? "on" : ""}" data-tab="${view}:${k}" role="tab" aria-selected="${k === cur}">${t}${n ? `<span class="cnt">${n}</span>` : ""}</button>`).join("")}</div>`};
}
const head = (code, title, desc, actions) => HOST.head(title, desc, actions, code);
const headIX = (code, title, desc, actions) => `<div class="head"><div>${code ? `<span class="ref">${code}</span>` : ""}<h1>${title}</h1>${desc ? `<p>${desc}</p>` : ""}</div>${actions ? `<div class="btnrow">${actions}</div>` : ""}</div>`;
const bars = (items, alt) => { const max = Math.max(1, ...items.map(x => x[1])); return `<div class="bars">${items.map(([l,n]) => `<div class="barrow"><span>${esc(l)}</span><b class="mono">${n}</b><div class="bar"><i class="${alt ? "b2" : ""}" style="width:${n/max*100}%"></i></div></div>`).join("")}</div>` };
const empty = (txt, btn) => `<div class="empty">${txt}${btn || ""}</div>`;

/* ---------- semáforo de plazos ---------- */
function plazoExp(x){ const t = tram(x.tramite); const due = addBiz(x.fecha, t.dias || 5); return {due, left:bizLeft(due)} }
function semaforo(estado, due, left){
  if(["Atendido","Cerrado","Respondido"].includes(estado)) return pill("Concluido","p-mut");
  if(left < 0) return pill(`Vencido hace ${-left} d`,"p-bad");
  if(left <= 2) return pill(left === 0 ? "Vence hoy" : `Vence en ${left} d`,"p-warn");
  return pill(`${left} d hábiles`,"p-ok");
}
const plazoRec = r => { const due = addBiz(r.fecha, DB.cfg.plazoReclamo); return {due, left:bizLeft(due)} };

/* ---------- acceso ---------- */
function renderLogin(){
  const demo = HOST.users().filter(u => u.estado === "Activo");
  return `<div class="login">
  <section class="lb"><div class="brandbox" style="border:0;padding:0">${sealHtml()}<div><b>${esc(DB.cfg.siglas)}</b><small>${esc(["Ministerio de Educación", ...(HOST.inst ? [HOST.inst().region ? "DRE " + HOST.inst().region : "", HOST.inst().distrito || ""] : [])].filter(Boolean).join(" · "))}</small></div></div>
    <h1>Intranet Institucional</h1>
    <p>Plataforma de gestión académica y administrativa: horarios, certificaciones, títulos, trámite documentario, libro de reclamaciones, bolsa laboral y portafolio docente en un solo sistema.</p>
    <div class="mods">${MODS.filter(m => m[2]).map(m => `<div>${ICO[m[0]] || ""}<span>${m[2]}</span>${m[1]}</div>`).join("")}</div>
    <p class="fine">Portal Web Institucional 2026 · ${esc(DB.cfg.nombre)}</p>
  </section>
  <section class="lf">
    <div class="login-tools">${themeBtn()}</div>
    <div><h2 style="font-size:1.5rem">Iniciar sesión</h2><p class="note">Ingrese con su usuario institucional.</p></div>
    <form class="f" data-form="login" style="grid-template-columns:1fr" novalidate>
      ${fieldHtml({k:"lu",l:"Usuario",req:true,ph:"usuario o DNI"}, S.ui.lu || "")}
      ${fieldHtml({k:"lp",l:"Contraseña",t:"password",req:true}, "")}
      <div id="loginErr"></div>
      <button class="btn" type="submit" style="justify-content:center">Ingresar</button>
    </form>
    <button class="btn sec" data-act="toPublic" style="justify-content:center">Consultas públicas sin cuenta (títulos, trámites, reclamos…)</button>
    <div class="stack" style="gap:8px"><h3>Cuentas de demostración</h3><p class="note">Las cuentas y contraseñas son administradas por la institución.</p>
      <div class="demo">${demo.map(u => `<button type="button" data-act="demoLogin" data-id="${u.id}"><b>${esc(ROLES[u.rol])}</b><small>${esc(u.nom)}</small><span class="mono">${esc(u.u)}</span></button>`).join("")}</div>
      <p class="note">Accede con tu cuenta institucional. Los trámites y documentos se gestionan según los permisos de tu perfil.</p></div>
  </section></div>`;
}
function doLogin(u){
  closeModal(); u.ult = nowStamp(); S.user = u; S.mode = "app"; S.view = "inicio"; S.tab = {}; S.q = {}; S.ui = {};
  log("Iniciar sesión","Seguridad",`Ingreso de ${u.u} (${ROLES[u.rol]})`); if(!save())return false; LS.set(SKEY,{uid:u.id,view:"inicio"}); render(); window.scrollTo(0,0);
  toast(`Bienvenido(a), ${u.nom.split(" ")[0]}.`);
}

/* ---------- portal público ---------- */
const PUB = [["titulos","Consulta de títulos"],["certificados","Consulta de certificaciones"],["verificar","Verificar documento"],["mesa","Mesa de partes virtual"],["seguimiento","Seguimiento de trámite"],["reclamos","Libro de reclamaciones"],["docentes","Nuestros docentes"],["bolsa","Bolsa laboral"],["empresa","Registro de empresas"]];
function renderPublic(){
  const t = PUB.find(p => p[0] === S.pubTab) ? S.pubTab : "titulos";
  let body = "";
  if(t === "titulos") body = consultaTitulo(true);
  if(t === "certificados") body = consultaCert(true);
  if(t === "verificar") body = verificarDoc();
  if(t === "mesa") body = formExpediente(true);
  if(t === "seguimiento") body = seguimiento();
  if(t === "reclamos") body = formReclamo(true);
  if(t === "docentes") body = directorioDoc(true);
  if(t === "bolsa") body = ofertasPublicas();
  if(t === "empresa") body = registroEmpresa();
  return `<header class="pub-top"><div class="brandbox">${sealHtml()}<div><b>${esc(DB.cfg.siglas)} · Servicios en línea</b><small>Acceso público desde ${esc(DB.cfg.web)}</small></div></div>
    <div class="btnrow">${themeBtn()}<button class="btn" data-act="toLogin">${S.user ? "Volver a la intranet" : "Ingresar a la intranet"}</button></div></header>
    <main class="content pub-wrap">${head("Portal de servicios","Consultas y trámites en línea","Servicios disponibles sin cuenta. Los datos que registre quedan en la intranet y los atiende el área responsable.")}
    <nav class="pubtabs" aria-label="Servicios">${PUB.map(([k,l]) => `<button class="${k === t ? "on" : ""}" data-act="pubTab" data-id="${k}">${l}</button>`).join("")}</nav>${body}</main>`;
}

/* ---------- shell de la intranet ---------- */
function navCount(k){
  if(k === "mesa" && lvl("mesa") >= 2) return cnt(HOST.exps(), x => !["Atendido","Cerrado"].includes(x.estado) && (["admin","dir"].includes(R()) || S.user.area === "MP" || x.area === S.user.area));
  if(k === "reclamos" && lvl("reclamos") >= 2) return cnt(DB.reclamos, x => x.estado !== "Respondido");
  if(k === "bolsa" && lvl("bolsa") >= 2) return cnt(DB.ofertas, o => o.estado === "Por validar") + cnt(DB.empresas, e => !e.validada);
  if(k === "horarios" && lvl("horarios") >= 2) return cnt(validar(), v => v.t === "bad");
  if(k === "bolsa" && R() === "emp"){ const e = myEmp(); return e ? cnt(DB.postulaciones, p => p.estado === "Recibida" && empresa(byId(DB.ofertas,p.of).emp).id === e.id) : 0 }
  return 0;
}
function renderApp(){
  if(lvl(S.view) === 0) S.view = "inicio";
  let groups = {}; MODS.forEach(m => { if(lvl(m[0]) > 0){ (groups[m[3] || "General"] = groups[m[3] || "General"] || []).push(m) } });
  const cur = MODS.find(m => m[0] === S.view);
  const nots = myNotifs(), unread = nots.filter(n => !n.leido.includes(S.user.id)).length;
  const side = `<div class="brandbox">${sealHtml()}<div><b>${esc(ap().titulo || ("Intranet " + DB.cfg.siglas))}</b><small>Gestión académica y administrativa · ${esc(DB.cfg.periodo)}</small></div></div>
    ${Object.entries(groups).map(([g,ms]) => `<nav class="navgroup"><span>${g}</span>${ms.map(m => { const n = navCount(m[0]); return `<button class="nav ${S.view === m[0] ? "on" : ""}" data-go="${m[0]}"><span class="nl">${ICO[m[0]] || ""}<span>${m[1]}</span></span>${n ? `<span class="cnt">${n}</span>` : `<span class="code">${m[2]}</span>`}</button>` }).join("")}</nav>`).join("")}
    <div class="side-foot"><span>${esc(DB.cfg.nombre)}</span><button data-act="toPublicApp">${ICO.globe}Ver portal público</button></div>`;
  return `<div class="app"><aside class="side ${S.ui.menu ? "open" : ""}" id="side" aria-label="Módulos">${side}</aside>
  <div class="main"><header class="top">
    <div class="btnrow"><button class="iconbtn menu-btn" data-act="menu" aria-label="Abrir menú">${ICO.menu}<span>Menú</span></button><span class="crumb"><span class="lbl-hide">Intranet ›</span> <b>${cur[1]}</b></span></div>
    <div class="userbox">
      ${themeBtn()}
      <button class="iconbtn" data-act="bell" aria-label="Notificaciones">${ICO.bell}${unread ? `<span class="dot">${unread}</span>` : ""}</button>
      <div class="who"><b>${esc(S.user.nom)}</b><small>${esc(ROLES[S.user.rol])}</small></div>
      <button class="iconbtn" data-act="account" aria-label="Mi cuenta"><span class="avatar" style="width:24px;height:24px;font-size:.62rem">${initials(S.user.nom)}</span></button>
      ${S.ui.dd === "bell" ? `<div class="dd" role="dialog" aria-label="Notificaciones"><header><b>Notificaciones</b>${unread ? `<button class="btn ghost sm" data-act="readAll">Marcar todas como leídas</button>` : ""}</header><div class="list">${nots.length ? nots.slice(0,15).map(n => `<button class="it ${n.leido.includes(S.user.id) ? "" : "new"}" data-act="openNotif" data-id="${n.id}">${esc(n.txt)}<small>${fd(n.fecha)}</small></button>`).join("") : `<p class="note" style="padding:14px">No tiene notificaciones.</p>`}</div></div>` : ""}
      ${S.ui.dd === "account" ? `<div class="dd" style="width:260px"><header><div><b>${esc(S.user.u)}</b><br><small class="muted">${esc(ROLES[S.user.rol])}</small></div></header><div class="list"><button class="it" data-act="changePass">Cambiar contraseña</button><button class="it" data-act="logout">Cerrar sesión</button></div></div>` : ""}
    </div></header>
    <main class="content" id="view">${V[S.view]()}</main></div></div>`;
}

/* ---------- panel de inicio ---------- */
V.inicio = () => {
  const r = R(), name = S.user.nom.split(" ")[0];
  const h = new Date().getHours(), sal = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  const nots = myNotifs(), unread = nots.filter(n => !n.leido.includes(S.user.id)).length;
  const fecha = new Date().toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const stats = [[unread,"Notificaciones sin leer",unread > 0]];
  if(["admin","dir","acad","adm"].includes(r)){ const ab = HOST.exps().filter(x => !["Atendido","Cerrado"].includes(x.estado)); stats.push([ab.filter(x => plazoExp(x).left < 0).length,"Expedientes vencidos",ab.some(x => plazoExp(x).left < 0)]) }
  const hello = `<section class="hero"><div class="hero-txt"><span class="eyebrow">${esc(DB.cfg.siglas)} · Periodo ${esc(DB.cfg.periodo)}</span><h1>${sal}, ${esc(name)}</h1><p>Sesión como <b>${esc(ROLES[r])}</b> · ${fecha}.</p></div>
    <div class="hero-stats">${stats.map(([n,l,al]) => `<div class="hero-stat ${al ? "alert" : ""}"><b>${n}</b><span>${l}</span></div>`).join("")}</div></section>`;
  const qm = MODS.filter(m => m[0] !== "inicio" && lvl(m[0]) > 0);
  const quick = qm.length ? `<div class="sec-title"><h2>Accesos rápidos</h2></div><div class="quick">${qm.map(m => `<button class="qa" data-go="${m[0]}"><span class="qi">${ICO[m[0]] || ""}</span><span><b>${m[1]}</b><small>${m[2] ? "Módulo " + m[2] : m[3]}</small></span></button>`).join("")}</div>` : "";
  let body = "";
  if(["admin","dir","acad","adm"].includes(r)) body = inicioStaff();
  else if(r === "doc") body = inicioDocente();
  else if(r === "est" || r === "egr") body = inicioEstudiante();
  else if(r === "emp") body = inicioEmpresa();
  return hello + body + quick;
};
function inicioStaff(){
  const val = validar(), errH = cnt(val, v => v.t === "bad");
  const expAb = HOST.exps().filter(x => !["Atendido","Cerrado"].includes(x.estado));
  const venc = expAb.filter(x => plazoExp(x).left < 0), porV = expAb.filter(x => { const l = plazoExp(x).left; return l >= 0 && l <= 2 });
  const recP = DB.reclamos.filter(x => x.estado !== "Respondido");
  const ofV = DB.ofertas.filter(o => o.estado === "Por validar"), empV = DB.empresas.filter(e => !e.validada);
  const k = (n,l,go,al,ic) => `<button class="kpi has-ico ${al && n ? "alert-k" : ""}" ${go && lvl(go) ? `data-go="${go}"` : "disabled"}><span class="kico">${ICO[ic || go] || ""}</span><b>${n}</b><span>${l}</span>${go && lvl(go) ? `<span class="more">Ver detalle →</span>` : ""}</button>`;
  const tasks = [];
  if(lvl("mesa") >= 2){ venc.forEach(x => tasks.push(["bad",`Expediente ${x.num} vencido`,`${tram(x.tramite).nombre} · ${areaN(x.area)}`,"mesa"])); porV.forEach(x => tasks.push(["warn",`Expediente ${x.num} por vencer`,`${tram(x.tramite).nombre} · ${areaN(x.area)}`,"mesa"])); const nuevos = expAb.filter(x => x.estado === "Recibido"); if(nuevos.length) tasks.push(["info",`${nuevos.length} expediente(s) recibidos sin derivar`,"Mesa de partes virtual","mesa"]) }
  if(lvl("reclamos") >= 2) recP.forEach(x => { const p = plazoRec(x); tasks.push([p.left < 3 ? "warn" : "info",`Reclamo ${x.num} ${x.resp ? "en atención" : "sin responsable"}`,`Plazo: ${fd(p.due)} · ${areaN(x.area)}`,"reclamos"]) });
  if(lvl("horarios") >= 2 && errH) tasks.push(["bad",`${errH} error(es) en la programación de horarios`,"Cruces o disponibilidad del docente","horarios"]);
  if(lvl("bolsa") >= 2){ ofV.forEach(o => tasks.push(["warn",`Oferta por validar: ${o.puesto}`,empresa(o.emp).nom,"bolsa"])); empV.forEach(e => tasks.push(["warn",`Empresa por validar: ${e.nom}`,`RUC ${e.ruc}`,"bolsa"])) }
  const estados = ["Recibido","Derivado","En evaluación","Observado","Atendido","Cerrado"].map(e => [e, cnt(HOST.exps(), x => x.estado === e)]).filter(x => x[1]);
  return `<div class="kpis">
    ${k(DB.estudiantes.filter(e => e.estado === "Regular").length,"Estudiantes regulares","certificados",false,"usuarios")}
    ${k(DB.sesiones.filter(s => s.per === DB.cfg.periodo).length,`Sesiones programadas ${DB.cfg.periodo}`,"horarios")}
    ${k(errH,"Errores de horario por resolver","horarios",true,"alerta")}
    ${k(expAb.length,"Expedientes en trámite","mesa")}
    ${k(venc.length,"Expedientes vencidos","mesa",true,"reloj")}
    ${k(recP.length,"Reclamos pendientes","reclamos",true)}
    ${k(DB.certs.length,"Certificaciones modulares","certificados")}
    ${k(DB.ofertas.filter(o => o.estado === "Publicada").length,"Ofertas laborales activas","bolsa")}
  </div>
  <div class="grid2">
    <section class="panel"><div class="panel-h"><h2>Pendientes que requieren atención</h2><span class="count">${tasks.length}</span></div>
      ${tasks.length ? `<div class="tasks">${tasks.slice(0,8).map(t => `<button class="task t-${t[0]}" data-go="${t[3]}">${pill(t[0] === "bad" ? "Urgente" : t[0] === "warn" ? "Atender" : "Nuevo", "p-" + t[0])}<span><b>${esc(t[1])}</b><span class="note">${esc(t[2])}</span></span><span class="go" aria-hidden="true">→</span></button>`).join("")}</div>${tasks.length > 8 ? `<p class="note">Y ${tasks.length - 8} pendiente(s) más en los módulos.</p>` : ""}` : empty("No hay pendientes. Todo está al día.")}
    </section>
    <div class="stack">
      <section class="panel"><div class="panel-h"><h2>Expedientes por estado</h2>${lvl("mesa") ? `<button class="btn ghost sm" data-go="mesa">Ver mesa de partes</button>` : ""}</div>${estados.length ? donut(estados) : empty("Sin expedientes")}</section>
      <section class="panel"><h2>Certificaciones por programa</h2>${bars(DB.programas.map(p => [p.cod + " · " + p.nombre, cnt(DB.certs, c => est(c.est).prog === p.id)]), true)}</section>
    </div>
  </div>
  <section class="panel"><div class="panel-h"><h2>Actividad reciente en el sistema</h2>${lvl("bitacora") ? `<button class="btn sec sm" data-go="bitacora">Ver bitácora completa</button>` : ""}</div>
  <div class="timeline">${DB.bitacora.slice(0,6).map(b => `<div><small>${fd(b.f)} · ${esc(b.u)}</small><br><b>${esc(b.a)}</b> · ${esc(b.m)} · ${esc(b.d)}</div>`).join("")}</div></section>`;
}
/* gráfico de anillo para estados */
const EST_COL = {"Recibido":"var(--info)","Derivado":"var(--brand)","En evaluación":"var(--warn)","Observado":"var(--bad)","Atendido":"var(--ok)","Cerrado":"var(--muted)"};
function donut(items){
  const tot = items.reduce((a,x) => a + x[1], 0) || 1, R = 52, C = 2 * Math.PI * R; let off = 0;
  const segs = items.map(([l,n]) => { const len = n / tot * C, s = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${EST_COL[l] || "var(--brand)"}" stroke-width="18" stroke-dasharray="${Math.max(len - 2, 0.1)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(l)}: ${n}</title></circle>`; off += len; return s }).join("");
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 140 140" role="img" aria-label="Expedientes por estado"><circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="18"/>${segs}<text x="70" y="68" text-anchor="middle" font-size="26" font-weight="800">${tot}</text><text x="70" y="88" text-anchor="middle" font-size="10" style="fill:var(--muted)">expedientes</text></svg>
  <div class="dleg">${items.map(([l,n]) => `<div><i style="background:${EST_COL[l] || "var(--brand)"}"></i><span>${esc(l)}</span><b>${n}</b></div>`).join("")}</div></div>`;
}
function claseHoy(ss, who){
  const hoy = dayKey(), list = ss.filter(s => s.dia === hoy).sort((a,b) => mins(a.ini) - mins(b.ini));
  return `<section class="panel"><div class="panel-h"><h2>Mis clases de hoy · ${DIAS_L[hoy] || "Domingo"}</h2><button class="btn sec sm" data-go="horarios">Ver semana</button></div>
  ${list.length ? `<div class="timeline">${list.map(s => `<div><small>${s.ini} – ${s.fin}</small><br><b>${esc(ud(s.ud).nombre)}</b> · ${who === "doc" ? `${prog(s.prog).cod} ${s.ciclo}-${s.sec}` : esc(shortName((docente(s.doc)||{}).nom))} · ${esc((amb(s.amb)||{cod:"—"}).cod)}</div>`).join("")}</div>` : empty("No tiene clases programadas hoy.")}</section>`;
}
function misTramitesMini(){
  const dni = S.user.dni; const mine = dni ? HOST.exps().filter(x => x.dni === dni) : [];
  return `<section class="panel"><div class="panel-h"><h2>Mis trámites</h2><a class="btn sec sm" href="#/servicios/mesa-de-partes">Ir a mesa de partes</a></div>
  ${mine.length ? `<div class="tw"><table><tbody>${mine.map(x => `<tr><td>${mono(x.num)}<br><span class="note">${esc(x.tramN)}</span></td><td>${estPill(x.estado)}</td><td style="text-align:right"><button type="button" class="btn sec sm" data-cargo-exp="${esc(String(x.id))}">Cargo (PDF)</button></td></tr>`).join("")}</tbody></table></div>` : empty("No tiene trámites registrados.")}</section>`;
}
function inicioDocente(){
  const d = myDoc(); if(!d) return empty("Su cuenta no está vinculada a un docente. Contacte al administrador.");
  const ss = DB.sesiones.filter(s => s.doc === d.id && s.per === DB.cfg.periodo), h = ss.reduce((a,s) => a + (mins(s.fin)-mins(s.ini))/60, 0);
  const p = DB.perfilesDoc.find(x => x.doc === d.id) || {}; const parts = [p.resumen, (p.grados||[]).length, (p.certs||[]).length, (p.exp||[]).length, (p.port||[]).length]; const pct = Math.round(parts.filter(Boolean).length / parts.length * 100);
  return `<div class="kpis"><div class="kpi"><b>${ss.length}</b><span>Sesiones semanales</span></div><div class="kpi"><b>${Math.round(h*10)/10}</b><span>Horas lectivas por semana</span></div><div class="kpi"><b>${new Set(ss.map(s => s.ud)).size}</b><span>Unidades didácticas a cargo</span></div><div class="kpi"><b>${pct}%</b><span>Perfil docente completo</span></div></div>
  <div class="grid2">${claseHoy(ss,"doc")}<div class="stack"><section class="panel"><div class="panel-h"><h2>Mi ficha docente</h2><a class="btn sm" href="#/nosotros/plana-docente">Ver en el portal</a></div><p class="note">Su hoja de vida, formación y experiencia se publican en la Plana docente del portal (con su autorización, Ley N.º 29733).</p><p><a class="btn sm" href="#/admin/cvdocente">Actualizar mi CV docente</a></p></section>${misTramitesMini()}</div></div>`;
}
function inicioEstudiante(){
  const e = myEst(); if(!e) return empty("Su cuenta no está vinculada a un estudiante. Contacte al administrador.");
  const pub = DB.publicados[gkey(e.prog,e.ciclo,e.sec,e.turno)];
  const ss = pub ? DB.sesiones.filter(s => s.per === DB.cfg.periodo && s.prog === e.prog && s.ciclo === e.ciclo && s.sec === e.sec && s.turno === e.turno) : [];
  const cs = DB.certs.filter(c => c.est === e.id), mods = DB.modulos.filter(m => m.prog === e.prog);
  const ofs = DB.ofertas.filter(o => o.estado === "Publicada" && (!o.prog || o.prog === e.prog) && o.limite >= today());
  return `<div class="kpis"><div class="kpi"><b>${prog(e.prog).cod}</b><span>${esc(prog(e.prog).nombre)}</span></div><div class="kpi"><b>${cs.length}/${mods.length}</b><span>Módulos certificados</span></div><div class="kpi"><b>${HOST.exps().filter(x => x.dni === e.dni && !["Cerrado","Atendido"].includes(x.estado)).length}</b><span>Trámites en curso</span></div><div class="kpi"><b>${ofs.length}</b><span>Ofertas para tu programa</span></div></div>
  <div class="grid2">${e.estado === "Regular" ? (pub ? claseHoy(ss,"est") : `<section class="panel"><h2>Mi horario</h2>${empty("El horario de tu sección aún no ha sido publicado.")}</section>`) : `<section class="panel"><h2>Mi situación académica</h2><dl class="dl"><dt>Estado</dt><dd>${estPill(e.estado)}</dd><dt>Programa</dt><dd>${esc(prog(e.prog).nombre)}</dd><dt>Módulos certificados</dt><dd>${cs.length} de ${mods.length}</dd></dl><div class="btnrow"><button class="btn sm" data-go="certificados">Ver mis certificaciones</button>${lvl("titulos") ? `<button class="btn sec sm" data-go="titulos">Mi título</button>` : ""}</div></section>`}
  <div class="stack">${misTramitesMini()}<section class="panel"><div class="panel-h"><h2>Ofertas laborales para ti</h2><button class="btn sec sm" data-go="bolsa">Ver todas</button></div>${ofs.length ? ofs.slice(0,3).map(o => `<div><b>${esc(o.puesto)}</b><br><span class="note">${esc(empresa(o.emp).nom)} · cierra ${fd(o.limite)}</span></div>`).join("") : empty("No hay ofertas vigentes para tu programa.")}</section></div></div>`;
}
function inicioEmpresa(){
  const e = myEmp(); if(!e) return empty("Cuenta sin empresa vinculada.");
  const ofs = DB.ofertas.filter(o => o.emp === e.id), posts = DB.postulaciones.filter(p => ofs.some(o => o.id === p.of));
  return `${e.validada ? "" : `<div class="alert warn"><b>Empresa pendiente de validación.</b> El instituto revisará sus datos; sus ofertas se publicarán cuando la empresa sea validada.</div>`}
  <div class="kpis"><div class="kpi"><b>${ofs.filter(o => o.estado === "Publicada").length}</b><span>Ofertas publicadas</span></div><div class="kpi"><b>${ofs.filter(o => o.estado === "Por validar").length}</b><span>Ofertas por validar</span></div><div class="kpi"><b>${posts.length}</b><span>Postulaciones recibidas</span></div><div class="kpi"><b>${posts.filter(p => p.estado === "Recibida").length}</b><span>Postulaciones sin revisar</span></div></div>
  <section class="panel"><div class="panel-h"><h2>Postulaciones recientes</h2><button class="btn sm" data-go="bolsa">Gestionar bolsa laboral</button></div>
  ${posts.length ? `<div class="tw"><table><thead><tr><th>Postulante</th><th>Oferta</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${posts.map(p => `<tr><td>${esc(est(p.est).nom)}</td><td>${esc(byId(DB.ofertas,p.of).puesto)}</td><td>${fd(p.fecha)}</td><td>${estPill(p.estado)}</td></tr>`).join("")}</tbody></table></div>` : empty("Aún no recibe postulaciones.")}</section>`;
}

/* ---------- 1.1 horarios ---------- */
/* Programas que puede programar el usuario: el coordinador, solo el suyo. */
function progsVisibles(){
  const act = DB.programas.filter(p => p.activo); const u = typeof currentUser === "function" ? currentUser() : null;
  if(u && u.rol === "coordinador"){ const own = act.filter(p => p.id === (DB.progMap || {})[u.programaId]); if(own.length) return own; }
  return act;
}
function grupoSel(){
  const act = progsVisibles();
  const g = S.ui.hg || (S.ui.hg = {p:act[0] ? act[0].id : 1, c:"III", s:"A", t:"Mañana"});
  if(act.length && !act.some(p => p.id === g.p)) g.p = act[0].id;
  return g;
}
function grupoPicker(g){
  return `<div class="f" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))">
    <div class="fld"><label for="hg_p">Programa</label><select id="hg_p" data-chg="hg">${progsVisibles().map(p => `<option value="${p.id}" ${p.id === g.p ? "selected" : ""}>${p.cod}</option>`).join("")}</select></div>
    <div class="fld"><label for="hg_c">Ciclo</label><select id="hg_c" data-chg="hg">${["I","II","III","IV","V","VI"].map(c => `<option ${c === g.c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
    <div class="fld"><label for="hg_s">Sección</label><select id="hg_s" data-chg="hg">${["A","B"].map(c => `<option ${c === g.s ? "selected" : ""}>${c}</option>`).join("")}</select></div>
    <div class="fld"><label for="hg_t">Turno</label><select id="hg_t" data-chg="hg">${["Mañana","Tarde"].map(c => `<option ${c === g.t ? "selected" : ""}>${c}</option>`).join("")}</select></div></div>`;
}
const sesGrupo = g => DB.sesiones.filter(s => s.per === DB.cfg.periodo && s.prog === g.p && s.ciclo === g.c && s.sec === g.s && s.turno === g.t);
function grid(ss, turno, opt = {}){
  const sl = SLOTS[turno], days = DIAS.slice(0, ss.some(s => s.dia === "Sáb") ? 6 : 5);
  const bad = new Set(validar().filter(v => v.t === "bad").flatMap(v => v.ids));
  const occ = sl.map(() => days.map(() => null)), hidden = [];
  [...ss].sort((a,b) => mins(a.ini) - mins(b.ini)).forEach(s => {
    const di = days.indexOf(s.dia); if(di < 0){ hidden.push(s); return }
    const rows = []; sl.forEach((x,i) => { const a = x[0] === "REC" ? x[1] : x[0], b = x[0] === "REC" ? x[2] : x[1]; if(mins(s.ini) < mins(b) && mins(a) < mins(s.fin)) rows.push(i) });
    if(!rows.length || rows.some(i => occ[i][di])){ hidden.push(s); return }
    rows.forEach((i,n) => occ[i][di] = {s, first:n === 0, span:rows.length});
  });
  let h = `<div class="tw" style="border:0"><table class="sched"><thead><tr><th style="width:96px"></th>${days.map(d => `<th>${DIAS_L[d]}</th>`).join("")}</tr></thead><tbody>`;
  sl.forEach((x,i) => {
    const isRec = x[0] === "REC";
    h += `<tr><td class="hr">${isRec ? `${x[1]}–${x[2]}` : `${x[0]}–${x[1]}`}</td>`;
    days.forEach((d,di) => {
      const c = occ[i][di];
      if(c && !c.first) return;
      if(c){ const s = c.s, dd = docente(s.doc), am = amb(s.amb);
        const inner = `<b>${esc(ud(s.ud).nombre)}</b><small>${opt.byDoc ? `${prog(s.prog).cod} ${s.ciclo}-${s.sec}` : esc(dd ? shortName(dd.nom) : "Sin docente")} · ${esc(am ? am.cod : "Sin ambiente")}</small><small class="mono">${s.ini}–${s.fin}</small>`;
        h += `<td rowspan="${c.span}">${opt.edit ? `<button class="cell ses ${bad.has(s.id) ? "err" : ""}" data-act="editSes" data-id="${s.id}" aria-label="Editar ${esc(ud(s.ud).nombre)} ${DIAS_L[d]} ${s.ini}">${inner}</button>` : `<div class="cell ses ${bad.has(s.id) && opt.showErr ? "err" : ""}">${inner}</div>`}</td>`; return }
      if(isRec){ h += `<td class="rec">Receso</td>`; return }
      h += `<td>${opt.edit ? `<button class="cell add" data-act="newSes" data-id="${d}|${x[0]}|${x[1]}" aria-label="Agregar clase ${DIAS_L[d]} ${x[0]}">+</button>` : ""}</td>`;
    });
    h += "</tr>";
  });
  h += "</tbody></table></div>";
  if(hidden.length) h += `<div class="alert bad"><b>Sesiones superpuestas:</b> ${hidden.map(s => `${esc(ud(s.ud).nombre)} (${s.dia} ${s.ini}–${s.fin})${opt.edit ? ` <button class="btn sec sm" data-act="editSes" data-id="${s.id}">Editar</button>` : ""}`).join(" · ")}</div>`;
  return h;
}
function sesForm(s, pre){
  const g = s ? {p:s.prog,c:s.ciclo,s:s.sec,t:s.turno} : grupoSel();
  const base = s || {dia:pre.dia, ini:pre.ini, fin:pre.fin};
  const udsG = DB.uds.filter(u => u.prog === g.p && u.ciclo === g.c);
  const fields = [
    {k:"ud",l:"Unidad didáctica",t:"select",req:true,num:true,w:1,opts:() => udsG.map(u => { const h = DB.sesiones.filter(x => x.ud === u.id && x.prog === g.p && x.sec === g.s && x.turno === g.t && x.per === DB.cfg.periodo && (!s || x.id !== s.id)).reduce((a,x) => a + (mins(x.fin)-mins(x.ini))/60,0); return [u.id, `${u.cod} · ${u.nombre} (${Math.round(h*10)/10}/${u.horas} h)`] })},
    {k:"doc",l:"Docente asignado",t:"select",num:true,none:"Sin asignar",opts:() => DB.docentes.map(d => [d.id, d.nom])},
    {k:"amb",l:"Ambiente asignado",t:"select",num:true,none:"Sin asignar",opts:() => DB.ambientes.map(a => [a.id, `${a.cod} · ${a.tipo}, ${a.cap} pers.${a.prog ? " (solo " + prog(a.prog).cod + ")" : ""}`])},
    {k:"dia",l:"Día",t:"select",req:true,opts:() => DIAS.map(d => [d, DIAS_L[d]])},
    {k:"ini",l:"Hora de inicio",t:"select",req:true,opts:() => slotStarts(g.t).map(x => [x,x])},
    {k:"fin",l:"Hora de término",t:"select",req:true,opts:() => slotEnds(g.t).map(x => [x,x])}];
  if(!udsG.length){ openModal({title:"No hay unidades didácticas", body:`<div class="alert warn">${prog(g.p).cod} no tiene unidades didácticas registradas para el ciclo ${g.c}.</div><p class="note">Regístrelas en Configuración › Unidades didácticas.</p>`}); return }
  let confirmed = false;
  openModal({ title:(s ? "Editar clase" : "Programar clase") + ` · ${prog(g.p).cod} ${g.c}-${g.s} (${g.t})`, wide:true,
    body:`<div class="f">${fields.map(f => fieldHtml(f, base[f.k])).join("")}</div><div id="sesWarn"></div>`,
    foot: s ? `<button type="button" class="btn ghost" data-act="delSes" data-id="${s.id}" style="margin-right:auto">Quitar del horario</button>` : "",
    submit: s ? "Guardar cambios" : "Agregar al horario",
    onSubmit: form => {
      const {vals, errs} = readFields(fields, form);
      if(vals.ini && vals.fin && mins(vals.fin) <= mins(vals.ini)) errs.fin = "Debe ser posterior a la hora de inicio.";
      if(!showErrs(form, errs)) return false;
      const tmp = Object.assign({}, s || {id:-1, per:DB.cfg.periodo, prog:g.p, ciclo:g.c, sec:g.s, turno:g.t}, vals);
      const others = DB.sesiones.filter(x => !s || x.id !== s.id);
      const saved = DB.sesiones; DB.sesiones = [...others, tmp]; const list = validar().filter(v => v.ids.includes(tmp.id)); DB.sesiones = saved;
      if(list.some(v => v.t === "bad") && !confirmed){
        $("#sesWarn").innerHTML = list.map(v => `<div class="alert ${v.t}"><b>${v.tipo}:</b> ${esc(v.msg)}</div>`).join("") + `<p class="note">Puede guardar de todos modos; el horario no podrá publicarse hasta corregirlo.</p>`;
        form.querySelector("button[type=submit]").textContent = "Guardar de todos modos"; confirmed = true; return false;
      }
      if(s) Object.assign(s, vals); else DB.sesiones.push(Object.assign(tmp, {id:nextId(DB.sesiones)}));
      const k = gkey(g.p,g.c,g.s,g.t); let msg = s ? "Clase actualizada." : "Clase agregada al horario.";
      if(DB.publicados[k]){ delete DB.publicados[k]; msg += " El horario volvió a borrador: publíquelo de nuevo."; }
      log(s ? "Editar" : "Registrar","Horarios",`${prog(g.p).cod} ${g.c}-${g.s} · ${ud(vals.ud).nombre} ${vals.dia} ${vals.ini}`); if(!save())return false; toast(msg); return true;
    }});
  // Validación en vivo: refresca advertencias al cambiar campos
  $("#mform").addEventListener("change", () => { confirmed = false; const b = $("#mform button[type=submit]"); if(b) b.textContent = s ? "Guardar cambios" : "Agregar al horario"; $("#sesWarn").innerHTML = "" });
}
function scheduleTurns(ss, turno) {
  return turno ? [turno] : ["Mañana", "Tarde"].filter(t => ss.some(s => s.turno === t));
}
function scheduleRows(ss, turno, byDoc, days) {
  const lessons = ss.filter(s => s.turno === turno);
  return SLOTS[turno].map(x => {
    if(x[0] === "REC") return [`${x[1]}-${x[2]}`, ...days.map(() => "Receso")];
    return [`${x[0]}-${x[1]}`, ...days.map(d => {
      const s = lessons.find(z => z.dia === d && mins(z.ini) < mins(x[1]) && mins(x[0]) < mins(z.fin));
      if(!s) return "";
      const teacher = docente(s.doc), room = amb(s.amb);
      return `${ud(s.ud).nombre}\n${byDoc ? prog(s.prog).cod + " " + s.ciclo + "-" + s.sec : (teacher ? shortName(teacher.nom) : "Sin docente")}\n${room ? room.cod : ""}`;
    })];
  });
}
function shiftGrids(ss, options) {
  const turns = scheduleTurns(ss);
  return turns.length ? turns.map(t => `<h3>Turno ${t}</h3>${grid(ss.filter(s=>s.turno===t),t,options)}`).join("") : empty("No hay clases asignadas en este periodo.");
}
function horarioPDF(title, ss, turno, byDoc){
  if(!libsOk("pdf")) return;
  const doc = pdfNew("landscape"), days = DIAS.slice(0, ss.some(s=>s.dia==="Sáb") ? 6 : 5);
  const turns = scheduleTurns(ss, turno);
  if(!turns.length){ toast("No hay clases para exportar."); return; }
  turns.forEach((t,index)=>{
    if(index) doc.addPage();
    const y=pdfHeader(doc,title,`Periodo académico ${DB.cfg.periodo} · Turno ${t}`);
    pdfTable(doc,y,["Hora",...days.map(d=>DIAS_L[d])],scheduleRows(ss,t,byDoc,days),{styles:{fontSize:7.5,cellPadding:2,valign:"middle",minCellHeight:13},columnStyles:{0:{cellWidth:24,fontStyle:"bold"}},didParseCell:c=>{if(c.section==="body"&&c.cell.raw==="Receso")c.cell.styles.fillColor=[236,240,239];else if(c.section==="body"&&c.column.index>0&&c.cell.raw)c.cell.styles.fillColor=[219,235,232]}});
  });
  pdfFooter(doc); log("Exportar","Horarios",title + " (PDF)"); if(!save())return false;
  saveFile(`horario_${slug(title)}_${fileStamp()}.pdf`,doc.output("blob"));
}
function horarioXLS(title, ss, turno, byDoc){
  const days=DIAS.slice(0,ss.some(s=>s.dia==="Sáb")?6:5), turns=scheduleTurns(ss,turno);
  const rows=turns.flatMap(t=>scheduleRows(ss,t,byDoc,days).map(row=>turno?row:[t,...row]));
  exportXLSX(`horario_${slug(title)}_${fileStamp()}.xlsx`,[...(turno?[]:["Turno"]),"Hora",...days.map(d=>DIAS_L[d])],rows,"Horario");
}
V.horarios = () => {
  const r = R(), L = lvl("horarios");
  const intro = head("1.1 · Gestión académica","Programación de horarios","Programación por sección, validación de cruces y publicación. Los maestros se administran en Configuración académica general.");
  if(L >= 2 || r === "dir"){
    const val = validar(), nb = cnt(val, v => v.t === "bad");
    const T = tabs("horarios", [["prog","Programación"],["valid","Validaciones", val.length || ""],["docente","Vista por docente"],["ambiente","Vista por ambiente"]]);
    let body = "";
    if(T.cur === "prog"){
      const g = grupoSel(), ss = sesGrupo(g), k = gkey(g.p,g.c,g.s,g.t), pub = DB.publicados[k];
      const gErr = val.filter(v => v.t === "bad" && v.ids.some(id => ss.some(s => s.id === id)));
      const gWarn = val.filter(v => v.t === "warn" && (v.ids.some(id => ss.some(s => s.id === id)) || v.grp === `${g.p}|${g.c}|${g.s}|${g.t}`));
      const title = `${prog(g.p).cod} ${g.c}-${g.s}`;
      body = `<section class="panel">${grupoPicker(g)}
        <div class="panel-h"><div><h2>${esc(prog(g.p).nombre)} · Ciclo ${g.c} · Sección ${g.s} · ${g.t}</h2><span class="note">${ss.length} clase(s) · ${pub ? `Publicado el ${fd(pub.fecha)} por ${esc(pub.por)}` : "Borrador sin publicar"}</span></div>
        <div class="btnrow">${pub ? pill("Publicado","p-ok") : pill("Borrador","p-warn")}
          <button class="btn sec sm" data-act="hPDF">PDF</button><button class="btn sec sm" data-act="hXLS">Excel</button>
          ${L >= 2 ? (pub ? `<button class="btn sec sm" data-act="unpublish">Retirar publicación</button>` : `<button class="btn sm" data-act="publish" ${gErr.length || !ss.length ? "disabled" : ""}>Publicar horario</button>`) : ""}</div></div>
        ${gErr.length ? `<div class="alert bad"><b>${gErr.length} error(es) bloquean la publicación.</b> ${gErr.map(v => esc(v.msg)).join(" ")}</div>` : ""}
        ${gWarn.length ? `<div class="alert warn"><b>${gWarn.length} advertencia(s):</b> ${gWarn.map(v => esc(v.msg)).join(" ")}</div>` : ""}
        ${!gErr.length && !gWarn.length && ss.length ? `<div class="alert ok"><b>Sin observaciones.</b> No hay cruces de docentes ni de ambientes y todas las unidades tienen sus horas completas.</div>` : ""}
        ${grid(ss, g.t, {edit:L >= 2, showErr:true})}
        <div class="legend"><span><i style="background:var(--brand-soft);border-left:3px solid var(--brand)"></i>Clase programada</span><span><i style="background:var(--bad-soft);border-left:3px solid var(--bad)"></i>Con cruce o fuera de disponibilidad</span>${L >= 2 ? `<span>Toque una celda vacía para programar una clase o una clase para editarla.</span>` : ""}</div>
      </section>`;
    }
    if(T.cur === "valid") body = `<section class="panel"><div class="panel-h"><div><h2>Control de la programación · ${DB.cfg.periodo}</h2><span class="note">Se revisan todas las secciones del periodo.</span></div><button class="btn sec sm" data-act="valXLS">Exportar Excel</button></div>
      <div class="alert ${nb ? "bad" : val.length ? "warn" : "ok"}"><b>${nb} error(es), ${val.length - nb} advertencia(s).</b> ${nb ? "Las secciones con errores no pueden publicarse." : val.length ? "Puede publicar, pero revise las advertencias." : "La programación no tiene observaciones."}</div>
      <div class="tw"><table><thead><tr><th>Severidad</th><th>Tipo</th><th>Detalle</th><th></th></tr></thead><tbody>${val.length ? val.map(v => `<tr><td>${v.t === "bad" ? pill("Error","p-bad") : pill("Advertencia","p-warn")}</td><td>${esc(v.tipo)}</td><td>${esc(v.msg)}</td><td class="act">${v.ids.length && L >= 2 ? `<button class="btn sec sm" data-act="goSes" data-id="${v.ids[0]}">Corregir</button>` : ""}</td></tr>`).join("") : `<tr><td colspan="4">${empty("Sin observaciones.")}</td></tr>`}</tbody></table></div></section>`;
    if(T.cur === "docente"){
      const dId = S.ui.hdoc || (DB.docentes[0] || {}).id; const d = docente(dId);
      const ss = d ? DB.sesiones.filter(s => s.doc === d.id && s.per === DB.cfg.periodo) : [];
      const h = ss.reduce((a,s) => a + (mins(s.fin)-mins(s.ini))/60, 0);
      body = `<section class="panel"><div class="f"><div class="fld"><label for="hdoc">Docente</label><select id="hdoc" data-chg="hdoc">${DB.docentes.map(x => `<option value="${x.id}" ${x.id === dId ? "selected" : ""}>${esc(x.nom)}</option>`).join("")}</select></div></div>
        ${d ? `<div class="panel-h"><div><h2>${esc(d.nom)}</h2><span class="note">${ss.length} sesiones · ${Math.round(h*10)/10} h semanales · Disponible ${d.dias.join(", ")} ${d.desde}–${d.hasta}</span></div><div class="btnrow"><button class="btn sec sm" data-act="hdPDF">PDF</button><button class="btn sec sm" data-act="hdXLS">Excel</button></div></div>${grid(ss.filter(s => s.turno === "Mañana"), "Mañana", {byDoc:true, showErr:true})}${ss.some(s => s.turno === "Tarde") ? grid(ss.filter(s => s.turno === "Tarde"), "Tarde", {byDoc:true, showErr:true}) : ""}` : empty("No hay docentes registrados.")}</section>`;
    }
    if(T.cur === "ambiente"){
      const aId = S.ui.hamb || (DB.ambientes[0] || {}).id; const a = amb(aId);
      const ss = a ? DB.sesiones.filter(s => s.amb === a.id && s.per === DB.cfg.periodo) : [];
      body = `<section class="panel"><div class="f"><div class="fld"><label for="hamb">Ambiente</label><select id="hamb" data-chg="hamb">${DB.ambientes.map(x => `<option value="${x.id}" ${x.id === aId ? "selected" : ""}>${x.cod} · ${x.tipo}</option>`).join("")}</select></div></div>
        ${a ? `<div class="panel-h"><div><h2>${esc(a.cod)} · ${esc(a.tipo)}</h2><span class="note">${esc(a.ubic)} · Capacidad ${a.cap} · ${ss.length} sesiones</span></div></div>${shiftGrids(ss, {byDoc:true, showErr:true})}` : empty("No hay ambientes registrados.")}</section>`;
    }
    return intro + T.html + body;
  }
  if(r === "doc"){
    const d = myDoc(); if(!d) return intro + empty("Cuenta sin docente vinculado.");
    const ss = DB.sesiones.filter(s => s.doc === d.id && s.per === DB.cfg.periodo);
    const T = tabs("horarios", [["mio","Mi horario"],["uds","Mis unidades"]]);
    if(T.cur === "mio") return intro + T.html + `<section class="panel"><div class="panel-h"><div><h2>Horario docente · ${esc(d.nom)}</h2><span class="note">Periodo ${DB.cfg.periodo}</span></div><div class="btnrow"><button class="btn sec sm" data-act="hdPDF">PDF</button><button class="btn sec sm" data-act="hdXLS">Excel</button></div></div>${shiftGrids(ss, {byDoc:true})}</section>`;
    return intro + T.html + `<section class="panel"><h2>Unidades asignadas</h2><div class="tw"><table><thead><tr><th>Unidad didáctica</th><th>Programa</th><th>Ciclo-Secc.</th><th>Día y hora</th><th>Ambiente</th><th>Publicación</th></tr></thead><tbody>${ss.map(s => `<tr><td>${esc(ud(s.ud).nombre)}</td><td>${prog(s.prog).cod}</td><td>${s.ciclo}-${s.sec}</td><td>${DIAS_L[s.dia]} ${mono(s.ini + "–" + s.fin)}</td><td>${esc((amb(s.amb)||{cod:"—"}).cod)}</td><td>${DB.publicados[gkey(s.prog,s.ciclo,s.sec,s.turno)] ? pill("Publicado","p-ok") : pill("Borrador","p-warn")}</td></tr>`).join("") || `<tr><td colspan="6">${empty("No tiene unidades asignadas en este periodo.")}</td></tr>`}</tbody></table></div></section>`;
  }
  const e = myEst(); if(!e) return intro + empty("Cuenta sin estudiante vinculado.");
  const pub = DB.publicados[gkey(e.prog,e.ciclo,e.sec,e.turno)];
  const ss = DB.sesiones.filter(s => s.per === DB.cfg.periodo && s.prog === e.prog && s.ciclo === e.ciclo && s.sec === e.sec && s.turno === e.turno);
  return intro + `<section class="panel"><div class="panel-h"><div><h2>Mi horario · ${prog(e.prog).cod} ${e.ciclo}-${e.sec} · ${e.turno}</h2><span class="note">${esc(prog(e.prog).nombre)} · Periodo ${DB.cfg.periodo}</span></div>${pub ? `<div class="btnrow"><button class="btn sec sm" data-act="hePDF">PDF</button><button class="btn sec sm" data-act="heXLS">Excel</button></div>` : ""}</div>
    ${pub ? grid(ss, e.turno) : empty("El horario de tu sección aún no ha sido publicado por la Jefatura de Unidad Académica.")}</section>`;
};
/* =====================================================================
   VISTAS — certificados, títulos, reclamos, mesa de partes
   ===================================================================== */

/* ---------- 1.2 constancias y certificados ---------- */
function findEst(q){ q = (q||"").trim().toLowerCase(); if(q.length < 3) return []; return DB.estudiantes.filter(e => e.dni === q || e.nom.toLowerCase().includes(q)) }
function fichaEst(e, opt = {}){
  const cs = DB.certs.filter(c => c.est === e.id), h = DB.notas.filter(n => n.est === e.id).sort((a,b) => a.periodo.localeCompare(b.periodo)), mods = DB.modulos.filter(m => m.prog === e.prog);
  const prom = h.length ? (h.reduce((a,n) => a + n.nota, 0) / h.length).toFixed(1) : "—";
  return `<div class="grid2"><section class="ficha"><div class="panel-h"><div><h2>${esc(e.nom)}</h2><span class="note">DNI ${e.dni}</span></div>${estPill(e.estado)}</div>
    <dl class="dl"><dt>Programa</dt><dd>${esc(prog(e.prog).nombre)}</dd><dt>Periodo de ingreso</dt><dd>${e.periodo}</dd>${opt.pub ? "" : `<dt>Ciclo y sección</dt><dd>${e.ciclo}-${e.sec} · ${e.turno}</dd>`}<dt>Módulos certificados</dt><dd>${cs.length} de ${mods.length}</dd></dl>
    <h3>Módulos formativos</h3>
    <div class="tw"><table><thead><tr><th>Módulo</th><th>Certificado</th><th>Fecha</th></tr></thead><tbody>${mods.map(m => { const c = cs.find(x => x.mod === m.id); return `<tr><td>${m.cod} · ${esc(m.nombre)}</td><td>${c ? mono(c.num) : pill("Pendiente","p-mut")}</td><td>${c ? fd(c.fecha) : "—"}</td></tr>` }).join("")}</tbody></table></div>
    ${!opt.pub ? `<div class="btnrow"><button class="btn sm" data-act="docCert" data-id="${e.id}" ${cs.length ? "" : "disabled"}>Emitir constancia de certificación</button>${lvl("certificados") >= 2 ? `<button class="btn sec sm" data-act="newCertFor" data-id="${e.id}">+ Registrar certificación</button>` : ""}</div>` : ""}</section>
    ${opt.pub ? `<section class="ficha"><h2>Validez de la consulta</h2><p class="note">Esta consulta muestra la información registrada por Secretaría Académica. Para un documento oficial con código de verificación, el titular puede emitir su constancia desde la intranet.</p></section>` :
    `<section class="ficha"><div class="panel-h"><h2>Historial académico</h2><span class="note">Promedio: <b>${prom}</b></span></div>
    <div class="tw"><table><thead><tr><th>Unidad didáctica</th><th>Periodo</th><th>Nota</th></tr></thead><tbody>${h.map(n => `<tr><td>${esc(n.ud)}</td><td>${n.periodo}</td><td><b style="color:${n.nota >= 13 ? "var(--ok)" : "var(--bad)"}">${n.nota}</b></td></tr>`).join("") || `<tr><td colspan="3"><span class="note">Sin notas registradas.</span></td></tr>`}</tbody></table></div>
    <p class="note">Escala vigesimal; nota mínima aprobatoria 13.</p></section>`}</div>`;
}
function consultaCert(pub){
  const q = S.ui.cq || "";
  const res = findEst(q);
  return `<section class="panel"><div><h2>Consulta institucional de certificaciones</h2><p class="note">Busque por DNI o por apellidos (mínimo 3 caracteres).</p></div>
    <form class="f" data-form="cq"><div class="fld"><label for="cq">DNI o apellidos</label><input id="cq" name="cq" value="${esc(q)}" placeholder="DNI o apellidos del alumno"></div><div class="fld" style="align-self:end"><button class="btn">Buscar</button></div></form>
    ${!q ? `<p class="note">Busque por DNI o nombre de un alumno registrado.</p>` : ""}</section>
    ${q ? (res.length === 1 ? fichaEst(res[0], {pub}) : res.length ? `<section class="panel"><h2>${res.length} coincidencias</h2><div class="tw"><table><tbody>${res.map(e => `<tr><td>${mono(e.dni)}</td><td>${esc(e.nom)}</td><td>${prog(e.prog).cod}</td><td>${estPill(e.estado)}</td><td class="act"><button class="btn sec sm" data-act="pickEst" data-id="${e.dni}">Ver</button></td></tr>`).join("")}</tbody></table></div></section>` : `<div class="alert warn">No se encontró ningún estudiante con “${esc(q)}”.</div>`) : ""}`;
}
function docCert(e){
  const cs = DB.certs.filter(c => c.est === e.id && c.estadoDoc!=="Anulado"); if(!cs.length){ toast("El estudiante no tiene certificaciones registradas."); return }
  const d = emitDoc("cert", e.id, e.nom); if(!d)return;
  const rows = cs.map(c => { const m = byId(DB.modulos,c.mod); return [`${m.cod} · ${m.nombre}`, c.num, fd(c.fecha)] });
  openModal({title:"Constancia de certificación modular", wide:true, body:`<div class="paper">${paperHead()}<h2>CONSTANCIA DE CERTIFICACIÓN MODULAR</h2>
    <p>La Secretaría Académica del ${esc(DB.cfg.nombre)} hace constar que <b>${esc(e.nom)}</b>, identificado(a) con DNI N.º <b>${e.dni}</b>, estudiante del programa de estudios <b>${esc(prog(e.prog).nombre)}</b>, registra las siguientes certificaciones modulares:</p>
    <div class="tw"><table><thead><tr><th>Módulo formativo</th><th>N.º de certificado</th><th>Fecha</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${mono(r[1])}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table></div>
    <p>Se expide la presente a solicitud del interesado para los fines que estime conveniente.</p>${paperFoot(d)}</div>`,
    foot:`<button type="button" class="btn" data-act="pdfCert" data-id="${e.id}">Descargar PDF</button>`});
}
function pdfCert(id){
  if(!libsOk("pdf")) return; const e = est(id), d = emitDoc("cert", e.id, e.nom), cs = DB.certs.filter(c => c.est === e.id && c.estadoDoc!=="Anulado"); if(!d)return;
  const doc = pdfNew(); let y = pdfHeader(doc, "CONSTANCIA DE CERTIFICACIÓN MODULAR");
  doc.setFontSize(10.5); doc.setTextColor(30); doc.setFont("helvetica","normal");
  const t = doc.splitTextToSize(`La Secretaría Académica del ${DB.cfg.nombre} hace constar que ${e.nom}, identificado(a) con DNI N.º ${e.dni}, estudiante del programa de estudios ${prog(e.prog).nombre}, registra las siguientes certificaciones modulares:`, 182);
  doc.text(t, 14, y + 2); y += t.length * 5.5 + 6;
  y = pdfTable(doc, y, ["Módulo formativo","N.º de certificado","Fecha"], cs.map(c => { const m = byId(DB.modulos,c.mod); return [`${m.cod} · ${m.nombre}`, c.num, fd(c.fecha)] }));
  doc.setFontSize(10.5); doc.setTextColor(30); doc.text("Se expide la presente a solicitud del interesado para los fines que estime conveniente.", 14, y + 10);
  doc.text(`${DB.cfg.direccion}, ${new Date().toLocaleDateString("es-PE",{day:"numeric",month:"long",year:"numeric"})}`, 196, y + 20, {align:"right"});
  pdfVerify(doc, d, y + 30); pdfFooter(doc);
  saveFile(`constancia_certificacion_${e.dni}.pdf`, doc.output("blob"));
}
V.certificados = () => {
  const L = lvl("certificados"), r = R();
  const intro = head("1.2 · Gestión académica","Certificación modular","Registro de certificaciones e historial académico con maestros compartidos y documentos verificables.");
  if(L >= 2){
    const T = tabs("certificados", [["consulta","Consulta"],["certs","Certificaciones", DB.certs.length],["notas","Historial académico"],["reportes","Reportes"]]);
    let body = "";
    if(T.cur === "consulta") body = consultaCert(false);
    if(T.cur === "certs") body = crud("certs", {addLabel:"Registrar certificación", sub:`Los estudiantes se toman del <a href="#/admin/ix-alumnos">Maestro de alumnos</a>.`});
    if(T.cur === "notas") body = crud("notas", {addLabel:"Registrar nota"});
    if(T.cur === "reportes"){
      const year = today().slice(0,4);
      body = `<div class="kpis"><div class="kpi"><b>${DB.certs.length}</b><span>Certificaciones registradas</span></div><div class="kpi"><b>${cnt(DB.certs, c => c.fecha.startsWith(year))}</b><span>Emitidas en ${year}</span></div><div class="kpi"><b>${cnt(DB.docs, d => d.tipo === "cert")}</b><span>Constancias con código emitidas</span></div><div class="kpi"><b>${cnt(DB.estudiantes, e => DB.modulos.filter(m => m.prog === e.prog).length && DB.modulos.filter(m => m.prog === e.prog).every(m => DB.certs.some(c => c.est === e.id && c.mod === m.id)))}</b><span>Estudiantes con todos los módulos</span></div></div>
      <div class="grid2"><section class="panel"><div class="panel-h"><h2>Certificaciones por programa</h2><button class="btn sec sm" data-act="repCertXLS">Excel</button></div>${bars(DB.programas.map(p => [p.nombre, cnt(DB.certs, c => est(c.est).prog === p.id)]))}</section>
      <section class="panel"><h2>Certificaciones por módulo</h2>${bars(DB.modulos.map(m => [`${prog(m.prog).cod}-${m.cod} · ${m.nombre}`, cnt(DB.certs, c => c.mod === m.id)]), true)}</section></div>`;
    }
    return intro + T.html + body;
  }
  if(r === "est" || r === "egr"){ const e = myEst(); return intro + (e ? fichaEst(e) : empty("Cuenta sin estudiante vinculado.")) }
  return intro + consultaCert(false);
};

V.alumnos = () => {
  const intro = head("1.0 · Gestión académica","Maestro de alumnos","Registro único de alumnos del instituto. De aquí se alimentan las cuentas de la intranet, la certificación modular, los grados y títulos, la bolsa laboral, los horarios y los trámites de mesa de partes.");
  const sin = DB.estudiantes.filter(e => !estUser(e)).length;
  const kp = `<div class="kpis"><div class="kpi"><b>${DB.estudiantes.length}</b><span>Alumnos registrados</span></div><div class="kpi"><b>${cnt(DB.estudiantes, e => e.estado === "Regular")}</b><span>Regulares</span></div><div class="kpi"><b>${cnt(DB.estudiantes, e => ["Egresado","Titulado"].includes(e.estado))}</b><span>Egresados y titulados</span></div><div class="kpi ${sin ? "alert-k" : ""}"><b>${sin}</b><span>Sin acceso a la intranet</span></div></div>`;
  return intro + kp + crud("estudiantes", {addLabel:"Registrar alumno", sub:"Use “Crear acceso” para generar su cuenta de la intranet (usuario = DNI).", note:"El alumno es la entidad central: certificaciones, títulos, postulaciones y trámites se relacionan con él por su DNI, sin duplicar datos. Una cuenta de estudiante o egresado creada en Usuarios y roles se vincula automáticamente si su usuario o DNI coincide con el de un alumno."});
};

/* ---------- 1.3 grados y títulos ---------- */
function consultaTitulo(pub){
  const q = S.ui.tq || ""; const ql = q.trim().toLowerCase();
  const res = ql.length >= 3 ? DB.titulos.filter(t => { const e = est(t.est); return e.dni === ql || e.nom.toLowerCase().includes(ql) }) : [];
  return `<section class="panel"><div><h2>Consulta de títulos emitidos</h2><p class="note">Verifique si una persona cuenta con título registrado por el ${esc(DB.cfg.siglas)}.</p></div>
    <form class="f" data-form="tq"><div class="fld"><label for="tq">DNI o apellidos</label><input id="tq" name="tq" value="${esc(q)}" placeholder="Ej.: 72458369 o Yupanqui"></div><div class="fld" style="align-self:end"><button class="btn">Consultar</button></div></form>
    ${!q ? `<p class="note">Busque por DNI o nombre de un egresado registrado.</p>` : ""}</section>
    ${q ? (res.length ? res.map(t => fichaTitulo(t, pub)).join("") : `<div class="alert warn">No existe registro de título emitido por el ${esc(DB.cfg.siglas)} para “${esc(q)}”.</div>`) : ""}`;
}
function fichaTitulo(t, pub){
  const e = est(t.est);
  return `<section class="ficha"><div class="panel-h"><div><h2>${esc(e.nom)}</h2><span class="note">DNI ${e.dni}</span></div>${pill("Titulado","p-ok")}</div>
  <dl class="dl"><dt>Programa de estudios</dt><dd>${esc(prog(e.prog).nombre)}</dd><dt>Fecha de culminación</dt><dd>${fd(t.culm)}</dd><dt>Fecha de titulación</dt><dd>${fd(t.tit)}</dd><dt>Código de título</dt><dd class="mono">${esc(t.cod)}</dd><dt>Resolución</dt><dd>${esc(t.resol)}</dd></dl>
  <div class="btnrow"><button class="btn sm" data-act="docTit" data-id="${t.id}">Reporte de validación</button></div></section>`;
}
function docTit(id){
  if(byId(DB.titulos,id)?.estadoDoc==="Anulado"){toast("El título está anulado.");return;}
  const t = byId(DB.titulos,id), e = est(t.est), d = emitDoc("titulo", t.id, e.nom); if(!d)return;
  openModal({title:"Reporte de validación de título", wide:true, body:`<div class="paper">${paperHead()}<h2>REPORTE DE VALIDACIÓN DE TÍTULO</h2>
    <p>El ${esc(DB.cfg.nombre)} certifica que la persona indicada cuenta con registro de título emitido por la institución:</p>
    <dl class="dl"><dt>Titulado(a)</dt><dd>${esc(e.nom)}</dd><dt>DNI</dt><dd>${e.dni}</dd><dt>Programa de estudios</dt><dd>${esc(prog(e.prog).nombre)}</dd><dt>Condición</dt><dd>Titulado(a)</dd><dt>Fecha de culminación</dt><dd>${fd(t.culm)}</dd><dt>Fecha de titulación</dt><dd>${fd(t.tit)}</dd><dt>Código institucional</dt><dd>${esc(t.cod)}</dd><dt>Resolución</dt><dd>${esc(t.resol)}</dd><dt>Fecha de registro</dt><dd>${fd(t.tit)}</dd></dl>${paperFoot(d)}</div>`,
    foot:`<button type="button" class="btn" data-act="pdfTit" data-id="${t.id}">Descargar PDF</button>`});
}
function pdfTit(id){
  if(byId(DB.titulos,id)?.estadoDoc==="Anulado"){toast("El título está anulado.");return;}
  if(!libsOk("pdf")) return; const t = byId(DB.titulos,id), e = est(t.est), d = emitDoc("titulo", t.id, e.nom); if(!d)return;
  const doc = pdfNew(); let y = pdfHeader(doc, "REPORTE DE VALIDACIÓN DE TÍTULO");
  doc.setFontSize(10.5); doc.setTextColor(30); doc.setFont("helvetica","normal");
  const tx = doc.splitTextToSize(`El ${DB.cfg.nombre} certifica que la persona indicada cuenta con registro de título emitido por la institución:`, 182); doc.text(tx, 14, y + 2); y += tx.length * 5.5 + 8;
  y = pdfKV(doc, y, [["Titulado(a)",e.nom],["DNI",e.dni],["Programa de estudios",prog(e.prog).nombre],["Condición","Titulado(a)"],["Fecha de culminación",fd(t.culm)],["Fecha de titulación",fd(t.tit)],["Código institucional",t.cod],["Resolución",t.resol]]);
  pdfVerify(doc, d, y + 8); pdfFooter(doc);
  saveFile(`validacion_titulo_${e.dni}.pdf`, doc.output("blob"));
}
V.titulos = () => {
  const L = lvl("titulos"), r = R();
  const intro = head("1.3 · Gestión académica","Grados y títulos","Registro digital de titulados vinculado al estudiante, consulta por DNI o nombres y reporte de validación con código QR verificable.");
  if(L >= 2){
    const T = tabs("titulos", [["registro","Registro de titulados", DB.titulos.length],["consulta","Consulta y validación"]]);
    return intro + T.html + (T.cur === "registro" ? crud("titulos", {addLabel:"Registrar título", note:"Al registrar un título, el estado del estudiante cambia a “Titulado” y se le notifica.", extra:t => `<button class="btn sec sm" data-act="docTit" data-id="${t.id}">Validación</button>`}) : consultaTitulo(false));
  }
  if(r === "egr" || r === "est"){ const e = myEst(); const t = e && DB.titulos.find(x => x.est === e.id);
    return intro + (t ? fichaTitulo(t) : `<section class="panel"><h2>Mi título</h2>${empty(`Aún no tiene un título registrado. Si ya presentó su expediente de titulación, puede seguirlo en <button class="btn ghost sm" data-go="mesa">Mesa de partes</button>.`)}</section>`) }
  return intro + consultaTitulo(false) + crud("titulos",{edit:false,add:false});
};

/* ---------- 2.1 libro de reclamaciones ---------- */
function formReclamo(pub){
  const u = S.user, e = myEst();
  const pre = u ? {nom:u.nom, dni:(u.dni || "").slice(0,8), correo:e ? e.correo : "", tel:e ? e.tel : ""} : {};
  const fields = RECF();
  return `<section class="panel"><div><h2>Hoja de reclamación virtual</h2><p class="note">Registre un <b>reclamo</b> (disconformidad con el servicio) o una <b>queja</b> (malestar por la atención). Recibirá un número y la institución responderá en un plazo de ${DB.cfg.plazoReclamo} días hábiles.</p></div>
  <form class="f" data-form="reclamo" novalidate>${fields.map(f => fieldHtml(f, pre[f.k])).join("")}
  <div class="fld wide"><label class="switch"><input type="checkbox" id="rAcepto" required> Declaro que la información es verdadera y autorizo el tratamiento de mis datos personales para atender esta solicitud.</label></div>
  <div class="fld"><button class="btn" type="submit">Registrar ${pub ? "reclamo" : "reclamo o queja"}</button></div></form></section><div id="recOut"></div>`;
}
const RECF = () => [
  {k:"tipo",l:"Tipo",t:"select",req:true,opts:() => [["Reclamo","Reclamo"],["Queja","Queja"]]},
  {k:"nom",l:"Apellidos y nombres",req:true,w:1},
  {k:"dni",l:"DNI / CE",req:true,pat:[/^\d{8,9}$/,"Ingrese 8 o 9 dígitos."]},
  {k:"tel",l:"Celular",req:true,pat:PAT_TEL},
  {k:"correo",l:"Correo electrónico",t:"email",req:true,pat:PAT_MAIL},
  {k:"dom",l:"Domicilio",w:1},
  {k:"area",l:"Área relacionada",t:"select",req:true,opts:() => DB.areas.filter(a => a.activo).map(a => [a.cod,a.nombre])},
  {k:"hecho",l:"Fecha del hecho",t:"date",req:true,max:today(),def:today},
  {k:"desc",l:"Descripción del hecho",t:"textarea",req:true,w:1,rows:3},
  {k:"pedido",l:"Pedido del usuario",t:"textarea",req:true,w:1,rows:2},
  {k:"adj",l:"Evidencias (PDF, JPG o PNG, hasta 5 MB)",t:"file",multiple:true,accept:".pdf,.jpg,.jpeg,.png",maxMB:5,w:1}];
function gestionReclamo(id){
  const x = byId(DB.reclamos,id), p = plazoRec(x);
  const fields = [
    {k:"resp",l:"Responsable asignado",t:"select",none:"Sin asignar",opts:() => [...new Set(DB.areas.map(a => a.resp))].map(n => [n,n])},
    {k:"area",l:"Área",t:"select",req:true,opts:() => DB.areas.map(a => [a.cod,a.nombre])},
    {k:"respuesta",l:"Respuesta al usuario",t:"textarea",w:1,rows:4,hint:"Al registrar la respuesta, el reclamo pasa a “Respondido” y se notifica al correo del usuario."}];
  openModal({title:`Reclamo ${x.num}`, wide:true, body:`<div class="grid2"><dl class="dl"><dt>Tipo</dt><dd>${x.tipo}</dd><dt>Usuario</dt><dd>${esc(x.nom)}</dd><dt>DNI</dt><dd>${x.dni}</dd><dt>Contacto</dt><dd>${esc(x.tel)} · ${esc(x.correo)}</dd><dt>Registrado</dt><dd>${fd(x.fecha)}</dd><dt>Plazo de respuesta</dt><dd>${fd(p.due)} ${semaforo(x.estado,p.due,p.left)}</dd><dt>Estado</dt><dd>${estPill(x.estado)}</dd></dl>
    <div class="stack" style="gap:8px"><div><b>Descripción del hecho</b><p>${esc(x.desc)}</p></div><div><b>Pedido</b><p>${esc(x.pedido)}</p></div>${x.adj.length ? `<div><b>Evidencias</b><div class="chips">${x.adj.map(a => `<span class="chip">📎 ${esc(a.n)} · ${kb(a.s)}</span>`).join("")}</div></div>` : ""}</div></div>
    ${x.estado === "Respondido" ? `<div class="alert ok"><b>Respondido el ${fd(x.fresp)}:</b> ${esc(x.respuesta)}</div>` : `<div class="f">${fields.map(f => fieldHtml(f, x[f.k])).join("")}</div>`}`,
    foot:`<button type="button" class="btn sec" data-act="docRec" data-id="${x.id}" style="margin-right:auto">Hoja de reclamación</button>`,
    submit:x.estado === "Respondido" ? null : "Guardar",
    onSubmit:x.estado === "Respondido" ? null : form => {
      const {vals, errs} = readFields(fields, form); if(!showErrs(form, errs)) return false;
      const prev = x.estado; x.resp = vals.resp; x.area = vals.area;
      if(vals.respuesta){ x.respuesta = vals.respuesta; x.estado = "Respondido"; x.fresp = today(); log("Responder","Reclamos",x.num); toast(`Respuesta registrada. Se notificó a ${x.correo}.`); const u = HOST.users().find(z => z.dni === x.dni); if(u) notify("u:"+u.id, `Tu ${x.tipo.toLowerCase()} ${x.num} fue respondido`, "reclamos") }
      else { if(x.resp && prev === "Recibido") x.estado = "En atención"; log("Asignar","Reclamos",`${x.num} → ${x.resp || "sin responsable"}`); toast("Reclamo actualizado.") }
      if(!save())return false; return true; }});
}
function docRec(id){
  const x = byId(DB.reclamos,id), d = emitDoc("reclamo", x.id, x.nom); if(!d)return;
  openModal({title:"Hoja de reclamación", wide:true, body:`<div class="paper">${paperHead()}<h2>HOJA DE RECLAMACIÓN N.º ${esc(x.num)}</h2>
    <dl class="dl"><dt>Tipo</dt><dd>${x.tipo}</dd><dt>Fecha de registro</dt><dd>${fd(x.fecha)}</dd><dt>Usuario</dt><dd>${esc(x.nom)} · DNI ${x.dni}</dd><dt>Domicilio</dt><dd>${esc(x.dom||"—")}</dd><dt>Contacto</dt><dd>${esc(x.tel)} · ${esc(x.correo)}</dd><dt>Área relacionada</dt><dd>${esc(areaN(x.area))}</dd><dt>Fecha del hecho</dt><dd>${fd(x.hecho)}</dd><dt>Descripción</dt><dd>${esc(x.desc)}</dd><dt>Pedido</dt><dd>${esc(x.pedido)}</dd><dt>Estado</dt><dd>${x.estado}</dd>${x.respuesta ? `<dt>Respuesta (${fd(x.fresp)})</dt><dd>${esc(x.respuesta)}</dd>` : `<dt>Plazo de respuesta</dt><dd>${fd(plazoRec(x).due)}</dd>`}</dl>${paperFoot(d)}</div>`,
    foot:`<button type="button" class="btn" data-act="pdfRec" data-id="${x.id}">Descargar PDF</button>`});
}
function pdfRec(id){
  if(!libsOk("pdf")) return; const x = byId(DB.reclamos,id), d = emitDoc("reclamo", x.id, x.nom); if(!d)return;
  const doc = pdfNew(); let y = pdfHeader(doc, `HOJA DE RECLAMACIÓN N.º ${x.num}`, `${x.tipo} ${x.tipo === "Queja" ? "registrada" : "registrado"} el ${fd(x.fecha)}`);
  y = pdfKV(doc, y + 2, [["Usuario",x.nom],["DNI",x.dni],["Domicilio",x.dom||"—"],["Contacto",`${x.tel} · ${x.correo}`],["Área relacionada",areaN(x.area)],["Fecha del hecho",fd(x.hecho)],["Descripción",x.desc],["Pedido",x.pedido],["Estado",x.estado],...(x.respuesta ? [["Respuesta",`${x.respuesta} (${fd(x.fresp)})`]] : [["Plazo de respuesta",fd(plazoRec(x).due)]])]);
  pdfVerify(doc, d, y + 6); pdfFooter(doc); saveFile(`hoja_reclamacion_${x.num}.pdf`, doc.output("blob"));
}
V.reclamos = () => {
  const L = lvl("reclamos");
  const intro = head("2.1 · Gestión administrativa","Libro de reclamaciones virtual","Formulario digital para el usuario y bandeja institucional para asignar responsable, dar seguimiento, registrar la respuesta y controlar los plazos.");
  if(L >= 2){
    const pend = cnt(DB.reclamos, x => x.estado !== "Respondido");
    const T = tabs("reclamos", [["bandeja","Bandeja", pend || ""],["nuevo","Registrar reclamo"],["reportes","Reportes"]]);
    if(T.cur === "nuevo") return intro + T.html + formReclamo(false);
    if(T.cur === "reportes"){
      const m = {}; DB.reclamos.forEach(x => { const k = x.fecha.slice(0,7); m[k] = (m[k]||0) + 1 });
      return intro + T.html + `<div class="kpis">${["Recibido","En atención","Respondido"].map(e => `<div class="kpi"><b>${cnt(DB.reclamos, x => x.estado === e)}</b><span>${e}</span></div>`).join("")}<div class="kpi"><b>${cnt(DB.reclamos, x => x.estado !== "Respondido" && plazoRec(x).left < 0)}</b><span>Fuera de plazo</span></div><div class="kpi"><b>${DB.reclamos.length}</b><span>Total ${today().slice(0,4)}</span></div></div>
      <div class="grid2"><section class="panel"><div class="panel-h"><h2>Por área</h2><button class="btn sec sm" data-act="repRecXLS">Excel</button></div>${bars(DB.areas.map(a => [a.nombre, cnt(DB.reclamos, x => x.area === a.cod)]))}</section><section class="panel"><h2>Por tipo</h2>${bars([["Reclamos",cnt(DB.reclamos,x => x.tipo === "Reclamo")],["Quejas",cnt(DB.reclamos,x => x.tipo === "Queja")]], true)}</section></div>`;
    }
    const f = S.ui.recF || "pend";
    let rows = [...DB.reclamos].sort((a,b) => b.fecha.localeCompare(a.fecha)); if(f === "pend") rows = rows.filter(x => x.estado !== "Respondido"); if(f === "resp") rows = rows.filter(x => x.estado === "Respondido");
    return intro + T.html + `<section class="panel"><div class="panel-h"><h2>Reclamos y quejas</h2><div class="tools"><select class="inp" style="width:auto" data-chg="recF" aria-label="Filtrar por estado"><option value="pend" ${f === "pend" ? "selected" : ""}>Pendientes</option><option value="resp" ${f === "resp" ? "selected" : ""}>Respondidos</option><option value="all" ${f === "all" ? "selected" : ""}>Todos</option></select><button class="btn sec sm" data-act="repRecXLS">Excel</button></div></div>
    <div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Usuario</th><th>Tipo</th><th>Área</th><th>Detalle</th><th>Responsable</th><th>Plazo</th><th>Estado</th><th></th></tr></thead><tbody>
    ${rows.map(x => { const p = plazoRec(x); return `<tr><td>${mono(x.num)}</td><td>${fd(x.fecha)}</td><td>${esc(x.nom)}<br><span class="note mono">${x.dni}</span></td><td>${x.tipo}</td><td>${esc(x.area)}</td><td style="min-width:220px">${esc(x.desc)}</td><td>${x.resp ? esc(shortName(x.resp)) : pill("Sin asignar","p-warn")}</td><td>${semaforo(x.estado,p.due,p.left)}</td><td>${estPill(x.estado)}</td><td class="act"><button class="btn sm" data-act="gesRec" data-id="${x.id}">${x.estado === "Respondido" ? "Ver" : "Gestionar"}</button></td></tr>` }).join("") || `<tr><td colspan="10">${empty("No hay reclamos en esta vista.")}</td></tr>`}
    </tbody></table></div></section>`;
  }
  const dni = S.user.dni; const mine = DB.reclamos.filter(x => x.dni === dni);
  const T = tabs("reclamos", [["nuevo","Registrar reclamo"],["mios","Mis reclamos", mine.length || ""]]);
  if(T.cur === "nuevo") return intro + T.html + formReclamo(false);
  return intro + T.html + `<section class="panel"><h2>Mis reclamos y quejas</h2>${mine.length ? `<div class="tw"><table><thead><tr><th>N.º</th><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th>Respuesta</th><th></th></tr></thead><tbody>${mine.map(x => `<tr><td>${mono(x.num)}</td><td>${fd(x.fecha)}</td><td>${x.tipo}</td><td>${esc(x.desc)}</td><td>${estPill(x.estado)}</td><td>${esc(x.respuesta || "Pendiente")}</td><td class="act"><button class="btn sec sm" data-act="docRec" data-id="${x.id}">Hoja</button></td></tr>`).join("")}</tbody></table></div>` : empty("No ha registrado reclamos.")}</section>`;
};

/* ---------- 2.2 mesa de partes / trámite documentario ---------- */
const EXPF = () => [
  {k:"sol",l:"Apellidos y nombres / Razón social",req:true,w:1},
  {k:"dni",l:"DNI / RUC",req:true,pat:[/^(\d{8}|\d{11})$/,"Ingrese DNI (8 dígitos) o RUC (11 dígitos)."]},
  {k:"tel",l:"Celular",req:true,pat:PAT_TEL},
  {k:"correo",l:"Correo electrónico",t:"email",req:true,pat:PAT_MAIL,hint:"Aquí recibirá el cargo y las notificaciones."},
  {k:"tipoDoc",l:"Tipo de documento",t:"select",req:true,opts:() => ["Solicitud","Oficio","Informe","Requerimiento","Carta","Otro"].map(x => [x,x])},
  {k:"tramite",l:"Tipo de trámite",t:"select",req:true,num:true,opts:() => DB.tramites.map(t => [t.id, `${t.nombre} (${t.dias} días hábiles)`])},
  {k:"asunto",l:"Asunto",req:true,w:1},
  {k:"desc",l:"Descripción",t:"textarea",w:1,rows:3},
  {k:"adj",l:`Archivos adjuntos (PDF, hasta ${DB.cfg.maxAdjuntoMB} MB c/u)`,t:"file",req:true,multiple:true,accept:".pdf",maxMB:DB.cfg.maxAdjuntoMB,w:1}];
function formExpediente(pub){
  const u = S.user, e = myEst();
  const pre = u ? {sol:u.nom, dni:u.dni, correo:e ? e.correo : (myEmp() ? myEmp().correo : ""), tel:e ? e.tel : ""} : {};
  return `<section class="panel"><div><h2>Presentar documento</h2><p class="note">Horario de recepción: ${esc(DB.cfg.horarioAtencion)}. Los documentos enviados fuera de ese horario se consideran recibidos el siguiente día hábil.</p></div>
  <form class="f" data-form="exp" novalidate>${EXPF().map(f => fieldHtml(f, pre[f.k])).join("")}
  <div class="fld wide"><label class="switch"><input type="checkbox" id="eAcepto"> Acepto ser notificado(a) por correo electrónico.</label><span class="err" id="eAceptoErr"></span></div>
  <div class="fld"><button class="btn" type="submit">Enviar documento</button></div></form></section>`;
}
function cargoHtml(x, d){
  return `<div class="paper">${paperHead()}<h2>CARGO DE RECEPCIÓN</h2>
  <dl class="dl"><dt>N.º de expediente</dt><dd class="mono">${x.num}</dd><dt>Código de seguimiento</dt><dd class="mono" style="font-size:1.1rem">${x.cod}</dd><dt>Fecha y hora</dt><dd>${fd(x.fecha)}</dd><dt>Solicitante</dt><dd>${esc(x.sol)} · ${x.dni}</dd><dt>Tipo de documento</dt><dd>${x.tipoDoc}</dd><dt>Trámite</dt><dd>${esc(tram(x.tramite).nombre)}</dd><dt>Asunto</dt><dd>${esc(x.asunto)}</dd><dt>Adjuntos</dt><dd>${x.adj.map(a => `${esc(a.n)} (${kb(a.s)})`).join(", ")}</dd><dt>Plazo estimado</dt><dd>${tram(x.tramite).dias} días hábiles · hasta ${fd(plazoExp(x).due)}</dd></dl>
  <p class="note" style="color:var(--paper-muted)">Use el código de seguimiento en “Seguimiento de trámite” para consultar el estado de su expediente.</p>${paperFoot(d)}</div>`;
}
function docCargo(id){ const x = byId(HOST.exps(),id), d = emitDoc("cargo", x.id, x.sol); if(!d)return; openModal({title:"Cargo de recepción", wide:true, body:cargoHtml(x,d), foot:`<button type="button" class="btn" data-act="pdfCargo" data-id="${x.id}">Descargar PDF</button>`}) }
function pdfCargo(id){
  if(!libsOk("pdf")) return; const x = byId(HOST.exps(),id), d = emitDoc("cargo", x.id, x.sol); if(!d)return;
  const doc = pdfNew(); let y = pdfHeader(doc, "CARGO DE RECEPCIÓN", `Mesa de partes virtual · ${x.num}`);
  y = pdfKV(doc, y + 2, [["N.º de expediente",x.num],["Código de seguimiento",x.cod],["Fecha y hora",fd(x.fecha)],["Solicitante",`${x.sol} · ${x.dni}`],["Tipo de documento",x.tipoDoc],["Trámite",tram(x.tramite).nombre],["Asunto",x.asunto],["Adjuntos",x.adj.map(a => a.n).join(", ")],["Plazo estimado",`${tram(x.tramite).dias} días hábiles · hasta ${fd(plazoExp(x).due)}`]]);
  pdfVerify(doc, d, y + 6); pdfFooter(doc); saveFile(`cargo_${x.num}.pdf`, doc.output("blob"));
}
function timeline(x){ return `<div class="timeline">${x.hist.map(h => `<div><small>${fd(h[0])} · ${esc(areaN(h[2]))}</small><br><b>${esc(h[1])}</b> · ${esc(h[3])}</div>`).join("")}</div>` }
function seguimiento(){
  const q = (S.ui.mq || "").trim().toUpperCase();
  const x = q ? HOST.exps().find(e => e.cod === q || e.num === q) : null;
  return `<section class="panel"><div><h2>Seguimiento de trámite</h2><p class="note">Ingrese el código de seguimiento o el número de expediente que figura en su cargo.</p></div>
  <form class="f" data-form="mq"><div class="fld"><label for="mq">Código o N.º de expediente</label><input id="mq" name="mq" value="${esc(S.ui.mq||"")}" placeholder="Ej.: PX7K-29QD"></div><div class="fld" style="align-self:end"><button class="btn">Consultar</button></div></form>
  ${!q ? `<p class="note">Ingrese los datos de su cargo de recepción.</p>` : ""}</section>
  ${q ? (x ? `<section class="ficha"><div class="panel-h"><div><h2 class="mono">${x.num}</h2><span class="note">${esc(tram(x.tramite).nombre)}</span></div>${estPill(x.estado)}</div>
    <dl class="dl"><dt>Asunto</dt><dd>${esc(x.asunto)}</dd><dt>Presentado</dt><dd>${fd(x.fecha)}</dd><dt>Área actual</dt><dd>${esc(areaN(x.area))}</dd><dt>Plazo</dt><dd>${fd(plazoExp(x).due)} ${semaforo(x.estado, plazoExp(x).due, plazoExp(x).left)}</dd></dl><h3>Historial</h3>${timeline(x)}</section>` : `<div class="alert warn">No se encontró un expediente con “${esc(S.ui.mq)}”. Revise el código de su cargo.</div>`) : ""}`;
}
function gestionExp(id){
  const x = byId(HOST.exps(),id), p = plazoExp(x), closed = x.estado === "Cerrado";
  const fields = [
    {k:"accion",l:"Acción",t:"select",req:true,opts:() => [["Derivado","Derivar a otra área"],["En evaluación","Poner en evaluación"],["Observado","Observar (pedir subsanación)"],["Atendido","Marcar como atendido"],["Cerrado","Cerrar expediente"]]},
    {k:"area",l:"Área destino",t:"select",req:true,opts:() => DB.areas.filter(a => a.activo).map(a => [a.cod,a.nombre]),hint:`Área sugerida para este trámite: ${areaN(tram(x.tramite).area)}.`},
    {k:"obs",l:"Comentario o acción realizada",t:"textarea",req:true,w:1,rows:2}];
  openModal({title:`Expediente ${x.num}`, wide:true, body:`<div class="grid2"><dl class="dl"><dt>Solicitante</dt><dd>${esc(x.sol)} · ${x.dni}</dd><dt>Contacto</dt><dd>${esc(x.tel)} · ${esc(x.correo)}</dd><dt>Documento</dt><dd>${x.tipoDoc}</dd><dt>Trámite</dt><dd>${esc(tram(x.tramite).nombre)}</dd><dt>Asunto</dt><dd>${esc(x.asunto)}</dd><dt>Recibido</dt><dd>${fd(x.fecha)}</dd><dt>Área actual</dt><dd>${esc(areaN(x.area))}</dd><dt>Plazo</dt><dd>${fd(p.due)} ${semaforo(x.estado,p.due,p.left)}</dd><dt>Estado</dt><dd>${estPill(x.estado)}</dd></dl>
    <div class="stack" style="gap:8px">${x.desc ? `<div><b>Descripción</b><p>${esc(x.desc)}</p></div>` : ""}<div><b>Adjuntos</b><div class="chips">${x.adj.map(a => `<span class="chip">📎 ${esc(a.n)} · ${kb(a.s)}</span>`).join("") || "—"}</div></div><div><b>Historial</b>${timeline(x)}</div></div></div>
    ${closed ? `<div class="alert info">El expediente está cerrado.</div>` : `<h3>Registrar acción</h3><div class="f">${fields.map(f => fieldHtml(f, f.k === "area" ? (x.estado === "Recibido" ? tram(x.tramite).area : x.area) : f.k === "accion" ? (x.estado === "Recibido" ? "Derivado" : "") : "")).join("")}</div>`}`,
    foot:`<button type="button" class="btn sec" data-act="docCargo" data-id="${x.id}" style="margin-right:auto">Cargo de recepción</button>`,
    submit:closed ? null : "Registrar acción",
    onSubmit:closed ? null : form => {
      const {vals, errs} = readFields(fields, form); if(!showErrs(form, errs)) return false;
      x.estado = vals.accion; x.area = vals.area; x.hist.push([nowStamp(), vals.accion, vals.area, `${vals.obs} – ${shortName(S.user.nom)}`]);
      log(vals.accion === "Derivado" ? "Derivar" : "Actualizar","Mesa de partes",`${x.num} → ${vals.accion} (${vals.area})`);
      const u = HOST.users().find(z => z.dni === x.dni); if(u) notify("u:"+u.id, `Tu expediente ${x.num} cambió a “${vals.accion}”`, "mesa");
      if(vals.accion === "Derivado"){ const resp = HOST.users().filter(z => z.area === vals.area); resp.forEach(z => notify("u:"+z.id, `Se derivó a tu área el expediente ${x.num}`, "mesa")) }
      if(!save())return false; toast(`${x.num}: ${vals.accion.toLowerCase()}. Se notificó al solicitante por correo.`); return true; }});
}
V.mesaCfg = () => {
  if(lvl("config") < 2) return empty("No tiene acceso a este módulo.");
  return crud("areas") + crud("tramites", {note:"Estados del flujo: Recibido → Derivado → En evaluación → (Observado) → Atendido → Cerrado."});
};
V.mesa = () => {
  const L = lvl("mesa");
  const intro = head("2.2 · Gestión administrativa","Mesa de partes virtual y trámite documentario","Recepción digital con número de expediente y código de seguimiento automáticos, derivación entre áreas, control de plazos e historial completo de cada documento.");
  if(L >= 2){
    const T = tabs("mesa", [["bandeja","Bandeja"],["nuevo","Registrar documento"],["seguimiento","Seguimiento"],["config","Configuración"],["reportes","Reportes"]]);
    if(T.cur === "nuevo") return intro + T.html + formExpediente(false);
    if(T.cur === "seguimiento") return intro + T.html + seguimiento();
    if(T.cur === "config") return intro + T.html + crud("areas") + crud("tramites", {note:"Estados del flujo: Recibido → Derivado → En evaluación → (Observado) → Atendido → Cerrado."});
    if(T.cur === "reportes"){
      const done = HOST.exps().filter(x => ["Atendido","Cerrado"].includes(x.estado));
      const avg = done.length ? (done.reduce((a,x) => { const f = x.hist.find(h => h[1] === "Atendido") || x.hist[x.hist.length-1]; return a + Math.max(0, -bizLeftFrom(x.fecha, f[0])) }, 0) / done.length).toFixed(1) : "—";
      return intro + T.html + `<div class="kpis"><div class="kpi"><b>${HOST.exps().length}</b><span>Documentos recibidos</span></div><div class="kpi"><b>${cnt(HOST.exps(), x => !["Atendido","Cerrado"].includes(x.estado))}</b><span>En trámite</span></div><div class="kpi alert-k"><b>${cnt(HOST.exps(), x => !["Atendido","Cerrado"].includes(x.estado) && plazoExp(x).left < 0)}</b><span>Vencidos</span></div><div class="kpi"><b>${avg}</b><span>Días hábiles promedio de atención</span></div></div>
      <div class="grid2"><section class="panel"><div class="panel-h"><h2>Documentos por área</h2><button class="btn sec sm" data-act="repExpXLS">Excel</button></div>${bars(DB.areas.map(a => [a.nombre, cnt(HOST.exps(), x => x.area === a.cod)]))}</section><section class="panel"><h2>Por tipo de trámite</h2>${bars(DB.tramites.map(t => [t.nombre, cnt(HOST.exps(), x => x.tramite === t.id)]), true)}</section></div>`;
    }
    const allAreas = ["admin","dir"].includes(R()) || S.user.area === "MP";
    if(S.ui.mArea === undefined) S.ui.mArea = allAreas ? "" : (S.user.area || "");
    const fa = S.ui.mArea, fe = S.ui.mEst || "abiertos", q = (S.q.exp || "").toLowerCase();
    let rows = [...HOST.exps()].sort((a,b) => b.fecha.localeCompare(a.fecha));
    if(fa) rows = rows.filter(x => x.area === fa);
    if(fe === "abiertos") rows = rows.filter(x => !["Atendido","Cerrado"].includes(x.estado)); else if(fe !== "todos") rows = rows.filter(x => x.estado === fe);
    if(q) rows = rows.filter(x => [x.num,x.cod,x.sol,x.dni,x.asunto,tram(x.tramite).nombre].join(" ").toLowerCase().includes(q));
    S.last.exp = rows;
    return intro + T.html + `<section class="panel"><div class="panel-h"><h2>Expedientes</h2><div class="tools">
      <input class="search" type="search" id="q_exp" data-q="exp" placeholder="Buscar N.º, DNI, asunto…" value="${esc(S.q.exp||"")}" aria-label="Buscar expedientes">
      <select class="inp" style="width:auto" data-chg="mArea" aria-label="Área"><option value="">Todas las áreas</option>${DB.areas.map(a => `<option value="${a.cod}" ${a.cod === fa ? "selected" : ""}>${a.cod} · ${esc(a.nombre)}</option>`).join("")}</select>
      <select class="inp" style="width:auto" data-chg="mEst" aria-label="Estado">${[["abiertos","En trámite"],["todos","Todos"],["Recibido","Recibido"],["Derivado","Derivado"],["En evaluación","En evaluación"],["Observado","Observado"],["Atendido","Atendido"],["Cerrado","Cerrado"]].map(([v,l]) => `<option value="${v}" ${v === fe ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="btn sec sm" data-act="repExpXLS">Excel</button></div></div>
    <div class="tw"><table><thead><tr><th>Expediente</th><th>Recepción</th><th>Solicitante</th><th>Trámite / asunto</th><th>Área</th><th>Plazo</th><th>Estado</th><th></th></tr></thead><tbody>
    ${rows.map(x => { const p = plazoExp(x); return `<tr><td>${mono(x.num)}<br><span class="note mono">${x.cod}</span></td><td>${fd(x.fecha)}</td><td>${esc(x.sol)}<br><span class="note mono">${x.dni}</span></td><td><b>${esc(tram(x.tramite).nombre)}</b><br>${esc(x.asunto)}</td><td>${x.area}</td><td>${semaforo(x.estado,p.due,p.left)}</td><td>${estPill(x.estado)}</td><td class="act"><button class="btn sm" data-act="gesExp" data-id="${x.id}">${x.estado === "Cerrado" ? "Ver" : "Gestionar"}</button></td></tr>` }).join("") || `<tr><td colspan="8">${empty("No hay expedientes con estos filtros.")}</td></tr>`}
    </tbody></table></div><span class="count">${rows.length} expediente(s)</span></section>`;
  }
  const mine = HOST.exps().filter(x => x.dni === S.user.dni).sort((a,b) => b.fecha.localeCompare(a.fecha));
  const T = tabs("mesa", [["mios","Mis trámites", mine.length || ""],["nuevo","Presentar documento"],["seguimiento","Seguimiento"]]);
  if(T.cur === "nuevo") return intro + T.html + formExpediente(false);
  if(T.cur === "seguimiento") return intro + T.html + seguimiento();
  return intro + T.html + `<section class="panel"><div class="panel-h"><h2>Mis trámites</h2><button class="btn sm" data-tab="mesa:nuevo">+ Presentar documento</button></div>${mine.length ? `<div class="tw"><table><thead><tr><th>Expediente</th><th>Trámite</th><th>Presentado</th><th>Área actual</th><th>Estado</th><th></th></tr></thead><tbody>${mine.map(x => `<tr><td>${mono(x.num)}<br><span class="note mono">${x.cod}</span></td><td><b>${esc(tram(x.tramite).nombre)}</b><br>${esc(x.asunto)}</td><td>${fd(x.fecha)}</td><td>${esc(areaN(x.area))}</td><td>${estPill(x.estado)}</td><td class="act"><div class="btnrow" style="justify-content:flex-end"><button class="btn sec sm" data-act="verExp" data-id="${x.id}">Historial</button><button class="btn sec sm" data-act="docCargo" data-id="${x.id}">Cargo</button></div></td></tr>`).join("")}</tbody></table></div>` : empty("No tiene trámites registrados.", `<button class="btn sm" data-tab="mesa:nuevo">Presentar mi primer documento</button>`)}</section>`;
};
function bizLeftFrom(a, b){ const d1 = new Date(a.slice(0,10)+"T12:00:00"), d2 = new Date(b.slice(0,10)+"T12:00:00"); let n = 0; const d = new Date(d1); while(d < d2){ d.setDate(d.getDate()+1); const w = d.getDay(); if(w !== 0 && w !== 6) n++ } return -n }
/* =====================================================================
   VISTAS — bolsa laboral, docentes, usuarios, bitácora, configuración,
   estructura técnica y servicios públicos
   ===================================================================== */

/* ---------- 2.3 bolsa laboral ---------- */
const perfilLab = id => { let p = DB.perfilesLab.find(x => x.est === id); if(!p){ p = {est:id,resumen:"",competencias:[],exp:[],cv:null}; DB.perfilesLab.push(p) } return p };
function ofertaCard(o, mode){
  const e = empresa(o.emp), n = cnt(DB.postulaciones, p => p.of === o.id), vig = o.limite >= today();
  const me = myEst(); const ya = me && DB.postulaciones.find(p => p.of === o.id && p.est === me.id);
  return `<div class="ficha"><div class="panel-h"><h3>${esc(o.puesto)}</h3>${mode === "cand" ? (vig ? pill(`Cierra ${fd(o.limite)}`,"p-info") : pill("Cerrada","p-mut")) : estPill(o.estado)}</div>
  <span class="note">${esc(e.nom)} · ${esc(e.ubic||"")} · ${o.modal} · ${o.vac} vacante(s)</span>
  <p style="font-size:.88rem">${esc(o.desc)}</p><p class="note"><b>Requisitos:</b> ${esc(o.req)}</p>
  <div class="btnrow">${o.prog ? pill(prog(o.prog).cod,"p-brand") : pill("Todos los programas","p-mut")}
  ${mode === "cand" ? (ya ? pill("Postulaste · " + ya.estado,"p-ok") : vig ? `<button class="btn sm" data-act="postular" data-id="${o.id}">Postular</button>` : "") : ""}
  ${mode === "pub" ? `<button class="btn sec sm" data-act="toLogin">Ingresa para postular</button>` : ""}
  ${mode === "admin" && o.estado === "Por validar" ? `<button class="btn sm" data-act="valOf" data-id="${o.id}">Aprobar</button><button class="btn sec sm" data-act="rejOf" data-id="${o.id}">Rechazar</button>` : ""}
  ${mode !== "cand" && mode !== "pub" ? `<span class="note">${n} postulante(s)</span>` : ""}</div></div>`;
}
function verPerfilLab(estId){
  const e = est(estId), p = perfilLab(estId), cs = DB.certs.filter(c => c.est === e.id);
  openModal({title:"Perfil profesional", wide:true, body:`<div class="prof"><div class="avatar lg">${initials(e.nom)}</div><div><h2>${esc(e.nom)}</h2><span class="note">${esc(prog(e.prog).nombre)} · ${e.estado}</span><br><span class="note">${esc(e.correo||"")} · ${esc(e.tel||"")}</span></div></div>
  ${p.resumen ? `<p>${esc(p.resumen)}</p>` : ""}
  <div class="grid2"><div class="stack" style="gap:8px"><h3>Competencias</h3><div class="chips">${p.competencias.map(c => `<span class="chip">${esc(c)}</span>`).join("") || '<span class="note">—</span>'}</div><h3>Certificaciones modulares</h3><div class="chips">${cs.map(c => `<span class="chip m">${esc(byId(DB.modulos,c.mod).nombre)}</span>`).join("") || '<span class="note">—</span>'}</div></div>
  <div class="stack" style="gap:8px"><h3>Experiencia</h3>${p.exp.length ? `<div class="timeline">${p.exp.map(x => `<div>${esc(x)}</div>`).join("")}</div>` : '<span class="note">Sin experiencia registrada.</span>'}<h3>Currículo</h3>${p.cv ? `<span class="chip">📎 ${esc(p.cv.n)} · ${kb(p.cv.s)}</span>${p.cv.fileId ? `<a class="btn sm" href="${esc(p.cv.url)}&download=1" target="_blank" rel="noopener">Descargar CV</a>` : ""}` : '<span class="note">No adjuntó CV.</span>'}</div></div>`});
}
function editPerfilLab(){
  const e = myEst(), p = perfilLab(e.id);
  const fields = [
    {k:"correo",l:"Correo electrónico",t:"email",req:true,pat:PAT_MAIL},{k:"tel",l:"Celular",req:true,pat:PAT_TEL},
    {k:"resumen",l:"Resumen profesional",t:"textarea",w:1,rows:3},
    {k:"competencias",l:"Competencias (una por línea)",t:"textarea",lines:true,w:1,rows:3},
    {k:"exp",l:"Experiencia laboral (una por línea: año · cargo – empresa)",t:"textarea",lines:true,w:1,rows:3},
    {k:"cv",l:"Currículo vitae (PDF, hasta 5 MB)",t:"file",accept:".pdf",maxMB:5,w:1,hint:p.cv ? `Archivo actual: ${p.cv.n}. Suba otro para reemplazarlo.` : "Aún no ha subido su CV."}];
  openModal({title:"Editar mi perfil profesional", wide:true, body:`<div class="f">${fields.map(f => fieldHtml(f, f.k === "correo" || f.k === "tel" ? e[f.k] : p[f.k])).join("")}</div>`,
    onSubmit:form => { const {vals, errs} = readFields(fields, form); if(!showErrs(form, errs)) return false;
      e.correo = vals.correo; e.tel = vals.tel; p.resumen = vals.resumen; p.competencias = vals.competencias; p.exp = vals.exp; if(vals.cv.length) p.cv = vals.cv[0];
      log("Editar","Bolsa laboral","Perfil profesional " + e.dni); if(!save())return false; toast("Perfil profesional actualizado."); return true }});
}
V.bolsa = () => {
  const r = R(), L = lvl("bolsa");
  const intro = head("2.3 · Gestión administrativa","Bolsa laboral","Vincula estudiantes, egresados y empresas: perfiles profesionales, ofertas validadas por el instituto, postulación en línea e indicadores de empleabilidad.");
  if(r === "est" || r === "egr"){
    const e = myEst(); if(!e) return intro + empty("Cuenta sin estudiante vinculado.");
    const mine = DB.postulaciones.filter(p => p.est === e.id);
    const T = tabs("bolsa", [["ofertas","Ofertas disponibles"],["mias","Mis postulaciones", mine.length || ""],["perfil","Mi perfil profesional"]]);
    if(T.cur === "ofertas"){
      const solo = S.ui.bSolo !== false, q = (S.q.of || "").toLowerCase();
      let ofs = DB.ofertas.filter(o => o.estado === "Publicada" && empresa(o.emp).validada);
      if(solo) ofs = ofs.filter(o => !o.prog || o.prog === e.prog);
      if(q) ofs = ofs.filter(o => [o.puesto,o.desc,o.req,empresa(o.emp).nom].join(" ").toLowerCase().includes(q));
      ofs.sort((a,b) => (b.limite >= today()) - (a.limite >= today()) || a.limite.localeCompare(b.limite));
      return intro + T.html + `<section class="panel"><div class="panel-h"><h2>${ofs.length} oportunidad(es)</h2><div class="tools"><input class="search" type="search" id="q_of" data-q="of" placeholder="Buscar puesto o empresa…" value="${esc(S.q.of||"")}" aria-label="Buscar ofertas"><label class="switch"><input type="checkbox" data-chg="bSolo" ${solo ? "checked" : ""}> Solo de ${prog(e.prog).cod}</label></div></div>
      ${perfilLab(e.id).cv ? "" : `<div class="alert info">Para postular necesitas subir tu CV. <button class="btn sm" data-tab="bolsa:perfil">Completar mi perfil</button></div>`}
      ${ofs.length ? `<div class="grid3">${ofs.map(o => ofertaCard(o,"cand")).join("")}</div>` : empty("No hay ofertas con esos criterios.")}</section>`;
    }
    if(T.cur === "mias") return intro + T.html + `<section class="panel"><h2>Mis postulaciones</h2>${mine.length ? `<div class="tw"><table><thead><tr><th>Puesto</th><th>Empresa</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>${mine.map(p => { const o = byId(DB.ofertas,p.of); return `<tr><td>${esc(o.puesto)}</td><td>${esc(empresa(o.emp).nom)}</td><td>${fd(p.fecha)}</td><td>${estPill(p.estado)}</td><td class="act">${p.estado === "Recibida" ? `<button class="btn ghost sm" data-act="retirarPost" data-id="${p.id}">Retirar</button>` : ""}</td></tr>` }).join("")}</tbody></table></div>` : empty("Aún no postulas a ninguna oferta.")}</section>`;
    const p = perfilLab(e.id), cs = DB.certs.filter(c => c.est === e.id);
    return intro + T.html + `<div class="grid2"><section class="ficha"><div class="prof"><div class="avatar lg">${initials(e.nom)}</div><div><h2>${esc(e.nom)}</h2><span class="note">${esc(prog(e.prog).nombre)} · ${e.estado}</span></div></div>
      <dl class="dl"><dt>DNI</dt><dd>${e.dni}</dd><dt>Correo</dt><dd>${esc(e.correo||"—")}</dd><dt>Celular</dt><dd>${esc(e.tel||"—")}</dd><dt>Currículo</dt><dd>${p.cv ? `📎 ${esc(p.cv.n)}` : pill("Pendiente","p-warn")}</dd></dl>
      ${p.resumen ? `<p>${esc(p.resumen)}</p>` : ""}<button class="btn sm" data-act="editPerfilLab">Editar perfil y subir CV</button></section>
      <section class="ficha"><h3>Certificaciones (del módulo 1.2)</h3><div class="chips">${cs.map(c => `<span class="chip m">${esc(byId(DB.modulos,c.mod).cod)} · ${esc(byId(DB.modulos,c.mod).nombre)}</span>`).join("") || '<span class="note">Sin certificaciones.</span>'}</div>
      <h3>Competencias</h3><div class="chips">${p.competencias.map(c => `<span class="chip">${esc(c)}</span>`).join("") || '<span class="note">Agregue sus competencias.</span>'}</div>
      <h3>Experiencia</h3>${p.exp.length ? `<div class="timeline">${p.exp.map(x => `<div>${esc(x)}</div>`).join("")}</div>` : '<span class="note">Sin experiencia registrada.</span>'}</section></div>`;
  }
  if(r === "emp"){
    const e = myEmp(); if(!e) return intro + empty("Cuenta sin empresa vinculada.");
    const ofs = DB.ofertas.filter(o => o.emp === e.id), posts = DB.postulaciones.filter(p => ofs.some(o => o.id === p.of));
    const T = tabs("bolsa", [["ofertas","Mis ofertas", ofs.length],["post","Postulantes", posts.filter(p => p.estado === "Recibida").length || ""],["empresa","Datos de la empresa"]]);
    const warn = e.validada ? "" : `<div class="alert warn"><b>Empresa pendiente de validación.</b> Sus ofertas quedarán “Por validar” hasta que el instituto revise sus datos.</div>`;
    if(T.cur === "ofertas") return intro + T.html + warn + crud("ofertas", {rows:ofs, edit:true, add:true, title:"Mis ofertas laborales", addLabel:"Publicar oferta", note:"Las ofertas nuevas pasan por validación del instituto antes de mostrarse a estudiantes y egresados."});
    if(T.cur === "post") return intro + T.html + `<section class="panel"><h2>Postulantes a mis ofertas</h2>${posts.length ? `<div class="tw"><table><thead><tr><th>Postulante</th><th>Programa</th><th>Oferta</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>${posts.map(p => { const s = est(p.est), o = byId(DB.ofertas,p.of); return `<tr><td>${esc(s.nom)}<br><span class="note">${s.estado}</span></td><td>${prog(s.prog).cod}</td><td>${esc(o.puesto)}</td><td>${fd(p.fecha)}</td><td><select class="inp" style="width:auto" data-chg="postEst" data-id="${p.id}" aria-label="Estado de la postulación">${["Recibida","En revisión","Seleccionado","No seleccionado"].map(x => `<option ${x === p.estado ? "selected" : ""}>${x}</option>`).join("")}</select></td><td class="act"><button class="btn sec sm" data-act="verPerfilLab" data-id="${s.id}">Ver perfil y CV</button></td></tr>` }).join("")}</tbody></table></div>` : empty("Aún no recibe postulaciones.")}</section>`;
    return intro + T.html + warn + `<section class="panel"><h2>Datos de la empresa</h2><form class="f" data-form="empSelf" novalidate>${ENT.empresas.fields().filter(f => f.k !== "validada" && f.k !== "ruc").map(f => fieldHtml(f, e[f.k])).join("")}<div class="fld"><span class="lbl">RUC</span><b class="mono">${e.ruc}</b></div><div class="fld"><button class="btn" type="submit">Guardar cambios</button></div></form></section>`;
  }
  const admin = L >= 2;
  const T = tabs("bolsa", [["ofertas","Ofertas", cnt(DB.ofertas, o => o.estado === "Por validar") || ""],["empresas","Empresas", cnt(DB.empresas, e => !e.validada) || ""],["post","Postulaciones"],["stats","Indicadores"]]);
  if(T.cur === "ofertas") return intro + T.html + (admin ? crud("ofertas", {extra:o => o.estado === "Por validar" ? `<button class="btn sm" data-act="valOf" data-id="${o.id}">Aprobar</button><button class="btn sec sm" data-act="rejOf" data-id="${o.id}">Rechazar</button>` : ""}) : crud("ofertas",{edit:false,add:false}));
  if(T.cur === "empresas") return intro + T.html + crud("empresas", {edit:admin, add:admin, extra:e => !e.validada && admin ? `<button class="btn sm" data-act="valEmp" data-id="${e.id}">Validar</button>` : ""});
  if(T.cur === "post") return intro + T.html + `<section class="panel"><div class="panel-h"><h2>Postulaciones</h2><button class="btn sec sm" data-act="repPostXLS">Excel</button></div><div class="tw"><table><thead><tr><th>Postulante</th><th>Programa</th><th>Oferta</th><th>Empresa</th><th>Fecha</th><th>Estado</th><th></th></tr></thead><tbody>${DB.postulaciones.map(p => { const s = est(p.est), o = byId(DB.ofertas,p.of); return `<tr><td>${esc(s.nom)}</td><td>${prog(s.prog).cod}</td><td>${esc(o.puesto)}</td><td>${esc(empresa(o.emp).nom)}</td><td>${fd(p.fecha)}</td><td>${estPill(p.estado)}</td><td class="act"><button class="btn sec sm" data-act="verPerfilLab" data-id="${s.id}">Perfil</button></td></tr>` }).join("") || `<tr><td colspan="7">${empty("Sin postulaciones.")}</td></tr>`}</tbody></table></div></section>`;
  const egr = DB.estudiantes.filter(e => ["Egresado","Titulado"].includes(e.estado));
  const ins = cnt(DB.postulaciones, p => p.estado === "Seleccionado");
  return intro + T.html + `<div class="kpis"><div class="kpi"><b>${DB.ofertas.length}</b><span>Ofertas registradas</span></div><div class="kpi"><b>${DB.ofertas.reduce((a,o) => a + (o.estado === "Publicada" ? o.vac : 0), 0)}</b><span>Vacantes publicadas</span></div><div class="kpi"><b>${DB.postulaciones.length}</b><span>Postulaciones</span></div><div class="kpi"><b>${new Set(DB.postulaciones.map(p => p.est)).size}</b><span>Estudiantes y egresados participantes</span></div><div class="kpi"><b>${DB.empresas.length}</b><span>Empresas registradas</span></div><div class="kpi"><b>${ins}</b><span>Seleccionados (inserción)</span></div></div>
  <div class="grid2"><section class="panel"><h2>Ofertas por programa</h2>${bars([...DB.programas.map(p => [p.nombre, cnt(DB.ofertas, o => o.prog === p.id)]), ["Todos los programas", cnt(DB.ofertas, o => !o.prog)]])}</section>
  <section class="panel"><h2>Egresados con perfil profesional</h2>${bars([["Egresados y titulados", egr.length],["Con perfil y CV", cnt(egr, e => { const p = DB.perfilesLab.find(x => x.est === e.id); return p && p.cv })],["Postularon al menos una vez", cnt(egr, e => DB.postulaciones.some(p => p.est === e.id))]], true)}</section></div>`;
};
function ofertasPublicas(){
  const ofs = DB.ofertas.filter(o => o.estado === "Publicada" && empresa(o.emp).validada && o.limite >= today());
  return `<section class="panel"><div class="panel-h"><div><h2>Ofertas laborales vigentes</h2><span class="note">Estudiantes y egresados postulan desde la intranet. Las empresas pueden registrarse en “Registro de empresas”.</span></div></div>${ofs.length ? `<div class="grid3">${ofs.map(o => ofertaCard(o,"pub")).join("")}</div>` : empty("No hay ofertas vigentes.")}</section>`;
}
function registroEmpresa(){
  const crit = (window.pzBolsaCfg ? window.pzBolsaCfg() : {criterios:[], responsable:"Unidad de Bienestar y Empleabilidad", correo:""});
  return `<section class="panel"><div><h2>Registro de empresas e instituciones</h2><p class="note">El registro es libre y gratuito. La cuenta queda <b>pendiente de validación</b> hasta que la ${esc(crit.responsable)} verifique los datos; luego podrá publicar convocatorias.</p></div>
  <div class="alert info" style="margin:10px 0"><b>Criterios de validación</b><ul style="margin:6px 0 0;padding-left:18px">${crit.criterios.map(c => `<li>${esc(c)}</li>`).join("")}</ul><span class="note">Responsable de la aprobación: ${esc(crit.responsable)}${crit.correo ? ` · ${esc(crit.correo)}` : ""}</span></div>
  <form class="f" data-form="regEmp" novalidate>${EMP_REG_FIELDS().map(f => fieldHtml(f,"")).join("")}${fieldHtml({k:"pass",l:"Contraseña para la intranet",t:"password",req:true,pat:[/^.{12,}$/,"Mínimo 12 caracteres."]},"")}
  <div class="fld wide"><label style="display:flex;gap:8px;align-items:flex-start;font-weight:400"><input type="checkbox" id="empDecl"> <span>Declaro bajo juramento que la empresa se encuentra con RUC <b>activo y habido</b>, que los datos registrados son verídicos y que las ofertas que publique cumplirán la normativa laboral vigente.</span></label><span class="err" id="empDeclErr"></span></div>
  <div class="fld wide mpv-progress" data-company-progress role="status" hidden><span class="mpv-spinner" aria-hidden="true"></span><span>Registrando empresa, espera un momento. No cierres la página ni repitas el envío.</span></div>
  <div class="fld"><button class="btn" type="submit">Crear cuenta de empresa</button></div></form></section>`;
}
const rucValido = r => { r = String(r || ""); if(!/^(10|15|17|20)\d{9}$/.test(r)) return false; const w = [5,4,3,2,7,6,5,4,3,2]; const s = w.reduce((a, x, i) => a + x * +r[i], 0); let d = 11 - s % 11; if(d === 10) d = 0; if(d === 11) d = 1; return d === +r[10] };
const EMP_REG_FIELDS = () => [
  {k:"ruc",l:"RUC",req:true,uniq:true,pat:[/^(10|15|17|20)\d{9}$/, "El RUC debe tener 11 dígitos (empieza en 10, 15, 17 o 20)."]},
  {k:"nom",l:"Razón social",req:true,w:1},
  {k:"sector",l:"Sector económico",req:true},
  {k:"ubic",l:"Ubicación (distrito, provincia)",req:true},
  {k:"dir",l:"Dirección fiscal",req:true,w:1},
  {k:"contacto",l:"Persona de contacto",req:true},
  {k:"cargoC",l:"Cargo de la persona de contacto",req:true},
  {k:"correo",l:"Correo corporativo de contacto",t:"email",req:true,pat:PAT_MAIL},
  {k:"tel",l:"Teléfono / celular",req:true,pat:[/^\d{6,9}$/, "Ingrese un teléfono de 6 a 9 dígitos."]},
  {k:"web",l:"Página web o red social (opcional)"}];

/* ---------- 2.4 branding docente ---------- */
const perfilDoc = id => { let p = DB.perfilesDoc.find(x => x.doc === id); if(!p){ p = {doc:id,resumen:"",grados:[],certs:[],exp:[],cursos:[],port:[]}; DB.perfilesDoc.push(p) } return p };
function directorioDoc(pub){
  const q = (S.q.dir || "").toLowerCase();
  const list = DB.docentes.filter(d => !q || [d.nom, d.esp, ...d.uds.map(u => ud(u).nombre)].join(" ").toLowerCase().includes(q));
  return `<section class="panel"><div class="panel-h"><div><h2>Directorio docente</h2><span class="note">${DB.docentes.length} docentes · portafolio profesional institucional</span></div><input class="search" type="search" id="q_dir" data-q="dir" placeholder="Buscar por nombre, especialidad o curso…" value="${esc(S.q.dir||"")}" aria-label="Buscar docentes"></div>
  ${list.length ? `<div class="grid3">${list.map(d => { const p = perfilDoc(d.id); return `<button class="ficha cardbtn" data-act="openDoc" data-id="${d.id}"><div class="prof"><div class="avatar">${initials(d.nom)}</div><div><h3>${esc(d.nom)}</h3><span class="note">${esc(d.esp)}</span></div></div><span class="note">${esc(p.resumen || "Perfil en construcción.")}</span><div class="chips">${p.certs.length ? `<span class="chip m">${p.certs.length} certificación(es)</span>` : ""}${p.port.length ? `<span class="chip">${p.port.length} proyecto(s)</span>` : ""}<span class="chip">${d.cond}</span></div></button>` }).join("")}</div>` : empty("Ningún docente coincide con la búsqueda.")}</section>`;
}
function perfilDocHtml(id){
  const d = docente(id), p = perfilDoc(id), canEdit = lvl("docentes") >= 2 || (myDoc() && myDoc().id === id);
  const sec = (t, arr) => `<section class="panel"><h2>${t}</h2>${arr.length ? `<div class="timeline">${arr.map(x => `<div>${esc(x)}</div>`).join("")}</div>` : '<p class="note">Sin información registrada.</p>'}</section>`;
  return `<div class="btnrow"><button class="btn sec sm" data-act="closeDoc">← Directorio</button>${canEdit ? `<button class="btn sm" data-act="editDoc" data-id="${id}">Editar perfil</button>` : ""}</div>
  <section class="ficha"><div class="prof"><div class="avatar lg">${initials(d.nom)}</div><div><h1>${esc(d.nom)}</h1><span class="note">${esc(d.esp)} · Docente ${d.cond.toLowerCase()} · ${esc(DB.cfg.siglas)}</span><br><span class="note">${esc(d.correo||"")}</span></div></div>${p.resumen ? `<p>${esc(p.resumen)}</p>` : ""}
  <div class="chips">${d.uds.map(u => `<span class="chip">${esc(ud(u).nombre)}</span>`).join("")}</div></section>
  <div class="grid2"><div class="stack">${sec("Grados y estudios", p.grados)}${sec("Experiencia profesional", p.exp)}${sec("Capacitaciones y cursos", p.cursos)}</div>
  <div class="stack"><section class="panel"><h2>Certificaciones</h2><div class="chips">${p.certs.map(c => `<span class="chip m">${esc(c)}</span>`).join("") || '<p class="note">Sin certificaciones registradas.</p>'}</div>${(p.files||[]).length ? `<h3>Documentos adjuntos</h3><div class="chips">${p.files.map(f => `<span class="chip">📎 ${esc(f.n)}</span>`).join("")}</div>` : ""}</section>${sec("Portafolio: investigaciones, proyectos y publicaciones", p.port)}</div></div>`;
}
function editDoc(id){
  const d = docente(id), p = perfilDoc(id);
  const fields = [
    {k:"esp",l:"Especialidad",req:true},{k:"correo",l:"Correo institucional",t:"email",pat:PAT_MAIL},
    {k:"resumen",l:"Presentación profesional",t:"textarea",w:1,rows:3},
    {k:"grados",l:"Grados y estudios (uno por línea)",t:"textarea",lines:true,w:1},
    {k:"exp",l:"Experiencia profesional (una por línea)",t:"textarea",lines:true,w:1},
    {k:"certs",l:"Certificaciones (una por línea)",t:"textarea",lines:true,w:1},
    {k:"cursos",l:"Capacitaciones y cursos especializados (uno por línea)",t:"textarea",lines:true,w:1},
    {k:"port",l:"Investigaciones, proyectos y publicaciones (uno por línea)",t:"textarea",lines:true,w:1},
    {k:"files",l:"Adjuntar certificados o constancias (PDF)",t:"file",multiple:true,accept:".pdf",maxMB:5,w:1}];
  openModal({title:"Editar perfil docente", wide:true, body:`<div class="f">${fields.map(f => fieldHtml(f, f.k === "esp" || f.k === "correo" ? d[f.k] : f.k === "files" ? "" : p[f.k])).join("")}</div>`,
    onSubmit:form => { const {vals, errs} = readFields(fields, form); if(!showErrs(form, errs)) return false;
      d.esp = vals.esp; d.correo = vals.correo; ["resumen","grados","exp","certs","cursos","port"].forEach(k => p[k] = vals[k]); if(vals.files.length) p.files = [...(p.files||[]), ...vals.files];
      log("Editar","Branding docente",d.nom); if(!save())return false; toast("Perfil docente actualizado y publicado en el directorio."); return true }});
}
V.docentes = () => {
  const intro = head("2.4 · Gestión administrativa","Branding para docentes","Portafolio profesional de cada docente con estructura uniforme e identidad institucional, visible en la intranet y en el portal público.");
  if(S.ui.dsel) return perfilDocHtml(S.ui.dsel);
  if(lvl("docentes") >= 2){ const T = tabs("docentes", [["dir","Directorio"],["gest","Gestión de docentes"]]); return intro + T.html + (T.cur === "dir" ? directorioDoc() : crud("docentes")) }
  return intro + (myDoc() ? `<div class="alert info">Mantenga actualizado su portafolio: <button class="btn sm" data-act="openDoc" data-id="${myDoc().id}">Ver mi perfil</button></div>` : "") + directorioDoc();
};

/* ---------- usuarios y permisos ---------- */
/* ---------- usuarios y roles ---------- */
const ROL_INFO = {
  admin:["config","Control total: usuarios, permisos y configuración."], dir:["titulos","Supervisa todos los módulos y reportes."],
  acad:["certificados","Horarios, certificaciones y títulos."], adm:["mesa","Mesa de partes, reclamos y bolsa laboral."],
  doc:["docentes","Su horario, portafolio y trámites."], est:["horarios","Su horario, certificaciones y trámites."],
  egr:["titulos","Su título, certificaciones y bolsa laboral."], emp:["bolsa","Publica ofertas y revisa postulantes."] };
const PERM_L = ["Sin acceso","Consulta","Gestión"];
const ROL_SHORT = {admin:"Admin.", dir:"Directivo", acad:"R. académico", adm:"R. administr.", doc:"Docente", est:"Estudiante", egr:"Egresado", emp:"Empresa"};
const permLocked = (r,k) => k === "inicio" || (r === "admin" && ["usuarios","config"].includes(k));
V.usuarios = () => {
  const T = tabs("usuarios", [["cuentas","Cuentas", HOST.users().length],["permisos","Roles y permisos"]]);
  const intro = head("Sistema","Usuarios y permisos","Cree cuentas, asígneles un rol y decida qué puede ver o hacer cada rol. Los cambios se aplican de inmediato.");
  return intro + T.html + (T.cur === "cuentas" ? usrCuentas() : usrRoles());
};
function usrCuentas(){
  const can = lvl("usuarios") >= 2, fr = S.ui.uRol || "", fe = S.ui.uEst || "", q = (S.q.usuarios || "").toLowerCase();
  const act = HOST.users().filter(u => u.estado === "Activo").length;
  let rows = HOST.users().filter(u => (!fr || u.rol === fr) && (!fe || u.estado === fe) && (!q || [u.u, u.nom, ROLES[u.rol], u.dni || ""].join(" ").toLowerCase().includes(q)));
  S.last.usuarios = rows;
  const vin = u => { const o = vinOpts().find(x => x[0] === u.vin); return o ? o[1].replace(/^\w+ · /,"") : "" };
  const chip = (v, l, n) => `<button class="rchip ${fr === v ? "on" : ""}" data-act="uRol" data-id="${v}">${l}<b>${n}</b></button>`;
  return `<div class="kpis">
    <div class="kpi has-ico"><span class="kico">${ICO.usuarios}</span><b>${HOST.users().length}</b><span>Cuentas registradas</span></div>
    <div class="kpi has-ico"><span class="kico">${ICO.certificados}</span><b>${act}</b><span>Cuentas activas</span></div>
    <div class="kpi has-ico ${HOST.users().length - act ? "alert-k" : ""}"><span class="kico">${ICO.alerta}</span><b>${HOST.users().length - act}</b><span>Cuentas inactivas</span></div>
    <div class="kpi has-ico"><span class="kico">${ICO.config}</span><b>${Object.keys(ROLES).length}</b><span>Roles del sistema</span></div></div>
  <section class="panel"><div class="panel-h"><div><h2>Cuentas de usuario</h2><span class="note">Filtre por rol tocando una etiqueta.</span></div>
    <div class="tools"><input class="search" type="search" id="q_usuarios" data-q="usuarios" placeholder="Buscar nombre, usuario o DNI…" value="${esc(S.q.usuarios||"")}" aria-label="Buscar usuarios">
      <select class="inp" style="width:auto" data-chg="uEst" aria-label="Filtrar por estado"><option value="">Todos los estados</option><option ${fe === "Activo" ? "selected" : ""}>Activo</option><option ${fe === "Inactivo" ? "selected" : ""}>Inactivo</option></select>
      <button class="btn sec sm" data-xls="usuarios">Excel</button><button class="btn sec sm" data-pdf="usuarios">PDF</button>${can ? `<button class="btn sm" data-new="usuarios">+ Nuevo usuario</button>` : ""}</div></div>
    <div class="rchips">${chip("","Todos",HOST.users().length)}${Object.entries(ROLES).map(([k,l]) => chip(k, l, HOST.users().filter(u => u.rol === k).length)).join("")}</div>
    ${rows.length ? `<div class="ulist">${rows.map(u => { const me = u.id === S.user.id, off = u.estado !== "Activo";
      return `<div class="urow ${off ? "off" : ""}"><span class="avatar">${initials(u.nom)}</span>
        <div class="um"><b>${esc(u.nom)}${me ? ` <span class="pill p-info">Usted</span>` : ""}</b><span class="note"><span class="mono">${esc(u.u)}</span>${u.dni ? ` · DNI/RUC ${esc(u.dni)}` : ""}${vin(u) && vin(u) !== u.nom ? ` · ${esc(vin(u))}` : ""}</span></div>
        <div class="ur"><button class="pill p-brand rolpill" data-act="uVerRol" data-id="${u.rol}" title="Ver permisos de este rol">${esc(ROLES[u.rol])}</button></div>
        <div class="ul"><span class="note">Último acceso</span><span>${u.ult ? fd(u.ult) : "Nunca"}</span></div>
        <div class="ue">${can && !me ? `<label class="tgl" title="${off ? "Activar" : "Desactivar"} cuenta"><input type="checkbox" data-chg="uToggle" data-id="${u.id}" ${off ? "" : "checked"}><span></span>${off ? "Inactivo" : "Activo"}</label>` : estPill(u.estado)}</div>
        <div class="ua">${can ? `<button class="btn sec sm" data-edit="usuarios:${u.id}">Editar</button><button class="btn ghost sm" data-act="resetPass" data-id="${u.id}">Restablecer clave</button>${me ? "" : `<button class="btn ghost sm" data-del="usuarios:${u.id}">Eliminar</button>`}` : ""}</div></div>` }).join("")}</div>`
      : empty(q || fr || fe ? "Ninguna cuenta coincide con los filtros." : "Aún no hay cuentas.", (q || fr || fe) ? `<button class="btn sec sm" data-act="uClear">Quitar filtros</button>` : "")}
    <span class="count">${rows.length} de ${HOST.users().length} cuenta(s)</span></section>`;
}
function usrRoles(){
  const roles = Object.keys(ROLES), r = roles.includes(S.ui.uRolSel) ? S.ui.uRolSel : roles[0], can = lvl("usuarios") >= 2, P = DB.perms[r] || {};
  const groups = {}; MODS.forEach(m => (groups[m[3] || "General"] = groups[m[3] || "General"] || []).push(m));
  const sum = k => MODS.filter(m => (DB.perms[k]||{})[m[0]] === 2).length, see = k => MODS.filter(m => (DB.perms[k]||{})[m[0]] >= 1).length;
  const users = HOST.users().filter(u => u.rol === r);
  return `<div class="alert info"><div><b>Cómo funciona:</b> elija un rol a la izquierda y marque para cada módulo si ese rol tiene <b>Sin acceso</b>, solo <b>Consulta</b> (ver) o <b>Gestión</b> (registrar, editar y aprobar). Se guarda al instante.</div></div>
  <div class="roles-grid">
    <nav class="rolelist" aria-label="Roles">${roles.map(k => `<button class="rolecard ${k === r ? "on" : ""}" data-act="uRolSel" data-id="${k}"><span class="ri">${ICO[(ROL_INFO[k]||[])[0]] || ICO.usuarios}</span><span class="rt"><b>${ROLES[k]}</b><small>${HOST.users().filter(u => u.rol === k).length} usuario(s) · ${see(k)} módulos</small></span></button>`).join("")}</nav>
    <div class="stack">
    <section class="panel"><div class="panel-h"><div><h2>${ROLES[r]}</h2><span class="note">${esc((ROL_INFO[r]||[])[1] || "")}</span></div>
      ${can ? `<div class="tools"><select class="inp" style="width:auto" data-chg="uCopy" data-id="${r}" aria-label="Copiar permisos de otro rol"><option value="">Copiar permisos de…</option>${roles.filter(k => k !== r).map(k => `<option value="${k}">${ROLES[k]}</option>`).join("")}</select>
        <button class="btn ghost sm" data-act="uPermAll" data-id="${r}|1">Todo en consulta</button><button class="btn ghost sm" data-act="uPermAll" data-id="${r}|0">Quitar todo</button></div>` : ""}</div>
      <div class="pstats"><span><b>${sum(r)}</b> con gestión</span><span><b>${see(r) - sum(r)}</b> solo consulta</span><span><b>${MODS.length - see(r)}</b> sin acceso</span></div>
      ${Object.entries(groups).map(([g, ms]) => `<div class="pgroup"><h3>${g}</h3>${ms.map(([k,l,c]) => { const v = P[k] || 0, lk = permLocked(r,k);
        return `<div class="prow"><span class="pi">${ICO[k] || ""}</span><span class="pl"><b>${l}</b>${c ? `<small class="mono">Módulo ${c}</small>` : ""}${lk ? `<small>Fijo para este rol</small>` : ""}</span>
        <div class="seg pseg" role="group" aria-label="${esc(l)}">${PERM_L.map((t,i) => `<button class="${v === i ? "on lv" + i : ""}" data-act="uPerm" data-id="${r}|${k}|${i}" ${lk || !can ? "disabled" : ""} aria-pressed="${v === i}">${t}</button>`).join("")}</div></div>` }).join("")}</div>`).join("")}
    </section>
    <section class="panel"><div class="panel-h"><h2>Usuarios con este rol</h2>${can ? `<button class="btn sm" data-new="usuarios">+ Nuevo usuario</button>` : ""}</div>
      ${users.length ? `<div class="chips">${users.map(u => `<span class="chip"><b>${esc(u.nom)}</b> · <span class="mono">${esc(u.u)}</span>${u.estado !== "Activo" ? " · inactivo" : ""}</span>`).join("")}</div>` : empty("Ningún usuario tiene este rol.")}</section>
    <section class="panel"><div class="panel-h"><div><h2>Resumen de todos los roles</h2><span class="note"><i class="dotp lv2"></i> Gestión · <i class="dotp lv1"></i> Consulta · <i class="dotp lv0"></i> Sin acceso</span></div>${can ? `<button class="btn ghost sm" data-act="resetPerms">Restaurar valores por defecto</button>` : ""}</div>
      <div class="tw"><table class="pmatrix"><thead><tr><th>Módulo</th>${roles.map(k => `<th class="chk" title="${ROLES[k]}">${ROL_SHORT[k] || ROLES[k]}</th>`).join("")}</tr></thead><tbody>
      ${MODS.map(([k,l]) => `<tr><td>${l}</td>${roles.map(x => { const v = (DB.perms[x]||{})[k] || 0; return `<td class="chk"><i class="dotp lv${v}" title="${ROLES[x]}: ${PERM_L[v]}"></i></td>` }).join("")}</tr>`).join("")}</tbody></table></div></section>
    </div></div>`;
}

/* ---------- bitácora ---------- */
V.bitacora = () => {
  const mods = [...new Set(DB.bitacora.map(b => b.m))].sort();
  const fm = S.ui.bm || ""; const rows = fm ? DB.bitacora.filter(b => b.m === fm) : DB.bitacora;
  return head("Sistema","Bitácora de auditoría","Registro automático de cada acción en la plataforma: quién, cuándo, en qué módulo y sobre qué registro.") +
  `<div class="tools"><label for="bm" class="note">Módulo</label><select id="bm" class="inp" style="width:auto" data-chg="bm"><option value="">Todos</option>${mods.map(m => `<option ${m === fm ? "selected" : ""}>${esc(m)}</option>`).join("")}</select></div>` +
  crud("bitacora", {rows, edit:false, add:false, empty:"Sin registros."});
};

/* ---------- configuración ---------- */
V.config = () => {
  const T = tabs("config", [...(HOST.programsView ? [["programas","Programas de estudios"]] : []),["modulos","Módulos formativos"],["uds","Unidades didácticas"],["docentes","Asignaciones docentes"],["ambientes","Ambientes"],["bloques","Turnos, bloques y recesos"],["periodo","Periodo académico"],["documentos","Formatos documentales"]]);
  const intro = head("Configuración compartida","Configuración académica general","Programas → Módulos formativos → Unidades didácticas. Horarios y los módulos documentales utilizan estos maestros únicos.") + T.html;
  if(T.cur === "programas" && HOST.programsView) return intro + HOST.programsView();
  if(["modulos","uds","docentes","ambientes"].includes(T.cur)) return intro + crud(T.cur);
  if(T.cur === "bloques") return intro + bloquesView();
  if(T.cur === "documentos") return intro + docsConfig();
  return intro + `<section class="panel"><h2>Periodo académico vigente</h2><form class="f" data-form="cfg" novalidate>${fieldHtml({k:"periodo",l:"Periodo académico vigente",req:true,pat:PAT_PER}, DB.cfg.periodo)}<div class="fld"><button class="btn" type="submit">Guardar</button></div></form></section>`;
};

function apariencia(){
  const a = ap(), canEdit = lvl("config") >= 2, dis = canEdit ? "" : "disabled";
  const modo = (() => { try{ return LS.get(TKEY) || "sistema" }catch(e){ return "sistema" } })();
  return `${canEdit ? "" : `<div class="alert info">Tiene acceso de consulta. Solo un usuario con permiso de gestión puede cambiar la apariencia.</div>`}
  <div class="ap-grid"><div class="stack">
  <section class="panel"><div><h2>Tema de color</h2><p class="note">Se aplica a toda la intranet, al inicio de sesión y al portal público.</p></div>
    <div class="themes">${PALETAS.map(([k,n,d,c]) => { if(!c){ const w = webC(); c = {bg:"#f5f6f7", side:w.side, brand:w.brand, acc:w.acc} } return `<button class="theme-card ${a.tema === k ? "on" : ""}" data-act="apTema" data-id="${k}" ${dis} aria-pressed="${a.tema === k}" style="--sw-bg:${c.bg};--sw-acc:${c.acc};--sw-brand:${c.brand}"><span class="sw"><span class="s1" style="background:${c.side}"><i></i><i></i><i></i></span><span class="s2"><i></i><i></i></span></span><span class="tn"><b>${n}</b><span class="chk-ico">✓</span></span><span class="note">${d}</span></button>` }).join("")}</div>
    ${a.tema === "web" ? `<div class="stack" style="gap:10px"><h3>Colores del tema Web institucional</h3><p class="note">Use los códigos de color de la página web del instituto. El sistema calcula los tonos claros, el modo oscuro y el color del texto sobre los botones.</p>
      <div class="colors">${[["brand","Color principal (botones, enlaces)"],["acc","Color de acento (detalles)"],["side","Barra lateral y cabeceras"]].map(([k,l]) => `<label class="colorf" for="apc_${k}"><input type="color" id="apc_${k}" value="${webC()[k]}" data-chg="apColor" data-id="${k}" ${dis}><span><small>${l}</small><input type="text" id="apt_${k}" value="${webC()[k]}" data-chg="apColor" data-id="${k}" maxlength="7" ${canEdit ? "" : "readonly"} aria-label="Código hexadecimal: ${l}"></span></label>`).join("")}</div></div>` : ""}</section>
  <section class="panel"><div><h2>Logotipo institucional</h2><p class="note">PNG, JPG o SVG de hasta 300 KB. Se muestra en el menú, el inicio de sesión y el portal público. Se recomienda una imagen cuadrada.</p></div>
    <div class="logo-row">${sealHtml("logo-prev")}<div class="btnrow"><label class="btn sm ${canEdit ? "" : "sec"}" for="apLogo" style="cursor:pointer">${ICO.imagen}${a.logo ? "Cambiar logo" : "Subir logo"}</label><input type="file" id="apLogo" accept="image/png,image/jpeg,image/svg+xml,image/webp" data-chg="apLogo" hidden ${dis}>${a.logo ? `<button class="btn sec sm" data-act="apLogoDel" ${dis}>Usar sello por defecto</button>` : ""}</div></div></section>
  <section class="panel"><div><h2>Tipo de letra</h2><p class="note">Combinación de fuente para títulos y para el texto.</p></div>
    <div class="fonts">${FUENTES.map(([k,n,d,fd_,fb]) => `<button class="font-card ${a.fuente === k ? "on" : ""}" data-act="apFuente" data-id="${k}" ${dis} aria-pressed="${a.fuente === k}"><span class="aa" style="font-family:${esc(fd_)}">Aa</span><b style="font-family:${esc(fd_)}">${n}</b><small style="font-family:${esc(fb)}">${d}</small></button>`).join("")}</div>
    <div class="fld"><span class="lbl">Tamaño del texto</span><div class="seg" role="group" aria-label="Tamaño del texto">${TAMANOS.map(([k,n]) => `<button class="${a.tam === k ? "on" : ""}" data-act="apTam" data-id="${k}" ${dis} aria-pressed="${a.tam === k}">${n}</button>`).join("")}</div></div></section>
  <section class="panel"><div><h2>Textos de la barra lateral</h2></div>
    <form class="f" data-form="apTxt" novalidate><div class="fld"><label for="apTitulo">Título de la intranet</label><input id="apTitulo" name="titulo" value="${esc(a.titulo)}" maxlength="40" ${canEdit ? "" : "readonly"}></div><div class="fld" style="align-self:end"><button class="btn" type="submit" ${dis}>Guardar título</button></div></form></section>
  <section class="panel"><div><h2>Modo claro u oscuro</h2><p class="note">Esta preferencia es personal y se guarda solo en este navegador.</p></div>
    <div class="seg" role="group" aria-label="Modo de color">${[["sistema","Según el sistema"],["light","Claro"],["dark","Oscuro"]].map(([k,n]) => `<button class="${modo === k ? "on" : ""}" data-act="apModo" data-id="${k}" aria-pressed="${modo === k}">${n}</button>`).join("")}</div></section>
  ${canEdit ? `<div class="btnrow"><button class="btn sec" data-act="apReset">Restablecer apariencia original</button></div>` : ""}
  </div>
  <aside class="ap-preview"><section class="panel"><h2>Vista previa</h2><div class="mini"><div class="ms">${sealHtml()}<i class="on"></i><i></i><i></i><i></i></div><div class="mc"><span class="ref">${esc(DB.cfg.siglas)}</span><h3>${esc(a.titulo)}</h3><p class="note">Así se verán los títulos y el texto con la configuración elegida.</p><div class="row"><span></span><span></span></div><div class="btnrow"><span class="btn sm">Botón principal</span><span class="btn sec sm">Secundario</span></div><div class="btnrow">${pill("Atendido","p-ok")}${pill("Por vencer","p-warn")}</div></div></div></section></aside></div>`;
}

/* ---------- bloques horarios y receso ---------- */
const slotEnd = sl => { const x = sl[sl.length-1]; return x[0] === "REC" ? x[2] : x[1] };
function bloquesView(){
  const minOpts = (v, list) => list.map(m => `<option value="${m}" ${m === v ? "selected" : ""}>${m} min</option>`).join("");
  const card = t => { const c = bloqCfg(t), sl = buildSlots(c), k = t === "Mañana" ? "m" : "t"; let h = 0;
    const rows = sl.map((x, i) => { if(x[0] === "REC"){ const r = c.recs.find(z => z.after === h); return `<div class="tl-row tl-rec"><span class="tl-ic">${ICO.reloj}</span><b>Receso</b><span class="mono">${x[1]} – ${x[2]}</span><select class="inp" data-chg="bqRecMin" data-id="${t}|${h}" aria-label="Duración del receso">${minOpts(r.min,[5,10,15,20,30,45,60])}</select><button class="btn ghost sm" data-act="bqDelRec" data-id="${t}|${h}">Quitar</button></div>` }
      h++; const next = sl[i+1], canRec = h < c.n && !(next && next[0] === "REC");
      return `<div class="tl-row"><span class="tl-n">${h}.ª</span><b>Hora de clase</b><span class="mono">${x[0]} – ${x[1]}</span><span></span>${canRec ? `<button class="btn ghost sm" data-act="bqAddRec" data-id="${t}|${h}">+ Receso después</button>` : "<span></span>"}</div>` }).join("");
    return `<section class="panel bq"><div class="panel-h"><div><h2>Turno ${t}</h2><span class="note">De ${sl[0][0]} a ${slotEnd(sl)} · ${c.n} horas de clase</span></div></div>
    <div class="bq-top"><div class="fld"><label for="bq_${k}_ini">Empieza a las</label><input id="bq_${k}_ini" type="time" step="300" value="${c.ini}" data-chg="bqIni" data-id="${t}"></div>
      <div class="fld"><label for="bq_${k}_dur">Cada hora de clase dura</label><select id="bq_${k}_dur" data-chg="bqDur" data-id="${t}">${minOpts(c.dur,[40,45,50,55,60,90])}</select></div></div>
    <div class="tl">${rows}</div>
    <div class="btnrow"><button class="btn sec sm" data-act="bqAddHora" data-id="${t}">+ Agregar hora de clase</button>${c.n > 1 ? `<button class="btn ghost sm" data-act="bqDelHora" data-id="${t}">Quitar la última hora</button>` : ""}</div></section>` };
  return `<div class="alert info"><div><b>Cómo funciona:</b> elija a qué hora empieza cada turno y cuánto dura cada hora de clase. Para poner un receso, pulse <b>“+ Receso después”</b> en la hora que corresponda. Los cambios se guardan al instante y las clases ya programadas se mueven solas.</div></div>
  <div class="grid2">${Object.keys(BLOQ_DEF).map(card).join("")}</div>
  <div class="btnrow"><button class="btn sec sm" data-act="bloqReset">Volver al horario original</button></div>`;
}
function bloqErr(t, nc){
  const sl = buildSlots(nc), end = mins(slotEnd(sl));
  if(end > 23*60) return `El turno ${t.toLowerCase()} terminaría a las ${hhmm(end)}. Debe terminar antes de las 23:00.`;
  if(t === "Mañana"){ const tt = buildSlots(bloqCfg("Tarde")); if(end > mins(tt[0][0])) return `La mañana terminaría a las ${hhmm(end)}, pero la tarde empieza a las ${tt[0][0]}. Cambie primero la hora de inicio de la tarde.` }
  else { const mm = buildSlots(bloqCfg("Mañana")); if(mins(nc.ini) < mins(slotEnd(mm))) return `La tarde no puede empezar antes de las ${slotEnd(mm)}, que es cuando termina la mañana.` }
  return "";
}
function applyBloques(t, nc){
  nc = normBloq(nc);
  const oldS = slotStarts(t), oldE = slotEnds(t), ns = buildSlots(nc).filter(x => x[0] !== "REC");
  const ss = DB.sesiones.filter(s => s.turno === t), lost = [];
  const moves = ss.map(s => { const a = oldS.indexOf(s.ini), b = oldE.indexOf(s.fin); if(a < 0 || b < 0 || b >= ns.length) { lost.push(s); return null } return [s, ns[a][0], ns[b][1]] });
  if(lost.length) return lost;
  moves.forEach(m => { if(m){ m[0].ini = m[1]; m[0].fin = m[2] } });
  DB.cfg.bloques = Object.assign({}, DB.cfg.bloques || {}, {[t]: nc}); rebuildSlots(); return null;
}
function setBloq(t, patch, msg){
  if(lvl("config") < 2) return;
  const nc = normBloq(Object.assign(bloqCfg(t), patch)), e = bloqErr(t, nc);
  if(e){ toast(e); render(); return }
  const lost = applyBloques(t, nc);
  if(lost){ toast(`No se puede: hay ${lost.length} clase(s) en la última hora (por ejemplo ${ud(lost[0].ud).nombre}, ${DIAS_L[lost[0].dia]}). Muévalas o quítelas primero.`); render(); return }
  log("Configurar horario","Horarios",`Turno ${t}: ${msg}`); if(!save())return false; toast(`Turno ${t}: ${msg}.`); render();
}

function docsConfig(){
  const C = docCfg(), ed = lvl("config") >= 2, dis = ed ? "" : "disabled", ro = ed ? "" : "readonly";
  const logo = (k, l, hint) => `<div class="fld"><span class="lbl">${l}</span><div class="logo-row">${C[k] ? `<img src="${esc(C[k].src)}" alt="" style="height:56px;max-width:140px;object-fit:contain;border:1px solid var(--line);border-radius:8px;padding:4px;background:#fff">` : `<span class="note" style="border:1.5px dashed var(--line-2);border-radius:8px;padding:16px 14px">Sin imagen</span>`}<div class="btnrow"><label class="btn sm ${ed ? "" : "sec"}" for="dc_${k}" style="cursor:pointer">${ICO.imagen}${C[k] ? "Cambiar" : "Subir"}</label><input type="file" id="dc_${k}" accept="image/png,image/jpeg,image/svg+xml,image/webp" data-chg="docImg" data-id="${k}" hidden ${dis}>${C[k] ? `<button class="btn ghost sm" data-act="docImgDel" data-id="${k}" ${dis}>Quitar</button>` : ""}</div></div><span class="hint">${hint}</span></div>`;
  const presets = [["#0b1d3f","Azul institucional"],["#c0141b","Rojo escudo"],["#0a7fc2","Celeste"],["#0f5e57","Verde"],["#8a1c2b","Granate"]];
  const sample = {cod:"MUES-TRA1", tipo:"titulo", fecha:nowStamp(), persona:"Nombre de ejemplo", por:S.user ? S.user.nom : ""};
  return `${ed ? "" : `<div class="alert info">Tiene acceso de consulta. Solo un usuario con permiso de gestión puede cambiar los documentos.</div>`}
  <div class="ap-grid"><div class="stack">
  <section class="panel"><div><h2>Logotipos</h2><p class="note">Se imprimen en el encabezado de constancias, reportes de título, cargos, hojas de reclamación, horarios y listados en PDF. PNG, JPG o SVG de hasta 1 MB.</p></div>
    <div class="grid2">${logo("logoIzq","Logo izquierdo","Por ejemplo, el logo del instituto.")}${logo("logoDer","Logo derecho","Por ejemplo, MINEDU o el Gobierno Regional. Si no sube uno, se usa el sello.")}</div></section>
  <form class="stack" data-form="docsCfg" novalidate>
  <section class="panel"><div><h2>Encabezado</h2></div>
    <div class="fld"><span class="lbl">Estilo</span><div class="seg" role="group" aria-label="Estilo del encabezado">${[["banda","Banda de color"],["blanco","Fondo blanco con línea"]].map(([k,l]) => `<button type="button" class="${C.estilo === k ? "on" : ""}" data-act="docEstilo" data-id="${k}" ${dis}>${l}</button>`).join("")}</div></div>
    <div class="fld"><span class="lbl">Color de los documentos</span><div class="btnrow">${presets.map(([h,l]) => `<button type="button" class="btn sec sm" data-act="docColor" data-id="${h}" ${dis} title="${l}"><span style="width:14px;height:14px;border-radius:4px;background:${h};display:inline-block;${C.color === h ? "box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--brand)" : ""}"></span>${l}</button>`).join("")}<input type="color" id="dc_color" value="${docColor()}" data-chg="docColorPick" ${dis} aria-label="Otro color" title="Otro color" style="width:44px;height:34px;padding:2px;border:1px solid var(--line-2);border-radius:8px;background:var(--surface);cursor:pointer"></div></div>
    <div class="f"><div class="fld wide"><label for="dc_sub">Texto bajo el nombre del instituto</label><input id="dc_sub" name="sub" value="${esc(C.sub)}" placeholder="${esc(DB.cfg.direccion + " · " + DB.cfg.web)}" maxlength="120" ${ro}><span class="hint">Déjelo vacío para usar la dirección y la web.</span></div>
    <div class="fld wide"><label for="dc_lema">Denominación del año</label><input id="dc_lema" name="lema" value="${esc(C.lema)}" placeholder="Ej.: Año de la ..." maxlength="140" ${ro}><span class="hint">Aparece centrada debajo del encabezado. Déjela vacía si no la usa.</span></div></div></section>
  <section class="panel"><div class="panel-h"><h2>Firma</h2><label class="switch"><input type="checkbox" name="firma" id="dc_firma" ${C.firma ? "checked" : ""} ${dis}> Mostrar firma en los documentos</label></div>
    <div class="f"><div class="fld"><label for="dc_fn">Nombre</label><input id="dc_fn" name="firmaNom" value="${esc(C.firmaNom)}" placeholder="${esc(DB.cfg.director)}" maxlength="80" ${ro}></div>
    <div class="fld"><label for="dc_fc">Cargo</label><input id="dc_fc" name="firmaCargo" value="${esc(C.firmaCargo)}" maxlength="80" ${ro}></div></div>
    ${logo("firmaImg","Imagen de la firma (opcional)","Una firma escaneada sobre fondo blanco o transparente.")}</section>
  <section class="panel"><div><h2>Pie de página</h2></div>
    <div class="fld"><label for="dc_pie">Texto del pie</label><input id="dc_pie" name="pie" value="${esc(C.pie)}" placeholder="Ej.: Av. Las Américas S/N, Pisco · iestp@iestppisco.edu.pe" maxlength="160" ${ro}></div></section>
  ${ed ? `<div class="btnrow"><button class="btn" type="submit">Guardar textos</button><button type="button" class="btn sec" data-act="docSample">Descargar PDF de ejemplo</button><button type="button" class="btn ghost" data-act="docReset">Restablecer</button></div>` : ""}
  </form></div>
  <aside class="ap-preview"><section class="panel"><h2>Vista previa</h2><div class="paper" style="padding:22px;--pp:22px;--pp2:22px;gap:10px;font-size:.86rem">${paperHead()}<h2 style="font-size:1rem">REPORTE DE VALIDACIÓN DE TÍTULO</h2><dl class="dl"><dt>Titulado(a)</dt><dd>Nombre de ejemplo</dd><dt>Programa</dt><dd>${esc((DB.programas[0]||{}).nombre || "Programa de estudios")}</dd></dl>${paperFoot(sample)}</div></section></aside></div>`;
}

/* ---------- verificación pública ---------- */
function verificarDoc(){
  const q = (S.ui.vq || "").trim().toUpperCase(), d = q ? DB.docs.find(x => x.cod === q) : null;
  return `<section class="panel"><div><h2>Verificar autenticidad de un documento</h2><p class="note">Ingrese el código de verificación impreso al pie de la constancia, reporte, cargo u hoja de reclamación.</p></div>
  <form class="f" data-form="vq"><div class="fld"><label for="vq">Código de verificación</label><input id="vq" name="vq" value="${esc(S.ui.vq||"")}" placeholder="XXXX-XXXX"></div><div class="fld" style="align-self:end"><button class="btn">Verificar</button></div></form>
  ${!q ? `<p class="note">${DB.docs.length ? `Último código emitido: <span class="mono">${DB.docs[0].cod}</span>.` : "Emita una constancia desde la intranet para obtener un código y verificarlo aquí."}</p>` : ""}</section>
  ${q ? (d ? `<div class="alert ok"><b>Documento auténtico.</b> ${esc(DOC_T[d.tipo])} emitido el ${fd(d.fecha)} a nombre de ${esc(d.persona)}.</div>` : S.ui.vqr && String(S.ui.vqr.c).toUpperCase() === q ? `<section class="ficha"><div class="panel-h"><h2>Datos leídos del código QR</h2>${pill("Código " + q,"p-info")}</div><dl class="dl"><dt>Documento</dt><dd>${esc(DOC_T[S.ui.vqr.t] || S.ui.vqr.t)}</dd><dt>A nombre de</dt><dd>${esc(S.ui.vqr.p)}</dd><dt>Emitido</dt><dd>${esc(fd(S.ui.vqr.f))}</dd></dl><div class="alert info">En esta versión los documentos se registran en el navegador donde se emitieron, por eso este dispositivo no puede confirmarlo contra el registro. En el sistema final, esta consulta se hace contra la base de datos del instituto.</div></section>` : `<div class="alert bad"><b>Código no registrado.</b> El código “${esc(q)}” no corresponde a ningún documento emitido por la institución.</div>`) : ""}`;
}

/* ---------- estructura técnica ---------- */
V.arquitectura = () => {
  const T = tabs("arquitectura", [["capas","Arquitectura"],["bd","Base de datos"],["codigo","Estructura del código"],["entregables","Entregables"]]); let body = "";
  if(T.cur === "capas") body = `<section class="panel"><h2>Capas del sistema</h2><div class="layers">
    <div class="layer"><b>Portal web público</b><div class="chips"><span class="chip">${esc(DB.cfg.web)} (existente, no se reemplaza)</span><span class="chip m">Acceso “Intranet”</span><span class="chip">Servicios públicos: títulos, certificaciones, verificación, mesa de partes, seguimiento, reclamos, docentes, bolsa</span></div></div>
    <div class="layer"><b>Presentación</b><div class="chips"><span class="chip">Bootstrap 5 responsive</span><span class="chip">Vistas PHP por módulo</span><span class="chip">PDF con QR (Dompdf / TCPDF)</span><span class="chip">Excel (PhpSpreadsheet)</span></div></div>
    <div class="layer"><b>Seguridad</b><div class="chips"><span class="chip">Login con password_hash</span><span class="chip">Roles y permisos configurables (RBAC)</span><span class="chip">Tokens CSRF y validación de entradas</span><span class="chip">Bitácora de auditoría</span><span class="chip">HTTPS</span><span class="chip">Ley N.º 29733 – datos personales</span></div></div>
    <div class="layer"><b>Aplicación · PHP 8.x</b><div class="chips"><span class="chip m">Núcleo: personas, usuarios, roles</span><span class="chip m">1.1 Horarios</span><span class="chip m">1.2 Certificados</span><span class="chip m">1.3 Títulos</span><span class="chip m">2.1 Reclamos</span><span class="chip m">2.2 Mesa de partes</span><span class="chip m">2.3 Bolsa laboral</span><span class="chip m">2.4 Docentes</span></div></div>
    <div class="layer"><b>Servicios comunes</b><div class="chips"><span class="chip">Notificaciones por correo (SMTP)</span><span class="chip">Almacén de adjuntos</span><span class="chip">Numeración de expedientes</span><span class="chip">Códigos de verificación</span><span class="chip">Métricas de uso</span><span class="chip">Respaldo programado (cron)</span></div></div>
    <div class="layer"><b>Datos</b><div class="chips"><span class="chip">MySQL / MariaDB · InnoDB · utf8mb4</span><span class="chip">Claves foráneas e integridad referencial</span><span class="chip">Scripts de creación y datos iniciales</span></div></div>
    <div class="layer"><b>Infraestructura</b><div class="chips"><span class="chip">Hosting institucional vigente</span><span class="chip">Subdominio sugerido: intranet.${esc(DB.cfg.web)}</span><span class="chip">Cambios DNS solo por el responsable institucional</span></div></div></div></section>
    <section class="panel"><h2>Una persona, varios módulos</h2><p class="note">Un estudiante se registra una sola vez y se relaciona con certificaciones, títulos, bolsa laboral y trámites (sección IX.3).</p><div class="layers">
    <div class="layer"><b class="mono">personas</b><div class="chips"><span class="chip m">estudiantes</span><span class="chip m">docentes</span><span class="chip m">usuarios</span><span class="chip">expedientes</span><span class="chip">reclamos</span></div></div>
    <div class="layer"><b class="mono">estudiantes</b><div class="chips"><span class="chip">certificaciones_modulares</span><span class="chip">notas</span><span class="chip">titulos</span><span class="chip">perfiles_laborales → postulaciones</span></div></div>
    <div class="layer"><b class="mono">docentes</b><div class="chips"><span class="chip">sesiones_horario</span><span class="chip">disponibilidad_docente</span><span class="chip">perfiles_docentes → docente_items</span></div></div></div></section>`;
  if(T.cur === "bd"){
    const tb = [
     ["Núcleo y seguridad",[["personas",["id PK","dni UNIQUE","nombres","apellidos","correo","telefono"]],["usuarios",["id PK","persona_id FK","username UNIQUE","password_hash","rol_id FK","area_id FK","estado","ultimo_acceso"]],["roles",["id PK","nombre"]],["modulos",["id PK","codigo","nombre"]],["rol_modulo",["rol_id FK","modulo_id FK","nivel (0/1/2)"]],["bitacora",["id PK","usuario_id FK","accion","modulo","detalle","ip","fecha"]],["notificaciones",["id PK","usuario_id FK","texto","enlace","leida","fecha"]],["documentos_emitidos",["id PK","codigo_verificacion UNIQUE","tipo","referencia_id","emitido_por FK","fecha"]],["configuracion",["clave PK","valor"]]]],
     ["Académico",[["programas",["id PK","codigo UNIQUE","nombre","duracion","semestres","activo"]],["periodos",["id PK","codigo","inicio","fin","vigente"]],["unidades_didacticas",["id PK","programa_id FK","codigo","nombre","ciclo","horas","creditos"]],["modulos_formativos",["id PK","programa_id FK","codigo","nombre","ciclos"]],["docentes",["id PK","persona_id FK","condicion","especialidad"]],["docente_ud",["docente_id FK","ud_id FK"]],["disponibilidad_docente",["id PK","docente_id FK","dia","hora_ini","hora_fin"]],["ambientes",["id PK","codigo","tipo","capacidad","ubicacion","programa_restringido FK"]],["sesiones_horario",["id PK","periodo_id FK","programa_id FK","ciclo","seccion","turno","ud_id FK","docente_id FK","ambiente_id FK","dia","hora_ini","hora_fin"]],["publicaciones_horario",["id PK","periodo_id FK","programa_id FK","ciclo","seccion","turno","usuario_id FK","fecha"]],["estudiantes",["id PK","persona_id FK","programa_id FK","ciclo","seccion","turno","periodo_ingreso","estado"]],["notas",["id PK","estudiante_id FK","unidad","periodo","nota"]],["certificaciones_modulares",["id PK","estudiante_id FK","modulo_id FK","numero UNIQUE","fecha"]],["titulos",["id PK","estudiante_id FK UNIQUE","fecha_culminacion","fecha_titulacion","codigo UNIQUE","resolucion"]]]],
     ["Administrativo",[["areas",["id PK","codigo UNIQUE","nombre","responsable","correo","activo"]],["tipos_tramite",["id PK","nombre","area_id FK","dias_atencion","requisitos"]],["expedientes",["id PK","numero UNIQUE","codigo_seguimiento UNIQUE","persona_id FK","tipo_documento","tramite_id FK","asunto","area_actual_id FK","estado","fecha"]],["expediente_movimientos",["id PK","expediente_id FK","accion","area_id FK","usuario_id FK","comentario","fecha"]],["adjuntos",["id PK","entidad","entidad_id","nombre","ruta","tamano","hash"]],["reclamos",["id PK","numero UNIQUE","persona_id FK","tipo","area_id FK","fecha_hecho","descripcion","pedido","responsable","respuesta","estado"]]]],
     ["Empleabilidad y docentes",[["empresas",["id PK","ruc UNIQUE","razon_social","sector","contacto","validada"]],["perfiles_laborales",["id PK","estudiante_id FK","resumen","competencias","cv_adjunto FK"]],["ofertas",["id PK","empresa_id FK","puesto","descripcion","requisitos","modalidad","programa_id FK","vacantes","fecha_limite","estado"]],["postulaciones",["id PK","oferta_id FK","estudiante_id FK","fecha","estado"]],["perfiles_docentes",["id PK","docente_id FK","resumen"]],["docente_items",["id PK","perfil_id FK","tipo","descripcion","adjunto FK"]]]]];
    body = tb.map(([g,ts]) => `<section class="panel"><h2>${g}</h2><div class="grid3">${ts.map(([n,cs]) => `<div class="tbl"><h4>${n}</h4><ul>${cs.map(c => `<li class="${/PK/.test(c) ? "pk" : /FK/.test(c) ? "fk" : ""}">${c}</li>`).join("")}</ul></div>`).join("")}</div></section>`).join("") + `<p class="note">${tb.reduce((a,g) => a + g[1].length, 0)} tablas · PK en ocre, FK en azul. Se entrega con <span class="mono">schema.sql</span>, datos iniciales y diccionario de datos.</p>`;
  }
  if(T.cur === "codigo") body = `<section class="panel"><h2>Estructura del proyecto (PHP 8 · MVC, sin dependencias cerradas)</h2>
<pre class="tree">intranet-iestp-ica/
├── public/                  ← único directorio expuesto en el hosting
│   ├── index.php            ← controlador frontal
│   ├── assets/              ← bootstrap, css, js, img
│   └── servicios/           ← páginas públicas: títulos, certificados, verificación,
│                              mesa de partes, seguimiento, reclamos, docentes, bolsa
├── app/
│   ├── Core/                ← Router, Controller, Model, Auth, Csrf, Validator, Mailer, Logger
│   ├── Modules/
│   │   ├── Seguridad/       ← usuarios, roles, permisos, bitácora, notificaciones
│   │   ├── Academico/
│   │   │   ├── Horarios/    ← Controller, Model, Views, ValidadorCruces.php
│   │   │   ├── Certificados/
│   │   │   └── Titulos/
│   │   └── Administrativo/
│   │       ├── Reclamos/
│   │       ├── MesaPartes/  ← NumeradorExpediente.php, Plazos.php
│   │       ├── BolsaLaboral/
│   │       └── Docentes/
│   └── Reports/             ← PDF con QR y Excel
├── config/                  ← .env.example, database.php, mail.php
├── database/
│   ├── schema.sql           ← tablas, relaciones e índices
│   ├── seed.sql             ← roles, permisos, administrador inicial
│   └── diccionario_datos.pdf
├── storage/                 ← adjuntos, logs, respaldos (fuera de public/)
├── install/                 ← verifica PHP 8, crea la base de datos y el administrador
├── docs/                    ← arquitectura y manuales
└── config.example.php       ← configuración de PHP y MySQL</pre>
<p class="note">Código completo, editable y sin restricciones, para que terceros puedan mantenerlo y agregar módulos (numeral 7.1 del TDR).</p></section>`;
  if(T.cur === "entregables"){
    const ents = [["7.1","Código fuente completo, editable y sin restricciones","Repositorio y archivo comprimido"],["7.2","Base de datos: estructura, tablas, relaciones y scripts","schema.sql, seed.sql, diccionario"],["7.3","Scripts de instalación y configuración inicial","/install y .env.example"],["7.4","Documentación técnica: arquitectura, módulos, requisitos e instalación","PDF"],["7.5","Manual técnico, manual de administrador y manual básico de operación","PDF"],["IX.5","Capacitación y accesos administrativos (transferencia tecnológica)","Acta de capacitación"],["XI","Certificado SSL para la intranet y respaldo automático","Evidencia de configuración"]];
    body = `<section class="panel"><h2>Entregables obligatorios (sección VII)</h2><div class="tw"><table><thead><tr><th>Ref.</th><th>Entregable</th><th>Forma de entrega</th></tr></thead><tbody>${ents.map(e => `<tr><td>${mono(e[0])}</td><td>${e[1]}</td><td>${e[2]}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="panel"><h2>Hitos sugeridos</h2><div class="timeline"><div><b>Hito 1 · Análisis y diseño</b><br>Validación del alcance, modelo de datos y esta versión funcional.</div><div><b>Hito 2 · Núcleo y gestión académica</b><br>Usuarios y permisos, horarios con validaciones, certificados y títulos.</div><div><b>Hito 3 · Gestión administrativa</b><br>Reclamos, mesa de partes, bolsa laboral y branding docente.</div><div><b>Hito 4 · Despliegue y transferencia</b><br>Instalación en el hosting, SSL, carga inicial, capacitación y entrega de fuentes y manuales.</div></div></section>`;
  }
  return head("Sistema","Estructura técnica del sistema","Cómo se construye la intranet definitiva: capas, modelo de datos relacional, organización del código y entregables exigidos.") + T.html + body;
};
/* =====================================================================
   RENDER, ACCIONES Y EVENTOS
   ===================================================================== */
function render(){
  const root = document.getElementById("ix-root"); if(!root) return;
  const a = document.activeElement, fid = a && a.id && root.contains(a) ? a.id : null, sel = fid && "selectionStart" in a ? [a.selectionStart, a.selectionEnd] : null;
  root.innerHTML = renderView();
  if(fid){ const el = document.getElementById(fid); if(el && el.tagName === "INPUT"){ el.focus(); try{ if(sel) el.setSelectionRange(sel[0], sel[1]) }catch(e){} } }
}
const VIEW_PERM = { mesaCfg: "config" };
function renderView(){ const f = V[S.view]; if(!f) return ""; if(!S.view.startsWith("pub:") && (!S.user || lvl(VIEW_PERM[S.view] || S.view) === 0)) return empty("No tiene acceso a este módulo."); return f() }
function go(view){ S.ui.dsel = null; S.ui.dd = null; closeModal(); HOST.go(view) }
function logout(){ HOST.logout() }

const ACTIONS = {
  mkAcc(id){ if(lvl("alumnos") < 2) return; const e = byId(DB.estudiantes, +id); if(!e) return; const r = HOST.createStudentAccount({id:e.id, dni:e.dni, nom:e.nom, estado:e.estado, correo:e.correo || ""});
    if(r.error) return toast(r.error); log("Crear acceso","Maestro de alumnos",`${e.dni} ${e.nom}`); render();
    openModal({title:"Acceso creado", body:`<p>Se creó la cuenta de <b>${esc(e.nom)}</b> como <b>${esc(r.rolLabel)}</b>.</p><dl class="dl"><dt>Usuario</dt><dd class="mono">${esc(r.usuario)}</dd><dt>Contraseña temporal</dt><dd class="mono" style="font-size:1.1rem">${esc(r.pass)}</dd></dl><p class="note">Entréguela al alumno: es temporal y deberá cambiarla en su primer ingreso. Luego verá su ficha, horario, certificaciones, bolsa laboral y trámites.</p>`}) },
  uRol(id){ S.ui.uRol = id; render() },
  uClear(){ S.ui.uRol = ""; S.ui.uEst = ""; S.q.usuarios = ""; render() },
  uVerRol(id){ S.ui.uRolSel = id; S.tab.usuarios = "permisos"; render(); window.scrollTo(0,0) },
  uRolSel(id){ S.ui.uRolSel = id; render() },
  uPerm(id){ if(lvl("usuarios") < 2) return; const [r,k,v] = id.split("|"); if(permLocked(r,k)) return; DB.perms[r] = DB.perms[r] || {}; DB.perms[r][k] = +v; const m = MODS.find(x => x[0] === k); log("Cambiar permiso","Usuarios",`${ROLES[r]} · ${m ? m[1] : k} → ${PERM_L[+v]}`); if(!save())return false; toast(`${ROLES[r]}: ${m ? m[1] : k} → ${PERM_L[+v]}.`); render() },
  uPermAll(id){ if(lvl("usuarios") < 2) return; const [r,v] = id.split("|"); const go = () => { MODS.forEach(([k]) => { if(!permLocked(r,k)) DB.perms[r][k] = +v }); log("Cambiar permiso","Usuarios",`${ROLES[r]} · todos → ${PERM_L[+v]}`); if(!save())return false; toast(`${ROLES[r]}: todos los módulos en “${PERM_L[+v]}”.`); render() };
    if(+v === 0) confirmBox("Quitar todos los permisos", `El rol <b>${esc(ROLES[r])}</b> quedará sin acceso a los módulos (salvo el panel de inicio). Sus usuarios dejarán de verlos en el menú.`, "Quitar todo", go); else go() },
  docEstilo(id){ setDocs({estilo:id}, "Estilo del encabezado actualizado.") },
  docColor(id){ setDocs({color:id}, "Color de los documentos actualizado.") },
  docImgDel(id){ setDocs({[id]:null}, "Imagen quitada.") },
  docReset(){ confirmBox("Restablecer documentos","Se quitarán los logos y la firma, y el encabezado volverá al estilo y color originales.","Restablecer",() => { DB.cfg.docs = {}; log("Configurar documentos","Configuración","Restablecido"); if(!save())return false; toast("Documentos restablecidos."); render() }) },
  docSample(){ if(!libsOk("pdf")) return; const d = {cod:"MUES-TRA1", tipo:"titulo", fecha:nowStamp(), persona:"Nombre de ejemplo", por:S.user ? S.user.nom : ""}; const doc = pdfNew(); let y = pdfHeader(doc, "DOCUMENTO DE EJEMPLO", "Vista de prueba del encabezado, la firma y el pie de página");
    y = pdfKV(doc, y + 4, [["Titulado(a)","Nombre de ejemplo"],["DNI","00000000"],["Programa de estudios",(DB.programas[0]||{}).nombre || "—"]]);
    y = pdfTable(doc, y + 4, ["Columna 1","Columna 2","Columna 3"], [["Dato","Dato","Dato"],["Dato","Dato","Dato"]]);
    pdfVerify(doc, d, y + 10); pdfFooter(doc); saveFile(`documento_ejemplo_${fileStamp()}.pdf`, doc.output("blob")) },
  bloqReset(){ if(lvl("config")<2)return;confirmBox("Volver al horario original","Mañana: de 08:00 a 14:15 con receso de 11:00 a 11:15. Tarde: de 14:30 a 19:45 con receso de 17:30 a 17:45. Las clases programadas se moverán a esas horas.","Volver al original",() => { const old = JSON.parse(JSON.stringify(DB.cfg.bloques || {})); const sv = DB.sesiones.map(x => [x.ini, x.fin]); const lost = ["Tarde","Mañana"].map(t => applyBloques(t, BLOQ_DEF[t])).filter(Boolean); if(lost.length){ DB.sesiones.forEach((x,i) => { x.ini = sv[i][0]; x.fin = sv[i][1] }); DB.cfg.bloques = old; rebuildSlots(); toast("Hay clases en horas que no existen en el horario original. Muévalas primero."); return } DB.cfg.bloques = {}; rebuildSlots(); log("Configurar horario","Horarios","Horario original restablecido"); if(!save())return false; toast("Se restableció el horario original."); render() }) },
  bqAddRec(id){ const [t,h] = id.split("|"); const c = bloqCfg(t); setBloq(t, {recs:[...c.recs, {after:+h, min:15}]}, `receso de 15 min después de la ${h}.ª hora`) },
  bqDelRec(id){ const [t,h] = id.split("|"); const c = bloqCfg(t); setBloq(t, {recs:c.recs.filter(r => r.after !== +h)}, `se quitó el receso después de la ${h}.ª hora`) },
  bqAddHora(t){ const c = bloqCfg(t); if(c.n >= 10) return toast("Máximo 10 horas de clase por turno."); setBloq(t, {n:c.n + 1}, `${c.n + 1} horas de clase`) },
  bqDelHora(t){ const c = bloqCfg(t); setBloq(t, {n:c.n - 1}, `${c.n - 1} horas de clase`) },
  toPublic(){ S.mode = "public"; render(); window.scrollTo(0,0) },
  toPublicApp(){ S.mode = "public"; S.ui.menu = false; render(); window.scrollTo(0,0) },
  toLogin(){ closeModal(); S.mode = S.user ? "app" : "login"; render(); window.scrollTo(0,0) },
  demoLogin(id){ doLogin(byId(HOST.users(),+id)) },
  pubTab(id){ S.pubTab = id; S.ui.cq = S.ui.tq = S.ui.mq = S.ui.vq = ""; render() },
  menu(){ S.ui.menu = !S.ui.menu; render() },
  theme(){ const t = isDark() ? "light" : "dark"; document.documentElement.setAttribute("data-theme", t); LS.set(TKEY, t); render() },
  apTema(id){ if(lvl("config") < 2) return; const p = PALETAS.find(x => x[0] === id); log("Cambiar apariencia","Configuración",`Tema: ${p[1]}`); setAp({tema:id}, `Tema “${p[1]}” aplicado.`) },
  apFuente(id){ if(lvl("config") < 2) return; const f = FUENTES.find(x => x[0] === id); log("Cambiar apariencia","Configuración",`Tipografía: ${f[1]}`); setAp({fuente:id}, `Tipografía “${f[1]}” aplicada.`) },
  apTam(id){ if(lvl("config") < 2) return; setAp({tam:id}) },
  apLogoDel(){ if(lvl("config") < 2) return; log("Cambiar apariencia","Configuración","Logo eliminado"); setAp({logo:""}, "Se restableció el sello por defecto.") },
  apModo(id){ const r = document.documentElement; if(id === "sistema"){ r.removeAttribute("data-theme"); LS.del(TKEY) } else { r.setAttribute("data-theme", id); LS.set(TKEY, id) } render() },
  apReset(){ confirmBox("Restablecer apariencia","Se volverá al tema Verde institucional, la tipografía Moderna, el sello por defecto y el título original. Los colores del tema Web institucional también se restablecen.","Restablecer",() => { log("Cambiar apariencia","Configuración","Apariencia restablecida"); setAp(Object.assign({}, AP_DEF), "Apariencia restablecida.") }) },
  bell(){ S.ui.dd = S.ui.dd === "bell" ? null : "bell"; render() },
  account(){ S.ui.dd = S.ui.dd === "account" ? null : "account"; render() },
  readAll(){ myNotifs().forEach(n => { if(!n.leido.includes(S.user.id)) n.leido.push(S.user.id) }); if(!save())return false; render() },
  openNotif(id){ const n = byId(DB.notifs,+id); if(!n.leido.includes(S.user.id)) n.leido.push(S.user.id); if(!save())return false; S.ui.dd = null; go(lvl(n.go) ? n.go : "inicio") },
  logout(){ logout() },
  changePass(){ location.href = "/accounts.php"; },
  /* horarios */
  newSes(id){ const [dia, ini, fin] = id.split("|"); sesForm(null, {dia, ini, fin}) },
  editSes(id){ sesForm(byId(DB.sesiones,+id)) },
  delSes(id){ const s = byId(DB.sesiones,+id); confirmBox("Quitar clase", `Se quitará <b>${esc(ud(s.ud).nombre)}</b> del ${DIAS_L[s.dia].toLowerCase()} ${s.ini}–${s.fin}.`, "Quitar", () => {
    DB.sesiones = DB.sesiones.filter(x => x.id !== s.id); const k = gkey(s.prog,s.ciclo,s.sec,s.turno); let m = "Clase retirada del horario."; if(DB.publicados[k]){ delete DB.publicados[k]; m += " El horario volvió a borrador." }
    log("Eliminar","Horarios",`${prog(s.prog).cod} ${s.ciclo}-${s.sec} · ${ud(s.ud).nombre} ${s.dia} ${s.ini}`); if(!save())return false; toast(m); render() }) },
  goSes(id){ const s = byId(DB.sesiones,+id); S.ui.hg = {p:s.prog,c:s.ciclo,s:s.sec,t:s.turno}; S.tab.horarios = "prog"; render(); sesForm(s) },
  publish(){ const g = grupoSel(); DB.publicados[gkey(g.p,g.c,g.s,g.t)] = {fecha:nowStamp(), por:S.user.nom};
    DB.estudiantes.filter(e => e.prog === g.p && e.ciclo === g.c && e.sec === g.s && e.turno === g.t).forEach(e => { const u = HOST.users().find(z => z.vin === "est:"+e.id); if(u) notify("u:"+u.id,"Se publicó el horario de tu sección","horarios") });
    [...new Set(sesGrupo(g).map(s => s.doc))].forEach(d => { const u = HOST.users().find(z => z.vin === "doc:"+d); if(u) notify("u:"+u.id,`Se publicó el horario de ${prog(g.p).cod} ${g.c}-${g.s}`,"horarios") });
    log("Publicar","Horarios",`${prog(g.p).cod} ${g.c}-${g.s} ${g.t} ${DB.cfg.periodo}`); if(!save())return false; toast("Horario publicado. Estudiantes y docentes ya pueden consultarlo."); render() },
  unpublish(){ const g = grupoSel(); delete DB.publicados[gkey(g.p,g.c,g.s,g.t)]; log("Retirar publicación","Horarios",`${prog(g.p).cod} ${g.c}-${g.s} ${g.t}`); if(!save())return false; toast("Publicación retirada. El horario volvió a borrador."); render() },
  hPDF(){ const g = grupoSel(); horarioPDF(`${prog(g.p).cod} ciclo ${g.c} sección ${g.s}`, sesGrupo(g), g.t) },
  hXLS(){ const g = grupoSel(); horarioXLS(`${prog(g.p).cod} ciclo ${g.c} sección ${g.s}`, sesGrupo(g), g.t) },
  hdPDF(){ const d = myDoc() || docente(S.ui.hdoc || DB.docentes[0].id); horarioPDF(`Docente ${d.nom}`, DB.sesiones.filter(s => s.doc === d.id && s.per === DB.cfg.periodo), null, true) },
  hdXLS(){ const d = myDoc() || docente(S.ui.hdoc || DB.docentes[0].id); horarioXLS(`Docente ${d.nom}`, DB.sesiones.filter(s => s.doc === d.id && s.per === DB.cfg.periodo), null, true) },
  hePDF(){ const e = myEst(); horarioPDF(`${prog(e.prog).cod} ciclo ${e.ciclo} sección ${e.sec}`, DB.sesiones.filter(s => s.per === DB.cfg.periodo && s.prog === e.prog && s.ciclo === e.ciclo && s.sec === e.sec && s.turno === e.turno), e.turno) },
  heXLS(){ const e = myEst(); horarioXLS(`${prog(e.prog).cod} ciclo ${e.ciclo} sección ${e.sec}`, DB.sesiones.filter(s => s.per === DB.cfg.periodo && s.prog === e.prog && s.ciclo === e.ciclo && s.sec === e.sec && s.turno === e.turno), e.turno) },
  valXLS(){ exportXLSX(`validacion_horarios_${fileStamp()}.xlsx`, ["Severidad","Tipo","Detalle"], validar().map(v => [v.t === "bad" ? "Error" : "Advertencia", v.tipo, v.msg]), "Validaciones") },
  /* certificados y títulos */
  pickEst(id){ S.ui.cq = id; render() },
  docCert(id){ docCert(est(+id)) },
  pdfCert(id){ pdfCert(+id) },
  newCertFor(id){ crudForm("certs", null, {est:+id}) },
  repCertXLS(){ exportXLSX(`certificaciones_${fileStamp()}.xlsx`, ["N.º certificado","DNI","Estudiante","Programa","Módulo","Fecha"], DB.certs.map(c => { const e = est(c.est), m = byId(DB.modulos,c.mod) || {}; return [c.num, e.dni, e.nom, prog(e.prog).cod, `${m.cod} ${m.nombre}`, fd(c.fecha)] }), "Certificaciones") },
  docTit(id){ docTit(+id) },
  pdfTit(id){ pdfTit(+id) },
  /* reclamos */
  gesRec(id){ gestionReclamo(+id) },
  docRec(id){ docRec(+id) },
  pdfRec(id){ pdfRec(+id) },
  repRecXLS(){ exportXLSX(`reclamos_${fileStamp()}.xlsx`, ["N.º","Fecha","Tipo","Usuario","DNI","Área","Descripción","Responsable","Estado","Vence","Respuesta"], DB.reclamos.map(x => [x.num, fd(x.fecha), x.tipo, x.nom, x.dni, areaN(x.area), x.desc, x.resp, x.estado, fd(plazoRec(x).due), x.respuesta]), "Reclamos") },
  /* mesa de partes */
  gesExp(id){ gestionExp(+id) },
  verExp(id){ const x = byId(HOST.exps(),+id); openModal({title:`Expediente ${x.num}`, body:`<dl class="dl"><dt>Trámite</dt><dd>${esc(tram(x.tramite).nombre)}</dd><dt>Asunto</dt><dd>${esc(x.asunto)}</dd><dt>Área actual</dt><dd>${esc(areaN(x.area))}</dd><dt>Estado</dt><dd>${estPill(x.estado)}</dd><dt>Plazo</dt><dd>${fd(plazoExp(x).due)}</dd></dl><h3>Historial</h3>${timeline(x)}`}) },
  docCargo(id){ docCargo(+id) },
  pdfCargo(id){ pdfCargo(+id) },
  repExpXLS(){ const rows = S.last.exp || HOST.exps(); exportXLSX(`expedientes_${fileStamp()}.xlsx`, ["Expediente","Código","Fecha","Solicitante","DNI/RUC","Tipo doc.","Trámite","Asunto","Área","Estado","Vence"], rows.map(x => [x.num, x.cod, fd(x.fecha), x.sol, x.dni, x.tipoDoc, tram(x.tramite).nombre, x.asunto, areaN(x.area), x.estado, fd(plazoExp(x).due)]), "Expedientes") },
  /* bolsa */
  postular(id){ const e = myEst(), p = perfilLab(e.id), o = byId(DB.ofertas,+id);
    if(!p.cv){ toast("Primero sube tu CV en “Mi perfil profesional”."); S.tab.bolsa = "perfil"; render(); return }
    confirmBox("Confirmar postulación", `Postularás a <b>${esc(o.puesto)}</b> en ${esc(empresa(o.emp).nom)} con tu perfil y el CV <b>${esc(p.cv.n)}</b>.`, "Postular", () => {
      DB.postulaciones.push({id:nextId(DB.postulaciones), of:o.id, est:e.id, fecha:today(), estado:"Recibida"});
      const u = HOST.users().find(z => z.vin === "emp:"+o.emp); if(u) notify("u:"+u.id, `Nueva postulación a “${o.puesto}”`, "bolsa");
      log("Postular","Bolsa laboral",`${e.dni} → ${o.puesto}`); if(!save())return false; toast("Postulación enviada. La empresa revisará tu perfil."); render() }) },
  retirarPost(id){ confirmBox("Retirar postulación","Se retirará tu postulación a esta oferta.","Retirar",() => { DB.postulaciones = DB.postulaciones.filter(p => p.id !== +id); log("Retirar postulación","Bolsa laboral",String(id)); if(!save())return false; toast("Postulación retirada."); render() }) },
  valOf(id){ const o = byId(DB.ofertas,+id); o.estado = "Publicada"; const u = HOST.users().find(z => z.vin === "emp:"+o.emp); if(u) notify("u:"+u.id,`Tu oferta “${o.puesto}” fue aprobada y publicada`,"bolsa");
    DB.estudiantes.filter(e => !o.prog || e.prog === o.prog).forEach(e => { const us = HOST.users().find(z => z.vin === "est:"+e.id); if(us) notify("u:"+us.id,`Nueva oferta laboral: ${o.puesto}`,"bolsa") });
    if(!empresa(o.emp).validada) toast("Oferta aprobada. Recuerde validar también a la empresa para que sea visible."); else toast("Oferta aprobada y publicada.");
    log("Aprobar","Bolsa laboral",o.puesto); if(!save())return false; render() },
  rejOf(id){ const o = byId(DB.ofertas,+id); o.estado = "Rechazada"; const u = HOST.users().find(z => z.vin === "emp:"+o.emp); if(u) notify("u:"+u.id,`Tu oferta “${o.puesto}” no fue aprobada`,"bolsa"); log("Rechazar","Bolsa laboral",o.puesto); if(!save())return false; toast("Oferta rechazada."); render() },
  valEmp(id){ const e = byId(DB.empresas,+id); e.validada = true; const u = HOST.users().find(z => z.vin === "emp:"+e.id); if(u) notify("u:"+u.id,"Tu empresa fue validada por el instituto","bolsa"); log("Validar","Bolsa laboral",e.nom); if(!save())return false; toast(`${e.nom} validada.`); render() },
  verPerfilLab(id){ verPerfilLab(+id) },
  editPerfilLab(){ editPerfilLab() },
  repPostXLS(){ exportXLSX(`postulaciones_${fileStamp()}.xlsx`, ["Postulante","DNI","Programa","Oferta","Empresa","Fecha","Estado"], DB.postulaciones.map(p => { const s = est(p.est), o = byId(DB.ofertas,p.of); return [s.nom, s.dni, prog(s.prog).cod, o.puesto, empresa(o.emp).nom, fd(p.fecha), p.estado] }), "Postulaciones") },
  /* docentes */
  openDoc(id){ if(S.mode === "public"){ openModal({title:"Perfil docente", wide:true, body:perfilDocHtml(+id).replace(/<div class="btnrow">[\s\S]*?<\/div>/, "")}); return } S.view = "docentes"; S.ui.dsel = +id; render(); window.scrollTo(0,0) },
  closeDoc(){ S.ui.dsel = null; render() },
  editDoc(id){ editDoc(+id) },
  /* sistema */
  resetPass(id){ location.hash = "#/admin/usuarios/server-" + id; },
  resetPerms(){ confirmBox("Restaurar permisos","Se restaurará la matriz de permisos por defecto para todos los roles.","Restaurar",() => { DB.perms = structuredClone(HOST.defaultPermissions()); log("Restaurar permisos","Usuarios","Matriz por defecto"); if(!save())return false; toast("Permisos restaurados."); render() }) },
  backup(){ HOST.openBackups(); },
  resetDemo(){ HOST.openBackups(); }
};

const CHANGES = {
  uEst(el){ S.ui.uEst = el.value; render() },
  uToggle(el){ if(lvl("usuarios") < 2) return; const u = byId(HOST.users(), +el.dataset.id); if(!u || u.id === S.user.id){ render(); return } u.estado = el.checked ? "Activo" : "Inactivo"; log(el.checked ? "Activar cuenta" : "Desactivar cuenta","Usuarios",u.u); if(!save())return false; toast(`Cuenta ${u.u} ${el.checked ? "activada" : "desactivada"}.`); setTimeout(render) },
  uCopy(el){ if(lvl("usuarios") < 2 || !el.value) return; const r = el.dataset.id, from = el.value; confirmBox("Copiar permisos", `El rol <b>${esc(ROLES[r])}</b> tendrá los mismos permisos que <b>${esc(ROLES[from])}</b>.`, "Copiar", () => { MODS.forEach(([k]) => { if(!permLocked(r,k)) DB.perms[r][k] = (DB.perms[from]||{})[k] || 0 }); log("Copiar permisos","Usuarios",`${ROLES[from]} → ${ROLES[r]}`); if(!save())return false; toast(`Permisos de ${ROLES[from]} copiados a ${ROLES[r]}.`); render() }); el.value = "" },
  docColorPick(el){ setDocs({color:el.value.toLowerCase()}, "Color de los documentos actualizado.") },
  docImg(el){ const f = el.files && el.files[0], k = el.dataset.id; if(!f || lvl("config") < 2) return;
    if(!/^image\/(png|jpeg|svg\+xml|webp)$/.test(f.type)){ toast("El archivo debe ser una imagen PNG, JPG, SVG o WEBP."); el.value = ""; return }
    if(f.size > 1024 * 1024){ toast(`La imagen pesa ${Math.round(f.size/1024)} KB. Use una de hasta 1 MB.`); el.value = ""; return }
    imgToPng(f, k === "firmaImg" ? 500 : 400).then(img => setDocs({[k]:img}, k === "firmaImg" ? "Firma actualizada." : "Logo actualizado.")).catch(() => toast("No se pudo leer la imagen. Intente con otro archivo.")) },
  hg(){ S.ui.hg = {p:+$("#hg_p").value, c:$("#hg_c").value, s:$("#hg_s").value, t:$("#hg_t").value}; render() },
  hdoc(el){ S.ui.hdoc = +el.value; render() },
  hamb(el){ S.ui.hamb = +el.value; render() },
  recF(el){ S.ui.recF = el.value; render() },
  mArea(el){ S.ui.mArea = el.value; render() },
  mEst(el){ S.ui.mEst = el.value; render() },
  bSolo(el){ S.ui.bSolo = el.checked; render() },
  bm(el){ S.ui.bm = el.value; render() },
  bqIni(el){ const t = el.dataset.id, v = el.value; if(!/^\d{2}:\d{2}$/.test(v)) return; setTimeout(() => setBloq(t, {ini:v}, `empieza a las ${v}`)) },
  bqDur(el){ setBloq(el.dataset.id, {dur:+el.value}, `cada hora dura ${el.value} min`) },
  bqRecMin(el){ const [t,h] = el.dataset.id.split("|"); const c = bloqCfg(t); setBloq(t, {recs:c.recs.map(r => r.after === +h ? {after:r.after, min:+el.value} : r)}, `receso de ${el.value} min después de la ${h}.ª hora`) },
  apColor(el){ if(lvl("config") < 2) return; let v = el.value.trim(); if(!v.startsWith("#")) v = "#" + v; if(!HEX.test(v)){ toast("Escriba el color en formato #RRGGBB, por ejemplo #1D4F9C."); setTimeout(render); return } const w = Object.assign(webC(), {[el.dataset.id]: v.toLowerCase()}); log("Cambiar apariencia","Configuración",`Color ${el.dataset.id}: ${v}`); setTimeout(() => setAp({web:w})) },
  apLogo(el){ const f = el.files && el.files[0]; if(!f || lvl("config") < 2) return;
    if(!/^image\/(png|jpeg|svg\+xml|webp)$/.test(f.type)){ toast("El archivo debe ser una imagen PNG, JPG, SVG o WEBP."); el.value = ""; return }
    if(f.size > 300 * 1024){ toast(`La imagen pesa ${Math.round(f.size/1024)} KB. Use una de hasta 300 KB.`); el.value = ""; return }
    const rd = new FileReader(); rd.onload = () => { log("Cambiar apariencia","Configuración",`Logo: ${f.name}`); setAp({logo:String(rd.result)}, "Logo actualizado.") }; rd.onerror = () => toast("No se pudo leer la imagen. Intente con otro archivo."); rd.readAsDataURL(f) },
  postEst(el){ const p = byId(DB.postulaciones,+el.dataset.id); p.estado = el.value; const u = HOST.users().find(z => z.vin === "est:"+p.est); if(u) notify("u:"+u.id,`Tu postulación a “${byId(DB.ofertas,p.of).puesto}” está: ${p.estado}`,"bolsa"); log("Actualizar postulación","Bolsa laboral",`${est(p.est).dni} → ${p.estado}`); if(!save())return false; toast("Estado de la postulación actualizado. El postulante puede consultar el estado en su intranet."); render() },
  perm(el){ const [r,k] = el.dataset.id.split("|"); DB.perms[r][k] = +el.value; log("Cambiar permiso","Usuarios",`${ROLES[r]} · ${k} → ${["Sin acceso","Consulta","Gestión"][+el.value]}`); if(!save())return false; toast(`Permiso actualizado para ${ROLES[r]}.`); render() },
  restore(el){el.value='';HOST.openBackups();}
};

const FORMS = {
  docsCfg(form){ if(lvl("config") < 2) return; const g = n => form.querySelector(`[name=${n}]`);
    setDocs({sub:g("sub").value.trim(), lema:g("lema").value.trim(), firma:g("firma").checked, firmaNom:g("firmaNom").value.trim(), firmaCargo:g("firmaCargo").value.trim(), pie:g("pie").value.trim()}, "Textos de los documentos guardados.") },

  apTxt(form){ if(lvl("config") < 2) return; const t = form.querySelector("[name=titulo]").value.trim(); if(!t){ toast("Escriba un título para la intranet."); return } log("Cambiar apariencia","Configuración",`Título: ${t}`); setAp({titulo:t.slice(0,40)}, "Título actualizado.") },
  login(form){
    const u = form.querySelector("[name=lu]").value.trim(), p = form.querySelector("[name=lp]").value;
    const usr = HOST.users().find(x => x.u.toLowerCase() === u.toLowerCase() || (x.dni && x.dni === u));
    const err = m => { $("#loginErr").innerHTML = `<div class="alert bad">${m}</div>` };
    if(!u || !p) return err("Ingrese usuario y contraseña.");
    if(!usr || usr.pass !== p){ log("Acceso fallido","Seguridad",u); if(!save())return false; return err("Usuario o contraseña incorrectos.") }
    if(usr.estado !== "Activo") return err("Su cuenta está inactiva. Comuníquese con el administrador de la intranet.");
    doLogin(usr);
  },
  cq(form){ S.ui.cq = form.querySelector("[name=cq]").value.trim(); render() },
  tq(form){ S.ui.tq = form.querySelector("[name=tq]").value.trim(); render() },
  mq(form){ S.ui.mq = form.querySelector("[name=mq]").value.trim(); render() },
  vq(form){ S.ui.vq = form.querySelector("[name=vq]").value.trim(); if(S.ui.vqr && String(S.ui.vqr.c).toUpperCase() !== S.ui.vq.toUpperCase()) S.ui.vqr = null; render() },
  reclamo(form){
    const fields = RECF(), {vals, errs} = readFields(fields, form);
    if(!showErrs(form, errs)) return;
    if(!form.querySelector("#rAcepto").checked){ toast("Debe aceptar la declaración para registrar el reclamo."); return }
    DB.seq.rec++; const num = `R-${today().slice(0,4)}-${String(DB.seq.rec).padStart(4,"0")}`;
    const x = Object.assign({id:nextId(DB.reclamos), num, fecha:today(), resp:"", respuesta:"", estado:"Recibido"}, vals);
    DB.reclamos.unshift(x); notify("r:adm",`Nuevo ${x.tipo.toLowerCase()} ${num} (${x.area})`,"reclamos"); notify("r:admin",`Nuevo ${x.tipo.toLowerCase()} ${num}`,"reclamos");
    log("Registrar","Reclamos",num); if(!save())return false; render();
    docRec(x.id); toast(`${x.tipo} ${num} registrado. La constancia está disponible para descargar.`);
  },
  exp(form){
    const fields = EXPF(), {vals, errs} = readFields(fields, form);
    if(!form.querySelector("#eAcepto").checked) $("#eAceptoErr").textContent = "Debe aceptar la notificación electrónica."; else $("#eAceptoErr").textContent = "";
    if(!showErrs(form, errs) || !form.querySelector("#eAcepto").checked) return;
    DB.seq.exp++; let cod; do{ cod = genCode() }while(HOST.exps().some(e => e.cod === cod));
    const x = Object.assign({id:nextId(HOST.exps()), num:`EXP-${today().slice(0,4)}-${String(DB.seq.exp).padStart(6,"0")}`, cod, fecha:nowStamp(), area:"MP", estado:"Recibido", hist:[[nowStamp(),"Recibido","MP","Registro por mesa de partes virtual"]]}, vals);
    HOST.exps().unshift(x); notify("r:adm",`Expediente ${x.num} recibido: ${tram(x.tramite).nombre}`,"mesa"); notify("r:admin",`Expediente ${x.num} recibido`,"mesa");
    log("Registrar","Mesa de partes",x.num); if(!save())return false; render(); docCargo(x.id); toast(`Documento recibido: ${x.num}. Guarde su código de seguimiento.`);
  },
  async regEmp(form){
    if(form.dataset.sending)return;
    const fields=[...EMP_REG_FIELDS(),{k:"pass",req:true,pat:[/^.{12,}$/,"Mínimo 12 caracteres."]}];
    const {vals,errs}=readFields(fields,form);
    if(vals.ruc&&!errs.ruc&&!rucValido(vals.ruc))errs.ruc="El RUC no es válido.";
    const decl=form.querySelector("#empDecl");if(!decl?.checked)errs.ruc="Debes aceptar la declaración jurada.";
    if(!showErrs(form,errs))return;
    form.dataset.sending='true';const controls=[...form.elements,...document.querySelectorAll('.pz-mt [data-tab]')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);const progress=form.querySelector('[data-company-progress]');if(progress)progress.hidden=false;const button=form.querySelector('[type=submit]');const original=button?.textContent;if(button){button.disabled=true;button.textContent='Registrando empresa, espera un momento…';}
    const preventLeave=event=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',preventLeave);portalSubmissionStatus('Registrando empresa. Espera un momento y no cierres la página.');
    try{const result=await HOST.registerCompany({...vals,declaration:decl.checked});DB.empresas.push(result.company);render();portalSubmissionStatus('Empresa registrada correctamente.');
      openModal({title:"Empresa registrada",body:`<div class="alert ok">${esc(result.company.nom)} quedó pendiente de validación institucional.</div><p>Tu usuario es <b>${esc(result.username)}</b>. Entra con la contraseña que acabas de elegir.</p>`,foot:'<a class="btn" href="#/admin">Ingresar a la intranet</a>'});
    }catch(error){toast(error.message);portalSubmissionStatus(error.message);}finally{window.removeEventListener('beforeunload',preventLeave);delete form.dataset.sending;controls.forEach(([el,disabled])=>el.disabled=disabled);if(progress)progress.hidden=true;if(button)button.textContent=original;}
  },
  empSelf(form){
    const e = myEmp(), fields = ENT.empresas.fields().filter(f => f.k !== "validada" && f.k !== "ruc"), {vals, errs} = readFields(fields, form);
    if(!showErrs(form, errs)) return; Object.assign(e, vals); S.user.nom = e.nom; log("Editar","Bolsa laboral",`Empresa ${e.nom}`); if(!save())return false; toast("Datos de la empresa actualizados."); render();
  },
  cfg(form){
    if(lvl("config")<2)return;
    const fields = [{k:"periodo",req:true,pat:PAT_PER}];
    const {vals, errs} = readFields(fields, form); if(!showErrs(form, errs)) return;
    const chg = vals.periodo !== DB.cfg.periodo; Object.assign(DB.cfg, vals); log("Editar","Configuración","Datos institucionales"); if(!save())return false;
    toast(chg ? `Configuración guardada. Periodo vigente: ${vals.periodo}. La programación de horarios se muestra para ese periodo.` : "Configuración guardada."); render();
  }
};

/* ---------- delegación de eventos ---------- */
document.addEventListener("click", e => { if(!(e.target && e.target.closest && e.target.closest(".ix"))) return;
  const t = e.target.closest("button,[data-go],[data-mclose],label[for]");
  if(S.ui.dd && !e.target.closest(".dd") && !(t && (t.dataset.act === "bell" || t.dataset.act === "account"))){ S.ui.dd = null; render(); if(!t) return }
  if(S.ui.menu && !e.target.closest("#side") && !(t && t.dataset.act === "menu")){ S.ui.menu = false; render(); if(!t) return }
  if(!t) return;
  const d = t.dataset;
  if(d.mclose !== undefined){ if(e.target === t || t.tagName === "BUTTON"){ e.preventDefault(); closeModal() } return }
  if(t.disabled) return;
  if(d.go){ closeModal(); go(d.go); return }
  if(d.tab){ const [v,k] = d.tab.split(":"); S.tab[v] = k; render(); return }
  if(d.new){ crudForm(d.new); return }
  if(d.edit){ const [ek,id] = d.edit.split(":"); crudForm(ek, byId(DB[ENT[ek].col], +id)); return }
  if(d.del){ const [ek,id] = d.del.split(":"); crudDelete(ek, +id); return }
  if(d.xls){ exportTableXLS(d.xls); return }
  if(d.pdf){ exportTablePDF(d.pdf); return }
  if(d.act && ACTIONS[d.act]){ e.preventDefault(); ACTIONS[d.act](d.id, t) }
});
document.addEventListener("input", e => { if(!(e.target && e.target.closest && e.target.closest(".ix"))) return;  const k = e.target.dataset && e.target.dataset.q; if(k !== undefined){ S.q[k] = e.target.value; render() } });
document.addEventListener("change", e => { if(!(e.target && e.target.closest && e.target.closest(".ix"))) return;  const k = e.target.dataset && e.target.dataset.chg; if(k && CHANGES[k]) CHANGES[k](e.target) });
document.addEventListener("submit", e => { if(!(e.target && e.target.closest && e.target.closest(".ix"))) return;
  e.preventDefault();
  if(e.target.id === "mform"){ if(MODAL && MODAL.onSubmit){ const ok = MODAL.onSubmit(e.target); if(ok){ closeModal(); render() } } return }
  const k = e.target.dataset.form; if(k && FORMS[k]) FORMS[k](e.target);
});
document.addEventListener("keydown", e => { if(e.key === "Escape"){ if(MODAL || ($("#ixmodal") && $("#ixmodal").innerHTML)){ closeModal(); return } if(S.ui.dd || S.ui.menu){ S.ui.dd = null; S.ui.menu = false; render() } } });

/* ---------- integración con el portal ---------- */
ACTIONS.toLogin = () => HOST.go("login");
ACTIONS.toPublic = ACTIONS.toPublicApp = () => { location.hash = "#/" };
ACTIONS.logout = () => HOST.logout();
function syncDocentes(){ const ps = HOST.docentes(); DB.docentes.forEach(d => { const p = ps.find(x => x.id === d.per); if(p){ d.nom = p.nom; d.dni = p.dni; d.correo = p.correo; d.esp = p.esp; d.cond = p.cond } }) }
function sync(){
  DB.publicados = Object.assign({}, DB.publicados || {});
  DB.perms = DB.perms || {}; Object.entries({admin:2, dir:1, acad:2, adm:1}).forEach(([r,v]) => { DB.perms[r] = DB.perms[r] || {}; if(DB.perms[r].alumnos == null) DB.perms[r].alumnos = v });
  const i = HOST.inst(); Object.assign(DB.cfg, {nombre:i.nombre, siglas:i.siglas, director:i.director, direccion:i.direccion, web:i.web});
  DB.progMap = DB.progMap || {};
  HOST.programas().forEach(p => { let id = DB.progMap[p.pid]; if(!id){ id = Math.max(0, ...Object.values(DB.progMap), ...DB.programas.map(x => x.id)) + 1; DB.progMap[p.pid] = id }
    let x = DB.programas.find(y => y.id === id); if(!x){ x = {id, cod:p.pid.toUpperCase(), dur:"3 años", sem:6}; DB.programas.push(x) }
    Object.assign(x, {nombre:p.nombre, activo:p.activo, pid:p.pid}) });
  syncDocentes(); rebuildSlots();
}
function setUser(){ S.user = HOST.user() }
V["pub:bolsa"] = () => { const T = tabs("pubbolsa", [["ofertas","Ofertas laborales vigentes"],["empresa","Registro de empresas"]]); return T.html + (T.cur === "empresa" ? registroEmpresa() : ofertasPublicas()) };
rebuildSlots();
return {
  contracts(){ return Object.fromEntries(Object.entries(ENT).filter(([,v])=>v.fields).map(([key,v])=>[key,{collection:v.col,fields:v.fields().map(f=>({name:f.k,type:f.t||'text',required:!!f.req,unique:!!f.uniq,min:f.min??null,max:f.max??null,pattern:f.pat?.source||null}))}])); },
  view(v){ sync(); setUser(); S.view = v; return renderView() },
  can(v){ setUser(); return !!S.user && lvl(v) > 0 },
  close: closeModal,
  cargoCode(ref, persona){ const doc=emitDoc("cargo",ref,persona);return doc?doc.cod:""; },
  cargoPdf(o){
    if(!(window.jspdf && window.jspdf.jsPDF)) return null;
    const doc = pdfNew(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14, col = hexRgb(docColor()), G = [22,128,61];
    let y = pdfHeader(doc, "CARGO DE RECEPCIÓN", "Mesa de Partes Virtual · Constancia de ingreso de documento");
    // número de expediente y sello de recepción
    doc.setFillColor(240,244,250); doc.setDrawColor(...col); doc.setLineWidth(.4); doc.roundedRect(M, y, W-2*M, 27, 2, 2, "FD");
    doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(95); doc.text("N.º DE EXPEDIENTE", M+5, y+7);
    doc.setFont("helvetica","bold"); doc.setFontSize(21); doc.setTextColor(...col); doc.text(o.num, M+5, y+17.5);
    doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(70); doc.text("Código de verificación:", M+5, y+23.5);
    const cw0 = doc.getTextWidth("Código de verificación: "); doc.setFont("courier","bold"); doc.setFontSize(10); doc.setTextColor(25); doc.text(o.cod, M+5+cw0, y+23.5);
    const sx = W-M-60, sy = y+3.5; doc.setDrawColor(...G); doc.setLineWidth(.8); doc.roundedRect(sx, sy, 56, 20, 2, 2); doc.setLineWidth(.3); doc.roundedRect(sx+1.2, sy+1.2, 53.6, 17.6, 1.5, 1.5);
    doc.setTextColor(...G); doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.text("RECIBIDO", sx+28, sy+8, {align:"center"});
    doc.setFontSize(7.5); doc.text(o.fechaCorta, sx+28, sy+12.8, {align:"center"}); doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.text("MESA DE PARTES VIRTUAL", sx+28, sy+16.8, {align:"center"});
    doc.setLineWidth(.2); y += 35;
    const room = need => { if(y + need > H - 22){ doc.addPage(); y = 20 } };
    const sec = (n, t) => { room(16); doc.setFillColor(...col); doc.rect(M, y-4.2, 1.6, 6, "F"); doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.setTextColor(25); doc.text(`${n}. ${t}`, M+4, y+.4); doc.setDrawColor(215,222,230); doc.line(M+4+doc.getTextWidth(`${n}. ${t}`)+3, y-1, W-M, y-1); y += 5.5 };
    const grid = pairs => { const cw = (W-2*M-6)/2; for(let i=0;i<pairs.length;){ const row = pairs[i][2] ? [pairs[i++]] : pairs.slice(i, i += 2); let h = 0;
      row.forEach(([k,v,full], j) => { const x = M + j*(cw+6), w = full ? W-2*M : cw; doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(110); doc.text(k.toUpperCase(), x, y); doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(25); const t = doc.splitTextToSize(String(v || "—"), w); room(4.3*t.length + 4); doc.text(t, x, y+4.3); h = Math.max(h, 4.3*t.length + 5.2) });
      y += h } y += 1 };
    sec(1, "Datos del remitente");
    grid([["Nombres y apellidos / razón social", o.sol], ["Documento de identidad", o.docTxt], ["Correo electrónico (notificaciones)", o.correo], ["Teléfono", o.tel]]);
    sec(2, "Datos del trámite");
    grid([["Tipo de trámite", o.tramite], ["N.º de folios", o.folios], ["Fecha y hora de registro", o.fechaTxt], ["Fecha de recepción efectiva", o.efectivaTxt], ["Área responsable", o.area], ["Estado actual", o.estado], ["Plazo de atención", o.plazoDias + " días hábiles"], ["Fecha límite de atención", o.vence]]);
    sec(3, "Asunto");
    { doc.setFont("helvetica","normal"); doc.setFontSize(9.5); const t = doc.splitTextToSize(o.asunto, W-2*M-8); room(5*t.length + 8); doc.setFillColor(247,249,251); doc.setDrawColor(220,226,232); doc.roundedRect(M, y-3, W-2*M, 5*t.length + 5, 1.5, 1.5, "FD"); doc.setTextColor(35); doc.text(t, M+4, y+2); y += 5*t.length + 7 }
    sec(4, "Documento adjunto");
    grid([["Archivo", `${o.archivo.n} · ${o.archivo.s} · PDF`, 1]].concat(o.archivo.sha ? [["Huella digital SHA-256 (integridad del archivo)", o.archivo.sha, 1]] : []));
    if(o.hist.length && doc.autoTable){ sec(5, "Seguimiento del expediente"); y = pdfTable(doc, y-2, ["Fecha y hora","Estado","Detalle"], o.hist, {styles:{fontSize:7.8, cellPadding:1.4, textColor:30, lineColor:[210,218,215]}, columnStyles:{0:{cellWidth:32},1:{cellWidth:34}}}) + 7 }
    // consulta en línea con QR e indicaciones
    room(46); doc.setDrawColor(...col); doc.setLineWidth(.4); doc.roundedRect(M, y, W-2*M, 42, 2, 2); doc.setLineWidth(.2);
    pdfQR(doc, o.url, M+5, y+5, 32);
    const tx = M+43, tw = W-M-5-tx; let ty = y+7;
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...col); doc.text("Consulte el estado de su trámite en línea", tx, ty); ty += 5;
    doc.setFont("helvetica","normal"); doc.setFontSize(8.3); doc.setTextColor(50);
    [`Escanee el código QR o ingrese a Mesa de Partes Virtual › Consultar expediente con el N.º ${o.num} y su documento de identidad o el código ${o.cod}.`,
     "Conserve este cargo: es la constancia de presentación de su documento.",
     "Los documentos ingresados después de las 5:00 p.m. o en días no hábiles se consideran recibidos el siguiente día hábil.",
     `La autenticidad de este cargo se verifica en “Consulta y verificación de documentos” con el código ${o.cod}.`].forEach(s => { const t = doc.splitTextToSize("• " + s, tw); doc.text(t, tx, ty); ty += 3.7*t.length + .8 });
    y += 47;
    doc.setFont("helvetica","italic"); doc.setFontSize(7.5); doc.setTextColor(120); doc.text(doc.splitTextToSize(`${o.inst.nombre} · ${o.inst.direccion} · Telf. ${o.inst.telefono} · ${o.inst.correo}`, W-2*M)[0], W/2, Math.min(y, H-18), {align:"center"});
    pdfFooter(doc); return doc.output("blob");
  },
  findDoc(cod){ const d = DB.docs.find(x => x.cod === String(cod || "").trim().toUpperCase()); return d ? {cod:d.cod, tipo:DOC_T[d.tipo] || d.tipo, persona:d.persona, fecha:d.fecha, valido:d.valido !== false} : null },
  areas(){ return DB.areas.filter(a => a.activo).map(a => [a.cod, a.nombre]) },
  areasFull(){ return DB.areas.map(a => Object.assign({}, a)) },
  tramitesFull(){ return (DB.tramites || []).map(t => Object.assign({}, t)) },
  db(){ return DB },
  persist(){ return save() },
  notifyTo(to, txt, go){ notify(to, txt, go) },
  logAct(a, m, d){ log(a, m, d) },
  nextIdOf(col){ return nextId(DB[col]) },
  vinOpts(){ return vinOpts() },
  findEst(k){ k = String(k || "").trim(); const e = k && DB.estudiantes.find(x => x.dni === k); return e ? {id:e.id, dni:e.dni, nom:e.nom, estado:e.estado} : null },
  estById(id){ const e = byId(DB.estudiantes, +id); return e ? {id:e.id, dni:e.dni, nom:e.nom, estado:e.estado} : null },
  stats(){ const v = validar(); return {est:cnt(DB.estudiantes, e => e.estado === "Regular"), ses:cnt(DB.sesiones, s => s.per === DB.cfg.periodo), err:cnt(v, x => x.t === "bad"), certs:DB.certs.length, tit:DB.titulos.length, ofertas:cnt(DB.ofertas, o => o.estado === "Publicada" && o.limite >= today()), porValidar:cnt(DB.ofertas, o => o.estado === "Por validar") + cnt(DB.empresas, e => !e.validada), periodo:DB.cfg.periodo} },
  init(){ sync(); save() }
};

}
