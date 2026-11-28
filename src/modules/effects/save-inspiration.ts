import { createHash, randomUUID } from 'node:crypto';
import type { AbilityKey } from '../shared/dnd5e.js';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../lib/http-error.js';
import type { DiceActor } from '../dice/dice.service.js';
import type { DiceRollDto } from '../dice/dice.dto.js';
import type { TableRollInput } from '../dice/dice.schema.js';
import { inspirationDecisionSchema } from '../combat/requested-test-inspiration.js';
import { BARDIC_INSPIRATION_IDS } from './definitions/bardic-inspiration.js';
import { consumeInspirationForRoll } from './inspiration-consumption.js';
import { resolvePendingEffectSave, publishHoldPersonResult } from './hold-person.service.js';
import { publishEffects } from './effects.service.js';
import { journalSpellSaveOutcome } from '../combat/resolution-requests.js';

export interface SaveInspirationCheckpoint {
  version: 1; combatId: string; fingerprint: string; effectId: string; sides: number; roll: DiceRollDto;
}
export function saveInspirationCheckpoint(snapshot: unknown): SaveInspirationCheckpoint | null {
  const value = (snapshot as { inspirationSave?: SaveInspirationCheckpoint } | null)?.inspirationSave;
  return value?.version === 1 && typeof value.effectId === 'string' && [6,8,10,12].includes(value.sides) && Number.isFinite(value.roll?.total) ? value : null;
}

/** Suspende apenas saves de efeito públicos; não resolve sucesso, efeito ou concentração. */
export async function rollInspiredEffectSave(actor: DiceActor, input: TableRollInput, roll: () => Promise<DiceRollDto>): Promise<DiceRollDto | null> {
  const seed = await prisma.pendingEffectSave.findUniqueOrThrow({ where: { id: input.pendingEffectSaveId } });
  if (seed.targetEntityKind !== 'character' || seed.visibility === 'private' || (actor.role === 'MASTER' && input.visibility === 'private')) return null;
  const fingerprint = createHash('sha256').update(JSON.stringify({ actor: actor.userId, input })).digest('hex');
  const result = await prisma.$transaction(async db => {
    const unit = await db.combatant.findFirst({ where: { characterId: seed.targetEntityId, combat: { status: 'ACTIVE' } }, select: { combatId: true } });
    if (!unit) return null;
    await db.$queryRaw`SELECT id FROM combats WHERE id = ${unit.combatId} FOR UPDATE`;
    if (!(await db.combat.findFirst({where:{id:unit.combatId,status:'ACTIVE'}}))) throw new HttpError('O combate foi encerrado.',409,'CONFLICT');
    await db.$queryRaw`SELECT id FROM pending_effect_saves WHERE id = ${seed.id} FOR UPDATE`;
    const row = await db.pendingEffectSave.findUniqueOrThrow({ where: { id: seed.id } });
    if (row.status !== 'pending') throw new HttpError('Salvaguarda encerrada.', 409, 'CONFLICT');
    const previous = saveInspirationCheckpoint(row.resolutionSnapshot);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new HttpError('O d20 já foi rolado; conclua a decisão no registro.',409,previous.roll.clientId === input.clientId ? 'IDEMPOTENCY_KEY_REUSED' : 'INSPIRATION_DECISION_PENDING');
      return previous.roll;
    }
    const effect = await db.effectInstance.findFirst({ where: { targetEntityKind: 'character', targetEntityId: row.targetEntityId, status: 'active', definitionId: { in: [...BARDIC_INSPIRATION_IDS] } }, orderBy: { createdAt: 'asc' } });
    if (!effect) return null;
    if (!input.clientId) throw new HttpError('Informe a chave da rolagem.', 400, 'VALIDATION_ERROR');
    const provisional = await roll();
    if (provisional.autoFail) return null;
    const snapshot: SaveInspirationCheckpoint = { version: 1, combatId: unit.combatId, fingerprint, effectId: effect.id, sides: Number(effect.definitionId!.split('.d')[1]), roll: { ...provisional, inspirationPending: true } };
    await db.pendingEffectSave.update({ where: { id: row.id }, data: { resolutionSnapshot: { inspirationSave: snapshot } as unknown as Prisma.InputJsonValue } });
    return snapshot.roll;
  }, { timeout: 15000 });
  if (result) {
    const { publishPendingEffectSaves } = await import('./pending-effect-saves.js');
    await publishPendingEffectSaves([{ kind: 'character', id: seed.targetEntityId }]);
  }
  return result;
}

