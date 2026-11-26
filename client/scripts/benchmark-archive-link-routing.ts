/**
 * Benchmark do roteamento relacional: geometria publicada na 8.5.4.1 (curva
 * quadrática) contra o roteamento angular da 8.5.4.2.
 *
 * Fixtures sintéticas e descartáveis; nenhum dado de campanha é lido. Mede
 * cálculo, geração de path, cruzamentos, travessias de cards, sobreposição de
 * rótulos e custo de string. Não mede FPS e não substitui o navegador.
 *
 * Uso: npx tsx --tsconfig client/tsconfig.json client/scripts/benchmark-archive-link-routing.ts
 */
import { performance } from "node:perf_hooks";
import type { ArchivePoint, ArchiveRect } from "../src/components/archive/archiveCamera";
import { linkEndpoints } from "../src/components/archive/archiveCamera";
import {
  archiveLinkPathCommands,
  sampleArchiveLinkPath,
} from "../src/components/archive/archiveLinkGeometry";
import {
  archiveLinkRouteGeometry,
  planArchiveLinkRoutes,
  type ArchiveRouteLink,
  type ArchiveRouteNode,
} from "../src/components/archive/archiveLinkRouting";
import { estimateArchiveRelationLabelWidth } from "../src/components/archive/archiveRelationMetrics";

type Topology = "esparsa" | "densa" | "radial" | "nucleos" | "paralelas" | "distantes";

const CARD = { width: 300, height: 200 };
const node = (id: string, x: number, y: number): ArchiveRouteNode => ({
  id,
  cardId: id,
  x,
  y,
  ...CARD,
});
const link = (
  id: string,
  sourceId: string,
  targetId: string,
  label = "",
): ArchiveRouteLink => ({ id, sourceId, targetId, relation: "related", label });

function board(topology: Topology, count: number) {
  const nodes: ArchiveRouteNode[] = [];
  const links: ArchiveRouteLink[] = [];
  if (topology === "radial") {
    nodes.push(node("hub", -CARD.width / 2, -CARD.height / 2));
    for (let i = 1; i < count; i++) {
      const angle = (i / (count - 1)) * Math.PI * 2,
        ring = 900 + Math.floor(i / 40) * 620;
      nodes.push(
        node(
          `c${i}`,
          Math.round(Math.cos(angle) * ring),
          Math.round(Math.sin(angle) * ring),
        ),
      );
      links.push(link(`l${i}`, "hub", `c${i}`));
    }
  } else if (topology === "nucleos" || topology === "distantes") {
    const cores = 4,
      spread = topology === "distantes" ? 9000 : 2200;
    for (let i = 0; i < count; i++) {
      const core = i % cores,
        index = Math.floor(i / cores),
        col = index % 6,
        row = Math.floor(index / 6);
      nodes.push(
        node(
          `c${i}`,
          core * spread + col * 420,
          (core % 2) * spread + row * 320,
        ),
      );
    }
    for (let i = 1; i < count; i++)
      links.push(link(`l${i}`, `c${i - 1}`, `c${i}`));
    for (let i = 0; i + cores < count; i++)
      links.push(link(`x${i}`, `c${i}`, `c${i + cores}`));
  } else {
    const gap = topology === "densa" ? 60 : 420,
      columns = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++)
      nodes.push(
        node(
          `c${i}`,
          (i % columns) * (CARD.width + gap),
          Math.floor(i / columns) * (CARD.height + gap),
        ),
      );
    if (topology === "paralelas") {
      for (let i = 0; i + 1 < count; i += 2)
        for (let k = 0; k < 6; k++)
          links.push(
            link(`p${i}-${k}`, `c${i}`, `c${i + 1}`, k % 2 ? "Sussurra" : ""),
          );
    } else {
      const byId = new Map(nodes.map((item) => [item.id, item]));
      for (const item of nodes) {
        const nearest = nodes
          .filter((other) => other.id !== item.id)
          .sort(
            (left, right) =>
              Math.hypot(left.x - item.x, left.y - item.y) -
                Math.hypot(right.x - item.x, right.y - item.y) ||
              (left.id < right.id ? -1 : 1),
          )
          .slice(0, 2);
        for (const target of nearest)
          links.push(link(`l-${item.id}-${target.id}`, item.id, target.id));
      }
      void byId;
    }
  }
  return { nodes, links };
}

