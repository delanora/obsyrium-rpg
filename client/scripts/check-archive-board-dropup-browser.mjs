/** Seletor de quadros acima da barra: Chromium com fixtures próprias, sem campanha. */
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const root=process.cwd(), temp=fs.mkdtempSync(path.join(os.tmpdir(),'interface-restaurada-'));
await build({nodePaths:[path.join(root,'client/node_modules')],stdin:{resolveDir:root,loader:'tsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import{ArchiveBoardSelect}from'./client/src/components/archive/ArchiveBoardSelect';import './client/src/styles.css';import './client/src/components/archive/archive.css';function App(){const[value,set]=React.useState('0');return <div style={{position:"fixed",inset:0}}><div className="archive-dock"><div className="archive-dock-row"><div className="archive-toolbar"><div className="archive-board-select"><ArchiveBoardSelect boards={Array.from({length:30},(_,i)=>({id:String(i),name:'Quadro '+i}))} value={value} disabled={false} onChange={set}/></div></div></div></div></div>}createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,jsx:'automatic',external:['/archive/*','/creation/*','/brand/*','/fonts/*'],outfile:path.join(temp,'app.js')});
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
 await page.goto('http://fixture.test/');
 const trigger=page.getByRole('button',{name:'Quadro narrativo'});
 for(const width of [1280,390]) {
  await page.setViewportSize({width,height:844});await trigger.click();
  const box=await page.getByRole('listbox').boundingBox(),button=await trigger.boundingBox();
  assert.ok(box.y+box.height<button.y,'lista acima do botão');assert.ok(box.x>=0&&box.x+box.width<=width,'lista dentro da tela');
  await page.getByRole('option',{name:'Quadro 2',exact:true}).click();assert.match(await trigger.innerText(),/Quadro 2/);
  await trigger.press('ArrowUp');await trigger.press('Home');await trigger.press('ArrowDown');await trigger.press('Enter');assert.match(await trigger.innerText(),/Quadro 1/);
  await trigger.click();await trigger.press('Escape');assert.equal(await page.getByRole('listbox').count(),0);
  await trigger.click();await page.mouse.click(width-10,20);assert.equal(await page.getByRole('listbox').count(),0);
 }
 assert.deepEqual(errors,[]);console.log('Dropup: desktop/celular, posição acima, seleção por clique/teclado, Escape e clique fora aprovados; sem API real.');
}finally{await browser.close();}
