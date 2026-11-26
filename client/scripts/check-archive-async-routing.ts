/** Verificações puras da microfase 8.5.4.2.2.
 *
 * Cobre o contrato serializável, a fila do worker (coalescência, cancelamento,
 * descarte de resultado obsoleto, substituição e falha controlada), a primeira
 * apresentação provisória, a reutilização sem mutação e a validação geométrica
 * dos comandos SVG realmente desenhados.
 *
 * Sem DOM, sem navegador e sem banco: o worker é substituído por um dublê que
 * executa o MESMO roteador puro.
 */
import assert from "node:assert/strict";
import {
  planArchiveLinkRoutes,
  provisionalArchiveRoutePlan,
  type ArchiveRouteLink,
  type ArchiveRouteNode,
  type ArchiveRoutePlanSet,
} from "../src/components/archive/archiveLinkRouting";
import {
  ARCHIVE_ROUTE_PROTOCOL,
  decodeRoutePlan,
  encodeRoutePlan,
  encodeRouteRequest,
  type ArchiveRouteRequest,
  type ArchiveRouteResponse,
} from "../src/components/archive/archiveRouteContract";
import {
  ArchiveRoutePlanner,
  type ArchiveRouteWorkerLike,
} from "../src/components/archive/archiveRoutePlanner";
import {
  archiveCommandBounds,
  archivePathProbe,
} from "../src/components/archive/archiveRouteValidation";
import { archiveLinkPathCommands } from "../src/components/archive/archiveLinkGeometry";

let total = 0;
const ok = (message: string) => {
  total++;
  console.log(`ok ${total} — ${message}`);
};

const node = (
  id: string,
  x: number,
  y: number,
  width = 300,
  height = 200,
): ArchiveRouteNode => ({ id, cardId: id, x, y, width, height });
const link = (
  id: string,
  sourceId: string,
  targetId: string,
  relation = "knows",
  label = "",
): ArchiveRouteLink => ({ id, sourceId, targetId, relation, label });

const board = (): { placements: ArchiveRouteNode[]; links: ArchiveRouteLink[] } => ({
  placements: [
    node("a", 0, 0),
    node("b", 900, 0),
    node("c", 0, 600),
    node("d", 900, 600),
    node("parede", 420, -120, 260, 440),
  ],
  links: [
    link("l1", "a", "b", "knows", "Reconhece"),
    link("l2", "c", "d", "enemy", "Teme"),
    link("l3", "a", "d", "protects", "Protege"),
    link("l4", "b", "c", "related", "Liga"),
  ],
});

