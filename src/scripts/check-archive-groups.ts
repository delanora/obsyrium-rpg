/** HTTP/PostgreSQL reais, somente instância recém-criada e schema descartável. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import { PrismaClient } from "@prisma/client";
const connection = process.env.ARCHIVE_TEST_DATABASE_URL,
  expectedData = process.env.ARCHIVE_TEST_PGDATA;
if (
  !connection ||
  !expectedData ||
  !/^\/tmp\/obsyrium-grupos-pg-[A-Za-z0-9]+\/data$/.test(expectedData)
)
  throw Error("Instância descartável explícita obrigatória.");
const url = new URL(connection);
if (
  url.pathname !== "/arquivo_grupos_853" ||
  url.searchParams.get("schema") !== "test_archive_grupos"
)
  throw Error(
    "Banco/schema de fixture obrigatório; campanha e public recusados.",
  );
process.env.DATABASE_URL = connection;
process.env.JWT_SECRET = "grupos-isolados-chave-de-teste-sem-dados-reais";
process.env.NODE_ENV = "test";
const db = new PrismaClient({ datasourceUrl: connection });
let server: ReturnType<typeof createServer> | undefined;
let applicationDb: PrismaClient | undefined;
let checks = 0,
  notifications = 0,
  leaks = 0;
const masterId = randomUUID(),
  otherId = randomUUID(),
  playerId = randomUUID();
const check = (fn: () => void) => {
  fn();
  checks++;
};
try {
  const [sentinel] = await db.$queryRaw<
    { database: string; directory: string; schema: string }[]
  >`SELECT current_database() AS database,current_setting('data_directory') AS directory,current_schema() AS schema`;
  assert.equal(sentinel.directory, expectedData);
  assert.equal(sentinel.database, "arquivo_grupos_853");
  assert.equal(sentinel.schema, "test_archive_grupos");
  assert.equal(await db.user.count(), 0);
  const { prisma } = await import("../config/prisma.js");
  applicationDb = prisma;
  const [appSentinel] = await prisma.$queryRaw<
    { directory: string; schema: string }[]
  >`SELECT current_setting('data_directory') AS directory,current_schema() AS schema`;
  assert.equal(appSentinel.directory, expectedData);
  assert.equal(appSentinel.schema, "test_archive_grupos");
  checks += 5;
  const { archiveRouter } = await import(
    "../modules/archive/archive.routes.js"
  );
  const { errorHandler } = await import("../middlewares/errorHandler.js");
  const { signToken } = await import("../lib/jwt.js");
  const { setBroadcaster } = await import("../realtime/hub.js");
  setBroadcaster({
    toMasters: (event, payload) => {
      assert.equal(event, "archive:updated");
      assert.deepEqual(Object.keys(payload as object), ["at"]);
      notifications++;
    },
    toPlayers: () => {
      leaks++;
    },
    toTable: () => {
      leaks++;
    },
    toUser: () => {
      leaks++;
    },
    presence: () => {},
    disconnectUser: () => {},
  });
  for (const [id, role] of [
    [masterId, "MASTER"],
    [otherId, "MASTER"],
    [playerId, "PLAYER"],
  ] as const)
    await db.user.create({
      data: {
        id,
        role,
        username: "grupo-fixture-" + id,
        displayName: "Fixture isolada",
        passwordHash: "nao-utilizavel",
      },
    });
  const token = (id: string, role: "MASTER" | "PLAYER") =>
    signToken({
      sub: id,
      username: "grupo-fixture-" + id,
      displayName: "Fixture isolada",
      role,
    });
  const master = token(masterId, "MASTER"),
    other = token(otherId, "MASTER"),
    player = token(playerId, "PLAYER");
  const app = express();
  app.use(express.json());
  app.use("/api/archive", archiveRouter);
  app.use(errorHandler);
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Porta de teste inválida");
  const base = "http://127.0.0.1:" + address.port + "/api/archive";
  const req = async (
    path: string,
    body: unknown = undefined,
    bearer: string | undefined = master,
    status = 200,
  ) => {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = (await response.json()) as any;
    assert.equal(response.status, status, JSON.stringify(data));
    checks++;
    return data;
  };
  const op = (input: Record<string, unknown>, status = 200, bearer = master) =>
    req("/operations", { operationId: randomUUID(), ...input }, bearer, status);
  await req("/groups", undefined, "", 401);
  await req("/groups", undefined, player, 403);
  await op(
    {
      action: "group.create",
      name: "Privado",
      color: "#ABCDEF",
      description: "",
    },
    403,
    player,
  );
  const create = {
    action: "group.create",
    name: "  Culto   da Serpente  ",
    color: "#abcdef",
    description: "Preparação privada",
    operationId: randomUUID(),
  };
  const group = await op(create);
  const beforeReplay = notifications;
  const replay = await op(create);
  check(() => assert.equal(replay.replayed, true));
  check(() => assert.equal(group.id, replay.id));
  check(() => assert.equal(notifications, beforeReplay));
  await op({ ...create, name: "outro" }, 409);
  let library = (await req("/groups")).groups;
  check(() => assert.equal(library[0].name, "Culto da Serpente"));
  check(() => assert.equal(library[0].color, "#ABCDEF"));
  check(() => assert.equal(library[0].createdById, masterId));
  check(() => assert.equal(library[0].cardCount, 0));
  await op(
    {
      action: "group.create",
      name: "culto DA serpente",
      color: "#ABCDEF",
      description: "",
    },
    409,
  );
  await op(
    { action: "group.create", name: " ", color: "#ABCDEF", description: "" },
    400,
  );
  await op(
    {
      action: "group.create",
      name: "a".repeat(81),
      color: "#ABCDEF",
      description: "",
    },
    400,
  );
  await op(
    {
      action: "group.create",
      name: "Cor inválida",
      color: "red;display:none",
      description: "",
    },
    400,
  );
  await op(
    {
      action: "group.create",
      name: "Descrição longa",
      color: "#ABCDEF",
      description: "x".repeat(501),
    },
    400,
  );
  const accent = await op({
    action: "group.create",
    name: "Ação",
    color: "#112233",
    description: "",
  });
  await op(
    {
      action: "group.create",
      name: "AC\u0327A\u0303O",
      color: "#112233",
      description: "",
    },
    409,
  );
  const board = await op({
      action: "board.create",
      name: "Quadro fixture 1",
      description: "",
    }),
    geo = { x: 0, y: 0, width: 280, height: 200, zIndex: 0 };
  await op({
    action: "card.create",
    boardId: board.id,
    expectedVersion: 0,
    title: "Pista canônica",
    category: "clue",
    summary: "Fixture",
    content: "Conteúdo preservado",
    geometry: geo,
    groupIds: [group.id, accent.id, group.id],
  });
  let graph = await req("/boards/" + board.id);
  let card = graph.placements[0].card;
  check(() => assert.equal(card.groups.length, 2));
  check(() =>
    assert.equal(graph.groups.find((g: any) => g.id === group.id).cardCount, 1),
  );
  const second = await op({
    action: "board.create",
    name: "Quadro fixture 2",
    description: "",
  });
  await op({
    action: "placement.add",
    boardId: second.id,
    expectedVersion: 0,
    cardId: card.id,
    geometry: geo,
  });
  const secondGraph = await req("/boards/" + second.id);
  check(() =>
    assert.deepEqual(secondGraph.placements[0].card.groups, card.groups),
  );
  await op({
    action: "card.create",
    boardId: board.id,
    expectedVersion: 1,
    title: "Card legado sem grupos",
    category: "note",
    summary: "",
    content: "",
    geometry: { ...geo, x: 600 },
  });
  const withLegacy = await req("/boards/" + board.id);
  const legacy = withLegacy.placements.find(
    (p: any) => p.cardId !== card.id,
  ).card;
  check(() => assert.deepEqual(legacy.groups, []));
  const relation = await op({
    action: "link.create",
    boardId: board.id,
    sourceId: card.id,
    targetId: legacy.id,
    relation: "related",
    label: "",
    directed: true,
    description: "Fixture",
  });
  const update = (ids: string[] | undefined, version = card.version) => ({
    action: "card.update",
    cardId: card.id,
    expectedVersion: version,
    title: card.title,
    category: card.category,
    summary: card.summary,
    content: card.content,
    ...(ids ? { groupIds: ids } : {}),
  });
  await op(update(undefined));
  card = await req("/cards/" + card.id);
  check(() => assert.equal(card.groups.length, 2));
  const countsBefore = {
    boards: await db.narrativeBoard.count(),
    placements: await db.narrativePlacement.count(),
    cards: await db.narrativeCard.count(),
  };
  const groupFresh = () =>
    req("/groups").then((r) => r.groups.find((g: any) => g.id === group.id));
  let row = await groupFresh();
  await op({
    action: "group.update",
    groupId: group.id,
    expectedVersion: row.version,
    name: "Missão principal",
    color: "#123456",
    description: "Descrição nova",
  });
  await op(
    {
      action: "group.update",
      groupId: group.id,
      expectedVersion: row.version,
      name: "Obsoleto",
      color: "#123456",
      description: "",
    },
    409,
  );
  const renamed = await req("/cards/" + card.id);
  check(() =>
    assert.equal(
      renamed.groups.find((g: any) => g.id === group.id).name,
      "Missão principal",
    ),
  );
  check(() =>
    assert.equal(
      renamed.groups.find((g: any) => g.id === group.id).color,
      "#123456",
    ),
  );
  const rollbackId = randomUUID(),
    notifyBefore = notifications,
    originalCard = await req("/cards/" + card.id);
  await op(
    {
      ...update([randomUUID()]),
      operationId: rollbackId,
      content: "Não deve persistir",
    },
    409,
  );
  check(() => assert.equal(notifications, notifyBefore));
  const rollbackReceipt = await db.narrativeOperation.count({
    where: { actorId: masterId, operationId: rollbackId },
  });
  check(() => assert.equal(rollbackReceipt, 0));
  const afterRollback = await req("/cards/" + card.id);
  check(() => assert.deepEqual(afterRollback, originalCard));
  const libraryBefore = (await req("/groups")).groups.length;
  const competing = await Promise.all(
    [master, other].map((bearer, i) =>
      fetch(base + "/operations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + bearer,
        },
        body: JSON.stringify({
          operationId: randomUUID(),
          action: "group.create",
          name: i ? "disputa única" : "Disputa única",
          color: "#AABBCC",
          description: "",
        }),
      }),
    ),
  );
  check(() =>
    assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]),
  );
  const libraryAfterRace = (await req("/groups")).groups.length;
  check(() => assert.equal(libraryAfterRace, libraryBefore + 1));
  card = await req("/cards/" + card.id);
  const responses = await Promise.all([
    fetch(base + "/operations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + master,
      },
      body: JSON.stringify({
        operationId: randomUUID(),
        ...update([group.id]),
      }),
    }),
    fetch(base + "/operations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + other,
      },
      body: JSON.stringify({
        operationId: randomUUID(),
        ...update([accent.id]),
      }),
    }),
  ]);
  check(() =>
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]),
  );
  card = await req("/cards/" + card.id);
  check(() => assert.equal(card.version, originalCard.version + 1));
  check(() => assert.equal(card.groups.length, 1));
  const newlyAdded = card.groups.some((g: any) => g.id === accent.id)
    ? group.id
    : accent.id;
  const staleGroup = (await req("/groups")).groups.find(
    (g: any) => g.id === newlyAdded,
  );
  await op(update([group.id, accent.id]));
  card = await req("/cards/" + card.id);
  await op(
    {
      action: "group.delete",
      groupId: newlyAdded,
      expectedVersion: staleGroup.version,
    },
    409,
  );
  const rowBeforeDelete = await groupFresh();
  await op({
    action: "group.delete",
    groupId: group.id,
    expectedVersion: rowBeforeDelete.version,
  });
  card = await req("/cards/" + card.id);
  check(() => assert.ok(!card.groups.some((g: any) => g.id === group.id)));
  const elsewhere = await req("/boards/" + second.id);
  check(() =>
    assert.ok(
      !elsewhere.placements[0].card.groups.some((g: any) => g.id === group.id),
    ),
  );
  check(() => assert.equal(card.content, "Conteúdo preservado"));
  const preservedLink = await db.narrativeLink.findUnique({
    where: { id: relation.id },
  });
  check(() => assert.ok(preservedLink));
  const countsAfter = {
    boards: await db.narrativeBoard.count(),
    placements: await db.narrativePlacement.count(),
    cards: await db.narrativeCard.count(),
  };
  check(() => assert.deepEqual(countsAfter, countsBefore));
  // Limites são testados com dados próprios, sem mexer na instalação operacional.
  const bulkIds = Array.from({ length: 31 }, () => randomUUID());
  await db.narrativeGroup.createMany({
    data: bulkIds.map((id, i) => ({
      id,
      name: "Grupo teste " + i,
      nameKey: "grupo teste " + i,
      color: "#112233",
      createdById: masterId,
    })),
  });
  await op(update(bulkIds), 400);
  const same = await req("/cards/" + card.id);
  check(() => assert.equal(same.version, card.version));
  await assert.rejects(
    db.narrativeCardGroup.create({
      data: { cardId: card.id, groupId: randomUUID() },
    }),
  );
  checks++;
  await assert.rejects(
    db.narrativeCardGroup.create({
      data: { cardId: card.id, groupId: accent.id },
    }),
  );
  checks++;
  await assert.rejects(
    db.narrativeGroup.create({
      data: {
        id: randomUUID(),
        name: "Cor negada",
        nameKey: "cor negada",
        color: "url(javascript:foo)",
        createdById: masterId,
      },
    }),
  );
  checks++;
  const beforeLimit = await db.narrativeGroup.count();
  const limitIds = Array.from({ length: 500 - beforeLimit }, () =>
    randomUUID(),
  );
  await db.narrativeGroup.createMany({
    data: limitIds.map((id, i) => ({
      id,
      name: "Limite fixture " + i,
      nameKey: "limite fixture " + i,
      color: "#112233",
      createdById: masterId,
    })),
  });
  await op(
    {
      action: "group.create",
      name: "Não cabe",
      color: "#112233",
      description: "",
    },
    400,
  );
  await db.narrativeGroup.deleteMany({
    where: { id: { in: [...bulkIds, ...limitIds] } },
  });
  // Remover card limpa somente suas associações. Agrupamento canônico continua existindo.
  await op({
    action: "card.delete",
    cardId: card.id,
    expectedVersion: card.version,
  });
  const remaining = await req("/groups");
  check(() =>
    assert.equal(
      remaining.groups.find((g: any) => g.id === accent.id).cardCount,
      0,
    ),
  );
  const remainingAssociations = await db.narrativeCardGroup.count({
    where: { cardId: card.id },
  });
  check(() => assert.equal(remainingAssociations, 0));
  check(() => assert.equal(leaks, 0));
  check(() => assert.ok(notifications > 0));
  console.log(
    `Agrupamentos HTTP/PostgreSQL: ${checks} verificações; privacidade, CAS, replay, rollback, limites, unicidade, exclusão e reutilização entre quadros passaram.`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
  // Cleanup seletivo por autores/IDs exclusivos desta execução, inclusive após falha.
  try {
    await db.narrativeBoard.deleteMany({
      where: { createdById: { in: [masterId, otherId] } },
    });
    await db.narrativeCard.deleteMany({
      where: { createdById: { in: [masterId, otherId] } },
    });
    await db.narrativeGroup.deleteMany({
      where: { createdById: { in: [masterId, otherId] } },
    });
    await db.narrativeOperation.deleteMany({
      where: { actorId: { in: [masterId, otherId, playerId] } },
    });
    await db.user.deleteMany({
      where: { id: { in: [masterId, otherId, playerId] } },
    });
  } finally {
    await db.$disconnect();
    await applicationDb?.$disconnect();
  }
}
