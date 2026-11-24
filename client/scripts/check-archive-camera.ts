import assert from "node:assert/strict";
import {
  cameraPoint,
  zoomArchive,
  fitArchive,
  linkEndpoints,
} from "../src/components/archive/archiveCamera";
let checks = 0;
for (const zoom of [0.15, 0.5, 1, 2.5]) {
  const c = { x: 31, y: -72, zoom },
    p = { x: 210, y: 400 };
  const world = cameraPoint(c, p);
  const next = zoomArchive(c, p, 1.4);
  const after = cameraPoint(next, p);
  assert.ok(
    Math.abs(world.x - after.x) < 1e-8 && Math.abs(world.y - after.y) < 1e-8,
  );
  checks++;
  for (const delta of [20, -100])
    assert.equal(
      cameraPoint(c, { x: p.x + delta * zoom, y: p.y }).x - world.x,
      delta,
    );
  checks += 2;
}
const positions = [
  { x: -500, y: -300, width: 280, height: 200 },
  { x: 400, y: 200, width: 500, height: 300 },
];
const before = JSON.stringify(positions);
const fit = fitArchive(positions, { width: 1200, height: 800 });
assert.equal(JSON.stringify(positions), before);
assert.ok(fit.zoom >= 0.15 && fit.zoom <= 1);
checks += 2;
const [a, b] = linkEndpoints(positions[0], positions[1]);
assert.ok(a.x >= -500 && a.x <= -220);
assert.ok(b.x >= 400 && b.x <= 900);
checks += 2;
console.log(
  `Arquivo: ${checks} verificações puras de câmera e ancoragem passaram.`,
);
