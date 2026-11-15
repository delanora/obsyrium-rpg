import { prisma } from '../../config/prisma.js';
import { deriveConditionEffects, deriveSaveEffects, dodgeBenefitAvailable, effectiveSpeed, resolveRollMode, type MechanicalEntity } from '../shared/conditions.js';
import { economyOf } from '../shared/action-economy.js';
import type { AbilityKey } from '../shared/dnd5e.js';
import type { EffectRollModifiers } from '../effects/effect-modifiers.js';
import type { DiceRollKind } from './dice.dto.js';

/**
 * Esquiva ATIVA e VÁLIDA do autor da rolagem, para a salvaguarda de Destreza.
 *
 * `dodging` mora no estado de TURNO do combatente (`Combatant.turnEconomy`),
 * não no `MechanicalState` da ficha — por isso a busca acontece aqui, e não
 * dentro de `deriveSaveEffects`. O deslocamento usado é o MESMO do combate —
 * `effectiveSpeed(base, estado, bônus de efeito)` —, nunca o movimento restante:
 * um `speed-flat` que zere a velocidade invalida a Esquiva, e gastar o
 * movimento do turno NÃO invalida.
 *
 * Fora de combate não existe turno: sem combatente ativo, não há Esquiva.
 */

export async function dodgeBenefitForSave(
  entity: MechanicalEntity | null,
  /** Soma dos `speed-flat` dos EFEITOS ativos (6.5B) — já resolvida em lote. */
  effectSpeedBonus = 0,
): Promise<boolean> {
  if (!entity || entity.kind === 'creature') return false;
  const combatant = await prisma.combatant.findFirst({
    where: {
      ...(entity.kind === 'combatant' ? { id: entity.id } : { characterId: entity.id }),
      combat: { status: { in: ['PENDING_INITIATIVE', 'ACTIVE'] } },
    },
    include: {
      character: { select: { speed: true, mechanicalState: true } },
      creature: { select: { speed: true } },
    },
  });
  if (!combatant) return false;
  // Personagem usa o estado CANÔNICO da ficha; a instância usa o próprio.
  const mechanical = combatant.character?.mechanicalState ?? combatant.mechanicalState;
  const baseSpeed = Math.max(0, combatant.character?.speed ?? combatant.creature?.speed ?? 0);
  return dodgeBenefitAvailable({
    dodging: economyOf(combatant.turnEconomy).dodging,
    mechanicalState: mechanical,
    effectiveSpeed: effectiveSpeed(baseSpeed, mechanical, effectSpeedBonus),
  });
}

/** A mesma derivação atende a prévia de apresentação e a rolagem efetiva. */
export function tableRollMode(kind: DiceRollKind, ability: AbilityKey | undefined, state: unknown, mods: EffectRollModifiers, dodge: boolean, advantage = false, disadvantage = false) {
  const effects = deriveConditionEffects(state);
  const advantages = advantage ? ['manual'] : [];
  const disadvantages = disadvantage ? ['manual'] : [];
  return kind === 'save' && ability
    ? deriveSaveEffects(state, ability, advantages, disadvantages, { dodge, effects: { advantage: mods.advantage, disadvantage: mods.disadvantage } })
    : { autoFail: false, ...resolveRollMode([...advantages, ...mods.advantage], [...disadvantages, ...mods.disadvantage,
      ...(kind === 'skill' && effects.checkDisadvantage || kind === 'save' && effects.saveDisadvantage ? ['conditions'] : [])]) };
}
