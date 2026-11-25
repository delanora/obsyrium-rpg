import type { NarrativePlacementDto } from "../../../../src/modules/shared/narrative";
import { archiveHierarchy } from "./archiveHierarchy";
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
  parentId?: string;
  offsetX?: number;
  offsetY?: number;
  signature?: string;
}
/** A posição própria e a linhagem validam a âncora; transladar/redimensionar
 * um ancestral não invalida o vetor entre centros. Trocar pertencimento invalida. */
export function archiveAnchorSignature(
  p: NarrativePlacementDto,
  placements: readonly NarrativePlacementDto[],
  index?: ReadonlyMap<string, NarrativePlacementDto>,
) {
  const byId = index ?? new Map(placements.map((item) => [item.id, item]));
  const seen = new Set<string>(),
    parts: unknown[] = [];
  let current: NarrativePlacementDto | undefined = p;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.push([
      current.id,
      current.parentPlacementId,
      ...(current.id === p.id
        ? [
            current.x,
            current.y,
            current.width,
            current.height,
            current.branchOffsetX,
            current.branchOffsetY,
          ]
        : []),
    ]);
    current = byId.get(current.parentPlacementId ?? "");
  }
  return JSON.stringify(parts);
}
export function captureArchiveAnchor(
  p: NarrativePlacementDto,
  shown: ArchiveGeometry,
  graph: ArchiveProjection["graph"],
  geometry: ReadonlyMap<string, ArchiveGeometry>,
): ArchiveAnchor {
  const parent = p.parentPlacementId
    ? geometry.get(p.parentPlacementId)
    : undefined;
  return {
    x: shown.x,
    y: shown.y,
    baseX: p.x,
    baseY: p.y,
    ...(parent
      ? {
          parentId: p.parentPlacementId!,
          offsetX: shown.x + shown.width / 2 - parent.x - parent.width / 2,
          offsetY: shown.y + shown.height / 2 - parent.y - parent.height / 2,
          signature: archiveAnchorSignature(p, graph.placements),
        }
      : {}),
  };
}
export const ARCHIVE_LAYOUT_CONFIG = {
  gap: 32,
  reserveMargin: 1120,
  reserveBands: 12,
  limit: 1_000_000,
  maxChecks: 750_000,
  maxMovesPerCard: 16,
  maxMoves: 4000,
  radialAttempts: 12,
};
export interface ArchiveReserve {
  sourceId: string;
  members: ReadonlySet<string>;
  regions: ArchiveGeometry[];
  coreRegions: number;
}
export type ArchiveReserveExceptions = Readonly<
  Record<string, Readonly<Record<string, ArchiveGeometry>>>
