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
 'characters/characters.service.js':'export const toSheetDto=async x=>x;export const createCharacter=()=>{throw Error("Não criar conta real")};export const levelUpDraft=()=>{};export const setCreationFinalized=()=>{};export const updateDraftSheet=(actor,patch,draft)=>globalThis.persistDraft(patch,draft);',
};
let character,operations=new Map();
const db={character:{findUnique:async()=>character,findUniqueOrThrow:async()=>character,updateMany:async({where,data})=>{if(where.version!==character.version)return{count:0};character={...character,...data,version:character.version+1};return{count:1};}},characterOperation:{findUnique:async({where})=>operations.get(where.characterId_operationId.operationId),create:async({data})=>operations.set(data.operationId,data)},$queryRaw:async()=>[]};
globalThis.persistDraft=(patch,draft)=>{character={...character,...patch,creationDraft:draft};};
globalThis.creationDb={...db,$transaction:async callback=>callback(db)};globalThis.diceCalls=0;globalThis.nextDice=[6,5,4,1];
try{
 await build({stdin:{contents:"export {rollCreationAttribute,saveCreationStep} from './src/modules/characters/creation.service.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:join(directory,'service.mjs'),plugins:[{name:'adaptadores-isolados',setup(build){build.onResolve({filter:/\.js$/},args=>{const key=Object.keys(adapters).find(key=>resolve(args.resolveDir,args.path).endsWith(key));return key?{path:key,namespace:'fixture'}:undefined;});build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:adapters[args.path],loader:'js'}));}}]});
 const {rollCreationAttribute,saveCreationStep}=await import(pathToFileURL(join(directory,'service.mjs')));
 const good={dice:[6,5,4,1],dropped:3},low={dice:[2,2,2,1],dropped:3};
 character={name:'Fixture',race:'',background:'',strength:10,dexterity:10,constitution:10,intelligence:10,wisdom:10,charisma:10,id:'fixture',userId:'fixture',version:1,creationFinalized:false,creationDraft:{mode:'new',step:6,rolls:[low,good,good,good,good,good],baseAbilities:{strength:6}},classes:[],classState:{},raceChoices:{},features:[],skills:{},proficiencies:{},raceId:null,subraceId:null,customRaceId:null};
 const actor={userId:'fixture',username:'fixture',displayName:'Fixture',role:'PLAYER'};
 const original=structuredClone(character);
 for(const equipmentMethod of ['class-background','purchase','master']){
  const result=await saveCreationStep(actor,{step:8,equipmentMethod});
  assert.equal(character.creationDraft.equipmentMethod,equipmentMethod);
  assert.equal(result.creation.equipmentMethod,equipmentMethod);
  assert.equal(character.creationDraft.step,9);
 }
 const {creationDraft:beforeDraft,...before}=original;
 const {creationDraft:afterDraft,...after}=character;
 assert.deepEqual(after,before);
 await assert.rejects(()=>saveCreationStep(actor,{step:8}),/Escolha como obter/);
 console.log('Serviço de equipamentos: três preferências persistidas/retomadas, nenhum outro campo alterado; opção vazia recusada. Adaptadores em memória, sem banco.');
}finally{rmSync(directory,{recursive:true,force:true});}
