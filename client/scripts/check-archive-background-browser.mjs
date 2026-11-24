/** Chromium real. Textura e câmera reais, fixtures locais sem HTTP de campanha. */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const root = process.cwd(),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "arquivo-fundo-"));
await build({
  stdin: {
    contents: `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{ArchiveBackground}from'${root}/client/src/components/archive/ArchiveBackground';import{ArchiveCanvas}from'${root}/client/src/components/archive/ArchiveCanvas';import'${root}/client/src/components/archive/archive.css';
const card=(id,x)=>({id,cardId:id,boardId:'b',x,y:260,width:280,height:200,zIndex:0,card:{id,title:id,category:'note',summary:'Consulta e conexões legíveis',content:'',version:0}});
function Test(){const[camera,setCamera]=useState({x:0,y:0,zoom:1});const[visual,setVisual]=useState({});const[graph,setGraph]=useState({board:{id:'b',name:'Fundo',version:0},placements:[card('A',240),card('B',760)],links:[{id:'link',sourceId:'A',targetId:'B',relation:'related',directed:true,label:'',description:''}]});window.__setCamera=setCamera;window.__camera=camera;window.__moves=window.__moves??0;return <div className="archive-page">{location.pathname==='/texture'?<ArchiveBackground camera={camera}/>:<ArchiveCanvas graph={graph} camera={camera} onCamera={setCamera} selected={null} onSelect={()=>{}} onMenu={()=>{}} visual={visual} onVisual={setVisual} onMove={(id,g)=>{window.__moves++;setGraph(s=>({...s,placements:s.placements.map(p=>p.id===id?{...p,...g}:p)}));setVisual({})}} onConnect={()=>{}} busy={false} onInteraction={()=>{}}/>}</div>;}createRoot(document.getElementById('root')).render(<Test/>);`,
    resolveDir: root + "/client",
    loader: "tsx",
  },
  bundle: true,
  jsx: "automatic",
  external: ["/archive/*", "/creation/*"],
  outfile: dir + "/app.js",
});
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1672, height: 1000 },
  recordVideo: { dir, size: { width: 1280, height: 766 } },
});
const page = await context.newPage();
let imageRequests = 0;
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("http://fundo.test/**", async (r) => {
  const p = new URL(r.request().url()).pathname;
  if (p.includes("textura-linho")) imageRequests++;
  if (p.startsWith("/api")) throw Error("O teste não pode usar APIs");
  let f =
    p === "/app.js"
      ? dir + "/app.js"
      : p === "/app.css"
        ? dir + "/app.css"
        : p === "/styles.css"
          ? root + "/client/src/styles.css"
          : root + "/client/public" + p;
  if (p.endsWith(".css") && !fs.existsSync(f)) f = root + "/client/src" + p;
  if (fs.existsSync(f) && fs.statSync(f).isFile())
    return r.fulfill({ path: f });
  return r.fulfill({
    contentType: "text/html",
    body: '<html data-theme="dark"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/app.css"><style>body{margin:0}</style><div id="root"></div><script src="/app.js"></script></html>',
  });
});
const camera = () => page.evaluate(() => window.__camera);
const pattern = () =>
  page.locator(".archive-background pattern").getAttribute("patternTransform");
const assertCamera = async (c) => {
  const m = await page.locator(".archive-background pattern").evaluate((p) => {
    const m = p.patternTransform.baseVal.consolidate().matrix;
    return { a: m.a, d: m.d, e: m.e, f: m.f };
  });
  assert.ok(Math.abs(m.a - c.zoom) < 1e-6 && Math.abs(m.d - c.zoom) < 1e-6);
  const dx = (m.e - c.x) / (1254 * c.zoom),
    dy = (m.f - c.y) / (1254 * c.zoom);
  assert.ok(
    Math.abs(dx - Math.round(dx)) < 1e-5 &&
      Math.abs(dy - Math.round(dy)) < 1e-5,
    "Fase do fundo deve ser equivalente à câmera no espaço periódico",
  );
};
const setCamera = async (c) => {
  await page.evaluate((c) => window.__setCamera(c), c);
  await page.waitForFunction(
    (c) =>
      window.__camera.x === c.x &&
      window.__camera.y === c.y &&
      window.__camera.zoom === c.zoom,
    c,
  );
  await page.waitForTimeout(50);
};
const screenshot = (name) =>
  page.screenshot({ path: path.join(dir, name + ".png") });