/** Dublê do worker: entrega respostas sob controle do teste. */
class FakeWorker implements ArchiveRouteWorkerLike {
  requests: ArchiveRouteRequest[] = [];
  terminated = 0;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  postMessage(message: ArchiveRouteRequest): void {
    this.requests.push(message);
  }
  terminate(): void {
    this.terminated++;
  }
  planFor(request: ArchiveRouteRequest): ArchiveRoutePlanSet {
    return planArchiveLinkRoutes({
      placements: request.placements,
      links: request.links,
      previous: decodeRoutePlan(request.previous),
    });
  }
  response(index: number, patch: Partial<ArchiveRouteResponse> = {}): ArchiveRouteResponse {
    const request = this.requests[index];
    return {
      protocol: ARCHIVE_ROUTE_PROTOCOL,
      requestId: request.requestId,
      boardId: request.boardId,
      generation: request.generation,
      signature: request.signature,
      plan: encodeRoutePlan(this.planFor(request)),
      error: null,
      elapsed: 1,
      ...patch,
    };
  }
  deliver(index: number, patch: Partial<ArchiveRouteResponse> = {}): void {
    this.onmessage?.({ data: this.response(index, patch) });
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const job = (
  signature: string,
  data = board(),
  boardId = "quadro-a",
  previous: ArchiveRoutePlanSet | null = null,
) => ({ boardId, signature, placements: data.placements, links: data.links, previous });

// 1 — contrato
{
  const plan = planArchiveLinkRoutes(board());
  const restored = decodeRoutePlan(encodeRoutePlan(plan));
  assert.ok(restored, "plano serializado pode ser restaurado");
  assert.deepEqual(
    [...restored!.routes].map(([id, route]) => [id, route.sides, route.slots, route.label]),
    [...plan.routes].map(([id, route]) => [id, route.sides, route.slots, route.label]),
    "geometria idêntica depois do contrato",
  );
  assert.equal(restored!.stats.work, plan.stats.work, "diagnóstico preservado");
  ok("contrato serializa e restaura o plano sem perder geometria");
}

// 2 — cópia profunda
{
  const plan = planArchiveLinkRoutes(board());
  const entry = [...plan.routes][0];
  const copy = decodeRoutePlan(encodeRoutePlan(plan))!;
  const cloned = copy.routes.get(entry[0])!;
  const original = { slot: entry[1].slots[0], x: entry[1].bounds.x, at: entry[1].label?.at };
  cloned.slots[0] = 0.5;
  cloned.residual.push("intruso");
  if (cloned.label) cloned.label.at = 0.9;
  cloned.bounds.x = -999;
  assert.equal(entry[1].slots[0], original.slot, "slot intocado");
  assert.notEqual(entry[1].bounds.x, -999, "caixa não é compartilhada");
  assert.ok(!entry[1].residual.includes("intruso"), "residual não é compartilhado");
  assert.equal(entry[1].label?.at, original.at, "rótulo não é compartilhado");
  ok("plano decodificado não muta o plano de origem");
}

// 3 — primeira apresentação
{
  const data = board();
  const provisional = provisionalArchiveRoutePlan(data);
  assert.equal(provisional.provisional, true, "plano marcado como provisório");
  assert.equal(provisional.stats.verified, 0, "nada é verificado antes do worker");
  for (const plan of provisional.routes.values()) {
    assert.equal(plan.state, "unverified", "rota provisória nunca é livre");
    assert.equal(plan.fallbackReason, "provisional", "motivo explícito");
  }
  assert.equal(provisional.stats.work, 0, "custo de primeira apresentação é zero");
  ok("primeira apresentação é provisória, explícita e sem custo de obstáculos");
}

// 4 — forma reaproveitada na primeira apresentação
{
  const data = board();
  const plan = planArchiveLinkRoutes(data);
  const provisional = provisionalArchiveRoutePlan({ ...data, previous: plan });
  const previous = plan.routes.get("l1")!;
  const adapted = provisional.routes.get("l1")!;
  assert.deepEqual(adapted.sides, previous.sides, "lados preservados");
  assert.equal(adapted.lane, previous.lane, "corredor preservado");
  assert.equal(adapted.state, "unverified", "sem alegar verificação");
  ok("primeira apresentação preserva a forma anterior sem alegar verificação");
}

// 5 — coalescência
{
  const workers: FakeWorker[] = [];
  const planner = new ArchiveRoutePlanner({
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  planner.request(job("s1"));
  planner.request(job("s2"));
  planner.request(job("s3"));
  const worker = workers[0];
  assert.equal(worker.requests.length, 1, "um único trabalho em voo");
  const status = planner.status();
  assert.equal(status.pending, true, "existe um pendente");
  assert.ok(status.superseded >= 1, "pendente antigo foi substituído");
  worker.deliver(0);
  assert.equal(worker.requests.length, 2, "só o mais recente é despachado");
  assert.equal(worker.requests[1].signature, "s3", "última geometria vence");
  planner.dispose();
  ok("fila coalesce e despacha apenas a geometria mais recente");
}

// 6 — resultado obsoleto por geração
{
  const workers: FakeWorker[] = [];
  const applied: string[] = [];
  const planner = new ArchiveRoutePlanner({
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    onResult: (_plan, meta) => applied.push(meta.signature),
  });
  planner.request(job("s1"));
  planner.request(job("s2"));
  const worker = workers[0];
  worker.deliver(0);
  assert.equal(applied.length, 0, "resposta da geração anterior descartada");
  assert.ok(planner.status().discarded >= 1, "descarte contabilizado");
  worker.deliver(1);
  assert.deepEqual(applied, ["s2"], "somente a geometria atual é aplicada");
  planner.dispose();
  ok("resposta atrasada de outra geração é descartada e contabilizada");
}

// 7 — quadro diferente
{
  const workers: FakeWorker[] = [];
  const applied: string[] = [];
  const planner = new ArchiveRoutePlanner({
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    onResult: (_plan, meta) => applied.push(meta.boardId),
  });
  planner.request(job("s1"));
  workers[0].deliver(0, { boardId: "quadro-b" });
  assert.equal(applied.length, 0, "plano de outro quadro nunca é aplicado");
  planner.dispose();
  ok("resultado de outro quadro é descartado");
}

// 8 — geometria diferente
{
  const workers: FakeWorker[] = [];
  const applied: string[] = [];
  const planner = new ArchiveRoutePlanner({
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    onResult: (_plan, meta) => applied.push(meta.signature),
  });
  planner.request(job("s1"));
  workers[0].deliver(0, { signature: "s0" });
  assert.equal(applied.length, 0, "assinatura divergente descartada");
  planner.dispose();
  ok("resultado de assinatura geométrica antiga é descartado");
}

// 9 — cancelamento
{
  const workers: FakeWorker[] = [];
  const applied: unknown[] = [];
  const planner = new ArchiveRoutePlanner({
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    onResult: (plan) => applied.push(plan),
  });
  planner.request(job("s1"));
  planner.cancel();
  workers[0].deliver(0);
  assert.equal(applied.length, 0, "cancelar invalida o trabalho em voo");
  assert.equal(planner.status().pending, false, "pendente limpo");
  planner.dispose();
  ok("cancelar invalida o que estava em voo sem aplicar nada");
}

// 10 — desmontagem
{
  const workers: FakeWorker[] = [];
  const applied: unknown[] = [];
  const planner = new ArchiveRoutePlanner({
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    onResult: (plan) => applied.push(plan),
  });
  planner.request(job("s1"));
  workers[0].deliver(0);
  const before = applied.length;
  planner.dispose();
  workers[0].deliver(0);
  assert.equal(workers[0].terminated, 1, "worker terminado na desmontagem");
  assert.equal(applied.length, before, "nada é aplicado após desmontar");
  ok("desmontagem encerra o worker e ignora respostas");
}

// 11 — falha transitória
{
  const workers: FakeWorker[] = [];
  const applied: string[] = [];
  const planner = new ArchiveRoutePlanner({
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    onResult: (_plan, meta) => applied.push(meta.signature),
  });
  planner.request(job("s1"));
  workers[0].onerror?.({ message: "boom" });
  assert.equal(workers.length, 2, "worker recriado após falha");
  assert.equal(workers[1].requests.length, 1, "pedido reenviado ao worker novo");
  workers[1].deliver(0);
  assert.deepEqual(applied, ["s1"], "plano aplicado depois da recuperação");
  planner.dispose();
  ok("falha do worker recria, reenvia e entrega o plano");
}

// 12 — falha persistente
{
  const workers: FakeWorker[] = [];
  const errors: string[] = [];
  const applied: unknown[] = [];
  const planner = new ArchiveRoutePlanner({
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    maxRestarts: 0,
    onError: (message) => errors.push(message),
    onResult: (plan) => applied.push(plan),
  });
  planner.request(job("s1"));
  workers[0].onerror?.({ message: "sem worker" });
  assert.equal(planner.status().failed, true, "falha declarada");
  assert.equal(applied.length, 0, "nenhum plano inventado");
  assert.ok(errors.length === 1, "falha reportada");
  planner.request(job("s2"));
  assert.equal(workers.length, 1, "não insiste em criar workers sem parar");
  planner.dispose();
  ok("falha persistente declara erro e não volta ao planejamento síncrono");
}

// 13 — recuperação manual
{
  const workers: FakeWorker[] = [];
  const applied: string[] = [];
  const planner = new ArchiveRoutePlanner({
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    maxRestarts: 0,
    onResult: (_plan, meta) => applied.push(meta.signature),
  });
  planner.request(job("s1"));
  workers[0].onerror?.({ message: "sem worker" });
  planner.retry();
  assert.equal(workers.length, 2, "retry cria um worker novo");
  workers[1].deliver(0);
  assert.deepEqual(applied, ["s1"], "plano recuperado");
  planner.dispose();
  ok("recuperação manual restaura o planejamento assíncrono");
}

// 14 — substituição controlada por estouro
{
  const workers: FakeWorker[] = [];
  const planner = new ArchiveRoutePlanner({
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    stallMs: 5,
  });
  planner.request(job("s1"));
  planner.request(job("s2"));
  await sleep(30);
  assert.equal(workers.length, 2, "worker substituído quando há pendente novo");
  assert.equal(workers[1].requests[0].signature, "s2", "pendente assume");
  assert.ok(planner.status().restarts >= 1, "substituição contabilizada");
  planner.dispose();
  ok("worker travado com pendente mais novo é substituído de forma controlada");
}

// 15 — limite de pendentes
{
  const workers: FakeWorker[] = [];
  const planner = new ArchiveRoutePlanner({
    factory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  for (let i = 0; i < 40; i++) planner.request(job(`s${i}`));
  const status = planner.status();
  assert.equal(workers[0].requests.length, 1, "um envio por vez");
  assert.equal(status.pending, true, "no máximo um pendente");
  assert.ok(status.superseded <= 40, "substituições contabilizadas");
  planner.dispose();
  ok("quarenta pedidos não criam fila crescente");
}

// 16 — reutilização não muta o plano anterior
{
  const data = board();
  const first = planArchiveLinkRoutes(data);
  const snapshot = new Map(
    [...first.routes].map(([id, route]) => [
      id,
      { slots: [...route.slots], sides: [...route.sides], via: route.via.map((p) => ({ ...p })) },
    ]),
  );
  const moved = board();
  moved.placements = moved.placements.map((item) =>
    item.id === "a" ? { ...item, x: item.x - 400, y: item.y - 240 } : item,
  );
  const second = planArchiveLinkRoutes({ ...moved, previous: first });
  assert.ok(second.stats.reused >= 1, "rotas independentes são reutilizadas");
  assert.equal(second.routes.get("l2")!.reused, true, "l2 independe do card movido");
  let changed = 0;
  for (const [id, before] of snapshot) {
    const after = first.routes.get(id)!;
    if (
      after.slots[0] !== before.slots[0] ||
      after.slots[1] !== before.slots[1] ||
      after.sides[0] !== before.sides[0] ||
      after.via.length !== before.via.length
    )
      changed++;
  }
  assert.equal(changed, 0, "plano anterior permanece intacto");
  ok("reutilização copia a rota e nunca muta o plano anterior");
}

// 17 — portas reutilizadas contam na ocupação
{
  const data = board();
  const first = planArchiveLinkRoutes(data);
  const moved = board();
  moved.placements = moved.placements.map((item) =>
    item.id === "a" ? { ...item, x: -500, y: -300 } : item,
  );
  const second = planArchiveLinkRoutes({ ...moved, previous: first });
  const reused = [...second.routes].filter(([, route]) => route.reused);
  assert.ok(reused.length >= 1, "existe rota reutilizada para conferir");
  const perCard = new Map<string, number[]>();
  for (const [, route] of reused) {
    const key = route.sides[0];
    const list = perCard.get(key) ?? [];
    list.push(route.slots[0]);
    perCard.set(key, list);
  }
  for (const [side, slots] of perCard)
    assert.equal(
      new Set(slots).size,
      slots.length,
      `encaixes reutilizados no lado ${side} são distintos`,
    );
  ok("portas reutilizadas entram na ocupação e preservam slots válidos");
}

// 18 — remoção de relação invalida a reutilização
{
  const data = board();
  const first = planArchiveLinkRoutes(data);
  const moved = board();
  moved.placements = moved.placements.map((item) =>
    item.id === "a" ? { ...item, x: -300, y: -200 } : item,
  );
  moved.links = moved.links.filter((item) => item.id !== "l4");
  const second = planArchiveLinkRoutes({ ...moved, previous: first });
  assert.equal(second.stats.reused, 0, "topologia mudou: nada é reaproveitado");
  assert.ok(!second.routes.has("l4"), "relação removida não volta");
  ok("remoção de relação invalida o plano inteiro e não ressuscita vínculo");
}

// 19 — texto do rótulo invalida a rota do vínculo
{
  const data = board();
  const first = planArchiveLinkRoutes(data);
  const renamed = board();
  renamed.links = renamed.links.map((item) =>
    item.id === "l2" ? { ...item, label: "Uma legenda bem maior para medir" } : item,
  );
  renamed.placements = renamed.placements.map((item) =>
    item.id === "a" ? { ...item, x: -300, y: -200 } : item,
  );
  const second = planArchiveLinkRoutes({ ...renamed, previous: first });
  assert.equal(second.routes.get("l2")!.reused, false, "rótulo novo replaneja a rota");
  ok("mudança de rótulo invalida a reutilização daquele vínculo");
}

// 20 — validação dos comandos reais
{
  const rect = { x: 0, y: 0, width: 200, height: 200 };
  const far = archiveLinkPathCommands([
    { x: 400, y: 400 },
    { x: 600, y: 400 },
    { x: 600, y: 200 },
  ]);
  const clear = archivePathProbe(far, rect);
  assert.equal(clear.hit, false, "arco afastado não toca o card");
  assert.equal(clear.conclusive, true, "ausência de interseção demonstrada");
  const crossing = archiveLinkPathCommands([
    { x: -200, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 500 },
    { x: 500, y: 500 },
  ]);
  assert.equal(archivePathProbe(crossing, rect).hit, true, "arco sobre o card é detectado");
  ok("validação usa os comandos SVG reais e demonstra ausência de interseção");
}

// 21 — inconclusivo nunca é livre
{
  const rect = { x: 0, y: 0, width: 200, height: 200 };
  const commands = archiveLinkPathCommands([
    { x: -200, y: 40 },
    { x: 320, y: 120 },
    { x: 520, y: 40 },
  ]);
  const probe = archivePathProbe(commands, rect, { tolerance: 0.0001, maxDepth: 1 });
  assert.equal(probe.conclusive, false, "subdivisão insuficiente é inconclusiva");
  const exhausted = archivePathProbe(commands, rect, { spend: () => false });
  assert.equal(exhausted.conclusive, false, "orçamento esgotado é inconclusivo");
  const bounds = archiveCommandBounds({ x: 0, y: 0 }, { kind: "L", x: 10, y: 10 }, 2);
  assert.ok(bounds.width >= 12, "caixa do comando cobre o traço");
  ok("verificação inconclusiva ou sem orçamento não vira rota verificada");
}

// 22 — worker não muda o resultado
{
  const data = board();
  const direct = planArchiveLinkRoutes(data);
  const request = encodeRouteRequest(job("s1"), 1, 1);
  const workerPlan = new FakeWorker().planFor(request);
  assert.deepEqual(
    [...workerPlan.routes].map(([id, route]) => [id, route.sides, route.slots, route.strategy]),
    [...direct.routes].map(([id, route]) => [id, route.sides, route.slots, route.strategy]),
    "mesma geometria dentro e fora do worker",
  );
  assert.equal(workerPlan.stats.work, direct.stats.work, "mesmo trabalho");
  ok("plano do worker é idêntico ao do planejador puro");
}

// 23 — rótulo da rota reutilizada
{
  const data = board();
  const first = planArchiveLinkRoutes(data);
  const moved = board();
  moved.placements = moved.placements.map((item) =>
    item.id === "a" ? { ...item, x: -420, y: -260 } : item,
  );
  const second = planArchiveLinkRoutes({ ...moved, previous: first });
  const before = first.routes.get("l2")!;
  const after = second.routes.get("l2")!;
  assert.equal(after.reused, true, "rota independente");
  assert.deepEqual(after.label, before.label, "rótulo não é recalculado");
  assert.equal(after.state, before.state, "diagnóstico preservado");
  ok("rota reutilizada preserva rótulo e diagnóstico sem recálculo");
}

// 24 — orçamento cobre índice, cruzamentos e validação
{
  const data = board();
  const plan = planArchiveLinkRoutes(data);
  assert.ok(plan.stats.work > 0, "trabalho contabilizado");
  assert.ok(
    plan.stats.work <= plan.stats.maxWork,
    "trabalho nunca ultrapassa o orçamento declarado",
  );
  assert.ok(plan.stats.checkTests > 0, "validação final entra no diagnóstico");
  assert.ok(
    plan.stats.work >= data.links.length,
    "índice e consultas também são pagos",
  );
  ok("orçamento cobre índice, cruzamentos, rótulos e validação final");
}

// 25 — diagnóstico preservado nas três categorias
{
  const data = board();
  const plan = planArchiveLinkRoutes(data);
  for (const route of plan.routes.values()) {
    if (route.state === "verified-clear")
      assert.equal(route.fallbackReason, null, "livre verificado não é fallback");
    if (route.state === "unverified")
      assert.ok(route.fallbackReason !== null, "não verificado tem motivo");
  }
  assert.ok(
    plan.stats.verified + plan.stats.intersects + plan.stats.unverified ===
      plan.routes.size,
    "toda rota tem exatamente um estado",
  );
  ok("estados e motivo de fallback continuam separados e completos");
}

console.log(`\n${total} verificações de planejamento assíncrono das relações.`);
