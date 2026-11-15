import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepararBandeja, simularBandeja } from '../src/dice/trayPhysics';
import { traySoundTimeline } from '../src/dice/traySoundTimeline';

// Capturas anteriores à instrumentação sonora: o movimento deve permanecer idêntico.
const trajectories = new Map([
  [1, 'a1e1935d2261cf5f664074c51bbb87f4ca1cff0e71f8a8f99748271ecc067be7'],
  [4, 'e51f140efa84d391c37f0a4fb2589506d41d5b8429a33c4eefefa6e12760decd'],
]);
for (const count of [1, 4, 20, 50]) {
  const preparation = prepararBandeja(count);
  const simulation = simularBandeja(preparation.poses, preparation.raio, 2250);
  const expected = trajectories.get(count);
  if (expected) assert.equal(createHash('sha256').update(JSON.stringify(simulation.quadros)).digest('hex'), expected);
  const cues = traySoundTimeline(simulation, preparation.raio, 2250);
  assert.ok(cues[0].atMs >= 650 && cues[0].atMs <= 685, 'Sem impactos durante o arremesso.');
  assert.ok(cues.every(cue => cue.atMs < 2900 && cue.strength > 0 && cue.strength <= 1));
  for (let index = 1; index < cues.length; index += 1) {
    assert.ok(cues[index].atMs - cues[index - 1].atMs >= 35, 'Choques simultâneos são agrupados sem saturar o áudio.');
    if (cues[index].strength > .15) assert.ok(simulation.contatos.some(contact => Math.abs(650 + contact.atMs - cues[index].atMs) < .001), 'Batidas fortes correspondem a colisões reais da trajetória.');
  }
  if (count === 1) {
    assert.ok(cues.some(cue => Math.abs(cue.atMs - (650 + simulation.contatos[0].atMs)) < .001));
    assert.ok(cues.at(-1)!.atMs < 2200, 'Não inventa batidas no trecho final quase parado.');
  }
}
console.log('OK: física preservada; contatos do piso, colisões e desaceleração na mesma linha do tempo.');
