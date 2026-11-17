import { SorcererAncestry, type DragonAncestryControl } from './SorcererAncestry';
import type { ClassOption } from '../../types';
import { ABILITY_LABELS, SKILLS } from '../../dnd';
import type { ClassFeatureDefinition } from '../../../../src/modules/shared/classes/types';
import { CLASS_PRESENTATIONS, CLASS_STARTING_EQUIPMENT } from './classPresentation';

function FeatureInformation({ features, dragonAncestry }: { features: ClassFeatureDefinition[]; dragonAncestry?: DragonAncestryControl }) {
  return <>{features.map(feature => <article className="wizard-detail-resource" key={feature.id}>
    <h4>{feature.name} <small>· nível {feature.level}</small></h4>
    <p>{feature.description}</p>
    {feature.id === 'dragon-ancestor' && feature.choice && dragonAncestry ? <SorcererAncestry options={feature.choice.options} control={dragonAncestry} /> : null}
    {/* As opções de Expertise já são apresentadas na etapa de perícias. */}
    {feature.choice && feature.id !== 'expertise' && feature.id !== 'dragon-ancestor' ? <><p className="section-note">{feature.choice.prompt ?? feature.name} · {feature.choice.count ?? 1} escolha(s)</p>
      <ul className="wizard-information-list">{feature.choice.options.filter(option => !option.requiresLevel || option.requiresLevel <= 1).map(option => <li key={option.key}>
        <strong>{option.name}</strong>{option.description ? ` — ${option.description}` : ''}{option.requiresLevel ? ` (a partir do nível ${option.requiresLevel})` : ''}{option.requiresPact ? ` · requer Pacto: ${option.requiresPact}` : ''}
      </li>)}</ul></> : null}
  </article>)}</>;
}

/** Somente leitura: o mesmo catálogo fornece contexto e benefícios de cada escolha. */
export function ClassInformation({ option, subclass, dragonAncestry }: { option: ClassOption; subclass?: string; dragonAncestry?: DragonAncestryControl }) {
  const definition = CLASS_PRESENTATIONS.find(entry => entry.key === option.key);
  if (!definition) return null;
  const specialization = subclass ? definition.subclasses.find(entry => entry.name === subclass) : null;
  if (subclass && !specialization) return null;
  const features = specialization?.features ?? definition.features;
  const proficiencies = specialization?.proficiencies ?? (!subclass ? option.firstProficiencies : undefined);
  return <section className="wizard-option-detail" aria-label={subclass ? 'Detalhes da subclasse' : 'Detalhes da classe'}>
    <h3>{specialization?.name ?? definition.name}</h3>
    <p className="wizard-option-description">{specialization?.description ?? definition.description}</p>
    {specialization ? <div className="wizard-detail-highlight"><strong>Classe</strong><span>{definition.name} · escolha no nível {definition.subclassLevel}</span></div> : <>
      <div className="wizard-detail-highlight"><strong>Vitalidade</strong><span>d{definition.hitDie} por nível; no 1º nível, {definition.hitDie} + modificador de Constituição em PV.</span></div>
      <div className="wizard-detail-highlight"><strong>Salvaguardas</strong><span>{definition.savingThrows.map(key => ABILITY_LABELS[key]).join(' · ')}</span></div>
      <div className="wizard-detail-highlight"><strong>Perícias</strong><span>Escolha {option.skillChoice?.count ?? 0}: {option.skillChoice?.from.map(key => SKILLS.find(skill => skill.key === key)?.label ?? key).join(' · ') || 'qualquer perícia'}.</span></div>
      {definition.spellcasting.ability ? <div className="wizard-detail-highlight"><strong>Conjuração</strong><span>{ABILITY_LABELS[definition.spellcasting.ability]} · {definition.spellcasting.learning === 'prepared' ? 'magias preparadas' : 'magias conhecidas'}.</span></div> : null}
    </>}
    {proficiencies ? <>{([['Armaduras', proficiencies.armor], ['Armas', proficiencies.weapons], ['Ferramentas', proficiencies.tools]] as const).map(([label, values]) => values.length ? <div className="wizard-detail-highlight" key={label}><strong>{label}</strong><span>{values.join(' · ')}</span></div> : null)}</> : null}
    <h4 className="wizard-information-heading">Benefícios no 1º nível</h4>
    <FeatureInformation features={features.filter(feature => feature.level <= 1)} dragonAncestry={dragonAncestry} />
    {!subclass ? <div className="wizard-detail-resource"><h4>Equipamento inicial da classe</h4>
      <p className="section-note">As alternativas abaixo compõem o equipamento inicial, além do antecedente. Esta consulta não adiciona itens ao inventário.</p>
      <ul className="wizard-information-list">{(CLASS_STARTING_EQUIPMENT[option.key] ?? []).map(text => <li key={text}>{text}</li>)}</ul>
    </div> : null}

  </section>;
}
