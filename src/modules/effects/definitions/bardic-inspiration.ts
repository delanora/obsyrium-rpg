import type { EffectDefinition } from './registry.js';

export const BARDIC_INSPIRATION_IDS = [
  'feature.bardic-inspiration.d6', 'feature.bardic-inspiration.d8',
  'feature.bardic-inspiration.d10', 'feature.bardic-inspiration.d12',
] as const;
/** O tier fica na identidade do efeito; ganhar níveis não altera o dado recebido. */
export function bardicInspirationDie(level: number): 6 | 8 | 10 | 12 {
  return level >= 15 ? 12 : level >= 10 ? 10 : level >= 5 ? 8 : 6;
}
export const BARDIC_INSPIRATION_DEFINITIONS: Record<string, EffectDefinition> = Object.fromEntries(
  [6, 8, 10, 12].map(sides => {
    const definitionId = `feature.bardic-inspiration.d${sides}`;
    return [definitionId, {
      definitionId, label: `Inspiração de Bardo · d${sides}`, requiresConcentration: false,
      maxTargets: 1, modifiers: () => [], conditions: () => [], turnTriggers: () => [],
    }];
  }),
);
