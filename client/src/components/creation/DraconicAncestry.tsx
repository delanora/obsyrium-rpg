import { useState } from 'react';
import { ChoiceGallery } from './ChoiceGallery';
import type { RaceChoice } from '../../types';
import { Icon } from '../Icon';

export const DRACONIC_ANCESTRY_ART: Record<string, string> = {
  black: 'preta', blue: 'azul', green: 'verde', red: 'vermelha', white: 'branca',
  brass: 'latao', bronze: 'bronze', copper: 'cobre', gold: 'ouro', silver: 'prata',
};

/** Apresentação PHB 2014; a escolha continua no contrato racial existente. */
export function DraconicAncestry({ choice, value, disabled, onSelect, baseDescription, bonusLabel }: {
  baseDescription?: string; bonusLabel: string;
  choice: RaceChoice; value: string; disabled: boolean; onSelect: (id: string) => void;
}) {
  const [previewIndex, setPreviewIndex] = useState(-1);
  const options = [...choice.options].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  const selected = options[previewIndex] ?? choice.options.find(option => option.id === value);
  const previewValue = selected?.id ?? value;
  const cone = ['gold', 'green', 'red', 'silver', 'white'].includes(previewValue);
  const constitution = ['green', 'silver', 'white'].includes(previewValue);
  return <>
    <h3 className="wizard-selection-title">Ancestralidade dracônica</h3>
    <ChoiceGallery className="wizard-class-grid" role="group" aria-label="Ancestralidade dracônica" onPreviewIndex={setPreviewIndex}>
      {options.map(option => <button
        key={option.id} data-ancestry={option.id} type="button" className={`wizard-class-card${value === option.id ? ' is-selected' : ''}`}
        aria-pressed={value === option.id} disabled={disabled} onClick={() => onSelect(option.id)}>
        <span className="wizard-class-emblem">{DRACONIC_ANCESTRY_ART[option.id]
          ? <img className="class-emblem-art" src={`/race-icons/draconato_ancestralidade_${DRACONIC_ANCESTRY_ART[option.id]}.webp`} width={512} height={512} alt="" aria-hidden="true" draggable={false} decoding="async" />
          : <Icon name="dragon" size={64} />}</span><span>{option.label}</span>
      </button>)}
    </ChoiceGallery>
    {selected ? <section className="wizard-option-detail" aria-label="Detalhes da ancestralidade">
      <h3>Draconato ({selected.label})</h3>
      {baseDescription ? <p className="wizard-option-description">{baseDescription}</p> : null}
      <div className="wizard-detail-highlight"><strong>Bônus de atributo</strong><span>{bonusLabel}</span></div>
      <div className="wizard-detail-highlight"><strong>Idiomas</strong><span>Comum e Dracônico</span></div>
      <p className="wizard-option-description">Sua linhagem de dragões se manifesta no sopro e na proteção contra {selected.damageType?.toLocaleLowerCase('pt-BR')}.</p>
      <div className="wizard-detail-highlight"><strong>Sopro</strong><span>{selected.damageType} · {cone ? 'cone de 4,5 m' : 'linha de 9 m por 1,5 m'} · salvaguarda de {constitution ? 'Constituição' : 'Destreza'}.</span></div>
      <div className="wizard-detail-highlight"><strong>Resistência</strong><span>Você recebe metade do dano de {selected.damageType?.toLocaleLowerCase('pt-BR')}.</span></div>
      <p>Como ação, cause 2d6 de dano com o sopro; quem passar na salvaguarda sofre metade. A CD é 8 + proficiência + modificador de Constituição. Você recupera o uso após um descanso curto ou longo.</p>
    </section> : null}
  </>;
}

export function racialTraitSummary(id: string, description: string): string {
  const summaries: Record<string, string> = {
    'mandrake-root-magic': 'Você conhece Clava Mágica, usando Sabedoria, e pode aplicá-la a um dos próprios membros, tratando-o como uma clava em vez de um ataque desarmado.',
    'infernal-legacy': 'Você conhece Taumaturgia e usa Carisma para conjurá-la.',
    'drow-magic': 'Você conhece Luzes Dançantes e usa Carisma para conjurá-la.',
    'draconic-ancestry': 'Sua ancestralidade determina o dano do sopro e sua resistência. Você fala Comum e Dracônico.',
    'breath-weapon': 'Exale um sopro de energia dracônica como ação. Os detalhes aparecem na ancestralidade escolhida.',
    'damage-resistance': 'Você tem resistência ao dano associado à sua ancestralidade.',
  };
  return summaries[id] ?? description.replace(/\s*\([^)]*(?:raceChoices|mechanicalState|racialState)[^)]*\)/g, '');
}
