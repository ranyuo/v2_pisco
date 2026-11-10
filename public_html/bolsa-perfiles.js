/* Bolsa Laboral (Informe N.º 011, observación 5).
   - Diseño configurable de la página pública: «actual» (sin cambios) o «perfiles», con cuatro tarjetas de ingreso
     (Estudiante/Egresado, Docente, Administrador y Empresa). Cada tarjeta solo admite su tipo de cuenta (el servidor lo exige).
   - Docente: ve las ofertas vigentes y recomienda estudiantes o egresados; la empresa y el administrador ven las recomendaciones.
   - Carga masiva por Excel de empresas y ofertas (la de estudiantes y egresados ya existía), con cualquiera de los dos diseños.
   Se carga antes de standalone-services.js para que /bolsa-laboral.php también muestre el diseño elegido. */
'use strict';
(function(){
if(typeof R!=='function'||typeof ROUTES!=='object'||!ROUTES['servicios/bolsa-laboral'])return;

/* Utilidades locales: las de assets/app/portal-3.js están encapsuladas y no son accesibles desde aquí. */
const XD=()=>IX.db();
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fdx=d=>d?fshort(String(d).length===10?d+'T12:00:00':d):'—';
const nrm=s=>String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const xemp=id=>(XD().empresas.find(e=>e.id===id)||{nom:'—'});
const xprog=id=>(XD().programas.find(p=>p.id===id)||{cod:'—',nombre:'—'});
const rucOk=r=>{r=String(r||'');if(!/^(10|15|17|20)\d{9}$/.test(r))return false;const w=[5,4,3,2,7,6,5,4,3,2];const s=w.reduce((a,x,i)=>a+x*+r[i],0);let d=11-s%11;if(d===10)d=0;if(d===11)d=1;return d===+r[10];};
const bHead=(sub,crumb)=>admHead('Bolsa laboral',sub,`<a class="btn ghost" href="#/servicios/bolsa-laboral" target="_blank">${sic('globe')} Ver bolsa pública</a>`,'briefcase',[['Servicios'],['Bolsa laboral','#/admin/ix-bolsa']].concat(crumb?[[crumb]]:[]));
function canWriteAcademic(module){const u=currentUser();if(!u)return false;if(u.rol==='admin')return true;const key={bolsa:'ix-bolsa'}[module];return !!key&&can(key)&&Number(XD().perms?.[IX_ROLE[u.rol]]?.[module]||0)>=2;}
function checkUpload(file,exts,maxMB){const ext=(file.name.split('.').pop()||'').toLowerCase();if(!exts.includes(ext))return `«${file.name}»: formato .${ext} no permitido. Formatos: ${exts.map(e=>e.toUpperCase()).join(', ')}.`;if(file.size>maxMB*1048576)return `«${file.name}» supera ${maxMB} MB.`;if(!file.size)return `«${file.name}» está vacío.`;return '';}
function excelDate(v){if(v instanceof Date&&!isNaN(v))return ymd(v);if(typeof v==='number'&&v>59&&v<80000)return new Date(Math.round((v-25569)*86400000)).toISOString().slice(0,10);const s=String(v||'').trim();let m=s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);if(m)return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[0]:'';}
// Programa por nombre, código o sigla del catálogo del portal (p. ej. «Contabilidad», «APSTI», «Hostelería»).
function progFromText(t){const text=nrm(t);if(!text)return '';const cat=(DB.programas||[]);const direct=cat.find(p=>[p.id,p.codigo,p.nombre].some(v=>nrm(v)===text));if(direct)return direct.id;const partial=cat.find(p=>nrm(p.nombre).includes(text)||text.includes(nrm(p.nombre)));if(partial)return partial.id;
 const aliases=[[/comput|informat|apsti|plataforma|tecnologias de (la )?informacion|sistemas/,'apsti'],[/contab/,'cont'],[/enferm/,'enf'],[/agropecu|agrari|agronom/,'pa'],[/hostel|restaur|ashr|gastron|hotel/,'ashr']];for(const[re,id]of aliases)if(re.test(text)&&cat.some(p=>p.id===id))return id;return '';}
async function readSheet(file){
 const ext=(file.name.split('.').pop()||'').toLowerCase();
 if(window.XLSX){const isCSV=ext==='csv';const content=isCSV?(await file.text()).replace(/^﻿/,''):await file.arrayBuffer();const wb=XLSX.read(content,{type:isCSV?'string':'array',cellDates:true,...(isCSV?{raw:true}:{})});return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:'',raw:true});}
 if(ext!=='csv')throw new Error('Para leer archivos Excel se requiere la librería XLSX. Puede usar la plantilla en CSV.');
 const lines=(await file.text()).replace(/^﻿/,'').split(/\r?\n/).filter(l=>l.trim());const sep=(lines[0].match(/;/g)||[]).length>=(lines[0].match(/,/g)||[]).length?';':',';
 const cells=l=>{const out=[];let cur='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===sep&&!q){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out.map(s=>s.trim());};
 const h=cells(lines[0]);return lines.slice(1).map(l=>{const c=cells(l);const o={};h.forEach((k,i)=>o[k]=c[i]||'');return o;});
}

const PERFILES=[
 {k:'estudiante',label:'Estudiante/Egresado',icon:'grad',text:'Postula a las ofertas con tu DNI y tu CV.',user:'DNI',hint:'Tu DNI y la contraseña que te entregó Secretaría Académica.'},
 {k:'docente',label:'Docente',icon:'book',text:'Revisa las ofertas y recomienda a tus estudiantes y egresados.',user:'Usuario',hint:'Tu usuario docente de la intranet.'},
 {k:'administrador',label:'Administrador',icon:'gear',text:'Gestiona ofertas, empresas, postulaciones y cargas masivas.',user:'Usuario',hint:'Tu usuario del personal del instituto.'},
 {k:'empresa',label:'Empresa',icon:'building',text:'Publica convocatorias y revisa a tus postulantes.',user:'RUC',hint:'El RUC y la contraseña con que registraste tu empresa.'}];
