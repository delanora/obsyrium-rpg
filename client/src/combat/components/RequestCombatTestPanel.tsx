import { useState } from 'react';
import { ABILITY_KEYS, ABILITY_LABELS, SKILLS } from '../../dnd';
import type { CombatDto, CombatantDto } from '../../types';
import { requestCombatTest } from '../combatApi';

export function RequestCombatTestPanel({ combat, combatant, busy, onRun }: {
  combat: CombatDto; combatant: CombatantDto; busy: boolean;
  onRun: (action: () => Promise<CombatDto>) => void;
}) {
  const [kind, setKind] = useState<'skill' | 'ability' | 'save'>('skill');
  const [dc, setDc] = useState('15');
  const [search, setSearch] = useState('');
  const [sent, setSent] = useState('');
  const difficulty = Number(dc);
  const valid = dc.trim() !== '' && Number.isInteger(difficulty) && difficulty >= 0 && difficulty <= 100;
  const options = kind === 'skill' ? SKILLS.map(skill => ({ key: skill.key, label: skill.label }))
    : ABILITY_KEYS.map(key => ({ key, label: ABILITY_LABELS[key] }));
  return <section className="requested-tests-panel" aria-label={`Solicitar teste de ${combatant.name}`}>
    <p>Envie um teste para <strong>{combatant.name}</strong>. O resultado aparece no Registro, sem gastar ações.</p>
    <label>Dificuldade (CD)<input type="number" min={0} max={100} step={1} value={dc}
      onChange={event => setDc(event.target.value)} disabled={busy} /></label>
    <div className="requested-tests-categories" role="group" aria-label="Categoria do teste">
      {([['skill', 'Perícias'], ['ability', 'Atributos'], ['save', 'Salvaguardas']] as const).map(([key, label]) =>
        <button type="button" key={key} className="btn btn-small" aria-pressed={kind === key}
          onClick={() => setKind(key)}>{label}</button>)}
    </div>
    <label>Buscar teste<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
    <div className="requested-tests-list">
      {options.filter(item => item.label.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).map(item =>
        <div className="requested-test-option" key={item.key}><span>{item.label}</span>
          <button type="button" className="btn btn-small" disabled={busy || !valid}
            aria-label={`Solicitar ${item.label}`}
            onClick={() => onRun(async () => {
              const updated = await requestCombatTest(combat, combatant.id, kind, item.key, difficulty);
              setSent(`${item.label} — CD ${difficulty}: solicitação enviada.`);
              return updated;
            })}>Solicitar</button>
        </div>)}
    </div>
    {sent ? <p role="status">{sent}</p> : null}
    <p className="section-note">O participante recebe o pedido no bloco Testes e rola na própria bandeja. O sistema usa os bônus atuais da ficha. O Mestre também pode rolar ou cancelar pelo bloco Testes.</p>
  </section>;
}
