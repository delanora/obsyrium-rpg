/** Browser real; API simulada em memória, sem conexão com a campanha. */
import { build } from "esbuild";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const root = process.cwd(),
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "arquivo-browser-"));
await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{ArchivePage}from'${root}/client/src/components/archive/ArchivePage';createRoot(document.getElementById('root')).render(<div className="app-shell theme-master"><header className="app-header" style={{height:48,flexShrink:0}}>Obsyrium</header><nav className="tabs tabs-inline master-navigation"><button className="tab">Início</button><button className="tab">Fichas</button><button className="tab">Fichário</button></nav><main className="app-main app-main-wide"><ArchivePage/></main></div>);`,
    resolveDir: path.join(root, "client"),
    loader: "tsx",
  },
  plugins: [
    {
      name: "medicao-layout-isolada",
      setup(builder) {
        builder.onLoad({ filter: /archiveLayout\.ts$/ }, (args) => ({
          contents:
            fs
              .readFileSync(args.path, "utf8")
              .replace(
                "export function layoutArchive(",
                "function computeArchiveLayout(",
              ) +
            `
        export function layoutArchive(...args: Parameters<typeof computeArchiveLayout>) {
          const start=performance.now();
          window.__archiveLayoutCalls=(window.__archiveLayoutCalls??0)+1;
          const result=computeArchiveLayout(...args);
          (window.__archiveLayoutTimes??=[]).push(performance.now()-start);
          return result;
        }`,
          loader: "ts",
        }));
      },
    },
  ],
  bundle: true,
  external: ["/archive/*"],
  jsx: "automatic",
  outfile: path.join(temp, "app.js"),
});
const boardId = randomUUID();
const boards = [
  {
    id: boardId,
    name: "Mundo de teste",
    description: "",
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
const cards = [],
  placements = [],
  links = [];
let reads = 0;
let operations = 0,
  failNext = false,
  graphDelay = 0;
function populate(count) {
  cards.length = 0;
  placements.length = 0;
  links.length = 0;
  for (let i = 0; i < count; i++) {
    const card = {
      id: randomUUID(),
      title: `Card ${i}`,
      category: i % 2 ? "npc" : "locality",
      summary: `Resumo ${i}`,
      content: `Conteúdo integral ${i}`,
      version: 0,
      createdAt: "",
      updatedAt: "",
    };
    cards.push(card);
    placements.push({
      id: randomUUID(),
      boardId,
      cardId: card.id,
      x: 100 + (i % 10) * 700,
      y: 80 + Math.floor(i / 10) * 280,
      width: 280,
      height: 200,
      zIndex: 0,
    });
  }
  for (let i = 1; i < count; i++)
    links.push({
      id: randomUUID(),
      sourceId: cards[i - 1].id,
      targetId: cards[i].id,
      relation: "related",
      label: "",
      directed: true,
      description: "",
      version: 0,
    });
}
populate(2);
links.length = 0;
const graph = (id) => ({
  board: boards.find((b) => b.id === id),
  placements: placements
    .filter((p) => p.boardId === id)
    .map((p) => ({ ...p, card: cards.find((c) => c.id === p.cardId) })),
  links: links.filter(
    (l) =>
      placements.some((p) => p.boardId === id && p.cardId === l.sourceId) &&
      placements.some((p) => p.boardId === id && p.cardId === l.targetId),
  ),
});
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
const assetRequests = [];
page.on("request", (r) => {
  if (/\/archive\/(icons|card-parts)\//.test(r.url()))
    assetRequests.push(r.url());
});
page.on("pageerror", (e) => errors.push(e.message));
await page.route("http://arquivo.test/**", async (route) => {
  const url = new URL(route.request().url()),
    p = url.pathname;
  if (p.startsWith("/api/archive")) {
    if (route.request().method() === "GET") reads++;
    if (p.endsWith("/operations")) {
      operations++;
      if (failNext) {
        failNext = false;
        return route.fulfill({
          status: 503,
          json: { message: "Falha simulada de salvamento" },
        });
      }
      const i = route.request().postDataJSON();
      const board = boards.find((b) => b.id === (i.boardId ?? boardId));
      let id = randomUUID();
      if (i.action === "board.create")
        boards.push({
          id,
          name: i.name,
          description: i.description,
          version: 0,
          createdAt: "",
          updatedAt: "",
        });
      else if (i.action === "card.create") {
        const c = {
          id: randomUUID(),
          title: i.title,
          category: i.category,
          summary: i.summary,
          content: i.content,
          version: 0,
          createdAt: "",
          updatedAt: "",
        };
        cards.push(c);
        placements.push({
          id,
          boardId: i.boardId,
          cardId: c.id,
          parentPlacementId: i.parentPlacementId ?? null,
          ...i.geometry,
        });
        board.version++;
      } else if (i.action === "card.update") {
        const c = cards.find((c) => c.id === i.cardId);
        Object.assign(c, {
          title: i.title,
          category: i.category,
          summary: i.summary,
          content: i.content,
          version: c.version + 1,
        });
        id = c.id;
      } else if (i.action === "placement.add") {
        placements.push({
          id,
          boardId: i.boardId,
          cardId: i.cardId,
          parentPlacementId: i.parentPlacementId ?? null,
          ...i.geometry,
        });
        board.version++;
      } else if (i.action === "placement.parent") {
        const place = placements.find((p) => p.id === i.placementId);
        place.parentPlacementId = i.parentPlacementId;
        id = place.id;
        board.version++;
      } else if (i.action === "placement.update") {
        id = i.placementId;
        Object.assign(
          placements.find((p) => p.id === i.placementId),
          i.geometry,
        );
        board.version++;
      } else if (i.action === "link.create")
        links.push({ ...i, id, version: 0 });
      if (i.parentPlacementId && i.branchRelation) {
        const parent = placements.find((p) => p.id === i.parentPlacementId);
        const child = placements.find((p) => p.id === id);
        if (
          !links.some(
            (l) =>
              l.sourceId === parent.cardId &&
              l.targetId === child.cardId &&
              l.relation === i.branchRelation.relation,
          )
        )
          links.push({
            id: randomUUID(),
            sourceId: parent.cardId,
            targetId: child.cardId,
            ...i.branchRelation,
            version: 0,
          });
      }
      return route.fulfill({ json: { id, version: board?.version ?? 0 } });
    }
    if (p === "/api/archive/boards") return route.fulfill({ json: { boards } });
    if (p === "/api/archive/cards") return route.fulfill({ json: { cards } });
    if (p.startsWith("/api/archive/boards/")) {
      if (graphDelay)
        await new Promise((resolve) => setTimeout(resolve, graphDelay));
      return route.fulfill({ json: graph(p.split("/").pop()) });
    }
  }
  let file =
    p === "/app.js"
      ? path.join(temp, "app.js")
      : p === "/app.css"
        ? path.join(temp, "app.css")
        : p === "/style.css"
          ? path.join(root, "client/src/styles.css")
          : path.join(root, "client/public", p);
  if (p.endsWith(".css") && !fs.existsSync(file))
    file = path.join(root, "client/src", p);
  if (fs.existsSync(file) && fs.statSync(file).isFile())
    return route.fulfill({
      path: file,
      contentType: p.endsWith(".css")
        ? "text/css"
        : p.endsWith(".js")
          ? "text/javascript"
          : p.endsWith(".woff2")
            ? "font/woff2"
            : undefined,
    });
  return route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><style>body{margin:0;padding:0}</style><div id="root"></div><script src="/app.js"></script></html>',
  });
});
const chooseRadial = async (name) => {
  const button = page.getByRole("menuitem", { name, exact: true });
  await button.waitFor();
  const point = await button.evaluate((el) => {
    const menu = el.closest('[role="menu"]');
    const rect = menu.getBoundingClientRect();
    const buttons = [
      ...menu.querySelectorAll(".scene-editor-radial-sector button"),
    ];
    const angle =
      -Math.PI / 2 + (buttons.indexOf(el) * Math.PI * 2) / buttons.length;
    return {
      x: rect.left + rect.width / 2 + Math.cos(angle) * rect.width * 0.35,
      y: rect.top + rect.height / 2 + Math.sin(angle) * rect.height * 0.35,
    };
  });
  await page.mouse.click(point.x, point.y);
};
try {
  await page.goto("http://arquivo.test");
  await page.locator(".archive-card").nth(1).waitFor();
  const layout = await page.evaluate(() => {
    const rect = document
      .querySelector(".archive-viewport")
      .getBoundingClientRect();
    const nav = document
      .querySelector(".master-navigation")
      .getBoundingClientRect();
    const dock = document
      .querySelector(".archive-dock")
      .getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      top: rect.top,
      navBottom: nav.bottom,
      headerBottom: document
        .querySelector(".app-header")
        .getBoundingClientRect().bottom,
      navBackground: getComputedStyle(
        document.querySelector(".master-navigation"),
      ).backgroundColor,
      width: innerWidth,
      height: innerHeight,
      dockBottom: dock.bottom,
      dockTop: dock.top,
      border: getComputedStyle(document.querySelector(".archive-viewport"))
        .borderWidth,
    };
  });
  assert.equal(layout.left, 0);
  assert.equal(layout.right, layout.width);
  assert.equal(layout.bottom, layout.height);
  assert.ok(Math.abs(layout.top - layout.headerBottom) < 1);
  assert.equal(layout.navBackground, "rgba(0, 0, 0, 0)");
  assert.ok(layout.navBottom > layout.top);
  assert.equal(layout.border, "0px");
  assert.ok(layout.dockBottom < layout.height && layout.dockTop > layout.top);
  const blank = await page.locator(".archive-viewport").boundingBox();
  await page.mouse.click(blank.x + 70, blank.y + 70, { button: "right" });
  await page.getByRole("menu", { name: "Novo card", exact: true }).waitFor();
  const menu = await page
    .getByRole("menu", { name: "Novo card", exact: true })
    .boundingBox();
  assert.ok(menu.x >= 0 && menu.y >= 0);
  await page.screenshot({
    path: path.join(temp, "arquivo-radial.png"),
    fullPage: true,
  });
  const hovered = page
    .getByRole("menu", { name: "Novo card", exact: true })
    .locator(".scene-editor-radial-sector")
    .first();
  const ring = await page
    .getByRole("menu", { name: "Novo card", exact: true })
    .boundingBox();
  await page.mouse.move(ring.x + ring.width / 2, ring.y + ring.height * 0.15);
  await page.waitForTimeout(200);
  assert.ok((await hovered.getAttribute("class")).includes("is-highlighted"));
  assert.notEqual(
    await hovered
      .locator(".scene-editor-radial-face")
      .evaluate((el) => getComputedStyle(el).transform),
    "none",
  );
  assert.ok(
    (
      await hovered
        .locator(".scene-editor-radial-face")
        .evaluate((el) => getComputedStyle(el).transitionDuration)
    ).includes("0.18s"),
  );
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.locator(":focus").getAttribute("aria-label"),
    "Pessoas",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("menu").count(), 0);
  assert.equal(operations, 0);
  // Pan e zoom são locais: nenhuma operação HTTP e coordenadas intactas.
  const original = JSON.stringify(placements);
  const viewport = await page.locator(".archive-viewport").boundingBox();
  await page.mouse.move(viewport.x + 30, viewport.y + 30);
  await page.mouse.down();
  await page.mouse.move(viewport.x + 90, viewport.y + 70, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -220);
  await page.waitForTimeout(100);
  assert.equal(operations, 0);
  assert.equal(JSON.stringify(placements), original);
  await page.getByRole("button", { name: "Enquadrar", exact: true }).click();
  const header = page.locator(".archive-card header").first();
  const rect = await header.boundingBox();
  await page.mouse.move(rect.x + 40, rect.y + 30);
  await page.mouse.down();
  await page.mouse.move(rect.x + 110, rect.y + 70, { steps: 8 });
  const draggedStyle = await header.locator("..").getAttribute("style");
  graphDelay = 650;
  await page.mouse.up();
  await page.waitForResponse((r) => r.url().endsWith("/operations"));
  await page.waitForTimeout(180);
  assert.equal(
    await header.locator("..").getAttribute("style"),
    draggedStyle,
    "O card não deve voltar à posição antiga enquanto o grafo é recarregado",
  );
  graphDelay = 0;
  await page.waitForFunction(
    () => document.querySelector(".archive-save")?.textContent === "Salvo",
  );
  assert.ok(placements[0].x !== 100);
  assert.equal(operations, 1);
  // Falha mantém a geometria e permite retry explícito.
  failNext = true;
  const handle = await page
    .locator(".archive-card .edge-se")
    .first()
    .boundingBox();
  await page.mouse.move(handle.x + 5, handle.y + 5);
  await page.mouse.down();
  await page.mouse.move(handle.x + 65, handle.y + 45, { steps: 7 });
  await page.mouse.up();
  await page.getByText("Falha simulada de salvamento").waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "Tentar salvar novamente" })
      .isVisible(),
  );
  await page.getByRole("button", { name: "Tentar salvar novamente" }).click();
  await page.waitForFunction(
    () => document.querySelector(".archive-save")?.textContent === "Salvo",
  );
  assert.ok(placements[0].width > 280);
  // O ponteiro usa coordenadas do quadro em zoom baixo e alto.
  for (const zoomButton of ["Afastar", "Aproximar"]) {
    for (let i = 0; i < (zoomButton === "Aproximar" ? 2 : 4); i++)
      await page.getByRole("button", { name: zoomButton, exact: true }).click();
    const scale = await page
      .locator(".archive-world")
      .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    const oldX = placements[0].x;
    const box = await page
      .locator(".archive-card header")
      .first()
      .boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 20,
      box.y + box.height / 2 + 10,
      { steps: 5 },
    );
    const saved = page.waitForResponse((r) => r.url().endsWith("/operations"));
    await page.mouse.up();
    await saved;
    await page.waitForFunction(
      () => document.querySelector(".archive-save")?.textContent === "Salvo",
    );
    assert.ok(Math.abs(placements[0].x - oldX - 20 / scale) < 1);
    const corner = await page
      .locator(".archive-card .edge-se")
      .first()
      .boundingBox();
    const oldWidth = placements[0].width;
    await page.mouse.move(
      corner.x + corner.width / 2,
      corner.y + corner.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      corner.x + corner.width / 2 + 15,
      corner.y + corner.height / 2 + 10,
      { steps: 5 },
    );
    const resized = page.waitForResponse((r) =>
      r.url().endsWith("/operations"),
    );
    await page.mouse.up();
    await resized;
    await page.waitForFunction(
      () => document.querySelector(".archive-save")?.textContent === "Salvo",
    );
    assert.ok(Math.abs(placements[0].width - oldWidth - 15 / scale) < 1);
    await page.getByRole("button", { name: "Enquadrar", exact: true }).click();
  }
  // Conexão cancelada não persiste; conexão válida abre o editor.
  const connect = page.getByRole("button", {
    name: "Conectar Card 0",
    exact: true,
  });
  await page.locator(".archive-card").first().hover();
  let port = await connect.boundingBox();
  const before = operations;
  await page.mouse.move(port.x + 10, port.y + 10);
  await page.mouse.down();
  await page.mouse.move(viewport.x + 20, viewport.y + 20, { steps: 6 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.equal(operations, before);
  await page.locator(".archive-card").first().hover();
  port = await connect.boundingBox();
  const target = await page.locator(".archive-card").nth(1).boundingBox();
  await page.mouse.move(port.x + 10, port.y + 10);
  await page.mouse.down();
  await page.mouse.move(target.x + 50, target.y + 50, { steps: 10 });
  await page.mouse.up();
  await page.getByRole("dialog", { name: "Relação narrativa" }).waitFor();
  await page.locator("dialog select").selectOption("protects");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForSelector(".archive-link-hit");
  assert.equal(links.length, 1);
  await page
    .getByRole("button", { name: /Card 0 — Protege — Card 1/ })
    .click({ force: true });
  await page.getByRole("button", { name: "Ações", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Editar relação", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  assert.equal(links.length, 1);
  await page.getByRole("button", { name: "Enquadrar", exact: true }).click();
  await page.screenshot({
    path: path.join(temp, "arquivo-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Novo card", exact: true }).click();
  await chooseRadial("Pistas");
  await chooseRadial("Pista");
  await page.getByLabel("Título", { exact: true }).fill("Pista nova");
  await page.getByLabel("Categoria", { exact: true }).selectOption("clue");
  await page.getByLabel("Resumo", { exact: true }).fill("Uma pista");
  await page
    .getByLabel("Conteúdo narrativo", { exact: true })
    .fill("Conteúdo completo secreto");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByRole("article", { name: "Pista nova" }).waitFor();
  await page.reload();
  await page.getByRole("article", { name: "Pista nova" }).waitFor();
  assert.equal(
    cards.find((c) => c.title === "Pista nova").content,
    "Conteúdo completo secreto",
  );
  assert.equal(links.length, 1);
  await page.getByRole("button", { name: "Novo quadro", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Sessão 2");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByText("Seu quadro está livre.").waitFor();
  assert.equal(boards.length, 2);
  await page.selectOption('[aria-label="Quadro narrativo"]', boardId);
  await page.getByRole("article", { name: "Pista nova" }).waitFor();
  await page
    .getByRole("button", { name: "Ações de Card 0", exact: true })
    .focus();
  await page.keyboard.press("Shift+F10");
  await page
    .getByRole("menu", { name: "Ações do card", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".archive-card").first().click({ button: "right" });
  await page
    .getByRole("menu", { name: "Ações do card", exact: true })
    .waitFor();
  await chooseRadial("Editar conteúdo");
  await page
    .getByRole("dialog", { name: "Card narrativo", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Fechar editor", exact: true })
    .click();
  const vp = await page.locator(".archive-viewport").boundingBox();
  const click = { x: vp.x + 90, y: vp.y + 65 };
  const expected = await page.locator(".archive-world").evaluate(
    (el, { x, y, vp }) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return {
        x: (x - vp.x - m.e) / m.a - 140,
        y: (y - vp.y - m.f) / m.a - 100,
      };
    },
    { ...click, vp },
  );
  await page.mouse.click(click.x, click.y, { button: "right" });
  await chooseRadial("Criar anotação");
  await page.getByLabel("Título", { exact: true }).fill("No ponto clicado");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByRole("article", { name: "No ponto clicado" }).waitFor();
  const added = placements.find(
    (p) => cards.find((c) => c.id === p.cardId)?.title === "No ponto clicado",
  );
  assert.ok(
    Math.abs(added.x - expected.x) < 1 && Math.abs(added.y - expected.y) < 1,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Novo card", exact: true }).click();
  assert.ok(
    await page
      .locator(".scene-editor-radial-face")
      .first()
      .evaluate((el) =>
        getComputedStyle(el)
          .transitionDuration.split(",")
          .every((value) => parseFloat(value) <= 0.001),
      ),
  );
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // 8.5.2.1: pertencimento persistido no mock, expansão apenas nesta janela.
  const storyNames = [
    "Cidade de Valdoria",
    "Taverna do Corvo",
    "Mercado",
    "Guarda da cidade",
    "Templo Serpentino",
    "Entrada da Caverna",
    "Salão das Estátuas",
    "Armadilha de Dardos",
    "Guardião",
    "Dragão das Montanhas do Norte",
  ];
  populate(10);
  links.length = 0;
  const positions = [
    [80, 120],
    [80, 400],
    [400, 120],
    [400, 400],
    [80, 680],
    [1100, 120],
    [1100, 400],
    [1440, 120],
    [1440, 400],
    [760, 680],
  ];
  storyNames.forEach((name, i) => {
    cards[i].title = name;
    cards[i].category = [
      "locality",
      "locality",
      "locality",
      "npc",
      "locality",
      "dungeon",
      "room",
      "trap",
      "creature",
      "creature",
    ][i];
    Object.assign(placements[i], {
      x: positions[i][0],
      y: positions[i][1],
      width: 300,
      height: 230,
      parentPlacementId:
        i > 0 && i < 5
          ? placements[0].id
          : i > 5 && i < 9
            ? placements[5].id
            : null,
    });
  });
  for (const [a, b] of [
    [0, 1],
    [0, 9],
    [6, 9],
    [6, 7],
  ])
    links.push({
      id: randomUUID(),
      sourceId: cards[a].id,
      targetId: cards[b].id,
      relation: "related",
      label: "",
      directed: true,
      description: "",
      version: 0,
    });
  const externalLink = links[2].id;
  const savedStructure = JSON.stringify({ placements, links });
  await page.setViewportSize({ width: 2100, height: 1320 });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".archive-card").length === 3,
  );
  const worldTransform = () =>
    page.locator(".archive-world").getAttribute("style");
  const fixedCamera = await worldTransform(),
    beforeExpand = operations,
    beforeRead = reads;
  await page.screenshot({
    path: path.join(temp, "expansao-inicial-recolhido.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Expandir ramificações de Cidade de Valdoria",
      exact: true,
    })
    .click();
  assert.equal(await page.locator(".archive-card").count(), 7);
  await page
    .getByRole("article", { name: storyNames[9], exact: true })
    .waitFor();
  await page.screenshot({
    path: path.join(temp, "expansao-cidade.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Expandir ramificações de Entrada da Caverna",
      exact: true,
    })
    .click();
  assert.equal(await page.locator(".archive-card").count(), 10);
  assert.equal(await page.locator(`[data-link="${externalLink}"]`).count(), 1);
  await page.screenshot({
    path: path.join(temp, "expansao-cidade-masmorra.png"),
    fullPage: true,
  });
  await page
    .getByRole("article", { name: "Salão das Estátuas", exact: true })
    .locator(".archive-card-copy")
    .click();
  await page
    .getByRole("button", {
      name: "Recolher ramificações de Entrada da Caverna",
      exact: true,
    })
    .click();
  assert.equal(await page.locator(`[data-link="${externalLink}"]`).count(), 0);
  assert.ok(
    await page
      .getByRole("article", { name: "Entrada da Caverna", exact: true })
      .evaluate((el) => el.classList.contains("is-selected")),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Conectar Salão das Estátuas", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", {
      name: "Expandir ramificações de Entrada da Caverna",
      exact: true,
    })
    .click();
  assert.equal(await page.locator(`[data-link="${externalLink}"]`).count(), 1);
  await page
    .getByRole("button", {
      name: "Recolher ramificações de Entrada da Caverna",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Recolher ramificações de Cidade de Valdoria",
      exact: true,
    })
    .click();
  assert.equal(await page.locator(".archive-card").count(), 3);
  assert.equal(await worldTransform(), fixedCamera);
  assert.equal(operations, beforeExpand);
  assert.equal(reads, beforeRead);
  assert.equal(JSON.stringify({ placements, links }), savedStructure);
  await page.screenshot({
    path: path.join(temp, "expansao-recolhida-vinculos-preservados.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ações de Cidade de Valdoria", exact: true })
    .click();
  await chooseRadial("Ramificações");
  await chooseRadial("Criar ramificação");
  await chooseRadial("Criar anotação");
  await page.getByLabel("Título", { exact: true }).fill("Posto de vigia");
  await page
    .getByLabel("Também registrar ou reutilizar relação narrativa")
    .check();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .getByRole("article", { name: "Posto de vigia", exact: true })
    .waitFor();
  const createdBranch = placements.find(
    (p) => cards.find((c) => c.id === p.cardId)?.title === "Posto de vigia",
  );
  assert.equal(createdBranch.parentPlacementId, placements[0].id);
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".archive-card").length === 3,
  );
  assert.equal(
    await page
      .getByRole("article", { name: "Posto de vigia", exact: true })
      .count(),
    0,
  );
  await page.screenshot({
    path: path.join(temp, "expansao-estrutura-apos-reload.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ações de Cidade de Valdoria", exact: true })
    .click();
  await chooseRadial("Ramificações");
  await chooseRadial("Associar card como ramificação");
  await page
    .getByLabel("Também registrar ou reutilizar relação narrativa")
    .check();
  await page
    .getByLabel("Relação narrativa", { exact: true })
    .selectOption("related");
  const oldLinks = links.length;
  await page
    .locator(".archive-library button")
    .filter({ hasText: "Dragão das Montanhas do Norte" })
    .click();
  await page.waitForFunction(
    () => document.querySelector(".archive-save")?.textContent === "Salvo",
  );
  assert.equal(placements[9].parentPlacementId, placements[0].id);
  assert.equal(links.length, oldLinks);
  await page
    .getByRole("button", {
      name: "Ações de Dragão das Montanhas do Norte",
      exact: true,
    })
    .click();
  await chooseRadial("Ramificações");
  await chooseRadial("Remover pertencimento");
  await page.waitForFunction(
    () => document.querySelector(".archive-save")?.textContent === "Salvo",
  );
  assert.equal(placements[9].parentPlacementId, null);
  await page
    .getByRole("article", { name: "Taverna do Corvo", exact: true })
    .locator(".archive-card-copy")
    .click();
  placements[1].parentPlacementId = placements[5].id;
  boards[0].version++;
  const beforeExternalCamera = await worldTransform();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await page
    .getByRole("article", { name: "Taverna do Corvo", exact: true })
    .waitFor({ state: "detached" });
  assert.ok(
    await page
      .getByRole("article", { name: "Entrada da Caverna", exact: true })
      .evaluate((el) => el.classList.contains("is-selected")),
  );
  assert.equal(await worldTransform(), beforeExternalCamera);
  await page
    .getByLabel("Quadro narrativo", { exact: true })
    .selectOption(boards[1].id);
  await page.waitForFunction(
    (id) => document.querySelector(".archive-toolbar select")?.value === id,
    boards[1].id,
  );
  await page
    .getByLabel("Quadro narrativo", { exact: true })
    .selectOption(boardId);
  await page
    .getByRole("button", {
      name: "Recolher ramificações de Cidade de Valdoria",
      exact: true,
    })
    .waitFor();
  assert.equal(placements[1].parentPlacementId, placements[5].id);
  Object.assign(placements[0], { width: 180, height: 120 });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".archive-card").length === 3,
  );
  const compactCore = page.getByRole("article", {
    name: "Cidade de Valdoria",
    exact: true,
  });
  assert.ok(
    await compactCore.evaluate((el) => {
      const card = el.getBoundingClientRect();
      return [...el.querySelectorAll("footer > *")].every((item) => {
        const r = item.getBoundingClientRect();
        return r.left >= card.left && r.right <= card.right;
      });
    }),
    "Indicadores do núcleo mínimo não saem da moldura",
  );
  await page.screenshot({
    path: path.join(temp, "expansao-nucleo-compacto.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  console.log(
    "Expansão local: zero HTTP/escritas/câmera; estrutura, radial, reload e atualização externa conferidos.",
  );
  // Quadro isolado com todas as artes, tamanhos livres e títulos extensos.
  const categories = [
    ["region", "regiao"],
    ["locality", "localidade"],
    ["dungeon", "masmorra"],
    ["room", "sala"],
    ["npc", "npc"],
    ["creature", "criatura"],
    ["item", "item"],
    ["faction", "faccao"],
    ["event", "acontecimento"],
    ["scene", "cena"],
    ["encounter", "encontro"],
    ["trap", "armadilha"],
    ["clue", "pista"],
    ["sound", "efeito-sonoro"],
    ["image", "imagem"],
    ["note", "anotacao"],
  ];
  populate(16);
  links.length = 0;
  categories.forEach(([category], i) => {
    cards[i].category = category;
    cards[i].title =
      i % 3 === 0
        ? `Título extenso de exemplo para ${category}`
        : `Card ${category}`;
    placements[i].x = 70 + (i % 4) * 350;
    placements[i].y = 90 + Math.floor(i / 4) * 235;
    placements[i].width = i % 3 === 0 ? 200 : i % 3 === 1 ? 280 : 330;
    placements[i].height = i % 3 === 0 ? 140 : 210;
  });
  const beforeIcons = operations;
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".archive-category-icon").length === 16 &&
      [...document.querySelectorAll(".archive-category-icon")].every(
        (i) => i.complete && i.naturalWidth === 256,
      ),
  );
  for (const [category, filename] of categories) {
    const image = page.locator(
      `[data-category="${category}"] .archive-category-icon`,
    );
    assert.ok((await image.getAttribute("src")).endsWith(`/${filename}.png`));
    const geometry = await image.evaluate(async (el) => {
      const card = el.closest(".archive-card");
      for (const source of [
        getComputedStyle(card.querySelector("header"), "::before")
          .backgroundImage,
        getComputedStyle(card.querySelector("header"), "::after")
          .backgroundImage,
      ]) {
        for (const match of source.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          const decoration = new Image();
          decoration.src = match[1];
          await decoration.decode();
        }
      }
      const style = getComputedStyle(el),
        canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(el, 0, 0);
      const pixels = ctx.getImageData(0, 0, 256, 256).data;
      let transparent = 0,
        visible = 0;
      for (let i = 3; i < pixels.length; i += 4) {
        if (!pixels[i]) transparent++;
        if (pixels[i] > 200) visible++;
      }
      const span = el.nextElementSibling.getBoundingClientRect(),
        rect = el.getBoundingClientRect();
      return {
        width: style.width,
        height: style.height,
        fit: style.objectFit,
        pointer: style.pointerEvents,
        overlap: rect.right > span.left,
        transparent,
        visible,
      };
    });
    assert.equal(geometry.width, geometry.height);
    assert.ok(["36px", "44px"].includes(geometry.width));
    assert.equal(geometry.fit, "contain");
    assert.equal(geometry.pointer, "none");
    assert.equal(geometry.overlap, false);
    assert.ok(geometry.transparent > 0 && geometry.visible > 0);
  }
  await page.getByRole("button", { name: "Afastar", exact: true }).click();
  await page.screenshot({
    path: path.join(temp, "icones-16-categorias.png"),
    fullPage: true,
  });
  const headerGroup = await page.locator(".archive-card").first().boundingBox();
  await page.screenshot({
    path: path.join(temp, "icones-cabecalhos.png"),
    clip: {
      x: Math.max(0, headerGroup.x - 10),
      y: Math.max(0, headerGroup.y - 10),
      width: Math.min(1100, 1440 - Math.max(0, headerGroup.x - 10)),
      height: 210,
    },
  });
  await page
    .locator('.archive-card[data-category="region"] .archive-card-copy')
    .click();
  await page.screenshot({
    path: path.join(temp, "icones-selecionado-e-tamanhos.png"),
    fullPage: true,
  });
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Afastar", exact: true }).click();
  await page.screenshot({
    path: path.join(temp, "icones-zoom-afastado.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enquadrar", exact: true }).click();
  // Aproximação usa a mesma transformação da câmera para card e PNG.
  const cardBounds = await page
    .locator('.archive-card[data-category="npc"]')
    .boundingBox();
  await page.mouse.move(cardBounds.x + cardBounds.width / 2, cardBounds.y + 40);
  await page.mouse.wheel(0, -340);
  await page.waitForTimeout(150);
  await page.screenshot({
    path: path.join(temp, "icones-aproximacao.png"),
    fullPage: true,
  });
  assert.equal(
    operations,
    beforeIcons,
    "Inspeção visual e zoom não escrevem na API",
  );
  console.log(
    "16 categorias: PNG correto, transparência, proporções, títulos e zoom conferidos.",
  );
  // Moldura e faixas: cantos fixos, suporte proporcional e assets realmente carregados.
  populate(2);
  cards[0].category = "faction";
  cards[0].title = "Gangue do Pé Sujo";
  cards[1].category = "encounter";
  cards[1].title = "Emboscada na estrada";
  placements[0] = { ...placements[0], x: 80, y: 170, width: 360, height: 250 };
  placements[1] = { ...placements[1], x: 960, y: 360, width: 360, height: 250 };
  links[0].label = "Está relacionado a";
  links.push({
    ...links[0],
    id: randomUUID(),
    label: "Controla os caminhos secretos e os acessos à fortaleza",
    relation: "custom",
  });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".archive-relation-text").length === 2,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);
  for (const relation of await page.locator(".archive-relation-label").all()) {
    assert.ok(
      await relation.evaluate((el) => {
        const text = el.querySelector("text"),
          hit = el.querySelector("rect");
        return (
          Number(hit.getAttribute("width")) >= text.getComputedTextLength() + 30
        );
      }),
      "Relações personalizadas não devem ser cortadas",
    );
  }
  const appearance = await page
    .locator(".archive-card")
    .first()
    .evaluate(async (el) => {
      const sources = [
        getComputedStyle(el, "::after").borderImageSource,
        getComputedStyle(el, "::before").backgroundImage,
        getComputedStyle(el.querySelector("header"), "::before")
          .backgroundImage,
        getComputedStyle(el.querySelector("header"), "::after").backgroundImage,
        getComputedStyle(el.querySelector("footer"), "::before")
          .backgroundImage,
      ];
      for (const source of sources) {
        for (const match of source.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          const image = new Image();
          image.src = match[1];
          await image.decode();
        }
      }
      const frame = getComputedStyle(el, "::after");
      return {
        slice: frame.borderImageSlice,
        width: frame.borderImageWidth,
        pointer: frame.pointerEvents,
      };
    });
  assert.equal(appearance.slice, "56");
  assert.equal(appearance.width, "28px");
  assert.equal(appearance.pointer, "none");
  await page.screenshot({
    path: path.join(temp, "componentes-faccao-encontro-conexoes.png"),
    fullPage: true,
  });
  await page
    .locator('.archive-card[data-category="faction"] .archive-card-copy')
    .click();
  await page.screenshot({
    path: path.join(temp, "componentes-selecionado.png"),
    fullPage: true,
  });
  const faction = page.locator('.archive-card[data-category="faction"]');
  await faction.screenshot({
    path: path.join(temp, "componentes-detalhe.png"),
  });
  await faction
    .getByRole("button", { name: "Ações de Gangue do Pé Sujo" })
    .click();
  await page.getByRole("menu").waitFor();
  await page.screenshot({
    path: path.join(temp, "componentes-menu-radial.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Afastar", exact: true }).click();
  await page.screenshot({
    path: path.join(temp, "componentes-conexoes-afastado.png"),
    fullPage: true,
  });
  // Fallback usa peças comuns e ícone de anotação, sem inventar nova categoria.
  cards[0].category = "categoria-sem-asset";
  await page.reload();
  const fallback = page.locator('[data-category="categoria-sem-asset"]');
  await fallback.waitFor();
  assert.ok(
    (await fallback.locator("img").getAttribute("src")).endsWith(
      "/anotacao.png",
    ),
  );
  assert.ok(
    await fallback.evaluate((el) =>
      getComputedStyle(el)
        .getPropertyValue("--archive-header-left")
        .includes("/comuns/"),
    ),
  );
  populate(5);
  links.length = 0;
  const sizes = [
    [180, 120],
    [440, 180],
    [220, 420],
    [520, 200],
    [360, 300],
  ];
  sizes.forEach(([width, height], i) => {
    cards[i].category = categories[i][0];
    Object.assign(placements[i], {
      x: [60, 320, 850, 70, 400][i],
      y: [120, 120, 120, 400, 400][i],
      width,
      height,
    });
  });
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll(".archive-card").length === 5,
  );
  const dimensions = await page
    .locator(".archive-card")
    .evaluateAll((els) => els.map((el) => [el.offsetWidth, el.offsetHeight]));
  assert.deepEqual(
    dimensions,
    sizes,
    "A composição não altera as dimensões persistidas",
  );
  await page.screenshot({
    path: path.join(temp, "componentes-proporcoes-livres.png"),
    fullPage: true,
  });
  const metrics = [];
  for (const count of [50, 100, 200, 500]) {
    populate(count);
    const start = Date.now();
    await page.reload();
    await page.waitForFunction(
      (n) => document.querySelectorAll(".archive-card").length === n,
      count,
    );
    const rendered = Date.now() - start;
    const callsBeforeCamera = await page.evaluate(
      () => window.__archiveLayoutCalls ?? 0,
    );
    const times = await page.evaluate(async () => {
      const result = [];
      let last = performance.now();
      for (let i = 0; i < 12; i++) {
        const viewport = document.querySelector(".archive-viewport");
        const box = viewport.getBoundingClientRect();
        viewport.dispatchEvent(
          new WheelEvent("wheel", {
            deltaY: i % 2 ? 3 : -3,
            clientX: box.left + box.width / 2,
            clientY: box.top + box.height / 2,
            bubbles: true,
            cancelable: true,
          }),
        );
        await new Promise((r) =>
          requestAnimationFrame((t) => {
            result.push(t - last);
            last = t;
            r();
          }),
        );
      }
      return result;
    });
    await page.waitForLoadState("networkidle");
    const loadedAssets = assetRequests.length;
    const ops = operations;
    await page.mouse.move(viewport.x + 20, viewport.y + 20);
    await page.mouse.wheel(0, -60);
    await page.waitForTimeout(100);
    assert.equal(operations, ops);
    assert.equal(
      assetRequests.length,
      loadedAssets,
      "Zoom não requisita novas texturas",
    );
    assert.equal(
      await page.evaluate(() => window.__archiveLayoutCalls ?? 0),
      callsBeforeCamera,
      "Pan e zoom não recalculam o layout",
    );
    const cycles = [];
    for (let sample = 0; sample < 3; sample++) {
      const cycleOps = operations;
      const gestureStart = Date.now();
      await page.mouse.move(viewport.x + 20, viewport.y + 150);
      await page.mouse.down();
      await page.mouse.move(viewport.x + 50, viewport.y + 170, { steps: 4 });
      await page.mouse.up();
      assert.equal(operations, cycleOps, "Pan não grava estado narrativo");
      const callsBeforeDrag = await page.evaluate(
        () => window.__archiveLayoutCalls ?? 0,
      );
      const movedIndex = Math.floor(count / 2);
      const moved = page.locator(".archive-card").nth(movedIndex);
      const movedHeader = await moved.locator("header").boundingBox();
      const priorPath = await page
        .locator(".archive-link")
        .nth(Math.max(0, movedIndex - 1))
        .getAttribute("d");
      await page.mouse.move(
        movedHeader.x + movedHeader.width / 2,
        movedHeader.y + movedHeader.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        movedHeader.x + movedHeader.width / 2 + 15,
        movedHeader.y + movedHeader.height / 2 + 10,
        { steps: 5 },
      );
      assert.equal(
        await page.evaluate(() => window.__archiveLayoutCalls ?? 0),
        callsBeforeDrag,
        "Arraste não recalcula por frame",
      );
      await page.mouse.up();
      await page.waitForFunction(
        () => document.querySelector(".archive-save")?.textContent === "Salvo",
      );
      assert.equal(
        operations,
        cycleOps + 1,
        "Arraste extenso salva uma única operação",
      );
      assert.notEqual(
        await page
          .locator(".archive-link")
          .nth(Math.max(0, movedIndex - 1))
          .getAttribute("d"),
        priorPath,
      );
      const callsBeforeResize = await page.evaluate(
        () => window.__archiveLayoutCalls ?? 0,
      );
      const handle = await moved.locator(".edge-se").boundingBox();
      await page.mouse.move(
        handle.x + handle.width / 2,
        handle.y + handle.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        handle.x + handle.width / 2 + 8,
        handle.y + handle.height / 2 + 6,
        { steps: 4 },
      );
      assert.equal(
        await page.evaluate(() => window.__archiveLayoutCalls ?? 0),
        callsBeforeResize,
        "Resize não recalcula por frame",
      );
      await page.mouse.up();
      await page.waitForFunction(
        () => document.querySelector(".archive-save")?.textContent === "Salvo",
      );
      assert.equal(
        operations,
        cycleOps + 2,
        "Resize extenso salva uma única operação",
      );
      assert.equal(
        assetRequests.length,
        loadedAssets,
        "Pan, arraste e resize reutilizam texturas carregadas",
      );
      cycles.push(Date.now() - gestureStart);
    }
    const gesturesMs = [...cycles].sort((a, b) => a - b)[1];
    metrics.push({
      cards: count,
      lines: count - 1,
      renderMs: rendered,
      gesturesMs,
      cycles,
      maxFrameMs: Math.round(Math.max(...times) * 10) / 10,
    });
  }
  await page.screenshot({
    path: path.join(temp, "arquivo-200-cards.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.ok(
    await page.locator(".archive-dock").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    }),
  );
  await page.screenshot({
    path: path.join(temp, "arquivo-mobile.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Browser real: pan, zoom, arraste, resize, falha/retry, conexão/cancelamento/seleção, criação, reload e celular passaram.",
  );
  console.log("Amostra local (API simulada):", JSON.stringify(metrics));
  console.log("Captura:", path.join(temp, "arquivo-200-cards.png"));
} catch (error) {
  console.log("Diálogo:", await page.locator("dialog").allTextContents());
  await page.screenshot({ path: path.join(temp, "falha.png"), fullPage: true });
  console.log("Captura da falha:", path.join(temp, "falha.png"));
  throw error;
} finally {
  await browser.close();
}
