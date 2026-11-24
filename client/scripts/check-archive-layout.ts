/** Sem DOM/banco: distribuição e reversibilidade no espaço narrativo. */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { projectArchive } from "../src/components/archive/archiveProjection";
import {
  layoutArchive,
  archiveIntersects,
  archiveGestureCommit,
  archiveLayoutTransition,
  type ArchiveLayout,
} from "../src/components/archive/archiveLayout";
import type {
  NarrativeGraphDto,
  NarrativePlacementDto,
} from "../../src/modules/shared/narrative";
let checks = 0;
const check = (f: () => void) => {
  f();
  checks++;
};
const card = (
  id: string,
  x = 0,
  y = 0,
  width = 280,
  height = 200,
  parentPlacementId: string | null = null,
): NarrativePlacementDto => ({
  id,
  cardId: `c-${id}`,
  boardId: "board",
  parentPlacementId,
  x,
  y,
  width,
  height,
  zIndex: 0,
  card: {
    id: `c-${id}`,
    title: id,
    category: "note",
    summary: "",
    content: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
});
const graph = (placements: NarrativePlacementDto[]): NarrativeGraphDto => ({
  board: {
    id: "board",
    name: "Teste",
    description: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
  placements,
  links: placements.slice(1).map((p, i) => ({
    id: `l${i}`,
    sourceId: placements[0].cardId,
    targetId: p.cardId,
    relation: "related",
    label: "",
    description: "",
    directed: i % 2 === 0,
    version: 0,
  })),
});
const run = (
  g: NarrativeGraphDto,
  ids: string[] = ["root"],
  options: Parameters<typeof layoutArchive>[1] = {},
) => layoutArchive(projectArchive(g, new Set(ids)), options);
const normalized = (r: ArchiveLayout) => JSON.stringify([...r.geometry]);
const clean = (r: ArchiveLayout) =>
  check(() =>
    assert.deepEqual(
      r.diagnostics.residuals,
      [],
      JSON.stringify(r.diagnostics),
    ),
  );
for (const count of [0, 1, 2, 4, 8, 24, 48]) {
  const g = graph([
    card("root"),
    ...Array.from({ length: count }, (_, i) =>
      card(
        `child-${String(i).padStart(2, "0")}`,
        0,
        0,
        180 + (i % 4) * 90,
        120 + (i % 3) * 100,
        "root",
      ),
    ),
  ]);
  const before = JSON.stringify(g),
    r = run(g);
  check(() =>
    assert.deepEqual(r.geometry.get("root"), {
      x: 0,
      y: 0,
      width: 280,
      height: 200,
      zIndex: 0,
    }),
  );
  clean(r);
  check(() => assert.equal(r.geometry.size, count + 1));
  check(() => assert.equal(JSON.stringify(g), before));
  check(() =>
    assert.equal(
      normalized(r),
      normalized(run({ ...g, placements: [...g.placements].reverse() })),
    ),
  );
  for (const p of g.placements)
    check(() => {
      const v = r.geometry.get(p.id)!;
      assert.equal(v.width, p.width);
      assert.equal(v.height, p.height);
      assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y));
    });
}
for (const [w, h] of [
  [180, 120],
  [1600, 120],
  [180, 1600],
  [1600, 1600],
]) {
  const g = graph([
    card("root", -800, -500, w, h),
    card("left", -3000, -500, 1600, 180, "root"),
    card("tall", -500, -500, 180, 1600, "root"),
  ]);
  const r = run(g);
  clean(r);
  check(() => assert.ok(r.geometry.get("left")!.x < r.geometry.get("root")!.x));
}
const neighbors = graph([
  card("root"),
  card("child", 0, 0, 280, 200, "root"),
  card("b", 312, 0),
  card("c", 624, 0),
  card("far", 10000, 10000),
  card("far-overlap", 10000, 10000),
]);
const before = JSON.stringify(neighbors),
  r = run(neighbors);
