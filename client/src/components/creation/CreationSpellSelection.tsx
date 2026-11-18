import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ABILITY_LABELS, formatModifier } from '../../dnd';
import { setSpellbook } from '../../spellbookApi';
import type { Character, ClassEntry, CompendiumSpell, Spell } from '../../types';
import { Icon, type IconName } from '../Icon';
import './creation-spells.css';

export interface CreationSpellSelectionHandle { save: () => Promise<boolean>; isComplete: () => boolean }
const SCHOOL_ICONS: Record<string, IconName> = { Abjuração: 'shield', Adivinhação: 'eye', Conjuração: 'sparkle', Encantamento: 'heart', Evocação: 'flame', Ilusão: 'moon', Necromancia: 'skull', Transmutação: 'flask' };

/** Edita uma parte do repertório, preservando a outra; o servidor revalida todos os limites. */
export const CreationSpellSelection = forwardRef<CreationSpellSelectionHandle, {
  entry: ClassEntry; mode: 'cantrips' | 'spells'; allSpells: CompendiumSpell[]; current: Spell[];
  disabled: boolean; onSaved: (character: Character) => void; onReadyChange?: (ready: boolean) => void;
}>(function CreationSpellSelection({ entry, mode, allSpells, current, disabled, onSaved, onReadyChange }, ref) {
  const initial = () => new Map(current.filter(spell => !spell.oath && !spell.race).map(spell => [spell.id, spell.prepared]));
  const [selection, setSelection] = useState(initial);
  const selectionRef = useRef(selection); selectionRef.current = selection;
  const savedFingerprint = useRef(JSON.stringify([...initial()].sort()));
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef<Promise<boolean> | null>(null);
  const [error, setError] = useState('');
  const limits = entry.spellcasting!;
  const pool = allSpells.filter(spell => spell.classes.includes(entry.classKey) && (mode === 'cantrips' ? spell.level === 0 : spell.level === 1));
  const byId = new Map(allSpells.map(spell => [spell.key, spell]));
  const chosen = [...selection.keys()].filter(key => pool.some(spell => spell.key === key));
  const limit = mode === 'cantrips' ? limits.cantripsKnown : limits.spellsKnown ?? limits.grimoireSize ?? limits.preparedCount ?? 0;
  const preparesFromList = mode === 'spells' && limits.spellsKnown === null && limits.grimoireSize === null;
  const visible = pool.filter(spell => `${spell.name} ${spell.school}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).sort((a,b) => a.name.localeCompare(b.name,'pt-BR'));
  const detail = pool.find(spell => spell.key === preview) ?? pool.find(spell => chosen.includes(spell.key)) ?? visible[0];
  const preparedCount = [...selection].filter(([key, prepared]) => prepared && (byId.get(key)?.level ?? 0) > 0).length;
  const complete = chosen.length === limit && (mode !== 'spells' || limits.grimoireSize === null || preparedCount === (limits.preparedCount ?? 0));
  useEffect(() => { onReadyChange?.(complete); }, [complete, onReadyChange]);
  function toggle(spell: CompendiumSpell) {
    if (busy || disabled) return;
    const next = new Map(selection);
    if (next.has(spell.key)) next.delete(spell.key);
    else {
      if (chosen.length >= limit) { setError(`Escolha até ${limit} ${mode === 'cantrips' ? 'truques' : 'magias'}. Desmarque uma opção para trocar.`); return; }
      next.set(spell.key, preparesFromList);
    }
    setSelection(next); setPreview(spell.key); setError('');
  }
  async function save(): Promise<boolean> {
    if (saving.current) return saving.current;
    const entries = [...selectionRef.current].sort();
    const fingerprint = JSON.stringify(entries);
    if (fingerprint === savedFingerprint.current) return true;
    setBusy(true); setError('');
    saving.current = (async () => {
      try {
        const saved = await setSpellbook(entry.classKey, entries.map(([key, prepared]) => ({ key, prepared })));
        savedFingerprint.current = fingerprint; onSaved(saved); return true;
      } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar as escolhas.'); return false; }
      finally { saving.current = null; setBusy(false); }
    })();
    return saving.current;
  }
  useImperativeHandle(ref, () => ({ save, isComplete: () => complete }));
  return <section className="creation-spells" aria-label={mode === 'cantrips' ? 'Escolher truques' : 'Escolher magias'}>
    <div className="creation-spell-stats">
      <span>Atributo de conjuração<strong>{limits.ability ? ABILITY_LABELS[limits.ability] : '—'}</strong></span>
      <span>Bônus de ataque<strong>{limits.attackBonus === null ? '—' : formatModifier(limits.attackBonus)}</strong></span>
      <span>CD de magia<strong>{limits.saveDC ?? '—'}</strong></span>
    </div>
    <header className="creation-spell-heading"><h3 className="wizard-selection-title">{mode === 'cantrips' ? 'Seus truques' : 'Suas magias de 1º nível'}</h3></header>
    <p className="section-note creation-spell-subtitle">{mode === 'cantrips' ? 'Pequenos feitos de magia que não gastam espaços.' : preparesFromList ? 'Escolha as magias que deseja deixar preparadas para começar sua aventura.' : limits.grimoireSize !== null ? 'Monte seu grimório e marque quais magias estarão preparadas.' : 'Escolha as magias que seu personagem conhece.'} As escolhas são guardadas ao sair desta subetapa.</p>
    <label className="field creation-spell-search"><input type="search" aria-label="Buscar por nome ou escola" placeholder="Buscar por nome ou escola" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="creation-spell-workspace"><div className="creation-spell-cards" role="group" aria-label="Catálogo de magias">
      {visible.map(spell => <button type="button" key={spell.key} className={`creation-spell-card${selection.has(spell.key) ? ' is-selected' : ''}`} aria-pressed={selection.has(spell.key)} disabled={busy || disabled}
        onMouseEnter={() => setPreview(spell.key)} onFocus={() => setPreview(spell.key)} onClick={() => toggle(spell)}>
        <Icon name={SCHOOL_ICONS[spell.school] ?? 'book'} size={30}/><strong>{spell.name}</strong><small>{spell.school}</small>{selection.has(spell.key) ? <span className="creation-spell-chosen"><Icon name="check" size={13}/></span> : null}
      </button>)}
      {!visible.length ? <p>Nenhuma magia encontrada.</p> : null}
    </div><aside className="creation-spell-detail" aria-live="polite"><output className="creation-spell-count" aria-label={`${mode === 'cantrips' ? 'Truques escolhidos' : 'Magias escolhidas'}: ${chosen.length} de ${limit}`}>{chosen.length}/{limit}</output>{detail ? <><h4>{detail.name}</h4><p className="section-note">{detail.school}{detail.ritual ? ' · Ritual' : ''}{detail.concentration ? ' · Concentração' : ''}</p>
      <dl><div><dt>Conjuração</dt><dd>{detail.castingTime}</dd></div><div><dt>Alcance</dt><dd>{detail.range}</dd></div><div><dt>Duração</dt><dd>{detail.duration}</dd></div><div><dt>Componentes</dt><dd>{detail.components}</dd></div></dl>
      <p className="creation-spell-description">{detail.description}</p>
      <button type="button" className="btn btn-small" disabled={busy || disabled} onClick={() => toggle(detail)}>{selection.has(detail.key) ? 'Remover escolha' : 'Escolher esta magia'}</button>
    </> : <p className="section-note creation-spell-no-detail">Escolha uma opção para consultar os detalhes.</p>}</aside></div>
    {mode === 'spells' && limits.grimoireSize !== null ? <div className="creation-spell-prepared"><h4>Preparadas {preparedCount}/{limits.preparedCount ?? 0}</h4>{chosen.map(key => <label className="check-row" key={key}><input type="checkbox" checked={selection.get(key) ?? false} disabled={busy || disabled || (!selection.get(key) && preparedCount >= (limits.preparedCount ?? 0))} onChange={() => setSelection(new Map(selection).set(key, !selection.get(key)))}/>{byId.get(key)?.name}</label>)}</div> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <button type="button" className="btn btn-small" disabled={busy || disabled} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar escolhas'}</button>
  </section>;
});
