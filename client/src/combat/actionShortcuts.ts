import { filterHotbarView, type CombatHotbarEntry, type HotbarFilter, type HotbarSlotView } from './hotbar';

/** Atalhos padrão e contextuais não alteram a configuração salva. Numa grade cheia,
 * os atalhos deslocados continuam acessíveis em “ver todas”. */
export function actionShortcutSlots(slots: readonly HotbarSlotView[], actions: readonly CombatHotbarEntry[], filter: HotbarFilter | null) {
  const filled = slots.map(slot => ({ ...slot }));
  const overflow: CombatHotbarEntry[] = [];
  const free = filled.flatMap((slot, index) => !slot.entry && !slot.ref ? [index] : []);
  const occupied = filled.flatMap((_, index) => free.includes(index) ? [] : [index]).reverse();
  for (const entry of actions) {
    const index = free.shift() ?? occupied.shift();
    if (index === undefined) { overflow.push(entry); continue; }
    const displaced = filled[index].entry;
    if (displaced) overflow.push(displaced);
    filled[index] = { index: index + 1, entry, state: 'ready', ref: null };
  }
  return { slots: filterHotbarView(filled, filter), overflow };
}
