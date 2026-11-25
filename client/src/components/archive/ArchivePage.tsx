import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArchiveDockHelp } from "./ArchiveDockHelp";
import type { ArchivePresentation } from "./useArchiveMotion";
import { createPortal } from "react-dom";
import { newId } from "../../utils";
import { ApiError } from "../../api";
import {
  ARCHIVE_CHANGED,
  archiveOperation,
  listBoards,
  listCards,
  listGroups,
  loadGraph,
  type ArchiveOperation,
} from "../../archiveApi";
import {
  NARRATIVE_CATEGORIES,
  NARRATIVE_CATEGORY_LABELS,
  NARRATIVE_RELATIONS,
  NARRATIVE_RELATION_LABELS,
  type NarrativeBoardDto,
  type NarrativeGraphDto,
  type NarrativeCardDto,
  type NarrativeCategory,
  type NarrativeRelation,
  type NarrativeGroupDto,
} from "../../../../src/modules/shared/narrative";
import { Icon } from "../Icon";
import {
  SceneEditorRadialMenu,
  type SceneRadialOption,
} from "../master/SceneEditorRadialMenu";
import "../master/scenes.css";
import {
  ArchiveCanvas,
  CATEGORY_ICONS,
  type ArchiveSelection,
  type Geometry,
} from "./ArchiveCanvas";
import {
  cameraPoint,
  fitArchive,
  zoomArchive,
  type ArchiveCamera,
} from "./archiveCamera";
import {
  layoutArchive,
  captureArchiveAnchor,
  archiveAnchorSignature,
  archiveGestureCommit,
  type ArchiveAnchor,
  type ArchiveReserveExceptions,
  archiveReserveIntent,
  archiveSameGeometry,
  isCustomBranch,
  branchVector,
  relativeGestureVisual,
} from "./archiveLayout";
import { ArchiveReader, type ArchiveReaderHandle } from "./ArchiveReader";
import { archiveDescendants } from "./archiveHierarchy";
import { projectArchive } from "./archiveProjection";
import {
  ArchiveGroupManager,
  ArchiveGroupPicker,
  ArchiveFilterControls,
} from "./ArchiveGroupControls";
import {
  filterArchive,
  EMPTY_ARCHIVE_FILTER,
  type ArchiveFilterState,
} from "./archiveFilters";
import "./archive.css";
const EMPTY_EXPANSION = new Set<string>();
const EMPTY_RESERVE_EXCEPTIONS: ArchiveReserveExceptions = {};
const EMPTY_ANCHORS: Record<string, ArchiveAnchor> = {};
type Command = ArchiveOperation extends infer T
  ? T extends { operationId: string }
    ? Omit<T, "operationId">
    : never
  : never;
type Radial = {
  point: { x: number; y: number };
  kind: "create" | "category" | "card" | "link" | "branches";
  group?: string;
  targetId?: string;
  parentPlacementId?: string;
};
const CARD_GROUPS = [
  {
    id: "places",
    label: "Lugares",
    icon: "earth",
    categories: ["region", "locality", "dungeon", "room"],
  },
  {
    id: "people",
    label: "Pessoas",
    icon: "users",
    categories: ["npc", "creature", "faction"],
  },
  {
    id: "stories",
    label: "Histórias",
    icon: "scroll",
    categories: ["event", "scene", "encounter"],
  },
  {
    id: "clues",
    label: "Pistas",
    icon: "search",
    categories: ["clue", "trap"],
  },
  {
    id: "resources",
    label: "Recursos",
    icon: "bag",
    categories: ["item", "image", "sound"],
  },
] as const;
type Editor =
  | {
      kind: "board" | "card" | "link";
      id?: string;
      version?: number;
      parentPlacementId?: string;
      sourceId?: string;
      targetId?: string;
    }
  | { kind: "library"; parentPlacementId?: string }
  | { kind: "confirm"; command: Command; message: string };
