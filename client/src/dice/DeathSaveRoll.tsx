import { useMemo, type CSSProperties } from 'react';
import { Die3D } from './Die3D';
import { rollAnimationMs } from './rollAnimation';

/** Uma peça contínua entre arremesso e pouso, sem recriar o dado ao revelar. */
export function DeathSaveRoll({
  value,
  rolling,
  settled,
  startedAt,
}: {
  value: number | null;
  rolling: boolean;
  settled: boolean;
  startedAt?: number;
}) {
  const delay = useMemo(() => startedAt && rolling ? -Math.max(0, Date.now() - startedAt) : 0, [startedAt, rolling]);
  return (
    <div
      className={`death-save-roll${rolling ? ' is-tumbling' : ''}${settled ? ' is-settled' : ''}`}
      style={
        {
          '--death-roll-delay': `${delay}ms`,
          '--death-roll-duration': `${rollAnimationMs('death-save')}ms`,
        } as CSSProperties
      }
    >
      <span className="death-save-shadow" aria-hidden="true" />
      <span className="death-save-flight">
        <Die3D
          appearance="death-save"
          sides={20}
          value={value}
          reveal={settled}
          tumbling={rolling}
          locked
        />
      </span>
    </div>
  );
}
