/** Fixtures próprias, sem HTTP de campanha. Inspeciona cada pintura do scheduler. */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const root = process.cwd(),
  source = process.env.ARCHIVE_BASELINE_ROOT ?? root,
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "arquivo-estabilidade-"));
await build({
  stdin: {
    loader: "tsx",
    resolveDir: path.join(root, "client"),
    contents: `
import React,{useMemo,useRef,useState}from'react';import{createRoot}from'react-dom/client';import{ArchiveCanvas}from'${source}/client/src/components/archive/ArchiveCanvas';import{layoutArchive,ARCHIVE_LAYOUT_CONFIG}from'${source}/client/src/components/archive/archiveLayout';import{projectArchive}from'${source}/client/src/components/archive/archiveProjection';import'${source}/client/src/components/archive/archive.css';
const place=(id,parent,x,y,w=280,h=200)=>({id,cardId:id,boardId:'test',parentPlacementId:parent,x,y,width:w,height:h,zIndex:0,card:{id,title:id,category:'note',summary:'Fixture isolada de continuidade',content:'',version:0,createdAt:'',updatedAt:''}});
const initial={board:{id:'test',name:'Reserva isolada',description:'',version:0,createdAt:'',updatedAt:''},placements:[place('root',null,0,0),...Array.from({length:4},(_,i)=>place('child'+i,'root',0,0)),place('neighbor',null,760,0),place('chain',null,1080,0),place('far',null,8000,8000),place('other',null,-1200,600),place('other-child','other',-1200,600)],links:Array.from({length:4},(_,i)=>({id:'link'+i,sourceId:'root',targetId:'child'+i,relation:'related',label:'Vínculo',description:'',directed:true,version:0}))};
function App(){const[graph,setGraph]=useState(initial),[expanded,setExpanded]=useState(new Set()),[visual,setVisual]=useState({}),[camera,onCamera]=useState({x:800,y:450,zoom:.65}),[margin,setMargin]=useState(ARCHIVE_LAYOUT_CONFIG.reserveMargin),[busy,setBusy]=useState(false);const projection=useMemo(()=>projectArchive(graph,expanded),[graph,expanded]);const layout=useMemo(()=>{window.__calls=(window.__calls??0)+1;return layoutArchive(projection,{config:{reserveMargin:margin}})},[projection,margin]);window.__defaultMargin=ARCHIVE_LAYOUT_CONFIG.reserveMargin;window.__layout=layout;window.__raw=graph;window.__visual=visual;window.__toggle=id=>setExpanded(v=>{const n=new Set(v);n.has(id)?n.delete(id):n.add(id);return n});window.__margin=setMargin;window.__reset=()=>{setExpanded(new Set());setGraph(structuredClone(initial));setVisual({})};window.__add=()=>setGraph(v=>({...v,placements:[...v.placements,place('new'+v.placements.length,'root',0,0)]}));window.__external=g=>setGraph(g);
return <ArchiveCanvas graph={layout.graph} layout={layout} snapshot={graph} nodes={projection.nodes} onToggle={window.__toggle} camera={camera} onCamera={onCamera} selected={null} onSelect={()=>{}} onMenu={()=>{}} visual={visual} onVisual={setVisual} onMove={(id,g)=>{window.__writes=(window.__writes??0)+1;setBusy(true);setTimeout(()=>{setGraph(v=>({...v,placements:v.placements.map(p=>p.id===id?{...p,...g}:p)}));setVisual({});setBusy(false)},120)}} onConnect={()=>{}} busy={busy} onInteraction={()=>{}}/>;}
window.__probeCalls=0;window.__frames=[];window.__maxPoses=0;window.__lastPoseCount=0;window.__paintProbe=({poses,visual,layout})=>{window.__probeCalls++;window.__maxPoses=Math.max(window.__maxPoses,poses.size);window.__lastPoseCount=poses.size;for(const el of document.querySelectorAll('[data-placement]')){const id=el.dataset.placement,p=visual[id]??poses.get(id);if(!p){if(layout&&!layout.geometry.has(id)&&Number(el.style.opacity)>.001)window.__frames.push({kind:'exit-reappeared',id,opacity:el.style.opacity,transform:el.style.transform});continue;}const m=new DOMMatrix(el.style.transform),x=parseFloat(el.style.left)+m.e,y=parseFloat(el.style.top)+m.f;if(Math.abs(x-p.x)>.02||Math.abs(y-p.y)>.02)window.__frames.push({kind:'geometry-discontinuity',stage:window.__stage,id,x,y,expectedX:p.x,expectedY:p.y});}};
createRoot(document.getElementById('root')).render(<App/>);`,
  },
  bundle: true,
  jsx: "automatic",
  external: ["/archive/*", "/creation/*"],
  outfile: path.join(dir, "app.js"),
  plugins: [
    {
      name: "probe-pintura",
      setup(b) {
        b.onLoad({ filter: /useArchiveMotion\.ts$/ }, (a) => ({
          loader: "ts",
          contents: fs
            .readFileSync(a.path, "utf8")
            .replace(
              /\n    };\n    (?=const mounted|r.retained)/,
              "\n      window.__paintProbe?.({poses:r.poses,visual:latest.current.visual,layout:latest.current.layout});\n    };\n    ",
            ),
        }));
      },
    },
  ],
});
const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  }),
  context = await browser.newContext({
    viewport: { width: 1900, height: 1100 },
    recordVideo: { dir, size: { width: 1280, height: 740 } },
  }),
  page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("http://stability.test/**", (r) => {
  const p = new URL(r.request().url()).pathname;
  if (p.startsWith("/api")) throw Error("API proibida");
  const f =
    p === "/app.js" || p === "/app.css"
      ? path.join(dir, p)
      : p === "/style.css"
        ? path.join(root, "client/src/styles.css")
        : path.join(root, "client/public", p);
  if (fs.existsSync(f) && fs.statSync(f).isFile())
    return r.fulfill({ path: f });
  return r.fulfill({
    contentType: "text/html",
    body: '<html data-theme="dark"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><style>html,body,#root{margin:0;width:100%;height:100%}.archive-viewport{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-height:0!important;border:0!important}</style><div id="root"></div><script src="/app.js"></script></html>',
  });
});
const shot = (n) => page.screenshot({ path: path.join(dir, n + ".png") });
try {
  await page.goto("http://stability.test/");
  await page.waitForFunction(() => window.__toggle);
  await shot("01-recolhido");
  await page.evaluate(() => {
    window.__stage = "expand-initial";
    window.__toggle("root");
  });
  await page.waitForTimeout(750);
  await shot("02-expandido");
  const initialGeometry = await page.evaluate(() =>
    Object.fromEntries(window.__layout.geometry),
  );
  for (const margin of [160, 280, 360, 560]) {
    await page.evaluate((m) => {
      window.__stage = "margin-" + m;
      window.__margin(m);
    }, margin);
    await page.waitForTimeout(700);
    await shot("margem-" + margin);
  }
  await page.evaluate(() => window.__margin(window.__defaultMargin));
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.__stage = "growth-one";
    window.__add();
  });
  await page.waitForTimeout(750);
  await shot("crescimento-primeiro");
  await page.evaluate(() => {
    window.__stage = "growth-two";
    window.__add();
  });
  await page.waitForTimeout(750);
  await shot("crescimento-segundo");
  await page.evaluate(() => window.__toggle("other"));
  await page.waitForTimeout(750);
  await shot("dois-nucleos");
  await page.evaluate(() => window.__toggle("other"));
  await page.waitForTimeout(750);
  for (const id of ["neighbor", "root"]) {
    await page.evaluate((id) => (window.__stage = "move-" + id), id);
    await page.evaluate(() => {
      window.__toggle("other");
    });
    await page.waitForTimeout(100);
    const identity = await page
      .locator('[data-placement="' + id + '"]')
      .elementHandle();
    const header = page.locator('[data-placement="' + id + '"] header'),
      box = await header.boundingBox();
    await page.mouse.move(box.x + 35, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + 45, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    assert.ok(
      await identity.evaluate(
        (el, id) =>
          el === document.querySelector('[data-placement="' + id + '"]'),
        id,
      ),
      "Movimento/ACK preserva identidade DOM",
    );
    await identity.dispose();
  }
  await shot("03-movimento");
  await page.evaluate(() => {
    window.__stage = "collapse-final";
    window.__toggle("root");
  });
  await page.waitForTimeout(800);
  await shot("04-restaurado");
  const writesBeforeCancel = await page.evaluate(() => window.__writes ?? 0);
  for (const kind of ["escape", "blur"]) {
    const box = await page
      .locator('[data-placement="root"] header')
      .boundingBox();
    await page.evaluate((k) => (window.__stage = "cancel-" + k), kind);
    await page.mouse.move(box.x + 25, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 55, box.y + 35, { steps: 4 });
    if (kind === "escape") await page.keyboard.press("Escape");
    else await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
  assert.equal(
    await page.evaluate(() => window.__writes ?? 0),
    writesBeforeCancel,
    "Cancelamentos não escrevem",
  );
  // Relógio controlado cobre cada frame do fim, incluindo a pintura anterior ao commit React.
  await page.clock.install();
  await page.clock.pauseAt(
    await page.evaluate(() => new Date(Date.now() + 10).toISOString()),
  );
  for (let cycle = 0; cycle < 100; cycle++) {
    await page.evaluate((i) => (window.__stage = "cycle-" + i), cycle);
    await page.evaluate(() => window.__toggle("root"));
    await page.clock.runFor(700);
    await page.evaluate(() => window.__toggle("root"));
    await page.clock.runFor(700);
  }
  // Fronteiras exatas, reversão tardia e mudança de reduced-motion durante a saída.
  await page.evaluate(() => {
    window.__stage = "boundary";
    window.__toggle("root");
  });
  await page.clock.runFor(700);
  await page.evaluate(() => window.__toggle("root"));
  await page.clock.runFor(319);
  await shot("saida-antes-320");
  await page.clock.runFor(1);
  await shot("saida-em-320");
  await page.clock.runFor(300);
  await page.evaluate(() => window.__toggle("root"));
  await page.clock.runFor(700);
  await page.evaluate(() => window.__toggle("root"));
  await page.clock.runFor(310);
  await page.evaluate(() => window.__toggle("root"));
  await page.clock.runFor(700);
  await page.evaluate(() => window.__toggle("root"));
  await page.clock.runFor(90);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(700);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const result = await page.evaluate(() => ({
    failures: window.__frames,
    calls: window.__calls,
    writes: window.__writes ?? 0,
    probeCalls: window.__probeCalls,
    maxPoses: window.__maxPoses,
    finalPoses: window.__lastPoseCount,
    visible: document.querySelectorAll("[data-placement]").length,
  }));
  result.initialGeometry = initialGeometry;
  fs.writeFileSync(
    path.join(dir, "continuidade.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(
    "Continuidade:",
    JSON.stringify({
      failures: result.failures.length,
      examples: result.failures.slice(0, 4),
      calls: result.calls,
      writes: result.writes,
    }),
  );
  assert.equal(
    result.finalPoses,
    result.visible,
    "Sem poses órfãs após os ciclos",
  );
  assert.ok(result.probeCalls > 200, "Probe de cada pintura está ativo");
  if (!process.env.ARCHIVE_REPRODUCE) assert.deepEqual(result.failures, []);
  assert.deepEqual(errors, []);
  console.log("Evidências:", dir);
} finally {
  await context.close();
  await browser.close();
}
