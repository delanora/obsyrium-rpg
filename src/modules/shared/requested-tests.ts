import { z } from 'zod';
import { ABILITY_KEYS, ABILITY_LABELS, SKILLS, type AbilityKey } from './dnd5e.js';

export const REQUESTED_TEST_KINDS = ['skill', 'ability', 'save'] as const;
export type RequestedTestKind = typeof REQUESTED_TEST_KINDS[number];
export function requestedTestDefinition(kind: RequestedTestKind, key: string): { ability: AbilityKey; label: string } | null {
  if (kind === 'skill') {
    const skill = SKILLS.find(item => item.key === key);
    return skill ? { ability: skill.ability, label: skill.label } : null;
  }
  if (!(ABILITY_KEYS as readonly string[]).includes(key)) return null;
  const ability = key as AbilityKey;
  return { ability, label: `${kind === 'save' ? 'Salvaguarda de' : 'Teste de'} ${ABILITY_LABELS[ability]}` };
}
export const requestedTestSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  operationId: z.string().min(1).max(100),
  kind: z.enum(REQUESTED_TEST_KINDS),
  key: z.string().min(1).max(40),
  dc: z.number().int().min(0).max(100),
}).strict().refine(input => requestedTestDefinition(input.kind, input.key) !== null, { message: 'Teste inválido.', path: ['key'] });
