import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { Character } from '../../types';
import { Icon } from '../Icon';

interface DeleteCharacterDialogProps {
  /** Ficha que será excluída (o nome dela aparece no texto da confirmação). */
  character: Character;
  onCancel: () => void;
  /**
   * Executa a exclusão no servidor. Deve rejeitar quando falhar — o diálogo
   * continua aberto com a mensagem do erro.
   */
  onConfirm: () => Promise<void>;
}

/**
 * Confirmação da exclusão de um personagem.
 *
 * A ação é irreversível e vai além da ficha: exclui também a **conta do
 * jogador**, então o texto diz exatamente o que desaparece e quem perde o
 * acesso. O botão vermelho exige uma confirmação adicional antes de apagar;
 * Esc e "cancelar" fecham sem excluir.
 */
export function DeleteCharacterDialog({
  character,
  onCancel,
  onConfirm,
}: DeleteCharacterDialogProps) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc cancela — nunca confirma, para um toque errado não apagar nada.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && !busy) onCancel();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  async function confirm(): Promise<void> {
    if (busy) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await onConfirm();
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir o personagem.');
    } finally {
      setBusy(false);
    }
  }

  const owner = character.ownerUsername ?? '—';

  return createPortal(
    <div
      className="modal-backdrop is-confirm"
      role="dialog"
      aria-modal="true"
      aria-label={`Excluir ${character.name}`}
    >
      <div className="modal delete-dialog">
        <h2>
          <Icon name="trash" size={20} /> Excluir personagem
        </h2>

        <p className="section-note" aria-live="polite">
          {confirming ? <>Você tem certeza? <strong>Esta ação não pode ser revertida.</strong></> :
            <>Esta ação <strong>não pode ser desfeita</strong>.</>}
        </p>

        <p className="delete-target">
          {character.name} <span className="muted">· jogador: {owner}</span>
        </p>

        {confirming ? (
          <p>O personagem {character.name} e a conta do jogador {owner} serão excluídos definitivamente.</p>
        ) : <ul>
          <li>A ficha inteira: atributos, perícias, inventário, magias, ataques e anotações.</li>
          <li>
            A <strong>conta do jogador {owner}</strong> — ele não conseguirá mais entrar no
            grimório com este usuário e senha.
          </li>
          <li>O avatar enviado e a participação dele em um combate em andamento.</li>
        </ul>}

        {error ? <p className="form-error">{error}</p> : null}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void confirm()}
            disabled={busy}
          >
            <Icon name="trash" size={14} />
            {busy ? 'excluindo...' : confirming ? 'sim, excluir definitivamente' : 'excluir personagem e conta'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
