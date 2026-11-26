import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { NarrativeGraphDto } from "../../../../src/modules/shared/narrative";
import type { ArchiveGeometry, ArchiveLayout } from "./archiveLayout";
import {
  ARCHIVE_MOTION,
  archivePose,
  completeArchiveMotion,
  planArchiveMotion,
  sampleArchiveMotion,
  type ArchivePose,
  type ArchiveMotionPlan,
} from "./archiveMotion";
import {
  archiveLinkRouteGeometry,
  type ArchiveRoutePlanSet,
} from "./archiveLinkRouting";

export interface ArchivePresentation {
  geometry: (id: string) => ArchiveGeometry | undefined;
  pause: () => void;
  resume: () => void;
}
/** Um RAF por canvas; nenhum render React, medição DOM ou layout espacial por frame. */
export function useArchiveMotion(
  container: RefObject<HTMLDivElement | null>,
  graph: NarrativeGraphDto,
  layout: ArchiveLayout | undefined,
  snapshot: NarrativeGraphDto | undefined,
  visual: Record<string, ArchiveGeometry>,
  presentation?: RefObject<ArchivePresentation | null>,
  routes?: RefObject<ArchiveRoutePlanSet | null>,
) {
  const [revision, update] = useState(0);
  const runtime = useRef({
    poses: new Map<string, ArchivePose>(),
    layout: undefined as ArchiveLayout | undefined,
    snapshot: undefined as NarrativeGraphDto | undefined,
    retained: graph,
    plan: null as ArchiveMotionPlan | null,
    start: 0,
    raf: 0,
    paused: false,
    reduced: false,
    disposed: false,
  });
  const latest = useRef({ graph, layout, snapshot, visual });
  latest.current = { graph, layout, snapshot, visual };
  const r = runtime.current;
  const rendering = useMemo(() => {
    if (
      !layout ||
      !snapshot ||
      r.reduced ||
      graph.placements.length > ARCHIVE_MOTION.maxVisible ||
      r.poses.size > ARCHIVE_MOTION.maxVisible ||
      (r.snapshot && r.snapshot !== snapshot)
    )
      return graph;
    const ids = new Set(graph.placements.map((p) => p.id));
    const valid = new Set(snapshot.placements.map((p) => p.id));
    const outgoing = r.retained.placements.filter(
      (p) => !ids.has(p.id) && valid.has(p.id) && r.poses.has(p.id),
    );
    const placements = [...graph.placements, ...outgoing];
    const cards = new Set(placements.map((p) => p.cardId));
    const validLinks = new Set(snapshot.links.map((l) => l.id));
    const links = new Map(
      [...r.retained.links, ...graph.links]
        .filter(
          (l) =>
            cards.has(l.sourceId) &&
            cards.has(l.targetId) &&
            validLinks.has(l.id),
        )
        .map((l) => [l.id, l]),
    );
    return { ...graph, placements, links: [...links.values()] };
  }, [graph, layout, snapshot, revision]);
  const paintRef = useRef<() => void>(() => {});
  const stop = () => {
    cancelAnimationFrame(r.raf);
    r.raf = 0;
  };
  const tick = (now: number) => {
    if (!r.plan || r.paused || r.disposed) return;
    const done = now - r.start >= r.plan.duration;
    r.poses = done
      ? completeArchiveMotion(r.plan, r.poses)
      : sampleArchiveMotion(r.plan, now - r.start);
    if (done) r.plan = null;
    paintRef.current();
    if (done) {
      const outgoing = r.retained.placements.some(
        (p) => r.poses.get(p.id)?.exiting || !r.poses.has(p.id),
      );
      r.retained = latest.current.graph;
      if (outgoing) update((n) => n + 1);
    } else r.raf = requestAnimationFrame(tick);
  };
  const begin = (paint = true) => {
    const c = latest.current;
    if (!c.layout || !c.snapshot || r.disposed) return;
    stop();
    r.plan = planArchiveMotion(
      r.poses,
      c.layout,
      c.snapshot,
      r.layout,
      r.reduced,
    );
    r.start = performance.now();
    r.poses = r.plan.duration
      ? sampleArchiveMotion(r.plan, 0)
      : completeArchiveMotion(r.plan, r.poses);
    if (r.plan.duration) {
      if (paint) paintRef.current();
      r.raf = requestAnimationFrame(tick);
    } else {
      r.plan = null;
      const outgoing = r.retained.placements.some(
        (p) => r.poses.get(p.id)?.exiting || !r.poses.has(p.id),
      );
      r.retained = c.graph;
      if (paint) paintRef.current();
      if (outgoing) update((n) => n + 1);
    }
  };
  useLayoutEffect(() => {
    if (!layout || !snapshot) return;
    if (!r.layout || r.snapshot !== snapshot) {
      stop();
      r.plan = null;
      r.paused = false;
      r.poses = new Map(
        [...layout.geometry].map(([id, g]) => [id, archivePose(g)]),
      );
      r.retained = graph;
    } else if (r.layout !== layout) begin(false);
    r.layout = layout;
    r.snapshot = snapshot;
    // A pintura ocorre abaixo, depois de coletar as referências deste commit.
  }, [layout, snapshot]);
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const elements = new Map(
      [...root.querySelectorAll<HTMLElement>("[data-placement]")].map((el) => [
        el.dataset.placement!,
        el,
      ]),
    );
    const linkById = new Map(rendering.links.map((l) => [l.id, l]));
    const links = [...root.querySelectorAll<SVGGElement>("[data-link]")].map(
      (el) => {
        const link = linkById.get(el.dataset.link!)!;
        const label = el.querySelector<SVGGElement>(".archive-relation-label");
        return {
          el,
          link,
          label,
          paths: [
            ...el.querySelectorAll<SVGPathElement>(
              "path.archive-link, path.archive-link-sheath, path.archive-link-hit",
            ),
          ],
          sockets: [
            ...el.querySelectorAll<SVGCircleElement>("[data-link-end]"),
          ].map((circle) => ({
            circle,
            at: circle.dataset.linkEnd === "end" ? ("end" as const) : ("start" as const),
          })),
          hits: [
            ...el.querySelectorAll<SVGElement>("path,rect,text,foreignObject"),
          ],
        };
      },
    );
    const lastCards = new Map<string, string>();
    const lastPaths = new Map<string, string>();
    paintRef.current = () => {
      const rects = new Map<string, ArchivePose>();
      for (const p of rendering.placements) {
        const pose = latest.current.visual[p.id]
          ? archivePose(latest.current.visual[p.id])
          : (r.poses.get(p.id) ?? archivePose(p));
        const el = elements.get(p.id);
        if (!el || !el.isConnected) continue;
        // O DOM já recebeu a base React atual, mesmo se outro layout effect mudou a pose.
        const base = {
          x: Number(el.dataset.baseX),
          y: Number(el.dataset.baseY),
          width: Number(el.dataset.baseWidth),
          height: Number(el.dataset.baseHeight),
        };
        const signature = `${base.x},${base.y},${base.width},${base.height},${pose.width},${pose.height},${pose.x},${pose.y},${pose.scale},${pose.opacity},${pose.exiting},${Boolean(r.plan?.tracks.has(p.id))}`;
        if (lastCards.get(p.id) !== signature) {
          lastCards.set(p.id, signature);
          el.style.transform = `translate3d(${pose.x - base.x}px,${pose.y - base.y}px,0) scale(${pose.scale})`;
          el.style.transformOrigin = "center";
          el.style.opacity = String(pose.opacity);
          const inactive =
            pose.exiting || pose.scale < 0.999 || pose.opacity < 0.999;
          el.inert = inactive;
          el.style.pointerEvents = inactive ? "none" : "";
          if (inactive) el.setAttribute("aria-hidden", "true");
          else el.removeAttribute("aria-hidden");
          el.dataset.motion = pose.exiting
            ? "exit"
            : inactive
              ? "entry"
              : r.plan?.tracks.has(p.id)
                ? "move"
                : "rest";
        }
        rects.set(p.cardId, {
          ...pose,
          x: pose.x + (pose.width * (1 - pose.scale)) / 2,
          y: pose.y + (pose.height * (1 - pose.scale)) / 2,
          width: pose.width * pose.scale,
          height: pose.height * pose.scale,
        });
      }
      for (const { el, link, label, paths, sockets, hits } of links) {
        const a = rects.get(link.sourceId),
          b = rects.get(link.targetId);
        if (!a || !b) continue;
        // Mesmo plano do React: a animação só adapta as pontas.
        const geometry = archiveLinkRouteGeometry(
          routes?.current?.routes.get(link.id),
          a,
          b,
        );
        const originKey = `:${label?.dataset.originX}:${label?.dataset.originY}`;
        if (
          lastPaths.get(link.id) ===
          geometry.path +
            originKey +
            ":" +
            a.opacity +
            ":" +
            b.opacity +
            ":" +
            a.exiting +
            ":" +
            b.exiting
        )
          continue;
        lastPaths.set(
          link.id,
          geometry.path +
            originKey +
            ":" +
            a.opacity +
            ":" +
            b.opacity +
            ":" +
            a.exiting +
            ":" +
            b.exiting,
        );
        for (const path of paths) path.setAttribute("d", geometry.path);
        // Encaixes acompanham as pontas sem tocar na geometria da curva.
        for (const socket of sockets) {
          const point = socket.at === "end" ? geometry.to : geometry.from;
          socket.circle.setAttribute("cx", String(point.x));
          socket.circle.setAttribute("cy", String(point.y));
        }
        // O rótulo inteiro, incluindo a área clicável, compartilha o deslocamento.
        if (label) {
          const x = Number(label.dataset.originX),
            y = Number(label.dataset.originY);
          label.setAttribute(
            "transform",
            `translate(${geometry.labelPoint.x - x} ${geometry.labelPoint.y - y})`,
          );
        }
        el.style.opacity = String(Math.min(a.opacity, b.opacity));
        const inactive =
          a.exiting || b.exiting || a.opacity < 0.999 || b.opacity < 0.999;
        el.style.pointerEvents = inactive ? "none" : "";
        for (const child of hits)
          child.style.pointerEvents = inactive ? "none" : "";
        for (const path of paths)
          if (path.hasAttribute("tabindex"))
            path.setAttribute("tabindex", inactive ? "-1" : "0");
        if (inactive) el.setAttribute("aria-hidden", "true");
        else el.removeAttribute("aria-hidden");
      }
    };
    const mounted = new Set(rendering.placements.map((p) => p.id));
    for (const id of r.poses.keys()) if (!mounted.has(id)) r.poses.delete(id);
    r.retained = rendering;
    paintRef.current();
  }, [rendering, visual]);
  useLayoutEffect(() => {
    r.disposed = false;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      r.reduced = media.matches;
      if (r.reduced && r.plan) {
        stop();
        r.poses = completeArchiveMotion(r.plan, r.poses);
        r.plan = null;
        r.retained = latest.current.graph;
        paintRef.current();
        update((n) => n + 1);
      }
    };
    change();
    media.addEventListener("change", change);
    return () => {
      r.disposed = true;
      stop();
      media.removeEventListener("change", change);
    };
  }, []);
  if (presentation)
    presentation.current = {
      geometry: (id) =>
        latest.current.visual[id] ??
        r.poses.get(id) ??
        latest.current.layout?.geometry.get(id),
      pause: () => {
        stop();
        r.paused = true;
      },
      resume: () => {
        if (!r.paused) return;
        r.paused = false;
        begin();
      },
    };
  return {
    graph: rendering,
    pause: () => {
      stop();
      r.paused = true;
    },
    resume: () => {
      if (r.paused) {
        r.paused = false;
        begin();
      }
    },
    geometry: (id: string) => latest.current.visual[id] ?? r.poses.get(id),
  };
}
