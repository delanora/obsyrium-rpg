import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchBardicInspirationOptions, grantBardicInspiration, type BardicInspirationOptions } from '../bardicInspirationApi';
import type { Character } from '../types';

/** Concede o dado por um executor único; não aplica bônus a uma rolagem. */
export function BardicInspirationDialog({ onClose, onCharacter }: { onClose: () => void; onCharacter: (character: Character) => void }) {
  const [options, setOptions] = useState<BardicInspirationOptions | null>(null);
  const [targetId, setTargetId] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let current = true;
    const previous = document.activeElement as HTMLElement | null;
    box.current?.focus();
    fetchBardicInspirationOptions().then(value => { if (current) { setOptions(value); setTargetId(value.targets.find(target => !target.reason)?.id ?? ''); } }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : 'Não foi possível consultar a inspiração.'); });
    return () => { current = false; previous?.focus(); };
  }, []);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !inFlight.current) onClose();
      if (event.key === 'Tab' && box.current) {
        const controls = [...box.current.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [onClose]);
  const target = options?.targets.find(value => value.id === targetId);
  async function grant() {
    if (inFlight.current || !options?.canUse || !target || target.reason) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const response = await grantBardicInspiration(options, target);
      onCharacter(response.character);
      setResult(`${target.name} recebeu d${options.sides}. Usos restantes: ${response.remaining}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível conceder a inspiração.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return createPortal(<div className="modal-backdrop" onClick={() => { if (!inFlight.current) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-label="Inspiração de Bardo" tabIndex={-1} ref={box} onClick={event => event.stopPropagation()}>
      <h2>Inspiração de Bardo</h2>
      {result ? <p role="status">{result}</p> : options ? <>
        <p>Dado d{options.sides} · Usos: {options.remaining} / {options.max} · Ação Bônus</p>
        {!options.canUse ? <p role="status">Confira o turno, a reserva e a posição dos personagens no grid.</p> : null}
        <label className="field"><span>Quem será inspirado?</span><select value={targetId} disabled={busy} onChange={event => setTargetId(event.target.value)}>
          <option value="">— escolha —</option>
          {options.targets.map(value => <option key={value.id} value={value.id} disabled={!!value.reason}>{value.name}{value.reason ? ' — indisponível' : ''}</option>)}
        </select></label>
        <p className="section-note">Outro personagem a até 18 m, capaz de ouvir você. O dado aparece nos efeitos do alvo por até 10 minutos; seu uso em rolagem continua assistido pelo Mestre.</p>
        <p className="section-note">Audição através de barreiras, silêncio e uso sem grid exigem resolução assistida.</p>
      </> : !error ? <p role="status">Consultando inspiração…</p> : null}
      {error ? <p role="alert" className="error">{error}</p> : null}
      <div className="modal-actions"><button className="btn" disabled={busy} onClick={onClose}>{result ? 'Fechar' : 'Cancelar'}</button>
        {!result ? <button className="btn btn-primary" disabled={busy || !options?.canUse || !target || !!target.reason} onClick={() => void grant()}>{busy ? 'Concedendo…' : 'Conceder inspiração'}</button> : null}
      </div>
    </div>
  </div>, document.body);
}
