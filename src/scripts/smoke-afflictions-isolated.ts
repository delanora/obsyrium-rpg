/** Administração real via HTTP em cluster descartável. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {writeFileSync} from 'node:fs';
import {prisma} from '../config/prisma.js';import {signToken} from '../lib/jwt.js';
const url=new URL(process.env.DATABASE_URL!);assert.equal(url.port,'55439');assert.equal(url.searchParams.get('schema'),'smoke_cure_wounds');
const sentinel:any[]=await prisma.$queryRawUnsafe("SELECT current_setting('data_directory') AS directory,current_schema() AS schema");assert.equal(sentinel[0].directory,'/tmp/obsyrium-cura-pg');assert.equal(sentinel[0].schema,'smoke_cure_wounds');
assert.equal(await prisma.user.count(),0);assert.equal(await prisma.character.count(),0);assert.equal(await prisma.combat.count(),0);
let masterId='',playerId='',characterId='';let checks=0;const check=(s:string,b:unknown)=>{assert.ok(b,s);checks++;};
try{
 const master=await prisma.user.create({data:{username:'aff_master_'+randomUUID(),displayName:'Fixture',passwordHash:'fixture',role:'MASTER'}});masterId=master.id;
 const player=await prisma.user.create({data:{username:'aff_player_'+randomUUID(),displayName:'Fixture',passwordHash:'fixture',role:'PLAYER'}});playerId=player.id;
 const character=await prisma.character.create({data:{userId:player.id,name:'Afecções Fixture',classes:[{classKey:'paladin',level:2}],hpCurrent:10,hpMax:20,mechanicalState:{conditions:[{id:'legado',condition:'poisoned',sourceType:'manual',sourceId:'antigo',sourceLabel:'Mestre',appliedAt:new Date().toISOString()}]}}});characterId=character.id;
 const token=(u:typeof player)=>signToken({sub:u.id,username:u.username,displayName:u.displayName,role:u.role});
 const http=async(path:string,method='GET',body?:unknown,user=master)=>{const r=await fetch('http://127.0.0.1:3309/api'+path,{method,headers:{Authorization:'Bearer '+token(user),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json() as any};};
 const read=()=>http('/mechanical/character/'+character.id);const mutation=async(extra:any)=>{const r=await read();return {entity:r.data.mechanical.entity,expectedVersion:r.data.mechanical.version,operationId:randomUUID(),...extra};};
 const add=await mutation({action:'affliction-add',afflictionKind:'poison',label:'Veneno Fixture',symptoms:['poisoned']});
 check('jogador não cria origem',(await http('/mechanical/mutate','POST',add,player)).status===403);
 check('jogador não injeta autoridade',(await http('/mechanical/mutate','POST',{...add,authority:{ruleId:'lay-on-hands'}},player)).status===403);
 const registered=await http('/mechanical/mutate','POST',add);assert.equal(registered.status,200,JSON.stringify(registered.data));const origin=registered.data.mechanical.state.afflictions[0];
 check('HTTP usa ficha deste cluster e vincula sintoma',registered.data.mechanical.entity.id===character.id&&registered.data.mechanical.state.conditions.some((c:any)=>c.sourceType==='affliction'&&c.sourceId===origin.id));
 const version=registered.data.mechanical.version;const replay=await http('/mechanical/mutate','POST',add);check('replay não cria outra origem',replay.status===200&&replay.data.replayed&&(await read()).data.mechanical.version===version);
 check('mesma chave com nome distinto recusada',(await http('/mechanical/mutate','POST',{...add,label:'Outro'})).status===409);
 check('versão antiga recusada',(await http('/mechanical/mutate','POST',{...add,operationId:randomUUID()})).status===409);
 const disease=await http('/mechanical/mutate','POST',await mutation({action:'affliction-add',afflictionKind:'disease',label:'Doença sem sintoma',symptoms:[]}));
 check('doença não acrescenta Envenenado',disease.status===200&&disease.data.mechanical.state.conditions.length===2&&disease.data.mechanical.state.afflictions.length===2);
 const remove=await mutation({action:'affliction-remove',afflictionId:origin.id});check('jogador não remove origem',(await http('/mechanical/mutate','POST',remove,player)).status===403);
 const removed=await http('/mechanical/mutate','POST',remove);check('Mestre remove só veneno selecionado',removed.status===200&&removed.data.mechanical.state.afflictions.length===1&&removed.data.mechanical.state.conditions.length===1&&removed.data.mechanical.state.conditions[0].id==='legado');
 check('proprietário pode ler registros da própria ficha',(await http('/mechanical/character/'+character.id,'GET',undefined,player)).data.mechanical.state.afflictions.length===1);
 const before=await prisma.character.findUniqueOrThrow({where:{id:character.id}});check('administração não gasta reserva nem altera PV',before.hpCurrent===10&&JSON.stringify(before.classState)===JSON.stringify(character.classState));
 check('referência já encerrada não atinge outras fontes',(await http('/mechanical/mutate','POST',await mutation({action:'affliction-remove',afflictionId:origin.id}))).status===409);
 const beforeHealing=(await read()).data.mechanical;
 const cured=await http('/characters/me/features/lay-on-hands/heal','POST',{target:{kind:'character',id:character.id},amount:1,expectedVersion:beforeHealing.version,expectedTargetVersion:beforeHealing.version,operationId:randomUUID()},player);
 check('cura de PV preserva doença e condição legada',cured.status===200&&cured.data.character.mechanicalState.afflictions[0].id===beforeHealing.state.afflictions[0].id&&cured.data.character.mechanicalState.conditions.some((c:any)=>c.id==='legado'));
 await prisma.character.update({where:{id:character.id},data:{classes:[{classKey:'paladin',level:3}],version:{increment:1}}});
 check('Saúde Divina impede nova doença',(await http('/mechanical/mutate','POST',await mutation({action:'affliction-add',afflictionKind:'disease',label:'Bloqueada'}))).data.error==='AFFLICTION_IMMUNE');
 check('origem existente não é apagada automaticamente',(await read()).data.mechanical.state.afflictions.length===1);
 for(const input of [{action:'affliction-add',afflictionKind:'disease'},{action:'affliction-remove'},{action:'affliction-add',afflictionKind:'invalid',label:'Inválida'}])check('payload incompleto ou inválido é recusado',(await http('/mechanical/mutate','POST',await mutation(input))).status===400);
 if(process.env.AFFLICTION_FIXTURE_OUTPUT)writeFileSync(process.env.AFFLICTION_FIXTURE_OUTPUT,JSON.stringify((await read()).data.mechanical));
 console.log(`${checks} verificações HTTP/PostgreSQL de afecções aprovadas.`);
}finally{
 if(characterId)await prisma.character.delete({where:{id:characterId}});if(playerId)await prisma.user.delete({where:{id:playerId}});if(masterId)await prisma.user.delete({where:{id:masterId}});
 assert.equal(await prisma.user.count(),0);assert.equal(await prisma.character.count(),0);assert.equal(await prisma.combat.count(),0);await prisma.$disconnect();
}
