import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useState,
} from "react";
import type { NarrativeGraphDto } from "../../../../src/modules/shared/narrative";
import {
  NARRATIVE_CATEGORY_LABELS,
  NARRATIVE_RELATION_LABELS,
} from "../../../../src/modules/shared/narrative";
import { ArchiveCategoryIcon } from "./ArchiveCategoryIcon";
import type { ArchiveProjection } from "./archiveProjection";
export interface ArchiveReaderHandle {
  consult: (id: string) => void;
  select: (id: string) => void;
}
/** Leitura exclusiva do snapshot privado. Abas/rolagem não alteram o estado do canvas. */
export const ArchiveReader = forwardRef<
  ArchiveReaderHandle,
  {
    graph: NarrativeGraphDto | null;
    projection: ArchiveProjection | null;
    onEdit: (cardId: string) => void;
    busy: boolean;
  }
>(function ArchiveReader({ graph, projection, onEdit, busy }, ref) {
  const [id, setId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [tab, setTab] = useState<"narrative" | "relations">("narrative");
  const [pinned, setPinned] = useState(false);
  const state = useRef({ id, pinned });
  state.current = { id, pinned };
  const panel = useRef<HTMLElement>(null);
  const open = (next: string) => {
    if (next === state.current.id) return;
    const previous = state.current.id;
    if (previous) setHistory((h) => [...h, previous].slice(-100));
    state.current.id = next;
    setId(next);
    setTab("narrative");
  };
  useImperativeHandle(ref, () => ({
    consult: open,
    select: (next) => {
      if (state.current.pinned && state.current.id) open(next);
    },
  }));
  useEffect(() => {
    const ids = new Set(graph?.placements.map((p) => p.cardId));
    if (id && !ids.has(id)) {
      setId(null);
      setHistory([]);
    } else setHistory((h) => h.filter((v) => ids.has(v)));
  }, [graph]);
  useEffect(() => {
    if (!id) return;
    const esc = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !document.querySelector("dialog[open], .scene-editor-radial-menu")
      )
        setId(null);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [id]);
  const place = graph?.placements.find((p) => p.cardId === id);
  if (!place || !graph) return null;
  const card = place.card;
  const entry = (cardId: string, detail: string, key: string) => {
    const p = graph.placements.find((v) => v.cardId === cardId);
    if (!p) return null;
    return (
      <li key={key}>
        <button type="button" onClick={() => open(cardId)}>
          <ArchiveCategoryIcon category={p.card.category} />
          <span>
            <strong>{p.card.title}</strong>
            <small>
              {NARRATIVE_CATEGORY_LABELS[p.card.category]} ·{" "}
              {projection?.visibleIds.has(p.id) ? "Visível" : "Recolhido"}
            </small>
            <span>{detail}</span>
          </span>
        </button>
      </li>
    );
  };
  return (
    <aside
      ref={panel}
      className="archive-reader"
      aria-label="Consulta narrativa"
    >
      <header>
        <ArchiveCategoryIcon category={card.category} />
        <div>
          <small>{NARRATIVE_CATEGORY_LABELS[card.category]}</small>
          <h2>{card.title}</h2>
        </div>
        <button
          type="button"
          aria-label="Fixar consulta"
          aria-pressed={pinned}
          onClick={() => setPinned(!pinned)}
        >
          {pinned ? "Desafixar" : "Fixar"}
        </button>
        <button
          type="button"
          aria-label="Fechar consulta"
          onClick={() => setId(null)}
        >
          ×
        </button>
      </header>
      <div className="archive-reader-actions">
        <button
          type="button"
          disabled={!history.length}
          onClick={() => {
            const last = history.at(-1);
            if (last) {
              setId(last);
              setHistory((h) => h.slice(0, -1));
            }
          }}
        >
          Voltar à consulta anterior
        </button>
        <button type="button" disabled={busy} onClick={() => onEdit(card.id)}>
          Editar card
        </button>
      </div>
      <nav aria-label="Conteúdo da consulta">
        <button
          type="button"
          aria-pressed={tab === "narrative"}
          onClick={() => setTab("narrative")}
        >
          Narrativa
        </button>
        <button
          type="button"
          aria-pressed={tab === "relations"}
          onClick={() => setTab("relations")}
        >
          Relações
        </button>
      </nav>
      <div className="archive-reader-scroll" key={card.id + tab}>
        {tab === "narrative" ? (
          <>
            <h3>Resumo</h3>
            <p>{card.summary || "Nenhum resumo registrado."}</p>
            <h3>Conteúdo narrativo</h3>
            <p>{card.content || "Nenhum conteúdo narrativo registrado."}</p>
          </>
        ) : (
          <>
            <p>Relações disponíveis no quadro “{graph.board.name}”.</p>
            <h3>Núcleo pai</h3>
            <ul>
              {place.parentPlacementId ? (
                (() => {
                  const parent = graph.placements.find(
                    (p) => p.id === place.parentPlacementId,
                  );
                  return (
                    parent &&
                    entry(parent.cardId, "Pertencimento estrutural", "parent")
                  );
                })()
              ) : (
                <li>Sem núcleo pai.</li>
              )}
            </ul>
            <h3>Ramificações diretas</h3>
            <ul>
              {graph.placements
                .filter((p) => p.parentPlacementId === place.id)
                .map((p) => entry(p.cardId, "Pertencimento estrutural", p.id))}
            </ul>
            <h3>Relações narrativas</h3>
            <ul>
              {graph.links
                .filter((l) => l.sourceId === id || l.targetId === id)
                .map((l) => (
                  <li key={l.id}>
                    <ul>
                      {entry(
                        l.sourceId === id ? l.targetId : l.sourceId,
                        `${NARRATIVE_RELATION_LABELS[l.relation]}${l.label ? " · " + l.label : ""} · ${l.directed ? (l.sourceId === id ? "Saída →" : "Entrada ←") : "Sem direção"}`,
                        l.id,
                      )}
                    </ul>
                    {l.description && <p>{l.description}</p>}
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
});
