/* Recuperar la contraseña con un código enviado al correo registrado de la cuenta.
   Disponible desde el ingreso a la intranet, las tarjetas de la Bolsa Laboral y «Mi acceso laboral».
   El servidor responde igual exista o no la cuenta; el código vence en 15 minutos y admite 5 intentos. */
'use strict';
(function(){
const api=async(url,body)=>{
 const r=await fetch(portalURL(url),{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','X-CSRF-TOKEN':portalBootstrap.csrf},body:JSON.stringify(body)});
 let data={};try{data=await r.json();}catch(e){}
 if(!r.ok)throw new Error(data.message||'No se pudo conectar con el servidor. Inténtalo nuevamente.');
 return data;
};
const S=document.createElement('style');
S.textContent=`.pwr-code{font:700 26px/1 ui-monospace,monospace;letter-spacing:.4em;text-align:center}.pwr-err{color:#b42318;min-height:1.2em;margin:4px 0}.pwr-a{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px}.pwr-ok{text-align:center}.pwr-ok .ic{width:60px;height:60px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#e6f6ee;color:#167548;margin-bottom:8px}`;
document.head.appendChild(S);

function openReset(prefill){
 let user=prefill||'';let minutes=15;
 const m=modal({title:'Restablecer contraseña',size:'sm',body:'<div data-pwr></div>'});const box=m.el.querySelector('[data-pwr]');
 const show=(html,bind)=>{box.innerHTML=html;bind();const f=box.querySelector('input:not([type=checkbox])');if(f)f.focus();};
 const step1=()=>show(`<form data-pwr1 novalidate><p style="margin-top:0">Escribe tu usuario. Te enviaremos un código de 6 dígitos al correo registrado en tu cuenta.</p>
  <div class="field"><label for="pwr-u">Usuario</label><input id="pwr-u" name="u" autocomplete="username" maxlength="80" placeholder="DNI, RUC o usuario" value="${esc(user)}" required></div>
  <p class="pwr-err" role="alert" data-pwr-err></p>
  <div class="pwr-a"><button class="btn" type="submit">${sic('send',16)} Enviar código</button><button type="button" class="btn ghost" data-pwr-have>Ya tengo un código</button></div></form>`,()=>{
   const f=box.querySelector('[data-pwr1]'),err=box.querySelector('[data-pwr-err]');
   box.querySelector('[data-pwr-have]').onclick=()=>{user=f.u.value.trim();step2(false);};
   f.onsubmit=async ev=>{ev.preventDefault();err.textContent='';user=f.u.value.trim();if(!user){err.textContent='Escribe tu usuario.';return;}
    const b=f.querySelector('[type=submit]');b.disabled=true;
    try{const r=await api('/api/clave/codigo',{usuario:user});minutes=r.minutos||15;step2(true);}catch(e){err.textContent=e.message;b.disabled=false;}};
  });
 const step2=sent=>show(`<form data-pwr2 novalidate>${sent?`<p style="margin-top:0">Si el usuario <b>${esc(user)}</b> tiene un correo registrado, te enviamos un código. Vence en ${minutes} minutos; revisa también tu carpeta de spam.</p>`:''}
  <div class="field"><label for="pwr-u2">Usuario</label><input id="pwr-u2" name="u" autocomplete="username" maxlength="80" value="${esc(user)}" required></div>
  <div class="field"><label for="pwr-c">Código</label><input id="pwr-c" name="c" class="pwr-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></div>
  <div class="field"><label for="pwr-p">Nueva contraseña</label><input id="pwr-p" name="p" type="password" minlength="12" maxlength="72" autocomplete="new-password" required><div class="hint">Mínimo 12 caracteres.</div></div>
  <div class="field"><label for="pwr-p2">Repite la nueva contraseña</label><input id="pwr-p2" name="p2" type="password" maxlength="72" autocomplete="new-password" required></div>
  <label class="check"><input type="checkbox" name="ver"> <span>Mostrar contraseña</span></label>
  <p class="pwr-err" role="alert" data-pwr-err></p>
  <div class="pwr-a"><button class="btn" type="submit">${sic('check',16)} Cambiar contraseña</button><button type="button" class="btn ghost" data-pwr-new>Pedir otro código</button></div>
  <p class="note" style="font-size:13px">¿No tienes un correo registrado o no llega el código? Estudiantes y egresados: Secretaría Académica. Empresas: responsable de la Bolsa Laboral.</p></form>`,()=>{
   const f=box.querySelector('[data-pwr2]'),err=box.querySelector('[data-pwr-err]');
   if(user)setTimeout(()=>f.c.focus(),0);
   f.ver.onchange=()=>{f.p.type=f.p2.type=f.ver.checked?'text':'password';};
   box.querySelector('[data-pwr-new]').onclick=()=>{user=f.u.value.trim();step1();};
   f.onsubmit=async ev=>{ev.preventDefault();err.textContent='';user=f.u.value.trim();const codigo=f.c.value.trim();
    const msg=!user?'Escribe tu usuario.':!/^\d{6}$/.test(codigo)?'El código tiene seis dígitos.':[...f.p.value].length<12?'La nueva contraseña necesita al menos 12 caracteres.':f.p.value!==f.p2.value?'Las contraseñas no coinciden.':'';
    if(msg){err.textContent=msg;return;}
    const b=f.querySelector('[type=submit]');b.disabled=true;
    try{await api('/api/clave/restablecer',{usuario:user,codigo,password:f.p.value,password_confirmation:f.p2.value});step3();}catch(e){err.textContent=e.message;b.disabled=false;}};
  });
 const step3=()=>show(`<div class="pwr-ok"><span class="ic">${sic('check',30)}</span><h3 style="margin:4px 0">Contraseña cambiada</h3><p>Ya puedes ingresar con tu usuario y tu nueva contraseña. Te enviamos un aviso a tu correo.</p><div class="pwr-a" style="justify-content:center"><button class="btn" data-pwr-close>Ir a ingresar</button></div></div>`,()=>{
   box.querySelector('[data-pwr-close]').onclick=()=>{m.close();const u=document.querySelector('#bl-u:not([type=hidden]), #lg-u, #sl-user');if(u){u.value=user;const p=u.form&&u.form.querySelector('input[type=password]');if(p){p.value='';p.focus();}}};
  });
 user?step2(false):step1();
}
window.pzRestablecerClave=openReset;
// En captura: reemplaza el aviso anterior («se restablece en la institución») de los ingresos existentes.
document.addEventListener('click',ev=>{
 const a=ev.target.closest&&ev.target.closest('[data-pw-reset],[data-olv]');if(!a)return;
 ev.preventDefault();ev.stopPropagation();
 const form=a.closest('form');const u=form&&form.querySelector('input[name=username],input[name=u]');const prefill=u?u.value.trim():'';
 const md=a.closest('.modal-wrap,.modal,[role=dialog]');if(md){const x=md.querySelector('[data-close],.modal-x,button[aria-label="Cerrar"]');if(x)x.click();}
 openReset('');if(prefill)setTimeout(()=>{const i=document.querySelector('#pwr-u');if(i)i.value=prefill;},0);
},true);
})();
