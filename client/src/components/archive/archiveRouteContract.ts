/** Contrato serializável entre a thread principal e o worker de rotas.
 *
 * Nada aqui conhece DOM, Prisma ou Socket.io: o pedido leva só geometria de
 * apresentação (cards e vínculos do quadro) e o resultado devolve o plano já
 * calculado pelo roteador puro. O contrato é versionado para que um resultado
 * de protocolo antigo nunca seja aplicado.
 */
import type { ArchiveRect } from "./archiveCamera";
import type {
  ArchiveLinkRoutePlan,
  ArchiveRouteLink,
  ArchiveRouteNode,
  ArchiveRoutePlanSet,
  ArchiveRouteStats,
} from "./archiveLinkRouting";

export const ARCHIVE_ROUTE_PROTOCOL = 1;

/** Limites de higiene da fila (não são orçamento de planejamento). */
export const ARCHIVE_ROUTE_QUEUE = {
  /** Um trabalho pendente por vez: o mais recente substitui o anterior. */
  maxPending: 1,
  /** Sem resposta nesse prazo, um pendente mais novo substitui o worker. */
  stallMs: 4_000,
  /** Substituições controladas do worker antes de declarar falha. */
  maxRestarts: 2,
  /** Resultados obsoletos tolerados antes de forçar substituição. */
  maxDiscards: 8,
} as const;

/** Plano pronto para `postMessage`: só arrays e objetos simples. */
export interface ArchiveRoutePlanDto {
  routes: [string, ArchiveLinkRoutePlan][];
  stats: ArchiveRouteStats;
  placements: [string, ArchiveRect][];
  topology: [string, string][];
}

export interface ArchiveRouteRequest {
  protocol: number;
  requestId: number;
  boardId: string;
  generation: number;
  signature: string;
  placements: ArchiveRouteNode[];
  links: ArchiveRouteLink[];
  previous: ArchiveRoutePlanDto | null;
}

export interface ArchiveRouteResponse {
  protocol: number;
  requestId: number;
  boardId: string;
  generation: number;
  signature: string;
  plan: ArchiveRoutePlanDto | null;
  error: string | null;
  /** Tempo gasto dentro do worker (diagnóstico; não decide aplicação). */
  elapsed: number;
}

/** Trabalho pedido pela interface; a fila decide quando ele vira requisição. */
export interface ArchiveRouteJob {
  boardId: string;
  signature: string;
  placements: readonly ArchiveRouteNode[];
  links: readonly ArchiveRouteLink[];
  previous?: ArchiveRoutePlanSet | null;
}

export function encodeRoutePlan(
  plan: ArchiveRoutePlanSet | null | undefined,
): ArchiveRoutePlanDto | null {
  if (!plan) return null;
  return {
    routes: [...plan.routes].map(([id, route]) => [id, cloneRoutePlan(route)]),
    stats: { ...plan.stats },
    placements: [...(plan.placements ?? new Map())].map(([id, rect]) => [
      id,
      { ...rect },
    ]),
    topology: [...(plan.topology ?? new Map())].map(([id, value]) => [id, value]),
  };
}

export function decodeRoutePlan(
  dto: ArchiveRoutePlanDto | null | undefined,
): ArchiveRoutePlanSet | null {
  if (!dto) return null;
  return {
    routes: new Map(
      dto.routes.map(([id, route]) => [id, cloneRoutePlan(route)]),
    ),
    stats: { ...dto.stats },
    placements: new Map(dto.placements.map(([id, rect]) => [id, { ...rect }])),
    topology: new Map(dto.topology),
  };
}

/** Cópia profunda o bastante: nenhum plano anterior é mutado por engano. */
export function cloneRoutePlan(plan: ArchiveLinkRoutePlan): ArchiveLinkRoutePlan {
  return {
    ...plan,
    sides: [plan.sides[0], plan.sides[1]],
    slots: [plan.slots[0], plan.slots[1]],
    via: plan.via.map((point) => ({ x: point.x, y: point.y })),
    residual: [...plan.residual],
    bounds: { ...plan.bounds },
    label: plan.label ? { ...plan.label } : null,
  };
}

export function encodeRouteRequest(
  job: ArchiveRouteJob,
  requestId: number,
  generation: number,
): ArchiveRouteRequest {
  return {
    protocol: ARCHIVE_ROUTE_PROTOCOL,
    requestId,
    boardId: job.boardId,
    generation,
    signature: job.signature,
    placements: job.placements.map((node) => ({ ...node })),
    links: job.links.map((link) => ({ ...link })),
    previous: encodeRoutePlan(job.previous),
  };
}

export function isArchiveRouteResponse(value: unknown): value is ArchiveRouteResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<ArchiveRouteResponse>;
  return (
    response.protocol === ARCHIVE_ROUTE_PROTOCOL &&
    typeof response.requestId === "number" &&
    typeof response.generation === "number" &&
    typeof response.signature === "string" &&
    typeof response.boardId === "string"
  );
}
