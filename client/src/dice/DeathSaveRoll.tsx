import { playDice } from '../sound';
import { useLayoutEffect, useMemo, type CSSProperties } from 'react';
import { Die3D } from './Die3D';
import { rollAnimationMs } from './rollAnimation';

/** Uma peça contínua entre arremesso e pouso, sem recriar o dado ao revelar. */
export function DeathSaveRoll({
  value,
  rolling,
  settled,
  startedAt,
  audioRollId,
}: {
  value: number | null;
  rolling: boolean;
  settled: boolean;
  startedAt?: number;
  audioRollId?: string;
}) {
  const animating = rolling && value !== null;
  const delay = useMemo(() => startedAt && animating ? -Math.max(0, Date.now() - startedAt) : 0, [startedAt, animating]);
  useLayoutEffect(() => {
    if (!animating || !audioRollId) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { playDice({ rollId: audioRollId }); return; }
    const duration = rollAnimationMs('death-save');
    playDice({ rollId: audioRollId, animationStartMs: performance.now() + delay, durationMs: duration,
      cues: [.28, .38, .52, .66, .78, .88].map((progress, index) => ({ atMs: duration * progress, strength: .85 * Math.pow(.67, index) })) });
  }, [animating, audioRollId, delay]);
  return (
    <div
      className={`death-save-roll${animating ? ' is-tumbling' : ''}${settled ? ' is-settled' : ''}`}
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
          tumbling={animating}
          locked
        />
      </span>
    </div>
  );
}