try {
  await page.goto("http://fundo.test/canvas");
  await page.locator(".archive-card").first().waitFor();
  await page.waitForTimeout(200);
  const requests = imageRequests;
  assert.equal(
    await page.locator(".archive-background").getAttribute("aria-hidden"),
    "true",
  );
  assert.equal(
    await page
      .locator(".archive-background")
      .evaluate((el) => getComputedStyle(el).pointerEvents),
    "none",
  );
  await screenshot("fundo-inicial");
  for (const [dx, dy] of [
    [150, 90],
    [-240, 160],
    [70, -210],
  ]) {
    const before = await camera();
    await page.mouse.move(80, 100);
    await page.mouse.down();
    await page.mouse.move(80 + dx, 100 + dy, { steps: 12 });
    await page.mouse.up();
    const after = await camera();
    assert.equal(after.x, before.x + dx);
    assert.equal(after.y, before.y + dy);
    await assertCamera(after);
  }
  const beforeZoom = await camera();
  await page.mouse.move(500, 400);
  await page.mouse.wheel(0, -250);
  await page.waitForTimeout(100);
  const zoomed = await camera();
  assert.ok(zoomed.zoom > beforeZoom.zoom);
  await assertCamera(zoomed);
  await screenshot("fundo-zoom");
  await setCamera({ x: 0, y: 0, zoom: 1 });
  const beforeDrag = await pattern();
  const header = await page
    .locator('[data-placement="A"] header')
    .boundingBox();
  await page.mouse.move(header.x + 70, header.y + 30);
  await page.mouse.down();
  await page.mouse.move(header.x + 125, header.y + 55, { steps: 12 });
  assert.equal(await pattern(), beforeDrag);
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__moves), 1);
  assert.equal(await pattern(), beforeDrag);
  await screenshot("fundo-card-arrastado");
  await setCamera({ x: -987654.25, y: 654321.75, zoom: 0.37 });
  await screenshot("fundo-pan-longo");
  assert.equal(await page.locator(".archive-background").count(), 1);
  assert.equal(await page.locator(".archive-background *").count(), 5);
  assert.equal(
    imageRequests,
    requests,
    "Pan/zoom não requisita novamente a textura",
  );
  // A superfície periódica retorna exatamente à mesma fase após muitos tiles.
  await page.goto("http://fundo.test/texture");
  await page.waitForTimeout(200);
  const base = { x: 0.25, y: 0.75, zoom: 0.5 };
  await setCamera(base);
  const a = await page.screenshot();
  await setCamera({
    ...base,
    x: base.x + 1254 * 0.5 * 400,
    y: base.y - 1254 * 0.5 * 300,
  });
  const b = await page.screenshot();
  fs.writeFileSync(path.join(dir, "periodico-antes.png"), a);
  fs.writeFileSync(path.join(dir, "periodico-depois.png"), b);
  assert.ok(
    b.equals(a),
    "Pan periódico deve gerar exatamente os mesmos pixels (evidências antes/depois salvas)",
  );
  const seams = [];
  for (const zoom of [0.15, 0.5, 1, 1.25, 2.5]) {
    const c = { x: 193.25, y: 217.75, zoom };
    await setCamera(c);
    const name = "repeticao-zoom-" + String(zoom).replace(".", "-");
    await screenshot(name);
    const png = (await page.screenshot()).toString("base64");
    const stat = await page.evaluate(
      async ({ png, c }) => {
        const im = new Image();
        im.src = "data:image/png;base64," + png;
        await im.decode();
        const canvas = document.createElement("canvas");
        canvas.width = im.width;
        canvas.height = im.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(im, 0, 0);
        const d = ctx.getImageData(0, 0, im.width, im.height).data;
        const delta = (a, b) =>
          [0, 1, 2].reduce(
            (s, k) => s + Math.abs(d[a * 4 + k] - d[b * 4 + k]),
            0,
          ) / 3;
        const xSeams = [],
          ySeams = [];
        for (let n = -20; n < 25; n++) {
          const x = Math.round(c.x + n * 1254 * c.zoom),
            y = Math.round(c.y + n * 1254 * c.zoom);
          if (x > 1 && x < im.width - 2) xSeams.push(x);
          if (y > 1 && y < im.height - 2) ySeams.push(y);
        }
        let sx = 0,
          sy = 0,
          nx = 0,
          ny = 0;
        for (const x of xSeams)
          for (let y = 0; y < im.height; y++) {
            sx += delta(y * im.width + x, y * im.width + x - 1);
            nx++;
          }
        for (const y of ySeams)
          for (let x = 0; x < im.width; x++) {
            sy += delta(y * im.width + x, (y - 1) * im.width + x);
            ny++;
          }
        return {
          zoom: c.zoom,
          horizontal: sx / nx,
          vertical: sy / ny,
          boundariesX: xSeams.length,
          boundariesY: ySeams.length,
        };
      },
      { png, c },
    );
    assert.ok(
      stat.horizontal < 8 && stat.vertical < 8,
      "Não pode surgir linha de alto contraste no limite do tile",
    );
    seams.push(stat);
  }
  assert.deepEqual(errors, []);
  console.log(
    "Fundo: pan em várias direções, zoom, arraste independente, navegação extensa, periodicidade pixel a pixel e textura única passaram.",
  );
  console.log(
    "Saltos médios RGB nos limites dos tiles (0–255, não substituem inspeção visual):",
    JSON.stringify(seams),
  );
  console.log("Evidências:", dir);
} finally {
  await context.close();
  await browser.close();
}
