import { useState } from 'react';
import { ChoiceGallery } from './ChoiceGallery';
import { DRACONIC_ANCESTRY_ART } from './DraconicAncestry';
import type { FeatureChoiceOption } from '../../../../src/modules/shared/classes/types';
export interface DragonAncestryControl { value: string; disabled: boolean; onChange: (value: string) => void }
/** A ancestralidade da classe é independente da ancestralidade racial do Draconato. */
export function SorcererAncestry({ options, control }: { options: FeatureChoiceOption[]; control: DragonAncestryControl }) {
  const sorted = [...options].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const [preview, setPreview] = useState(-1);
  const current = sorted[preview] ?? sorted.find(option => option.key === control.value);
  return <div className="sorcerer-ancestry">
    <ChoiceGallery className="wizard-class-grid" aria-label="Ancestral Dracônico do Feiticeiro" role="group" onPreviewIndex={setPreview}>
      {sorted.map(option => <button key={option.key} type="button" data-ancestry={option.key}
        className={`wizard-class-card${control.value === option.key ? ' is-selected' : ''}`}
        aria-pressed={control.value === option.key} disabled={control.disabled} onClick={() => control.onChange(option.key)}>
        <span className="wizard-class-emblem"><img className="class-emblem-art" src={`/race-icons/draconato_ancestralidade_${DRACONIC_ANCESTRY_ART[option.key]}.webp`} width={512} height={512} alt="" aria-hidden="true" draggable={false} /></span>
        <span>{option.name}</span>
      </button>)}
    </ChoiceGallery>
    {current ? <p className="sorcerer-ancestry-caption"><strong>{current.name}</strong> · {current.description}</p> : null}
  </div>;
}
