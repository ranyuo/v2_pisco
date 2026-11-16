'use strict';
// Intranet por módulos (enfoque de v2_palpa): la entrada «/» abre el ingreso, el panel muestra los siete módulos,
// la web institucional no se administra aquí y cada servicio tiene su página independiente.
const {chromium}=require('playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const base=(process.env.PORTAL_BROWSER_URL||process.env.PORTAL_TEST_URL||'http://127.0.0.1:8081').replace(/\/$/,'');assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Use an isolated local test site');
 const account=process.env.PORTAL_TEST_ACCOUNT_FILE?JSON.parse(fs.readFileSync(process.env.PORTAL_TEST_ACCOUNT_FILE,'utf8')):{username:'qaadmin',password:fs.readFileSync(process.env.PORTAL_TEST_PASSWORD_FILE,'utf8')};
 const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
 try{
  const p=await b.newPage();p.setDefaultTimeout(15000);await p.route('https://**/*',r=>r.abort());const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/',{waitUntil:'domcontentloaded'});await p.locator('#lg-u').waitFor();
  assert.match(p.url(),/#\/admin$/,'La entrada / abre el inicio de sesión');console.log('PASS: / opens the login');
  await p.goto(base+'/#/noticias',{waitUntil:'domcontentloaded'});await p.waitForTimeout(800);
  assert.match(await p.locator('main').innerText(),/web institucional/i);console.log('PASS: website routes are not part of the intranet');
  await p.goto(base+'/#/admin',{waitUntil:'domcontentloaded'});await p.locator('#lg-u').fill(account.username);await p.locator('#lg-p').fill(account.password);
  await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),p.locator('#lg-p').press('Enter')]);await p.locator('.intra-modules').waitFor();
  const cards=await p.locator('.intra-modules .intra-module h3').allInnerTexts();
  for(const m of ['Horarios','Certificación modular','Grados y títulos','Mesa de partes','Libro de reclamaciones','Bolsa laboral','CV docente'])assert(cards.includes(m),'Falta el módulo '+m);
  console.log('PASS: the dashboard lists the seven modules');
  const menu=await p.locator('.adm-side nav').innerText();assert(!/Noticias|Portada|Eventos|Admisión/.test(menu),'El menú no debe incluir la web institucional');console.log('PASS: the menu has no website editors');
  await p.goto(base+'/#/admin/noticias',{waitUntil:'domcontentloaded'});await p.waitForTimeout(800);assert.match(await p.locator('main').innerText(),/no tiene permiso|denegado/i);console.log('PASS: website editors are denied');
  for(const [entry,text] of [['/mesa-de-partes.php',/Mesa de partes/i],['/libro-de-reclamaciones.php',/reclamaciones/i],['/bolsa-laboral.php',/Bolsa laboral/i],['/certificados.php',/documentos/i],['/horarios.php',/Horarios/i],['/cv-docente.php',/CV docente/i]]){
   await p.goto(base+entry,{waitUntil:'domcontentloaded'});await p.locator('.standalone-header').waitFor();
   assert.match(await p.locator('.standalone-service-name').innerText(),text);assert.equal(await p.locator('.adm-side').count(),0,'Sin el menú de la intranet');
   console.log('PASS: independent page '+entry);
  }
  assert.deepEqual(errors,[]);console.log('PASS: no browser errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