const TITULO_DEF='Bienvenido a la Bolsa Laboral';
const PF=k=>PERFILES.find(p=>p.k===k);
const cfg=()=>{const c=window.pzBolsaCfg();if(c.diseno!=='perfiles')c.diseno='actual';if(typeof c.titulo!=='string')c.titulo=TITULO_DEF;if(!c.perfiles||typeof c.perfiles!=='object'||Array.isArray(c.perfiles))c.perfiles={};return c;};
const fotoDe=k=>(cfg().perfiles[k]||{}).img||'';
const hoy=()=>ymd(new Date());
const D=()=>{const d=XD();if(!Array.isArray(d.recomendaciones))d.recomendaciones=[];return d;};
const binding=(u,type)=>{const m=String(u?.vin||'').match(new RegExp('^'+type+':(\\d+)$'));return m?+m[1]:null;};
const vigentes=()=>{const d=D();return d.ofertas.filter(o=>o.estado==='Publicada'&&o.limite>=hoy()&&(d.empresas.find(e=>e.id===o.emp)||{}).validada).sort((a,b)=>a.limite.localeCompare(b.limite));};
const docName=id=>(D().docentes.find(x=>x.id===id)||{}).nom||'Docente';
const condLabel=e=>e.estado==='Regular'?'Estudiante':(e.estado||'');
// Identificadores amplios: el docente solo ve sus propias recomendaciones y no debe chocar con las de otros.
const newRecId=()=>{let id;const used=new Set(D().recomendaciones.map(r=>r.id));do{id=Date.now()*100+Math.floor(Math.random()*100);}while(used.has(id));return id;};

