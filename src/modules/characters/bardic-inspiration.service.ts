import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../lib/http-error.js';
import { normalizeClassEntries, normalizeClassState } from '../shared/classes.js';
import { deathStateOf } from '../shared/death.js';
import { deriveConditionEffects } from '../shared/conditions.js';
import { loadEntity } from '../mechanical/mechanical.service.js';
import { combatSpatialIndexById, gridSpatialProvider, spatialBodyOf } from '../combat/spatial/spatial-distance.service.js';
import { castingTurnContext, commitCastingEconomy } from '../spells/execution/spell-casting-economy.js';
import { buildDurationSnapshot } from '../spells/execution/spell-duration.js';
import { publishCharacter, refreshCombatForEffects } from '../combat/combat.service.js';
import { appendCombatJournal } from '../combat/combat-journal.js';
import { publishEffects, effectModifierSetFor } from '../effects/effects.service.js';
import { toEffectDto } from '../effects/effects.dto.js';
import { BARDIC_INSPIRATION_IDS, BARDIC_INSPIRATION_DEFINITIONS, bardicInspirationDie } from '../effects/definitions/bardic-inspiration.js';
import { characterClassAdjustments, toCharacterDto } from './characters.dto.js';
import { loadCatalogLookup } from './inventory-sync.js';

