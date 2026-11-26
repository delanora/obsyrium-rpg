/**
 * Roteamento angular das relações do Fichário: suíte pura e determinística.
 *
 * Não usa DOM, HTTP, banco ou dados de campanha. Cada fixture é sintética e
 * descartável; o objetivo é validar invariantes da rota FINAL suavizada.
 *
 * Uso: npx tsx --tsconfig client/tsconfig.json client/scripts/check-archive-link-routing.ts
 */
import assert from "node:assert/strict";
import type { ArchivePoint, ArchiveRect } from "../src/components/archive/archiveCamera";
import {
  archiveLinkCornerMargin,
  archiveLinkPathCommands,
  archiveLinkPath,
  inflateArchiveRect,
  sampleArchiveLinkPath,
  type ArchiveLinkSide,
} from "../src/components/archive/archiveLinkGeometry";
import {
  ARCHIVE_LINK_ROUTING,
  archiveLinkRouteGeometry,
  archiveLinkRoutePoints,
  archiveRouteSignature,
  planArchiveLinkRoutes,
  type ArchiveRouteLink,
  type ArchiveRouteNode,
  type ArchiveRoutePlanSet,
} from "../src/components/archive/archiveLinkRouting";

let checks = 0;
const check = (label: string, run: () => void) => {
  run();
  checks++;
  console.log(`ok ${checks} — ${label}`);
};

const node = (
  id: string,
  x: number,
  y: number,
  width = 300,
  height = 200,
): ArchiveRouteNode => ({ id, cardId: id, x, y, width, height });
const link = (
  id: string,
  sourceId: string,
  targetId: string,
  label = "",
  relation = "related",
  directed = true,
): ArchiveRouteLink => ({ id, sourceId, targetId, label, relation, directed });
const plan = (
  nodes: ArchiveRouteNode[],
  links: ArchiveRouteLink[],
  previous: ArchiveRoutePlanSet | null = null,
) => planArchiveLinkRoutes({ placements: nodes, links, previous });
const geometryOf = (
  routes: ArchiveRoutePlanSet,
  nodes: ArchiveRouteNode[],
  linkId: string,
  theLinks: ArchiveRouteLink[],
) => {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const item = theLinks.find((entry) => entry.id === linkId)!;
  return archiveLinkRouteGeometry(
    routes.routes.get(linkId),
    byId.get(item.sourceId)!,
    byId.get(item.targetId)!,
  );
};

const onBorder = (point: ArchivePoint, rect: ArchiveRect) => {
  const onVertical =
      Math.abs(point.x - rect.x) < 1e-6 ||
      Math.abs(point.x - (rect.x + rect.width)) < 1e-6,
    onHorizontal =
      Math.abs(point.y - rect.y) < 1e-6 ||
      Math.abs(point.y - (rect.y + rect.height)) < 1e-6;
  return (
    (onVertical || onHorizontal) &&
    point.x >= rect.x - 1e-6 &&
    point.x <= rect.x + rect.width + 1e-6 &&
    point.y >= rect.y - 1e-6 &&
    point.y <= rect.y + rect.height + 1e-6
  );
};
const inside = (point: ArchivePoint, rect: ArchiveRect, inset = 1) =>
  point.x > rect.x + inset &&
  point.x < rect.x + rect.width - inset &&
  point.y > rect.y + inset &&
  point.y < rect.y + rect.height - inset;
const samples = (points: readonly ArchivePoint[], step = 4) =>
  sampleArchiveLinkPath(archiveLinkPathCommands(points), step);
const hits = (points: readonly ArchivePoint[], rect: ArchiveRect) =>
  samples(points).filter((point) => inside(point, rect)).length;
/** Desvio em graus de um trecho em relação ao eixo mais próximo ou a 45°. */
const deviation = (a: ArchivePoint, b: ArchivePoint) => {
  const angle = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 180;
  return Math.min(angle % 45, 45 - (angle % 45));
};
const bodyDeviation = (points: readonly ArchivePoint[]) => {
  let worst = 0;
  for (let i = 2; i < points.length - 1; i++)
    worst = Math.max(worst, deviation(points[i - 1], points[i]));
  return worst;
};

