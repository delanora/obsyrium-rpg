/** Regressão das melhorias anteriormente omitidas no build; API simulada, sem campanha. */
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const root=process.cwd(), temp=fs.mkdtempSync(path.join(os.tmpdir(),'interface-restaurada-'));
await build({nodePaths:[path.join(root,'client/node_modules')],stdin:{resolveDir:root,loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';
import{MusicPlayerBar}from'./client/src/music/MusicPlayerBar';
import{RegionsTab}from'./client/src/components/master/RegionsTab';
import{MasterHome}from'./client/src/components/master/MasterHome';
import './client/src/styles.css';import './client/src/floating-fabs.css';
const noop=()=>{},music={state:null,volume:.5,position:0,duration:0,tracks:[],busy:false,seek:noop,setVolume:noop,select:noop,remove:noop,toggle:noop,next:noop,previous:noop,toggleRepeat:noop};
createRoot(document.getElementById('root')).render(<div className="app-shell theme-master has-music-bar"><MasterHome userName="Fixture" sheets={0} creatures={0} npcs={0} regions={0} localities={0} items={0} musicTrackCount={0} levelUpRelease={0} startingLevel={1} extraCoins={false} onOpenTab={noop} onStartCombat={noop} onReleaseLevelUp={noop}/><RegionsTab regions={[]} localities={[]} creatures={[]} onCreate={noop} onPatch={noop} onDelete={noop} onCreateLocality={noop} onPatchLocality={noop} onDeleteLocality={noop} onPatchCreature={noop} onOpenCreature={noop}/><button className="dice-fab is-master"><span>◆</span><span className="dice-fab-label">Dados</span></button><MusicPlayerBar music={music}/></div>);`},bundle:true,jsx:'automatic',external:['/archive/*','/creation/*','/brand/*','/fonts/*'],outfile:path.join(temp,'app.js')});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(5000);let calls=0;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;
  if(p==='/api/scenes'){calls++;return route.fulfill({json:{scenes:[]}});}
  if(p.startsWith('/api/')||p.startsWith('/socket.io/'))return route.fulfill({json:{}});
  if(p==='/')return route.fulfill({contentType:'text/html',body:'<html data-theme="dark"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>'});
  if(p==='/app.js'||p==='/app.css')return route.fulfill({path:path.join(temp,p.slice(1)),contentType:p.endsWith('.js')?'text/javascript':'text/css'});
  const file=path.join(root,'client/public',p);if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
  return route.fulfill({status:404,body:''});
 });
 await page.goto('http://fixture.test/');await page.waitForSelector('.music-fab');
 assert.equal(await page.getByRole('button',{name:'Abrir a barra de som'}).count(),1);
 assert.equal(await page.locator('.music-dock.is-open').count(),0);
 await page.locator('.music-fab').click();assert.equal(await page.locator('.music-dock.is-open').count(),1);
 await page.locator('.music-fab').click();assert.equal(await page.locator('.music-dock.is-open').count(),0);
 for(const selector of ['.dice-fab','.music-fab']){
  await page.mouse.move(900,20);await page.waitForTimeout(250);const before=await page.locator(selector).boundingBox();
  await page.locator(selector).hover();await page.waitForTimeout(250);const after=await page.locator(selector).boundingBox();assert.ok(after.width>before.width+10,selector+' expande no hover');
  const transition=await page.locator(selector).evaluate(e=>getComputedStyle(e).transitionDuration);assert.notEqual(transition,'0s');
 }
 assert.ok(await page.getByRole('heading',{name:'Geografia',exact:true}).count() || await page.getByText('Geografia',{exact:true}).count());
 for(const text of ['Regiões','Localidades','Cenas'])assert.ok(await page.getByText(text,{exact:true}).count(),text);
 assert.equal(calls,1);assert.deepEqual(errors,[]);
 await page.setViewportSize({width:390,height:844});await page.mouse.move(300,20);await page.waitForTimeout(250);
 const fab=await page.locator('.music-fab').boundingBox();assert.ok(fab.x>=0&&fab.x+fab.width<=390);
 await page.screenshot({path:path.join(temp,'celular.png'),fullPage:true});
 console.log('Interface restaurada: som abre/fecha por clique, FABs retraem/animam, Geografia com três blocos e API simulada, celular sem FAB fora da tela; sem erros JS. Evidências: '+temp);
}finally{await browser.close();}
