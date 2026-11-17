/* Intranet de Pisco por módulos (mismo enfoque que v2_palpa). La web institucional se administra por separado:
   aquí no se editan portada, noticias, admisión, TUPA ni transparencia, y el servidor rechaza esos cambios.
   Siete módulos funcionales (Horarios, Certificación modular, Grados y títulos, Mesa de partes, Libro de reclamaciones,
   Bolsa laboral y CV docente), cada servicio con su propia página: /mesa-de-partes.php, /libro-de-reclamaciones.php,
   /bolsa-laboral.php, /certificados.php, /horarios.php y /cv-docente.php. */
'use strict';
const INTRANET_WEBSITE=(portalBootstrap.scope&&portalBootstrap.scope.website)||'https://iestppisco.edu.pe/';
MODULES.dashboard='Mi panel';MODULES.docentes='Personal docente';MODULES.cvdocente='CV docente';MODULES.config='Configuración de la intranet';MODULES['ix-certificados']='Certificación modular';MODULES['ix-titulos']='Grados y títulos';MODULES['ix-horarios']='Horarios';MODULES.certificados='Verificación de documentos';
NAV_GROUPS.splice(0,NAV_GROUPS.length,
 ['Inicio',[['dashboard','home']]],
 ['Gestión académica',[['ix-horarios','calendar'],['ix-certificados','award'],['ix-titulos','grad'],['certificados','shield']]],
 ['Gestión administrativa',[['expedientes','inbox'],['reclamos','book'],['ix-bolsa','briefcase']]],
 ['Perfiles profesionales',[['cvdocente','user']]],
 ['Catálogos de soporte',[['programas','grad'],['ix-alumnos','users'],['docentes','users'],['ix-config','gear']]],
 ['Administración y seguridad',[['config','gear'],['temas','palette'],['usuarios','key'],['auditoria','history'],['respaldo','database']]]);
