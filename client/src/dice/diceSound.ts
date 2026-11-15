/** Recortes da referência enviada pelo usuário; o áudio não interfere no resultado. */
export interface DiceSoundCue { atMs: number; strength: number }

export interface DiceSoundOptions {
  rollId?: string;
  animationStartMs?: number;
  cues?: DiceSoundCue[];
  durationMs?: number;
  contactDelayMs?: number;
  diceCount?: number;
}

let decoded: Promise<{ rolls: AudioBuffer[]; impacts: AudioBuffer[] }> | null = null;
let generation = 0;
const activeSources = new Set<AudioBufferSourceNode>();

export function prepareDiceSound(audio: AudioContext) {
  if (!decoded) {
    const load = async (name: string) => {
      const response = await fetch(`/sounds/dados/${name}.wav`);
      if (!response.ok) throw new Error('Som dos dados indisponível.');
      return audio.decodeAudioData(await response.arrayBuffer());
    };
    decoded = Promise.all([load('rolagem-1'), load('rolagem-2'), load('rolagem-3'), load('rolagem-4'), load('contato-1'), load('contato-2'), load('contato-3'), load('contato-4')])
      .then(([a, b, c, d, ...impacts]) => ({ rolls: [a, b, c, d], impacts }))
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
  const synced = options.animationStartMs !== undefined;
  const audioAt = (ms: number) => synced ? audioTimeForPerformance(audio, options.animationStartMs! + ms) : start + ms / 1000;
  const end = audioAt(duration * 1000);

  const play = (buffer: AudioBuffer, target: number, peak: number, contactOnly = false) => {
    if (contactOnly && audio.currentTime - target > .035) return;
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
    trackDiceSource(source, () => { source.disconnect(); gain.disconnect(); });
    source.start(at, offset);
    source.stop(at + remaining);
  };

  if (options.cues) {
    for (const cue of options.cues) {
      play(samples.impacts[Math.floor(Math.random() * samples.impacts.length)], audioAt(cue.atMs), .24 * cue.strength, true);
    }
  } else {
    play(samples.rolls[Math.floor(Math.random() * samples.rolls.length)], start + contact, .24);
  }
}

/** Converte o relógio visual em tempo de saída de áudio, compensando o dispositivo. */
export function audioTimeForPerformance(audio: AudioContext, performanceMs: number): number {
  const timestamp = audio.getOutputTimestamp?.();
  if (timestamp && timestamp.performanceTime && timestamp.contextTime !== undefined) {
    return timestamp.contextTime + (performanceMs - timestamp.performanceTime) / 1000;
  }
  return audio.currentTime + (performanceMs - performance.now()) / 1000 - (audio.baseLatency || 0) - (audio.outputLatency || 0);
}

export function trackDiceSource(source: AudioBufferSourceNode, cleanup: () => void = () => {}) {
  activeSources.add(source);
  source.onended = () => { activeSources.delete(source); cleanup(); };
}
