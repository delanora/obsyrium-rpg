import type { RollModifierView } from '../../../src/modules/shared/roll-modifier-view';
import './roll-modifiers.css';

/** Explica a rolagem; os valores são fornecidos pelo servidor, nunca somados aqui. */
export function RollModifierCards({ view, disabled, onToggle }: {
  view?: RollModifierView | null; disabled: boolean; onToggle: (id: string) => void;
}) {
  if (!view?.cards.length) return null;
  return <section className="dice-modifiers" aria-label="Modificadores da rolagem">
    {view.cards.map(card => {
      const value = card.kind === 'flat' ? `${(card.value ?? 0) >= 0 ? '+' : ''}${card.value ?? 0}`
        : card.kind === 'dice' ? `${card.sign === -1 ? '−' : '+'}${card.count ?? 1}d${card.sides ?? 4}`
        : card.kind === 'advantage' ? 'Vantagem' : card.kind === 'disadvantage' ? 'Desvantagem' : 'Falha automática';
      const content = <><strong>{value}</strong><span>{card.label}</span><small>{card.detail}</small></>;
      const className = `dice-modifier is-${card.kind}${card.applied ? ' is-applied' : ' is-inactive'}`;
      return card.optionId ? <button key={card.id} type="button" className={className} aria-pressed={card.applied}
        title={card.detail} disabled={disabled} onClick={() => onToggle(card.optionId!)}>{content}</button>
        : <div key={card.id} className={className} title={card.detail}>{content}</div>;
    })}
  </section>;
}
