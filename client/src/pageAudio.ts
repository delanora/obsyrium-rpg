/** Preferência local de escuta: não altera o volume compartilhado da mesa. */
const VOLUME_KEY = 'grimorio.volume', MUTE_KEY = 'grimorio.muted';
export interface PageAudioSettings { volume: number; muted: boolean }
function read(): PageAudioSettings {
  try {
    const saved = localStorage.getItem(VOLUME_KEY), value = saved === null ? 1 : Number(saved);
    return { volume: Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1, muted: localStorage.getItem(MUTE_KEY) === 'true' };
  } catch { return { volume: 1, muted: false }; }
}
let settings = read();
const listeners = new Set<(value: PageAudioSettings) => void>();
const outputs = new Map<BaseAudioContext, GainNode>();
export function getPageAudioSettings(): PageAudioSettings { return { ...settings }; }
export function subscribePageAudio(listener: (value: PageAudioSettings) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function notify() {
  const level = settings.muted ? 0 : settings.volume;
  for (const [audio, output] of outputs) {
    if (audio.state === 'closed') { outputs.delete(audio); continue; }
    output.gain.cancelScheduledValues(audio.currentTime);
    output.gain.setTargetAtTime(level, audio.currentTime, .025);
  }
  for (const listener of listeners) listener(getPageAudioSettings());
}
export function setPageVolume(value: number) {
  if (!Number.isFinite(value)) return;
  settings = { ...settings, volume: Math.max(0, Math.min(1, value)) };
  try { localStorage.setItem(VOLUME_KEY, String(settings.volume)); } catch { /* A sessão continua sem persistência. */ }
  notify();
}
export function setPageMuted(muted: boolean) {
  settings = { ...settings, muted };
  try { localStorage.setItem(MUTE_KEY, String(muted)); } catch { /* A sessão continua sem persistência. */ }
  notify();
}
/** Ganho mestre após os envelopes individuais: regula também sons já em execução. */
export function pageAudioDestination(audio: BaseAudioContext): AudioNode {
  let output = outputs.get(audio);
  if (!output) {
    output = audio.createGain(); output.gain.value = settings.muted ? 0 : settings.volume;
    output.connect(audio.destination); outputs.set(audio, output);
    audio.addEventListener?.('statechange', () => { if (audio.state === 'closed') outputs.delete(audio); });
  }
  return output;
}
if (typeof window !== 'undefined') window.addEventListener?.('storage', event => {
  if (event.key === VOLUME_KEY || event.key === MUTE_KEY || event.key === null) { settings = read(); notify(); }
});
