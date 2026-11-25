import { useEffect, useRef, useState } from "react";
import type {
  NarrativeGroupDto,
  NarrativeGroupSummaryDto,
} from "../../../../src/modules/shared/narrative";
import { archiveOperation, type ArchiveOperation } from "../../archiveApi";
import { newId } from "../../utils";
import type {
  ArchiveFilterState,
  ArchiveFilterPresentation,
} from "./archiveFilters";
export function GroupChips({
  groups,
  onPick,
}: {
  groups: readonly NarrativeGroupSummaryDto[];
  onPick?: (id: string) => void;
}) {
  return (
    <div className="archive-group-chips">
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(g.id)}
          style={
            {
              "--group-color": /^#[0-9A-Fa-f]{6}$/.test(g.color)
                ? g.color
                : "#B89A5A",
            } as React.CSSProperties
          }
        >
          {g.name}
        </button>
      ))}
    </div>
  );
}
export function ArchiveFilterControls({
  groups,
  state,
  result,
  onChange,
  onManage,
  disabled,
}: {
  groups: NarrativeGroupDto[];
  state: ArchiveFilterState;
  result: ArchiveFilterPresentation | null;
  onChange: (s: ArchiveFilterState) => void;
  onManage: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  return (
    <div className="archive-filter-controls">
      <button
        className="btn btn-small"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Filtros{result?.active ? ` (${result.total})` : ""}
      </button>
      {open ? (
        <section
          className="archive-filter-popover"
          aria-label="Filtros de agrupamentos"
        >
          <input
            aria-label="Pesquisar filtros"
            placeholder="Pesquisar agrupamentos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="archive-group-options">
            {groups
              .filter((g) =>
                g.name
                  .toLocaleLowerCase("pt-BR")
                  .includes(query.toLocaleLowerCase("pt-BR")),
              )
              .map((g) => (
                <label key={g.id}>
                  <input
                    type="checkbox"
                    checked={state.groupIds.includes(g.id)}
                    disabled={disabled}
                    onChange={() =>
                      onChange({
                        ...state,
                        groupIds: state.groupIds.includes(g.id)
                          ? state.groupIds.filter((id) => id !== g.id)
                          : [...state.groupIds, g.id],
                      })
                    }
                  />
                  <span aria-hidden="true" style={{ color: g.color }}>
                    ●
                  </span>
                  {g.name}
                </label>
              ))}
            {!groups.length ? <p>Nenhum agrupamento criado.</p> : null}
          </div>
          <label>
            Combinação
            <select
              aria-label="Combinação dos filtros"
              value={state.match}
              onChange={(e) =>
                onChange({
                  ...state,
                  match: e.target.value as ArchiveFilterState["match"],
                })
              }
            >
              <option value="any">Qualquer um</option>
              <option value="all">Todos</option>
            </select>
          </label>
          <label>
            Apresentação
            <select
              aria-label="Modo do filtro"
              value={state.mode}
              onChange={(e) =>
                onChange({
                  ...state,
                  mode: e.target.value as ArchiveFilterState["mode"],
                })
              }
            >
              <option value="highlight">Destaque</option>
              <option value="isolate">Isolamento</option>
            </select>
          </label>
          {result?.active ? (
            <p role="status">
              {result.total} cards correspondentes neste quadro ·{" "}
              {result.visible} visíveis · {result.collapsed} recolhidos
            </p>
          ) : (
            <p>Sem filtros ativos.</p>
          )}
          <button
            className="btn btn-small"
            type="button"
            onClick={() => onChange({ ...state, groupIds: [] })}
          >
            Limpar filtros
          </button>
          <button className="btn btn-small" type="button" onClick={onManage}>
            Gerenciar agrupamentos
          </button>
        </section>
      ) : null}
    </div>
  );
}
export function ArchiveGroupPicker({
  groups,
  selected,
  onChange,
  onManage,
  disabled = false,
}: {
  disabled?: boolean;
  groups: NarrativeGroupDto[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onManage: () => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <fieldset className="archive-group-picker" disabled={disabled}>
      <legend>Agrupamentos</legend>
      <input
        aria-label="Pesquisar agrupamentos do card"
        placeholder="Pesquisar agrupamentos existentes"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="archive-group-options">
        {groups
          .filter((g) =>
            g.name
              .toLocaleLowerCase("pt-BR")
              .includes(query.toLocaleLowerCase("pt-BR")),
          )
          .map((g) => (
            <label key={g.id}>
              <input
                type="checkbox"
                checked={selected.includes(g.id)}
                disabled={!selected.includes(g.id) && selected.length >= 30}
                onChange={() =>
                  onChange(
                    selected.includes(g.id)
                      ? selected.filter((id) => id !== g.id)
                      : [...selected, g.id],
                  )
                }
              />
              <span aria-hidden="true" style={{ color: g.color }}>
                ●
              </span>
              {g.name}
            </label>
          ))}
      </div>
      <small>
        {selected.length}/30 · associações serão guardadas ao salvar o card.
      </small>
      <button type="button" className="btn btn-small" onClick={onManage}>
        Criar ou gerenciar agrupamentos
      </button>
    </fieldset>
  );
}
export function ArchiveGroupManager({
  groups,
  onClose,
  onRefresh,
}: {
  groups: NarrativeGroupDto[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const [query, setQuery] = useState(""),
    [editing, setEditing] = useState<NarrativeGroupDto | null>(null),
    [removing, setRemoving] = useState<NarrativeGroupDto | null>(null);
  const [name, setName] = useState(""),
    [color, setColor] = useState("#B89A5A"),
    [description, setDescription] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<ArchiveOperation | null>(null);
  const lock = useRef(false);
  const reset = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setColor("#B89A5A");
    setPending(null);
    setError("");
    setRemoving(null);
  };
  const perform = async (input: ArchiveOperation) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setPending(input);
    setError("");
    try {
      await archiveOperation(input);
      await onRefresh();
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="archive-group-manager"
      aria-label="Agrupamentos narrativos"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2>Agrupamentos narrativos</h2>
        <button
          type="button"
          aria-label="Fechar agrupamentos"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <p>
        Biblioteca global do Arquivo · não altera categorias, relações ou
        ramificações.
      </p>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {pending && !busy ? (
        <div>
          <button className="btn" onClick={() => void perform(pending)}>
            Tentar novamente
          </button>
          <button
            className="btn"
            onClick={() => {
              reset();
              void onRefresh();
            }}
          >
            Descartar pedido e recarregar
          </button>
        </div>
      ) : null}
      <input
        aria-label="Pesquisar biblioteca de agrupamentos"
        placeholder="Pesquisar pelo nome"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="archive-group-library">
        {groups
          .filter((g) =>
            g.name
              .toLocaleLowerCase("pt-BR")
              .includes(query.toLocaleLowerCase("pt-BR")),
          )
          .map((g) => (
            <li key={g.id}>
              <span aria-hidden="true" style={{ color: g.color }}>
                ●
              </span>
              <strong>{g.name}</strong>
              <small>{g.cardCount} cards globais</small>
              <button
                type="button"
                className="btn btn-small"
                disabled={busy || !!pending}
                onClick={() => {
                  setEditing(g);
                  setName(g.name);
                  setColor(g.color);
                  setDescription(g.description);
                  setRemoving(null);
                }}
              >
                Editar {g.name}
              </button>
              <button
                type="button"
                className="btn btn-small"
                disabled={busy || !!pending}
                onClick={() => setRemoving(g)}
              >
                Excluir {g.name}
              </button>
            </li>
          ))}
      </ul>
      {removing ? (
        <section
          role="alertdialog"
          aria-label="Confirmar exclusão do agrupamento"
        >
          <h3>Excluir {removing.name}?</h3>
          <p>
            {removing.cardCount} cards associados globalmente. Somente os
            vínculos com este agrupamento serão removidos. Os cards e suas
            representações serão preservados.
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() => setRemoving(null)}
          >
            Cancelar exclusão
          </button>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() =>
              void perform({
                action: "group.delete",
                groupId: removing.id,
                expectedVersion: removing.version,
                operationId: newId(),
              })
            }
          >
            Confirmar exclusão
          </button>
        </section>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void perform({
              action: editing ? "group.update" : "group.create",
              ...(editing
                ? { groupId: editing.id, expectedVersion: editing.version }
                : {}),
              name,
              color,
              description,
              operationId: newId(),
            } as ArchiveOperation);
          }}
        >
          <h3>{editing ? "Editar agrupamento" : "Criar agrupamento"}</h3>
          <label>
            Nome
            <input
              required
              maxLength={80}
              aria-label="Nome do agrupamento"
              value={name}
              disabled={busy || !!pending}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Cor
            <input
              type="color"
              aria-label="Cor do agrupamento"
              value={color}
              disabled={busy || !!pending}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          <label>
            Descrição
            <textarea
              maxLength={500}
              aria-label="Descrição do agrupamento"
              value={description}
              disabled={busy || !!pending}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" disabled={busy || !!pending}>
            {editing ? "Salvar agrupamento" : "Criar agrupamento"}
          </button>
          {editing ? (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={reset}
            >
              Cancelar edição do agrupamento
            </button>
          ) : null}
        </form>
      )}
      <small>
        Criar um agrupamento persiste a biblioteca imediatamente; cancelar o
        editor do card não exclui o agrupamento.
      </small>
    </dialog>
  );
}
