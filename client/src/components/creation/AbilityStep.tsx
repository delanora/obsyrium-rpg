import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState, type PointerEvent, type CSSProperties } from 'react';
import { ABILITY_KEYS, ABILITY_LABELS, formatModifier } from '../../dnd';
import { CommonDicePool } from '../../dice/CommonDicePool';
import { CommonTrayFrame } from '../../dice/CommonTrayFrame';
import { rollAnimationMs } from '../../dice/rollAnimation';
import '../../dice/common-tray.css';
import './ability-step.css';
import type { AbilityKey, CreationRoll, DiceRollDto } from '../../types';
import { Icon } from '../Icon';

const POOL = Array.from({ length: 4 }, () => ({ sides: 6, locked: true }));
export const rollValue = (roll: CreationRoll) => roll.dice.reduce((sum, value, index) => index === roll.dropped ? sum : sum + value, 0);
type SubStep = 'roll' | 'assign';
interface AbilityStepProps {
  mode: 'new' | 'existing'; rolls: CreationRoll[];
  assigned: Partial<Record<AbilityKey, number>>;
  racialBonus: Partial<Record<AbilityKey, number>>;
  onRoll: (restart: boolean, retryIndex?: number) => Promise<CreationRoll | null>;
  onAssign: (ability: AbilityKey, value: number | null) => void;
  subStep: SubStep; onSubStep: (step: SubStep) => void;
  disabled?: boolean;
}

