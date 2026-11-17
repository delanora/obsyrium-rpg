/** Validação pura do catálogo e do contrato de escolha, sem banco/HTTP. */
import assert from 'node:assert/strict';
import { featureChoiceInfo, resolveFeatureChoices } from '../modules/shared/classes/index.js';
import { sorcerer } from '../modules/shared/classes/sorcerer.js';
const options = featureChoiceInfo(sorcerer, {}, 'Linhagem Dracônica', {}, 1).find(info => info.featureId === 'dragon-ancestor');
assert.ok(options); assert.equal(options.count, 1); assert.equal(options.options.length, 10);
for (const option of options.options) {
  const resolved = resolveFeatureChoices(sorcerer, 1, { 'dragon-ancestor': [option.key] }, {}, 'Linhagem Dracônica');
  assert.deepEqual(resolved['dragon-ancestor'], [option.key]);
  assert.deepEqual(featureChoiceInfo(sorcerer, resolved, 'Linhagem Dracônica', {}, 1).find(info => info.featureId === 'dragon-ancestor')?.chosen, [option.key]);
}
assert.throws(() => resolveFeatureChoices(sorcerer, 1, { 'dragon-ancestor': ['inexistente'] }, {}, 'Linhagem Dracônica'));
assert.throws(() => resolveFeatureChoices(sorcerer, 1, { 'dragon-ancestor': ['red', 'blue'] }, {}, 'Linhagem Dracônica'));
assert.equal(featureChoiceInfo(sorcerer, {}, 'Magia Selvagem', {}, 1).some(info => info.featureId === 'dragon-ancestor'), false);
console.log('Feiticeiro: dez ancestrais válidos, escolha recuperável, opções inválidas recusadas e Magia Selvagem sem escolha dracônica.');
