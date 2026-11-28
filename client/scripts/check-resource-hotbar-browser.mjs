/** Hotbar real + CombatTracker + grid: Chromium com API simulada e fixtures próprias. */
import {build} from 'esbuild';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.cwd();const fixture=JSON.parse(fs.readFileSync(process.env.BREATH_FIXTURE_OUTPUT,'utf8'));const character=JSON.parse(fs.readFileSync(process.env.ACTION_SURGE_FIXTURE_OUTPUT,'utf8'));
assert.equal(character.name,'Surto Fixture');assert.ok(fixture.combat.combatants.some(u=>u.name==='Draconato Fixture'));
const unit=fixture.combat.combatants.find(u=>u.id===fixture.options.combatantId);character.id=unit.characterId;character.hpCurrent=100;character.conditionEffects.incapacitated=false;
character.classAdjustments.resources.forEach(r=>r.remaining=r.max);character.racialAdjustments.resources=[{id:'breath-weapon',name:'Arma de Sopro',remaining:1,max:1,used:0,recharge:'short'}];
fixture.combat.currentCombatantId=unit.id;unit.turnEconomy.actionsUsed=0;unit.turnEconomy.actionsGranted=1;unit.turnEconomy.bonusActionUsed=false;unit.turnEconomy.actionSurgeUsed=false;
const viewer={id:unit.ownerUserId,username:'fixture',displayName:'Fixture',role:'PLAYER'};fixture.options.characterVersion=character.version;fixture.options.combatVersion=fixture.combat.version;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'recursos-hotbar-browser-'));
await build({plugins:[{name:'regua-exata',setup(b){b.onResolve({filter:/^\.\/gridRuler$/},a=>({path:path.join(a.resolveDir,'gridRuler.ts')}));}}],nodePaths:[path.join(root,'client/node_modules')],stdin:{resolveDir:path.join(root,'client'),loader:'tsx',contents:`
import React from'react';import{createRoot}from'react-dom/client';import{CombatTracker}from'./src/combat/CombatTracker';import{AuthProvider}from'./src/auth';import './src/styles.css';import './src/fonts.css';import './src/combat/grid/grid.css';
const fixture=${JSON.stringify(fixture)},initial=${JSON.stringify(character)},viewer=${JSON.stringify(viewer)};const report=message=>(window.errors??=[]).push(message);
localStorage.setItem('grimorio.token','fixture');
function App(){const[c,set]=React.useState(initial),[combat,update]=React.useState(fixture.combat),[layout,setLayout]=React.useState(null);window.customLayout=()=>setLayout(Array.from({length:48},()=>null));
return <AuthProvider><CombatTracker combat={combat} user={viewer} resourceCharacter={c} characterHotbar={layout} characterVersion={c.version} onHotbarSaved={(value,version)=>{setLayout(value.slots);set(prev=>({...prev,version}))}} onResourceCharacterUpdated={value=>{set(value);if(value.classState.used['action-surge'])update(prev=>({...prev,combatants:prev.combatants.map(u=>u.id===fixture.options.combatantId?{...u,turnEconomy:{...u.turnEconomy,actionSurgeUsed:true,actionsGranted:2}}:u)}));}} characterAttacks={[]} characterInventory={[]} log={[]} turnAlert={null} onCombatChange={update} onCombatEnd={()=>{}} onError={report}/></AuthProvider>};createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,jsx:'automatic',external:['/archive/*','/creation/*','/brand/*','/fonts/*','/dice-tray/*'],outfile:path.join(temp,'app.js')});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const calls=[];let current=structuredClone(character),savedSlots=null;
 await page.route('**/*',async route=>{const req=route.request(),p=new URL(req.url()).pathname;
  if(p==='/api/auth/me')return route.fulfill({json:{user:viewer}});
  if(p==='/api/characters/me/features/second-wind'||p==='/api/characters/me/features/action-surge'){
   const body=req.postDataJSON();calls.push({p,body});assert.equal(body.expectedVersion,current.version);assert.ok(body.operationId);const id=p.endsWith('second-wind')?'second-wind':'action-surge';current.version++;current.classState.used[id]=1;current.classAdjustments.resources.find(r=>r.id===id).remaining--;
   return route.fulfill({json:{character:current,remaining:0,replayed:false}});
  }
  if(p==='/api/characters/me/breath-weapon/options'){calls.push({p});return route.fulfill({json:{...fixture.options,characterVersion:current.version}});}
  if(p==='/api/characters/me/breath-weapon/preview')return route.fulfill({json:fixture.preview});
  if(p==='/api/characters/me/hotbar'&&req.method()==='PUT'){const body=req.postDataJSON();savedSlots=body.slots;return route.fulfill({json:{hotbar:{slots:body.slots},character:current,version:++current.version}});}
  if(p.startsWith('/api/')||p.startsWith('/socket.io/'))return route.fulfill({status:404,json:{message:'Sem leitura auxiliar nesta fixture'}});
  if(p==='/')return route.fulfill({contentType:'text/html',body:'<html data-theme="dark"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>'});
  if(p==='/app.js'||p==='/app.css')return route.fulfill({path:path.join(temp,p.slice(1)),contentType:p.endsWith('.js')?'text/javascript':'text/css'});
  const f=path.join(root,'client/public',p);if(fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({path:f});return route.fulfill({status:404,body:''});
 });
 await page.goto('http://fixture.test/');
 const surge=page.getByRole('button',{name:/^\d+\. Surto de Ação/});await surge.waitFor();await surge.click();await page.waitForFunction(()=>document.querySelector('[aria-label*=". Surto de Ação"]')?.disabled);
 const wind=page.getByRole('button',{name:/^\d+\. Retomar o Fôlego/});await wind.click();await page.waitForFunction(()=>document.querySelector('[aria-label*=". Retomar o Fôlego"]')?.disabled);
 assert.equal(calls.filter(c=>c.p.endsWith('/action-surge')).length,1);assert.equal(calls.filter(c=>c.p.endsWith('/second-wind')).length,1);
 await page.getByRole('button',{name:/^\d+\. Arma de Sopro/}).click();await page.locator('.grid-area-capture').waitFor();
 assert.equal(calls.filter(c=>c.p.endsWith('/use')).length,0,'preparar sopro não consome recurso');await page.keyboard.press('Escape');
 await page.evaluate(()=>window.customLayout());await page.getByText(/ver todas/).click();await page.locator('.hotbar-all-item').filter({hasText:'Arma de Sopro'}).waitFor();
 assert.equal(await page.locator('.hotbar-slot[aria-label*=". Arma de Sopro"]').count(),0,'layout vazio não repovoa');
 await page.getByRole('button',{name:'Personalizar a Hotbar',exact:true}).click();
 await page.locator('.hotbar-slot.is-editable[data-slot="1"]').click();
 await page.locator('.hotbar-picker-item').filter({hasText:'Arma de Sopro'}).click();
 await page.getByRole('button',{name:'Salvar a personalização da Hotbar',exact:true}).click();
 await page.waitForFunction(()=>!!document.querySelector('.hotbar-slot[aria-label*=". Arma de Sopro"]'));
 assert.equal(savedSlots[0].kind,'feature');assert.equal(savedSlots[0].sourceId,'breath-weapon');
 await page.screenshot({path:path.join(temp,'hotbar-recursos-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(temp,'hotbar-recursos-celular.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.errors??[]),[]);
 console.log('Chromium: Hotbar real, executores de classe, versões atualizadas, preparo racial sem consumo, layout personalizado e celular aprovados; '+temp);
}finally{await browser.close();}
