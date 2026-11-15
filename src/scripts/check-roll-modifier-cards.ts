/** Verifica apresentação e privacidade sem consultar ou modificar dados da mesa. */
import assert from 'node:assert/strict';
import { describeRollModifiers } from '../modules/dice/roll-modifier-view.js';
import { emptyRollModifiers } from '../modules/effects/effect-modifiers.js';
const mods = emptyRollModifiers();
mods.bonus = 2;
mods.contributions = [
  { id: 'interno', kind: 'roll-flat', value: 2, source: { effectId: 'secreto', label: 'Segredo do Mestre', visibility: 'private' } },
  { id: 'bencao', kind: 'roll-dice', count: 1, sides: 4, sign: 1, source: { effectId: 'bencao', label: 'Bênção', visibility: 'public' } },
  { id: 'vantagem', kind: 'roll-advantage', source: { effectId: 'aprimorar', label: 'Aprimorar habilidade', visibility: 'public' } },
];
mods.optional = [{ id: 'opcional', effectId: 'efeito', kind: 'roll-flat', roll: 'check', value: 3, label: 'Inspiração', visibility: 'public', stackingKey: null }];
const context = { kind: 'skill', baseBonus: -1, mods, state: {}, mode: { advantage: true, disadvantage: false, autoFail: false } };
const preview = await describeRollModifiers({ ...context, includeOptions: true, selected: ['opcional'] });
assert.equal(preview.bonus, 4, 'Parcelas fixas entram uma única vez; dados adicionais não são bônus fixo.');
assert.equal(preview.cards[1].label, 'Efeito');
assert.ok(preview.cards.some(card => card.kind === 'dice' && card.label === 'Bênção'));
assert.ok(preview.cards.some(card => card.optionId === 'opcional' && card.applied));
const result = await describeRollModifiers({ ...context, selected: ['opcional'] });
assert.equal(result.bonus, preview.bonus);
assert.ok(!JSON.stringify(result).includes('Segredo'));
assert.ok(!JSON.stringify(result).includes('secreto'));
assert.ok(result.cards.every(card => !card.optionId));
const cancelled = await describeRollModifiers({ ...context, manualDisadvantage: true, mode: { advantage: false, disadvantage: false, autoFail: false } });
assert.ok(cancelled.cards.filter(card => ['advantage', 'disadvantage'].includes(card.kind)).every(card => !card.applied));
const failed = await describeRollModifiers({ ...context, mode: { advantage: false, disadvantage: false, autoFail: true } });
assert.ok(failed.cards.some(card => card.kind === 'failure' && card.applied));
console.log('Cards: bônus, dados, opcionais, cancelamento e privacidade verificados.');
