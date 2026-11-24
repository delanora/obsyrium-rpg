/** Classificações narrativas; não concedem ações nem efeitos mecânicos. */
export const NARRATIVE_CATEGORIES = [
  "region",
  "locality",
  "dungeon",
  "room",
  "npc",
  "creature",
  "item",
  "faction",
  "event",
  "scene",
  "encounter",
  "trap",
  "clue",
  "sound",
  "image",
  "note",
] as const;
export type NarrativeCategory = (typeof NARRATIVE_CATEGORIES)[number];
export const NARRATIVE_CATEGORY_LABELS: Record<NarrativeCategory, string> = {
  region: "Região",
  locality: "Localidade",
  dungeon: "Masmorra",
  room: "Sala",
  npc: "NPC",
  creature: "Criatura",
  item: "Item",
  faction: "Facção",
  event: "Acontecimento",
  scene: "Cena",
  encounter: "Encontro",
  trap: "Armadilha",
  clue: "Pista",
  sound: "Efeito sonoro",
  image: "Imagem",
  note: "Anotação",
};
export const NARRATIVE_RELATIONS = [
  "inhabits",
  "contains",
  "owns",
  "knows",
  "protects",
  "belongs",
  "ally",
  "enemy",
  "leads",
  "triggers",
  "related",
  "custom",
] as const;
export type NarrativeRelation = (typeof NARRATIVE_RELATIONS)[number];
export const NARRATIVE_RELATION_LABELS: Record<NarrativeRelation, string> = {
  inhabits: "Habita",
  contains: "Contém",
  owns: "Possui",
  knows: "Conhece",
  protects: "Protege",
  belongs: "Pertence a",
  ally: "É aliado de",
  enemy: "É inimigo de",
  leads: "Leva a",
  triggers: "Desencadeia",
  related: "Está relacionado a",
  custom: "Relação personalizada",
};
export interface NarrativeBoardDto {
  id: string;
  name: string;
  description: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface NarrativeCardDto {
  id: string;
  title: string;
  category: NarrativeCategory;
  summary: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface NarrativePlacementDto {
  /** Pai estrutural no quadro; ausente em clientes anteriores à expansão. */
  parentPlacementId?: string | null;
  /** Vetor entre centros, em unidades do quadro; ambos nulos = automático. */
  branchOffsetX?: number | null;
  branchOffsetY?: number | null;
  id: string;
  boardId: string;
  cardId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  card: NarrativeCardDto;
}
export interface NarrativeLinkDto {
  id: string;
  sourceId: string;
  targetId: string;
  relation: NarrativeRelation;
  label: string;
  directed: boolean;
  description: string;
  version: number;
}
export interface NarrativeGraphDto {
  board: NarrativeBoardDto;
  placements: NarrativePlacementDto[];
  links: NarrativeLinkDto[];
}