// 1. Caminho horizontal livre: direto, na altura do centro dos cards.
check("caminho horizontal livre vira conexão direta", () => {
  const a = node("a", 0, 0),
    b = node("b", 700, 0);
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b], links);
  const route = routes.routes.get("l1")!;
  assert.deepEqual(route.sides, ["e", "w"]);
  assert.equal(route.strategy, "direct");
  const geometry = geometryOf(routes, [a, b], "l1", links);
  assert.equal(geometry.points.length, 2);
  assert.equal(geometry.from.x, 300);
  assert.ok(Math.abs(geometry.from.y - 100) < 1e-6);
  assert.equal(geometry.to.x, 700);
  assert.equal(geometry.residual.length, 0);
  assert.equal(hits(geometry.points, a) + hits(geometry.points, b), 0);
});

// 2. Caminho vertical livre.
check("caminho vertical livre usa as portas norte e sul", () => {
  const a = node("a", 0, 0),
    b = node("b", 0, 500);
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b], links);
  const route = routes.routes.get("l1")!;
  assert.deepEqual(route.sides, ["s", "n"]);
  const geometry = geometryOf(routes, [a, b], "l1", links);
  assert.ok(onBorder(geometry.from, a));
  assert.ok(onBorder(geometry.to, b));
  assert.equal(geometry.points.length, 2);
});

// 3. Caminho diagonal livre: só eixos e diagonais de 45°.
check("caminho diagonal livre respeita eixos e 45 graus", () => {
  const a = node("a", 0, 0),
    b = node("b", 700, 700);
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b], links);
  const geometry = geometryOf(routes, [a, b], "l1", links);
  assert.ok(bodyDeviation(geometry.points) < 0.01, `${bodyDeviation(geometry.points)}`);
  assert.equal(geometry.residual.length, 0);
  assert.ok(onBorder(geometry.from, a) && onBorder(geometry.to, b));
});

// 4. Portas nos quatro lados.
check("a porta escolhida acompanha a posição do destino", () => {
  const hub = node("hub", 0, 0);
  const targets = {
    e: node("e", 800, 0),
    s: node("s", 0, 700),
    w: node("w", -800, 0),
    n: node("n", 0, -700),
  };
  const nodes = [hub, ...Object.values(targets)];
  const links = Object.entries(targets).map(([key, target]) =>
    link(`l-${key}`, "hub", target.id),
  );
  const routes = plan(nodes, links);
  assert.equal(routes.routes.get("l-e")!.sides[0], "e");
  assert.equal(routes.routes.get("l-s")!.sides[0], "s");
  assert.equal(routes.routes.get("l-w")!.sides[0], "w");
  assert.equal(routes.routes.get("l-n")!.sides[0], "n");
  for (const [key, target] of Object.entries(targets)) {
    const geometry = geometryOf(routes, nodes, `l-${key}`, links);
    assert.ok(onBorder(geometry.from, hub));
    assert.ok(onBorder(geometry.to, target));
  }
});

// 5. Distribuição de múltiplas portas no mesmo lado.
check("portas do mesmo lado são distribuídas sem coincidir", () => {
  const hub = node("hub", 0, 0),
    target = node("target", 900, 0);
  const links = [
    link("l1", "hub", "target", "Sussurra"),
    link("l2", "hub", "target", "Teme"),
    link("l3", "hub", "target", "Protege"),
  ];
  const routes = plan([hub, target], links);
  const ports = links.map((entry) => {
    const route = routes.routes.get(entry.id)!;
    assert.equal(route.sides[0], "e");
    assert.equal(route.sides[1], "w");
    return archiveLinkRouteGeometry(route, hub, target).from.y;
  });
  const ys = [...ports].sort((left, right) => left - right);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] > 15, `${ys}`);
  assert.equal(new Set(ys.map((y) => y.toFixed(2))).size, ys.length);
});

