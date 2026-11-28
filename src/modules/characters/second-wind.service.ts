import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../lib/http-error.js';
import { rollDice } from '../shared/dice.js';
import { normalizeClassEntries, normalizeClassState } from '../shared/classes.js';
import { deathStateOf } from '../shared/death.js';
import { deriveConditionEffects } from '../shared/conditions.js';
import { loadEntity } from '../mechanical/mechanical.service.js';
import { resolveHealing } from '../combat/damage-resolution.js';
import { publishCharacter, refreshCombatForEffects } from '../combat/combat.service.js';
import { appendCombatJournal } from '../combat/combat-journal.js';
import { castingTurnContext, commitCastingEconomy } from '../spells/execution/spell-casting-economy.js';
import { effectModifierSetFor } from '../effects/effects.service.js';
import { characterClassAdjustments, toCharacterDto, type CharacterDto } from './characters.dto.js';
import { loadCatalogLookup } from './inventory-sync.js';
import { recordHealingRoll } from '../dice/dice.service.js';

export const secondWindSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  operationId: z.string().uuid(),
}).strict();
export type SecondWindInput = z.infer<typeof secondWindSchema>;
const TYPE = 'feature.second-wind';
const FINGERPRINT = JSON.stringify({ featureId: 'second-wind' });
export interface SecondWindResult {
  character: CharacterDto;
  roll: { dice: number; bonus: number; total: number };
  healed: number;
  remaining: number;
  replayed: boolean;
}
function replay(previous: { type: string; requestFingerprint: string; result: unknown }): SecondWindResult {
  if (previous.type !== TYPE || previous.requestFingerprint !== FINGERPRINT) {
    throw new HttpError('Esta chave já foi usada para outra operação.', 409, 'IDEMPOTENCY_KEY_REUSED');
  }
  return { ...(previous.result as SecondWindResult), replayed: true };
}

