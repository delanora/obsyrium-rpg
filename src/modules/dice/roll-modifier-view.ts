import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../lib/http-error.js';
import { toCharacterDto } from '../characters/characters.dto.js';
import { ABILITY_LABELS, SKILLS, abilityModifier, halfProficiencyForAbility, type AbilityKey } from '../shared/dnd5e.js';
import { CONDITION_LABELS, deriveConditionEffects, mechanicalStateOf, deriveSaveEffects, type MechanicalEntity } from '../shared/conditions.js';
import { publicEffectLabel, emptyRollModifiers, rollModifiersFor, toOptionalModifierDtos, type EffectRollModifiers } from '../effects/effect-modifiers.js';
import { effectModifierSetFor } from '../effects/effects.service.js';
import { getMechanicalState } from '../mechanical/mechanical.service.js';
import { loadPendingEffectSaveForRoll } from '../effects/hold-person.service.js';
import { loadConcentrationTarget, concentrationSaveBonus } from '../concentration/concentration.service.js';
import { entityHasWarCaster } from '../mechanical/war-caster.service.js';
import { savingThrowBonus } from '../shared/saving-throws.js';
import { requestedTestDefinition, type RequestedTestKind } from '../shared/requested-tests.js';
import { dodgeBenefitForSave, tableRollMode } from './roll-mode.js';
import type { TableRollInput } from './dice.schema.js';
import type { DiceActor } from './dice.service.js';
import type { RollModifierCard, RollModifierView } from '../shared/roll-modifier-view.js';

interface ExplanationContext {
  entity?: MechanicalEntity | null; ability?: AbilityKey; kind: string; baseBonus: number;
  mods: EffectRollModifiers; mode: { advantage: boolean; disadvantage: boolean; autoFail: boolean };
  state: unknown; selected?: string[]; skillKey?: string; toolKey?: string;
  cover?: number; dodge?: boolean; warCaster?: boolean; manualAdvantage?: boolean; manualDisadvantage?: boolean;
  includeOptions?: boolean;
}