// 6. Proteção dos cantos.
check("nenhuma porta invade o canto ornamentado", () => {
  const card = node("card", 0, 0, 400, 200);
  const targets = [
    node("t1", 900, -400),
    node("t2", 900, 0),
    node("t3", 900, 400),
    node("t4", 0, 900),
  ];
  const links = targets.map((target) => link(`l-${target.id}`, "card", target.id));
  const routes = plan([card, ...targets], links);
  for (const [index, target] of targets.entries()) {
    const route = routes.routes.get(links[index].id)!;
    const geometry = archiveLinkRouteGeometry(route, card, target);
    const sides: ArchiveLinkSide[] = [geometry.fromSide, geometry.toSide];
    for (const [position, side] of sides.entries()) {
      const rect = position === 0 ? card : target;
      const point = position === 0 ? geometry.from : geometry.to;
      if (side === "n" || side === "s") {
        const margin = archiveLinkCornerMargin(rect, side);
        assert.ok(point.x >= rect.x + margin - 1e-6);
        assert.ok(point.x <= rect.x + rect.width - margin + 1e-6);
      } else {
        const margin = archiveLinkCornerMargin(rect, side);
        assert.ok(point.y >= rect.y + margin - 1e-6);
        assert.ok(point.y <= rect.y + rect.height - margin + 1e-6);
      }
    }
  }
});

// 7. Arredondamento limitado.
check("o arredondamento é limitado e não ultrapassa os pontos de referência", () => {
  const a = node("a", 0, 0),
    b = node("b", 420, 340);
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b], links);
  const geometry = geometryOf(routes, [a, b], "l1", links);
  const commands = archiveLinkPathCommands(geometry.points, 20);
  assert.ok(commands.some((command) => command.kind === "Q"));
  const bounds = {
    x: Math.min(...geometry.points.map((point) => point.x)) - 0.5,
    y: Math.min(...geometry.points.map((point) => point.y)) - 0.5,
    width:
      Math.max(...geometry.points.map((point) => point.x)) -
      Math.min(...geometry.points.map((point) => point.x)) +
      1,
    height:
      Math.max(...geometry.points.map((point) => point.y)) -
      Math.min(...geometry.points.map((point) => point.y)) +
      1,
  };
  for (const sample of sampleArchiveLinkPath(commands, 2))
    assert.ok(
      sample.x >= bounds.x - 1 &&
        sample.x <= bounds.x + bounds.width + 1 &&
        sample.y >= bounds.y - 1 &&
        sample.y <= bounds.y + bounds.height + 1,
    );
  assert.ok(archiveLinkPath(commands).startsWith("M"));
});

// 8. Um obstáculo entre as pontas.
check("desvia de um card intermediário", () => {
  const a = node("a", 0, 0),
    b = node("b", 1000, 0),
    middle = node("mid", 400, -60, 320, 320);
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b, middle], links);
  const route = routes.routes.get("l1")!;
  const geometry = geometryOf(routes, [a, b, middle], "l1", links);
  assert.equal(route.residual.length, 0, JSON.stringify(route));
  assert.equal(hits(geometry.points, middle), 0);
  assert.ok(onBorder(geometry.from, a) && onBorder(geometry.to, b));
  assert.notEqual(geometry.strategy, "direct");
});

// 9. Vários obstáculos.
check("desvia de vários cards intermediários", () => {
  const a = node("a", 0, 0),
    b = node("b", 1400, 0);
  const walls = [
    node("w1", 340, -150, 300, 260),
    node("w2", 340, 260, 300, 260),
    node("w3", 760, -40, 300, 260),
  ];
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b, ...walls], links);
  const geometry = geometryOf(routes, [a, b, ...walls], "l1", links);
  assert.equal(routes.routes.get("l1")!.residual.length, 0);
  for (const wall of walls) assert.equal(hits(geometry.points, wall), 0, wall.id);
});

// 10. Corredor estreito: sem travessia silenciosa.
check("corredor estreito nunca atravessa card sem registrar", () => {
  const a = node("a", 0, 0, 200, 140),
    b = node("b", 700, 0, 200, 140);
  const walls = [node("up", 300, -220, 300, 320), node("down", 300, 60, 300, 320)];
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b, ...walls], links);
  const route = routes.routes.get("l1")!;
  const geometry = geometryOf(routes, [a, b, ...walls], "l1", links);
  assert.ok(Number.isFinite(geometry.length) && geometry.length > 0);
  if (!route.residual.length)
    for (const wall of walls) assert.equal(hits(geometry.points, wall), 0, wall.id);
  else assert.equal(geometry.fallback, true);
});

