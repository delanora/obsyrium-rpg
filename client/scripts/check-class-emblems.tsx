import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { classEmblemAsset } from '../src/components/creation/ClassEmblem';
import { CLASS_PRESENTATIONS } from '../src/components/creation/classPresentation';

const assets = new Set<string>();
let bases = 0, subclasses = 0;
for (const definition of CLASS_PRESENTATIONS) {
  const base = classEmblemAsset(definition.key);
  if (base) { bases++; assets.add(base); }
  for (const subclass of definition.subclasses) {
    const asset = classEmblemAsset(definition.key, subclass.name);
    if (asset) { subclasses++; assets.add(asset); }
  }
}
assert.equal(bases, 10);
assert.equal(subclasses, 29);
assert.equal(assets.size, 39);
for (const asset of assets) assert.ok(existsSync(resolve('client/public', asset.slice(1))), asset);
assert.equal(classEmblemAsset('cleric', 'Domínio do Engano'), '/class-icons/clerigo_dominio_da_trapaca.webp');
assert.equal(classEmblemAsset('bard', 'Colégio do Conhecimento'), '/class-icons/bardo_colegio_do_saber.webp');
assert.equal(classEmblemAsset('warlock', 'O Corruptor'), '/class-icons/bruxo_infero.webp');
assert.equal(classEmblemAsset('warlock', 'O Grande Antigo'), '/class-icons/bruxo_corruptor.webp');
assert.equal(classEmblemAsset('wizard'), undefined);
console.log('39 artes associadas sem duplicação: dez classes, vinte e nove subclasses, aliases e fallback verificados.');
