/** Parâmetros raciais PHB 2014: nenhuma consulta ou escrita em banco. */
import assert from 'node:assert/strict';
import { dragonbornBreath } from '../modules/shared/races/dragonborn-breath.js';
import { proficiencyBonus } from '../modules/shared/dnd5e.js';
const expected = [
 ['black','Ácido','line','dexterity'],['blue','Elétrico','line','dexterity'],
 ['brass','Fogo','line','dexterity'],['bronze','Elétrico','line','dexterity'],
 ['copper','Ácido','line','dexterity'],['gold','Fogo','cone','dexterity'],
 ['green','Veneno','cone','constitution'],['red','Fogo','cone','dexterity'],
 ['silver','Frio','cone','constitution'],['white','Frio','cone','constitution'],
];
let checks=0;
for(const [ancestry,type,shape,save] of expected)for(const [level,dice] of [[1,2],[5,2],[6,3],[10,3],[11,4],[15,4],[16,5],[20,5]]){
 const definition=dragonbornBreath({raceId:'dragonborn',customRaceId:null,raceChoices:{'draconic-ancestry':ancestry},constitution:16,classes:[{classKey:'fighter',level}]});
 assert.ok(definition?.area);const area=definition.area;
 assert.equal(area.damage[0].type,type);assert.equal(area.shape.kind,shape);assert.equal(area.saveAbility,save);
 assert.equal(area.damage[0].dice.count,dice);assert.equal(area.damage[0].dice.sides,6);
 assert.equal(area.dc,8+3+proficiencyBonus(level));assert.equal(area.onSuccess,'half');
 if(area.shape.kind==='line'){assert.equal(area.shape.lengthFeet,30);assert.equal(area.shape.widthFeet,5);}
 else if(area.shape.kind==='cone')assert.equal(area.shape.lengthFeet,15);
 checks++;
}
const base={raceId:'dragonborn',customRaceId:null,raceChoices:{'draconic-ancestry':'red'},constitution:12,classes:[{classKey:'fighter',level:3},{classKey:'cleric',level:3}]};
assert.equal(dragonbornBreath(base)?.area?.damage[0].dice.count,3);checks++;
for(const variant of [{...base,raceId:'human'},{...base,customRaceId:'personalizada'},{...base,raceChoices:{}},{...base,raceChoices:{'draconic-ancestry':'invalid'}}]){assert.equal(dragonbornBreath(variant),null);checks++;}
console.log(`${checks} casos de ancestralidade, CD e escalonamento de Arma de Sopro aprovados.`);
