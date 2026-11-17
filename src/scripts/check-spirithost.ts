/** Catálogo, incremento escolhido e descanso: sem banco nem API. */
import assert from 'node:assert/strict';
import { RACE_CATALOG, racialAbilityBonuses, raceChoicePool } from '../modules/shared/creation.js';
import { getRace, raceAbilityBonuses, raceSpeed, raceDarkvision, raceLanguages } from '../modules/shared/races/index.js';
import { racialResourceDefinitions, racialResources, restoreRacialResourcesForRest } from '../modules/shared/races/resources.js';
const input = { raceId: 'spirithost' };
const option = RACE_CATALOG.find(option => option.key === 'spirithost');
assert.ok(option);
assert.equal(getRace('spirithost')?.subraces, undefined);
assert.equal(option.abilityChoice, 1);
assert.equal(option.abilityChoiceBonus, 2);
assert.equal(option.bonusLanguageChoices, 1);
assert.ok(!raceChoicePool(option).includes('dexterity'));
for (const ability of ['strength','constitution','intelligence','wisdom','charisma'] as const) {
  const expected = { dexterity: 1, [ability]: 2 };
  assert.deepEqual(racialAbilityBonuses('Spirithost', [ability]), expected);
  assert.deepEqual(raceAbilityBonuses({ ...input, choices: { 'spirithost-ability': ability } }), expected);
}
assert.deepEqual(raceAbilityBonuses({ ...input, choices: { 'spirithost-ability': 'dexterity' } }), { dexterity: 1 });
assert.deepEqual(racialAbilityBonuses('Meio-Elfo', ['strength', 'wisdom']), { charisma: 2, strength: 1, wisdom: 1 });
assert.equal(raceSpeed(input), 9);
assert.equal(raceDarkvision(input), 0); // Visão etérea não é visão no escuro.
assert.deepEqual(raceLanguages(input), ['Comum']);
const definitions = racialResourceDefinitions(input, 1);
assert.equal(definitions.length, 2);
const state = { used: { 'spirithost-spirit-speech': 1, 'spirithost-translucence': 1 } };
const resources = racialResources(input, state, 1);
assert.deepEqual(restoreRacialResourcesForRest(state, resources, 'short'), { used: { 'spirithost-spirit-speech': 1 } });
assert.deepEqual(restoreRacialResourcesForRest(state, resources, 'long'), { used: {} });
assert.equal(RACE_CATALOG.filter(option => option.raceId === 'spirithost').length, 1);
console.log('Spirithost: +2 em outro atributo, Meio-Elfo preservado, idiomas, recursos e descansos verificados sem banco.');
