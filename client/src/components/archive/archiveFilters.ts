import type { NarrativeGraphDto } from "../../../../src/modules/shared/narrative";
import type { ArchiveProjection } from "./archiveProjection";
export interface ArchiveFilterState {
  groupIds: string[];
  match: "any" | "all";
  mode: "highlight" | "isolate";
}
export const EMPTY_ARCHIVE_FILTER: ArchiveFilterState = {
  groupIds: [],
  match: "any",
  mode: "highlight",
};
export interface ArchiveFilterPresentation {
  active: boolean;
  mode: ArchiveFilterState["mode"];
  selected: string[];
  matchingCardIds: ReadonlySet<string>;
  visibleIds: ReadonlySet<string>;
  contextIds: ReadonlySet<string>;
  hiddenByOwner: ReadonlyMap<string, number>;
  total: number;
  visible: number;
  collapsed: number;
}
/** Camada de apresentação posterior ao layout. Não altera projeção, geometria ou expansão. */
export function filterArchive(
  graph: NarrativeGraphDto,
  projection: ArchiveProjection,
  state: ArchiveFilterState,
): ArchiveFilterPresentation {
  const library = new Set((graph.groups ?? []).map((g) => g.id));
  if (!graph.groups)
    for (const p of graph.placements)
      for (const g of p.card.groups ?? []) library.add(g.id);
  const selected = [...new Set(state.groupIds)].filter((id) => library.has(id)),
    active = selected.length > 0;
  const byId = new Map(graph.placements.map((p) => [p.id, p]));
  const cards = new Map(graph.placements.map((p) => [p.cardId, p.card]));
  const matchingCardIds = new Set<string>();
  for (const card of cards.values()) {
    const ids = new Set((card.groups ?? []).map((g) => g.id));
    if (
      !active ||
      (state.match === "all"
        ? selected.every((id) => ids.has(id))
        : selected.some((id) => ids.has(id)))
    )
      matchingCardIds.add(card.id);
  }
  const contextIds = new Set<string>(),
    ascended = new Set<string>(),
    hiddenSets = new Map<string, Set<string>>(),
    visibleCards = new Set<string>();
  for (const p of graph.placements)
    if (matchingCardIds.has(p.cardId)) {
      if (projection.visibleIds.has(p.id)) visibleCards.add(p.cardId);
      else {
        const owner = projection.owner.get(p.id);
        if (owner) {
          const set = hiddenSets.get(owner) ?? new Set<string>();
          set.add(p.cardId);
          hiddenSets.set(owner, set);
        }
      }
      let parent = p.parentPlacementId;
      while (parent && !ascended.has(parent)) {
        ascended.add(parent);
        if (projection.visibleIds.has(parent)) contextIds.add(parent);
        parent = byId.get(parent)?.parentPlacementId;
      }
    }
  const visibleIds = new Set(
    [...projection.visibleIds].filter(
      (id) =>
        !active ||
        state.mode !== "isolate" ||
        matchingCardIds.has(byId.get(id)!.cardId) ||
        contextIds.has(id),
    ),
  );
  return {
    active,
    mode: state.mode,
    selected,
    matchingCardIds,
    visibleIds,
    contextIds,
    hiddenByOwner: new Map([...hiddenSets].map(([id, set]) => [id, set.size])),
    total: matchingCardIds.size,
    visible: visibleCards.size,
    collapsed: matchingCardIds.size - visibleCards.size,
  };
}
export function archiveFilterKind(
  filter: ArchiveFilterPresentation | undefined,
  id: string,
  cardId: string,
) {
  if (!filter?.active) return "normal";
  if (filter.mode === "isolate" && !filter.visibleIds.has(id)) return "hidden";
  if (filter.matchingCardIds.has(cardId)) return "match";
  return filter.mode === "isolate" && filter.contextIds.has(id)
    ? "context"
    : "dim";
}
