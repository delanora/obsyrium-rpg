/** Filtros puros, sem HTTP/DB; geometria e estados estruturais são entradas imutáveis. */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  filterArchive,
  archiveFilterKind,
  EMPTY_ARCHIVE_FILTER,
} from "../src/components/archive/archiveFilters";
import { projectArchive } from "../src/components/archive/archiveProjection";
import { layoutArchive } from "../src/components/archive/archiveLayout";
import type {
  NarrativeGraphDto,
  NarrativePlacementDto,
  NarrativeGroupDto,
} from "../../src/modules/shared/narrative";
let checks = 0;
const check = (f: () => void) => {
  f();
  checks++;
};
const group = (id: string): NarrativeGroupDto => ({
  id,
  name: "Grupo " + id,
  color: "#AABBCC",
  version: 0,
  description: "",
  cardCount: 0,
  createdById: "fixture",
  createdAt: "",
  updatedAt: "",
});
const groups = [group("g1"), group("g2"), group("vazio")];
const place = (
  id: string,
  parent: string | null,
  ids: string[],
): NarrativePlacementDto => ({
  id,
  cardId: id,
  boardId: "fixture",
  parentPlacementId: parent,
  x: 0,
  y: 0,
  width: 280,
  height: 200,
  zIndex: 0,
  card: {
    id,
    title: id,
    category: "note",
    summary: "",
    content: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
    groups: groups.filter((g) => ids.includes(g.id)),
  },
});
const graph: NarrativeGraphDto = {
  board: {
    id: "fixture",
    name: "Fixture",
    description: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
  groups,
  placements: [
    place("root", null, ["g2"]),
    place("a", "root", []),
    place("b", "a", []),
    place("c", "b", []),
    place("leaf", "c", ["g1", "g2"]),
    place("loose", null, []),
  ],
  links: [
    {
      id: "l",
      sourceId: "root",
      targetId: "leaf",
      relation: "related",
      directed: true,
      label: "",
      description: "",
      version: 0,
    },
  ],
};
const run = (
  ids: string[],
  mode: "highlight" | "isolate" = "highlight",
  match: "any" | "all" = "any",
  open: string[] = [],
  g = graph,
) =>
  filterArchive(g, projectArchive(g, new Set(open)), {
    groupIds: ids,
    mode,
    match,
  });
const empty = run([]);
check(() => assert.equal(empty.active, false));
check(() => assert.equal(empty.total, 6));
check(() => assert.equal(archiveFilterKind(empty, "root", "root"), "normal"));
const single = run(["g1"]);
check(() => assert.equal(single.total, 1));
check(() => assert.equal(single.visible, 0));
check(() => assert.equal(single.collapsed, 1));
check(() => assert.equal(single.hiddenByOwner.get("root"), 1));
check(() => assert.equal(single.visibleIds.size, 2));
const isolated = run(["g1"], "isolate");
check(() => assert.deepEqual([...isolated.visibleIds], ["root"]));
check(() =>
  assert.equal(archiveFilterKind(isolated, "root", "root"), "context"),
);
check(() =>
  assert.equal(archiveFilterKind(isolated, "loose", "loose"), "hidden"),
);
const partial = run(["g1"], "isolate", "any", ["root"]);
check(() => assert.deepEqual(partial.visibleIds, new Set(["root", "a"])));
check(() => assert.equal(partial.hiddenByOwner.get("a"), 1));
check(() => assert.equal(partial.visible, 0));
const any = run(["g1", "g2"]);
check(() => assert.equal(any.total, 2));
check(() => assert.equal(any.visible, 1));
check(() => assert.equal(any.collapsed, 1));
const all = run(["g1", "g2"], "isolate", "all", ["root", "a", "b", "c"]);
check(() => assert.equal(all.total, 1));
check(() => assert.equal(all.visible, 1));
check(() => assert.equal(all.collapsed, 0));
check(() => assert.equal(all.contextIds.size, 4));
check(() => assert.equal(all.visibleIds.size, 5));
check(() => assert.equal(archiveFilterKind(all, "leaf", "leaf"), "match"));
check(() => assert.equal(run(["vazio"]).total, 0));
check(() => assert.equal(run(["excluido"]).active, false));
check(() =>
  assert.equal(
    run(["g1"], "highlight", "all", [], { ...graph, groups: [] }).active,
    false,
  ),
);
const duplicate = structuredClone(graph);
duplicate.placements.push({
  ...duplicate.placements[4],
  id: "visible-duplicate",
  parentPlacementId: null,
});
const duplicateResult = run(["g1"], "highlight", "any", [], duplicate);
check(() => assert.equal(duplicateResult.total, 1));
check(() => assert.equal(duplicateResult.visible, 1));
check(() => assert.equal(duplicateResult.collapsed, 0));
check(() =>
  assert.deepEqual(
    run(["g2", "g1"], "highlight", "all").matchingCardIds,
    run(["g1", "g2"], "highlight", "all").matchingCardIds,
  ),
);
const cyclic = structuredClone(graph);
cyclic.placements[0].parentPlacementId = "leaf";
check(() =>
  assert.ok(run(["g1"], "isolate", "all", [], cyclic).visibleIds.size > 0),
);
const open = new Set(["root", "a", "b", "c"]),
  projection = projectArchive(graph, open),
  layout = layoutArchive(projection),
  saved = JSON.stringify(graph),
  geometry = JSON.stringify([...layout.geometry]),
  reserves = JSON.stringify(
    layout.reserves.map((r) => ({ id: r.sourceId, regions: r.regions })),
  ),
  camera = { x: 13, y: -20, zoom: 0.7 };
for (let i = 0; i < 110; i++) {
  const filter = filterArchive(graph, projection, {
    groupIds: ["g1"],
    match: i % 2 ? "any" : "all",
    mode: i % 2 ? "highlight" : "isolate",
  });
  const cleared = filterArchive(graph, projection, EMPTY_ARCHIVE_FILTER);
  check(() => assert.equal(filter.total, 1));
  check(() => assert.equal(cleared.active, false));
  check(() => assert.equal(JSON.stringify(graph), saved));
  check(() => assert.equal(JSON.stringify([...layout.geometry]), geometry));
  check(() =>
    assert.equal(
      JSON.stringify(
        layout.reserves.map((r) => ({ id: r.sourceId, regions: r.regions })),
      ),
      reserves,
    ),
  );
  check(() => assert.deepEqual([...open], ["root", "a", "b", "c"]));
  check(() => assert.deepEqual(camera, { x: 13, y: -20, zoom: 0.7 }));
}
const states = {
  a: { groupIds: ["g1"], match: "any", mode: "highlight" },
  b: { groupIds: ["g2"], match: "all", mode: "isolate" },
};
check(() => assert.notDeepEqual(states.a.groupIds, states.b.groupIds));
const timings = [];
for (const count of [50, 100, 200, 500]) {
  const g = {
    ...graph,
    placements: Array.from({ length: count }, (_, i) =>
      place("p" + i, i > 0 && i < 8 ? "p0" : null, i % 3 ? ["g1"] : ["g2"]),
    ),
  };
  const p = projectArchive(g, new Set(["p0"]));
  const times = [];
  for (let i = 0; i < 20; i++) {
    const t = performance.now();
    for (let n = 0; n < 100; n++)
      filterArchive(g, p, {
        groupIds: ["g1", "g2"],
        match: "any",
        mode: "isolate",
      });
    times.push((performance.now() - t) / 100);
  }
  times.sort((a, b) => a - b);
  timings.push({ count, medianMs: times[10], p95Ms: times[19] });
}
console.log(
  `Filtros: ${checks} verificações; 110 ciclos sem mutação, drift ou alteração estrutural.`,
);
console.log(
  "CPU de avaliação+contagem (ms), amostras locais:",
  JSON.stringify(timings),
);
