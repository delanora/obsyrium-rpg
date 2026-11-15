/** Áudio agendado: contexto simulado, sem alto-falante, rede ou banco reais. */
import assert from 'node:assert/strict';
const storage = new Map<string, string>();
const sources: { starts: number[]; stops: (number | undefined)[]; playbackRate: { value: number }; buffer: unknown }[] = [];
let loads = 0;
let unavailable = true;
const parameter = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
class FakeAudioContext {
  currentTime = 10;
  state = 'running';
  sampleRate = 24000;
  destination = {};
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
  fetch: async (path: string) => { loads += 1; return unavailable ? new Response('', { status: 404 }) : new Response(new Uint8Array([path.includes('impacto') ? 1 : 0])); },
});
const { playDice, setMuted } = await import('../src/sound');
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
playDice(); await flush();
assert.equal(sources.length, 6, 'Arquivos indisponíveis mantêm a alternativa sintetizada.');
unavailable = false; sources.length = 0; loads = 0;
playDice({ durationMs: 2900, contactDelayMs: 650, diceCount: 4 });
await flush();
assert.equal(loads, 5);
assert.equal(sources.length, 5);
assert.equal(sources[0].starts[0], 10.65, 'Primeiro contato acompanha a queda.');
assert.ok(sources.every(source => source.starts[0] >= 10.65 && source.stops[0]! <= 12.9));
setMuted(true);
assert.ok(sources.every(source => source.stops.at(-1) === undefined), 'Mudo interrompe inclusive impactos futuros.');
playDice(); await flush(); assert.equal(sources.length, 5);
setMuted(false);
playDice({ durationMs: 2100, contactDelayMs: 0 }); await flush();
assert.equal(loads, 5, 'Os arquivos já decodificados são reutilizados.');
assert.equal(sources[5].starts[0], 10, 'A bandeja de morte começa sem o arremesso da bandeja comum.');
const before = sources.length;
playDice(); setMuted(true); setMuted(false); await flush();
assert.equal(sources.length, before, 'Silenciar cancela também a reprodução ainda aguardando carregamento.');
console.log('OK: amostras, cache, contato, duração, morte, mudo e cancelamento antes da reprodução.');
