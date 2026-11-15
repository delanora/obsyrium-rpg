import { useEffect, useId, useRef, useState } from 'react';
import './tray-help.css';

/** Ajuda local: hover/foco para consulta rápida; clique mantém a leitura aberta. */
export function DiceTrayHelp({ deathSave = false }: { deathSave?: boolean }) {
  const [fixada, setFixada] = useState(false);
  const [hover, setHover] = useState(false);
  const [foco, setFoco] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();
  const aberta = fixada || hover || foco;

  useEffect(() => {
    if (!fixada) return;
    const fecharFora = (event: PointerEvent) => {
      if (!raiz.current?.contains(event.target as Node)) {
        setFixada(false);
        setFoco(false);
      }
    };
    document.addEventListener('pointerdown', fecharFora);
    return () => document.removeEventListener('pointerdown', fecharFora);
  }, [fixada]);

  return <div className="dice-help" ref={raiz}
    onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    onKeyDown={event => {
      if (event.key !== 'Escape' || !aberta) return;
      event.stopPropagation();
      setFixada(false); setHover(false); setFoco(false);
    }}>
    <button type="button" className="dice-head-close dice-help-button"
      aria-label="Ajuda da bandeja" aria-expanded={aberta} aria-controls={id}
      aria-describedby={aberta ? id : undefined}
      onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}
      onClick={() => { setFixada(value => !value); setHover(false); setFoco(false); }}>?</button>
    {aberta ? <div className="dice-help-panel" id={id} role="tooltip">
      <strong>Como usar a bandeja</strong>
      {deathSave ? <p>O d20 deste teste é fixo. Clique em <b>Rolar</b> para fazer o Teste contra a Morte.</p> : <>
        <dl>
          <dt>Adicionar dados</dt><dd>Clique no tipo de dado abaixo da bandeja.</dd>
          <dt>Remover um dado</dt><dd>Clique uma vez no dado que está na bandeja.</dd>
          <dt>Remover um tipo</dt><dd>Dê dois cliques em um dado para remover todas as cópias daquele tipo.</dd>
          <dt>Limpar a seleção</dt><dd>Dê dois cliques numa parte vazia da bandeja.</dd>
          <dt>Vantagem / Desvantagem</dt><dd>Ative o botão desejado: cada d20 rola duas vezes e mantém o maior / menor resultado. Clique novamente para desativar.</dd>
          <dt>Rolar</dt><dd>Inicia a rolagem dos dados escolhidos.</dd>
        </dl>
        <p>Dados obrigatórios de testes permanecem fixos. Nos testes pendentes, o sistema aplica os bônus e o modo de rolagem permitidos.</p>
      </>}
    </div> : null}
  </div>;
}
