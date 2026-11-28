import { api } from '../../api';
import type { CombatDto, CreatureAbility } from '../../types';
import type { CreatureAreaPlacement } from '../../../../src/modules/shared/creature-abilities';
import type { AreaQueryResult } from './areaQueryApi';
export interface BreathOptions {
  combatId: string; combatVersion: number; characterVersion: number;
  combatantId: string; definition: CreatureAbility; remaining: number; canUse: boolean;
}
export function fetchBreathOptions(combatId: string) {
  return api<BreathOptions>(`/api/characters/me/breath-weapon/options?combatId=${encodeURIComponent(combatId)}`);
}
export function queryBreathArea(combatId: string, placement: CreatureAreaPlacement) {
  return api<AreaQueryResult>('/api/characters/me/breath-weapon/preview', { method: 'POST', body: { combatId, placement } });
}
export function executeBreath(input: {
  combatId: string; expectedVersion: number; expectedCombatVersion: number;
  placement: Omit<CreatureAreaPlacement, 'selectedTargetKeys'>; operationId: string;
}) {
  return api<{ combat: CombatDto; areaUseId: string; replayed: boolean }>('/api/characters/me/breath-weapon/use', { method: 'POST', body: input });
}