const interiors = (points: readonly ArchivePoint[], nodes: readonly ArchiveRouteNode[], source: string, target: string) => {
  const hit = new Set<string>();
  for (const item of nodes) {
    if (item.id === source || item.id === target) continue;
    for (const point of points)
      if (
        point.x > item.x + 1 &&
        point.x < item.x + item.width - 1 &&
        point.y > item.y + 1 &&
        point.y < item.y + item.height - 1
      ) {
        hit.add(item.id);
        break;
      }
  }
  return hit;
};

const cross = (a: ArchivePoint, b: ArchivePoint, c: ArchivePoint, d: ArchivePoint) => {
  const value = (p: ArchivePoint, q: ArchivePoint, r: ArchivePoint) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = value(c, d, a),
    d2 = value(c, d, b),
    d3 = value(a, b, c),
    d4 = value(a, b, d);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
};

/** Curva publicada na 8.5.4.1, mantida apenas para comparação. */
function baselineCurve(a: ArchiveRect, b: ArchiveRect, ordinal: number, total: number) {
  const [from, to] = linkEndpoints(a, b);
  const offset = (ordinal - (total - 1) / 2) * 64;
  const dx = to.x - from.x,
    dy = to.y - from.y,
    length = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(100, length * 0.16) + offset;
  const mid = {
    x: (from.x + to.x) / 2 - (dy / length) * bend,
    y: (from.y + to.y) / 2 + (dx / length) * bend,
  };
  const samples: ArchivePoint[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24,
      inverse = 1 - t;
    samples.push({
      x: inverse * inverse * from.x + 2 * inverse * t * mid.x + t * t * to.x,
      y: inverse * inverse * from.y + 2 * inverse * t * mid.y + t * t * to.y,
    });
  }
  return {
    from,
    to,
    samples,
    label: {
      x: (from.x + 2 * mid.x + to.x) / 4,
      y: (from.y + 2 * mid.y + to.y) / 4,
    },
    path: `M${from.x},${from.y} Q${mid.x},${mid.y} ${to.x},${to.y}`,
  };
}

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const percentile = (values: number[], q: number) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
};

function baselineRun(nodes: ArchiveRouteNode[], links: ArchiveRouteLink[]) {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const pairs = new Map<string, string[]>();
  for (const item of links) {
    const key = [item.sourceId, item.targetId].sort().join("|");
    pairs.set(key, [...(pairs.get(key) ?? []), item.id]);
  }
  const start = performance.now();
  let obstacleHits = 0,
    characters = 0,
    labelOverlaps = 0;
  const samples = new Map<string, ArchivePoint[]>();
  const labels = new Map<string, ArchivePoint>();
  const halfWidth = new Map<string, number>();
  for (const item of links) {
    const a = byId.get(item.sourceId),
      b = byId.get(item.targetId);
    if (!a || !b) continue;
    const same = pairs.get([item.sourceId, item.targetId].sort().join("|"))!;
    const curve = baselineCurve(a, b, same.indexOf(item.id), same.length);
    samples.set(item.id, curve.samples);
    labels.set(item.id, curve.label);
    halfWidth.set(
      item.id,
      estimateArchiveRelationLabelWidth(item.label || "Relação") / 2 + 8,
    );
    characters += curve.path.length;
    if (interiors(curve.samples, nodes, item.sourceId, item.targetId).size)
      obstacleHits++;
  }
  const elapsed = performance.now() - start;
  // Sobreposição de rótulos entre vínculos que compartilham um card.
  const byCard = new Map<string, string[]>();
  for (const item of links) {
    for (const card of [item.sourceId, item.targetId]) {
      const list = byCard.get(card) ?? [];
      list.push(item.id);
      byCard.set(card, list);
    }
  }
  for (const ids of byCard.values())
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const pointA = labels.get(ids[i])!,
          pointB = labels.get(ids[j])!;
        if (
          Math.abs(pointA.x - pointB.x) < halfWidth.get(ids[i])! &&
          Math.abs(pointA.y - pointB.y) < 26
        )
          labelOverlaps++;
      }
  return { elapsed, obstacleHits, characters, labelOverlaps, samples };
}

