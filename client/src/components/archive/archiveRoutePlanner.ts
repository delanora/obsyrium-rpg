/** Fila e ciclo de vida do worker de rotas.
 *
 * Regras (documentadas na microfase 8.5.4.2.2):
 * - no máximo UM trabalho em execução e UM pendente (o mais recente vence);
 * - resultado só é aplicado se `requestId`, `generation`, `signature` e
 *   `boardId` corresponderem ao estado atual — resposta atrasada é descartada,
 *   nunca "desfaz" uma mudança;
 * - worker que trava com pendente mais novo, ou que acumula descartes, é
 *   substituído de forma controlada (nunca um worker por vínculo/frame);
 * - falha do worker nunca volta ao planejamento síncrono pesado: a interface
 *   continua com o plano provisório e o diagnóstico de não verificado.
 */
import {
  ARCHIVE_ROUTE_PROTOCOL,
  ARCHIVE_ROUTE_QUEUE,
  decodeRoutePlan,
  encodeRouteRequest,
  isArchiveRouteResponse,
  type ArchiveRouteJob,
  type ArchiveRouteRequest,
  type ArchiveRouteResponse,
} from "./archiveRouteContract";
import type { ArchiveRoutePlanSet } from "./archiveLinkRouting";

export interface ArchiveRouteWorkerLike {
  postMessage(message: ArchiveRouteRequest): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type ArchiveRouteWorkerFactory = () => ArchiveRouteWorkerLike;

/** Worker real do Vite: um módulo separado, carregado sob demanda. */
export function createArchiveRouteWorker(): ArchiveRouteWorkerLike {
  const worker = new Worker(
    new URL("./archiveRoute.worker.ts", import.meta.url),
    { type: "module" },
  );
  return worker as unknown as ArchiveRouteWorkerLike;
}

export interface ArchiveRouteResultMeta {
  requestId: number;
  generation: number;
  boardId: string;
  signature: string;
  /** Tempo dentro do worker, informado por ele (diagnóstico). */
  workerMs: number;
  /** Latência entre envio e recepção, medida na thread principal. */
  latencyMs: number;
}

export interface ArchiveRoutePlannerStatus {
  inFlight: boolean;
  pending: boolean;
  dispatched: number;
  applied: number;
  discarded: number;
  superseded: number;
  errors: number;
  restarts: number;
  failed: boolean;
  generation: number;
}

export interface ArchiveRoutePlannerOptions {
  factory?: ArchiveRouteWorkerFactory;
  stallMs?: number;
  maxRestarts?: number;
  maxDiscards?: number;
  now?: () => number;
  onResult?: (plan: ArchiveRoutePlanSet, meta: ArchiveRouteResultMeta) => void;
  onError?: (message: string) => void;
}

interface Flight {
  request: ArchiveRouteRequest;
  sentAt: number;
}

export class ArchiveRoutePlanner {
  private worker: ArchiveRouteWorkerLike | null = null;
  private readonly factory: ArchiveRouteWorkerFactory;
  private readonly options: ArchiveRoutePlannerOptions;
  private pending: ArchiveRouteRequest | null = null;
  private flight: Flight | null = null;
  private current: ArchiveRouteRequest | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private requestId = 0;
  private disposed = false;
  private failed = false;
  private restarts = 0;
  private counts = {
    dispatched: 0,
    applied: 0,
    discarded: 0,
    superseded: 0,
    errors: 0,
  };

  constructor(options: ArchiveRoutePlannerOptions = {}) {
    this.options = options;
    this.factory = options.factory ?? createArchiveRouteWorker;
  }

  /** Registra um pedido. A geração nova invalida tudo o que estava em voo. */
  request(job: ArchiveRouteJob): number {
    if (this.disposed) return this.generation;
    this.generation++;
    const request = encodeRouteRequest(job, ++this.requestId, this.generation);
    if (this.pending) this.counts.superseded++;
    this.pending = request;
    this.pump();
    return this.generation;
  }

  /** Cancela o pendente e invalida o que está em voo (sem parar o quadro). */
  cancel(): void {
    this.pending = null;
    this.generation++;
  }

  /** Tenta de novo depois de uma falha declarada. */
  retry(): void {
    if (this.disposed || !this.failed) return;
    this.failed = false;
    this.restarts = 0;
    this.counts.errors = 0;
    // O último pedido volta para a fila: recuperar não perde a geometria atual.
    if (!this.pending && this.current) this.pending = this.current;
    this.pump();
  }

