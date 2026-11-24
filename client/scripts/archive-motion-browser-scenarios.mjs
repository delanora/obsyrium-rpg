import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
/** Executada exclusivamente pelo harness HTTP em memória. */
export async function exerciseArchiveMotion({
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
}) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const root = page.getByRole("article", { name: names[0], exact: true });
  const box = await root.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1100);
  await page.waitForTimeout(150);
  const camera = await world(),
    writes = requests.length;
  await shot("ondas-01-recolhido");
  await page.clock.install();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 10).toISOString()),
  );
  await toggle(0, false);
  await page.clock.runFor(16);
  assert.equal(await page.locator('[data-motion="entry"]').count(), 6);
  await shot("ondas-02-inicio");
  const count = await calls();
  await page.clock.runFor(160);
  const presented = () =>
    page.locator(`[data-placement="${uuid(201)}"]`).evaluate((el) => ({
      transform: el.style.transform,
      opacity: Number(el.style.opacity),
      inert: el.inert,
    }));
  let mid = await presented();
  assert.ok(mid.opacity > 0 && mid.opacity < 1);
  assert.equal(mid.inert, true);
  await shot("ondas-03-intermediario");
  // Coerência de curvas e rótulos com os mesmos retângulos apresentados.
  assert.ok(
    await page.evaluate(() => {
      const cards = new Map(
        [...document.querySelectorAll("[data-card]")].map((el) => {
          const m = new DOMMatrix(el.style.transform),
            w = parseFloat(el.style.width),
            h = parseFloat(el.style.height);
          return [
            el.dataset.card,
            {
              x: parseFloat(el.style.left) + m.e + (w * (1 - m.a)) / 2,
              y: parseFloat(el.style.top) + m.f + (h * (1 - m.d)) / 2,
              w: w * m.a,
              h: h * m.d,
            },
          ];
        }),
      );
      return [...document.querySelectorAll("[data-link]")].every((el) => {
        const hit = el.querySelector(".archive-link-hit");
        const d = hit
          .getAttribute("d")
          .match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)
          .map(Number);
        const label = el.querySelector(".archive-relation-label"),
          m = label.transform.baseVal.consolidate().matrix;
        return (
          Math.abs(
            Number(label.dataset.originX) + m.e - (d[0] + 2 * d[2] + d[4]) / 4,
          ) < 0.02 &&
          Math.abs(
            Number(label.dataset.originY) + m.f - (d[1] + 2 * d[3] + d[5]) / 4,
          ) < 0.02 &&
          [...cards.values()].some(
            (r) =>
              d[0] >= r.x - 0.02 &&
              d[0] <= r.x + r.w + 0.02 &&
              d[1] >= r.y - 0.02 &&
              d[1] <= r.y + r.h + 0.02,
          )
        );
      });
    }),
  );
  // A consulta usa o card canônico enquanto a geometria continua interpolando.
  await root.focus();
  await page.keyboard.press("Enter");
  const reader = page.getByRole("complementary", {
    name: "Consulta narrativa",
  });
  await reader.waitFor();
  await page.clock.runFor(32);
  await reader.getByRole("button", { name: "Fechar consulta" }).click();
  mid = await presented();
  await toggle(0, true);
  const reversed = await presented();
  assert.equal(reversed.transform, mid.transform);
  assert.equal(reversed.opacity, mid.opacity);
  assert.equal(reversed.inert, true);
  await page.clock.runFor(120);
  await shot("ondas-04-recolhimento");
  await toggle(0, false);
  await page.clock.runFor(700);
  assert.equal(
    await page
      .locator(
        '[data-motion="entry"],[data-motion="exit"],[data-motion="move"]',
      )
      .count(),
    0,
  );
  assert.equal(
    await calls(),
    count + 2,
    "Apenas os dois toggles recalculam o layout",
  );
  assert.equal(await world(), camera, "Animação não altera a câmera");
  await shot("ondas-05-final");
  // Vários núcleos, zoom durante animação e cancelamento de gesto sem escrita.
  await toggle(11, false);
  await page.clock.runFor(130);
  await page.mouse.move(25, 350);
  await page.mouse.wheel(0, 30);
  await page.clock.runFor(30);
  const beforePan = await world();
  await page.mouse.move(25, 350);
  await page.mouse.down();
  await page.mouse.move(55, 380);
  await page.clock.runFor(16);
  await page.mouse.up();
  assert.notEqual(
    await world(),
    beforePan,
    "Pan segue independente durante animação",
  );
  const neighbor = page.locator(`[data-placement="${uuid(207)}"] header`),
    n = await neighbor.boundingBox();
  await page.mouse.move(n.x + 30, n.y + 20);
  await page.mouse.down();
  await page.mouse.move(n.x + 70, n.y + 30);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  const handle = page.locator(
    `[data-placement="${uuid(207)}"] .archive-resize.edge-se`,
  );
  const resize = await handle.boundingBox();
  await page.mouse.move(
    resize.x + resize.width / 2,
    resize.y + resize.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(resize.x + 35, resize.y + 25);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.clock.runFor(700);
  assert.equal(
    requests.length,
    writes,
    "Gestos cancelados e animações não persistem",
  );
  await toggle(0, true);
  await toggle(11, true);
  await page.clock.runFor(700);
  // Cem ciclos completos com RAF real e relógio controlado, sem esperas reais.
  for (let cycle = 0; cycle < 100; cycle++) {
    for (const expanding of [true, false]) {
      await page
        .getByRole("button", {
          name: `${expanding ? "Expandir" : "Recolher"} ramificações de ${names[0]}`,
          exact: true,
        })
        .evaluate((el) => el.click());
      await page.clock.runFor(700);
    }
  }
  assert.equal(
    await page.locator('[data-motion="exit"],[data-motion="entry"]').count(),
    0,
  );
  assert.equal(requests.length, writes);
  // Captura com relógio real para avaliar fluidez, além dos quadros determinísticos.
  await page.clock.resume();
  for (let i = 0; i < 3; i++) {
    await toggle(0, false);
    await page.waitForTimeout(750);
    await toggle(0, true);
    await page.waitForTimeout(650);
  }
  // Atualização externa durante entrada: remove somente a fixture em memória.
  const savedPlacements = structuredClone(placements),
    savedLinks = structuredClone(links);
  await toggle(0, false);
  await page.waitForTimeout(90);
  placements.splice(1, 1);
  links.splice(0, 1);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await page.waitForTimeout(750);
  assert.equal(
    await page.locator(`[data-placement="${uuid(201)}"]`).count(),
    0,
  );
  assert.equal(await page.locator(`[data-link="${uuid(300)}"]`).count(), 0);
  placements.splice(0, placements.length, ...structuredClone(savedPlacements));
  links.splice(0, links.length, ...savedLinks);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await page.waitForTimeout(150);
  // Preferência relativa preservada ao entrar e sair; somente fixture local.
  placements[1].branchOffsetX = -650;
  placements[1].branchOffsetY = -360;
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await page.waitForTimeout(120);
  await toggle(0, true);
  await page.waitForTimeout(700);
  await toggle(0, false);
  await page.waitForTimeout(700);
  assert.ok(
    await page.evaluate(
      ([r, c]) => {
        const root = document.querySelector(`[data-placement="${r}"]`),
          child = document.querySelector(`[data-placement="${c}"]`);
        return (
          Math.abs(
            parseFloat(child.style.left) -
              parseFloat(root.style.left) -
              (parseFloat(root.style.width) - parseFloat(child.style.width)) /
                2 +
              650,
          ) < 0.01 &&
          Math.abs(
            parseFloat(child.style.top) -
              parseFloat(root.style.top) -
              (parseFloat(root.style.height) - parseFloat(child.style.height)) /
                2 +
              360,
          ) < 0.01
        );
      },
      [uuid(200), uuid(201)],
    ),
  );
  placements.splice(0, placements.length, ...structuredClone(savedPlacements));
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await page.waitForTimeout(120);
  await toggle(0, true);
  await page.waitForTimeout(90);
  await page
    .getByLabel("Quadro narrativo", { exact: true })
    .selectOption(uuid(2));
  await page.waitForTimeout(100);
  assert.equal(
    await page.locator("[data-placement]").count(),
    0,
    "Troca de quadro elimina saídas pendentes",
  );
  await page
    .getByLabel("Quadro narrativo", { exact: true })
    .selectOption(uuid(1));
  await page.waitForTimeout(100);
  await toggle(0, false);
  await page.waitForTimeout(80);
  await page.reload();
  await page.getByRole("article", { name: names[0], exact: true }).waitFor();
  assert.equal(
    await page.locator(`[data-placement="${uuid(201)}"]`).count(),
    0,
    "Reload não ressuscita entrada temporária",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await toggle(0, false);
  assert.equal(
    await page.locator('[data-motion="entry"],[data-motion="exit"]').count(),
    0,
  );
  await toggle(0, true);
  assert.equal(
    await page.locator(`[data-placement="${uuid(201)}"]`).count(),
    0,
  );
  fs.writeFileSync(
    path.join(temp, "ondas-verificacoes.json"),
    JSON.stringify(
      {
        inversao: true,
        curvasRotulos: true,
        semEscritas: requests.length === writes,
        reducedMotion: true,
        layoutPorFrame: false,
      },
      null,
      2,
    ),
  );
  console.log(
    "Ondas no Chromium: entrada, saída, inversão, curvas/rótulos, múltiplos núcleos, 100 ciclos, externo, remoção, troca/reload, zoom, Escape, relógio real e reduced-motion passaram.",
  );
}