// 11. Obstáculos alinhados em parede.
check("contorna uma parede de cards alinhados", () => {
  const a = node("a", 0, 0),
    b = node("b", 1200, 300);
  const wall = [
    node("p1", 400, -300, 300, 260),
    node("p2", 400, 0, 300, 260),
    node("p3", 400, 300, 300, 260),
  ];
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b, ...wall], links);
  const geometry = geometryOf(routes, [a, b, ...wall], "l1", links);
  assert.equal(routes.routes.get("l1")!.residual.length, 0);
  for (const block of wall) assert.equal(hits(geometry.points, block), 0, block.id);
});

// 12. Cards sobrepostos: fallback explícito.
check("cards sobrepostos produzem fallback registrado, nunca silêncio", () => {
  const a = node("a", 0, 0, 900, 600),
    b = node("b", 300, 200, 300, 200);
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b], links);
  const route = routes.routes.get("l1")!;
  const geometry = geometryOf(routes, [a, b], "l1", links);
  assert.ok(route.residual.length > 0);
  assert.equal(geometry.fallback, true);
  assert.ok(Number.isFinite(geometry.length));
  assert.ok(onBorder(geometry.from, a) && onBorder(geometry.to, b));
});

// 13. Cards quase coincidentes.
check("cards quase coincidentes continuam com rota finita", () => {
  const a = node("a", 0, 0),
    b = node("b", 4, 3);
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b], links);
  const geometry = geometryOf(routes, [a, b], "l1", links);
  assert.ok(Number.isFinite(geometry.length));
  assert.ok(geometry.points.length >= 2);
  assert.ok(onBorder(geometry.from, a) && onBorder(geometry.to, b));
  assert.ok(!geometry.path.includes("NaN"));
});

// 14. Relações paralelas.
check("relações paralelas ganham corredores e portas distintas", () => {
  const a = node("a", 0, 0),
    b = node("b", 800, 0);
  const links = [
    link("l1", "a", "b", "Sussurra", "knows", false),
    link("l2", "a", "b", "Teme", "enemy", true),
    link("l3", "a", "b", "Protege", "protects", false),
  ];
  const routes = plan([a, b], links);
  const lanes = links.map((entry) => routes.routes.get(entry.id)!.lane);
  assert.deepEqual(lanes, [-1, 0, 1]);
  const geometries = links.map((entry) =>
    geometryOf(routes, [a, b], entry.id, links),
  );
  const paths = new Set(geometries.map((geometry) => geometry.path));
  assert.equal(paths.size, 3);
  const anchors = geometries.map((geometry) => geometry.from.y.toFixed(2));
  assert.equal(new Set(anchors).size, 3);
  const labels = geometries.map(
    (geometry) => `${geometry.labelPoint.x.toFixed(1)}:${geometry.labelPoint.y.toFixed(1)}`,
  );
  assert.equal(new Set(labels).size, 3);
});

// 15. Sentidos opostos.
check("relações em sentidos opostos não são fundidas", () => {
  const a = node("a", 0, 0),
    b = node("b", 800, 0);
  const links = [link("l1", "a", "b"), link("l2", "b", "a")];
  const routes = plan([a, b], links);
  assert.equal(routes.routes.size, 2);
  assert.deepEqual(routes.routes.get("l1")!.sides, [
    routes.routes.get("l2")!.sides[1],
    routes.routes.get("l2")!.sides[0],
  ]);
  assert.notEqual(routes.routes.get("l1")!.lane, routes.routes.get("l2")!.lane);
});

// 16. Geometria extrema e coordenadas negativas.
check("coordenadas extremas e negativas permanecem finitas", () => {
  const cases: [ArchiveRouteNode, ArchiveRouteNode][] = [
    [node("a", -1_000_000, -1_000_000), node("b", 1_000_000, 1_000_000)],
    [node("a", -2400, -1800), node("b", -900, -1750)],
    [node("a", 0, 0, 5000, 5000), node("b", 7000, 7000, 5000, 5000)],
  ];
  for (const [a, b] of cases) {
    const links = [link("l1", a.id, b.id)];
    const routes = plan([a, b], links);
    const geometry = geometryOf(routes, [a, b], "l1", links);
    assert.ok(Number.isFinite(geometry.length) && geometry.length > 0);
    assert.ok(!/NaN|Infinity/.test(geometry.path));
    assert.ok(onBorder(geometry.from, a) && onBorder(geometry.to, b));
  }
});

