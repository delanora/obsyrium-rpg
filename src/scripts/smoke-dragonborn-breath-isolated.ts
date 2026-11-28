/** Teste end-to-end em cluster exclusivo; nenhum dado da campanha pode ser usado. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { prisma } from '../config/prisma.js';
import { signToken } from '../lib/jwt.js';
import { smokeCreatureArea } from './smoke-creature-area.js';
const url=new URL(process.env.DATABASE_URL!);
assert.equal(url.port,'55439');assert.equal(url.searchParams.get('schema'),'smoke_cure_wounds');
const sentinel:any[]=await prisma.$queryRawUnsafe("SELECT current_setting('data_directory') AS directory");assert.equal(sentinel[0].directory,'/tmp/obsyrium-cura-pg');
assert.equal(await prisma.user.count(),0);assert.equal(await prisma.character.count(),0);assert.equal(await prisma.combat.count(),0);
const users:string[]=[],characters:string[]=[],combats:string[]=[],creatures:string[]=[],scenes:string[]=[];let checks=0;
const check=(s:string,b:unknown)=>{assert.ok(b,s);checks++;};
try {
 const makeUser=async(role:'PLAYER'|'MASTER')=>{const u=await prisma.user.create({data:{username:'sopro_'+randomUUID(),displayName:'Fixture Sopro',passwordHash:'fixture',role}});users.push(u.id);return u;};
 const player=await makeUser('PLAYER'),master=await makeUser('MASTER'),other=await makeUser('PLAYER');
 const tokenOf=(u:typeof player)=>signToken({sub:u.id,username:u.username,displayName:u.displayName,role:u.role});
 const playerToken=tokenOf(player),masterToken=tokenOf(master),otherToken=tokenOf(other);
 const http=async(path:string,method='GET',body?:unknown,token=masterToken)=>{const r=await fetch('http://127.0.0.1:3309/api'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:r.status,data:await r.json() as any};};
 const hero=await prisma.character.create({data:{userId:player.id,name:'Draconato Fixture',raceId:'dragonborn',raceChoices:{'draconic-ancestry':'black'},constitution:16,charisma:20,hpCurrent:100,hpMax:100,speed:9,classes:[{classKey:'fighter',level:3},{classKey:'sorcerer',level:3}],classState:{choices:{'dragon-ancestor':['red']}}}});characters.push(hero.id);
 const intruder=await prisma.character.create({data:{userId:other.id,name:'Humano Fixture',raceId:'human',hpCurrent:100,hpMax:100,speed:9,classes:[{classKey:'fighter',level:1}]}});characters.push(intruder.id);
 const template=await prisma.creature.create({data:{name:'Resistente Fixture',type:'Humanoide',hpMax:100,hpCurrent:100,resistances:['Ácido']}});creatures.push(template.id);
 const immune=await prisma.creature.create({data:{name:'Imune Oculto Fixture',type:'Constructo',hpMax:100,hpCurrent:100,immunities:['Ácido']}});creatures.push(immune.id);
 const scene=await prisma.scene.create({data:{name:'Cena Sopro Fixture',spatialConfig:{mode:'grid-2d',widthFeet:100,heightFeet:100,cellSizeFeet:5}}});scenes.push(scene.id);
 const combat=await prisma.combat.create({data:{status:'ACTIVE',sceneId:scene.id,round:1,currentIndex:0,turnSequence:1,spatialConfig:{mode:'grid-2d',widthFeet:100,heightFeet:100,cellSizeFeet:5},combatants:{create:[
 {kind:'CHARACTER',characterId:hero.id,ownerUserId:player.id,name:hero.name,initiative:20,dexterityMod:0,spatialPosition:{xFeet:0,yFeet:0},elevationFeet:0,turnEconomy:{actionsGranted:1,actionsUsed:0,movementBudget:9}},
 {kind:'CHARACTER',characterId:intruder.id,ownerUserId:other.id,name:intruder.name,initiative:10,dexterityMod:0,spatialPosition:{xFeet:5,yFeet:20},elevationFeet:0},
 {kind:'CREATURE',creatureId:template.id,name:template.name,initiative:5,dexterityMod:0,hpCurrent:100,hpMax:100,spatialPosition:{xFeet:10,yFeet:0},elevationFeet:0},
 {kind:'CREATURE',creatureId:immune.id,name:immune.name,initiative:1,dexterityMod:0,hpCurrent:100,hpMax:100,spatialPosition:{xFeet:15,yFeet:0},elevationFeet:0,spatialVisibility:'master-only'},
 ]}},include:{combatants:true}});combats.push(combat.id);
 const source=combat.combatants.find(c=>c.characterId===hero.id)!,publicTarget=combat.combatants.find(c=>c.creatureId===template.id)!,hidden=combat.combatants.find(c=>c.creatureId===immune.id)!;
 const options=await http('/characters/me/breath-weapon/options?combatId='+combat.id,'GET',undefined,playerToken);assert.equal(options.status,200,JSON.stringify(options.data));
 check('deriva da raça, não da subclasse ou Carisma',options.data.definition.area.dc===14&&options.data.definition.area.damage[0].type==='Ácido'&&options.data.definition.area.damage[0].dice.count===3);
 check('outro jogador não herda o Sopro', (await http('/characters/me/breath-weapon/options?combatId='+combat.id,'GET',undefined,otherToken)).status===403);
 const placement={origin:{xFeet:2.5,yFeet:2.5},angle:0};
 const preview=await http('/characters/me/breath-weapon/preview','POST',{combatId:combat.id,placement},playerToken);assert.equal(preview.status,200,JSON.stringify(preview.data));
 check('prévia oculta IDs e nomes privados',!JSON.stringify(preview.data).includes(hidden.id)&&!JSON.stringify(preview.data).includes(immune.name));
 check('preview não cobra nem cria resolução',await prisma.creatureAreaUse.count({where:{combatId:combat.id}})===0&&(await prisma.character.findUniqueOrThrow({where:{id:hero.id}})).version===hero.version);
 check('jogador não arbitra exceções', (await http('/characters/me/breath-weapon/preview','POST',{combatId:combat.id,placement:{...placement,decisions:[{targetKey:'combatant:'+publicTarget.id,affected:true}]}},playerToken)).status===403);
 const operationId=randomUUID(),input={combatId:combat.id,expectedCombatVersion:options.data.combatVersion,expectedVersion:options.data.characterVersion,operationId,placement:{...placement,definitionFingerprint:preview.data.definitionFingerprint}};
 check('não aceita escolher imunidade por checkbox', (await http('/characters/me/breath-weapon/use','POST',{...input,placement:{...input.placement,selectedTargetKeys:[]}},playerToken)).status===400);
 check('não aceita definir dano', (await http('/characters/me/breath-weapon/use','POST',{...input,damage:9999},playerToken)).status===400);
 check('marcação legada bloqueada em combate', (await http('/characters/me/racial-features/use','POST',{resourceId:'breath-weapon',expectedVersion:hero.version,operationId:randomUUID()},playerToken)).data.error==='BREATH_AREA_REQUIRED');
 check('origem fora do executor recusada',(await http('/characters/me/breath-weapon/preview','POST',{combatId:combat.id,placement:{...placement,origin:{xFeet:50,yFeet:50}}},playerToken)).status===400);
 check('versão antiga da ficha não cobra',(await http('/characters/me/breath-weapon/use','POST',{...input,expectedVersion:hero.version-1},playerToken)).status===409);
 check('definição antiga não cobra Ação nem uso',(await http('/characters/me/breath-weapon/use','POST',{...input,placement:{...input.placement,definitionFingerprint:'0'.repeat(64)}},playerToken)).status===409&&((await prisma.combatant.findUniqueOrThrow({where:{id:source.id}})).turnEconomy as any).actionsUsed===0&&await prisma.creatureAreaUse.count({where:{combatId:combat.id}})===0);
 const duplicates=await Promise.all([http('/characters/me/breath-weapon/use','POST',input,playerToken),http('/characters/me/breath-weapon/use','POST',input,playerToken)]);
 const used=duplicates[0];assert.equal(used.status,200,JSON.stringify(used.data));
 check('mesma chave concorrente só cria uma execução',duplicates.every(r=>r.status===200)&&duplicates[0].data.areaUseId===duplicates[1].data.areaUseId);

 check('resposta não expõe token oculto',!JSON.stringify(used.data.combat).includes(hidden.id));
 const saved=await prisma.creatureAreaUse.findUniqueOrThrow({where:{id:used.data.areaUseId}});
 const pending=await prisma.pendingEffectSave.findMany({where:{creatureAreaUseId:saved.id}});
 check('todos os atingidos, inclusive ocultos; exclui o próprio executor',pending.length===2&&pending.every(p=>p.targetEntityId!==hero.id));
 check('custo racial e Ação juntos',((await prisma.character.findUniqueOrThrow({where:{id:hero.id}})).racialState as any).used['breath-weapon']===1&&((await prisma.combatant.findUniqueOrThrow({where:{id:source.id}})).turnEconomy as any).actionsUsed===1);
 const replay=await http('/characters/me/breath-weapon/use','POST',input,playerToken);
 check('replay não duplica barreira nem uso',replay.status===200&&replay.data.replayed&&await prisma.creatureAreaUse.count({where:{combatId:combat.id}})===1);
 check('chave não pode mudar direção', (await http('/characters/me/breath-weapon/use','POST',{...input,placement:{...input.placement,angle:1}},playerToken)).data.error==='IDEMPOTENCY_KEY_REUSED');
 const fresh=await prisma.character.findUniqueOrThrow({where:{id:hero.id}}),freshCombat=await prisma.combat.findUniqueOrThrow({where:{id:combat.id}});
 check('sem saldo não cria nova área',(await http('/characters/me/breath-weapon/use','POST',{...input,expectedVersion:fresh.version,expectedCombatVersion:freshCombat.version,operationId:randomUUID()},playerToken)).status===409&&await prisma.creatureAreaUse.count({where:{combatId:combat.id}})===1);
 check('jogador não resolve salvaguarda de NPC',(await http('/dice/roll','POST',{kind:'save',dice:[{sides:20}],pendingEffectSaveId:pending[0].id},playerToken)).status===403);
 const first=await http('/dice/roll','POST',{kind:'save',dice:[{sides:20}],pendingEffectSaveId:pending[0].id});assert.equal(first.status,201,JSON.stringify(first.data));
 check('barreira aguarda todos antes de aplicar dano',(await prisma.combatant.findUniqueOrThrow({where:{id:publicTarget.id}})).hpCurrent===100);
 await prisma.character.update({where:{id:hero.id},data:{raceChoices:{'draconic-ancestry':'red'},constitution:2,version:{increment:1}}});
 const second=await http('/dice/roll','POST',{kind:'save',dice:[{sides:20}],pendingEffectSaveId:pending[1].id});assert.equal(second.status,201,JSON.stringify(second.data));
 const completed=await prisma.creatureAreaUse.findUniqueOrThrow({where:{id:saved.id}}),snapshot=completed.resolutionSnapshot as any;
 check('snapshot preserva ancestralidade e dados após edição da ficha',completed.status==='resolved'&&snapshot.damageRoll.components[0].rolls.length===3&&snapshot.damageRoll.rawDamage>=3&&snapshot.damageRoll.rawDamage<=18);
 const publicSave=await prisma.pendingEffectSave.findUniqueOrThrow({where:{id:pending.find(p=>p.targetEntityId===publicTarget.id)!.id}});
 const share=publicSave.result==='success'?Math.floor(snapshot.damageRoll.rawDamage/2):snapshot.damageRoll.rawDamage;
 check('salvaguarda e resistência aplicadas na ordem canônica',(await prisma.combatant.findUniqueOrThrow({where:{id:publicTarget.id}})).hpCurrent===100-Math.floor(share/2));
 check('imunidade preserva PV',(await prisma.combatant.findUniqueOrThrow({where:{id:hidden.id}})).hpCurrent===100);
 const hpAfter=(await prisma.combatant.findUniqueOrThrow({where:{id:publicTarget.id}})).hpCurrent;
 await http('/dice/roll','POST',{kind:'save',dice:[{sides:20}],pendingEffectSaveId:pending[1].id});
 check('repetir save não repete dano',(await prisma.combatant.findUniqueOrThrow({where:{id:publicTarget.id}})).hpCurrent===hpAfter);
 if(process.env.BREATH_FIXTURE_OUTPUT)writeFileSync(process.env.BREATH_FIXTURE_OUTPUT,JSON.stringify({options:options.data,preview:preview.data,combat:used.data.combat}));
 console.log(checks+' verificações HTTP/PostgreSQL de Sopro racial aprovadas.');
 // A refatoração precisa preservar a execução do bestiário, inclusive concorrência.
 await prisma.combat.update({where:{id:combat.id},data:{status:'ENDED'}});
 const regressionCombat=await prisma.combat.create({data:{status:'ACTIVE',sceneId:scene.id,round:1,currentIndex:0,turnSequence:1,combatants:{create:[{kind:'CHARACTER',characterId:hero.id,ownerUserId:player.id,name:hero.name,initiative:20,dexterityMod:0,spatialPosition:{xFeet:5,yFeet:0},elevationFeet:0,turnEconomy:{actionsGranted:1,actionsUsed:0,movementBudget:9}}]}},include:{combatants:true}});combats.push(regressionCombat.id);
 await smokeCreatureArea(http,regressionCombat.id,regressionCombat.combatants[0].id,playerToken);
} finally {
 await prisma.combat.deleteMany({where:{id:{in:combats}}});await prisma.scene.deleteMany({where:{id:{in:scenes}}});await prisma.character.deleteMany({where:{id:{in:characters}}});await prisma.creature.deleteMany({where:{id:{in:creatures}}});await prisma.user.deleteMany({where:{id:{in:users}}});
 assert.equal(await prisma.user.count(),0);assert.equal(await prisma.character.count(),0);assert.equal(await prisma.combat.count(),0);await prisma.$disconnect();
}
