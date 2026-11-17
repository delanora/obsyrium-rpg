/** Apenas a preferência inicial; entrega, compra e riqueza serão resolvidas em etapas próprias. */
export const STARTING_EQUIPMENT_METHODS = ['class-background', 'purchase', 'master'] as const;
export type StartingEquipmentMethod = (typeof STARTING_EQUIPMENT_METHODS)[number];
export const STARTING_EQUIPMENT_LABELS: Record<StartingEquipmentMethod, string> = {
  'class-background': 'Classe e antecedente', purchase: 'Compra de equipamentos', master: 'Tratar com o Mestre',
};
export function normalizeEquipmentMethod(value: unknown): StartingEquipmentMethod | null {
  return STARTING_EQUIPMENT_METHODS.includes(value as StartingEquipmentMethod) ? value as StartingEquipmentMethod : null;
}
