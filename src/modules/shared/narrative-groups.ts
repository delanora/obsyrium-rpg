/** Identidade textual independente de categoria, ramificação ou relação. */
export const NARRATIVE_GROUP_LIMITS = {
  total: 500,
  perCard: 30,
  name: 80,
  description: 500,
} as const;
export const normalizeNarrativeGroupName = (name: string) =>
  name.normalize("NFC").replace(/\s+/gu, " ").trim();
export const narrativeGroupNameKey = (name: string) =>
  normalizeNarrativeGroupName(name).toLocaleLowerCase("pt-BR");
export interface NarrativeGroupSummaryDto {
  id: string;
  name: string;
  color: string;
  version: number;
}
export interface NarrativeGroupDto extends NarrativeGroupSummaryDto {
  description: string;
  cardCount: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}
