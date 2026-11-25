import assert from "node:assert/strict";
/** Usa apenas o backend em memória do harness, com hierarquia de cinco níveis. */
export async function exerciseArchiveMultilevel({
  page,
  placements,
  links,
  names,
  uuid,
  requests,
  shot,
  state,
}) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  for (let i = 1; i <= 4; i++) placements[i].parentPlacementId = uuid(199 + i);
  await page.reload();
  await page
    .getByRole("button", {
      name: `Expandir ramificações de ${names[0]}`,
      exact: true,
    })
    .waitFor();
  const click = async (i) =>
    page
      .getByRole("button", { name: new RegExp(`ramificações de ${names[i]}$`) })
      .evaluate((el) => el.click());
  const rootBox = await page
    .locator(`[data-placement="${uuid(200)}"]`)
    .boundingBox();
  await page.mouse.move(
    rootBox.x + rootBox.width / 2,
    rootBox.y + rootBox.height / 2,
  );
  await page.mouse.wheel(0, -650);
  await page.waitForTimeout(150);
  // Sequência em tempo real para a gravação, além do relógio controlado abaixo.
  for (let i = 0; i < 4; i++) {
    await click(i);
    await page.waitForTimeout(750);
    await shot("multinivel-real-" + i);
  }
  // Arraste real do ancestral com cinco níveis abertos, ACK pelo mock.
  const beforeDrag = await state();
  const header = await page
    .locator(`[data-placement="${uuid(200)}"] header`)
    .boundingBox();
  await page.mouse.move(
    header.x + header.width / 2,
    header.y + header.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    header.x + header.width / 2 + 24,
    header.y + header.height / 2 + 16,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.waitForTimeout(850);
  const afterDrag = await state();
  const dx = afterDrag[uuid(200)].x - beforeDrag[uuid(200)].x;
  assert.ok(Math.abs(dx) > 1);
  assert.ok(
    Math.abs(afterDrag[uuid(201)].x - beforeDrag[uuid(201)].x - dx) < 0.02,
  );
  await shot("multinivel-real-ancestral-arrastado");
  await click(0);
  await page.waitForTimeout(750);
  await page.clock.install();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 10).toISOString()),
  );
  const writes = requests.length;
  for (let i = 0; i < 4; i++) {
    const button = page.getByRole("button", {
      name: new RegExp(`ramificações de ${names[i]}$`),
    });
    if ((await button.getAttribute("aria-expanded")) !== "true") await click(i);
    await page.clock.runFor(720);
  }
  assert.equal(
    await page.locator(`[data-placement="${uuid(204)}"]`).count(),
    1,
  );
  await shot("multinivel-01-cinco-niveis");
  let full = await state();
  // Snapshot autoritativo desloca o ancestral enquanto os níveis internos estão abertos.
  const rootPlacement = placements.find((p) => p.id === uuid(200));
  rootPlacement.x += 200;
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await page.waitForTimeout(150);
  await page.clock.runFor(720);
  const translated = await state();
  assert.ok(Math.abs(translated[uuid(201)].x - full[uuid(201)].x - 200) < 0.02);
  full = translated;
  await shot("multinivel-01b-ancestral-movido");
  for (let cycle = 0; cycle < 100; cycle++) {
    await click(0);
    await page.clock.runFor(90);
    await click(0);
    await page.clock.runFor(720);
    for (let i = 1; i <= 3; i++)
      assert.equal(
        await page
          .getByRole("button", {
            name: `Recolher ramificações de ${names[i]}`,
            exact: true,
          })
          .count(),
        1,
      );
    assert.deepEqual(await state(), full);
  }
  assert.equal(requests.length, writes, "Expansão lógica não escreve HTTP");
  await click(0);
  await page.clock.runFor(720);
  assert.equal(
    await page.locator(`[data-placement="${uuid(204)}"]`).count(),
    0,
  );
  await shot("multinivel-02-ancestral-recolhido");
  await click(0);
  await page.clock.runFor(720);
  assert.deepEqual(await state(), full);
  await shot("multinivel-03-reaberto");
  await page.clock.resume();
  // Remoção autoritativa enquanto o ancestral está fechado, sem snapshot antigo.
  await click(0);
  await page.waitForTimeout(720);
  const tip = placements.findIndex((p) => p.id === uuid(204));
  placements.splice(tip, 1);
  for (let i = links.length - 1; i >= 0; i--)
    if (links[i].sourceId === uuid(104) || links[i].targetId === uuid(104))
      links.splice(i, 1);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("obsyrium:archive-changed")),
  );
  await page.waitForTimeout(300);
  await click(0);
  await page.waitForTimeout(720);
  assert.equal(
    await page.locator(`[data-placement="${uuid(204)}"]`).count(),
    0,
  );
  await shot("multinivel-04-remocao-oculta");
  console.log(
    "Multinível Chromium: cinco níveis, 100 reversões ancestrais, memória lógica, sem drift/HTTP e remoção oculta passaram.",
  );
}
