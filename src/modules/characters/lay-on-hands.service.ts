import { removeAffliction } from '../mechanical/afflictions.js';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../lib/http-error.js';
import { normalizeClassState } from '../shared/classes.js';
import { deathStateOf } from '../shared/death.js';
import { deriveConditionEffects } from '../shared/conditions.js';
import { creatureTypeOf } from '../shared/creature-types.js';
import { loadEntity } from '../mechanical/mechanical.service.js';
import { damageTargetOf } from '../combat/damage-target.js';
import { applyHealConsequences, publishDeathUpdated } from '../death/death.service.js';
import type { MechanicalEntity } from '../shared/conditions.js';
import { resolveHealing } from '../combat/damage-resolution.js';
import { publishCharacter, refreshCombatForEffects } from '../combat/combat.service.js';
import { loadCombatById } from '../combat/combat-load.js';
import { appendCombatJournal } from '../combat/combat-journal.js';
import { combatSpatialIndexById, gridSpatialProvider, spatialBodyOf } from '../combat/spatial/spatial-distance.service.js';
import { castingTurnContext, commitCastingEconomy } from '../spells/execution/spell-casting-economy.js';
import { assertLivingHealingTargets } from '../spells/execution/healing-targets.js';
import { effectModifierSetFor } from '../effects/effects.service.js';
import { characterClassAdjustments, toCharacterDto } from './characters.dto.js';
import { loadCatalogLookup } from './inventory-sync.js';

