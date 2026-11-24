/** Coordenadas visuais livres. Não importa tipos, limites ou unidades do combate. */
export interface ArchiveCamera {
  x: number;
  y: number;
  zoom: number;
}
export interface ArchivePoint {
  x: number;
  y: number;
}
export interface ArchiveRect extends ArchivePoint {
  width: number;
  height: number;
}
export const cameraPoint = (
  c: ArchiveCamera,
  p: ArchivePoint,
): ArchivePoint => ({ x: (p.x - c.x) / c.zoom, y: (p.y - c.y) / c.zoom });
export function zoomArchive(
  c: ArchiveCamera,
  p: ArchivePoint,
  factor: number,
): ArchiveCamera {
  const anchor = cameraPoint(c, p);
  const zoom = Math.min(2.5, Math.max(0.15, c.zoom * factor));
  return { x: p.x - anchor.x * zoom, y: p.y - anchor.y * zoom, zoom };
}
export function fitArchive(
  rects: ArchiveRect[],
  size: { width: number; height: number },
): ArchiveCamera {
  if (!rects.length)
    return { x: size.width / 2 - 140, y: size.height / 2 - 100, zoom: 1 };
  const left = Math.min(...rects.map((r) => r.x)),
    top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width)),
    bottom = Math.max(...rects.map((r) => r.y + r.height));
  const zoom = Math.min(
    1,
    Math.max(
      0.15,
      Math.min(
        Math.max(1, size.width - 100) / (right - left),
        Math.max(1, size.height - 100) / (bottom - top),
      ),
    ),
  );
  return {
    x: size.width / 2 - ((left + right) / 2) * zoom,
    y: size.height / 2 - ((top + bottom) / 2) * zoom,
    zoom,
  };
}
/** Ancoragem na borda; linhas não passam pelo miolo do card. */
export function linkEndpoints(
  a: ArchiveRect,
  b: ArchiveRect,
): [ArchivePoint, ArchivePoint] {
  const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const edge = (r: ArchiveRect, c: ArchivePoint, t: ArchivePoint) => {
    const dx = t.x - c.x,
      dy = t.y - c.y;
    if (!dx && !dy) return { x: c.x + r.width / 2, y: c.y };
    const factor = Math.min(
      dx ? r.width / 2 / Math.abs(dx) : Infinity,
      dy ? r.height / 2 / Math.abs(dy) : Infinity,
    );
    return { x: c.x + dx * factor, y: c.y + dy * factor };
  };
  return [edge(a, ac, bc), edge(b, bc, ac)];
}