clean(r);
check(() => assert.ok(r.offsets.has("b")));
check(() =>
  assert.ok(r.offsets.has("c"), "Propagação alcança o segundo vizinho"),
);
check(() => assert.equal(r.offsets.has("far"), false));
check(() => assert.equal(r.offsets.has("far-overlap"), false));
check(() => assert.ok(r.diagnostics.preservedOverlaps > 0));
check(() => assert.deepEqual(r.graph.links, neighbors.links));
for (let i = 0; i < 100; i++) {
  const open = run(neighbors),
    closed = run(neighbors, []);
  check(() => assert.equal(normalized(open), normalized(r)));
  check(() => assert.equal(closed.offsets.size, 0));
  check(() =>
    assert.deepEqual(
      [...closed.geometry.values()],
      neighbors.placements
        .filter((p) => !p.parentPlacementId)
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .map(({ x, y, width, height, zIndex }) => ({
          x,
          y,
          width,
          height,
          zIndex,
        })),
    ),
  );
}
check(() => assert.equal(JSON.stringify(neighbors), before));
for (const distance of [700, 20000]) {
  const g = graph([
    card("root"),
    card("a", 0, 0, 280, 200, "root"),
    card("other", distance, 0),
    card("o", distance, 0, 600, 350, "other"),
    card("third", distance, 800),
    card("t", distance, 800, 180, 400, "third"),
  ]);
  const all = run(g, ["other", "root", "third"]);
  clean(all);
  check(() =>
    assert.equal(
      normalized(all),
      normalized(
        run({ ...g, placements: [...g.placements].reverse() }, [
          "third",
          "other",
          "root",
        ]),
      ),
    ),
  );
  check(() =>
    assert.deepEqual(
      all.geometry.get("root"),
      run(g, ["root"]).geometry.get("root"),
    ),
  );
  check(() =>
    assert.equal(
      normalized(run(g, ["root", "other"])),
      normalized(run(g, ["other", "root"])),
    ),
  );
  check(() => assert.equal(run(g, []).offsets.size, 0));
}
const nested = graph([
  card("root"),
  card("sub", 0, 0, 300, 220, "root"),
  card("leaf", 0, 0, 280, 200, "sub"),
]);
clean(run(nested, ["root", "sub"]));
check(() => assert.equal(run(nested, ["sub"]).geometry.has("leaf"), false));
const removed = {
  ...nested,
  placements: nested.placements.slice(1).map((p) => ({
    ...p,
    parentPlacementId: p.id === "sub" ? null : p.parentPlacementId,
  })),
};
clean(run(removed, ["sub"]));
const nearLimit = graph([
  card("root", 1e6, -1e6, 1600, 1600),
  card("kid", 1e6, -1e6, 1600, 1600, "root"),
]);
const limit = run(nearLimit);
clean(limit);
check(() =>
  assert.ok(
    [...limit.geometry.values()].every(
      (p) =>
        Number.isFinite(p.x) && Math.abs(p.x) <= 1e6 && Math.abs(p.y) <= 1e6,
    ),
  ),
);
const capped = run(neighbors, ["root"], { config: { maxChecks: 0 } });
check(() => assert.equal(capped.diagnostics.capped, true));
check(() => assert.ok(capped.diagnostics.residuals.length > 0));
check(() =>
  assert.equal(
    normalized(capped),
    normalized(run(neighbors, ["root"], { config: { maxChecks: 0 } })),
  ),
);
const pin = { x: 900, y: 700, baseX: 0, baseY: 0 };
check(() =>
  assert.equal(
    run(neighbors, ["root"], { anchors: { root: pin } }).geometry.get("root")!
      .x,
    900,
  ),
);
check(() =>
  assert.equal(
    run(neighbors, [], { anchors: { root: pin } }).geometry.get("root")!.x,
    0,
  ),
);
check(() =>
  assert.equal(
    run(neighbors, ["root"], {
      anchors: { root: { ...pin, baseX: 1 } },
    }).geometry.get("root")!.x,
    0,
  ),
);
const pinFixture = graph([
  card("root"),
  card("r-child", 0, 0, 280, 200, "root"),
  card("b", 312, 0),
  card("b-child", 312, 0, 280, 200, "b"),
]);
const firstPin = run(pinFixture, ["root"]),
  bShown = firstPin.geometry.get("b")!;
