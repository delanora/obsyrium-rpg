/** Cura variável com dados exclusivos de um cluster descartável. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {writeFileSync} from 'node:fs';
import {prisma} from '../config/prisma.js';import {signToken} from '../lib/jwt.js';
import {normalizeClassState,restoreShortRestResources,restoreLongRestResources} from '../modules/shared/classes.js';
import {addHpZeroUnconscious} from '../modules/shared/death.js';
import {characterClassAdjustments} from '../modules/characters/characters.dto.js';
const url=new URL(process.env.DATABASE_URL!);assert.equal(url.port,'55439');assert.equal(url.searchParams.get('schema'),'smoke_cure_wounds');
const sentinel:any[]=await prisma.$queryRawUnsafe("SELECT current_setting('data_directory') AS directory,current_schema() AS schema");assert.equal(sentinel[0].directory,'/tmp/obsyrium-cura-pg');assert.equal(sentinel[0].schema,'smoke_cure_wounds');
assert.equal(await prisma.user.count(),0);assert.equal(await prisma.character.count(),0);assert.equal(await prisma.combat.count(),0);
const users:string[]=[],characters:string[]=[],combats:string[]=[],scenes:string[]=[],creatures:string[]=[];let checks=0;
const check=(s:string,b:unknown)=>{assert.ok(b,s);checks++;};
try{
 const make=async(classes:unknown,name:string)=>{const u=await prisma.user.create({data:{username:'maos_'+randomUUID(),displayName:'Fixture',passwordHash:'fixture',role:'PLAYER'}});users.push(u.id);const c=await prisma.character.create({data:{userId:u.id,name,classes:classes as any,hpCurrent:10,hpMax:100,hpTemp:7,speed:9}});characters.push(c.id);return {c,u,token:signToken({sub:u.id,username:u.username,displayName:u.displayName,role:'PLAYER'})};};
 const hero=await make([{classKey:'paladin',level:2},{classKey:'fighter',level:3}],'Paladino Fixture');const other=await make([{classKey:'fighter',level:1}],'Alvo Fixture');
 const http=async(path:string,method='GET',body?:unknown,token=hero.token)=>{const r=await fetch('http://127.0.0.1:3309/api'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json() as any};};
 const options=()=>http('/characters/me/features/lay-on-hands/options');const use=(body:unknown,token=hero.token)=>http('/characters/me/features/lay-on-hands/heal','POST',body,token);
 const fresh=()=>prisma.character.findUniqueOrThrow({where:{id:hero.c.id}});
 const input=async(id=hero.c.id,kind:'character'|'combatant'='character',amount=3)=>{const o=await options();const target=o.data.targets.find((t:any)=>t.target.kind===kind&&t.target.id===id);assert.ok(target);return {target:target.target,amount,expectedVersion:o.data.characterVersion,expectedTargetVersion:target.version,operationId:randomUUID()};};
 const reset=async(data:any={})=>prisma.character.update({where:{id:hero.c.id},data:{classState:{},mechanicalState:{},deathState:{},hpCurrent:10,...data,version:{increment:1}}});
 const o=await options();check('reserva usa nível de Paladino, não nível total',o.status===200&&o.data.max===10&&o.data.canUse);
 check('terceiro fora de combate exige toque assistido',o.data.targets.find((t:any)=>t.target.id===other.c.id).reason);
 const req=await input();const result=await use(req);assert.equal(result.status,200,JSON.stringify(result.data));check('autoalvo fora de combate cura e gasta o escolhido',result.data.healed===3&&result.data.remaining===7&&result.data.character.hpCurrent===13&&result.data.character.hpTemp===7);
 const after=await fresh();check('replay não repete a cura',(await use(req)).data.replayed&&(await fresh()).version===after.version);
 check('chave com outra quantidade é recusada',(await use({...req,amount:4})).data.error==='IDEMPOTENCY_KEY_REUSED');
 for(const amount of [0,-1,1.5,101])check('quantidade inválida sem gasto',(await use({...await input(),amount})).status===400);
 check('saldo insuficiente sem gasto',(await use(await input(hero.c.id,'character',8))).data.error==='INSUFFICIENT_RESOURCE');
 check('não permite confirmação espacial do jogador',(await use({...await input(),spatialConfirmation:{withinRange:true}})).status===400);
 check('alvo desconhecido não vaza dados',(await use({...await input(),target:{kind:'character',id:'nao-existe'}})).status===404);
 const stale=await input();await reset();check('versão antiga não cobra',(await use(stale)).status===409);
 check('sem Paladino é recusado',(await use({...await input(),expectedVersion:other.c.version},other.token)).status===403);
 for(const data of [{hpCurrent:0},{deathState:{dead:true}},{mechanicalState:{conditions:[{id:'maos-incap',condition:'incapacitated',appliedAt:new Date().toISOString()}]}}]){await reset(data);const before=await fresh();check('estado impeditivo sem gasto',(await use(await input())).data.error==='FEATURE_INCAPACITATED'&&(await fresh()).version===before.version);}
 await reset();const same=await input();const race=await Promise.all([use(same),use(same)]);check('mesmo pedido concorrente cobra uma vez',race.every(r=>r.status===200)&&(await fresh()).hpCurrent===13);
 await reset();const a=await input(),b={...a,operationId:randomUUID()};const distinct=await Promise.all([use(a),use(b)]);check('pedidos concorrentes distintos têm um vencedor',distinct.filter(r=>r.status===200).length===1&&distinct.filter(r=>r.status===409).length===1);
 await reset({hpCurrent:99});const cap=await use(await input(hero.c.id,'character',5));check('excesso respeita teto, mas gasta pontos escolhidos',cap.status===200&&cap.data.healed===1&&cap.data.remaining===5);
 const spent=await fresh(),resources=characterClassAdjustments(spent).resources,state=normalizeClassState(spent.classState);check('descanso curto não recupera reserva',(restoreShortRestResources(state,resources).used['lay-on-hands'])===5);check('descanso longo recupera reserva',(restoreLongRestResources(state,resources).used['lay-on-hands']??0)===0);
 await reset();
 const scene=await prisma.scene.create({data:{name:'Cena Mãos Fixture',spatialConfig:{mode:'grid-2d',widthFeet:100,heightFeet:100,cellSizeFeet:5}}});scenes.push(scene.id);
 const template=await prisma.creature.create({data:{name:'NPC Fixture',type:'Humanoide',hpMax:100,hpCurrent:1}});creatures.push(template.id);
 const combat=await prisma.combat.create({data:{status:'ACTIVE',sceneId:scene.id,currentIndex:0,round:1,turnSequence:1,spatialConfig:{mode:'grid-2d',widthFeet:100,heightFeet:100,cellSizeFeet:5},combatants:{create:[
 {kind:'CHARACTER',characterId:hero.c.id,ownerUserId:hero.u.id,name:hero.c.name,initiative:20,dexterityMod:0,spatialPosition:{xFeet:0,yFeet:0},elevationFeet:0,turnEconomy:{actionsGranted:1,actionsUsed:0,movementBudget:9}},
 {kind:'CHARACTER',characterId:other.c.id,ownerUserId:other.u.id,name:other.c.name,initiative:10,dexterityMod:0,spatialPosition:{xFeet:5,yFeet:0},elevationFeet:0},
 {kind:'CREATURE',creatureId:template.id,name:template.name,initiative:5,dexterityMod:0,spatialPosition:{xFeet:0,yFeet:5},elevationFeet:0,hpCurrent:1,hpMax:100},
 {kind:'CREATURE',creatureId:template.id,name:'Oculto Fixture',initiative:1,dexterityMod:0,spatialPosition:{xFeet:5,yFeet:5},elevationFeet:0,hpCurrent:1,hpMax:100,spatialVisibility:'master-only'}
 ]}},include:{combatants:true}});combats.push(combat.id);const own=combat.combatants.find(u=>u.characterId===hero.c.id)!,target=combat.combatants.find(u=>u.characterId===other.c.id)!,npc=combat.combatants.find(u=>u.name===template.name)!,hidden=combat.combatants.find(u=>u.name==='Oculto Fixture')!;
 const resetAction=()=>prisma.combatant.update({where:{id:own.id},data:{turnEconomy:{actionsGranted:1,actionsUsed:0,movementBudget:9}}});
 const visible=await options();check('opções não revelam token oculto',!JSON.stringify(visible.data).includes(hidden.id)&&!JSON.stringify(visible.data).includes(hidden.name));
 check('uso em oculto é recusado sem gasto',(await use({...await input(),target:{kind:'combatant',id:hidden.id}})).status===404);
 await prisma.character.update({where:{id:other.c.id},data:{hpCurrent:0,deathState:{successes:1,failures:1,stable:false},mechanicalState:addHpZeroUnconscious({conditions:[{id:'veneno-independente',condition:'poisoned',sourceType:'fixture',appliedAt:new Date().toISOString()}]}).state as any}});
 const wounded=await use(await input(other.c.id));assert.equal(wounded.status,200,JSON.stringify(wounded.data));const healed=await prisma.character.findUniqueOrThrow({where:{id:other.c.id}});check('cura aliado a zero PV e limpa morte pelo motor canônico',wounded.data.healed===3&&healed.hpCurrent===3&&(healed.deathState as any).failures===0&&!(healed.mechanicalState as any).conditions.some((c:any)=>c.condition==='unconscious')&&(healed.mechanicalState as any).conditions.some((c:any)=>c.condition==='poisoned'));
 const usedEconomy=(await prisma.combatant.findUniqueOrThrow({where:{id:own.id}})).turnEconomy as any;check('gasta uma Ação, sem consumir bônus',usedEconomy.actionsUsed===1&&!usedEconomy.bonusActionUsed);
 const noAction=await use(await input());check('sem Ação não cobra pontos',noAction.status===409);
 await reset();await resetAction();const staleTarget=await input(other.c.id);await prisma.character.update({where:{id:other.c.id},data:{version:{increment:1}}});check('versão do alvo protege cura e custo',(await use(staleTarget)).status===409&&(await fresh()).classState!==null);
 await prisma.character.update({where:{id:other.c.id},data:{deathState:{dead:true}}});check('alvo morto não é ressuscitado',(await use(await input(other.c.id))).status===400);await prisma.character.update({where:{id:other.c.id},data:{deathState:{}}});
 await prisma.combatant.update({where:{id:target.id},data:{elevationFeet:10}});check('altura diferente exige adjudicação',(await use(await input(other.c.id))).data.error==='FEATURE_TOUCH_UNVERIFIED');await prisma.combatant.update({where:{id:target.id},data:{elevationFeet:0}});
 const wall=await prisma.spatialObstacle.create({data:{sceneId:scene.id,startXFeet:5,startYFeet:-10,endXFeet:5,endYFeet:20,blocksMovement:false,blocksSight:false,blocksTargeting:true,coverLevel:'total'}});check('barreira entre os alvos impede toque',(await use(await input(other.c.id))).data.error==='FEATURE_TOUCH_UNVERIFIED');await prisma.spatialObstacle.delete({where:{id:wall.id}});
 await prisma.combatant.update({where:{id:target.id},data:{spatialPosition:{xFeet:30,yFeet:0}}});check('fora do toque bloqueia',(await use(await input(other.c.id))).data.error==='FEATURE_TOUCH_UNVERIFIED');
 await resetAction();await prisma.combat.update({where:{id:combat.id},data:{currentIndex:1}});check('fora do turno bloqueia',(await use(await input())).data.error==='FEATURE_OUT_OF_TURN');await prisma.combat.update({where:{id:combat.id},data:{currentIndex:0}});
 await resetAction();const npcResult=await use(await input(npc.id,'combatant'));check('cura instância NPC, não template',npcResult.status===200&&(await prisma.combatant.findUniqueOrThrow({where:{id:npc.id}})).hpCurrent===4&&(await prisma.creature.findUniqueOrThrow({where:{id:template.id}})).hpCurrent===1);
 await reset();await resetAction();await prisma.creature.update({where:{id:template.id},data:{type:'Constructo'}});const noEffect=await use(await input(npc.id,'combatant'));check('constructo gasta pontos e ação sem cura',noEffect.status===200&&noEffect.data.noEffect&&noEffect.data.healed===0&&noEffect.data.remaining===7);
 await reset();await resetAction();await prisma.creature.update({where:{id:template.id},data:{type:'Morto-vivo'}});check('morto-vivo não recebe cura',(await use(await input(npc.id,'combatant'))).data.noEffect);
 if(process.env.LAY_ON_HANDS_FIXTURE_OUTPUT){await reset();await resetAction();writeFileSync(process.env.LAY_ON_HANDS_FIXTURE_OUTPUT,JSON.stringify({character:(await use(await input(hero.c.id,'character',1))).data.character,options:(await options()).data}));}
 console.log(`${checks} verificações de Mãos Consagradas aprovadas em HTTP/PostgreSQL isolados.`);
}finally{
 await prisma.combat.deleteMany({where:{id:{in:combats}}});await prisma.scene.deleteMany({where:{id:{in:scenes}}});await prisma.character.deleteMany({where:{id:{in:characters}}});await prisma.creature.deleteMany({where:{id:{in:creatures}}});await prisma.user.deleteMany({where:{id:{in:users}}});assert.equal(await prisma.user.count(),0);assert.equal(await prisma.character.count(),0);assert.equal(await prisma.combat.count(),0);await prisma.$disconnect();
}
