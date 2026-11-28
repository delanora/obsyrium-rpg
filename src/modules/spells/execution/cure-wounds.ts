import type { SpellExecutionDefinition } from './spell-execution-definition.js';
import { assertLivingHealingTargets } from './healing-targets.js';

export const CURE_WOUNDS_SPELL_ID = 'cure-wounds';
export const CURE_WOUNDS_LABEL = 'Curar Ferimentos';

/** PHB 2014: toque, 1d8 + atributo da fonte; +1d8 por nível de espaço adicional. */
export const CURE_WOUNDS_DEFINITION: SpellExecutionDefinition = {
  spellId: CURE_WOUNDS_SPELL_ID,
  requiresConcentration: false,
  targeting: {
    kind: 'creatures',
    minTargets: 1,
    targetCount: { base: 1, baseSlotLevel: 1, additionalPerSlotLevel: 0 },
    range: { kind: 'touch' },
    allowSelf: true,
    // O texto exige tocar, não enxergar. Caminho livre continua obrigatório.
    requiresSight: false,
    requiresClearPath: true,
    filters: [],
    groupConstraints: [],
  },
  resolution: {
    kind: 'immediate-healing',
    healing: {
      dice: { count: 1, sides: 8 },
      abilityModifier: 'spellcasting',
      slotScaling: { baseSpellLevel: 1, baseDice: 1, dicePerLevelAboveBase: 1 },
    },
    // São alvos válidos, mas a conjuração resolve sem cura e mantém os custos.
    noEffectOnCreatureTypes: ['undead', 'construct'],
  },
  validateTargets: context => assertLivingHealingTargets(context, CURE_WOUNDS_LABEL),
};