/** PHB 2014: cura própria 1d10 + nível de Guerreiro, uma vez por descanso curto/longo. */
export async function useSecondWind(actor: { userId: string; username: string }, input: SecondWindInput): Promise<SecondWindResult> {
  const owner = await prisma.character.findUnique({ where: { userId: actor.userId } });
  if (!owner) throw new HttpError('Esta ficha ainda não foi criada.', 404);
  const key = { characterId_operationId: { characterId: owner.id, operationId: input.operationId } };
  const previous = await prisma.characterOperation.findUnique({ where: key });
  if (previous) return replay(previous);
  const catalog = await loadCatalogLookup([owner.inventory]);
  let combatId: string | null = null;
  let result: SecondWindResult;
  try {
    result = await prisma.$transaction(async db => {
      const previous = await db.characterOperation.findUnique({ where: key });
      if (previous) return replay(previous);
      const character = await db.character.findUniqueOrThrow({ where: { id: owner.id } });
      if (character.version !== input.expectedVersion) throw new HttpError('A ficha mudou. Atualize antes de usar Retomar o Fôlego.', 409, 'CONFLICT');
      const level = normalizeClassEntries(character.classes).find(c => c.classKey === 'fighter')?.level ?? 0;
      const resource = characterClassAdjustments(character).resources.find(r => r.id === 'second-wind');
      if (!level || !resource) throw new HttpError('Retomar o Fôlego não está disponível nesta ficha.', 403, 'FEATURE_NOT_AVAILABLE');
      if (resource.remaining < 1) throw new HttpError('Retomar o Fôlego recupera no descanso curto ou longo.', 409, 'INSUFFICIENT_RESOURCE');
      const entity = { kind: 'character' as const, id: character.id };
      const loaded = await loadEntity(entity, db);
      if (deathStateOf(character.deathState).dead || loaded.hpCurrent <= 0 || deriveConditionEffects(loaded.state).incapacitated) {
        throw new HttpError('O personagem não pode usar Retomar o Fôlego neste estado.', 409, 'FEATURE_INCAPACITATED');
      }
      if (loaded.combat && loaded.combat.status !== 'ACTIVE') throw new HttpError('Aguarde o início dos turnos para usar a característica.', 409, 'COMBAT_NOT_READY');
      // Mesmo guard estrutural das ações de combate: estabiliza o turno antes
      // de tocar na economia ou ficha; encerrar/avançar turno não cruza o commit.
      if (loaded.combat) {
        const lockedCombat = await db.combat.updateMany({
          where: { id: loaded.combat.id, status: 'ACTIVE', version: loaded.combat.version },
          data: { version: { increment: 1 } },
        });
        if (lockedCombat.count !== 1) throw new HttpError('O combate mudou; tente novamente.', 409, 'CONFLICT');
      }
      const turn = await castingTurnContext(db, loaded);
      if (turn) {
        if (!turn.isCasterTurn) throw new HttpError('Aguarde seu turno.', 409, 'FEATURE_OUT_OF_TURN');
        // Só consome economia: não aplica a restrição de MAGIA de Ação Bônus.
        await commitCastingEconomy(db, turn, 'bonus-action');
        combatId = turn.combatId;
      }
      const state = normalizeClassState(character.classState);
      state.used[resource.id] = resource.used + 1;
      const locked = await db.character.updateMany({
        where: { id: character.id, version: input.expectedVersion },
        data: { classState: state as unknown as Prisma.InputJsonValue, version: { increment: 1 } },
      });
      if (locked.count !== 1) throw new HttpError('A ficha mudou; nenhum uso foi consumido.', 409, 'CONFLICT');
      // Rolagem exclusivamente após as guardas de versão, posse, saldo e economia.
      const rolled = rollDice('1d10');
      if (!rolled) throw new HttpError('Não foi possível rolar a cura.', 500);
      const total = rolled.total + level;
      const healed = await resolveHealing(db, {
        eventId: randomUUID(), source: { kind: 'feature', label: 'Retomar o Fôlego' },
        target: { kind: 'CHARACTER', id: character.id, character }, amount: total,
      });
      if (!healed) throw new HttpError('A ficha não está mais disponível.', 409, 'CONFLICT');
      if (turn) await appendCombatJournal({ combatId: turn.combatId, actorName: character.name, action: TYPE,
        message: `Retomar o Fôlego — ${healed.finalHealing} PV restaurados (1d10 + ${level}: ${total}).` }, db);
      const fresh = await db.character.findUniqueOrThrow({ where: { id: character.id } });
      const effects = await effectModifierSetFor(entity, db);
      const snapshot: SecondWindResult = {
        character: toCharacterDto(fresh, actor.username, catalog, effects),
        roll: { dice: rolled.total, bonus: level, total }, healed: healed.finalHealing,
        remaining: resource.remaining - 1, replayed: false,
      };
      await db.characterOperation.create({ data: { characterId: character.id, operationId: input.operationId,
        type: TYPE, requestFingerprint: FINGERPRINT, result: snapshot as unknown as Prisma.InputJsonValue } });
      return snapshot;
    });
  } catch (error) {
    // Um pedido idêntico concorrente pode ter confirmado enquanto este aguardava o CAS.
    const previous = await prisma.characterOperation.findUnique({ where: key });
    if (previous) return replay(previous);
    if (['P2034', 'P2002'].includes((error as { code?: string }).code ?? '')) {
      throw new HttpError('Uma operação concorrente mudou a ficha; tente novamente.', 409, 'CONFLICT');
    }
    throw error;
  }
  if (!result.replayed) {
    try {
      await publishCharacter(owner.id);
      if (combatId) await refreshCombatForEffects();
      recordHealingRoll(actor, owner.name, 'Retomar o Fôlego', { rolls: [result.roll.dice], sides: 10, bonus: result.roll.bonus, total: result.roll.total });
    } catch (error) { console.error('[Retomar o Fôlego] falha ao notificar operação já confirmada:', error); }
  }
  return result;
}
