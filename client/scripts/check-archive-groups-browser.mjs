/** Chromium real; API inteiramente simulada e fixtures próprias, sem campanha. */
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const root = process.cwd(),
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "arquivo-grupos-browser-"));
await build({
  stdin: {
    resolveDir: path.join(root, "client"),
    loader: "tsx",
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{ArchivePage}from'${root}/client/src/components/archive/ArchivePage';createRoot(document.getElementById('root')).render(<div className="app-shell theme-master"><header className="app-header" style={{height:48}}>Obsyrium</header><nav className="tabs master-navigation">Fichário</nav><main className="app-main app-main-wide"><ArchivePage/></main></div>);`,
  },
  bundle: true,
  jsx: "automatic",
  external: ["/archive/*", "/creation/*"],
  outfile: path.join(temp, "app.js"),
  plugins: [
    {
      name: "medicao-sem-alterar-producao",
      setup(b) {
        b.onLoad({ filter: /archiveLayout\.ts$/ }, (a) => ({
          loader: "ts",
          contents:
            fs
              .readFileSync(a.path, "utf8")
              .replace(
                "export function layoutArchive(",
                "function computeArchiveLayout(",
              ) +
            `export function layoutArchive(...args:Parameters<typeof computeArchiveLayout>){window.__layouts=(window.__layouts??0)+1;return computeArchiveLayout(...args);}`,
        }));
      },
    },
  ],
});
const id = (i) => `85300000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const group = (i, name) => ({
  id: id(i),
  name,
  color: i === 10 ? "#E4AC44" : "#739EC4",
  description: "Fixture",
  version: 0,
  cardCount: 0,
  createdById: "fixture",
  createdAt: "",
  updatedAt: "",
});
let groups = [
  group(10, "Missão Solar"),
  group(11, "Investigação"),
  group(12, "Sem cards"),
];
const boards = [
  {
    id: id(1),
    name: "Quadro Alfa",
    description: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: id(2),
    name: "Quadro Beta",
    description: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
];
const cards = Array.from({ length: 8 }, (_, i) => ({
  id: id(100 + i),
  title: i === 0 ? "Núcleo" : `Card ${i}`,
  category: "note",
  summary: "Resumo da fixture",
  content: "",
  version: 0,
  createdAt: "",
  updatedAt: "",
  groups:
    i === 2
      ? [groups[0], groups[1]]
      : i === 1 || i === 5
        ? [groups[0]]
        : i === 6
          ? [groups[1]]
          : [],
}));
const placements = cards.map((c, i) => ({
  id: id(200 + i),
  cardId: c.id,
  boardId: id(1),
  parentPlacementId: i > 0 && i < 4 ? id(200) : null,
  x: i < 4 ? 0 : (i - 4) * 360,
  y: i < 4 ? 0 : 500,
  width: 280,
  height: 200,
  zIndex: 0,
}));
placements.push({ ...placements[5], id: id(250), boardId: id(2) });
const links = [
  {
    id: id(300),
    sourceId: cards[5].id,
    targetId: cards[6].id,
    relation: "related",
    label: "Relação",
    description: "",
    directed: true,
    version: 0,
  },
];
const graph = (boardId) => ({
  board: boards.find((b) => b.id === boardId),
  groups,
  placements: placements
    .filter((p) => p.boardId === boardId)
    .map((p) => ({ ...p, card: cards.find((c) => c.id === p.cardId) })),
  links: boardId === id(1) ? links : [],
});
const requests = [],
  errors = [];
let fail = false,
  conflict = false,
  checks = 0,
  reads = 0;
const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  }),
  page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    reducedMotion: "reduce",
  });
