import type { NarrativePlacementDto } from "../../../../src/modules/shared/narrative";
import type { ArchiveProjection } from "./archiveProjection";
import type { ArchiveRect } from "./archiveCamera";

export type ArchiveGeometry = Pick<
  NarrativePlacementDto,
  "x" | "y" | "width" | "height" | "zIndex"
>;
export interface ArchiveAnchor {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
}
export const ARCHIVE_LAYOUT_CONFIG = {
  gap: 32,
  limit: 1_000_000,
  maxChecks: 750_000,
  maxMovesPerCard: 16,
  maxMoves: 4000,
  radialAttempts: 12,
};
export interface ArchiveLayout {
  graph: ArchiveProjection["graph"];
  geometry: Map<string, ArchiveGeometry>;
  offsets: Map<string, { x: number; y: number }>;
  affected: {
    id: string;
    from: ArchiveGeometry;
    to: ArchiveGeometry;
    sourceId: string;
    depth: number;
    distance: number;
  }[];
  diagnostics: {
    checks: number;
    moves: number;
    capped: boolean;
    residuals: [string, string][];
    preservedOverlaps: number;
    manualOverlaps: [string, string][];
  };
}
const EPS = 1e-7,
  TAU = Math.PI * 2;
const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const center = (r: ArchiveRect) => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
});
const geometryOf = (p: ArchiveGeometry): ArchiveGeometry => ({
  x: p.x,
  y: p.y,
  width: p.width,
  height: p.height,
  zIndex: p.zIndex,
});
export function archiveOverlapArea(
  a: ArchiveRect,
  b: ArchiveRect,
  gap = 32,
): number {
  return (
    Math.max(
      0,
      Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + gap,
    ) *
    Math.max(
      0,
      Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + gap,
    )
  );
}
export const archiveIntersects = (a: ArchiveRect, b: ArchiveRect, gap = 32) =>
  archiveOverlapArea(a, b, gap) > EPS;

export const isCustomBranch = (
  p: Pick<
    NarrativePlacementDto,
    "parentPlacementId" | "branchOffsetX" | "branchOffsetY"
  >,
) =>
  !!p.parentPlacementId &&
  p.branchOffsetX != null &&
  p.branchOffsetY != null &&
  Number.isFinite(p.branchOffsetX) &&
  Number.isFinite(p.branchOffsetY);

/** Vetor entre centros no espaço do quadro, sem câmera ou offset orgânico. */
export function branchVector(child: ArchiveGeometry, parent: ArchiveGeometry) {
  return {
    x: child.x + child.width / 2 - parent.x - parent.width / 2,
    y: child.y + child.height / 2 - parent.y - parent.height / 2,
  };
}
export function relativeGeometry(
  child: NarrativePlacementDto,
  parent: ArchiveGeometry,
): ArchiveGeometry {
  return {
    ...geometryOf(child),
    x: parent.x + parent.width / 2 + child.branchOffsetX! - child.width / 2,
    y: parent.y + parent.height / 2 + child.branchOffsetY! - child.height / 2,
  };
}
/** Acompanha centros durante o gesto sem executar o resolvedor de colisões. */
export function relativeGestureVisual(
  graph: ArchiveProjection["graph"],
  visual: Record<string, ArchiveGeometry>,
) {
  const result = { ...visual };
  const queue = Object.keys(visual);
  const visited = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const parentId = queue[i],
      parent = result[parentId];
    for (const child of graph.placements) {
      if (
        child.parentPlacementId !== parentId ||
        !isCustomBranch(child) ||
        visited.has(child.id)
      )
        continue;
      visited.add(child.id);
      queue.push(child.id);
      result[child.id] = relativeGeometry(child, parent);
    }
  }
  return result;
}

/** Posição final do arraste é uma escolha explícita. Resize preserva o offset
 * temporário: só seu delta de borda e dimensões pertencem ao commit. */