function candidateRun(nodes: ArchiveRouteNode[], links: ArchiveRouteLink[]) {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const start = performance.now();
  const plan = planArchiveLinkRoutes({ placements: nodes, links });
  const samples = new Map<string, ArchivePoint[]>();
  const labels = new Map<string, ArchivePoint>();
  const halfWidth = new Map<string, number>();
  let characters = 0,
    obstacleHits = 0;
  for (const item of links) {
    const a = byId.get(item.sourceId),
      b = byId.get(item.targetId);
    if (!a || !b) continue;
    const route = archiveLinkRouteGeometry(plan.routes.get(item.id), a, b);
    const points = sampleArchiveLinkPath(
      archiveLinkPathCommands(route.points),
      8,
    );
    samples.set(item.id, points);
    labels.set(item.id, route.labelPoint);
    halfWidth.set(
      item.id,
      estimateArchiveRelationLabelWidth(item.label || "Relação") / 2 + 8,
    );
    characters += route.path.length;
    if (interiors(points, nodes, item.sourceId, item.targetId).size)
      obstacleHits++;
  }
  const elapsed = performance.now() - start;
  let labelOverlaps = 0;
  const byCard = new Map<string, string[]>();
  for (const item of links) {
    for (const card of [item.sourceId, item.targetId]) {
      const list = byCard.get(card) ?? [];
      list.push(item.id);
      byCard.set(card, list);
    }
  }
  for (const ids of byCard.values())
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const pointA = labels.get(ids[i])!,
          pointB = labels.get(ids[j])!;
        if (
          Math.abs(pointA.x - pointB.x) < halfWidth.get(ids[i])! &&
          Math.abs(pointA.y - pointB.y) < 26
        )
          labelOverlaps++;
      }
  return { elapsed, obstacleHits, characters, labelOverlaps, samples, stats: plan.stats };
}

const thin = (points: readonly ArchivePoint[], limit = 16) => {
  if (points.length <= limit) return points;
  const step = (points.length - 1) / (limit - 1),
    out: ArchivePoint[] = [];
  for (let i = 0; i < limit; i++) out.push(points[Math.round(i * step)]);
  return out;
};

function crossings(samples: Map<string, ArchivePoint[]>, ids: string[]) {
  let total = 0;
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const left = thin(samples.get(ids[i])!),
        right = thin(samples.get(ids[j])!);
      for (let a = 1; a < left.length; a++)
        for (let b = 1; b < right.length; b++)
          if (cross(left[a - 1], left[a], right[b - 1], right[b])) total++;
    }
  return total;
}