page.on("pageerror", (e) => errors.push(e.message));
await page.route("http://grupos.test/**", async (route) => {
  const req = route.request(),
    p = new URL(req.url()).pathname;
  if (p.startsWith("/api/")) {
    if (req.method() === "GET") reads++;
    if (p === "/api/archive/boards") return route.fulfill({ json: { boards } });
    if (p === "/api/archive/groups") return route.fulfill({ json: { groups } });
    if (p === "/api/archive/cards") return route.fulfill({ json: { cards } });
    if (p.startsWith("/api/archive/boards/"))
      return route.fulfill({ json: graph(p.split("/").pop()) });
    if (p.endsWith("/operations")) {
      const input = req.postDataJSON();
      requests.push(input);
      if (fail) {
        fail = false;
        return route.fulfill({
          status: 503,
          json: { message: "Falha simulada" },
        });
      }
      if (conflict) {
        conflict = false;
        return route.fulfill({
          status: 409,
          json: { message: "Versão alterada em outra janela" },
        });
      }
      let changed = id(90);
      if (input.action === "group.create") {
        changed = id(90 + groups.length);
        groups.push({
          ...group(90 + groups.length, input.name),
          color: input.color,
          description: input.description,
        });
      } else if (input.action === "group.update") {
        changed = input.groupId;
        const g = groups.find((g) => g.id === changed);
        Object.assign(g, {
          name: input.name,
          color: input.color,
          description: input.description,
          version: g.version + 1,
        });
        for (const c of cards)
          c.groups = c.groups.map((x) => (x.id === changed ? g : x));
      } else if (input.action === "group.delete") {
        changed = input.groupId;
        groups = groups.filter((g) => g.id !== changed);
        for (const c of cards)
          c.groups = c.groups.filter((g) => g.id !== changed);
      } else if (input.action === "card.update") {
        changed = input.cardId;
        const c = cards.find((c) => c.id === changed);
        Object.assign(c, {
          title: input.title,
          category: input.category,
          summary: input.summary,
          content: input.content,
          groups: groups.filter((g) => input.groupIds.includes(g.id)),
          version: c.version + 1,
        });
      } else throw new Error("Operação não prevista: " + input.action);
      for (const g of groups)
        g.cardCount = cards.filter((c) =>
          c.groups.some((x) => x.id === g.id),
        ).length;
      return route.fulfill({ json: { id: changed, version: 1 } });
    }
    return route.fulfill({
      status: 404,
      json: { message: "Não existe na fixture" },
    });
  }
  const file =
    p === "/app.js" || p === "/app.css"
      ? path.join(temp, p)
      : p === "/style.css"
        ? path.join(root, "client/src/styles.css")
        : path.join(root, "client/public", p);
  if (fs.existsSync(file) && fs.statSync(file).isFile())
    return route.fulfill({ path: file });
  return route.fulfill({
    contentType: "text/html",
    body: '<html data-theme="dark"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>',
  });
});
const card = (i) => page.locator(`[data-placement="${id(200 + i)}"]`);
const filters = () =>
  page.getByRole("region", { name: "Filtros de agrupamentos" });
const openFilters = async () => {
  if (!(await filters().isVisible()))
    await page.getByRole("button", { name: /^Filtros/ }).click();
};
const closeFilters = async () => {
  if (await filters().isVisible())
    await page.getByRole("button", { name: /^Filtros/ }).click();
};
const snapshot = () =>
  page
    .locator("[data-placement]")
    .evaluateAll((els) =>
      Object.fromEntries(
        els.map((el) => [
          el.dataset.placement,
          [
            el.style.left,
            el.style.top,
            el.style.width,
            el.style.height,
            el.style.transform,
          ],
        ]),
      ),
    );
