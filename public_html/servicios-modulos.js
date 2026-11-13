/* Páginas independientes de Horarios (/horarios.php) y CV docente (/cv-docente.php), con el mismo marco que Mesa de partes,
   Libro de reclamaciones y Bolsa laboral (standalone-services.js). Comparten la sesión y la API de la intranet:
   el servidor sigue verificando los permisos de cada perfil. */
'use strict';
(function(){
if(typeof R!=='function')return;
const loginBox=(id,title,text,who)=>`<section class="panel standalone-login" id="${id}"><h2>${title}</h2><p>${text}</p><form data-mod-login novalidate><div class="form-grid"><div class="field"><label for="ml-u">${who}</label><input id="ml-u" name="username" required autocomplete="username"></div><div class="field"><label for="ml-p">Contraseña</label><input id="ml-p" name="password" required type="password" autocomplete="current-password"></div></div><p role="alert" data-mod-login-error style="color:#b42318;min-height:1.2em"></p><button class="btn" type="submit">Ingresar</button><p class="note">¿Olvidaste tu contraseña? <button type="button" data-pw-reset style="background:none;border:0;padding:0;color:var(--link,#1a5fae);text-decoration:underline;cursor:pointer;font:inherit">Restablécela con un código a tu correo</button>.</p></form></section>`;
const accountBar=label=>`<div class="standalone-account"><span>${esc(currentUser().nombre)}</span><button type="button" class="btn sec sm" data-mod-logout>${label}</button></div>`;
function bindLogin(){
 const form=document.querySelector('[data-mod-login]');
 if(form)form.onsubmit=async ev=>{ev.preventDefault();const b=form.querySelector('[type=submit]'),err=form.querySelector('[data-mod-login-error]');err.textContent='';
  if(!form.username.value.trim()||!form.password.value){err.textContent='Completa usuario y contraseña.';return;}
  b.disabled=true;
  try{const r=await fetch(portalURL('/api/session'),{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-TOKEN':portalBootstrap.csrf},body:JSON.stringify({username:form.username.value.trim(),password:form.password.value})});
   let d={};try{d=await r.json();}catch(e){}if(!r.ok)throw new Error(d.message||'No se pudo iniciar sesión.');location.reload();}
  catch(e){err.textContent=e.message;b.disabled=false;}};
 document.querySelectorAll('[data-mod-logout]').forEach(b=>b.onclick=()=>{try{portalRequest('DELETE','/api/session');}catch(e){}location.reload();});
 // Los enlaces a la intranet se abren como botones (la página independiente desactiva los enlaces internos).
 document.querySelectorAll('[data-mod-intranet]').forEach(b=>b.onclick=()=>{location.href='/#/admin/'+b.dataset.modIntranet;});
}
const STAFF_NOTE=(mod,label)=>`<section class="panel"><h2>Gestión de ${label}</h2><div class="pb"><p>Tu perfil administra este módulo. La gestión completa se realiza en la intranet.</p><button type="button" class="btn" data-mod-intranet="${mod}">Abrir ${label} en la intranet</button></div></section>`;

/* ---------- Horarios ---------- */
R('servicios/horarios',()=>{
 const u=currentUser();const per=(IX&&IX.db&&IX.db().cfg&&IX.db().cfg.periodo)||'';
 let body;
 if(!u)body=loginBox('mod-acceso','Consulta tu horario','Docentes y estudiantes: ingresa con tu cuenta institucional (estudiantes con su DNI) para ver tu horario publicado.','Usuario o DNI');
 else if(!can('ix-horarios'))body=accountBar('Cambiar de usuario')+`<section class="panel"><h2>Horarios</h2><div class="pb"><p>Los horarios se publican para docentes y estudiantes en curso. ${['egresado','empresa'].includes(u.rol)?'Tu cuenta es de '+(u.rol==='egresado'?'egresado':'empresa')+': no tiene un horario asignado.':'Tu perfil no tiene acceso al módulo de horarios.'}</p></div></section>`;
 else if(['docente','estudiante','egresado'].includes(u.rol))body=accountBar('Salir de Horarios')+ixWrap(IX.view('horarios'));
 else body=accountBar('Salir')+STAFF_NOTE('ix-horarios','Horarios');
 const html=`<main class="wrap"><section class="panel" style="margin-bottom:18px"><div class="pb"><h1 style="margin:0 0 6px">Horarios académicos</h1><p style="margin:0">Programación por sección${per?` · periodo <b>${esc(per)}</b>`:''}. Cada docente y estudiante ve solo su propio horario publicado.</p></div></section>${body}</main>`;
 return {html,after:bindLogin};
});

/* ---------- CV docente ---------- */
const directory=ROUTES['nosotros/plana-docente'];
R('servicios/cv-docente',(path,q)=>{
 const u=currentUser();
 let access;
 if(!u)access=loginBox('mod-acceso','Acceso docente','Ingresa con tu cuenta de docente para actualizar tu CV: formación, experiencia, certificaciones y proyectos.','Usuario');
 else if(can('cvdocente')&&u.rol==='docente')access=accountBar('Salir')+`<section class="panel"><h2>Mi CV docente</h2><div class="pb"><p>Actualiza tu formación, experiencia, certificaciones y proyectos, y elige qué se publica en el directorio.</p><button type="button" class="btn" data-mod-intranet="cvdocente">Editar mi CV</button></div></section>`;
 else if(can('cvdocente'))access=accountBar('Salir')+STAFF_NOTE('cvdocente','CV docente');
 else access=accountBar('Cambiar de usuario')+`<section class="panel"><h2>CV docente</h2><div class="pb"><p>Este acceso es para docentes y para el personal que administra los CV.</p></div></section>`;
 // Directorio público de docentes (solo información profesional publicada).
 let dir='';let dirAfter=null;
 if(typeof directory==='function'){
  const out=directory('nosotros/plana-docente',q||new URLSearchParams());const res=typeof out==='string'?{html:out}:out||{};
  const t=document.createElement('template');t.innerHTML=res.html||'';const main=t.content.querySelector('main');
  if(main&&!/no encontrada|pertenece a la web/i.test(main.textContent)){main.querySelectorAll('.pz-svnav,.mainnav,.intra-directory-nav,.crumbs,.side,aside,.pz-ptabs').forEach(n=>n.remove());dir=`<section class="mod-directorio" style="margin-top:24px">${main.innerHTML}</section>`;dirAfter=res.after;}
 }
 if(!dir)dir='<section class="panel" style="margin-top:24px"><h2>Directorio docente</h2><p>El directorio se publicará cuando el instituto lo habilite.</p></section>';
 const html=`<main class="wrap"><section class="panel" style="margin-bottom:18px"><div class="pb"><h1 style="margin:0 0 6px">CV docente</h1><p style="margin:0">Directorio profesional de la plana docente y acceso de cada docente a su CV.</p></div></section>${access}${dir}</main>`;
 return {html,after:()=>{
  bindLogin();
  try{dirAfter&&dirAfter();}catch(e){}
  // Filtros del directorio dentro de esta misma página.
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>go('#/servicios/cv-docente?p='+b.dataset.cat));
  const f=document.querySelector('[data-ps]');if(f)f.onsubmit=e=>{e.preventDefault();const p=new URLSearchParams(location.hash.split('?')[1]||'').get('p')||'';go('#/servicios/cv-docente?'+(p?'p='+encodeURIComponent(p)+'&':'')+'q='+encodeURIComponent(e.target.q.value.trim()));};
 }};
});
})();
