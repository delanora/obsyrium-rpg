/** Associação das artes ao catálogo real, sem API ou banco. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { BACKGROUND_CATALOG } from '../../src/modules/shared/creation';
import { BACKGROUND_EMBLEMS } from '../src/components/creation/BackgroundEmblem';
assert.equal(BACKGROUND_CATALOG.length, 13);
assert.equal(Object.keys(BACKGROUND_EMBLEMS).length, 13);
const assets = BACKGROUND_CATALOG.map(option => {
  const asset = BACKGROUND_EMBLEMS[option.key];
  assert.ok(asset, option.name);
  assert.ok(existsSync(`client/public/background-icons/${asset}.webp`), option.name);
  return asset;
});
assert.equal(new Set(assets).size, 13);
assert.equal(BACKGROUND_EMBLEMS.outlander, 'outlander');
assert.ok(existsSync('client/public/background-icons/outlander-alternativa.webp'));
console.log('13 antecedentes associados a artes distintas; alternativa do Forasteiro preservada.');
