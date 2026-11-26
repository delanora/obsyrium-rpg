/** Fila e ciclo de vida do worker de rotas.
 *
 * Regras (documentadas nas microfases 8.5.4.2.2 e 8.5.4.2.3):
 * - no máximo UM trabalho em execução e UM pendente (o mais recente vence);
 * - resultado só é aplicado se o worker for o atual e `requestId`, `generation`,
 *   `signature` e `boardId` corresponderem ao estado atual — resposta atrasada de
 *   worker substituído é descartada, nunca "desfaz" uma mudança;
 * - o vigia acompanha a fila inteira: um pedido que chega depois do primeiro
 *   estouro encontra o voo marcado como travado e o substitui na hora;
 * - mensagem fora do protocolo, `messageerror`, exceção de fábrica e erro do
 *   worker contam como falha de transporte e nunca deixam o controlador ocupado;
 * - falha do worker nunca volta ao planejamento síncrono pesado: a interface
 *   continua com o plano provisório e o diagnóstico de não verificado;
 * - recuperação só por ação controlada (`retry`) ou mudança relevante de
 *   contexto (outro quadro) — nunca tentativas infinitas.
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
  onmessageerror?: ((event: unknown) => void) | null;
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

/** Decisão de aplicação de um resultado que chegou da fila. */
export type ArchiveRouteApply = "apply" | "defer" | "drop";

/**
 * Um resultado só entra se for do quadro e da assinatura atuais; durante um
 * gesto ele é guardado (o traço não muda no meio do arrasto) e aplicado depois.
 * Regra pura para poder ser verificada sem DOM.
 */
export function archiveRouteApplyPolicy(input: {
  inGesture: boolean;
  current: { signature: string; boardId: string };
  result: { signature: string; boardId: string };
}): ArchiveRouteApply {
  if (
    input.result.signature !== input.current.signature ||
    input.result.boardId !== input.current.boardId
  )
    return "drop";
  return input.inGesture ? "defer" : "apply";
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
  maxInvalid?: number;
  now?: () => number;
  onResult?: (plan: ArchiveRoutePlanSet, meta: ArchiveRouteResultMeta) => void;
  onError?: (message: string) => void;
}

interface Flight {
  request: ArchiveRouteRequest;
  sentAt: number;
  /** O vigia expirou sem pendente: o próximo pedido substitui na hora. */
  stalled: boolean;
  /** Mensagens fora do protocolo recebidas neste voo. */
  invalid: number;
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
  private failedBoardId = "";
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
    if (this.failed) {
      // Só outro quadro (mudança relevante de contexto) reabilita sozinho;
      // repetir o mesmo pedido não gera tentativas infinitas. Mesmo assim a
      // geometria atual fica guardada: a recuperação controlada precisa
      // reenviar o que o quadro mostra agora, não o pedido que quebrou.
      if (job.boardId === this.failedBoardId) {
        this.current = encodeRouteRequest(job, this.requestId, this.generation);
        return this.generation;
      }
      this.recover();
    }
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

