/** Recortes da referência enviada pelo usuário; o áudio não interfere no resultado. */
export interface DiceSoundOptions {
  durationMs?: number;
  contactDelayMs?: number;
  diceCount?: number;
}

let decoded: Promise<{ rolls: AudioBuffer[]; impact: AudioBuffer }> | null = null;
let generation = 0;
const activeSources = new Set<AudioBufferSourceNode>();

export function prepareDiceSound(audio: AudioContext) {
  if (!decoded) {
    const load = async (name: string) => {
      const response = await fetch(`/sounds/dados/${name}.wav`);
      if (!response.ok) throw new Error('Som dos dados indisponível.');
      return audio.decodeAudioData(await response.arrayBuffer());
    };
    decoded = Promise.all([load('rolagem-1'), load('rolagem-2'), load('rolagem-3'), load('rolagem-4'), load('impacto')])
      .then(([a, b, c, d, impact]) => ({ rolls: [a, b, c, d], impact }))
      .catch(error => { decoded = null; throw error; });
  }
  return decoded;
}

/** Também interrompe impactos que estavam agendados quando o usuário silencia a mesa. */
export function stopDiceSound() {
  generation += 1;
  for (const source of activeSources) {
    try { source.stop(); } catch { /* Uma fonte que já terminou não precisa ser interrompida. */ }
  }
  activeSources.clear();
}

export async function playRecordedDice(audio: AudioContext, options: DiceSoundOptions, isMuted: () => boolean) {
  const currentGeneration = generation;
  const start = audio.currentTime;
  const duration = Math.max(.2, (options.durationMs ?? 550) / 1000);
  const contact = Math.min(duration - .1, Math.max(0, (options.contactDelayMs ?? 0) / 1000));
  const samples = await prepareDiceSound(audio);
  if (isMuted() || currentGeneration !== generation || audio.state !== 'running') return;
  const count = Math.max(1, options.diceCount ?? 1);
  const volume = Math.min(1, .72 + Math.log2(count + 1) * .08);
  const end = start + duration;

  const play = (buffer: AudioBuffer, target: number, peak: number) => {
    if (isMuted()) return;
    const at = Math.max(audio.currentTime, target);
    // Se o carregamento atrasou, acompanha a animação atual sem repetir o começo.
    const rate = .98 + Math.random() * .04;
    const offset = Math.max(0, at - target) * rate;
    const remaining = Math.min((buffer.duration - offset) / rate, end - at);
    if (remaining <= .015) return;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak * volume, at + .002);
    gain.gain.setValueAtTime(peak * volume, at + Math.max(.002, remaining - .012));
    gain.gain.linearRampToValueAtTime(0, at + remaining);
    source.connect(gain).connect(audio.destination);
    source.onended = () => { activeSources.delete(source); source.disconnect(); gain.disconnect(); };
    activeSources.add(source);
    source.start(at, offset);
    source.stop(at + remaining);
  };

  play(samples.rolls[Math.floor(Math.random() * samples.rolls.length)], start + contact, .24);
  // Pequenos contatos cada vez mais discretos acompanham a desaceleração.
  if (duration - contact > 1) {
    [ .45, .63, .79, .90 ].forEach((progress, index) => {
      play(samples.impact, start + contact + (duration - contact) * progress, .07 * Math.pow(.65, index));
    });
  }
}
