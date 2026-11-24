import type {
  NarrativeBoard,
  NarrativeCard,
  NarrativeLink,
} from "@prisma/client";
import type {
  NarrativeBoardDto,
  NarrativeCardDto,
  NarrativeLinkDto,
} from "../shared/narrative.js";
export const boardDto = (r: NarrativeBoard): NarrativeBoardDto => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});
export const cardDto = (r: NarrativeCard): NarrativeCardDto => ({
  ...r,
  category: r.category as NarrativeCardDto["category"],
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});
export const linkDto = (r: NarrativeLink): NarrativeLinkDto => ({
  id: r.id,
  sourceId: r.sourceId,
  targetId: r.targetId,
  relation: r.relation as NarrativeLinkDto["relation"],
  label: r.label,
  directed: r.directed,
  description: r.description,
  version: r.version,
});