export function archiveGestureCommit(
  persisted: ArchiveGeometry,
  start: ArchiveGeometry,
  final: ArchiveGeometry,
  mode: "move" | "resize",
): ArchiveGeometry {
  return {
    ...final,
    x: Math.max(
      -1e6,
      Math.min(
        1e6,
        mode === "move" ? final.x : persisted.x + (final.x - start.x),
      ),
    ),
    y: Math.max(
      -1e6,
      Math.min(
        1e6,
        mode === "move" ? final.y : persisted.y + (final.y - start.y),
      ),
    ),
  };
}

/** Cálculo finito no espaço do quadro. Não conhece DOM, câmera, HTTP ou relógio.
 * A ordem é profundidade/ID para núcleos e ângulo/ID para filhos. */
export function layoutArchive(
  projection: ArchiveProjection,
  options: {
    anchors?: Readonly<Record<string, ArchiveAnchor>>;
    config?: Partial<typeof ARCHIVE_LAYOUT_CONFIG>;
  } = {},
): ArchiveLayout {
  const config = { ...ARCHIVE_LAYOUT_CONFIG, ...options.config };
  const cards = [...projection.graph.placements].sort((a, b) =>
    order(a.id, b.id),
  );
  const raw = new Map(cards.map((p) => [p.id, p]));
  const result = new Map(cards.map((p) => [p.id, geometryOf(p)]));
  const diagnostics: ArchiveLayout["diagnostics"] = {
    checks: 0,
    moves: 0,
    capped: false,
    residuals: [],
    preservedOverlaps: 0,
    manualOverlaps: [],
  };
  const causes = new Map<string, { sourceId: string; depth: number }>();
  const depth = (id: string) => {
    let n = 0,
      cursor = raw.get(id);
    const seen = new Set<string>();
    while (
      cursor?.parentPlacementId &&
      raw.has(cursor.parentPlacementId) &&
      !seen.has(cursor.id)
    ) {
      seen.add(cursor.id);
      n++;
      cursor = raw.get(cursor.parentPlacementId);
    }
    return n;
  };
  const groups = cards
    .filter(
      (p) =>
        projection.nodes.get(p.id)?.expanded &&
        projection.nodes.get(p.id)!.children.some((c) => raw.has(c.id)),
    )
    .sort((a, b) => depth(a.id) - depth(b.id) || order(a.id, b.id));
  if (!groups.length)
    return {
      graph: projection.graph,
      geometry: result,
      offsets: new Map(),
      affected: [],
      diagnostics,
    };
  const pinned = new Set<string>();
  const anchors = new Set(groups.map((p) => p.id));
  for (const p of groups) {
    const pin = options.anchors?.[p.id];
    if (
      pin &&
      pin.baseX === p.x &&
      pin.baseY === p.y &&
      Number.isFinite(pin.x) &&
      Number.isFinite(pin.y) &&
      !isCustomBranch(p)
    ) {
      pinned.add(p.id);
      result.set(p.id, {
        ...result.get(p.id)!,
        x: Math.max(-config.limit, Math.min(config.limit, pin.x)),
        y: Math.max(-config.limit, Math.min(config.limit, pin.y)),
      });
    }
  }
  const custom = new Set(cards.filter(isCustomBranch).map((p) => p.id));
  const radial = new Set<string>(),
    reserved = new Set([...anchors, ...custom]);
  // Reserva antecipada das intenções manuais, em ordem pai→filho.
  for (const p of [...cards].sort(
    (a, b) => depth(a.id) - depth(b.id) || order(a.id, b.id),
  ))
    if (custom.has(p.id) && result.has(p.parentPlacementId!))
      result.set(p.id, relativeGeometry(p, result.get(p.parentPlacementId!)!));
  const exhausted = () => {
    if (
      diagnostics.checks >= config.maxChecks ||
      diagnostics.moves >= config.maxMoves
    ) {
      diagnostics.capped = true;
      return true;
    }
    return false;
  };
  const overlap = (a: ArchiveRect, b: ArchiveRect) => {
    diagnostics.checks++;
    return archiveIntersects(a, b, config.gap);
  };
  const inBounds = (p: ArchiveRect) =>
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Math.abs(p.x) <= config.limit &&
    Math.abs(p.y) <= config.limit;
  const angleOf = (
    child: NarrativePlacementDto,
    parent: NarrativePlacementDto,
  ) => {
    const a = center(child),
      b = center(parent),
      dx = a.x - b.x,
      dy = a.y - b.y;
    return Math.hypot(dx, dy) < config.gap
      ? 0
      : (Math.atan2(dy, dx) + TAU) % TAU;
  };
  for (const group of groups) {
    if (custom.has(group.id) && result.has(group.parentPlacementId!))
      result.set(
        group.id,
        relativeGeometry(group, result.get(group.parentPlacementId!)!),
      );
    const core = result.get(group.id)!,
      c = center(core);
    const children = projection.nodes
      .get(group.id)!
      .children.filter((p) => raw.has(p.id))
      .sort(
        (a, b) => angleOf(a, group) - angleOf(b, group) || order(a.id, b.id),
      );
    for (const child of children) {
      if (!custom.has(child.id)) continue;
      result.set(child.id, relativeGeometry(child, core));
      radial.add(child.id);
      causes.set(child.id, { sourceId: group.id, depth: 0 });
    }
    let first = 0,
      ring = 0,
      previousOuter = Math.hypot(core.width, core.height) / 2;
    while (first < children.length) {
      const batch = children.slice(first, first + 8 + ring * 4);
      const prefs = batch.map((p) => angleOf(p, group));
      const gaps = prefs.map(
        (a, i) => (i === prefs.length - 1 ? prefs[0] + TAU : prefs[i + 1]) - a,
      );
      const clustered =
        batch.length > 1 &&
        TAU - Math.max(...gaps) < Math.PI &&
        batch.every(
          (p) => Math.hypot(p.x - group.x, p.y - group.y) < config.gap,
        );
      const rotationVector = prefs.reduce(
        (v, a, i) => ({
          x: v.x + Math.cos(a - (i * TAU) / batch.length),
          y: v.y + Math.sin(a - (i * TAU) / batch.length),
        }),
        { x: 0, y: 0 },
      );
      const rotation =
        Math.hypot(rotationVector.x, rotationVector.y) > EPS
          ? Math.atan2(rotationVector.y, rotationVector.x)
          : prefs[0];
      const maxHalf = Math.max(
        ...batch.map((p) => Math.hypot(p.width, p.height) / 2),
      );
      const packing =
        batch.reduce(
          (sum, p) => sum + Math.hypot(p.width, p.height) + config.gap,
          0,
        ) / TAU;
      const baseRadius =
        batch.length === 1 && !ring
          ? 0
          : Math.max(previousOuter + maxHalf + config.gap, packing);
      let outer = previousOuter;
      batch.forEach((child, index) => {
        radial.add(child.id);
        if (
          custom.has(child.id) ||
          (anchors.has(child.id) && pinned.has(child.id))
        ) {
          reserved.add(child.id);
          return;
        }
        const desired = clustered
          ? rotation + (index * TAU) / batch.length
          : prefs[index];
        const half = Math.hypot(child.width, child.height) / 2;
        let chosen: ArchiveGeometry | undefined;
        let fallback: ArchiveGeometry | undefined;
        for (
          let attempt = 0;
          attempt < config.radialAttempts && !chosen;
          attempt++
        ) {
          for (let slot = 0; slot < 24 && !chosen; slot++) {
            const turn =
              slot === 0
                ? 0
                : (Math.ceil(slot / 2) * (slot % 2 ? 1 : -1) * TAU) / 24;
            const angle = desired + turn,
              ux = Math.cos(angle),
              uy = Math.sin(angle);
            const clearance =
              ((core.width + child.width) / 2) * Math.abs(ux) +
              ((core.height + child.height) / 2) * Math.abs(uy) +
              config.gap;
            const radius =
              Math.max(baseRadius, clearance) +
              attempt * (Math.max(48, half / 2) + config.gap);
            const candidate = {
              ...geometryOf(child),
              x: c.x + ux * radius - child.width / 2,
              y: c.y + uy * radius - child.height / 2,
            };
            fallback ??= {
              ...candidate,
              x: Math.max(-config.limit, Math.min(config.limit, candidate.x)),
              y: Math.max(-config.limit, Math.min(config.limit, candidate.y)),
            };
            if (!inBounds(candidate)) continue;
            let blocked = false;
            for (const id of reserved) {
              if (id === child.id) continue;
              if (exhausted() || overlap(candidate, result.get(id)!)) {
                blocked = true;
                break;
              }
            }
            if (!blocked) chosen = candidate;
            if (exhausted()) break;
          }
          if (exhausted()) break;
        }
        chosen ??= fallback ?? geometryOf(child);
        result.set(child.id, chosen);
        reserved.add(child.id);
        causes.set(child.id, { sourceId: group.id, depth: 0 });
        outer = Math.max(
          outer,
          Math.hypot(center(chosen).x - c.x, center(chosen).y - c.y) + half,
        );
      });
      previousOuter = outer;
      first += batch.length;
      ring++;
    }
  }
  const fixed = [...reserved].sort(order),
    movable = cards.filter((p) => !reserved.has(p.id));
  const originalArea = (a: string, b: string) =>
    radial.has(a) || radial.has(b)
      ? 0
      : archiveOverlapArea(raw.get(a)!, raw.get(b)!, config.gap);
  const introduced = (a: string, b: string) =>
    archiveOverlapArea(result.get(a)!, result.get(b)!, config.gap) >
    originalArea(a, b) + EPS;
  const queue = fixed.map((id) => ({
    id,
    sourceId: causes.get(id)?.sourceId ?? id,
    depth: 0,
  }));
  const moves = new Map<string, number>();
  for (let q = 0; q < queue.length && !exhausted(); q++) {
    const event = queue[q],
      blocker = result.get(event.id)!;
    for (const card of movable) {
      if (card.id === event.id || exhausted()) continue;
      if (
        !overlap(blocker, result.get(card.id)!) ||
        !introduced(event.id, card.id)
      )
        continue;
      const cause = causes.get(card.id) ?? {
        sourceId: event.sourceId,
        depth: event.depth + 1,
      };
      const origin = center(
        result.get(cause.sourceId) ?? raw.get(cause.sourceId) ?? blocker,
      );
      const obstacles = [event.id, ...fixed.filter((id) => id !== event.id)];
      let moved = false;
      for (
        let attempt = 0;
        attempt < config.maxMovesPerCard && !exhausted();
        attempt++
      ) {
        const current = result.get(card.id)!;
        let hit: string | undefined;
        for (const id of obstacles)
          if (
            id !== card.id &&
            overlap(current, result.get(id)!) &&
            introduced(id, card.id)
          ) {
            hit = id;
            break;
          }
        if (!hit) break;
        if ((moves.get(card.id) ?? 0) >= config.maxMovesPerCard) {
          diagnostics.capped = true;
          break;
        }
        const b = result.get(hit)!,
          cc = center(current),
          dx = cc.x - origin.x,
          dy = cc.y - origin.y;
        const candidates = [
          { x: b.x + b.width + config.gap - current.x, y: 0 },
          { x: b.x - config.gap - current.x - current.width, y: 0 },
          { x: 0, y: b.y + b.height + config.gap - current.y },
          { x: 0, y: b.y - config.gap - current.y - current.height },
        ]
          .filter((v) => v.x * dx + v.y * dy >= -EPS)
          .map((v, i) => ({
            v,
            i,
            score:
              (Math.abs(v.x) + Math.abs(v.y)) /
              (0.5 +
                Math.max(
                  0,
                  (v.x * dx + v.y * dy) /
                    Math.max(1, Math.hypot(v.x, v.y) * Math.hypot(dx, dy)),
                )),
          }))
          .sort((a, b) => a.score - b.score || a.i - b.i);
        const next = candidates
          .map(({ v }) => ({
            ...current,
            x: current.x + v.x,
            y: current.y + v.y,
          }))
          .find((p) => inBounds(p) && !archiveIntersects(p, b, config.gap));
        if (!next) break;
        result.set(card.id, next);
        causes.set(card.id, cause);
        moves.set(card.id, (moves.get(card.id) ?? 0) + 1);
        diagnostics.moves++;
        moved = true;
      }
      if (moved) queue.push({ id: card.id, ...cause });
    }
  }
  const offsets = new Map<string, { x: number; y: number }>(),
    affected: ArchiveLayout["affected"] = [];
  for (const p of cards) {
    const to = result.get(p.id)!,
      dx = to.x - p.x,
      dy = to.y - p.y;
    if (dx || dy) {
      offsets.set(p.id, { x: dx, y: dy });
      const cause = causes.get(p.id) ?? { sourceId: p.id, depth: 0 };
      const source = center(result.get(cause.sourceId) ?? p),
        target = center(to);
      affected.push({
        id: p.id,
        from: geometryOf(p),
        to: { ...to },
        ...cause,
        distance: Math.hypot(target.x - source.x, target.y - source.y),
      });
    }
  }
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i].id,
        b = cards[j].id;
      if (archiveIntersects(result.get(a)!, result.get(b)!, config.gap)) {
        if (
          (custom.has(a) &&
            (custom.has(b) || raw.get(a)?.parentPlacementId === b)) ||
          (custom.has(b) && raw.get(b)?.parentPlacementId === a)
        ) {
          diagnostics.manualOverlaps.push([a, b]);
          continue;
        }
        if (
          (radial.has(a) ||
            radial.has(b) ||
            offsets.has(a) ||
            offsets.has(b)) &&
          introduced(a, b)
        )
          diagnostics.residuals.push([a, b]);
        else diagnostics.preservedOverlaps++;
      }
    }
  return {
    geometry: result,
    offsets,
    affected,
    diagnostics,
    graph: {
      ...projection.graph,
      placements: projection.graph.placements.map((p) => ({
        ...p,
        ...result.get(p.id)!,
      })),
    },
  };
}

