/** Recursos na ficha: API simulada e DTO de fixture própria do smoke isolado. */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const fixturePath = process.env.SECOND_WIND_FIXTURE_OUTPUT;
assert.ok(fixturePath, 'Exporte o DTO da fixture pelo smoke isolado; nunca use uma ficha real.');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
assert.equal(fixture.name, 'Fôlego Fixture');
const root = process.cwd(), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'folego-browser-'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
await build({ nodePaths: [path.join(root, 'client/node_modules')], stdin: { resolveDir: path.join(root, 'client'), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';
import{ResourcesSection}from'./src/components/sections/ResourcesSection';
import{SheetAccessProvider}from'./src/readonly';import './src/styles.css';
const fixture=${JSON.stringify(fixture)};
function ready(){const c=structuredClone(fixture);c.classState.used['second-wind']=0;c.classAdjustments.resources.find(r=>r.id==='second-wind').remaining=1;return c;}
function App(){const[c,set]=React.useState(ready),[ro,setRo]=React.useState(false);window.resetFixture=()=>set(ready());window.readOnlyFixture=setRo;
return <SheetAccessProvider value={{readOnly:ro,creationLocked:true,masterView:false}}><ResourcesSection character={c} update={()=>{throw Error('PATCH genérico não pode executar a cura')}} onSecondWind={async version=>{
window.calls=(window.calls??[]).concat(version);await new Promise((resolve,reject)=>{window.finishUse=resolve;window.failUse=()=>reject(Error('Sem Ação Bônus'));});set(fixture);
}}/></SheetAccessProvider>;}createRoot(document.getElementById('root')).render(<App/>);` }, bundle: true, jsx: 'automatic', external: ['/archive/*', '/creation/*', '/brand/*', '/fonts/*'], outfile: path.join(temp, 'app.js') });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
 const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
 const errors=[];page.on('pageerror', e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const p=new URL(route.request().url()).pathname;
  if(p==='/')return route.fulfill({contentType:'text/html',body:'<html data-theme="dark"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>'});
  if(p==='/app.js'||p==='/app.css')return route.fulfill({path:path.join(temp,p.slice(1)),contentType:p.endsWith('.js')?'text/javascript':'text/css'});
  const file=path.join(root,'client/public',p);if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
  return route.fulfill({status:404,body:''});
 });
 await page.goto('http://fixture.test/');
 const button=page.getByRole('button',{name:'Retomar o Fôlego',exact:true});await button.waitFor();
 assert.equal(await button.isEnabled(),true,'construção finalizada não impede uso de recurso');
 await button.click();await page.waitForFunction(()=>window.calls?.length===1);
 assert.equal(await page.getByRole('button',{name:'…',exact:true}).isDisabled(),true,'bloqueia durante requisição');
 await page.evaluate(()=>window.finishUse());await button.waitFor();assert.equal(await button.isDisabled(),true,'sem saldo fica desabilitado');
 await page.evaluate(()=>window.resetFixture());await page.waitForFunction(()=>!document.querySelector('.resource-action').disabled);
 await button.click();await page.evaluate(()=>window.failUse());await page.getByText('Sem Ação Bônus',{exact:true}).waitFor();assert.equal(await button.isEnabled(),true,'falha permite nova tentativa');
 await page.evaluate(()=>window.readOnlyFixture(true));await page.waitForFunction(()=>document.querySelector('.resource-action').disabled);
 assert.equal(await button.isDisabled(),true,'somente leitura impede uso');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(temp,'recursos-celular.png'),fullPage:true});
 const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390,'botão cabe no celular');assert.deepEqual(errors,[]);
 console.log('Retomar o Fôlego: botão, pendência, saldo, erro, somente leitura e celular aprovados em Chromium; '+temp);
} finally {await browser.close();}
