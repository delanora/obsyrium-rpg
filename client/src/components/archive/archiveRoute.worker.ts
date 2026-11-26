/** Worker do planejamento relacional.
 *
 * Reaproveita o roteador puro (`planArchiveLinkRoutes`), sem DOM e sem acesso a
 * dados persistidos: a thread principal continua dona dos cards, da câmera e do
 * scheduler de animação. Cada resposta carrega o pedido de origem; a interface
 * decide se ainda é válida.
 */
import { planArchiveLinkRoutes } from "./archiveLinkRouting";
import {
  ARCHIVE_ROUTE_PROTOCOL,
  decodeRouteLink,
  decodeRouteNode,
  decodeRoutePlan,
  encodeRoutePlan,
  type ArchiveRouteRequest,
  type ArchiveRouteResponse,
} from "./archiveRouteContract";

const scope = globalThis as unknown as {
  onmessage: ((event: { data: ArchiveRouteRequest }) => void) | null;
  postMessage: (message: ArchiveRouteResponse) => void;
};

scope.onmessage = (event) => {
  const request = event.data;
  if (!request || request.protocol !== ARCHIVE_ROUTE_PROTOCOL) return;
  const started = Date.now();
  const respond = (plan: ArchiveRouteResponse["plan"], error: string | null) =>
    scope.postMessage({
      protocol: ARCHIVE_ROUTE_PROTOCOL,
      requestId: request.requestId,
      boardId: request.boardId,
      generation: request.generation,
      signature: request.signature,
      plan,
      error,
      elapsed: Date.now() - started,
    });
  // Larguras medidas na thread principal: o worker não tem DOM nem a
  // medição do render, e a caixa avaliada precisa ser a cápsula apresentada.
  const widths = new Map(request.labels);
  try {
    const plan = planArchiveLinkRoutes({
      placements: request.placements.map(decodeRouteNode),
      links: request.links.map(decodeRouteLink),
      labelWidth: (label) => widths.get(label) ?? 0,
      previous: decodeRoutePlan(request.previous),
    });
    respond(encodeRoutePlan(plan), null);
  } catch (error) {
    respond(null, error instanceof Error ? error.message : String(error));
  }
};
