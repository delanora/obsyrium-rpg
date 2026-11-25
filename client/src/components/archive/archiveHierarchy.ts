import type { NarrativePlacementDto } from "../../../../src/modules/shared/narrative";

/** Índice linear por snapshot; ciclos legados recebem profundidade finita. */
export function archiveHierarchy(placements: readonly NarrativePlacementDto[]) {
  const byId = new Map(placements.map((p) => [p.id, p]));
  const children = new Map<string, NarrativePlacementDto[]>();
  for (const p of placements) {
    if (
      p.parentPlacementId &&
      p.parentPlacementId !== p.id &&
      byId.has(p.parentPlacementId)
    ) {
      const list = children.get(p.parentPlacementId) ?? [];
      list.push(p);
      children.set(p.parentPlacementId, list);
    }
  }
  const depths = new Map<string, number>();
  for (const p of placements) {
    if (depths.has(p.id)) continue;
    const chain: string[] = [],
      seen = new Set<string>();
    let id: string | null = p.id;
    while (id && byId.has(id) && !depths.has(id) && !seen.has(id)) {
      chain.push(id);
      seen.add(id);
      id = byId.get(id)!.parentPlacementId ?? null;
    }
    let depth = id && depths.has(id) ? depths.get(id)! + 1 : 0;
    for (let i = chain.length - 1; i >= 0; i--) depths.set(chain[i], depth++);
  }
  return { byId, children, depths };
}

export function archiveDescendants(
  placements: readonly NarrativePlacementDto[],
  id: string,
) {
  const { children } = archiveHierarchy(placements),
    ids = new Set([id]);
  for (const current of ids)
    for (const child of children.get(current) ?? []) ids.add(child.id);
  return ids;
}
