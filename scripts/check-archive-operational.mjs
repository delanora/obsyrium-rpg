/** Regressão de artefatos candidatos/rollback, somente PostgreSQL descartável próprio. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
const runtime = process.env.ARCHIVE_COMPAT_RUNTIME,
  url = process.env.ARCHIVE_TEST_DATABASE_URL,
  data = process.env.ARCHIVE_TEST_PGDATA;
if (
  !runtime ||
  !fs.realpathSync(runtime).startsWith("/tmp/") ||
  !data ||
  !/^\/tmp\/obsyrium-grupos-pg-[a-zA-Z0-9]+\/data$/.test(data) ||
  !url
)
  throw Error("Runtime e instância descartáveis explícitos obrigatórios.");
const connection = new URL(url);
assert.equal(connection.pathname, "/arquivo_grupos_853");
assert.equal(connection.searchParams.get("schema"), "test_archive_grupos");
assert.ok(
  fs
    .realpathSync(path.join(runtime, "node_modules/.prisma/client"))
    .startsWith("/tmp/"),
);
process.env.DATABASE_URL = url;
process.env.JWT_SECRET = "compatibilidade-isolada-sem-credenciais-reais";
process.env.NODE_ENV = "test";
const load = (rel) => import(pathToFileURL(path.join(runtime, rel)).href);
const { default: express } = await load("node_modules/express/index.js");
const { prisma } = await load("dist/config/prisma.js");
const user = randomUUID(),
  player = randomUUID(),
  group = randomUUID();
let board,
  card,
  region,
  locality,
  scene,
  roll,
  server,
  checks = 0,
  isolated = false;
const check = (fn) => {
  fn();
  checks++;
};
try {
  const [sentinel] = await prisma.$queryRawUnsafe(
    "SELECT current_database() AS database,current_schema() AS schema,current_setting('data_directory') AS directory",
  );
  assert.equal(sentinel.database, "arquivo_grupos_853");
  assert.equal(sentinel.schema, "test_archive_grupos");
  assert.equal(sentinel.directory, data);
  assert.equal(await prisma.user.count(), 0);
  assert.equal(await prisma.locality.count(), 0);
  assert.equal(await prisma.scene.count(), 0);
  assert.equal(await prisma.diceRollLog.count(), 0);
  isolated = true;
  for (const [id, role] of [
    [user, "MASTER"],
    [player, "PLAYER"],
  ])
    await prisma.user.create({
      data: {
        id,
        username: "compat-" + id,
        displayName: "Fixture isolada",
        passwordHash: "nao-utilizavel",
        role,
      },
    });
  const { setBroadcaster } = await load("dist/realtime/hub.js");
  setBroadcaster({
    toMasters() {},
    toTable() {},
    toPlayers() {},
    toUser() {},
    presence() {},
    disconnectUser() {},
  });
  const { signToken } = await load("dist/lib/jwt.js");
  const token = (id) =>
    signToken({
      sub: id,
      username: "compat-" + id,
      displayName: "Fixture isolada",
      role: id === user ? "MASTER" : "PLAYER",
    });
  const app = express();
  app.use(express.json());
  for (const [prefix, rel, key] of [
    ["regions", "regions/regions.routes", "regionsRouter"],
    ["localities", "localities/localities.routes", "localitiesRouter"],
    ["scenes", "scenes/scenes.routes", "scenesRouter"],
    ["dice", "dice/dice.routes", "diceRouter"],
    ["archive", "archive/archive.routes", "archiveRouter"],
  ])
    app.use("/api/" + prefix, (await load("dist/modules/" + rel + ".js"))[key]);
  app.use((await load("dist/middlewares/errorHandler.js")).errorHandler);
  server = createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const req = async (
    route,
    method = "GET",
    body,
    status = 200,
    bearer = token(user),
  ) => {
    const r = await fetch(base + "/api/" + route, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await r.text();
    check(() => assert.equal(r.status, status, text));
    return text ? JSON.parse(text) : null;
  };
  for (const endpoint of [
    "regions",
    "scenes",
    "dice/history",
    "archive/boards",
  ]) {
    await req(endpoint, "GET", undefined, 401, null);
    await req(endpoint, "GET", undefined, 403, token(player));
  }
  region = (await req("regions", "POST", { name: "Região de fixture" }, 201))
    .region;
  locality = (
    await req("localities", "POST", { name: "Localidade de fixture" }, 201)
  ).locality;
  check(() => assert.equal(locality.regionId, null));
  locality = (
    await req("localities/" + locality.id, "PATCH", { regionId: region.id })
  ).locality;
  check(() => assert.equal(locality.regionId, region.id));
  scene = (
    await req(
      "scenes",
      "POST",
      { name: "Cena de fixture", regionId: region.id },
      201,
    )
  ).scene;
  check(() => assert.equal(scene.localityId, null));
  check(() => assert.equal(scene.regionId, region.id));
  const originalLocality = locality.id;
  await req("regions/" + region.id, "DELETE", undefined, 204);
  region = null;
  locality = (await req("localities/" + originalLocality)).locality;
  scene = (await req("scenes/" + scene.id)).scene;
  check(() => assert.equal(locality.regionId, null));
  check(() => assert.equal(scene.regionId, null));
  const updated = await req("scenes/" + scene.id, "PATCH", {
    name: "Cena editada",
    expectedVersion: scene.version,
    operationId: randomUUID(),
  });
  scene = updated.scene;
  check(() => assert.equal(scene.name, "Cena editada"));
  roll = (
    await req(
      "dice/roll",
      "POST",
      {
        kind: "free",
        dice: [{ sides: 6 }],
        private: true,
        label: "Fixture de persistência",
      },
      201,
    )
  ).roll;
  assert.ok(roll.id);
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await prisma.diceRollLog.count({ where: { id: roll.id } })) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  const stored = await prisma.diceRollLog.findUnique({
    where: { id: roll.id },
  });
  check(() => assert.ok(stored));
  const history = (await req("dice/history")).rolls;
  check(() => assert.ok(history.some((r) => r.id === roll.id)));
  const child = `const {prisma}=await import(${JSON.stringify(pathToFileURL(path.join(runtime, "dist/config/prisma.js")).href)});const [s]=await prisma.$queryRawUnsafe("SELECT current_setting('data_directory') AS directory");if(s.directory!==process.env.ARCHIVE_TEST_PGDATA)throw Error('Instância divergente');const {getDiceHistory}=await import(${JSON.stringify(pathToFileURL(path.join(runtime, "dist/modules/dice/dice.service.js")).href)});const h=await getDiceHistory();if(!h.some(r=>r.id===${JSON.stringify(roll.id)}))throw Error('Log não persistiu');await prisma.$disconnect();`;
  execFileSync(process.execPath, ["--input-type=module", "-e", child], {
    cwd: runtime,
    env: process.env,
    timeout: 15000,
  });
  checks++;
  const op = async (input) =>
    req("archive/operations", "POST", { operationId: randomUUID(), ...input });
  board = await op({
    action: "board.create",
    name: "Quadro da fixture",
    description: "",
  });
  card = await op({
    action: "card.create",
    boardId: board.id,
    expectedVersion: 0,
    title: "Card preservado",
    category: "note",
    summary: "Resumo",
    content: "Conteúdo",
    geometry: { x: 0, y: 0, width: 280, height: 200, zIndex: 0 },
  });
  const graph = await req("archive/boards/" + board.id);
  const canonical = graph.placements[0].card.id;
  await prisma.$executeRawUnsafe(
    'INSERT INTO narrative_groups (id,name,"nameKey",color,"createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)',
    group,
    "Grupo de rollback",
    "grupo de rollback",
    "#AABBCC",
    user,
  );
  await prisma.$executeRawUnsafe(
    'INSERT INTO narrative_card_groups ("cardId","groupId") VALUES ($1,$2)',
    canonical,
    group,
  );
  await op({
    action: "card.update",
    cardId: canonical,
    expectedVersion: graph.placements[0].card.version,
    title: "Editado pela composição",
    category: "note",
    summary: "Resumo",
    content: "Conteúdo mantido",
  });
  const after = await req("archive/boards/" + board.id);
  check(() =>
    assert.equal(after.placements[0].card.title, "Editado pela composição"),
  );
  const [association] = await prisma.$queryRawUnsafe(
    'SELECT count(*)::int AS count FROM narrative_card_groups WHERE "cardId"=$1 AND "groupId"=$2',
    canonical,
    group,
  );
  check(() => assert.equal(association.count, 1));
  console.log(
    `Composição ${path.basename(runtime)}: ${checks} verificações HTTP/DB; geografia anulável, SET NULL, cenas, persistência do log em novo processo e agrupamentos preservados.`,
  );
} finally {
  if (!isolated) {
    await prisma.$disconnect();
  } else {
    if (server) await new Promise((r) => server.close(r));
    await prisma.diceRollLog.deleteMany({
      where: { actorUserId: { in: [user, player] } },
    });
    await prisma.$executeRawUnsafe(
      "DELETE FROM narrative_groups WHERE id=$1",
      group,
    );
    await prisma.narrativeBoard.deleteMany({ where: { createdById: user } });
    await prisma.narrativeCard.deleteMany({ where: { createdById: user } });
    await prisma.narrativeOperation.deleteMany({ where: { actorId: user } });
    if (scene) await prisma.scene.deleteMany({ where: { id: scene.id } });
    if (locality)
      await prisma.locality.deleteMany({ where: { id: locality.id } });
    if (region) await prisma.region.deleteMany({ where: { id: region.id } });
    await prisma.user.deleteMany({ where: { id: { in: [user, player] } } });
    await prisma.$disconnect();
  }
}
