/**
 * 8.5.4.2.1 — hardening do roteamento relacional: suíte pura.
 *
 * Cobre diagnóstico de rota, verificação final do caminho suavizado, orçamento
 * total, contrato do rótulo, reutilização localizada e cenários extremos.
 * Fixtures sintéticas e descartáveis; nenhum dado de campanha.
 *
 * Uso: npx tsx --tsconfig client/tsconfig.json client/scripts/check-archive-link-routing-hardening.ts
 */
import assert from "node:assert/strict";
import type { ArchivePoint, ArchiveRect } from "../src/components/archive/archiveCamera";
import {
  archiveLinkPathCommands,
  inflateArchiveRect,
  sampleArchiveLinkPath,
} from "../src/components/archive/archiveLinkGeometry";
import {
  ARCHIVE_LINK_ROUTING,
  archiveLinkRouteGeometry,
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
): ArchiveRouteLink => ({
  id,
  sourceId,
  targetId,
  label,
  relation: "related",
  directed: true,
});
const plan = (
  nodes: ArchiveRouteNode[],
  links: ArchiveRouteLink[],
  previous: ArchiveRoutePlanSet | null = null,
) => planArchiveLinkRoutes({ placements: nodes, links, previous });

const inside = (point: ArchivePoint, rect: ArchiveRect, inset = 0.75) =>
  point.x > rect.x + inset &&
  point.x < rect.x + rect.width - inset &&
  point.y > rect.y + inset &&
  point.y < rect.y + rect.height - inset;

/** Referência independente: amostragem fina do path renderizado. */
const crossings = (points: readonly ArchivePoint[], rects: readonly ArchiveRect[]) => {
  const path = sampleArchiveLinkPath(archiveLinkPathCommands(points), 2);
  const hit = new Set<number>();
  rects.forEach((rect, index) => {
    for (const point of path) if (inside(point, rect)) hit.add(index);
  });
  return hit.size;
};

const geometryOf = (
  routes: ArchiveRoutePlanSet,
  nodes: ArchiveRouteNode[],
  item: ArchiveRouteLink,
) => {
  const byId = new Map(nodes.map((entry) => [entry.id, entry]));
  return archiveLinkRouteGeometry(
    routes.routes.get(item.id),
    byId.get(item.sourceId)!,
    byId.get(item.targetId)!,
  );
};

const states = new Set(["verified-clear", "intersects", "unverified"]);

/** Invariante central: o diagnóstico nunca afirma mais do que verificou. */
const assertStateContract = (routes: ArchiveRoutePlanSet) => {
  for (const item of routes.routes.values()) {
    assert.ok(states.has(item.state), `estado inválido: ${item.state}`);
    if (item.state === "verified-clear") {
      assert.equal(item.residual.length, 0, "livre verificado sem residual");
      assert.equal(item.fallbackReason, null, "livre verificado não é fallback");
    }
    if (item.state === "intersects")
      assert.ok(item.residual.length > 0, "interseção exige obstáculo residual");
    if (item.fallbackReason !== null)
      assert.notEqual(item.state, "verified-clear", "fallback não é livre verificado");
  }
};

// 1. Quadro amplo (>40 obstáculos) mantém a classificação honesta.
check("mais de 40 obstáculos mantém o contrato de diagnóstico", () => {
  const nodes: ArchiveRouteNode[] = [];
  for (let row = 0; row < 7; row++)
    for (let column = 0; column < 9; column++)
      nodes.push(node(`c${row}-${column}`, column * 400, row * 300));
  nodes.push(node("origem", -600, 900), node("destino", 900, -500));
  const links = [link("l1", "origem", "destino")];
  const routes = plan(nodes, links);
  assertStateContract(routes);
  const item = routes.routes.get("l1")!;
  assert.ok(item.bounds.width > 0 && item.bounds.height > 0, "caixa do trajeto");
});

