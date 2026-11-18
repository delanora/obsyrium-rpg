import './fighting-style.css';
import { useState } from 'react';
import { Icon, type IconName } from '../Icon';
import { ChoiceGallery } from './ChoiceGallery';
import type { FeatureChoiceInfo } from '../../types';

export interface FightingStyleControl {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

const SYMBOLS: Record<string, IconName> = {
  archery: 'ammo', defense: 'armor', dueling: 'sword',
  'great-weapon-fighting': 'sword', protection: 'shield', 'two-weapon-fighting': 'sword',
};

export const FIGHTING_STYLE_ART: Record<string, string> = Object.fromEntries(
  Object.keys(SYMBOLS).map(key => [key, `/fighting-style-icons/${key}.png`]),
);

/** A agulha consulta o estilo; somente o clique confirma a escolha. */
export function FightingStyleChoice({ options, control }: {
  options: FeatureChoiceInfo['options'];
  control?: FightingStyleControl;
}) {
  const [preview, setPreview] = useState(-1);
  const current = options[preview] ?? options.find(option => option.key === control?.value) ?? options[0];
  return <div className="sorcerer-ancestry fighting-style-selector">
    <ChoiceGallery className="wizard-class-grid" aria-label="Estilo de Luta" role="group" onPreviewIndex={setPreview}>
      {options.map(option => <button key={option.key} type="button"
        className={`wizard-class-card${control?.value === option.key ? ' is-selected' : ''}`}
        aria-pressed={control?.value === option.key} disabled={!control || control.disabled}
        onClick={() => control?.onChange(option.key)}>
        <span className="wizard-class-emblem">{FIGHTING_STYLE_ART[option.key]
          ? <img className="class-emblem-art" src={FIGHTING_STYLE_ART[option.key]} width={1254} height={1254} alt="" aria-hidden="true" draggable={false} />
          : <Icon name={SYMBOLS[option.key] ?? 'sword'} size={64} />}</span>
        <span>{option.name}</span>
      </button>)}
    </ChoiceGallery>
    {current ? <p className="sorcerer-ancestry-caption" aria-live="polite"><strong>{current.name}</strong> · {current.description}</p> : null}
  </div>;
}
