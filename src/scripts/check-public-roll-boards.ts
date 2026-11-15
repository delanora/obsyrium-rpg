/** Fixtures em memória: sem HTTP, socket real, conexão ou escrita no banco. */
import assert from 'node:assert/strict';
import { PublicRollBoards } from '../modules/dice/public-roll-boards.js';
import type { ActiveRollDto, DiceRollDto } from '../modules/dice/dice.dto.js';
const board=(userId:string):ActiveRollDto=>({userId,actorName:userId,avatarUrl:'',kind:'free',label:'',at:new Date().toISOString(),board:{pool:[{sides:20,locked:false}],bonus:0,advantage:false,disadvantage:false,phase:'idle'},lastRoll:null});
const boards=new PublicRollBoards();
boards.put(board('fixture-a'));boards.put(board('fixture-b'));
assert.equal(boards.all().length,2);
const roll={id:'fixture-roll',actorUserId:'fixture-a',isPrivate:false,kind:'free'} as DiceRollDto;
boards.remember(roll);assert.equal(boards.get('fixture-a')?.lastRoll?.id,roll.id);assert.equal(boards.get('fixture-b')?.lastRoll,null);
boards.remember({...roll,id:'private',isPrivate:true});boards.remember({...roll,id:'npc',audience:'masters'});boards.remember({...roll,id:'creation',kind:'creation'});
assert.equal(boards.get('fixture-a')?.lastRoll?.id,roll.id);
boards.remove('fixture-b');assert.equal(boards.all().length,1);assert.equal(boards.get('fixture-a')?.userId,'fixture-a');
// O service real é exercitado com leitura de identidade mockada e um URL
// deliberadamente inacessível. Uma chamada de banco acidental falharia.
process.env.DATABASE_URL='postgresql://fixture:fixture@127.0.0.1:1/fixture?schema=spectator_mock';
process.env.JWT_SECRET='fixture-espectador-sem-banco';process.env.NODE_ENV='test';
const { prisma }=await import('../config/prisma.js');
const { setBroadcaster }=await import('../realtime/hub.js');
const events:unknown[]=[];
setBroadcaster({toTable:(_event:unknown,payload:unknown)=>events.push(payload)} as never);
const find=prisma.character.findUnique;
prisma.character.findUnique=(async(args:{where:{userId:string}})=>({name:`Personagem ${args.where.userId}`,avatarUrl:'/fixture.png'})) as unknown as typeof find;
try{
 const {setActiveRoll,getActiveRolls,markRollTumbling,clearActiveRollFrom}=await import('../modules/dice/dice.service.js');
 const a={userId:'fixture-a',username:'a',displayName:'Conta A',role:'PLAYER' as const};
 const b={userId:'fixture-b',username:'b',displayName:'Conta B',role:'PLAYER' as const};
 await setActiveRoll(a,{active:true,kind:'free',pool:[{sides:20,locked:false}]});
 await setActiveRoll(b,{active:true,kind:'free',pool:[{sides:6,locked:false}]});
 assert.equal(getActiveRolls().length,2);
 assert.equal(getActiveRolls().find(x=>x.userId===a.userId)?.actorName,'Personagem fixture-a');
 markRollTumbling(a);assert.equal(getActiveRolls().find(x=>x.userId===a.userId)?.board.phase,'tumbling');assert.equal(getActiveRolls().find(x=>x.userId===b.userId)?.board.phase,'idle');
 await setActiveRoll({...a,role:'MASTER'},{active:true,private:true});
 assert.deepEqual(getActiveRolls().map(x=>x.userId),[b.userId]);
 await setActiveRoll(a,{active:true,private:true});assert.equal(getActiveRolls().length,2,'Jogador não transforma rolagem em privada pelo corpo do pedido.');
 clearActiveRollFrom(b.userId);assert.equal(getActiveRolls().length,1);clearActiveRollFrom(a.userId);assert.equal(getActiveRolls().length,0);
 assert.ok(events.length>=6);
 console.log('✔ Bandejas simultâneas, identidade do servidor, privacidade e encerramento por participante. Nenhuma conexão de banco.');
}finally{prisma.character.findUnique=find;await prisma.$disconnect();}
