import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
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
  NARRATIVE_RELATIONS,
} from "../../../../src/modules/shared/narrative";
import type { ArchiveNodeProjection } from "./archiveProjection";
import { ArchiveBackground } from "./ArchiveBackground";
import { ArchiveRelationLabel } from "./ArchiveRelationLabel";
import { cameraPoint, zoomArchive, type ArchiveCamera } from "./archiveCamera";
import { useArchiveMotion, type ArchivePresentation } from "./useArchiveMotion";
import {
  archiveFilterKind,
  type ArchiveFilterPresentation,
} from "./archiveFilters";
import type { ArchiveLayout } from "./archiveLayout";
import {
  archiveRelationLabelSignature,
  archiveRelationMeasuredWidths,
  onArchiveRelationLabelWidthsChange,
} from "./archiveRelationMetrics";
import {
  archiveLinkRouteGeometry,
  archiveRouteSignature,
  provisionalArchiveRoutePlan,
  type ArchiveRoutePlanSet,
} from "./archiveLinkRouting";
import {
  ArchiveRoutePlanner,
  archiveRouteApplyPolicy,
  type ArchiveRouteWorkerFactory,
} from "./archiveRoutePlanner";
import {
  ARCHIVE_RELATION_MARKERS,
  ARCHIVE_RELATION_VISUALS,
  archiveRelationMarkerId,
  archiveRelationStyle,
  archiveRelationVisual,
} from "./archiveRelationStyle";
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
  layout?: ArchiveLayout;
  snapshot?: NarrativeGraphDto;
  presentation?: RefObject<ArchivePresentation | null>;
  nodes?: Map<string, ArchiveNodeProjection>;
  filter?: ArchiveFilterPresentation;
  onToggle?: (id: string) => void;
  onConsult?: (id: string, pointer?: boolean) => void;
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
  /** Fábrica do worker; só os fixtures instrumentados substituem. */
  routeWorker?: ArchiveRouteWorkerFactory;
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
  filter,
  onToggle,
  onConsult,
  graph,
  visual,
  routes,
  selected,
  onStart,
  onSelect,
  onMenu,
  temporary,
}: {
  filter?: ArchiveFilterPresentation;
  nodes?: Map<string, ArchiveNodeProjection>;
  onToggle?: (id: string) => void;
  onConsult?: (id: string, pointer?: boolean) => void;
  graph: NarrativeGraphDto;
  visual: Record<string, Geometry>;
  routes: ArchiveRoutePlanSet;
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
          {/* Uma ponta por tipo: a direção continua vindo de `link.directed`. */}
          {NARRATIVE_RELATIONS.map((relation) => {
            const visual = ARCHIVE_RELATION_VISUALS[relation];
            const shape = ARCHIVE_RELATION_MARKERS[visual.marker];
            return (
              <marker
                key={relation}
                id={archiveRelationMarkerId(relation)}
                viewBox={shape.viewBox}
                refX={shape.refX}
                refY={shape.refY}
                markerWidth={shape.width}
                markerHeight={shape.height}
                orient="auto-start-reverse"
              >
                <path
                  d={shape.d}
                  fill={shape.filled ? visual.tone : "none"}
                  stroke={shape.filled ? "none" : visual.tone}
                  strokeWidth={shape.filled ? undefined : 1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
            );
          })}
        </defs>
        {graph.links.map((link) => {
          const a = byCard.get(link.sourceId),
            b = byCard.get(link.targetId);
          if (!a || !b) return null;
          const route = archiveLinkRouteGeometry(
            routes.routes.get(link.id),
            a,
            b,
          );
          const { path, labelPoint, from, to } = route;
          const label = link.label || NARRATIVE_RELATION_LABELS[link.relation];
          const sheath = archiveRelationVisual(link.relation).sheath;
          // Filtro em destaque: vínculo que toca card atenuado também recua.
          const dim =
            filter?.active &&
            filter.mode === "highlight" &&
            (archiveFilterKind(filter, a.id, a.cardId) === "dim" ||
              archiveFilterKind(filter, b.id, b.cardId) === "dim");
          return (
            <g
              key={link.id}
              data-link={link.id}
              data-relation={link.relation}
              data-route={route.strategy}
              data-route-state={route.state}
              data-route-fallback={
                route.fallback || route.residual.length || undefined
              }
              data-filter-hidden={
                (filter?.active &&
                  filter.mode === "isolate" &&
                  (!filter.visibleIds.has(a.id) ||
                    !filter.visibleIds.has(b.id))) ||
                undefined
              }
              data-filter-dim={dim || undefined}
              style={archiveRelationStyle(link.relation)}
              className={selected?.id === link.id ? "is-selected" : ""}
            >
              {sheath ? (
                <path className="archive-link-sheath" d={path} />
              ) : null}
              <path
                className="archive-link"
                d={path}
                markerEnd={
                  link.directed
                    ? `url(#${archiveRelationMarkerId(link.relation)})`
                    : undefined
                }
              />
              {/* Encaixe na moldura: sai do card, sem parecer linha solta. */}
              <circle
                className="archive-link-socket"
                data-link-end="start"
                cx={from.x}
                cy={from.y}
                r={4.2}
              />
              <circle
                className="archive-link-core"
                data-link-end="start"
                cx={from.x}
                cy={from.y}
                r={1.15}
              />
              {link.directed ? null : (
                <>
                  <circle
                    className="archive-link-socket"
                    data-link-end="end"
                    cx={to.x}
                    cy={to.y}
                    r={4.2}
                  />
                  <circle
                    className="archive-link-core"
                    data-link-end="end"
                    cx={to.x}
                    cy={to.y}
                    r={1.15}
                  />
                </>
              )}
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
                relation={link.relation}
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
      {places.map((p) => (
        <ArchiveCard
          key={p.id}
          p={p}
          filterKind={archiveFilterKind(filter, p.id, p.cardId)}
          hiddenMatches={
            filter?.active ? (filter.hiddenByOwner.get(p.id) ?? 0) : 0
          }
          titles={related.get(p.cardId) ?? []}
          info={nodes?.get(p.id)}
          isSelected={selected?.id === p.id}
          onStart={onStart}
          onSelect={onSelect}
          onMenu={onMenu}
          onToggle={onToggle}
          onConsult={onConsult}
        />
      ))}
    </>
  );
});

/** Cards invariantes não precisam remontar seu conteúdo a cada intenção de layout. */
const ArchiveCard = memo(
  function ArchiveCard({
    p,
    filterKind,
    hiddenMatches,
    titles,
    info,
    isSelected,
    onStart,
    onSelect,
    onMenu,
    onToggle,
    onConsult,
  }: {
    p: NarrativePlacementDto;
    filterKind: string;
    hiddenMatches: number;
    titles: string[];
    info?: ArchiveNodeProjection;
    isSelected: boolean;
    onStart: (
      e: PointerEvent,
      mode: Gesture["mode"],
      p: NarrativePlacementDto,
      edge?: string,
    ) => void;
    onSelect: Props["onSelect"];
    onMenu: Props["onMenu"];
    onToggle?: Props["onToggle"];
    onConsult?: Props["onConsult"];
  }) {
    const compact = p.width < 230 || p.height < 160;
    return (
      <article
        data-placement={p.id}
        data-filter={filterKind}
        hidden={filterKind === "hidden"}
        data-base-x={p.x}
        data-base-y={p.y}
        data-base-width={p.width}
        data-base-height={p.height}
        data-card={p.cardId}
        data-category={p.card.category}
        data-compact={compact || undefined}
        data-tiny={p.height < 148 || undefined}
        className={`archive-card${isSelected ? " is-selected" : ""}`}
        style={{
          ...archiveCategoryStyle(p.card.category),
          left: p.x,
          top: p.y,
          width: p.width,
          height: p.height,
          zIndex: p.zIndex + 1 + (isSelected ? 1000001 : 0),
        }}
        aria-label={p.card.title}
        tabIndex={filterKind === "hidden" ? -1 : 0}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && e.key === "Enter") {
            e.preventDefault();
            onConsult?.(p.cardId);
          }
        }}
        onDoubleClick={(e) => {
          const target = e.target as Element;
          if (target.closest("button, .archive-resize")) return;
          onConsult?.(p.cardId, true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header onPointerDown={(e) => onStart(e, "move", p)}>
          <ArchiveCategoryIcon category={p.card.category} />
          <span>
            <small>
              {NARRATIVE_CATEGORY_LABELS[p.card.category] ?? "Card narrativo"}
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
          {p.card.groups?.length ? (
            <button
              className="archive-card-group-count"
              type="button"
              title={p.card.groups.map((g) => g.name).join(" · ")}
              aria-label={`Agrupamentos de ${p.card.title}: ${p.card.groups.map((g) => g.name).join(", ")}`}
              onClick={() => onConsult?.(p.cardId)}
            >
              {p.card.groups.slice(0, 2).map((g) => (
                <span
                  key={g.id}
                  style={{
                    color: /^#[0-9a-fA-F]{6}$/.test(g.color)
                      ? g.color
                      : "#B89A5A",
                  }}
                >
                  ●
                </span>
              ))}{" "}
              {p.card.groups.length} grupos
            </button>
          ) : null}
          {hiddenMatches ? (
            <small
              className="archive-filter-hidden-count"
              title={`${hiddenMatches} correspondências em descendentes recolhidos`}
            >
              {hiddenMatches} recolhidos
            </small>
          ) : null}
          {filterKind === "context" ? (
            <small className="archive-filter-context">Contexto</small>
          ) : null}
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
        <span className="archive-filter-veil" aria-hidden="true" />
      </article>
    );
  },
  (a, b) =>
    a.filterKind === b.filterKind &&
    a.hiddenMatches === b.hiddenMatches &&
    a.p.card === b.p.card &&
    a.p.id === b.p.id &&
    a.p.parentPlacementId === b.p.parentPlacementId &&
    a.p.branchOffsetX === b.p.branchOffsetX &&
    a.p.branchOffsetY === b.p.branchOffsetY &&
    a.p.x === b.p.x &&
    a.p.y === b.p.y &&
    a.p.width === b.p.width &&
    a.p.height === b.p.height &&
    a.p.zIndex === b.p.zIndex &&
    a.isSelected === b.isSelected &&
    a.onStart === b.onStart &&
    a.onSelect === b.onSelect &&
    a.onMenu === b.onMenu &&
    a.onToggle === b.onToggle &&
    a.onConsult === b.onConsult &&
    a.info?.expanded === b.info?.expanded &&
    a.info?.children.length === b.info?.children.length &&
    a.info?.hiddenLinks === b.info?.hiddenLinks &&
    a.info?.relationCount === b.info?.relationCount &&
    a.titles.length === b.titles.length &&
    a.titles.every((title, i) => title === b.titles[i]),
);
export function ArchiveCanvas({
  filter,
  layout,
  snapshot,
  presentation,
  nodes,
  onToggle,
  onConsult,
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
  routeWorker,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  // O mesmo plano alimenta a pintura estática e o loop de animação.
  const routesRef = useRef<ArchiveRoutePlanSet | null>(null);
  const motion = useArchiveMotion(
    viewport,
    graph,
    layout,
    snapshot,
    visual,
    presentation,
    routesRef,
  );
  const motionRef = useRef(motion);
  motionRef.current = motion;
  // Larguras de rótulo: a medição vive na cápsula (DOM), o plano no worker.
  const [labelRevision, setLabelRevision] = useState(0);
  useEffect(
    () =>
      onArchiveRelationLabelWidthsChange(() =>
        setLabelRevision((value) => value + 1),
      ),
    [],
  );
  const labelTexts = useMemo(
    () => motion.graph.links.map((link) => link.label ?? "").filter(Boolean),
    [motion.graph],
  );
  const routeSignature = useMemo(
    () =>
      `${archiveRouteSignature(motion.graph)}||${archiveRelationLabelSignature(
        labelTexts,
      )}`,
    [motion.graph, labelTexts, labelRevision],
  );
  const boardId = motion.graph.board?.id ?? "";
  // Plano anterior (definitivo ou provisório): base do reuso localizado.
  const previousRoutes = useRef<ArchiveRoutePlanSet | null>(null);
  const [planned, setPlanned] = useState<{
    signature: string;
    boardId: string;
    plan: ArchiveRoutePlanSet;
  } | null>(null);
  const planner = useRef<ArchiveRoutePlanner | null>(null);
  const pendingApply = useRef<{
    signature: string;
    boardId: string;
    plan: ArchiveRoutePlanSet;
  } | null>(null);
  const currentRequest = useRef({ signature: routeSignature, boardId });
  currentRequest.current = { signature: routeSignature, boardId };
  /** Aplica o resultado guardado durante um gesto, se ainda for o atual. */
  const flushPending = useCallback(() => {
    const next = pendingApply.current;
    if (!next) return;
    pendingApply.current = null;
    if (
      archiveRouteApplyPolicy({
        inGesture: false,
        current: currentRequest.current,
        result: next,
      }) !== "apply"
    )
      return;
    previousRoutes.current = next.plan;
    setPlanned(next);
  }, []);
  // Outro quadro: nada do anterior serve (nem plano nem resultado guardado).
  useEffect(() => {
    previousRoutes.current = null;
    pendingApply.current = null;
  }, [boardId]);
  // Planejamento fora da thread principal: um worker, um trabalho em voo.
  useEffect(() => {
    const instance = new ArchiveRoutePlanner({
      factory: routeWorker,
      onResult: (plan, meta) => {
        const next = {
          signature: meta.signature,
          boardId: meta.boardId,
          plan,
        };
        const decision = archiveRouteApplyPolicy({
          inGesture: gesture.current !== null,
          current: currentRequest.current,
          result: next,
        });
        if (decision === "drop") return;
        if (decision === "defer") {
          // Durante o gesto o traço não muda: aplica quando ele termina.
          pendingApply.current = next;
          return;
        }
        previousRoutes.current = plan;
        setPlanned(next);
      },
    });
    planner.current = instance;
    return () => {
      instance.dispose();
      planner.current = null;
    };
  }, [routeWorker]);
  useEffect(() => {
    planner.current?.request({
      boardId,
      signature: routeSignature,
      placements: motion.graph.placements,
      links: motion.graph.links,
      labels: archiveRelationMeasuredWidths(labelTexts),
      previous: previousRoutes.current,
    });
  }, [routeSignature, boardId, labelTexts]);
  // Primeira apresentação: forma anterior adaptada, nunca anunciada
  // como verificada. Custo linear e sem consulta a obstáculos.
  const provisional = useMemo(
    () =>
      provisionalArchiveRoutePlan({
        placements: motion.graph.placements,
        links: motion.graph.links,
        previous: previousRoutes.current,
      }),
    [routeSignature],
  );
  const routes =
    planned && planned.signature === routeSignature && planned.boardId === boardId
      ? planned.plan
      : provisional;
  routesRef.current = routes;
  const gesture = useRef<Gesture | null>(null);
  const suppressConsultUntil = useRef(0);
  const lastTap = useRef<{
    id: string;
    at: number;
    x: number;
    y: number;
  } | null>(null);
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
    onConsult,
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
    onConsult,
    onConnect,
    busy,
    onSelect,
    onInteraction,
  };
  const consultCard = useCallback((id: string, pointer = false) => {
    if (
      !state.current.busy &&
      (!pointer || Date.now() >= suppressConsultUntil.current)
    )
      state.current.onConsult?.(id);
  }, []);
  const cancel = () => {
    const g = gesture.current;
    if (!g) return;
    lastTap.current = null;
    if (g.moved) suppressConsultUntil.current = Date.now() + 350;
    gesture.current = null;
    state.current.onInteraction(false);
    if (g.mode !== "pan") state.current.onVisual({});
    setTemporary(null);
    motionRef.current.resume();
    flushPending();
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
      if (p) {
        const shown = motionRef.current.geometry(p.id);
        if (shown) p = { ...p, ...shown };
        motionRef.current.pause();
      }
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
      data-route-plan={routes.provisional ? "provisional" : "definitive"}
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
          lastTap.current = null;
          suppressConsultUntil.current = Date.now() + 350;
          if (next) onMove(g.placement.id, next, g.mode, g.geometry!);
        } else if (g.mode !== "pan") {
          onVisual({});
          // O capture no viewport suprime o dblclick nativo do cabeçalho.
          if (g.mode === "move" && g.placement) {
            const last = lastTap.current,
              now = Date.now();
            if (
              last?.id === g.placement.id &&
              now - last.at < 350 &&
              Math.hypot(e.clientX - last.x, e.clientY - last.y) < 8 &&
              now >= suppressConsultUntil.current
            ) {
              state.current.onConsult?.(g.placement.cardId);
              lastTap.current = null;
            } else
              lastTap.current = {
                id: g.placement.id,
                at: now,
                x: e.clientX,
                y: e.clientY,
              };
          }
        }
        if (g.mode !== "pan") {
          motionRef.current.resume();
          flushPending();
        }
      }}
    >
      <ArchiveBackground camera={camera} />
      <div
        className="archive-world"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
        }}
      >
        <GraphContent
          nodes={nodes}
          filter={filter}
          routes={routes}
          onToggle={busy ? undefined : onToggle}
          onConsult={busy ? undefined : consultCard}
          graph={motion.graph}
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
