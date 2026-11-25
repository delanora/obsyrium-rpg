import { useEffect, useId, useRef, useState } from "react";
import { ArchiveDockPopover } from "./ArchiveDockPopover";

/** Mesmo gesto da ajuda da bandeja: hover/foco consulta; clique mantém aberto. */
export function ArchiveDockHelp() {
  const [fixada, setFixada] = useState(false),
    [hover, setHover] = useState(false),
    [foco, setFoco] = useState(false);
  const raiz = useRef<HTMLDivElement>(null),
    atraso = useRef<ReturnType<typeof setTimeout> | null>(null),
    id = useId();
  const aberta = fixada || hover || foco;
  const entrar = () => {
    if (atraso.current) clearTimeout(atraso.current);
    setHover(true);
  };
  const sair = () => {
    if (atraso.current) clearTimeout(atraso.current);
    atraso.current = setTimeout(() => setHover(false), 160);
  };
  const fechar = () => {
    setFixada(false);
    setHover(false);
    setFoco(false);
  };
  useEffect(
    () => () => {
      if (atraso.current) clearTimeout(atraso.current);
    },
    [],
  );
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (
        !raiz.current?.contains(e.target as Node) &&
        !document.getElementById(id)?.contains(e.target as Node)
      )
        fechar();
    };
    const teclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        fechar();
      }
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", teclado, true);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", teclado, true);
    };
  }, [aberta, id]);
  return (
    <div
      className="archive-dock-help"
      ref={raiz}
      onMouseEnter={entrar}
      onMouseLeave={sair}
    >
      <button
        className="archive-guide-button"
        type="button"
        aria-label="Ajuda do Fichário do Mestre"
        aria-expanded={aberta}
        aria-controls={id}
        aria-describedby={aberta ? id : undefined}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        onClick={() => {
          setFixada((v) => !v);
          setHover(false);
          setFoco(false);
        }}
      >
        ?
      </button>
      {aberta ? (
        <ArchiveDockPopover
          anchor={raiz}
          className="archive-guide-panel"
          id={id}
          role="tooltip"
          onMouseEnter={entrar}
          onMouseLeave={sair}
        >
          <strong>Como usar o Fichário</strong>
          <dl>
            <dt>Navegar</dt>
            <dd>
              Arraste o fundo para mover a câmera. Use a roda ou − / + para o
              zoom; Enquadrar mostra o conjunto.
            </dd>
            <dt>Criar e consultar</dt>
            <dd>
              Use Novo card ou o botão direito para abrir o menu radial. Dois
              cliques em um card abrem a consulta; Enter também funciona com o
              card em foco.
            </dd>
            <dt>Organizar e relacionar</dt>
            <dd>
              Arraste o cabeçalho para mover, as bordas para redimensionar e o
              conector para criar uma relação. O menu do card permite editar e
              organizar ramificações.
            </dd>
            <dt>Ramificações</dt>
            <dd>
              Expanda ou recolha pelos controles do núcleo, preservando os
              vínculos entre os cards.
            </dd>
            <dt>Agrupamentos e filtros</dt>
            <dd>
              Classifique cards em Agrupamentos. Em Filtros, combine Qualquer um
              ou Todos e escolha Destaque ou Isolamento, sem mover os cards.
            </dd>
            <dt>Guardar alterações</dt>
            <dd>
              Confirme os formulários em Salvar. O indicador da barra mostra o
              estado da gravação; Escape fecha menus ou cancela o gesto atual.
            </dd>
          </dl>
          <p>
            Em telas estreitas, deslize a barra para acessar todos os controles.
          </p>
        </ArchiveDockPopover>
      ) : null}
    </div>
  );
}
