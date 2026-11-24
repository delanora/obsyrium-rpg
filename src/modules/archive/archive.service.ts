import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { getBroadcaster } from "../../realtime/hub.js";
import { ServerEvents } from "../../realtime/events.js";
import {
  archiveOperationSchema,
  type ArchiveOperation,
} from "./archive.schema.js";
import { boardDto, cardDto, linkDto } from "./archive.dto.js";
import type { NarrativeGraphDto } from "../shared/narrative.js";
export interface ArchiveActor {
  userId: string;
  role: string;
}
export interface ArchiveReceipt {
  id: string;
  version?: number;
  replayed?: boolean;
}
function requireMaster(actor: ArchiveActor) {
  if (actor.role !== "MASTER")
    throw new HttpError("O Arquivo é exclusivo do Mestre.", 403, "FORBIDDEN");
}
export async function listArchiveBoards(actor: ArchiveActor) {
  requireMaster(actor);
  return (
    await prisma.narrativeBoard.findMany({ orderBy: { createdAt: "asc" } })
  ).map(boardDto);
}
export async function listArchiveCards(actor: ArchiveActor) {
  requireMaster(actor);
  return prisma.narrativeCard.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true, category: true, version: true },
  });
}
export async function getArchiveCard(actor: ArchiveActor, id: string) {
  requireMaster(actor);
  const r = await prisma.narrativeCard.findUnique({ where: { id } });
  if (!r) throw new HttpError("Card não encontrado.", 404);
  return cardDto(r);
}
export async function getArchiveGraph(
  actor: ArchiveActor,
  id: string,
): Promise<NarrativeGraphDto> {
  requireMaster(actor);
  return prisma.$transaction(
    async (db) => {
      const board = await db.narrativeBoard.findUnique({ where: { id } });
      if (!board) throw new HttpError("Quadro não encontrado.", 404);
      const placements = await db.narrativePlacement.findMany({
        where: { boardId: id },
        include: { card: true },
        orderBy: [{ zIndex: "asc" }, { id: "asc" }],
      });
      const ids = placements.map((p) => p.cardId);
      const links = await db.narrativeLink.findMany({
        where: { sourceId: { in: ids }, targetId: { in: ids } },
        orderBy: { createdAt: "asc" },
      });
      return {
        board: boardDto(board),
        placements: placements.map((p) => ({ ...p, card: cardDto(p.card) })),
        links: links.map(linkDto),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
function conflict() {
  return new HttpError(
    "O Arquivo mudou em outra janela. Recarregue antes de salvar novamente.",
    409,
    "CONFLICT",
  );
}
/** A mesma identidade canônica é usada por relações livres e por vínculos opcionais de ramificações. */
function narrativeLinkData(input: {
  sourceId: string;
  targetId: string;
  relation: string;
  label: string;
  directed: boolean;
  description: string;
}) {
  if (input.sourceId === input.targetId)
    throw new HttpError(
      "Um card não pode se conectar a si mesmo.",
      400,
      "SELF_RELATION",
    );
  const label = input.relation === "custom" ? input.label.trim() : "";
  if (input.relation === "custom" && !label)
    throw new HttpError("Dê um nome à relação personalizada.", 400);
  const ends = input.directed
    ? [input.sourceId, input.targetId]
    : [input.sourceId, input.targetId].sort();
  const signature = createHash("sha256")
    .update(
      JSON.stringify([
        ends,
        input.directed,
        input.relation,
        label.normalize("NFKC").toLocaleLowerCase("pt-BR"),
      ]),
    )
    .digest("hex");
  return {
    sourceId: input.sourceId,
    targetId: input.targetId,
    relation: input.relation,
    label,
    directed: input.directed,
    description: input.description,
    signature,
  };
}
/** Mesma semântica de SceneOperation: versão esperada, fingerprint e recibo atômico. */
export async function operateArchive(
  actor: ArchiveActor,
  raw: unknown,
): Promise<ArchiveReceipt> {
  requireMaster(actor);
  const parsed = archiveOperationSchema.safeParse(raw);
  if (!parsed.success)
    throw new HttpError(
      parsed.error.issues.map((i) => i.message).join(" "),
      400,
      "VALIDATION_ERROR",
    );
  const input: ArchiveOperation = parsed.data;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  let replayed = false;
  let result: ArchiveReceipt;
  try {
    result = await prisma.$transaction(
      async (db) => {
        // Serializa as alterações deste pequeno grafo privado (inclusive deleções
        // entre quadros). CAS continua sendo a guarda de edição das entidades.
        await db.$queryRaw`SELECT pg_advisory_xact_lock(8541001)::text`;
        const old = await db.narrativeOperation.findUnique({
          where: {
            actorId_operationId: {
              actorId: actor.userId,
              operationId: input.operationId,
            },
          },
        });
        if (old) {
          if (old.fingerprint !== fingerprint)
            throw new HttpError(
              "Identificador reutilizado com outro pedido.",
              409,
              "IDEMPOTENCY_KEY_REUSED",
            );
          replayed = true;
          return old.result as unknown as ArchiveReceipt;
        }
        const boardVersion = async (id: string, expected: number) => {
          const row = await db.narrativeBoard.findUnique({ where: { id } });
          if (!row) throw new HttpError("Quadro não encontrado.", 404);
          if (
            !(
              await db.narrativeBoard.updateMany({
                where: { id, version: expected },
                data: { version: { increment: 1 } },
              })
            ).count
          )
            throw conflict();
          return expected + 1;
        };
        const ensureCard = async (id: string) => {
          const card = await db.narrativeCard.findUnique({ where: { id } });
          if (!card) throw new HttpError("Card não encontrado.", 404);
          return card;
        };
        const ensureLink = async (id: string, version: number) => {
          const link = await db.narrativeLink.findUnique({ where: { id } });
          if (!link) throw new HttpError("Relação não encontrada.", 404);
          if (link.version !== version) throw conflict();
          return link;
        };
        const placement = async (id: string, boardId: string) => {
          const row = await db.narrativePlacement.findUnique({ where: { id } });
          if (!row || row.boardId !== boardId)
            throw new HttpError(
              "Representação não encontrada neste quadro.",
              404,
            );
          return row;
        };
        const validateParent = async (
          boardId: string,
          childId: string | null,
          parentId: string,
        ) => {
          const parent = await placement(parentId, boardId);
          const visited = new Set<string>();
          let cursor: typeof parent | null = parent;
          while (cursor) {
            if (cursor.id === childId || visited.has(cursor.id))
              throw new HttpError(
                "O pertencimento não pode criar ciclos.",
                400,
                "STRUCTURAL_CYCLE",
              );
            visited.add(cursor.id);
            cursor = cursor.parentPlacementId
              ? await placement(cursor.parentPlacementId, boardId)
              : null;
          }
          return parent;
        };
        const branchLink = async (
          parentCardId: string,
          childCardId: string,
          relation:
            | {
                relation: string;
                label: string;
                directed: boolean;
                description: string;
              }
            | undefined,
        ) => {
          if (!relation) return;
          const data = narrativeLinkData({
            sourceId: parentCardId,
            targetId: childCardId,
            ...relation,
          });
          // Reaproveita a relação existente sem alterar descrição, tipo ou versão.
          if (
            !(await db.narrativeLink.findUnique({
              where: { signature: data.signature },
            }))
          )
            await db.narrativeLink.create({
              data: { ...data, createdById: actor.userId },
            });
        };
        let receipt: ArchiveReceipt;
        switch (input.action) {
          case "board.create": {
            if ((await db.narrativeBoard.count()) >= 100)
              throw new HttpError("Limite de 100 quadros atingido.", 400);
            const r = await db.narrativeBoard.create({
              data: {
                name: input.name,
                description: input.description,
                createdById: actor.userId,
              },
            });
            receipt = { id: r.id, version: r.version };
            break;
          }
          case "board.update": {
            const version = await boardVersion(
              input.boardId,
              input.expectedVersion,
            );
            await db.narrativeBoard.update({
              where: { id: input.boardId },
              data: { name: input.name, description: input.description },
            });
            receipt = { id: input.boardId, version };
            break;
          }
          case "board.delete": {
            await boardVersion(input.boardId, input.expectedVersion);
            await db.narrativeBoard.delete({ where: { id: input.boardId } });
            receipt = { id: input.boardId };
            break;
          }
          case "card.create":
          case "placement.add": {
            const version = await boardVersion(
              input.boardId,
              input.expectedVersion,
            );
            if (
              (await db.narrativePlacement.count({
                where: { boardId: input.boardId },
              })) >= 500
            )
              throw new HttpError(
                "Limite de 500 cards neste quadro atingido.",
                400,
              );
            if (input.branchRelation && !input.parentPlacementId)
              throw new HttpError("Informe o núcleo da ramificação.", 400);
            const parent = input.parentPlacementId
              ? await validateParent(
                  input.boardId,
                  null,
                  input.parentPlacementId,
                )
              : null;
            let cardId: string;
            if (input.action === "card.create") {
              if ((await db.narrativeCard.count()) >= 10000)
                throw new HttpError("Limite de cards atingido.", 400);
              const card = await db.narrativeCard.create({
                data: {
                  title: input.title,
                  category: input.category,
                  summary: input.summary,
                  content: input.content,
                  createdById: actor.userId,
                },
              });
              cardId = card.id;
            } else {
              await ensureCard(input.cardId);
              cardId = input.cardId;
            }
            const r = await db.narrativePlacement.create({
              data: {
                boardId: input.boardId,
                cardId,
                parentPlacementId: parent?.id ?? null,
                ...input.geometry,
              },
            });
            if (parent)
              await branchLink(parent.cardId, cardId, input.branchRelation);
            receipt = { id: r.id, version };
            break;
          }
          case "placement.parent": {
            const version = await boardVersion(
              input.boardId,
              input.expectedVersion,
            );
            const child = await placement(input.placementId, input.boardId);
            if (child.parentPlacementId === input.parentPlacementId)
              throw new HttpError(
                "Esta associação estrutural já está definida.",
                409,
                "DUPLICATE_STRUCTURE",
              );
            if (input.parentPlacementId && child.parentPlacementId)
              throw new HttpError(
                "Remova o pertencimento atual antes de associar outro núcleo.",
                409,
                "STRUCTURAL_PARENT_EXISTS",
              );
            if (!input.parentPlacementId && input.branchRelation)
              throw new HttpError(
                "Remover pertencimento não altera relações narrativas.",
                400,
              );
            const parent = input.parentPlacementId
              ? await validateParent(
                  input.boardId,
                  child.id,
                  input.parentPlacementId,
                )
              : null;
            await db.narrativePlacement.update({
              where: { id: child.id },
              data: {
                parentPlacementId: parent?.id ?? null,
                branchOffsetX: null,
                branchOffsetY: null,
              },
            });
            if (parent)
              await branchLink(
                parent.cardId,
                child.cardId,
                input.branchRelation,
              );
            receipt = { id: child.id, version };
            break;
          }
          case "placement.reset": {
            const version = await boardVersion(
              input.boardId,
              input.expectedVersion,
            );
            await placement(input.placementId, input.boardId);
            await db.narrativePlacement.updateMany({
              where: input.children
                ? {
                    boardId: input.boardId,
                    parentPlacementId: input.placementId,
                  }
                : { boardId: input.boardId, id: input.placementId },
              data: { branchOffsetX: null, branchOffsetY: null },
            });
            receipt = { id: input.placementId, version };
            break;
          }
          case "placement.update":
          case "placement.remove": {
            const version = await boardVersion(
              input.boardId,
              input.expectedVersion,
            );
            const r = await db.narrativePlacement.findFirst({
              where: { id: input.placementId, boardId: input.boardId },
            });
            if (!r)
              throw new HttpError(
                "Representação não encontrada neste quadro.",
                404,
              );
            if (input.action === "placement.remove") {
              await db.narrativePlacement.updateMany({
                where: { parentPlacementId: r.id },
                data: {
                  parentPlacementId: null,
                  branchOffsetX: null,
                  branchOffsetY: null,
                },
              });
              await db.narrativePlacement.delete({ where: { id: r.id } });
            } else {
              if (input.relative) {
                if (
                  !r.parentPlacementId ||
                  r.parentPlacementId !== input.relative.parentPlacementId
                )
                  throw new HttpError(
                    "O núcleo desta ramificação mudou. Recarregue o quadro.",
                    409,
                    "CONFLICT",
                  );
                await placement(
                  input.relative.parentPlacementId,
                  input.boardId,
                );
              }
              await db.narrativePlacement.update({
                where: { id: r.id },
                data: {
                  ...input.geometry,
                  ...(input.relative
                    ? {
                        branchOffsetX: input.relative.x,
                        branchOffsetY: input.relative.y,
                      }
                    : {}),
                },
              });
            }
            receipt = { id: r.id, version };
            break;
          }
          case "card.update":
          case "card.delete": {
            await ensureCard(input.cardId);
            if (
              !(
                await db.narrativeCard.updateMany({
                  where: { id: input.cardId, version: input.expectedVersion },
                  data: { version: { increment: 1 } },
                })
              ).count
            )
              throw conflict();
            if (input.action === "card.delete") {
              const places = await db.narrativePlacement.findMany({
                where: { cardId: input.cardId },
                select: { id: true, boardId: true },
              });
              await db.narrativeBoard.updateMany({
                where: { id: { in: places.map((p) => p.boardId) } },
                data: { version: { increment: 1 } },
              });
              await db.narrativePlacement.updateMany({
                where: { parentPlacementId: { in: places.map((p) => p.id) } },
                data: {
                  parentPlacementId: null,
                  branchOffsetX: null,
                  branchOffsetY: null,
                },
              });
              await db.narrativeCard.delete({ where: { id: input.cardId } });
            } else
              await db.narrativeCard.update({
                where: { id: input.cardId },
                data: {
                  title: input.title,
                  category: input.category,
                  summary: input.summary,
                  content: input.content,
                },
              });
            receipt = { id: input.cardId, version: input.expectedVersion + 1 };
            break;
          }
          case "link.create":
          case "link.update": {
            if (input.sourceId === input.targetId)
              throw new HttpError(
                "Um card não pode se conectar a si mesmo.",
                400,
                "SELF_RELATION",
              );
            await ensureCard(input.sourceId);
            await ensureCard(input.targetId);
            if (input.action === "link.create") {
              if (
                !(await db.narrativeBoard.findUnique({
                  where: { id: input.boardId },
                }))
              )
                throw new HttpError("Quadro não encontrado.", 404);
              if (
                (await db.narrativePlacement.count({
                  where: {
                    boardId: input.boardId,
                    cardId: { in: [input.sourceId, input.targetId] },
                  },
                })) !== 2
              )
                throw new HttpError(
                  "Conecte dois cards presentes no mesmo quadro.",
                  400,
                );
            } else await ensureLink(input.linkId, input.expectedVersion);
            const data = narrativeLinkData(input);
            const signature = data.signature;
            const duplicate = await db.narrativeLink.findUnique({
              where: { signature },
            });
            if (
              duplicate &&
              (input.action === "link.create" || duplicate.id !== input.linkId)
            ) {
              throw new HttpError(
                "Esta relação já existe.",
                409,
                "DUPLICATE_NARRATIVE",
              );
            }
            if (input.action === "link.create") {
              const r = await db.narrativeLink.create({
                data: { ...data, createdById: actor.userId },
              });
              receipt = { id: r.id, version: r.version };
            } else {
              const changed = await db.narrativeLink.updateMany({
                where: { id: input.linkId, version: input.expectedVersion },
                data: { ...data, version: { increment: 1 } },
              });
              if (!changed.count) throw conflict();
              receipt = {
                id: input.linkId,
                version: input.expectedVersion + 1,
              };
            }
            break;
          }
          case "link.delete": {
            await ensureLink(input.linkId, input.expectedVersion);
            const removed = await db.narrativeLink.deleteMany({
              where: { id: input.linkId, version: input.expectedVersion },
            });
            if (!removed.count) throw conflict();
            receipt = { id: input.linkId };
            break;
          }
        }
        await db.narrativeOperation.create({
          data: {
            actorId: actor.userId,
            operationId: input.operationId,
            fingerprint,
            result: receipt as unknown as Prisma.InputJsonValue,
          },
        });
        return receipt;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new HttpError(
        "Este card já está no quadro ou esta relação já existe.",
        409,
        "DUPLICATE_NARRATIVE",
      );
    throw error;
  }
  if (!replayed) {
    try {
      getBroadcaster().toMasters(ServerEvents.ARCHIVE_UPDATED, {
        at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[arquivo] notificação indisponível", error);
    }
  }
  return { ...result, replayed };
}