  status(): ArchiveRoutePlannerStatus {
    return {
      ...this.counts,
      inFlight: this.flight !== null,
      pending: this.pending !== null,
      restarts: this.restarts,
      failed: this.failed,
      generation: this.generation,
    };
  }

  dispose(): void {
    this.disposed = true;
    this.pending = null;
    this.flight = null;
    this.current = null;
    this.clearTimer();
    this.worker?.terminate();
    this.worker = null;
  }

  private ensureWorker(): ArchiveRouteWorkerLike | null {
    if (this.worker) return this.worker;
    try {
      const worker = this.factory();
      worker.onmessage = (event) => this.receive(event.data);
      worker.onerror = (event) => this.fail(errorMessage(event));
      this.worker = worker;
      return worker;
    } catch (error) {
      this.fail(errorMessage(error));
      return null;
    }
  }

  private pump(): void {
    if (this.disposed || this.failed || this.flight || !this.pending) return;
    const worker = this.ensureWorker();
    if (!worker) return;
    const request = this.pending;
    this.pending = null;
    this.counts.dispatched++;
    this.flight = { request, sentAt: this.now() };
    this.current = request;
    this.armTimer();
    try {
      worker.postMessage(request);
    } catch (error) {
      this.fail(errorMessage(error));
    }
  }

  private receive(data: unknown): void {
    if (this.disposed || !isArchiveRouteResponse(data)) return;
    const response = data as ArchiveRouteResponse;
    const flight = this.flight;
    if (!flight || flight.request.requestId !== response.requestId) {
      this.counts.discarded++;
      return;
    }
    this.flight = null;
    this.clearTimer();
    if (response.error) {
      this.counts.errors++;
      this.fail(response.error);
      return;
    }
    const stale =
      response.generation !== this.generation ||
      response.protocol !== ARCHIVE_ROUTE_PROTOCOL ||
      response.signature !== flight.request.signature ||
      response.boardId !== flight.request.boardId;
    if (stale) {
      this.counts.discarded++;
      this.checkDiscards();
      this.pump();
      return;
    }
    const plan = decodeRoutePlan(response.plan);
    if (!plan) {
      this.counts.errors++;
      this.fail("plano vazio");
      return;
    }
    this.counts.applied++;
    this.options.onResult?.(plan, {
      requestId: response.requestId,
      generation: response.generation,
      boardId: response.boardId,
      signature: response.signature,
      workerMs: response.elapsed,
      latencyMs: Math.max(0, this.now() - flight.sentAt),
    });
    this.pump();
  }

  private checkDiscards(): void {
    const limit = this.options.maxDiscards ?? ARCHIVE_ROUTE_QUEUE.maxDiscards;
    if (this.counts.discarded < limit) return;
    this.counts.discarded = 0;
    this.replaceWorker("descartes");
  }

  /** Substituição controlada: o pendente mais novo assume o worker novo. */
  private replaceWorker(reason: string): void {
    const limit = this.options.maxRestarts ?? ARCHIVE_ROUTE_QUEUE.maxRestarts;
    this.worker?.terminate();
    this.worker = null;
    this.flight = null;
    this.current = null;
    this.clearTimer();
    if (this.restarts >= limit) {
      this.declareFailed(`worker substituído demais (${reason})`);
      return;
    }
    this.restarts++;
    this.pump();
  }

  private armTimer(): void {
    this.clearTimer();
    const stall = this.options.stallMs ?? ARCHIVE_ROUTE_QUEUE.stallMs;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.disposed || !this.flight) return;
      // Só substitui quando existe trabalho mais novo esperando: um plano
      // legítimo e demorado não deve ser interrompido.
      if (this.pending) this.replaceWorker("estouro");
    }, stall);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private fail(message: string): void {
    if (this.disposed) return;
    const limit = this.options.maxRestarts ?? ARCHIVE_ROUTE_QUEUE.maxRestarts;
    this.worker?.terminate();
    this.worker = null;
    this.flight = null;
    this.clearTimer();
    if (this.restarts >= limit) {
      this.declareFailed(message);
      return;
    }
    this.restarts++;
    // Reenvia o último pedido (mesma identidade) em um worker novo; se havia
    // um mais novo esperando, ele vence.
    if (!this.pending && this.current) this.pending = this.current;
    this.pump();
  }

  private declareFailed(message: string): void {
    this.failed = true;
    this.pending = null;
    this.options.onError?.(message);
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now();
  }
}

function errorMessage(event: unknown): string {
  if (event instanceof Error) return event.message;
  if (event && typeof event === "object" && "message" in event)
    return String((event as { message?: unknown }).message);
  return "falha no worker de rotas";
}