  /** Ação controlada de recuperação depois de uma falha declarada. */
  retry(): void {
    if (this.disposed || !this.failed) return;
    this.recover();
    if (this.current) {
      // Reenvia a última geometria com identidade nova: a antiga seria
      // descartada como geração vencida.
      this.generation++;
      this.pending = {
        ...this.current,
        requestId: ++this.requestId,
        generation: this.generation,
      };
    }
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

  private recover(): void {
    this.failed = false;
    this.failedBoardId = "";
    this.restarts = 0;
    this.counts.errors = 0;
  }

  private ensureWorker(): ArchiveRouteWorkerLike | null {
    if (this.worker) return this.worker;
    try {
      const worker = this.factory();
      // Cada instância responde pela sua própria identidade: mensagem de worker
      // substituído nunca toca o voo atual.
      worker.onmessage = (event) => this.receive(worker, event.data);
      worker.onerror = (event) => this.fail(worker, errorMessage(event));
      worker.onmessageerror = () =>
        this.fail(worker, "mensagem ilegível do worker de rotas");
      this.worker = worker;
      return worker;
    } catch (error) {
      this.fail(null, errorMessage(error));
      return null;
    }
  }

  private pump(): void {
    if (this.disposed || this.failed || !this.pending) return;
    if (this.flight) {
      // Já existe voo: o pendente espera — mas nunca sem vigia. Se o prazo
      // anterior expirou sem pendente, a substituição é imediata.
      if (this.flight.stalled) this.replaceWorker("estouro");
      else this.armTimer();
      return;
    }
    const worker = this.ensureWorker();
    if (!worker) return;
    const request = this.pending;
    this.pending = null;
    this.counts.dispatched++;
    this.flight = { request, sentAt: this.now(), stalled: false, invalid: 0 };
    this.current = request;
    this.armTimer();
    try {
      worker.postMessage(request);
    } catch (error) {
      this.fail(worker, errorMessage(error));
    }
  }

  private receive(worker: ArchiveRouteWorkerLike, data: unknown): void {
    if (this.disposed) return;
    if (worker !== this.worker) {
      // Chegou de um worker já substituído: não afeta a instância atual.
      this.counts.discarded++;
      return;
    }
    const flight = this.flight;
    if (!flight) {
      this.counts.discarded++;
      return;
    }
    if (!isArchiveRouteResponse(data)) {
      this.counts.errors++;
      flight.invalid++;
      const limit =
        this.options.maxInvalid ?? ARCHIVE_ROUTE_QUEUE.maxInvalid;
      if (flight.invalid >= limit) this.replaceWorker("protocolo");
      else this.armTimer();
      return;
    }
    const response = data as ArchiveRouteResponse;
    if (flight.request.requestId !== response.requestId) {
      this.counts.discarded++;
      return;
    }
    this.flight = null;
    this.clearTimer();
    if (response.error) {
      this.counts.errors++;
      this.fail(worker, response.error);
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
    let plan: ArchiveRoutePlanSet | null = null;
    try {
      plan = decodeRoutePlan(response.plan);
    } catch {
      // Nenhum formato inesperado escapa do controlador.
      plan = null;
    }
    if (!plan) {
      this.counts.errors++;
      this.fail(worker, "plano vazio");
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
    const flight = this.flight;
    this.worker?.terminate();
    this.worker = null;
    this.flight = null;
    this.clearTimer();
    if (this.restarts >= limit) {
      // `current` sobrevive: a falha precisa saber qual quadro quebrou e o
      // `retry` precisa de uma geometria para reenviar.
      this.declareFailed(`worker substituído demais (${reason})`);
      return;
    }
    this.restarts++;
    // O trabalho que estava em voo não se perde: sem pendente mais novo, ele
    // volta para a fila e o worker novo assume (nunca fica sem planejamento).
    if (!this.pending && flight && flight.request.generation === this.generation)
      this.pending = flight.request;
    this.current = flight?.request ?? null;
    this.pump();
  }

  private armTimer(): void {
    this.clearTimer();
    const stall = this.options.stallMs ?? ARCHIVE_ROUTE_QUEUE.stallMs;
    const flight = this.flight;
    if (!flight) return;
    const remaining = Math.max(0, flight.sentAt + stall - this.now());
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.disposed || !this.flight) return;
      // Só substitui quando existe trabalho mais novo esperando: um plano
      // legítimo e demorado não deve ser interrompido. Sem pendente, o voo
      // fica marcado como travado e o próximo pedido substitui imediatamente.
      if (this.pending) this.replaceWorker("estouro");
      else this.flight.stalled = true;
    }, remaining);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private fail(worker: ArchiveRouteWorkerLike | null, message: string): void {
    if (this.disposed) return;
    if (worker && worker !== this.worker) return;
    const limit = this.options.maxRestarts ?? ARCHIVE_ROUTE_QUEUE.maxRestarts;
    this.worker?.terminate();
    this.worker = null;
    const kept =
      this.current && this.current.generation === this.generation
        ? this.current
        : null;
    this.flight = null;
    this.clearTimer();
    if (this.restarts >= limit) {
      this.declareFailed(message);
      return;
    }
    this.restarts++;
    // Reenvia o último pedido (mesma identidade) em um worker novo; se havia
    // um mais novo esperando, ele vence.
    if (!this.pending && kept) this.pending = kept;
    this.pump();
  }

  private declareFailed(message: string): void {
    // Um pendente que chegou depois do voo quebrado é a geometria que o
    // quadro mostra agora: ele sobrevive para o `retry`, em vez de sumir.
    if (this.pending) this.current = this.pending;
    this.failed = true;
    this.failedBoardId = this.current?.boardId ?? "";
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
