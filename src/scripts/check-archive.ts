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
    // Compatibilidade: representação antiga, criada antes da migration aditiva.
    const legacyBoard = randomUUID(),
      legacyCard = randomUUID(),
      legacyPlacement = randomUUID();
    await tx.$executeRaw`INSERT INTO narrative_boards (id, name, "createdById", "updatedAt") VALUES (${legacyBoard}, 'Legado isolado', 'fixture', CURRENT_TIMESTAMP)`;
    await tx.$executeRaw`INSERT INTO narrative_cards (id, title, category, "createdById", "updatedAt") VALUES (${legacyCard}, 'Card legado', 'note', 'fixture', CURRENT_TIMESTAMP)`;
    await tx.$executeRaw`INSERT INTO narrative_placements (id, "boardId", "cardId", x, y) VALUES (${legacyPlacement}, ${legacyBoard}, ${legacyCard}, -123, 456)`;
    const [legacyBefore] = await tx.$queryRaw<
      Record<string, unknown>[]
    >`SELECT * FROM narrative_placements WHERE id=${legacyPlacement}`;
    const branches = await readFile(
      new URL(
        "../../prisma/migrations/20261124150000_narrative_branches/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    for (const statement of branches.split(";").filter((s) => s.trim()))
      await tx.$executeRawUnsafe(statement);
    const [legacyAfter] = await tx.$queryRaw<
      Record<string, unknown>[]
    >`SELECT id, "boardId", "cardId", x, y, width, height, "zIndex", "parentPlacementId" FROM narrative_placements WHERE id=${legacyPlacement}`;
    const { parentPlacementId, ...unchanged } = legacyAfter;
    assert.equal(parentPlacementId, null);
    assert.deepEqual(unchanged, legacyBefore);
    checks += 2;
    const relative = await readFile(
      new URL(
        "../../prisma/migrations/20261124170000_narrative_relative_positions/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    for (const statement of relative.split(";").filter((s) => s.trim()))
      await tx.$executeRawUnsafe(statement);
    const [legacyRelative] = await tx.$queryRaw<
      Record<string, unknown>[]
    >`SELECT "branchOffsetX", "branchOffsetY", x, y FROM narrative_placements WHERE id=${legacyPlacement}`;
    assert.deepEqual(legacyRelative, {
      branchOffsetX: null,
      branchOffsetY: null,
      x: -123,
      y: 456,
    });
    checks++;
    const groups = await readFile(
      new URL(
        "../../prisma/migrations/20261125120000_narrative_groups/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    for (const statement of groups.split(";").filter((s) => s.trim()))
      await tx.$executeRawUnsafe(statement);
    await tx.$executeRaw`DELETE FROM narrative_boards WHERE id=${legacyBoard}`;
    await tx.$executeRaw`DELETE FROM narrative_cards WHERE id=${legacyCard}`;
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
  // Estrutura explícita: todas as entidades abaixo pertencem a este schema descartável.
  const structureBoard = await op({
    action: "board.create",
    name: "Estrutura",
    description: "",
  });
  const readStructure = () => req(`/boards/${structureBoard.id}`);
  const makeBranch = async (title: string, parentPlacementId?: string) =>
    op({
      action: "card.create",
      boardId: structureBoard.id,
      expectedVersion: (await readStructure()).board.version,
      title,
      category: "room",
      summary: "",
      content: "",
      geometry: geo,
      ...(parentPlacementId ? { parentPlacementId } : {}),
    });
  const root = await makeBranch("Masmorra");
  const branchA = await makeBranch("Sala A", root.id);
  const branchB = await makeBranch("Sala B");
  const grandchild = await makeBranch("Passagem", branchA.id);
  let structure = await readStructure();
  assert.equal(
    structure.placements.find((p: any) => p.id === branchA.id)
      .parentPlacementId,
    root.id,
  );
  checks++;
  const rootCard = structure.placements.find(
    (p: any) => p.id === root.id,
  ).cardId;
  const childCard = structure.placements.find(
    (p: any) => p.id === branchB.id,
  ).cardId;
  const canonical = await op({
    action: "link.create",
    boardId: structureBoard.id,
    sourceId: rootCard,
    targetId: childCard,
    relation: "contains",
    label: "",
    directed: true,
    description: "Original",
  });
  const attach = {
    action: "placement.parent",
    boardId: structureBoard.id,
    placementId: branchB.id,
    parentPlacementId: root.id,
    expectedVersion: structure.board.version,
    branchRelation: {
      relation: "contains",
      label: "",
      directed: true,
      description: "Não substituir",
    },
    operationId: randomUUID(),
  };
  await req("/operations", attach);
  assert.equal((await req("/operations", attach)).replayed, true);
  checks++;
  await req(
    "/operations",
    { ...attach, parentPlacementId: branchA.id },
    mt,
    409,
  );
  structure = await readStructure();
  assert.equal(
    structure.links.filter((l: any) => l.id === canonical.id).length,
    1,
  );
  assert.equal(
    (
      await prisma.narrativeLink.findUniqueOrThrow({
        where: { id: canonical.id },
      })
    ).description,
    "Original",
  );
  checks += 2;
  const parentOp = async (
    child: string,
    parent: string | null,
    status = 200,
    extra = {},
  ) =>
    op(
      {
        action: "placement.parent",
        boardId: structureBoard.id,
        expectedVersion: (await readStructure()).board.version,
        placementId: child,
        parentPlacementId: parent,
        ...extra,
      },
      status,
    );
  await parentOp(root.id, root.id, 400);
  await parentOp(root.id, grandchild.id, 400);
  await parentOp(branchB.id, root.id, 409);
  await parentOp(branchB.id, branchA.id, 409);
  await parentOp(root.id, randomUUID(), 404);
  await parentOp(root.id, branchA.id, 409, { expectedVersion: 0 });
  await req("/operations", { ...attach, operationId: randomUUID() }, pt, 403);
  await req(`/boards/${structureBoard.id}`, undefined, pt, 403);
  const beforeDetach = JSON.stringify((await readStructure()).links);
  await parentOp(branchB.id, null);
  assert.equal(JSON.stringify((await readStructure()).links), beforeDetach);
  checks++;
  await parentOp(branchB.id, root.id);
  const snapshot = await readStructure();
  const countCards = await prisma.narrativeCard.count();
  await op(
    {
      action: "card.create",
      boardId: structureBoard.id,
      expectedVersion: snapshot.board.version,
      title: "Rollback",
      category: "room",
      summary: "",
      content: "",
      geometry: geo,
      parentPlacementId: root.id,
      branchRelation: {
        relation: "custom",
        label: "",
        directed: true,
        description: "",
      },
    },
    400,
  );
  assert.equal(await prisma.narrativeCard.count(), countCards);
  assert.equal((await readStructure()).board.version, snapshot.board.version);
  checks += 2;
  const foreignBoard = await op({
    action: "board.create",
    name: "Outro contexto",
    description: "",
  });
  const foreignRoot = await op({
    action: "placement.add",
    boardId: foreignBoard.id,
    cardId: rootCard,
    expectedVersion: 0,
    geometry: geo,
  });
  const foreignChild = await op({
    action: "placement.add",
    boardId: foreignBoard.id,
    cardId: childCard,
    expectedVersion: 1,
    geometry: geo,
    parentPlacementId: foreignRoot.id,
  });
  await parentOp(root.id, foreignRoot.id, 404);
  await assert.rejects(
    prisma.narrativePlacement.update({
      where: { id: root.id },
      data: { parentPlacementId: foreignRoot.id },
    }),
  );
  await assert.rejects(
    prisma.narrativePlacement.update({
      where: { id: root.id },
      data: { parentPlacementId: root.id },
    }),
  );
  checks += 2;
  await op({
    action: "placement.remove",
    boardId: structureBoard.id,
    placementId: root.id,
    expectedVersion: (await readStructure()).board.version,
  });
  structure = await readStructure();
  assert.equal(
    structure.placements.find((p: any) => p.id === branchA.id)
      .parentPlacementId,
    null,
  );
  assert.equal(
    structure.placements.find((p: any) => p.id === branchB.id)
      .parentPlacementId,
    null,
  );
  assert.equal(
    structure.placements.find((p: any) => p.id === grandchild.id)
      .parentPlacementId,
    branchA.id,
  );
  assert.equal(
    (
      await prisma.narrativePlacement.findUniqueOrThrow({
        where: { id: foreignChild.id },
      })
    ).parentPlacementId,
    foreignRoot.id,
  );
  checks += 4;
  // Duas janelas, mesma versão: uma associação vence, a outra não sobrescreve.
  const v = structure.board.version;
  const race = await Promise.all(
    [root.id, branchA.id].map((parentPlacementId) =>
      fetch(`http://127.0.0.1:${port}/api/archive/operations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operationId: randomUUID(),
          action: "placement.parent",
          boardId: structureBoard.id,
          placementId: branchB.id,
          parentPlacementId:
            parentPlacementId === root.id ? grandchild.id : parentPlacementId,
          expectedVersion: v,
        }),
      }),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  checks++;
  await op({ action: "card.delete", cardId: rootCard, expectedVersion: 0 });
  assert.equal(
    (
      await prisma.narrativePlacement.findUniqueOrThrow({
        where: { id: foreignChild.id },
      })
    ).parentPlacementId,
    null,
  );
  assert.ok(
    await prisma.narrativeCard.findUnique({ where: { id: childCard } }),
  );
  checks += 2;
  await op({
    action: "board.delete",
    boardId: structureBoard.id,
    expectedVersion: (await readStructure()).board.version,
  });
  assert.equal(
    await prisma.narrativePlacement.count({
      where: { boardId: structureBoard.id },
    }),
    0,
  );
  checks++;

  // Preferências espaciais: fixtures exclusivamente deste schema e operações HTTP reais.
  const relBoard = await op({
    action: "board.create",
    name: "Relativo",
    description: "",
  });
  let rv = 0;
  const createRelative = async (title: string, parentPlacementId?: string) => {
    const r = await op({
      action: "card.create",
      boardId: relBoard.id,
      expectedVersion: rv++,
      title,
      category: "note",
      summary: "",
      content: "",
      geometry: geo,
      ...(parentPlacementId ? { parentPlacementId } : {}),
    });
    return r.id as string;
  };
  const rp = await createRelative("Pai"),
    rc = await createRelative("Filho", rp),
    rs = await createRelative("Irmão", rp);
  const relGraph = () => req(`/boards/${relBoard.id}`);
  assert.equal(
    (await relGraph()).placements.find((p: any) => p.id === rc).branchOffsetX,
    null,
  );
  checks++;
  const custom = {
    action: "placement.update",
    operationId: randomUUID(),
    boardId: relBoard.id,
    expectedVersion: rv,
    placementId: rc,
    geometry: geo,
    relative: { parentPlacementId: rp, x: 720, y: -230 },
  };
  const { operationId: customId, ...customInput } = custom;
  await req("/operations", custom);
  rv++;
  const customReplay = await req("/operations", custom);
  assert.equal(customReplay.replayed, true);
  checks++;
  await req(
    "/operations",
    { ...custom, relative: { ...custom.relative, x: 800 } },
    mt,
    409,
  );
  checks++;
  let rg = await relGraph();
  assert.equal(rg.placements.find((p: any) => p.id === rc).branchOffsetX, 720);
  assert.equal(rg.placements.find((p: any) => p.id === rc).x, geo.x);
  checks += 2;
  await op({ ...customInput, expectedVersion: rv, placementId: rp }, 409);
  checks++;
  await op(
    {
      ...customInput,
      expectedVersion: rv,
      relative: { parentPlacementId: rs, x: 1, y: 1 },
    },
    409,
  );
  checks++;
  for (const relative of [
    { parentPlacementId: rp, x: 1 },
    { parentPlacementId: rp, x: 2002001, y: 0 },
    { parentPlacementId: rp, x: "NaN", y: 0 },
  ]) {
    await op({ ...customInput, expectedVersion: rv, relative }, 400);
    checks++;
  }
  await req(
    "/operations",
    { ...custom, operationId: randomUUID(), expectedVersion: rv },
    pt,
    403,
  );
  checks++;
  await assert.rejects(
    prisma.narrativePlacement.update({
      where: { id: rc },
      data: { branchOffsetY: null },
    }),
  );
  checks++;
  const reset = {
    action: "placement.reset",
    operationId: randomUUID(),
    boardId: relBoard.id,
    placementId: rp,
    children: true,
    expectedVersion: rv,
  };
  await req("/operations", reset);
  rv++;
  await req("/operations", { ...reset, operationId: randomUUID() }, mt, 409);
  checks++;
  assert.equal((await req("/operations", reset)).replayed, true);
  checks++;
  assert.equal(
    (await relGraph()).placements.find((p: any) => p.id === rc).branchOffsetX,
    null,
  );
  checks++;
  await op({ ...customInput, expectedVersion: rv++ });
  await op({
    action: "placement.parent",
    boardId: relBoard.id,
    placementId: rc,
    parentPlacementId: null,
    expectedVersion: rv++,
  });
  assert.equal(
    (await relGraph()).placements.find((p: any) => p.id === rc).branchOffsetX,
    null,
  );
  checks++;
  await op({
    action: "placement.parent",
    boardId: relBoard.id,
    placementId: rc,
    parentPlacementId: rs,
    expectedVersion: rv++,
  });
  await op({
    ...customInput,
    expectedVersion: rv++,
    relative: { parentPlacementId: rs, x: -700, y: 400 },
  });
  await op({
    action: "placement.reset",
    boardId: relBoard.id,
    placementId: rp,
    children: true,
    expectedVersion: rv++,
  });
  assert.equal(
    (await relGraph()).placements.find((p: any) => p.id === rc).branchOffsetX,
    -700,
  );
  checks++;
  await op({
    action: "placement.reset",
    boardId: relBoard.id,
    placementId: rc,
    children: false,
    expectedVersion: rv++,
  });
  assert.equal(
    (await relGraph()).placements.find((p: any) => p.id === rc).branchOffsetX,
    null,
  );
  checks++;
  await op({
    ...customInput,
    expectedVersion: rv++,
    relative: { parentPlacementId: rs, x: -700, y: 400 },
  });
  await op({
    action: "placement.remove",
    boardId: relBoard.id,
    placementId: rs,
    expectedVersion: rv++,
  });
  rg = await relGraph();
  const promoted = rg.placements.find((p: any) => p.id === rc);
  assert.equal(promoted.parentPlacementId, null);
  assert.equal(promoted.branchOffsetX, null);
  checks += 2;
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