const pins = { b: { x: bShown.x, y: bShown.y, baseX: 312, baseY: 0 } };
check(() =>
  assert.equal(
    run(pinFixture, ["b", "root"], { anchors: pins }).geometry.get("b")!.x,
    bShown.x,
  ),
);
check(() =>
  assert.equal(
    run(pinFixture, ["b"], { anchors: pins }).geometry.get("b")!.x,
    bShown.x,
  ),
);
check(() =>
  assert.equal(
    run(pinFixture, [], { anchors: pins }).geometry.get("b")!.x,
    312,
  ),
);
const persisted = { x: 10, y: 20, width: 280, height: 200, zIndex: 0 },
  start = { ...persisted, x: 410, y: 320 },
  final = { ...start, x: 450, y: 350, width: 330, height: 250 };
check(() =>
  assert.deepEqual(
    archiveGestureCommit(persisted, start, final, "move"),
    final,
  ),
);
check(() =>
  assert.deepEqual(archiveGestureCommit(persisted, start, final, "resize"), {
    ...final,
    x: 50,
    y: 50,
  }),
);
check(() =>
  assert.ok(
    archiveLayoutTransition(run(neighbors, []).geometry, r).some(
      (c) => c.id === "child" && c.from === null,
    ),
  ),
);
check(() => assert.equal(archiveLayoutTransition(r.geometry, r).length, 0));
check(() =>
  assert.ok(
    archiveIntersects(
      { x: 0, y: 0, width: 1600, height: 120 },
      { x: 1500, y: 100, width: 180, height: 1600 },
    ),
  ),
);

check(() =>
  assert.equal(
    archiveGestureCommit(
      { ...persisted, x: 1 / 3 },
      { ...start, x: 1234.56789 },
      { ...start, x: 1234.56789, width: 350 },
      "resize",
    ).x,
    1 / 3,
  ),
);
// Amostras repetidas após aquecimento, em baixa/alta densidade, sem SLA/FPS inferidos.
const metrics = [];
for (const count of [50, 100, 200, 500])
  for (const dense of [false, true]) {
    const g = graph(
      Array.from({ length: count }, (_, i) =>
        card(
          i === 0 ? "root" : `n-${String(i).padStart(3, "0")}`,
          dense ? (i % 10) * 70 : (i % 20) * 400,
          dense ? Math.floor(i / 10) * 55 : Math.floor(i / 20) * 300,
          180 + (i % 4) * 80,
          120 + (i % 3) * 70,
          i > 0 && i < Math.min(25, count / 2) ? "root" : null,
        ),
      ),
    );
    const projection = projectArchive(g, new Set(["root"]));
    for (let i = 0; i < 5; i++) layoutArchive(projection);
    const times = [],
      application = [];
    let last: ArchiveLayout | undefined;
    for (let i = 0; i < 12; i++) {
      let t = performance.now();
      last = layoutArchive(projection);
      times.push(performance.now() - t);
      t = performance.now();
      last.graph.placements.map((p) => ({ ...p, ...last!.geometry.get(p.id) }));
      application.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    application.sort((a, b) => a - b);
    check(() =>
      assert.ok(
        [...last!.geometry.values()].every(
          (p) =>
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            Math.abs(p.x) <= 1e6 &&
            Math.abs(p.y) <= 1e6,
        ),
      ),
    );
    check(() =>
      assert.equal(
        normalized(last!),
        normalized(
          layoutArchive(
            projectArchive(
              { ...g, placements: [...g.placements].reverse() },
              new Set(["root"]),
            ),
          ),
        ),
      ),
    );
    check(() =>
      assert.equal(
        new Set(last!.geometry.keys()).size,
        projection.visibleIds.size,
      ),
    );
    metrics.push({
      cards: count,
      dense,
      medianMs: +times[6].toFixed(3),
      p95Ms: +times[11].toFixed(3),
      applicationMedianMs: +application[6].toFixed(3),
      checks: last!.diagnostics.checks,
      moves: last!.diagnostics.moves,
      affected: last!.affected.length,
      residuals: last!.diagnostics.residuals.length,
      capped: last!.diagnostics.capped,
    });
  }
console.log(
  "Amostras locais aquecidas (12 repetições):",
  JSON.stringify(metrics),
);

console.log(
  `Layout: ${checks} verificações de distribuição, colisão, determinismo, reversibilidade e gestos passaram.`,
);
