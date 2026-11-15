/** Cliques reais nos dados, com React/jsdom e sem rede ou banco da mesa. */
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
register('data:text/javascript,' + encodeURIComponent("export async function load(url,context,next){return url.endsWith('.css')?{format:'module',source:'export default {}',shortCircuit:true}:next(url,context)}"), import.meta.url);
const dom = new JSDOM('<div id="root"></div>', { url: 'http://fixture.local', pretendToBeVisual: true });
const globals = globalThis as unknown as Record<string, unknown>;
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'MouseEvent', 'localStorage', 'sessionStorage']) {
  globals[name] = (dom.window as unknown as Record<string, unknown>)[name];
}
globals.IS_REACT_ACT_ENVIRONMENT = true;
globals.ResizeObserver = class { observe() {} disconnect() {} };
window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
HTMLElement.prototype.animate = (() => ({ cancel() {} })) as unknown as typeof HTMLElement.prototype.animate;
globals.fetch = async (path: unknown) => {
  if (String(path).endsWith('/dice/roll')) return new Response(JSON.stringify({ roll: { id: 'fixture-roll', actorUserId: 'fixture', actorName: 'Fixture', kind: 'free', label: '', dice: [{ sides: 4, value: 3 }], bonus: 0, total: 3, advantage: false, disadvantage: false, isPrivate: false, crit: false, lucky: false, at: new Date().toISOString() } }));
  if (String(path).endsWith('/dice/active')) return new Response('{"activeRolls":[]}');
  if (String(path).includes('/dice/options/')) return new Response('{"options":[]}');
  throw new Error(`HTTP inesperado: ${String(path)}`);
};
const { act, createElement: h } = await import('react');
const { createRoot } = await import('react-dom/client');
const { useDiceRoller } = await import('../src/dice/useDiceRoller');
const { DiceDock } = await import('../src/dice/DiceDock');
let roller!: ReturnType<typeof useDiceRoller>;
function App() {
  roller = useDiceRoller({ id: 'fixture', username: 'fixture', displayName: 'Fixture', role: 'PLAYER' });
  return h(DiceDock, { roller });
}
const root = createRoot(document.getElementById('root')!);
const aguardarClique = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 310)); });
try {
  await act(async () => root.render(h(App)));
  await act(async () => roller.openFree());
  await act(async () => { for (const sides of [6, 6, 6, 6, 4, 4]) roller.addDie(sides); });
  assert.equal(document.querySelector('.dice-controls-secondary button'), null, 'Sem botão limpar pool.');
  await act(async () => (document.querySelector('.ddie-s4') as HTMLElement).click());
  await aguardarClique();
  assert.deepEqual(roller.pool.map(d => d.sides), [6, 6, 6, 6, 4]);
  await act(async () => {
    const die = document.querySelector('.ddie-s6')!;
    die.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    die.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }));
    die.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
  });
  await aguardarClique();
  assert.deepEqual(roller.pool.map(d => d.sides), [4], 'Duplo clique remove todos e só os d6.');
  await act(async () => roller.addDie(100));
  assert.equal(document.querySelectorAll('[data-percentile]').length, 2);
  await act(async () => (document.querySelector('[data-percentile="units"]') as HTMLElement).click());
  await aguardarClique();
  assert.deepEqual(roller.pool.map(d => d.sides), [4], 'Os dois d10 visuais pertencem a um d100.');
  await act(async () => roller.submit());
  assert.equal(roller.phase, 'tumbling');
  await act(async () => (document.querySelector('.ddie-s4') as HTMLElement).click());
  await aguardarClique();
  assert.equal(roller.pool.length, 0, 'Também remove durante a animação.');
  await act(async () => roller.addDie(4));
  await act(async () => roller.submit());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 3000)); });
  assert.equal(roller.phase, 'settled');
  await act(async () => (document.querySelector('.ddie-s4') as HTMLElement).click());
  await aguardarClique();
  assert.equal(roller.pool.length, 0, 'Também remove depois do resultado.');
  await act(async () => { roller.addDie(6); roller.addDie(4); roller.addDie(8); });
  await act(async () => {
    (document.querySelector('.ddie-s6') as HTMLElement).click();
    (document.querySelector('.ddie-s4') as HTMLElement).click();
  });
  await aguardarClique();
  assert.deepEqual(roller.pool.map(d => d.sides), [8], 'Cliques rápidos em peças diferentes removem ambas.');
  await act(async () => { roller.addDie(6); roller.addDie(4); });
  await act(async () => document.querySelector('.common-dice-pool')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal(roller.pool.length, 3, 'Um clique no fundo não limpa.');
  await act(async () => document.querySelector('.common-dice-pool')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  assert.equal(roller.pool.length, 0, 'Duplo clique no fundo remove todos os tipos.');
  await act(async () => roller.openSkillRoll({ kind: 'skill', label: 'Percepção', bonus: 0 }));
  await act(async () => { roller.addDie(6); roller.addDie(4); });
  await act(async () => document.querySelector('.common-dice-pool')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  assert.deepEqual(roller.pool, [{ sides: 20, locked: true }], 'Limpeza preserva o d20 fixo.');
  await act(async () => roller.openSkillRoll({ kind: 'save', label: 'Sopro', bonus: 0,
    entity: { kind: 'character', id: 'fixture' }, ability: 'dexterity', pendingEffectSaveId: 'pendente' }));
  assert.equal(document.querySelector('button.ddie'), null, 'Dado obrigatório não é removível.');
  await act(async () => { roller.removeDie(0); roller.removeDie([0]); });
  assert.equal(roller.pool.length, 1);
  console.log('OK: clique individual, duplo clique por tipo, d100 e proteção dos testes.');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