const wait = () => page.waitForTimeout(60);
const check = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks++;
};
try {
  await page.goto("http://grupos.test/");
  await card(0).waitFor();
  await wait();
  const geometry = await snapshot(),
    layoutCount = await page.evaluate(() => window.__layouts),
    http = reads;
  await openFilters();
  await filters()
    .getByRole("checkbox", { name: "Missão Solar", exact: true })
    .check();
  await wait();
  check(
    await filters().getByRole("status").textContent(),
    "3 cards correspondentes neste quadro · 1 visíveis · 2 recolhidos",
    "Contagem canônica recolhida",
  );
  check(await card(5).getAttribute("data-filter"), "match");
  check(await card(6).getAttribute("data-filter"), "dim");
  check(
    await card(0)
      .textContent()
      .then((t) => t.includes("2 recolhidos")),
    true,
  );
  await filters().getByLabel("Combinação dos filtros").selectOption("all");
  await filters()
    .getByRole("checkbox", { name: "Investigação", exact: true })
    .check();
  await wait();
  check(
    await filters().getByRole("status").textContent(),
    "1 cards correspondentes neste quadro · 0 visíveis · 1 recolhidos",
  );
  await filters().getByLabel("Modo do filtro").selectOption("isolate");
  await wait();
  check(await card(0).getAttribute("data-filter"), "context");
  check(await card(5).isVisible(), false);
  check(await card(5).getAttribute("tabindex"), "-1");
  check(await page.locator('[data-filter-hidden="true"]').count(), 1);
  await filters().getByRole("button", { name: "Limpar filtros" }).click();
  await wait();
  check(await card(5).isVisible(), true);
  // Ciclos de ida e volta: nada grava nem recalcula o layout.
  for (let i = 0; i < 100; i++) {
    await filters()
      .getByRole("checkbox", { name: "Missão Solar", exact: true })
      .check();
    await filters()
      .getByLabel("Modo do filtro")
      .selectOption(i % 2 ? "isolate" : "highlight");
    await filters().getByRole("button", { name: "Limpar filtros" }).click();
  }
  await wait();
  check(await snapshot(), geometry, "100 ciclos sem drift");
  check(reads, http, "Sem GET por filtro");
  check(requests.length, 0, "Sem escrita por filtro");
  check(
    await page.evaluate(() => window.__layouts),
    layoutCount,
    "Sem recálculo geométrico",
  );
  // Independente por quadro, restaurado ao retornar e reinicializado ao reload.
  await filters()
    .getByRole("checkbox", { name: "Missão Solar", exact: true })
    .check();
  await closeFilters();
  await page
    .getByLabel("Quadro narrativo", { exact: true })
    .selectOption(id(2));
  await card(5).waitFor({ state: "detached" });
  await openFilters();
  check(
    await filters()
      .getByRole("checkbox", { name: "Missão Solar", exact: true })
      .isChecked(),
    false,
  );
  await page
    .getByLabel("Quadro narrativo", { exact: true })
    .selectOption(id(1));
  await card(0).waitFor();
  check(
    await filters()
      .getByRole("checkbox", { name: "Missão Solar", exact: true })
      .isChecked(),
    true,
  );
  await page.reload();
  await card(0).waitFor();
  await openFilters();
  check(
    await filters()
      .getByRole("checkbox", { name: "Missão Solar", exact: true })
      .isChecked(),
    false,
  );
  await closeFilters();
  // Consulta ativa filtro; edição mantém rascunho e não grava antes de salvar.
  await card(5).dblclick();
  const reader = page.locator(".archive-reader");
  await reader.waitFor();
  await reader
    .getByRole("button", { name: "Missão Solar", exact: true })
    .click();
  await openFilters();
  check(
    await filters()
      .getByRole("checkbox", { name: "Missão Solar", exact: true })
      .isChecked(),
    true,
  );
  await filters().getByRole("button", { name: "Limpar filtros" }).click();
  await closeFilters();
  await reader
    .getByRole("button", { name: "Editar card", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Card narrativo",
    exact: true,
  });
  await editor.waitFor();
  const before = requests.length;
  await editor
    .getByRole("checkbox", { name: "Investigação", exact: true })
    .check();
  await wait();
  check(requests.length, before);
  check(
    await card(5)
      .textContent()
      .then((t) => t.includes("2 grupos")),
    true,
  );
  await editor.getByRole("button", { name: "Fechar editor" }).click();
  check(cards[5].groups.length, 1, "Cancelar não associa");
  await reader
    .getByRole("button", { name: "Editar card", exact: true })
    .click();
  await editor
    .getByRole("checkbox", { name: "Investigação", exact: true })
    .check();
  await editor.getByRole("button", { name: "Salvar", exact: true }).click();
  await editor.waitFor({ state: "detached" });
  check(cards[5].groups.length, 2, "Salvar associa");
  await reader.getByRole("button", { name: "Fechar consulta" }).click();
  // Seleção/foco ocultos são reconciliados sem mover a câmera.
  await card(6).click();
  check(
    await card(6).evaluate((el) => el.classList.contains("is-selected")),
    true,
  );
  await openFilters();
  await filters().getByLabel("Modo do filtro").selectOption("isolate");
  await card(6).evaluate((el) => el.focus());
  await filters()
    .getByRole("checkbox", { name: "Missão Solar", exact: true })
    .evaluate((el) => el.click());
  await wait();
  check(await card(6).isVisible(), false);
  check(
    await card(6).evaluate((el) => el.classList.contains("is-selected")),
    false,
  );
  check(
    await page.evaluate(() =>
      document.activeElement?.classList.contains("archive-viewport"),
    ),
    true,
  );
  // Invalidação privada atualiza metadados e remove filtros excluídos.
  groups[0].name = "Missão renomeada";
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await filters()
    .getByRole("checkbox", { name: "Missão renomeada", exact: true })
    .waitFor();
  check(
    await filters()
      .getByRole("checkbox", { name: "Missão renomeada", exact: true })
      .isChecked(),
    true,
  );
  const originalGroup = groups[0];
  groups = groups.filter((g) => g.id !== originalGroup.id);
  for (const c of cards)
    c.groups = c.groups.filter((g) => g.id !== originalGroup.id);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await filters().getByText("Sem filtros ativos.", { exact: true }).waitFor();
  check(await card(6).isVisible(), true);
  // Repor somente a fixture para os cenários seguintes.
  originalGroup.name = "Missão Solar";
  groups.unshift(originalGroup);
  for (const i of [1, 2, 5]) cards[i].groups.unshift(originalGroup);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await filters()
    .getByRole("checkbox", { name: "Missão Solar", exact: true })
    .waitFor();
  await closeFilters();
  // Biblioteca: criação, falha/retry com a mesma chave, edição e exclusão explícita.
  await page.getByRole("button", { name: "Agrupamentos", exact: true }).click();
  const manager = page.getByRole("dialog", {
    name: "Agrupamentos narrativos",
    exact: true,
  });
  await manager.waitFor();
  await manager
    .getByLabel("Nome do agrupamento", { exact: true })
    .fill("Missão de teste");
  await manager
    .getByLabel("Descrição do agrupamento")
    .fill("Sem vínculos estruturais");
  fail = true;
  await manager
    .getByRole("button", { name: "Criar agrupamento", exact: true })
    .click();
  await manager.getByRole("alert").waitFor();
  const retryId = requests.at(-1).operationId;
  await manager.getByRole("button", { name: "Tentar novamente" }).click();
  await manager
    .getByRole("button", { name: "Editar Missão de teste", exact: true })
    .waitFor();
  check(requests.at(-1).operationId, retryId);
  await manager
    .getByRole("button", { name: "Editar Missão de teste", exact: true })
    .click();
  await manager
    .getByLabel("Nome do agrupamento", { exact: true })
    .fill("Missão revisada");
  conflict = true;
  await manager
    .getByRole("button", { name: "Salvar agrupamento", exact: true })
    .click();
  await manager.getByRole("alert").waitFor();
  check(
    await manager.getByRole("alert").textContent(),
    "Versão alterada em outra janela",
  );
  await manager
    .getByRole("button", { name: "Descartar pedido e recarregar" })
    .click();
  await manager
    .getByRole("button", { name: "Editar Missão de teste", exact: true })
    .click();
  await manager
    .getByLabel("Nome do agrupamento", { exact: true })
    .fill("Missão revisada");
  await manager
    .getByRole("button", { name: "Salvar agrupamento", exact: true })
    .click();
  await manager
    .getByRole("button", { name: "Excluir Missão revisada", exact: true })
    .waitFor();
  await manager
    .getByRole("button", { name: "Excluir Missão revisada", exact: true })
    .click();
  await manager.getByRole("button", { name: "Cancelar exclusão" }).click();
  check(
    groups.some((g) => g.name === "Missão revisada"),
    true,
  );
  await manager
    .getByRole("button", { name: "Excluir Missão revisada", exact: true })
    .click();
  await manager
    .getByRole("button", { name: "Confirmar exclusão", exact: true })
    .click();
  await manager
    .getByRole("button", { name: "Excluir Missão revisada", exact: true })
    .waitFor({ state: "detached" });
  check(
    groups.some((g) => g.name === "Missão revisada"),
    false,
  );
  await manager.getByRole("button", { name: "Fechar agrupamentos" }).click();
  // Filtro durante expansão; o scheduler mantém o controle da opacidade.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page
    .getByRole("button", {
      name: "Expandir ramificações de Núcleo",
      exact: true,
    })
    .click();
  await openFilters();
  await filters()
    .getByRole("checkbox", { name: "Investigação", exact: true })
    .check();
  await wait();
  await filters().getByLabel("Modo do filtro").selectOption("isolate");
  await page.waitForTimeout(900);
  check(await card(2).isVisible(), true);
  check(await card(4).isVisible(), false);
  check(await card(2).evaluate((el) => Number(el.style.opacity)), 1);
  await filters().getByRole("button", { name: "Limpar filtros" }).click();
  await closeFilters();
  await page.screenshot({
    path: path.join(temp, "desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openFilters();
  const box = await filters().boundingBox();
  check(box.x >= 0 && box.x + box.width <= 390, true, "Filtro em celular");
  await page.screenshot({
    path: path.join(temp, "mobile.png"),
    fullPage: true,
  });
  await page.keyboard.press("Tab");
  check(
    await page.evaluate(() => document.activeElement?.tagName !== "BODY"),
    true,
    "Navegação por teclado",
  );
  check(errors, []);
  console.log(
    `Agrupamentos Chromium: ${checks} verificações + 100 ciclos; API simulada, sem campanha. Evidências: ${temp}`,
  );
} catch (e) {
  await page.screenshot({ path: path.join(temp, "falha.png"), fullPage: true });
  console.log("Evidências:", temp);
  throw e;
} finally {
  await browser.close();
}
