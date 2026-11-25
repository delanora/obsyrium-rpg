/** Fixtures descartáveis e puras: nenhuma API ou banco. */
import assert from "node:assert/strict";
import type {
  NarrativeGraphDto,
  NarrativePlacementDto,
} from "../../src/modules/shared/narrative";
import { projectArchive } from "../src/components/archive/archiveProjection";
import { archiveHierarchy } from "../src/components/archive/archiveHierarchy";
import {
  layoutArchive,
  captureArchiveAnchor,
  relativeGestureVisual,
  archiveOverlapArea,
  ARCHIVE_LAYOUT_CONFIG,
} from "../src/components/archive/archiveLayout";
import {
  archivePose,
  planArchiveMotion,
  sampleArchiveMotion,
  completeArchiveMotion,
} from "../src/components/archive/archiveMotion";
let checks = 0;
const check = (fn: () => void) => {
  fn();
  checks++;
};
export const place = (
  id: string,
  parent: string | null = null,
  x = 0,
  y = 0,
): NarrativePlacementDto => ({
  id,
  boardId: "test",
  cardId: id,
  parentPlacementId: parent,
  x,
  y,
  width: 280,
  height: 200,
  zIndex: 0,
  card: {
    id,
    title: id,
    category: "note",
    summary: "Fixture própria",
    content: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
});
export const graph = (
  placements: NarrativePlacementDto[],
): NarrativeGraphDto => ({
  board: {
    id: "test",
    name: "Teste",
    description: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
  placements,
  links: placements
    .filter((p) => p.parentPlacementId)
    .map((p) => ({
      id: "l" + p.id,
      sourceId: p.parentPlacementId!,
      targetId: p.id,
      relation: "related",
      directed: true,
      label: "",
      description: "",
      version: 0,
    })),
});
for (const levels of [2, 3, 5, 32, 256]) {
  const g = graph(
      Array.from({ length: levels }, (_, i) =>
        place("n" + i, i ? "n" + (i - 1) : null),
      ),
    ),
    saved = JSON.stringify(g);
  const all = new Set(g.placements.map((p) => p.id)),
    hidden = new Set(all);
  hidden.delete("n0");
  check(() =>
    assert.equal(projectArchive(g, hidden).graph.placements.length, 1),
  );
  check(() => assert.equal(projectArchive(g, hidden).graph.links.length, 0));
  check(() =>
    assert.equal(projectArchive(g, all).graph.placements.length, levels),
  );
  check(() =>
    assert.equal(
      archiveHierarchy(g.placements).depths.get("n" + (levels - 1)),
      levels - 1,
    ),
  );
  const layout = layoutArchive(projectArchive(g, all));
  check(() => assert.equal(layout.reserves.length, 1));
  check(() => assert.equal(layout.reserves[0].members.size, levels));
  check(() =>
    assert.ok(
      layout.diagnostics.checks + layout.diagnostics.reserveValidationChecks <=
        750000,
    ),
  );
  check(() => assert.equal(JSON.stringify(g), saved));
  const removed = {
    ...g,
    placements: g.placements.slice(0, -1),
    links: g.links.slice(0, -1),
  };
  check(() =>
    assert.ok(!projectArchive(removed, all).visibleIds.has("n" + (levels - 1))),
  );
}
const g = graph([
    place("root"),
    place("child", "root"),
    place("grand", "child"),
    place("leaf", "grand"),
    place("tip", "leaf"),
    place("outside", null, 760),
  ]),
  open = new Set(["root", "child", "grand", "leaf"]);
const initial = layoutArchive(projectArchive(g, open));
const child = g.placements[1],
  pin = captureArchiveAnchor(
    child,
    initial.geometry.get("child")!,
    g,
    initial.geometry,
  );
const pinned = layoutArchive(projectArchive(g, open), {
  anchors: { child: pin },
});
check(() =>
  assert.deepEqual(pinned.geometry.get("child"), initial.geometry.get("child")),
);
// Um ancestral movido no espaço visual deve transportar a âncora relativa, não fixá-la no mundo.
const moved = layoutArchive(projectArchive(g, open), {
  anchors: { root: { x: 700, y: 450, baseX: 0, baseY: 0 }, child: pin },
});
check(() =>
  assert.equal(
    moved.geometry.get("child")!.x,
    pinned.geometry.get("child")!.x + 700,
  ),
);
check(() =>
  assert.equal(
    moved.geometry.get("child")!.y,
    pinned.geometry.get("child")!.y + 450,
  ),
);
const visual = relativeGestureVisual(initial.graph, {
  root: { ...initial.geometry.get("root")!, x: 700, y: 450 },
});
check(() => assert.equal(visual.tip.x, initial.geometry.get("tip")!.x + 700));
const closed = layoutArchive(
  projectArchive(g, new Set(["child", "grand", "leaf"])),
);
check(() => assert.equal(closed.reserves.length, 0));
let poses = new Map(
  [...closed.geometry].map(([id, p]) => [id, archivePose(p)]),
);
for (let cycle = 0; cycle < 110; cycle++) {
  const entry = planArchiveMotion(poses, initial, g, closed);
  poses = sampleArchiveMotion(entry, 80);
  const exit = planArchiveMotion(poses, closed, g, initial);
  check(() =>
    assert.deepEqual(exit.tracks.get("tip")?.from.x, poses.get("tip")?.x),
  );
  poses = completeArchiveMotion(exit, poses);
  const reopen = planArchiveMotion(poses, initial, g, closed);
  poses = completeArchiveMotion(reopen, poses);
  check(() =>
    assert.deepEqual(
      new Map(
        [...poses]
          .filter(([id]) => initial.geometry.has(id))
          .map(([id, p]) => [id, { x: p.x, y: p.y }]),
      ),
      new Map([...initial.geometry].map(([id, p]) => [id, { x: p.x, y: p.y }])),
    ),
  );
  poses = completeArchiveMotion(
    planArchiveMotion(poses, closed, g, initial),
    poses,
  );
  check(() =>
    assert.equal(layoutArchive(projectArchive(g, open)).reserves.length, 1),
  );
}
// Veto localizado: A denso, B distante e livre. Mesma fixture também prova segurança conjunta.
const dense = Array.from({ length: 100 }, (_, i) =>
  place(
    "a" + i,
    i > 0 && i < 7 ? "a0" : null,
    (i % 20) * 45,
    Math.floor(i / 20) * 45,
  ),
);
const composite = graph([
  ...dense,
  place("b0", null, 20000),
  ...Array.from({ length: 4 }, (_, i) => place("b" + (i + 1), "b0", 20000)),
  place("b-neighbor", null, 20760),
]);
const project = projectArchive(composite, new Set(["a0", "b0"])),
  physical = layoutArchive(project, { config: { reserveMargin: 0 } }),
  result = layoutArchive(project);
check(() => {
  assert.ok(result.diagnostics.reserveComponents?.accepted);
  assert.ok(result.diagnostics.reserveComponents?.rejected);
});
check(() =>
  assert.ok(
    result.geometry.get("b-neighbor")!.x >
      physical.geometry.get("b-neighbor")!.x,
  ),
);
check(() =>
  assert.ok(
    !result.diagnostics.reserveResiduals.some(
      (r) => r.sourceId === "b0" && !r.protected,
    ),
  ),
);
check(() => {
  const ids = [...result.geometry.keys()];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i],
        b = ids[j];
      const before = archiveOverlapArea(
        physical.geometry.get(a)!,
        physical.geometry.get(b)!,
      );
      const raw = archiveOverlapArea(
        composite.placements.find((p) => p.id === a)!,
        composite.placements.find((p) => p.id === b)!,
      );
      assert.ok(
        archiveOverlapArea(result.geometry.get(a)!, result.geometry.get(b)!) <=
          Math.max(before, raw) + 1e-7,
      );
    }
});
check(() => assert.deepEqual(layoutArchive(project).geometry, result.geometry));
check(() => assert.equal(ARCHIVE_LAYOUT_CONFIG.reserveMargin, 1120));
console.log(
  `Multinível: ${checks} verificações, 110 ciclos, cadeia de 256 níveis e veto localizado seguro.`,
);
// Misto, ramo remoto e atualização autoritativa invalidando a âncora anterior.
const customized = structuredClone(g);
customized.placements[2].branchOffsetX = 9000;
customized.placements[2].branchOffsetY = -9000;
const customLayout = layoutArchive(projectArchive(customized, open));
check(() =>
  assert.equal(
    customLayout.geometry.get("grand")!.x +
      140 -
      customLayout.geometry.get("child")!.x -
      140,
    9000,
  ),
);
check(() => assert.equal(customized.placements[2].branchOffsetX, 9000));
const altered = structuredClone(g);
altered.placements[0].x = 500;
check(() =>
  assert.notEqual(
    layoutArchive(projectArchive(altered, open), {
      anchors: { child: pin },
    }).geometry.get("child")!.x,
    initial.geometry.get("child")!.x,
  ),
);
const promoted = structuredClone(g);
promoted.placements[1].parentPlacementId = null;
check(() =>
  assert.ok(projectArchive(promoted, new Set()).visibleIds.has("child")),
);
const invalid = graph([place("bad"), place("bad-child", "bad")]);
invalid.placements[0].x = NaN;
invalid.placements[1].width = Infinity;
check(() => {
  for (const geom of layoutArchive(
    projectArchive(invalid, new Set(["bad"])),
  ).geometry.values())
    assert.ok([geom.x, geom.y, geom.width, geom.height].every(Number.isFinite));
});
const limited = layoutArchive(project, { config: { maxChecks: 20 } });
check(() =>
  assert.ok(
    limited.diagnostics.checks + limited.diagnostics.reserveValidationChecks <=
      20,
  ),
);
check(() => assert.equal(limited.diagnostics.reserveFallback, "budget"));
const interacting = structuredClone(composite);
for (const p of interacting.placements) if (p.id.startsWith("b")) p.x -= 17600;
const interactingProjection = projectArchive(
  interacting,
  new Set(["a0", "b0"]),
);
const interaction = layoutArchive(interactingProjection),
  safe = layoutArchive(interactingProjection, { config: { reserveMargin: 0 } });
