/** Planejador determinístico das conexões do Fichário.
 *
 * O roteador só lê a geometria de apresentação: não move cards, não persiste
 * caminhos e não conhece regra de jogo. Portas, corredores e rótulos são
 * derivados uma vez por mudança de geometria/topologia; a pintura por frame
 * reaproveita o plano e apenas adapta as pontas.
 */
import {
  NARRATIVE_RELATION_LABELS,
  type NarrativeRelation,
} from "../../../../src/modules/shared/narrative";
import type { ArchivePoint, ArchiveRect } from "./archiveCamera";
import {
  ARCHIVE_LINK_GEOMETRY,
  angularLinkConnectors,
  archiveLinkCenter,
  archiveLinkDistance,
  archiveLinkFacingSides,
  archiveLinkNormal,
  archiveLinkPath,
  archiveLinkPathCommands,
  archiveLinkPointOnPolyline,
  archiveLinkPolylineLength,
  archiveLinkPort,
  archiveRectsIntersect,
  inflateArchiveRect,
  offsetArchiveLinkLane,
  segmentCrossesArchiveRect,
  simplifyArchiveLinkPoints,
  type ArchiveLinkSide,
} from "./archiveLinkGeometry";
import { archiveRelationLabelBox } from "./archiveRelationMetrics";

export type ArchiveRouteStrategy = "direct" | "elbow" | "diagonal" | "detour";

/** Menor contrato aceito pelo roteador; o DTO do Arquivo é estruturalmente compatível. */
export interface ArchiveRouteNode extends ArchiveRect {
  id: string;
  cardId: string;
}
export interface ArchiveRouteLink {
  id: string;
  sourceId: string;
  targetId: string;
  relation?: string;
  label?: string;
  directed?: boolean;
}
export interface ArchiveRouteLabel {
  /** Índice do segmento da polilinha em que o rótulo se apoia. */
  segment: number;
  /** Posição normalizada dentro desse segmento. */
  at: number;
}
export interface ArchiveLinkRoutePlan {
  sides: [ArchiveLinkSide, ArchiveLinkSide];
  slots: [number, number];
  lane: number;
  strategy: ArchiveRouteStrategy;
  variant: number;
  /** Pontos absolutos de desvio (cantos de obstáculos), sem as âncoras. */
  via: ArchivePoint[];
  /** Diagnóstico do corredor: lados, estratégia e variante. */
  corridor: string;
  cost: number;
  /** Cards cujo interior a rota ainda atravessa (vazio = rota livre). */
  residual: string[];
  /** Verdadeiro quando o orçamento de cálculo esgotou antes da checagem. */
  budget: boolean;
  label: ArchiveRouteLabel | null;
  labelOverlap: boolean;
}
export interface ArchiveRouteStats {
  links: number;
  planned: number;
  candidates: number;
  obstacleTests: number;
  fallbacks: number;
  crossings: number;
  budgetExceeded: boolean;
  maxTests: number;
}
export interface ArchiveRoutePlanSet {
  routes: Map<string, ArchiveLinkRoutePlan>;
  stats: ArchiveRouteStats;
}
export interface ArchiveLinkRoute {
  from: ArchivePoint;
  to: ArchivePoint;
  fromSide: ArchiveLinkSide;
  toSide: ArchiveLinkSide;
  points: ArchivePoint[];
  path: string;
  labelPoint: ArchivePoint;
  length: number;
  lane: number;
  strategy: ArchiveRouteStrategy;
  fallback: boolean;
  residual: string[];
}

/** Orçamentos explícitos: nada de busca irrestrita no plano do Fichário. */
export const ARCHIVE_LINK_ROUTING = {
  laneStep: ARCHIVE_LINK_GEOMETRY.lane,
  maxLinks: 4000,
  maxCandidatesPerLink: 64,
  maxDetourObstacles: 4,
  maxNearbyRouted: 16,
  maxBuildsPerLink: 40,
  maxSegmentTests: 600_000,
  segmentTestsPerLink: 4_000,
  maxAbsoluteSegmentTests: 6_000_000,
  labelHeight: 26,
  labelGap: 4,
} as const;

/**
 * Pesos da função de custo, na ordem de prioridade documentada:
 * interior (proibido) → portas/direção → sobreposição com outras conexões →
 * cruzamentos → comprimento → inflexões → estabilidade.
 */
export const ARCHIVE_ROUTE_WEIGHTS = {
  interior: 1_000_000,
  clearance: 900,
  crossing: 140,
  length: 0.55,
  turn: 34,
  angle: 0.9,
  detour: 26,
  diagonal: 8,
  alignment: 12,
  misalignedDirect: 320,
  occupancy: 70,
  sideSwitch: 140,
  strategySwitch: 45,
  labelCard: 1_000_000,
  labelOverlap: 9000,
  labelCrossing: 4000,
  labelEnd: 500,
  labelCorner: 160,
  labelShortSegment: 180,
} as const;

