/** Contrato puro do rascunho: sem banco, itens, moedas ou rolagens. */
import assert from 'node:assert/strict';
import { CREATION_STEPS, EMPTY_CREATION_DRAFT, normalizeCreationDraft } from '../modules/shared/creation.js';
import { normalizeEquipmentMethod, STARTING_EQUIPMENT_METHODS } from '../modules/shared/starting-equipment.js';
import { creationStepSchema } from '../modules/characters/characters.schema.js';
assert.equal(CREATION_STEPS.length, 10);
assert.equal(CREATION_STEPS[7].id, 'equipment'); assert.equal(CREATION_STEPS[8].id, 'level'); assert.equal(CREATION_STEPS[9].id, 'review');
assert.equal(normalizeCreationDraft({ step: 8 }).step, 9);
assert.equal(normalizeCreationDraft({ step: 9 }).step, 10);
assert.equal(normalizeCreationDraft({ step: 7 }).step, 7);
for (const equipmentMethod of STARTING_EQUIPMENT_METHODS) {
  const normalized = normalizeCreationDraft({ ...EMPTY_CREATION_DRAFT, step: 8, equipmentMethod });
  assert.equal(normalized.step, 8); assert.equal(normalized.equipmentMethod, equipmentMethod);
  assert.deepEqual(normalizeCreationDraft(normalized), normalized);
  assert.ok(creationStepSchema.safeParse({ step: 8, equipmentMethod }).success);
}
assert.equal(normalizeEquipmentMethod('inválido'), null);
assert.equal(creationStepSchema.safeParse({ step: 8, equipmentMethod: 'inválido' }).success, false);
assert.ok(creationStepSchema.safeParse({ step: 10 }).success);
console.log('Equipamentos: dez etapas, três opções, validação, retomada legada e normalização idempotente aprovadas.');
