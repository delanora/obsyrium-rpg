/** Bandeja de salvaguardas: hook real e HTTP inteiramente simulado. */
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useDiceRoller } from '../src/dice/useDiceRoller';
import type { SessionUser } from '../src/types';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://fixture.local' });
const globals = globalThis as unknown as Record<string, unknown>;
for (const name of ['window', 'document', 'localStorage', 'sessionStorage']) {
  globals[name] = (dom.window as unknown as Record<string, unknown>)[name];
}
globals.IS_REACT_ACT_ENVIRONMENT = true;
const requests: Record<string, unknown>[] = [];
const timers: (() => void)[] = [];
window.setTimeout = ((fn: () => void) => { timers.push(fn); return timers.length; }) as typeof window.setTimeout;
window.clearTimeout = (() => {}) as typeof window.clearTimeout;
globals.fetch = async (path: unknown, init?: RequestInit) => {
  if (String(path).endsWith('/dice/active')) return new Response('{"activeRolls":[]}');
  if (String(path).includes('/dice/options/')) return new Response('{"options":[]}');
  if (String(path).endsWith('/dice/roll')) {
    requests.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ roll: {
      id: 'save-1', actorUserId: 'viewer', actorName: 'Umbrae', kind: 'save', label: 'Sopro',
      dice: [{ sides: 20, value: 14 }], bonus: 7, total: 21, advantage: false,
      disadvantage: false, isPrivate: false, crit: false, lucky: false, at: new Date().toISOString(),
    } }));
  }
  throw new Error(`HTTP inesperado: ${String(path)}`);
};
const user: SessionUser = { id: 'viewer', username: 'viewer', displayName: 'Umbrae', role: 'PLAYER' };
let roller!: ReturnType<typeof useDiceRoller>;
function App() { roller = useDiceRoller(user); return createElement('div'); }
const root = createRoot(document.getElementById('root')!);
try {
  await act(async () => root.render(createElement(App)));
  await act(async () => roller.openSkillRoll({ kind: 'save', label: 'Sopro', bonus: 0,
    entity: { kind: 'character', id: 'umbrae' }, ability: 'dexterity',
    pendingEffectSaveId: 'pending-umbrae', selectedEffectModifiers: ['bless'] }));
  assert.equal(requests.length, 0, 'Abrir não resolve a pendência.');
  assert.deepEqual(roller.pool, [{ sides: 20, locked: true }]);
  await act(async () => roller.submit());
  assert.equal(requests[0].pendingEffectSaveId, 'pending-umbrae');
  assert.deepEqual(requests[0].selectedEffectModifiers, ['bless']);
  assert.equal(requests[0].bonus, 0, 'Bônus final vem do servidor.');
  assert.equal(roller.result?.total, 21);
  assert.equal(roller.result?.bonus, 7);
  await act(async () => { timers.splice(0).forEach(fn => fn()); });
  await act(async () => roller.submit());
  assert.equal(requests.length, 1, 'Não repetir pendência já resolvida.');
  await act(async () => roller.openSkillRoll({ kind: 'concentration', label: 'Concentração', bonus: 0,
    entity: { kind: 'character', id: 'umbrae' }, ability: 'constitution', pendingConcentrationSaveId: 'con-1' }));
  await act(async () => roller.submit());
  assert.equal(requests[1].pendingConcentrationSaveId, 'con-1');
  console.log('OK: pendências na bandeja, modificadores opcionais, bônus autoritativo e bloqueio de repetição.');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
