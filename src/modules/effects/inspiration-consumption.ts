import type { Prisma } from '@prisma/client';
import { HttpError } from '../../lib/http-error.js';
import type { DiceRollDto } from '../dice/dice.dto.js';
import { rollDie } from '../shared/dice.js';
import { BARDIC_INSPIRATION_IDS } from './definitions/bardic-inspiration.js';
import { endEffectInstances } from './effect-lifecycle.js';

/** Uma única aplicação do dado pós-d20 para todos os resolvedores. */
export async function consumeInspirationForRoll(db: Prisma.TransactionClient, characterId: string, expectedVersion: number, effectId: string, original: DiceRollDto): Promise<DiceRollDto> {
  await db.$queryRaw`SELECT id FROM effect_instances WHERE id = ${effectId} FOR UPDATE`;
  const effect = await db.effectInstance.findFirst({ where: { id: effectId, status: 'active', targetEntityKind: 'character', targetEntityId: characterId, definitionId: { in: [...BARDIC_INSPIRATION_IDS] } } });
  if (!effect) throw new HttpError('A Inspiração expirou ou já foi utilizada. Você pode continuar sem ela.', 409, 'INSPIRATION_UNAVAILABLE');
  const changed = await db.character.updateMany({ where: { id: characterId, version: expectedVersion }, data: { version: { increment: 1 } } });
  if (changed.count !== 1) throw new HttpError('A ficha mudou.', 409, 'CONFLICT');
  await endEffectInstances({ id: effect.id }, 'consumed', db);
  const sides = Number(effect.definitionId!.split('.d')[1]);
  const value = rollDie(sides);
  return { ...original, total: original.total + value, effectModifiers: {
    bonus: original.effectModifiers?.bonus ?? 0,
    sources: [...(original.effectModifiers?.sources ?? []), 'Inspiração de Bardo'],
    dice: [...(original.effectModifiers?.dice ?? []), { sides, value, sign: 1, label: 'Inspiração de Bardo' }],
  } };
}
