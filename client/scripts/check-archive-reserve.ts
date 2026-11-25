/** Reserva temporária: sem DOM, HTTP ou banco; invariantes sobre o resolvedor existente. */
import assert from "node:assert/strict";
import { projectArchive } from "../src/components/archive/archiveProjection";
import {
  layoutArchive,
  archiveReserveIntent,
  archiveIntersects,
  ARCHIVE_LAYOUT_CONFIG,
  type ArchiveReserveExceptions,
} from "../src/components/archive/archiveLayout";
import {
  archivePose,
  planArchiveMotion,
  completeArchiveMotion,
  sampleArchiveMotion,
} from "../src/components/archive/archiveMotion";
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
  parent: string | null,
  x = 0,
  y = 0,
  width = 280,
  height = 200,
): NarrativePlacementDto => ({
  id,
  boardId: "b",
  cardId: id,
  parentPlacementId: parent,
  x,
  y,
  width,
  height,
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
  },
});
const graph = (placements: NarrativePlacementDto[]): NarrativeGraphDto => ({
  board: {
    id: "b",
    name: "Reserva",
    description: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
  placements,
  links: [],
});
const inside = [
  card("root", null),
  ...Array.from({ length: 4 }, (_, i) => card("child" + i, "root")),
];
const run = (
  g: NarrativeGraphDto,
  ids = ["root"],
  margin = 280,
  manual: ArchiveReserveExceptions = {},
) =>
  layoutArchive(projectArchive(g, new Set(ids)), {
    // Perfil legado conserva suas invariantes; o novo padrão é verificado abaixo.
    config: { reserveMargin: margin, reserveBands: 0 },
    manual,
  });
const isolated = graph(inside),
  old = run(isolated, ["root"], 0),
  reserved = run(isolated);
check(() => assert.deepEqual(reserved.geometry, old.geometry));
check(() => {
  assert.equal(reserved.reserves.length, 1);
  assert.equal(reserved.reserves[0].regions.length, 5);
  assert.equal(ARCHIVE_LAYOUT_CONFIG.gap, 32);
  assert.equal(ARCHIVE_LAYOUT_CONFIG.reserveMargin, 560);
});
const g = graph([
    ...inside,
    card("neighbor", null, 760),
    card("chain", null, 1080),
    card("far", null, 8000, 8000),
  ]),
  raw = JSON.stringify(g),
  normal = run(g, ["root"], 0),
  space = run(g);
check(() =>
  assert.deepEqual(
    normal.geometry.get("neighbor"),
    g.placements.find((p) => p.id === "neighbor") && {
      x: 760,
      y: 0,
      width: 280,
      height: 200,
      zIndex: 0,
    },
  ),
);
check(() =>
  assert.notDeepEqual(
    space.geometry.get("neighbor"),
    normal.geometry.get("neighbor"),
  ),
);
check(() =>
  assert.deepEqual(space.geometry.get("far"), normal.geometry.get("far")),
);
for (const p of inside)
  check(() =>
    assert.deepEqual(space.geometry.get(p.id), old.geometry.get(p.id)),
  );
check(() => assert.equal(space.diagnostics.reserveResiduals.length, 0));
for (const reserve of space.reserves)
  for (const p of g.placements.filter((p) => !reserve.members.has(p.id)))
    check(() =>
      assert.ok(
        reserve.regions.every(
          (r) => !archiveIntersects(r, space.geometry.get(p.id)!, 32),
        ),
      ),
    );
// A faixa de 280 (+ folga) admite um card padrão sem tocar na estrutura ou no vizinho afastado.
check(() => {
  const branch = space.geometry.get("child0")!,
    next = space.geometry.get("neighbor")!;
  assert.ok(next.x - (branch.x + branch.width) >= 280);
});
for (let i = 0; i < 110; i++) {
  check(() => assert.deepEqual(run(g, []).geometry, run(g, [], 0).geometry));
  check(() => assert.deepEqual(run(g).geometry, space.geometry));
}
check(() => assert.equal(JSON.stringify(g), raw));
const grown = graph([
  ...g.placements,
  card("new1", "root"),
  card("new2", "root"),
]);
check(() => assert.equal(run(grown).reserves[0].members.size, 7));
check(() =>
  assert.deepEqual(
    run(grown).geometry.get("neighbor"),
    space.geometry.get("neighbor"),
    "Novos ramos cabem no espaço já liberado sem afastar novamente o vizinho",
  ),
);
check(() =>
  assert.deepEqual(run(grown, []).geometry, run(grown, [], 0).geometry),
);
const resized = graph(
  g.placements.map((p) =>
    p.id === "child0" ? { ...p, width: 520, height: 350 } : p,
  ),
);
check(() =>
  assert.ok(
    run(resized).reserves[0].regions.some(
      (r) => r.width === 1080 && r.height === 910,
    ),
  ),
);
const distant = graph([
    ...g.placements.map((p) =>
      p.id === "child3"
        ? { ...p, branchOffsetX: 50000, branchOffsetY: -3000 }
        : p,
    ),
    card("middle", null, 20000, -1400),
  ]),
  far = run(distant);
check(() =>
  assert.deepEqual(
    far.geometry.get("middle"),
    run(distant, ["root"], 0).geometry.get("middle"),
  ),
);
check(() => assert.equal(far.geometry.get("child3")!.x, 50000));
const manualGeometry = { ...space.geometry.get("neighbor")!, x: 650, y: 0 };
const exception = archiveReserveIntent(space, {}, "neighbor", manualGeometry),
  manualGraph = graph(
    g.placements.map((p) =>
      p.id === "neighbor" ? { ...p, ...manualGeometry } : p,
    ),
  );
check(() =>
  assert.deepEqual(
    run(manualGraph, ["root"], 280, exception).geometry.get("neighbor"),
    manualGeometry,
  ),
);
check(() =>
  assert.notDeepEqual(
    run(manualGraph).geometry.get("neighbor"),
    manualGeometry,
  ),
);
check(() =>
  assert.deepEqual(
    run(manualGraph, [], 280, exception).geometry,
    run(manualGraph, [], 0).geometry,
  ),
);
const changed = graph(
  manualGraph.placements.map((p) =>
    p.id === "neighbor" ? { ...p, x: 651 } : p,
  ),
);
check(() =>
  assert.notEqual(
    run(changed, ["root"], 280, exception).geometry.get("neighbor")!.x,
    651,
  ),
);
const multiple = graph([
    ...g.placements,
    card("other", null, -700, 200),
    card("other-child", "other", -700, 200),
  ]),
  two = run(multiple, ["root", "other"]);
check(() => assert.equal(two.reserves.length, 2));
check(() =>
  assert.deepEqual(
    two.geometry.get("other"),
    run(multiple, ["other"], 0).geometry.get("other"),
  ),
);
check(() => assert.ok(two.diagnostics.reserveResiduals.length > 0));
const negative = graph(
  g.placements.map((p) => ({ ...p, x: p.x - 3500, y: p.y - 2500 })),
);
for (const geometry of run(negative).geometry.values())
  check(() => assert.ok(Object.values(geometry).every(Number.isFinite)));
const extreme = graph(
    g.placements.map((p) => ({ ...p, x: 999800, y: 999800 })),
  ),
  limited = run(extreme);
for (const p of limited.geometry.values())
  check(() =>
    assert.ok(
      Number.isFinite(p.x) &&
        Math.abs(p.x) <= 1e6 &&
        Number.isFinite(p.y) &&
        Math.abs(p.y) <= 1e6,
    ),
  );
check(() =>
  assert.ok(
    layoutArchive(projectArchive(extreme, new Set(["root"])), {
      config: { maxChecks: 8, maxMoves: 1 },
    }).diagnostics.capped,
  ),
);
check(() => assert.deepEqual(run(g).geometry, run(g).geometry));
check(() =>
  assert.ok(
    space.diagnostics.moves <= ARCHIVE_LAYOUT_CONFIG.maxMoves &&
      space.diagnostics.checks <= ARCHIVE_LAYOUT_CONFIG.maxChecks,
  ),
);
// Finalização conserva apenas poses terminais invisíveis até o commit de remoção.
const closed = run(g, []),
  poses = new Map([...space.geometry].map(([id, p]) => [id, archivePose(p)])),
  plan = planArchiveMotion(poses, closed, g, space);
for (const t of [plan.duration - 0.01, plan.duration, plan.duration + 0.01]) {
  const sampled =
    t >= plan.duration
      ? completeArchiveMotion(plan, poses)
      : sampleArchiveMotion(plan, t);
  for (const [id, p] of sampled)
    if (!closed.geometry.has(id))
      check(() => {
        assert.equal(p.exiting, true);
        assert.ok(p.opacity < 0.001);
        assert.ok(p.scale <= 0.301);
      });
}
const finish = completeArchiveMotion(plan, poses);
const reverse = planArchiveMotion(finish, space, g, closed);
check(() =>
  assert.equal(sampleArchiveMotion(reverse, 0).get("child0")!.opacity, 0),
);
check(() =>
  assert.deepEqual(
    sampleArchiveMotion(reverse, 1000),
    new Map([...space.geometry].map(([id, p]) => [id, archivePose(p)])),
  ),
);
for (let i = 0; i < 50; i++) {
  const creation = graph([...g.placements, card("created-" + i, "root")]);
  check(() => assert.equal(run(creation).reserves[0].members.size, 6));
  check(() =>
    assert.deepEqual(run(creation, []).geometry, run(creation, [], 0).geometry),
  );
  check(() => assert.deepEqual(run(g).geometry, space.geometry));
}
// Sob saturação, não trocar colisões físicas por uma reserva aparentemente livre.
for (const count of [100, 200, 500]) {
  const dense = graph([
    card("root", null),
    ...Array.from({ length: count - 1 }, (_, i) =>
      card(
        "p" + i,
        i < 6 ? "root" : null,
        (i % 20) * 45,
        Math.floor(i / 20) * 45,
      ),
    ),
  ]);
  const previous = run(dense, ["root"], 0),
    next = run(dense);
  if (next.diagnostics.reserveFallback)
    check(() => assert.deepEqual(next.geometry, previous.geometry));
  check(() =>
    assert.ok(
      next.diagnostics.residuals.length <=
        previous.diagnostics.residuals.length,
    ),
  );
  check(() =>
    assert.ok(
      next.diagnostics.moves <= 4000 && next.diagnostics.checks <= 750000,
    ),
  );
}
const expanded = layoutArchive(projectArchive(g, new Set(["root"])));
check(() => assert.equal(expanded.reserves[0].regions.length, 12));
for (const p of inside)
  check(() =>
    assert.deepEqual(expanded.geometry.get(p.id), old.geometry.get(p.id)),
  );
check(() =>
  assert.ok(
    expanded.geometry.get("neighbor")!.x > space.geometry.get("neighbor")!.x,
  ),
);
check(() =>
  assert.deepEqual(expanded.geometry.get("far"), space.geometry.get("far")),
);
check(() => assert.equal(expanded.diagnostics.reserveResiduals.length, 0));
check(() => assert.equal(expanded.diagnostics.reserveFallback, null));
const c = { x: 140, y: 100 };
for (let i = 0; i < 24; i++) {
  const angle = (i * Math.PI) / 12,
    p = {
      x: c.x + 900 * Math.cos(angle) - 1,
      y: c.y + 900 * Math.sin(angle) - 1,
      width: 2,
      height: 2,
    };
  check(() =>
    assert.ok(
      expanded.reserves[0].regions.some((r) => archiveIntersects(r, p, 0)),
      "Área contínua em todas as direções",
    ),
  );
}
check(() =>
  assert.deepEqual(
    layoutArchive(projectArchive(g, new Set())).geometry,
    run(g, []).geometry,
  ),
);
check(() =>
  assert.deepEqual(
    layoutArchive(projectArchive(distant, new Set(["root"]))).geometry.get(
      "middle",
    ),
    run(distant, ["root"], 0).geometry.get("middle"),
    "Ramo remoto não amplia toda a área intermediária",
  ),
);
const radialManual = archiveReserveIntent(
  expanded,
  {},
  "neighbor",
  manualGeometry,
);
check(() =>
  assert.deepEqual(
    layoutArchive(projectArchive(manualGraph, new Set(["root"])), {
      manual: radialManual,
    }).geometry.get("neighbor"),
    manualGeometry,
  ),
);
console.log(
  `Reserva e finalização: ${checks} verificações; 110 ciclos sem offsets.`,
);
