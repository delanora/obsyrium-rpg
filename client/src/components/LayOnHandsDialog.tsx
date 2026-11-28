import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchLayOnHandsOptions, healWithLayOnHands, purifyWithLayOnHands, type LayOnHandsOptions } from '../layOnHandsApi';
import type { Character } from '../types';

/** Mesma escolha variável na ficha e Hotbar; o servidor valida alvo e reserva. */
export function LayOnHandsDialog({ onClose, onCharacter }: { onClose: () => void; onCharacter: (character: Character) => void }) {
  const [options, setOptions] = useState<LayOnHandsOptions | null>(null);
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState<'heal' | 'purify'>('heal');
  const [chosen, setChosen] = useState<string[]>([]);
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const inFlight = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const key = (value: LayOnHandsOptions['targets'][number]) => `${value.target.kind}:${value.target.id}`;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    let current = true;
    fetchLayOnHandsOptions().then(value => { if (current) { setOptions(value); setSelected(value.targets.find(t => !t.reason) ? key(value.targets.find(t => !t.reason)!) : ''); } }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : 'Não foi possível consultar a reserva.'); });
    box.current?.focus();
    return () => { current = false; previous?.focus(); };
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !inFlight.current) onClose();
      if (event.key === 'Tab' && box.current) {
        const controls = [...box.current.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled)')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [onClose]);
  const target = options?.targets.find(t => key(t) === selected);
  const cost = mode === 'heal' ? amount : chosen.length * 5;
  const validChoice = mode === 'heal' ? Number.isInteger(amount) && amount > 0 : chosen.length > 0 && chosen.every(id => target?.afflictions?.some(origin => origin.id === id));
  async function heal() {
    if (inFlight.current || !options || !target || target.reason || !options.canUse || !validChoice || cost > options.remaining) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      if (mode === 'purify') {
        const response = await purifyWithLayOnHands(options, target, chosen);
        onCharacter(response.character);
        setResult(response.noEffect ? `Sem efeito: esta criatura não é afetada por Mãos Consagradas. ${cost} pontos gastos; reserva restante: ${response.remaining}.` : `${response.purified} origem(ns) neutralizada(s). Reserva restante: ${response.remaining}.`);
      } else {
        const response = await healWithLayOnHands(options, target, amount);
        onCharacter(response.character);
        setResult(response.noEffect ? `Sem efeito: esta criatura não é afetada por Mãos Consagradas. ${cost} pontos gastos; reserva restante: ${response.remaining}.` : `${response.healed} PV restaurados. Reserva restante: ${response.remaining}.`);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível aplicar a cura. Feche e confira novamente.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return createPortal(<div className="modal-backdrop" onClick={() => { if (!inFlight.current) onClose(); }}>
    <div ref={box} className="modal" role="dialog" aria-modal="true" aria-label="Mãos Consagradas" tabIndex={-1} onClick={event => event.stopPropagation()}>
      <h2>Mãos Consagradas</h2>
      {result ? <p role="status">{result}</p> : <>
        <p>Escolha um alvo ao alcance do toque e como usar a reserva.</p>
        {options ? <>
          <p>Reserva: {options.remaining} / {options.max}</p>
          {!options.canUse ? <p role="status">Indisponível: confira seu turno, sua condição e a reserva.</p> : null}
          <div className="lay-on-hands-fields">
          <label className="field"><span>Uso da reserva</span><select aria-label="Uso da reserva" disabled={busy} value={mode} onChange={event => { setMode(event.target.value as 'heal' | 'purify'); setChosen([]); }}>
            <option value="heal">Curar pontos de vida</option><option value="purify">Neutralizar doenças e venenos</option>
          </select></label>
          <label className="field"><span>Alvo</span><select value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setChosen([]); }}>
            <option value="">— escolha —</option>
            {options.targets.map(t => <option key={key(t)} value={key(t)} disabled={!!t.reason}>{t.name}{t.reason ? ' — toque indisponível' : ''}</option>)}
          </select></label>
          {mode === 'heal' ? <label className="field"><span>Pontos de cura</span><input type="number" min={1} max={options.remaining} step={1} value={amount} disabled={busy} onChange={event => setAmount(Number(event.target.value))} /></label> : null}
          </div>
          {mode === 'purify' ? <fieldset className="lay-on-hands-origins" disabled={busy}>
            <legend>Origens tratáveis — 5 pontos cada</legend>
            {(target?.afflictions ?? []).map(origin => <label className="check" key={origin.id}>
              <input type="checkbox" checked={chosen.includes(origin.id)} onChange={event => setChosen(previous => event.target.checked ? [...previous, origin.id] : previous.filter(id => id !== origin.id))} />
              <span>{origin.kind === 'poison' ? 'Veneno' : 'Doença'} — {origin.label}</span>
            </label>)}
            {!target?.afflictions?.length ? <p>Nenhuma origem tratável disponível. O Mestre pode registrar e publicar uma origem.</p> : null}
            <p>Custo: {cost} pontos · Reserva: {options.remaining}</p>
          </fieldset> : null}
          <p className="section-note">Condições sem origem registrada não são neutralizadas. Sem geometria confiável, apenas o autoalvo é automatizado.</p>
        </> : !error ? <p role="status">Consultando reserva…</p> : null}
      </>}
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="modal-actions">
        <button className="btn" disabled={busy} onClick={onClose}>{result ? 'Fechar' : 'Cancelar'}</button>
        {!result ? <button className="btn btn-primary" disabled={busy || !options?.canUse || !target || !!target.reason || !validChoice || cost > (options?.remaining ?? 0)} onClick={() => void heal()}>{busy ? 'Aplicando…' : mode === 'heal' ? 'Aplicar cura' : 'Neutralizar origens'}</button> : null}
      </div>
    </div>
  </div>, document.body);
}