/** Interface geométrica para a próxima microfase: compara duas saídas, sem animar. */
export function archiveLayoutTransition(
  previous: ReadonlyMap<string, ArchiveGeometry>,
  next: ArchiveLayout,
  context?: {
    graph: ArchiveProjection["graph"];
    previous?: ReadonlyMap<string, ArchiveGeometry>;
  },
) {
  const affected = new Map(next.affected.map((p) => [p.id, p]));
  return [...new Set([...previous.keys(), ...next.geometry.keys()])]
    .sort(order)
    .flatMap((id) => {
      const from = previous.get(id),
        to = next.geometry.get(id);
      if (
        from &&
        to &&
        from.x === to.x &&
        from.y === to.y &&
        from.width === to.width &&
        from.height === to.height
      )
        return [];
      const placement = context?.graph.placements.find((p) => p.id === id);
      const sourceId =
        placement?.parentPlacementId ?? affected.get(id)?.sourceId ?? id;
      const nucleus = next.geometry.get(sourceId) ?? previous.get(sourceId);
      const core = nucleus ? center(nucleus) : null;
      const collapsed =
        core && placement
          ? {
              ...geometryOf(placement),
              x: core.x - placement.width / 2,
              y: core.y - placement.height / 2,
            }
          : null;
      return [
        {
          id,
          from: from ? { ...from } : null,
          to: to ? { ...to } : null,
          entryOrigin: !from ? collapsed : null,
          exitTarget: !to ? collapsed : null,
          mode: placement && isCustomBranch(placement) ? "custom" : "automatic",
          sourceId,
          depth: affected.get(id)?.depth ?? 0,
        },
      ];
    });
}
