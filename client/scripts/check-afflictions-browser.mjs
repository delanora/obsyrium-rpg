/** Administração de afecções: Chromium, MechanicalPanel real e API simulada. */
import {build} from 'esbuild';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
const fixture=JSON.parse(fs.readFileSync(process.env.AFFLICTION_FIXTURE_OUTPUT,'utf8'));assert.equal(fixture.name,'Afecções Fixture');
fixture.state.afflictions=[];const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'afeccoes-browser-'));
await build({nodePaths:[path.join(root,'client/node_modules')],stdin:{resolveDir:path.join(root,'client'),loader:'tsx',contents:`
import React from'react';import{createRoot}from'react-dom/client';import{AuthProvider}from'./src/auth';import{MechanicalPanel}from'./src/components/MechanicalPanel';import './src/styles.css';import './src/fonts.css';
localStorage.setItem('grimorio.token','fixture');const entity=${JSON.stringify(fixture.entity)};createRoot(document.getElementById('root')).render(<AuthProvider><MechanicalPanel entity={entity} variant="sheet" refreshVersion={0}/></AuthProvider>);`},bundle:true,jsx:'automatic',external:['/archive/*','/creation/*','/brand/*','/fonts/*','/dice-tray/*'],outfile:path.join(temp,'app.js')});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:900}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const calls=[];let current=structuredClone(fixture);let viewerRole='MASTER';
 await page.route('**/*',async route=>{const req=route.request(),p=new URL(req.url()).pathname;
  if(p==='/api/auth/me')return route.fulfill({json:{user:{id:'master',username:'fixture',displayName:'Fixture',role:viewerRole}}});
  if(p===`/api/mechanical/${fixture.entity.kind}/${fixture.entity.id}`)return route.fulfill({json:{mechanical:current}});
  if(p==='/api/mechanical/mutate'){
   const body=req.postDataJSON();calls.push(body);assert.equal(body.expectedVersion,current.version);assert.ok(body.operationId);current.version++;
   if(body.action==='affliction-add')current.state.afflictions.push({id:crypto.randomUUID(),kind:body.afflictionKind,label:body.label,appliedBy:'master',appliedAt:new Date().toISOString()});
   if(body.action==='affliction-remove')current.state.afflictions=current.state.afflictions.filter(a=>a.id!==body.afflictionId);
   return route.fulfill({json:{mechanical:current,replayed:false}});
  }
  if(p.startsWith('/api/')||p.startsWith('/socket.io/'))return route.fulfill({status:404,json:{message:'Leitura complementar não usada nesta fixture'}});
  if(p==='/')return route.fulfill({contentType:'text/html',body:'<html data-theme="dark"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>'});
  if(p==='/app.js'||p==='/app.css')return route.fulfill({path:path.join(temp,p.slice(1)),contentType:p.endsWith('.js')?'text/javascript':'text/css'});
  const file=path.join(root,'client/public',p);if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.fulfill({status:404,body:''});
 });
 await page.goto('http://fixture.test/');await page.getByText('Doenças e venenos por origem',{exact:true}).click();
 const register=page.getByRole('button',{name:'Registrar origem',exact:true});assert.equal(await register.isDisabled(),true);
 await page.getByLabel('Nome da doença ou veneno').fill('Veneno do escorpião');await register.click();await page.getByText('Veneno — Veneno do escorpião',{exact:true}).waitFor();
 assert.deepEqual(calls[0].symptoms,['poisoned']);assert.equal(calls[0].afflictionKind,'poison');
 await page.getByLabel('Tipo de afecção').selectOption('disease');assert.equal(await page.getByLabel('Sintoma da afecção').inputValue(),'');
 await page.getByLabel('Nome da doença ou veneno').fill('Febre Fixture');await register.click();await page.getByText('Doença — Febre Fixture',{exact:true}).waitFor();assert.deepEqual(calls[1].symptoms,[]);
 await page.getByRole('button',{name:'Encerrar esta origem',exact:true}).first().click();await page.getByText('Veneno — Veneno do escorpião',{exact:true}).waitFor({state:'hidden'});assert.equal(current.state.afflictions.length,1);
 await page.setViewportSize({width:390,height:844});const form=await page.locator('.affliction-admin-form').boundingBox();assert.ok(form.x>=0&&form.x+form.width<=390);await page.screenshot({path:path.join(temp,'afeccoes-celular.png'),fullPage:true});assert.deepEqual(errors,[]);
 viewerRole='PLAYER';await page.reload();await page.getByText('Doenças e venenos por origem',{exact:true}).click();await page.getByText('Doença — Febre Fixture',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Registrar origem',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Encerrar esta origem',exact:true}).count(),0);
 console.log('Chromium: registro por origem, veneno com sintoma, doença sem condição, remoção seletiva, versão e celular aprovados; '+temp);
}finally{await browser.close();}
