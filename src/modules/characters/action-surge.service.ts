import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../lib/http-error.js';
import { normalizeClassState } from '../shared/classes.js';
import { deathStateOf } from '../shared/death.js';
import { deriveConditionEffects } from '../shared/conditions.js';
import { economyOf, grantActionSurge } from '../shared/action-economy.js';
import { loadEntity } from '../mechanical/mechanical.service.js';
import { publishCharacter, refreshCombatForEffects } from '../combat/combat.service.js';
import { appendCombatJournal } from '../combat/combat-journal.js';
import { castingTurnContext } from '../spells/execution/spell-casting-economy.js';
import { effectModifierSetFor } from '../effects/effects.service.js';
import { characterClassAdjustments, toCharacterDto } from './characters.dto.js';
import { loadCatalogLookup } from './inventory-sync.js';

export const actionSurgeSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  operationId: z.string().uuid(),
}).strict();
const TYPE = 'feature.action-surge';
const FINGERPRINT = JSON.stringify({ featureId: 'action-surge' });
type Actor = { userId: string; username: string };

/** Concede uma Ação na economia canônica, sem gastar Ação/Bônus para ativar. */
export async function useActionSurge(actor: Actor, input: z.infer<typeof actionSurgeSchema>) {
  const owner = await prisma.character.findUnique({ where: { userId: actor.userId } });
  if (!owner) throw new HttpError('Esta ficha ainda não foi criada.', 404);
  const key = { characterId_operationId: { characterId: owner.id, operationId: input.operationId } };
  const replay = (previous: { type: string; requestFingerprint: string; result: unknown }) => {
    if (previous.type !== TYPE || previous.requestFingerprint !== FINGERPRINT) throw new HttpError('Esta chave já foi usada em outra operação.', 409, 'IDEMPOTENCY_KEY_REUSED');
    return { ...(previous.result as { character: ReturnType<typeof toCharacterDto>; remaining: number }), replayed: true };
  };
  const previous = await prisma.characterOperation.findUnique({ where: key });
  if (previous) return replay(previous);
  const catalog = await loadCatalogLookup([owner.inventory]);
  let result;
  try {
    result = await prisma.$transaction(async db => {
      const previous = await db.characterOperation.findUnique({ where: key });
      if (previous) return replay(previous);
      const character = await db.character.findUniqueOrThrow({ where: { id: owner.id } });
      if (character.version !== input.expectedVersion) throw new HttpError('A ficha mudou. Atualize antes de usar Surto de Ação.', 409, 'CONFLICT');
      const resource = characterClassAdjustments(character).resources.find(r => r.id === 'action-surge');
      if (!resource) throw new HttpError('Surto de Ação não está disponível nesta ficha.', 403, 'FEATURE_NOT_AVAILABLE');
      if (resource.remaining < 1) throw new HttpError('Surto de Ação recupera no descanso curto ou longo.', 409, 'INSUFFICIENT_RESOURCE');
      const entity = { kind: 'character' as const, id: character.id };
      const loaded = await loadEntity(entity, db);
      if (loaded.hpCurrent <= 0 || deathStateOf(character.deathState).dead || deriveConditionEffects(loaded.state).incapacitated) throw new HttpError('O personagem não pode usar Surto de Ação neste estado.', 409, 'FEATURE_INCAPACITATED');
      if (!loaded.combat || loaded.combat.status !== 'ACTIVE') throw new HttpError('Use Surto de Ação durante seu turno em um combate ativo.', 409, 'FEATURE_TURN_REQUIRED');
      const locked = await db.combat.updateMany({ where: { id: loaded.combat.id, status: 'ACTIVE', version: loaded.combat.version }, data: { version: { increment: 1 } } });
      if (locked.count !== 1) throw new HttpError('O combate mudou; tente novamente.', 409, 'CONFLICT');
      const turn = await castingTurnContext(db, loaded);
      if (!turn?.isCasterTurn) throw new HttpError('Aguarde seu turno.', 409, 'FEATURE_OUT_OF_TURN');
      const unit = await db.combatant.findUniqueOrThrow({ where: { id: turn.combatantId } });
      const economy = economyOf(unit.turnEconomy);
      grantActionSurge(economy);
      const updated = await db.combatant.updateMany({ where: { id: unit.id, mechanicalVersion: turn.combatantVersion }, data: { turnEconomy: economy as unknown as Prisma.InputJsonValue, mechanicalVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new HttpError('A economia do turno mudou; tente novamente.', 409, 'CONFLICT');
      const state = normalizeClassState(character.classState);
      state.used[resource.id] = resource.used + 1;
      const written = await db.character.updateMany({ where: { id: character.id, version: input.expectedVersion }, data: { classState: state as unknown as Prisma.InputJsonValue, version: { increment: 1 } } });
      if (written.count !== 1) throw new HttpError('A ficha mudou; nenhum uso foi consumido.', 409, 'CONFLICT');
      await appendCombatJournal({ combatId: turn.combatId, actorName: character.name, action: TYPE, message: 'Surto de Ação — uma Ação adicional neste turno.' }, db);
      const fresh = await db.character.findUniqueOrThrow({ where: { id: character.id } });
      const effects = await effectModifierSetFor(entity, db);
      const snapshot = { character: toCharacterDto(fresh, actor.username, catalog, effects), remaining: resource.remaining - 1, replayed: false };
      await db.characterOperation.create({ data: { characterId: character.id, operationId: input.operationId, type: TYPE, requestFingerprint: FINGERPRINT, result: snapshot as unknown as Prisma.InputJsonValue } });
      return snapshot;
    });
  } catch (error) {
    const previous = await prisma.characterOperation.findUnique({ where: key });
    if (previous) return replay(previous);
    if (['P2034', 'P2002'].includes((error as { code?: string }).code ?? '')) throw new HttpError('Uma operação concorrente mudou a ficha; tente novamente.', 409, 'CONFLICT');
    throw error;
  }
  if (!result.replayed) {
    try { await publishCharacter(owner.id); await refreshCombatForEffects(); }
    catch (error) { console.error('[Surto de Ação] falha ao notificar operação já confirmada:', error); }
  }
  return result;
}
