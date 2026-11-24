/** Relógio controlado, sem DOM, HTTP, banco ou dados da campanha. */
import assert from "node:assert/strict";
import { projectArchive } from "../src/components/archive/archiveProjection";
import { layoutArchive } from "../src/components/archive/archiveLayout";
import {
  ARCHIVE_MOTION,
  archivePose,
  planArchiveMotion,
  sampleArchiveMotion,
} from "../src/components/archive/archiveMotion";
import type {
  NarrativeGraphDto,
  NarrativePlacementDto,
} from "../../src/modules/shared/narrative";
let checks = 0;
const check = (fn: () => void) => {
  fn();
  checks++;
};
const placement = (
  id: string,
  parent: string | null,
  x: number,
): NarrativePlacementDto => ({
  id,
  cardId: id,
  boardId: "test",
  parentPlacementId: parent,
  x,
  y: 0,
  width: 280,
  height: 200,
  zIndex: 0,
  card: {
    id,
    title: id,
    summary: "",
    content: "",
    category: "note",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
});
const graph: NarrativeGraphDto = {
  board: {
    id: "test",
    name: "Teste isolado",
    description: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
  placements: [
    placement("root", null, 0),
    placement("branch", "root", 0),
    placement("nested", "branch", 0),
    placement("neighbor", null, 310),
    placement("far", null, 20000),
  ],
  links: [],
};
const layout = (ids: string[]) =>
  layoutArchive(projectArchive(graph, new Set(ids)));
const closed = layout([]),
  open = layout(["root"]),
  nested = layout(["root", "branch"]);
const poses = (l: typeof open) =>
  new Map([...l.geometry].map(([id, g]) => [id, archivePose(g)]));
const plan = planArchiveMotion(poses(closed), open, graph, closed);
check(() =>
  assert.ok(plan.duration > 0 && plan.duration <= ARCHIVE_MOTION.maxTotal),
);
const first = sampleArchiveMotion(plan, 0),
  middle = sampleArchiveMotion(plan, 180),
  last = sampleArchiveMotion(plan, 1000);
check(() => {
  assert.equal(first.get("branch")!.opacity, 0);
  assert.equal(first.get("branch")!.scale, 0.3);
  assert.equal(
    first.get("branch")!.x + 140,
    closed.geometry.get("root")!.x + 140,
  );
});
check(() =>
  assert.ok(
    middle.get("branch")!.opacity > 0 && middle.get("branch")!.opacity < 1,
  ),
);
check(() => assert.deepEqual(last, poses(open)));
check(() => assert.deepEqual(last.get("far"), poses(closed).get("far")));
const collapse = planArchiveMotion(last, closed, graph, open);
check(() =>
  assert.equal(sampleArchiveMotion(collapse, 0).get("branch")!.exiting, true),
);
check(() =>
  assert.equal(sampleArchiveMotion(collapse, 1000).has("branch"), false),
);
check(() =>
  assert.deepEqual(
    sampleArchiveMotion(planArchiveMotion(middle, closed, graph, open), 0).get(
      "branch",
    )!.x,
    middle.get("branch")!.x,
  ),
);
check(() =>
  assert.deepEqual(
    sampleArchiveMotion(
      planArchiveMotion(middle, open, graph, closed, true),
      0,
    ),
    poses(open),
  ),
);
let current = poses(closed),
  previous = closed;
for (let i = 0; i < 120; i++) {
  const target = i % 2 ? closed : i % 4 ? nested : open;
  const motion = planArchiveMotion(current, target, graph, previous);
  const start = sampleArchiveMotion(motion, 0);
  for (const [id, p] of current)
    if (start.has(id))
      check(() => {
        assert.equal(start.get(id)!.x, p.x);
        assert.equal(start.get(id)!.opacity, p.opacity);
      });
  current = sampleArchiveMotion(motion, 80 + (i % 7));
  previous = target;
}
check(() =>
  assert.deepEqual(
    sampleArchiveMotion(
      planArchiveMotion(current, closed, graph, previous),
      1000,
    ),
    poses(closed),
  ),
);
for (let i = 0; i < 110; i++) {
  const out = sampleArchiveMotion(
    planArchiveMotion(poses(closed), open, graph, closed),
    700,
  );
  const back = sampleArchiveMotion(
    planArchiveMotion(out, closed, graph, open),
    700,
  );
  check(() => assert.deepEqual(back, poses(closed)));
}
for (const [id, p] of middle)
  check(() =>
    assert.ok(
      [p.x, p.y, p.width, p.height, p.scale, p.opacity].every(Number.isFinite),
      id,
    ),
  );
const personalized = {
  ...graph,
  placements: graph.placements.map((p) =>
    p.id === "branch" ? { ...p, branchOffsetX: -850, branchOffsetY: 430 } : p,
  ),
};
const customLayout = layoutArchive(
  projectArchive(personalized, new Set(["root"])),
);
check(() =>
  assert.deepEqual(
    sampleArchiveMotion(
      planArchiveMotion(poses(closed), customLayout, personalized, closed),
      700,
    ),
    poses(customLayout),
  ),
);
const removed = {
  ...graph,
  placements: graph.placements.filter(
    (p) => p.id !== "branch" && p.id !== "nested",
  ),
};
check(() =>
  assert.equal(
    planArchiveMotion(poses(open), closed, removed, open).tracks.has("branch"),
    false,
  ),
);
const many = {
  ...graph,
  placements: [
    placement("root", null, 0),
    ...Array.from({ length: 170 }, (_, i) => placement("b" + i, "root", 0)),
  ],
};
const largeClosed = layoutArchive(projectArchive(many, new Set())),
  largeOpen = layoutArchive(projectArchive(many, new Set(["root"])));
check(() => {
  const p = planArchiveMotion(poses(largeClosed), largeOpen, many, largeClosed);
  assert.equal(p.degraded, true);
  assert.equal(p.duration, 0);
  assert.deepEqual(sampleArchiveMotion(p, 0), poses(largeOpen));
});
console.log(
  `Animação: ${checks} verificações, 110 ciclos completos, 120 inversões e degradação controlada.`,
);
