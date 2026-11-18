import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BackgroundEmblem } from './BackgroundEmblem';
import type { Character, FeatureChoiceInfo } from '../../types';
import { ABILITY_KEYS, ABILITY_LABELS, SKILLS } from '../../dnd';
import { ClassEmblem } from './ClassEmblem';
import { Icon } from '../Icon';
import './skill-selection.css';

/** Camada fora do wizard: acompanha o cursor sem deslocamento por transformações. */
function SkillHoverTip({ id, x, y, children }: { id: string; x: number; y: number; children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x + 14, top: y + 18 });
  useLayoutEffect(() => {
    const rect = element.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ left: Math.max(8, Math.min(x + 14, window.innerWidth - rect.width - 8)),
      top: Math.max(8, y + 18 + rect.height <= window.innerHeight - 8 ? y + 18 : y - rect.height - 12) });
  }, [x, y, children]);
  return createPortal(<div ref={element} id={id} role="tooltip" className="skill-selection-tooltip" style={position}>{children}</div>, document.body);
}

/** Escolhas mantêm a ordem para substituir a mais antiga quando o limite é alcançado. */
export function toggleRecentChoice(values: string[], key: string, limit: number): string[] {
  if (values.includes(key)) return values.filter(value => value !== key);
  if (limit < 1) return values;
  return [...values.slice(Math.max(0, values.length - limit + 1)), key];
}