const targetSchema = z.object({ kind: z.enum(['character', 'combatant']), id: z.string().min(1) }).strict();
export const layOnHandsSchema = z.object({
  target: targetSchema, amount: z.number().int().min(1).max(100),
  expectedVersion: z.number().int().nonnegative(), expectedTargetVersion: z.number().int().nonnegative(),
  operationId: z.string().uuid(),
}).strict();
export const layOnHandsPurifySchema = layOnHandsSchema.omit({ amount: true }).extend({
  afflictionIds: z.array(z.string().uuid()).min(1).max(20).refine(ids => new Set(ids).size === ids.length, 'Escolha cada origem uma única vez.'),
}).strict();
type HealingInput = z.infer<typeof layOnHandsSchema>;
type PurifyInput = z.infer<typeof layOnHandsPurifySchema>;
type Actor = { userId: string; username: string; role: 'MASTER' | 'PLAYER' };
const TYPE = 'feature.lay-on-hands-heal';
async function context(db: Prisma.TransactionClient, actor: Actor) {
  const character = await db.character.findUnique({ where: { userId: actor.userId } });
  if (!character) throw new HttpError('Esta ficha ainda não foi criada.', 404);
  const resource = characterClassAdjustments(character).resources.find(r => r.id === 'lay-on-hands');
  if (!resource) throw new HttpError('Mãos Consagradas não está disponível nesta ficha.', 403, 'FEATURE_NOT_AVAILABLE');
  const source = await loadEntity({ kind: 'character', id: character.id }, db);
  return { character, resource, source };
}
/** Só alvos já públicos: jogadores e instâncias visíveis do próprio combate. */
async function targets(db: Prisma.TransactionClient, actor: Actor, c: Awaited<ReturnType<typeof context>>) {
  const characters = await db.character.findMany({ where: { OR: [{ id: c.character.id }, { user: { role: 'PLAYER' } }] }, select: { id: true } });
  const refs: z.infer<typeof targetSchema>[] = characters.map(row => ({ kind: 'character', id: row.id }));
  if (c.source.combat) {
    const combat = await loadCombatById(c.source.combat.id, db);
    for (const unit of combat.combatants) if (!unit.characterId && unit.creatureId && (actor.role === 'MASTER' || unit.spatialVisibility !== 'master-only')) refs.push({ kind: 'combatant', id: unit.id });
  }
  return refs;
}
async function touch(db: Prisma.TransactionClient, source: Awaited<ReturnType<typeof loadEntity>>, target: Awaited<ReturnType<typeof loadEntity>>) {
  if (source.entity.kind === target.entity.kind && source.entity.id === target.entity.id) return null;
  if (!source.combat || !target.combat || source.combat.id !== target.combat.id) return 'Alcance de toque não verificado; precisa de resolução assistida pelo Mestre.';
  const index = await combatSpatialIndexById(db, source.combat.id);
  if (index && spatialBodyOf(index, source.entity)?.elevationFeet !== spatialBodyOf(index, target.entity)?.elevationFeet) return 'Alturas distintas: toque exige resolução assistida pelo Mestre.';
  const provider = gridSpatialProvider(index);
  const range = provider.evaluateRange(source.entity, target.entity, 5);
  const path = provider.evaluateClearPath(source.entity, target.entity);
  if (range === 'fail') return 'O alvo está além do alcance de toque (1,5 m).';
  if (path === 'fail') return 'Uma barreira impede o toque no alvo.';
  if (range !== 'pass' || path !== 'pass') return 'Toque sem geometria confiável; precisa de resolução assistida pelo Mestre.';
  return null;
}
export async function layOnHandsOptions(actor: Actor) {
  return prisma.$transaction(async db => {
    const c = await context(db, actor);
    const turn = await castingTurnContext(db, c.source);
    const sourceBlocked = c.source.hpCurrent <= 0 || deriveConditionEffects(c.source.state).incapacitated || deathStateOf(c.character.deathState).dead;
    const canUse = !sourceBlocked && c.resource.remaining > 0 && (!c.source.combat || (c.source.combat.status === 'ACTIVE' && !!turn?.isCasterTurn && turn.actionsUsed < turn.actionsGranted));
    const options = [];
    for (const ref of await targets(db, actor, c)) {
      const target = await loadEntity(ref, db);
      let reason = await touch(db, c.source, target);
      try { await assertLivingHealingTargets({ db, targets: [target] }, 'Mãos Consagradas'); } catch { reason = 'O alvo não pode receber esta cura.'; }
      const own = target.entity.kind === 'character' && target.ownerUserId === actor.userId;
      const afflictions = (target.state.afflictions ?? []).filter(origin => actor.role === 'MASTER' || own || origin.visibility === 'public')
        .map(origin => ({ id: origin.id, kind: origin.kind, label: origin.label }));
      options.push({ target: ref, name: target.name, version: target.version, reason, afflictions });
    }
    return { characterVersion: c.character.version, remaining: c.resource.remaining, max: c.resource.max, canUse, targets: options };
  }, { isolationLevel: 'RepeatableRead' });
}
/** As duas opções passam pelo mesmo commit de alvo, reserva e Ação. */
export const useLayOnHands = (actor: Actor, input: HealingInput) => commitLayOnHands(actor, input);
export const purifyWithLayOnHands = (actor: Actor, input: PurifyInput) => commitLayOnHands(actor, input);
async function commitLayOnHands(actor: Actor, input: HealingInput | PurifyInput) {
  const purify = 'afflictionIds' in input;
  const amount = purify ? input.afflictionIds.length * 5 : input.amount;
  const operationType = purify ? 'feature.lay-on-hands-purify' : TYPE;
  const owner = await prisma.character.findUnique({ where: { userId: actor.userId } });
  if (!owner) throw new HttpError('Esta ficha ainda não foi criada.', 404);
  const key = { characterId_operationId: { characterId: owner.id, operationId: input.operationId } };
  const fingerprint = createHash('sha256').update(JSON.stringify(purify ? { target: input.target, afflictionIds: [...input.afflictionIds].sort() } : { target: input.target, amount })).digest('hex');
  const replay = (row: { type: string; requestFingerprint: string; result: unknown }) => {
    if (row.type !== operationType || row.requestFingerprint !== fingerprint) throw new HttpError('Chave já utilizada em outra operação.', 409, 'IDEMPOTENCY_KEY_REUSED');
    return { ...(row.result as { character: ReturnType<typeof toCharacterDto>; healed: number; remaining: number; noEffect: boolean; purified?: number }), replayed: true };
  };
  const previous = await prisma.characterOperation.findUnique({ where: key });
  if (previous) return replay(previous);
  const catalog = await loadCatalogLookup([owner.inventory]);
  let targetCharacterId: string | null = null;
  let deathTarget: MechanicalEntity | null = null;
  let result;
  try {
    result = await prisma.$transaction(async db => {
      const previous = await db.characterOperation.findUnique({ where: key });
      if (previous) return replay(previous);
      const c = await context(db, actor);
      if (c.character.version !== input.expectedVersion) throw new HttpError('A ficha mudou; confira a reserva.', 409, 'CONFLICT');
      if (amount > c.resource.remaining) throw new HttpError('A reserva não tem pontos suficientes.', 409, 'INSUFFICIENT_RESOURCE');
      if (c.source.hpCurrent <= 0 || deriveConditionEffects(c.source.state).incapacitated || deathStateOf(c.character.deathState).dead) throw new HttpError('O personagem não pode usar Mãos Consagradas neste estado.', 409, 'FEATURE_INCAPACITATED');
      if (c.source.combat) {
        const locked = await db.combat.updateMany({ where: { id: c.source.combat.id, status: 'ACTIVE', version: c.source.combat.version }, data: { version: { increment: 1 } } });
        if (locked.count !== 1) throw new HttpError('Aguarde um turno ativo e confira o combate.', 409, 'CONFLICT');
      }
      const visible = await targets(db, actor, c);
      if (!visible.some(ref => ref.kind === input.target.kind && ref.id === input.target.id)) throw new HttpError('Alvo indisponível.', 404);
      const target = await loadEntity(input.target, db);
      if (target.version !== input.expectedTargetVersion) throw new HttpError('O alvo mudou; confira antes de curar.', 409, 'CONFLICT');
      if (purify) {
        const own = target.entity.kind === 'character' && target.ownerUserId === actor.userId;
        for (const id of input.afflictionIds) {
          const origin = target.state.afflictions?.find(value => value.id === id);
          if (!origin || !(actor.role === 'MASTER' || own || origin.visibility === 'public')) throw new HttpError('Origem indisponível; confira as opções atuais.', 409, 'AFFLICTION_NOT_AVAILABLE');
        }
      }
      const blocked = await touch(db, c.source, target);
      if (blocked) throw new HttpError(blocked, 409, 'FEATURE_TOUCH_UNVERIFIED');
      await assertLivingHealingTargets({ db, targets: [target] }, 'Mãos Consagradas');
      const turn = await castingTurnContext(db, c.source);
      if (turn) {
        if (!turn.isCasterTurn) throw new HttpError('Aguarde seu turno.', 409, 'FEATURE_OUT_OF_TURN');
        await commitCastingEconomy(db, turn, 'action');
      }
      const state = normalizeClassState(c.character.classState);
      state.used['lay-on-hands'] = c.resource.used + amount;
      const written = await db.character.updateMany({ where: { id: owner.id, version: input.expectedVersion }, data: { classState: state as unknown as Prisma.InputJsonValue, version: { increment: 1 } } });
      if (written.count !== 1) throw new HttpError('A ficha mudou; nenhum ponto foi gasto.', 409, 'CONFLICT');

      if (target.entity.kind === 'character') {
        targetCharacterId = target.entity.id;
        if (target.entity.id !== owner.id) {
          const locked = await db.character.updateMany({ where: { id: target.entity.id, version: input.expectedTargetVersion }, data: { version: { increment: 1 } } });
          if (locked.count !== 1) throw new HttpError('O alvo mudou; nenhum ponto foi gasto.', 409, 'CONFLICT');
        }

      } else {
        const locked = await db.combatant.updateMany({ where: { id: target.entity.id, mechanicalVersion: input.expectedTargetVersion }, data: { mechanicalVersion: { increment: 1 } } });
        if (locked.count !== 1) throw new HttpError('O alvo mudou; nenhum ponto foi gasto.', 409, 'CONFLICT');

      }
      const noEffect = ['undead', 'construct'].includes((await creatureTypeOf(target.entity, db)) ?? '');
      const healing = noEffect || purify ? null : await resolveHealing(db, { eventId: randomUUID(), source: { kind: 'feature', label: 'Mãos Consagradas' }, target: await damageTargetOf(db, target.entity), amount });
      if (!noEffect && !purify && !healing) throw new HttpError('Alvo indisponível; nenhum ponto foi gasto.', 409, 'CONFLICT');
      let purified = 0;
      if (purify && !noEffect) {
        for (const id of input.afflictionIds) removeAffliction(target.state, id);
        target.state.log = [...target.state.log, { id: `affliction:${randomUUID()}`, actorName: actor.username, message: `Mãos Consagradas neutralizou ${input.afflictionIds.length} origem(ns).`, at: new Date().toISOString() }].slice(-100);
        const data = { mechanicalState: target.state as unknown as Prisma.InputJsonValue };
        const changed = target.entity.kind === 'character'
          ? await db.character.updateMany({ where: { id: target.entity.id, version: input.expectedTargetVersion + 1 }, data: { ...data, version: { increment: 1 } } })
          : await db.combatant.updateMany({ where: { id: target.entity.id, mechanicalVersion: input.expectedTargetVersion + 1 }, data: { ...data, mechanicalVersion: { increment: 1 } } });
        if (changed.count !== 1) throw new HttpError('O estado do alvo mudou; nenhum ponto foi gasto.', 409, 'CONFLICT');
        purified = input.afflictionIds.length;
      }
      if (healing && healing.finalHealing > 0) {
        const death = await applyHealConsequences(target.entity, healing.hpAfter, db, c.character.name);
        if (death.changed) deathTarget = target.entity;
      }
      if (turn) await appendCombatJournal({ combatId: turn.combatId, actorName: c.character.name, action: operationType, message: purify ? `Mãos Consagradas — ${amount} pontos gastos em neutralização.` : `Mãos Consagradas — ${amount} pontos gastos; ${healing?.finalHealing ?? 0} PV restaurados.` }, db);
      const fresh = await db.character.findUniqueOrThrow({ where: { id: owner.id } });
      const snapshot = { character: toCharacterDto(fresh, actor.username, catalog, await effectModifierSetFor(c.source.entity, db)), healed: healing?.finalHealing ?? 0, remaining: c.resource.remaining - amount, noEffect, ...(purify ? { purified } : {}), replayed: false };
      await db.characterOperation.create({ data: { characterId: owner.id, operationId: input.operationId, type: operationType, requestFingerprint: fingerprint, result: snapshot as unknown as Prisma.InputJsonValue } });
      return snapshot;
    });
  } catch (error) {
    const previous = await prisma.characterOperation.findUnique({ where: key });
    if (previous) return replay(previous);
    if (['P2034', 'P2002'].includes((error as { code?: string }).code ?? '')) throw new HttpError('Operação concorrente; confira as fichas.', 409, 'CONFLICT');
    throw error;
  }
  if (!result.replayed) {
    try { if (deathTarget) await publishDeathUpdated(deathTarget); await publishCharacter(owner.id); if (targetCharacterId && targetCharacterId !== owner.id) await publishCharacter(targetCharacterId); await refreshCombatForEffects(); }
    catch (error) { console.error('[Mãos Consagradas] falha ao notificar operação confirmada:', error); }
  }
  return result;
}