// 2. Rota verificada e sem colisão pela referência independente.
check("rota livre verificada não colide com nenhum card", () => {
  const nodes = [
    node("a", 0, 0),
    node("b", 1200, 0),
    node("c", 600, 800),
    node("d", -600, 800),
  ];
  const links = [link("l1", "a", "b")];
  const routes = plan(nodes, links);
  const item = routes.routes.get("l1")!;
  assert.equal(item.state, "verified-clear", item.state);
  assert.equal(item.residual.length, 0);
  const geometry = geometryOf(routes, nodes, links[0]);
  assert.equal(crossings(geometry.points, nodes), 0, "referência independente");
});

// 3. Barreira larga: se declarar livre, a referência independente confirma.
check("barreira larga só é declarada livre com confirmação independente", () => {
  const nodes = [
    node("a", 0, 0),
    node("parede", 420, -4000, 500, 8000),
    node("b", 1400, 0),
  ];
  const links = [link("l1", "a", "b")];
  const routes = plan(nodes, links);
  assertStateContract(routes);
  const item = routes.routes.get("l1")!;
  const geometry = geometryOf(routes, nodes, links[0]);
  if (item.state === "verified-clear")
    assert.equal(crossings(geometry.points, nodes), 0, "referência independente");
  else assert.ok(item.residual.length > 0, "interseção precisa de residual");
});

// 4. Cards sobrepostos: diagnóstico coerente com o residual.
check("cards sobrepostos não produzem diagnóstico falso", () => {
  const nodes = [node("a", 0, 0), node("b", 80, 40)];
  const routes = plan(nodes, [link("l1", "a", "b")]);
  assertStateContract(routes);
});

// 5. Orçamento estourado interrompe a exploração e marca não verificado.
check("orçamento esgotado marca rotas como não verificadas", () => {
  const nodes = [node("a", 0, 0), node("b", 900, 0)];
  const links: ArchiveRouteLink[] = [];
  for (let i = 0; i <= ARCHIVE_LINK_ROUTING.maxLinks; i++)
    links.push(link(`l${i}`, "a", "b"));
  const routes = plan(nodes, links);
  assert.equal(routes.stats.budgetExceeded, true, "orçamento excedido");
  assert.ok(routes.stats.unverified > 0, "rotas não verificadas registradas");
  assertStateContract(routes);
  const unverified = [...routes.routes.values()].filter(
    (item) => item.state === "unverified",
  );
  assert.ok(unverified.length > 0);
  assert.ok(
    unverified.every((item) => item.residual.length === 0),
    "não verificado não inventa colisão",
  );
});

// 6. Trabalho total respeita o teto determinístico.
check("trabalho total fica dentro do orçamento declarado", () => {
  const nodes = [node("a", 0, 0), node("b", 1500, 900), node("c", 700, 700)];
  const links = [
    link("l1", "a", "b"),
    link("l2", "a", "c"),
    link("l3", "c", "b"),
  ];
  const routes = plan(nodes, links);
  assert.ok(routes.stats.maxWork > 0, "teto de trabalho publicado");
  assert.ok(
    routes.stats.work <= routes.stats.maxWork,
    `trabalho ${routes.stats.work} excedeu ${routes.stats.maxWork}`,
  );
});

// 7. Contrato do rótulo: deslocamento guardado no plano.
check("plano guarda o deslocamento do rótulo explicitamente", () => {
  const nodes = [node("a", 0, 0), node("b", 1000, 400), node("c", 500, 600)];
  const links = [link("l1", "a", "b", "Relação longa"), link("l2", "a", "c")];
  const routes = plan(nodes, links);
  for (const item of routes.routes.values()) {
    assert.ok(item.label, "rótulo posicionado");
    assert.equal(typeof item.label!.offset, "number");
    assert.ok(Number.isFinite(item.label!.offset));
  }
});

