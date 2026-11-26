/** Geometria pura das conexões do Fichário: portas, segmentos angulares e arredondamento.
 *
 * Nada aqui conhece banco, relação persistida ou layout: só retângulos, pontos e
 * parâmetros de apresentação. O mesmo trajeto alimenta traço, bainha, hit area,
 * encaixes, marcadores e rótulo.
 */
import type { ArchivePoint, ArchiveRect } from "./archiveCamera";

/** Lados possíveis de uma porta; a porta fica sempre na borda real do card. */
export type ArchiveLinkSide = "n" | "e" | "s" | "w";

/**
 * Parâmetros iniciais de experimentação do roteamento. Não são medidas
 * persistidas nem substituem a margem externa (1120) e a folga interna (32)
 * do ArchiveLayout; são só a linguagem geométrica das conexões.
 */
export const ARCHIVE_LINK_GEOMETRY = {
  /** Folga de segurança ao redor dos cards (faixa pedida: 24–40). */
  clearance: 26,
  /** Saída perpendicular curta: o fio nasce do encaixe, não do miolo. */
  stub: 20,
  /** Raio máximo do arredondamento; limitado por metade de cada segmento. */
  radius: 20,
  /** Distância entre corredores de relações paralelas (cabe o rótulo). */
  lane: 36,
  /** Faixa útil da borda para distribuir portas; os cantos ficam reservados. */
  portSpan: 0.64,
} as const;

const EPS = 1e-6;
const near = (a: number, b: number) => Math.abs(a - b) < EPS;

/** Paths compactos: duas casas bastam para o quadro e reduzem o DOM. */
const round = (value: number) => (Math.abs(value) < 0.005 ? 0 : Math.round(value * 100) / 100);

export const archiveLinkDistance = (a: ArchivePoint, b: ArchivePoint) =>
  Math.hypot(b.x - a.x, b.y - a.y);

export const archiveLinkCenter = (rect: ArchiveRect): ArchivePoint => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

export const archiveLinkNormal = (side: ArchiveLinkSide): ArchivePoint =>
  side === "n"
    ? { x: 0, y: -1 }
    : side === "s"
      ? { x: 0, y: 1 }
      : side === "e"
        ? { x: 1, y: 0 }
        : { x: -1, y: 0 };

/** Margem em relação aos cantos ornamentados, relativa ao lado do card. */
export function archiveLinkCornerMargin(rect: ArchiveRect, side: ArchiveLinkSide) {
  const length = side === "n" || side === "s" ? rect.width : rect.height;
  return Math.min(28, Math.max(0, length * 0.18));
}

/** Ponto do encaixe na borda real; `slot` ∈ [-portSpan, portSpan]. */
export function archiveLinkPort(
  rect: ArchiveRect,
  side: ArchiveLinkSide,
  slot = 0,
): ArchivePoint {
  const span = ARCHIVE_LINK_GEOMETRY.portSpan;
  const value = Number.isFinite(slot) ? Math.max(-span, Math.min(span, slot)) : 0;
  if (side === "n" || side === "s") {
    const margin = archiveLinkCornerMargin(rect, side);
    return {
      x: rect.x + rect.width / 2 + value * Math.max(0, rect.width / 2 - margin),
      y: side === "n" ? rect.y : rect.y + rect.height,
    };
  }
  const margin = archiveLinkCornerMargin(rect, side);
  return {
    x: side === "w" ? rect.x : rect.x + rect.width,
    y: rect.y + rect.height / 2 + value * Math.max(0, rect.height / 2 - margin),
  };
}

/** Lados cuja normal aponta para o alvo: no máximo dois por card. */
export function archiveLinkFacingSides(
  rect: ArchiveRect,
  toward: ArchivePoint,
): ArchiveLinkSide[] {
  const center = archiveLinkCenter(rect);
  const sides: ArchiveLinkSide[] = [];
  if (toward.x > center.x + EPS) sides.push("e");
  else if (toward.x < center.x - EPS) sides.push("w");
  if (toward.y > center.y + EPS) sides.push("s");
  else if (toward.y < center.y - EPS) sides.push("n");
  return sides.length ? sides : ["e"];
}

export const inflateArchiveRect = (rect: ArchiveRect, by: number): ArchiveRect => ({
  x: rect.x - by,
  y: rect.y - by,
  width: rect.width + by * 2,
  height: rect.height + by * 2,
});

export const pointInsideArchiveRect = (point: ArchivePoint, rect: ArchiveRect) =>
  point.x > rect.x &&
  point.x < rect.x + rect.width &&
  point.y > rect.y &&
  point.y < rect.y + rect.height;

export const archiveRectsIntersect = (a: ArchiveRect, b: ArchiveRect) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

