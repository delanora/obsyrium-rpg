import { linkEndpoints, type ArchiveRect } from "./archiveCamera";
/** Curva única compartilhada pela pintura estática e pela transição. */
export function archiveLinkGeometry(
  a: ArchiveRect,
  b: ArchiveRect,
  ordinal: number,
  total: number,
) {
  const [from, to] = linkEndpoints(a, b);
  const offset = (ordinal - (total - 1) / 2) * 64;
  const dx = to.x - from.x,
    dy = to.y - from.y,
    len = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(100, len * 0.16) + offset;
  const mid = {
    x: (from.x + to.x) / 2 - (dy / len) * bend,
    y: (from.y + to.y) / 2 + (dx / len) * bend,
  };
  return {
    from,
    to,
    path: `M${from.x},${from.y} Q${mid.x},${mid.y} ${to.x},${to.y}`,
    labelPoint: {
      x: (from.x + 2 * mid.x + to.x) / 4,
      y: (from.y + 2 * mid.y + to.y) / 4,
    },
  };
}
