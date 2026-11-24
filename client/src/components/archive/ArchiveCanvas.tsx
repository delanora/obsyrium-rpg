import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Icon, type IconName } from "../Icon";
import {
  ArchiveCategoryIcon,
  archiveCategoryStyle,
} from "./ArchiveCategoryIcon";
import type {
  NarrativeGraphDto,
  NarrativePlacementDto,
  NarrativeCategory,
} from "../../../../src/modules/shared/narrative";
import {
  NARRATIVE_CATEGORY_LABELS,
  NARRATIVE_RELATION_LABELS,
} from "../../../../src/modules/shared/narrative";
import type { ArchiveNodeProjection } from "./archiveProjection";
import { ArchiveRelationLabel } from "./ArchiveRelationLabel";
import {
  cameraPoint,
  linkEndpoints,
  zoomArchive,
  type ArchiveCamera,
} from "./archiveCamera";
export const CATEGORY_ICONS: Record<NarrativeCategory, IconName> = {
  region: "earth",
  locality: "home",
  dungeon: "skull",
  room: "table",
  npc: "users",
  creature: "dragon",
  item: "bag",
  faction: "flag",
  event: "bolt",
  scene: "eye",
  encounter: "sword",
  trap: "gear",
  clue: "search",
  sound: "music",
  image: "sun",
  note: "quill",
};
export type ArchiveSelection = { kind: "card" | "link"; id: string } | null;
export type Geometry = Pick<
  NarrativePlacementDto,
  "x" | "y" | "width" | "height" | "zIndex"
