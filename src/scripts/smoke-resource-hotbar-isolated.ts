/** Persistência de referências: cluster descartável, sem fixtures da campanha. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../config/prisma.js';
import {signToken} from '../lib/jwt.js';
import {smokeHotbar} from './smoke-hotbar.js';
const url=new URL(process.env.DATABASE_URL!);assert.equal(url.port,'55439');assert.equal(url.searchParams.get('schema'),'smoke_cure_wounds');
const sentinel:any[]=await prisma.$queryRawUnsafe("SELECT current_setting('data_directory') AS directory");assert.equal(sentinel[0].directory,'/tmp/obsyrium-cura-pg');
assert.equal(await prisma.user.count(),0);assert.equal(await prisma.character.count(),0);assert.equal(await prisma.combat.count(),0);
let checks=0;const check=(label:string,ok:boolean)=>{assert.ok(ok,label);checks++;};
let userId='',characterId='';
try{
 const user=await prisma.user.create({data:{username:'hotbar_resource_'+randomUUID(),displayName:'Fixture',passwordHash:'fixture',role:'PLAYER'}});userId=user.id;
 const character=await prisma.character.create({data:{userId,name:'Hotbar Fixture',hpCurrent:10,hpMax:10,classState:{used:{'second-wind':0}},classes:[{classKey:'fighter',level:2,subclass:''}]}});characterId=character.id;
 const token=signToken({sub:user.id,username:user.username,displayName:user.displayName,role:'PLAYER'});
 const slots:any[]=Array.from({length:48},()=>null);slots[0]={kind:'feature',sourceId:'second-wind'};slots[17]={kind:'feature',sourceId:'action-surge'};slots[47]={kind:'feature',sourceId:'breath-weapon'};
 const operationId=randomUUID();const save=async(s:any[],version=character.version)=>{const r=await fetch('http://127.0.0.1:3309/api/characters/me/hotbar',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({slots:s,expectedVersion:version,operationId})});return {status:r.status,data:await r.json() as any};};
 const saved=await save(slots);assert.equal(saved.status,200,JSON.stringify(saved.data));check('HTTP usa fixture deste cluster e preserva as três referências',saved.data.character.id===characterId&&JSON.stringify(saved.data.hotbar.slots)===JSON.stringify(slots));
 const after=await prisma.character.findUniqueOrThrow({where:{id:characterId}});check('organizar não cobra recursos nem altera PV',JSON.stringify(after.classState)===JSON.stringify(character.classState)&&after.hpCurrent===10);
 const replay=await save(slots);check('replay não grava novamente',replay.status===200&&replay.data.replayed&&(await prisma.character.findUniqueOrThrow({where:{id:characterId}})).version===after.version);
 const invalid=[...slots];invalid[1]={kind:'feature',sourceId:'recurso-inventado'};check('referência desconhecida não é aceita',(await save(invalid,after.version)).status===400);
 check('salvar referência não concede posse de Sopro',await prisma.creatureAreaUse.count()===0&&JSON.stringify(after.racialState)===JSON.stringify(character.racialState));
 await prisma.character.delete({where:{id:characterId}});characterId='';await prisma.user.delete({where:{id:userId}});userId='';
 await smokeHotbar('http://127.0.0.1:3309',check);
 console.log(`${checks} verificações HTTP/PostgreSQL da Hotbar aprovadas.`);
}finally{
 if(characterId)await prisma.character.delete({where:{id:characterId}});if(userId)await prisma.user.delete({where:{id:userId}});
 assert.equal(await prisma.user.count(),0);assert.equal(await prisma.character.count(),0);assert.equal(await prisma.combat.count(),0);await prisma.$disconnect();
}
