/** Agenda de áudio sem rede ou dados da campanha. A renderização OfflineAudioContext é conferida no navegador. */
import assert from 'node:assert/strict';
import { musicLoopWindow, scheduleMusicPass, WIZARD_MUSIC_VOLUME } from '../src/music/wizardMusic';
const samples = new Float32Array(5000); samples.fill(.1, 500, 4500);
const buffer = { length: 5000, sampleRate: 1000, numberOfChannels: 1, getChannelData: () => samples } as unknown as AudioBuffer;
assert.deepEqual(musicLoopWindow(buffer), { start: .5, duration: 4 });
const curves: { at: number; duration: number; values: Float32Array }[] = [];
let started: unknown[] = [];
const gain = { setValueAtTime() {}, setValueCurveAtTime(values: Float32Array, at: number, duration: number) { curves.push({ values, at, duration }); } };
const audio = { createBufferSource: () => ({ buffer: null, connect() {}, disconnect() {}, start: (...args: unknown[]) => { started = args; } }), createGain: () => ({ gain, connect() {}, disconnect() {} }) } as unknown as BaseAudioContext;
scheduleMusicPass(audio, buffer, {} as AudioNode, 10, musicLoopWindow(buffer), 1);
assert.deepEqual(started, [10, .5, 4]);
assert.equal(curves[0].at, 10); assert.equal(curves[1].at, 13);
assert.equal(curves[0].values[0], 0); assert.equal(curves[0].values.at(-1), 1);
assert.equal(curves[1].values[0], 1); assert.ok(curves[1].values.at(-1)! < .00001);
for (let i = 0; i < 64; i++) assert.ok(Math.abs(curves[0].values[i] ** 2 + curves[1].values[i] ** 2 - 1) < .00001);
assert.ok(WIZARD_MUSIC_VOLUME < .1);
console.log('Ambientação: silêncio aparado, volume baixo, agenda e curvas de transição verificados.');
