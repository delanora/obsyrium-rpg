/** Contrato serializável entre a thread principal e o worker de rotas.
 *
 * Nada aqui conhece DOM, Prisma ou Socket.io: o pedido leva só geometria de
 * apresentação (cards e vínculos do quadro), as larguras de rótulo já medidas e
 * o plano anterior pertinente. O resultado devolve o plano calculado pelo
 * roteador puro. O contrato é versionado para que um resultado de protocolo
 * antigo nunca seja aplicado.
 *
 * Os DTOs são construídos campo a campo: objetos recebidos da interface podem
 * carregar descrições, conteúdo de card ou qualquer propriedade extra, e nada
 * disso atravessa a fronteira do worker.
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
  /** Mensagens fora do protocolo toleradas por voo antes de substituir. */
  maxInvalid: 2,
} as const;

/** Card no formato mínimo que o roteador entende. */
export interface ArchiveRouteNodeDto {
  id: string;
  cardId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Vínculo no formato mínimo que o roteador entende. */
export interface ArchiveRouteLinkDto {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  label: string;
  directed: boolean;
}

/** Plano pronto para `postMessage`: só arrays e objetos simples. */
export interface ArchiveRoutePlanDto {
  routes: [string, ArchiveLinkRoutePlan][];
  stats: ArchiveRouteStats;
  placements: [string, ArchiveRect][];
  topology: [string, string][];
  provisional: boolean;
}

export interface ArchiveRouteRequest {
  protocol: number;
  requestId: number;
  boardId: string;
  generation: number;
  signature: string;
  placements: ArchiveRouteNodeDto[];
  links: ArchiveRouteLinkDto[];
  /** Larguras de rótulo medidas na thread principal: `[texto, largura]`. */
  labels: [string, number][];
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
  /** Larguras de rótulo já medidas (texto → largura em unidades do quadro). */
  labels?: readonly (readonly [string, number])[];
  previous?: ArchiveRoutePlanSet | null;
}

export function encodeRouteNode(node: ArchiveRouteNode): ArchiveRouteNodeDto {
  return {
    id: String(node.id),
    cardId: String(node.cardId),
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

export function decodeRouteNode(dto: ArchiveRouteNodeDto): ArchiveRouteNode {
  return {
    id: dto.id,
    cardId: dto.cardId,
    x: dto.x,
    y: dto.y,
    width: dto.width,
    height: dto.height,
  };
}

export function encodeRouteLink(link: ArchiveRouteLink): ArchiveRouteLinkDto {
  return {
    id: String(link.id),
    sourceId: String(link.sourceId),
    targetId: String(link.targetId),
    relation: typeof link.relation === "string" ? link.relation : "",
    label: typeof link.label === "string" ? link.label : "",
    directed: link.directed === true,
  };
}

export function decodeRouteLink(dto: ArchiveRouteLinkDto): ArchiveRouteLink {
  return {
    id: dto.id,
    sourceId: dto.sourceId,
    targetId: dto.targetId,
    relation: dto.relation || undefined,
    label: dto.label || undefined,
    directed: dto.directed,
  };
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
      { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    ]),
    topology: [...(plan.topology ?? new Map())].map(([id, value]) => [id, value]),
    provisional: plan.provisional === true,
  };
}

/**
 * Plano recebido só vira estado com a estrutura esperada. Um cabeçalho
 * válido com corpo estranho é recusado aqui: `null` em vez de exceção, para
 * que a apresentação siga com as rotas provisórias.
 */
export function decodeRoutePlan(
  dto: ArchiveRoutePlanDto | null | undefined,
): ArchiveRoutePlanSet | null {
  if (!dto || typeof dto !== "object") return null;
  if (
    !Array.isArray(dto.routes) ||
    !Array.isArray(dto.placements) ||
    !Array.isArray(dto.topology) ||
    !dto.stats ||
    typeof dto.stats !== "object"
  )
    return null;
  try {
    return {
      routes: new Map(
        dto.routes.map(([id, route]) => [id, cloneRoutePlan(route)]),
      ),
      stats: { ...dto.stats },
      placements: new Map(
        dto.placements.map(([id, rect]) => [
          id,
          { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        ]),
      ),
      topology: new Map(dto.topology),
      provisional: dto.provisional === true,
    };
  } catch {
    return null;
  }
}

/** Cópia profunda o bastante: nenhum plano anterior é mutado por engano. */
export function cloneRoutePlan(plan: ArchiveLinkRoutePlan): ArchiveLinkRoutePlan {
  return {
    sides: [plan.sides[0], plan.sides[1]],
    slots: [plan.slots[0], plan.slots[1]],
    lane: plan.lane,
    strategy: plan.strategy,
    variant: plan.variant,
    via: plan.via.map((point) => ({ x: point.x, y: point.y })),
    corridor: plan.corridor,
    cost: plan.cost,
    residual: [...plan.residual],
    budget: plan.budget,
    state: plan.state,
    fallbackReason: plan.fallbackReason,
    reused: plan.reused,
    bounds: {
      x: plan.bounds.x,
      y: plan.bounds.y,
      width: plan.bounds.width,
      height: plan.bounds.height,
    },
    label: plan.label
      ? {
          segment: plan.label.segment,
          at: plan.label.at,
          offset: plan.label.offset,
        }
      : null,
    labelOverlap: plan.labelOverlap,
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
    placements: job.placements.map(encodeRouteNode),
    links: job.links.map(encodeRouteLink),
    labels: (job.labels ?? []).map(([text, width]) => [String(text), width]),
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