// 8. Posição avaliada e posição renderizada são a mesma (referência própria).
check("rótulo renderizado usa o mesmo deslocamento avaliado", () => {
  const nodes = [node("a", 0, 0), node("b", 1000, 400), node("c", 500, 620)];
  const links = [link("l1", "a", "b", "Rótulo"), link("l2", "a", "c", "Outro")];
  const routes = plan(nodes, links);
  for (const item of links) {
    const planItem = routes.routes.get(item.id)!;
    const geometry = geometryOf(routes, nodes, item);
    const label = planItem.label!;
    const head = geometry.points[label.segment],
      tail = geometry.points[label.segment + 1];
    assert.ok(head && tail, "segmento do rótulo existe");
    // Base = interpolação linear no segmento (mesma convenção do render).
    const baseX = head.x + (tail.x - head.x) * label.at;
    const baseY = head.y + (tail.y - head.y) * label.at;
    const moved = Math.hypot(
      geometry.labelPoint.x - baseX,
      geometry.labelPoint.y - baseY,
    );
    assert.ok(
      Math.abs(moved - Math.abs(label.offset)) < 1e-6,
      `deslocamento ${moved} != ${Math.abs(label.offset)}`,
    );
  }
});

// 9. Reutilização localizada preserva rotas independentes.
check("mudança de um card reutiliza rotas independentes", () => {
  const nodes = [
    node("a", 0, 0),
    node("b", 900, 0),
    node("c", 0, 700),
    node("d", 900, 700),
    node("e", 1800, 0),
  ];
  const links = [
    link("l1", "a", "b"),
    link("l2", "c", "d"),
    link("l3", "b", "e"),
  ];
  const first = plan(nodes, links);
  assert.equal(first.stats.reused, 0, "primeiro ciclo não reutiliza");
  const moved = nodes.map((item) =>
    item.id === "e" ? { ...item, x: 2600, y: 1400 } : item,
  );
  const second = plan(moved, links, first);
  assert.ok(second.stats.reused > 0, "rotas independentes reaproveitadas");
  const untouched = second.routes.get("l2")!;
  assert.equal(untouched.reused, true, "l2 independe de e");
  const touched = second.routes.get("l3")!;
  assert.equal(touched.reused, false, "l3 toca o card movido");
  assertStateContract(second);
});

// 10. Remoção de obstáculo invalida a rota que o tocava.
check("remoção de obstáculo invalida a rota afetada", () => {
  const nodes = [
    node("a", 0, 0),
    node("b", 1200, 0),
    node("meio", 600, -100),
    node("outro", 0, 900),
    node("longe", 1200, 900),
  ];
  const links = [link("l1", "a", "b"), link("l2", "outro", "longe")];
  const first = plan(nodes, links);
  const without = nodes.filter((item) => item.id !== "meio");
  const second = plan(without, links, first);
  const item = second.routes.get("l1")!;
  assert.equal(item.reused, false, "rota sobre o obstáculo removido é recalculada");
  assertStateContract(second);
});

// 11. Determinismo absoluto entre execuções.
check("mesma entrada produz o mesmo plano", () => {
  const nodes = [
    node("a", 0, 0),
    node("b", 800, 200),
    node("c", 400, 700),
    node("d", 1400, 600),
  ];
  const links = [
    link("l1", "a", "b", "Um"),
    link("l2", "a", "c", "Dois"),
    link("l3", "c", "d", "Três"),
  ];
  const shorthand = (routes: ArchiveRoutePlanSet) =>
    [...routes.routes.entries()]
      .map(
        ([id, item]) =>
          `${id}:${item.state}:${item.fallbackReason ?? "-"}:${item.sides.join("")}:${item.lane}:${item.label?.segment ?? -1}:${item.label?.at ?? -1}:${item.label?.offset ?? 0}`,
      )
      .join("|");
  const first = shorthand(plan(nodes, links));
  const second = shorthand(plan(nodes, links));
  assert.equal(first, second);
});