// Cada servicio abre su página independiente (sin el menú de la intranet).
const INTRANET_SERVICES=[
 ['/mesa-de-partes.php','Mesa de partes','Presenta documentos y consulta el estado de tu expediente.','inbox'],
 ['/libro-de-reclamaciones.php','Libro de reclamaciones','Registra un reclamo o consulta su atención.','book'],
 ['/bolsa-laboral.php','Bolsa laboral','Ofertas de empleo, registro de egresados y acceso para empresas.','briefcase'],
 ['/horarios.php','Horarios','Docentes y estudiantes consultan su horario publicado.','calendar'],
 ['/cv-docente.php','CV docente','Directorio de docentes y acceso del docente a su CV.','user'],
 ['/certificados.php','Validación de documentos','Consulta constancias, certificaciones y títulos registrados.','shield']
];
const serviceLinks=()=>INTRANET_SERVICES.map(([url,label])=>`<a href="${url}">${esc(label)}</a>`).join('');
const instShort=()=>inst().nombreCorto||'IESTP Pisco';
function intranetBrand(){return `<a class="intra-brand" href="#/admin"><img src="${logoSrc()}" alt="Logotipo institucional"><span><strong>${esc(instShort())}</strong><small>Intranet institucional</small></span></a>`;}
headerHTML=function(){return `<header class="intra-public-header"><div class="wrap">${intranetBrand()}<nav aria-label="Accesos principales"><a href="#/servicios">Servicios en línea</a><a href="${INTRANET_WEBSITE}" target="_blank" rel="noopener">Web institucional ↗</a><a class="btn sm" href="#/admin">${currentUser()?'Mi panel':'Iniciar sesión'}</a></nav></div></header>`;};
footerHTML=function(){return `<footer class="intra-footer"><div class="wrap"><span>© ${yearNow()} ${esc(instShort())} · Intranet institucional</span><nav aria-label="Información legal"><a href="#/politica-de-privacidad">Privacidad</a><a href="#/terminos-de-uso">Términos de uso</a><a href="${INTRANET_WEBSITE}" target="_blank" rel="noopener">Web institucional ↗</a></nav></div></footer>`;};
navModel=function(){return [];};
sideContact=function(){return `<aside class="side-box"><div class="pad"><strong>Atención institucional</strong><p>${esc(inst().horario||'')}</p><a href="mailto:${esc(inst().correo)}">${esc(inst().correo)}</a><p><a href="${INTRANET_WEBSITE}" target="_blank" rel="noopener">Ir a la web institucional ↗</a></p></div></aside>`;};
loginView=function(){return `<main class="intra-login" id="contenido"><div class="intra-login-grid"><section class="intra-login-story">${intranetBrand()}<div><span class="intra-eyebrow">Gestión académica y administrativa</span><h1>Tu comunidad.<br>Un solo espacio.</h1><p>Accede a las herramientas de trabajo y consulta del instituto con tu cuenta institucional.</p><ul><li>Horarios, certificación modular, grados y títulos</li><li>Mesa de partes y libro de reclamaciones</li><li>Bolsa laboral y CV docente</li></ul></div><a href="${INTRANET_WEBSITE}" target="_blank" rel="noopener">Visitar la web institucional ↗</a></section><section class="intra-login-access"><div class="intra-login-box"><span class="intra-eyebrow">Intranet ${esc(instShort())}</span><h2>Iniciar sesión</h2><p>Personal, docentes, estudiantes, egresados y empresas.</p><form data-login novalidate><div class="field"><label for="lg-u">Usuario</label><input id="lg-u" name="u" autocomplete="username" placeholder="Usuario, DNI o RUC" required></div><div class="field"><label for="lg-p">Contraseña</label><div class="intra-password"><input id="lg-p" name="p" type="password" autocomplete="current-password" required><button type="button" data-eye aria-label="Mostrar contraseña" aria-pressed="false">Ver</button></div></div><p id="lg-e" role="alert"></p><button class="btn intra-enter" type="submit">Ingresar a la intranet →</button></form><p class="intra-help">¿Olvidaste tu contraseña? <a href="#" data-pw-reset>Restablécela con un código a tu correo</a>. Si necesitas una cuenta, comunícate con el instituto; los egresados pueden <a href="/bolsa-laboral.php#/servicios/bolsa-laboral?registro=egresado">registrarse en línea</a>.</p><div class="intra-service-access"><h3>¿Quieres realizar una consulta o trámite?</h3><p>Cada servicio tiene su propia página.</p>${serviceLinks()}</div></div></section></div></main>`;};
const intranetAdmShell=admShell;
admShell=function(active,content){return intranetAdmShell(active,content).replace('href="#/" target="_blank"',`href="${INTRANET_WEBSITE}" target="_blank"`).replace('Ver sitio web','Web institucional').replace('Intranet institucional · Portal Web 2026','Intranet institucional · '+esc(instShort())).replace('Intranet · Panel administrativo','Gestión académica y administrativa');};
const MODULE_CARDS=[
 ['ix-horarios','Horarios','Programa clases, revisa cruces y publica los horarios.','calendar','/horarios.php'],
 ['ix-certificados','Certificación modular','Registra certificaciones y consulta el historial académico.','award',''],
 ['ix-titulos','Grados y títulos','Administra y valida el registro institucional de titulados.','grad',''],
 ['expedientes','Mesa de partes','Recibe, deriva y atiende expedientes con seguimiento.','inbox','/mesa-de-partes.php'],
 ['reclamos','Libro de reclamaciones','Gestiona la atención y el historial de reclamos y quejas.','book','/libro-de-reclamaciones.php'],
 ['ix-bolsa','Bolsa laboral','Empresas, ofertas, egresados, postulaciones y seguimiento.','briefcase','/bolsa-laboral.php'],
 ['cvdocente','CV docente','Formación, experiencia, certificaciones y proyectos.','user','/cv-docente.php']
];
// Textos de consulta para la comunidad: no administran estos registros.
const COMMUNITY_CARD_TEXT={'ix-horarios':'Consulta tu horario publicado.','ix-certificados':'Consulta tus certificaciones modulares.','ix-titulos':'Consulta tu título registrado y su validación.','ix-bolsa':'Ofertas, tu perfil profesional y tus postulaciones.','cvdocente':'Actualiza tu CV y lo que se publica en el directorio.'};
CUSTOM.dashboard=function(){
 const user=currentUser(),cards=MODULE_CARDS.filter(([key])=>can(key));
 let next=null;try{next=sessionStorage.getItem('pz_next');sessionStorage.removeItem('pz_next');}catch{}
 if(next&&['estudiante','egresado'].includes(user.rol)&&/^#\/admin\/ix-bolsa(?:\/|$)/.test(next))setTimeout(()=>go(next),0);
 const support=NAV_GROUPS.slice(4).flatMap(([,items])=>items).filter(([key])=>can(key));
 const own=role().community;
 const body=`<section class="intra-welcome"><span class="intra-eyebrow">${esc(role().label)}</span><h1>Hola, ${esc(String(user.nombre||'').split(' ')[0])}</h1><p>${own?'Tus consultas y herramientas, según tu perfil.':'Gestiona los servicios académicos y administrativos del instituto.'}</p><a href="/accounts.php">Mi cuenta y contraseña →</a></section><section><h2 class="intra-section-title">Mis módulos</h2><div class="intra-modules">${cards.map(([key,title,desc,icon,page])=>`<article class="intra-module"><span class="intra-module-icon">${ic(icon)}</span><h3><a href="#/admin/${key}">${title}</a></h3><p>${own&&(user.rol==='empresa'&&key==='ix-bolsa'?'Publica ofertas, revisa a tus postulantes y los datos de tu empresa.':COMMUNITY_CARD_TEXT[key])||desc}</p><span class="intra-module-open"><a href="#/admin/${key}">Abrir módulo →</a>${page&&!own?` <a class="intra-module-page" href="${page}" target="_blank" rel="noopener">Página pública ↗</a>`:''}</span></article>`).join('')||'<p class="notice">No tienes módulos asignados. Consulta con el administrador.</p>'}</div></section>${support.length?`<section class="intra-support"><h2 class="intra-section-title">Catálogos y administración</h2><div>${support.map(([key])=>`<a href="#/admin/${key}">${esc(MODULES[key])} →</a>`).join('')}</div></section>`:''}<section class="intra-support"><h2 class="intra-section-title">Páginas de servicios</h2><div>${serviceLinks()}</div></section>`;
 return {html:body};
};
// Configuración de la intranet sin herramientas de publicación de la web institucional.
// (El correo SMTP y la consulta de DNI/RUC se agregan desde mail-settings.js y document-lookup.js.)
const INST_KEYS=['nombre','nombreCorto','logoSigla','logo','direccion','distrito','region','telefono','telefonoNota','correo','horario','horarioSab','ruc','codigoModular','fechaCreacion','normaCreacion'];
CUSTOM.config=()=>singletonForm({title:'Configuración de la intranet',icon:'gear',sub:'Datos institucionales que usan los documentos emitidos y los servicios, correos receptores y límites del Libro de reclamaciones.',
 get:()=>Object.assign({},...INST_KEYS.map(k=>({[k]:inst()[k]??''})),{correoMesaPartes:DB.config.mpv?.correo||'',correoReclamos:DB.config.correoReclamos||'',correoBolsa:DB.config.bolsa?.correo||'',limDesc:DB.config.limites?.descripcion||1500,limPed:DB.config.limites?.pedido||1000}),
 fields:[{n:'nombre',l:'Denominación oficial',req:true,full:true},{n:'nombreCorto',l:'Nombre corto / siglas',req:true},{n:'logoSigla',l:'Texto del logotipo generado',max:10},
  {n:'logo',l:'Logotipo oficial (se usa en la intranet y en los documentos emitidos)',t:'image',full:true},
  {n:'direccion',l:'Dirección',req:true,full:true},{n:'distrito',l:'Distrito',max:80},{n:'region',l:'Región (departamento)',max:80,hint:'Se usa en los títulos emitidos y en el pie de la intranet.'},
  {n:'telefono',l:'Teléfono',req:true},{n:'telefonoNota',l:'Detalle del teléfono'},{n:'correo',l:'Correo institucional',t:'email'},{n:'horario',l:'Horario de atención',req:true},{n:'horarioSab',l:'Horario de sábados'},
  {n:'ruc',l:'RUC'},{n:'codigoModular',l:'Código modular'},{n:'fechaCreacion',l:'Fecha de creación',t:'date',req:true},{n:'normaCreacion',l:'Norma de creación'},
  {n:'correoMesaPartes',l:'Correo receptor de Mesa de Partes',t:'email',req:true,max:254,hint:'Destino de los avisos de nuevos trámites.'},
  {n:'correoReclamos',l:'Correo receptor del Libro de Reclamaciones (parámetro protegido)',t:'email',req:true,ro:()=>currentUser().rol!=='admin'},
  {n:'correoBolsa',l:'Correo responsable de Bolsa Laboral',t:'email'},
  {n:'limDesc',l:'Límite de caracteres: descripción del reclamo',t:'number',min:200},{n:'limPed',l:'Límite de caracteres: pedido del reclamo',t:'number',min:100}],
 onSave:(w,er)=>{if(Object.keys(er).length)return;const C=DB.config;const oldLogo=C.inst.logo;
  const reclamos=String(w.correoReclamos||'').trim();if(C.correoReclamos!==reclamos)audit('Cambio de parámetro protegido','Configuración','Correo del Libro de Reclamaciones',`${C.correoReclamos||'—'} → ${reclamos}`);
  INST_KEYS.forEach(k=>C.inst[k]=typeof w[k]==='string'?w[k].trim():w[k]);
  // El logotipo de los documentos emitidos sigue al logotipo institucional si era el mismo.
  if(oldLogo!==w.logo&&DB.academico?.cfg?.docs?.logoIzq?.src===oldLogo){const preview=document.querySelector('[data-img=logo] img');DB.academico.cfg.docs.logoIzq=w.logo?{src:w.logo,w:preview?.naturalWidth||240,h:preview?.naturalHeight||310}:null;}
  C.mpv=C.mpv||{};C.mpv.correo=String(w.correoMesaPartes||'').trim();C.correoReclamos=reclamos;C.lr=C.lr||{};C.lr.correo=reclamos;C.bolsa.correo=String(w.correoBolsa||'').trim();
  C.limites={...(C.limites||{}),descripcion:+w.limDesc||1500,pedido:+w.limPed||1000};}
});
// El catálogo de programas es soporte académico, sin perfiles promocionales de la web.
if(SPECS.programas){
 SPECS.programas.sub='Programas, duración y organización curricular para los módulos académicos.';
 if(Array.isArray(SPECS.programas.cols))SPECS.programas.cols=SPECS.programas.cols.filter(c=>!['Imagen','Egresados'].includes(c.l));
 SPECS.programas.sideExtra=()=>'';
 const intranetProgramFields=SPECS.programas.fields;
 SPECS.programas.fields=(w)=>{const fields=typeof intranetProgramFields==='function'?intranetProgramFields(w):intranetProgramFields;return fields.filter(f=>['orden','nombre','codigo','duracion','modalidad','turno','horario','titulo','coordinadorId','modulos'].includes(f.n));};
 SPECS.programas.title='Programas de estudios';SPECS.programas.preview=null;
}
// Rutas públicas: solo los servicios (cada uno con su página propia) y los textos legales.
const PUBLIC_ROUTES=new Set(['servicios','servicios/mesa-de-partes','servicios/libro-de-reclamaciones','servicios/bolsa-laboral','servicios/consulta-certificados','servicios/horarios','servicios/cv-docente','nosotros/plana-docente','libro-de-reclamaciones','transparencia/libro-de-reclamaciones','politica-de-privacidad','terminos-de-uso']);
for(const key of Object.keys(ROUTES))if(!PUBLIC_ROUTES.has(key))delete ROUTES[key];
R('servicios',()=>({html:`${headerHTML()}<main class="wrap intra-services" id="contenido"><span class="intra-eyebrow">${esc(instShort())}</span><h1>Servicios en línea</h1><p>Cada servicio tiene su propia página: presenta documentos, consulta su seguimiento y accede a los servicios del instituto.</p><div class="intra-modules">${INTRANET_SERVICES.map(([url,title,desc,icon])=>`<a class="intra-module" href="${url}"><span class="intra-module-icon">${ic(icon)}</span><h2>${title}</h2><p>${desc}</p><span class="intra-module-open">Abrir página →</span></a>`).join('')}</div></main>${footerHTML()}`}));
notFound=function(){return {html:`${headerHTML()}<main class="wrap intra-services" id="contenido"><h1>Esta sección pertenece a la web institucional</h1><p>La intranet reúne las herramientas de gestión académica y administrativa del instituto.</p><a class="btn" href="#/admin">Ir a la intranet</a> <a class="btn sec" href="${INTRANET_WEBSITE}" target="_blank" rel="noopener">Visitar la web institucional ↗</a></main>${footerHTML()}`};};
const intranetRoute=route;
route=function(){
 const raw=location.hash.replace(/^#\/?/,'');
 // La entrada «/» abre el inicio de sesión (o el panel), como en Palpa.
 if(!portalBootstrap.standaloneService&&(!raw||raw==='inicio'))history.replaceState(null,'',location.pathname+location.search+'#/admin');
 intranetRoute();
 if(location.hash.startsWith('#/admin'))document.title='Intranet '+instShort()+' · '+(currentUser()?MODULES[location.hash.split('/')[2]]||'Mi panel':'Iniciar sesión');
 document.querySelectorAll('a[href="#/nosotros/plana-jerarquica"],a[href="#/servicios/complementarios"]').forEach(a=>a.remove());
};
// Auditoría y respaldos conservan el marco común de la intranet.
const intranetRenderAdmin=renderAdmin;
renderAdmin=function(parts,q){const out=intranetRenderAdmin(parts,q);if(currentUser()&&['auditoria','respaldo'].includes(parts[1])&&out&&typeof out.html==='string'&&!out.html.includes('class="adm"')){const after=out.after;out.html=admShell(parts[1],out.html);out.after=()=>{bindAdmChrome();if(after)after();};}return out;};
if(SPECS.usuarios){const intranetUserFields=SPECS.usuarios.fields;
 SPECS.usuarios.fields=function(work){const fields=typeof intranetUserFields==='function'?intranetUserFields(work):intranetUserFields;for(const f of fields)if(f.n==='rol'&&Array.isArray(f.opts))f.opts=f.opts.filter(([r])=>!['imagen','transparencia'].includes(r));return fields;};}
nosotrosSide=function(){return `<div class="side-box"><div class="pad"><h2 style="font-size:16px">Servicios en línea</h2><nav class="intra-directory-nav" aria-label="Servicios">${serviceLinks()}</nav></div></div>`;};
sidePromo=function(){return '';};

/* Usuarios y roles: «Vinculado a» es obligatorio para Estudiante, Egresado, Docente y Empresa (el servidor lo exige).
   Se marca con asterisco al elegir el rol, se explica qué elegir y la lista muestra solo las opciones de ese tipo. */
const VIN_RULES={estudiante:['est:','Obligatorio: elige al estudiante del padrón. Si no figura, regístralo primero en Gestión académica › Maestro de alumnos (desde ahí también puedes crear su acceso).'],
 egresado:['est:','Obligatorio: elige al egresado del padrón. Si no figura, regístralo en Maestro de alumnos, o pídele que se registre en línea desde la Bolsa Laboral (crea su propia contraseña).'],
 docente:['doc:','Obligatorio: elige al docente de la carga docente (Configuración académica general).'],
 empresa:['emp:','Obligatorio: elige la empresa registrada en la Bolsa Laboral.']};
function syncVinField(){
 const rol=document.getElementById('f_rol'),vin=document.getElementById('f_vin');if(!rol||!vin)return;
 const field=vin.closest('.field');const label=field&&field.querySelector('label');const rule=VIN_RULES[rol.value];
 if(label){label.querySelector('.req')?.remove();if(rule)label.insertAdjacentHTML('beforeend',' <span class="req">*</span>');}
 vin.required=!!rule;
 for(const o of vin.options){if(!o.value)continue;const show=!rule||o.value.startsWith(rule[0]);o.hidden=!show;o.disabled=!show;}
 if(rule&&vin.value&&!vin.value.startsWith(rule[0]))vin.value='';
 let hint=field&&field.querySelector('[data-vin-hint]');
 if(field&&!hint){hint=document.createElement('small');hint.dataset.vinHint='1';hint.className='hint';field.appendChild(hint);}
 if(hint){hint.textContent=rule?rule[1]:'Opcional para el personal del instituto.';hint.style.color=rule?'var(--warn,#8a5a00)':'';}
}
document.addEventListener('change',e=>{if(e.target&&e.target.id==='f_rol')syncVinField();});
const intranetRouteVin=route;
route=function(){intranetRouteVin();if(location.hash.startsWith('#/admin/usuarios'))setTimeout(syncVinField,0);};

/* ---------- Temas y apariencia de la intranet (como Palpa) ----------
   Solo los colores, las letras y el redondeo del panel. La estructura de la página pública se administra en la web institucional. */
MODULES.temas='Temas y apariencia';
disenoPanel=function(){return '';};
themeMock=function(t,big=false){
 const mods=big?['Horarios','Bolsa laboral','Mesa de partes']:['Horarios','Bolsa','Trámites'];
 return `<div class="itm-mock${big?' big':''}" style="${esc(themeScope(t))}" aria-hidden="true"><div class="itm-side"><b>${esc(instShort())}</b><u class="on"></u><u></u><u></u><u></u>${big?'<u></u><u></u>':''}</div><div class="itm-top"><i></i></div><div class="itm-main"><h4>Mi panel</h4><div class="itm-cards">${mods.map(m=>`<div class="itm-card"><b>${esc(m)}</b>${big?'<em>Abrir módulo</em>':''}</div>`).join('')}</div>${big?'<div class="itm-btns"><span class="itm-b1">Botón principal</span><span class="itm-b2">Dorado</span><span class="itm-badge">Etiqueta</span></div>':''}</div></div>`;
};
const intranetTemas=CUSTOM.temas;
CUSTOM.temas=function(parts){
 const out=intranetTemas(parts);if(!out||typeof out.html!=='string')return out;
 if(parts[2]){out.html=out.html.replaceAll('Apariencia del portal','Apariencia de la intranet').replaceAll('en todo el portal','en toda la intranet');return out;}
 out.html=out.html.replaceAll('Apariencia del portal','Apariencia de la intranet').replace(' Se aplican a cualquier estructura.',' Se aplican a toda la intranet.').replace(/Elija la estructura y los colores del sitio público\.[^<']*/,'Elija los colores y las letras de la intranet. Se aplican al ingreso, al panel y a las páginas de servicios; la web institucional tiene su propia apariencia.')
  .replace(/<section class="panel ap-step"><details class="pb ap-adv"[\s\S]*$/,'').replace('<span class="ap-n">2</span> Colores y letras','<span class="ap-n">1</span> Colores y letras');
 return out;
};
const intranetApplyTheme=applyTheme;
applyTheme=function(){intranetApplyTheme();delete document.documentElement.dataset.layout;};
const intranetToast=toast;
toast=function(msg,...rest){return intranetToast(typeof msg==='string'?msg.replace('en todo el portal','en toda la intranet'):msg,...rest);};
