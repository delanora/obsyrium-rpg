import { ChoiceGallery } from './ChoiceGallery';
import type { RaceChoice } from '../../types';
import { Icon } from '../Icon';

/** Apresentação PHB 2014; a escolha continua no contrato racial existente. */
export function DraconicAncestry({ choice, value, disabled, onSelect }: {
  choice: RaceChoice; value: string; disabled: boolean; onSelect: (id: string) => void;
}) {
  const selected = choice.options.find(option => option.id === value);
  const cone = ['gold', 'green', 'red', 'silver', 'white'].includes(value);
  const constitution = ['green', 'silver', 'white'].includes(value);
  return <>
    <h3 className="wizard-selection-title">Ancestralidade dracônica</h3>
    <ChoiceGallery className="wizard-class-grid" role="group" aria-label="Ancestralidade dracônica">
      {[...choice.options].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')).map(option => <button
        key={option.id} data-ancestry={option.id} type="button" className={`wizard-class-card${value === option.id ? ' is-selected' : ''}`}
        aria-pressed={value === option.id} disabled={disabled} onClick={() => onSelect(option.id)}>
        <span className="wizard-class-emblem"><Icon name="dragon" size={64} /></span><span>{option.label}</span>
      </button>)}
    </ChoiceGallery>
    {selected ? <section className="wizard-option-detail" aria-label="Detalhes da ancestralidade">
      <h3>Draconato {selected.label}</h3>
      <p className="wizard-option-description">Sua linhagem de dragões se manifesta no sopro e na proteção contra {selected.damageType?.toLocaleLowerCase('pt-BR')}.</p>
      <div className="wizard-detail-highlight"><strong>Sopro</strong><span>{selected.damageType} · {cone ? 'cone de 4,5 m' : 'linha de 9 m por 1,5 m'} · salvaguarda de {constitution ? 'Constituição' : 'Destreza'}.</span></div>
      <div className="wizard-detail-highlight"><strong>Resistência</strong><span>Você recebe metade do dano de {selected.damageType?.toLocaleLowerCase('pt-BR')}.</span></div>
      <p>Como ação, cause 2d6 de dano com o sopro; quem passar na salvaguarda sofre metade. A CD é 8 + proficiência + modificador de Constituição. Você recupera o uso após um descanso curto ou longo.</p>
    </section> : null}
  </>;
}

export function racialTraitSummary(id: string, description: string): string {
  const summaries: Record<string, string> = {
    'infernal-legacy': 'Você conhece Taumaturgia e usa Carisma para conjurá-la.',
    'drow-magic': 'Você conhece Luzes Dançantes e usa Carisma para conjurá-la.',
    'draconic-ancestry': 'Sua ancestralidade determina o dano do sopro e sua resistência. Você fala Comum e Dracônico.',
    'breath-weapon': 'Exale um sopro de energia dracônica como ação. Os detalhes aparecem na ancestralidade escolhida.',
    'damage-resistance': 'Você tem resistência ao dano associado à sua ancestralidade.',
  };
  return summaries[id] ?? description.replace(/\s*\([^)]*(?:raceChoices|mechanicalState|racialState)[^)]*\)/g, '');
}
