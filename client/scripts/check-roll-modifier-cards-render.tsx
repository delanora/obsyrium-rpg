/** Cards reais com React/jsdom: opcionais selecionáveis e resultado imutável. */
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
register('data:text/javascript,' + encodeURIComponent("export async function load(url,context,next){return url.endsWith('.css')?{format:'module',source:'export default {}',shortCircuit:true}:next(url,context)}"), import.meta.url);
const dom = new JSDOM('<div id="root"></div>');
Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
const { act, createElement: h } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RollModifierCards } = await import('../src/dice/RollModifierCards');
const root = createRoot(document.getElementById('root')!);
const view = { bonus: 3, advantage: true, disadvantage: false, autoFail: false, cards: [
  { id: '0', kind: 'flat' as const, label: 'Sabedoria', detail: 'Modificador do atributo', value: -1, applied: true },
  { id: '1', kind: 'dice' as const, label: 'Bênção', detail: 'Efeito opcional', count: 1, sides: 4, applied: false, optionId: 'bencao' },
  { id: '2', kind: 'advantage' as const, label: 'Aprimorar habilidade', detail: 'Efeito ativo', applied: true },
] };
let selected = '';
await act(async () => root.render(h(RollModifierCards, { view, disabled: false, onToggle: id => { selected = id; } })));
assert.equal(document.querySelectorAll('.dice-modifier').length, 3);
assert.ok(document.body.textContent?.includes('-1'));
assert.ok(document.body.textContent?.includes('+1d4'));
const button = document.querySelector('button')!;
assert.equal(button.getAttribute('aria-pressed'), 'false');
await act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
assert.equal(selected, 'bencao');
await act(async () => root.render(h(RollModifierCards, { view, disabled: true, onToggle: () => assert.fail('Resultado não pode mudar.') })));
assert.equal(document.querySelector('button')!.disabled, true);
await act(async () => root.render(h(RollModifierCards, { disabled: false, onToggle() {} })));
assert.equal(document.querySelector('.dice-modifiers'), null);
await act(async () => root.unmount());
console.log('Cards: origem, penalidade, dados, seleção opcional e bloqueio após resultado verificados.');