const EPS = 1e-6;
const pairKey = (link: ArchiveRouteLink) =>
  [link.sourceId, link.targetId].sort().join("|");
const byId = (a: { id: string }, b: { id: string }) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const archiveLinkLabel = (link: ArchiveRouteLink) =>
  link.label?.trim() ||
  NARRATIVE_RELATION_LABELS[link.relation as NarrativeRelation] ||
  "Relação";

/** Grade esparsa: cada card entra nas células que ocupa; consultas por trecho. */
function obstacleIndex(nodes: readonly ArchiveRouteNode[], cell = 320) {
  const buckets = new Map<string, number[]>(),
    huge: number[] = [];
  nodes.forEach((node, index) => {
    const x0 = Math.floor(node.x / cell),
      x1 = Math.floor((node.x + node.width) / cell),
      y0 = Math.floor(node.y / cell),
      y1 = Math.floor((node.y + node.height) / cell);
    if (
      !Number.isFinite(x0) ||
      !Number.isFinite(x1) ||
      !Number.isFinite(y0) ||
      !Number.isFinite(y1) ||
      (x1 - x0 + 1) * (y1 - y0 + 1) > 4096
    ) {
      huge.push(index);
      return;
    }
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const key = `${x}:${y}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(index);
        else buckets.set(key, [index]);
      }
  });
  return {
    query(rect: ArchiveRect): ArchiveRouteNode[] {
      const x0 = Math.floor(rect.x / cell),
        x1 = Math.floor((rect.x + rect.width) / cell),
        y0 = Math.floor(rect.y / cell),
        y1 = Math.floor((rect.y + rect.height) / cell);
      if (
        !Number.isFinite(x0) ||
        !Number.isFinite(x1) ||
        !Number.isFinite(y0) ||
        !Number.isFinite(y1) ||
        (x1 - x0 + 1) * (y1 - y0 + 1) > 512
      )
        return nodes.filter((node) => archiveRectsIntersect(node, rect));
      const seen = new Set<number>(huge),
        found: ArchiveRouteNode[] = huge.map((index) => nodes[index]);
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          for (const index of buckets.get(`${x}:${y}`) ?? []) {
            if (seen.has(index)) continue;
            seen.add(index);
            const node = nodes[index];
            if (archiveRectsIntersect(node, rect)) found.push(node);
          }
      return found;
    },
  };
}

interface Candidate {
  sides: [ArchiveLinkSide, ArchiveLinkSide];
  strategy: ArchiveRouteStrategy;
  variant: number;
  via: ArchivePoint[];
  points: ArchivePoint[];
  cost: number;
  residual: string[];
  clearance: number;
  crossings: number;
  order: number;
}

interface Evaluation {
  residual: string[];
  clearance: number;
}

/** Ângulo entre a normal da porta e a direção do outro card (0 = encaixe ideal). */
function portAngle(
  rect: ArchiveRect,
  side: ArchiveLinkSide,
  toward: ArchivePoint,
): number {
  const normal = archiveLinkNormal(side),
    center = archiveLinkCenter(rect);
  const dx = toward.x - center.x,
    dy = toward.y - center.y;
  const length = Math.max(EPS, Math.hypot(dx, dy));
  const dot = (normal.x * dx + normal.y * dy) / length;
  return (Math.acos(clamp(dot, -1, 1)) * 180) / Math.PI;
}

/** Desvio (em graus) dos trechos centrais em relação a eixos e diagonais de 45°. */
function alignmentPenalty(points: readonly ArchivePoint[]) {
  let total = 0;
  for (let i = 2; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 0.5) continue;
    const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI) % 180;
    const mod = angle % 45;
    total += Math.min(mod, 45 - mod);
  }
  return total;
}

/** Pior desvio dos trechos centrais (sem as saídas perpendiculares). */
function bodyDeviation(points: readonly ArchivePoint[]): number {
  let worst = 0;
  for (let i = 2; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 0.5) continue;
    const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI) % 180;
    const mod = angle % 45;
    worst = Math.max(worst, Math.min(mod, 45 - mod));
  }
  return worst;
}

const segmentBounds = (a: ArchivePoint, b: ArchivePoint): ArchiveRect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

function evaluateRoute(
  points: readonly ArchivePoint[],
  sourceId: string,
  targetId: string,
  obstacles: readonly ArchiveRouteNode[],
  stats: ArchiveRouteStats,
  clearance = ARCHIVE_LINK_GEOMETRY.clearance,
): Evaluation {
  const residual = new Set<string>();
  let clearanceHits = 0;
  if (!obstacles.length) return { residual: [], clearance: 0 };
  let minX = Number.POSITIVE_INFINITY,
    minY = Number.POSITIVE_INFINITY,
    maxX = Number.NEGATIVE_INFINITY,
    maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  const around = obstacles.filter((node) =>
    archiveRectsIntersect(node, inflateArchiveRect(bounds, clearance)),
  );
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (archiveLinkDistance(a, b) < 0.5) continue;
    // Caixa do segmento: descarta quase todos os obstáculos sem o teste
    // exato de retângulo contra retângulo.
    const band = inflateArchiveRect(segmentBounds(a, b), clearance);
    for (const node of around) {
      if (!archiveRectsIntersect(node, band)) continue;
      if (stats.obstacleTests >= stats.maxTests) {
        stats.budgetExceeded = true;
        return { residual: [], clearance: 0 };
      }
      stats.obstacleTests++;
      const own = node.id === sourceId || node.id === targetId;
      if (segmentCrossesArchiveRect(a, b, node, 1)) residual.add(node.id);
      else if (
        !own &&
        segmentCrossesArchiveRect(a, b, inflateArchiveRect(node, clearance), 0.5)
      )
        clearanceHits++;
    }
  }
  return { residual: [...residual], clearance: clearanceHits };
}

/**
 * Obstáculos que podem afetar este vínculo: caixa dos dois cards mais a
 * folga, limitada aos mais próximos. Mantém a avaliação previsível mesmo em
 * quadros extensos, sem varrer o plano inteiro por candidato.
 */
function relevantObstacles(
  a: ArchiveRouteNode,
  b: ArchiveRouteNode,
  index: ReturnType<typeof obstacleIndex>,
): ArchiveRouteNode[] {
  const margin = ARCHIVE_LINK_GEOMETRY.clearance * 3;
  const box = {
    x: Math.min(a.x, b.x) - margin,
    y: Math.min(a.y, b.y) - margin,
    width:
      Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x) + margin * 2,
    height:
      Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y) + margin * 2,
  };
  const near = index.query(box);
  if (near.length <= 40) return near;
  const middle = {
    x: (archiveLinkCenter(a).x + archiveLinkCenter(b).x) / 2,
    y: (archiveLinkCenter(a).y + archiveLinkCenter(b).y) / 2,
  };
  return near
    .sort(
      (left, right) =>
        Math.hypot(
          left.x + left.width / 2 - middle.x,
          left.y + left.height / 2 - middle.y,
        ) -
          Math.hypot(
            right.x + right.width / 2 - middle.x,
            right.y + right.height / 2 - middle.y,
          ) || (left.id < right.id ? -1 : 1),
    )
    .slice(0, 40);
}

function segmentsCross(
  a: ArchivePoint,
  b: ArchivePoint,
  c: ArchivePoint,
  d: ArchivePoint,
) {
  const cross = (p: ArchivePoint, q: ArchivePoint, r: ArchivePoint) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = cross(c, d, a),
    d2 = cross(c, d, b),
    d3 = cross(a, b, c),
    d4 = cross(a, b, d);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/** Cruzamentos com as rotas vizinhas já fixadas (mesmo card, conjunto limitado). */
function countCrossings(
  points: readonly ArchivePoint[],
  nearby: readonly (readonly ArchivePoint[])[],
) {
  let total = 0;
  for (const other of nearby)
    for (let i = 1; i < points.length; i++)
      for (let j = 1; j < other.length; j++)
        if (segmentsCross(points[i - 1], points[i], other[j - 1], other[j]))
          total++;
  return total;
}

export interface ArchiveLinkRouteMode {
  sides: [ArchiveLinkSide, ArchiveLinkSide];
  slots: [number, number];
  strategy: ArchiveRouteStrategy;
  variant: number;
  via: readonly ArchivePoint[];
}

/**
 * Reconstrói a polilinha a partir do plano e da geometria ATUAL. É a mesma
 * função usada no planejamento, na pintura estática e no loop de animação:
 * nunca há dois caminhos incompatíveis para a mesma rota.
 */
export function archiveLinkRoutePoints(
  mode: ArchiveLinkRouteMode,
  a: ArchiveRect,
  b: ArchiveRect,
  lane = 0,
): ArchivePoint[] {
  const [sideA, sideB] = mode.sides;
  const anchorA = archiveLinkPort(a, sideA, mode.slots[0]);
  const anchorB = archiveLinkPort(b, sideB, mode.slots[1]);
  const normalA = archiveLinkNormal(sideA),
    normalB = archiveLinkNormal(sideB);
  const stub = ARCHIVE_LINK_GEOMETRY.stub;
  const from = {
    x: anchorA.x + normalA.x * stub,
    y: anchorA.y + normalA.y * stub,
  };
  const to = { x: anchorB.x + normalB.x * stub, y: anchorB.y + normalB.y * stub };
  const connector = (start: ArchivePoint, end: ArchivePoint, variant: number) => {
    const options = angularLinkConnectors(start, end);
    return options[clamp(variant, 0, options.length - 1)] ?? [end];
  };
  let points: ArchivePoint[];
  switch (mode.strategy) {
    case "elbow": {
      const corner =
        mode.variant === 1 ? { x: from.x, y: to.y } : { x: to.x, y: from.y };
      points = [anchorA, from, corner, to, anchorB];
      break;
    }
    case "diagonal":
      points = [anchorA, from, ...connector(from, to, mode.variant), anchorB];
      break;
    case "detour": {
      const first = mode.via[0],
        second = mode.via[1];
      if (!first || !second) {
        points = [anchorA, from, to, anchorB];
        break;
      }
      points = [
        anchorA,
        from,
        ...connector(from, first, mode.variant),
        second,
        ...connector(second, to, mode.variant),
        anchorB,
      ];
      break;
    }
    default:
      points = [anchorA, from, to, anchorB];
  }
  return simplifyArchiveLinkPoints(offsetArchiveLinkLane(points, lane));
}

function fallbackMode(a: ArchiveRect, b: ArchiveRect): ArchiveLinkRouteMode {
  return {
    sides: [
      archiveLinkFacingSides(a, archiveLinkCenter(b))[0],
      archiveLinkFacingSides(b, archiveLinkCenter(a))[0],
    ],
    slots: [0, 0],
    strategy: "direct",
    variant: 0,
    via: [],
  };
}

/** Aplica o deslocamento perpendicular do rótulo sobre o próprio trajeto. */
function shiftLabelPoint(
  points: readonly ArchivePoint[],
  segment: number,
  at: number,
  offset: number,
): ArchivePoint {
  const base = archiveLinkPointOnPolyline(points, segment, at);
  if (!offset) return base;
  const head = points[segment],
    tail = points[segment + 1];
  if (!head || !tail) return base;
  const span = Math.max(1, archiveLinkDistance(head, tail));
  return {
    x: base.x - ((tail.y - head.y) / span) * offset,
    y: base.y + ((tail.x - head.x) / span) * offset,
  };
}

/**
 * Geometria de uma rota. Sem plano (vínculo transitório de saída), cai numa
 * conexão direta previsível — nunca esconde a relação.
 */
export function archiveLinkRouteGeometry(
  plan: ArchiveLinkRoutePlan | undefined,
  a: ArchiveRect,
  b: ArchiveRect,
): ArchiveLinkRoute {
  const mode = plan ?? fallbackMode(a, b);
  const points = archiveLinkRoutePoints(mode, a, b, plan?.lane ?? 0);
  const commands = archiveLinkPathCommands(points);
  const label = plan?.label;
  const labelPoint = label
    ? shiftLabelPoint(
        points,
        label.segment,
        label.at,
        (label as { offset?: number }).offset ?? 0,
      )
    : archiveLinkPointOnPolyline(
        points,
        Math.max(0, Math.floor((points.length - 2) / 2)),
        0.5,
      );
  const first = points[0] ?? { x: a.x, y: a.y };
  return {
    from: first,
    to: points[points.length - 1] ?? first,
    fromSide: mode.sides[0],
    toSide: mode.sides[1],
    points,
    path: archiveLinkPath(commands),
    labelPoint,
    length: archiveLinkPolylineLength(points),
    lane: plan?.lane ?? 0,
    strategy: plan?.strategy ?? "direct",
    fallback: !!plan?.residual.length,
    residual: plan?.residual ?? [],
  };
}

export interface ArchiveRouteInput {
  placements: readonly ArchiveRouteNode[];
  links: readonly ArchiveRouteLink[];
  /** Plano anterior: preserva portas quando a mudança não justifica troca. */
  previous?: ArchiveRoutePlanSet | null;
}

/** Índice esparso dos trechos já roteados, para o rótulo não cair sobre outra linha. */
function routeSegmentIndex(
  lines: readonly { id: string; points: readonly ArchivePoint[] }[],
  cell = 320,
) {
  const buckets = new Map<
    string,
    { id: string; a: ArchivePoint; b: ArchivePoint }[]
  >();
  for (const line of lines)
    for (let i = 1; i < line.points.length; i++) {
      const a = line.points[i - 1],
        b = line.points[i];
      const entry = { id: line.id, a, b };
      const x0 = Math.floor(Math.min(a.x, b.x) / cell),
        x1 = Math.floor(Math.max(a.x, b.x) / cell),
        y0 = Math.floor(Math.min(a.y, b.y) / cell),
        y1 = Math.floor(Math.max(a.y, b.y) / cell);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 1024) {
        const key = "*";
        const list = buckets.get(key) ?? [];
        list.push(entry);
        buckets.set(key, list);
        continue;
      }
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++) {
          const key = `${x}:${y}`;
          const list = buckets.get(key) ?? [];
          list.push(entry);
          buckets.set(key, list);
        }
    }
  return {
    query(rect: ArchiveRect) {
      const x0 = Math.floor(rect.x / cell),
        x1 = Math.floor((rect.x + rect.width) / cell),
        y0 = Math.floor(rect.y / cell),
        y1 = Math.floor((rect.y + rect.height) / cell);
      const found = new Set<string>();
      const out: { id: string; a: ArchivePoint; b: ArchivePoint }[] = [];
      const add = (entry: { id: string; a: ArchivePoint; b: ArchivePoint }) => {
        const key = `${entry.id}:${entry.a.x}:${entry.a.y}:${entry.b.x}:${entry.b.y}`;
        if (found.has(key)) return;
        found.add(key);
        out.push(entry);
      };
      for (const entry of buckets.get("*") ?? []) add(entry);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 1024) {
        for (const list of buckets.values()) for (const entry of list) add(entry);
        return out;
      }
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++) {
          for (const entry of buckets.get(`${x}:${y}`) ?? []) add(entry);
        }
      return out;
    },
  };
}

interface LabelPlacement {
  segment: number;
  at: number;
  /** Deslocamento perpendicular curto, aplicado também no render. */
  offset: number;
  point: ArchivePoint;
  rect: ArchiveRect;
  overlap: boolean;
  /** O melhor candidato insiste em cair sobre um card. */
  cardHit: boolean;
  cost: number;
}

/** Candidatos limitados ao próprio trajeto: nada de posição arbitrária. */
function placeLabel(
  points: readonly ArchivePoint[],
  text: string,
  index: ReturnType<typeof obstacleIndex>,
  placed: readonly ArchiveRect[],
  lines: ReturnType<typeof routeSegmentIndex>,
  linkId: string,
): LabelPlacement {
  const box = archiveRelationLabelBox(text);
  const segments: { index: number; length: number; arc: number }[] = [];
  let total = 0,
    prefix = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const length = archiveLinkDistance(points[i], points[i + 1]);
    segments.push({ index: i, length, arc: prefix });
    prefix += length;
    total += length;
  }
  const long = segments
    .filter((segment) => segment.length >= 44)
    .sort((left, right) => right.length - left.length)
    .slice(0, 10)
    .sort((left, right) => left.index - right.index);
  const pool = long.length ? long : segments;
  const shift = box.height / 2 + 6;
  let best: LabelPlacement | null = null;

  const evaluate = (
    segment: { index: number; length: number; arc: number },
    at: number,
    offset: number,
  ): LabelPlacement => {
    const base = archiveLinkPointOnPolyline(points, segment.index, at);
    const head = points[segment.index],
      tail = points[segment.index + 1];
    const span = Math.max(1, archiveLinkDistance(head, tail));
    const normal = {
      x: -(tail.y - head.y) / span,
      y: (tail.x - head.x) / span,
    };
    // Deslocamento perpendicular curto: a cápsula continua colada à conexão,
    // mas sai de cima de um card que a rota apenas contorna.
    const point = {
      x: base.x + normal.x * offset,
      y: base.y + normal.y * offset,
    };
    const rect: ArchiveRect = {
      x: point.x - box.width / 2,
      y: point.y - box.height / 2,
      width: box.width,
      height: box.height,
    };
    let cost =
      Math.abs((segment.arc + segment.length * at) / Math.max(1, total) - 0.5) * 300;
    if (segment.length < 90) cost += ARCHIVE_ROUTE_WEIGHTS.labelShortSegment;
    if (
      archiveLinkDistance(point, points[0]) < 56 ||
      archiveLinkDistance(point, points[points.length - 1]) < 56
    )
      cost += ARCHIVE_ROUTE_WEIGHTS.labelEnd;
    for (let i = 1; i < points.length - 1; i++)
      if (archiveLinkDistance(point, points[i]) < 30) {
        cost += ARCHIVE_ROUTE_WEIGHTS.labelCorner;
        break;
      }
    let overlap = false,
      cardHit = false;
    for (const node of index.query(rect))
      if (archiveRectsIntersect(rect, node)) {
        cost += ARCHIVE_ROUTE_WEIGHTS.labelCard;
        cardHit = true;
        break;
      }
    for (const other of placed)
      if (
        archiveRectsIntersect(rect, inflateArchiveRect(other, ARCHIVE_LINK_ROUTING.labelGap))
      ) {
        cost += ARCHIVE_ROUTE_WEIGHTS.labelOverlap;
        overlap = true;
      }
    // Uma cápsula sobre outra conexão fica ilegível e perde o próprio hover.
    // Candidato que já caiu sobre um card não precisa dessa conta.
    if (!cardHit)
      for (const crossing of lines.query(inflateArchiveRect(rect, 6)))
        if (
          crossing.id !== linkId &&
          segmentCrossesArchiveRect(crossing.a, crossing.b, rect, 0)
        ) {
          cost += ARCHIVE_ROUTE_WEIGHTS.labelCrossing;
          break;
        }
    return { segment: segment.index, at, offset, point, rect, overlap, cardHit, cost };
  };

  // Desempate determinístico: menor custo e, depois, primeiro candidato.
  const keep = (placement: LabelPlacement) => {
    if (!best || placement.cost < best.cost - 1e-9) best = placement;
  };

  for (const segment of pool)
    for (const at of [0.5, 0.34, 0.66, 0.2, 0.8, 0.42, 0.58])
      for (const offset of [0, shift, -shift]) keep(evaluate(segment, at, offset));

  // Segunda passada, só quando o melhor ainda cai sobre um card: amostragem mais
  // densa e deslocamentos maiores, ainda limitada e determinística.
  if (best && (best as LabelPlacement).cardHit) {
    const dense = segments
      .slice()
      .sort((left, right) => right.length - left.length)
      .slice(0, 6)
      .sort((left, right) => left.index - right.index);
    for (const segment of dense)
      for (let step = 1; step <= 9; step++)
        for (const offset of [0, shift, -shift, shift * 2, -shift * 2])
          keep(evaluate(segment, step / 10, offset));
  }
  if (best) return best;
  return {
    segment: 0,
    at: 0.5,
    offset: 0,
    point: points[0] ?? { x: 0, y: 0 },
    rect: { x: 0, y: 0, width: box.width, height: box.height },
    overlap: false,
    cardHit: false,
    cost: 0,
  };
}

/**
 * Calcula todas as rotas. Entrada geométrica + topologia iguais produzem
 * sempre o mesmo plano (ordem por `id`, candidatos e desempates fixos).
 */
export function planArchiveLinkRoutes(input: ArchiveRouteInput): ArchiveRoutePlanSet {
  const links = [...input.links].sort(byId);
  const nodes = [...input.placements].filter(
    (node) =>
      Number.isFinite(node.x) &&
      Number.isFinite(node.y) &&
      Number.isFinite(node.width) &&
      Number.isFinite(node.height),
  );
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const stats: ArchiveRouteStats = {
    links: links.length,
    planned: 0,
    candidates: 0,
    obstacleTests: 0,
    fallbacks: 0,
    crossings: 0,
    budgetExceeded: false,
    maxTests: ARCHIVE_LINK_ROUTING.maxSegmentTests,
  };
  const routes = new Map<string, ArchiveLinkRoutePlan>();
  const index = obstacleIndex(nodes);

  const usable = links.filter((link) => {
    const a = nodeById.get(link.sourceId),
      b = nodeById.get(link.targetId);
    return !!a && !!b && link.id !== "";
  });

  // Corredores paralelos: mesma dupla de cards, ordem estável por id.
  const groups = new Map<string, string[]>();
  for (const link of usable) {
    const key = pairKey(link);
    const list = groups.get(key);
    if (list) list.push(link.id);
    else groups.set(key, [link.id]);
  }
  const laneOf = new Map<string, number>();
  for (const ids of groups.values())
    ids.forEach((id, position) =>
      laneOf.set(id, position - (ids.length - 1) / 2),
    );

  const occupancy = new Map<string, number>();
  const routedByCard = new Map<string, Set<string>>();
  const routedPoints = new Map<string, ArchivePoint[]>();
  const usage = new Map<string, string[]>();
  const exhausted = usable.length > ARCHIVE_LINK_ROUTING.maxLinks;
  // Orçamento explícito e proporcional: um quadro denso não pode cair todo
  // em fallback apenas porque a contagem de vínculos cresceu.
  stats.maxTests = Math.min(
    ARCHIVE_LINK_ROUTING.maxAbsoluteSegmentTests,
    Math.max(
      ARCHIVE_LINK_ROUTING.maxSegmentTests,
      usable.length * ARCHIVE_LINK_ROUTING.segmentTestsPerLink,
    ),
  );

  for (const link of usable) {
    const a = nodeById.get(link.sourceId)!,
      b = nodeById.get(link.targetId)!;
    const lane = laneOf.get(link.id) ?? 0;
    const obstacles = relevantObstacles(a, b, index);
    const previous = input.previous?.routes.get(link.id);
    const nearby: ArchivePoint[][] = [];
    const incident = new Set<string>();
    for (const card of [link.sourceId, link.targetId])
      for (const id of routedByCard.get(card) ?? []) incident.add(id);
    for (const id of incident) {
      const points = routedPoints.get(id);
      if (points) nearby.push(points);
      if (nearby.length >= ARCHIVE_LINK_ROUTING.maxNearbyRouted) break;
    }

    const consider: Candidate[] = [];
    let builds = 0;
    const push = (candidate: Candidate) => {
      if (consider.length < ARCHIVE_LINK_ROUTING.maxCandidatesPerLink)
        consider.push(candidate);
    };
    const build = (
      sideA: ArchiveLinkSide,
      sideB: ArchiveLinkSide,
      strategy: ArchiveRouteStrategy,
      variant: number,
      via: ArchivePoint[],
    ) => {
      // Teto de construções por vínculo: desvios em excesso não entram na
      // disputa e não devem custar avaliação de obstáculos.
      if (builds >= ARCHIVE_LINK_ROUTING.maxBuildsPerLink) return;
      builds++;
      const points = archiveLinkRoutePoints(
        { sides: [sideA, sideB], slots: [0, 0], strategy, variant, via },
        a,
        b,
        lane,
      );
      const evaluation = exhausted
        ? { residual: [], clearance: 0 }
        : evaluateRoute(points, a.cardId, b.cardId, obstacles, stats);
      const turns = Math.max(0, points.length - 2);
      const angle =
        portAngle(a, sideA, archiveLinkCenter(b)) +
        portAngle(b, sideB, archiveLinkCenter(a));
      const crossing = countCrossings(points, nearby);
      const switched = previous
        ? previous.sides[0] !== sideA || previous.sides[1] !== sideB
          ? ARCHIVE_ROUTE_WEIGHTS.sideSwitch
          : previous.strategy !== strategy
            ? ARCHIVE_ROUTE_WEIGHTS.strategySwitch
            : 0
        : 0;
      const used =
        (occupancy.get(`${a.cardId}|${sideA}`) ?? 0) +
        (occupancy.get(`${b.cardId}|${sideB}`) ?? 0);
      const cost =
        evaluation.residual.length * ARCHIVE_ROUTE_WEIGHTS.interior +
        evaluation.clearance * ARCHIVE_ROUTE_WEIGHTS.clearance +
        crossing * ARCHIVE_ROUTE_WEIGHTS.crossing +
        archiveLinkPolylineLength(points) * ARCHIVE_ROUTE_WEIGHTS.length +
        turns * ARCHIVE_ROUTE_WEIGHTS.turn +
        angle * ARCHIVE_ROUTE_WEIGHTS.angle +
        alignmentPenalty(points) * ARCHIVE_ROUTE_WEIGHTS.alignment +
        (strategy === "direct" && bodyDeviation(points) > 0.05
          ? ARCHIVE_ROUTE_WEIGHTS.misalignedDirect
          : 0) +
        used * ARCHIVE_ROUTE_WEIGHTS.occupancy +
        switched +
        (strategy === "detour" ? ARCHIVE_ROUTE_WEIGHTS.detour : 0) +
        (strategy === "diagonal" ? ARCHIVE_ROUTE_WEIGHTS.diagonal : 0);
      push({
        sides: [sideA, sideB],
        strategy,
        variant,
        via,
        points,
        cost,
        residual: evaluation.residual,
        clearance: evaluation.clearance,
        crossings: crossing,
        order: stats.candidates++,
      });
    };

    const facingA = archiveLinkFacingSides(a, archiveLinkCenter(b));
    const facingB = archiveLinkFacingSides(b, archiveLinkCenter(a));
    const sidePairs: [ArchiveLinkSide, ArchiveLinkSide][] = [];
    for (const sideA of facingA)
      for (const sideB of facingB) sidePairs.push([sideA, sideB]);
    const explore = (pairs: [ArchiveLinkSide, ArchiveLinkSide][]) => {
      for (const [sideA, sideB] of pairs) {
        build(sideA, sideB, "direct", 0, []);
        build(sideA, sideB, "elbow", 0, []);
        build(sideA, sideB, "elbow", 1, []);
        build(sideA, sideB, "diagonal", 0, []);
        build(sideA, sideB, "diagonal", 1, []);
      }
    };
    explore(sidePairs);

    const bestOf = () =>
      consider.reduce<Candidate | null>(
        (current, candidate) =>
          !current ||
          candidate.cost < current.cost - 1e-9 ||
          (Math.abs(candidate.cost - current.cost) <= 1e-9 &&
            candidate.order < current.order)
            ? candidate
            : current,
        null,
      );
    let best = bestOf();

    // Só procura desvios quando o caminho simples ainda encosta em obstáculos.
    if (best && (best.residual.length || best.clearance > 0)) {
      const near = index
        .query(
          inflateArchiveRect(segmentBounds(a, b), ARCHIVE_LINK_GEOMETRY.clearance * 3),
        )
        .filter((node) => node.cardId !== a.cardId && node.cardId !== b.cardId)
        .sort(
          (left, right) =>
            Math.hypot(left.x - a.x, left.y - a.y) -
              Math.hypot(right.x - a.x, right.y - a.y) ||
            (left.id < right.id ? -1 : 1),
        )
        .slice(0, ARCHIVE_LINK_ROUTING.maxDetourObstacles);
      const margin = ARCHIVE_LINK_GEOMETRY.clearance + 4;
      for (const obstacle of near) {
        const left = obstacle.x - margin,
          right = obstacle.x + obstacle.width + margin,
          top = obstacle.y - margin,
          bottom = obstacle.y + obstacle.height + margin;
        const passages: ArchivePoint[][] = [
          [{ x: left, y: top }, { x: right, y: top }],
          [{ x: right, y: top }, { x: right, y: bottom }],
          [{ x: left, y: bottom }, { x: right, y: bottom }],
          [{ x: left, y: top }, { x: left, y: bottom }],
        ];
        for (const [sideA, sideB] of sidePairs)
          for (const passage of passages) {
            build(sideA, sideB, "detour", 0, passage);
            build(sideA, sideB, "detour", 1, passage);
          }
      }
      // Se ainda há travessia, abre os quatro lados como alternativa limitada.
      if (best.residual.length) {
        const others: [ArchiveLinkSide, ArchiveLinkSide][] = [];
        for (const sideA of ["n", "e", "s", "w"] as const)
          for (const sideB of ["n", "e", "s", "w"] as const)
            if (!sidePairs.some(([x, y]) => x === sideA && y === sideB))
              others.push([sideA, sideB]);
        explore(others);
      }
      best = bestOf();
    }

    if (!best) continue;
    const plan: ArchiveLinkRoutePlan = {
      sides: [...best.sides],
      slots: [0, 0],
      lane,
      strategy: best.strategy,
      variant: best.variant,
      via: best.via.map((point) => ({ ...point })),
      corridor: `${best.sides[0]}${best.sides[1]}:${best.strategy}:${best.variant}`,
      cost: best.cost,
      residual: best.residual,
      budget: stats.budgetExceeded,
      label: null,
      labelOverlap: false,
    };
    routes.set(link.id, plan);
    stats.planned++;
    stats.crossings += best.crossings;
    routedPoints.set(link.id, best.points);
    for (const card of [a.cardId, b.cardId]) {
      const set = routedByCard.get(card) ?? new Set<string>();
      set.add(link.id);
      routedByCard.set(card, set);
    }
    for (const [cardId, side] of [
      [a.cardId, plan.sides[0]],
      [b.cardId, plan.sides[1]],
    ] as const) {
      const key = `${cardId}|${side}`;
      occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
    }
    for (const [end, cardId, side] of [
      ["0", a.cardId, plan.sides[0]],
      ["1", b.cardId, plan.sides[1]],
    ] as const) {
      const key = `${cardId}|${side}`;
      const list = usage.get(key) ?? [];
      list.push(`${link.id}|${end}`);
      usage.set(key, list);
    }
  }

  // Portas distribuídas: a posição sai do conjunto final de cada lado do card.
  const span = ARCHIVE_LINK_GEOMETRY.portSpan;
  for (const entries of usage.values()) {
    const size = entries.length;
    entries.forEach((entry, position) => {
      const split = entry.lastIndexOf("|");
      const plan = routes.get(entry.slice(0, split));
      if (!plan) return;
      plan.slots[entry.slice(split + 1) === "0" ? 0 : 1] =
        -span + (2 * span * (position + 1)) / (size + 1);
    });
  }

  // Trajeto final (com portas distribuídas) e posicionamento dos rótulos.
  const finalPoints = new Map<string, ArchivePoint[]>();
  for (const link of usable) {
    const plan = routes.get(link.id);
    if (!plan) continue;
    const a = nodeById.get(link.sourceId)!,
      b = nodeById.get(link.targetId)!;
    const points = archiveLinkRoutePoints(plan, a, b, plan.lane);
    finalPoints.set(link.id, points);
    if (!exhausted) {
      const evaluation = evaluateRoute(
        points,
        a.cardId,
        b.cardId,
        relevantObstacles(a, b, index),
        stats,
      );
      plan.residual = evaluation.residual;
    }
    plan.budget = stats.budgetExceeded;
  }
  const lines = routeSegmentIndex(
    [...finalPoints].map(([id, points]) => ({ id, points })),
  );
  const placedLabels: ArchiveRect[] = [];
  for (const link of usable) {
    const plan = routes.get(link.id);
    const points = finalPoints.get(link.id);
    if (!plan || !points) continue;
    const label = placeLabel(
      points,
      archiveLinkLabel(link),
      index,
      placedLabels,
      lines,
      link.id,
    );
    plan.label = { segment: label.segment, at: label.at };
    plan.labelOverlap = label.overlap;
    placedLabels.push({ ...label.rect });
  }
  stats.fallbacks = [...routes.values()].filter(
    (plan) => plan.residual.length || plan.budget,
  ).length;
  return { routes, stats };
}

/**
 * Assinatura estável da entrada geométrica. Muda com posição, tamanho,
 * criação/remoção de card ou relação — e nunca com pan, zoom ou opacidade.
 */
export function archiveRouteSignature(input: {
  board?: { id?: string };
  placements: readonly (ArchiveRect & { id: string; cardId: string })[];
  links: readonly ArchiveRouteLink[];
}): string {
  const part: string[] = [input.board?.id ?? ""];
  const round = (value: number) => Math.round(value * 100) / 100;
  for (const node of input.placements)
    part.push(
      `${node.id}:${node.cardId}:${round(node.x)},${round(node.y)},${round(node.width)},${round(node.height)}`,
    );
  for (const link of input.links)
    part.push(
      `${link.id}>${link.sourceId}>${link.targetId}:${link.relation ?? ""}:${link.label ?? ""}`,
    );
  return part.join("|");
}
