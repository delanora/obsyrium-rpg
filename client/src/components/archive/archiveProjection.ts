import type {
  NarrativeGraphDto,
  NarrativePlacementDto,
} from "../../../../src/modules/shared/narrative";

export interface ArchiveNodeProjection {
  children: NarrativePlacementDto[];
  expanded: boolean;
  relationCount: number;
  hiddenLinks: number;
}
export interface ArchiveProjection {
  graph: NarrativeGraphDto;
  nodes: Map<string, ArchiveNodeProjection>;
  visibleIds: Set<string>;
  owner: Map<string, string>;
  hiddenLinks: NarrativeGraphDto["links"];
}
/** Uma projeção, sem mutar o grafo: pertencimento não é uma relação narrativa.
 * A geometria visual continua separada nos overrides de arraste do Canvas.
 */
export function projectArchive(
  graph: NarrativeGraphDto,
  expanded: ReadonlySet<string>,
): ArchiveProjection {
  const byId = new Map(graph.placements.map((p) => [p.id, p]));
  const byCard = new Map(graph.placements.map((p) => [p.cardId, p]));
  const nodes = new Map<string, ArchiveNodeProjection>();
  for (const p of graph.placements)
    nodes.set(p.id, {
      children: [],
      expanded: expanded.has(p.id),
      relationCount: 0,
      hiddenLinks: 0,
    });
  const roots: NarrativePlacementDto[] = [];
  for (const p of graph.placements) {
    const parent =
      p.parentPlacementId && p.parentPlacementId !== p.id
        ? nodes.get(p.parentPlacementId)
        : null;
    if (parent) parent.children.push(p);
    else roots.push(p);
  }
  const visibleIds = new Set<string>(),
    owner = new Map<string, string>();
  const queue = roots.map((p) => ({ id: p.id, owner: p.id }));
  for (let i = 0; i < queue.length; i++) {
    const step = queue[i];
    if (owner.has(step.id)) continue;
    owner.set(step.id, step.owner);
    if (step.id === step.owner) visibleIds.add(step.id);
    const info = nodes.get(step.id)!;
    for (const child of info.children)
      queue.push({
        id: child.id,
        owner: step.id === step.owner && info.expanded ? child.id : step.owner,
      });
  }
  // Defesa contra snapshots legados/corrompidos: nunca percorrer ciclos indefinidamente.
  for (const p of byId.values())
    if (!owner.has(p.id)) {
      owner.set(p.id, p.id);
      visibleIds.add(p.id);
    }
  const links: NarrativeGraphDto["links"] = [],
    hiddenLinks: NarrativeGraphDto["links"] = [];
  for (const link of graph.links) {
    const a = byCard.get(link.sourceId),
      b = byCard.get(link.targetId);
    if (a) nodes.get(a.id)!.relationCount++;
    if (b) nodes.get(b.id)!.relationCount++;
    if (a && b && visibleIds.has(a.id) && visibleIds.has(b.id))
      links.push(link);
    else {
      hiddenLinks.push(link);
      const hosts = new Set(
        [a, b]
          .filter(
            (p): p is NarrativePlacementDto => !!p && !visibleIds.has(p.id),
          )
          .map((p) => owner.get(p.id)!),
      );
      for (const host of hosts) nodes.get(host)!.hiddenLinks++;
    }
  }
  return {
    graph: {
      ...graph,
      placements: graph.placements.filter((p) => visibleIds.has(p.id)),
      links,
    },
    nodes,
    visibleIds,
    owner,
    hiddenLinks,
  };
}
