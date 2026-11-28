import { randomUUID } from 'node:crypto';
import { HttpError } from '../../lib/http-error.js';
import { afflictionSchema, deriveConditionEffects, type Condition, type MechanicalState, type Affliction } from '../shared/conditions.js';
import { applyConditionInstances, conditionBlockedReason, removeConditionInstancesBySource } from './condition-instances.js';

/** Origem explícita do Mestre; não reclassifica Conditions/Effects legados. */
export function registerAffliction(state: MechanicalState, input: { kind: Affliction['kind']; label: string; symptoms: readonly Condition[] }, actorId: string): Affliction {
  if ((state.afflictions?.length ?? 0) >= 50) throw new HttpError('Limite de afecções ativas atingido.', 409, 'AFFLICTION_LIMIT');
  const immunity = deriveConditionEffects(state);
  if ((input.kind === 'poison' && immunity.poisonImmune) || (input.kind === 'disease' && immunity.diseaseImmune)) throw new HttpError('O alvo está imune a esta afecção.', 409, 'AFFLICTION_IMMUNE');
  for (const symptom of input.symptoms) {
    const reason = conditionBlockedReason(state, symptom);
    if (reason) throw new HttpError(reason, 409, 'CONDITION_IMMUNE');
  }
  const origin = afflictionSchema.parse({ id: randomUUID(), kind: input.kind, label: input.label.trim(), appliedBy: actorId, appliedAt: new Date().toISOString() });
  const symptoms = [...new Set(input.symptoms)];
  applyConditionInstances(state, symptoms, { sourceType: 'affliction', sourceId: origin.id, sourceLabel: origin.label }, actorId);
  state.afflictions = [...(state.afflictions ?? []), origin];
  return origin;
}

/** Encerra somente a origem escolhida e os sintomas pertencentes a ela. */
export function removeAffliction(state: MechanicalState, id: string): Affliction {
  const origin = state.afflictions?.find(value => value.id === id);
  if (!origin) throw new HttpError('Afecção não encontrada; confira o estado atual.', 409, 'AFFLICTION_NOT_FOUND');
  state.afflictions = state.afflictions!.filter(value => value.id !== id);
  removeConditionInstancesBySource(state, 'affliction', [id]);
  return origin;
}
