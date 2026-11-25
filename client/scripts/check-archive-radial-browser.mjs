/** Chromium real, API em memória: nenhuma chamada à campanha ou ao banco. */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const root = process.cwd(),
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "arquivo-radial-browser-"));
await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{ArchivePage}from'${root}/client/src/components/archive/ArchivePage';createRoot(document.getElementById('root')).render(<div className="app-shell theme-master"><header className="app-header" style={{height:48}}>Obsyrium</header><nav className="tabs tabs-inline master-navigation"><button className="tab">Início</button><button className="tab">Fichário</button></nav><main className="app-main app-main-wide"><ArchivePage/></main></div>);`,
    loader: "tsx",
    resolveDir: path.join(root, "client"),
  },
  bundle: true,
  jsx: "automatic",
  outfile: path.join(temp, "app.js"),
  external: ["/archive/*", "/creation/*"],
  plugins: [
    {
      name: "medicao-isolada",
      setup(b) {
        b.onLoad({ filter: /useArchiveMotion\.ts$/ }, (a) => ({
          loader: "ts",
          contents: fs
            .readFileSync(a.path, "utf8")
            .replace(
              /\n    };\n    (?=const mounted|r.retained)/,
              "\n      window.__probeArchivePaint?.({poses:r.poses,visual:latest.current.visual,layout:latest.current.layout});\n    };\n    ",
            ),
        }));
        b.onLoad({ filter: /archiveLayout\.ts$/ }, (a) => ({
          loader: "ts",
          contents:
            fs
              .readFileSync(a.path, "utf8")
              .replace(
                "export function layoutArchive(",
                "function computeArchiveLayout(",
              ) +
            `export function layoutArchive(...args:Parameters<typeof computeArchiveLayout>){const t=performance.now();window.__calls=(window.__calls??0)+1;const r=computeArchiveLayout(...args);(window.__times??=[]).push(performance.now()-t);return r;}`,
        }));
      },
    },
  ],
});
const uuid = (i) => `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const names = [
  "Templo Serpentino",
  "Entrada da Caverna",
  "Salão das Estátuas",
  "Câmara Ritual",
  "Armadilha de Dardos",
  "Guardião",
  "Tesouro Oculto",
  "Cidade de Valdoria",
  "Mercador",
  "Floresta",
  "Acontecimento narrativo",
  "Facção local",
  "Agente da facção",
  "Refúgio da facção",
  "Distante A",
  "Distante B",
  "Distante C",
  "Vizinho em cadeia",
];
const positions = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
  [460, 0],
  [140, 450],
  [-460, 0],
  [150, -450],
  [430, 400],
  [430, 400],
  [430, 400],
  [6000, 3500],
  [6200, 3700],
  [-6000, -4000],
  [780, 0],
];
const sizes = [
  [300, 230],
  [280, 200],
  [360, 180],
  [220, 360],
  [280, 200],
  [300, 240],
  [420, 200],
];
const cards = names.map((title, i) => ({
  id: uuid(100 + i),
  title,
  category:
    [
      "dungeon",
      "room",
      "room",
      "room",
      "trap",
      "creature",
      "item",
      "locality",
      "npc",
      "region",
      "event",
      "faction",
    ][i] ?? "note",
  summary: "Referência narrativa de demonstração",
  content: "",
  version: 0,
  createdAt: "",
  updatedAt: "",
}));
const placements = cards.map((c, i) => ({
  id: uuid(200 + i),
  boardId: uuid(1),
  cardId: c.id,
  parentPlacementId:
    i > 0 && i < 7 ? uuid(200) : i === 12 || i === 13 ? uuid(211) : null,
  x: positions[i][0],
  y: positions[i][1],
  width: (sizes[i] ?? [300, 230])[0],
  height: (sizes[i] ?? [300, 230])[1],
  zIndex: 0,
}));
const links = [
  [0, 1],
  [0, 2],
  [1, 7],
  [2, 8],
  [0, 14],
  [11, 12],
  [11, 13],
].map(([a, b], i) => ({
  id: uuid(300 + i),
  sourceId: cards[a].id,
  targetId: cards[b].id,
  relation: "related",
  label: "",
  description: "",
  directed: i % 2 === 0,
  version: 0,
}));
const boards = [
  {
    id: uuid(1),
    name: "Templo e obstáculos",
    description: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: uuid(2),
    name: "Outro quadro",
    description: "",
    version: 0,
    createdAt: "",
    updatedAt: "",
  },
];
const original = JSON.stringify({ placements, links }),
  receipts = new Map(),
  requests = [];
