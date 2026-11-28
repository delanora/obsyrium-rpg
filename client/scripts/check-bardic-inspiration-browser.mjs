/** Hotbar real + CombatTracker + grid: Chromium com API simulada e fixtures próprias. */
import {build} from 'esbuild';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.cwd();const fixture=JSON.parse(fs.readFileSync(process.env.BREATH_FIXTURE_OUTPUT,'utf8'));const maos=JSON.parse(fs.readFileSync(process.env.BARDIC_FIXTURE_OUTPUT,'utf8'));const character=maos.character;
assert.equal(character.name,'Bardo Fixture');assert.ok(fixture.combat.combatants.some(u=>u.name==='Draconato Fixture'));
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
return <AuthProvider><CombatTracker combat={combat} user={viewer} resourceCharacter={c} characterHotbar={layout} characterVersion={c.version} onHotbarSaved={(value,version)=>{setLayout(value.slots);set(prev=>({...prev,version}))}} onResourceCharacterUpdated={value=>{set(value);if(value.classState.used['bardic-inspiration'])update(prev=>({...prev,combatants:prev.combatants.map(u=>u.id===fixture.options.combatantId?{...u,turnEconomy:{...u.turnEconomy,bonusActionUsed:true}}:u)}));}} characterAttacks={[]} characterInventory={[]} log={[]} turnAlert={null} onCombatChange={update} onCombatEnd={()=>{}} onError={report}/></AuthProvider>};createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,jsx:'automatic',external:['/archive/*','/creation/*','/brand/*','/fonts/*','/dice-tray/*'],outfile:path.join(temp,'app.js')});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));const calls=[];let current=structuredClone(character),savedSlots=null;
 await page.route('**/*',async route=>{const req=route.request(),p=new URL(req.url()).pathname;
  if(p==='/api/characters/me/features/bardic-inspiration/options')return route.fulfill({json:{...maos.options,canUse:true,characterVersion:current.version}});
  if(p==='/api/characters/me/features/bardic-inspiration/grant'){
    const body=req.postDataJSON();calls.push({p,body});current.version++;current.classState.used['bardic-inspiration']=1;current.classAdjustments.resources.find(r=>r.id==='bardic-inspiration').remaining--;
    return route.fulfill({json:{character:current,remaining:2,effect:{}}});
  }
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
 const launch=page.getByRole('button',{name:/^\d+\. Inspiração de Bardo/});await launch.waitFor();await launch.click();
 const dialog=page.getByRole('dialog',{name:'Inspiração de Bardo',exact:true});await dialog.waitFor();
 const apply=dialog.getByRole('button',{name:'Conceder inspiração',exact:true});await apply.waitFor();assert.equal(calls.filter(c=>c.p.endsWith('/grant')).length,0);
 await page.waitForTimeout(350);await page.screenshot({path:path.join(temp,'inspiracao-desktop.png'),fullPage:true});
 await apply.click();await dialog.getByRole('status').filter({hasText:'recebeu d8'}).waitFor();
 assert.equal(calls.filter(c=>c.p.endsWith('/grant')).length,1);const sent=calls.find(c=>c.p.endsWith('/grant')).body;
 assert.ok(sent.operationId);assert.equal(sent.expectedVersion,character.version);assert.ok(Number.isInteger(sent.expectedTargetVersion));
 assert.deepEqual(Object.keys(sent).sort(),['combatId','expectedCombatVersion','expectedTargetVersion','expectedVersion','operationId','targetCharacterId']);
 await dialog.getByRole('button',{name:'Fechar',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.reload();await page.setViewportSize({width:390,height:844});await launch.click();await dialog.waitFor();await page.waitForTimeout(350);
 const mobile=await dialog.boundingBox();assert.ok(mobile.x>=0&&mobile.x+mobile.width<=390);await page.screenshot({path:path.join(temp,'inspiracao-celular.png'),fullPage:true});
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.errors??[]),[]);
 console.log('Chromium: Inspiração pela Hotbar real, confirmação, payload, atualização, Escape e celular aprovados; '+temp);
}finally{await browser.close();}
