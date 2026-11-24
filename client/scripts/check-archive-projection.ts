/** Funções puras: nenhuma conexão HTTP/banco ou fixture da campanha. */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { projectArchive } from "../src/components/archive/archiveProjection";
import type { NarrativeGraphDto } from "../../src/modules/shared/narrative";
let checks = 0;
const check = (test: () => void) => {
  test();
  checks++;
};
const names = [
  "Cidade de Valdoria",
  "Taverna do Corvo",
  "Mercado",
  "Guarda da cidade",
  "Templo Serpentino",
  "Entrada da Caverna",
  "Salão das Estátuas",
  "Armadilha de Dardos",
  "Guardião",
  "Dragão das Montanhas do Norte",
];
const graph: NarrativeGraphDto = {
  board: {
    id: "quadro",
    name: "Mundo",
    description: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
  placements: names.map((title, i) => ({
    id: `p${i}`,
    boardId: "quadro",
    cardId: `c${i}`,
    parentPlacementId: i > 0 && i < 5 ? "p0" : i > 5 && i < 9 ? "p5" : null,
    x: i * 380,
    y: (i % 3) * 240,
    width: 280,
    height: 200,
    zIndex: 0,
    card: {
      id: `c${i}`,
      title,
      category: "note",
      summary: "Resumo",
      content: "",
      version: 0,
      createdAt: "",
      updatedAt: "",
    },
  })),
  links: [
    [0, 1],
    [0, 9],
    [6, 9],
    [6, 7],
    [9, 0],
  ].map(([a, b], i) => ({
    id: `l${i}`,
    sourceId: `c${a}`,
    targetId: `c${b}`,
    relation: "contains",
    label: "",
    directed: i !== 3,
    description: "",
    version: 0,
  })),
};
const original = JSON.stringify(graph);
const closed = projectArchive(graph, new Set());
check(() => assert.deepEqual([...closed.visibleIds], ["p0", "p5", "p9"]));
check(() => assert.equal(closed.nodes.get("p0")!.children.length, 4));
check(() => assert.equal(closed.nodes.get("p0")!.relationCount, 3));
check(() => assert.equal(closed.owner.get("p1"), "p0"));
check(() => assert.equal(closed.owner.get("p6"), "p5"));
check(() => assert.equal(closed.nodes.get("p5")!.hiddenLinks, 2));
check(() =>
  assert.deepEqual(
    closed.graph.links.map((l) => l.id),
    ["l1", "l4"],
  ),
);
check(() => assert.equal(closed.hiddenLinks.length, 3));
const city = projectArchive(graph, new Set(["p0"]));
check(() => assert.equal(city.visibleIds.size, 7));
check(() =>
  assert.ok(
    city.visibleIds.has("p9"),
    "Relação Contém não implica pertencimento",
  ),
);
check(() =>
  assert.equal(
    city.graph.links.find((l) => l.id === "l0"),
    graph.links[0],
  ),
);
const open = projectArchive(graph, new Set(["p0", "p5"]));
check(() => assert.equal(open.visibleIds.size, 10));
check(() => assert.equal(open.graph.links.length, graph.links.length));
check(() => assert.deepEqual(open.graph.links, graph.links));
check(() =>
  assert.equal(
    open.graph.placements.length,
    new Set(open.graph.placements.map((p) => p.id)).size,
  ),
);
for (let i = 0; i < 100; i++) {
  projectArchive(graph, new Set());
  projectArchive(graph, new Set(["p0", "p5"]));
}
check(() =>
  assert.equal(
    JSON.stringify(graph),
    original,
    "Ciclos visuais preservam posições, tamanhos, IDs e direções",
  ),
);
const nested = structuredClone(graph);
nested.placements[7].parentPlacementId = "p6";
check(() =>
  assert.equal(
    projectArchive(nested, new Set(["p5"])).visibleIds.has("p7"),
    false,
  ),
);
check(() =>
  assert.equal(
    projectArchive(nested, new Set(["p5", "p6"])).visibleIds.has("p7"),
    true,
  ),
);
check(() =>
  assert.equal(
    projectArchive(nested, new Set(["p6"])).visibleIds.has("p7"),
    false,
  ),
);
const corrupt = structuredClone(graph);
corrupt.placements[0].parentPlacementId = "p1";
check(() => assert.ok(projectArchive(corrupt, new Set()).visibleIds.size > 0));
corrupt.placements[1].parentPlacementId = "inexistente";
check(() => assert.ok(projectArchive(corrupt, new Set()).visibleIds.has("p1")));
const other = structuredClone(graph);
other.board.id = "outro";
other.placements = other.placements.map((p) => ({
  ...p,
  id: `outro-${p.id}`,
  boardId: "outro",
  parentPlacementId: null,
}));
check(() =>
  assert.equal(projectArchive(other, new Set(["p0"])).visibleIds.size, 10),
);
const metrics = [];
for (const count of [50, 100, 200]) {
  const large = {
    ...graph,
    links: [],
    placements: Array.from({ length: count }, (_, i) => ({
      ...graph.placements[0],
      id: `n${i}`,
      cardId: `c${i}`,
      parentPlacementId: i % 10 ? `n${i - (i % 10)}` : null,
    })),
  };
  const before = JSON.stringify(large),
    start = performance.now();
  for (let i = 0; i < 1000; i++)
    projectArchive(
      large,
      new Set(i % 2 ? large.placements.map((p) => p.id) : []),
    );
  const elapsed = performance.now() - start;
  check(() => assert.equal(JSON.stringify(large), before));
  metrics.push({
    cards: count,
    projections: 1000,
    elapsedMs: +elapsed.toFixed(2),
  });
}
console.log(
  `Expansão: ${checks} invariantes de visibilidade, relações, geometria e proteção contra ciclos passaram.`,
);
console.log(
  "Amostra pura local, sem garantia de produção:",
  JSON.stringify(metrics),
);