let reads = 0,
  failNext = false,
  conflictNext = false;
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
const context = await browser.newContext({
  viewport: { width: 2200, height: 1400 },
  reducedMotion: "reduce",
  recordVideo: { dir: temp, size: { width: 1280, height: 814 } },
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let archivedPaints = 0;
const archivedDiscontinuities = [];
const originalReload = page.reload.bind(page);
page.reload = async (options) => {
  if (process.env.ARCHIVE_STABILITY_EVIDENCE) {
    const p = await page.evaluate(() => ({
      paints: window.__archivePaints ?? 0,
      failures: window.__archiveDiscontinuities ?? [],
    }));
    archivedPaints += p.paints;
    archivedDiscontinuities.push(...p.failures);
    assert.deepEqual(p.failures, [], "Continuidade antes do reload");
  }
  return originalReload(options);
};

if (process.env.ARCHIVE_STABILITY_EVIDENCE)
  await page.addInitScript(() => {
    window.__archivePaints = 0;
    window.__archiveDiscontinuities = [];
    window.__probeArchivePaint = ({ poses, visual, layout }) => {
      window.__archivePaints++;
      for (const el of document.querySelectorAll("[data-placement]")) {
        const id = el.dataset.placement,
          p = visual[id] ?? poses.get(id);
        if (!p) {
          if (
            layout &&
            !layout.geometry.has(id) &&
            Number(el.style.opacity) > 0.001
          )
            window.__archiveDiscontinuities.push({
              id,
              kind: "exit-reappeared",
            });
          continue;
        }
        const m = new DOMMatrix(el.style.transform),
          x = parseFloat(el.style.left) + m.e,
          y = parseFloat(el.style.top) + m.f;
        if (
          Math.abs(x - p.x) > 0.02 ||
          Math.abs(y - p.y) > 0.02 ||
          Math.abs(Number(el.style.opacity) - (p.opacity ?? 1)) > 0.001
        )
          window.__archiveDiscontinuities.push({
            id,
            kind: "geometry",
            x,
            y,
            expected: p,
          });
      }
    };
  });
await page.route("http://radial.test/**", async (route) => {
  const url = new URL(route.request().url()),
    p = url.pathname;
  if (p.startsWith("/api/archive")) {
    if (route.request().method() === "GET") reads++;
    if (p === "/api/archive/boards") return route.fulfill({ json: { boards } });
    if (p === "/api/archive/cards") return route.fulfill({ json: { cards } });
    if (p.startsWith("/api/archive/boards/"))
      return route.fulfill({ json: graph(p.split("/").pop()) });
    if (p.endsWith("/operations")) {
      const input = route.request().postDataJSON();
      requests.push(input);
      if (failNext) {
        failNext = false;
        return route.fulfill({
          status: 503,
          json: { message: "Falha simulada" },
        });
      }
      if (conflictNext) {
        conflictNext = false;
        return route.fulfill({
          status: 409,
          json: { message: "Versão alterada em outra janela" },
        });
      }
      if (receipts.has(input.operationId))
        return route.fulfill({
          json: { ...receipts.get(input.operationId), replayed: true },
        });
      const board = boards.find((b) => b.id === (input.boardId ?? uuid(1)));
      let id = input.placementId ?? uuid(500 + requests.length);
      if (input.action === "placement.update") {
        Object.assign(
          placements.find((p) => p.id === id),
          input.geometry,
        );
        if (input.relative)
          Object.assign(
            placements.find((p) => p.id === id),
            {
              branchOffsetX: input.relative.x,
              branchOffsetY: input.relative.y,
            },
          );
        board.version++;
      } else if (input.action === "placement.reset") {
        for (const p of placements)
          if (input.children ? p.parentPlacementId === id : p.id === id) {
            p.branchOffsetX = null;
            p.branchOffsetY = null;
          }
        board.version++;
      } else if (input.action === "card.update") {
        id = input.cardId;
        Object.assign(
          cards.find((c) => c.id === id),
          {
            title: input.title,
            summary: input.summary,
            content: input.content,
            category: input.category,
          },
        );
        cards.find((c) => c.id === id).version++;
      } else if (input.action === "placement.parent") {
        placements.find((p) => p.id === id).parentPlacementId =
          input.parentPlacementId;
        Object.assign(
          placements.find((p) => p.id === id),
          { branchOffsetX: null, branchOffsetY: null },
        );
        board.version++;
      } else if (input.action === "card.create") {
        const c = {
          id: uuid(1000 + requests.length),
          title: input.title,
          category: input.category,
          summary: input.summary,
          content: input.content,
          version: 0,
          createdAt: "",
          updatedAt: "",
        };
        cards.push(c);
        placements.push({
          id,
          boardId: input.boardId,
          cardId: c.id,
          parentPlacementId: input.parentPlacementId ?? null,
          ...input.geometry,
        });
        board.version++;
      } else if (input.action === "link.create")
        links.push({ ...input, id, version: 0 });
      else throw new Error("Operação não simulada: " + input.action);
      const receipt = { id, version: board.version };
      receipts.set(input.operationId, receipt);
      return route.fulfill({ json: receipt });
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
    return route.fulfill({ path: file });
  return route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html data-theme="dark"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><style>body{margin:0;padding:0}</style><div id="root"></div><script src="/app.js"></script></html>',
  });
});
const world = () => page.locator(".archive-world").getAttribute("style");
const background = () =>
  page.locator(".archive-background pattern").getAttribute("patternTransform");
const state = () =>
  page.locator(".archive-card").evaluateAll((els) =>
    Object.fromEntries(
      els.map((el) => [
        el.dataset.placement,
        {
          x: parseFloat(el.style.left),
          y: parseFloat(el.style.top),
          width: parseFloat(el.style.width),
          height: parseFloat(el.style.height),
        },
      ]),
    ),
  );
const calls = () => page.evaluate(() => window.__calls ?? 0);
const settled = () =>
  page.waitForFunction(
    () => document.querySelector(".archive-save")?.textContent === "Salvo",
  );
const shot = (name) =>
  page.screenshot({ path: path.join(temp, name + ".png"), fullPage: true });
const toggle = (i, expanded) =>
  page
    .getByRole("button", {
      name: `${expanded ? "Recolher" : "Expandir"} ramificações de ${names[i]}`,
      exact: true,
    })
    .click();
const chooseRadial = async (name) => {
  const button = page.getByRole("menuitem", { name, exact: true });
  await button.waitFor();
  const point = await button.evaluate((el) => {
    const menu = el.closest('[role="menu"]'),
      box = menu.getBoundingClientRect();
    const buttons = [
      ...menu.querySelectorAll(".scene-editor-radial-sector button"),
    ];
    const angle =
      -Math.PI / 2 + (buttons.indexOf(el) * Math.PI * 2) / buttons.length;
    return {
      x: box.x + box.width / 2 + Math.cos(angle) * box.width * 0.35,
      y: box.y + box.height / 2 + Math.sin(angle) * box.height * 0.35,
    };
  });
  await page.mouse.click(point.x, point.y);
};
const assertEndpoints = async () =>
  assert.ok(
    await page.evaluate((pairs) => {
      // A CSSOM serializa px fracionários com precisão menor que os números do SVG.
      const edge = (r, x, y) =>
        ((Math.abs(x - r.x) < 0.01 || Math.abs(x - r.x - r.width) < 0.01) &&
          y >= r.y - 0.01 &&
          y <= r.y + r.height + 0.01) ||
        ((Math.abs(y - r.y) < 0.01 || Math.abs(y - r.y - r.height) < 0.01) &&
          x >= r.x - 0.01 &&
          x <= r.x + r.width + 0.01);
      for (const l of pairs) {
        const g = document.querySelector(`[data-link="${l.id}"]`);
        if (!g) continue;
        const find = (id) => {
          const el = document.querySelector(`[data-card="${id}"]`);
          return (
            el && {
              x: parseFloat(el.style.left),
              y: parseFloat(el.style.top),
              width: parseFloat(el.style.width),
              height: parseFloat(el.style.height),
            }
          );
        };
        const a = find(l.sourceId),
          b = find(l.targetId),
          n = g
            .querySelector(".archive-link")
            .getAttribute("d")
            .match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/g)
            .map(Number);
        if (!a || !b || !edge(a, n[0], n[1]) || !edge(b, n[4], n[5]))
          throw new Error(JSON.stringify({ id: l.id, a, b, n }));
      }
      return true;
    }, links),
    "Conexões devem usar as bordas visuais efetivas",
  );
const saveGesture = async (id, mode, dx, dy, expected = "ok") => {
  const raw = structuredClone(placements.find((p) => p.id === id)),
    others = JSON.stringify(placements.filter((p) => p.id !== id));
  const el = page.locator(`[data-placement="${id}"]`);
  const target =
    mode === "move" ? el.locator("header") : el.locator(".edge-se");
  // A reserva afasta vizinhos: aproximação anterior pode deixar a alça sob o dock.
  // Ajusta a câmera antes do gesto, sem enfraquecer suas verificações geométricas.
  for (let attempt = 0; attempt < 4; attempt++) {
    const b = await target.boundingBox(),
      dock = await page.locator(".archive-dock").boundingBox();
    if (
      b.x > 15 &&
      b.x + b.width < 2190 &&
      b.y > 130 &&
      b.y + b.height < (dock?.y ?? 1380) - 12
    )
      break;
    await page.mouse.move(30, 350);
    await page.mouse.wheel(0, 220);
    await page.waitForTimeout(100);
  }
  const before = await el.boundingBox(),
    box = await target.boundingBox();
  const start =
    mode === "move"
      ? { x: box.x + Math.min(40, box.width / 2), y: box.y + box.height / 2 }
      : { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const backgroundBeforeGesture = await background();
  const count = calls(),
    prior = await state(),
    op = requests.length,
    countBefore = await count;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
  assert.equal(
    await calls(),
    countBefore,
    "Gesto não executa layout por frame",
  );
  assert.equal(
    await background(),
    backgroundBeforeGesture,
    "Arraste/resize não move o fundo espacial",
  );
  const shown = await el.boundingBox();
  if (mode === "move") {
    assert.ok(Math.abs(shown.x - before.x - dx) < 1);
    assert.ok(Math.abs(shown.y - before.y - dy) < 1);
  }
  await assertEndpoints();
  if (expected === "cancel") {
    await page.keyboard.press("Escape");
    await page.mouse.up();
    assert.equal(requests.length, op);
    assert.deepEqual(await state(), prior);
    return;
  }
  const final = (await state())[id];
  await page.mouse.up();
  if (expected === "fail") {
    await page
      .getByRole("button", { name: "Tentar salvar novamente", exact: true })
      .waitFor();
    assert.deepEqual(
      (await state())[id],
      final,
      "Geometria do gesto fica preservada durante falha",
    );
    await page
      .getByRole("button", { name: "Tentar salvar novamente", exact: true })
      .click();
    await settled();
    assert.equal(requests[op].operationId, requests[op + 1].operationId);
  } else if (expected === "conflict") {
    await page
      .getByRole("button", {
        name: "Descartar alterações e recarregar",
        exact: true,
      })
      .click();
    await settled();
    assert.deepEqual(
      placements.find((p) => p.id === id),
      raw,
    );
    assert.equal(JSON.stringify(placements.filter((p) => p.id !== id)), others);
    return;
  } else await settled();
  const saved = placements.find((p) => p.id === id),
    input = requests[op].geometry;
  if (mode === "move" && saved.parentPlacementId) {
    assert.equal(saved.x, raw.x);
    assert.equal(saved.y, raw.y);
    assert.ok(requests[op].relative);
    const shown = (await state())[id];
    assert.ok(
      Math.abs(shown.x - final.x) < 0.01 && Math.abs(shown.y - final.y) < 0.01,
      "Intenção manual não é desfeita",
    );
  } else if (mode === "move") {
    assert.ok(Math.abs(saved.x - final.x) < 0.01);
    assert.ok(Math.abs(saved.y - final.y) < 0.01);
    const shown = (await state())[id];
    assert.ok(
      Math.abs(shown.x - final.x) < 0.01 && Math.abs(shown.y - final.y) < 0.01,
      "Reserva respeita a intenção manual confirmada: " +
        JSON.stringify({ id, shown, final }),
    );
  } else {
    assert.equal(saved.x, raw.x);
    assert.equal(saved.y, raw.y);
    assert.ok(saved.width > raw.width && saved.height > raw.height);
  }
  assert.equal(input.x, saved.x);
  assert.equal(input.y, saved.y);
  assert.equal(
    JSON.stringify(placements.filter((p) => p.id !== id)),
    others,
    "Nenhum deslocamento dos demais cards é persistido",
  );
  await assertEndpoints();
};
try {
  await page.goto("http://radial.test/");
  await page.getByRole("article", { name: names[0], exact: true }).waitFor();
  await settled();
  if (process.env.ARCHIVE_MOTION_EVIDENCE) {
    const { exerciseArchiveMotion } = await import(
      "./archive-motion-browser-scenarios.mjs"
    );
    await exerciseArchiveMotion({
      page,
      temp,
      names,
      uuid,
      toggle,
      calls,
      shot,
      world,
      requests,
      placements,
      links,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.getByRole("article", { name: names[0], exact: true }).waitFor();
    await settled();
  }
  assert.equal(
    await page
      .locator(".archive-page")
      .evaluate((el) => getComputedStyle(el, "::after").content),
    "none",
    "Sem moldura externa no Fichário",
  );
  await shot("radial-organizacao-original-global");
  const rootBox = await page
    .getByRole("article", { name: names[0], exact: true })
    .boundingBox();
  const beforeZoom = await calls();
  await page.mouse.move(
    rootBox.x + rootBox.width / 2,
    rootBox.y + rootBox.height / 2,
  );
  await page.mouse.wheel(0, -1100);
  await page.waitForTimeout(120);
  assert.equal(await calls(), beforeZoom);
  await shot("radial-recolhido");
  const savedBackground = await background();
  const savedCamera = await world(),
    readBefore = reads;
  await toggle(0, false);
  await page.waitForTimeout(150);
  let open = await state();
  assert.equal(await world(), savedCamera);
  assert.equal(
    await background(),
    savedBackground,
    "Expansão/recolhimento não altera o fundo",
  );
  assert.equal(reads, readBefore);
  assert.equal(requests.length, 0);
  assert.deepEqual(open[uuid(200)], { x: 0, y: 0, width: 300, height: 230 });
  assert.ok(
    [7, 8, 9, 10, 11, 17].some(
      (i) =>
        open[uuid(200 + i)].x !== placements[i].x ||
        open[uuid(200 + i)].y !== placements[i].y,
    ),
  );
  for (const i of [14, 15, 16])
    assert.deepEqual(open[uuid(200 + i)], {
      x: placements[i].x,
      y: placements[i].y,
      width: placements[i].width,
      height: placements[i].height,
    });
  assert.equal(
    await page.locator(".archive-layout-status").count(),
    0,
    "Demonstração suportada sem colisões residuais",
  );
  await assertEndpoints();
  await shot("radial-expandido-vizinhos");
  const factionPosition = open[uuid(211)];
  await toggle(11, false);
  await page.waitForTimeout(150);
  assert.deepEqual(
    (await state())[uuid(211)],
    factionPosition,
    "Novo núcleo ancora na posição visual que tinha ao abrir",
  );
  await shot("radial-dois-nucleos");
  await toggle(0, true);
  await page.waitForTimeout(100);
  assert.equal(await world(), savedCamera);
  assert.equal(
    await background(),
    savedBackground,
    "Expansão/recolhimento não altera o fundo",
  );
  await shot("radial-somente-faccao");
  await toggle(11, true);
  await page.waitForTimeout(100);
  assert.equal(JSON.stringify({ placements, links }), original);
  const restored = await state();
  for (const p of placements.filter((p) => !p.parentPlacementId))
    assert.deepEqual(restored[p.id], {
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
    });
  await shot("radial-restaurado");
  await toggle(0, false);
  assert.deepEqual(await state(), open, "Segunda expansão é idêntica");
  // Cinco amostras após aquecimento: evento até o segundo rAF (não é FPS/latência de produção).
  const expansionSamples = [];
  for (let i = 0; i < 5; i++)
    expansionSamples.push(
      await page.evaluate(
        (id) =>
          new Promise((resolve) => {
            const t = performance.now();
            document
              .querySelector(`[data-placement="${id}"] .archive-branch-toggle`)
              .click();
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve(performance.now() - t)),
            );
          }),
        uuid(200),
      ),
    );
  if (!(await page.locator(`[data-placement="${uuid(201)}"]`).count()))
    await toggle(0, false);
  assert.equal(requests.length, 0);
  assert.equal(JSON.stringify({ placements, links }), original);
  let visibleCandidate;
  // A área maior pode afastar todos os avulsos para além do zoom inicial da fixture.
  for (let attempt = 0; attempt < 4 && !visibleCandidate; attempt++) {
    visibleCandidate = await page.locator(".archive-card").evaluateAll(
      (els, ids) =>
        els.find((el) => {
          const b = el.querySelector("header").getBoundingClientRect();
          return (
            ids.includes(el.dataset.placement) &&
            b.x > 20 &&
            b.right < innerWidth - 20 &&
            b.y > 130 &&
            b.bottom < innerHeight - 170
          );
        })?.dataset.placement,
      [7, 8, 9, 10, 17].map((i) => uuid(200 + i)),
    );
    if (!visibleCandidate) {
      await page.mouse.move(30, 350);
      await page.mouse.wheel(0, 220);
      await page.waitForTimeout(100);
    }
  }
  assert.ok(visibleCandidate, "Há um vizinho deslocado acessível para o gesto");
  await saveGesture(visibleCandidate, "move", 23, 17, "cancel");
  failNext = true;
  await saveGesture(visibleCandidate, "move", 25, 18, "fail");
  conflictNext = true;
  await saveGesture(visibleCandidate, "move", -15, 15, "conflict");
  await saveGesture(visibleCandidate, "resize", 9, 8);
  await saveGesture(uuid(200), "move", 18, 12);
  await saveGesture(uuid(200), "resize", 9, 8);
  const branch = await page.locator(".archive-card").evaluateAll(
    (els, ids) =>
      els.find((el) => {
        const b = el.querySelector("header").getBoundingClientRect();
        return (
          ids.includes(el.dataset.placement) &&
          b.x > 20 &&
          b.right < innerWidth - 20 &&
          b.y > 130 &&
          b.bottom < innerHeight - 170
        );
      })?.dataset.placement,
    [1, 2, 3, 4, 5, 6].map((i) => uuid(200 + i)),
  );
  assert.ok(branch);
  await saveGesture(branch, "move", 12, 9);
  await saveGesture(branch, "resize", 8, 8);
  await saveGesture(branch, "move", 70, -40);
  await saveGesture(branch, "move", -45, 25);
  const vectorBeforeRoot = {
    x: placements.find((p) => p.id === branch).branchOffsetX,
    y: placements.find((p) => p.id === branch).branchOffsetY,
  };
  await saveGesture(uuid(200), "move", 20, 12);
  assert.deepEqual(
    {
      x: placements.find((p) => p.id === branch).branchOffsetX,
      y: placements.find((p) => p.id === branch).branchOffsetY,
    },
    vectorBeforeRoot,
  );

  // Consulta usa o snapshot integral, inclusive quando a representação é recolhida.
  const branchPlace = placements.find((p) => p.id === branch);
  const branchCard = cards.find((c) => c.id === branchPlace.cardId);
  branchCard.summary = "Resumo integral\nSegunda linha";
  branchCard.content =
    "Conteúdo narrativo completo\n<script>window.__unsafe=true</script>\n" +
    "Segredo de sessão. ".repeat(1500);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await page.waitForTimeout(120);
  await page.getByRole("button", { name: "Enquadrar", exact: true }).click();
  await page.waitForTimeout(400); // Não confundir o fim do resize anterior com duplo clique.
  await page.locator(`[data-placement="${branch}"] header`).dblclick();
  const reader = page.getByRole("complementary", {
    name: "Consulta narrativa",
  });
  await reader.waitFor();
  const readerBackground = await background();
  const readOps = requests.length,
    readHTTP = reads,
    readerCamera = await world(),
    readerCalls = await calls();
  assert.ok((await reader.textContent()).includes(branchCard.content));
  assert.equal(await page.evaluate(() => window.__unsafe), undefined);
  await shot("consulta-narrativa");
  await reader.getByRole("button", { name: "Relações", exact: true }).click();
  await reader
    .getByRole("button", { name: new RegExp(names[0]) })
    .first()
    .click();
  assert.ok((await reader.locator("h2").textContent()).includes(names[0]));
  await reader
    .getByRole("button", { name: "Voltar à consulta anterior" })
    .click();
  assert.equal(await reader.locator("h2").textContent(), branchCard.title);
  assert.equal(await calls(), readerCalls);
  assert.equal(await world(), readerCamera);
  assert.equal(
    await background(),
    readerBackground,
    "Consulta não altera textura/câmera",
  );
  assert.equal(requests.length, readOps);
  assert.equal(reads, readHTTP, "Leitura do snapshot não duplica HTTP");
  await saveGesture(branch, "move", 10, 7);
  assert.equal(
    await reader.locator("h2").textContent(),
    branchCard.title,
    "Movimento não troca o registro consultado",
  );
  await reader
    .getByRole("button", { name: "Fixar consulta", exact: true })
    .click();
  await page
    .locator(`[data-placement="${uuid(200)}"] .archive-card-copy`)
    .click();
  assert.equal(await reader.locator("h2").textContent(), names[0]);
  await reader
    .getByRole("button", { name: "Fixar consulta", exact: true })
    .click();
  await page.locator(`[data-placement="${branch}"]`).focus();
  await page.keyboard.press("Enter");
  assert.equal(await reader.locator("h2").textContent(), branchCard.title);
  const customOffset = {
    x: branchPlace.branchOffsetX,
    y: branchPlace.branchOffsetY,
  };
  await toggle(0, true);
  assert.equal(
    await reader.locator("h2").textContent(),
    branchCard.title,
    "Recolher não interrompe consulta",
  );
  await toggle(0, false);
  const currentState = await state(),
    pa = currentState[uuid(200)],
    ch = currentState[branch];
  assert.ok(
    Math.abs(ch.x + ch.width / 2 - pa.x - pa.width / 2 - customOffset.x) < 0.01,
  );
  assert.ok(
    Math.abs(ch.y + ch.height / 2 - pa.y - pa.height / 2 - customOffset.y) <
      0.01,
  );
  await reader
    .getByRole("button", { name: "Editar card", exact: true })
    .click();
  const cardEditor = page.getByRole("dialog", {
    name: "Card narrativo",
    exact: true,
  });
  await cardEditor.waitFor();
  assert.equal(await cardEditor.getAttribute("aria-modal"), "false");
  assert.ok(
    (await cardEditor.evaluate((el) => +getComputedStyle(el).zIndex)) >
      (await reader.evaluate((el) => +getComputedStyle(el).zIndex)),
    "Edição sobrepõe a consulta",
  );
  const previewOps = requests.length,
    previewCalls = await calls(),
    previewCamera = await world(),
    previewState = await state();
  const savedTitle = branchCard.title,
    savedSummary = branchCard.summary,
    savedCategory = branchCard.category;
  await cardEditor
    .getByLabel("Título", { exact: true })
    .fill("Título em prévia");
  await cardEditor
    .getByLabel("Categoria", { exact: true })
    .selectOption("faction");
  await cardEditor
    .getByLabel("Resumo", { exact: true })
    .fill("Resumo em prévia");
  const previewCard = page.locator(`[data-placement="${branch}"]`);
  assert.equal(
    await previewCard.locator("header strong").textContent(),
    "Título em prévia",
  );
  assert.equal(await previewCard.getAttribute("data-category"), "faction");
  assert.ok(
    (await previewCard.locator(".archive-card-copy").textContent()).includes(
      "Resumo em prévia",
    ),
  );
  assert.equal(
    branchCard.title,
    savedTitle,
    "Rascunho não altera snapshot confirmado",
  );
  assert.equal(requests.length, previewOps, "Digitar não grava no servidor");
  assert.equal(await calls(), previewCalls, "Digitar não executa resolvedor");
  assert.equal(await world(), previewCamera);
  assert.deepEqual(await state(), previewState);
  await shot("editor-lateral-previa");
  await page.mouse.move(30, 250);
  await page.mouse.down();
  await page.mouse.move(50, 260, { steps: 4 });
  await page.mouse.up();
  assert.notEqual(
    await world(),
    previewCamera,
    "Painel não bloqueia navegação do quadro",
  );
  assert.equal(requests.length, previewOps);
  assert.equal(await calls(), previewCalls);
  await cardEditor.getByLabel("Título", { exact: true }).fill(savedTitle);
  await cardEditor
    .getByLabel("Categoria", { exact: true })
    .selectOption(savedCategory);
  await cardEditor.getByLabel("Resumo", { exact: true }).fill(savedSummary);
  await page
    .getByLabel("Conteúdo narrativo", { exact: true })
    .fill("Texto confirmado da consulta\nLinha preservada");
  const contentSaveStart = requests.length;
  failNext = true;
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await cardEditor
    .getByRole("button", { name: "Tentar salvar novamente", exact: true })
    .waitFor();
  assert.equal(
    await cardEditor
      .getByLabel("Conteúdo narrativo", { exact: true })
      .inputValue(),
    "Texto confirmado da consulta\nLinha preservada",
  );
  await cardEditor
    .getByRole("button", { name: "Tentar salvar novamente", exact: true })
    .click();
  await settled();
  assert.equal(
    requests[contentSaveStart].operationId,
    requests[contentSaveStart + 1].operationId,
    "Retry do editor mantém idempotência",
  );
  assert.ok(
    (await reader.textContent()).includes("Texto confirmado da consulta"),
  );
  await reader
    .getByRole("button", { name: "Editar card", exact: true })
    .click();
  await page
    .getByLabel("Conteúdo narrativo", { exact: true })
    .fill("Rascunho cancelado");
  await cardEditor
    .getByLabel("Título", { exact: true })
    .fill("Título descartado");
  assert.equal(
    await previewCard.locator("header strong").textContent(),
    "Título descartado",
  );
  await page
    .getByRole("button", { name: "Fechar editor", exact: true })
    .click();
  assert.ok(!(await reader.textContent()).includes("Rascunho cancelado"));
  assert.equal(
    await previewCard.locator("header strong").textContent(),
    savedTitle,
    "Cancelar restaura a apresentação confirmada",
  );
  await reader
    .getByRole("button", { name: "Editar card", exact: true })
    .click();
  await cardEditor
    .getByLabel("Título", { exact: true })
    .fill("Rascunho via Escape");
  await page.keyboard.press("Escape");
  await cardEditor.waitFor({ state: "hidden" });
  await reader.waitFor();
  assert.equal(
    await previewCard.locator("header strong").textContent(),
    savedTitle,
  );
  await page.keyboard.press("Escape");
  await reader.waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: `Ações de ${branchCard.title}`, exact: true })
    .click();
  await chooseRadial("Consultar");
  await reader.waitFor();
  await reader.getByRole("button", { name: "Fechar consulta" }).click();
  await page.reload();
  await settled();
  await toggle(0, false);
  await page.getByRole("button", { name: "Enquadrar", exact: true }).click();
  const reloadedState = await state(),
    reloadedBranch = reloadedState[branch],
    reloadedRoot = reloadedState[uuid(200)];
  assert.ok(
    Math.abs(
      reloadedBranch.x +
        reloadedBranch.width / 2 -
        reloadedRoot.x -
        reloadedRoot.width / 2 -
        branchPlace.branchOffsetX,
    ) < 0.01,
    "Preferência sobrevive ao reload",
  );
  await page.locator(`[data-placement="${branch}"]`).focus();
  await page.keyboard.press("Enter");
  await reader.waitFor();
  branchCard.summary = "Atualização externa confirmada";
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await reader
    .getByText("Atualização externa confirmada", { exact: true })
    .waitFor();
  const removedIndex = placements.findIndex((p) => p.id === branch);
  placements.splice(removedIndex, 1);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await reader.waitFor({ state: "hidden" });
  placements.splice(removedIndex, 0, branchPlace);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await page.waitForTimeout(100);
  await page
    .getByRole("button", { name: `Ações de ${branchCard.title}`, exact: true })
    .click();
  await chooseRadial("Ramificações");
  await chooseRadial("Restaurar posição automática");
  await settled();
  assert.equal(branchPlace.branchOffsetX, null);
  await page.getByRole("button", { name: "Enquadrar", exact: true }).click();
  await saveGesture(branch, "move", 14, 8);
  await page
    .getByRole("button", { name: `Ações de ${names[0]}`, exact: true })
    .click();
  await chooseRadial("Ramificações");
  await chooseRadial("Restaurar distribuição automática");
  assert.ok(
    (await page.getByRole("dialog").textContent()).includes("1 posições"),
  );
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await settled();
  assert.equal(branchPlace.branchOffsetX, null);
  await shot("radial-gestos-confirmados");
  // Hit testing/radial usam a geometria orgânica. Conexões novas seguem o fluxo existente.
  await page
    .getByRole("button", { name: `Ações de ${names[0]}`, exact: true })
    .click();
  await chooseRadial("Ramificações");
  await chooseRadial("Criar ramificação");
  await chooseRadial("Criar anotação");
  await page
    .getByLabel("Título", { exact: true })
    .fill("Nova ramificação radial");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await settled();
  assert.equal(placements.at(-1).parentPlacementId, uuid(200));
  await shot("reserva-primeira-ramificacao");
  await page
    .getByRole("button", { name: `Ações de ${names[0]}`, exact: true })
    .click();
  await chooseRadial("Ramificações");
  await chooseRadial("Criar ramificação");
  await chooseRadial("Criar anotação");
  await page
    .getByLabel("Título", { exact: true })
    .fill("Segunda ramificação na área livre");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await settled();
  assert.equal(placements.at(-1).parentPlacementId, uuid(200));
  await shot("reserva-segunda-ramificacao");
  await toggle(0, true);
  await shot("reserva-restauracao");
  await toggle(0, false);
  await assertEndpoints();
  await page.getByRole("button", { name: "Enquadrar", exact: true }).click();
  const sourcePort = await page
    .getByRole("button", { name: `Conectar ${names[0]}`, exact: true })
    .boundingBox();
  const destination = await page
    .getByRole("article", { name: names[8], exact: true })
    .locator("header")
    .boundingBox();
  await page.mouse.move(
    sourcePort.x + sourcePort.width / 2,
    sourcePort.y + sourcePort.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.getByLabel("Tipo", { exact: true }).selectOption("knows");
  const linkCount = links.length;
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await settled();
  assert.equal(links.length, linkCount + 1);
  await assertEndpoints();
  const line = page.locator(`[data-link="${uuid(304)}"] .archive-link-hit`);
  const point = await line.evaluate((el) => {
    const p = el.getPointAtLength(el.getTotalLength() / 2),
      m = el.getScreenCTM();
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  });
  await page.mouse.click(point.x, point.y);
  assert.ok(
    await page
      .locator(`[data-link="${uuid(304)}"]`)
      .evaluate((el) => el.classList.contains("is-selected")),
  );
  await shot("radial-conexao-selecionada");
  const oldParent = placements[1].parentPlacementId;
  await page
    .getByRole("button", { name: `Ações de ${names[1]}`, exact: true })
    .click();
  await chooseRadial("Ramificações");
  await chooseRadial("Remover pertencimento");
  await settled();
  assert.equal(placements[1].parentPlacementId, null);
  placements[1].parentPlacementId = oldParent;
  boards[0].version++;
  const externalCamera = await world();
  placements[0].x += 90;
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await page.waitForTimeout(150);
  assert.equal(await world(), externalCamera);
  assert.ok(
    Math.abs((await state())[uuid(200)].x - placements[0].x) < 0.01,
    "Movimento externo invalida a âncora antiga",
  );
  await assertEndpoints();
  const beforeSwitch = await state();
  await page
    .getByLabel("Quadro narrativo", { exact: true })
    .selectOption(uuid(2));
  await page.waitForFunction(
    (id) => document.querySelector(".archive-toolbar select")?.value === id,
    uuid(2),
  );
  await page
    .getByLabel("Quadro narrativo", { exact: true })
    .selectOption(uuid(1));
  await page
    .getByRole("button", {
      name: `Recolher ramificações de ${names[0]}`,
      exact: true,
    })
    .waitFor();
  assert.deepEqual(await state(), beforeSwitch);
  await page.getByRole("button", { name: "Enquadrar", exact: true }).click();
  await shot("radial-enquadramento-visual");
  const recordedLayoutTimes = await page.evaluate(() =>
    window.__times?.slice(-20),
  );
  await page.reload();
  await settled();
  assert.equal(
    await page
      .getByRole("button", {
        name: `Expandir ramificações de ${names[0]}`,
        exact: true,
      })
      .count(),
    1,
  );
  assert.equal(
    await page.locator(`[data-placement="${uuid(201)}"]`).count(),
    0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await shot("radial-mobile");
  await page
    .getByRole("button", { name: `Ações de ${names[0]}`, exact: true })
    .click();
  await chooseRadial("Consultar");
  const mobileReader = page.getByRole("complementary", {
    name: "Consulta narrativa",
  });
  await mobileReader.waitFor();
  const mobileBox = await mobileReader.boundingBox();
  assert.ok(mobileBox.x >= 0 && mobileBox.x + mobileBox.width <= 390);
  await shot("consulta-mobile");
  await mobileReader
    .getByRole("button", { name: "Editar card", exact: true })
    .click();
  const mobileEditor = page.getByRole("dialog", {
    name: "Card narrativo",
    exact: true,
  });
  await mobileEditor.waitFor();
  const editorBox = await mobileEditor.boundingBox();
  assert.ok(editorBox.x >= 0 && editorBox.x + editorBox.width <= 390);
  await shot("editor-lateral-mobile");
  await mobileEditor.getByRole("button", { name: "Fechar editor" }).click();
  await mobileReader.waitFor();
  await mobileReader.getByRole("button", { name: "Fechar consulta" }).click();
  if (process.env.ARCHIVE_MULTILEVEL_EVIDENCE) {
    const { exerciseArchiveMultilevel } = await import(
      "./archive-multilevel-browser-scenarios.mjs"
    );
    await exerciseArchiveMultilevel({
      page,
      placements,
      links,
      names,
      uuid,
      requests,
      shot,
      state,
    });
  }
  if (process.env.ARCHIVE_STABILITY_EVIDENCE) {
    const probe = await page.evaluate(() => ({
      paints: window.__archivePaints,
      failures: window.__archiveDiscontinuities,
    }));
    assert.ok(archivedPaints + probe.paints > 20);
    assert.deepEqual([...archivedDiscontinuities, ...probe.failures], []);
    console.log(
      "Continuidade na API simulada: " +
        (archivedPaints + probe.paints) +
        " pinturas sem descontinuidades.",
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Radial no Chromium: âncoras, vizinhos, restauração, gestos, Escape, retry, conflito, estruturas, externo, quadros e celular passaram.",
  );
  console.log(
    "Amostras evento → segundo rAF (ms):",
    JSON.stringify(expansionSamples),
  );
  console.log("Amostras de cálculo no navegador:", recordedLayoutTimes);
  console.log("Evidências:", temp);
} catch (e) {
  await shot("falha");
  console.log("Diálogos:", await page.locator("dialog").allTextContents());
  console.log("Evidências:", temp);
  throw e;
} finally {
  await context.close();
  await browser.close();
}
