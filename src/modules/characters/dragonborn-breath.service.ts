import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../lib/http-error.js';
import { dragonbornBreath } from '../shared/races/dragonborn-breath.js';
import { normalizeRacialState } from '../shared/races/resources.js';
import { deathStateOf } from '../shared/death.js';
import { deriveConditionEffects } from '../shared/conditions.js';
import { creatureAreaPlacementSchema } from '../shared/creature-abilities.js';
import { loadCombatById } from '../combat/combat-load.js';
import { toCombatDto, orderCombatants } from '../combat/combat.dto.js';
import { abilityAreaPlan, beginAreaAbilityUse, publishCreatureAreaUse } from '../combat/creature-area.service.js';
import { publishCharacter, refreshCombatForEffects } from '../combat/combat.service.js';
import { appendCombatJournal } from '../combat/combat-journal.js';
import { characterRacialAdjustments } from './characters.dto.js';
import { loadEntity } from '../mechanical/mechanical.service.js';
import { castingTurnContext, commitCastingEconomy } from '../spells/execution/spell-casting-economy.js';

export const breathOptionsSchema = z.object({ combatId: z.string().min(1) }).strict();
// Sopro afeta TODOS na área. O jogador não pode escolher imunidade por checkbox.
const placement = creatureAreaPlacementSchema.omit({ selectedTargetKeys: true });
export const breathPreviewSchema = breathOptionsSchema.extend({ placement }).strict();
export const breathUseSchema = breathPreviewSchema.extend({
  expectedVersion: z.number().int().nonnegative(),
  expectedCombatVersion: z.number().int().nonnegative(),
  operationId: z.string().uuid(),
}).strict();
type Actor = { userId: string; username: string; role: 'MASTER' | 'PLAYER' };
const TYPE = 'racial.breath-weapon';

