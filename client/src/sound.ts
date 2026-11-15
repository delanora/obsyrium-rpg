import { getPageAudioSettings, pageAudioDestination, setPageMuted, subscribePageAudio } from './pageAudio';
import { playRecordedDice, prepareDiceSound, stopDiceSound, audioTimeForPerformance, trackDiceSource, type DiceSoundOptions } from './dice/diceSound';
/**
 * Efeitos sonoros da mesa.
 *
 * Os dados usam recortes da referência enviada pelo usuário; os demais efeitos
 * são sintetizados com Web Audio. O navegador só libera o áudio depois de
 * uma interação do usuário, então o contexto é retomado sob demanda.
 */


let context: AudioContext | null = null;
let muteVersion = 0;
const playedDiceRolls = new Set<string>();
let muted = getPageAudioSettings().muted;
subscribePageAudio(value => { muted = value.muted; });

/** Assinatura local do mesmo controle de som, sem notificar mudanças só de volume. */
export function subscribeMuted(listener: (value: boolean) => void): () => void {
  let previous = muted;
  return subscribePageAudio(value => { if (value.muted !== previous) { previous = value.muted; listener(value.muted); } });
}

type AudioContextCtor = typeof AudioContext;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!context) {
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;

    if (!Ctor) return null;
    context = new Ctor();
  }

  if (context.state === 'suspended') void context.resume();
  return context;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  muteVersion += 1;
  setPageMuted(value);
  if (value) stopDiceSound();
  else { const audio = getContext(); if (audio) void prepareDiceSound(audio).catch(() => {}); }
}

/** Retorna o novo estado (útil para atualizar o botão). */
export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

/** Um tom simples, com envelope para não estalar. */
function playTone(
  audio: AudioContext,
  frequency: number,
  at: number,
  duration: number,
  options: { type?: OscillatorType; gain?: number; sweepTo?: number } = {},
): void {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = options.type ?? 'sine';
  oscillator.frequency.setValueAtTime(frequency, at);

  if (options.sweepTo) {
    oscillator.frequency.exponentialRampToValueAtTime(options.sweepTo, at + duration);
  }

  const peak = options.gain ?? 0.08;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  oscillator.connect(gain).connect(pageAudioDestination(audio));
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

/** Estalo curto de ruído — o "clique" dos dados batendo na mesa. */
function playClick(audio: AudioContext, at: number, duration: number, peak: number, tracked = false): void {
  const size = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, size, audio.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < size; i += 1) {
    // Ruído branco com decaimento linear.
    data[i] = (Math.random() * 2 - 1) * (1 - i / size);
  }

  const source = audio.createBufferSource();
  source.buffer = buffer;

  const filter = audio.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1500;

  const gain = audio.createGain();
  gain.gain.setValueAtTime(peak, at);

  source.connect(filter).connect(gain).connect(pageAudioDestination(audio));
  if (tracked) trackDiceSource(source, () => { source.disconnect(); filter.disconnect(); gain.disconnect(); });
  source.start(at);
}

/** Som gravado de dados na bandeja; conserva uma alternativa sintetizada sem rede. */
export function playDice(options: DiceSoundOptions = {}): void {
  if (options.rollId) {
    if (playedDiceRolls.has(options.rollId)) return;
    playedDiceRolls.add(options.rollId);
    if (playedDiceRolls.size > 200) playedDiceRolls.delete(playedDiceRolls.values().next().value!);
  }
  if (muted) return;
  const audio = getContext();
  if (!audio) return;
  const requestedAt = audio.currentTime;
  const version = muteVersion;
  void playRecordedDice(audio, options, () => muted).catch(() => {
    if (muted || version !== muteVersion || audio.state !== 'running') return;
    if (options.cues) {
      for (const cue of options.cues) {
        const target = options.animationStartMs !== undefined ? audioTimeForPerformance(audio, options.animationStartMs + cue.atMs) : requestedAt + cue.atMs / 1000;
        if (audio.currentTime - target > .035) continue;
        playClick(audio, Math.max(audio.currentTime, target), .04, .05 * cue.strength, true);
      }
      return;
    }
    const end = requestedAt + (options.durationMs ?? 550) / 1000;
    const now = Math.max(audio.currentTime, requestedAt + (options.contactDelayMs ?? 0) / 1000);
    if (now + .12 > end) return;
    for (let i = 0; i < 6; i += 1) {
      const at = now + i * .045 + Math.random() * .02;
      if (at + .04 <= end) playClick(audio, at, .04, .05, true);
    }
  });
}

/** Fanfarra curta para um 20 natural. */
export function playCrit(): void {
  const audio = getContext();
  if (!audio || muted) return;

  const now = audio.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
    playTone(audio, frequency, now + index * 0.07, 0.22, { type: 'triangle', gain: 0.07 });
  });
}

/** Aviso CURTO de turno (criatura/NPC do Mestre): dois toques discretos. */
export function playTurn(): void {
  const audio = getContext();
  if (!audio || muted) return;

  const now = audio.currentTime;
  playTone(audio, 587.33, now, 0.18, { type: 'sine', gain: 0.1 });
  playTone(audio, 880, now + 0.13, 0.32, { type: 'sine', gain: 0.1 });
}

/**
 * CHAMADO DE BATALHA — o seu turno chegou.
 *
 * Bem mais presente que o aviso curto: dois tambores graves (ruído + queda de
 * frequência), uma corneta ascendente em terças e um brilho final. Tudo
 * sintetizado, sem arquivo de áudio; respeita o mudo global como os demais.
 */
export function playTurnHorn(): void {
  const audio = getContext();
  if (!audio || muted) return;

  const now = audio.currentTime;

  // Tambores: golpe de pele (ruído curto) + corpo grave caindo.
  playClick(audio, now, 0.1, 0.34);
  playTone(audio, 96, now, 0.3, { type: 'triangle', gain: 0.16, sweepTo: 48 });
  playClick(audio, now + 0.24, 0.1, 0.28);
  playTone(audio, 84, now + 0.24, 0.32, { type: 'triangle', gain: 0.14, sweepTo: 42 });

  // Corneta: uma terça maior subindo, com corpo de palheta.
  [392, 493.88, 587.33].forEach((frequency, index) => {
    playTone(audio, frequency, now + 0.46 + index * 0.09, 0.42, {
      type: 'square',
      gain: 0.045,
    });
  });
  playTone(audio, 587.33, now + 0.78, 0.72, { type: 'triangle', gain: 0.09 });

  // Fecho: o brilho do aço.
  playTone(audio, 1174.66, now + 0.84, 0.5, { type: 'sine', gain: 0.05, sweepTo: 1567.98 });
}

/** Um gesto do usuário em qualquer lugar libera o áudio para o resto da sessão. */
export function unlockAudioOnFirstGesture(): void {
  if (typeof document === 'undefined') return;

  const unlock = (): void => {
    const audio = getContext();
    if (audio && !muted) void prepareDiceSound(audio).catch(() => {});
    document.removeEventListener('click', unlock);
    document.removeEventListener('keydown', unlock);
  };

  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}
