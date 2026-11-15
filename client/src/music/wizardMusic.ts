import { pageAudioDestination } from '../pageAudio';
/** Ambientação local do assistente; não usa o canal de música compartilhada da mesa. */
export const WIZARD_MUSIC_VOLUME = .07;
export const WIZARD_MUSIC_CROSSFADE = 6;

/** Remove apenas silêncio nas pontas, limitado a oito segundos de cada lado. */
export function musicLoopWindow(buffer: AudioBuffer) {
  const step = Math.max(1, Math.floor(buffer.sampleRate * .05));
  const audible = (from: number) => {
    let energy = 0, count = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = from; i < Math.min(from + step, data.length); i++) { energy += data[i] ** 2; count++; }
    }
    return Math.sqrt(energy / Math.max(1, count)) > .0005;
  };
  const limit = Math.min(buffer.length / 4, buffer.sampleRate * 8);
  let start = 0, end = buffer.length;
  while (start < limit && !audible(start)) start += step;
  while (buffer.length - end < limit && end - step > start && !audible(end - step)) end -= step;
  return { start: start / buffer.sampleRate, duration: (end - start) / buffer.sampleRate };
}

/** Agenda as duas pontas no relógio do áudio: a nova passagem entra antes de a anterior sair. */
export function scheduleMusicPass(audio: BaseAudioContext, buffer: AudioBuffer, destination: AudioNode,
  at: number, window: { start: number; duration: number }, overlap: number) {
  const source = audio.createBufferSource(), envelope = audio.createGain();
  source.buffer = buffer; source.connect(envelope); envelope.connect(destination);
  const fade = Math.min(overlap, window.duration / 4);
  const incoming = new Float32Array(64), outgoing = new Float32Array(64);
  for (let i = 0; i < incoming.length; i++) {
    const angle = i / (incoming.length - 1) * Math.PI / 2;
    incoming[i] = Math.sin(angle); outgoing[i] = Math.cos(angle);
  }
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.setValueCurveAtTime(incoming, at, fade);
  envelope.gain.setValueAtTime(1, at + window.duration - fade);
  envelope.gain.setValueCurveAtTime(outgoing, at + window.duration - fade, fade);
  source.start(at, window.start, window.duration);
  source.onended = () => { source.disconnect(); envelope.disconnect(); };
  return source;
}

export class WizardMusicLoop {
  private output: GainNode;
  private sources = new Set<AudioBufferSourceNode>();
  private timer: ReturnType<typeof setInterval>;
  private nextAt: number;
  private window: { start: number; duration: number };
  private overlap: number;
  constructor(private audio: AudioContext, private buffer: AudioBuffer, muted: boolean) {
    this.output = audio.createGain(); this.output.gain.value = 0; this.output.connect(pageAudioDestination(audio));
    this.window = musicLoopWindow(buffer); this.overlap = Math.min(WIZARD_MUSIC_CROSSFADE, this.window.duration / 4);
    this.nextAt = audio.currentTime + .05;
    this.fill(); this.timer = setInterval(() => this.fill(), 1000); this.setMuted(muted);
  }
  private fill() {
    if (this.nextAt < this.audio.currentTime) this.nextAt = this.audio.currentTime + .05;
    while (this.nextAt < this.audio.currentTime + Math.max(12, this.window.duration)) {
      const source = scheduleMusicPass(this.audio, this.buffer, this.output, this.nextAt, this.window, this.overlap);
      this.sources.add(source);
      source.addEventListener('ended', () => this.sources.delete(source));
      this.nextAt += this.window.duration - this.overlap;
    }
  }
  setMuted(muted: boolean) {
    this.output.gain.cancelScheduledValues(this.audio.currentTime);
    this.output.gain.setTargetAtTime(muted ? 0 : WIZARD_MUSIC_VOLUME, this.audio.currentTime, muted ? .035 : .6);
  }
  stop() {
    clearInterval(this.timer);
    const now = this.audio.currentTime;
    this.output.gain.cancelScheduledValues(now); this.output.gain.setTargetAtTime(0, now, .15);
    setTimeout(() => {
      for (const source of this.sources) { try { source.stop(); } catch { /* A fonte pode já ter terminado. */ } }
      this.sources.clear(); this.output.disconnect(); void this.audio.close().catch(() => {});
    }, 1000);
  }
}
