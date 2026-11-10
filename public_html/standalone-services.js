/* Servicios públicos con enlace propio (/mesa-de-partes.php, /libro-de-reclamaciones.php, /bolsa-laboral.php y
   /certificados.php): comparten la API y los datos, sin la navegación del portal ni de la intranet.
   En el portal principal (/) no se modifica nada. */
'use strict';
(function(){
if(!portalBootstrap.standaloneService)return;
const PUBLIC_SERVICE_PAGES={
 'servicios/mesa-de-partes':{title:'Mesa de partes virtual',entry:'/mesa-de-partes.php',accent:'#b94313'},
 'servicios/libro-de-reclamaciones':{title:'Libro de reclamaciones',entry:'/libro-de-reclamaciones.php',accent:'#a62d3a'},
 'servicios/bolsa-laboral':{title:'Bolsa laboral',entry:'/bolsa-laboral.php',accent:'#167568'},
 'servicios/consulta-certificados':{title:'Consulta de documentos',entry:'/certificados.php',accent:'#245487'}
};
const PUBLIC_SERVICE_ALIASES={'libro-de-reclamaciones':'servicios/libro-de-reclamaciones','transparencia/libro-de-reclamaciones':'servicios/libro-de-reclamaciones'};
function publicServicePath(){
 const hash=location.hash.replace(/^#\/?/,'').split('?')[0];
 return PUBLIC_SERVICE_ALIASES[hash]||hash||portalBootstrap.standaloneService||'';
}
function employmentServiceContext(){return publicServicePath()==='servicios/bolsa-laboral';}
window.PORTAL_EMPLOYMENT_CONTEXT=()=>employmentServiceContext()&&['estudiante','egresado','empresa'].includes(currentUser()?.rol)&&can('ix-bolsa');
function publicServiceHeader(path){
 const service=PUBLIC_SERVICE_PAGES[path];
 return `<header class="standalone-header"><div class="wrap"><div class="standalone-brand"><img src="${logoSrc()}" alt="Logotipo institucional"><span><strong>${esc(inst().nombreCorto||inst().nombre)}</strong><small>Servicio institucional en línea</small></span></div><span class="standalone-service-name">${service.title}</span></div></header>`;
}
function publicServiceFooter(path){return `<footer class="standalone-footer wrap"><span>${esc(inst().nombreCorto)} · ${PUBLIC_SERVICE_PAGES[path].title}</span><div><button type="button" data-service-policy="privacidad">Privacidad</button><button type="button" data-service-policy="terminos">Términos de uso</button></div></footer>`;}
function publicServicePolicy(key){
 const p=page(key);const title=key==='privacidad'?'Política de privacidad':'Términos de uso';
 modal({title,body:`<div class="prose">${p?sanitize(p.contenido):'<p>Solicita esta información a la institución.</p>'}</div>`});
 const box=document.querySelector('.modal-bg');if(box){cleanServiceLinks(box,publicServicePath());box.querySelectorAll('[data-service-policy]').forEach(button=>button.onclick=()=>publicServicePolicy(button.dataset.servicePolicy));}
}
function cleanServiceLinks(root,path){
 for(const a of [...root.querySelectorAll('a[href]')]){
  const href=a.getAttribute('href');
  if(/^(?:mailto:|tel:)/i.test(href)||/^(?:\/index\.php\?route=api|\/assets\/)/.test(href))continue;
  const hash=href.replace(/^#\/?/,'').split('?')[0];
  if(hash===path||PUBLIC_SERVICE_ALIASES[hash]===path)continue;
  if(href.startsWith('#')&&!href.startsWith('#/')&&href!=='#')continue;
  let key=null;if(/politica-de-privacidad/.test(href))key='privacidad';else if(/terminos-de-uso/.test(href))key='terminos';
  if(key){const button=document.createElement('button');button.type='button';button.className='standalone-text-button';button.textContent=a.textContent;button.dataset.servicePolicy=key;a.replaceWith(button);}
  else if(path==='servicios/bolsa-laboral'&&href.startsWith('#/admin')){
   const button=document.createElement('button');button.type='button';button.className=a.className||'btn';button.textContent=currentUser()?'Mi espacio laboral':'Ingresar a Bolsa laboral';button.dataset.serviceAccess='1';a.replaceWith(button);
  }else{const span=document.createElement('span');span.innerHTML=a.innerHTML;a.replaceWith(span);}
 }
}
function publicServiceLayout(html,path){
 const template=document.createElement('template');template.innerHTML=html;
 const main=template.content.querySelector('main');
 if(!main)return html;
 main.querySelectorAll('.pz-svnav,.mainnav,.intra-directory-nav').forEach(n=>n.remove());
 cleanServiceLinks(main,path);
 return publicServiceHeader(path)+`<main id="contenido" tabindex="-1" class="standalone-main wrap ${esc(main.className)}" style="--service-accent:${PUBLIC_SERVICE_PAGES[path].accent}">${main.innerHTML}</main>`+publicServiceFooter(path);
}
function serviceWorkspaceMarkup(){
 const user=currentUser();
 if(user&&window.PORTAL_EMPLOYMENT_CONTEXT())return `<div class="standalone-account"><span>${esc(user.nombre)}</span><button type="button" class="btn sec sm" data-service-logout>Salir de Bolsa laboral</button></div>${ixWrap(IX.view('bolsa'))}`;
 if(user)return `<section class="panel"><h2>Acceso laboral</h2><p>Este espacio está destinado a estudiantes, egresados y empresas. La sesión actual pertenece a otro perfil.</p><button type="button" class="btn" data-service-logout>Cambiar de usuario</button></section>`;
 return `<section class="panel standalone-login"><h2>Mi acceso laboral</h2><p>Ingresa con tu cuenta institucional para gestionar tu perfil, postulaciones u ofertas dentro de Bolsa laboral.</p><form data-service-login><div class="form-grid"><div class="field"><label for="sl-role">Tipo de usuario</label><select id="sl-role" name="role" required><option value="estudiante">Estudiante</option><option value="egresado">Egresado</option><option value="empresa">Empresa</option></select></div><div class="field"><label for="sl-user">DNI, RUC o usuario</label><input id="sl-user" name="username" required autocomplete="username"></div><div class="field"><label for="sl-password">Contraseña</label><input id="sl-password" name="password" required type="password" autocomplete="current-password"></div></div><p role="alert" data-service-login-error></p><button class="btn" type="submit">Ingresar a Bolsa laboral</button><p class="note">Si necesitas recuperar tu acceso, comunícate con el responsable institucional.</p></form></section>`;
}
function openServiceWorkspace(){
 const button=document.querySelector('.pz-mt [data-tab="workspace"]');if(button)button.click();
 document.getElementById('service-workspace')?.scrollIntoView({block:'start',behavior:'smooth'});
}
function bindStandaloneService(path){
 document.querySelectorAll('[data-service-policy]').forEach(button=>button.onclick=()=>publicServicePolicy(button.dataset.servicePolicy));
 if(path!=='servicios/bolsa-laboral')return;
 document.querySelectorAll('.pz-mt [data-tab]').forEach(button=>button.addEventListener('click',()=>{
  const tab={o:'ofertas',e:'empresas',i:'como',workspace:currentUser()?'mi-espacio':'acceso'}[button.dataset.tab];
  if(tab)history.replaceState(null,'',location.pathname+location.search+'#/servicios/bolsa-laboral?tab='+tab);
 }));
 document.querySelectorAll('[data-post]').forEach(button=>button.onclick=()=>standalonePostular(button.dataset.post));
 document.querySelectorAll('[data-service-access]').forEach(button=>button.onclick=openServiceWorkspace);
 document.querySelectorAll('[data-service-logout]').forEach(button=>button.onclick=()=>{try{portalRequest('DELETE','/api/session');location.hash='#/servicios/bolsa-laboral?tab=acceso';location.reload();}catch(e){toast(e.message,'err');}});
 const form=document.querySelector('[data-service-login]');
 if(form)form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
  try{const values=new FormData(form);const response=await fetch(portalURL('/api/session'),{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-TOKEN':portalBootstrap.csrf},body:JSON.stringify({username:values.get('username'),password:values.get('password'),role:values.get('role')})});const result=await response.json();if(!response.ok)throw Error(result.message||'No se pudo iniciar sesión.');location.hash='#/servicios/bolsa-laboral?tab=mi-espacio';location.reload();}
  catch(e){form.querySelector('[data-service-login-error]').textContent=e.message;button.disabled=false;}
 };
 const tab=new URLSearchParams(location.hash.split('?')[1]||'').get('tab');if(['acceso','mi-espacio'].includes(tab)){openServiceWorkspace();resumeServiceApplication();}
}
// Keep the original form binders and business rules while replacing the public frame.
const standaloneServiceRenderers=Object.fromEntries(Object.keys(PUBLIC_SERVICE_PAGES).map(path=>[path,ROUTES[path]]));
for(const [path,canonical] of [...Object.keys(PUBLIC_SERVICE_PAGES).map(p=>[p,p]),...Object.entries(PUBLIC_SERVICE_ALIASES)]){
 const original=standaloneServiceRenderers[canonical];if(!original)continue;
 R(path,(...args)=>{
  const out=original(...args);const result=typeof out==='string'?{html:out}:out;
  if(canonical==='servicios/bolsa-laboral'){
   const template=document.createElement('template');template.innerHTML=result.html;
   if(currentUser()){
    const registration=template.content.querySelector('.pz-bl-ix');
    if(registration)registration.innerHTML='<p class="note">Para gestionar una empresa, utiliza Mi acceso laboral con su cuenta. Para registrar una cuenta nueva, cierra primero la sesión actual.</p>';
   }
   const companyInfo=template.content.querySelector('.pz-bl-side section p');if(companyInfo)companyInfo.textContent='Ingresa a Mi acceso laboral con tu RUC y contraseña para publicar convocatorias y revisar postulantes.';
   const tabs=template.content.querySelector('.pz-mt');
   if(tabs){tabs.insertAdjacentHTML('beforeend','<button type="button" role="tab" aria-selected="false" data-tab="workspace">Mi acceso laboral</button>');const pane=document.createElement('section');pane.id='service-workspace';pane.dataset.pane='workspace';pane.hidden=true;pane.innerHTML=serviceWorkspaceMarkup();tabs.parentNode.appendChild(pane);}
   const cta=template.content.querySelector('.pz-of-cta span');if(cta)cta.textContent='Presiona Postular e ingresa con tu cuenta institucional. Tu perfil y tus postulaciones se gestionan en esta misma página.';
   const info=template.content.querySelector('[data-pane="i"]');if(info)info.innerHTML='<section class="panel"><h2>¿Cómo postular?</h2><ol><li>Busca una oferta de tu interés.</li><li>Selecciona Postular e ingresa a tu espacio laboral.</li><li>Completa tu perfil y adjunta tu CV.</li><li>Confirma la postulación y consulta su estado en Mis postulaciones.</li></ol></section>';
   result.html=template.innerHTML;
  }
  result.html=publicServiceLayout(result.html,canonical);
  const after=result.after;result.after=()=>{document.title=PUBLIC_SERVICE_PAGES[canonical].title+' · '+inst().nombreCorto;after?.();bindStandaloneService(canonical);};
  return result;
 });
}
const standaloneOriginalRoute=route;
route=function(){
 const entry=portalBootstrap.standaloneService;
 if(PUBLIC_SERVICE_PAGES[entry]&&location.hash.replace(/^#\/?/,'').split('?')[0]!==entry)history.replaceState(null,'',location.pathname+location.search+'#/'+entry);
 document.body.classList.toggle('is-standalone-service',!!PUBLIC_SERVICE_PAGES[publicServicePath()]);
 standaloneOriginalRoute();
};
const standaloneOriginalHead=IXHOST.head;
IXHOST.head=(title,...rest)=>employmentServiceContext()?`<div class="standalone-workspace-head"><h2>${esc(String(title).replace(/<[^>]+>/g,''))}</h2></div>`:standaloneOriginalHead(title,...rest);
const standaloneOriginalGo=IXHOST.go;
IXHOST.go=view=>{if(employmentServiceContext())return openServiceWorkspace();return standaloneOriginalGo(view);};
function standalonePostular(id){
 if(currentUser()&&!['estudiante','egresado'].includes(currentUser().rol)){toast('La postulación está disponible para estudiantes y egresados.','warn');return;}
 try{sessionStorage.setItem('pz_post',String(id));sessionStorage.removeItem('pz_next');}catch{}
 openServiceWorkspace();resumeServiceApplication();
}
function resumeServiceApplication(){
 if(!['estudiante','egresado'].includes(currentUser()?.rol))return;
 let id=0;try{id=Number(sessionStorage.getItem('pz_post'));sessionStorage.removeItem('pz_post');}catch{}
 if(!Number.isInteger(id)||id<1)return;
 document.querySelector('[data-tab="bolsa:ofertas"]')?.click();
 queueMicrotask(()=>document.querySelector('[data-act="postular"][data-id="'+id+'"]')?.click());
}
})();
