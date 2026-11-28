/** Integração em cluster exclusivo de teste; recusa portas/schema/caminho da campanha. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { signToken } from '../lib/jwt.js';
import { seedSpellRepertoire } from './spell-slot-fixtures.js';
import { emptyDeathState } from '../modules/shared/death.js';
const url = new URL(process.env.DATABASE_URL!);
assert.equal(url.port,'55439');assert.equal(url.searchParams.get('schema'),'smoke_cure_wounds');
const location:any[] = await prisma.$queryRawUnsafe("SELECT current_setting('data_directory') AS directory, current_schema() AS schema");
assert.equal(location[0].directory,'/tmp/obsyrium-cura-pg');assert.equal(location[0].schema,'smoke_cure_wounds');
assert.equal(await prisma.user.count(),0,'cluster precisa estar vazio antes das fixtures');
let checks=0;const ownUsers:string[]=[],ownChars:string[]=[],ownCombats:string[]=[];
const check=(s:string,b:unknown)=>{assert.ok(b,s);checks++;};
try {
 const user=async(role:'MASTER'|'PLAYER')=>{const u=await prisma.user.create({data:{username:'cura_'+randomUUID(),passwordHash:'fixture',displayName:'Fixture',role}});ownUsers.push(u.id);return u;};
 const master=await user('MASTER'),owner=await user('PLAYER'),targetOwner=await user('PLAYER');
 const token=signToken({sub:master.id,username:master.username,displayName:'Fixture',role:'MASTER'});
 const make=async(userId:string,name:string)=>{const c=await prisma.character.create({data:{userId,name,wisdom:16,hpCurrent:1,hpMax:100,speed:9,classes:[{classKey:'cleric',subclass:'',level:5}]}});ownChars.push(c.id);return c;};
 const caster=await make(owner.id,'Conjurador'),target=await make(targetOwner.id,'Alvo');
 await seedSpellRepertoire({characterId:caster.id,classKey:'cleric',spellIds:['cure-wounds','healing-word']});
 const post=async(body:any)=>{const r=await fetch('http://127.0.0.1:3309/api/spells/cast-proof',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:r.status,data:await r.json() as any};};
 const body=(id=randomUUID(),level=1)=>({operationId:id,spellId:'cure-wounds',caster:{kind:'character',id:caster.id},targets:[{kind:'character',id:target.id}],castingResource:{kind:'spell-slot',level},spatialConfirmation:{withinRange:true,clearPath:true}});
 const before=await prisma.character.findUniqueOrThrow({where:{id:target.id}});
 const id=randomUUID(),request=body(id),first=await post(request);assert.equal(first.status,201,JSON.stringify(first.data));
 const resolution=first.data.cast.resolution,after=await prisma.character.findUniqueOrThrow({where:{id:target.id}});
 check('1d8 e atributo da fonte uma vez',resolution.dice.rolls.length===1&&resolution.dice.rolls[0]>=1&&resolution.dice.rolls[0]<=8&&resolution.abilityModifier===3&&resolution.requestedHealing===resolution.dice.rolls[0]+3);
 check('cura persistida fora de combate',after.hpCurrent===before.hpCurrent+resolution.finalHealing);
 const spent=await prisma.character.findUniqueOrThrow({where:{id:caster.id}});
 check('um espaço consumido',(spent.spells as any).slotsUsed['1']===1);
 const retry=await post(request);check('retry replay sem nova cura',retry.status===200&&retry.data.replayed===true&&(await prisma.character.findUniqueOrThrow({where:{id:target.id}})).hpCurrent===after.hpCurrent);
 check('retry sem novo gasto',(await prisma.character.findUniqueOrThrow({where:{id:caster.id}})).version===spent.version);
 const up=await post(body(randomUUID(),2));assert.equal(up.status,201,JSON.stringify(up.data));check('upcast 2d8, atributo uma vez',up.data.cast.resolution.dice.rolls.length===2&&up.data.cast.resolution.requestedHealing===up.data.cast.resolution.dice.rolls.reduce((a:number,b:number)=>a+b,0)+3);
 await prisma.character.update({where:{id:target.id},data:{hpCurrent:0,deathState:{...emptyDeathState(),dead:true}}});
 const beforeDead=await prisma.character.findUniqueOrThrow({where:{id:caster.id}}),dead=await post(body());
 check('morto recusado sem consumo',dead.data.error==='SPELL_TARGET_DEAD'&&(await prisma.character.findUniqueOrThrow({where:{id:caster.id}})).version===beforeDead.version);
 await prisma.character.update({where:{id:target.id},data:{hpCurrent:1,deathState:emptyDeathState()}});
 const combat=await prisma.combat.create({data:{status:'ACTIVE',round:1,currentIndex:0,turnSequence:1,combatants:{create:[{kind:'CHARACTER',characterId:caster.id,ownerUserId:owner.id,name:'Conjurador',initiative:20,initiativeRoll:20,dexterityMod:0,hpCurrent:30,hpMax:30,turnEconomy:{actionsGranted:1,actionsUsed:0,movementBudget:9}},{kind:'CHARACTER',characterId:target.id,ownerUserId:targetOwner.id,name:'Alvo',initiative:10,initiativeRoll:10,dexterityMod:0,hpCurrent:1,hpMax:100}]}},include:{combatants:true}});ownCombats.push(combat.id);
 const castCombat=await post(body());assert.equal(castCombat.status,201,JSON.stringify(castCombat.data));const participant=await prisma.combatant.findUniqueOrThrow({where:{id:combat.combatants.find(x=>x.characterId===caster.id)!.id}});
 check('em combate consome Ação, não Bônus',(participant.turnEconomy as any).actionsUsed===1&&(participant.turnEconomy as any).bonusActionUsed!==true);
 const exhaustedBefore=await prisma.character.findUniqueOrThrow({where:{id:caster.id}}),again=await post(body());
 check('ação esgotada falha sem novo slot',again.status>=400&&(await prisma.character.findUniqueOrThrow({where:{id:caster.id}})).version===exhaustedBefore.version);
 await prisma.combat.update({where:{id:combat.id},data:{status:'ENDED'}});
 for(const type of ['Morto-vivo','Constructo']) {
  const creature=await prisma.creature.create({data:{name:'Cura '+type,type,hpCurrent:1,hpMax:100,speed:9}});
  try {
   const noEffect=await post({...body(randomUUID(),2),targets:[{kind:'creature',id:creature.id}]});
   assert.equal(noEffect.status,201,JSON.stringify(noEffect.data));
   check(type+' sem cura, conjuração válida',noEffect.data.cast.resolution.noEffectReason==='creature-type-immune'&&(await prisma.creature.findUniqueOrThrow({where:{id:creature.id}})).hpCurrent===1);
  } finally {await prisma.creature.delete({where:{id:creature.id}});}
 }
 await prisma.character.update({where:{id:target.id},data:{hpCurrent:0,deathState:{...emptyDeathState(),successes:2,failures:1}}});
 const zero=await post(body());assert.equal(zero.status,201,JSON.stringify(zero.data));
 const zeroAfter=await prisma.character.findUniqueOrThrow({where:{id:target.id}});
 check('cura a zero PV restaura vida e limpa testes',zeroAfter.hpCurrent>0&&(zeroAfter.deathState as any).successes===0&&(zeroAfter.deathState as any).failures===0);
 console.log(`${checks} verificações HTTP/PostgreSQL de Curar Ferimentos aprovadas no cluster descartável.`);
} finally {
 await prisma.combat.deleteMany({where:{id:{in:ownCombats}}});
 await prisma.spellCast.deleteMany({where:{casterEntityId:{in:ownChars}}});
 await prisma.character.deleteMany({where:{id:{in:ownChars}}});
 await prisma.user.deleteMany({where:{id:{in:ownUsers}}});
 assert.equal(await prisma.user.count(),0);await prisma.$disconnect();
}