export const bardicInspirationSchema = z.object({
  targetCharacterId: z.string().min(1), combatId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(), expectedTargetVersion: z.number().int().nonnegative(),
  expectedCombatVersion: z.number().int().nonnegative(), operationId: z.string().uuid(),
}).strict();
type Actor = { userId: string; username: string };
const TYPE = 'feature.bardic-inspiration-grant';
async function sourceContext(db: Prisma.TransactionClient, actor: Actor) {
  const character = await db.character.findUnique({ where: { userId: actor.userId } });
  if (!character) throw new HttpError('Esta ficha ainda não foi criada.', 404);
  const resource = characterClassAdjustments(character).resources.find(r => r.id === 'bardic-inspiration');
  const level = normalizeClassEntries(character.classes).find(c => c.classKey === 'bard')?.level ?? 0;
  if (!resource || !level) throw new HttpError('Inspiração de Bardo indisponível nesta ficha.', 403, 'FEATURE_NOT_AVAILABLE');
  const source = await loadEntity({ kind: 'character', id: character.id }, db);
  return { character, source, resource, sides: bardicInspirationDie(level) };
}
async function targetReason(db: Prisma.TransactionClient, source: Awaited<ReturnType<typeof sourceContext>>, targetId: string) {
  if (targetId === source.character.id) return 'Inspiração de Bardo exige outro personagem.';
  const row = await db.character.findFirst({ where: { id: targetId, user: { role: 'PLAYER' } } });
  if (!row) return 'Alvo indisponível.';
  const target = await loadEntity({ kind: 'character', id: row.id }, db);
  if (!source.source.combat || !target.combat || source.source.combat.id !== target.combat.id) return 'Sem geometria de alcance e audição; exige resolução assistida pelo Mestre.';
  const unit = await db.combatant.findUnique({ where: { id: target.combat.combatantId }, select: { spatialVisibility: true } });
  if (!unit || unit.spatialVisibility === 'master-only') return 'Alvo indisponível.';
  const effects = deriveConditionEffects(target.state);
  if (deathStateOf(row.deathState).dead || effects.hearingChecksAutoFail || effects.active.includes('unconscious')) return 'O alvo não pode ouvir a inspiração neste estado.';
  const index = await combatSpatialIndexById(db, source.source.combat.id);
  if (index && spatialBodyOf(index, source.source.entity)?.elevationFeet !== spatialBodyOf(index, target.entity)?.elevationFeet) return 'Audição entre alturas diferentes exige resolução assistida pelo Mestre.';
  const provider = gridSpatialProvider(index);
  const range = provider.evaluateRange(source.source.entity, target.entity, 60);
  if (range === 'fail') return 'O alvo está além de 18 m.';
  if (range !== 'pass' || provider.evaluateClearPath(source.source.entity, target.entity) !== 'pass') return 'Alcance ou audição através de barreiras não verificados; resolver com o Mestre.';
  const held = await db.effectInstance.findFirst({ where: { status: 'active', definitionId: { in: [...BARDIC_INSPIRATION_IDS] }, targetEntityKind: 'character', targetEntityId: targetId } });
  if (held) return 'O alvo não está disponível para receber este dado.';
  return null;
}
export async function bardicInspirationOptions(actor: Actor) {
  return prisma.$transaction(async db => {
    const c = await sourceContext(db, actor);
    const turn = await castingTurnContext(db, c.source);
    const canUse = c.resource.remaining > 0 && c.source.hpCurrent > 0 && !deathStateOf(c.character.deathState).dead && !deriveConditionEffects(c.source.state).incapacitated && !!turn?.isCasterTurn && !turn.bonusActionUsed;
    const units = c.source.combat ? await db.combatant.findMany({ where: { combatId: c.source.combat.id, characterId: { not: null }, spatialVisibility: { not: 'master-only' } }, select: { characterId: true } }) : [];
    const rows = await db.character.findMany({ where: { id: { in: units.flatMap(u => u.characterId && u.characterId !== c.character.id ? [u.characterId] : []) }, user: { role: 'PLAYER' } }, select: { id: true, name: true, version: true } });
    const targets = [];
    for (const row of rows) targets.push({ ...row, reason: await targetReason(db, c, row.id) });
    return { characterVersion: c.character.version, combatId: c.source.combat?.id ?? null, combatVersion: c.source.combat?.version ?? null,
      sides: c.sides, remaining: c.resource.remaining, max: c.resource.max, canUse: !!canUse, targets };
  }, { isolationLevel: 'RepeatableRead' });
}
/** Concede o dado; seu consumo pós-d20 será uma etapa independente. */
export async function grantBardicInspiration(actor: Actor, input: z.infer<typeof bardicInspirationSchema>) {
  const owner = await prisma.character.findUnique({ where: { userId: actor.userId } });
  if (!owner) throw new HttpError('Esta ficha ainda não foi criada.', 404);
  const key = { characterId_operationId: { characterId: owner.id, operationId: input.operationId } };
  const fingerprint = createHash('sha256').update(JSON.stringify({ targetCharacterId: input.targetCharacterId, combatId: input.combatId })).digest('hex');
  const replay = (row: { type: string; requestFingerprint: string; result: unknown }) => {
    if (row.type !== TYPE || row.requestFingerprint !== fingerprint) throw new HttpError('Chave já utilizada em outra operação.', 409, 'IDEMPOTENCY_KEY_REUSED');
    return { ...(row.result as { character: ReturnType<typeof toCharacterDto>; effect: ReturnType<typeof toEffectDto>; remaining: number }), replayed: true };
  };
  const existing = await prisma.characterOperation.findUnique({ where: key });
  if (existing) return replay(existing);
  const catalog = await loadCatalogLookup([owner.inventory]);
  let result;
  try {
    result = await prisma.$transaction(async db => {
      const previous = await db.characterOperation.findUnique({ where: key });
      if (previous) return replay(previous);
      const c = await sourceContext(db, actor);
      if (c.character.version !== input.expectedVersion) throw new HttpError('A ficha mudou; confira a inspiração.', 409, 'CONFLICT');
      if (c.resource.remaining < 1) throw new HttpError('Sem usos de Inspiração de Bardo.', 409, 'INSUFFICIENT_RESOURCE');
      if (c.source.hpCurrent <= 0 || deathStateOf(c.character.deathState).dead || deriveConditionEffects(c.source.state).incapacitated) throw new HttpError('O bardo não pode agir neste estado.', 409, 'FEATURE_INCAPACITATED');
      if (!c.source.combat || c.source.combat.status !== 'ACTIVE' || c.source.combat.id !== input.combatId) throw new HttpError('Use a concessão durante seu turno num combate ativo com grid.', 409, 'FEATURE_COMBAT_REQUIRED');
      const locked = await db.combat.updateMany({ where: { id: input.combatId, version: input.expectedCombatVersion, status: 'ACTIVE' }, data: { version: { increment: 1 } } });
      if (locked.count !== 1) throw new HttpError('O combate mudou; confira os alvos.', 409, 'CONFLICT');
      const reason = await targetReason(db, c, input.targetCharacterId);
      if (reason) throw new HttpError(reason, 409, 'INSPIRATION_TARGET_UNAVAILABLE');
      const turn = await castingTurnContext(db, c.source);
      if (!turn?.isCasterTurn) throw new HttpError('Aguarde seu turno.', 409, 'FEATURE_OUT_OF_TURN');
      await commitCastingEconomy(db, turn, 'bonus-action');
      const target = await db.character.updateMany({ where: { id: input.targetCharacterId, version: input.expectedTargetVersion }, data: { version: { increment: 1 } } });
      if (target.count !== 1) throw new HttpError('O alvo mudou; nenhum uso foi gasto.', 409, 'CONFLICT');
      const state = normalizeClassState(c.character.classState);
      state.used['bardic-inspiration'] = c.resource.used + 1;
      const written = await db.character.updateMany({ where: { id: owner.id, version: input.expectedVersion }, data: { classState: state as unknown as Prisma.InputJsonValue, version: { increment: 1 } } });
      if (written.count !== 1) throw new HttpError('A ficha mudou; nenhum uso foi gasto.', 409, 'CONFLICT');
      const definition = BARDIC_INSPIRATION_DEFINITIONS[`feature.bardic-inspiration.d${c.sides}`]!;
      const combat = await db.combat.findUniqueOrThrow({ where: { id: input.combatId } });
      const duration = buildDurationSnapshot({ definition: { kind: 'timed', amount: 10, unit: 'minute' }, combat: {
        combatId: combat.id, anchorCombatantId: turn.combatantId, roundNumber: combat.round, turnSequence: turn.turnSequence,
      } });
      const effect = await db.effectInstance.create({ data: {
        definitionId: definition.definitionId, label: definition.label, sourceType: 'feature', sourceId: input.operationId,
        groupId: `bardic-inspiration:${owner.id}:${input.operationId}`, sourceEntityKind: 'character', sourceEntityId: owner.id, sourceLabel: c.character.name,
        targetEntityKind: 'character', targetEntityId: input.targetCharacterId, createdBy: actor.userId, visibility: 'public', status: 'active',
        modifiers: definition.modifiers() as unknown as Prisma.InputJsonValue, conditions: [], turnTriggers: [], durationSnapshot: duration as unknown as Prisma.InputJsonValue,
      } });
      await appendCombatJournal({ combatId: combat.id, actorName: c.character.name, action: TYPE, message: `Inspiração de Bardo — dado d${c.sides} concedido.` }, db);
      const fresh = await db.character.findUniqueOrThrow({ where: { id: owner.id } });
      const snapshot = { character: toCharacterDto(fresh, actor.username, catalog, await effectModifierSetFor(c.source.entity, db)), effect: toEffectDto(effect), remaining: c.resource.remaining - 1, replayed: false };
      await db.characterOperation.create({ data: { characterId: owner.id, operationId: input.operationId, type: TYPE, requestFingerprint: fingerprint, result: snapshot as unknown as Prisma.InputJsonValue } });
      return snapshot;
    });
  } catch (error) {
    const previous = await prisma.characterOperation.findUnique({ where: key });
    if (previous) return replay(previous);
    if (['P2034', 'P2002'].includes((error as { code?: string }).code ?? '')) throw new HttpError('Operação concorrente; confira as fichas.', 409, 'CONFLICT');
    throw error;
  }
  if (!result.replayed) {
    try { await publishCharacter(owner.id); await publishEffects([{ kind: 'character', id: input.targetCharacterId }]); await refreshCombatForEffects(); }
    catch (error) { console.error('[Inspiração de Bardo] falha ao notificar concessão confirmada:', error); }
  }
  return result;
}