/* ---------- Página pública: diseño con cuatro perfiles ---------- */
function cardsHTML(){
 const c=cfg();
 return `<section class="bl-pf" aria-labelledby="bl-pf-t"><h2 id="bl-pf-t" class="bl-pf-t">${esc(c.titulo||TITULO_DEF)}</h2><p class="bl-pf-s">Elige tu perfil para ingresar a la Bolsa Laboral de ${esc(inst().nombreCorto||inst().nombre)}.</p>
 <div class="bl-pf-g">${PERFILES.map(p=>{const f=fotoDe(p.k);return `<article class="bl-pf-c" data-bl-card="${p.k}"><div class="bl-pf-i">${f?`<img src="${esc(img(f))}" alt="" loading="lazy" decoding="async">`:`<span class="bl-pf-ic" aria-hidden="true">${sic(p.icon,64)}</span>`}</div>
  <div class="bl-pf-b"><button type="button" class="bl-pf-btn" data-bl-perfil="${p.k}">${sic(p.icon,18)}<span>${esc(p.label)}</span></button><p>${esc(p.text)}</p></div></article>`;}).join('')}</div></section>`;
}
function loginModal(k){
 const p=PF(k);if(!p)return;
 const u=currentUser();
 if(u){
  const ok=k==='estudiante'?['estudiante','egresado'].includes(u.rol):k==='administrador'?!['docente','estudiante','egresado','empresa'].includes(u.rol):u.rol===k;
  if(ok)return goSpace();
  return modal({title:'Sesión iniciada con otro perfil',body:`<p>Ya iniciaste sesión como <b>${esc(u.nombre)}</b>. Para ingresar como <b>${esc(p.label)}</b>, primero cierra la sesión actual.</p>`,foot:`<button type="button" class="btn" data-bl-out>Cerrar sesión</button>`}).el.querySelector('[data-bl-out]').onclick=()=>{try{portalRequest('DELETE','/api/session');}catch(e){}location.reload();};
 }
 const m=modal({title:`Ingreso · ${esc(p.label)}`,body:`<form class="bl-lg" data-bl-login novalidate><p class="note">${esc(p.hint)}</p>
  <div class="field"><label for="bl-u">${esc(p.user)}</label><input id="bl-u" name="username" required maxlength="80" autocomplete="username" ${p.user==='DNI'?'inputmode="numeric"':p.user==='RUC'?'inputmode="numeric"':''}></div>
  <div class="field"><label for="bl-p">Contraseña</label><input id="bl-p" name="password" type="password" required maxlength="72" autocomplete="current-password"></div>
  <p class="bl-lg-err" data-bl-err role="alert"></p>
  <div class="bl-lg-a"><button class="btn" type="submit">${sic('key',16)} Ingresar</button>${k==='empresa'?'<button type="button" class="btn ghost" data-bl-reg>Registrar mi empresa</button>':''}</div></form>`,size:'sm'});
 const form=m.el.querySelector('[data-bl-login]'),err=m.el.querySelector('[data-bl-err]');
 const reg=m.el.querySelector('[data-bl-reg]');if(reg)reg.onclick=()=>{m.close();const b=document.querySelector('.pz-mt [data-tab="e"]');if(b){b.click();b.scrollIntoView({behavior:'smooth',block:'start'});}};
 form.onsubmit=async ev=>{
  ev.preventDefault();err.textContent='';
  if(!form.username.value.trim()||!form.password.value){err.textContent='Completa '+p.user+' y contraseña.';return;}
  const btn=form.querySelector('[type=submit]');btn.disabled=true;
  try{
   const r=await fetch(portalURL('/api/session'),{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-TOKEN':portalBootstrap.csrf},body:JSON.stringify({username:form.username.value.trim(),password:form.password.value,perfil:k})});
   let data={};try{data=await r.json();}catch(e){}
   if(!r.ok)throw new Error(data.message||'No se pudo iniciar sesión.');
   goSpace(true);
  }catch(e){err.textContent=e.message;btn.disabled=false;}
 };
}
// Todos los perfiles continúan en su espacio de Bolsa Laboral dentro de la intranet.
function goSpace(reload){
 const target='/#/admin/ix-bolsa';
 if(location.pathname==='/'||location.pathname==='/index.php'){location.hash='#/admin/ix-bolsa';if(reload)location.reload();else if(typeof route==='function')route();}
 else location.href=target;
}
const baseRoute=ROUTES['servicios/bolsa-laboral'];
R('servicios/bolsa-laboral',(...args)=>{
 const out=baseRoute(...args);
 if(cfg().diseno!=='perfiles')return out;
 const res=typeof out==='string'?{html:out}:out;
 const t=document.createElement('template');t.innerHTML=res.html;
 const top=t.content.querySelector('.pz-mpv-top');
 const box=document.createElement('template');box.innerHTML=cardsHTML();
 if(top)top.replaceWith(box.content);else{const main=t.content.querySelector('main')||t.content;main.prepend(box.content);}
 return Object.assign({},res,{html:t.innerHTML,after:()=>{res.after&&res.after();document.querySelectorAll('[data-bl-perfil]').forEach(b=>b.onclick=()=>loginModal(b.dataset.blPerfil));}});
});

/* ---------- Intranet: pestañas adicionales de la Bolsa Laboral ---------- */
const TAB_LIST=[['p','Panel','#/admin/ix-bolsa'],['g','Convocatorias y postulaciones','#/admin/ix-bolsa/gestion'],['e','Validación de empresas','#/admin/ix-bolsa/empresas'],['r','Padrón de estudiantes y egresados','#/admin/ix-bolsa/padron'],['s','Seguimiento de egresados','#/admin/ix-bolsa/egresados'],['c','Carga masiva','#/admin/ix-bolsa/carga'],['w','Página pública','#/admin/ix-bolsa/pagina']];
const myTabs=a=>tabsBar(TAB_LIST,a);
function withTabs(out,active){
 const res=typeof out==='string'?{html:out}:out;if(!res||typeof res.html!=='string')return out;
 const t=document.createElement('template');t.innerHTML=res.html;
 const tabs=t.content.querySelector('.tabs[role=tablist]');
 if(tabs&&tabs.querySelector('a[href="#/admin/ix-bolsa/padron"]')){const n=document.createElement('template');n.innerHTML=myTabs(active);tabs.replaceWith(n.content);}
 return Object.assign({},res,{html:t.innerHTML});
}
const canEditPage=()=>['admin','atencion'].includes(currentUser()?.rol);
const baseCustom=CUSTOM['ix-bolsa'];
CUSTOM['ix-bolsa']=(parts,q)=>{
 const u=currentUser();
 if(u&&u.rol==='docente'&&IX&&IX.db)return docenteBolsa(q);
 if(u&&u.rol==='empresa'&&IX&&IX.db){const out=baseCustom(parts,q);const res=typeof out==='string'?{html:out}:out;return Object.assign({},res,{html:res.html+empresaRecs()});}
 if(isCommunity()||!IX||!IX.db)return baseCustom(parts,q);
 const t=parts[2]||'';
 if(t==='pagina')return paginaPublica();
 if(t==='carga')return cargaMasiva(q);
 const out=withTabs(baseCustom(parts,q),{'':'p',gestion:'g',empresas:'e',padron:'r',egresados:'s'}[t]||'p');
 if(t==='')return Object.assign({},out,{html:out.html+adminRecs()});
 return out;
};

/* ---------- Página pública (configuración) ---------- */
let PAGE_WORK=null;
function paginaPublica(){
 const c=cfg();PAGE_WORK=PAGE_WORK||{diseno:c.diseno,titulo:c.titulo,perfiles:JSON.parse(JSON.stringify(c.perfiles||{}))};const W=PAGE_WORK;const ro=!canEditPage();
 const html=bHead('Diseño de la página pública de la Bolsa Laboral','Página pública')+myTabs('w')+`
 <form class="panel" data-bl-page><h2>Diseño de la página pública</h2><div class="pb">
  <p>Elige cómo se presenta la Bolsa Laboral en la web (<code>/#/servicios/bolsa-laboral</code> y <code>/bolsa-laboral.php</code>). El cambio se aplica al guardar y no modifica ofertas, empresas ni postulaciones.</p>
  <div class="bl-opt">${[['actual','Diseño actual','Encabezado con las cifras de la bolsa, ofertas, registro de empresas y «¿Cómo postular?».'],['perfiles','Diseño con perfiles','Portada con cuatro tarjetas de ingreso: Estudiante/Egresado, Docente, Administrador y Empresa. Debajo se mantienen las ofertas, el registro de empresas y «¿Cómo postular?».']].map(([v,l,d])=>`<label class="bl-opt-i"><input type="radio" name="diseno" value="${v}" ${W.diseno===v?'checked':''} ${ro?'disabled':''}><span><b>${l}</b><small>${d}</small></span></label>`).join('')}</div>
  <div class="field" style="margin-top:14px"><label for="bl-tt">Título de la portada con perfiles</label><input id="bl-tt" name="titulo" maxlength="120" value="${esc(W.titulo)}" ${ro?'disabled':''}></div>
  <h3 style="margin:18px 0 6px">Fotos de las tarjetas</h3><p class="note">Se recomienda una foto horizontal o cuadrada de al menos 800 px. Sin foto, la tarjeta muestra el ícono del perfil.</p>
  <div class="bl-ph">${PERFILES.map(p=>{const f=(W.perfiles[p.k]||{}).img||'';return `<div class="bl-ph-i"><div class="bl-pf-i">${f?`<img src="${esc(img(f))}" alt="Foto de la tarjeta ${esc(p.label)}">`:`<span class="bl-pf-ic" aria-hidden="true">${sic(p.icon,48)}</span>`}</div><b>${esc(p.label)}</b>
   <div class="bl-ph-a"><label class="btn sm sec ${ro?'disabled':''}">${sic('upload',14)} ${f?'Cambiar foto':'Subir foto'}<input type="file" accept="image/*" data-bl-img="${p.k}" hidden ${ro?'disabled':''}></label>${f&&!ro?`<button type="button" class="btn sm ghost" data-bl-rm="${p.k}">Quitar</button>`:''}</div></div>`;}).join('')}</div>
  ${ro?'<p class="note">Tu perfil puede consultar esta configuración. La modifican el administrador o Atención al ciudadano.</p>':''}
  <div class="bl-lg-a" style="margin-top:16px"><button class="btn" type="submit" ${ro?'disabled':''}>${sic('check',16)} Guardar diseño</button><button type="button" class="btn ghost" data-bl-cancel ${ro?'disabled':''}>Descartar cambios</button><a class="btn ghost" href="#/servicios/bolsa-laboral" target="_blank">${sic('globe',16)} Ver bolsa pública</a></div>
 </div></form>`;
 return {html,after:()=>{
  const f=document.querySelector('[data-bl-page]');if(!f)return;
  f.querySelectorAll('input[name=diseno]').forEach(r=>r.onchange=()=>{W.diseno=r.value;});
  f.titulo.oninput=()=>{W.titulo=f.titulo.value;};
  f.querySelectorAll('[data-bl-img]').forEach(inp=>inp.onchange=async()=>{const file=inp.files[0];if(!file)return;const er=checkFile(file,'image');if(er){inp.value='';return toast(er,'err');}
   try{const data=await compressImage(file,1200,{q:.85});W.perfiles[inp.dataset.blImg]={img:data};route();}catch(e){toast('No se pudo procesar la imagen.','err');}});
  f.querySelectorAll('[data-bl-rm]').forEach(b=>b.onclick=()=>{W.perfiles[b.dataset.blRm]={img:''};route();});
  f.querySelector('[data-bl-cancel]').onclick=()=>{PAGE_WORK=null;route();};
  f.onsubmit=ev=>{ev.preventDefault();if(ro)return;const c=cfg();const prev={diseno:c.diseno,titulo:c.titulo,perfiles:c.perfiles};
   const titulo=String(W.titulo||'').trim().slice(0,120)||TITULO_DEF;
   Object.assign(c,{diseno:W.diseno==='perfiles'?'perfiles':'actual',titulo,perfiles:Object.fromEntries(PERFILES.map(p=>[p.k,{img:(W.perfiles[p.k]||{}).img||''}]))});
   audit('Configuración','Bolsa laboral',`Diseño de la página pública: ${c.diseno==='perfiles'?'con perfiles':'actual'}`);
   if(saveDB()){PAGE_WORK=null;toast(`Diseño guardado: ${c.diseno==='perfiles'?'con perfiles':'actual'}.`,'ok');route();}else Object.assign(c,prev);
  };
 }};
}

/* ---------- Docente: ofertas vigentes y recomendaciones ---------- */
function docenteBolsa(q){
 const u=currentUser(),d=D(),doc=binding(u,'doc');const tab=q&&q.get&&q.get('tab')==='mias'?'mias':'ofertas';
 const mine=d.recomendaciones.filter(r=>r.doc===doc).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
 const ofs=vigentes();
 const head=admHead('Bolsa laboral','Ofertas vigentes y recomendaciones a estudiantes y egresados','','briefcase',[['Servicios'],['Bolsa laboral']]);
 const tabs=tabsBar([['ofertas','Ofertas vigentes','#/admin/ix-bolsa'],['mias',`Mis recomendaciones (${mine.length})`,'#/admin/ix-bolsa?tab=mias']],tab);
 const warn=doc?'':'<div class="notice warn" style="margin-bottom:14px">Tu cuenta no está vinculada a un docente de la plana académica, por eso no puedes registrar recomendaciones. Solicita a Secretaría Académica que la vincule en <b>Usuarios y roles</b>.</div>';
 let body;
 if(tab==='ofertas')body=ofs.length?`<div class="bl-of">${ofs.map(o=>{const n=mine.filter(r=>r.of===o.id).length;return `<article class="panel bl-of-c"><div class="pb"><h3>${esc(o.puesto)}</h3><p class="note">${esc(xemp(o.emp).nom)} · ${esc(o.modal)} · ${o.prog?esc(xprog(o.prog).nombre):'Cualquier programa'} · ${+o.vac||1} vacante(s) · cierra ${fdx(o.limite)}</p><p>${esc(String(o.desc||'').slice(0,240))}${String(o.desc||'').length>240?'…':''}</p>
  <div class="bl-lg-a">${doc?`<button type="button" class="btn sm" data-bl-rec="${o.id}">${sic('star',15)} Recomendar</button>`:''}${n?`<span class="badge ok">${n} recomendado(s) por ti</span>`:''}</div></div></article>`;}).join('')}</div>`:'<div class="empty">No hay ofertas vigentes por el momento.</div>';
 else body=mine.length?`<div class="panel"><div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>Fecha</th><th>Oferta</th><th>Recomendado</th><th>Motivo</th><th></th></tr></thead><tbody>${mine.map(r=>{const o=d.ofertas.find(x=>x.id===r.of)||{};const e=d.estudiantes.find(x=>x.id===r.est)||{};return `<tr><td>${fdx(r.fecha)}</td><td><b>${esc(o.puesto||'—')}</b><br><small>${esc(xemp(o.emp).nom)}</small></td><td>${esc(e.nom||'—')}<br><small>${esc(condLabel(e))}${e.prog?' · '+esc(xprog(e.prog).cod):''}</small></td><td>${esc(r.motivo||'')}</td><td class="c"><button type="button" class="btn xs ghost" data-bl-del="${r.id}">Retirar</button></td></tr>`;}).join('')}</tbody></table></div></div>`:'<div class="empty">Aún no registras recomendaciones. Ve a «Ofertas vigentes» y presiona «Recomendar».</div>';
 return {html:head+tabs+warn+body,after:()=>{
  document.querySelectorAll('[data-bl-rec]').forEach(b=>b.onclick=()=>recomendar(+b.dataset.blRec));
  document.querySelectorAll('[data-bl-del]').forEach(b=>b.onclick=async()=>{const r=D().recomendaciones.find(x=>x.id===+b.dataset.blDel);if(!r)return;if(!await confirmBox('¿Retirar esta recomendación? La empresa dejará de verla.',{ok:'Retirar'}))return;
   const list=D().recomendaciones;const i=list.indexOf(r);list.splice(i,1);if(IX.persist()){toast('Recomendación retirada.','ok');route();}else list.splice(i,0,r);});
 }};
}
function recomendar(ofId){
 const d=D(),u=currentUser(),doc=binding(u,'doc');const o=d.ofertas.find(x=>x.id===ofId);if(!o||!doc)return;
 const ya=new Set(d.recomendaciones.filter(r=>r.of===ofId&&r.doc===doc).map(r=>r.est));
 const people=d.estudiantes.filter(e=>['Regular','Egresado','Titulado'].includes(e.estado)&&(!o.prog||e.prog===o.prog)&&!ya.has(e.id)).sort((a,b)=>String(a.nom).localeCompare(String(b.nom)));
 const opts=list=>list.map(e=>`<option value="${e.id}">${esc(e.nom)} · ${esc(condLabel(e))} · ${esc(xprog(e.prog).cod)}</option>`).join('');
 const m=modal({title:'Recomendar para la oferta',body:`<form class="bl-lg" data-bl-recf novalidate><p><b>${esc(o.puesto)}</b><br><span class="note">${esc(xemp(o.emp).nom)}${o.prog?' · solo '+esc(xprog(o.prog).nombre):''}</span></p>
  ${people.length?`<div class="field"><label for="bl-rq">Buscar persona</label><input id="bl-rq" type="search" placeholder="Escribe un nombre" autocomplete="off"></div>
  <div class="field"><label for="bl-re">Estudiante o egresado</label><select id="bl-re" name="est" required size="6">${opts(people)}</select></div>
  <div class="field"><label for="bl-rm">Motivo de la recomendación (opcional)</label><textarea id="bl-rm" name="motivo" rows="4" maxlength="500" placeholder="Ej.: Destacó en las prácticas de laboratorio y en trabajo en equipo."></textarea><div class="hint" data-bl-n>0 / 500</div></div>
  <p class="bl-lg-err" data-bl-err role="alert"></p><div class="bl-lg-a"><button class="btn" type="submit">${sic('send',16)} Enviar recomendación</button></div>`:'<p class="notice">No hay estudiantes ni egresados disponibles para esta oferta (o ya los recomendaste a todos).</p>'}</form>`});
 const f=m.el.querySelector('[data-bl-recf]');if(!people.length)return;
 const sel=f.est,qs=f.querySelector('#bl-rq');qs.oninput=()=>{const t=nrm(qs.value);sel.innerHTML=opts(people.filter(e=>!t||nrm(e.nom).includes(t)));};
 f.motivo.oninput=()=>{f.querySelector('[data-bl-n]').textContent=`${f.motivo.value.length} / 500`;};
 f.onsubmit=ev=>{ev.preventDefault();const est=+sel.value;const err=f.querySelector('[data-bl-err]');if(!est){err.textContent='Selecciona a la persona que recomiendas.';return;}
  const rec={id:newRecId(),of:o.id,est,doc,fecha:hoy(),motivo:f.motivo.value.trim().slice(0,500)};
  D().recomendaciones.push(rec);
  if(IX.persist()){m.close();toast('Recomendación enviada. La empresa ya puede verla.','ok');route();}
  else{const list=D().recomendaciones;list.splice(list.indexOf(rec),1);err.textContent='No se pudo guardar la recomendación.';}
 };
}
function recsTable(rows,withCompany){
 const d=D();
 return `<div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>Fecha</th><th>Oferta</th>${withCompany?'<th>Empresa</th>':''}<th>Recomendado</th><th>Docente</th><th>Motivo</th></tr></thead><tbody>${rows.map(r=>{const o=d.ofertas.find(x=>x.id===r.of)||{};const e=d.estudiantes.find(x=>x.id===r.est)||{};return `<tr><td>${fdx(r.fecha)}</td><td><b>${esc(o.puesto||'—')}</b></td>${withCompany?`<td>${esc(xemp(o.emp).nom)}</td>`:''}<td>${esc(e.nom||'—')}<br><small>${esc(condLabel(e))}${e.prog?' · '+esc(xprog(e.prog).cod):''}${e.correo?' · '+esc(e.correo):''}</small></td><td>${esc(docName(r.doc))}</td><td>${esc(r.motivo||'')}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function empresaRecs(){
 const d=D(),emp=binding(currentUser(),'emp');if(!emp)return '';
 const mine=new Set(d.ofertas.filter(o=>o.emp===emp).map(o=>o.id));const rows=d.recomendaciones.filter(r=>mine.has(r.of)).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
 return `<section class="panel" style="margin-top:16px" data-bl-emprecs><h2>Recomendaciones de docentes (${rows.length})</h2><div class="pb">${rows.length?'<p class="note">Docentes del instituto recomiendan a estas personas para sus ofertas. Pueden invitarlas a postular.</p>'+recsTable(rows,false):'<p class="note">Aún no hay recomendaciones de docentes para sus ofertas.</p>'}</div></section>`;
}
function adminRecs(){
 const rows=D().recomendaciones.slice().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
 return `<div class="panel" style="margin-top:16px" data-bl-admrecs><h2><span>Recomendaciones de docentes (${rows.length})</span></h2><div class="pb">${rows.length?recsTable(rows.slice(0,20),true):'<p class="note">Los docentes recomiendan estudiantes y egresados desde su ingreso a la Bolsa Laboral.</p>'}</div></div>`;
}

/* ---------- Carga masiva por Excel: empresas y ofertas ---------- */
const KINDS={
 empresas:{label:'Empresas',file:'plantilla_empresas_bolsa',cols:['RUC','Razón social','Sector económico','Ubicación','Dirección fiscal','Persona de contacto','Cargo del contacto','Correo','Teléfono','Página web'],
  sample:[['20123456786','EMPRESA DE EJEMPLO S.A.C.','Servicios','Pisco, Ica','Av. Ejemplo 123, Pisco','Nombre Apellido','Jefe de recursos humanos','rrhh@empresa-ejemplo.pe','956000000','https://www.empresa-ejemplo.pe']],
  key:h=>{const t=nrm(h);if(/^ruc/.test(t))return 'ruc';if(/razon|nombre de la empresa|empresa$/.test(t))return 'nom';if(/sector|rubro|actividad/.test(t))return 'sector';if(/ubicacion|distrito|provincia/.test(t))return 'ubic';if(/direccion|domicilio/.test(t))return 'dir';if(/cargo/.test(t))return 'cargoC';if(/contacto|responsable/.test(t))return 'contacto';if(/correo|email|e mail/.test(t))return 'correo';if(/telefono|celular|movil/.test(t))return 'tel';if(/web|pagina|red social/.test(t))return 'web';return null;},
  need:['ruc','nom']},
 ofertas:{label:'Ofertas laborales',file:'plantilla_ofertas_bolsa',cols:['RUC de la empresa','Puesto','Descripción','Requisitos','Modalidad','Programa de estudio','Vacantes','Fecha límite'],
  sample:[['20123456786','Asistente contable','Registro de comprobantes y apoyo en declaraciones mensuales.','Egresado de Contabilidad, manejo de Excel.','Presencial','Contabilidad','2','31/12/2026']],
  key:h=>{const t=nrm(h);if(/ruc/.test(t))return 'ruc';if(/puesto|cargo|convocatoria/.test(t))return 'puesto';if(/descripcion|funciones/.test(t))return 'desc';if(/requisito|perfil/.test(t))return 'req';if(/modalidad/.test(t))return 'modal';if(/programa|carrera|especialidad/.test(t))return 'prog';if(/vacante/.test(t))return 'vac';if(/limite|cierre|vence|fecha/.test(t))return 'limite';return null;},
  need:['ruc','puesto']}};
let CARGA=null;
function parseRows(kind,rows){
 const K=KINDS[kind],d=D();if(!rows.length)return {items:[],error:'El archivo no tiene filas.'};
 const keys=Object.keys(rows[0]).map(h=>[h,K.key(h)]);
 for(const n of K.need)if(!keys.some(x=>x[1]===n))return {items:[],error:`Falta la columna obligatoria «${K.cols[n==='ruc'?0:1]}». Use la plantilla.`};
 const seen=new Set(),today=hoy();
 const items=rows.map((r,i)=>{const o={};keys.forEach(([h,k])=>{if(k&&o[k]==null)o[k]=r[h];});const s=v=>String(v==null?'':v).trim().replace(/\s+/g,' ');const it={fila:i+2,errs:[],warns:[]};
  it.ruc=String(o.ruc==null?'':o.ruc).replace(/\D/g,'');
  if(kind==='empresas'){
   Object.assign(it,{nom:s(o.nom),sector:s(o.sector),ubic:s(o.ubic),dir:s(o.dir),contacto:s(o.contacto),cargoC:s(o.cargoC),correo:s(o.correo).toLowerCase(),tel:String(o.tel||'').replace(/\D/g,'').slice(-9),web:s(o.web)});
   if(!rucOk(it.ruc))it.errs.push('RUC no válido');else if(seen.has(it.ruc))it.errs.push('RUC repetido en el archivo');seen.add(it.ruc);
   it.existe=d.empresas.find(e=>e.ruc===it.ruc)||null;
   if(it.nom.length<3)it.errs.push('Falta la razón social');
   for(const [f,l] of [['sector','sector'],['ubic','ubicación'],['contacto','persona de contacto']])if(!it[f]&&!(it.existe&&it.existe[f]))it.errs.push('Falta '+l);
   if(!it.correo&&!(it.existe&&it.existe.correo))it.errs.push('Falta el correo');else if(it.correo&&!reEmail.test(it.correo))it.errs.push('Correo no válido');
   if(it.tel&&(it.tel.length<6||it.tel.length>9)){it.warns.push('Teléfono no válido (se omitirá)');it.tel='';}
   if(it.web&&!/^https?:\/\/\S+$/i.test(it.web)){it.warns.push('Página web sin http(s):// (se omitirá)');it.web='';}
  }else{
   Object.assign(it,{puesto:s(o.puesto),desc:String(o.desc||'').trim(),req:String(o.req||'').trim(),modalTxt:s(o.modal),progTxt:s(o.prog),vac:parseInt(String(o.vac||'1').replace(/\D/g,''),10)||1,limite:excelDate(o.limite)});
   const emp=d.empresas.find(e=>e.ruc===it.ruc)||null;it.emp=emp;
   if(!/^\d{11}$/.test(it.ruc))it.errs.push('RUC no válido');else if(!emp)it.errs.push('Empresa no registrada (cárguela antes en «Empresas»)');else if(!emp.validada)it.errs.push('Empresa sin validar');
   if(it.puesto.length<3)it.errs.push('Falta el puesto');if(!it.desc)it.errs.push('Falta la descripción');if(!it.req)it.errs.push('Faltan los requisitos');
   const m=nrm(it.modalTxt);it.modal=/remot|virtual/.test(m)?'Remoto':/hibrid|mixt|semipresencial/.test(m)?'Híbrido':/presencial/.test(m)||!m?'Presencial':'';if(!it.modal)it.errs.push('Modalidad no reconocida (Presencial, Híbrido o Remoto)');else if(!m)it.warns.push('Modalidad vacía: se asume Presencial');
   it.prog=null;if(it.progTxt&&!/^(todos|cualquier)/.test(nrm(it.progTxt))){const pid=progFromText(it.progTxt);it.prog=pid?(d.progMap||{})[pid]||null:null;if(!it.prog)it.errs.push('Programa no reconocido');}
   if(it.vac<1||it.vac>50)it.errs.push('Vacantes entre 1 y 50');
   if(!it.limite)it.errs.push('Fecha límite no válida');else if(it.limite<today)it.errs.push('La fecha límite ya pasó');
   const key=[it.ruc,nrm(it.puesto),it.limite].join('|');if(seen.has(key))it.errs.push('Oferta repetida en el archivo');seen.add(key);
   it.existe=emp?d.ofertas.find(x=>x.emp===emp.id&&nrm(x.puesto)===nrm(it.puesto)&&x.limite===it.limite)||null:null;
  }
  return it;});
 return {items};
}
function plantilla(kind){
 const K=KINDS[kind];const rows=[K.cols,...K.sample];
 if(window.XLSX){const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=K.cols.map(c=>({wch:Math.max(14,c.length+4)}));XLSX.utils.book_append_sheet(wb,ws,K.label.slice(0,30));
  const help=kind==='empresas'?['RUC: 11 dígitos con dígito verificador válido (obligatorio).','Razón social, sector, ubicación, persona de contacto y correo: obligatorios.','Las empresas cargadas quedan validadas por el instituto y aparecen como aliadas; para que ingresen, cree su cuenta en Usuarios y roles o pídales registrarse.','Si el RUC ya existe, se actualizan sus datos sin cambiar su validación.']:['RUC de la empresa: debe estar registrada y validada (cárguela antes en «Empresas»).','Puesto, descripción, requisitos y fecha límite (dd/mm/aaaa): obligatorios.','Modalidad: Presencial, Híbrido o Remoto.','Programa de estudio: nombre o sigla (vacío = cualquier programa).','Vacantes: de 1 a 50. Las ofertas cargadas quedan publicadas.'];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Instrucciones'],...help.map(x=>[x])]),'Instrucciones');XLSX.writeFile(wb,K.file+'.xlsx');}
 else downloadText(toCSV(rows),K.file+'.csv','text/csv');
}
function cargaMasiva(q){
 const kind=q&&q.get&&q.get('tipo')==='ofertas'?'ofertas':'empresas';const K=KINDS[kind];const P=CARGA&&CARGA.kind===kind?CARGA:null;const ok=P?P.items.filter(i=>!i.errs.length):[];const write=canWriteAcademic('bolsa');
 const sub=`<div class="bl-sub" role="group" aria-label="Tipo de carga"><a class="btn sm ghost" href="#/admin/ix-bolsa/padron">${sic('grad',15)} Estudiantes y egresados</a>${['empresas','ofertas'].map(k=>`<a class="btn sm ${k===kind?'':'ghost'}" href="#/admin/ix-bolsa/carga?tipo=${k}" ${k===kind?'aria-current="page"':''}>${sic(k==='empresas'?'building':'briefcase',15)} ${KINDS[k].label}</a>`).join('')}</div>`;
 const cols=kind==='empresas'?['Fila','RUC','Razón social','Sector','Contacto','Correo','Resultado']:['Fila','Empresa','Puesto','Modalidad','Programa','Vac.','Cierra','Resultado'];
 const cells=i=>kind==='empresas'?[i.fila,`<span class="mono">${esc(i.ruc)}</span>`,esc(i.nom),esc(i.sector),esc(i.contacto),esc(i.correo)]:[i.fila,esc(i.emp?i.emp.nom:i.ruc),esc(i.puesto),esc(i.modal||i.modalTxt),i.prog?esc(xprog(i.prog).cod):'Todos',i.vac,fdx(i.limite)];
 const html=bHead('Carga masiva por Excel: estudiantes y egresados, empresas y ofertas','Carga masiva')+myTabs('c')+sub+`
 <div class="panel"><h2>1. Descargue la plantilla de ${esc(K.label.toLowerCase())}</h2><div class="pb"><p>Columnas: ${K.cols.map(c=>`<code>${esc(c)}</code>`).join(' ')}. Se aceptan archivos <b>.xlsx, .xls o .csv</b>; el sistema reconoce los nombres de columna aunque varíen ligeramente.${kind==='ofertas'?' Las empresas deben estar registradas y validadas antes de cargar sus ofertas.':' Las empresas nuevas quedan validadas por el instituto; los RUC existentes se actualizan.'}</p><button type="button" class="btn sec" data-bl-tpl>${sic('download',16)} Descargar plantilla</button></div></div>
 <div class="panel"><h2>2. Suba el archivo y revise la validación</h2><div class="pb"><div class="field"><label for="bl-cf">Archivo de ${esc(K.label.toLowerCase())}</label><input id="bl-cf" type="file" accept=".xlsx,.xls,.csv" ${write?'':'disabled'}><div class="hint">Máx. 10 MB.${write?'':' Tu perfil dispone de consulta: la importación requiere permiso de edición de la Bolsa Laboral.'}</div></div><div data-bl-cmsg></div>
 ${P?`<div class="notice ${P.error?'err':''}" style="margin-top:12px" data-bl-csum>${P.error?esc(P.error):`<b>${esc(P.nombre)}</b>: ${P.items.length} fila(s) · <b>${ok.length}</b> válidas (${ok.filter(i=>i.existe).length} actualizaciones, ${ok.filter(i=>!i.existe).length} nuevas) · <b>${P.items.length-ok.length}</b> con errores.`}</div>
 ${P.items.length?`<div class="tbl-wrap" style="max-height:420px;overflow:auto;margin-top:10px"><table class="tbl light"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${P.items.map(i=>`<tr class="${i.errs.length?'pz-bad':''}">${cells(i).map(c=>`<td>${c}</td>`).join('')}<td>${i.errs.length?`<span class="badge err">${esc(i.errs.join('; '))}</span>`:`<span class="badge ok">${i.existe?'Actualiza':'Nueva'}</span>`}${i.warns.length?`<br><small>${esc(i.warns.join('; '))}</small>`:''}</td></tr>`).join('')}</tbody></table></div>
 <div class="bl-lg-a" style="justify-content:flex-end;margin-top:12px"><button type="button" class="btn ghost" data-bl-cx>Descartar</button><button type="button" class="btn" data-bl-ci ${ok.length&&write?'':'disabled'}>${sic('upload',16)} Importar ${ok.length} registro(s) válidos</button></div>`:''}`:''}</div></div>`;
 return {html,after:()=>{
  document.querySelector('[data-bl-tpl]').onclick=()=>plantilla(kind);
  const inp=document.querySelector('#bl-cf');
  inp.onchange=async ev=>{if(!write)return;const file=ev.target.files[0];if(!file)return;const e0=checkUpload(file,['xlsx','xls','csv'],10);if(e0){document.querySelector('[data-bl-cmsg]').innerHTML=`<div class="notice err">${esc(e0)}</div>`;return;}
   try{const rows=await readSheet(file);CARGA=Object.assign({kind,nombre:file.name},parseRows(kind,rows));}catch(err){CARGA={kind,nombre:file.name,items:[],error:'No se pudo leer el archivo: '+(err.message||err)};}route();};
  const x=document.querySelector('[data-bl-cx]');if(x)x.onclick=()=>{CARGA=null;route();};
  const im=document.querySelector('[data-bl-ci]');if(im)im.onclick=async()=>{
   if(!write)return;
   if(!await confirmBox(`Se importarán ${ok.length} registro(s) de ${K.label.toLowerCase()}: ${ok.filter(i=>!i.existe).length} nuevos y ${ok.filter(i=>i.existe).length} actualizaciones. ¿Continuar?`,{ok:'Importar',danger:false,title:'Carga masiva'}))return;
   const d=D(),u=currentUser(),snapshot=JSON.stringify([d.empresas,d.ofertas]);let nN=0,nU=0;
   if(kind==='empresas')ok.forEach(i=>{const data={nom:i.nom};for(const f of ['sector','ubic','dir','contacto','cargoC','correo','tel','web'])if(i[f])data[f]=i[f];
    if(i.existe){Object.assign(i.existe,data);nU++;}else{d.empresas.push(Object.assign({id:IX.nextIdOf('empresas'),ruc:i.ruc,sector:'',ubic:'',contacto:'',correo:''},data,{validada:true,estadoVal:'Aprobada',motivoRech:'',valPor:u.usuario,fechaVal:hoy(),origen:'Carga masiva'}));nN++;}});
   else ok.forEach(i=>{const data={emp:i.emp.id,puesto:i.puesto,desc:i.desc,req:i.req,modal:i.modal,prog:i.prog||'',vac:i.vac,limite:i.limite};
    if(i.existe){Object.assign(i.existe,data);nU++;}else{d.ofertas.push(Object.assign({id:IX.nextIdOf('ofertas'),fecha:hoy(),estado:'Publicada',origen:'Carga masiva'},data));nN++;}});
   IX.logAct('Carga masiva de '+K.label.toLowerCase(),'Bolsa laboral',`${CARGA.nombre}: ${nN} nuevos, ${nU} actualizados`);
   if(!IX.persist()){const [e,o]=JSON.parse(snapshot);d.empresas.splice(0,d.empresas.length,...e);d.ofertas.splice(0,d.ofertas.length,...o);return;}
   CARGA=null;toast(`${K.label}: ${nN} nuevo(s) y ${nU} actualizado(s).`,'ok');route();
  };
 }};
}
})();
