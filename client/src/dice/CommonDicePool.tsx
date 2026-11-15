import { Fragment, useEffect, useRef } from 'react';
import { useTrayPhysics } from './useTrayPhysics';
import type { DiceRollDto } from '../types';
import { Die3D } from './Die3D';
import type { DicePoolDie } from './useDiceRoller';

/** Mantém as mesmas peças entre espera, arremesso e resultado do servidor. */
export function CommonDicePool({ pool, result, rolling, settled, extraD20, removeDie, startedAt }: {
  pool: DicePoolDie[];
  result: DiceRollDto | null;
  rolling: boolean;
  settled: boolean;
  extraD20: number;
  startedAt?: number;
  removeDie?: (index: number | number[]) => void;
}) {
  // Aguarda o segundo clique antes de remover a peça, preservando o alvo do duplo clique.
  const clique = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicesPendentes = useRef(new Set<number>());
  const cancelarClique = () => {
    if (clique.current !== null) clearTimeout(clique.current);
    clique.current = null;
  };
  useEffect(() => () => { cancelarClique(); indicesPendentes.current.clear(); }, [pool, result]);
  const removerPendentes = () => {
    const indices = [...indicesPendentes.current];
    indicesPendentes.current.clear();
    clique.current = null;
    removeDie?.(indices);
  };
  const indices = pool.flatMap((die, index) => Array.from({ length: result && die.sides === 20 && (result.advantage || result.disadvantage) ? 2 : 1 }, () => index));
  const dados = result?.dice ?? [
    ...pool.map(die => ({ ...die, value: null, dropped: false })),
    ...(rolling ? Array.from({ length: extraD20 }, () => ({ sides: 20, value: null, dropped: false })) : []),
  ];
  const pecas = dados.flatMap<{ sides: number; value: number | null; dropped?: boolean; index: number; percentile?: 'tens' | 'units' }>((die, index) => {
    const base = { dropped: die.dropped, index: result ? (indices[index] ?? -1) : index };
    if (die.sides !== 100) return [{ ...base, sides: die.sides, value: die.value, percentile: undefined }];
    const percentual = (die.value ?? 100) % 100;
    return [
      { ...base, sides: 10, value: Math.floor(percentual / 10) || 10, percentile: 'tens' as const },
      { ...base, sides: 10, value: percentual % 10 || 10, percentile: 'units' as const },
    ];
  });
  const arena = useTrayPhysics(pecas.length, rolling && result !== null, result?.id, startedAt);
  return <div className="common-dice-pool" ref={arena}>{pecas.length === 0 ? <p className="dice-ring-hint">Escolha os dados abaixo</p> : pecas.map((die, index) => (
    <Fragment key={index}>
    <span className="common-die-shadow" aria-hidden="true" />
    <span className="common-die-slot">
      <Die3D
        appearance="azure"
        sides={die.sides}
        percentile={die.percentile}
        value={die.value}
        reveal={settled}
        tumbling={rolling && result !== null}
        dropped={settled && die.dropped}
        locked={pool[die.index]?.locked}
        title={removeDie && pool[die.index] && !pool[die.index].locked ? `Clique para remover um d${pool[die.index].sides}; duplo clique para remover todos desse tipo` : die.percentile ? 'd100: dezenas e unidades (00 + 0 = 100)' : undefined}
        onClick={pool[die.index] && !pool[die.index].locked && removeDie ? () => {
          cancelarClique();
          indicesPendentes.current.add(die.index);
          clique.current = setTimeout(removerPendentes, 280);
        } : undefined}
        onDoubleClick={pool[die.index] && !pool[die.index].locked && removeDie ? () => {
          cancelarClique();
          pool.forEach((item, index) => {
            if (!item.locked && item.sides === pool[die.index].sides) indicesPendentes.current.add(index);
          });
          removerPendentes();
        } : undefined}
      />
    </span>
    </Fragment>
  ))}</div>;
}