async function context(db: Prisma.TransactionClient, actor: Actor, combatId: string) {
  const character = await db.character.findUnique({ where: { userId: actor.userId } });
  if (!character) throw new HttpError('Esta ficha ainda não foi criada.', 404);
  const definition = dragonbornBreath(character);
  if (!definition) throw new HttpError('Escolha uma ancestralidade racial de Draconato válida.', 403, 'BREATH_NOT_AVAILABLE');
  const combat = await loadCombatById(combatId, db);
  const unit = combat.combatants.find(c => c.characterId === character.id);
  if (!unit || combat.status !== 'ACTIVE') throw new HttpError('Entre no combate ativo com seu personagem.', 409, 'BREATH_COMBAT_REQUIRED');
  const resource = characterRacialAdjustments(character).resources.find(r => r.id === 'breath-weapon');
  if (!resource) throw new HttpError('Sopro racial indisponível.', 403, 'BREATH_NOT_AVAILABLE');
  return { character, definition, combat, unit, resource };
}
export async function breathOptions(actor: Actor, combatId: string) {
  return prisma.$transaction(async db => {
    const c = await context(db, actor, combatId);
    const loaded = await loadEntity({ kind: 'character', id: c.character.id }, db);
    const turn = await castingTurnContext(db, loaded);
    const canUse = c.resource.remaining > 0 && turn?.isCasterTurn && turn.actionsUsed < turn.actionsGranted && loaded.hpCurrent > 0 && !deriveConditionEffects(loaded.state).incapacitated && !deathStateOf(c.character.deathState).dead;
    return { combatId, combatVersion: c.combat.version, characterVersion: c.character.version,
      combatantId: c.unit.id, definition: c.definition, remaining: c.resource.remaining, canUse: !!canUse };
  }, { isolationLevel: 'RepeatableRead' });
}
function assertDecisions(actor: Actor, decisions: unknown[] | undefined) {
  if (actor.role !== 'MASTER' && decisions?.length) throw new HttpError('Somente o Mestre decide exceções espaciais.', 403, 'FORBIDDEN');
}
export async function previewBreath(actor: Actor, input: z.infer<typeof breathPreviewSchema>) {
  assertDecisions(actor, input.placement.decisions);
  return prisma.$transaction(async db => {
    const c = await context(db, actor, input.combatId);
    const reading = abilityAreaPlan(c.combat, c.unit, c.definition, input.placement).reading;
    const visible = new Set(c.combat.combatants.filter(u => actor.role === 'MASTER' || u.spatialVisibility !== 'master-only' || u.characterId === c.character.id).map(u => u.id));
    return { ...reading, candidates: reading.candidates.filter(row => visible.has(row.combatantId)).map(row => ({ ...row, overrideAllowed: actor.role === 'MASTER' && row.overrideAllowed })) };
  }, { isolationLevel: 'RepeatableRead' });
}
export async function useBreath(actor: Actor, input: z.infer<typeof breathUseSchema>) {
  assertDecisions(actor, input.placement.decisions);
  const owner = await prisma.character.findUnique({ where: { userId: actor.userId } });
  if (!owner) throw new HttpError('Esta ficha ainda não foi criada.', 404);
  const key = { characterId_operationId: { characterId: owner.id, operationId: input.operationId } };
  const fingerprint = createHash('sha256').update(JSON.stringify({ role: actor.role, combatId: input.combatId, placement: input.placement })).digest('hex');
  const replay = (previous: { type: string; requestFingerprint: string; result: unknown }) => {
    if (previous.type !== TYPE || previous.requestFingerprint !== fingerprint) throw new HttpError('Chave já utilizada em outra operação.', 409, 'IDEMPOTENCY_KEY_REUSED');
    return { ...(previous.result as { combat: ReturnType<typeof toCombatDto>; areaUseId: string }), replayed: true };
  };
  const previous = await prisma.characterOperation.findUnique({ where: key });
  if (previous) return replay(previous);
  let result: { combat: ReturnType<typeof toCombatDto>; areaUseId: string; replayed: boolean };
  try {
    result = await prisma.$transaction(async db => {
      const previous = await db.characterOperation.findUnique({ where: key });
      if (previous) return replay(previous);
      const locked = await db.combat.updateMany({ where: { id: input.combatId, version: input.expectedCombatVersion, status: 'ACTIVE' }, data: { version: { increment: 1 } } });
      if (locked.count !== 1) throw new HttpError('O combate mudou; confira a área novamente.', 409, 'CONFLICT');
      const c = await context(db, actor, input.combatId);
      if (c.character.version !== input.expectedVersion) throw new HttpError('A ficha mudou; confira o Sopro novamente.', 409, 'CONFLICT');
      if (c.resource.remaining < 1) throw new HttpError('O Sopro recupera no descanso curto ou longo.', 409, 'INSUFFICIENT_RESOURCE');
      const loaded = await loadEntity({ kind: 'character', id: c.character.id }, db);
      if (loaded.hpCurrent <= 0 || deathStateOf(c.character.deathState).dead || deriveConditionEffects(loaded.state).incapacitated) throw new HttpError('O personagem não pode usar o Sopro neste estado.', 409, 'FEATURE_INCAPACITATED');
      const turn = await castingTurnContext(db, loaded);
      if (!turn?.isCasterTurn) throw new HttpError('Aguarde seu turno.', 409, 'FEATURE_OUT_OF_TURN');
      await commitCastingEconomy(db, turn, 'action');
      const state = normalizeRacialState(c.character.racialState);
      state.used['breath-weapon'] = c.resource.used + 1;
      const written = await db.character.updateMany({ where: { id: c.character.id, version: input.expectedVersion }, data: { racialState: state as unknown as Prisma.InputJsonValue, version: { increment: 1 } } });
      if (written.count !== 1) throw new HttpError('A ficha mudou; nenhum uso foi consumido.', 409, 'CONFLICT');
      const areaUseId = await beginAreaAbilityUse(db, c.combat, c.unit, c.definition, input.placement);
      await appendCombatJournal({ combatId: c.combat.id, actorName: c.character.name, action: TYPE, message: 'Arma de Sopro — salvaguardas da área solicitadas.' }, db);
      const snapshot = { combat: toCombatDto(await loadCombatById(c.combat.id, db), actor.role), areaUseId, replayed: false };
      await db.characterOperation.create({ data: { characterId: c.character.id, operationId: input.operationId, type: TYPE, requestFingerprint: fingerprint, result: snapshot as unknown as Prisma.InputJsonValue } });
      return snapshot;
    });
  } catch (error) {
    const previous = await prisma.characterOperation.findUnique({ where: key });
    if (previous) return replay(previous);
    if (['P2034', 'P2002'].includes((error as { code?: string }).code ?? '')) throw new HttpError('Operação concorrente; confira a área novamente.', 409, 'CONFLICT');
    throw error;
  }
  if (!result.replayed) {
    try { await publishCharacter(owner.id); await publishCreatureAreaUse(result.areaUseId); await refreshCombatForEffects(); }
    catch (error) { console.error('[Sopro] falha de notificação após commit:', error); }
  }
  return result;
}
/** O marcador legado fica disponível fora de combate, sem simular dano. */
export async function assertBreathManualUseAllowed(actor: { userId: string }) {
  const participant = await prisma.combatant.findFirst({ where: { character: { userId: actor.userId }, combat: { status: { in: ['ACTIVE', 'PENDING_INITIATIVE'] } } } });
  if (participant) throw new HttpError('Prepare a Arma de Sopro no grid para executar a área.', 409, 'BREATH_AREA_REQUIRED');
}
