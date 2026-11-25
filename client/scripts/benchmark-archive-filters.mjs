/** Custo incremental dos filtros no Chromium; fixtures sintéticas, sem rede de campanha. */
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const root = process.cwd(),
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "arquivo-filtros-perf-"));
await build({
  stdin: {
    resolveDir: path.join(root, "client"),
    loader: "tsx",
    contents: `
import React,{useMemo,useState,Profiler}from'react';import{createRoot}from'react-dom/client';import{ArchiveCanvas}from'${root}/client/src/components/archive/ArchiveCanvas';import{projectArchive}from'${root}/client/src/components/archive/archiveProjection';import{layoutArchive}from'${root}/client/src/components/archive/archiveLayout';import{filterArchive}from'${root}/client/src/components/archive/archiveFilters';import'${root}/client/src/components/archive/archive.css';
const groups=[{id:'a',name:'Grupo A',color:'#DDAA55',version:0},{id:'b',name:'Grupo B',color:'#6699AA',version:0}];const empty={};const noop=()=>{};
function App(){const[n,setN]=useState(50),[state,setFilter]=useState({groupIds:[],match:'any',mode:'highlight'}),[camera,onCamera]=useState({x:300,y:300,zoom:.5});
const graph=useMemo(()=>({board:{id:'board',name:'Fixture',description:'',version:0,createdAt:'',updatedAt:''},groups,placements:Array.from({length:n},(_,i)=>({id:'p'+i,cardId:'c'+i,boardId:'board',parentPlacementId:i>0&&i<5?'p0':null,x:i<5?0:(i%20)*400,y:i<5?0:Math.floor(i/20)*300,width:280,height:200,zIndex:0,card:{id:'c'+i,title:'Card '+i,category:'note',summary:'Conteúdo sintético',content:'',version:0,groups:groups.filter((_,j)=>i%(j+2)===0)}})),links:Array.from({length:n-1},(_,i)=>({id:'l'+i,sourceId:'c0',targetId:'c'+(i+1),relation:'related',label:'Relacionado',description:'',directed:true,version:0}))}),[n]);
const projection=useMemo(()=>projectArchive(graph,new Set(['p0'])),[graph]);const layout=useMemo(()=>{window.__layouts=(window.__layouts??0)+1;return layoutArchive(projection)},[projection]);const filter=useMemo(()=>{const t=performance.now();const f=filterArchive(graph,projection,state);window.__filterMs=performance.now()-t;return f},[graph,projection,state]);window.__configure=setN;window.__filter=setFilter;window.__pan=()=>onCamera(c=>({...c,x:c.x+5,y:c.y+5,zoom:c.zoom===.5?.55:.5}));window.__geometry=JSON.stringify([...layout.geometry]);
return <Profiler id="canvas" onRender={(_,__,actual)=>{(window.__react??=[]).push(actual)}}><ArchiveCanvas graph={layout.graph} snapshot={graph} layout={layout} nodes={projection.nodes} filter={filter} camera={camera} onCamera={onCamera} onToggle={noop} selected={null} onSelect={noop} onMenu={noop} visual={empty} onVisual={noop} onMove={noop} onConnect={noop} onInteraction={noop} busy={false}/></Profiler>};createRoot(document.getElementById('root')).render(<App/>);
`,
  },
  bundle: true,
  jsx: "automatic",
  external: ["/archive/*", "/creation/*"],
  outfile: path.join(temp, "app.js"),
});
const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  }),
  page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    reducedMotion: "reduce",
  }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("http://filter-perf.test/**", (route) => {
  const p = new URL(route.request().url()).pathname;
  assert.ok(!p.startsWith("/api"), "Benchmark não deve fazer HTTP");
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
    body: '<html data-theme="dark"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><style>html,body,#root{margin:0;width:100%;height:100%}.archive-viewport{position:fixed;inset:0}</style><div id="root"></div><script src="/app.js"></script></html>',
  });
});
try {
  await page.goto("http://filter-perf.test/");
  await page.waitForFunction(() => window.__filter);
  const results = [];
  for (const n of [50, 100, 200, 500]) {
    await page.evaluate((n) => window.__configure(n), n);
    await page.waitForTimeout(400);
    for (const mode of [
      "none",
      "highlight-any",
      "highlight-all",
      "isolate-any",
      "isolate-all",
    ]) {
      const measurements = [];
      for (let cycle = 0; cycle < 3; cycle++)
        measurements.push(
          await page.evaluate(async (mode) => {
            const before = window.__layouts,
              geometry = window.__geometry,
              reactAt = (window.__react ?? []).length,
              long = [];
            const o = new PerformanceObserver((list) =>
              long.push(...list.getEntries().map((e) => e.duration)),
            );
            o.observe({ type: "longtask", buffered: false });
            const start = performance.now();
            window.__filter({
              groupIds: mode === "none" ? [] : ["a", "b"],
              match: mode.endsWith("all") ? "all" : "any",
              mode: mode.startsWith("isolate") ? "isolate" : "highlight",
            });
            await new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            );
            const filterEventMs = performance.now() - start;
            window.__pan();
            await new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            );
            o.disconnect();
            return {
              filterEventMs,
              filterCpuMs: window.__filterMs,
              reactMs: window.__react.slice(reactAt),
              longTasks: long,
              layouts: window.__layouts - before,
              sameGeometry: geometry === window.__geometry,
            };
          }, mode),
        );
      assert.ok(measurements.every((m) => m.layouts === 0 && m.sameGeometry));
      results.push({ n, mode, measurements });
    }
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(temp, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
  console.log("Benchmark sem recálculo espacial/HTTP; evidências:", temp);
} finally {
  await browser.close();
}
