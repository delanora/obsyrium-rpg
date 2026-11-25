import type {
  NarrativeBoard,
  NarrativeCard,
  NarrativeLink,
  NarrativeGroup,
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
export const groupSummary = (r: NarrativeGroup) => ({
  id: r.id,
  name: r.name,
  color: r.color,
  version: r.version,
});
export const groupDto = (
  r: NarrativeGroup & { _count?: { cards: number } },
) => ({
  ...groupSummary(r),
  description: r.description,
  createdById: r.createdById,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  cardCount: r._count?.cards ?? 0,
});
export const cardGroupsInclude = {
  groups: { include: { group: true }, orderBy: { groupId: "asc" as const } },
};
export const cardDto = (
  r: NarrativeCard & { groups?: { group: NarrativeGroup }[] },
): NarrativeCardDto => ({
  ...r,
  category: r.category as NarrativeCardDto["category"],
  groups: (r.groups ?? []).map((entry) => groupSummary(entry.group)),
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
