/** Contratos e targeting reais, sem HTTP, banco ou dados da campanha. */
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { getSpell } from '../modules/shared/spells/index.js';
import { mechanicalStateOf } from '../modules/shared/conditions.js';
import { slotScaledDiceCount } from '../modules/shared/spells/slot-scaling.js';
import { emptyDeathState } from '../modules/shared/death.js';
import { CURE_WOUNDS_DEFINITION as definition } from '../modules/spells/execution/cure-wounds.js';
import { assertLivingHealingTargets } from '../modules/spells/execution/healing-targets.js';
import { assertHealingWordTargets } from '../modules/spells/execution/healing-word.js';
import { spellExecutionDefinition } from '../modules/spells/execution/spell-execution-registry.js';
import { targetingRangeFeet, maximumTargets, isExplicitTargeting } from '../modules/spells/execution/spell-targeting.js';
import { validateTargeting } from '../modules/spells/execution/spell-targeting.service.js';
import { gridSpatialProvider, type CombatSpatialIndex } from '../modules/combat/spatial/spatial-distance.service.js';
import type { LoadedEntity } from '../modules/mechanical/mechanical.service.js';

let checks = 0;
function check(label: string, value: unknown) { assert.ok(value, label); checks++; }
async function rejects(label: string, fn: () => Promise<unknown>, code: string) {
  await assert.rejects(fn, (e: any) => e.code === code || e.errorCode === code); checks++;
}
const spell = getSpell('cure-wounds');
check('catálogo 2014: ação, toque, V/S, instantânea', spell?.castingTimeKind === 'action' && spell.rangeKind === 'touch' && spell.components.verbal && spell.components.somatic && !spell.components.material && !spell.concentration);
check('registro central usa a definição real', spellExecutionDefinition('cure-wounds') === definition);
assert.ok(isExplicitTargeting(definition.targeting));
const targeting = definition.targeting;
check('toque é adjacência de 5 pés, não ilimitado', targetingRangeFeet(targeting) === 5);
check('sem visão obrigatória, com caminho livre e autoalvo', !targeting.requiresSight && targeting.requiresClearPath && targeting.allowSelf);
assert.equal(definition.resolution.kind, 'immediate-healing');
if (definition.resolution.kind !== 'immediate-healing') throw new Error('Padrão incorreto');
const healing = definition.resolution.healing;
check('d8 e modificador da fonte', healing.dice.sides === 8 && healing.abilityModifier === 'spellcasting');
for (let level = 1; level <= 9; level++) {
  check(`espaço ${level}: ${level}d8 e um alvo`, slotScaledDiceCount(healing.slotScaling, level) === level && maximumTargets(targeting, level) === 1);
}
check('constructos e mortos-vivos resolvem sem efeito, não são filtro de alvo', definition.resolution.noEffectOnCreatureTypes?.includes('construct') && definition.resolution.noEffectOnCreatureTypes.includes('undead') && targeting.filters.length === 0);
const entity = (id: string): LoadedEntity => ({ entity: { kind: 'character', id }, name: id, version: 0, ownerUserId: null, state: mechanicalStateOf(null), baseSpeed: 9, baseMaxHp: 20, hpCurrent: 1, combat: null });
const caster = entity('conjurador-fixture'), target = entity('alvo-fixture');
const index: CombatSpatialIndex = { combatId: 'combate-fixture', scene: { mode: 'grid-2d', widthFeet: 100, heightFeet: 100, cellSizeFeet: 5 }, obstacles: [], bodies: new Map([
  ['character:conjurador-fixture', { position: { xFeet: 0, yFeet: 0 }, size: 'medium' }],
  ['character:alvo-fixture', { position: { xFeet: 5, yFeet: 0 }, size: 'medium' }],
]) };
const db = {} as Prisma.TransactionClient;
const input = { db, targeting, caster, targets: [target], castAtLevel: 1, provider: gridSpatialProvider(index) };
const result = await validateTargeting(input);
check('adjacente medido pelo grid sem arbitragem', result.requiredConfirmations.length === 0);
const targetBody = index.bodies.get('character:alvo-fixture')!;
assert.ok(targetBody.position);
targetBody.position.xFeet = 10;
await rejects('distante não aceita confirmação que burle geometria', () => validateTargeting({ ...input, confirmation: { withinRange: true, clearPath: true } }), 'SPELL_TARGET_OUT_OF_RANGE');
await rejects('exatamente um alvo mesmo no upcast', () => validateTargeting({ ...input, targets: [target, caster], castAtLevel: 9 }), 'SPELL_TARGET_COUNT_INVALID');
await rejects('alvo obrigatório', () => validateTargeting({ ...input, targets: [] }), 'SPELL_TARGET_REQUIRED');
const assisted = await validateTargeting({ ...input, provider: undefined, deferUnknown: true });
check('fora do grid exige confirmar alcance e caminho', assisted.requiredConfirmations.includes('range') && assisted.requiredConfirmations.includes('clearPath'));
await validateTargeting({ ...input, provider: undefined, confirmation: { withinRange: true, clearPath: true } }); checks++;
let dead = false;
const fakeDb = { character: { findUnique: async () => ({ deathState: { ...emptyDeathState(), dead } }) } } as unknown as Prisma.TransactionClient;
await assertLivingHealingTargets({ db: fakeDb, targets: [target] }, 'Curar Ferimentos'); checks++;
dead = true;
await rejects('morto recusado antes do commit', () => assertLivingHealingTargets({ db: fakeDb, targets: [target] }, 'Curar Ferimentos'), 'SPELL_TARGET_DEAD');
// O wrapper antigo permanece com o mesmo comportamento e mensagem própria.
await assert.rejects(() => assertHealingWordTargets({ db: fakeDb, targets: [target] } as any), /Palavra Curativa/); checks++;
console.log(`${checks} verificações de Curar Ferimentos e Toque, sem banco/HTTP/rolagens da campanha.`);
