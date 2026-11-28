import { api } from './api';
import { newId } from './utils';
import type { Character, EffectDto } from './types';
export interface BardicInspirationOptions {
  characterVersion: number; combatId: string | null; combatVersion: number | null;
  sides: number; remaining: number; max: number; canUse: boolean;
  targets: { id: string; name: string; version: number; reason: string | null }[];
}
export const fetchBardicInspirationOptions = () => api<BardicInspirationOptions>('/api/characters/me/features/bardic-inspiration/options');
export function grantBardicInspiration(options: BardicInspirationOptions, target: BardicInspirationOptions['targets'][number]) {
  if (!options.combatId || options.combatVersion === null) throw new Error('A concessão sem grid continua assistida pelo Mestre.');
  return api<{ character: Character; effect: EffectDto; remaining: number }>('/api/characters/me/features/bardic-inspiration/grant', {
    method: 'POST', body: { targetCharacterId: target.id, combatId: options.combatId, expectedVersion: options.characterVersion,
      expectedTargetVersion: target.version, expectedCombatVersion: options.combatVersion, operationId: newId() },
  });
}
