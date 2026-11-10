/* Notificaciones por correo (SMTP) en Configuración del portal. Adaptado de v2_palpa.
   Solo la cuenta administradora ve y guarda la configuración; el servidor también lo exige. */
'use strict';
(function(){
const originalConfig=CUSTOM.config;
if(typeof originalConfig!=='function')return;
CUSTOM.config=(...args)=>{
 const out=originalConfig(...args);
 if(currentUser()?.rol!=='admin')return out;
 out.html+=mailSmtpHTML()+'<section class="panel"><h2>Estado de las notificaciones por correo</h2><div class="pb" data-mail-panel>Cargando estado del correo…</div></section>';
 const after=out.after;out.after=()=>{after?.();mailSmtpBind();mailStatusPanel();};
 return out;
};

function mailSmtpHTML(){return `<section class="panel" style="margin-top:20px"><h2>Configurar correo notificador (SMTP)</h2><form class="pb" data-smtp-form autocomplete="off" novalidate><p>Configura la cuenta central que enviará los avisos de Mesa de Partes, Libro de Reclamaciones y Bolsa Laboral. Los correos receptores de cada servicio se indican arriba y en la configuración de cada módulo.</p><div class="form-grid">
 <div class="field full"><label class="check"><input name="enabled" type="checkbox"> Activar envío de notificaciones por correo</label></div>
 <div class="field"><label for="smtp-host">Servidor SMTP</label><input id="smtp-host" name="host" required maxlength="253" placeholder="smtp.gmail.com"></div>
 <div class="field"><label for="smtp-port">Puerto</label><input id="smtp-port" name="port" type="number" min="1" max="65535" required></div>
 <div class="field"><label for="smtp-security">Seguridad de la conexión</label><select id="smtp-security" name="encryption"><option value="tls">STARTTLS (Gmail: puerto 587)</option><option value="ssl">SSL/TLS (puerto 465)</option></select></div>
 <div class="field"><label for="smtp-user">Correo de acceso SMTP</label><input id="smtp-user" name="username" type="email" required maxlength="254" autocomplete="off"></div>
 <div class="field"><label for="smtp-from">Correo remitente</label><input id="smtp-from" name="from_email" type="email" required maxlength="254"></div>
 <div class="field"><label for="smtp-name">Nombre visible del remitente</label><input id="smtp-name" name="from_name" required maxlength="150"></div>
 <div class="field full"><label for="smtp-password">Contraseña de aplicación</label><input id="smtp-password" name="password" type="password" maxlength="512" autocomplete="new-password" placeholder="Introduce una nueva contraseña de aplicación"><small data-smtp-password-info>La contraseña guardada no se muestra.</small></div>
 </div><p data-smtp-message role="status" aria-live="polite"></p><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn sec" data-smtp-gmail>Usar Gmail / Google Workspace</button><button type="submit" class="btn">Guardar configuración SMTP</button></div><p class="note">Guardar no envía correos de prueba. Al activar el servicio se podrán entregar los avisos pendientes. El proceso de reintentos (cron de <code>mail-worker.php</code>) debe estar programado en el hosting.</p></form></section>`;}

function mailSmtpBind(){
 const form=document.querySelector('[data-smtp-form]');if(!form)return;
 // El formulario SMTP no forma parte del formulario general de Configuración.
 form.addEventListener('submit',event=>event.stopPropagation());
 const message=form.querySelector('[data-smtp-message]');const save=form.querySelector('[type=submit]');
 const fill=info=>{for(const key of ['host','port','encryption','username','from_email','from_name'])form.elements[key].value=info[key]??'';form.elements.enabled.checked=!!info.enabled;form.elements.password.value='';form.querySelector('[data-smtp-password-info]').textContent=info.has_password?'Contraseña guardada de forma protegida. Deja el campo vacío para conservarla.':'Todavía no hay contraseña guardada. Introduce una nueva contraseña de aplicación.';};
 try{fill(portalRequest('GET','/api/smtp'));}catch(error){message.textContent=error.message;save.disabled=true;}
 form.querySelector('[data-smtp-gmail]').onclick=()=>{
  for(const [key,value] of Object.entries({host:'smtp.gmail.com',port:587,encryption:'tls'}))form.elements[key].value=value;
  if(!form.elements.from_name.value)form.elements.from_name.value='Notificaciones · '+(inst().nombreCorto||inst().nombre);
  message.textContent='Datos de Gmail cargados. Indica la cuenta, introduce su contraseña de aplicación y guarda la configuración.';
 };
 form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;save.disabled=true;message.textContent='Guardando…';
  try{const input=Object.fromEntries(new FormData(form));input.enabled=form.elements.enabled.checked;input.port=Number(input.port);const result=portalRequest('PUT','/api/smtp',input);fill(result);message.textContent='Configuración SMTP guardada. '+(result.enabled?'Envío habilitado.':'Envío desactivado.');mailStatusPanel();}
  catch(error){message.textContent=error.message;}finally{save.disabled=false;}
 };
}

const MAIL_SOURCES={expedientes:'Mesa de Partes',reclamos:'Reclamos',empresas:'Empresas',ofertas:'Ofertas',postulaciones:'Postulaciones'};
function mailStatusPanel(){
 const panel=document.querySelector('[data-mail-panel]');if(!panel)return;
 try{const info=portalRequest('GET','/api/notificaciones');
  panel.innerHTML=`<p>Remitente central: <b>${esc(info.from)}</b>.</p><p>${info.configured?'SMTP habilitado para Mesa de Partes, Reclamos y Bolsa Laboral. Los avisos de seguimiento y las postulaciones se procesan mediante el cron de correo.':'Completa el formulario SMTP y activa el envío. Los avisos quedan en cola hasta habilitar el servicio.'}</p><p>El estado «Enviado» indica aceptación por el servidor de correo; revisa también la bandeja de spam del destinatario.</p>${(info.warnings||[]).map(w=>`<p class="notice">${esc(w)}</p>`).join('')}<button type="button" class="btn sec sm" data-mail-refresh>Actualizar estado</button><div class="tbl-wrap"><table class="tbl light"><thead><tr><th>Módulo / evento</th><th>Referencia</th><th>Destinatario</th><th>Estado</th><th>Intentos</th><th>Detalle</th></tr></thead><tbody>${info.messages.map(m=>`<tr><td>${esc(MAIL_SOURCES[m.source_type]||m.source_type)} · ${esc(m.event)}</td><td>${esc(m.reference)}</td><td>${esc(m.recipient)}</td><td>${esc(m.status)}</td><td>${+m.attempts}</td><td>${esc(m.last_error||'')}${m.status==='Error'?` <button type="button" class="btn sm" data-mail-retry="${esc(m.id)}">Reintentar</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6">No hay notificaciones registradas.</td></tr>'}</tbody></table></div>`;
  panel.querySelector('[data-mail-refresh]').onclick=mailStatusPanel;
  panel.querySelectorAll('[data-mail-retry]').forEach(button=>{button.onclick=()=>{try{portalRequest('POST','/api/notificaciones/reintentar',{id:button.dataset.mailRetry});mailStatusPanel();toast('Notificación en cola. Se procesará en la próxima ejecución del correo.','ok');}catch(error){toast(error.message,'err');}};});
 }catch(error){panel.textContent='No se pudo consultar el correo. Verifica que se haya ejecutado la actualización de la base (actualizar.php o install.php).';}
}
})();