check(() => {
  const ids = [...interaction.geometry.keys()];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i],
        b = ids[j];
      assert.ok(
        archiveOverlapArea(
          interaction.geometry.get(a)!,
          interaction.geometry.get(b)!,
        ) <=
          Math.max(
            archiveOverlapArea(safe.geometry.get(a)!, safe.geometry.get(b)!),
            archiveOverlapArea(
              interacting.placements.find((p) => p.id === a)!,
              interacting.placements.find((p) => p.id === b)!,
            ),
          ) +
            1e-7,
      );
    }
});
console.log(
  `Complementos multinível: ${checks} verificações totais; personalização, promoção, extremos defensivos, orçamento e interação.`,
);
const ancestorMoved = layoutArchive(projectArchive(altered, open), {
  anchors: { child: pin },
});
check(() =>
  assert.equal(
    ancestorMoved.geometry.get("child")!.x,
    initial.geometry.get("child")!.x + 500,
  ),
);
const ancestorSized = structuredClone(g);
ancestorSized.placements[0].width += 100;
const sized = layoutArchive(projectArchive(ancestorSized, open), {
  anchors: { child: pin },
});
check(() =>
  assert.equal(
    sized.geometry.get("child")!.x,
    initial.geometry.get("child")!.x + 50,
  ),
);
console.log(`Total final multinível: ${checks}.`);
