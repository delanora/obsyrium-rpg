/** Serviço real com adaptadores em memória: nenhuma conexão HTTP ou de banco. */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const directory=mkdtempSync(join(tmpdir(),'creation-roll-check-'));
const adapters={
 'config/prisma.js':'export const prisma=globalThis.creationDb;',
 'dice/dice.service.js':'export const rollTableDice=async()=>{globalThis.diceCalls++;return {dice:globalThis.nextDice.map(value=>({value,sides:6}))};};',
 'game-config/game-config.service.js':'export const getGameConfig=async()=>({startingLevel:1});',
 'custom-races/custom-races.service.js':'export const listCustomRaceOptions=async()=>[];export const findCustomRace=async()=>null;export const toCustomRaceDto=x=>x;',
 'characters/characters.service.js':'export const toSheetDto=async x=>x;export const createCharacter=()=>{throw Error("Não criar conta real")};export const levelUpDraft=()=>{};export const setCreationFinalized=()=>{};export const updateDraftSheet=()=>{};',
};
let character,operations=new Map();
const db={character:{findUnique:async()=>character,findUniqueOrThrow:async()=>character,updateMany:async({where,data})=>{if(where.version!==character.version)return{count:0};character={...character,...data,version:character.version+1};return{count:1};}},characterOperation:{findUnique:async({where})=>operations.get(where.characterId_operationId.operationId),create:async({data})=>operations.set(data.operationId,data)},$queryRaw:async()=>[]};
globalThis.creationDb={...db,$transaction:async callback=>callback(db)};globalThis.diceCalls=0;globalThis.nextDice=[6,5,4,1];
try{
 await build({stdin:{contents:"export {rollCreationAttribute,saveCreationStep} from './src/modules/characters/creation.service.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:join(directory,'service.mjs'),plugins:[{name:'adaptadores-isolados',setup(build){build.onResolve({filter:/\.js$/},args=>{const key=Object.keys(adapters).find(key=>resolve(args.resolveDir,args.path).endsWith(key));return key?{path:key,namespace:'fixture'}:undefined;});build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:adapters[args.path],loader:'js'}));}}]});
 const {rollCreationAttribute,saveCreationStep}=await import(pathToFileURL(join(directory,'service.mjs')));
 const good={dice:[6,5,4,1],dropped:3},low={dice:[2,2,2,1],dropped:3};
 character={name:'Fixture',race:'',background:'',strength:10,dexterity:10,constitution:10,intelligence:10,wisdom:10,charisma:10,id:'fixture',userId:'fixture',version:1,creationFinalized:false,creationDraft:{mode:'new',step:6,rolls:[low,good,good,good,good,good],baseAbilities:{strength:6}},classes:[],classState:{},raceChoices:{},features:[],skills:{},proficiencies:{},raceId:null,subraceId:null,customRaceId:null};
 const actor={userId:'fixture',username:'fixture',displayName:'Fixture',role:'PLAYER'};
 const request={retryIndex:0,expectedVersion:1,operationId:'retry'};
 await assert.rejects(()=>saveCreationStep(actor,{step:6,baseAbilities:{strength:6,dexterity:15,constitution:15,intelligence:15,wisdom:15,charisma:15}}),/menores? que 8|menos que 8/);
 const before=JSON.stringify(character.creationDraft.rolls.slice(1));
 const result=await rollCreationAttribute(actor,request);assert.equal(result.roll.value,15);assert.equal(character.creationDraft.rolls.length,6);assert.equal(JSON.stringify(character.creationDraft.rolls.slice(1)),before);assert.deepEqual(character.creationDraft.baseAbilities,{});
 await rollCreationAttribute(actor,request);assert.equal(globalThis.diceCalls,1);
 await assert.rejects(()=>rollCreationAttribute(actor,{...request,retryIndex:1}),/Identificador/);
 await assert.rejects(()=>rollCreationAttribute(actor,{retryIndex:1,expectedVersion:2,operationId:'invalid'}),/menor que 8/);
 await assert.rejects(()=>rollCreationAttribute(actor,{restart:true,expectedVersion:1,operationId:'stale'}),/ficha mudou/);
 assert.equal(globalThis.diceCalls,1);
 character.creationDraft.rolls=[good];
 await rollCreationAttribute(actor,{expectedVersion:2,operationId:'append'});assert.equal(character.creationDraft.rolls.length,2);
 console.log('Criação: repetição só abaixo de 8, preservação dos demais valores, idempotência, conflito e inclusão verificados em memória.');
}finally{rmSync(directory,{recursive:true,force:true});}
