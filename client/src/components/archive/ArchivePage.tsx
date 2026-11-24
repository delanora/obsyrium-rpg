import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { newId } from "../../utils";
import { ApiError } from "../../api";
import {
  ARCHIVE_CHANGED,
  archiveOperation,
  listBoards,
  listCards,
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
} from "../../../../src/modules/shared/narrative";
import { Icon } from "../Icon";
import {
  ArchiveCanvas,
  type ArchiveSelection,
  type Geometry,
} from "./ArchiveCanvas";
import {
  cameraPoint,
  fitArchive,
  zoomArchive,
  type ArchiveCamera,
} from "./archiveCamera";
import "./archive.css";
type Command = ArchiveOperation extends infer T
  ? T extends { operationId: string }
    ? Omit<T, "operationId">
    : never
  : never;
type Editor =
  | {
      kind: "board" | "card" | "link";
      id?: string;
      version?: number;
      sourceId?: string;
      targetId?: string;
    }
  | { kind: "library" }
  | { kind: "confirm"; command: Command; message: string };
function ArchiveDialog({
  title,
  children,
  onClose,
  busy,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
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
  const [boards, setBoards] = useState<NarrativeBoardDto[]>([]),
    [boardId, setBoardId] = useState(""),
    [graph, setGraph] = useState<NarrativeGraphDto | null>(null);
  const [selected, setSelected] = useState<ArchiveSelection>(null),
    [camera, setCamera] = useState<ArchiveCamera>({ x: 60, y: 60, zoom: 1 });
  const [visual, setVisual] = useState<Record<string, Geometry>>({}),
    [editor, setEditor] = useState<Editor | null>(null);
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
    relation: "related" as NarrativeRelation,
    label: "",
    directed: true,
  });
  const interacting = useRef(false);
  const onInteraction = useCallback((active: boolean) => {
    interacting.current = active;
  }, []);
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
  });
  current.current = { boardId, graph, editor, busy, pending, selected, camera };
  const refresh = useCallback(async (id?: string) => {
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
      setBoardId(chosen);
    } else {
      setGraph(null);
      setBoardId("");
    }
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
      fitArchive(graph.placements, viewport);
    cameras.current.set(graph.board.id, next);
    setCamera(next);
  }, [graph?.board.id]);
  const onCamera = useCallback((value: ArchiveCamera) => {
    setCamera(value);
    if (current.current.boardId)
      cameras.current.set(current.current.boardId, value);
  }, []);
  useEffect(() => {
    const update = () => {
      const c = current.current;
      if (c.busy || c.editor || c.pending || interacting.current) {
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
      setPending(null);
      setVisual({});
      setEditor(null);
      setSelected(null);
      await refresh(
        input.action === "board.create" ? receipt.id : current.current.boardId,
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
    if (r && graph) onCamera(fitArchive(graph.placements, r));
  };
  const geometry = (): Geometry => {
    const r = root.current
      ?.querySelector(".archive-viewport")
      ?.getBoundingClientRect();
    const center = cameraPoint(camera, {
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
    }));
    setEditor({ kind: "card", id: card.id, version: card.version });
  }, []);
  const newCard = () => {
    setDraft((d) => ({
      ...d,
      title: "",
      category: "note",
      summary: "",
      content: "",
    }));
    setEditor({ kind: "card" });
  };
  const openLink = (sourceId?: string, targetId?: string) => {
    const link = graph?.links.find((l) => l.id === selected?.id);
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
  return (
    <section
      className="archive-page"
      ref={root}
      aria-label="Fichário do Mestre"
    >
      <header className="archive-toolbar">
        <div>
          <h2>
            <Icon name="book" /> Fichário do Mestre
          </h2>
          <small>Arquivo privado · malha narrativa</small>
        </div>
        <label>
          Quadro
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
          onClick={() => openBoard()}
        >
          Novo quadro
        </button>
        {graph ? (
          <>
            <button
              className="btn"
              type="button"
              disabled={guarded}
              onClick={() => openBoard(true)}
            >
              Editar quadro
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={guarded}
              onClick={newCard}
            >
              <Icon name="plus" size={14} /> Novo card
            </button>
            <button
              className="btn"
              type="button"
              disabled={guarded}
              onClick={() => {
                setEditor({ kind: "library" });
                void listCards()
                  .then((r) => setLibrary(r.cards))
                  .catch((e) => setError(e.message));
              }}
            >
              Adicionar existente
            </button>
          </>
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
      {error ? (
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
              setVisual({});
              setEditor(null);
              setError("");
              void refresh(boardId).catch((e) => setError(e.message));
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
      {graph ? (
        <>
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
                  zoomArchive(camera, { x: r.width / 2, y: r.height / 2 }, 1.2),
                );
              }}
              aria-label="Aproximar"
            >
              +
            </button>
            <button className="btn btn-small" onClick={fit}>
              Enquadrar
            </button>
            <span className="archive-help">
              Arraste o fundo para navegar · roda para zoom · arraste o + para
              conectar
            </span>
          </div>
          <ArchiveCanvas
            key={graph.board.id}
            graph={graph}
            camera={camera}
            onCamera={onCamera}
            selected={selected}
            onSelect={setSelected}
            onEdit={editCard}
            visual={visual}
            onVisual={setVisual}
            onMove={(id, g) =>
              run({
                action: "placement.update",
                boardId,
                placementId: id,
                expectedVersion: graph.board.version,
                geometry: g,
              })
            }
            onConnect={(a, b) => openLink(a, b)}
            busy={guarded}
            onInteraction={onInteraction}
          />
          <div className="archive-selection" aria-live="polite">
            {selectedPlace ? (
              <>
                <strong>{selectedPlace.card.title}</strong>
                <button
                  className="btn btn-small"
                  disabled={guarded}
                  onClick={() => editCard()}
                >
                  Editar conteúdo
                </button>
                <button
                  className="btn btn-small"
                  disabled={guarded}
                  onClick={() =>
                    setEditor({
                      kind: "confirm",
                      message:
                        "Remover somente deste quadro? O conteúdo e suas relações continuam no Arquivo.",
                      command: {
                        action: "placement.remove",
                        boardId,
                        placementId: selectedPlace.id,
                        expectedVersion: graph.board.version,
                      },
                    })
                  }
                >
                  Remover do quadro
                </button>
                <button
                  className="btn btn-danger btn-small"
                  disabled={guarded}
                  onClick={() =>
                    setEditor({
                      kind: "confirm",
                      message:
                        "Excluir definitivamente este card de todos os quadros e apagar suas relações? Esta ação não pode ser revertida.",
                      command: {
                        action: "card.delete",
                        cardId: selectedPlace.cardId,
                        expectedVersion: selectedPlace.card.version,
                      },
                    })
                  }
                >
                  Excluir card
                </button>
              </>
            ) : selectedLink ? (
              <>
                <strong>
                  {selectedLink.label ||
                    NARRATIVE_RELATION_LABELS[selectedLink.relation]}
                </strong>
                <button
                  className="btn btn-small"
                  disabled={guarded}
                  onClick={() => openLink()}
                >
                  Editar relação
                </button>
                <button
                  className="btn btn-danger btn-small"
                  disabled={guarded}
                  onClick={() =>
                    setEditor({
                      kind: "confirm",
                      message:
                        "Excluir esta relação em todos os quadros? Os cards serão preservados.",
                      command: {
                        action: "link.delete",
                        linkId: selectedLink.id,
                        expectedVersion: selectedLink.version,
                      },
                    })
                  }
                >
                  Excluir relação
                </button>
              </>
            ) : (
              <span>Selecione um card ou uma conexão para editar.</span>
            )}
          </div>
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
      {editor ? (
        <ArchiveDialog
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
                          graph?.placements.some((p) => p.cardId === c.id)
                        }
                        onClick={() =>
                          graph &&
                          run({
                            action: "placement.add",
                            boardId,
                            cardId: c.id,
                            expectedVersion: graph.board.version,
                            geometry: geometry(),
                          })
                        }
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
                          geometry: geometry(),
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
                  <label>
                    Resumo
                    <textarea
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
                void refresh(boardId).catch((e) => setError(e.message));
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