/** Consumo e resolução do efeito na MESMA transação do recibo. */
export async function decideEffectSaveInspiration(actor: DiceActor, pendingId: string, input: z.infer<typeof inspirationDecisionSchema>) {
  const seed = await prisma.pendingEffectSave.findUnique({ where: { id: pendingId } });
  if (!seed || seed.targetEntityKind !== 'character') throw new HttpError('Salvaguarda indisponível.', 404);
  const checkpoint = saveInspirationCheckpoint(seed.resolutionSnapshot);
  if (!checkpoint) throw new HttpError('Não há decisão de Inspiração nesta salvaguarda.',409,'CONFLICT');
  const fingerprint = createHash('sha256').update(JSON.stringify({pendingId,useInspiration:input.useInspiration})).digest('hex');
  const outcome = await prisma.$transaction(async db => {
    await db.$queryRaw`SELECT id FROM combats WHERE id = ${checkpoint.combatId} FOR UPDATE`;
    await db.$queryRaw`SELECT id FROM pending_effect_saves WHERE id = ${pendingId} FOR UPDATE`;
    const row = await db.pendingEffectSave.findUniqueOrThrow({where:{id:pendingId}});
    const character = await db.character.findUniqueOrThrow({where:{id:row.targetEntityId}});
    if (character.userId !== actor.userId) throw new HttpError('Somente o dono decide sobre a Inspiração.',403,'FORBIDDEN');
    const key = {characterId_operationId:{characterId:character.id,operationId:input.operationId}};
    const previous = await db.characterOperation.findUnique({where:key});
    if (previous) {
      if (previous.type !== 'inspiration-effect-save' || previous.requestFingerprint !== fingerprint) throw new HttpError('Chave reutilizada.',409,'IDEMPOTENCY_KEY_REUSED');
      return {...(previous.result as unknown as {roll:DiceRollDto}),replayed:true,resolution:null};
    }
    const current = saveInspirationCheckpoint(row.resolutionSnapshot);
    if (row.status !== 'pending' || !current || input.expectedTestVersion !== current.version || character.version !== input.expectedVersion || !(await db.combat.findFirst({where:{id:current.combatId,status:'ACTIVE'}}))) throw new HttpError('A ficha ou salvaguarda mudou.',409,'CONFLICT');
    let result: DiceRollDto = {...current.roll,id:randomUUID(),inspirationPending:false};
    if (input.useInspiration) result = await consumeInspirationForRoll(db,character.id,input.expectedVersion,current.effectId,result);
    const resolution = await resolvePendingEffectSave(pendingId,result.total,actor.displayName,db);
    if (resolution.replayed) throw new HttpError('Salvaguarda já resolvida.',409,'CONFLICT');
    // Preserva o checkpoint para replay e auditoria; não é regra de efeito.
    const snapshot = {roll:result};
    await db.characterOperation.create({data:{characterId:character.id,operationId:input.operationId,type:'inspiration-effect-save',requestFingerprint:fingerprint,result:snapshot as unknown as Prisma.InputJsonValue}});
    return {...snapshot,replayed:false,resolution};
  }, {timeout:15000});
  if (!outcome.replayed && outcome.resolution) {
    try {
      await publishEffects([{kind:'character',id:seed.targetEntityId}]);
      await publishHoldPersonResult(outcome.resolution,actor.displayName);
      await journalSpellSaveOutcome({target:{kind:'character',id:seed.targetEntityId},label:outcome.resolution.label,ability:seed.ability as AbilityKey,dc:seed.dc,total:outcome.roll.total,success:outcome.resolution.success,phase:seed.phase === 'ongoing' ? 'ongoing' : 'initial',privateRoll:false,actorName:outcome.roll.actorName});
      const {publishFinalRequestedRoll}=await import('../dice/dice.service.js');publishFinalRequestedRoll(outcome.roll);
    } catch(error) {console.error('[Inspiração] decisão de salvaguarda confirmada; notificação falhou:',error);}
  }
  return {roll:outcome.roll,replayed:outcome.replayed};
}
