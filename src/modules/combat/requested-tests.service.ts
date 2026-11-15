import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../lib/http-error.js';
import { ServerEvents } from '../../realtime/events.js';
import { toCharacterDto, characterClassAdjustments } from '../characters/characters.dto.js';
import { halfProficiencyForAbility, abilityModifier } from '../shared/dnd5e.js';
import { savingThrowBonus } from '../shared/saving-throws.js';
import { requestedTestDefinition, type RequestedTestKind, requestedTestSchema } from '../shared/requested-tests.js';
import type { MechanicalEntity } from '../shared/conditions.js';
import type { DiceRollDto } from '../dice/dice.dto.js';
import type { TableRollInput } from '../dice/dice.schema.js';
import { runSpatialOperation } from './spatial/spatial-scene.service.js';
import { emitCombat, loadCombatById, type CombatActor } from './combat.service.js';
import { toCombatDto } from './combat.dto.js';
import { appendCombatJournal } from './combat-journal.js';
import type { z } from 'zod';

function requireMaster(actor: CombatActor) {
  if (actor.role !== 'MASTER') throw new HttpError('Apenas o Mestre solicita ou cancela testes.', 403, 'FORBIDDEN');
}
export async function requestCombatTest(actor: CombatActor, combatId: string, combatantId: string, input: z.infer<typeof requestedTestSchema>) {
  requireMaster(actor);
  return runSpatialOperation(actor, { ...input, combatId, combatantId }, 'combat-test-request', async (db, combat) => {
    if (!combat.combatants.some(item => item.id === combatantId)) throw new HttpError('Participante não encontrado.', 404);
    await db.combatTestRequest.create({ data: { combatId, combatantId, kind: input.kind, key: input.key, dc: input.dc } });
    return { combat: toCombatDto(combat, actor.role) };
  });
}
export async function cancelCombatTest(actor: CombatActor, combatId: string, requestId: string, input: { expectedVersion: number; operationId: string }) {
  requireMaster(actor);
  return runSpatialOperation(actor, { ...input, combatId, testRequestId: requestId }, 'combat-test-cancel', async (db, combat) => {
    const changed = await db.combatTestRequest.updateMany({ where: { id: requestId, combatId, status: 'pending' }, data: { status: 'cancelled', version: { increment: 1 } } });
    if (changed.count !== 1) throw new HttpError('Solicitação já resolvida ou cancelada.', 409, 'CONFLICT');
    return { combat: toCombatDto(combat, actor.role) };
  });
}

/** A pendência fixa entidade, atributo, CD e bônus; o motor de dados aplica condições e efeitos. */
export async function resolveCombatTest(
  actor: CombatActor, input: TableRollInput,
  roll: (input: TableRollInput) => Promise<DiceRollDto>,
): Promise<{ roll: DiceRollDto; replayed: boolean }> {
  if (!input.pendingCombatTestId || !input.clientId || input.expectedTestVersion === undefined)
    throw new HttpError('Informe a solicitação, sua versão e a chave da rolagem.', 400, 'VALIDATION_ERROR');
  const seed = await prisma.combatTestRequest.findUnique({ where: { id: input.pendingCombatTestId }, select: { combatId: true } });
  if (!seed) throw new HttpError('Solicitação não encontrada.', 404);
  const fingerprint = createHash('sha256').update(JSON.stringify({ actor: actor.userId, input })).digest('hex');
  const outcome = await prisma.$transaction(async db => {
    // Mesma fronteira do combate: término, remoção e duas rolagens não podem vencer juntos.
    await db.$queryRaw`SELECT id FROM combats WHERE id = ${seed.combatId} FOR UPDATE`;
    const request = await db.combatTestRequest.findUnique({ where: { id: input.pendingCombatTestId }, include: { combat: true, combatant: { include: { character: true, creature: true } } } });
    if (!request) throw new HttpError('Solicitação não encontrada.', 404);
    const unit = request.combatant;
    const owner = unit.character?.userId ?? unit.ownerUserId;
    if (actor.role !== 'MASTER' && (!unit.character || owner !== actor.userId)) throw new HttpError('Este teste pertence a outro participante.', 403, 'FORBIDDEN');
    if (request.status === 'resolved' && request.resolutionFingerprint === fingerprint && request.result)
      return { roll: request.result as unknown as DiceRollDto, replayed: true };
    if (request.status === 'resolved' && (request.result as unknown as DiceRollDto | null)?.clientId === input.clientId)
      throw new HttpError('Chave de rolagem reutilizada com outro payload.', 409, 'IDEMPOTENCY_KEY_REUSED');
    if (request.status !== 'pending' || request.version !== input.expectedTestVersion || request.combat.status === 'ENDED')
      throw new HttpError('Solicitação já resolvida, cancelada ou desatualizada.', 409, 'CONFLICT');
    const definition = requestedTestDefinition(request.kind as RequestedTestKind, request.key);
    if (!definition) throw new HttpError('Teste inválido.', 409);
    const entity: MechanicalEntity = unit.characterId ? { kind: 'character', id: unit.characterId } : { kind: 'combatant', id: unit.id };
    let bonus: number;
    if (request.kind === 'save') bonus = await savingThrowBonus(entity, definition.ability, db);
    else if (unit.character) {
      const derived = toCharacterDto(unit.character).derived;
      bonus = request.kind === 'skill' ? derived.skills[request.key].total
        : derived.modifiers[definition.ability] + halfProficiencyForAbility(characterClassAdjustments(unit.character).halfProficiency, derived.proficiencyBonus, definition.ability);
    } else {
      if (!unit.creature) throw new HttpError('Cadastro do participante não encontrado.', 404);
      bonus = abilityModifier(unit.creature[definition.ability]);
    }
    const privateRoll = actor.role === 'MASTER' && input.visibility === 'private';
    const result = await roll({ ...input, pendingCombatTestId: undefined, pendingEffectSaveId: undefined,
      pendingConcentrationSaveId: undefined, entity, ability: definition.ability,
      kind: request.kind === 'save' ? 'save' : 'skill', dice: [{ sides: 20 }], bonus,
      private: privateRoll, label: `${definition.label} — CD ${request.dc}` });
    await db.combatTestRequest.update({ where: { id: request.id }, data: { status: 'resolved', version: { increment: 1 }, resolutionFingerprint: fingerprint, result: result as unknown as Prisma.InputJsonValue } });
    await appendCombatJournal({ combatId: request.combatId, actorName: unit.name,
      message: `${definition.label}: ${result.total} vs CD ${request.dc} → ${!result.autoFail && result.total >= request.dc ? 'SUCESSO' : 'FALHA'}.`, action: 'requested-test', private: privateRoll }, db);
    await db.combat.update({ where: { id: request.combatId }, data: { version: { increment: 1 } } });
    return { roll: result, replayed: false };
  }, { timeout: 15000 });
  if (!outcome.replayed) emitCombat(ServerEvents.COMBAT_UPDATED, toCombatDto(await loadCombatById(seed.combatId), 'MASTER'));
  return outcome;
}
