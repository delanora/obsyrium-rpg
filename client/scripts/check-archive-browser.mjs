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
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{ArchivePage}from'${root}/client/src/components/archive/ArchivePage';createRoot(document.getElementById('root')).render(<ArchivePage/>);`,
    resolveDir: path.join(root, "client"),
    loader: "tsx",
  },
  bundle: true,
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
let operations = 0,
  failNext = false;
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
page.on("pageerror", (e) => errors.push(e.message));
await page.route("http://arquivo.test/**", async (route) => {
  const url = new URL(route.request().url()),
    p = url.pathname;
  if (p.startsWith("/api/archive")) {
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
      } else if (i.action === "placement.update") {
        Object.assign(
          placements.find((p) => p.id === i.placementId),
          i.geometry,
        );
        board.version++;
      } else if (i.action === "link.create")
        links.push({ ...i, id, version: 0 });
      return route.fulfill({ json: { id, version: board?.version ?? 0 } });
    }
    if (p === "/api/archive/boards") return route.fulfill({ json: { boards } });
    if (p === "/api/archive/cards") return route.fulfill({ json: { cards } });
    if (p.startsWith("/api/archive/boards/"))
      return route.fulfill({ json: graph(p.split("/").pop()) });
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
    body: '<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><style>body{margin:0;padding:14px}</style><div id="root"></div><script src="/app.js"></script></html>',
  });
});
try {
  await page.goto("http://arquivo.test");
  await page.locator(".archive-card").nth(1).waitFor();
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
  await page.mouse.up();
  await page.waitForResponse((r) => r.url().endsWith("/operations"));
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
  await page.getByRole("button", { name: "Editar relação" }).waitFor();
  assert.equal(links.length, 1);
  await page.getByRole("button", { name: "Enquadrar", exact: true }).click();
  await page.screenshot({
    path: path.join(temp, "arquivo-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Novo card", exact: true }).click();
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
  const metrics = [];
  for (const count of [50, 100, 200]) {
    populate(count);
    const start = Date.now();
    await page.reload();
    await page.waitForFunction(
      (n) => document.querySelectorAll(".archive-card").length === n,
      count,
    );
    const rendered = Date.now() - start;
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
    const ops = operations;
    await page.mouse.move(viewport.x + 20, viewport.y + 20);
    await page.mouse.wheel(0, -60);
    await page.waitForTimeout(100);
    assert.equal(operations, ops);
    metrics.push({
      cards: count,
      lines: count - 1,
      renderMs: rendered,
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