/** A bandeja só anima resultados autoritativos; distribuir não gera dados novos. */
export function AbilityStep({ mode, rolls, assigned, racialBonus, onRoll, onAssign, subStep, onSubStep, disabled = false }: AbilityStepProps) {
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiceRollDto | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<{ index: number; x: number; y: number; width: number; height: number; appearance: CSSProperties } | null>(null);
  const gesture = useRef<{ index: number; x: number; y: number; offsetX: number; offsetY: number; width: number; height: number; appearance: CSSProperties; moved: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const previousCount = useRef(rolls.length);
  const retrying = useRef<number | undefined>(undefined);
  const [restarting, setRestarting] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);
  const assignedIndices = useRef<Partial<Record<AbilityKey, number>>>({});
  const values = rolls.map(rollValue);
  // Identidade por índice: dois resultados iguais continuam sendo dois cards.
  const placements = new Map<number, AbilityKey>();
  for (const ability of ABILITY_KEYS) {
    const index = assignedIndices.current[ability];
    if (index !== undefined && values[index] === assigned[ability] && !placements.has(index)) placements.set(index, ability);
  }
  for (const ability of ABILITY_KEYS) {
    if ([...placements.values()].includes(ability)) continue;
    const index = values.findIndex((value, index) => value === assigned[ability] && !placements.has(index));
    if (index >= 0) { placements.set(index, ability); assignedIndices.current[ability] = index; }
  }
  const last = rolls[rolls.length - 1];
  const restingResult = useMemo<DiceRollDto | null>(() => last ? {
    id: `creation-saved-${rolls.length}`, actorUserId: '', clientId: null, actorName: '', kind: 'creation', label: 'Atributos',
    dice: last.dice.map((value, index) => ({ sides: 6, value, dropped: index === last.dropped })),
    total: rollValue(last), bonus: 0, advantage: false, disadvantage: false, isPrivate: true, crit: false, lucky: false, at: '',
  } : null, [last, rolls.length]);
  async function roll(restart = false, retryIndex?: number) {
    if (pending.current || disabled) return;
    pending.current = true; previousCount.current = restart ? 0 : rolls.length; retrying.current = retryIndex; setResult(null);
    setRolling(true); setError(null); setSelected(null); onSubStep('roll');
    try {
      const entry = await onRoll(restart, retryIndex);
      if (!mounted.current) return;
      if (!entry) { setRolling(false); pending.current = false; return; }
      setResult({ ...restingResult, id: `creation-animation-${Date.now()}`, actorUserId: '', actorName: '', clientId: null, kind: 'creation', label: 'Atributos',
        dice: entry.dice.map((value, index) => ({ sides: 6, value, dropped: index === entry.dropped })), total: rollValue(entry), bonus: 0,
        advantage: false, disadvantage: false, isPrivate: true, crit: false, lucky: false, at: '' });
      timer.current = setTimeout(() => {
        pending.current = false; setRolling(false); setRestarting(false);
        if ((restart ? 1 : retryIndex !== undefined ? rolls.length : rolls.length + 1) === 6 && rollValue(entry) >= 8 && rolls.every((item, index) => index === retryIndex || rollValue(item) >= 8)) onSubStep('assign');
      }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : rollAnimationMs());
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao rolar.'); setRolling(false); pending.current = false; }
  }
  function assign(index: number, ability: AbilityKey) {
    if (disabled || rolling || rolls.length !== 6 || values.some(value => value < 8)) return;
    const source = placements.get(index);
    if (source === ability) { setSelected(null); return; }
    if (source) {
      const previous = [...placements].find(([, placed]) => placed === ability)?.[0];
      if (previous === undefined) delete assignedIndices.current[source];
      else assignedIndices.current[source] = previous;
      onAssign(source, assigned[ability] ?? null);
    }
    assignedIndices.current[ability] = index;
    onAssign(ability, values[index]); setSelected(null);
  }
  function release(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (current?.moved) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-ability-target]');
      if (target) assign(current.index, target.dataset.abilityTarget as AbilityKey);
    }
    setDragging(null);
    // Mantém moved até o clique sintetizado, para soltar não selecionar outra peça.
  }
  function token(index: number, interactive = true) {
    const source = placements.get(index);
    return <button type="button" key={index} className={`ability-value-card${selected === index ? ' is-selected' : ''}${dragging?.index === index ? ' is-drag-source' : ''}`}
      disabled={disabled || rolling || !interactive} aria-pressed={selected === index}
      aria-label={`Rolagem ${index + 1}: ${values[index]}${source ? `, ${ABILITY_LABELS[source]}` : ''}`}
      onPointerDown={event => {
        if (event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const style = getComputedStyle(event.currentTarget);
        gesture.current = { index, x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top, width: rect.width, height: rect.height,
          appearance: { font: style.font, background: style.background, color: style.color, boxShadow: style.boxShadow }, moved: false };
      }}
      onDragStart={event => event.preventDefault()}
      onPointerMove={event => {
        const current = gesture.current;
        if (!current || current.index !== index || event.buttons === 0) return;
        if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
        current.moved = true; event.currentTarget.setPointerCapture(event.pointerId);
        setDragging({ index, x: event.clientX - current.offsetX, y: event.clientY - current.offsetY, width: current.width, height: current.height, appearance: current.appearance });
      }} onPointerUp={release} onPointerCancel={() => { gesture.current = null; setDragging(null); }}
      onClick={() => { if (!gesture.current?.moved) setSelected(index); gesture.current = null; }}>
      <strong>{values[index]}</strong><small>{rolls[index].dice.map((die, i) => <span key={i} className={i === rolls[index].dropped ? 'is-dropped' : ''}>{die} </span>)}</small>
    </button>;
  }
  if (mode === 'existing') {
    return (
      <div className="wizard-step-body">
        <p className="section-note">
          Digite o valor de cada atributo (1 a 20), como ele já é na sua ficha de papel.
        </p>

        <div className="grid grid-3 wizard-abilities">
          {ABILITY_KEYS.map((ability) => (
            <label className="field" key={ability}>
              <span>{ABILITY_LABELS[ability]}</span>
              <input
                type="number"
                min={1}
                max={20}
                value={assigned[ability] ?? ''}
                disabled={disabled}
                onChange={(event) => {
                  const raw = event.target.value;
                  onAssign(ability, raw === '' ? null : Number(raw));
                }}
              />
              <small className="muted">
                modificador{' '}
                {formatModifier(Math.floor(((assigned[ability] ?? 10) - 10) / 2))}
              </small>
            </label>
          ))}
        </div>

        {error ? <p className="form-error">{error}</p> : null}
      </div>
    );
  }
  const distributing = subStep === 'assign' && rolls.length === 6 && values.every(value => value >= 8) && !rolling;
  return <div className="wizard-step-body ability-step">
    <p className="section-note">{distributing ? 'Arraste os valores para os atributos. Você também pode clicar em um valor e depois no atributo. Troque valores arrastando entre os campos.' : 'Role os quatro D6 seis vezes. Em cada rolagem, o menor dado é descartado e os outros três formam um valor.'}</p>
    {!distributing ? <>
      <div className="dice-stage is-standard-roll ability-tray" aria-label="Bandeja de atributos com quatro D6 fixos">
        <div className={`dice-ring${rolling ? ' is-rolling' : ''}`}><div className="dice-ring-inner"><div className="dice-ring-floor">
          <CommonDicePool pool={POOL} result={result ?? restingResult} rolling={rolling && result !== null} settled={!rolling || result === null} extraD20={0} />
        </div></div><CommonTrayFrame /></div>
        <button type="button" className="btn btn-primary" disabled={disabled || rolling || rolls.length >= 6} onClick={() => void roll()}>
          <Icon name="die" size={18} /> {rolling ? 'Rolando...' : `Rolar 4d6 · ${rolls.length}/6`}
        </button>
      </div>
      <div className="ability-roll-bank" aria-label="Resultados das seis rolagens">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="ability-roll-entry">
          {index < (rolling ? previousCount.current : rolls.length) && !(rolling && index === retrying.current) ? token(index, false) : <span className="ability-value-card is-empty">—</span>}
          {!rolling && values[index] < 8 ? <><small className="ability-low-result">Você tirou menos que 8. Pode rolar de novo.</small><button type="button" className="btn btn-small" disabled={disabled} onClick={() => void roll(false, index)}>Repetir rolagem {index + 1}</button></> : null}
        </div>)}
      </div>
      {rolls.length === 6 && values.every(value => value >= 8) && !rolling ? <button type="button" className="btn" onClick={() => onSubStep('assign')}>Distribuir valores</button> : null}
      {rolls.length > 0 && !rolling ? <button type="button" className="btn btn-small" disabled={disabled} onClick={() => { if (restarting) void roll(true); else setRestarting(true); }}>{restarting ? 'Confirmar: recomeçar as seis rolagens' : 'Recomeçar rolagens'}</button> : null}
    </> : <>
      <h3 className="wizard-selection-title">Distribuir atributos</h3>
      <div className="ability-roll-bank" aria-label="Valores disponíveis">{values.map((_, index) => !placements.has(index) ? token(index) : null)}{placements.size === 6 ? <p className="section-note">Todos os valores distribuídos.</p> : null}</div>
      {values.some(value => value < 8) ? <p className="ability-low-result">Você tirou menos que 8. Pode rolar de novo: volte em Atributos na lateral e repita somente essa rolagem.</p> : null}
      <div className="ability-targets">{ABILITY_KEYS.map(ability => {
        const index = [...placements].find(([, placed]) => placed === ability)?.[0];
        const base = assigned[ability], bonus = racialBonus[ability] ?? 0;
        return <section className="ability-target" key={ability} data-ability-target={ability}>
          <h4>{ABILITY_LABELS[ability]}</h4>
          {index === undefined ? <button type="button" className="ability-empty-target" disabled={disabled} data-ability-target={ability} onClick={() => { if (selected !== null) assign(selected, ability); }} aria-label={`Atribuir valor a ${ABILITY_LABELS[ability]}`}>+</button> : <div data-ability-target={ability}>{token(index)}<button type="button" className="btn btn-small" disabled={disabled} onClick={() => { delete assignedIndices.current[ability]; onAssign(ability, null); }} aria-label={`Remover valor de ${ABILITY_LABELS[ability]}`}>Remover</button></div>}
          <small>{bonus ? `${bonus > 0 ? '+' : ''}${bonus} da raça · ` : ''}total {base === undefined ? '—' : base + bonus} · modificador {formatModifier(Math.floor(((base ?? 10) + bonus - 10) / 2))}</small>
        </section>;
      })}</div>
    </>}
    {dragging ? createPortal(<div className="ability-value-card ability-drag-ghost" aria-hidden="true"
      style={{ ...dragging.appearance, left: dragging.x, top: dragging.y, width: dragging.width, height: dragging.height }}>
      <strong>{values[dragging.index]}</strong><small>{rolls[dragging.index].dice.map((die, i) => <span key={i} className={i === rolls[dragging.index].dropped ? 'is-dropped' : ''}>{die} </span>)}</small>
    </div>, document.body) : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
  </div>;
}
