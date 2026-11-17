import { Icon } from '../Icon';
import { STARTING_EQUIPMENT_LABELS, type StartingEquipmentMethod } from '../../../../src/modules/shared/starting-equipment';
import { CLASS_STARTING_EQUIPMENT } from './classPresentation';
export function StartingEquipmentStep({ method, details, disabled, classKey, className, background, onChoose }: {
  method: StartingEquipmentMethod | null; details: boolean; disabled: boolean;
  classKey: string; className: string; background: string; onChoose: (method: StartingEquipmentMethod) => void;
}) {
  if (details && method) return <section className="wizard-option-detail" aria-label="Detalhes dos equipamentos iniciais">
    <h3>{STARTING_EQUIPMENT_LABELS[method]}</h3>
    {method === 'class-background' ? <>
      <p>Comece com os equipamentos de {className || 'sua classe'} e os itens do antecedente {background || 'escolhido'}.</p>
      <h4 className="wizard-information-heading">Equipamento da classe</h4>
      <ul className="wizard-information-list">{(CLASS_STARTING_EQUIPMENT[classKey] ?? []).map(text => <li key={text}>{text}</li>)}</ul>
      <div className="wizard-detail-highlight"><strong>Antecedente</strong><span>{background || 'Escolha seu antecedente na etapa 4.'}</span></div>
      <p className="section-note">Esta é a sua opção inicial de equipamento. Os itens ainda não foram adicionados ao inventário.</p>
    </> : method === 'purchase' ? <>
      <p>Monte seu conjunto comprando armas, armaduras e suprimentos com a riqueza inicial de {className || 'sua classe'}.</p>
      <div className="wizard-detail-highlight"><strong>Riqueza inicial</strong><span>Definida pela classe {className || 'escolhida'}.</span></div>
      <p>Esta alternativa substitui os equipamentos iniciais de classe e antecedente.</p>
      <p className="section-note">A opção fica registrada; nenhuma moeda foi rolada ou gasta nesta etapa.</p>
    </> : <>
      <p>Combine seus equipamentos iniciais diretamente com o Mestre, de acordo com a história do personagem e o início da aventura.</p>
      <p className="section-note">A opção fica registrada para vocês definirem os itens juntos.</p>
    </>}
  </section>;
  return <><p className="section-note">Como você quer obter seus equipamentos iniciais?</p>
    <div className="wizard-mode-cards wizard-equipment-cards" role="group" aria-label="Forma de obter equipamentos iniciais">
      {([
        { key: 'class-background', icon: 'sword', hint: 'Use os equipamentos oferecidos pela sua classe e pelo seu antecedente.' },
        { key: 'purchase', icon: 'coin', hint: `Escolha o que comprar com a riqueza inicial da classe ${className || 'que você selecionou'}.` },
        { key: 'master', icon: 'crown', hint: 'Combine os equipamentos diretamente com o Mestre, conforme a história e a aventura.' },
      ] as const).map(option => <button type="button" key={option.key} disabled={disabled} aria-pressed={method === option.key}
        className={`wizard-mode-card${method === option.key ? ' is-selected' : method ? ' is-dimmed' : ''}`} onClick={() => onChoose(option.key)}>
        <Icon name={option.icon} size={40} /><strong>{STARTING_EQUIPMENT_LABELS[option.key]}</strong><span>{option.hint}</span>
      </button>)}
    </div>
  </>;
}
