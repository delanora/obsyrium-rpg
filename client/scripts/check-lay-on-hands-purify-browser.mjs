/** Hotbar real + CombatTracker + grid: Chromium com API simulada e fixtures próprias. */
import {build} from 'esbuild';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.cwd();const fixture=JSON.parse(fs.readFileSync(process.env.BREATH_FIXTURE_OUTPUT,'utf8'));const maos=JSON.parse(fs.readFileSync(process.env.PURIFY_FIXTURE_OUTPUT,'utf8'));const character=maos.character;const ownTarget=maos.options.targets.find(t=>t.target.id===character.id);ownTarget.afflictions.push({id:crypto.randomUUID(),kind:'poison',label:'Veneno C'});
assert.equal(character.name,'Paladino Fixture');assert.ok(fixture.combat.combatants.some(u=>u.name==='Draconato Fixture'));
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
  if(p==='/api/characters/me/features/lay-on-hands/options')return route.fulfill({json:{...maos.options,canUse:true,remaining:10,characterVersion:current.version}});
  if(p==='/api/characters/me/features/lay-on-hands/purify'){
    const body=req.postDataJSON();calls.push({p,body});assert.equal(body.expectedVersion,current.version);current.version++;current.classAdjustments.resources.find(r=>r.id==='lay-on-hands').remaining-=body.afflictionIds.length*5;
    return route.fulfill({json:{character:current,purified:body.afflictionIds.length,remaining:10-body.afflictionIds.length*5,noEffect:false}});
  }
  if(p==='/api/characters/me/features/lay-on-hands/heal'){
    const body=req.postDataJSON();calls.push({p,body});current.version++;current.classAdjustments.resources.find(r=>r.id==='lay-on-hands').remaining-=body.amount;
    return route.fulfill({json:{character:current,healed:body.amount,remaining:10-body.amount,noEffect:false}});
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
 const launch=page.getByRole('button',{name:/^\d+\. Mãos Consagradas/});await launch.waitFor();await launch.click();
 const dialog=page.getByRole('dialog',{name:'Mãos Consagradas',exact:true});await dialog.waitFor();
 await dialog.getByLabel('Uso da reserva').selectOption('purify');const apply=dialog.getByRole('button',{name:'Neutralizar origens',exact:true});assert.equal(await apply.isDisabled(),true);
 const boxes=dialog.getByRole('checkbox');assert.equal(await boxes.count(),3);await boxes.nth(0).check();await dialog.getByText('Custo: 5 pontos · Reserva: 10',{exact:true}).waitFor();await boxes.nth(1).check();await boxes.nth(2).check();assert.equal(await apply.isDisabled(),true,'saldo não cobre três origens');await boxes.nth(2).uncheck();assert.equal(await apply.isEnabled(),true);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);const mobile=await dialog.boundingBox();assert.ok(mobile.x>=0&&mobile.x+mobile.width<=390);await page.screenshot({path:path.join(temp,'neutralizacao-celular.png'),fullPage:true});await page.setViewportSize({width:1400,height:1000});
 await apply.click();await dialog.getByRole('status').filter({hasText:'2 origem(ns) neutralizada(s)'}).waitFor();
 const sent=calls.find(c=>c.p.endsWith('/purify')).body;assert.equal(sent.afflictionIds.length,2);assert.equal(sent.amount,undefined);assert.equal(sent.cost,undefined);assert.ok(sent.operationId);assert.deepEqual(Object.keys(sent).sort(),['afflictionIds','expectedTargetVersion','expectedVersion','operationId','target']);assert.equal(calls.filter(c=>c.p.endsWith('/heal')).length,0,'não mistura cura e neutralização');
 await dialog.getByRole('button',{name:'Fechar',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.screenshot({path:path.join(temp,'hotbar-recursos-desktop.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.errors??[]),[]);
 console.log('Chromium: neutralização pela Hotbar real, seleção de origens, custo, limite da reserva, payload sem custo cliente e celular aprovados; '+temp);
}finally{await browser.close();}
