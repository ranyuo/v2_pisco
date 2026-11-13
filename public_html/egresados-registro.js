/* Registro en línea de egresados (Bolsa Laboral).
   1. El egresado completa sus datos y crea su contraseña; recibe un código de 6 dígitos en su correo.
   2. Con el código confirma su correo. Si el padrón ya lo registra como egresado con ese correo, su cuenta queda activa;
      si no, Secretaría Académica (o la Bolsa Laboral) revisa la solicitud y el egresado recibe la respuesta en su correo.
   3. El personal revisa las solicitudes en Bolsa laboral › Registro de egresados.
   Se carga antes de standalone-services.js para que /bolsa-laboral.php también muestre la invitación a registrarse. */
'use strict';
(function(){
if(typeof R!=='function'||typeof ROUTES!=='object'||!ROUTES['servicios/bolsa-laboral'])return;

const api=async(method,url,body)=>{
 const r=await fetch(portalURL(url),{method,headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-TOKEN':portalBootstrap.csrf},body:body===undefined?undefined:JSON.stringify(body)});
 let data={};try{data=await r.json();}catch(e){}
 if(!r.ok)throw new Error(data.message||'No se pudo conectar con el servidor. Inténtalo nuevamente.');
 return data;
};
const programas=()=>{try{return (IX.db().programas||[]).filter(p=>p.activo!==false&&p.estado!=='Inactivo');}catch(e){return [];}};
const thisYear=new Date().getFullYear();
let FLOW={dni:'',correo:'',minutos:30};

const CSS=`.egr-cta{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 0 18px;padding:16px 18px;border-radius:14px;background:linear-gradient(100deg,var(--navy,#0b1d3f),color-mix(in srgb,var(--navy,#0b1d3f) 70%,var(--link,#1a5fae)));color:#fff}
.egr-cta b{display:block;font-size:17px}.egr-cta span{color:#d6e2f5;font-size:14px}.egr-cta .btn{background:#f2b705;color:#0b1d3f;border-color:#f2b705}.egr-cta .btn.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.5)}
.egr-steps{display:flex;gap:8px;margin:0 0 16px;padding:0;list-style:none;font-size:13px}.egr-steps li{flex:1;padding:8px 10px;border-radius:10px;background:var(--sky,#eef5fd);color:var(--muted,#5b6b82);text-align:center}.egr-steps li.on{background:var(--navy,#0b1d3f);color:#fff;font-weight:600}
.egr-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.egr-grid .full{grid-column:1/-1}@media (max-width:620px){.egr-grid{grid-template-columns:1fr}}
.egr-code{font:700 26px/1 ui-monospace,monospace;letter-spacing:.4em;text-align:center}
.egr-ok{text-align:center;padding:8px 4px}.egr-ok .ic{width:64px;height:64px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#e6f6ee;color:#167548;margin-bottom:10px}
.egr-ok.wait .ic{background:#fff4d6;color:#8a5a00}.egr-err{color:#b42318;min-height:1.2em;margin:4px 0}
.egr-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px}
.egr-filter{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}`;
const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);

const steps=n=>`<ol class="egr-steps" aria-label="Pasos del registro">${['Tus datos y contraseña','Confirma tu correo','Cuenta lista'].map((t,i)=>`<li class="${i===n?'on':''}" ${i===n?'aria-current="step"':''}>${i+1}. ${t}</li>`).join('')}</ol>`;

function openRegistro(start){
 const m=modal({title:'Registro de egresados',body:'<div data-egr></div>'});const box=m.el.querySelector('[data-egr]');
 const show=(html,bind)=>{box.innerHTML=html;bind&&bind();const f=box.querySelector('input:not([type=hidden]):not([type=checkbox])');if(f)f.focus();};

 const formStep=()=>show(`${steps(0)}<form data-egr-f novalidate><p class="note" style="margin-top:0">Si egresaste del ${esc(inst().nombre)}, regístrate para postular a las ofertas de la Bolsa Laboral. Te enviaremos un código a tu correo para confirmarlo.</p>
  <div class="egr-grid">
   <div class="field"><label for="eg-dni">DNI</label><input id="eg-dni" name="dni" inputmode="numeric" maxlength="8" autocomplete="off" required value="${esc(FLOW.dni)}"></div>
   <div class="field"><label for="eg-anio">Año de egreso</label><input id="eg-anio" name="anio" type="number" min="1984" max="${thisYear}" required></div>
   <div class="field full"><label for="eg-nom">Apellidos y nombres</label><input id="eg-nom" name="nom" maxlength="150" autocomplete="name" required></div>
   <div class="field full"><label for="eg-prog">Programa de estudios</label><select id="eg-prog" name="prog" required><option value="">Selecciona tu programa</option>${programas().map(p=>`<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></div>
   <div class="field"><label for="eg-mail">Correo electrónico</label><input id="eg-mail" name="correo" type="email" maxlength="254" autocomplete="email" required value="${esc(FLOW.correo)}"></div>
   <div class="field"><label for="eg-tel">Celular</label><input id="eg-tel" name="tel" inputmode="tel" maxlength="12" autocomplete="tel" required placeholder="9XXXXXXXX"></div>
   <div class="field"><label for="eg-pw">Crea tu contraseña</label><input id="eg-pw" name="password" type="password" minlength="12" maxlength="72" autocomplete="new-password" required><div class="hint">Mínimo 12 caracteres.</div></div>
   <div class="field"><label for="eg-pw2">Repite tu contraseña</label><input id="eg-pw2" name="password_confirmation" type="password" maxlength="72" autocomplete="new-password" required></div>
   <div class="field full"><label class="check"><input type="checkbox" name="ver"> <span>Mostrar contraseña</span></label></div>
   <div class="field full"><label class="check"><input type="checkbox" name="declaration" required> <span>Declaro que mis datos son verdaderos y acepto la <a href="#/politica-de-privacidad" target="_blank">política de privacidad</a> y el tratamiento de mis datos personales para la Bolsa Laboral.</span></label></div>
   <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
  </div>
  <p class="egr-err" role="alert" data-egr-err></p>
  <div class="egr-actions"><button class="btn" type="submit">${sic('send',16)} Registrarme y recibir código</button><button type="button" class="btn ghost" data-egr-have>Ya tengo un código</button></div></form>`,()=>{
   const f=box.querySelector('[data-egr-f]'),err=box.querySelector('[data-egr-err]');
   f.ver.onchange=()=>{f.password.type=f.password_confirmation.type=f.ver.checked?'text':'password';};
   box.querySelector('[data-egr-have]').onclick=()=>codeStep(true);
   f.onsubmit=async ev=>{ev.preventDefault();err.textContent='';
    const v={dni:f.dni.value.trim(),anio:f.anio.value.trim(),nom:f.nom.value.trim(),prog:f.prog.value,correo:f.correo.value.trim(),tel:f.tel.value.replace(/\D/g,''),password:f.password.value,password_confirmation:f.password_confirmation.value,declaration:f.declaration.checked,website:f.website.value};
    const msg=!/^\d{8}$/.test(v.dni)?'El DNI debe tener ocho dígitos.':!v.anio||+v.anio<1984||+v.anio>thisYear?'Indica tu año de egreso.':v.nom.length<5?'Escribe tus apellidos y nombres completos.':!v.prog?'Selecciona tu programa de estudios.':!/^\S+@\S+\.\S+$/.test(v.correo)?'Escribe un correo válido.':!/^9\d{8}$/.test(v.tel)?'El celular debe tener nueve dígitos y empezar con 9.':[...v.password].length<12?'La contraseña necesita al menos 12 caracteres.':v.password!==v.password_confirmation?'Las contraseñas no coinciden.':!v.declaration?'Debes aceptar la declaración y la política de privacidad.':'';
    if(msg){err.textContent=msg;return;}
    const b=f.querySelector('[type=submit]');b.disabled=true;
    try{const r=await api('POST','/api/egresados/registro',{...v,prog:+v.prog,anio:+v.anio});FLOW={dni:v.dni,correo:r.correo,minutos:r.minutos||30};codeStep(false);}
    catch(e){err.textContent=e.message;b.disabled=false;}
   };
  });

 const codeStep=askDni=>show(`${steps(1)}<form data-egr-c novalidate>
  ${askDni||!FLOW.correo?`<p class="note" style="margin-top:0">Escribe tu DNI y el código que recibiste en tu correo.</p><div class="field"><label for="eg-dni2">DNI</label><input id="eg-dni2" name="dni" inputmode="numeric" maxlength="8" required value="${esc(FLOW.dni)}"></div>`
   :`<p style="margin-top:0">Enviamos un código de 6 dígitos a <b>${esc(FLOW.correo)}</b>. Vence en ${FLOW.minutos} minutos. Revisa también tu carpeta de spam.</p><input type="hidden" name="dni" value="${esc(FLOW.dni)}">`}
  <div class="field"><label for="eg-code">Código de verificación</label><input id="eg-code" name="codigo" class="egr-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></div>
  <p class="egr-err" role="alert" data-egr-err></p>
  <div class="egr-actions"><button class="btn" type="submit">${sic('check',16)} Confirmar correo</button><button type="button" class="btn ghost" data-egr-resend>Enviar un código nuevo</button><button type="button" class="btn ghost" data-egr-back>Corregir mis datos</button></div>
  <p class="note" style="font-size:13px">¿No llega el código? Puedes acercarte a Secretaría Académica con tu DNI para que validen tu registro.</p></form>`,()=>{
   const f=box.querySelector('[data-egr-c]'),err=box.querySelector('[data-egr-err]');
   box.querySelector('[data-egr-back]').onclick=formStep;
   box.querySelector('[data-egr-resend]').onclick=async()=>{err.textContent='';const dni=f.dni.value.trim();if(!/^\d{8}$/.test(dni)){err.textContent='Escribe tu DNI.';return;}
    try{const r=await api('POST','/api/egresados/codigo',{dni});FLOW={...FLOW,dni,correo:r.correo};toast(`Enviamos un código nuevo a ${r.correo}.`,'ok');}catch(e){err.textContent=e.message;}};
   f.onsubmit=async ev=>{ev.preventDefault();err.textContent='';const dni=f.dni.value.trim(),codigo=f.codigo.value.trim();
    if(!/^\d{8}$/.test(dni)){err.textContent='Escribe tu DNI.';return;}if(!/^\d{6}$/.test(codigo)){err.textContent='El código tiene seis dígitos.';return;}
    const b=f.querySelector('[type=submit]');b.disabled=true;
    try{const r=await api('POST','/api/egresados/verificar',{dni,codigo});FLOW.dni=dni;doneStep(r.estado);}catch(e){err.textContent=e.message;b.disabled=false;}
   };
  });

 const doneStep=estado=>show(`${steps(2)}${estado==='Aprobada'?`<div class="egr-ok"><span class="ic">${sic('check',34)}</span><h3 style="margin:4px 0">¡Tu cuenta está activa!</h3><p>Ingresa con tu <b>DNI</b> y la contraseña que creaste. Te enviamos la confirmación a tu correo.</p><p class="note">Luego completa tu perfil profesional y sube tu CV para postular.</p><div class="egr-actions" style="justify-content:center"><button class="btn" data-egr-login>${sic('key',16)} Ingresar ahora</button></div></div>`
  :`<div class="egr-ok wait"><span class="ic">${sic('clock',34)}</span><h3 style="margin:4px 0">Correo confirmado: tu solicitud está en revisión</h3><p>Secretaría Académica validará tus datos de egresado. Te avisaremos a tu correo cuando tu cuenta esté activa; después ingresarás con tu DNI y la contraseña que creaste.</p><div class="egr-actions" style="justify-content:center"><button class="btn ghost" data-egr-close>Entendido</button></div></div>`}`,()=>{
   const c=box.querySelector('[data-egr-close]');if(c)c.onclick=()=>m.close();
   const l=box.querySelector('[data-egr-login]');if(l)l.onclick=()=>{m.close();goLogin();};
  });

 start==='codigo'?codeStep(true):formStep();
}
// Ingreso tras activar la cuenta: tarjeta «Estudiante/Egresado» si existe; si no, el acceso laboral o la intranet.
function goLogin(){
 const card=document.querySelector('[data-bl-perfil="estudiante"]');if(card){card.click();setTimeout(()=>{const u=document.querySelector('#bl-u');if(u)u.value=FLOW.dni;},50);return;}
 const ws=document.querySelector('.pz-mt [data-tab="workspace"]');if(ws){ws.click();setTimeout(()=>{const r=document.querySelector('#sl-role'),u=document.querySelector('#sl-user');if(r)r.value='egresado';if(u)u.value=FLOW.dni;},50);return;}
 location.hash='#/admin';
}
window.pzRegistroEgresado=openRegistro;
document.addEventListener('click',ev=>{const b=ev.target.closest&&ev.target.closest('[data-egr-open]');if(!b)return;ev.preventDefault();const md=b.closest('.modal-wrap,.modal,[role=dialog]');if(md){const x=md.querySelector('[data-close],.modal-x,button[aria-label="Cerrar"]');if(x)x.click();}openRegistro(b.dataset.egrOpen);});

/* Página pública: invitación a registrarse, encima de las ofertas. */
const base=ROUTES['servicios/bolsa-laboral'];
R('servicios/bolsa-laboral',(...args)=>{
 const out=base(...args);const res=typeof out==='string'?{html:out}:out;if(!res||typeof res.html!=='string')return out;
 const u=currentUser();if(u)return res;
 const t=document.createElement('template');t.innerHTML=res.html;
 const pane=t.content.querySelector('[data-pane="o"]');
 if(pane){const d=document.createElement('template');d.innerHTML=`<section class="egr-cta" aria-label="Registro de egresados"><div><b>¿Egresaste del instituto y aún no tienes cuenta?</b><span>Regístrate en línea, crea tu contraseña y recibe la confirmación en tu correo.</span></div><div class="egr-actions" style="margin:0"><button type="button" class="btn" data-egr-open="registro">Registrarme como egresado</button><button type="button" class="btn ghost" data-egr-open="codigo">Ya tengo un código</button></div></section>`;pane.prepend(d.content);}
 const q=args[1];const auto=q&&q.get&&q.get('registro')==='egresado';
 return Object.assign({},res,{html:t.innerHTML,after:()=>{res.after&&res.after();if(auto)openRegistro('registro');}});
});

/* Intranet: panel del personal (Bolsa laboral › Registro de egresados). */
let FILTRO='Por validar';
window.pzEgresadosPanel=function(head){
 let rows=[],error='';
 try{rows=portalRequest('GET','/api/egresados/solicitudes').requests||[];}catch(e){error=e.message;}
 const prog=id=>((IX.db().programas||[]).find(p=>+p.id===+id)||{}).nombre||'—';
 const count=k=>rows.filter(r=>r.status===k).length;
 const list=FILTRO==='Todas'?rows:rows.filter(r=>r.status===FILTRO);
 const badge=s=>`<span class="badge ${({'Por validar':'warn','Por verificar':'gray','Aprobada':'ok','Rechazada':'err'})[s]||'gray'}">${esc(s==='Por verificar'?'Correo sin confirmar':s)}</span>`;
 const padron=r=>r.padron?`<span class="badge ${['Egresado','Titulado'].includes(r.padron.estado)?'ok':'warn'}">${esc(r.padron.estado==='Regular'?'Estudiante':r.padron.estado)}</span>${r.padron.correo&&r.padron.correo.toLowerCase()!==String(r.email).toLowerCase()?`<br><small>Otro correo: ${esc(r.padron.correo)}</small>`:''}`:'<span class="badge gray">No figura</span>';
 const html=head+`<div class="panel"><h2>Solicitudes de registro de egresados</h2><div class="pb">
  <p class="note">Los egresados se registran en la página de la Bolsa Laboral, crean su contraseña y confirman su correo con un código. Si el padrón ya los registra como egresados con el mismo correo, su cuenta se activa sola. Las demás solicitudes se revisan aquí; el egresado recibe la respuesta en su correo. Al aprobar, se agrega (o actualiza) en el padrón como egresado.</p>
  ${error?`<div class="notice err">${esc(error)}</div>`:`<div class="egr-filter" role="group" aria-label="Filtrar por estado">${['Por validar','Por verificar','Aprobada','Rechazada','Todas'].map(k=>`<button type="button" class="btn sm ${FILTRO===k?'':'ghost'}" data-egr-f="${k}">${k==='Por verificar'?'Correo sin confirmar':k}${k!=='Todas'?` (${count(k)})`:''}</button>`).join('')}</div>
  ${list.length?`<div class="tbl-wrap" style="border:0"><table class="tbl light"><thead><tr><th>Fecha</th><th>DNI</th><th>Apellidos y nombres</th><th>Programa · egreso</th><th>Contacto</th><th>En el padrón</th><th>Estado</th><th></th></tr></thead><tbody>${list.map(r=>`<tr><td>${esc(String(r.created_at||'').slice(0,16))}</td><td class="mono">${esc(r.dni)}</td><td><b>${esc(r.name)}</b></td><td>${esc(prog(r.program_id))}<br><small>Egreso ${esc(r.grad_year)}</small></td><td><small>${esc(r.email)}<br>${esc(r.phone)}</small></td><td>${padron(r)}</td><td>${badge(r.status)}${r.reason?`<br><small>${esc(r.reason)}</small>`:''}${r.decided_by?`<br><small>${esc(r.decided_by)}</small>`:''}</td><td class="c">${['Por validar','Por verificar'].includes(r.status)?`<button type="button" class="btn xs" data-egr-ok="${r.id}">Aprobar</button> <button type="button" class="btn xs ghost" data-egr-no="${r.id}">Rechazar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">No hay solicitudes ${FILTRO==='Todas'?'':'en «'+esc(FILTRO==='Por verificar'?'Correo sin confirmar':FILTRO)+'»'}.</div>`}`}
  </div></div>`;
 return {html,after:()=>{
  document.querySelectorAll('[data-egr-f]').forEach(b=>b.onclick=()=>{FILTRO=b.dataset.egrF;route();});
  const done=msg=>{toast(msg,'ok');setTimeout(()=>location.reload(),900);};
  document.querySelectorAll('[data-egr-ok]').forEach(b=>b.onclick=async()=>{const r=rows.find(x=>x.id===+b.dataset.egrOk);if(!r)return;
   const extra=r.status==='Por verificar'?' Su correo aún no está confirmado: apruébala solo si verificaste su identidad (por ejemplo, en persona con su DNI).':'';
   if(!await confirmBox(`¿Aprobar el registro de ${r.name} (DNI ${r.dni})? Se activará su cuenta con la contraseña que creó y se le avisará a ${r.email}.${extra}`,{ok:'Aprobar',danger:false,title:'Aprobar registro'}))return;
   try{await api('POST','/api/egresados/solicitudes',{id:r.id,accion:'aprobar'});done('Registro aprobado. Se avisó al egresado por correo.');}catch(e){toast(e.message,'err');}});
  document.querySelectorAll('[data-egr-no]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===+b.dataset.egrNo);if(!r)return;
   const m=modal({title:'Rechazar registro',size:'sm',body:`<form data-egr-rf novalidate><p>${esc(r.name)} · DNI ${esc(r.dni)}</p><div class="field"><label for="egr-mot">Motivo (se enviará a ${esc(r.email)})</label><textarea id="egr-mot" rows="3" maxlength="300" required placeholder="Ej.: No figuras como egresado del programa indicado."></textarea></div><p class="egr-err" role="alert" data-egr-err></p><div class="egr-actions"><button class="btn" type="submit">Rechazar y avisar</button></div></form>`});
   const f=m.el.querySelector('[data-egr-rf]');f.onsubmit=async ev=>{ev.preventDefault();const motivo=f.querySelector('textarea').value.trim();if(motivo.length<5){f.querySelector('[data-egr-err]').textContent='Indica el motivo (al menos 5 caracteres).';return;}
    try{await api('POST','/api/egresados/solicitudes',{id:r.id,accion:'rechazar',motivo});m.close();done('Solicitud rechazada. Se avisó al egresado por correo.');}catch(e){f.querySelector('[data-egr-err]').textContent=e.message;}};});
 }};
};
})();