// 17. Determinismo e independência da ordem de entrada.
check("mesma entrada produz o mesmo plano em qualquer ordem", () => {
  const nodes = [
    node("a", 0, 0),
    node("b", 900, 200),
    node("c", 420, -80, 280, 320),
    node("d", 120, 640),
  ];
  const links = [
    link("l1", "a", "b"),
    link("l2", "a", "d", "Sela"),
    link("l3", "c", "b", "Guarda", "protects"),
  ];
  const first = plan(nodes, links);
  const second = plan([...nodes].reverse(), [...links].reverse());
  assert.equal(JSON.stringify([...first.routes]), JSON.stringify([...second.routes]));
  const third = plan(nodes, links);
  assert.equal(JSON.stringify([...first.routes]), JSON.stringify([...third.routes]));
});

// 18. Orçamento e estatísticas.
check("o plano expõe orçamento, candidatos e obstáculos consultados", () => {
  const nodes = [node("a", 0, 0), node("b", 900, 0), node("c", 430, -60, 280, 320)];
  const links = [link("l1", "a", "b")];
  const routes = plan(nodes, links);
  assert.equal(routes.stats.planned, 1);
  assert.ok(routes.stats.candidates > 0);
  assert.ok(routes.stats.obstacleTests > 0);
  assert.equal(routes.stats.budgetExceeded, false);
  assert.equal(routes.stats.fallbacks, 0);
  assert.ok(ARCHIVE_LINK_ROUTING.maxSegmentTests > 0);
});

// 19. Estabilidade de portas com plano anterior.
check("pequenas mudanças preservam as portas já estabelecidas", () => {
  const a = node("a", 0, 0),
    b = node("b", 900, 260);
  const links = [link("l1", "a", "b")];
  const first = plan([a, b], links);
  const moved = { ...b, x: b.x + 40, y: b.y + 18 };
  const second = plan([a, moved], links, first);
  assert.deepEqual(second.routes.get("l1")!.sides, first.routes.get("l1")!.sides);
});

// 20. Assinatura de cache/invalidação.
check("a assinatura muda com geometria/topologia e não por câmera", () => {
  const nodes = [node("a", 0, 0), node("b", 600, 0)];
  const links = [link("l1", "a", "b")];
  const base = archiveRouteSignature({ placements: nodes, links });
  assert.equal(base, archiveRouteSignature({ placements: nodes, links }));
  assert.notEqual(
    base,
    archiveRouteSignature({
      placements: [nodes[0], { ...nodes[1], x: nodes[1].x + 1 }],
      links,
    }),
  );
  assert.notEqual(
    base,
    archiveRouteSignature({
      placements: nodes,
      links: [...links, link("l2", "a", "b")],
    }),
  );
});

// 21. Rótulo apoiado no próprio trajeto e fora dos cards.
check("o rótulo se apoia no trajeto e evita os cards", () => {
  const a = node("a", 0, 0),
    b = node("b", 1000, 400),
    middle = node("mid", 380, 300, 300, 200);
  const links = [link("l1", "a", "b", "Reconhece a marca antiga na soleira")];
  const routes = plan([a, b, middle], links);
  const geometry = geometryOf(routes, [a, b, middle], "l1", links);
  let closest = Infinity;
  for (let i = 1; i < geometry.points.length; i++) {
    const from = geometry.points[i - 1],
      to = geometry.points[i];
    const dx = to.x - from.x,
      dy = to.y - from.y;
    const length = dx * dx + dy * dy;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((geometry.labelPoint.x - from.x) * dx +
          (geometry.labelPoint.y - from.y) * dy) /
          length,
      ),
    );
    closest = Math.min(
      closest,
      Math.hypot(
        geometry.labelPoint.x - (from.x + t * dx),
        geometry.labelPoint.y - (from.y + t * dy),
      ),
    );
  }
  assert.ok(closest < 0.51, `distância ${closest}`);
  for (const rect of [a, b, middle])
    assert.equal(inside(geometry.labelPoint, rect), false, rect.id);
});