// 12. Vínculo muito extenso usa a estratégia simplificada.
check("vínculo extenso não explora desvios caros", () => {
  const nodes = [
    node("a", 0, 0),
    node("b", 6000, 0),
    node("meio", 3000, -200, 400, 400),
  ];
  const links = [link("l1", "a", "b")];
  const routes = plan(nodes, links);
  assertStateContract(routes);
  const item = routes.routes.get("l1")!;
  assert.notEqual(item.strategy, "detour", "sem exploração de desvio longo");
});

// 13. Relações paralelas continuam individuais.
check("relações paralelas mantêm corredores e diagnóstico próprios", () => {
  const nodes = [node("a", 0, 0), node("b", 1000, 0)];
  const links = [
    link("p1", "a", "b", "Um"),
    link("p2", "a", "b", "Dois"),
    link("p3", "b", "a", "Três"),
  ];
  const routes = plan(nodes, links);
  const lanes = new Set([...routes.routes.values()].map((item) => item.lane));
  assert.equal(lanes.size, 3, "um corredor por vínculo");
  assertStateContract(routes);
});

// 14. Hub com muitas relações: planos existem e o diagnóstico fecha.
check("hub denso mantém plano e contagem coerente", () => {
  const nodes = [node("hub", 0, 0)];
  const links: ArchiveRouteLink[] = [];
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2;
    const target = node(
      `n${i}`,
      Math.round(Math.cos(angle) * 2400),
      Math.round(Math.sin(angle) * 2400),
    );
    nodes.push(target);
    links.push(link(`h${i}`, "hub", target.id));
  }
  const routes = plan(nodes, links);
  assert.equal(routes.routes.size, links.length);
  const fallbacks = [...routes.routes.values()].filter(
    (item) => item.fallbackReason !== null,
  ).length;
  assert.equal(routes.stats.fallbacks, fallbacks);
  assert.equal(
    routes.stats.verified + routes.stats.intersects + routes.stats.unverified,
    links.length,
    "todo vínculo tem estado classificado",
  );
  assertStateContract(routes);
});

// 15. Coordenadas extremas não quebram o diagnóstico.
check("coordenadas extremas permanecem finitas e classificadas", () => {
  const nodes = [
    node("a", -9000, -9000),
    node("b", 9000, 9000),
    node("c", -9000, 9000),
  ];
  const links = [link("l1", "a", "b"), link("l2", "a", "c")];
  const routes = plan(nodes, links);
  assertStateContract(routes);
  for (const item of routes.routes.values()) {
    assert.ok(Number.isFinite(item.bounds.x) && Number.isFinite(item.bounds.width));
    assert.ok(Number.isFinite(item.cost));
  }
});

// 16. Cards muito próximos: fallback continua selecionável e finito.
check("cards quase coincidentes produzem rota finita", () => {
  const nodes = [node("a", 0, 0), node("b", 4, 3)];
  const routes = plan(nodes, [link("l1", "a", "b")]);
  assertStateContract(routes);
  const geometry = geometryOf(routes, nodes, { id: "l1", sourceId: "a", targetId: "b" });
  assert.ok(geometry.path.length > 0);
  assert.ok(Number.isFinite(geometry.length));
});

// 17. Obstáculo removido não gera rota órfã nem diagnóstico vazio.
check("remoção de obstáculo mantém todos os vínculos classificados", () => {
  const nodes = [
    node("a", 0, 0),
    node("b", 1000, 0),
    node("x", 500, -120),
    node("y", 500, 320),
  ];
  const links = [link("l1", "a", "b")];
  const first = plan(nodes, links);
  const second = plan(nodes.slice(0, 2), links, first);
  assert.equal(second.routes.size, 1);
  assertStateContract(second);
  const reached = inflateArchiveRect(second.routes.get("l1")!.bounds, 1);
  assert.ok(reached.width >= 0 && reached.height >= 0);
});

console.log(`\n${checks} verificações de hardening do roteamento relacional.`);
