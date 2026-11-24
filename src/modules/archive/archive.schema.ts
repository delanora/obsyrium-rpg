import { z } from "zod";
import {
  NARRATIVE_CATEGORIES,
  NARRATIVE_RELATIONS,
} from "../shared/narrative.js";
const id = z.string().uuid();
const receipt = { operationId: z.string().min(1).max(128) };
const version = { expectedVersion: z.number().int().nonnegative() };
const name = z.string().trim().min(1).max(160);
const description = z.string().max(4000);
const card = {
  title: name,
  category: z.enum(NARRATIVE_CATEGORIES),
  summary: z.string().max(1000),
  content: z.string().max(100000),
};
export const narrativeGeometrySchema = z
  .object({
    x: z.number().finite().min(-1000000).max(1000000),
    y: z.number().finite().min(-1000000).max(1000000),
    width: z.number().finite().min(180).max(1600),
    height: z.number().finite().min(120).max(1600),
    zIndex: z.number().int().min(0).max(1000000),
  })
  .strict();
const link = {
  sourceId: id,
  targetId: id,
  relation: z.enum(NARRATIVE_RELATIONS),
  label: z.string().trim().max(160),
  directed: z.boolean(),
  description,
};
const branchRelation = z
  .object({
    relation: z.enum(NARRATIVE_RELATIONS),
    label: z.string().trim().max(160),
    directed: z.boolean(),
    description,
  })
  .strict();
const branch = {
  parentPlacementId: id.optional(),
  branchRelation: branchRelation.optional(),
};
export const archiveOperationSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...receipt,
      action: z.literal("board.create"),
      name,
      description,
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("board.update"),
      boardId: id,
      name,
      description,
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("board.delete"),
      boardId: id,
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("card.create"),
      ...branch,
      boardId: id,
      ...card,
      geometry: narrativeGeometrySchema,
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("card.update"),
      cardId: id,
      ...card,
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("card.delete"),
      cardId: id,
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("placement.add"),
      ...branch,
      boardId: id,
      cardId: id,
      geometry: narrativeGeometrySchema,
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("placement.parent"),
      boardId: id,
      placementId: id,
      parentPlacementId: id.nullable(),
      branchRelation: branchRelation.optional(),
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("placement.update"),
      boardId: id,
      placementId: id,
      geometry: narrativeGeometrySchema,
      relative: z
        .object({
          parentPlacementId: id,
          x: z.number().finite().min(-2002000).max(2002000),
          y: z.number().finite().min(-2002000).max(2002000),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("placement.reset"),
      boardId: id,
      placementId: id,
      children: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("placement.remove"),
      boardId: id,
      placementId: id,
    })
    .strict(),
  z
    .object({
      ...receipt,
      action: z.literal("link.create"),
      boardId: id,
      ...link,
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("link.update"),
      linkId: id,
      ...link,
    })
    .strict(),
  z
    .object({
      ...receipt,
      ...version,
      action: z.literal("link.delete"),
      linkId: id,
    })
    .strict(),
]);
export type ArchiveOperation = z.infer<typeof archiveOperationSchema>;