/**
 * Cruzamento real com o interior do retângulo (Liang–Barsky). `inset` evita
 * contar como travessia um fio que apenas encosta ou corre sobre a borda.
 */
export function segmentCrossesArchiveRect(
  a: ArchivePoint,
  b: ArchivePoint,
  rect: ArchiveRect,
  inset = 1,
): boolean {
  const left = rect.x + inset,
    right = rect.x + rect.width - inset,
    top = rect.y + inset,
    bottom = rect.y + rect.height - inset;
  if (right - left <= 0 || bottom - top <= 0) return false;
  let t0 = 0,
    t1 = 1;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - left, right - a.x, a.y - top, bottom - a.y];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < EPS) {
      if (q[i] < 0) return false;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return t1 > t0 + 1e-9;
}

/** Distância de um ponto ao segmento; usada para casar rótulo e trajeto. */
export function archivePointSegmentDistance(
  point: ArchivePoint,
  a: ArchivePoint,
  b: ArchivePoint,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  if (length < EPS) return archiveLinkDistance(point, a);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length),
  );
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Remove repetidos e vértices colineares: sem segmentos de comprimento zero. */
export function simplifyArchiveLinkPoints(
  points: readonly ArchivePoint[],
): ArchivePoint[] {
  const out: ArchivePoint[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const last = out[out.length - 1];
    if (last && archiveLinkDistance(last, point) < 0.5) continue;
    out.push({ x: point.x, y: point.y });
  }
  for (let i = out.length - 2; i > 0; i--) {
    const a = out[i - 1],
      b = out[i],
      c = out[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const forward = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) > 0;
    if (Math.abs(cross) < 1e-3 && forward) out.splice(i, 1);
  }
  return out;
}

/**
 * Conector de `from` até `to` usando somente eixos e diagonais de 45°.
 * Devolve variantes determinísticas (diagonal primeiro / reta primeiro).
 */
export function angularLinkConnectors(
  from: ArchivePoint,
  to: ArchivePoint,
): ArchivePoint[][] {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const ax = Math.abs(dx),
    ay = Math.abs(dy);
  if (ax < 0.5 || ay < 0.5 || Math.abs(ax - ay) < 0.5) return [[to]];
  const sx = Math.sign(dx),
    sy = Math.sign(dy);
  if (ax > ay)
    return [
      [{ x: from.x + sx * ay, y: to.y }, to],
      [{ x: to.x - sx * ay, y: from.y }, to],
    ];
  return [
    [{ x: to.x, y: from.y + sy * ax }, to],
    [{ x: from.x, y: to.y - sy * ax }, to],
  ];
}

/**
 * Separa relações paralelas deslocando só o miolo da rota, com um degrau axial
 * logo após a saída da porta. Assim o fio continua saindo perpendicular do
 * encaixe e nenhum trecho perde o eixo ou os 45°.
 */
export function offsetArchiveLinkLane(
  points: readonly ArchivePoint[],
  lane: number,
): ArchivePoint[] {
  if (!lane || points.length < 2) return [...points];
  const first = points[0],
    last = points[points.length - 1];
  const horizontal = Math.abs(last.x - first.x) >= Math.abs(last.y - first.y);
  const shift = {
    x: horizontal ? 0 : lane * ARCHIVE_LINK_GEOMETRY.lane,
    y: horizontal ? lane * ARCHIVE_LINK_GEOMETRY.lane : 0,
  };
  if (points.length === 2)
    return [
      first,
      { x: first.x + shift.x, y: first.y + shift.y },
      { x: last.x + shift.x, y: last.y + shift.y },
      last,
    ];
  const shifted = points.map((point) =>
    point === first || point === last
      ? point
      : { x: point.x + shift.x, y: point.y + shift.y },
  );
  const result: ArchivePoint[] = [first, points[1]];
  for (let index = 1; index < points.length - 1; index++)
    result.push(shifted[index]);
  result.push(points[points.length - 2], last);
  return result;
}

export type ArchiveLinkCommand =
  | { kind: "M"; x: number; y: number }
  | { kind: "L"; x: number; y: number }
  | { kind: "Q"; cx: number; cy: number; x: number; y: number };

/**
 * Arredonda cada inflexão com um arco quadrático pequeno. O raio é limitado à
 * metade dos segmentos vizinhos: nunca há inversão, segmento negativo ou curva
 * que ultrapasse os pontos de referência.
 */