function ArchiveDialog({
  title,
  children,
  onClose,
  busy,
  side = false,
}: {
  side?: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const actions = useRef({ onClose, busy });
  actions.current = { onClose, busy };
  useEffect(() => {
    if (!side) return;
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !actions.current.busy
      ) {
        event.preventDefault();
        actions.current.onClose();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [side]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  if (side)
    return (
      <section
        className="archive-reader archive-card-editor"
        role="dialog"
        aria-modal="false"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Fechar editor"
          >
            <Icon name="x" size={16} />
          </button>
        </header>
        <div className="archive-editor-body">{children}</div>
      </section>
    );
  return createPortal(
    <dialog
      className="archive-dialog"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          className="btn btn-small"
          disabled={busy}
          onClick={onClose}
          aria-label="Fechar editor"
        >
          <Icon name="x" size={16} />
        </button>
      </header>
      {children}
    </dialog>,
    document.body,
  );
}
export function ArchivePage() {
  const reader = useRef<ArchiveReaderHandle>(null);
  const presentation = useRef<ArchivePresentation | null>(null);
  const consult = useCallback((id: string) => reader.current?.consult(id), []);
  const [boards, setBoards] = useState<NarrativeBoardDto[]>([]),
    [boardId, setBoardId] = useState(""),
    [graph, setGraph] = useState<NarrativeGraphDto | null>(null);
  // Memória desta janela, por quadro; não persiste nem publica expansão.
  const [expansion, setExpansion] = useState<Record<string, Set<string>>>({});
  const expanded = expansion[boardId] ?? EMPTY_EXPANSION;
  const [groups, setGroups] = useState<NarrativeGroupDto[]>([]);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, ArchiveFilterState>>(
    {},
  );
  const filterState = filters[boardId] ?? EMPTY_ARCHIVE_FILTER;
  const projection = useMemo(
    () => (graph ? projectArchive(graph, expanded) : null),
    [graph, expanded],
  );
  const filterPresentation = useMemo(
    () =>
      graph && projection
        ? filterArchive(graph, projection, filterState)
        : null,
    [graph, projection, filterState],
  );
  useEffect(() => {
    const valid = new Set(groups.map((g) => g.id));
    setFilters((previous) => {
      let changed = false;
      const next = Object.fromEntries(
        Object.entries(previous).map(([id, state]) => {
          const groupIds = state.groupIds.filter((id) => valid.has(id));
          if (groupIds.length === state.groupIds.length) return [id, state];
          changed = true;
          return [id, { ...state, groupIds }];
        }),
      );
      return changed ? next : previous;
    });
  }, [groups]);
  const [layoutAnchors, setLayoutAnchors] = useState<
    Record<string, Record<string, ArchiveAnchor>>
  >({});
  const anchors = layoutAnchors[boardId] ?? EMPTY_ANCHORS;
  const [reserveExceptions, setReserveExceptions] = useState<
    Record<string, ArchiveReserveExceptions>
  >({});
  const manual = reserveExceptions[boardId] ?? EMPTY_RESERVE_EXCEPTIONS;
  // Nenhuma dependência de câmera/ponteiro: o layout permanece congelado durante os gestos.
  const layout = useMemo(
    () => (projection ? layoutArchive(projection, { anchors, manual }) : null),
    [projection, anchors, manual],
  );
  useLayoutEffect(() => {
    if (!projection) return;
    setLayoutAnchors((previous) => {
      const entries = previous[boardId];
      if (
        !entries ||
        Object.entries(entries).every(
          ([id, pin]) => projection.visibleIds.has(id) || !!pin.parentId,
        )
      )
        return previous;
      return {
        ...previous,
        [boardId]: Object.fromEntries(
          Object.entries(entries).filter(
            ([id, pin]) => projection.visibleIds.has(id) || !!pin.parentId,
          ),
        ),
      };
    });
    const sources = new Set(layout?.reserves.map((r) => r.sourceId));
    setReserveExceptions((previous) => {
      const entries = previous[boardId];
      if (!entries || Object.keys(entries).every((id) => sources.has(id)))
        return previous;
      return {
        ...previous,
        [boardId]: Object.fromEntries(
          Object.entries(entries).filter(([id]) => sources.has(id)),
        ),
      };
    });
  }, [projection, layout, boardId]);
  const gestureCommit = useRef<{
    id: string;
    visual: Geometry;
    mode: "move" | "resize";
  } | null>(null);
  const [branchRelationEnabled, setBranchRelationEnabled] = useState(false);
  const [branchRelation, setBranchRelation] =
    useState<NarrativeRelation>("contains");
  const [branchLabel, setBranchLabel] = useState("");
  const [branchDirected, setBranchDirected] = useState(true);
  const [radial, setRadial] = useState<Radial | null>(null);
  const radialRef = useRef<Radial | null>(null);
  radialRef.current = radial;
  const draftPosition = useRef<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<ArchiveSelection>(null),
    [camera, setCamera] = useState<ArchiveCamera>({ x: 60, y: 60, zoom: 1 });
  const [visual, setVisual] = useState<Record<string, Geometry>>({}),
    [editor, setEditor] = useState<Editor | null>(null);
  const branchAncestors = useMemo(() => {
    const ancestors = new Set<string>();
    let id =
      editor && "parentPlacementId" in editor
        ? editor.parentPlacementId
        : undefined;
    const byId = new Map(graph?.placements.map((p) => [p.id, p]) ?? []);
    while (id && !ancestors.has(id)) {
      ancestors.add(id);
      id = byId.get(id)?.parentPlacementId ?? undefined;
    }
    return ancestors;
  }, [graph, editor]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<ArchiveOperation | null>(null),
    [conflict, setConflict] = useState(false),
    [changed, setChanged] = useState(false),
    [loading, setLoading] = useState(true);
  const [library, setLibrary] = useState<
      Pick<NarrativeCardDto, "id" | "title" | "category" | "version">[]
    >([]),
    [libraryQuery, setLibraryQuery] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    category: "note" as NarrativeCategory,
    summary: "",
    content: "",
    groupIds: [] as string[],
    relation: "related" as NarrativeRelation,
    label: "",
    directed: true,
  });
  const interacting = useRef(false);
  const onInteraction = useCallback((active: boolean) => {
    interacting.current = active;
  }, []);
  const lastCanvasFocus = useRef<ArchiveSelection>(null);
  const root = useRef<HTMLDivElement>(null),
    lock = useRef(false),
    generation = useRef(0),
    cameras = useRef(new Map<string, ArchiveCamera>());
  const current = useRef({
    boardId,
    graph,
    editor,
    busy,
    pending,
    selected,
    camera,
    layout,
    expanded,
  });
  current.current = {
    boardId,
    graph,
    editor,
    busy,
    pending,
    selected,
    camera,
    layout,
    expanded,
  };
  const selectIntentional = useCallback((selection: ArchiveSelection) => {
    setSelected(selection);
    if (selection?.kind === "card") {
      const p = current.current.graph?.placements.find(
        (p) => p.id === selection.id,
      );
      if (p) reader.current?.select(p.cardId);
    }
  }, []);
  const visualGesture = useCallback((v: Record<string, Geometry>) => {
    const layout = current.current.layout;
    setVisual(layout ? relativeGestureVisual(layout.graph, v) : v);
  }, []);
  const refresh = useCallback(async (id?: string, onApplied?: () => void) => {
    const request = ++generation.current;
    const all = await listBoards();
    if (request !== generation.current) return;
    setBoards(all.boards);
    const chosen =
      id && all.boards.some((b) => b.id === id)
        ? id
        : (all.boards[0]?.id ?? "");
    if (chosen) {
      const next = await loadGraph(chosen);
      if (request !== generation.current) return;
      setGraph(next);
      if (next.groups) setGroups(next.groups);
      setLayoutAnchors((previous) => {
        if (!previous[chosen]) return previous;
        const valid: Record<string, ArchiveAnchor> = {};
        const byId = new Map(next.placements.map((p) => [p.id, p]));
        for (const p of next.placements) {
          const pin = previous[chosen][p.id];
          if (
            pin &&
            pin.baseX === p.x &&
            pin.baseY === p.y &&
            (!pin.parentId ||
              pin.signature ===
                archiveAnchorSignature(p, next.placements, byId))
          )
            valid[p.id] = pin;
        }
        return { ...previous, [chosen]: valid };
      });
      setReserveExceptions((previous) => {
        const byId = new Map(next.placements.map((p) => [p.id, p]));
        const valid: Record<string, Record<string, Geometry>> = {};
        for (const [source, entries] of Object.entries(previous[chosen] ?? {}))
          if (byId.has(source)) {
            for (const [id, g] of Object.entries(entries))
              if (byId.has(id) && archiveSameGeometry(byId.get(id)!, g))
                (valid[source] ??= {})[id] = g;
          }
        return { ...previous, [chosen]: valid };
      });
      setExpansion((previous) => {
        if (!previous[chosen]) return previous;
        const ids = new Set(next.placements.map((p) => p.id));
        return {
          ...previous,
          [chosen]: new Set([...previous[chosen]].filter((id) => ids.has(id))),
        };
      });
      setBoardId(chosen);
    } else {
      setGraph(null);
      setBoardId("");
      try {
        setGroups((await listGroups()).groups);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
    }
    onApplied?.();
    setLoading(false);
    setChanged(false);
  }, []);
  useEffect(() => {
    void refresh().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
    return () => {
      generation.current++;
    };
  }, [refresh]);
  useLayoutEffect(() => {
    if (!graph) return;
    const viewport = root.current
      ?.querySelector(".archive-viewport")
      ?.getBoundingClientRect();
    if (!viewport) return;
    const next =
      cameras.current.get(graph.board.id) ??
      fitArchive(layout?.graph.placements ?? [], viewport);
    cameras.current.set(graph.board.id, next);
    setCamera(next);
  }, [graph?.board.id]);
  // A seleção nunca mantém controles em representações temporariamente ocultas.
  useLayoutEffect(() => {
    if (!projection) return;
    if (radial?.kind === "link") {
      if (!projection.graph.links.some((l) => l.id === radial.targetId))
        setRadial(null);
    } else if (radial?.targetId && !projection.visibleIds.has(radial.targetId))
      setRadial(null);
    if (
      radial?.parentPlacementId &&
      !projection.visibleIds.has(radial.parentPlacementId)
    )
      setRadial(null);
    if (!selected) return;
    if (selected.kind === "card" && !projection.visibleIds.has(selected.id)) {
      const owner = projection.owner.get(selected.id);
      setSelected(owner ? { kind: "card", id: owner } : null);
    } else if (
      selected.kind === "link" &&
      !projection.graph.links.some((l) => l.id === selected.id)
    ) {
      const link = graph?.links.find((l) => l.id === selected.id);
      const place = graph?.placements.find((p) => p.cardId === link?.sourceId);
      const owner = place && projection.owner.get(place.id);
      setSelected(owner ? { kind: "card", id: owner } : null);
    }
  }, [projection, selected, graph, radial]);
  useLayoutEffect(() => {
    if (!filterPresentation?.active || filterPresentation.mode !== "isolate")
      return;
    const visible = filterPresentation.visibleIds;
    if (selected?.kind === "card" && !visible.has(selected.id))
      setSelected(null);
    if (
      radial?.targetId &&
      radial.kind !== "link" &&
      !visible.has(radial.targetId)
    )
      setRadial(null);
    if (radial?.kind === "link") {
      const link = graph?.links.find((l) => l.id === radial.targetId);
      if (
        link &&
        graph?.placements.some(
          (p) =>
            (p.cardId === link.sourceId || p.cardId === link.targetId) &&
            !visible.has(p.id),
        )
      )
        setRadial(null);
    }
    if (selected?.kind === "link") {
      const link = graph?.links.find((l) => l.id === selected.id);
      if (
        link &&
        !graph?.placements
          .filter(
            (p) => p.cardId === link.sourceId || p.cardId === link.targetId,
          )
          .every((p) => visible.has(p.id))
      ) {
        setSelected(null);
        setRadial(null);
      }
    }
    const active = document.activeElement;
    const focused = active?.closest<HTMLElement>("[data-placement]");
    const remembered = lastCanvasFocus.current;
    const rememberedHidden =
      remembered?.kind === "card"
        ? !visible.has(remembered.id)
        : remembered?.kind === "link" &&
          !!graph?.links.some(
            (link) =>
              link.id === remembered.id &&
              graph.placements.some(
                (p) =>
                  (p.cardId === link.sourceId || p.cardId === link.targetId) &&
                  !visible.has(p.id),
              ),
          );
    // hidden pode transferir o foco para body antes do layout effect no Chromium.
    if (
      (focused && !visible.has(focused.dataset.placement!)) ||
      (active === document.body && rememberedHidden)
    )
      root.current
        ?.querySelector<HTMLElement>(".archive-viewport")
        ?.focus({ preventScroll: true });
  }, [filterPresentation, selected, radial, graph]);
  const toggleBranches = useCallback((id: string) => {
    const c = current.current;
    if (c.busy || c.pending || interacting.current) return;
    const opening = !c.expanded.has(id);
    const descendants = archiveDescendants(c.graph?.placements ?? [], id);
    setReserveExceptions((previous) => {
      const next = { ...(previous[c.boardId] ?? {}) };
      for (const child of descendants) delete next[child];
      return { ...previous, [c.boardId]: next };
    });
    const base = c.graph?.placements.find((p) => p.id === id),
      shown = presentation.current?.geometry(id) ?? c.layout?.geometry.get(id);
    setLayoutAnchors((previous) => {
      const next = { ...(previous[c.boardId] ?? {}) };
      // Âncoras relativas ocultas ficam inativas e serão rebaseadas no pai atual.
      // Nunca reativar uma antiga coordenada absoluta de descendente.
      for (const child of descendants)
        if (child === id || !next[child]?.parentId) delete next[child];
      if (opening && base && shown && c.layout)
        next[id] = captureArchiveAnchor(
          base,
          shown,
          c.graph!,
          c.layout.geometry,
        );
      return { ...previous, [c.boardId]: next };
    });
    setExpansion((previous) => {
      const next = new Set(previous[c.boardId] ?? []);
      if (opening) next.add(id);
      else next.delete(id);
      return { ...previous, [c.boardId]: next };
    });
  }, []);
  const onCamera = useCallback((value: ArchiveCamera) => {
    setCamera(value);
    if (current.current.boardId)
      cameras.current.set(current.current.boardId, value);
  }, []);
  useEffect(() => {
    const update = () => {
      const c = current.current;
      if (
        c.busy ||
        c.editor ||
        c.pending ||
        interacting.current ||
        radialRef.current
      ) {
        setChanged(true);
        return;
      }
      void refresh(c.boardId).catch((e) => setError(e.message));
    };
    window.addEventListener(ARCHIVE_CHANGED, update);
    window.addEventListener("focus", update);
    return () => {
      window.removeEventListener(ARCHIVE_CHANGED, update);
      window.removeEventListener("focus", update);
    };
  }, [refresh]);
  const perform = async (input: ArchiveOperation) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setConflict(false);
    setPending(input);
    try {
      const receipt = await archiveOperation(input);
      // Mantém a geometria local até aplicar o grafo confirmado, na mesma renderização.
      await refresh(
        input.action === "board.create" ? receipt.id : current.current.boardId,
        () => {
          setPending(null);
          setVisual({});
          setEditor(null);
          if (input.action !== "placement.update") setSelected(null);
          if ("parentPlacementId" in input && input.parentPlacementId) {
            const parentId = input.parentPlacementId;
            setExpansion((previous) => ({
              ...previous,
              [current.current.boardId]: new Set([
                ...(previous[current.current.boardId] ?? []),
                parentId,
              ]),
            }));
            setSelected({ kind: "card", id: receipt.id });
          }
          const c = current.current;
          if (
            c.layout &&
            ((input.action === "placement.update" &&
              (gestureCommit.current?.mode !== "resize" ||
                Object.values(manual).some(
                  (entries) => entries[input.placementId],
                ))) ||
              ((input.action === "card.create" ||
                input.action === "placement.add") &&
                !input.parentPlacementId))
          ) {
            const id =
              input.action === "placement.update"
                ? input.placementId
                : receipt.id;
            const acceptedLayout = c.layout;
            setReserveExceptions((previous) => ({
              ...previous,
              [c.boardId]: archiveReserveIntent(
                acceptedLayout,
                previous[c.boardId] ?? {},
                id,
                input.geometry,
              ),
            }));
          }
          if (
            input.action === "placement.reset" ||
            input.action === "placement.parent"
          ) {
            setLayoutAnchors((previous) => {
              const next = { ...(previous[c.boardId] ?? {}) };
              if (input.action === "placement.reset" && input.children)
                for (const p of c.graph?.placements ?? []) {
                  if (p.parentPlacementId === input.placementId)
                    delete next[p.id];
                }
              else delete next[input.placementId];
              return { ...previous, [c.boardId]: next };
            });
          }
          if (
            input.action === "placement.update" &&
            gestureCommit.current?.id === input.placementId &&
            c.expanded.has(input.placementId)
          ) {
            const final = gestureCommit.current.visual;
            setLayoutAnchors((previous) => ({
              ...previous,
              [c.boardId]: {
                ...(previous[c.boardId] ?? {}),
                [input.placementId]: captureArchiveAnchor(
                  {
                    ...c.graph!.placements.find(
                      (p) => p.id === input.placementId,
                    )!,
                    ...input.geometry,
                  },
                  final,
                  c.graph!,
                  c.layout!.geometry,
                ),
              },
            }));
          }
          if ("parentPlacementId" in input && input.parentPlacementId) {
            const id = input.parentPlacementId,
              base = c.graph?.placements.find((p) => p.id === id),
              shown =
                presentation.current?.geometry(id) ??
                c.layout?.geometry.get(id);
            if (base && shown && !c.expanded.has(id))
              setLayoutAnchors((previous) => ({
                ...previous,
                [c.boardId]: {
                  ...(previous[c.boardId] ?? {}),
                  [id]: captureArchiveAnchor(
                    base,
                    shown,
                    c.graph!,
                    c.layout!.geometry,
                  ),
                },
              }));
          }
          gestureCommit.current = null;
          draftPosition.current = null;
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      setConflict(e instanceof ApiError && e.status === 409);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const run = (command: Command) =>
    void perform({ ...command, operationId: newId() } as ArchiveOperation);
  const fit = () => {
    const r = root.current
      ?.querySelector(".archive-viewport")
      ?.getBoundingClientRect();
    if (r && layout)
      onCamera(
        fitArchive(
          layout.graph.placements.map((p) => ({
            ...p,
            ...presentation.current?.geometry(p.id),
            ...visual[p.id],
          })),
          r,
        ),
      );
  };
  const geometry = (parentId?: string): Geometry => {
    const parent = graph?.placements.find((p) => p.id === parentId);
    if (parent)
      return {
        x: Math.min(1000000, parent.x + parent.width + 64),
        y: Math.min(
          1000000,
          parent.y +
            (projection?.nodes.get(parent.id)?.children.length ?? 0) * 220,
        ),
        width: 280,
        height: 200,
        zIndex: parent.zIndex,
      };
    const r = root.current
      ?.querySelector(".archive-viewport")
      ?.getBoundingClientRect();
    const center =
      draftPosition.current ??
      cameraPoint(camera, {
        x: (r?.width ?? 800) / 2,
        y: (r?.height ?? 600) / 2,
      });
    return {
      x: center.x - 140,
      y: center.y - 100,
      width: 280,
      height: 200,
      zIndex: 0,
    };
  };
  const openBoard = (edit = false) => {
    if (!graph && edit) return;
    setDraft({
      ...draft,
      title: edit ? graph!.board.name : "",
      description: edit ? graph!.board.description : "",
    });
    setEditor({
      kind: "board",
      ...(edit ? { id: graph!.board.id, version: graph!.board.version } : {}),
    });
  };
  const editCard = useCallback((id?: string) => {
    const c = current.current;
    const place = c.graph?.placements.find(
      (p) => p.id === (id ?? c.selected?.id),
    );
    if (!place) return;
    const card = place.card;
    setDraft((d) => ({
      ...d,
      title: card.title,
      category: card.category,
      summary: card.summary,
      content: card.content,
      groupIds: (card.groups ?? []).map((g) => g.id),
    }));
    setEditor({ kind: "card", id: card.id, version: card.version });
  }, []);
  const newCard = (
    category: NarrativeCategory = "note",
    parentPlacementId?: string,
  ) => {
    setBranchRelationEnabled(false);
    setBranchDirected(true);
    setBranchLabel("");
    setDraft((d) => ({
      ...d,
      title: "",
      category,
      summary: "",
      content: "",
      groupIds: [],
    }));
    setEditor({ kind: "card", parentPlacementId });
  };
  const openLink = (sourceId?: string, targetId?: string, linkId?: string) => {
    const link = graph?.links.find((l) => l.id === (linkId ?? selected?.id));
    setDraft((d) => ({
      ...d,
      relation: sourceId ? "related" : (link?.relation ?? "related"),
      label: sourceId ? "" : (link?.label ?? ""),
      description: sourceId ? "" : (link?.description ?? ""),
      directed: sourceId ? true : (link?.directed ?? true),
    }));
    setEditor({
      kind: "link",
      sourceId: sourceId ?? link?.sourceId,
      targetId: targetId ?? link?.targetId,
      ...(!sourceId && link ? { id: link.id, version: link.version } : {}),
    });
  };
  const selectedPlace =
    selected?.kind === "card"
      ? graph?.placements.find((p) => p.id === selected.id)
      : undefined;
  const selectedLink =
    selected?.kind === "link"
      ? graph?.links.find((l) => l.id === selected.id)
      : undefined;
  const guarded = busy || pending !== null;
  // Prévia de conteúdo, separada do snapshot autoritativo e do layout espacial.
  const previewGraph = useMemo(() => {
    if (!layout || editor?.kind !== "card" || !editor.id) return layout?.graph;
    return {
      ...layout.graph,
      placements: layout.graph.placements.map((p) =>
        p.cardId === editor.id
          ? {
              ...p,
              card: {
                ...p.card,
                title: draft.title,
                category: draft.category,
                summary: draft.summary,
                content: draft.content,
                groups: groups.filter((g) => draft.groupIds.includes(g.id)),
              },
            }
          : p,
      ),
    };
  }, [
    layout,
    editor?.kind,
    editor && "id" in editor ? editor.id : undefined,
    draft.title,
    draft.category,
    draft.summary,
    draft.content,
    draft.groupIds,
    groups,
  ]);
  const closeRadial = useCallback(() => setRadial(null), []);
  const openContextMenu = useCallback(
    (point: { x: number; y: number }, selection: ArchiveSelection) => {
      const c = current.current;
      if (c.busy || c.pending || c.editor) return;
      setSelected(selection);
      if (selection?.kind === "card") {
        const p = c.graph?.placements.find((p) => p.id === selection.id);
        if (p) reader.current?.select(p.cardId);
      }
      if (!selection) {
        const rect = root.current
          ?.querySelector(".archive-viewport")
          ?.getBoundingClientRect();
        draftPosition.current = rect
          ? cameraPoint(c.camera, {
              x: point.x - rect.left,
              y: point.y - rect.top,
            })
          : null;
      }
      setRadial({
        kind: selection?.kind ?? "create",
        targetId: selection?.id,
        point,
      });
    },
    [],
  );
  const radialAction = (action: () => void) => () => {
    setRadial(null);
    action();
  };
  const targetPlace = graph?.placements.find((p) => p.id === radial?.targetId);
  const targetLink = graph?.links.find((l) => l.id === radial?.targetId);
  let radialOptions: SceneRadialOption[] = [];
  let radialTitle = "Novo card";
  if (radial?.kind === "category") {
    const group = CARD_GROUPS.find((g) => g.id === radial.group);
    radialTitle = group?.label ?? "Categoria";
    radialOptions = (group?.categories ?? []).map((category) => ({
      id: category,
      label: NARRATIVE_CATEGORY_LABELS[category],
      caption: NARRATIVE_CATEGORY_LABELS[category],
      icon: CATEGORY_ICONS[category],
      disabled: guarded,
      action: radialAction(() => newCard(category, radial.parentPlacementId)),
    }));
  } else if (radial?.kind === "create") {
    radialOptions = graph
      ? [
          ...CARD_GROUPS.map((group) => ({
            id: group.id,
            label: group.label,
            caption: group.label,
            icon: group.icon,
            disabled: guarded,
            action: () =>
              setRadial({ ...radial, kind: "category", group: group.id }),
          })),
          {
            id: "note",
            label: "Criar anotação",
            caption: "Anotação",
            icon: "quill",
            disabled: guarded,
            action: radialAction(() =>
              newCard("note", radial.parentPlacementId),
            ),
          },
        ]
      : [
          {
            id: "board",
            label: "Criar quadro",
            caption: "Quadro",
            icon: "plus",
            disabled: guarded,
            action: radialAction(() => openBoard()),
          },
        ];
  } else if (radial?.kind === "card" && targetPlace && graph) {
    radialTitle = "Ações do card";
    radialOptions = [
      {
        id: "consult",
        label: "Consultar",
        caption: "Consultar",
        icon: "book",
        disabled: guarded,
        action: radialAction(() => consult(targetPlace.cardId)),
      },
      {
        id: "edit",
        label: "Editar conteúdo",
        caption: "Editar",
        icon: "quill",
        disabled: guarded,
        action: radialAction(() => editCard(targetPlace.id)),
      },
      {
        id: "new",
        label: "Novo card",
        caption: "Novo card",
        icon: "plus",
        disabled: guarded,
        action: () => {
          draftPosition.current = null;
          setRadial({ ...radial, kind: "create", targetId: undefined });
        },
      },
      {
        id: "remove",
        label: "Remover do quadro",
        caption: "Remover",
        icon: "minus",
        disabled: guarded,
        action: radialAction(() =>
          setEditor({
            kind: "confirm",
            message:
              "Remover somente deste quadro? Suas ramificações diretas ficarão independentes. O conteúdo e suas relações continuam no Arquivo.",
            command: {
              action: "placement.remove",
              boardId,
              placementId: targetPlace.id,
              expectedVersion: graph.board.version,
            },
          }),
        ),
      },
      {
        id: "delete",
        label: "Excluir card definitivamente",
        caption: "Excluir",
        icon: "trash",
        disabled: guarded,
        action: radialAction(() =>
          setEditor({
            kind: "confirm",
            message:
              "Excluir definitivamente este card de todos os quadros e apagar suas relações? Suas ramificações diretas ficarão independentes. Esta ação não pode ser revertida.",
            command: {
              action: "card.delete",
              cardId: targetPlace.cardId,
              expectedVersion: targetPlace.card.version,
            },
          }),
        ),
      },
    ];
    radialOptions.push({
      id: "branches",
      label: "Ramificações",
      caption: "Ramificações",
      icon: "flag",
      disabled: guarded,
      action: () => setRadial({ ...radial, kind: "branches" }),
    });
  } else if (radial?.kind === "branches" && targetPlace && graph) {
    radialTitle = "Ramificações";
    const info = projection?.nodes.get(targetPlace.id);
    const customChildren = graph.placements.filter(
      (p) => p.parentPlacementId === targetPlace.id && isCustomBranch(p),
    );
    radialOptions = [
      ...(info?.children.length
        ? [
            {
              id: "toggle",
              label: `${info.expanded ? "Recolher" : "Expandir"} ramificações`,
              caption: info.expanded ? "Recolher" : "Expandir",
              icon: "eye" as const,
              disabled: guarded,
              action: radialAction(() => toggleBranches(targetPlace.id)),
            },
          ]
        : []),
      {
        id: "new-branch",
        label: "Criar ramificação",
        caption: "Criar",
        icon: "plus",
        disabled: guarded,
        action: () =>
          setRadial({
            ...radial,
            kind: "create",
            parentPlacementId: targetPlace.id,
          }),
      },
      {
        id: "associate",
        label: "Associar card como ramificação",
        caption: "Associar",
        icon: "book",
        disabled: guarded,
        action: radialAction(() => {
          setBranchRelationEnabled(false);
          setBranchLabel("");
          setLibraryQuery("");
          setEditor({ kind: "library", parentPlacementId: targetPlace.id });
          void listCards()
            .then((r) => setLibrary(r.cards))
            .catch((e) => setError(e.message));
        }),
      },
      ...(isCustomBranch(targetPlace)
        ? [
            {
              id: "reset-one",
              label: "Restaurar posição automática",
              caption: "Automática",
              icon: "gear" as const,
              disabled: guarded,
              action: radialAction(() =>
                run({
                  action: "placement.reset",
                  boardId,
                  placementId: targetPlace.id,
                  children: false,
                  expectedVersion: graph.board.version,
                }),
              ),
            },
          ]
        : []),
      ...(customChildren.length
        ? [
            {
              id: "reset-children",
              label: "Restaurar distribuição automática",
              caption: "Restaurar",
              icon: "gear" as const,
              disabled: guarded,
              action: radialAction(() =>
                setEditor({
                  kind: "confirm",
                  message: `Restaurar a distribuição automática? ${customChildren.length} posições personalizadas de ramificações diretas serão descartadas.`,
                  command: {
                    action: "placement.reset",
                    boardId,
                    placementId: targetPlace.id,
                    children: true,
                    expectedVersion: graph.board.version,
                  },
                }),
              ),
            },
          ]
        : []),
      ...(targetPlace.parentPlacementId
        ? [
            {
              id: "detach",
              label: "Remover pertencimento",
              caption: "Desvincular",
              icon: "minus" as const,
              disabled: guarded,
              action: radialAction(() =>
                run({
                  action: "placement.parent",
                  boardId,
                  placementId: targetPlace.id,
                  parentPlacementId: null,
                  expectedVersion: graph.board.version,
                }),
              ),
            },
          ]
        : []),
    ];
  } else if (radial?.kind === "link" && targetLink) {
    radialTitle = "Relação";
    radialOptions = [
      {
        id: "edit",
        label: "Editar relação",
        caption: "Editar",
        icon: "quill",
        disabled: guarded,
        action: radialAction(() =>
          openLink(undefined, undefined, targetLink.id),
        ),
      },
      {
        id: "delete",
        label: "Excluir relação",
        caption: "Excluir",
        icon: "trash",
        disabled: guarded,
        action: radialAction(() =>
          setEditor({
            kind: "confirm",
            message: "Excluir esta relação? Os cards serão preservados.",
            command: {
              action: "link.delete",
              linkId: targetLink.id,
              expectedVersion: targetLink.version,
            },
          }),
        ),
      },
    ];
  }

  return (
    <section
      className="archive-page"
      ref={root}
      aria-label="Fichário do Mestre"
      onFocusCapture={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        const card = target?.closest<HTMLElement>("[data-placement]");
        const link = target?.closest("[data-link]")?.getAttribute("data-link");
        lastCanvasFocus.current = card
          ? { kind: "card", id: card.dataset.placement! }
          : link
            ? { kind: "link", id: link }
            : null;
      }}
    >
      <div className="archive-notices">
        {error && !editor ? (
          <div className="archive-alert" role="alert">
            <p>{error}</p>
            {pending && !conflict ? (
              <button
                className="btn"
                disabled={busy}
                onClick={() => void perform(pending)}
              >
                Tentar salvar novamente
              </button>
            ) : null}
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                setPending(null);
                gestureCommit.current = null;
                setVisual({});
                setEditor(null);
                setError("");
                setBusy(true);
                void refresh(boardId)
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              {pending ? "Descartar alterações e recarregar" : "Recarregar"}
            </button>
          </div>
        ) : null}
        {changed ? (
          <div className="archive-alert">
            O Arquivo foi alterado em outra janela. Suas alterações locais estão
            preservadas.
          </div>
        ) : null}
      </div>
      {graph ? (
        <>
          <ArchiveReader
            ref={reader}
            graph={graph}
            projection={projection}
            busy={guarded}
            onFilterGroup={(id) =>
              setFilters((previous) => ({
                ...previous,
                [boardId]: {
                  ...(previous[boardId] ?? EMPTY_ARCHIVE_FILTER),
                  groupIds: [id],
                },
              }))
            }
            onEdit={(cardId) => {
              const p = current.current.graph?.placements.find(
                (p) => p.cardId === cardId,
              );
              if (p) editCard(p.id);
            }}
          />
          <ArchiveCanvas
            key={graph.board.id}
            graph={previewGraph!}
            layout={layout!}
            snapshot={graph}
            presentation={presentation}
            nodes={projection!.nodes}
            onToggle={toggleBranches}
            filter={filterPresentation ?? undefined}
            camera={camera}
            onCamera={onCamera}
            selected={selected}
            onSelect={selectIntentional}
            onConsult={consult}
            onMenu={openContextMenu}
            visual={visual}
            onVisual={visualGesture}
            onMove={(id, g, mode, start) => {
              const persisted = graph.placements.find((p) => p.id === id);
              if (!persisted) return;
              gestureCommit.current = { id, visual: g, mode };
              const parent = persisted.parentPlacementId
                ? (presentation.current?.geometry(
                    persisted.parentPlacementId,
                  ) ?? layout?.geometry.get(persisted.parentPlacementId))
                : null;
              const relative =
                parent && (mode === "move" || isCustomBranch(persisted))
                  ? {
                      parentPlacementId: persisted.parentPlacementId!,
                      ...branchVector(g, parent),
                    }
                  : undefined;
              const geometry = archiveGestureCommit(persisted, start, g, mode);
              // Arraste de ramo guarda intenção relativa, sem reescrever sua geometria independente.
              if (relative && mode === "move") {
                geometry.x = persisted.x;
                geometry.y = persisted.y;
              }
              run({
                action: "placement.update",
                boardId,
                placementId: id,
                expectedVersion: graph.board.version,
                geometry,
                ...(relative ? { relative } : {}),
              });
            }}
            onConnect={(a, b) => openLink(a, b)}
            busy={guarded || editor?.kind === "card"}
            onInteraction={onInteraction}
          />
        </>
      ) : !loading ? (
        <div className="archive-welcome">
          <Icon name="book" size={44} />
          <h3>Seu Arquivo começa com um quadro</h3>
          <p>
            Organize locais, pessoas e pistas em uma malha livre, visível apenas
            ao Mestre.
          </p>
          <button
            className="btn btn-primary"
            disabled={guarded}
            onClick={() => openBoard()}
          >
            Criar primeiro quadro
          </button>
        </div>
      ) : null}
      <footer className="archive-dock" aria-label="Controles do Fichário">
        <div className="archive-dock-row">
          <header className="archive-toolbar">
            <div className="archive-dock-brand">
              <h2 aria-label="Fichário do Mestre" title="Fichário do Mestre">
                <Icon name="book" />{" "}
                <span>
                  Fichário
                  <span className="archive-dock-brand-extra"> do Mestre</span>
                </span>
              </h2>
            </div>
            <ArchiveFilterControls
              groups={groups}
              state={filterState}
              result={filterPresentation}
              disabled={guarded}
              onManage={() => setGroupsOpen(true)}
              onChange={(state) =>
                setFilters((previous) => ({ ...previous, [boardId]: state }))
              }
            />
            <button
              className="btn btn-small"
              type="button"
              aria-label="Agrupamentos"
              title="Agrupamentos narrativos"
              onClick={() => setGroupsOpen(true)}
            >
              <Icon name="flag" size={14} /> Grupos
            </button>
            <label className="archive-board-select">
              <span>Quadro</span>
              <select
                aria-label="Quadro narrativo"
                value={boardId}
                disabled={guarded || !!editor}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelected(null);
                  void refresh(id).catch((e) => setError(e.message));
                }}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn"
              type="button"
              disabled={guarded}
              aria-label="Novo quadro"
              title="Novo quadro"
              onClick={() => openBoard()}
            >
              <Icon name="plus" size={14} /> Quadro
            </button>
            {graph ? (
              <>
                <button
                  className="btn"
                  type="button"
                  disabled={guarded}
                  aria-label="Editar quadro"
                  title="Editar quadro"
                  onClick={() => openBoard(true)}
                >
                  <Icon name="quill" size={14} /> Editar
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={guarded}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    draftPosition.current = null;
                    setRadial({
                      kind: "create",
                      point: {
                        x: rect.left + rect.width / 2,
                        y: rect.top - 112,
                      },
                    });
                  }}
                >
                  <Icon name="plus" size={14} /> Novo card
                </button>
                <button
                  className="btn"
                  type="button"
                  aria-label="Adicionar existente"
                  title="Adicionar card existente"
                  disabled={guarded}
                  onClick={() => {
                    draftPosition.current = null;
                    setEditor({ kind: "library" });
                    void listCards()
                      .then((r) => setLibrary(r.cards))
                      .catch((e) => setError(e.message));
                  }}
                >
                  <Icon name="book" size={14} /> Existente
                </button>
              </>
            ) : null}
            {layout?.diagnostics.residuals.length ? (
              <small
                role="status"
                className="archive-layout-status"
                title="Os limites locais de organização foram atingidos. Você pode ajustar os cards manualmente."
              >
                {layout.diagnostics.residuals.length} conflitos de layout
              </small>
            ) : null}
            <span className="archive-save" role="status">
              {busy
                ? "Salvando…"
                : pending
                  ? "Alterações não salvas"
                  : loading
                    ? "Carregando…"
                    : "Salvo"}
            </span>
          </header>
          {graph ? (
            <div className="archive-dock-secondary">
              <div className="archive-tools">
                <button
                  className="btn btn-small"
                  onClick={() => {
                    const r = root
                      .current!.querySelector(".archive-viewport")!
                      .getBoundingClientRect();
                    onCamera(
                      zoomArchive(
                        camera,
                        { x: r.width / 2, y: r.height / 2 },
                        1 / 1.2,
                      ),
                    );
                  }}
                  aria-label="Afastar"
                >
                  −
                </button>
                <span>{Math.round(camera.zoom * 100)}%</span>
                <button
                  className="btn btn-small"
                  onClick={() => {
                    const r = root
                      .current!.querySelector(".archive-viewport")!
                      .getBoundingClientRect();
                    onCamera(
                      zoomArchive(
                        camera,
                        { x: r.width / 2, y: r.height / 2 },
                        1.2,
                      ),
                    );
                  }}
                  aria-label="Aproximar"
                >
                  +
                </button>
                <button className="btn btn-small" onClick={fit}>
                  Enquadrar
                </button>
              </div>

              {selectedPlace || selectedLink ? (
                <div className="archive-selection">
                  <strong>
                    {selectedPlace?.card.title ??
                      (selectedLink?.label ||
                        NARRATIVE_RELATION_LABELS[selectedLink!.relation])}
                  </strong>
                  <button
                    className="btn btn-small"
                    disabled={guarded}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      openContextMenu(
                        { x: rect.left + rect.width / 2, y: rect.top - 112 },
                        selected,
                      );
                    }}
                  >
                    Ações
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <ArchiveDockHelp />
      </footer>
      {groupsOpen ? (
        <ArchiveGroupManager
          groups={groups}
          onClose={() => setGroupsOpen(false)}
          onRefresh={() => refresh(boardId)}
        />
      ) : null}
      {radial && !editor ? (
        <SceneEditorRadialMenu
          point={radial.point}
          menuId={`${radial.kind}:${radial.group ?? radial.targetId ?? ""}`}
          title={radialTitle}
          options={radialOptions}
          onClose={closeRadial}
          onBack={
            radial.kind === "category"
              ? () => setRadial({ ...radial, kind: "create", group: undefined })
              : radial.kind === "branches"
                ? () => setRadial({ ...radial, kind: "card" })
                : radial.kind === "create" && radial.parentPlacementId
                  ? () =>
                      setRadial({
                        ...radial,
                        kind: "branches",
                        targetId: radial.parentPlacementId,
                      })
                  : undefined
          }
          centerLabel={
            radial.kind === "category" ||
            radial.kind === "branches" ||
            radial.parentPlacementId
              ? "Voltar no menu do Fichário"
              : "Fechar menu do Fichário"
          }
        />
      ) : null}
      {editor ? (
        <ArchiveDialog
          key={editor.kind === "card" ? "card-side" : "modal"}
          side={editor.kind === "card"}
          title={
            editor.kind === "board"
              ? "Quadro narrativo"
              : editor.kind === "card"
                ? "Card narrativo"
                : editor.kind === "link"
                  ? "Relação narrativa"
                  : editor.kind === "library"
                    ? "Cards do Arquivo"
                    : "Confirmar exclusão"
          }
          onClose={() => {
            if (!pending) setEditor(null);
            else
              setError(
                "Há um salvamento pendente. Tente novamente ou descarte as alterações.",
              );
          }}
          busy={busy}
        >
          {"parentPlacementId" in editor && editor.parentPlacementId ? (
            <fieldset className="archive-branch-relation" disabled={guarded}>
              <legend>
                Ramificação de{" "}
                {
                  graph?.placements.find(
                    (p) => p.id === editor.parentPlacementId,
                  )?.card.title
                }
              </legend>
              <label>
                <input
                  type="checkbox"
                  checked={branchRelationEnabled}
                  onChange={(e) => setBranchRelationEnabled(e.target.checked)}
                />
                Também registrar ou reutilizar relação narrativa
              </label>
              {branchRelationEnabled ? (
                <>
                  <label>
                    Relação narrativa
                    <select
                      aria-label="Relação narrativa"
                      value={branchRelation}
                      onChange={(e) =>
                        setBranchRelation(e.target.value as NarrativeRelation)
                      }
                    >
                      {NARRATIVE_RELATIONS.map((r) => (
                        <option key={r} value={r}>
                          {NARRATIVE_RELATION_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={branchDirected}
                      onChange={(e) => setBranchDirected(e.target.checked)}
                    />{" "}
                    Relação direcional
                  </label>
                  {branchRelation === "custom" ? (
                    <label>
                      Nome da relação
                      <input
                        maxLength={160}
                        value={branchLabel}
                        onChange={(e) => setBranchLabel(e.target.value)}
                      />
                    </label>
                  ) : null}
                </>
              ) : null}
            </fieldset>
          ) : null}
          {editor.kind === "confirm" ? (
            <>
              <p>{editor.message}</p>
              <button
                className="btn btn-danger"
                disabled={guarded}
                onClick={() => run(editor.command)}
              >
                Confirmar
              </button>
            </>
          ) : editor.kind === "library" ? (
            <>
              <label>
                Buscar card
                <input
                  type="search"
                  value={libraryQuery}
                  onChange={(e) => setLibraryQuery(e.target.value)}
                />
              </label>
              <ul className="archive-library">
                {library
                  .filter((c) =>
                    c.title
                      .toLocaleLowerCase()
                      .includes(libraryQuery.toLocaleLowerCase()),
                  )
                  .map((c) => (
                    <li key={c.id}>
                      <button
                        className="btn"
                        disabled={
                          guarded ||
                          graph?.placements.some(
                            (p) =>
                              p.cardId === c.id &&
                              (!editor.parentPlacementId ||
                                branchAncestors.has(p.id) ||
                                !!p.parentPlacementId),
                          )
                        }
                        onClick={() => {
                          if (!graph) return;
                          const place = graph.placements.find(
                            (p) => p.cardId === c.id,
                          );
                          const branch = editor.parentPlacementId
                            ? {
                                parentPlacementId: editor.parentPlacementId,
                                ...(branchRelationEnabled
                                  ? {
                                      branchRelation: {
                                        relation: branchRelation,
                                        label: branchLabel,
                                        directed: branchDirected,
                                        description: "",
                                      },
                                    }
                                  : {}),
                              }
                            : {};
                          if (place && editor.parentPlacementId)
                            run({
                              action: "placement.parent",
                              boardId,
                              placementId: place.id,
                              parentPlacementId: editor.parentPlacementId,
                              expectedVersion: graph.board.version,
                              ...branch,
                            });
                          else
                            run({
                              action: "placement.add",
                              boardId,
                              cardId: c.id,
                              expectedVersion: graph.board.version,
                              geometry: geometry(editor.parentPlacementId),
                              ...branch,
                            });
                        }}
                      >
                        {c.title}{" "}
                        <small>
                          {
                            NARRATIVE_CATEGORY_LABELS[
                              c.category as NarrativeCategory
                            ]
                          }
                        </small>
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (guarded) return;
                if (editor.kind === "board")
                  run(
                    editor.id
                      ? {
                          action: "board.update",
                          boardId: editor.id,
                          expectedVersion: editor.version!,
                          name: draft.title,
                          description: draft.description,
                        }
                      : {
                          action: "board.create",
                          name: draft.title,
                          description: draft.description,
                        },
                  );
                if (editor.kind === "card" && graph) {
                  const content = {
                    title: draft.title,
                    category: draft.category,
                    summary: draft.summary,
                    content: draft.content,
                    groupIds: draft.groupIds,
                  };
                  run(
                    editor.id
                      ? {
                          action: "card.update",
                          cardId: editor.id,
                          expectedVersion: editor.version!,
                          ...content,
                        }
                      : {
                          action: "card.create",
                          boardId,
                          expectedVersion: graph.board.version,
                          geometry: geometry(editor.parentPlacementId),
                          ...(editor.parentPlacementId
                            ? {
                                parentPlacementId: editor.parentPlacementId,
                                ...(branchRelationEnabled
                                  ? {
                                      branchRelation: {
                                        relation: branchRelation,
                                        label: branchLabel,
                                        directed: branchDirected,
                                        description: "",
                                      },
                                    }
                                  : {}),
                              }
                            : {}),
                          ...content,
                        },
                  );
                }
                if (
                  editor.kind === "link" &&
                  editor.sourceId &&
                  editor.targetId
                ) {
                  const relation = {
                    sourceId: editor.sourceId,
                    targetId: editor.targetId,
                    relation: draft.relation,
                    label: draft.label,
                    directed: draft.directed,
                    description: draft.description,
                  };
                  run(
                    editor.id
                      ? {
                          action: "link.update",
                          linkId: editor.id,
                          expectedVersion: editor.version!,
                          ...relation,
                        }
                      : { action: "link.create", boardId, ...relation },
                  );
                }
              }}
            >
              {editor.kind !== "link" ? (
                <label>
                  {editor.kind === "board" ? "Nome" : "Título"}
                  <input
                    autoFocus
                    required
                    maxLength={160}
                    value={draft.title}
                    disabled={guarded}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </label>
              ) : null}
              {editor.kind === "card" ? (
                <>
                  <label>
                    Categoria
                    <select
                      aria-label="Categoria"
                      value={draft.category}
                      disabled={guarded}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          category: e.target.value as NarrativeCategory,
                        })
                      }
                    >
                      {NARRATIVE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {NARRATIVE_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ArchiveGroupPicker
                    disabled={guarded}
                    groups={groups}
                    selected={draft.groupIds}
                    onChange={(ids) => setDraft({ ...draft, groupIds: ids })}
                    onManage={() => setGroupsOpen(true)}
                  />
                  <label>
                    Resumo
                    <textarea
                      aria-label="Resumo"
                      maxLength={1000}
                      value={draft.summary}
                      disabled={guarded}
                      onChange={(e) =>
                        setDraft({ ...draft, summary: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Conteúdo narrativo
                    <textarea
                      aria-label="Conteúdo narrativo"
                      className="archive-content"
                      maxLength={100000}
                      value={draft.content}
                      disabled={guarded}
                      onChange={(e) =>
                        setDraft({ ...draft, content: e.target.value })
                      }
                    />
                  </label>
                </>
              ) : null}
              {editor.kind === "link" ? (
                <>
                  <label>
                    Tipo
                    <select
                      aria-label="Tipo"
                      autoFocus
                      value={draft.relation}
                      disabled={guarded}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          relation: e.target.value as NarrativeRelation,
                        })
                      }
                    >
                      {NARRATIVE_RELATIONS.map((r) => (
                        <option key={r} value={r}>
                          {NARRATIVE_RELATION_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {draft.relation === "custom" ? (
                    <label>
                      Nome da relação
                      <input
                        maxLength={160}
                        required
                        value={draft.label}
                        disabled={guarded}
                        onChange={(e) =>
                          setDraft({ ...draft, label: e.target.value })
                        }
                      />
                    </label>
                  ) : null}
                  <label className="archive-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.directed}
                      disabled={guarded}
                      onChange={(e) =>
                        setDraft({ ...draft, directed: e.target.checked })
                      }
                    />{" "}
                    Direcional (origem → destino)
                  </label>
                </>
              ) : null}
              {editor.kind !== "card" ? (
                <label>
                  Descrição
                  <textarea
                    maxLength={4000}
                    value={draft.description}
                    disabled={guarded}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                  />
                </label>
              ) : null}
              <footer>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={guarded}
                >
                  Salvar
                </button>
                {editor.kind === "board" && editor.id ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={guarded}
                    onClick={() =>
                      setEditor({
                        kind: "confirm",
                        message:
                          "Excluir o quadro e suas posições? Os cards e relações continuam disponíveis no Arquivo.",
                        command: {
                          action: "board.delete",
                          boardId: editor.id!,
                          expectedVersion: editor.version!,
                        },
                      })
                    }
                  >
                    Excluir quadro
                  </button>
                ) : null}
              </footer>
            </form>
          )}
          {error ? (
            <p className="archive-error" role="alert">
              {error}
            </p>
          ) : null}
          {pending && !conflict ? (
            <button
              className="btn"
              disabled={busy}
              onClick={() => void perform(pending)}
            >
              Tentar salvar novamente
            </button>
          ) : null}
          {pending ? (
            <button
              className="btn"
              disabled={busy}
              onClick={() => {
                setPending(null);
                setVisual({});
                setEditor(null);
                setError("");
                setBusy(true);
                void refresh(boardId)
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              Descartar alterações e recarregar
            </button>
          ) : null}
        </ArchiveDialog>
      ) : null}
    </section>
  );
}
