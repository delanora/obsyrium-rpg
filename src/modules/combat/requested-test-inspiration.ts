import { consumeInspirationForRoll } from '../effects/inspiration-consumption.js';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../lib/http-error.js';
import type { DiceRollDto } from '../dice/dice.dto.js';
import { publishEffects } from '../effects/effects.service.js';
import { emitCombat, loadCombatById, type CombatActor } from './combat.service.js';
import { toCombatDto } from './combat.dto.js';
import { appendCombatJournal } from './combat-journal.js';
import { ServerEvents } from '../../realtime/events.js';

export const inspirationDecisionSchema = z.object({
  useInspiration: z.boolean(), expectedTestVersion: z.number().int().nonnegative(),
  expectedVersion: z.number().int().nonnegative(), operationId: z.string().uuid(),
}).strict();
export type InspirationRoll = DiceRollDto & { inspiration: { effectId: string; sides: number } };

/** Decide uma única vez sobre o d20 já persistido; nunca recebe resultado do cliente. */
export async function decideRequestedTestInspiration(actor: CombatActor, combatId: string, requestId: string, input: z.infer<typeof inspirationDecisionSchema>) {
  const fingerprint = createHash('sha256').update(JSON.stringify({ requestId, combatId, useInspiration: input.useInspiration })).digest('hex');
  const outcome = await prisma.$transaction(async db => {
    await db.$queryRaw`SELECT id FROM combats WHERE id = ${combatId} FOR UPDATE`;
    const request = await db.combatTestRequest.findUnique({ where: { id: requestId }, include: { combat: true, combatant: { include: { character: true } } } });
    const character = request?.combatant.character;
    if (!request || request.combatId !== combatId) throw new HttpError('Teste não encontrado.', 404);
    // A decisão é do beneficiário. Assumir o turno não concede esse consentimento.
    if (!character || character.userId !== actor.userId) throw new HttpError('Somente o dono do personagem decide sobre a Inspiração.', 403, 'FORBIDDEN');
    const key = { characterId_operationId: { characterId: character.id, operationId: input.operationId } };
    const previous = await db.characterOperation.findUnique({ where: key });
    if (previous) {
      if (previous.type !== 'bardic-inspiration-decision' || previous.requestFingerprint !== fingerprint) throw new HttpError('Chave reutilizada.', 409, 'IDEMPOTENCY_KEY_REUSED');
      return { ...(previous.result as unknown as { roll: DiceRollDto }), replayed: true, characterId: character.id };
    }
    if (request.status !== 'pending' || request.version !== input.expectedTestVersion || request.combat.status !== 'ACTIVE') throw new HttpError('O teste mudou ou foi encerrado.', 409, 'CONFLICT');
    const pending = request.result as unknown as InspirationRoll | null;
    if (!pending?.inspirationPending || !pending.inspiration) throw new HttpError('Não existe decisão de Inspiração neste teste.', 409, 'CONFLICT');
    if (character.version !== input.expectedVersion) throw new HttpError('A ficha mudou; atualize a decisão.', 409, 'CONFLICT');
    const result: DiceRollDto = { ...pending, id: randomUUID(), inspirationPending: false };
    delete (result as Partial<InspirationRoll>).inspiration;
    if (input.useInspiration) {
      Object.assign(result, await consumeInspirationForRoll(db, character.id, input.expectedVersion, pending.inspiration.effectId, result));
    }
    await db.combatTestRequest.update({ where: { id: request.id }, data: { status: 'resolved', version: { increment: 1 }, result: result as unknown as Prisma.InputJsonValue } });
    await appendCombatJournal({ combatId, actorName: request.combatant.name, action: 'requested-test', private: result.isPrivate,
      message: `${result.label}: ${result.total} vs CD ${request.dc} → ${!result.autoFail && result.total >= request.dc ? 'SUCESSO' : 'FALHA'}.` }, db);
    await db.combat.update({ where: { id: combatId }, data: { version: { increment: 1 } } });
    const snapshot = { roll: result };
    await db.characterOperation.create({ data: { characterId: character.id, operationId: input.operationId, type: 'bardic-inspiration-decision', requestFingerprint: fingerprint, result: snapshot as unknown as Prisma.InputJsonValue } });
    return { ...snapshot, replayed: false, characterId: character.id };
  });
  if (!outcome.replayed) {
    try {
    await publishEffects([{ kind: 'character', id: outcome.characterId }]);
    emitCombat(ServerEvents.COMBAT_UPDATED, toCombatDto(await loadCombatById(combatId), 'MASTER'));
    const { publishFinalRequestedRoll } = await import('../dice/dice.service.js');
    publishFinalRequestedRoll(outcome.roll);
    } catch (error) { console.error('[Inspiração] decisão confirmada; falha na notificação:', error); }
  }
  return { roll: outcome.roll, replayed: outcome.replayed };
}