export function SkillSelectionStep({ character, classKey, className, count, pool, picked, background, race, backgroundName, backgroundKey, raceName, expertise, expertisePicked, disabled, onPicks, onExpertise }: {
  character: Character | null; classKey: string; className: string; count: number;
  pool: ReadonlySet<string>; picked: string[]; background: ReadonlySet<string>; race: ReadonlySet<string>;
  backgroundName: string; backgroundKey: string; raceName: string; expertise: FeatureChoiceInfo | null; expertisePicked: string[];
  disabled: boolean; onPicks: (values: string[]) => void; onExpertise: (values: string[]) => void;
}) {
  const tooltipPrefix = useId();
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  const pointer = useRef<{ key: string; x: number; y: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function dismissTip() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null; pointer.current = null; setHover(null);
  }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismissTip(); };
    window.addEventListener('blur', dismissTip);
    window.addEventListener('scroll', dismissTip, true);
    window.addEventListener('keydown', escape);
    return () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); window.removeEventListener('blur', dismissTip); window.removeEventListener('scroll', dismissTip, true); window.removeEventListener('keydown', escape); };
  }, []);
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;
  const pb = character?.derived.proficiencyBonus ?? 2;
  const expertiseKeys = new Set(expertise?.options.map(option => option.key) ?? []);
  const skills = [...SKILLS].sort((a, b) => ABILITY_KEYS.indexOf(a.ability) - ABILITY_KEYS.indexOf(b.ability) || a.label.localeCompare(b.label, 'pt-BR'));
  const tools = expertise?.options.filter(option => !SKILLS.some(skill => skill.key === option.key)) ?? [];
  function chooseSkill(key: string) {
    const next = toggleRecentChoice(picked, key, count);
    onPicks(next);
    onExpertise(expertisePicked.filter(value => !SKILLS.some(skill => skill.key === value) || next.includes(value) || background.has(value) || race.has(value)));
  }
  return <section className={`skill-selection${expertise ? ' has-expertise' : ''}`} aria-label="Escolher perícias">
    <p className="skill-selection-intro">A proficiência soma seu bônus às rolagens da perícia. Escolha as que combinam com seu personagem.</p>
    <div className="skill-selection-head">
      <span>Perícia</span><span>Bônus</span>
      <span aria-label="Escolhas de proficiência da classe"><Icon name="check" size={17}/><strong aria-label="Proficiências escolhidas">{picked.length}/{count}</strong><small>Proficiência</small></span>
      {expertise ? <span aria-label="A Expertise dobra o bônus de proficiência"><Icon name="book" size={17}/><strong aria-label="Expertises escolhidas">{expertisePicked.filter(Boolean).length}/{expertise.count}</strong><small>Expertise</small></span> : null}
    </div>
    <div className="skill-selection-rows">
      {skills.map(skill => {
        const granted = background.has(skill.key) || race.has(skill.key);
        const chosen = picked.includes(skill.key);
        const proficient = granted || chosen;
        const expert = proficient && expertisePicked.includes(skill.key);
        const eligible = !granted && pool.has(skill.key) && count > 0;
        const detail = character?.derived.skills[skill.key];
        const modifier = detail?.modifier ?? character?.derived.modifiers[skill.ability] ?? 0;
        // Prévia usa os valores já derivados pelo servidor, preservando outros bônus.
        const previousProficiency = detail?.proficient ? pb * (detail.expertise ? 2 : 1) : 0;
        const base = (detail?.total ?? modifier) - previousProficiency;
        const total = base + (proficient ? pb * (expert ? 2 : 1) : 0);
        const origin = background.has(skill.key) ? `Antecedente: ${backgroundName}` : race.has(skill.key) ? `Raça: ${raceName}` : chosen ? `Classe: ${className}` : '';
        const calculation = `${ABILITY_LABELS[skill.ability]} ${signed(modifier)}${base !== modifier ? ` · outros bônus ${signed(base - modifier)}` : ''}${proficient ? ` · ${expert ? 'Expertise' : 'proficiência'} ${signed(pb * (expert ? 2 : 1))}` : ''} = ${signed(total)}`;
        return <div className={`skill-selection-row${proficient ? ' is-proficient' : ''}`} key={skill.key} aria-describedby={hover?.key === skill.key ? `${tooltipPrefix}-${skill.key}` : undefined}
          onPointerEnter={event => {
            if (event.pointerType !== 'mouse') return;
            dismissTip(); pointer.current = { key: skill.key, x: event.clientX, y: event.clientY };
            hoverTimer.current = setTimeout(() => { hoverTimer.current = null; if (pointer.current?.key === skill.key) setHover({ ...pointer.current }); }, 2000);
          }}
          onPointerMove={event => {
            if (pointer.current?.key !== skill.key) return;
            pointer.current = { key: skill.key, x: event.clientX, y: event.clientY };
            if (hover?.key === skill.key) setHover({ ...pointer.current });
          }} onPointerLeave={dismissTip}>
          <div className="skill-selection-name">
            <span className="skill-selection-origin">{chosen && !granted ? <ClassEmblem classKey={classKey}/> : background.has(skill.key) ? <BackgroundEmblem backgroundKey={backgroundKey}/> : race.has(skill.key) ? <Icon name="star" size={16}/> : null}</span>
            <span>{skill.label}<small>{ABILITY_LABELS[skill.ability]}{origin ? ` · ${origin}` : ''}</small></span>
          </div>
          <output className="skill-selection-bonus" aria-label={`Bônus de ${skill.label}`}>{signed(total)}<small>{proficient ? `${signed(base)} + ${pb * (expert ? 2 : 1)}` : signed(base)}</small></output>
          <span className="skill-selection-check">{granted || eligible ? <input type="checkbox" aria-label={`Proficiência em ${skill.label}`} checked={proficient} disabled={disabled || granted} onChange={() => chooseSkill(skill.key)}/> : <span aria-label="Não disponível para esta classe">—</span>}</span>
          {expertise ? <span className="skill-selection-check">{proficient && expertiseKeys.has(skill.key) ? <input type="checkbox" aria-label={`Expertise em ${skill.label}`} checked={expert} disabled={disabled} onChange={() => onExpertise(toggleRecentChoice(expertisePicked.filter(Boolean), skill.key, expertise.count))}/> : <span aria-label="Expertise indisponível">—</span>}</span> : null}
          {hover?.key === skill.key ? <SkillHoverTip id={`${tooltipPrefix}-${skill.key}`} x={hover.x} y={hover.y}>
            <strong>{skill.label}</strong><span>{skill.description}</span>
            {origin ? <span>{origin}</span> : null}<span className="skill-selection-tooltip-total">{calculation}</span>
          </SkillHoverTip> : null}
        </div>;
      })}
      {tools.map(tool => <div className="skill-selection-row" key={tool.key}>
        <div className="skill-selection-name"><span className="skill-selection-origin"><Icon name="gear" size={16}/></span><span>{tool.name}<small>Ferramenta · bônus de proficiência</small></span></div>
        <output className="skill-selection-bonus">{signed(pb * (expertisePicked.includes(tool.key) ? 2 : 1))}</output><span className="skill-selection-check"><input type="checkbox" aria-label={`Proficiência em ${tool.name}`} checked disabled/></span>
        <span className="skill-selection-check"><input type="checkbox" aria-label={`Expertise em ${tool.name}`} checked={expertisePicked.includes(tool.key)} disabled={disabled} onChange={() => onExpertise(toggleRecentChoice(expertisePicked.filter(Boolean), tool.key, expertise!.count))}/></span>
      </div>)}
    </div>
    <p className="skill-selection-note">Ao ultrapassar o limite, a nova escolha substitui a mais antiga. As proficiências concedidas por raça ou antecedente permanecem marcadas.</p>
  </section>;
}
