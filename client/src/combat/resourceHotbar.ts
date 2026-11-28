import type { Character, CombatantDto } from '../types';
import type { CombatHotbarEntry } from './hotbar';

export type ExecutableResourceId = 'second-wind' | 'action-surge' | 'breath-weapon';
/** Apresentação apenas: posse, saldo e efeitos são revalidados pelo executor. */
export function resourceHotbarEntries(character: Character | null | undefined, own: CombatantDto | null, ownTurn: boolean): CombatHotbarEntry[] {
  if (!character) return [];
  const definitions = [
    { id: 'second-wind', label: 'Retomar o Fôlego', cost: 'bonus-action', icon: 'heart' },
    { id: 'action-surge', label: 'Surto de Ação', cost: 'other', icon: 'sword' },
    { id: 'breath-weapon', label: 'Arma de Sopro', cost: 'action', icon: 'flame' },
  ] as const;
  return definitions.flatMap(def => {
    const resource = (def.id === 'breath-weapon' ? character.racialAdjustments.resources : character.classAdjustments.resources).find(r => r.id === def.id);
    if (!resource) return [];
    const usedSurge = (own?.turnEconomy as { actionSurgeUsed?: boolean } | undefined)?.actionSurgeUsed;
    const economy = own?.turnEconomy;
    const costBlocked = def.cost === 'action' ? !!economy && economy.actionsUsed >= economy.actionsGranted : def.cost === 'bonus-action' && !!economy?.bonusActionUsed;
    const disabledReason = !ownTurn ? 'Aguarde seu turno.' : character.hpCurrent <= 0 || character.conditionEffects.incapacitated ? 'O personagem não pode agir.' : costBlocked ? 'Economia necessária já utilizada neste turno.' : resource.remaining <= 0 ? 'Sem usos; recupera no descanso.' : def.id === 'action-surge' && usedSurge ? 'Surto de Ação já usado neste turno.' : undefined;
    return [{ id: `feature:${def.id}`, kind: 'feature' as const, sourceId: def.id, label: def.label,
      detail: `${resource.remaining}/${resource.max} usos`, cost: def.cost, icon: def.icon, disabledReason }];
  });
}

/** Despacha somente para os executores existentes; não calcula efeito ou custo. */
export async function executeHotbarResource(id: string, version: number, combatId: string) {
  if (id === 'second-wind') return { character: (await (await import('../featuresApi')).useSecondWind(version)).character };
  if (id === 'action-surge') return { character: (await (await import('../featuresApi')).useActionSurge(version)).character };
  if (id === 'breath-weapon') {
    const options = await (await import('./grid/breathWeaponApi')).fetchBreathOptions(combatId);
    if (!options.canUse) throw new Error('Arma de Sopro indisponível neste turno.');
    return { breath: options };
  }
  throw new Error('Recurso sem executor na Hotbar.');
}
