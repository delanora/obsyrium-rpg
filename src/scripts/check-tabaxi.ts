/** Catálogo e resolvedores puros; não conecta ao banco nem à mesa. */
import assert from 'node:assert/strict';
import { RACE_CATALOG } from '../modules/shared/creation.js';
import { getRace, raceFixedAbilityBonuses, raceSkillProficiencies, raceSpeed, raceDarkvision, raceLanguages, raceTraits } from '../modules/shared/races/index.js';
const base = getRace('tabaxi');
assert.ok(base);
assert.equal(base.subraces?.length, 4);
assert.equal(base.bonusLanguageChoices, 2);
const cases = [['tabaxi-panther', 'charisma'], ['tabaxi-lion', 'strength'], ['tabaxi-leopard', 'wisdom'], ['tabaxi-tiger', 'constitution']] as const;
for (const [subraceId, ability] of cases) {
  const input = { raceId: 'tabaxi', subraceId };
  assert.equal(raceFixedAbilityBonuses(input).dexterity, 2);
  assert.equal(raceFixedAbilityBonuses(input)[ability], 1);
  assert.deepEqual(raceSkillProficiencies(input).sort(), ['stealth', 'survival']);
  assert.equal(raceSpeed(input), 9);
  assert.equal(raceDarkvision(input), 18);
  assert.deepEqual(raceLanguages(input), ['Silvestre']);
  const option = RACE_CATALOG.find(option => option.key === `tabaxi:${subraceId}`);
  assert.ok(option);
  assert.equal(option.bonusLanguageChoices, 2);
  assert.equal(option.traits?.length, raceTraits(input).length);
  assert.match(option.name, /Tabaxi/);
}
assert.equal(RACE_CATALOG.filter(option => option.raceId === 'tabaxi').length, 5);
assert.equal(new Set(RACE_CATALOG.map(option => option.key)).size, RACE_CATALOG.length);
// O crítico do Tigre é descritivo: não amplia o crítico de todas as armas.
assert.ok(raceTraits({ raceId: 'tabaxi', subraceId: 'tabaxi-tiger' }).every(trait => trait.mechanicalEffect?.type !== 'critThreshold'));
assert.ok(getRace('elf'));
console.log('Tabaxi: quatro linhagens, bônus, idiomas, perícias e projeção de criação verificados sem banco.');