>;
/** Exceção local aceita somente enquanto a geometria persistida continua igual. */
export function archiveSameGeometry(a: ArchiveGeometry, b: ArchiveGeometry) {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}
export interface ArchiveLayout {
  reserves: ArchiveReserve[];
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
    reserveFallback: "budget" | "collisions" | null;
    reserveValidationChecks: number;
    reserveComponents?: {
      accepted: number;
      rejected: number;
      interdependent: number;
    };
    reserveIndexChecks?: number;
    diagnosticChecks?: number;
    diagnosticsIncomplete?: boolean;
    reserveStatus?: {
      sourceId: string;
      state: "satisfied" | "partial" | "vetoed" | "budget" | "protected";
    }[];
    reserveResiduals: {
      sourceId: string;
      cardId: string;
      manual: boolean;
      protected: boolean;
    }[];
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
  const { children } = archiveHierarchy(graph.placements);
  const raw = new Map(graph.placements.map((p) => [p.id, p]));
  const queue = Object.keys(visual);
  const visited = new Set(queue);
  for (let i = 0; i < queue.length; i++) {
    const parentId = queue[i],
      parent = result[parentId];
    for (const child of children.get(parentId) ?? []) {
      if (child.parentPlacementId !== parentId || visited.has(child.id))
        continue;
      visited.add(child.id);
      queue.push(child.id);
      const original = raw.get(parentId)!;
      result[child.id] = isCustomBranch(child)
        ? relativeGeometry(child, parent)
        : {
            ...geometryOf(child),
            x: child.x + parent.x - original.x,
            y: child.y + parent.y - original.y,
          };
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

/** Uma intenção explícita é uma exceção apenas às reservas ativas deste ciclo. */
export function archiveReserveIntent(
  layout: ArchiveLayout,
  previous: ArchiveReserveExceptions,
  id: string,
  geometry: ArchiveGeometry,
): ArchiveReserveExceptions {
  const next: Record<string, Record<string, ArchiveGeometry>> = {};
  for (const reserve of layout.reserves) {
    const entries = { ...(previous[reserve.sourceId] ?? {}) };
    delete entries[id];
    // Também protege o fim de um arraste que saiu da reserva e alcançou a cadeia
    // de vizinhos afastados: não disputar a posição recém-confirmada pelo Mestre.
    if (!reserve.members.has(id)) entries[id] = { ...geometry };
    if (Object.keys(entries).length) next[reserve.sourceId] = entries;
  }
  return next;
}

/** Cálculo finito no espaço do quadro. Não conhece DOM, câmera, HTTP ou relógio.
 * A ordem é profundidade/ID para núcleos e ângulo/ID para filhos. */
export function layoutArchive(
  projection: ArchiveProjection,
  options: {
    anchors?: Readonly<Record<string, ArchiveAnchor>>;
    config?: Partial<typeof ARCHIVE_LAYOUT_CONFIG>;
    manual?: ArchiveReserveExceptions;
  } = {},
): ArchiveLayout {
  const config = { ...ARCHIVE_LAYOUT_CONFIG, ...options.config };
  const finite = (n: number, fallback: number, min: number, max: number) =>
    Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  const cards = projection.graph.placements
    .map((p) => ({
      ...p,
      x: finite(p.x, 0, -config.limit, config.limit),
      y: finite(p.y, 0, -config.limit, config.limit),
      width: finite(p.width, 280, 1, 1600),
      height: finite(p.height, 200, 1, 1600),
      zIndex: finite(p.zIndex, 0, -config.limit, config.limit),
    }))
    .sort((a, b) => order(a.id, b.id));
  const originalById = new Map(
    projection.graph.placements.map((p) => [p.id, p]),
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
    reserveFallback: null,
    reserveValidationChecks: 0,
    reserveIndexChecks: 0,
    reserveResiduals: [],
  };
  const causes = new Map<string, { sourceId: string; depth: number }>();
  const hierarchy = archiveHierarchy(cards);
  const depth = (id: string) => hierarchy.depths.get(id) ?? 0;
  const groups = cards
    .filter(
      (p) =>
        projection.nodes.get(p.id)?.expanded &&
        projection.nodes.get(p.id)!.children.some((c) => raw.has(c.id)),
    )
    .sort((a, b) => depth(a.id) - depth(b.id) || order(a.id, b.id));
  if (!groups.length)
    return {
      graph: cards.some((p) => !archiveSameGeometry(p, originalById.get(p.id)!))
        ? { ...projection.graph, placements: cards }
        : projection.graph,
      geometry: result,
      offsets: new Map(),
      affected: [],
      diagnostics,
      reserves: [],
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
      !isCustomBranch(p) &&
      !p.parentPlacementId
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
      diagnostics.checks +
        (diagnostics.reserveIndexChecks ?? 0) +
        diagnostics.reserveValidationChecks >=
        config.maxChecks ||
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
      .map((p) => raw.get(p.id)!)
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
        const pin = options.anchors?.[child.id];
        if (
          anchors.has(child.id) &&
          pin?.parentId === group.id &&
          pin.signature ===
            archiveAnchorSignature(
              child,
              projection.graph.placements,
              originalById,
            ) &&
          Number.isFinite(pin.offsetX) &&
          Number.isFinite(pin.offsetY) &&
          !custom.has(child.id)
        ) {
          result.set(child.id, {
            ...geometryOf(child),
            x: core.x + core.width / 2 + pin.offsetX! - child.width / 2,
            y: core.y + core.height / 2 + pin.offsetY! - child.height / 2,
          });
          pinned.add(child.id);
        }
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
  const indexCheck = () => {
    if (exhausted()) return false;
    diagnostics.reserveIndexChecks = (diagnostics.reserveIndexChecks ?? 0) + 1;
    return true;
  };
  // União localizada: não cria uma envoltória gigante entre um ramo remoto e o núcleo.
  const reserves: ArchiveReserve[] = [];
  const expandedIds = new Set(groups.map((g) => g.id));
  const manual = new Set<string>();
  for (const group of groups) {
    let ancestor = raw.get(group.parentPlacementId ?? ""),
      nested = false;
    const seen = new Set<string>();
    while (ancestor && !seen.has(ancestor.id)) {
      seen.add(ancestor.id);
      if (expandedIds.has(ancestor.id)) {
        nested = true;
        break;
      }
      ancestor = raw.get(ancestor.parentPlacementId ?? "");
    }
    if (nested) continue;
    const members = new Set<string>([group.id]);
    for (const id of members)
      for (const child of projection.nodes.get(id)?.children ?? [])
        if (raw.has(child.id)) members.add(child.id);
    const margin = Number.isFinite(config.reserveMargin)
      ? Math.max(0, Math.min(config.limit, config.reserveMargin))
      : 0;
    if (!margin) continue;
    const memberIds = [...members].sort(order);
    const localRegions = memberIds.map((id) => {
      const g = result.get(id)!;
      return {
        ...g,
        x: g.x - margin,
        y: g.y - margin,
        width: g.width + margin * 2,
        height: g.height + margin * 2,
      };
    });
    let regions = localRegions;
    let coreRegions = 0;
    if (config.reserveBands > 0) {
      // Área contínua em torno do núcleo, sem desenhar círculo ou alterar os anéis.
      // Um ramo remoto desconectado continua local, sem inflar todo o quadro.
      const core = result.get(group.id)!,
        c = center(core),
        connected = new Set<number>([memberIds.indexOf(group.id)]);
      for (const i of connected)
        for (let j = 0; j < localRegions.length; j++)
          if (
            !connected.has(j) &&
            indexCheck() &&
            archiveIntersects(localRegions[i], localRegions[j], 0)
          )
            connected.add(j);
      const radius =
        Math.max(
          ...[...connected].map((i) => {
            const g = result.get(memberIds[i])!,
              p = center(g);
            return (
              Math.hypot(p.x - c.x, p.y - c.y) +
              Math.hypot(g.width, g.height) / 2
            );
          }),
        ) + margin;
      const bands = Math.max(4, Math.min(24, Math.floor(config.reserveBands)));
      coreRegions = bands;
      regions = Array.from({ length: bands }, (_, i) => {
        const y0 = -radius + (i * 2 * radius) / bands,
          y1 = -radius + ((i + 1) * 2 * radius) / bands;
        const near =
          y0 <= 0 && y1 >= 0 ? 0 : Math.min(Math.abs(y0), Math.abs(y1));
        const half = Math.sqrt(Math.max(0, radius * radius - near * near));
        return {
          ...core,
          x: c.x - half,
          y: c.y + y0,
          width: half * 2,
          height: y1 - y0,
        };
      });
      regions.push(...localRegions.filter((_, i) => !connected.has(i)));
    }
    reserves.push({ sourceId: group.id, members, regions, coreRegions });
    for (const [id, geometry] of Object.entries(
      options.manual?.[group.id] ?? {},
    ))
      if (
        raw.has(id) &&
        archiveSameGeometry(raw.get(id)!, geometry) &&
        !members.has(id)
      )
        manual.add(id);
  }
  // Uma intenção manual não participa da escolha radial nem é expulsa pelo afastamento.
  for (const id of manual) reserved.add(id);
  const fixed = [...reserved].sort(order),
    movable = cards.filter((p) => !reserved.has(p.id));
  const originalArea = (a: string, b: string) =>
    radial.has(a) || radial.has(b)
      ? 0
      : archiveOverlapArea(raw.get(a)!, raw.get(b)!, config.gap);
  const introduced = (a: string, b: string) =>
    archiveOverlapArea(result.get(a)!, result.get(b)!, config.gap) >
    originalArea(a, b) + EPS;
  type Obstacle = {
    id: string;
    sourceId: string;
    depth: number;
    region?: ArchiveGeometry;
    members?: ReadonlySet<string>;
    cluster?: number;
  };
  const reserveObstacles: Obstacle[] = reserves.flatMap((r) =>
    r.regions.map((region, i) => ({
      id: `reserve:${r.sourceId}:${i}`,
      sourceId: r.sourceId,
      depth: 0,
      region,
      cluster: i < r.coreRegions ? 0 : i + 1,
      members: r.members,
    })),
  );
  const coreZones = new Map<string, ArchiveGeometry[]>();
  for (const obstacle of reserveObstacles)
    if (obstacle.cluster === 0) {
      const list = coreZones.get(obstacle.sourceId) ?? [];
      list.push(obstacle.region!);
      coreZones.set(obstacle.sourceId, list);
    }
  const fixedObstacles: Obstacle[] = fixed.map((id) => ({
    id,
    sourceId: causes.get(id)?.sourceId ?? id,
    depth: 0,
  }));
  const queue: Obstacle[] = [...fixedObstacles];
  const geometry = (b: Obstacle) => b.region ?? result.get(b.id)!;
  const applicable = (b: Obstacle, id: string) =>
    b.region ? !b.members!.has(id) && !manual.has(id) : introduced(b.id, id);
  const moves = new Map<string, number>();
  let reservePhase = false;
  const sweeps = new Map<string, ArchiveGeometry>();
  const reserveDependencies = new Map<string, Set<string>>();
  let physical: Map<string, ArchiveGeometry> | undefined;
  let physicalCauses:
    | Map<string, { sourceId: string; depth: number }>
    | undefined;
  for (let q = 0; !exhausted(); q++) {
    if (q >= queue.length) {
      if (reservePhase || !reserveObstacles.length) break;
      physical = new Map(result);
      physicalCauses = new Map(causes);
      reservePhase = true;
      queue.push(...reserveObstacles);
    }
    const event = queue[q],
      blocker = geometry(event);
    // A lista depende do evento, não do card: evita realocá-la em toda colisão.
    const obstacles = [
      event,
      ...fixedObstacles.filter((b) => b.id !== event.id),
      ...(reservePhase
        ? reserveObstacles.filter((b) => b.id !== event.id)
        : []),
    ];
    for (const card of movable) {
      if (card.id === event.id || exhausted()) continue;
      if (
        !overlap(blocker, result.get(card.id)!) ||
        !applicable(event, card.id)
      )
        continue;
      const cause = causes.get(card.id) ?? {
        sourceId: event.sourceId,
        depth: event.depth + 1,
      };
      const origin = center(
        result.get(cause.sourceId) ?? raw.get(cause.sourceId) ?? blocker,
      );
      let moved = false;
      for (
        let attempt = 0;
        attempt < config.maxMovesPerCard && !exhausted();
        attempt++
      ) {
        const current = result.get(card.id)!;
        let hit: Obstacle | undefined;
        for (const obstacle of obstacles)
          if (
            obstacle.id !== card.id &&
            overlap(current, geometry(obstacle)) &&
            applicable(obstacle, card.id)
          ) {
            hit = obstacle;
            break;
          }
        if (!hit) break;
        if ((moves.get(card.id) ?? 0) >= config.maxMovesPerCard) {
          diagnostics.capped = true;
          break;
        }
        const b = geometry(hit),
          cc = center(current),
          dx = cc.x - origin.x,
          dy = cc.y - origin.y;
        // Uma faixa não deve empurrar o card em pequenos degraus por dentro da
        // área contínua. Separa pela borda útil de todo o núcleo, sem envolver ramos remotos.
        let right = b.x + b.width,
          left = b.x,
          bottom = b.y + b.height,
          top = b.y;
        if (hit.region && hit.cluster === 0) {
          const zones = coreZones.get(hit.sourceId)!;
          const horizontal = zones.filter(
            (r) =>
              r.y < current.y + current.height + config.gap &&
              r.y + r.height + config.gap > current.y,
          );
          const vertical = zones.filter(
            (r) =>
              r.x < current.x + current.width + config.gap &&
              r.x + r.width + config.gap > current.x,
          );
          right = Math.max(...horizontal.map((r) => r.x + r.width));
          left = Math.min(...horizontal.map((r) => r.x));
          bottom = Math.max(...vertical.map((r) => r.y + r.height));
          top = Math.min(...vertical.map((r) => r.y));
        }
        const candidates = [
          { x: right + config.gap - current.x, y: 0 },
          { x: left - config.gap - current.x - current.width, y: 0 },
          { x: 0, y: bottom + config.gap - current.y },
          { x: 0, y: top - config.gap - current.y - current.height },
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
        if (reservePhase) {
          if (hit.region) {
            const entries =
              reserveDependencies.get(hit.sourceId) ?? new Set<string>();
            entries.add(card.id);
            reserveDependencies.set(hit.sourceId, entries);
          }
          const old = sweeps.get(card.id) ?? current;
          const x = Math.min(old.x, next.x),
            y = Math.min(old.y, next.y);
          sweeps.set(card.id, {
            ...old,
            x,
            y,
            width: Math.max(old.x + old.width, next.x + next.width) - x,
            height: Math.max(old.y + old.height, next.y + next.height) - y,
          });
        }
        result.set(card.id, next);
        causes.set(card.id, cause);
        moves.set(card.id, (moves.get(card.id) ?? 0) + 1);
        diagnostics.moves++;
        moved = true;
      }
      if (moved) queue.push({ id: card.id, ...cause });
    }
  }
  if (reserveObstacles.length && !reservePhase && exhausted())
    diagnostics.reserveFallback = "budget";
  if (physical) {
    const changed = new Set(
      cards
        .filter(
          (p) => !archiveSameGeometry(result.get(p.id)!, physical!.get(p.id)!),
        )
        .map((p) => p.id),
    );
    // Componentes pelo caminho percorrido, não pela hierarquia. Uma trajetória
    // envolve todos os seus destinos intermediários (caixa conservadora).
    const ids = [...changed].sort(order),
      parents = new Map(ids.map((id) => [id, id]));
    const find = (id: string): string => {
      let root = id;
      while (parents.get(root)! !== root) root = parents.get(root)!;
      while (id !== root) {
        const next = parents.get(id)!;
        parents.set(id, root);
        id = next;
      }
      return root;
    };
    const join = (a: string, b: string) => {
      a = find(a);
      b = find(b);
      if (a !== b) parents.set(b, a);
    };
    const safety = () => {
      if (
        diagnostics.checks +
          (diagnostics.reserveIndexChecks ?? 0) +
          diagnostics.reserveValidationChecks >=
        config.maxChecks
      ) {
        diagnostics.capped = true;
        diagnostics.reserveFallback = "budget";
        return false;
      }
      diagnostics.reserveValidationChecks++;
      return true;
    };
    let uncertain = false;
    const bad = new Set<string>();
    for (let i = 0; i < cards.length && !uncertain; i++)
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i].id,
          b = cards[j].id;
        if (!changed.has(a) && !changed.has(b)) continue;
        if (!safety()) {
          uncertain = true;
          break;
        }
        const area = archiveOverlapArea(
          result.get(a)!,
          result.get(b)!,
          config.gap,
        );
        const worsened =
          area > originalArea(a, b) + EPS &&
          area >
            archiveOverlapArea(physical.get(a)!, physical.get(b)!, config.gap) +
              EPS;
        if (worsened) {
          // Com uma única família não existe outra reserva independente a salvar.
          // Manter o veto rápido evita construir componentes sem benefício.
          if (reserves.length === 1) {
            uncertain = true;
            break;
          }
          if (changed.has(a) && changed.has(b)) join(a, b);
          if (changed.has(a)) bad.add(a);
          if (changed.has(b)) bad.add(b);
        }
      }
    if (bad.size) {
      for (const entries of reserveDependencies.values()) {
        const linked = [...entries].filter((id) => changed.has(id));
        for (let i = 1; i < linked.length; i++) {
          if (!safety()) {
            uncertain = true;
            break;
          }
          join(linked[0], linked[i]);
        }
        if (uncertain) break;
      }
      for (let i = 0; i < ids.length && !uncertain; i++)
        for (let j = i + 1; j < ids.length; j++) {
          if (!safety()) {
            uncertain = true;
            break;
          }
          if (
            archiveIntersects(
              sweeps.get(ids[i])!,
              sweeps.get(ids[j])!,
              config.gap,
            )
          )
            join(ids[i], ids[j]);
        }
    }
    const rejected = new Set([...bad].map(find));
    const roots = new Set(ids.map(find));
    if (!uncertain) {
      for (const id of ids)
        if (rejected.has(find(id))) {
          result.set(id, physical.get(id)!);
          const cause = physicalCauses!.get(id);
          if (cause) causes.set(id, cause);
          else causes.delete(id);
        }
      // A restauração pode reencontrar destinos de outra tentativa. Validar a
      // composição conjunta; qualquer dúvida volta ao snapshot físico inteiro.
      for (let i = 0; i < cards.length && !uncertain && rejected.size > 0; i++)
        for (let j = i + 1; j < cards.length; j++) {
          const a = cards[i].id,
            b = cards[j].id;
          if (!changed.has(a) && !changed.has(b)) continue;
          if (!safety()) {
            uncertain = true;
            break;
          }
          if (
            archiveOverlapArea(result.get(a)!, result.get(b)!, config.gap) >
            Math.max(
              originalArea(a, b),
              archiveOverlapArea(
                physical.get(a)!,
                physical.get(b)!,
                config.gap,
              ),
            ) +
              EPS
          ) {
            uncertain = true;
            break;
          }
        }
    }
    diagnostics.reserveComponents = {
      accepted: uncertain
        ? 0
        : bad.size
          ? roots.size - rejected.size
          : ids.length
            ? 1
            : 0,
      rejected: uncertain ? (ids.length ? 1 : 0) : rejected.size,
      interdependent: ids.length - roots.size,
    };
    if (rejected.size || uncertain)
      diagnostics.reserveFallback ??= "collisions";
    if (uncertain) {
      for (const [id, g] of physical) result.set(id, g);
      causes.clear();
      for (const [id, cause] of physicalCauses!) causes.set(id, cause);
    }
  }

  for (const reserve of reserves)
    for (const card of cards) {
      if (reserve.members.has(card.id)) continue;
      if (
        (diagnostics.diagnosticChecks ?? 0) >= ARCHIVE_LAYOUT_CONFIG.maxChecks
      ) {
        diagnostics.diagnosticsIncomplete = true;
        break;
      }
      if (
        reserve.regions.some(
          (r) =>
            (diagnostics.diagnosticChecks =
              (diagnostics.diagnosticChecks ?? 0) + 1) <=
              ARCHIVE_LAYOUT_CONFIG.maxChecks &&
            archiveIntersects(r, result.get(card.id)!, config.gap),
        )
      )
        diagnostics.reserveResiduals.push({
          sourceId: reserve.sourceId,
          cardId: card.id,
          manual: manual.has(card.id),
          protected: reserved.has(card.id),
        });
    }
  diagnostics.reserveStatus = reserves.map((reserve) => {
    const remaining = diagnostics.reserveResiduals.filter(
      (r) => r.sourceId === reserve.sourceId,
    );
    const applied = [...(reserveDependencies.get(reserve.sourceId) ?? [])].some(
      (id) =>
        physical && !archiveSameGeometry(result.get(id)!, physical.get(id)!),
    );
    return {
      sourceId: reserve.sourceId,
      state:
        diagnostics.diagnosticsIncomplete ||
        diagnostics.reserveFallback === "budget"
          ? "budget"
          : !remaining.length
            ? "satisfied"
            : remaining.every((r) => r.manual || r.protected)
              ? "protected"
              : applied
                ? "partial"
                : "vetoed",
    };
  });
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
      if (
        (diagnostics.diagnosticChecks ?? 0) >= ARCHIVE_LAYOUT_CONFIG.maxChecks
      ) {
        diagnostics.diagnosticsIncomplete = true;
        break;
      }
      diagnostics.diagnosticChecks = (diagnostics.diagnosticChecks ?? 0) + 1;
      if (archiveIntersects(result.get(a)!, result.get(b)!, config.gap)) {
        if (
          manual.has(a) ||
          manual.has(b) ||
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
    reserves,
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
