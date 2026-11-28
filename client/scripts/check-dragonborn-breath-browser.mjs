/** Sopro no grid: Chromium, DTOs de fixture exclusiva e API completamente simulada. */
import { build } from 'esbuild';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
const fixturePath=process.env.BREATH_FIXTURE_OUTPUT;assert.ok(fixturePath,'Execute o smoke isolado; não use dados reais.');
const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));assert.equal(fixture.options.definition.id,'breath-weapon');
assert.ok(fixture.combat.combatants.some(u=>u.name==='Draconato Fixture'));
// Restaura a apresentação anterior ao uso; o smoke exporta também o DTO após commit.
fixture.combat.version=fixture.options.combatVersion;
fixture.combat.combatants.find(u=>u.id===fixture.options.combatantId).turnEconomy.actionsUsed=0;
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sopro-browser-'));
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
await build({plugins:[{name:'caminho-exato-regua',setup(b){b.onResolve({filter:/^\.\/gridRuler$/},args=>({path:path.join(args.resolveDir,'gridRuler.ts')}));}}],nodePaths:[path.join(root,'client/node_modules')],stdin:{resolveDir:path.join(root,'client'),loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';import{CombatGrid}from'./src/combat/grid/CombatGrid';import './src/styles.css';import './src/fonts.css';import './src/combat/grid/grid.css';
const fixture=${JSON.stringify(fixture)};const error=message=>{window.errors=(window.errors??[]).concat(message)};
createRoot(document.getElementById('root')).render(<div style={{height:'800px',position:'relative'}}><CombatGrid combat={fixture.combat} isMaster={false} onCombatChange={value=>window.result=value} onError={error}/></div>);`},bundle:true,jsx:'automatic',external:['/archive/*','/creation/*','/brand/*','/fonts/*','/dice-tray/*'],outfile:path.join(temp,'app.js')});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:900}});page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let submitted=null;
 await page.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;
  if(p==='/api/characters/me/breath-weapon/options')return route.fulfill({json:fixture.options});
  if(p==='/api/characters/me/breath-weapon/preview')return route.fulfill({json:fixture.preview});
  if(p==='/api/characters/me/breath-weapon/use'){submitted=route.request().postDataJSON();return route.fulfill({json:{combat:fixture.combat,areaUseId:'fixture-area',replayed:false}});}
  if(p.startsWith('/api/')||p.startsWith('/socket.io/'))return route.fulfill({json:{}});
  if(p==='/')return route.fulfill({contentType:'text/html',body:'<html data-theme="dark"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>'});
  if(p==='/app.js'||p==='/app.css')return route.fulfill({path:path.join(temp,p.slice(1)),contentType:p.endsWith('.js')?'text/javascript':'text/css'});
  const file=path.join(root,'client/public',p);if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});return route.fulfill({status:404,body:''});
 });
 await page.goto('http://fixture.test/');const launch=page.getByRole('button',{name:'Arma de Sopro · 1/1'});await launch.waitFor();await page.waitForFunction(()=>document.querySelector('[data-grid-phase]')?.getAttribute('data-grid-phase')==='ready');await launch.click();
 const capture=page.locator('.grid-area-capture');await capture.waitFor();const box=await capture.boundingBox();await page.mouse.click(box.x+box.width*.6,box.y+box.height*.3);
 assert.equal(await page.getByLabel('Forma da área').isDisabled(),true,'a forma vem do servidor');assert.equal(await page.getByLabel('Dimensão da área').isDisabled(),true,'tamanho não é escolhido pelo jogador');
 await page.getByRole('button',{name:'Confirmar',exact:true}).click();const use=page.getByRole('button',{name:'Usar Arma de Sopro',exact:true});await use.waitFor();
 assert.equal(await page.getByRole('checkbox').count(),0,'jogador não pode excluir aliados da área');
 await page.screenshot({path:path.join(temp,'sopro-desktop.png'),fullPage:true});await use.click();await page.waitForFunction(()=>!!window.result);
 assert.equal(submitted.expectedVersion,fixture.options.characterVersion);assert.equal(submitted.expectedCombatVersion,fixture.combat.version);assert.equal(submitted.placement.selectedTargetKeys,undefined);assert.equal(submitted.damage,undefined);
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.errors??[]),[]);
 await page.setViewportSize({width:390,height:844});const mobile=await launch.boundingBox();assert.ok(mobile.x>=0&&mobile.x+mobile.width<=390);
 console.log('Sopro em Chromium: preparo, forma/tamanho bloqueados, confirmação, sem exclusão de alvos, envio derivado e celular aprovados; '+temp);
}finally{await browser.close();}
