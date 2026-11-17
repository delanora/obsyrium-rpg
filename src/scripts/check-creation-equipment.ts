/** Regras puras: todas as classes/antecedentes e preços são derivados no servidor. */
import assert from 'node:assert/strict';
import {
  EQUIPMENT_PRODUCTS,
  equipmentConfiguration,
  equipmentProduct,
  resolveEquipmentPlan,
  STARTING_WEALTH,
  type EquipmentDraft,
} from '../modules/shared/creation-equipment.js';
import { allBackgrounds } from '../modules/shared/backgrounds/index.js';
for (const product of EQUIPMENT_PRODUCTS) {
  assert.ok(Number.isFinite(product.weight) && product.weight >= 0, product.id);
  if (product.priceCp !== null)
    assert.ok(Number.isSafeInteger(product.priceCp) && product.priceCp >= 0, product.id);
  for (const part of product.contents ?? []) assert.ok(equipmentProduct(part.id), part.id);
}
let cases = 0;
for (const classKey of Object.keys(STARTING_WEALTH))
  for (const background of allBackgrounds()) {
    const config = equipmentConfiguration(classKey, background.id, {
      armor: ['Armaduras pesadas'],
      weapons: ['Armas marciais'],
    });
    const selections: Record<string, string> = {};
    for (const group of config.groups) {
      assert.ok(group.options.length);
      for (const option of group.options) {
        for (const grant of option.grants) assert.ok(equipmentProduct(grant.id), grant.id);
        for (const slot of option.slots) {
          assert.ok(slot.ids.length);
          for (const id of slot.ids) assert.ok(equipmentProduct(id), id);
        }
      }
      const option = group.options[0];
      selections[group.id] = option.id;
      option.slots.forEach((slot, index) => {
        selections[`${group.id}:${option.id}:${index}`] = slot.ids[0];
      });
    }
    const plan = resolveEquipmentPlan(
      'class-background',
      classKey,
      background.id,
      { selections, cart: [] },
      { armor: ['Armaduras pesadas'], weapons: ['Armas marciais'] },
    );
    assert.ok(plan.grants.length);
    assert.ok(plan.grants.every((row) => !equipmentProduct(row.id)?.contents));
    assert.equal(plan.remainingCp, config.gold * 100);
    cases++;
  }
const wealth = { classKey: 'sorcerer', dice: [4, 3, 2], gold: 90 };
const draft: EquipmentDraft = {
  selections: {},
  cart: [{ id: 'weapon:dagger', quantity: 2 }],
  wealth,
};
assert.equal(resolveEquipmentPlan('purchase', 'sorcerer', 'sage', draft).remainingCp, 8600);
assert.throws(() =>
  resolveEquipmentPlan('purchase', 'sorcerer', 'sage', {
    ...draft,
    cart: [{ id: 'weapon:dagger', quantity: -1 }],
  }),
);
assert.throws(
  () =>
    resolveEquipmentPlan('purchase', 'sorcerer', 'sage', {
      ...draft,
      cart: [{ id: 'gear:Livro de magias', quantity: 2 }],
    }),
  /excede/,
);
assert.throws(() => resolveEquipmentPlan('purchase', 'wizard', 'sage', draft), /riqueza/);
assert.throws(
  () =>
    resolveEquipmentPlan('purchase', 'sorcerer', 'sage', {
      ...draft,
      wealth: { ...wealth, gold: 9999 },
    }),
  /riqueza/,
);
assert.throws(() =>
  resolveEquipmentPlan('purchase', 'sorcerer', 'sage', {
    ...draft,
    cart: [
      { id: 'weapon:dagger', quantity: 1 },
      { id: 'weapon:dagger', quantity: 1 },
    ],
  }),
);
assert.throws(
  () => resolveEquipmentPlan('class-background', 'sorcerer', 'sage', { selections: {}, cart: [] }),
  /escolha/i,
);
assert.deepEqual(resolveEquipmentPlan('master', 'sorcerer', 'sage', draft), {
  grants: [],
  gold: 0,
  spent: 0,
  remainingCp: 0,
});
assert.equal(
  equipmentConfiguration('cleric', 'sage').groups[1].options.some((item) => item.id === 'chain'),
  false,
);
console.log(
  `${cases} combinações de classe/antecedente, pacotes expandidos, saldo, fraude, categorias e modo Mestre aprovados.`,
);
