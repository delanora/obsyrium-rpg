import type { DiceRollKind } from '../types';

/** Só apresentação: o resultado e o ciclo de morte continuam no servidor. */
export function rollAnimationMs(kind?: DiceRollKind): number {
  return kind === 'death-save' ? 2100 : kind === 'creation' ? 1150 : 2900;
}

/** Preparação aérea antes de tocar a superfície da bandeja comum. */
export const COMMON_THROW_MS = 650;
