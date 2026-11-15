import type { CSSProperties } from 'react';
import type { DiceRollDto } from '../types';
import { Die3D } from './Die3D';
import type { DicePoolDie } from './useDiceRoller';
import { rollAnimationMs } from './rollAnimation';

/** Mantém as mesmas peças entre espera, arremesso e resultado do servidor. */
export function CommonDicePool({ pool, result, rolling, settled, extraD20, removeDie }: {
  pool: DicePoolDie[];
  result: DiceRollDto | null;
  rolling: boolean;
  settled: boolean;
  extraD20: number;
  removeDie?: (index: number) => void;
}) {
  const dados = result?.dice ?? [
    ...pool.map(die => ({ ...die, value: null, dropped: false })),
    ...(rolling ? Array.from({ length: extraD20 }, () => ({ sides: 20, value: null, dropped: false })) : []),
  ];
  return dados.length === 0 ? <p className="dice-ring-hint">Escolha os dados abaixo</p> : dados.map((die, index) => (
    <span className="common-die-slot" key={index} style={{ '--common-roll-duration': `${rollAnimationMs()}ms`, '--common-roll-direction': index % 2 ? -1 : 1 } as CSSProperties}>
      <Die3D
        appearance="ivory"
        sides={die.sides}
        value={die.value}
        reveal={settled}
        tumbling={rolling && result !== null}
        dropped={settled && die.dropped}
        locked={pool[index]?.locked}
        onClick={!rolling && !settled && !pool[index]?.locked && removeDie ? () => removeDie(index) : undefined}
      />
    </span>
  ));
}