export function archiveLinkPathCommands(
  points: readonly ArchivePoint[],
  radius = ARCHIVE_LINK_GEOMETRY.radius,
): ArchiveLinkCommand[] {
  const clean = simplifyArchiveLinkPoints(points);
  if (!clean.length) return [];
  if (clean.length === 1)
    return [{ kind: "M", x: round(clean[0].x), y: round(clean[0].y) }];
  const commands: ArchiveLinkCommand[] = [
    { kind: "M", x: round(clean[0].x), y: round(clean[0].y) },
  ];
  for (let i = 1; i < clean.length - 1; i++) {
    const previous = clean[i - 1],
      vertex = clean[i],
      next = clean[i + 1];
    const before = archiveLinkDistance(previous, vertex),
      after = archiveLinkDistance(vertex, next);
    const r = Math.min(radius, before / 2, after / 2);
    if (r < 1) {
      commands.push({ kind: "L", x: round(vertex.x), y: round(vertex.y) });
      continue;
    }
    commands.push({
      kind: "L",
      x: round(vertex.x + ((previous.x - vertex.x) / before) * r),
      y: round(vertex.y + ((previous.y - vertex.y) / before) * r),
    });
    commands.push({
      kind: "Q",
      cx: round(vertex.x),
      cy: round(vertex.y),
      x: round(vertex.x + ((next.x - vertex.x) / after) * r),
      y: round(vertex.y + ((next.y - vertex.y) / after) * r),
    });
  }
  const last = clean[clean.length - 1];
  commands.push({ kind: "L", x: round(last.x), y: round(last.y) });
  return commands;
}

export function archiveLinkPath(commands: readonly ArchiveLinkCommand[]): string {
  let path = "";
  for (const command of commands) {
    if (command.kind === "M") path += `M${command.x},${command.y}`;
    else if (command.kind === "L") path += `L${command.x},${command.y}`;
    else path += `Q${command.cx},${command.cy} ${command.x},${command.y}`;
  }
  return path;
}

/** Amostra o path final (linhas e arcos), não a polilinha original. */
export function sampleArchiveLinkPath(
  commands: readonly ArchiveLinkCommand[],
  step = 6,
): ArchivePoint[] {
  const size = Math.max(1, step);
  const samples: ArchivePoint[] = [];
  let current: ArchivePoint = { x: 0, y: 0 };
  for (const command of commands) {
    if (command.kind === "M") {
      current = { x: command.x, y: command.y };
      samples.push(current);
      continue;
    }
    if (command.kind === "L") {
      const target = { x: command.x, y: command.y };
      const length = archiveLinkDistance(current, target);
      const steps = Math.max(1, Math.ceil(length / size));
      for (let i = 1; i <= steps; i++)
        samples.push({
          x: current.x + ((target.x - current.x) * i) / steps,
          y: current.y + ((target.y - current.y) * i) / steps,
        });
      current = target;
      continue;
    }
    const control = { x: command.cx, y: command.cy },
      target = { x: command.x, y: command.y };
    const approx =
      archiveLinkDistance(current, control) + archiveLinkDistance(control, target);
    const steps = Math.max(2, Math.ceil(approx / size));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps,
        inverse = 1 - t;
      samples.push({
        x: inverse * inverse * current.x + 2 * inverse * t * control.x + t * t * target.x,
        y: inverse * inverse * current.y + 2 * inverse * t * control.y + t * t * target.y,
      });
    }
    current = target;
  }
  return samples;
}

export function archiveLinkPolylineLength(points: readonly ArchivePoint[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += archiveLinkDistance(points[i - 1], points[i]);
  return total;
}

export function archiveLinkPathLength(commands: readonly ArchiveLinkCommand[]) {
  let total = 0;
  let current: ArchivePoint = { x: 0, y: 0 };
  for (const command of commands) {
    if (command.kind === "M") {
      current = { x: command.x, y: command.y };
      continue;
    }
    if (command.kind === "L") {
      total += archiveLinkDistance(current, { x: command.x, y: command.y });
      current = { x: command.x, y: command.y };
      continue;
    }
    const control = { x: command.cx, y: command.cy },
      target = { x: command.x, y: command.y };
    // Comprimento do arco quadrático coberto pelo polígono de controle.
    total += archiveLinkDistance(current, control) + archiveLinkDistance(control, target);
    current = target;
  }
  return total;
}

/** Ponto sobre um segmento da polilinha, afastado das pontas quando possível. */
export function archiveLinkPointOnPolyline(
  points: readonly ArchivePoint[],
  segment: number,
  at: number,
): ArchivePoint {
  if (!points.length) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  const index = Math.max(0, Math.min(points.length - 2, segment));
  const from = points[index],
    to = points[index + 1];
  const length = archiveLinkDistance(from, to);
  if (length < EPS) return from;
  const margin = Math.min(24, length * 0.3);
  const t = Math.max(margin / length, Math.min(1 - margin / length, at));
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

export { EPS as ARCHIVE_LINK_EPSILON, near as archiveLinkNear };