const sizes = [50, 100, 200, 500];
const topologies: Topology[] = [
  "esparsa",
  "densa",
  "radial",
  "nucleos",
  "paralelas",
  "distantes",
];
const rows: Record<string, unknown>[] = [];
for (const topology of topologies) {
  for (const size of sizes) {
    if (topology === "paralelas" && size > 200) continue;
    const { nodes, links } = board(topology, size);
    const rounds = size >= 500 ? 1 : size >= 200 ? 2 : 2;
    const baseTimes: number[] = [],
      nextTimes: number[] = [];
    let baseResult = baselineRun(nodes, links),
      nextResult = candidateRun(nodes, links);
    for (let round = 0; round < rounds; round++) {
      const baseStart = performance.now();
      baseResult = baselineRun(nodes, links);
      baseTimes.push(performance.now() - baseStart);
      const nextStart = performance.now();
      nextResult = candidateRun(nodes, links);
      nextTimes.push(performance.now() - nextStart);
    }
    const sample = links.slice(0, 120).map((item) => item.id);
    rows.push({
      topology,
      cards: nodes.length,
      links: links.length,
      baselineMsMedian: +median(baseTimes).toFixed(2),
      baselineMsP95: +percentile(baseTimes, 0.95).toFixed(2),
      angularMsMedian: +median(nextTimes).toFixed(2),
      angularMsP95: +percentile(nextTimes, 0.95).toFixed(2),
      routes: nextResult.stats.planned,
      candidates: nextResult.stats.candidates,
      obstacleTests: nextResult.stats.obstacleTests,
      fallbacks: nextResult.stats.fallbacks,
      budgetExceeded: nextResult.stats.budgetExceeded,
      obstacleHitsBaseline: baseResult.obstacleHits,
      obstacleHitsAngular: nextResult.obstacleHits,
      crossingsBaseline120: crossings(baseResult.samples, sample),
      crossingsAngular120: crossings(nextResult.samples, sample),
      labelOverlapsBaseline: baseResult.labelOverlaps,
      labelOverlapsAngular: nextResult.labelOverlaps,
      pathCharsBaseline: baseResult.characters,
      pathCharsAngular: nextResult.characters,
      verified: nextResult.stats.verified,
      intersects: nextResult.stats.intersects,
      unverified: nextResult.stats.unverified,
      reused: nextResult.stats.reused,
      work: nextResult.stats.work,
      maxWork: nextResult.stats.maxWork,
      labelTests: nextResult.stats.labelTests,
      checkTests: nextResult.stats.checkTests,
    });
  }
}
// Atualizações: quanto o planejamento realmente recalcula em cada mudança.
{
  const updateRows: Record<string, unknown>[] = [];
  const base = board("densa", 60);
  const first = planArchiveLinkRoutes({
    placements: base.nodes,
    links: base.links,
  });
  const measure = (
    kind: string,
    placements: ArchiveRouteNode[],
    links: ArchiveRouteLink[],
    previous: typeof first,
  ) => {
    const started = performance.now();
    const next = planArchiveLinkRoutes({ placements, links, previous });
    updateRows.push({
      scenario: "atualizacao",
      kind,
      ms: +(performance.now() - started).toFixed(2),
      links: links.length,
      reused: next.stats.reused,
      planned: links.length - next.stats.reused,
      verified: next.stats.verified,
      intersects: next.stats.intersects,
      unverified: next.stats.unverified,
      work: next.stats.work,
    });
    return next;
  };
  const moved = base.nodes.map((item, index) =>
    index === 5 ? { ...item, x: item.x + 220, y: item.y + 160 } : item,
  );
  const afterMove = measure("mover-card", moved, base.links, first);
  const resized = base.nodes.map((item, index) =>
    index === 9
      ? { ...item, width: item.width + 120, height: item.height + 60 }
      : item,
  );
  const afterResize = measure("redimensionar-card", resized, base.links, afterMove);
  const added: ArchiveRouteLink[] = [
    ...base.links,
    {
      id: "nova-relacao",
      sourceId: base.nodes[1].id,
      targetId: base.nodes[12].id,
      relation: "related",
      label: "Nova",
    },
  ];
  const afterAdd = measure("criar-relacao", base.nodes, added, afterResize);
  measure("remover-relacao", base.nodes, base.links.slice(1), afterAdd);
  const obstacle = base.nodes.map((item, index) =>
    index === 20 ? { ...item, x: item.x - 300 } : item,
  );
  measure("mover-obstaculo", obstacle, base.links, afterMove);
  updateRows.push({
    scenario: "atualizacao",
    kind: "pan-zoom",
    ms: 0,
    links: base.links.length,
    reused: base.links.length,
    planned: 0,
    note: "câmera fora da assinatura: nenhum replanejamento",
  });
  for (const row of updateRows) console.log(JSON.stringify(row));
}
for (const row of rows) console.log(JSON.stringify(row));
console.log(
  `\n${rows.length} cenários sintéticos. Tempos de cálculo+path em Node (sem DOM); não são FPS.`,
);

