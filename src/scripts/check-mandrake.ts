/** Conteúdo e recursos raciais puros: nenhum banco ou personagem real. */
import assert from 'node:assert/strict';
import { getRace, raceFixedAbilityBonuses, raceSpeed, raceDarkvision, raceLanguages, raceDamageResistances, raceSkillProficiencies, raceSpells } from '../modules/shared/races/index.js';
import { racialResourceDefinitions, racialResources, restoreRacialResourcesForRest } from '../modules/shared/races/resources.js';
import { RACE_CATALOG } from '../modules/shared/creation.js';
const cases = [
  ['mandrake-spring', 'dexterity', 10.5, 'Elétrico'],
  ['mandrake-summer', 'strength', 9, 'Fogo'],
  ['mandrake-autumn', 'charisma', 9, 'Veneno'],
  ['mandrake-winter', 'constitution', 9, 'Frio'],
] as const;
assert.equal(getRace('mandrake')?.size, 'Medium');
for (const [subraceId, ability, speed, damage] of cases) {
  const input = { raceId: 'mandrake', subraceId };
  assert.deepEqual(raceFixedAbilityBonuses(input), { wisdom: 2, [ability]: 1 });
  assert.equal(raceSpeed(input), speed);
  assert.equal(raceDarkvision(input), 0);
  assert.deepEqual(raceLanguages(input), ['Comum']);
  assert.deepEqual(raceDamageResistances(input), [damage]);
  assert.deepEqual(raceSkillProficiencies(input), []); // Furtividade é condicional, não global.
  const initial = raceSpells(input, 1);
  assert.deepEqual(initial.map(spell => spell.key), subraceId === 'mandrake-autumn' ? ['shillelagh', 'goodberry'] : ['shillelagh']);
  assert.ok(initial.every(spell => spell.ability === 'wisdom'));
  assert.deepEqual(raceSpells(input, 3).map(spell => spell.key), ['shillelagh', 'goodberry']);
  assert.deepEqual(raceSpells(input, 5).map(spell => spell.key), ['shillelagh', 'goodberry', 'barkskin']);
  const definitions = racialResourceDefinitions(input, 5);
  assert.equal(definitions.length, 2);
  assert.equal(new Set(definitions.map(resource => resource.id)).size, 2);
  assert.ok(definitions.every(resource => resource.max === 1 && resource.recharge === 'long'));
  const state = { used: { 'mandrake-goodberry': 1, 'mandrake-barkskin': 1 } };
  const resources = racialResources(input, state, 5);
  assert.deepEqual(restoreRacialResourcesForRest(state, resources, 'short'), state);
  assert.deepEqual(restoreRacialResourcesForRest(state, resources, 'long'), { used: {} });
  assert.equal(racialResourceDefinitions(input, 1).length, subraceId === 'mandrake-autumn' ? 1 : 0);
}
assert.equal(RACE_CATALOG.filter(option => option.raceId === 'mandrake').length, 5);
assert.equal(new Set(RACE_CATALOG.map(option => option.key)).size, RACE_CATALOG.length);
console.log('Mandrágora: quatro estações, bônus, deslocamento, resistências, idiomas, magias 1/3/5 e usos por descanso verificados sem banco.');
