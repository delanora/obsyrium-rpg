import { CommonTrayFrame } from './CommonTrayFrame';
import './common-tray.css';
import { DeathFateHeader } from './DeathFateHeader';
import { DeathSaveTitle } from './DeathSaveTitle';
import { DeathSaveRoll } from './DeathSaveRoll';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';
import { Portrait } from '../components/Portrait';
import { CommonDicePool } from './CommonDicePool';
import { resultBreakdown } from './format';
import type { RemoteBoard } from './useDiceRoller';

interface RemoteRollBoardProps {
  board: RemoteBoard;
  onClose: () => void;
  presentation?: 'dialog' | 'preview';
}

/**
 * O tabuleiro de rolagem de outra pessoa da mesa.
 *
 * Quem abre a janela de dados anuncia a rolagem para todos; quem não é o autor
 * clica na faixa e vê este tabuleiro — os mesmos dados, caindo no mesmo
 * instante, e o mesmo resultado. É só leitura: não tem picker, controles nem
 * botão de rolar.
 */
export function RemoteRollBoard({ board, onClose, presentation = 'dialog' }: RemoteRollBoardProps) {
  const rolling = board.phase === 'tumbling';
  const result = board.result;
  const settled = board.phase === 'settled' && result !== null;
  const extraD20 =
    board.advantage || board.disadvantage
      ? board.pool.filter((die) => die.sides === 20).length
      : 0;
  // Rolagem de VIDA OU MORTE: quem assiste vê o MESMO quadro sombrio do autor
  // (a pele é a de `death-save.css`, aplicada pelas classes abaixo).
  const deathSave = board.kind === 'death-save';
  const stage = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (presentation !== 'preview' || !deathSave) return;
    const arena = stage.current?.querySelector<HTMLElement>('.death-save-roll');
    if (!arena) return;
    const resize = () => {
      // Mesma proporção da bandeja grande na largura atual, sem medir a
      // transformação temporária da animação de abertura do pop-up.
      const rem = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      const referencia = Math.min(25 * rem, .76 * window.innerWidth) * .77;
      const escala = referencia <= 160 ? .27 : referencia <= 200 ? .35 : referencia <= 250 ? .44 : .58;
      const caixa = referencia <= 160 ? 4 : referencia <= 200 ? 5 : referencia <= 250 ? 6 : 7.4;
      const proporcao = arena.clientWidth / referencia;
      arena.style.setProperty('--death-preview-scale', String(escala * proporcao));
      arena.style.setProperty('--death-preview-box', `${caixa * rem * proporcao}px`);
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(arena);
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, [presentation, deathSave]);

  // Esc fecha e o fundo não rola enquanto o tabuleiro está aberto.
  useEffect(() => {
    if (presentation === 'preview') return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, presentation]);

  const content = (
      <div
        ref={stage}
        className={`dice-stage${deathSave ? ' is-death-save' : ' is-standard-roll'}`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Cabeçalho: quem está rolando (só leitura para quem assiste). */}
        <header className="dice-watch-head">
          <Portrait
            src={board.avatarUrl}
            alt={board.actorName}
            size="sm"
            icon="users"
            zoomable={false}
          />
          <span className="dice-live-text">
            <strong>{board.actorName}</strong>
            {board.label
              ? ` está realizando um teste de ${board.label}`
              : ' está realizando um teste'}
          </span>
          <span className="dice-watch-tag">somente leitura</span>
          <button
            type="button"
            className="dice-head-close"
            aria-label="Fechar o tabuleiro"
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        {deathSave ? <DeathFateHeader before={board.deathSave} result={result} settled={settled} /> : null}

        {/* Ring: o mesmo tabuleiro do autor, sem os controles. */}
        <div className={rolling ? 'dice-ring is-rolling' : 'dice-ring'}>
          <div className="dice-ring-inner">
            <div className="dice-ring-floor">
              {deathSave ? (
                <DeathSaveRoll value={result?.dice[0]?.value ?? null} rolling={rolling} settled={settled} startedAt={board.startedAt} />
              ) : (
                <CommonDicePool pool={board.pool} result={result} rolling={rolling} settled={settled} extraD20={extraD20} startedAt={board.startedAt} />
              )}
            </div>
          </div>
          {!deathSave?<CommonTrayFrame/>:null}
        </div>

        {deathSave ? <DeathSaveTitle /> : null}

        <div className="dice-readout">
          {settled && result ? (
            <div className={result.crit ? 'dice-total is-crit' : 'dice-total'}>
              <span className="dice-total-value">{result.autoFail ? 'Falha automática' : result.total}</span>
              <span className="dice-total-detail">{resultBreakdown(result)}</span>
              <span className="dice-total-tags">
                {result.advantage ? <em>vantagem</em> : null}
                {result.disadvantage ? <em>desvantagem</em> : null}
                {result.crit ? <em className="crit">20 natural!</em> : null}
              </span>
            </div>
          ) : (
            <p className="dice-readout-hint">
              {rolling ? 'Rolando os dados...' : 'Aguardando a rolagem'}
            </p>
          )}
        </div>
      </div>
  );
  if (presentation === 'preview') return content;
  return createPortal(<div className={`dice-overlay${deathSave ? ' is-death-save' : ' is-standard-roll'}`} role="dialog" aria-modal="true" onClick={onClose}>{content}</div>, document.body);
}
