/** Áudio agendado: contexto simulado, sem alto-falante, rede ou banco reais. */
import assert from 'node:assert/strict';
const storage = new Map<string, string>();
const sources: { starts: number[]; stops: (number | undefined)[]; playbackRate: { value: number }; buffer: unknown }[] = [];
let loads = 0;
let unavailable = true;
const parameter = () => ({ value: 1, cancelScheduledValues() {}, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
class FakeAudioContext {
  currentTime = 10;
  state = 'running';
  sampleRate = 24000;
  destination = {};
  getOutputTimestamp() { return { contextTime: 9.9, performanceTime: 1000 }; }
  resume() { return Promise.resolve(); }
  decodeAudioData(data: ArrayBuffer) { return Promise.resolve({ duration: new Uint8Array(data)[0] ? .105 : .8 }); }
  createBuffer(_channels: number, size: number) { return { getChannelData: () => new Float32Array(size) }; }
  createBiquadFilter() { return { type: 'highpass', frequency: { value: 0 }, connect() { return this; } }; }
  createGain() { return { gain: parameter(), connect() { return this; }, disconnect() {} }; }
  createBufferSource() {
    const source = { starts: [] as number[], stops: [] as (number | undefined)[], playbackRate: { value: 1 }, buffer: null as unknown,
      connect() { return this; }, disconnect() {}, onended: null as unknown,
      start(at: number) { this.starts.push(at); }, stop(at?: number) { this.stops.push(at); } };
    sources.push(source); return source;
  }
}
Object.assign(globalThis, {
  localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
  window: { AudioContext: FakeAudioContext },
  fetch: async (path: string) => { loads += 1; return unavailable ? new Response('', { status: 404 }) : new Response(new Uint8Array([path.includes('contato') ? 1 : 0])); },
});
const { playDice, setMuted } = await import('../src/sound');
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
playDice(); await flush();
assert.equal(sources.length, 6, 'Arquivos indisponíveis mantêm a alternativa sintetizada.');
unavailable = false; sources.length = 0; loads = 0;
const cues = [{ atMs: 650, strength: 1 }, { atMs: 1000, strength: .6 }, { atMs: 1600, strength: .2 }];
playDice({ rollId: 'visual-1', animationStartMs: 1000, durationMs: 2900, cues });
await flush();
assert.equal(loads, 8);
assert.equal(sources.length, 3);
assert.ok(Math.abs(sources[0].starts[0] - 10.55) < .0001, 'Compensa 100 ms de saída do dispositivo.');
assert.ok(sources.every(source => source.starts[0] >= 10.55 && source.stops[0]! <= 12.8));
playDice({ rollId: 'visual-1', animationStartMs: 1000, durationMs: 2900, cues }); await flush();
assert.equal(sources.length, 3, 'Expandir/recriar a mesma rolagem não duplica o som.');
playDice({ rollId: 'antiga', animationStartMs: 0, durationMs: 2900, cues: [{ atMs: 100, strength: 1 }] }); await flush();
assert.equal(sources.length, 3, 'Contatos que já passaram não são reproduzidos atrasados.');
setMuted(true);
assert.ok(sources.every(source => source.stops.at(-1) === undefined), 'Mudo interrompe inclusive impactos futuros.');
playDice(); await flush(); assert.equal(sources.length, 3);
setMuted(false);
playDice({ durationMs: 2100, cues: [{ atMs: 588, strength: 1 }] }); await flush();
assert.equal(loads, 8, 'Os arquivos decodificados são reutilizados.');
assert.equal(sources[3].starts[0], 10.588);
const before = sources.length;
playDice(); setMuted(true); setMuted(false); await flush();
assert.equal(sources.length, before, 'Silenciar cancela a reprodução aguardando carregamento.');
console.log('OK: contatos curtos, relógio visual, compensação de saída, cache, deduplicação, descarte de contatos passados e mudo.');
