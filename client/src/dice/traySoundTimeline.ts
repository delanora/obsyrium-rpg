import type { PoseDado } from './trayPhysics';
import { COMMON_THROW_MS } from './rollAnimation';
import type { DiceSoundCue } from './diceSound';

/** Contatos observados na trajetória já usada pela animação; não roda outra física. */
export function traySoundTimeline(simulation: {
  quadros: PoseDado[][];
  contatos: { atMs: number; intensidade: number }[];
}, radius: number, durationMs: number): DiceSoundCue[] {
  const cues: DiceSoundCue[] = [{ atMs: COMMON_THROW_MS, strength: .85 }];
  for (const contact of simulation.contatos) {
    if (contact.intensidade > .025) cues.push({ atMs: COMMON_THROW_MS + contact.atMs, strength: contact.intensidade });
  }
  let distance = 0;
  for (let frame = 1; frame < simulation.quadros.length; frame += 1) {
    const previous = simulation.quadros[frame - 1], current = simulation.quadros[frame];
    const step = current.reduce((sum, point, index) => sum + Math.hypot(point.x - previous[index].x, point.y - previous[index].y), 0) / Math.max(1, current.length);
    distance += step;
    if (distance < radius * 1.2) continue;
    distance %= radius * 1.2;
    const elapsed = frame / (simulation.quadros.length - 1) * durationMs;
    const speed = step / (durationMs / (simulation.quadros.length - 1) / 1000);
    // As faces que passam pelo piso soam mais baixas que uma colisão com o aro.
    cues.push({ atMs: COMMON_THROW_MS + elapsed, strength: Math.min(.14, speed / 3.8 * .14) });
  }
  const merged: DiceSoundCue[] = [];
  for (const cue of cues.sort((a, b) => a.atMs - b.atMs)) {
    const last = merged.at(-1);
    if (last && cue.atMs - last.atMs < 35) {
      if (cue.strength > last.strength) Object.assign(last, cue);
    } else merged.push({ ...cue });
  }
  return merged;
}