/** Decompõe somente um total que confere com a ficha; nunca inventa a origem de um ajuste manual. */
async function baseCards(input: ExplanationContext): Promise<Omit<RollModifierCard, 'id'>[]> {
  const { entity, ability, baseBonus } = input;
  const fallback = () => baseBonus ? [{ kind: 'flat' as const, label: 'Bônus do teste', detail: 'Valor definido para esta rolagem', value: baseBonus, applied: true }] : [];
  if (!entity || !ability) return fallback();
  const unit = entity.kind === 'combatant' ? await prisma.combatant.findUnique({ where: { id: entity.id }, include: { character: true, creature: true } }) : null;
  const character = entity.kind === 'character' ? await prisma.character.findUnique({ where: { id: entity.id } }) : unit?.character;
  if (!character) {
    const creature = entity.kind === 'creature' ? await prisma.creature.findUnique({ where: { id: entity.id } }) : unit?.creature;
    return creature && abilityModifier(creature[ability]) === baseBonus
      ? [{ kind: 'flat', label: ABILITY_LABELS[ability], detail: 'Modificador do atributo', value: baseBonus, applied: true }] : fallback();
  }
  const dto = toCharacterDto(character), derived = dto.derived;
  const cards: Omit<RollModifierCard, 'id'>[] = [{ kind: 'flat', label: ABILITY_LABELS[ability], detail: 'Modificador do atributo', value: derived.modifiers[ability], applied: true }];
  const add = (label: string, value: number, detail: string) => { if (value) cards.push({ kind: 'flat', label, value, detail, applied: true }); };
  if (input.kind === 'save' || input.kind === 'concentration') {
    if (derived.saves.find(save => save.ability === ability)?.proficient) add('Proficiência', derived.proficiencyBonus, 'Treinamento em salvaguardas');
    add(dto.classAdjustments.saveBonusLabel || 'Características da ficha', derived.saveBonus, 'Bônus de salvaguarda');
  } else if (input.skillKey) {
    const skill = SKILLS.find(item => item.key === input.skillKey && item.ability === ability);
    if (!skill) return fallback();
    const entry = derived.skills[skill.key];
    if (entry.proficient) {
      add('Proficiência', derived.proficiencyBonus, skill.label);
      if (entry.expertise) add('Especialização', derived.proficiencyBonus, 'Proficiência adicional em ' + skill.label);
    } else add('Meia proficiência', entry.total - entry.modifier, 'Característica de classe');
  } else if (input.toolKey) {
    const tool = dto.tools.find(item => item.id === input.toolKey);
    if (!tool) return fallback();
    add('Proficiência', derived.proficiencyBonus, tool.name);
    const expertise = dto.expertiseSkills.some(key => key.startsWith('tool:') && key.slice(5).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === tool.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    if (expertise) add('Especialização', derived.proficiencyBonus, tool.name);
  } else {
    const half = halfProficiencyForAbility(dto.classAdjustments.halfProficiency, derived.proficiencyBonus, ability);
    if (baseBonus === derived.modifiers[ability] + half) add('Meia proficiência', half, 'Característica de classe');
  }
  return cards.reduce((sum, card) => sum + (card.value ?? 0), 0) === baseBonus ? cards : fallback();
}

/** Só explica os dados já usados pelo pipeline; não gasta recursos, não rola dados e não aplica efeitos. */
export async function describeRollModifiers(input: ExplanationContext): Promise<RollModifierView> {
  let cards: Omit<RollModifierCard, 'id'>[];
  try { cards = await baseCards(input); }
  catch { cards = input.baseBonus ? [{ kind: 'flat', label: 'Bônus do teste', detail: 'Bônus base', value: input.baseBonus, applied: true }] : []; }
  const { mods, mode } = input;
  for (const contribution of mods.contributions ?? []) {
    const kind = contribution.kind === 'roll-flat' ? 'flat' : contribution.kind === 'roll-dice' ? 'dice' : contribution.kind === 'roll-advantage' ? 'advantage' : 'disadvantage';
    cards.push({ kind, label: publicEffectLabel(contribution.source) ?? 'Efeito', detail: 'Efeito ativo',
      value: contribution.value, count: contribution.count, sides: contribution.sides, sign: contribution.sign, applied: true });
  }
  let optionalBonus = 0;
  for (const option of mods.optional) {
    const selected = input.selected?.includes(option.id) ?? false;
    if (!selected && !input.includeOptions) continue;
    cards.push({ kind: option.kind === 'roll-flat' ? 'flat' : 'dice', label: option.label, detail: selected ? 'Efeito opcional selecionado' : 'Efeito opcional',
      value: option.value, count: option.count, sides: option.sides, sign: option.sign, applied: selected,
      ...(input.includeOptions ? { optionId: option.id } : {}) });
    if (selected && option.kind === 'roll-flat') optionalBonus += option.value ?? 0;
  }
  const addMode = (kind: 'advantage' | 'disadvantage', label: string, detail = 'Automática') => cards.push({ kind, label, detail, applied: true });
  if (input.manualAdvantage) addMode('advantage', 'Escolha na bandeja', 'Vantagem manual');
  if (input.manualDisadvantage) addMode('disadvantage', 'Escolha na bandeja', 'Desvantagem manual');
  if (input.dodge && input.ability === 'dexterity') addMode('advantage', 'Esquiva');
  if (input.warCaster) addMode('advantage', 'Conjurador de Guerra');
  const state = mechanicalStateOf(input.state), effects = deriveConditionEffects(state);
  const conditionName = (name: string) => input.entity?.kind === 'character' ? name : 'Condição ativa';
  if (input.kind === 'skill' && effects.checkDisadvantage) {
    if (state.conditions.some(item => item.condition === 'poisoned') && !effects.poisonSuspended) addMode('disadvantage', conditionName(CONDITION_LABELS.poisoned));
    if (state.exhaustionLevel >= 1) addMode('disadvantage', conditionName('Exaustão'));
  }
  if (input.kind === 'save' || input.kind === 'concentration') {
    if (effects.saveDisadvantage) addMode('disadvantage', conditionName('Exaustão'));
    if (input.ability === 'dexterity' && effects.dexSaveDisadvantage) addMode('disadvantage', conditionName('Contido'));
  }
  if (input.cover) cards.push({ kind: 'flat', label: 'Cobertura', detail: 'Bônus da salvaguarda', value: input.cover, applied: true });
  for (const card of cards) {
    if (card.kind === 'advantage' || card.kind === 'disadvantage') {
      card.applied = !mode.autoFail && (card.kind === 'advantage' ? mode.advantage : mode.disadvantage);
      if (!card.applied) card.detail = mode.autoFail ? 'Não se aplica: falha automática' : 'Anulada por fonte oposta';
    } else if (mode.autoFail) { card.applied = false; card.detail = 'Não se aplica: falha automática'; }
  }
  if (mode.autoFail) cards.push({ kind: 'failure', label: 'Condição ativa', detail: 'Falha automática; não há rolagem', applied: true });
  return { cards: cards.map((card, index) => ({ ...card, id: String(index) })),
    bonus: input.baseBonus + (mode.autoFail ? 0 : mods.bonus + optionalBonus + (input.cover ?? 0)), ...mode };
}

/** Leitura autorizada para a bandeja; as pendências fixam entidade, atributo e bônus. */
export async function previewRollModifiers(actor: DiceActor, input: TableRollInput) {
  let entity = input.entity, ability = input.ability, kind = input.kind ?? 'free', baseBonus = input.bonus ?? 0;
  let skillKey = input.skillKey, cover = 0, warCaster = false;
  if (kind === 'death-save') return { view: { cards: [], bonus: 0, advantage: false, disadvantage: false, autoFail: false }, options: [] };
  if (input.pendingCombatTestId) {
    const request = await prisma.combatTestRequest.findUnique({ where: { id: input.pendingCombatTestId }, include: { combat: true, combatant: { include: { character: true, creature: true } } } });
    if (!request || request.status !== 'pending' || request.combat.status === 'ENDED') throw new HttpError('Solicitação indisponível.', 409);
    const definition = requestedTestDefinition(request.kind as RequestedTestKind, request.key);
    if (!definition) throw new HttpError('Teste inválido.', 400);
    entity = request.combatant.characterId ? { kind: 'character', id: request.combatant.characterId } : { kind: 'combatant', id: request.combatantId };
    await getMechanicalState(actor, entity);
    ability = definition.ability; kind = request.kind === 'save' ? 'save' : 'skill'; skillKey = request.kind === 'skill' ? request.key : undefined;
    if (kind === 'save') baseBonus = await savingThrowBonus(entity, ability);
    else if (request.combatant.character) {
      const dto = toCharacterDto(request.combatant.character);
      baseBonus = request.kind === 'skill' ? dto.derived.skills[request.key].total : dto.derived.modifiers[ability] + halfProficiencyForAbility(dto.classAdjustments.halfProficiency, dto.derived.proficiencyBonus, ability);
    } else baseBonus = abilityModifier(request.combatant.creature![ability]);
  } else if (input.pendingEffectSaveId) {
    const pending = await loadPendingEffectSaveForRoll(actor, input.pendingEffectSaveId);
    entity = pending.targetEntity; ability = pending.pending.ability; kind = 'save';
    baseBonus = await savingThrowBonus(entity, ability);
    const stored = pending.pending.cover as { bonus?: unknown } | null;
    if (ability === 'dexterity' && typeof stored?.bonus === 'number') cover = Math.max(0, Math.min(5, Math.trunc(stored.bonus)));
  } else if (kind === 'concentration') {
    if (!entity) throw new HttpError('Informe o alvo.', 400);
    await getMechanicalState(actor, entity);
    const target = await loadConcentrationTarget(entity);
    const pending = target.state.pendingConcentrationSaves.find(item => item.id === input.pendingConcentrationSaveId);
    if (!pending) throw new HttpError('Teste de concentração indisponível.', 409);
    ability = 'constitution'; baseBonus = await concentrationSaveBonus(entity);
    warCaster = pending.damage > 0 && await entityHasWarCaster(entity);
  }
  const mechanical = entity ? await getMechanicalState(actor, entity) : null;
  entity = mechanical?.entity ?? entity;
  const state = mechanical?.state ?? {};
  const set = entity && (kind === 'skill' || kind === 'save' || kind === 'concentration') ? await effectModifierSetFor(entity) : null;
  const mods = set ? rollModifiersFor(set, kind === 'skill' ? 'check' : 'save', ability) : emptyRollModifiers();
  const dodge = kind === 'save' && !input.pendingConcentrationSaveId ? await dodgeBenefitForSave(entity ?? null, set?.speedBonus ?? 0) : false;
  const manual = kind !== 'concentration' && !input.pendingEffectSaveId;
  const mode = kind === 'concentration'
    ? deriveSaveEffects(state, 'constitution', warCaster ? ['war-caster'] : [], [], { effects: { advantage: mods.advantage, disadvantage: mods.disadvantage } })
    : tableRollMode(kind, ability, state, mods, dodge, manual && input.advantage, manual && input.disadvantage);
  const view = await describeRollModifiers({ entity, ability, kind, baseBonus, mods, mode, state, selected: input.selectedEffectModifiers,
    skillKey, toolKey: input.toolKey, cover, dodge, warCaster, manualAdvantage: manual && input.advantage, manualDisadvantage: manual && input.disadvantage, includeOptions: true });
  return { view, options: toOptionalModifierDtos(mods.optional) };
}