>;
interface Props {
  nodes?: Map<string, ArchiveNodeProjection>;
  onToggle?: (id: string) => void;
  graph: NarrativeGraphDto;
  camera: ArchiveCamera;
  onCamera: (c: ArchiveCamera) => void;
  selected: ArchiveSelection;
  onSelect: (s: ArchiveSelection) => void;
  onMenu: (
    point: { x: number; y: number },
    selection: ArchiveSelection,
  ) => void;
  visual: Record<string, Geometry>;
  onVisual: (v: Record<string, Geometry>) => void;
  onMove: (
    id: string,
    g: Geometry,
    mode: "move" | "resize",
    start: Geometry,
  ) => void;
  onConnect: (from: string, to: string) => void;
  busy: boolean;
  onInteraction: (active: boolean) => void;
}
interface Gesture {
  pointer: number;
  x: number;
  y: number;
  mode: "pan" | "move" | "resize" | "connect";
  placement?: NarrativePlacementDto;
  geometry?: Geometry;
  currentGeometry?: Geometry;
  camera: ArchiveCamera;
  moved: boolean;
  edge?: string;
}
/** O memo evita recalcular relações/títulos quando apenas a câmera se move. */
const GraphContent = memo(function GraphContent({
  nodes,
  onToggle,
  graph,
  visual,
  selected,
  onStart,
  onSelect,
  onMenu,
  temporary,
}: {
  nodes?: Map<string, ArchiveNodeProjection>;
  onToggle?: (id: string) => void;
  graph: NarrativeGraphDto;
  visual: Record<string, Geometry>;
  selected: ArchiveSelection;
  onStart: (
    e: PointerEvent,
    mode: Gesture["mode"],
    p: NarrativePlacementDto,
    edge?: string,
  ) => void;
  onSelect: (s: ArchiveSelection) => void;
  onMenu: (
    point: { x: number; y: number },
    selection: ArchiveSelection,
  ) => void;
  temporary: { from: string; point: { x: number; y: number } } | null;
}) {
  const places = useMemo(
    () => graph.placements.map((p) => ({ ...p, ...visual[p.id] })),
    [graph.placements, visual],
  );
  const byCard = useMemo(
    () => new Map(places.map((p) => [p.cardId, p])),
    [places],
  );
  const pairs = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const l of graph.links) {
      const key = [l.sourceId, l.targetId].sort().join(":");
      groups.set(key, [...(groups.get(key) ?? []), l.id]);
    }
    return groups;
  }, [graph.links]);
  const related = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of graph.links) {
      for (const [a, b] of [
        [link.sourceId, link.targetId],
        [link.targetId, link.sourceId],
      ]) {
        const title = byCard.get(b)?.card.title;
        if (title) map.set(a, [...(map.get(a) ?? []), title]);
      }
    }
    return map;
  }, [graph.links, byCard]);
  return (
    <>
      <svg className="archive-lines" aria-label="Conexões narrativas">
        <defs>
          <marker
            id="archive-arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M0 0 10 5 0 10Z" />
          </marker>
        </defs>
        {graph.links.map((link) => {
          const a = byCard.get(link.sourceId),
            b = byCard.get(link.targetId);
          if (!a || !b) return null;
          const [from, to] = linkEndpoints(a, b);
          const same = pairs.get(
            [link.sourceId, link.targetId].sort().join(":"),
          )!;
          const ordinal = same.indexOf(link.id);
          const offset = (ordinal - (same.length - 1) / 2) * 64;
          const dx = to.x - from.x,
            dy = to.y - from.y,
            len = Math.max(1, Math.hypot(dx, dy));
          const bend = Math.min(100, len * 0.16) + offset;
          const mid = {
            x: (from.x + to.x) / 2 - (dy / len) * bend,
            y: (from.y + to.y) / 2 + (dx / len) * bend,
          };
          const path = `M${from.x},${from.y} Q${mid.x},${mid.y} ${to.x},${to.y}`;
          const label = link.label || NARRATIVE_RELATION_LABELS[link.relation];
          const labelPoint = {
            x: (from.x + 2 * mid.x + to.x) / 4,
            y: (from.y + 2 * mid.y + to.y) / 4,
          };
          return (
            <g
              key={link.id}
              data-link={link.id}
              className={selected?.id === link.id ? "is-selected" : ""}
            >
              <path
                className="archive-link"
                d={path}
                markerEnd={link.directed ? "url(#archive-arrow)" : undefined}
              />
              <path
                className="archive-link-hit"
                d={path}
                role="button"
                tabIndex={0}
                aria-label={`${a.card.title} — ${label} — ${b.card.title}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect({ kind: "link", id: link.id });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect({ kind: "link", id: link.id });
                  }
                }}
              />
              <ArchiveRelationLabel
                label={label}
                point={labelPoint}
                onSelect={() => onSelect({ kind: "link", id: link.id })}
              />
            </g>
          );
        })}
        {temporary && byCard.has(temporary.from)
          ? (() => {
              const a = byCard.get(temporary.from)!;
              return (
                <line
                  className="archive-link is-temporary"
                  x1={a.x + a.width / 2}
                  y1={a.y + a.height / 2}
                  x2={temporary.point.x}
                  y2={temporary.point.y}
                />
              );
            })()
          : null}
      </svg>
      {places.map((p) => {
        const titles = related.get(p.cardId) ?? [];
        const info = nodes?.get(p.id);
        const compact = p.width < 230 || p.height < 160;
        return (
          <article
            key={p.id}
            data-placement={p.id}
            data-card={p.cardId}
            data-category={p.card.category}
            data-compact={compact || undefined}
            data-tiny={p.height < 148 || undefined}
            className={`archive-card${selected?.id === p.id ? " is-selected" : ""}`}
            style={{
              ...archiveCategoryStyle(p.card.category),
              left: p.x,
              top: p.y,
              width: p.width,
              height: p.height,
              zIndex: p.zIndex + 1 + (selected?.id === p.id ? 1000001 : 0),
            }}
            aria-label={p.card.title}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <header
              onPointerDown={(e) => onStart(e, "move", p)}
              onDoubleClick={(event) =>
                onMenu(
                  { x: event.clientX, y: event.clientY },
                  { kind: "card", id: p.id },
                )
              }
            >
              <ArchiveCategoryIcon category={p.card.category} />
              <span>
                <small>
                  {NARRATIVE_CATEGORY_LABELS[p.card.category] ??
                    "Card narrativo"}
                </small>
                <strong>{p.card.title}</strong>
              </span>
            </header>
            <div
              className="archive-card-copy"
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelect({ kind: "card", id: p.id });
              }}
            >
              <p>{p.card.summary || "Sem resumo."}</p>
              {!compact && titles.length > 0 ? (
                <ul>
                  {titles
                    .slice(0, Math.max(1, Math.floor((p.height - 150) / 22)))
                    .map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                </ul>
              ) : null}
            </div>
            <footer>
              <span>{info?.relationCount ?? titles.length} conexões</span>
              {info?.children.length ? (
                <button
                  type="button"
                  className="archive-branch-toggle"
                  aria-label={`${info.expanded ? "Recolher" : "Expandir"} ramificações de ${p.card.title}`}
                  aria-expanded={info.expanded}
                  disabled={!onToggle}
                  title={`${info.children.length} ramificações diretas; ${info.hiddenLinks} vínculos ocultos`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle?.(p.id);
                  }}
                >
                  {info.expanded ? "−" : "+"} {info.children.length}
                </button>
              ) : null}
              {info?.hiddenLinks ? (
                <small
                  className="archive-hidden-links"
                  aria-label={`${info.hiddenLinks} vínculos ocultos`}
                >
                  ↗ {info.hiddenLinks}
                </small>
              ) : null}
              <button
                type="button"
                aria-label={`Ações de ${p.card.title}`}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  onMenu(
                    { x: rect.left + rect.width / 2, y: rect.top },
                    { kind: "card", id: p.id },
                  );
                }}
              >
                <Icon name="gear" size={14} />
              </button>
            </footer>
            <button
              type="button"
              className="archive-port"
              aria-label={`Conectar ${p.card.title}`}
              onPointerDown={(e) => onStart(e, "connect", p)}
            >
              +
            </button>
            {["n", "s", "e", "w", "ne", "nw", "se", "sw"].map((edge) => (
              <div
                key={edge}
                className={`archive-resize edge-${edge}`}
                onPointerDown={(e) => onStart(e, "resize", p, edge)}
                aria-hidden="true"
              />
            ))}
          </article>
        );
      })}
    </>
  );
});
export function ArchiveCanvas({
  nodes,
  onToggle,
  graph,
  camera,
  onCamera,
  selected,
  onSelect,
  onMenu,
  visual,
  onVisual,
  onMove,
  onConnect,
  busy,
  onInteraction,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [temporary, setTemporary] = useState<{
    from: string;
    point: { x: number; y: number };
  } | null>(null);
  const state = useRef({
    camera,
    onCamera,
    visual,
    onVisual,
    onMove,
    onConnect,
    busy,
    onSelect,
    onInteraction,
  });
  state.current = {
    camera,
    onCamera,
    visual,
    onVisual,
    onMove,
    onConnect,
    busy,
    onSelect,
    onInteraction,
  };
  const cancel = () => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    state.current.onInteraction(false);
    if (g.mode !== "pan") state.current.onVisual({});
    setTemporary(null);
    if (viewport.current?.hasPointerCapture(g.pointer))
      viewport.current.releasePointerCapture(g.pointer);
  };
  useLayoutEffect(() => {
    const active = gesture.current?.placement;
    if (active && !graph.placements.some((p) => p.id === active.id)) cancel();
  }, [graph.placements]);
  useEffect(() => {
    const stop = () => cancel();
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("blur", stop);
    window.addEventListener("keydown", esc);
    return () => {
      stop();
      window.removeEventListener("blur", stop);
      window.removeEventListener("keydown", esc);
    };
  }, []);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || gesture.current) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      state.current.onCamera(
        zoomArchive(
          state.current.camera,
          { x: e.clientX - r.left, y: e.clientY - r.top },
          Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.04 : 0.0015)),
        ),
      );
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const start = useCallback(
    (
      e: PointerEvent,
      mode: Gesture["mode"],
      p?: NarrativePlacementDto,
      edge?: string,
    ) => {
      const { camera, busy, onSelect } = state.current;
      if (e.button !== 0 || gesture.current || (busy && mode !== "pan")) return;
      e.stopPropagation();
      e.preventDefault();
      if (p) onSelect({ kind: "card", id: p.id });
      else onSelect(null);
      state.current.onInteraction(true);
      gesture.current = {
        pointer: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        mode,
        placement: p,
        geometry: p
          ? {
              x: p.x,
              y: p.y,
              width: p.width,
              height: p.height,
              zIndex: p.zIndex,
            }
          : undefined,
        camera: { ...camera },
        moved: false,
        edge,
      };
      viewport.current?.setPointerCapture(e.pointerId);
      if (mode === "connect" && p) {
        const r = viewport.current!.getBoundingClientRect();
        setTemporary({
          from: p.cardId,
          point: cameraPoint(camera, {
            x: e.clientX - r.left,
            y: e.clientY - r.top,
          }),
        });
      }
    },
    [],
  );
  return (
    <div
      ref={viewport}
      className="archive-viewport"
      tabIndex={0}
      aria-label="Quadro narrativo. Arraste o fundo para navegar e use a roda para ampliar."
      onContextMenu={(event) => {
        event.preventDefault();
        cancel();
        if (busy) return;
        const target = event.target instanceof Element ? event.target : null;
        const cardId =
          target?.closest<HTMLElement>("[data-placement]")?.dataset.placement;
        const linkId = target
          ?.closest<SVGElement>("[data-link]")
          ?.getAttribute("data-link");
        onMenu(
          { x: event.clientX, y: event.clientY },
          cardId
            ? { kind: "card", id: cardId }
            : linkId
              ? { kind: "link", id: linkId }
              : null,
        );
      }}
      onKeyDown={(event) => {
        if (
          event.key !== "ContextMenu" &&
          !(event.shiftKey && event.key === "F10")
        )
          return;
        event.preventDefault();
        const target = event.target instanceof Element ? event.target : null;
        const card = target?.closest<HTMLElement>("[data-placement]");
        const link = target
          ?.closest<SVGElement>("[data-link]")
          ?.getAttribute("data-link");
        const rect = (card ?? event.currentTarget).getBoundingClientRect();
        onMenu(
          { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          card
            ? { kind: "card", id: card.dataset.placement! }
            : link
              ? { kind: "link", id: link }
              : selected,
        );
      }}
      onPointerDown={(e) => start(e, "pan")}
      onPointerCancel={cancel}
      onLostPointerCapture={() => {
        if (gesture.current) cancel();
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (!g || g.pointer !== e.pointerId) return;
        const dx = (e.clientX - g.x) / g.camera.zoom,
          dy = (e.clientY - g.y) / g.camera.zoom;
        g.moved ||= Math.abs(dx) + Math.abs(dy) > 2;
        if (g.mode === "pan")
          onCamera({
            ...g.camera,
            x: g.camera.x + e.clientX - g.x,
            y: g.camera.y + e.clientY - g.y,
          });
        else if (g.mode === "connect") {
          const r = e.currentTarget.getBoundingClientRect();
          setTemporary({
            from: g.placement!.cardId,
            point: cameraPoint(camera, {
              x: e.clientX - r.left,
              y: e.clientY - r.top,
            }),
          });
        } else if (g.geometry && g.placement) {
          const base = g.geometry;
          let next: Geometry = { ...base };
          if (g.mode === "move") {
            next.x = Math.max(-1e6, Math.min(1e6, base.x + dx));
            next.y = Math.max(-1e6, Math.min(1e6, base.y + dy));
          } else {
            const edge = g.edge!;
            if (edge.includes("e"))
              next.width = Math.max(180, Math.min(1600, base.width + dx));
            if (edge.includes("s"))
              next.height = Math.max(120, Math.min(1600, base.height + dy));
            if (edge.includes("w")) {
              next.width = Math.max(180, Math.min(1600, base.width - dx));
              next.x = base.x + base.width - next.width;
            }
            if (edge.includes("n")) {
              next.height = Math.max(120, Math.min(1600, base.height - dy));
              next.y = base.y + base.height - next.height;
            }
          }
          g.currentGeometry = next;
          onVisual({ [g.placement.id]: next });
        }
      }}
      onPointerUp={(e) => {
        const g = gesture.current;
        if (!g || g.pointer !== e.pointerId) return;
        gesture.current = null;
        state.current.onInteraction(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (g.mode === "connect") {
          const target = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest<HTMLElement>("[data-card]")?.dataset.card;
          if (target && target !== g.placement!.cardId)
            onConnect(g.placement!.cardId, target);
          setTemporary(null);
        } else if (
          (g.mode === "move" || g.mode === "resize") &&
          g.moved &&
          g.placement
        ) {
          const next =
            g.currentGeometry ?? state.current.visual[g.placement.id];
          if (next) onMove(g.placement.id, next, g.mode, g.geometry!);
        }
      }}
    >
      <div
        className="archive-world"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
        }}
      >
        <GraphContent
          nodes={nodes}
          onToggle={busy ? undefined : onToggle}
          graph={graph}
          visual={visual}
          selected={selected}
          onStart={start}
          onSelect={onSelect}
          onMenu={onMenu}
          temporary={temporary}
        />
      </div>
      {!graph.placements.length ? (
        <div className="archive-empty">
          Seu quadro está livre.
          <br />
          Crie um card ou adicione um card do Arquivo.
        </div>
      ) : null}
    </div>
  );
}
