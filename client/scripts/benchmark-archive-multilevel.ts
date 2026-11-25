/** Baseline/candidato sob as mesmas fixtures sintéticas; nenhum banco ou HTTP. */
import { performance } from "node:perf_hooks";
import { layoutArchive } from "../src/components/archive/archiveLayout";
import { projectArchive } from "../src/components/archive/archiveProjection";
import { archiveBenchmarkFixture } from "./archive-multilevel-fixtures";
const median = (a: number[]) =>
  a.sort((a, b) => a - b)[Math.floor(a.length / 2)];
for (const count of [50, 100, 200, 500])
  for (const kind of [
    "esparso",
    "denso",
    "multinivel",
    "independente",
    "interdependente",
  ]) {
    const graph = archiveBenchmarkFixture(count, kind);
    const placements = graph.placements;
    const expanded = new Set(
      placements
        .filter((p) => placements.some((c) => c.parentPlacementId === p.id))
        .map((p) => p.id),
    );
    const projectionMs: number[] = [],
      layoutMs: number[] = [];
    let last;
    for (let run = 0; run < 9; run++) {
      let t = performance.now();
      const p = projectArchive(graph, expanded);
      const pt = performance.now() - t;
      t = performance.now();
      last = layoutArchive(p);
      const lt = performance.now() - t;
      if (run >= 2) {
        projectionMs.push(pt);
        layoutMs.push(lt);
      }
    }
    const d = last!.diagnostics;
    console.log(
      JSON.stringify({
        count,
        kind,
        projectionMs: median(projectionMs),
        layoutMs: median(layoutMs),
        checks: d.checks,
        validation: d.reserveValidationChecks,
        index: d.reserveIndexChecks ?? null,
        diagnostic: d.diagnosticChecks ?? null,
        moves: d.moves,
        affected: last!.affected.length,
        reserves: last!.reserves.length,
        components: d.reserveComponents ?? null,
        residuals: d.residuals.length,
        reserveResiduals: d.reserveResiduals.length,
        fallback: d.reserveFallback,
      }),
    );
  }