// 22. Nenhuma escrita na geometria de entrada.
check("o roteador não altera a geometria persistida", () => {
  const frozenNodes = Object.freeze([
    Object.freeze(node("a", 0, 0)),
    Object.freeze(node("b", 800, 300)),
    Object.freeze(node("c", 400, 0, 280, 240)),
  ]);
  const frozenLinks = Object.freeze([
    Object.freeze(link("l1", "a", "b")),
    Object.freeze(link("l2", "a", "c")),
  ]);
  const before = JSON.stringify([frozenNodes, frozenLinks]);
  plan([...frozenNodes], [...frozenLinks]);
  assert.equal(JSON.stringify([frozenNodes, frozenLinks]), before);
});

// 23. Rota final suavizada livre de obstáculos.
check("a rota suavizada não atravessa nenhum obstáculo considerado", () => {
  const nodes = [
    node("a", 0, 0),
    node("b", 1500, 100),
    node("c", 400, -160, 280, 320),
    node("d", 700, 120, 280, 320),
    node("e", 1050, -120, 280, 320),
  ];
  const links = [link("l1", "a", "b"), link("l2", "c", "b", "Sela"), link("l3", "e", "a")];
  const routes = plan(nodes, links);
  for (const entry of links) {
    const route = routes.routes.get(entry.id)!;
    const geometry = geometryOf(routes, nodes, entry.id, links);
    if (route.residual.length) continue;
    const obstacles = nodes.filter(
      (item) => item.id !== entry.sourceId && item.id !== entry.targetId,
    );
    for (const obstacle of obstacles)
      assert.equal(hits(geometry.points, obstacle), 0, `${entry.id}/${obstacle.id}`);
  }
});

// 24. Entradas e saídas coerentes entre plano e pintura.
check("plano e pintura compartilham exatamente a mesma rota", () => {
  const a = node("a", 0, 0),
    b = node("b", 700, 300);
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b], links);
  const route = routes.routes.get("l1")!;
  const rebuilt = archiveLinkRoutePoints(route, a, b, route.lane);
  const painted = geometryOf(routes, [a, b], "l1", links);
  assert.equal(JSON.stringify(rebuilt), JSON.stringify(painted.points));
});

// 25. O sentido semântico não altera a geometria.
check("relações direcionadas e não direcionadas compartilham a geometria", () => {
  const a = node("a", 0, 0),
    b = node("b", 700, 200);
  const directed = plan([a, b], [link("l1", "a", "b", "", "related", true)]);
  const undirected = plan([a, b], [link("l1", "a", "b", "", "related", false)]);
  assert.deepEqual(
    directed.routes.get("l1"),
    undirected.routes.get("l1"),
  );
});

// 26. Fallback sem plano (vínculo transitório de saída).
check("sem plano, a rota cai numa conexão direta previsível", () => {
  const a = node("a", 0, 0),
    b = node("b", 600, 0);
  const geometry = archiveLinkRouteGeometry(undefined, a, b);
  assert.equal(geometry.strategy, "direct");
  assert.equal(geometry.points.length, 2);
  assert.ok(onBorder(geometry.from, a) && onBorder(geometry.to, b));
});

// 27. Área de segurança: nenhuma rota cruza o miolo das próprias pontas.
check("a rota não atravessa o miolo do card de origem ou destino", () => {
  const a = node("a", 0, 0),
    b = node("b", 760, 420);
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b], links);
  const geometry = geometryOf(routes, [a, b], "l1", links);
  assert.equal(hits(geometry.points, a), 0);
  assert.equal(hits(geometry.points, b), 0);
  assert.ok(geometry.length > 0);
});

// 28. Folga: a rota mantém distância dos obstáculos usados no planejamento.
check("a folga de roteamento é respeitada quando há corredor", () => {
  const a = node("a", 0, 0),
    b = node("b", 1200, 0),
    middle = node("mid", 450, -100, 300, 240);
  const links = [link("l1", "a", "b")];
  const routes = plan([a, b, middle], links);
  const route = routes.routes.get("l1")!;
  assert.equal(route.residual.length, 0);
  const geometry = geometryOf(routes, [a, b, middle], "l1", links);
  for (const sample of samples(geometry.points, 2))
    assert.equal(inside(sample, inflateArchiveRect(middle, 4), 0), false);
});

console.log(`\n${checks} verificações de roteamento angular das relações.`);
