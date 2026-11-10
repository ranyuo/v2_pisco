// Configuración → Consulta de DNI y RUC (API): el administrador elige proveedor, URL, token y límites.
// La prueba usa una URL https local sin servicio, así que no se consulta ningún proveedor real.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const config=process.env.PORTAL_CONFIG_FILE;
assert(config&&fs.existsSync(config),'Indica en PORTAL_CONFIG_FILE la configuración de la instalación de pruebas');
const account=JSON.parse(fs.readFileSync(process.env.PORTAL_TEST_ACCOUNT_FILE,'utf8'));
const base=(process.env.PORTAL_BROWSER_URL||'http://127.0.0.1:8081/').replace(/\/$/,'');
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const settings=path.join(path.dirname(config),'.document-lookup.json');
const previous=fs.existsSync(settings)?fs.readFileSync(settings):null;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let checks=0;
 const login=async()=>{await page.goto(base+'/#/admin');await page.fill('#lg-u',account.username);await page.fill('#lg-p',account.password);await page.press('#lg-p','Enter');await page.waitForFunction(()=>!!currentUser());};
 const put=()=>page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('api%2Fidentidad%2Fconfig'));
 try{
  if(fs.existsSync(settings))fs.unlinkSync(settings);
  await login();await page.goto(base+'/#/admin/config');const form=page.locator('[data-idapi-form]');await form.waitFor();
  assert.equal(await form.locator('[name=provider]').inputValue(),'migo');assert.equal(await form.locator('[name=base_url]').inputValue(),'https://api.migo.pe/api/v2');
  assert.equal(await form.locator('[name=enabled]').isChecked(),false);assert.match(await form.locator('[data-idapi-token-info]').innerText(),/Todavía no hay token/);assert.match(await form.locator('[data-idapi-docs]').innerText(),/docs\.migo\.pe/);checks++;

  // Habilitar sin token: el servidor lo rechaza.
  await form.locator('[name=enabled]').check();let r=put();await form.locator('[type=submit]').click();assert.equal((await r).status(),422);assert.match(await form.locator('[data-idapi-message]').innerText(),/token/);checks++;

  // Cambiar de proveedor rellena su URL.
  await form.locator('[name=provider]').selectOption('decolecta');assert.equal(await form.locator('[name=base_url]').inputValue(),'https://api.decolecta.com/v1');await form.locator('[name=provider]').selectOption('migo');checks++;

  // Guardar con token: queda cifrado y no se devuelve.
  await form.locator('[name=base_url]').fill('https://127.0.0.1:9/api/v2');await form.locator('[name=token]').fill('token-navegador-prueba-ab12');await form.locator('[name=per_minute]').fill('5');await form.locator('[name=per_hour]').fill('25');
  r=put();await form.locator('[type=submit]').click();let res=await r;assert.equal(res.status(),200);const body=await res.text();assert(!body.includes('token-navegador-prueba'));checks++;
  assert.equal(await form.locator('[name=token]').inputValue(),'');assert.match(await form.locator('[data-idapi-token-info]').innerText(),/Token guardado.*ab12/);assert(!fs.readFileSync(settings,'utf8').includes('token-navegador-prueba'));checks++;
  await page.reload();await form.waitFor();assert.equal(await form.locator('[name=enabled]').isChecked(),true);assert.equal(await form.locator('[name=base_url]').inputValue(),'https://127.0.0.1:9/api/v2');assert.equal(await form.locator('[name=per_minute]').inputValue(),'5');assert.equal(await form.locator('[name=per_hour]').inputValue(),'25');checks++;
  assert.equal(await page.evaluate(()=>JSON.stringify(window.PORTAL_BOOTSTRAP).includes('token-navegador-prueba')),false);checks++;

  // URL sin https: rechazada.
  await form.locator('[name=base_url]').fill('http://api.migo.pe/api/v2');r=put();await form.locator('[type=submit]').click();
  const status=await Promise.race([r.then(x=>x.status()),new Promise(ok=>setTimeout(()=>ok('validación del navegador'),800))]);
  if(status!=='validación del navegador')assert.equal(status,422);
  await page.reload();await form.waitFor();assert.equal(await form.locator('[name=base_url]').inputValue(),'https://127.0.0.1:9/api/v2');checks++;

  // Prueba con la configuración guardada: la URL local no responde y se informa sin bloquear la pantalla.
  const test=page.locator('[data-idapi-test-form]');await test.locator('[type=submit]').click();await page.waitForFunction(()=>/✗/.test(document.querySelector('[data-idapi-test-message]').textContent),null,{timeout:20000});
  assert.match(await test.locator('[data-idapi-test-message]').innerText(),/no está disponible/);checks++;
  await test.locator('[name=tipoDoc]').selectOption('DNI');await test.locator('[name=numDoc]').fill('123');await test.locator('[type=submit]').click();await page.waitForFunction(()=>/8 dígitos/.test(document.querySelector('[data-idapi-test-message]').textContent));checks++;

  // La Mesa de Partes ya ve el autocompletado activado.
  await page.goto(base+'/mesa-de-partes.php');await page.locator('[data-mpv]').waitFor();assert.equal(await page.evaluate(()=>PORTAL_BOOTSTRAP.documentLookup),true);assert.match(await page.locator('[data-idhint]').innerText(),/completaremos/);checks++;

  // Borrar el token desactiva el autocompletado.
  await page.goto(base+'/#/admin/config');await form.waitFor();await form.locator('[name=enabled]').uncheck();await form.locator('[name=clear_token]').check();r=put();await form.locator('[type=submit]').click();assert.equal((await r).status(),200);assert.match(await form.locator('[data-idapi-token-info]').innerText(),/Todavía no hay token/);checks++;
  await page.goto(base+'/mesa-de-partes.php');await page.locator('[data-mpv]').waitFor();assert.equal(await page.evaluate(()=>PORTAL_BOOTSTRAP.documentLookup),false);checks++;

  await page.goto(base+'/#/admin/config');await form.waitFor();await page.setViewportSize({width:390,height:844});assert(await form.evaluate(el=>el.scrollWidth<=el.clientWidth+1));checks++;await page.setViewportSize({width:1440,height:1100});

  // Sin sesión de administrador no se puede leer, guardar ni probar.
  await page.evaluate(()=>portalRequest('DELETE','/api/session'));await page.goto(base+'/?'+Date.now());await page.waitForFunction(()=>!!window.PORTAL_BOOTSTRAP&&!PORTAL_BOOTSTRAP.user);
  const denied=await page.evaluate(async()=>{const h={'Content-Type':'application/json','X-CSRF-TOKEN':PORTAL_BOOTSTRAP.csrf};return [(await fetch('/index.php?route=api%2Fidentidad%2Fconfig')).status,(await fetch('/index.php?route=api%2Fidentidad%2Fconfig',{method:'PUT',headers:h,body:'{}'})).status,(await fetch('/index.php?route=api%2Fidentidad%2Fprueba',{method:'POST',headers:h,body:'{"tipoDoc":"RUC","numDoc":"20131312955"}'})).status];});
  assert.deepEqual(denied,[403,403,403]);checks++;
  assert.equal(await page.evaluate(async()=>(await fetch('/index.php?route=api%2Fidentidad%2Fconfig',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'})).status),419);checks++;
  assert.deepEqual(errors,[]);console.log(`${checks} comprobaciones del formulario de la API de DNI/RUC aprobadas.`);
 }finally{await browser.close();if(previous!==null)fs.writeFileSync(settings,previous,{mode:0o600});else if(fs.existsSync(settings))fs.unlinkSync(settings);}
})().catch(e=>{console.error(e);process.exit(1)});
