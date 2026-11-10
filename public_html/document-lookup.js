/* Consulta de DNI y RUC por API (traído de v2_palpa).
   - Mesa de Partes y Libro de Reclamaciones: al escribir un DNI o un RUC se completan nombres y apellidos o la razón social.
     El navegador consulta /api/identidad; el servidor consulta al proveedor con el token privado, que nunca llega aquí.
   - Configuración (solo administradores): proveedor, URL, token cifrado, límites por visitante y prueba de la API.
   Se carga antes de standalone-services.js para que /mesa-de-partes.php y /libro-de-reclamaciones.php también lo usen. */
'use strict';
(function(){
if(typeof R!=='function'||typeof ROUTES!=='object')return;
const IDLE='Con DNI o RUC completaremos tus datos automáticamente.';
const enabled=()=>!!window.PORTAL_BOOTSTRAP?.documentLookup;

async function identityLookup(tipoDoc,numDoc){
 const response=await fetch(portalURL('/api/identidad'),{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-TOKEN':portalBootstrap.csrf},body:JSON.stringify({tipoDoc,numDoc})});
 let result={};try{result=await response.json();}catch(e){}
 if(!response.ok)throw new Error(result.message||'No se pudo consultar el documento. Completa los campos manualmente.');
 return result.record;
}
// Mesa de Partes (con razón social) y Libro de Reclamaciones (solo nombres y apellidos) comparten el autocompletado.
// Los campos siguen siendo editables: el resultado solo los rellena.
function bindIdentityLookup(f){
 if(!f||!enabled()||f.dataset.idLookup)return;f.dataset.idLookup='1';
 let hint=f.querySelector('[data-idhint]');
 if(!hint){const field=f.numDoc.closest('.field');hint=document.createElement('div');hint.className='hint';hint.dataset.idhint='';hint.id=(f.numDoc.id||'nd')+'-h';hint.setAttribute('aria-live','polite');field.appendChild(hint);f.numDoc.setAttribute('aria-describedby',hint.id);}
 let last='',seq=0;
 const say=(text,cls='')=>{hint.textContent=text;hint.className='hint'+(cls?' '+cls:'');};say(IDLE);
 const setPersona=natural=>{const t=f.tipoPersona;if(!t)return;const want=natural?'Persona natural':[...t.options].map(o=>o.value).find(v=>v!=='Persona natural');if(want&&t.value!==want){t.value=want;t.dispatchEvent(new Event('change'));}};
 const fillPerson=r=>{f.nombresP.value=r.nombres||'';f.apellidos.value=r.apellidos||'';};
 const run=async()=>{
  // Sin tipo elegido, 8 dígitos se toman como DNI y 11 que empiezan con 10 o 20 como RUC.
  if(!f.tipoDoc.value){const n=f.numDoc.value.trim();if(/^\d{8}$/.test(n))f.tipoDoc.value='DNI';else if(/^(10|20)\d{9}$/.test(n))f.tipoDoc.value='RUC';}
  const tipo=f.tipoDoc.value,num=f.numDoc.value.trim(),key=tipo+':'+num;
  if(!['DNI','RUC'].includes(tipo)||validDoc(tipo,num)){last='';seq++;f.numDoc.removeAttribute('aria-busy');return say(IDLE);}
  if(key===last)return;last=key;const mine=++seq;
  say('Consultando '+tipo+'…','pz-id-wait');f.numDoc.setAttribute('aria-busy','true');
  try{
   const r=await identityLookup(tipo,num);if(mine!==seq)return;
   const extra=[r.estado,r.condicion].filter(Boolean).join(' · ');
   if(tipo==='DNI'){setPersona(true);f.tipoDoc.value='DNI';fillPerson(r);say('Datos encontrados: '+[r.nombres,r.apellidos].filter(Boolean).join(' ')+'. Revísalos antes de enviar.','pz-id-ok');}
   else if(f.razon){setPersona(false);f.tipoDoc.value='RUC';f.razon.value=r.razon||'';if(r.direccion&&f.direccion&&!f.direccion.value.trim())f.direccion.value=r.direccion;say('Datos encontrados: '+(r.razon||'')+(extra?' ('+extra+')':'')+'. Revísalos antes de enviar.','pz-id-ok');}
   else if(r.nombres||r.apellidos){fillPerson(r);say('Datos encontrados: '+[r.nombres,r.apellidos].filter(Boolean).join(' ')+(extra?' ('+extra+')':'')+'. Revísalos antes de enviar.','pz-id-ok');}
   else say('RUC de '+(r.razon||'una entidad')+(extra?' ('+extra+')':'')+'. Escribe los nombres y apellidos de quien presenta el reclamo.','pz-id-ok');
  }catch(error){if(mine===seq){say(error.message,'pz-id-err');last='';}}
  finally{if(mine===seq)f.numDoc.removeAttribute('aria-busy');}
 };
 f.numDoc.addEventListener('input',()=>{if(['DNI','RUC'].includes(f.tipoDoc.value))f.numDoc.value=f.numDoc.value.replace(/\D/g,'');run();});
 f.tipoDoc.addEventListener('change',run);
 f.addEventListener('reset',()=>setTimeout(()=>{last='';seq++;say(IDLE);},0));
}
// Se enlaza después de que cada formulario termina de prepararse (incluidas las rutas alternativas del Libro).
for(const path of ['servicios/mesa-de-partes','servicios/libro-de-reclamaciones','libro-de-reclamaciones','transparencia/libro-de-reclamaciones']){
 const original=ROUTES[path];if(typeof original!=='function')continue;
 R(path,(...args)=>{const out=original(...args);const res=typeof out==='string'?{html:out}:out;
  return Object.assign({},res,{after:()=>{res.after&&res.after();bindIdentityLookup(document.querySelector('[data-mpv]'));bindIdentityLookup(document.querySelector('[data-lr2]'));}});});
}

/* ---------- Configuración: API de DNI y RUC (solo administradores) ---------- */
const originalConfig=CUSTOM.config;
if(typeof originalConfig==='function')CUSTOM.config=(...args)=>{
 const out=originalConfig(...args);
 if(currentUser()?.rol!=='admin')return out;
 const res=typeof out==='string'?{html:out}:out;const after=res.after;
 return Object.assign({},res,{html:res.html+docLookupHTML(),after:()=>{after&&after();docLookupBind();}});
};
function docLookupHTML(){return `<section class="panel" style="margin-top:20px"><h2>Consulta de DNI y RUC (API)</h2><form class="pb" data-idapi-form autocomplete="off" novalidate><p>Al escribir un DNI o RUC en la Mesa de Partes o en el Libro de Reclamaciones se completan los nombres o la razón social con la API configurada aquí. El token se guarda cifrado en el servidor y nunca se muestra.</p><div class="form-grid">
 <div class="field full"><label class="check"><input name="enabled" type="checkbox"> Activar autocompletado por DNI y RUC</label></div>
 <div class="field"><label for="idapi-provider">Proveedor</label><select id="idapi-provider" name="provider"></select><small data-idapi-docs></small></div>
 <div class="field"><label for="idapi-url">URL base de la API</label><input id="idapi-url" name="base_url" type="url" required maxlength="200" placeholder="https://api.migo.pe/api/v2"><small>Debe empezar con https://. Déjala como está salvo que el proveedor indique otra.</small></div>
 <div class="field full"><label for="idapi-token">Token de la API</label><input id="idapi-token" name="token" type="password" maxlength="512" autocomplete="new-password" spellcheck="false" placeholder="Pega aquí el token del proveedor"><small data-idapi-token-info>El token guardado no se muestra.</small><label class="check" data-idapi-clear hidden><input name="clear_token" type="checkbox"> Borrar el token guardado</label></div>
 <div class="field"><label for="idapi-min">Consultas por minuto por visitante</label><input id="idapi-min" name="per_minute" type="number" min="1" max="120" required></div>
 <div class="field"><label for="idapi-hour">Consultas por hora por visitante</label><input id="idapi-hour" name="per_hour" type="number" min="1" max="2000" required><small>Evitan que se use el formulario para recorrer el padrón. Cada consulta consume créditos del plan.</small></div>
 </div><p data-idapi-message role="status" aria-live="polite"></p><button type="submit" class="btn">Guardar configuración de la API</button></form>
 <form class="pb" data-idapi-test-form autocomplete="off" novalidate style="border-top:1px solid var(--line,#e5e7eb)"><h3 style="margin:0 0 6px">Probar la API</h3><p>Consulta un documento con la configuración <b>guardada</b>, aunque el autocompletado esté desactivado.</p>
 <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><label class="field" style="min-width:130px">Tipo<select name="tipoDoc"><option>RUC</option><option>DNI</option></select></label><label class="field" style="flex:1;min-width:180px">Número<input name="numDoc" required inputmode="numeric" maxlength="11" value="20131312955"></label><button type="submit" class="btn sec">Probar consulta</button></div>
 <p data-idapi-test-message role="status" aria-live="polite"></p></form></section>`;}
function docLookupBind(){
 const form=document.querySelector('[data-idapi-form]');if(!form)return;
 // Formularios propios: no deben enviar el formulario general de Configuración.
 form.addEventListener('submit',e=>e.stopPropagation());
 const message=form.querySelector('[data-idapi-message]'),save=form.querySelector('[type=submit]'),provider=form.elements.provider,docs=form.querySelector('[data-idapi-docs]');let providers={};
 const showDocs=()=>{const p=providers[provider.value];docs.innerHTML=p?`Documentación: <a href="${esc(p.docs)}" target="_blank" rel="noopener">${esc(p.docs)}</a>`:'';};
 const fill=info=>{providers=info.providers||{};provider.innerHTML=Object.entries(providers).map(([k,p])=>`<option value="${esc(k)}">${esc(p.label)}</option>`).join('');
  provider.value=info.provider;form.elements.base_url.value=info.base_url;form.elements.enabled.checked=info.enabled;form.elements.per_minute.value=info.per_minute;form.elements.per_hour.value=info.per_hour;form.elements.token.value='';form.elements.clear_token.checked=false;
  form.querySelector('[data-idapi-clear]').hidden=!info.has_token;form.querySelector('[data-idapi-token-info]').textContent=info.has_token?`Token guardado de forma protegida (${info.token_hint}). Deja el campo vacío para conservarlo.`:'Todavía no hay token guardado.';showDocs();};
 try{fill(portalRequest('GET','/api/identidad/config'));}catch(error){message.textContent=error.message;save.disabled=true;}
 provider.onchange=()=>{const p=providers[provider.value];if(p)form.elements.base_url.value=p.base_url;showDocs();message.textContent='Proveedor cambiado: introduce el token de este proveedor y guarda.';};
 form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;save.disabled=true;message.className='';message.textContent='Guardando…';
  try{const e=form.elements;const result=portalRequest('PUT','/api/identidad/config',{enabled:e.enabled.checked,provider:e.provider.value,base_url:e.base_url.value.trim(),token:e.token.value.trim(),clear_token:e.clear_token.checked,per_minute:Number(e.per_minute.value),per_hour:Number(e.per_hour.value)});
   fill(result);window.PORTAL_BOOTSTRAP.documentLookup=result.enabled&&result.has_token;message.className='ok';message.textContent='Configuración guardada. '+(result.enabled?'Autocompletado activado.':'Autocompletado desactivado.');toast('Configuración de la API guardada.','ok');}
  catch(error){message.className='notice';message.textContent=error.message;}finally{save.disabled=false;}
 };
 const test=document.querySelector('[data-idapi-test-form]'),out=test.querySelector('[data-idapi-test-message]'),run=test.querySelector('[type=submit]');
 test.addEventListener('submit',e=>e.stopPropagation());
 test.elements.tipoDoc.onchange=()=>{test.elements.numDoc.maxLength=test.elements.tipoDoc.value==='DNI'?8:11;};
 test.onsubmit=async event=>{event.preventDefault();if(run.disabled||!test.reportValidity())return;run.disabled=true;run.setAttribute('aria-busy','true');out.className='';out.textContent='Consultando…';
  try{const response=await fetch(portalURL('/api/identidad/prueba'),{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-TOKEN':portalBootstrap.csrf},body:JSON.stringify({tipoDoc:test.elements.tipoDoc.value,numDoc:test.elements.numDoc.value.trim()})});
   let result={};try{result=await response.json();}catch(e){}
   if(!response.ok)throw new Error(result.message||'No se pudo conectar con el servidor.');
   const r=result.record||{};out.className=result.ok?'ok':'notice';
   out.textContent=result.ok?'✓ '+result.message+' '+(r.razon||[r.nombres,r.apellidos].filter(Boolean).join(' '))+(r.estado?` (${[r.estado,r.condicion].filter(Boolean).join(' · ')})`:''):'✗ '+result.message;
  }catch(error){out.className='notice';out.textContent=error.message;}
  finally{run.disabled=false;run.removeAttribute('aria-busy');}
 };
}
})();
