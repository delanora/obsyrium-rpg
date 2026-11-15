/** Ações padrão/contextuais reutilizam os fluxos existentes, sem HTTP ou banco. */
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { actionShortcutSlots } from '../src/combat/actionShortcuts';
import { HOTBAR_SLOTS, type HotbarSlotView, type CombatHotbarEntry } from '../src/combat/hotbar';
const dom = new JSDOM('<div id="root"></div>');
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
const { act, createElement: h } = await import('react');
const { createRoot } = await import('react-dom/client');
const { ActionMenu } = await import('../src/combat/components/ActionMenu');
const { CombatHotbar } = await import('../src/combat/components/CombatHotbar');
const root = createRoot(document.getElementById('root')!);
const empty: HotbarSlotView[] = Array.from({ length: HOTBAR_SLOTS }, (_, i) => ({ index: i + 1, entry: null, ref: null, state: 'empty' }));
let calls: unknown[][] = [];
let entries: CombatHotbarEntry[] = [];
async function render(context = false, actionsDisabled = false) {
  await act(async () => root.render(h(ActionMenu, { disabled: false, actionsDisabled, onSelect: (...args) => calls.push(args),
    standUp: context ? { cost: 4.5, available: true } : null, onStandUp: () => calls.push(['stand']),
    stabilizeTargets: context ? [{ id: 'a', name: 'Alvo A' }, { id: 'b', name: 'Alvo B' }] : [], onStabilize: id => calls.push(['stabilize', id]),
    renderShortcuts: (items, activate) => { entries = items; const display = actionShortcutSlots(empty, items, null); return h(CombatHotbar, { slots: display.slots, extraEntries: display.overflow, busy: false, onSelect: activate }); },
  })));
}
const click = async (name: string) => { const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.getAttribute('aria-label')?.includes(name) || b.textContent?.trim().startsWith(name)); assert.ok(button, name); await act(async () => button.click()); };
await render();
assert.equal(document.querySelector('.action-menu-trigger'), null);
assert.equal(entries.length, 9);
assert.ok(!entries.some(entry => entry.label === 'Levantar-se'));
await click('Disparada');assert.deepEqual(calls.pop(), ['dash']);
await click('Preparar');assert.ok(document.querySelector('.action-menu-form'));assert.equal(document.querySelector('.action-menu-item'), null, 'Não abre lista de ações.');
await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
await render(true);assert.equal(entries.length, 11);
await click('Levantar-se');assert.deepEqual(calls.pop(), ['stand']);
await click('Estabilizar');await click('Estabilizar Alvo B');assert.deepEqual(calls.pop(), ['stabilize', 'b']);
await render(true, true);
assert.ok(entries.find(e => e.label === 'Disparada')?.disabledReason);
assert.equal(entries.find(e => e.label === 'Levantar-se')?.disabledReason, undefined, 'Levantar não exige Ação.');
const full = empty.map((slot, index) => ({ ...slot, entry: { ...entries[0], id: 'attack:' + index, sourceId: String(index), kind: 'attack' as const }, ref: { kind: 'attack' as const, sourceId: String(index) }, state: 'ready' as const }));
const snapshot = JSON.stringify(full), display = actionShortcutSlots(full, entries, null);
assert.equal(display.slots.filter(slot => slot.entry?.sourceId.startsWith('action:')).length, 11);
assert.equal(display.overflow.length, 11);
assert.equal(JSON.stringify(full), snapshot, 'Grade salva permanece intacta.');
await act(async () => root.unmount());
console.log('Atalhos: nove padrões, contexto, comando existente, formulário, alvo, orçamento e grade cheia verificados.');
