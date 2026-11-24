import type { NarrativeGraphDto } from "../../../../src/modules/shared/narrative";
import {
  archiveLayoutTransition,
  type ArchiveGeometry,
  type ArchiveLayout,
} from "./archiveLayout";

/** Apenas apresentação: não resolve colisões nem grava posições intermediárias. */
export const ARCHIVE_MOTION = {
  entry: 420,
  exit: 320,
  neighbor: 400,
  wave: 35,
  maxDelay: 180,
  maxTotal: 650,
  maxAnimated: 160,
  maxVisible: 200,
};
export interface ArchivePose extends ArchiveGeometry {
  scale: number;
  opacity: number;
  exiting: boolean;
}
export interface ArchiveMotionPlan {
  tracks: Map<
    string,
    { from: ArchivePose; to: ArchivePose; delay: number; duration: number }
  >;
  final: Map<string, ArchivePose>;
  duration: number;
  degraded: boolean;
}
export const archivePose = (g: ArchiveGeometry): ArchivePose => ({
  ...g,
  scale: 1,
  opacity: 1,
  exiting: false,
});
export function planArchiveMotion(
  current: ReadonlyMap<string, ArchivePose>,
  next: ArchiveLayout,
  snapshot: NarrativeGraphDto,
  previous?: ArchiveLayout,
  reduced = false,
): ArchiveMotionPlan {
  const final = new Map(
    [...next.geometry].map(([id, g]) => [id, archivePose(g)]),
  );
  const transitions = archiveLayoutTransition(current, next, {
    graph: snapshot,
  });
  const changed = new Set(transitions.map((t) => t.id));
  for (const [id, p] of current)
    if (p.scale !== 1 || p.opacity !== 1 || p.exiting) changed.add(id);
  const degraded =
    changed.size > ARCHIVE_MOTION.maxAnimated ||
    next.graph.placements.length > ARCHIVE_MOTION.maxVisible ||
    current.size > ARCHIVE_MOTION.maxVisible;
  const plan: ArchiveMotionPlan = {
    tracks: new Map(),
    final,
    duration: 0,
    degraded,
  };
  if (reduced || degraded) return plan;
  const causes = new Map(
    [...(previous?.affected ?? []), ...next.affected].map((p) => [p.id, p]),
  );
  const raw = new Map(snapshot.placements.map((p) => [p.id, p]));
  const changes = new Map(transitions.map((t) => [t.id, t]));
  let entering = 0;
  for (const id of changed) {
    if (!raw.has(id)) continue;
    const t = changes.get(id),
      old = current.get(id),
      target = final.get(id);
    if (!old && !target) continue;
    const exiting = !target;
    // Procura o ancestral realmente apresentado, inclusive em recolhimentos aninhados.
    let parent = raw.get(id)?.parentPlacementId,
      core: ArchiveGeometry | undefined;
    const visited = new Set<string>();
    while (parent && !visited.has(parent)) {
      visited.add(parent);
      core = exiting ? next.geometry.get(parent) : current.get(parent);
      if (core) break;
      parent = raw.get(parent)?.parentPlacementId;
    }
    const base = target ?? old!;
    const collapsed = core
      ? {
          ...base,
          x: core.x + (core.width - base.width) / 2,
          y: core.y + (core.height - base.height) / 2,
        }
      : (t?.entryOrigin ?? t?.exitTarget ?? base);
    const from = old ?? { ...archivePose(collapsed), scale: 0.3, opacity: 0 };
    const to = target ?? {
      ...archivePose(collapsed),
      scale: 0.3,
      opacity: 0,
      exiting: true,
    };
    const cause = causes.get(id);
    const delay = exiting
      ? 0
      : !old
        ? Math.min(90, entering++ * 18)
        : Math.min(
            ARCHIVE_MOTION.maxDelay,
            (cause?.depth ?? t?.depth ?? 0) * ARCHIVE_MOTION.wave +
              Math.min(35, (cause?.distance ?? 0) / 30),
          );
    const duration = exiting
      ? ARCHIVE_MOTION.exit
      : !old || old.exiting
        ? ARCHIVE_MOTION.entry
        : ARCHIVE_MOTION.neighbor;
    plan.tracks.set(id, { from: { ...from, exiting }, to, delay, duration });
    plan.duration = Math.max(plan.duration, delay + duration);
  }
  return plan;
}
export function sampleArchiveMotion(
  plan: ArchiveMotionPlan,
  elapsed: number,
): Map<string, ArchivePose> {
  if (elapsed >= plan.duration) return new Map(plan.final);
  const poses = new Map(plan.final);
  for (const [id, t] of plan.tracks) {
    const progress = Math.max(0, Math.min(1, (elapsed - t.delay) / t.duration));
    const k = t.to.exiting
      ? progress * progress * (3 - 2 * progress)
      : 1 - Math.pow(1 - progress, 3);
    const lerp = (a: number, b: number) => a + (b - a) * k;
    poses.set(id, {
      x: lerp(t.from.x, t.to.x),
      y: lerp(t.from.y, t.to.y),
      width: lerp(t.from.width, t.to.width),
      height: lerp(t.from.height, t.to.height),
      zIndex: t.to.zIndex,
      scale: lerp(t.from.scale, t.to.scale),
      opacity: lerp(t.from.opacity, t.to.opacity),
      exiting: t.to.exiting,
    });
  }
  return poses;
}
