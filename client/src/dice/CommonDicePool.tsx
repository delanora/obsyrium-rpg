import { useTrayPhysics } from './useTrayPhysics';
import type { DiceRollDto } from '../types';
import { Die3D } from './Die3D';
import type { DicePoolDie } from './useDiceRoller';

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
  const pecas = dados.flatMap<{ sides: number; value: number | null; dropped?: boolean; index: number; percentile?: 'tens' | 'units' }>((die, index) => {
    const base = { dropped: die.dropped, index };
    if (die.sides !== 100) return [{ ...base, sides: die.sides, value: die.value, percentile: undefined }];
    const percentual = (die.value ?? 100) % 100;
    return [
      { ...base, sides: 10, value: Math.floor(percentual / 10) || 10, percentile: 'tens' as const },
      { ...base, sides: 10, value: percentual % 10 || 10, percentile: 'units' as const },
    ];
  });
  const arena = useTrayPhysics(pecas.length, rolling && result !== null, result?.id);
  return <div className="common-dice-pool" ref={arena}>{pecas.length === 0 ? <p className="dice-ring-hint">Escolha os dados abaixo</p> : pecas.map((die, index) => (
    <span className="common-die-slot" key={index}>
      <Die3D
        appearance="ivory"
        sides={die.sides}
        percentile={die.percentile}
        value={die.value}
        reveal={settled}
        tumbling={rolling && result !== null}
        dropped={settled && die.dropped}
        locked={pool[die.index]?.locked}
        title={die.percentile ? 'd100: dezenas e unidades (00 + 0 = 100)' : undefined}
        onClick={!rolling && !settled && !pool[die.index]?.locked && removeDie ? () => removeDie(die.index) : undefined}
      />
    </span>
  ))}</div>;
}
