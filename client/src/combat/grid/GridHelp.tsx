import { useEffect, useId, useRef, useState } from 'react';

/** Ajuda fora da superfície de gestos; hover/foco consultam e clique fixa a leitura. */
export function GridHelp({ isMaster, hint }: { isMaster: boolean; hint: string }) {
  const [pinned, setPinned] = useState(false), [hover, setHover] = useState(false), [focus, setFocus] = useState(false);
  const root = useRef<HTMLDivElement>(null), id = useId();
  const open = pinned || hover || focus;
  useEffect(() => {
    if (!pinned) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setPinned(false); setFocus(false); } };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [pinned]);
  return <div className="grid-help" ref={root} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); setPinned(false); setHover(false); setFocus(false); } }}>
    <button type="button" className="grid-help-button" aria-label="Ajuda do grid" aria-expanded={open} aria-controls={id}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      onClick={() => { setPinned(value => !value); setHover(false); setFocus(false); }}>?</button>
    {open ? <div id={id} className="grid-help-panel" role="tooltip">
      <strong>Controles do grid</strong>
      <dl>
        <dt>Mover o token</dt><dd>Arraste o token sob seu controle e confirme o movimento na prévia.</dd>
        <dt>Mover a câmera</dt><dd>Segure Espaço e arraste, ou use o botão do meio do mouse.</dd>
        <dt>Zoom</dt><dd>Segure Ctrl e gire a rodinha do mouse, ou use os botões − e +. Enquadrar mostra a cena; Centralizar retorna ao foco do combate.</dd>
        <dt>Medir</dt><dd>Segure F para usar a régua. Esc cancela a operação atual.</dd>
        <dt>Sinalizar</dt><dd>Segure Alt e clique no mapa para enviar um ping à mesa.</dd>
        <dt>Menu radial</dt><dd>Clique com o botão direito em uma célula vazia para acessar as ferramentas de área{isMaster ? ', participantes e marcações do terreno' : ''}.</dd>
        {isMaster ? <><dt>Ajustar um token</dt><dd>Clique com o botão direito no token para abrir seus ajustes de combate.</dd>
          <dt>Cena e posicionamento</dt><dd>Na barra inferior, configure a cena, posicione unidades e ajuste sua visibilidade.</dd></> : null}
      </dl>
      <p className="grid-help-context">{hint}</p>
    </div> : null}
  </div>;
}
