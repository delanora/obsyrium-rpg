/** Explicação de apresentação: todos os valores e modos são calculados no servidor. */
export interface RollModifierCard {
  id: string;
  kind: 'flat' | 'dice' | 'advantage' | 'disadvantage' | 'failure';
  label: string;
  detail: string;
  value?: number;
  count?: number;
  sides?: number;
  sign?: 1 | -1;
  applied: boolean;
  /** Somente na prévia privada do autor; nunca no resultado público. */
  optionId?: string;
}
export interface RollModifierView {
  cards: RollModifierCard[];
  bonus: number;
  advantage: boolean;
  disadvantage: boolean;
  autoFail: boolean;
}
