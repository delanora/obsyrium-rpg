/** Surto de Ação: fixtures exclusivas em PostgreSQL descartável. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { prisma } from '../config/prisma.js';
import { signToken } from '../lib/jwt.js';
import { economyOf, grantActionSurge, onTurnStart, spendEconomy } from '../modules/shared/action-economy.js';
import { normalizeClassState, restoreShortRestResources } from '../modules/shared/classes.js';
import { characterClassAdjustments } from '../modules/characters/characters.dto.js';
import { bonusActionSpellViolation } from '../modules/spells/execution/spell-casting-economy.js';
import { seedSpellRepertoire } from './spell-slot-fixtures.js';
const url = new URL(process.env.DATABASE_URL!);
assert.equal(url.port, '55439'); assert.equal(url.searchParams.get('schema'), 'smoke_cure_wounds');
const sentinel: any[] = await prisma.$queryRawUnsafe("SELECT current_setting('data_directory') AS directory, current_schema() AS schema");
assert.equal(sentinel[0].directory, '/tmp/obsyrium-cura-pg'); assert.equal(sentinel[0].schema, 'smoke_cure_wounds');
assert.equal(await prisma.user.count(), 0); assert.equal(await prisma.character.count(), 0); assert.equal(await prisma.combat.count(), 0);
const users: string[] = [], characters: string[] = [], combats: string[] = [];
let checks=0; const check=(label:string,ok:unknown)=>{assert.ok(ok,label);checks++;};
try {
 const make=async(classes:unknown,role:'PLAYER'|'MASTER'='PLAYER')=>{
  const user=await prisma.user.create({data:{username:'surto_'+randomUUID(),displayName:'Fixture',passwordHash:'fixture',role}});users.push(user.id);
  const character=await prisma.character.create({data:{userId:user.id,name:'Surto Fixture',hpCurrent:100,hpMax:100,speed:9,wisdom:16,classes:classes as any}});characters.push(character.id);
  return {user,character,token:signToken({sub:user.id,username:user.username,displayName:user.displayName,role})};
 };
 const fighter=await make([{classKey:'fighter',level:17,subclass:''},{classKey:'cleric',level:3,subclass:''}]);
 const other=await make([{classKey:'fighter',level:1,subclass:''}]);const master=await make([], 'MASTER');
 const post=async(token:string,body:unknown,path='/characters/me/features/action-surge')=>{
  const response=await fetch('http://127.0.0.1:3309/api'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {status:response.status,data:await response.json() as any};
 };
 const fresh=()=>prisma.character.findUniqueOrThrow({where:{id:fighter.character.id}});
 const body=async(operationId=randomUUID())=>({operationId,expectedVersion:(await fresh()).version});
 const reset=async(data:Record<string,unknown>={})=>prisma.character.update({where:{id:fighter.character.id},data:{classState:{},hpCurrent:100,deathState:{},mechanicalState:{},...data,version:{increment:1}}});
 const noTurn=await post(fighter.token,await body());check('fora de combate não desperdiça uso',noTurn.status===409&&noTurn.data.error==='FEATURE_TURN_REQUIRED'&&(await fresh()).version===fighter.character.version);
 check('Guerreiro nível 1 não tem Surto', (await post(other.token,{operationId:randomUUID(),expectedVersion:other.character.version})).status===403);
 check('não aceita concessão nem alvo do cliente',(await post(fighter.token,{...await body(),actionsGranted:99,characterId:other.character.id})).status===400);
 const combat=await prisma.combat.create({data:{status:'ACTIVE',currentIndex:0,round:1,turnSequence:1,combatants:{create:[
  {kind:'CHARACTER',characterId:fighter.character.id,ownerUserId:fighter.user.id,name:'Guerreiro',initiative:20,initiativeRoll:20,dexterityMod:0,turnEconomy:{actionsGranted:1,actionsUsed:1,bonusActionUsed:true,reactionAvailable:false,movementBudget:9,movementUsed:3}},
  {kind:'CHARACTER',characterId:other.character.id,ownerUserId:other.user.id,name:'Outro',initiative:10,initiativeRoll:10,dexterityMod:0}
 ]}},include:{combatants:true}});combats.push(combat.id);const unit=combat.combatants.find(u=>u.characterId===fighter.character.id)!;
 const economy=async()=>economyOf((await prisma.combatant.findUniqueOrThrow({where:{id:unit.id}})).turnEconomy);
 const req=await body();const result=await post(fighter.token,req);assert.equal(result.status,200,JSON.stringify(result.data));
 check('sentinela HTTP e saldo nível 17',result.data.character.id===fighter.character.id&&result.data.remaining===1);
 if(process.env.ACTION_SURGE_FIXTURE_OUTPUT)writeFileSync(process.env.ACTION_SURGE_FIXTURE_OUTPUT,JSON.stringify(result.data.character));
 const e=await economy();check('concede exatamente uma ação sem restaurar demais custos',e.actionsGranted===2&&e.actionsUsed===1&&e.bonusActionUsed&&!e.reactionAvailable&&e.movementUsed===3&&e.actionSurgeUsed);
 const before=await fresh();const repeat=await post(fighter.token,req);check('replay não concede nem cobra de novo',repeat.status===200&&repeat.data.replayed&&(await economy()).actionsGranted===2&&(await fresh()).version===before.version);
 check('dois usos no descanso não permitem dois no mesmo turno',(await post(fighter.token,await body())).data.error==='ACTION_SURGE_ALREADY_USED'&&(await fresh()).version===before.version);
 const consumable=await economy();spendEconomy(consumable,'action');check('ação extra utilizável pela economia canônica',consumable.actionsUsed===2);
 const turn=onTurnStart(9);check('novo turno elimina ação extra e limite de uso',turn.actionsGranted===1&&!turn.actionSurgeUsed);
 await prisma.combatant.update({where:{id:unit.id},data:{turnEconomy:turn}});await prisma.combat.update({where:{id:combat.id},data:{turnSequence:2}});
 const second=await post(fighter.token,await body());check('segundo uso no turno seguinte permitido no nível 17',second.status===200&&second.data.remaining===0);
 await prisma.combatant.update({where:{id:unit.id},data:{turnEconomy:onTurnStart(9)}});
 check('terceiro uso sem descanso bloqueado',(await post(fighter.token,await body())).data.error==='INSUFFICIENT_RESOURCE');
 const spent=await fresh();const restored=restoreShortRestResources(normalizeClassState(spent.classState),characterClassAdjustments(spent).resources);check('recarga curta canônica restaura o saldo',(restored.used['action-surge']??0)===0);
 await reset();await prisma.combat.update({where:{id:combat.id},data:{currentIndex:1,turnSequence:3}});
 check('fora do turno sem efeito',(await post(fighter.token,await body())).data.error==='FEATURE_OUT_OF_TURN');
 await prisma.combat.update({where:{id:combat.id},data:{status:'PENDING_INITIATIVE'}});
 check('pré-iniciativa sem efeito',(await post(fighter.token,await body())).data.error==='FEATURE_TURN_REQUIRED');
 await prisma.combat.update({where:{id:combat.id},data:{status:'ACTIVE',currentIndex:0,turnSequence:4}});
 for(const data of [{hpCurrent:0},{deathState:{dead:true}},{mechanicalState:{conditions:[{id:'surto-incap',condition:'incapacitated',appliedAt:new Date().toISOString()}]}}]){
  await reset(data);const b=await fresh();check('incapacidade/morte/zero PV não cobra',(await post(fighter.token,await body())).data.error==='FEATURE_INCAPACITATED'&&(await fresh()).version===b.version);
 }
 await reset();const stale=await body();await reset();check('versão antiga não concede',(await post(fighter.token,stale)).status===409&&(await economy()).actionsGranted===1);
 const foreign=randomUUID();await prisma.characterOperation.create({data:{characterId:fighter.character.id,operationId:foreign,type:'outra',requestFingerprint:'{}',result:{}}});check('chave de outra operação recusada',(await post(fighter.token,await body(foreign))).data.error==='IDEMPOTENCY_KEY_REUSED');
 const same=await body();const race=await Promise.all([post(fighter.token,same),post(fighter.token,same)]);check('mesma chave concorrente concede uma vez',race.every(r=>r.status===200)&&(await economy()).actionsGranted===2&&await prisma.characterOperation.count({where:{characterId:fighter.character.id,operationId:same.operationId}})===1);
 await reset();await prisma.combatant.update({where:{id:unit.id},data:{turnEconomy:onTurnStart(9)}});const version=(await fresh()).version;
 const distinct=await Promise.all([post(fighter.token,{operationId:randomUUID(),expectedVersion:version}),post(fighter.token,{operationId:randomUUID(),expectedVersion:version})]);check('chaves distintas concorrentes têm um vencedor',distinct.filter(r=>r.status===200).length===1&&distinct.filter(r=>r.status===409).length===1&&(await economy()).actionsGranted===2);
 // A economia real permite duas magias de Ação; o Surto não remove a regra de magia bônus.
 await seedSpellRepertoire({characterId:fighter.character.id,classKey:'cleric',spellIds:['cure-wounds']});
 const cast=()=>post(master.token,{operationId:randomUUID(),spellId:'cure-wounds',caster:{kind:'character',id:fighter.character.id},targets:[{kind:'character',id:fighter.character.id}],castingResource:{kind:'spell-slot',level:1},spatialConfirmation:{withinRange:true,clearPath:true}},'/spells/cast-proof');
 const a=await cast(),b=await cast(),c=await cast();check('duas magias de Ação usam as duas ações, terceira falha',a.status===201&&b.status===201&&c.status===409);
 check('restrição de magia bônus continua válida',bonusActionSpellViolation([{spellLevel:1,castingTime:'bonus-action'}],{spellLevel:1,castingTime:'action'})==='BONUS_ACTION_SPELL_RESTRICTION');
 const legacy=economyOf({actionsGranted:1,movementBudget:9});grantActionSurge(legacy);check('JSON legado aceita campo novo sem migração',legacy.actionsGranted===2&&legacy.actionSurgeUsed);
 console.log(`${checks} verificações de Surto de Ação aprovadas em HTTP/PostgreSQL isolados.`);
}finally{
 await prisma.combat.deleteMany({where:{id:{in:combats}}});await prisma.spellCast.deleteMany({where:{casterEntityId:{in:characters}}});await prisma.character.deleteMany({where:{id:{in:characters}}});await prisma.user.deleteMany({where:{id:{in:users}}});
 assert.equal(await prisma.user.count(),0);assert.equal(await prisma.character.count(),0);assert.equal(await prisma.combat.count(),0);await prisma.$disconnect();
}
