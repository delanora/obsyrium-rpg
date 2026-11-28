import { abilityModifier, proficiencyBonus } from '../dnd5e.js';
import { normalizeClassEntries, totalCharacterLevel } from '../classes.js';
import { dragonborn } from './dragonborn.js';
import type { CreatureAbility } from '../creature-abilities.js';
import type { DamageType } from '../attacks.js';

const CONES = new Set(['gold', 'green', 'red', 'silver', 'white']);
const CONSTITUTION = new Set(['green', 'silver', 'white']);
/** PHB 2014; não lê a ancestralidade de Feiticeiro nem a CD de conjuração. */
export function dragonbornBreath(character: {
  raceId: string | null; customRaceId: string | null; raceChoices: unknown;
  constitution: number; classes: unknown;
}): CreatureAbility | null {
  if (character.raceId !== 'dragonborn' || character.customRaceId) return null;
  const choice = (character.raceChoices as Record<string, unknown> | null)?.['draconic-ancestry'];
  const ancestry = dragonborn.hasChoices?.find(c => c.id === 'draconic-ancestry')?.options.find(c => c.id === choice);
  if (!ancestry?.damageType) return null;
  const level = totalCharacterLevel(normalizeClassEntries(character.classes));
  const dice = level >= 16 ? 5 : level >= 11 ? 4 : level >= 6 ? 3 : 2;
  return {
    id: 'breath-weapon', name: 'Arma de Sopro', description: `Ancestralidade: ${ancestry.label}.`,
    cost: 'action', execution: 'area-save-damage', trigger: '', maxUses: 1,
    area: {
      shape: CONES.has(ancestry.id) ? { kind: 'cone', lengthFeet: 15 } : { kind: 'line', lengthFeet: 30, widthFeet: 5 },
      rangeFeet: 0, saveAbility: CONSTITUTION.has(ancestry.id) ? 'constitution' : 'dexterity',
      dc: 8 + proficiencyBonus(level) + abilityModifier(character.constitution),
      onSuccess: 'half', damage: [{ type: ancestry.damageType as DamageType, dice: { count: dice, sides: 6 } }],
    },
  };
}
