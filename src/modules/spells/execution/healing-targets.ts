import { HttpError } from '../../../lib/http-error.js';
import { deathStateOf } from '../../shared/death.js';
import type { SpellValidationContext } from './spell-execution-definition.js';

/** Cura comum não ressuscita: recusa mortos antes de gastar a conjuração. */
export async function assertLivingHealingTargets(
  context: Pick<SpellValidationContext, 'db' | 'targets'>,
  label: string,
): Promise<void> {
  for (const target of context.targets) {
    if (target.entity.kind === 'character') {
      const row = await context.db.character.findUnique({
        where: { id: target.entity.id },
        select: { deathState: true },
      });
      if (!row) throw new HttpError('Personagem não encontrado.', 404);
      if (deathStateOf(row.deathState).dead) {
        throw new HttpError(
          `Uma criatura morta não pode ser alvo de ${label}.`,
          400,
          'SPELL_TARGET_DEAD',
        );
      }
      continue;
    }
    if (target.entity.kind === 'combatant') {
      const row = await context.db.combatant.findUnique({
        where: { id: target.entity.id },
        select: { deathState: true },
      });
      if (!row) throw new HttpError('Combatente não encontrado.', 404);
      if (deathStateOf(row.deathState).dead) {
        throw new HttpError(
          `Uma criatura morta não pode ser alvo de ${label}.`,
          400,
          'SPELL_TARGET_DEAD',
        );
      }
    }
    // Criatura solta do bestiário: sem ciclo de morte canônico, alvo válido.
  }
}
