/** Integração real PostgreSQL + HTTP, exclusivamente em schema novo descartável. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import express from "express";
import { createServer } from "node:http";
const connection = process.env.ARCHIVE_TEST_DATABASE_URL;
if (!connection)
  throw new Error(
    "Informe ARCHIVE_TEST_DATABASE_URL com schema test_archive_... descartável.",
  );
const url = new URL(connection),
  schema = url.searchParams.get("schema") ?? "";
if (!/^test_archive_[a-z0-9_]+$/.test(schema))
  throw new Error(
    "Schema de teste explícito obrigatório; public nunca é aceito.",
  );
process.env.DATABASE_URL = connection;
process.env.JWT_SECRET = "arquivo-teste-isolado-sem-credenciais-reais";
process.env.NODE_ENV = "test";
const db = new PrismaClient({ datasourceUrl: connection });
let created = false;
let server: ReturnType<typeof createServer> | undefined;
let checks = 0;
const publicDigest = async () => {
  const tables = await db.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const hash = createHash("sha256");
  for (const { tablename } of tables) {
    const name = tablename.replaceAll('"', '""');
    const [r] = await db.$queryRawUnsafe<{ digest: string }[]>(
      `SELECT md5(COALESCE(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text),'')) AS digest FROM public."${name}" t`,
    );
    hash.update(tablename + r.digest);
  }
  return hash.digest("hex");
};
const before = await publicDigest();
try {
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  const sql = await readFile(
    new URL(
      "../../prisma/migrations/20261124120000_narrative_archive/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}", public`);
    for (const statement of sql.split(";").filter((s) => s.trim()))
      await tx.$executeRawUnsafe(statement);
    await tx.$executeRawUnsafe(
      `CREATE TYPE "${schema}"."Role" AS ENUM ('PLAYER','MASTER')`,
    );
    await tx.$executeRawUnsafe(
      `CREATE TABLE "${schema}".users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, "displayName" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, role "${schema}"."Role" NOT NULL DEFAULT 'PLAYER', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    );
  });
  const [{ scope }] = await db.$queryRawUnsafe<{ scope: string }[]>(
    "SELECT current_schema() AS scope",
  );
  assert.equal(scope, schema);
  checks++;
  const { prisma } = await import("../config/prisma.js");
  const [{ scope: appScope }] = await prisma.$queryRawUnsafe<
    { scope: string }[]
  >("SELECT current_schema() AS scope");
  assert.equal(appScope, schema);
  checks++;
  const { archiveRouter } = await import(
    "../modules/archive/archive.routes.js"
  );
  const { signToken } = await import("../lib/jwt.js");
  const { errorHandler } = await import("../middlewares/errorHandler.js");
  const { setBroadcaster } = await import("../realtime/hub.js");
  let notifications = 0;
  setBroadcaster({
    toMasters: (event, payload) => {
      assert.equal(event, "archive:updated");
      assert.deepEqual(Object.keys(payload as object), ["at"]);
      notifications++;
    },
    toTable: () => {
      throw new Error("Vazamento público");
    },
    toPlayers: () => {
      throw new Error("Vazamento para jogadores");
    },
    toUser: () => {
      throw new Error("Sala incorreta");
    },
    presence: () => {},
    disconnectUser: () => {},
  });
  const master = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: "teste-arquivo-master",
      displayName: "Teste",
      passwordHash: "nao-utilizavel",
      role: "MASTER",
    },
  });
  const player = await prisma.user.create({
    data: {
      id: randomUUID(),
      username: "teste-arquivo-player",
      displayName: "Teste",
      passwordHash: "nao-utilizavel",
      role: "PLAYER",
    },
  });
  const token = (u: typeof master) =>
    signToken({
      sub: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
    });
  const mt = token(master),
    pt = token(player);
  const app = express();
  app.use(express.json());
  app.use("/api/archive", archiveRouter);
  app.use(errorHandler);
  server = createServer(app);
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const req = async (path: string, body?: unknown, auth = mt, status = 200) => {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/archive${path}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${auth}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    const data = (await response.json()) as any;
    assert.equal(response.status, status, JSON.stringify(data));
    checks++;
    return data;
  };
  const op = async (body: Record<string, unknown>, status = 200) =>
    req("/operations", { operationId: randomUUID(), ...body }, mt, status);
  const board = await op({
    action: "board.create",
    name: "Mundo",
    description: "Teste",
  });
  const other = await op({
    action: "board.create",
    name: "Segundo",
    description: "",
  });
  const geo = { x: -300, y: -100, width: 280, height: 200, zIndex: 0 };
  await op({
    action: "card.create",
    boardId: board.id,
    expectedVersion: 0,
    title: "Cidade",
    category: "locality",
    summary: "Resumo",
    content: "Segredo",
    geometry: geo,
  });
  let graph = await req(`/boards/${board.id}`);
  assert.equal(graph.placements.length, 1);
  const a = graph.placements[0].card;
  const create = {
    action: "card.create",
    boardId: board.id,
    expectedVersion: 1,
    title: "Guia",
    category: "npc",
    summary: "Resumo",
    content: "Texto",
    geometry: { ...geo, x: 100 },
    operationId: randomUUID(),
  };
  const once = await op(create);
  const countBefore = await prisma.narrativeCard.count();
  const replay = await req("/operations", create);
  assert.equal(replay.replayed, true);
  assert.equal(replay.id, once.id);
  assert.equal(await prisma.narrativeCard.count(), countBefore);
  checks += 3;
  await req("/operations", { ...create, title: "Outro" }, mt, 409);
  graph = await req(`/boards/${board.id}`);
  const b = graph.placements.find((p: any) => p.cardId !== a.id).card;
  const relation = {
    action: "link.create",
    boardId: board.id,
    sourceId: a.id,
    targetId: b.id,
    relation: "knows",
    label: "",
    directed: true,
    description: "Privada",
  };
  const link = await op(relation);
  await op(relation, 409);
  await op({ ...relation, relation: "protects" });
  await op({
    ...relation,
    sourceId: b.id,
    targetId: a.id,
    directed: false,
    relation: "ally",
  });
  await op({ ...relation, directed: false, relation: "ally" }, 409);
  await op({ ...relation, targetId: a.id }, 400);
  await op({ ...relation, targetId: randomUUID() }, 404);
  await op({ ...relation, boardId: other.id, relation: "owns" }, 400);
  await op({
    action: "card.update",
    cardId: a.id,
    expectedVersion: 0,
    title: "Cidade revisada",
    category: "locality",
    summary: "Novo",
    content: "Segredo integral",
  });
  await op(
    {
      action: "card.update",
      cardId: a.id,
      expectedVersion: 0,
      title: "Velho",
      category: "note",
      summary: "",
      content: "",
    },
    409,
  );
  const placements = [graph.placements.find((p: any) => p.cardId === a.id)];
  await op({
    action: "placement.update",
    boardId: board.id,
    expectedVersion: 2,
    placementId: placements[0].id,
    geometry: { ...geo, x: -450, width: 500, height: 310 },
  });
  const reloaded = await req(`/boards/${board.id}`);
  assert.equal(
    reloaded.placements.find((p: any) => p.cardId === a.id).width,
    500,
  );
  assert.equal(
    reloaded.placements.find((p: any) => p.cardId === a.id).card.content,
    "Segredo integral",
  );
  assert.equal(reloaded.links.length, 3);
  checks += 3;
  await op(
    {
      action: "placement.update",
      boardId: board.id,
      expectedVersion: 3,
      placementId: placements[0].id,
      geometry: { ...geo, width: 1 },
    },
    400,
  );
  const concurrent = await Promise.all(
    [1, 2].map((n) =>
      fetch(`http://127.0.0.1:${port}/api/archive/operations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operationId: randomUUID(),
          action: "board.update",
          boardId: board.id,
          expectedVersion: 3,
          name: `Nome ${n}`,
          description: "",
        }),
      }).then((r) => r.status),
    ),
  );
  assert.deepEqual(concurrent.sort(), [200, 409]);
  checks++;
  await op({
    action: "placement.add",
    boardId: other.id,
    cardId: a.id,
    expectedVersion: 0,
    geometry: { ...geo, x: 900 },
  });
  assert.equal((await req(`/boards/${other.id}`)).placements[0].x, 900);
  assert.equal(
    (await req(`/boards/${board.id}`)).placements.find(
      (p: any) => p.cardId === a.id,
    ).x,
    -450,
  );
  checks++;
  for (const path of [
    "/boards",
    "/cards",
    `/boards/${board.id}`,
    `/cards/${a.id}`,
  ])
    await req(path, undefined, pt, 403);
  await req(
    "/operations",
    {
      action: "board.create",
      operationId: randomUUID(),
      name: "Intrusão",
      description: "",
    },
    pt,
    403,
  );
  await req("/boards", undefined, "invalido", 401);
  // Prova de que o papel do corpo não é autoridade.
  await req(
    "/operations",
    {
      action: "board.create",
      operationId: randomUUID(),
      name: "Intrusão",
      description: "",
      role: "MASTER",
    },
    pt,
    403,
  );
  await op({
    action: "link.update",
    linkId: link.id,
    expectedVersion: 0,
    sourceId: a.id,
    targetId: b.id,
    relation: "custom",
    label: "Negocia com",
    directed: false,
    description: "Nova",
  });
  await op({ action: "link.delete", linkId: link.id, expectedVersion: 1 });
  await op({
    action: "placement.remove",
    boardId: other.id,
    expectedVersion: 1,
    placementId: (await req(`/boards/${other.id}`)).placements[0].id,
  });
  assert.ok(await prisma.narrativeCard.findUnique({ where: { id: a.id } }));
  checks++;
  await op({ action: "board.delete", boardId: other.id, expectedVersion: 2 });
  const deleteId = randomUUID();
  await op({
    action: "card.delete",
    cardId: a.id,
    expectedVersion: 1,
    operationId: deleteId,
  });
  const deletedReplay = await req("/operations", {
    action: "card.delete",
    cardId: a.id,
    expectedVersion: 1,
    operationId: deleteId,
  });
  assert.equal(deletedReplay.replayed, true);
  assert.equal(await prisma.narrativeLink.count(), 0);
  assert.equal(
    await prisma.narrativePlacement.count({ where: { cardId: a.id } }),
    0,
  );
  checks += 3;
  assert.ok(notifications > 10);
  checks++;
  await prisma.$disconnect();
  console.log(
    `Arquivo: ${checks} verificações HTTP/PostgreSQL; CAS, replay, privacidade, referências, persistência e exclusões passaram.`,
  );
} finally {
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  if (created) await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  const after = await publicDigest();
  await db.$disconnect();
  assert.equal(after, before, "Dados reais devem permanecer idênticos.");
  console.log(
    "Isolamento: hash dos dados public ANTES = DEPOIS. Schema descartável removido.",
  );
}
